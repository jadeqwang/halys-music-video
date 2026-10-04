"""INK direct footage (v3, the rewind decision): her ORIGINAL anime footage, matted and lightly graded, for S78 / S80 / S81.

    python3 video/src/worlds/ink/prep/direct.py P57 P59 [--frames='P57:1,3;P59:5'] [--force] [--debug=out.jpg]

Why: the director wants her kept in her own anime medium so she stands apart from the abstract room (the rewind video: the
anime footage composited directly, a light grade, an ink outline and a scene rim light; a cel re-segmentation of her was
rejected as weird). So the plate itself is shown, never redrawn.

Output: video/src/worlds/ink/direct/<plate>_<take stem>/d%04d.webp, RGBA at the take's native size (1280x720, decoded from
media/plates/<id>/<take>, not the pipeline's 960x540 JPEGs): the footage graded lightly toward the room (the bottom of the
range to the room's ink, the top to its pearl, blue casts trimmed, the orange kept), alpha = her matte (the INK prep matte,
prep/mattes.py, upsampled and snapped to the full-size frame with a guided filter, then cut crisp, choked 1 px and
antialiased). index.json lists the frames per take. The renderer (worlds/ink/direct.js) adds the ink outline, the scene
light and the rim, and maps the frame into the setup through sheets.js REG (x_setup = s * x_960 + tx; x_960 = x * 960 / w).
"""
import json, pathlib, sys
import numpy as np
import cv2

ROOT = pathlib.Path(__file__).resolve().parents[5]
INK = pathlib.Path(__file__).resolve().parents[1]
OUT = INK / 'direct'
MATTES = INK / 'mattes'

# the room's ends of the range (palette.js ROOM.ink / ROOM.pearl), BGR 0..1
DARK = np.array([12, 8, 7], np.float32) / 255
LIGHT = np.array([230, 239, 243], np.float32) / 255

# per plate: zones in the plate's 960x540 frame. P57 (behind her chair, P39's camera): the chair back is in front of her
# hips; the painted room has the same chair (P39), so the plate's chair is cut out of her matte and the room's chair shows
# through, in front of her. The chair is what stays still (the camera is locked, she moves behind it): dark pixels inside
# the chair zone that keep their median brightness in most frames of the take, grown 2 px over its flickering outline.
ZONES = {
    'P57': {'chair': [[105, 366], [228, 369], [318, 388], [340, 418], [344, 540], [100, 540]]},
    'P59': {},
}


def static_mask(src, poly960, sd_max=0.035, l_max=0.55):
    H, W = src[0].shape[:2]
    A = np.stack([cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in src]).astype(np.float32) / 255
    med = np.median(A, 0)
    still = (np.abs(A - med) < sd_max * 1.7).mean(0) > 0.6     # the same in most frames (she uncovers it only now and then)
    poly = np.zeros((H, W), np.uint8); cv2.fillPoly(poly, [np.int32(np.array(poly960) * W / 960)], 1)
    m = (still & (med < l_max) & (poly > 0)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n > 1: m = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    return cv2.dilate(m, np.ones((5, 5), np.uint8)) * (poly > 0)


def grade(bgr):
    """Light touch: the footage stays the footage. Deepen only the very bottom, a slight S, trim blue casts (hue 190-260 deg
    loses a quarter of its chroma; her eyes, skin and the orange keep theirs), map 0..1 onto the room's ink..pearl."""
    x = bgr.astype(np.float32) / 255
    x = np.clip((x - 0.012) / 0.976, 0, 1)
    x = x * x * (3 - 2 * x) * 0.18 + x * 0.82
    hsv = cv2.cvtColor((x * 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    h = hsv[..., 0] * 2
    blue = np.clip(1 - np.abs(h - 225) / 45, 0, 1)
    L = x @ np.array([0.114, 0.587, 0.299], np.float32)
    k = (1 - 0.25 * blue)[..., None]
    x = L[..., None] + (x - L[..., None]) * k
    x = DARK + (LIGHT - DARK) * np.clip(x, 0, 1)
    return np.clip(x * 255 + 0.5, 0, 255).astype(np.uint8)


def guided(I, p, r, eps):
    m = lambda a: cv2.boxFilter(a, -1, (2 * r + 1, 2 * r + 1))
    mI, mp = m(I), m(p)
    a = (m(I * p) - mI * mp) / (m(I * I) - mI * mI + eps)
    b = mp - a * mI
    return m(a) * I + m(b)


def alpha_of(frame, m960, pid, cut=None):
    H, W = frame.shape[:2]
    m = cv2.resize(m960, (W, H), interpolation=cv2.INTER_CUBIC)
    I = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    m = np.clip(guided(I, np.clip(m, 0, 1), 3, 2e-3), 0, 1)
    a = np.clip((m - 0.35) / 0.3, 0, 1); a = a * a * (3 - 2 * a)
    if cut is not None:
        a = a * (1 - cut)
    b = (a > 0.5).astype(np.uint8)
    b = cv2.morphologyEx(b, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    if cut is not None:   # slivers of the chair's flickering rim left along the cut: open harder near the chair only
        near = cv2.dilate(cut, np.ones((15, 15), np.uint8)) > 0
        b = np.where(near, cv2.morphologyEx(b, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)), b)
    n, lab, st, _ = cv2.connectedComponentsWithStats(b, 8)
    if n > 1:   # her, not specks: components above 0.4% of the largest
        big = st[1:, cv2.CC_STAT_AREA].max()
        keep = np.zeros(n, bool); keep[1:] = st[1:, cv2.CC_STAT_AREA] > 0.004 * big
        b = keep[lab].astype(np.uint8)
    b = cv2.erode(b, np.ones((3, 3), np.uint8))                    # 1 px choke: no halo of the plate's room
    soft = cv2.GaussianBlur(b.astype(np.float32), (0, 0), 0.65)
    return np.clip(np.minimum(soft, cv2.GaussianBlur(a, (0, 0), 0.5) + 0.5 * soft), 0, 1)


def matte960(pid, take, pf):
    d = MATTES / f'{pid}_{take}'
    fs = sorted(int(p.stem[1:]) for p in d.glob('m*.png')) if d.exists() else []
    if fs:
        best = min(fs, key=lambda f: abs(f - pf))
        if abs(best - pf) <= 1:
            return cv2.imread(str(d / f'm{best:04d}.png'), cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
    mk = ROOT / 'video/plates' / pid / 'masks' / f'm{1 + 2 * round((max(1, pf) - 1) / 2):04d}.png'
    if mk.exists():
        return cv2.resize(cv2.imread(str(mk), cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255, (960, 540), interpolation=cv2.INTER_CUBIC)
    return None


def run(pid, frames, force=False):
    idx = json.loads((ROOT / 'video/plates/index.json').read_text()).get(pid)
    if not idx:
        print(pid, 'not in video/plates/index.json (run tools/pipeline.sh first)'); return None
    take = pathlib.Path(idx['take']).stem
    cap = cv2.VideoCapture(str(ROOT / 'media/plates' / pid / idx['take']))
    src = []
    while True:
        ok, f = cap.read()
        if not ok: break
        src.append(f)
    od = OUT / f'{pid}_{take}'; od.mkdir(parents=True, exist_ok=True)
    frames = frames or list(range(1, len(src) + 1, 2))
    cut = None
    if 'chair' in ZONES.get(pid, {}):
        cut = static_mask(src, ZONES[pid]['chair'])
        cv2.imwrite(str(od / 'chair.png'), cut * 255)
    done = []
    for pf in frames:
        dst = od / f'd{pf:04d}.webp'
        if dst.exists() and not force:
            done.append(pf); continue
        fr = src[min(len(src), pf) - 1]
        m = matte960(pid, take, pf)
        if m is None:
            print(pid, pf, 'no matte'); continue
        a = alpha_of(fr, m, pid, cut)
        out = np.dstack([grade(fr), (a * 255 + 0.5).astype(np.uint8)])
        out[a < 0.004] = 0
        cv2.imwrite(str(dst), out, [cv2.IMWRITE_WEBP_QUALITY, 92])
        done.append(pf)
    H, W = src[0].shape[:2]
    print(pid, take, len(done), 'frames', W, 'x', H, flush=True)
    return f'{pid}_{take}', {'w': W, 'h': H, 'fps': idx.get('fps', 24)}


def write_index(meta):
    p = OUT / 'index.json'
    idx = json.loads(p.read_text()) if p.exists() else {}
    for d in sorted(OUT.iterdir()):
        if d.is_dir():
            fs = sorted(int(q.stem[1:]) for q in d.glob('d*.webp'))
            idx[d.name] = {**idx.get(d.name, {}), **meta.get(d.name, {}), 'frames': fs}
    p.write_text(json.dumps(idx))


def debug_sheet(keys, path):
    """the RGBA frames over a mid-grey and over the room's navy, for review"""
    tiles = []
    for key, pfs in keys:
        for pf in pfs:
            im = cv2.imread(str(OUT / key / f'd{pf:04d}.webp'), cv2.IMREAD_UNCHANGED)
            if im is None: continue
            a = im[..., 3:4].astype(np.float32) / 255
            for bg in ((128, 128, 128), (36, 24, 20)):
                t = im[..., :3] * a + np.array(bg, np.float32) * (1 - a)
                tiles.append(cv2.resize(t.astype(np.uint8), (640, 360), interpolation=cv2.INTER_AREA))
    rows = [np.hstack(tiles[i:i + 4] + [np.zeros_like(tiles[0])] * (4 - len(tiles[i:i + 4]))) for i in range(0, len(tiles), 4)]
    cv2.imwrite(path, np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 88])


def main():
    a = sys.argv[1:]
    kw = {x[2:].split('=', 1)[0]: (x.split('=', 1)[1] if '=' in x else True) for x in a if x.startswith('--')}
    ids = [x for x in a if not x.startswith('--')] or ['P57', 'P59']
    fr = {}
    if 'frames' in kw:
        for part in kw['frames'].split(';'):
            k, v = part.split(':'); fr[k] = [int(x) for x in v.split(',')]
    meta, keys = {}, []
    for pid in ids:
        r = run(pid, fr.get(pid), bool(kw.get('force')))
        if r:
            meta[r[0]] = r[1]; keys.append((r[0], (fr.get(pid) or [1, 33, 65, 97])[:4]))
    write_index(meta)
    if kw.get('debug'):
        debug_sheet(keys, kw['debug'])


if __name__ == '__main__':
    main()
