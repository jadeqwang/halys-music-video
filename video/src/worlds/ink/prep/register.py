"""Register a room plate into another plate's 960x540 frame by a similarity (SIFT on the room, her excluded).

    python3 video/src/worlds/ink/prep/register.py P57 --to=P39 [--frames=1,40,90] [--to-frame=40]

Prints the similarity in sheets.js REG form (x_setup = s * x_src + tx, y_setup = s * y_src + ty), the inlier count and the
median residual. Her pixels are excluded with each plate's matte (INK prep mattes when present, else the pipeline masks,
dilated) plus a generous keep-out box around the chair, so only the room votes.
"""
import json, pathlib, sys
import numpy as np, cv2

ROOT = pathlib.Path(__file__).resolve().parents[5]
PL = ROOT / 'video' / 'plates'
INK = pathlib.Path(__file__).resolve().parents[1] / 'mattes'


def frame(pid, pf):
    return cv2.imread(str(PL / pid / 'frames' / f'f{pf:04d}.jpg'), cv2.IMREAD_GRAYSCALE)


def matte(pid, pf, take):
    d = INK / f'{pid}_{take}'
    cands = sorted(d.glob('m*.png'), key=lambda p: abs(int(p.stem[1:]) - pf)) if d.exists() else []
    if not cands:
        m = PL / pid / 'masks'
        cands = sorted(m.glob('m*.png'), key=lambda p: abs(int(p.stem[1:]) - pf)) if m.exists() else []
    if not cands:
        return None
    a = cv2.resize(cv2.imread(str(cands[0]), cv2.IMREAD_GRAYSCALE), (960, 540), interpolation=cv2.INTER_LINEAR)   # pipeline masks are 480x270
    return cv2.dilate((a > 64).astype(np.uint8), np.ones((25, 25), np.uint8))


def room_mask(pid, pf, take, keepout):
    img = frame(pid, pf)
    m = np.full(img.shape, 255, np.uint8)
    mt = matte(pid, pf, take)
    if mt is not None:
        m[mt > 0] = 0
    if keepout:
        x0, y0, x1, y1 = keepout
        m[y0:y1, x0:x1] = 0
    return img, m


def main(argv):
    pos = [a for a in argv if not a.startswith('--')]
    kw = {a[2:].split('=', 1)[0]: (a.split('=', 1)[1] if '=' in a else True) for a in argv if a.startswith('--')}
    src, dst = pos[0], kw.get('to', 'P39')
    idx = json.loads((PL / 'index.json').read_text())
    stem = lambda p: pathlib.Path(idx[p]['take']).stem
    keep = tuple(int(v) for v in kw.get('keepout', '150,120,560,540').split(','))
    dimg, dmask = room_mask(dst, int(kw.get('to-frame', 40)), stem(dst), keep)
    sift = cv2.SIFT_create(6000)
    kd, dd = sift.detectAndCompute(dimg, dmask)
    out, pooled = [], []
    for pf in [int(v) for v in str(kw.get('frames', '1')).split(',')]:
        simg, smask = room_mask(src, pf, stem(src), keep)
        ks, ds = sift.detectAndCompute(simg, smask)
        mt = cv2.BFMatcher(cv2.NORM_L2).knnMatch(ds, dd, k=2)
        good = [m for m, n in (p for p in mt if len(p) == 2) if m.distance < .72 * n.distance]
        A = np.float32([ks[m.queryIdx].pt for m in good]); B = np.float32([kd[m.trainIdx].pt for m in good])
        M, inl = cv2.estimateAffinePartial2D(A, B, method=cv2.RANSAC, ransacReprojThreshold=1.5, maxIters=20000, confidence=.999)
        inl = inl.ravel().astype(bool)
        pooled.append({'A': A[inl], 'B': B[inl]})
        s = float(np.hypot(M[0, 0], M[1, 0])); rot = float(np.degrees(np.arctan2(M[1, 0], M[0, 0])))
        res = np.hypot(*(A[inl] @ M[:, :2].T + M[:, 2] - B[inl]).T)
        out.append(dict(pf=pf, s=s, rot=rot, tx=float(M[0, 2]), ty=float(M[1, 2]), inliers=int(inl.sum()), matches=len(good),
                        med_px=float(np.median(res))))
        print(f'{src} f{pf} -> {dst}: s={s:.5f} rot={rot:+.3f} deg tx={M[0, 2]:+.2f} ty={M[1, 2]:+.2f}  inliers {inl.sum()}/{len(good)}  '
              f'median residual {np.median(res):.2f} px')
    o = out[0]
    if len(out) > 1:
        # one camera (Seedance's static camera): scale + translation, no rotation (the REG form), fitted by RANSAC on the
        # inlier matches of every frame pooled; per-frame fits trade rotation against translation on the room's mostly
        # horizontal edges, which is noise, not motion
        A = np.concatenate([q['A'] for q in pooled]); B = np.concatenate([q['B'] for q in pooled])
        best = None
        rng = np.random.default_rng(0)
        for _ in range(4000):
            i, j = rng.choice(len(A), 2, replace=False)
            dA, dB = A[i] - A[j], B[i] - B[j]
            if np.hypot(*dA) < 40:
                continue
            sc = np.hypot(*dB) / np.hypot(*dA); t = B[i] - sc * A[i]
            r = np.hypot(*(sc * A + t - B).T); n = int((r < 1.5).sum())
            if best is None or n > best[0]:
                best = (n, r < 1.5)
        inl = best[1]
        X = np.zeros((2 * inl.sum(), 3)); Y = np.zeros(2 * inl.sum())
        X[0::2, 0] = A[inl, 0]; X[0::2, 1] = 1; X[1::2, 0] = A[inl, 1]; X[1::2, 2] = 1; Y[0::2] = B[inl, 0]; Y[1::2] = B[inl, 1]
        sc, tx, ty = np.linalg.lstsq(X, Y, rcond=None)[0]
        r = np.hypot(*(sc * A[inl] + [tx, ty] - B[inl]).T)
        print(f"pooled (no rotation): s={sc:.5f} tx={tx:+.2f} ty={ty:+.2f}  inliers {inl.sum()}/{len(A)}  median residual {np.median(r):.2f} px")
        o = dict(s=sc, tx=tx, ty=ty)
    print(f"REG['{src}:{idx[src]['take']}->{dst}'] = {{ s: {o['s']:.5f}, tx: {o['tx']:.2f}, ty: {o['ty']:.2f} }}")


if __name__ == '__main__':
    main(sys.argv[1:])
