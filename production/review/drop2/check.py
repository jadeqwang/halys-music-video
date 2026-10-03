#!/usr/bin/env python3
"""Drop 2 (ORBIT) checks on RENDERED frames (video/out/frames_drop2/f%05d.jpg, 1920x1080@60) against timing.json:

    python3 production/review/drop2/check.py [--dir=video/out/frames_drop2] [--t0=213] [--t1=267]

  cuts    frame-difference peaks vs the shot cuts (SHOTLIST downbeats); offset in frames (+ = picture after the sound)
  kicks   the brightness peak of each kick window (-2..+6 frames) in the 60 fps shots with the kick in (S63-S73)
  ring    S64-S70: the crisp black disk's centroid and radius (frame px) vs the frame centre; S71: the bright sun disk
  blue    the first frame with saturated blue (B - max(R, G) > 48 on > 0.05 % of the pixels) and the most blue before S72
A frame shows song time i/60; an event at t belongs to frame ceil(60 t), so 0 frames = on the frame (0-16.7 ms late).
"""
import json, math, pathlib, sys
import numpy as np, cv2

ROOT = pathlib.Path(__file__).resolve().parents[3]
FPS = 60
fi = lambda t: int(math.ceil(t * FPS - 1e-6))
CUTS = {'S63': 215.287, 'S64': 222.077, 'S65': 225.476, 'S66': 228.876, 'S67': 232.266, 'S68': 235.656, 'S69': 239.046, 'S70': 242.446,
        'S71': 245.826, 'S72': 249.215, 'S73': 255.985, 'S74': 257.675, 'S75': 259.36, 'S77': 262.72, 'S78': 266.12}
CASCADE = [('S64', 222.077, 225.476), ('S65', 225.476, 228.876), ('S66', 228.876, 232.266), ('S67', 232.266, 235.656), ('S68', 235.656, 239.046),
           ('S69', 239.046, 242.446), ('S70', 242.446, 245.826), ('S71', 245.826, 249.215)]


def load(d, i, size=None, gray=False):
    p = d / f'f{i:05d}.jpg'
    if not p.exists(): return None
    im = cv2.imread(str(p), cv2.IMREAD_GRAYSCALE if gray else cv2.IMREAD_COLOR)
    return cv2.resize(im, size, interpolation=cv2.INTER_AREA) if size else im


def main():
    kw = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    d = ROOT / kw.get('dir', 'video/out/frames_drop2'); t0, t1 = float(kw.get('t0', 213)), float(kw.get('t1', 267))
    T = json.loads((ROOT / 'video/data/timing.json').read_text())
    a, b = fi(t0), fi(t1)
    idx, small = [], []
    for i in range(a, b):
        im = load(d, i, (160, 90), gray=True)
        if im is None: continue
        idx.append(i); small.append(im.astype(np.float32) / 255)
    if not idx: sys.exit(f'no frames in {d} for {t0}-{t1}')
    idx = np.array(idx); fr = np.stack(small); pos = {int(i): k for k, i in enumerate(idx)}
    diff = np.r_[0, np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))]
    lum = fr.mean(axis=(1, 2))
    print(f'{len(idx)} frames f{idx[0]}-f{idx[-1]} ({idx[0] / FPS:.2f}-{(idx[-1] + 1) / FPS:.2f} s) from {d}')
    # ---- cuts
    print('\ncuts (shot list downbeats): frame of the biggest frame difference within +-3 frames of the cut')
    for sid, t in CUTS.items():
        e = fi(t)
        if e - 3 not in pos or e + 3 not in pos: continue
        win = [(diff[pos[j]], j) for j in range(e - 3, e + 4) if j in pos]
        dv, j = max(win)
        med = np.median([diff[pos[k]] for k in range(e - 30, e - 5) if k in pos] or [1e-3])
        print(f'  {sid:4s} {t:8.3f}  frame {e}  peak at {j - e:+d} ({(j - e) * 1000 / FPS:+.0f} ms)  strength {dv / max(med, 1e-4):5.1f}x')
    # ---- kicks: brightness peak per kick window, kick-in shots only (S63-S73: 215.287-257.675)
    kicks = [k for k in T['events']['kicks'] if max(t0, 215.29) <= k < min(t1, 257.6)]
    offs = []
    for k in kicks:
        e = fi(k)
        if any(abs(e - fi(c)) <= 3 for c in CUTS.values()): continue          # cuts dominate the brightness there
        win = [(lum[pos[j]], j) for j in range(e - 2, e + 7) if j in pos]
        if len(win) < 9: continue
        offs.append(max(win)[1] - e)
    if offs:
        o = np.array(offs)
        print(f'\nkick pulses: {len(o)} kicks (away from cuts): brightness peak on the kick frame {np.mean(o == 0) * 100:.0f} %, within +-1 frame {np.mean(np.abs(o) <= 1) * 100:.0f} %, median {np.median(o):+.0f}')
    # ---- the locked ring
    print('\nthe ring (S64-S71): disk centroid offset from the frame centre (px at 1920x1080), radius')
    for sid, s0, s1 in CASCADE:
        devs, rads = [], []
        for t in np.linspace(s0 + .03, s1 - .03, 9):
            im = load(d, fi(t), gray=True)
            if im is None: continue
            H, W = im.shape; cy, cx = H // 2, W // 2; R = int(.105 * H * 1.6)
            roi = im[cy - R:cy + R, cx - R:cx + R].astype(np.float32)
            if sid == 'S71':      # the bright solar disk: the smallest circle enclosing its bright limb (Phobos cuts the hatching)
                rr = int(.105 * H * 1.2); sub = roi[R - rr:R + rr, R - rr:R + rr]
                pts = np.argwhere(sub > 170)[:, ::-1].astype(np.float32)
                if len(pts) < 50: continue
                (ex, ey), er = cv2.minEnclosingCircle(pts)
                devs.append(math.hypot(ex - rr + .5, ey - rr + .5)); rads.append(er); continue
            elif sid == 'S69':    # the Moon's disk carries earthshine: fit a circle to the limb (first bright pixel outward)
                pts = []
                for a in np.linspace(0, 2 * math.pi, 180, endpoint=False):
                    for r in np.arange(.6 * R / 1.6, 1.5 * R / 1.6, .5):
                        x, y = R + r * math.cos(a), R + r * math.sin(a)
                        if roi[int(y), int(x)] > 150: pts.append((x, y)); break
                if len(pts) < 90: continue
                P = np.array(pts); A = np.c_[2 * P, np.ones(len(P))]; b = (P ** 2).sum(1)
                (ex, ey, c0), *_ = np.linalg.lstsq(A, b, rcond=None)
                devs.append(math.hypot(ex - R, ey - R)); rads.append(math.sqrt(c0 + ex * ex + ey * ey)); continue
            else:                 # the crisp black disk: the connected dark region at the centre
                m = (roi < 14).astype(np.uint8)
                n, lab = cv2.connectedComponents(m)
                m = lab == lab[R, R] if lab[R, R] else np.zeros_like(m, bool)
            ys, xs = np.nonzero(m)
            if len(xs) < 50: continue
            devs.append(math.hypot(xs.mean() - R + .5, ys.mean() - R + .5)); rads.append(math.sqrt(len(xs) / math.pi))
        if devs:
            print(f'  {sid}: max offset {max(devs):5.2f} px, mean {np.mean(devs):5.2f} px; radius {np.mean(rads):6.1f} px (expected {.105 * 1080:.1f}, kick pulse to +2.2 %)')
    # ---- the first blue
    first, before = None, (0, None)
    for i in idx[::2]:
        im = load(d, int(i), (480, 270))
        B, G, R_ = [im[..., c].astype(np.int16) for c in range(3)]
        frac = float(np.mean((B - np.maximum(R_, G)) > 48))
        if i < fi(249.215) and frac > before[0]: before = (frac, int(i))
        if first is None and frac > .0005: first = (int(i), frac)
    print(f'\nblue: first frame with saturated blue: {first and f"f{first[0]} ({first[0] / FPS:.3f} s, {first[1] * 100:.2f} % of pixels)"}; S72 starts at f{fi(249.215)}')
    print(f'      most blue before S72: {before[0] * 100:.3f} % of pixels{f" at f{before[1]} ({before[1] / FPS:.2f} s)" if before[1] else ""}')


if __name__ == '__main__':
    main()
