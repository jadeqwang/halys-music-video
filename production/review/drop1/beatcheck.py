#!/usr/bin/env python3
"""Beat-sync check for Drop 1: measures the RENDERED picture against the song's events (video/data/timing.json).

    python3 production/review/drop1/beatcheck.py CLIP.mp4 --t0=108 [--t1=156]
    python3 production/review/drop1/beatcheck.py video/out/frames --t0=108 --t1=156      (JPEG frames f%05d.jpg, 60 fps)

From the picture alone it finds
  cuts        frames whose difference to the previous frame is a strong local peak (hard cuts, formation snaps)
  inversions  frames whose mean luminance jumps above 0.45 (dark lines on pearl)
  pulses      the brightness peak of every kick window (kick -> peak frame within -3..+5 frames)
and prints, per event list, the offset from the audio event to the visual event in frames and ms (+ = picture after
sound). A frame shows song time i/60, so an event at t lands on frame ceil(60 t): offsets of 0..16.7 ms are "on the frame".
"""
import json, pathlib, subprocess, sys
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[3]
FPS = 60


def frames_from(src, t0, t1, w=160, h=90):
    p = pathlib.Path(src)
    if p.is_dir():
        import cv2
        a, b = int(np.ceil(t0 * FPS - 1e-6)), int(np.ceil(t1 * FPS - 1e-6))
        out, idx = [], []
        for i in range(a, b):
            f = p / f"f{i:05d}.jpg"
            if not f.exists():
                continue
            im = cv2.imread(str(f), cv2.IMREAD_GRAYSCALE)
            out.append(cv2.resize(im, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32) / 255)
            idx.append(i)
        return np.array(idx), np.stack(out)
    # an MP4 that starts at song time t0 (render.mjs --clip / --encode --range)
    cmd = ["ffmpeg", "-v", "error", "-i", str(p), "-vf", f"scale={w}:{h}:flags=area,format=gray", "-f", "rawvideo", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32) / 255
    first = int(round(t0 * FPS))
    idx = np.arange(first, first + len(fr))
    keep = idx < np.ceil(t1 * FPS)
    return idx[keep], fr[keep]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    kw = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
    src, t0, t1 = args[0], float(kw.get("t0", 108)), float(kw.get("t1", 156))
    T = json.loads((ROOT / "video/data/timing.json").read_text())
    ev = T["events"]
    kicks = [k for k in ev["kicks"] if t0 <= k < t1]
    stabs = [s["t"] for s in ev["stabs"] if t0 <= s["t"] < t1]
    stut = [c["t"] for c in T["chops"] if c["word"] == "stutter" and t0 <= c["t"] < t1]
    idx, fr = frames_from(src, t0, t1)
    lum = fr.mean(axis=(1, 2))
    diff = np.r_[0, np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))]
    fi = lambda t: int(np.ceil(t * FPS - 1e-6))
    pos = {int(i): k for k, i in enumerate(idx)}
    ms = lambda d: d * 1000 / FPS

    # cuts: strong local peaks of the frame difference
    med = np.median(diff[1:]) + 1e-6
    cut_frames = [int(idx[k]) for k in range(1, len(diff) - 1) if diff[k] > max(6 * med, .018) and diff[k] >= diff[k - 1] and diff[k] >= diff[k + 1]]
    inv_frames = [int(idx[k]) for k in range(len(lum)) if lum[k] > .45]

    def match(events, frames, window=3, name=""):
        rows, offs = [], []
        fs = np.array(frames) if frames else np.array([-10 ** 9])
        for t in events:
            e = fi(t)
            j = int(np.argmin(np.abs(fs - e)))
            d = int(fs[j] - e)
            hit = abs(d) <= window
            rows.append((t, e, d if hit else None))
            if hit:
                offs.append(d)
        n = len(events)
        print(f"\n{name}: {len(offs)}/{n} matched within +-{window} frames")
        if offs:
            o = np.array(offs)
            exact = (o == 0).mean() * 100
            print(f"  offset frames: mean {o.mean():+.2f}  max |d| {np.abs(o).max()}  on the event frame: {exact:.0f} %")
            # audio -> picture offset in ms: frame time minus audio time
            om = [ (fi(t) + d) / FPS * 1000 - t * 1000 for (t, e, d) in rows if d is not None]
            print(f"  picture after sound (ms): mean {np.mean(om):+.1f}  min {np.min(om):+.1f}  max {np.max(om):+.1f}")
        return rows

    print(f"{src}: frames {idx[0]}-{idx[-1]} ({len(idx)}), t {t0}-{t1}")
    print(f"kicks {len(kicks)}, stabs {len(stabs)}, stutter onsets {len(stut)}; detected cuts {len(cut_frames)}, inverted frames {len(inv_frames)}")

    # stutter cuts
    st_rows = match([t for t in stut], cut_frames, 1, "S36/S37 stutter onsets -> hard cuts")
    # shotlist cuts (all Drop 1 shot boundaries)
    cuts = [110.58, 112.31, 117.53, 124.47, 126.21, 133.13, 140.04, 143.49, 146.94, 150.38, 153.83]
    match([c for c in cuts if t0 < c < t1], cut_frames, 1, "shot cuts (SHOTLIST)")
    # formation snaps (S39)
    snaps = [127.505, 128.803, 129.236, 130.967, 131.828, 132.694]
    match([s for s in snaps if t0 <= s < t1], cut_frames, 1, "S39 formation snaps -> picture jumps")
    # inversions: first inverted frame of each run vs the S36 stab list
    runs = [f for k, f in enumerate(inv_frames) if k == 0 or inv_frames[k - 1] != f - 1]
    lens = []
    for r in runs:
        n = 1
        while r + n in inv_frames:
            n += 1
        lens.append(n)
    s36 = [112.74, 113.173, 113.607, 115.783, 116.217, 116.652, 117.086]
    match([s for s in s36 if t0 <= s < t1], runs, 1, "S36 stab inversions (first inverted frame)")
    if lens:
        print(f"  inversion run lengths (frames): {sorted(set(lens))}")
    # kick pulses: brightness peak near each kick (only frames inside the same shot: skip kicks next to cuts)
    offs = []
    for t in kicks:
        e = fi(t)
        if any(abs(e - c) <= 2 for c in cut_frames) or any(abs(e - r) <= 3 for r in runs):
            continue
        ks = [pos[i] for i in range(e - 3, e + 6) if i in pos]
        if len(ks) < 6:
            continue
        seg = lum[ks]
        k = int(np.argmax(seg))
        offs.append(idx[ks[k]] - e)
    if offs:
        o = np.array(offs)
        print(f"\nkick pulses -> brightness peak: {len(o)} kicks measured (away from cuts/inversions)")
        print(f"  offset frames: mean {o.mean():+.2f}  median {np.median(o):+.0f}  on the kick frame: {(o == 0).mean() * 100:.0f} %  within 1 frame: {(np.abs(o) <= 1).mean() * 100:.0f} %")
        hist = {int(v): int((o == v).sum()) for v in sorted(set(o.tolist()))}
        print(f"  histogram {hist}")


if __name__ == "__main__":
    main()
