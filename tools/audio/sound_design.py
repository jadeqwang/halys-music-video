"""The sound-design layer for Halys and the extended ending -> the "updated sound" master.

usage:  python tools/audio/sound_design.py          (needs media/sfx/src/*.mp3 from sfx_gen.py, media/stems/*.wav,
                                                       video/data/timing.json)
writes: media/stems/halys_sd_master.wav        48 kHz / 24-bit master for the video mux (gitignored)
        release/Halys_sound_design.mp3         320 kbps CBR, tags + cover copied from Halys.mp3
        media/sfx/cue_*.flac                   each processed cue (its own span only; t0 in media/sfx/cues.json);
                                               16-bit FLAC, regenerable, gitignored (the paid sources in src/ are kept)
        media/stems/halys_sd_bus.wav           all cues on the song timeline (gitignored; for the video's own mixer)
        media/sfx/cues.json                    cue sheet: times, sources, processing, measured levels, loudness

The song is never edited: master = original (bit-identical samples up to 271.6 s) + the cue bus, and from the
final chord on, the original's mastering fade is crossfaded into a spectral freeze of the chord.
Every cue is placed from timing.json word/beat times, ducked under the lead vocal (sidechain from the
lead-vocal stem) and kept out of the vocal presence band; levels are set relative to the music's own
short-term loudness at that moment (see cues.json "rel_LU").
"""
import json
import math
import pathlib
import subprocess

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import butter, fftconvolve, resample_poly, sosfilt, sosfiltfilt

ROOT = pathlib.Path(__file__).resolve().parents[2]
SR = 48000
T = json.loads((ROOT / "video" / "data" / "timing.json").read_text())
SRC = ROOT / "media" / "sfx" / "src"
SFX = ROOT / "media" / "sfx"
MASTER = ROOT / "media" / "stems" / "halys_sd_master.wav"
BUS = ROOT / "media" / "stems" / "halys_sd_bus.wav"
MP3 = ROOT / "release" / "Halys_sound_design.mp3"
RNG = np.random.default_rng(585)          # deterministic render


# ============================================================================ helpers
def load(path, mono=False):
    raw = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-ac", "1" if mono else "2",
                          "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    return x if mono else x.reshape(-1, 2).T.copy()


def word(text, sec=None, nth=0):
    """start time of a lyric word (true text, case-insensitive, punctuation ignored)."""
    hits = [w for ln in T["lines"] if sec is None or ln["sec"] == sec for w in ln["words"]
            if w[1].lower().strip(".,…") == text.lower()]
    return hits[nth][0]


def db(g):
    return 10 ** (g / 20)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(np.square(x))) + 1e-12)


def sos(kind, f, order=4):
    return butter(order, f, kind, fs=SR, output="sos")


def filt(x, kind, f, order=4, zero_phase=True):
    s = sos(kind, f, order)
    return sosfiltfilt(s, x, axis=-1) if zero_phase else sosfilt(s, x, axis=-1)


def env(n, pts, t0=0.0):
    """piecewise-linear gain in dB from [(t_song, dB), ...] over n samples starting at song time t0 (-120 = off)."""
    t = t0 + np.arange(n) / SR
    tp = np.array([p[0] for p in pts])
    gp = np.array([p[1] for p in pts])
    return db(np.interp(t, tp, gp))


def stft_filter(x, gain_fn, nfft=4096, hop=1024):
    """time-varying spectral gain: gain_fn(t_sec_array, f_hz_array) -> (frames, bins). x: (2, n)."""
    w = np.hanning(nfft)
    n = x.shape[1]
    pad = np.pad(x, ((0, 0), (nfft, nfft + hop)))
    frames = (pad.shape[1] - nfft) // hop
    tf = (np.arange(frames) * hop - nfft + nfft / 2) / SR
    f = np.fft.rfftfreq(nfft, 1 / SR)
    G = gain_fn(tf, f)
    out = np.zeros_like(pad)
    norm = np.zeros(pad.shape[1])
    for i in range(frames):
        a = i * hop
        seg = np.fft.rfft(pad[:, a:a + nfft] * w, axis=1) * G[i]
        out[:, a:a + nfft] += np.fft.irfft(seg, nfft, axis=1) * w
        norm[a:a + nfft] += w ** 2
    out /= np.maximum(norm, 1e-6)
    return out[:, nfft:nfft + n]


def reverb_ir(rt60=2.0, secs=3.0, predelay=0.02, damp_hz=3500.0, seed=1):
    """stereo exponentially decaying noise, darker with time (a plausible open-air / hall tail)."""
    rng = np.random.default_rng(seed)
    n = int(secs * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * 10 ** (-3 * t / rt60)
    # darken progressively: blend of a low-passed copy that takes over with time
    dark = filt(ir, "low", damp_hz, 2)
    mix = np.clip(t / (rt60 * 0.6), 0, 1)
    ir = ir * (1 - mix) + dark * mix
    ir = np.pad(ir, ((0, 0), (int(predelay * SR), 0)))[:, :n]
    ir[:, :int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))


def convolve(x, ir):
    return np.stack([fftconvolve(x[c], ir[c])[:x.shape[1] + ir.shape[1] - 1] for c in range(2)])


def smooth_noise(n, rate_hz, rng, lo=-1.0, hi=1.0):
    """slow random control signal (cubic-interpolated random points at rate_hz)."""
    k = max(4, int(n / SR * rate_hz) + 4)
    pts = rng.uniform(lo, hi, k)
    from scipy.interpolate import CubicSpline
    cs = CubicSpline(np.linspace(0, n / SR, k), pts)
    return cs(np.arange(n) / SR)


def pan(x_mono, p):
    """equal-power pan, p in [-1, 1] (scalar or per-sample)."""
    a = (np.asarray(p) + 1) * np.pi / 4
    return np.stack([x_mono * np.cos(a), x_mono * np.sin(a)])


def loop_to(x, n, xf=2.0, rng=None, avoid=()):
    """stitch random segments of x (2, m) with equal-power crossfades into length n (no audible loop point)."""
    rng = rng or RNG
    m = x.shape[1]
    L = int(xf * SR)
    out = np.zeros((2, n + m))
    pos = 0
    fade_in = np.sin(np.linspace(0, np.pi / 2, L)) ** 2
    while pos < n:
        seg_len = int(rng.uniform(0.45, 0.9) * m)
        st = int(rng.uniform(0, m - seg_len))
        for a, b in avoid:          # skip segments that contain excluded events (s)
            if st < b * SR and st + seg_len > a * SR:
                st = int(b * SR) if b * SR + seg_len < m else max(0, int(a * SR) - seg_len)
        seg = x[:, st:st + seg_len].copy()
        if pos > 0:
            seg[:, :L] *= fade_in
            out[:, pos:pos + L] *= fade_in[::-1]
        out[:, pos:pos + seg.shape[1]] += seg
        pos += seg.shape[1] - L
    return out[:, :n]


def vocal_duck(t0, n, depth_db=5.0, thr_db=-38.0):
    """gain curve (n samples from song time t0): dips by up to depth_db while the lead vocal sings."""
    a, b = int(t0 * SR), int(t0 * SR) + n
    v = VOX[a:b] if b <= len(VOX) else np.pad(VOX[a:], (0, b - len(VOX)))
    return db(-depth_db * np.clip((v - thr_db) / 12.0, 0, 1))


def presence_dip(x, depth_db=-5.0, f0=2600.0, q=0.9):
    """gentle peaking cut in the vocal presence band (x + (g-1) * resonator(x); the resonator has unity gain at f0)."""
    from scipy.signal import iirpeak, lfilter
    b, a = iirpeak(f0, q, fs=SR)
    return x + (db(depth_db) - 1) * lfilter(b, a, x, axis=-1)


def set_lufs(x, target, active_db=-50.0):
    """scale x so its loudness over the non-silent part (blocks above active_db RMS) is `target` LUFS."""
    blk = SR // 10
    nb = x.shape[1] // blk
    keep = [i for i in range(nb) if rms_db(x[:, i * blk:(i + 1) * blk]) > active_db]
    act = np.concatenate([x[:, i * blk:(i + 1) * blk] for i in keep], axis=1) if len(keep) >= 5 else x
    return x * db(target - lufs_s(act))


# ============================================================================ generators (procedural)
def wind(dur, seed, band=(180.0, 1400.0), gust_rate=0.18, whistle=0.0, whistle_hz=(650.0, 1100.0)):
    """steppe wind: brown-ish noise through a slowly wandering band-pass, gusting, stereo decorrelated."""
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    x = rng.standard_normal((2, n))
    x = filt(x, "low", 2500, 1)                                # tilt down (brown-ish)
    lfo = smooth_noise(n, gust_rate, rng)                      # -1..1
    center = np.sqrt(band[0] * band[1]) * 2 ** (0.9 * lfo)

    def g(tf, f):
        c = np.interp(tf, np.arange(n) / SR, center)[:, None]
        lf = np.log2(np.maximum(f[None, :], 20) / c)
        return np.exp(-0.5 * (lf / 1.1) ** 2)
    y = stft_filter(x, g)
    gust = 0.62 + 0.38 * smooth_noise(n, gust_rate * 1.7, rng, -1, 1)
    y *= np.clip(gust, 0.08, 1.0)
    if whistle > 0:                                            # faint resonant whistle gliding with the gusts
        wh = np.interp(lfo, [-1, 1], whistle_hz)
        ph = 2 * np.pi * np.cumsum(wh) / SR
        tone = np.sin(ph) * (0.5 + 0.5 * smooth_noise(n, 0.4, rng)) * np.clip(gust, 0, 1) ** 2
        y += whistle * pan(tone, 0.3 * smooth_noise(n, 0.1, rng))
    return y / (np.abs(y).max() + 1e-9)


def room_tone(dur, seed):
    """quiet room at night: soft fan air (pink-ish, rolled off), a faint 50 Hz-family hum."""
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    x = filt(filt(rng.standard_normal((2, n)), "low", 900, 2), "high", 60, 2)
    t = np.arange(n) / SR
    hum = 0.06 * np.sin(2 * np.pi * 100 * t) + 0.03 * np.sin(2 * np.pi * 200 * t + 1.0)
    return x / np.abs(x).max() + np.stack([hum, hum * 0.9])


def partial_bell(freqs, amps, decays, dur, seed, jitter=0.012, detune=0.002):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for f, a, d in zip(freqs, amps, decays):
        for side in range(2):
            on = rng.uniform(0, jitter)
            ff = f * (1 + rng.uniform(-detune, detune))
            tt = np.clip(t - on, 0, None)
            e = np.where(t >= on, np.exp(-tt / d) * (1 - np.exp(-tt / 0.002)), 0)
            out[side] += a * e * np.sin(2 * np.pi * ff * tt + rng.uniform(0, 2 * np.pi))
    return out


def glitter(dur, seed, n_grains=70, f_range=(4500.0, 11000.0), decay=0.5, rise=0.0):
    """tiny high sine grains, density decaying from t=0 (or rising over `rise` s then decaying)."""
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros((2, n))
    for _ in range(n_grains):
        on = (rise - rng.exponential(rise / 3)) if (rise and rng.random() < 0.4) else rise + rng.exponential(decay)
        if not 0 <= on < dur - 0.08:
            continue
        L = int(rng.uniform(0.015, 0.06) * SR)
        f = rng.uniform(*f_range)
        g = np.sin(2 * np.pi * f * np.arange(L) / SR) * np.hanning(L) * rng.uniform(0.3, 1.0)
        g *= math.exp(-max(0.0, on - rise) / (decay * 1.5))
        p = rng.uniform(-0.9, 0.9)
        i = int(on * SR)
        out[:, i:i + L] += pan(g, p)[:, :max(0, min(L, n - i))]
    return out


def spectral_freeze(y, win, secs, seed, nfft=8192, hop=1024):
    """random-phase resynthesis of the average magnitude spectrum of y[:, win] (orbital extend_ending.py)."""
    rng = np.random.default_rng(seed)
    a, b = int(win[0] * SR), int(win[1] * SR)
    w = np.hanning(nfft)
    mags = []
    for c in range(2):
        fr = [np.abs(np.fft.rfft(y[c, i:i + nfft] * w)) for i in range(a, b - nfft, hop)]
        mags.append(np.mean(fr, axis=0))
    frames = int(secs * SR / hop) + 2 * nfft // hop + 8
    out = np.zeros((2, frames * hop + nfft))
    norm = np.zeros(frames * hop + nfft)
    for i in range(frames):
        shared = rng.uniform(0, 2 * np.pi, len(mags[0]))
        for c in range(2):
            ph = 0.75 * shared + 0.25 * rng.uniform(0, 2 * np.pi, len(mags[c]))
            out[c, i * hop:i * hop + nfft] += np.fft.irfft(mags[c] * np.exp(1j * ph), nfft) * w
        norm[i * hop:i * hop + nfft] += w ** 2
    out /= np.maximum(norm, 1e-6)
    return out[:, nfft:nfft + int(secs * SR)]


def tv_lowpass(x, f_start, f_end, curve=1.0):
    """time-varying low-pass via STFT mask, cutoff gliding exponentially (curve shapes the glide)."""
    n = x.shape[1]

    def g(tf, f):
        u = np.clip(tf / (n / SR), 0, 1) ** curve
        fc = (f_start * (f_end / f_start) ** u)[:, None]
        return 1 / np.sqrt(1 + (f[None, :] / fc) ** 6)
    return stft_filter(x, g)


def distant(x, lp=2200.0, rt60=1.8, wet=0.7, seed=3, hp=120.0):
    """push a close sound far away: high-pass, low-pass, mostly-wet open-air tail (tail level-matched to the dry)."""
    y = filt(filt(x, "high", hp, 2), "low", lp, 2)
    tail = convolve(y, reverb_ir(rt60, rt60 * 1.6, 0.03, lp * 0.6, seed))
    tail *= db(rms_db(y) - rms_db(tail[:, :y.shape[1]]))
    dry = np.pad(y, ((0, 0), (0, tail.shape[1] - y.shape[1])))
    return (1 - wet) * dry + wet * tail


def pitch(x, semis):
    """resample-based pitch/speed shift (fine for one-shot hits)."""
    if abs(semis) < 1e-3:
        return x
    r = 2 ** (semis / 12)
    up, down = int(round(1000 / r)), 1000
    return np.stack([resample_poly(c, up, down) for c in x])


# ============================================================================ the song and its measurements
SONG = load(ROOT / "Halys.mp3")                       # (2, n), t = 0 at the first decoded sample
N0 = SONG.shape[1]
DUR0 = N0 / SR
VOCAL_ST = load(ROOT / "media" / "stems" / "vocals_lead.wav")
_v = VOCAL_ST.mean(0)
_hop = 240
_r = np.sqrt(np.convolve(_v ** 2, np.ones(960) / 960, mode="same")[::_hop])
VOX = np.repeat(20 * np.log10(_r + 1e-9), _hop)[:N0]
VOX = np.convolve(VOX, np.ones(2400) / 2400, mode="same")       # 50 ms smoothing (attack/release ~25 ms)
METER = pyln.Meter(SR)


def music_lufs_s(t, win=3.0):
    """music short-term loudness (3 s window centred on t)."""
    a, b = max(0, int((t - win / 2) * SR)), min(N0, int((t + win / 2) * SR))
    return METER.integrated_loudness(SONG[:, a:b].T) if b - a > SR * 0.5 else -70.0


def lufs_s(x):
    return METER.integrated_loudness(x.T) if x.shape[1] > SR * 0.45 else -70.0


# ============================================================================ cues
CUES = []


def add(name, x, t0, meta):
    """register a cue (stereo array starting at song time t0)."""
    CUES.append(dict(name=name, t0=float(t0), x=x, **meta))


def cue_wind_open():
    t0, t1 = 0.0, 9.0
    w = wind(t1 - t0 + 1.0, seed=11, band=(160, 1100), gust_rate=0.22, whistle=0.05)[:, :int((t1 - t0) * SR)]
    w = set_lufs(filt(w, "high", 90, 2), -50.0)                 # ~24 LU under the cello (-25..-26 LUFS-S)
    g = env(w.shape[1], [(0.0, -120), (0.04, -4), (1.5, 0), (5.5, 0), (7.18, -6), (9.0, -120)], t0)
    add("a1_steppe_wind", w * g, t0, dict(
        cue="a. Cold open: steppe wind from frame 0", source="procedural (noise through a wandering band-pass, gusts, faint whistle)",
        processing="HP 90 Hz; in from frame 0 (40 ms de-click), out under the strings at 7.2 s (gone by 9.0 s)",
        rationale="air before the picture; the cello alone reads as a void, the wind gives it a place"))


def build_bed(n, seed=21):
    """distant battle: crowd/rumble + far cavalry + river + sparse far bronze clashes (positions returned)."""
    rng = np.random.default_rng(seed)
    bed_src = load(SRC / "battle_bed.mp3")
    rumble = loop_to(bed_src, n, xf=2.5, rng=rng, avoid=[(14.8, 19.6)])       # skip the two close clangs
    rumble = filt(filt(rumble, "low", 1300, 2), "high", 70, 2)
    horses = loop_to(load(SRC / "horses_far.mp3"), n, xf=2.0, rng=rng)
    horses = filt(filt(horses, "low", 1600, 2), "high", 60, 2)
    river = loop_to(load(SRC / "river.mp3"), n, xf=2.0, rng=rng)
    river = filt(filt(river, "low", 2600, 2), "high", 250, 2)

    def norm(x, target):
        return x * db(target - rms_db(x))
    bed = norm(rumble, -20) + norm(horses, -27) + norm(river, -25)
    # far bronze: the two clangs in battle_bed.mp3, the blade drop and the earlier sword test, pitched/filtered/far
    hits = [bed_src[:, int(15.05 * SR):int(16.9 * SR)], bed_src[:, int(17.65 * SR):int(19.5 * SR)],
            load(SRC / "blade_drop.mp3")[:, :int(1.6 * SR)], load(ROOT / "media" / "tests" / "sfx_bronze_swords.mp3")[:, :int(1.6 * SR)]]
    return bed, hits, rng


def cue_battle_bed():
    t0, t1 = 1.0, 93.5
    n = int((t1 - t0) * SR)
    bed, hits, rng = build_bed(n)
    # clash times: irregular (mean gap 2.6 s), denser on "slew each other on the shore", none after the drain starts,
    # and in verse 1 kept out of sung syllable onsets (+-120 ms) so they never sit on a consonant
    # clash times: irregular (mean gap 2.6 s), denser around "slew each other on the shore" and the breath after it,
    # none once the drain starts, and during verse 1 only in vocal gaps (lead stem < -40 dB from 50 ms before to
    # 450 ms after the hit), so a clash never sits on a sung word
    slew0, shore1 = word("slew") - 1.0, word("Sun", "verse1") - 0.2
    strange = word("when", "verse1")

    def in_gap(tc):
        a_, b_ = int((tc - 0.05) * SR), int((tc + 0.45) * SR)
        return VOX[a_:b_].max() < -40.0

    times, t = [], 1.9
    while True:
        t += rng.exponential(2.6) + 0.35
        if t >= strange - 1.0:
            break
        if in_gap(t) and not slew0 <= t <= shore1:
            times.append(t)
    # the swell: hits go into the singer's breaths (lead stem < -30 dB for >= 0.12 s), up to five of them
    k0, k1 = int(slew0 * SR), int(shore1 * SR)
    low = VOX[k0:k1] < -30.0
    edges = np.flatnonzero(np.diff(np.concatenate([[0], low.astype(int), [0]])))
    breaths = [(a_, b_) for a_, b_ in zip(edges[::2], edges[1::2]) if (b_ - a_) / SR >= 0.12]
    for a_, b_ in breaths[:5]:
        times.append(slew0 + a_ / SR + 0.03)
    times.sort()
    clash = np.zeros((2, n + 6 * SR))
    for tc in times:
        h = hits[rng.integers(len(hits))]
        h = pitch(h, rng.uniform(-3.0, 1.0))
        h = distant(h, lp=rng.uniform(1400, 2800), rt60=rng.uniform(1.4, 2.4), wet=0.75, seed=int(rng.integers(1e6)))
        h = h[0] * 0.5 + h[1] * 0.5
        h = pan(h, rng.uniform(-0.8, 0.8)) * db(rng.uniform(-9, 0))
        i = int((tc - t0) * SR)
        clash[:, i:i + h.shape[1]] += h[:, :clash.shape[1] - i]
    clash = clash[:, :n]
    act = np.abs(clash[0]) > 1e-5
    if act.any():           # clashes (with their tails) sit 3 dB under the bed's RMS, so only the attacks poke out
        clash *= db(rms_db(bed) - 3.0 - rms_db(clash[:, act]))
    x = set_lufs(presence_dip(bed + clash, -5.0, 2600, 0.8), -44.0)   # 0 dB below = -44 LUFS (27 LU under the song's body)
    # level plan (absolute dBFS-ish gain on the normalised bed): faint in the cold open, constant under the intro,
    # a small swell on "slew each other on the shore", then the drain
    halo_awed = word("awed")
    g = env(n, [(t0, -120), (1.7, -120), (3.2, 0), (7.18, 0), (60.0, 0), (slew0, 0), (slew0 + 1.6, 3.5),
                (shore1, 3.5), (shore1 + 1.5, 0), (strange, 0), (halo_awed, -36), (halo_awed + 0.3, -120), (t1, -120)], t0)
    x = x * g * vocal_duck(t0, n, depth_db=4.0)
    # "the battle noise dies as the light dies": low-pass glide + thinning over the drain
    a = int((strange - t0) * SR)
    drain = tv_lowpass(x[:, a:], 7000.0, 220.0, curve=0.8)
    x = np.concatenate([x[:, :a], drain], axis=1)
    add("a2_b_battle_bed", x, t0, dict(
        cue="a/b. Distant battle bed: in at 1.7 s, low under the intro and verse 1, swell on 'slew each other on the shore', "
            "drains from 'when light went strange' to silence by 'warriors awed'",
        source="ElevenLabs music-v2 (sfx:battle_bed, sfx:horses_far, sfx:river, sfx:blade_drop + test sfx_bronze_swords)",
        processing=f"crowd/rumble LP 1.3 kHz, cavalry LP 1.6 kHz, river BP 250-2600 Hz, stitched without loop points; "
                   f"{len(times)} far bronze clashes (pitched -3..+1 st, LP 1.4-2.8 kHz, 75% wet open-air tail, random pan, "
                   f"only in vocal gaps); presence dip -5 dB @ 2.6 kHz; ducked 4 dB under the lead vocal; "
                   f"drain = low-pass glide 7 kHz -> 220 Hz + gain to silence ({strange:.2f} -> {halo_awed:.2f} s)",
        rationale="the war is going on out of frame; when the light goes strange the world loses its top end and goes quiet",
        clashes=[round(c, 2) for c in times]))


def cue_birdsong():
    t0 = T["sections"][[s["id"] for s in T["sections"]].index("verse2")]["t0"]     # bar 93
    t_cut = word("quiet")
    src = load(SRC / "birdsong.mp3")
    # the liveliest stretch of the take (most chirp energy above 2 kHz) for the 7.6 s we need
    need = int((t_cut - t0 + 0.2) * SR)
    hf = filt(src, "high", 2000, 2)
    best, bi = -1, 0
    for i in range(0, src.shape[1] - need, SR // 4):
        e = np.mean(hf[:, i:i + need] ** 2)
        if e > best:
            best, bi = e, i
    x = src[:, bi:bi + need]
    x = filt(filt(x, "high", 2600, 3), "low", 9500, 2)
    x = convolve(x, reverb_ir(1.1, 1.6, 0.015, 5000, 7) * 0.25)[:, :need] + x
    n = x.shape[1]
    x = set_lufs(x, music_lufs_s(t0 + 3.5) - 22.0, active_db=-60.0)
    g = env(n, [(t0, -120), (t0 + 0.9, 0), (t_cut - 0.002, 0), (t_cut, -120)], t0)
    x = x * g * vocal_duck(t0, n, depth_db=9.0)
    k = int((t_cut - t0) * SR)
    x[:, k:] = 0.0                                              # the cut: no tail, the world stops
    add("c1_evening_birds", x, t0, dict(
        cue="c. Verse 2: faint evening birdsong from the first bar of verse 2, cut dead on 'quiet' (Birds went quiet)",
        source="ElevenLabs music-v2 (sfx:birdsong)",
        processing=f"liveliest {need / SR:.1f} s of the take; BP 2.6-9.5 kHz; short air (RT 1.1 s, -12 dB); fade in 0.9 s; "
                   f"ducked 9 dB under the vocal; hard cut at {t_cut:.3f} s (2 ms ramp, no reverb tail)",
        rationale="the strangest real report from eclipses: birds stop singing. The cut is the event"))


def cue_gusts():
    for tag, a, peak, b, level, seed in (
            ("c2_cold_gust_air", word("air", "verse2") - 0.6, word("cold", "verse2") + 0.25, word("cold", "verse2") + 2.4, -17.0, 31),
            ("c3_chill_wind", word("wind", "shadow") - 0.4, word("chill") + 0.3, word("chill") + 2.6, -18.0, 37)):
        n = int((b - a) * SR)
        w = wind((b - a) + 0.5, seed=seed, band=(500, 3200), gust_rate=0.6, whistle=0.08, whistle_hz=(900, 1500))[:, :n]
        w = filt(w, "high", 300, 2)
        w = presence_dip(presence_dip(w, -9.0, 2300, 0.7), -6.0, 4200, 0.9)
        # left-to-right sweep (the gust crosses the frame) + swell envelope
        u = np.linspace(-0.6, 0.6, n)
        w = np.stack([w[0] * np.cos((u + 1) * np.pi / 4) * 1.41, w[1] * np.sin((u + 1) * np.pi / 4) * 1.41])
        w = set_lufs(w, music_lufs_s(peak) + level)          # `level` = LU relative to the music at the peak
        g = env(n, [(a, -120), (a + 0.2, -18), (peak, 0), (b - 0.6, -10), (b, -120)], a)
        add(tag, w * g * vocal_duck(a, n, depth_db=9.0 if "chill" in tag else 7.0), a, dict(
            cue="c. Cold wind gust: " + ("'air suddenly cold'" if "air" in tag else "'the wind picked up a chill'"),
            source="procedural wind (higher, faster band than the steppe wind, faint whistle)",
            processing=f"HP 300 Hz, dips -9 dB @ 2.3 kHz and -6 dB @ 4.2 kHz, ducked {9 if 'chill' in tag else 7} dB under the vocal, L->R sweep, "
                       f"swell to peak at {peak:.2f} s, out by {b:.2f} s",
            rationale="temperature drops in totality; the second gust is the shadow arriving"))


def cue_spark():
    t = word("spark")
    pre = 0.45
    dur = 3.6
    # B minor / B5 colours, high: B6 F#7 B7 D8 + a little inharmonic glass
    f = [3951.1, 5919.9, 4698.6 * 2.0, 7902.1, 2349.3 * 4.04, 11839.8]       # B7 F#8 D9 B8 (+ glass), all above the voice
    bell = partial_bell(f, [0.8, 0.6, 0.45, 0.4, 0.25, 0.2], [1.4, 1.1, 0.9, 0.7, 0.5, 0.35], dur, seed=41)
    sparkle = glitter(dur, seed=43, n_grains=90, f_range=(5000, 12000), decay=0.55)
    burst = bell + 0.9 * sparkle / (np.abs(sparkle).max() + 1e-9) * np.abs(bell).max()
    burst = convolve(burst, reverb_ir(2.2, 3.0, 0.01, 7000, 45) * 0.5)[:, :int(dur * SR)] + burst
    # pre-swell: the burst reversed through a long tail, rising into the word (light gathering)
    rev = convolve(burst[:, ::-1][:, :int(1.2 * SR)], reverb_ir(1.5, 2.0, 0.0, 6000, 47))[:, :int(pre * SR) * 3]
    swell = rev[:, ::-1][:, -int(pre * SR):] * np.linspace(0, 1, int(pre * SR)) ** 2
    x = np.concatenate([swell * db(rms_db(burst[:, :SR // 2]) - rms_db(swell) - 9), burst], axis=1)
    x = filt(x, "high", 3200, 4)
    x /= np.abs(x).max()
    n = x.shape[1]
    t0 = t - pre
    level = music_lufs_s(t) - 17.0          # bright, short: ~17 LU under the swell, above it only in the air band
    x = x * db(level - lufs_s(x[:, :int(1.8 * SR)]))
    x *= env(n, [(t0, 0), (t + 2.2, 0), (t0 + n / SR, -30)], t0)
    add("d_spark_shimmer", x, t0, dict(
        cue="d. 'a sudden spark': crystalline shimmer / light-burst on 'spark' (the diamond ring)",
        source="procedural (bell partials B7-F#8-B8-D9 + glass, 90 high glitter grains, open tail; reversed-tail pre-swell)",
        processing=f"pre-swell {pre:.2f} s into the word, burst at {t:.3f} s, HP 3.2 kHz (above the voice's intelligibility band), "
                   f"~3 s decay",
        rationale="the first point of light; tuned to B so it rings with the held 'spaaark'"))


def cue_cheer():
    t = word("Shadow", "chorus2")
    src = load(SRC / "army_cheer.mp3")
    # take the swell (find the loudest 4 s stretch) and push it across the valley
    e = np.array([rms_db(src[:, i:i + 4 * SR]) for i in range(0, src.shape[1] - 4 * SR, SR // 4)])
    st = int(np.argmax(e)) * (SR // 4)
    x = src[:, max(0, st - SR // 2):st + int(3.6 * SR)]
    x = distant(x, lp=1600, rt60=2.8, wet=0.7, seed=51, hp=180)
    x = presence_dip(x, -6.0, 2600, 0.8)
    n = x.shape[1]
    t0 = t
    level = music_lufs_s(t + 1.5) - 21.0
    x = x * db(level - lufs_s(x))
    x *= env(n, [(t0, -40), (t0 + 1.3, 0), (t0 + 2.4, -2), (t0 + 4.0, -40), (t0 + n / SR, -120)], t0)
    x *= vocal_duck(t0, n, depth_db=6.0)
    add("e_armies_roar", x, t0, dict(
        cue="e. 'Shadow turned to day': distant roar of two armies as the light returns",
        source="ElevenLabs music-v2 (sfx:army_cheer)",
        processing="loudest 4 s of the take; HP 180 Hz, LP 1.6 kHz, 70% wet open-air tail (RT 2.8 s), presence dip -6 dB; "
                   f"swell 0 -> +1.3 s, gone by +4.0 s; ducked 6 dB under the vocal",
        rationale="the Reykjavik-crowd beat from the brief, kept far away so the choir stays in front"))


def cue_blade():
    t = next(c["t"] for c in T["chops"] if c["word"] == "blade")
    src = load(SRC / "blade_drop.mp3")[:, :int(1.4 * SR)]
    main = filt(src, "high", 2200, 3)
    main = convolve(main, reverb_ir(1.2, 1.6, 0.01, 5000, 61) * 0.35)[:, :main.shape[1] + SR // 2] + np.pad(main, ((0, 0), (0, SR // 2)))
    n = main.shape[1]
    off = 0.06                                    # after the vocal's "bl" so the consonant leads
    level = music_lufs_s(t) - 20.0
    main = main * db(level - lufs_s(main[:, :int(0.6 * SR)]))
    main *= env(n, [(0, 0), (0.6, -3), (n / SR, -40)])
    add("f_blade_clang", main, t + off, dict(
        cue="f. Outro chop 'BLADE' (260.6 s): one metallic blade-drop transient",
        source="ElevenLabs music-v2 (sfx:blade_drop)",
        processing="HP 2.2 kHz (no low-end clutter, above the shout's body), short room (RT 1.2 s), 60 ms after the chop onset, "
                   "~20 LU under the music",
        rationale="the only clearly sung 'blade' in Drop 2/outro; the stop-time gap leaves room for one clean ring"))


def cue_ending():
    """freeze the final chord, crossfade the mastering fade into it, room tone, key clicks, the wink's ting."""
    chord = T["events"]["final_chord"]["t"]                    # 270.04
    win = (chord + 0.55, chord + 1.55)                         # sustained chord, after the attack, before the fade
    xf0 = 271.60                                               # original untouched until here
    hold, decay = 1.2, 4.6
    tail_len = hold + decay + 0.5
    tex = spectral_freeze(SONG, win, tail_len + 1.0, seed=71)[:, :int(tail_len * SR)]
    t = np.arange(tex.shape[1]) / SR
    ref = SONG[:, int((xf0 - 0.15) * SR):int((xf0 + 0.05) * SR)]
    g0 = db(rms_db(ref) - rms_db(tex[:, int(0.3 * SR):int(0.8 * SR)]))
    shape = np.where(t < hold, -2.5 * t / hold, -2.5 - 52.0 * np.clip((t - hold) / decay, 0, None) ** 1.25)   # linger, fall
    e = db(shape) * np.sin(np.pi / 2 * np.clip(t / 0.35, 0, 1))
    tail = tv_lowpass(tex * g0 * e, 7000.0, 900.0, curve=0.9)
    space = convolve(tail, reverb_ir(2.8, 3.6, 0.02, 3000, 73))[:, :tail.shape[1]]
    tail = tail + space * db(rms_db(tail[:, :SR]) - rms_db(space[:, :SR]) - 9)
    return dict(xf0=xf0, tail=tail, win=win, hold=hold, decay=decay)


def place_ending_extras(t_end):
    """room tone, three key clicks, the ting; returns their cue entries (positions on the extended timeline)."""
    rt0 = 272.2
    rt = room_tone(t_end - rt0, seed=81)
    n = rt.shape[1]
    rt *= db(-58.0 - rms_db(rt))
    rt *= env(n, [(rt0, -120), (rt0 + 1.5, 0), (t_end - 1.4, 0), (t_end - 0.4, -120)], rt0)
    add("g2_room_tone", rt, rt0, dict(cue="g. Ending: quiet room tone under the frozen chord", source="procedural (fan air + faint hum)",
                                      processing=f"in {rt0:.1f} -> {rt0 + 1.5:.1f} s, -58 dBFS RMS, out by {t_end - 0.4:.1f} s",
                                      rationale="the reveal is a real room; its air is the first non-musical space in the film"))
    kb = load(SRC / "keyboard.mp3")
    # the take has key presses at ~1.9, 3.85, 5.6 s (down+up each); use them as three separate keys
    keys = []
    for c in (1.90, 3.85, 5.60):
        a = int((c - 0.06) * SR)
        seg = kb[:, a:a + int(0.42 * SR)].copy()
        seg *= np.concatenate([np.ones(seg.shape[1] - int(0.08 * SR)), np.linspace(1, 0, int(0.08 * SR))])
        keys.append(seg)
    clicks = [273.45, 274.05, 274.95]
    for i, (k, tc) in enumerate(zip(keys, clicks)):
        k = filt(k, "high", 250, 2)
        k = k * db(-24.0 + [0, -2, -1][i] - 20 * np.log10(np.abs(k).max() + 1e-12))   # small: peaks -24..-26 dBFS
        add(f"g3_key_{i + 1}", k, tc - 0.06, dict(cue="g. Ending: mechanical-keyboard click", source="ElevenLabs music-v2 (sfx:keyboard)",
                                                  processing="one key press (down+up) from the take, HP 250 Hz, close and dry",
                                                  rationale="someone is at a terminal"))
    tt = t_end - 1.85
    bell = partial_bell([2960.0, 3951.1, 5919.9, 7902.1], [1.0, 0.7, 0.35, 0.2], [0.55, 0.45, 0.3, 0.2], 2.4, seed=91)
    glit = glitter(2.4, seed=93, n_grains=28, f_range=(6000, 12500), decay=0.12, rise=0.10)
    ting = np.concatenate([np.zeros((2, int(0.10 * SR))), bell], axis=1)[:, :glit.shape[1]] + 0.5 * glit / (np.abs(glit).max() + 1e-9)
    ting = filt(ting, "high", 2000, 2)
    ting = convolve(ting, reverb_ir(1.0, 1.4, 0.01, 8000, 95) * 0.3)[:, :ting.shape[1]] + ting
    ting *= db(-20.0 - 20 * np.log10(np.abs(ting).max() + 1e-12))      # small and bright: peak -20 dBFS
    fo = int(0.5 * SR)
    ting[:, -fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2       # the ring dies out inside its own buffer
    add("g4_wink_ting", ting, tt - 0.10, dict(cue="g. Ending: one small bright sparkle / 'ting' for the wink",
                                              source="procedural (F#7-B7 tine partials + a 0.1 s rising glitter)",
                                              processing=f"glitter from {tt - 0.10:.2f} s, tine at {tt:.2f} s, HP 2 kHz, ~1.5 s ring, peak -20 dBFS",
                                              rationale="the eyelid closes like the Moon over the Sun: the last light in the film"))
    return tt


# ============================================================================ mix, loudness, export
def main():
    SFX.mkdir(parents=True, exist_ok=True)
    cue_wind_open()
    cue_battle_bed()
    cue_birdsong()
    cue_gusts()
    cue_spark()
    cue_cheer()
    cue_blade()
    end = cue_ending()
    xf0 = end["xf0"]
    t_sound = round(xf0 + end["tail"].shape[1] / SR + 0.9, 3)    # last audible moment (room tone/ting gone)
    ting_t = place_ending_extras(t_sound)
    SILENCE = 0.8                                                  # true digital silence for the cut to black
    t_end = round(t_sound + SILENCE, 3)
    n_out = int(round(t_end * SR))
    # music: original to xf0, then its own fade crossfades (0.6 s) into the frozen chord
    music = np.zeros((2, n_out))
    k = int(xf0 * SR)
    music[:, :N0] = SONG
    L = int(0.6 * SR)
    fo = np.cos(np.linspace(0, np.pi / 2, L)) ** 2
    music[:, k:k + L] *= fo
    music[:, k + L:] = 0.0
    tail = end["tail"]
    fi = np.sin(np.linspace(0, np.pi / 2, L)) ** 2
    tail[:, :L] *= fi
    m = min(tail.shape[1], n_out - k)
    music[:, k:k + m] += tail[:, :m]
    k_snd = int(t_sound * SR)
    fe = int(0.35 * SR)
    music[:, k_snd - fe:k_snd] *= np.cos(np.linspace(0, np.pi / 2, fe)) ** 2
    music[:, k_snd:] = 0.0
    # cue bus
    bus = np.zeros((2, n_out))
    report = []
    for c in CUES:
        i = int(round(c["t0"] * SR))
        x = c["x"][:, :max(0, n_out - i)]
        bus[:, i:i + x.shape[1]] += x
        span = (c["t0"], min(c["t0"] + x.shape[1] / SR, t_sound))
        mus = SONG[:, int(span[0] * SR):min(N0, int(span[1] * SR))]
        peak_win = max(range(0, max(1, x.shape[1] - int(1.5 * SR)), max(1, SR // 4)),
                       key=lambda q: np.mean(x[:, q:q + int(1.5 * SR)] ** 2)) if x.shape[1] > 1.5 * SR else 0
        short = x.shape[1] < 0.6 * SR
        cue_l = lufs_s(x[:, peak_win:peak_win + int(3 * SR)]) if not short else None
        mus_l = music_lufs_s(c["t0"] + (peak_win / SR) + 1.5) if span[0] < DUR0 - 2 else None
        pk = 20 * np.log10(np.abs(x).max() + 1e-12)
        # vocal masking check: where the lead sings, cue vs lead-vocal level in the 1-5 kHz intelligibility band
        mask = None
        a_, b_ = int(span[0] * SR), min(N0, int(span[1] * SR))
        if b_ - a_ > SR // 2:
            vb = filt(VOCAL_ST[:, a_:b_], "band", [1000, 5000], 2)
            cb = filt(x[:, :b_ - a_], "band", [1000, 5000], 2)
            hop = SR // 20
            fr = [(rms_db(vb[:, i:i + hop]), rms_db(cb[:, i:i + hop])) for i in range(0, b_ - a_ - hop, hop)]
            sung = [v - q for v, q in fr if v > -40 and q > -100]
            mask = round(float(np.percentile(sung, 5)), 1) if len(sung) > 5 else None
        fn = SFX / f"cue_{c['name']}.flac"          # regenerable intermediates (media/sfx/*.flac is gitignored)
        sf.write(fn, x.T.astype(np.float32), SR, subtype="PCM_16")
        report.append(dict({k2: v for k2, v in c.items() if k2 != "x"}, t1=round(span[1], 3), t0=round(span[0], 3),
                           peak_dbfs=round(pk, 1), peak_rms_dbfs=round(rms_db(x[:, peak_win:peak_win + int(1.5 * SR)]), 1),
                           cue_LUFS_S=round(cue_l, 1) if cue_l is not None else None,
                           music_LUFS_S=round(mus_l, 1) if mus_l is not None else None,
                           rel_LU=round(cue_l - mus_l, 1) if cue_l is not None and mus_l is not None and mus_l > -60 else None,
                           vocal_margin_db_p5=mask, file=str(fn.relative_to(ROOT))))
        cue_l = cue_l if cue_l is not None else -70.0
        mus_l = mus_l if mus_l is not None else -70.0
        print(f"[sd] {c['name']:20s} {span[0]:7.2f}-{span[1]:7.2f}  cue {cue_l:6.1f} LUFS-S  music {mus_l:6.1f}  "
              f"rel {cue_l - mus_l:+6.1f} LU  peak {pk:6.1f} dBFS  vocal margin p5 {mask}")
    bus[:, k_snd - fe:k_snd] *= np.cos(np.linspace(0, np.pi / 2, fe)) ** 2
    bus[:, k_snd:] = 0.0
    mix = music + bus
    # loudness: the original's integrated loudness / true peak, matched (gain applied only if the cue layer moved it)
    def tp(x):
        return 20 * np.log10(np.abs(np.stack([resample_poly(c, 4, 1) for c in x])).max() + 1e-12)
    I0, I1 = METER.integrated_loudness(SONG.T), METER.integrated_loudness(mix.T)
    trim = I0 - I1 if abs(I0 - I1) > 0.05 else 0.0
    mix *= db(trim)
    I2, tp0, tp2 = METER.integrated_loudness(mix.T), tp(SONG), tp(mix)
    print(f"[sd] loudness: original {I0:.2f} LUFS / {tp0:.2f} dBTP; new {I1:.2f} -> trim {trim:+.2f} dB -> {I2:.2f} LUFS / {tp2:.2f} dBTP")
    sf.write(MASTER, mix.T.astype(np.float32), SR, subtype="PCM_24")
    sf.write(BUS, bus.T.astype(np.float32), SR, subtype="PCM_24")
    for old_f in list(SFX.glob("cue_*")) + [SFX / "sfx_bus.flac"]:      # drop files of cues that no longer exist
        if old_f.exists() and old_f.stem[4:] not in {c["name"] for c in CUES}:
            old_f.unlink()
    MP3.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(MASTER), "-i", str(ROOT / "Halys.mp3"),
                    "-map", "0:a", "-map", "1:v?", "-map_metadata", "1", "-c:a", "libmp3lame", "-b:a", "320k", "-ar", str(SR),
                    "-c:v", "copy", "-id3v2_version", "3", "-metadata", "title=The River Halys (sound design)",
                    "-metadata", "comment=original song unchanged + sound-design layer and extended ending (halys-music-video)",
                    "-metadata:s:v", "title=Cover", "-metadata:s:v", "comment=Cover (front)", str(MP3)], check=True)
    rep = dict(dur_original=round(DUR0, 3), dur_new=t_end, last_sound=t_sound, wink_ting=round(ting_t, 3), ending=dict(
        crossfade_at=xf0, freeze_window=[round(v, 2) for v in end["win"]], hold=end["hold"], decay=end["decay"]),
        loudness=dict(original_I=round(I0, 2), original_TP=round(tp0, 2), mixed_I_before_trim=round(I1, 2), trim_db=round(trim, 2),
                      master_I=round(I2, 2), master_TP=round(tp2, 2)), cues=report)
    (SFX / "cues.json").write_text(json.dumps(rep, indent=1))
    print(f"[sd] wrote {MASTER.name} ({t_end:.2f} s), {MP3}, media/sfx/cues.json")


if __name__ == "__main__":
    main()
