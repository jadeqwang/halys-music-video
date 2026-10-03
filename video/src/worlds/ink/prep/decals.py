"""INK decal measurements for the room plates: where the costume graphics are on each plate frame, so the renderer can
redraw them crisp and keep them ON the fabric (decals.js). Offline, CPU, deterministic.

    python3 video/src/worlds/ink/prep/decals.py P57 [--frames=1,12,40] [--debug]

Per frame (plate px, the 960x540 analysis frame):
  circle  the light-blue print on her back: an ellipse fitted to the circle's TRUE edge only (boundary pixels that border
          the jacket; where her hair overlaps the circle the boundary is an occlusion edge and is ignored)
  text    the RARE EARTH line under it: dark letter pixels in a band below the circle, its x extent and, per column window,
          the cap line and the baseline (robust quadratic fits), so the redrawn lettering follows the plate's lettering as
          the fabric moves, turns and bends
  patch   the round 1420 MHz patch on her LEFT sleeve: the dark ring's ellipse (centre, axes, angle), tracked from the
          first frame's position
Output: video/src/worlds/ink/decals/<plate>_<take stem>.json  {pf: {circle, text, patch}}; --debug also writes a contact
sheet of the detections to video/out/review_v2/room/decals_<plate>.jpg.
"""
import json, pathlib, sys
import numpy as np, cv2

ROOT = pathlib.Path(__file__).resolve().parents[5]
OUT = pathlib.Path(__file__).resolve().parents[1] / 'decals'
# where to look on the first frame (plate px), per plate
SEED = {'P57': {'circle': (200, 250, 420, 420), 'patch': (211, 358)}}


def frames_of(pid):
    idx = json.loads((ROOT / 'video/plates/index.json').read_text()).get(pid)
    d = ROOT / 'video/plates' / pid / 'frames'
    if idx and d.exists():
        take = pathlib.Path(idx['take']).stem
        return take, lambda pf: cv2.imread(str(d / f'f{pf:04d}.jpg')), idx['n']
    # development fallback: decode the latest take directly (same 960x540 resize as extract_plates.py for 16:9)
    takes = sorted((ROOT / 'media/plates' / pid).glob('take*.mp4'), key=lambda p: int(p.stem[4:]))
    cap = cv2.VideoCapture(str(takes[-1])); fr = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        fr.append(cv2.resize(f, (960, 540), interpolation=cv2.INTER_AREA))
    return takes[-1].stem, lambda pf: fr[pf - 1], len(fr)


def ell(e):
    (cx, cy), (w, h), a = e
    return {'cx': round(cx, 2), 'cy': round(cy, 2), 'rx': round(w / 2, 2), 'ry': round(h / 2, 2), 'rot': round(np.radians(a), 4)}


def circle(img, box):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    x0, y0, x1, y1 = box
    m = np.zeros(img.shape[:2], np.uint8)
    sub = hsv[y0:y1, x0:x1]
    blue = (sub[..., 0] >= 95) & (sub[..., 0] <= 125) & (sub[..., 1] >= 45) & (sub[..., 2] >= 110)
    m[y0:y1, x0:x1] = blue.astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n < 2:
        return None
    k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    blob = (lab == k).astype(np.uint8)
    cs, _ = cv2.findContours(blob, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)[:, 0, :]
    # keep boundary points whose outside neighbour is jacket (bright), not hair (dark): the true print edge
    M = cv2.moments(blob); cx, cy = M['m10'] / M['m00'], M['m01'] / M['m00']
    V = hsv[..., 2].astype(np.float32)
    good = []
    for x, y in c:
        dx, dy = x - cx, y - cy; d = np.hypot(dx, dy) or 1
        ox, oy = int(round(x + 3 * dx / d)), int(round(y + 3 * dy / d))
        if 0 <= ox < img.shape[1] and 0 <= oy < img.shape[0] and V[oy, ox] > 150:
            good.append((x, y))
    good = np.array(good, np.float32)
    if len(good) < 20:
        return None
    e = cv2.fitEllipse(good)
    out = ell(e); out['area'] = int(st[k, cv2.CC_STAT_AREA]); out['edge'] = round(len(good) / len(c), 3)
    return out


def text_band(img, C):
    """the RARE EARTH line below the circle: x extent, cap line and baseline samples"""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    R = max(C['rx'], C['ry'])
    x0, x1 = int(C['cx'] - 1.45 * R), int(C['cx'] + 1.45 * R)
    y0, y1 = int(C['cy'] + 0.9 * R), int(C['cy'] + 2.1 * R)
    sub = hsv[y0:y1, x0:x1]
    dark = ((sub[..., 2] < 120) & (sub[..., 1] < 110)).astype(np.uint8)
    # letters only: small components (the chair back and her hair are big)
    n, lab, st, _ = cv2.connectedComponentsWithStats(dark, 8)
    keep = np.zeros_like(dark)
    for k in range(1, n):
        w, h, a = st[k, cv2.CC_STAT_WIDTH], st[k, cv2.CC_STAT_HEIGHT], st[k, cv2.CC_STAT_AREA]
        if 2 <= a <= 160 and h <= 0.42 * R and w <= 0.9 * R:
            keep[lab == k] = 1
    ys, xs = np.nonzero(keep)
    if len(xs) < 25:
        return None
    # the densest row band is the lettering (drop stray marks above/below it)
    hist = np.bincount(ys, minlength=keep.shape[0]).astype(np.float32)
    hs = np.convolve(hist, np.ones(7) / 7, mode='same'); yc = int(np.argmax(hs))
    sel = np.abs(ys - yc) <= 0.25 * R
    xs, ys = xs[sel], ys[sel]
    if len(xs) < 25:
        return None
    xa, xb = np.percentile(xs, .3) - .5, np.percentile(xs, 99.7) + 1
    samples = []
    nwin = 8
    for j in range(nwin):
        a = xa + (xb - xa) * j / nwin; b = xa + (xb - xa) * (j + 1) / nwin
        s = (xs >= a) & (xs <= b)
        if s.sum() < 4:
            continue
        samples.append(((a + b) / 2, np.percentile(ys[s], 4), np.percentile(ys[s], 96) + 1))
    if len(samples) < 4:
        return None
    S = np.array(samples)
    deg = 2 if len(S) >= 6 else 1
    pt = np.polyfit(S[:, 0], S[:, 1], deg); pb = np.polyfit(S[:, 0], S[:, 2], deg)
    # equal cap height along the line (it is one line of capitals): average the height, keep the centre line's bend
    xsamp = np.linspace(xa, xb, 9)
    top, bot = np.polyval(pt, xsamp), np.polyval(pb, xsamp)
    mid, hgt = (top + bot) / 2, np.clip(bot - top, 3, None)
    h = float(np.median(hgt)); hgt = 0.6 * hgt + 0.4 * h
    pts = [[round(x0 + float(x), 2), round(y0 + float(m - g / 2), 2), round(y0 + float(m + g / 2), 2)] for x, m, g in zip(xsamp, mid, hgt)]
    return {'pts': pts, 'n': int(len(xs))}


def patch(img, prev):
    """the dark ring of the patch near prev (x, y): ellipse fit of the ring contour enclosing a bright disc"""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    px, py = prev
    x0, y0 = int(max(0, px - 34)), int(max(0, py - 40)); x1, y1 = int(min(959, px + 34)), int(min(539, py + 40))
    V = hsv[y0:y1, x0:x1, 2]
    dark = (V < 105).astype(np.uint8)
    cs, _ = cv2.findContours(dark, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    best, bs = None, 1e9
    for c in cs:
        if len(c) < 12:
            continue
        (cx, cy), (w, h), a = cv2.fitEllipse(c)
        rx, ry = sorted((w / 2, h / 2))
        if not (4 <= rx <= 22 and 9 <= ry <= 34 and ry / max(rx, 1e-3) < 4.5):
            continue
        # bright interior: the patch disc
        m = np.zeros_like(dark); cv2.ellipse(m, ((cx, cy), (w * .6, h * .6), a), 1, -1)
        if m.sum() < 8 or V[m > 0].mean() < 120:
            continue
        # the ring encloses its own outline points: contour length close to the ellipse perimeter
        per = np.pi * (3 * (rx + ry) - np.sqrt((3 * rx + ry) * (rx + 3 * ry)))
        fit = abs(len(c) / per - 1)
        score = np.hypot(cx + x0 - px, cy + y0 - py) + 20 * fit
        if score < bs:
            bs, best = score, ((cx + x0, cy + y0), (w, h), a)
    return ell(best) if best else None


def main(argv):
    pos = [a for a in argv if not a.startswith('--')]
    kw = {a[2:].split('=', 1)[0]: (a.split('=', 1)[1] if '=' in a else True) for a in argv if a.startswith('--')}
    pid = pos[0]
    take, get, n = frames_of(pid)
    want = [int(v) for v in kw['frames'].split(',')] if 'frames' in kw else list(range(1, n + 1))
    seed = SEED[pid]
    res, prev = {}, seed['patch']
    for pf in range(1, max(want) + 1):            # track the patch through every frame up to the last one wanted
        img = get(pf)
        p = patch(img, prev)
        if p:
            prev = (p['cx'], p['cy'])
        if pf in want:
            c = circle(img, seed['circle'])
            t = text_band(img, c) if c else None
            res[str(pf)] = {'circle': c, 'text': t, 'patch': p}
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f'{pid}_{take}.json'
    old = json.loads(out.read_text()) if out.exists() else {}
    old.update(res)
    out.write_text(json.dumps(dict(sorted(old.items(), key=lambda kv: int(kv[0])))))
    miss = {k: [n for n in ('circle', 'text', 'patch') if not v[n]] for k, v in res.items()}
    miss = {k: v for k, v in miss.items() if v}
    print(f'{pid} {take}: {len(res)} frames -> {out.relative_to(ROOT)}; missing: {miss or "none"}')
    if kw.get('debug'):
        debug_sheet(pid, get, res)


def debug_sheet(pid, get, res, cols=6):
    tiles = []
    for k, v in list(res.items())[:: max(1, len(res) // 18)]:
        img = get(int(k)).copy()
        for nm, col in (('circle', (0, 255, 255)), ('patch', (0, 0, 255))):
            e = v.get(nm)
            if e:
                cv2.ellipse(img, ((e['cx'], e['cy']), (2 * e['rx'], 2 * e['ry']), np.degrees(e['rot'])), col, 1, cv2.LINE_AA)
        t = v.get('text')
        if t:
            P = t['pts']
            cv2.polylines(img, [np.int32([[p[0], p[1]] for p in P])], False, (0, 255, 0), 1, cv2.LINE_AA)
            cv2.polylines(img, [np.int32([[p[0], p[2]] for p in P])], False, (255, 0, 255), 1, cv2.LINE_AA)
        crop = img[230:470, 150:530]
        crop = cv2.resize(crop, (crop.shape[1] * 2, crop.shape[0] * 2), interpolation=cv2.INTER_NEAREST)
        cv2.putText(crop, f'f{k}', (6, 22), cv2.FONT_HERSHEY_SIMPLEX, .7, (0, 255, 0), 2)
        tiles.append(crop)
    while len(tiles) % cols:
        tiles.append(np.zeros_like(tiles[0]))
    rows = [np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]
    sheet = np.vstack(rows)
    dst = ROOT / 'video/out/review_v2/room' / f'decals_{pid}.jpg'
    dst.parent.mkdir(parents=True, exist_ok=True)
    s = min(1.0, 2880 / sheet.shape[1])
    cv2.imwrite(str(dst), cv2.resize(sheet, (int(sheet.shape[1] * s), int(sheet.shape[0] * s))), [cv2.IMWRITE_JPEG_QUALITY, 88])
    print('debug sheet', dst.relative_to(ROOT))


if __name__ == '__main__':
    main(sys.argv[1:])
