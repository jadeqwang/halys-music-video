"""INK subject mattes for the room plates (offline, CPU).

    python3 video/src/worlds/ink/prep/mattes.py [P39 P40 P41] [--frames='P39:12,22;P40:40,49'] [--force]

Why: rembg's isnet-anime (the plate pipeline's default, tools/plate_masks.py) is right for close-ups (P41) but on the wide
room plates it picks the brass saros dial or the desk lamp as the subject and drops her black hair (P39). For the wide
setup this combines three rembg models (isnet-general-use: jacket + chair; u2net_human_seg: hair; isnet-anime: limbs)
inside a generous keep zone, removes the lamp and dial (anime model only) and keeps the components connected to her.
Output: video/src/worlds/ink/mattes/<plate>_<take stem>/m%04d.png, 960x540 grey (255 = her), for the frames the x-sheets
use (worlds/ink/sheets.js -> --frames, or the defaults below). The renderer refines the edge against the frame at runtime.
"""
import json, pathlib, sys
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[5]
OUT = pathlib.Path(__file__).resolve().parents[1] / 'mattes'
# frames used by worlds/ink/sheets.js (take1/take2/take4) + a few extra for the clean background plate
DEFAULT = {
    'P39': [12, 22, 30, 40, 46, 52, 60, 62, 64, 66, 68, 75, 88, 1, 97],
    'P40': [40, 49, 57, 67, 79, 84, 90, 96, 100, 104, 1, 20, 44, 53, 61, 72, 112, 121],
    'P41': [22, 31, 34, 37, 39, 41, 43, 45, 48, 51, 53, 55, 57, 59, 62, 65, 67, 70, 73, 75, 77, 79, 81, 84, 95, 10, 140],
}
# per plate (its own 960x540 coordinates): keep zone, and zones where the anime model's extra objects are ignored
ZONES = {
    'P39': {'keep': (95, 70, 600, 540), 'drop': [(170, 100, 246, 345), (760, 300, 860, 430)], 'models': ('g', 'h', 'a')},
    'P40': {'keep': (80, 60, 590, 540), 'drop': [(180, 100, 262, 335), (750, 290, 850, 420)], 'models': ('g', 'h', 'a')},
    'P41': {'keep': (0, 0, 960, 540), 'drop': [], 'models': ('a',)},
}
MODEL = {'g': 'isnet-general-use', 'h': 'u2net_human_seg', 'a': 'isnet-anime'}
_ses = {}


def infer(img, m):
    from rembg import remove, new_session
    if m not in _ses:
        _ses[m] = new_session(MODEL[m])
    return np.asarray(remove(img, session=_ses[m], only_mask=True), np.float32) / 255


def combine(pid, ms):
    import cv2
    Z = ZONES[pid]
    if pid == 'P41':
        return ms['a']
    a = ms['a'].copy()
    for (x0, y0, x1, y1) in Z['drop']:
        a[y0:y1, x0:x1] = 0
    m = np.maximum(np.maximum(ms['g'], ms['h']), a)
    keep = np.zeros_like(m); x0, y0, x1, y1 = Z['keep']; keep[y0:y1, x0:x1] = 1
    m *= keep
    b = (m > .5).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(b, 8)
    core = ((ms['g'] > .6) | (ms['h'] > .6)).astype(np.uint8) * b
    ok = np.zeros(n, bool)
    for k in range(1, n):
        if st[k, cv2.CC_STAT_AREA] > 1500 and core[lab == k].sum() > 500:
            ok[k] = True
    sel = ok[lab]
    # fill interior holes (the jacket at 0.5 in one model, the face in another)
    filled = sel.astype(np.uint8)
    inv = 1 - filled
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(inv, 4)
    for k in range(1, n2):
        xs, ys, w, h, ar = st2[k]
        if ar < 4000 and xs > 0 and ys > 0 and xs + w < 960 and ys + h < 540:
            filled[lab2 == k] = 1
    band = cv2.dilate(filled, np.ones((5, 5), np.uint8)) - cv2.erode(filled, np.ones((5, 5), np.uint8))
    out = np.where(band > 0, m, filled.astype(np.float32))
    return np.clip(out, 0, 1)


def post_p40(od, frames):
    """P40 (the spin): the seated legs are the same through the turn, but the models drop them on some frames; take the
    lower body from the union of the settled front frames. Drop the keyboard the models grab while she types (f <= 45)
    and the lamp's bright head where her flying hair crosses it."""
    import cv2
    ROOTF = ROOT / 'video/plates/P40/frames'
    front = [f for f in frames if f >= 72]
    ms = {f: np.asarray(Image.open(od / f'm{f:04d}.png'), np.float32) / 255 for f in frames if (od / f'm{f:04d}.png').exists()}
    if not front:
        return
    low = np.max([ms[f] for f in front if f in ms], axis=0)
    yy = np.arange(540)[:, None] * np.ones((1, 960))
    lowmask = np.clip((yy - 370) / 30, 0, 1)
    for f, m in ms.items():
        m = np.maximum(m, low * lowmask)
        img = np.asarray(Image.open(ROOTF / f'f{f:04d}.jpg').convert('L'), np.float32) / 255
        if f <= 45:
            m[300:352, 375:470] = 0
        box = (slice(100, 200), slice(178, 262))
        m[box] = np.where(img[box] > .38, 0, m[box])
        Image.fromarray((np.clip(m, 0, 1) * 255 + .5).astype(np.uint8)).save(od / f'm{f:04d}.png', optimize=True)
    print('P40 post: legs from', front, flush=True)


def main():
    a = sys.argv[1:]
    kw = {x[2:].split('=', 1)[0]: (x.split('=', 1)[1] if '=' in x else True) for x in a if x.startswith('--')}
    ids = [x for x in a if not x.startswith('--')] or ['P41', 'P39', 'P40']
    frames = dict(DEFAULT)
    if 'frames' in kw:
        for part in kw['frames'].split(';'):
            k, v = part.split(':'); frames[k] = [int(x) for x in v.split(',')]
    for pid in ids:
        idx = json.loads((ROOT / 'video/plates/index.json').read_text()).get(pid)
        src = 'plates'
        if not idx:
            print(pid, 'not in video/plates/index.json (run tools/pipeline.sh first)'); continue
        take = pathlib.Path(idx['take']).stem
        od = OUT / f'{pid}_{take}'; od.mkdir(parents=True, exist_ok=True)
        for f in sorted(set(frames[pid])):
            dst = od / f'm{f:04d}.png'
            if dst.exists() and not kw.get('force'):
                continue
            img = Image.open(ROOT / 'video' / src / pid / 'frames' / f'f{f:04d}.jpg').convert('RGB')
            ms = {m: infer(img, m) for m in ZONES[pid]['models']}
            out = combine(pid, ms)
            Image.fromarray((out * 255 + .5).astype(np.uint8)).save(dst, optimize=True)
            print(pid, take, f, 'ok', flush=True)
        if pid == 'P40':
            post_p40(od, sorted(set(frames[pid])))
    write_index()


def write_index():
    idx = {d.name: sorted(int(p.stem[1:]) for p in d.glob('m*.png')) for d in sorted(OUT.iterdir()) if d.is_dir()}
    (OUT / 'index.json').write_text(json.dumps(idx))


if __name__ == '__main__':
    main()
