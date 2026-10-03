"""Beat grid, downbeats/bars, 24 fps feature curves and event lists for Halys.

usage:  python tools/audio/madmom_beats.py     (once; neural beat/downbeat activations, see its docstring)
        python tools/audio/analyze.py          (needs media/stems/*.wav from separate.sh)
writes: media/stems/analysis/analysis.json     (consumed by build_outputs.py)

Method (findings in production/AUDIO_MAP.md):
* onset envelopes with a short (23 ms) window, shifted by the measured window bias so that envelope peaks sit
  on attacks (onsets.calibrate); percussive (HPSS) flux + instrumental flux + harmonic flux, locally normalised.
* beats: madmom RNN+DBN beat track as the backbone (the earlier librosa DP tracker squeezed one extra beat
  into chorus 1, the final chorus and the intro swell), then three passes of local phase alignment against the
  calibrated envelope (drops: the grid sits on the kick click within ~2 ms). The intro swell (bar 15, ~23.3 to
  27.2 s) has no pulse at all (rubato swell into the boom), so its beats are a steady interpolation between the
  last ostinato beat and the boom.
* tempo is NOT constant: ~136.4 BPM in the intro, drifting up to ~142 BPM in Drop 2 (Suno does not lock to a grid).
* downbeats: Viterbi over bar position with 4-beat bars and penalised 2/3/5/6-beat bars; evidence = madmom
  downbeat activation (mix + instrumental) + chord/bass change + low-band hit at each beat.
"""
import json
import pathlib
import sys

import librosa
import numpy as np
import soundfile as sf
from scipy.interpolate import UnivariateSpline
from scipy.ndimage import gaussian_filter1d, median_filter, percentile_filter
from scipy.signal import butter, find_peaks, sosfiltfilt

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import onsets as O  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]
ST = ROOT / "media" / "stems"
OUT = ST / "analysis"
SR = 22050
NFFT, HOP = 512, 32           # 23 ms frames on a 1.45 ms hop
FPS = 24

# the intro swell: no pulse between the last string-ostinato beat (bar 13 + 5 beats) and the low boom; the beats
# there are a steady interpolation (14 beats from bar 13's downbeat to the boom -> bar 15 has 6 beats)
SWELL = (21.0, 27.4)
IRREGULAR_PENALTY = {4: 0.0, 3: -6.0, 5: -6.0, 2: -7.0, 6: -7.0}


def load(name, sr=SR):
    x, s = sf.read(ST / name, dtype="float32")
    x = x.mean(1) if x.ndim > 1 else x
    return librosa.resample(x, orig_sr=s, target_sr=sr) if sr != s else x


def calib_bias(sr=SR, nfft=NFFT, hop=HOP):
    rng = np.random.default_rng(0)
    y = np.zeros(int(sr * 12))
    true = np.arange(1.0, 11.0, 0.5) + rng.uniform(0, 0.01, 20)
    for t0 in true:
        i, n = int(round(t0 * sr)), int(0.25 * sr)
        tt = np.arange(n) / sr
        y[i:i + n] += np.sin(2 * np.pi * (50 * tt + 2 * (1 - np.exp(-tt * 30)))) * np.exp(-tt * 12) \
            + rng.standard_normal(n) * np.exp(-tt * 400) * 0.3
    y += rng.standard_normal(len(y)) * 1e-4
    t, fl = O.band_flux(y, sr=sr, bands=((30, 11000),), nfft=nfft, hop=hop)
    env = fl[(30, 11000)]
    pk, _ = O.peaks(t, env, min_gap=0.3)
    tp = t[pk]
    return float(np.median([tp[np.argmin(np.abs(tp - x))] - x for x in true]))


def locnorm(e, dt, win=4.0):
    dec = 50
    q = percentile_filter(e[::dec], 97, size=max(3, int(win / dt) // dec), mode="nearest")
    q = np.interp(np.arange(len(e)), np.arange(0, len(e), dec), q)
    return e / (q + 1e-6)


# ----------------------------------------------------------------------------- beat alignment
def local_align(g, t, env_s, half, smooth, span=0.045):
    deltas = np.arange(-span, span + 1e-9, 0.001)
    V = np.stack([np.interp(g + d, t, env_s) for d in deltas])
    n = len(g)
    dk, conf = np.zeros(n), np.zeros(n)
    for k in range(n):
        a, b = max(0, k - half), min(n, k + half + 1)
        sc = V[:, a:b].sum(1)
        i = int(np.argmax(sc))
        off = 0.0
        if 0 < i < len(deltas) - 1:
            den = sc[i - 1] - 2 * sc[i] + sc[i + 1]
            off = 0.5 * (sc[i - 1] - sc[i + 1]) / den if den != 0 else 0.0
        dk[k] = deltas[i] + off * 0.001
        conf[k] = (sc.max() - np.median(sc)) / (np.median(sc) + 1e-9)
    w = np.clip(conf, 0.01, None)
    sp = UnivariateSpline(np.arange(n), dk, w=w / w.mean(), s=n * smooth ** 2, k=3)
    return g + sp(np.arange(n)), conf


# ----------------------------------------------------------------------------- bar phase
def bar_evidence(g, yh, yp):
    """per-beat downbeat evidence: chord novelty + bass novelty + low-band level."""
    hop = 256
    C = librosa.feature.chroma_cqt(y=yh, sr=SR, hop_length=hop, bins_per_octave=36)
    Cq = np.abs(librosa.cqt(yh, sr=SR, hop_length=hop, fmin=librosa.note_to_hz("E1"), n_bins=36, bins_per_octave=12))
    bass = np.zeros((12, Cq.shape[1]))
    for i in range(36):
        bass[(i + 4) % 12] += Cq[i]
    tc = librosa.frames_to_time(np.arange(C.shape[1]), sr=SR, hop_length=hop)

    def bsync(M):
        out = []
        for k in range(len(g) - 1):
            s = (tc >= g[k]) & (tc < g[k + 1])
            out.append(M[:, s].mean(1) if s.any() else np.zeros(M.shape[0]))
        out.append(out[-1])
        return np.array(out).T

    def nov(M):
        n = M.shape[1]
        v = np.zeros(n)
        for k in range(2, n - 2):
            a, b = M[:, k - 2:k].mean(1), M[:, k:k + 2].mean(1)
            v[k] = 1 - (a @ b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9)
        return v

    nc, nb = nov(bsync(C)), nov(bsync(bass))
    S = np.abs(librosa.stft(yp, n_fft=1024, hop_length=128))
    f = librosa.fft_frequencies(sr=SR, n_fft=1024)
    ts = librosa.frames_to_time(np.arange(S.shape[1]), sr=SR, hop_length=128)
    low = S[(f >= 30) & (f < 150)].sum(0)
    lb = np.array([low[(ts >= b - 0.01) & (ts < b + 0.06)].max() for b in g])
    lb = lb / np.median(lb)
    return nc / (nc.std() + 1e-9) + nb / (nb.std() + 1e-9) + 0.5 * np.log1p(lb)


# ----------------------------------------------------------------------------- madmom backbone grid
def madmom_grid(t, env, mm):
    """madmom DBN beats -> steady interpolation through the intro swell -> local phase alignment."""
    b = np.asarray(mm["beats"], dtype=float)
    a_i = int(np.argmin(np.abs(b - SWELL[0])))
    e_i = int(np.argmin(np.abs(b - 27.24)))
    # anchor 1: the ostinato downbeat before the swell (last madmom beat <= SWELL[0] + 0.2 on a 4-beat boundary
    # from the song start); anchor 2: the boom. Count beats at the pre-swell period.
    a_t, e_t = b[a_i], b[e_i]
    per = np.median(np.diff(b[max(0, a_i - 8):a_i + 1]))
    n = int(round((e_t - a_t) / per))
    g0 = np.concatenate([b[:a_i], np.linspace(a_t, e_t, n + 1), b[e_i + 1:]])
    dt = t[1] - t[0]
    env_s = gaussian_filter1d(env, sigma=0.008 / dt)
    g = g0.copy()
    conf = None
    for half, sm in ((8, 0.004), (6, 0.003), (4, 0.003)):
        g, conf = local_align(g, t, env_s, half, sm, span=0.03)
    sw = (g0 >= a_t - 1e-3) & (g0 <= e_t + 1e-3)
    g[sw] = g0[sw]
    return g, conf, dict(swell_beats=n, swell=[round(float(a_t), 3), round(float(e_t), 3)], swell_period=round(float(per), 4))


def downbeat_hmm(g, ev):
    """Viterbi over (bar length, position); returns downbeat beat indices."""
    L = IRREGULAR_PENALTY
    states = [(l, q) for l in L for q in range(l)]
    idx = {s_: i for i, s_ in enumerate(states)}
    n, NEG = len(g), -1e18
    V = np.full((n, len(states)), NEG)
    B = np.zeros((n, len(states)), dtype=int)
    for s_ in states:
        V[0, idx[s_]] = L[s_[0]] + (ev[0] if s_[1] == 0 else 0.0)
    ends = [idx[(l2, l2 - 1)] for l2 in L]
    for k in range(1, n):
        j = max(ends, key=lambda q: V[k - 1, q])
        for s_ in states:
            l, q = s_
            i = idx[s_]
            if q > 0:
                V[k, i], B[k, i] = V[k - 1, idx[(l, q - 1)]], idx[(l, q - 1)]
            else:
                V[k, i], B[k, i] = V[k - 1, j] + L[l] + ev[k], j
    s_ = int(np.argmax(V[-1]))
    path = [s_]
    for k in range(n - 1, 0, -1):
        s_ = B[k, s_]
        path.append(s_)
    path = path[::-1]
    return [k for k in range(n) if states[path[k]][1] == 0]


def downbeat_evidence(g, yh, yp, mm):
    """madmom P(downbeat | beat) log-odds + chord/bass change + low-band hit, per beat."""
    act = (mm["down_act_mix"] + mm["down_act_instrumental"]) / 2
    ta = np.arange(len(act)) / 100.0

    def at(x, a, b):
        return np.array([x[(ta >= gg + a) & (ta < gg + b)].max() for gg in g])
    md, mb = at(act[:, 1], -0.04, 0.05), at(act[:, 0], -0.04, 0.05)
    p = np.clip(md / (md + mb + 1e-6), 1e-3, 1 - 1e-3)
    ev_m = np.log(p / (1 - p))
    ev_h = bar_evidence(g, yh, yp)
    ev_h = (ev_h - median_filter(ev_h, 49, mode="nearest")) / (np.std(ev_h) + 1e-9)
    return ev_m + 0.6 * ev_h, ev_m, ev_h


# ----------------------------------------------------------------------------- curves
def curves(mix48, sr48, voc48, dur):
    hop = 240  # 5 ms
    S = np.abs(librosa.stft(mix48, n_fft=2048, hop_length=hop))
    f = librosa.fft_frequencies(sr=sr48, n_fft=2048)
    tt = np.arange(S.shape[1]) * hop / sr48

    def bandd(lo, hi):
        e = np.sqrt((S[(f >= lo) & (f < hi)] ** 2).sum(0))
        return 20 * np.log10(e + 1e-9)

    rms = 20 * np.log10(librosa.feature.rms(y=mix48, frame_length=2048, hop_length=hop)[0][:len(tt)] + 1e-9)
    vr = 20 * np.log10(librosa.feature.rms(y=voc48, frame_length=2048, hop_length=hop)[0][:len(tt)] + 1e-9)
    Ld = np.maximum(20 * np.log10(S + 1e-9), -100)
    fl = np.zeros_like(tt)
    fl[1:] = np.maximum(Ld[:, 1:] - Ld[:, :-1], 0).mean(0)
    nfr = int(np.ceil(dur * FPS))
    ft = np.arange(nfr) / FPS

    def sample(x, mode="mean"):
        out = np.empty(nfr)
        for i, c in enumerate(ft):
            s = (tt >= c - 0.5 / FPS) & (tt < c + 0.5 / FPS)
            out[i] = (x[s].max() if mode == "max" else x[s].mean()) if s.any() else x[min(len(x) - 1, int(c / (hop / sr48)))]
        return out

    def ndb(x, rng=45.0):
        top = np.percentile(x, 99.5)
        return np.clip((x - (top - rng)) / rng, 0, 1)

    cur = {
        "rms": ndb(sample(rms)),
        "low": ndb(sample(bandd(30, 150))),
        "mid": ndb(sample(bandd(150, 2500))),
        "high": ndb(sample(bandd(2500, 16000))),
        "onset": np.clip(sample(fl, "max") / np.percentile(sample(fl, "max"), 99.5), 0, 1),
        "vocal": ndb(sample(vr), 40.0),
    }
    return {k: [round(float(v), 3) for v in a] for k, a in cur.items()}


# ----------------------------------------------------------------------------- events
def envdb(y, sr, ms):
    n = max(1, int(sr * ms / 1000))
    return 10 * np.log10(np.convolve(y * y, np.ones(n) / n, mode="same") + 1e-12)


def regions_from_mask(t, m, min_len=0.15, merge=0.25):
    segs, i, n = [], 0, len(m)
    while i < n:
        if m[i]:
            j = i
            while j < n and m[j]:
                j += 1
            segs.append([float(t[i]), float(t[min(j, n - 1)])])
            i = j
        else:
            i += 1
    out = []
    for s in segs:
        if out and s[0] - out[-1][1] < merge:
            out[-1][1] = s[1]
        else:
            out.append(s)
    return [s for s in out if s[1] - s[0] >= min_len]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    mix48, sr48 = sf.read(ST / "mix.wav", dtype="float32")
    mix48 = mix48.mean(1)
    dur = len(mix48) / sr48
    inst48 = sf.read(ST / "instrumental.wav", dtype="float32")[0].mean(1)
    voc48 = sf.read(ST / "vocals.wav", dtype="float32")[0].mean(1)
    lead48 = sf.read(ST / "vocals_lead.wav", dtype="float32")[0].mean(1)
    back48 = sf.read(ST / "vocals_backing.wav", dtype="float32")[0].mean(1)
    inst = librosa.resample(inst48, orig_sr=sr48, target_sr=SR)

    print("[analyze] HPSS ...", flush=True)
    D = librosa.stft(inst, n_fft=2048, hop_length=128)
    H, P = librosa.decompose.hpss(D, kernel_size=(31, 31), margin=1.0)
    yh = librosa.istft(H, hop_length=128, length=len(inst))
    yp = librosa.istft(P, hop_length=128, length=len(inst))
    del D, H, P

    bias = calib_bias()
    print(f"[analyze] onset window bias {bias * 1000:.1f} ms", flush=True)
    bandsP = ((30, 150), (150, 2500), (2500, 11000))
    t, fP = O.band_flux(yp, sr=SR, bands=bandsP, nfft=NFFT, hop=HOP)
    _, fI = O.band_flux(inst, sr=SR, bands=bandsP, nfft=NFFT, hop=HOP)
    _, fH = O.band_flux(yh, sr=SR, bands=((60, 300), (300, 2500), (2500, 8000)), nfft=NFFT, hop=HOP)
    t = t - bias
    dt = t[1] - t[0]

    def comb(fl):
        return sum(v / np.percentile(v, 99.5) for v in fl.values())

    envP, envI, envH = comb(fP), comb(fI), comb(fH)
    env = locnorm(envP, dt) + locnorm(envI, dt) + locnorm(envH, dt)

    print("[analyze] beat grid (madmom backbone) ...", flush=True)
    mm = np.load(OUT / "madmom.npz")
    g, conf, grid_dbg = madmom_grid(t, env, mm)
    g = g[(g >= 0) & (g < dur)]
    conf = conf[:len(g)]
    ev, ev_m, ev_h = downbeat_evidence(g, yh, yp, mm)
    downs = downbeat_hmm(g, ev)
    lens = np.diff(downs + [len(g)])
    irregular = [dict(bar=i + 1, beat=int(k), t=round(float(g[k]), 3), beats=int(l)) for i, (k, l) in enumerate(zip(downs, lens)) if l != 4]
    print(f"[analyze] {len(g)} beats, {len(downs)} bars, irregular bars: {irregular}", flush=True)
    tempo_dbg = dict(grid=grid_dbg, irregular=irregular)
    phase_report = []

    # ---------------- kicks: drop beats + any strong low hit
    lp = sosfiltfilt(butter(4, 150, "low", fs=sr48, output="sos"), inst48.astype(np.float64))
    hp = sosfiltfilt(butter(4, 2500, "high", fs=sr48, output="sos"), inst48.astype(np.float64))
    eL, eH = envdb(lp, sr48, 5), envdb(hp, sr48, 2)
    tE = np.arange(len(eL)) / sr48

    def lvl(e, a, b, f=np.max):
        i0, i1 = int(max(0, a) * sr48), int(min(dur, b) * sr48)
        return float(f(e[i0:i1])) if i1 > i0 else -120.0

    pk, _ = find_peaks(fP[(30, 150)], height=np.percentile(fP[(30, 150)], 85), distance=int(0.12 / dt))
    hiP = fP[(2500, 11000)]
    low_hits = []
    for p in pk:
        x = float(t[p])
        post, pre = lvl(eL, x, x + 0.06), lvl(eL, x - 0.05, x - 0.005, np.mean)
        cj = lvl(eH, x - 0.035, x + 0.01) - lvl(eH, x - 0.08, x - 0.04, np.mean)
        # attack = strongest high-band percussive flux peak just before/at the low-band peak
        w = (t >= x - 0.035) & (t <= x + 0.01)
        xa = float(t[w][np.argmax(hiP[w])]) if w.any() and hiP[w].max() > np.percentile(hiP, 90) else x - 0.012
        low_hits.append(dict(t=xa, t_low=x, low_db=post, jump=post - pre, click=cj))
    Lref = np.percentile([h["low_db"] for h in low_hits], 99)
    kicks = [h for h in low_hits if h["low_db"] >= Lref - 9 and (h["jump"] >= 4.5 or h["click"] >= 10)]
    # de-duplicate (keep strongest within 0.2 s)
    kk = []
    for h in sorted(kicks, key=lambda h: -h["low_db"]):
        if all(abs(h["t"] - o["t"]) > 0.2 for o in kk):
            kk.append(h)
    kicks = sorted(kk, key=lambda h: h["t"])
    for h in kicks:
        j = int(np.argmin(np.abs(g - h["t"])))
        h["beat"] = j
        h["on_beat_ms"] = round((h["t"] - g[j]) * 1000, 1)

    # ---------------- snares / claps / rolls: high-band percussive onsets away from kicks
    pkh, _ = find_peaks(hiP, height=np.percentile(hiP, 97), distance=int(0.07 / dt))
    kt = np.array([h["t"] for h in kicks]) if kicks else np.array([-9.0])
    snares = []
    for p in pkh:
        x = float(t[p])
        if np.min(np.abs(kt - x)) < 0.03:
            continue
        snares.append(dict(t=x, s=float(hiP[p] / np.percentile(hiP, 99.5))))
    st = np.array([s["t"] for s in snares])
    rolls = []
    if len(st):
        dens = np.array([((st >= x - 0.5) & (st < x + 0.5)).sum() for x in st])
        rolls = regions_from_mask(st, dens >= 6, min_len=0.6, merge=0.4)

    # ---------------- stabs / big transients: instrumental mid-band flux peaks + level jump
    mI = fI[(150, 2500)]
    pks, _ = find_peaks(mI, height=np.percentile(mI, 99.0), distance=int(0.25 / dt))
    eM = envdb(sosfiltfilt(butter(4, [200, 2500], "band", fs=sr48, output="sos"), inst48.astype(np.float64)), sr48, 10)
    stabs = []
    for p in pks:
        x = float(t[p])
        jump = lvl(eM, x, x + 0.08) - lvl(eM, x - 0.12, x - 0.01, np.mean)
        if jump >= 5:
            stabs.append(dict(t=x, s=round(float(mI[p] / np.percentile(mI, 99.5)), 3), jump=round(jump, 1)))

    # ---------------- vocal activity (lead / backing)
    def act(y, thr_rel, min_len, merge):
        hop = 480
        r = 20 * np.log10(librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0] + 1e-9)
        tt = np.arange(len(r)) * hop / sr48
        thr = np.percentile(r, 99) - thr_rel
        return regions_from_mask(tt, median_filter(r, 5) > thr, min_len, merge), tt, r

    lead_phr, tl, rl = act(lead48, 22, 0.25, 0.35)
    back_reg, tb, rb = act(back48, 18, 0.5, 0.6)
    choir = []
    for s in back_reg:
        lead_here = rl[(tl >= s[0]) & (tl < s[1])].mean()
        back_here = rb[(tb >= s[0]) & (tb < s[1])].mean()
        choir.append(dict(start=round(s[0], 3), end=round(s[1], 3), back_db=round(float(back_here), 1),
                          back_minus_lead=round(float(back_here - lead_here), 1)))

    # ---------------- risers before drops + micro-dips (no real silences in this song)
    S = np.abs(librosa.stft(mix48, n_fft=2048, hop_length=480))
    f = librosa.fft_frequencies(sr=sr48, n_fft=2048)
    tsp = np.arange(S.shape[1]) * 480 / sr48
    bright = gaussian_filter1d(20 * np.log10(np.sqrt((S[f > 6000] ** 2).sum(0)) + 1e-9), 8)
    rr = 20 * np.log10(librosa.feature.rms(y=mix48, frame_length=960, hop_length=240)[0] + 1e-9)
    trr = np.arange(len(rr)) * 240 / sr48
    dip = median_filter(rr, size=int(2.0 / 0.005)) - rr
    dips = [dict(start=round(a, 3), end=round(b, 3), depth_db=round(float(dip[(trr >= a) & (trr <= b)].max()), 1))
            for a, b in regions_from_mask(trr, dip > 6, min_len=0.05, merge=0.05) if a > 0.5]

    res = dict(
        dur=dur, bias_ms=round(bias * 1000, 2),
        beats=[round(float(x), 4) for x in g], beat_conf=[round(float(x), 3) for x in conf],
        downbeat_idx=[int(k) for k in downs], phase_report=phase_report, tempo_windows=tempo_dbg,
        kicks=[{k: (round(v, 4) if isinstance(v, float) else v) for k, v in h.items()} for h in kicks],
        low_hits=[{k: (round(v, 4) if isinstance(v, float) else v) for k, v in h.items()} for h in low_hits if h["jump"] >= 8],
        snares=[dict(t=round(s["t"], 4), s=round(s["s"], 3)) for s in snares],
        snare_rolls=[[round(a, 3), round(b, 3)] for a, b in rolls],
        stabs=stabs, lead_phrases=[[round(a, 3), round(b, 3)] for a, b in lead_phr], choir=choir, dips=dips,
        brightness=dict(t=[round(float(x), 3) for x in tsp[::4]], db=[round(float(x), 2) for x in bright[::4]]),
    )
    print("[analyze] curves ...", flush=True)
    res["curves"] = curves(mix48, sr48, lead48, dur)
    np.savez_compressed(OUT / "envelopes.npz", t=t, env=env, envP=envP, envI=envI, envH=envH,
                        low=fP[(30, 150)], high=hiP, ev=ev)
    (OUT / "analysis.json").write_text(json.dumps(res))
    print(f"[analyze] wrote {OUT / 'analysis.json'}: {len(kicks)} kicks, {len(snares)} snare-band hits, "
          f"{len(stabs)} stabs, {len(lead_phr)} lead phrases, {len(choir)} backing regions")


if __name__ == "__main__":
    main()
