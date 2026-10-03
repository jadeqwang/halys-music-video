#!/usr/bin/env python3
"""track_p33.py: the thrown sword in plate P33, tracked from the plate's mattes (video/plates/P33/masks, odd frames).

Writes p33_sword.json next to this script: [{f, tp, u, v, ang, len, hilt: [u, v], tip: [u, v]}] in plate uv (0..1)
and plate seconds (24 fps). The sword is the elongated matte component above the thrower once it has left his hand.
Run: python3 video/src/worlds/marble/data/track_p33.py
"""
import json, glob, os
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
out = []
for p in sorted(glob.glob(os.path.join(ROOT, 'plates/P33/masks/m*.png'))):
    f = int(os.path.basename(p)[1:5])
    m = cv2.imread(p, cv2.IMREAD_GRAYSCALE)
    h, w = m.shape
    n, lab, stats, cents = cv2.connectedComponentsWithStats((m > 128).astype(np.uint8), 8)
    best = None
    for k in range(1, n):
        x, y, bw, bh, area = stats[k]
        if area < 12 or area > 0.02 * w * h: continue
        if y + bh >= h - 2: continue                      # touching the bottom: the thrower
        ys, xs = np.nonzero(lab == k)
        pts = np.stack([xs, ys], 1).astype(np.float64)
        c = pts.mean(0); cov = np.cov((pts - c).T)
        ev, evec = np.linalg.eigh(cov)
        el = np.sqrt(max(ev[1], 1e-6) / max(ev[0], 1e-6))
        if el < 2.6: continue
        ax = evec[:, 1]; s = (pts - c) @ ax
        L = s.max() - s.min()
        # the hilt is the end with more mass across the axis (guard + grip + pommel)
        q = (pts - c) @ np.array([-ax[1], ax[0]])
        lo = np.abs(q[s < np.percentile(s, 30)]).mean() if (s < np.percentile(s, 30)).any() else 0
        hi = np.abs(q[s > np.percentile(s, 70)]).mean() if (s > np.percentile(s, 70)).any() else 0
        hilt_dir = -1 if lo > hi else 1
        hilt = c + ax * (s.min() if hilt_dir < 0 else s.max())
        tip = c + ax * (s.max() if hilt_dir < 0 else s.min())
        cand = dict(f=f, tp=round((f - 1) / 24, 4), u=c[0] / w, v=c[1] / h, len=L / h, el=float(el),
                    hilt=[hilt[0] / w, hilt[1] / h], tip=[tip[0] / w, tip[1] / h])
        d = tip - hilt; cand['ang'] = float(np.degrees(np.arctan2(d[1], d[0])))   # hilt -> tip, screen degrees (y down)
        if best is None or el > best['el']: best = cand
    if best: out.append(best)
for o in out:
    for k in ('u', 'v', 'len', 'el', 'ang'): o[k] = round(float(o[k]), 4)
    o['hilt'] = [round(float(x), 4) for x in o['hilt']]; o['tip'] = [round(float(x), 4) for x in o['tip']]
json.dump(out, open(os.path.join(HERE, 'p33_sword.json'), 'w'), indent=0)
print(len(out), 'frames tracked:', [(o['f'], o['u'], o['v'], o['ang']) for o in out[::4]])
