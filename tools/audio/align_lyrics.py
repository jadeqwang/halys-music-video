"""Word-level lyric timings: Whisper estimates -> the true lyric words -> snapped to lead-vocal onsets.

usage:  python tools/audio/align_lyrics.py
reads:  tools/audio/whisper/*.json (Cloudflare Whisper passes, see whisper_cf.py), media/stems/vocals_lead.wav
writes: media/stems/analysis/lyrics_aligned.json   (consumed by build_outputs.py)

1. every Whisper pass is aligned to the true word sequence (lyrics.LINES) with Needleman-Wunsch on a fuzzy
   word similarity (character ratio + a small alias table for Suno's sung spellings / Whisper's mishearings:
   "hairlies" = Halys, "mates" = Medes, "tealight" = Daylight, "slow" = Throw, "plate" = blade, "dailies" = Thales ...);
2. each true word gets the median start of the passes that matched it (lead-stem passes preferred);
3. starts are snapped to lead-vocal onsets (mel flux peaks + voiced onsets after a breath) by a per-line DP
   that trades distance to the Whisper estimate against onset strength, keeping words in order >= 60 ms apart;
4. ends: next word's start, or the voiced offset when the singer breathes / holds the last note of a line.
Places where Whisper is known to be unreliable (a word after a long held note) get evidence-based estimates in
OVERRIDE (each one is explained there); the DP still snaps them to an actual onset.
"""
import difflib
import json
import pathlib
import re
import sys

import librosa
import numpy as np
import soundfile as sf
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import lyrics as LY  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]
WH = ROOT / "tools" / "audio" / "whisper"
OUT = ROOT / "media" / "stems" / "analysis" / "lyrics_aligned.json"

# (file, weight): prompted lead-stem passes first, then the older full-song passes
PASSES = [("lead_v1", 1.0), ("lead_v2", 1.0), ("full_mdx", 0.6), ("../../../media/tests/whisper_first120s", 0.6),
          ("np_spark_mix", 0.8)]
# coarse windows (s) per section: a pass's words are only matched against that section's true words
WINDOWS = {"verse1": (66.0, 89.35), "pre1": (89.0, 96.4), "chorus1": (96.0, 111.0), "verse2": (159.5, 175.0),
           "shadow": (174.8, 182.0), "thales": (181.5, 200.0), "chorus2": (199.8, 216.5)}
ALIAS = {"hairlies": "halys", "hae": "halys", "mates": "medes", "tealight": "daylight", "slow": "throw",
         "plate": "blade", "dailies": "thales", "guide": "god", "worry": "warriors", "warrior's": "warriors",
         "art": "awed", "odd": "awed", "set": "sunlight", "splash": "spark", "turn": "turned", "from": "went"}

# Whisper puts the start of a word that follows a long held note / breath far too early (it ends the previous
# word late and starts the next one early). For these the estimate comes from the lead stem itself
# (voiced onset after the breath, read off the spectrogram) -- the DP below still snaps them to an onset.
OVERRIDE = {
    ("verse1", 0, "The"): 67.50,      # first sung sound; Whisper says 67.0-67.14 (inside the silence before it)
    ("verse1", 2, "Sun"): 81.50,      # passes disagree (81.46 / 81.80 / 82.18); lead-stem dip at 81.45, note starts 81.5
    ("chorus1", 0, "Daylight"): 96.55,  # lead_v1 "Tealight@96.12" starts inside the held "god"
    ("chorus1", 1, "eye"): 100.20,     # "Eye@98.78-100.50": the vowel enters at 100.2 after the breath at 99-100
    ("thales", 1, "Warriors"): 188.60,  # "Warriors@187.60": breath/silence 187.65-188.55 in the lead stem
    ("thales", 1, "a"): 193.25,        # the "[rest, rest]" (192.75-193.1) precedes "a sudden spark"
    ("thales", 1, "sudden"): 193.62,   # sung ONCE: the prompted passes hallucinate 2 repeats over the held note
    ("thales", 1, "spark"): 194.75,    # "sp" burst at 194.75, then the vowel is held ~5 s (unprompted: splash@194.54)
    ("chorus2", 0, "Shadow"): 200.30,   # unprompted mix pass: Shadow@200.26; 194.9-200.2 is the held "spaaark"
    ("chorus2", 1, "Sunlight"): 204.82,  # Whisper 203.46-203.50 is inside "day"; lead silent 204.2-204.8, onset 204.82
    ("chorus2", 2, "Throw"): 208.62,   # lead_v2 "Throw@206.98-209.10"; lead silent 207.7-208.6, onset 208.62
    ("chorus2", 3, "Home"): 211.75,    # "blade" is held through the beat-held-back bar (209.9-211.7); "h" at 211.75
}


def norm(w):
    w = w.lower().strip().strip(".,!?;:\"()…-")
    return ALIAS.get(w, w)


def sim(a, b):
    if a == b:
        return 1.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def nw(seq_true, seq_pass, gap=-0.4):
    """Needleman-Wunsch: returns list of (i_true, j_pass) matches with similarity >= 0.5."""
    n, m = len(seq_true), len(seq_pass)
    S = np.zeros((n + 1, m + 1))
    P = np.zeros((n + 1, m + 1), dtype=np.int8)
    S[1:, 0] = gap * np.arange(1, n + 1)
    S[0, 1:] = gap * np.arange(1, m + 1)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            s = sim(seq_true[i - 1], seq_pass[j - 1])
            c = (S[i - 1, j - 1] + (s * 2 - 0.8), S[i - 1, j] + gap, S[i, j - 1] + gap)
            k = int(np.argmax(c))
            S[i, j], P[i, j] = c[k], k
    i, j, out = n, m, []
    while i > 0 and j > 0:
        if P[i, j] == 0:
            if sim(seq_true[i - 1], seq_pass[j - 1]) >= 0.5:
                out.append((i - 1, j - 1))
            i, j = i - 1, j - 1
        elif P[i, j] == 1:
            i -= 1
        else:
            j -= 1
    return out[::-1]


def true_words():
    out = []
    for li, (sec, text) in enumerate(LY.LINES):
        for wi, w in enumerate(LY.words(text)):
            out.append(dict(line=li, sec=sec, wi=wi, text=w, key=norm(w.replace("exchange-", "exchanging"))))
    return out


def vocal_features():
    y, sr = sf.read(ROOT / "media" / "stems" / "vocals_lead.wav", dtype="float32")
    y = y.mean(1)
    hop = 240  # 5 ms
    M = librosa.feature.melspectrogram(y=y, sr=sr, n_fft=1024, hop_length=hop, n_mels=80, fmin=150, fmax=6000)
    L = librosa.power_to_db(M, ref=np.max, top_db=80)
    t = np.arange(L.shape[1]) * hop / sr
    flux = np.zeros(L.shape[1])
    flux[2:] = np.maximum(L[:, 2:] - L[:, :-2], 0).mean(0)
    flux = gaussian_filter1d(flux, 1.5)
    rdb = 20 * np.log10(librosa.feature.rms(y=y, frame_length=1024, hop_length=hop)[0][:len(t)] + 1e-9)
    rdb_s = gaussian_filter1d(rdb, 3)
    return t, flux, rdb_s


def onset_candidates(t, flux, rdb, thr=-36.0):
    dt = t[1] - t[0]
    from scipy.ndimage import percentile_filter
    loc = percentile_filter(flux, 95, size=int(3.0 / dt), mode="nearest")
    pk, _ = find_peaks(flux, distance=int(0.06 / dt), prominence=0.15)
    cand = {round(float(t[p]), 3): float(np.clip(flux[p] / (loc[p] + 1e-9), 0, 1.5)) for p in pk if rdb[p] > thr - 12}
    # voiced onsets after >= 100 ms below threshold (breaths, rests): strong, reliable phrase starts
    v = rdb > thr
    i, n = 0, len(v)
    while i < n:
        if v[i] and i > 0 and not v[i - 1]:
            j = i - 1
            while j > 0 and not v[j]:
                j -= 1
            if (i - j) * dt >= 0.10:
                # back off to where the level starts rising (10 dB under the threshold)
                k = i
                while k > 0 and rdb[k - 1] > thr - 10 and rdb[k - 1] < rdb[k] + 0.5:
                    k -= 1
                cand[round(float(t[k]), 3)] = 1.5
        i += 1
    # note changes from the pYIN pitch track (legato lines often change syllable on a pitch step, with no energy onset)
    pf = ROOT / "media" / "stems" / "analysis" / "lead_pitch.npz"
    if pf.exists():
        P = np.load(pf)
        tp, f0, vp = P["t"], P["f0"], P["vprob"]
        midi = median_filter_nan(12 * np.log2(np.where(np.isnan(f0), np.nan, f0) / 440.0) + 69, 5)
        for i in range(4, len(midi) - 4):
            a, b = midi[i - 4:i], midi[i:i + 4]
            if np.isnan(a).sum() > 1 or np.isnan(b).sum() > 1:
                continue
            step = abs(np.nanmedian(b) - np.nanmedian(a))
            if step >= 0.8 and abs(midi[i] - np.nanmedian(b)) < 0.5 and abs(midi[i - 1] - np.nanmedian(a)) < 0.5:
                tt = round(float(tp[i]), 3)
                near = [x for x in cand if abs(x - tt) < 0.03]
                if near:
                    for x in near:
                        cand[x] = max(cand[x], 0.9)
                else:
                    cand[tt] = 0.9
    ts = np.array(sorted(cand))
    return ts, np.array([cand[x] for x in ts])


def median_filter_nan(x, k):
    out = x.copy()
    h = k // 2
    for i in range(len(x)):
        w = x[max(0, i - h):i + h + 1]
        out[i] = np.nan if np.isnan(w).sum() > h else np.nanmedian(w)
    return out


def voiced_offset(t, rdb, t0, t_max, thr=-36.0, hold=0.08):
    """first time after t0 where the lead drops under thr for >= hold s (or t_max)."""
    dt = t[1] - t[0]
    i0, i1 = int(t0 / dt), min(len(t) - 1, int(t_max / dt))
    below = rdb[i0:i1] < thr
    run = 0
    for k, b in enumerate(below):
        run = run + 1 if b else 0
        if run * dt >= hold:
            return float(t[i0 + k - run + 1])
    return float(t_max)


def snap_line(est, sig, ts, st, lo, hi, min_gap=0.06, w_on=1.2):
    """DP over onset candidates in [lo, hi]. est/sig: per-word estimate and tolerance (s)."""
    k = (ts >= lo) & (ts <= hi)
    ct, cs = ts[k], st[k]
    n, m = len(est), len(ct)
    if m < n:
        return list(est)
    cost = np.full((n, m), np.inf)
    back = np.zeros((n, m), dtype=int)
    unit = np.array([[0.5 * ((ct[c] - est[j]) / sig[j]) ** 2 - w_on * np.log(cs[c] + 0.05) for c in range(m)] for j in range(n)])
    cost[0] = unit[0]
    for j in range(1, n):
        best, arg = np.inf, -1
        ptr = 0
        # running min over candidates at least min_gap earlier
        order_min = np.full(m, np.inf)
        order_arg = np.zeros(m, dtype=int)
        for c in range(m):
            while ptr < m and ct[ptr] <= ct[c] - min_gap:
                if cost[j - 1, ptr] < best:
                    best, arg = cost[j - 1, ptr], ptr
                ptr += 1
            order_min[c], order_arg[c] = best, arg
        cost[j] = unit[j] + order_min
        back[j] = order_arg
    c = int(np.argmin(cost[-1]))
    path = [c]
    for j in range(n - 1, 0, -1):
        c = back[j, c]
        path.append(c)
    return [float(ct[c]) for c in path[::-1]]


def main():
    TW = true_words()
    keys = [w["key"] for w in TW]
    est = [[] for _ in TW]
    for name, wt in PASSES:
        p = WH / f"{name}.json"
        if not p.exists():
            continue
        d = json.loads(p.read_text())
        ws_all = [w for s in d.get("segments", []) for w in (s.get("words") or [])]
        for sec, (a, b) in WINDOWS.items():
            ti = [i for i, w in enumerate(TW) if w["sec"] == sec]
            ws = [w for w in ws_all if a <= w["start"] < b]
            if not ws:
                continue
            for i, j in nw([keys[k] for k in ti], [norm(w["word"]) for w in ws]):
                est[ti[i]].append((ws[j]["start"], ws[j]["end"], wt, name))
    t, flux, rdb = vocal_features()
    ts, st = onset_candidates(t, flux, rdb)
    lines = []
    for li, (sec, text) in enumerate(LY.LINES):
        idx = [i for i, w in enumerate(TW) if w["line"] == li]
        e, sg = [], []
        for i in idx:
            w = TW[i]
            ov = OVERRIDE.get((sec, sum(1 for q in LY.LINES[:li] if q[0] == sec), w["text"]))
            cands = est[i]
            if ov is not None:
                e.append(ov), sg.append(0.08)
            elif cands:
                lead = [c for c in cands if c[3].startswith("lead")]
                use = lead or cands
                e.append(float(np.median([c[0] for c in use])))
                spread = max([c[0] for c in use]) - min([c[0] for c in use]) if len(use) > 1 else 0.0
                long_word = np.median([c[1] - c[0] for c in use]) > 0.8   # Whisper start of a long word is early
                sg.append(0.10 + 0.5 * spread + (0.15 if long_word else 0.0))
            else:
                e.append(np.nan), sg.append(0.3)
        e = np.array(e)
        # interpolate words no pass matched (e.g. the "ing" of exchange-/ing)
        if np.isnan(e).any():
            good = ~np.isnan(e)
            e[~good] = np.interp(np.where(~good)[0], np.where(good)[0], e[good]) + 0.12
        lo, hi = np.nanmin(e) - 0.45, np.nanmax(e) + 0.45
        snapped = snap_line(e, np.array(sg), ts, st, lo, hi)
        words = []
        for k, i in enumerate(idx):
            s0 = snapped[k]
            nxt = snapped[k + 1] if k + 1 < len(idx) else s0 + 4.0
            end = min(nxt - 0.01, voiced_offset(t, rdb, s0 + 0.12, nxt))
            words.append(dict(t=round(s0, 3), end=round(max(end, s0 + 0.08), 3), w=TW[i]["text"],
                              est=round(float(e[k]), 3), n_pass=len(est[i])))
        if words:
            words[-1]["end"] = round(voiced_offset(t, rdb, words[-1]["t"] + 0.12, words[-1]["t"] + 6.0), 3)
        lines.append(dict(sec=sec, text=text, t0=words[0]["t"], t1=words[-1]["end"], words=words))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(dict(lines=lines), indent=1))
    for L in lines:
        print(f"{L['sec']:8s} {L['t0']:7.2f}-{L['t1']:7.2f}  " + " ".join(f"{w['w']}@{w['t']:.2f}({w['t'] - w['est']:+.2f})" for w in L["words"]))


if __name__ == "__main__":
    main()
