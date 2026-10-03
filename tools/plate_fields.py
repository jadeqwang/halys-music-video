"""Guide-map fields for every plate frame: what the renderer reads instead of the footage.

    python3 tools/plate_fields.py [ids ...] [--w=480] [--h=270] [--force] [--no-flow]

Writes, per frame f (1-based, same numbering as frames/f%04d.jpg), RGB PNGs in video/plates/<id>/maps/:
  g%04d.png   R = ink: DoG line art (255 = line)          G = tone: edge-preserving luminance (exposure-normalised)
              B = edge strength: Sobel magnitude (per-plate normalised)
  o%04d.png   R, G = 128 + 127 * (cos 2θ, sin 2θ) of the edge-tangent direction θ (structure tensor);
              B = coherence 0..255 (how strongly oriented). Decode: θ = atan2(G - 128, R - 128) / 2.
  v%04d.png   motion from frame f to f+1 (DIS optical flow, in map pixels): R, G = 128 + 4 * (dx, dy)
              (±31 px), B = min(255, 8 * |flow|). The last frame repeats the previous flow.
and video/plates/<id>/fields.json with the encoding, map size and a 6-colour plate palette (k-means).
No alpha channel on purpose: browsers premultiply alpha, which destroys data where alpha is low.

In the browser: draw the PNG to a canvas of the map size and getImageData(); see video/src/plates.js.
"""
import json, pathlib, sys
import numpy as np, cv2

ROOT = pathlib.Path(__file__).resolve().parent.parent
DST = ROOT / "video" / "plates"


def lines(L, sigma=0.8, k=1.6, gain=12.0, bias=0.2):
    """Line art from a difference of Gaussians, relative to local brightness (so outlines in shadows survive):
    ink 0..1, 1 = line, on the dark side of edges. Tuned on the Seedance anime smoke plate at 480x270
    (sigma 0.8 px, gain 12, bias 0.2); raise bias for fewer, cleaner lines."""
    g1 = cv2.GaussianBlur(L, (0, 0), sigma)
    g2 = cv2.GaussianBlur(L, (0, 0), sigma * k)
    return np.clip((g2 - g1) / (g2 + 0.08) * gain - bias, 0, 1)


def orientation(L, sigma=2.5):
    gx = cv2.Sobel(L, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(L, cv2.CV_32F, 0, 1, ksize=3)
    A = cv2.GaussianBlur(gx * gx, (0, 0), sigma)
    B = cv2.GaussianBlur(gx * gy, (0, 0), sigma)
    C = cv2.GaussianBlur(gy * gy, (0, 0), sigma)
    th = 0.5 * np.arctan2(2 * B, A - C) + np.pi / 2          # tangent (along edges)
    tr = A + C
    coh = np.where(tr > 1e-6, (np.sqrt((A - C) ** 2 + 4 * B * B) / np.maximum(tr, 1e-6)) ** 2, 0)
    return th, coh, np.hypot(gx, gy)


def palette(frames, k=6):
    px = []
    for f in frames[::max(1, len(frames) // 8)]:
        im = cv2.resize(cv2.imread(str(f)), (96, 54), interpolation=cv2.INTER_AREA)
        px.append(im.reshape(-1, 3))
    data = np.concatenate(px).astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
    _, labels, centers = cv2.kmeans(data, k, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    share = np.bincount(labels.ravel(), minlength=k) / len(labels)
    order = np.argsort(-share)
    return [{"hex": "#%02x%02x%02x" % tuple(int(c) for c in centers[i][::-1]), "share": round(float(share[i]), 3)} for i in order]


def run(pid, w=480, h=270, force=False, flow=True):
    d = DST / pid
    frames = sorted((d / "frames").glob("f*.jpg"))
    if not frames:
        return
    maps = d / "maps"
    maps.mkdir(exist_ok=True)
    done = len(list(maps.glob("g*.png")))
    if done == len(frames) and not force and (d / "fields.json").exists():
        return
    st = json.loads((d / "stats.json").read_text()) if (d / "stats.json").exists() else {}
    gain = st.get("gain", 1.0)
    # per-plate normalisation of edge strength (robust max over sampled frames)
    mags = []
    for f in frames[::max(1, len(frames) // 10)]:
        L = cv2.cvtColor(cv2.resize(cv2.imread(str(f)), (w, h), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
        mags.append(np.percentile(orientation(np.clip(L * gain, 0, 1))[2], 99.5))
    mnorm = float(np.median(mags)) or 1.0
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM) if flow else None
    prev_g, prev_flow = None, None
    grays = []
    for i, f in enumerate(frames):
        bgr = cv2.resize(cv2.imread(str(f)), (w, h), interpolation=cv2.INTER_AREA)
        g8 = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        L = np.clip(g8.astype(np.float32) / 255 * gain, 0, 1)
        tone = cv2.bilateralFilter(L, 7, 0.12, 5)
        ink = lines(L)
        th, coh, mag = orientation(L)
        G = np.dstack([ink * 255, tone * 255, np.clip(mag / mnorm, 0, 1) * 255]).astype(np.uint8)
        O = np.dstack([128 + 127 * np.cos(2 * th), 128 + 127 * np.sin(2 * th), np.clip(coh, 0, 1) * 255]).astype(np.uint8)
        n = i + 1
        cv2.imwrite(str(maps / f"g{n:04d}.png"), G[..., ::-1])
        cv2.imwrite(str(maps / f"o{n:04d}.png"), O[..., ::-1])
        grays.append(g8)
        if flow and i > 0:
            fl = dis.calc(grays[i - 1], g8, None)
            V = np.dstack([np.clip(128 + 4 * fl[..., 0], 0, 255), np.clip(128 + 4 * fl[..., 1], 0, 255),
                           np.clip(8 * np.hypot(fl[..., 0], fl[..., 1]), 0, 255)]).astype(np.uint8)
            cv2.imwrite(str(maps / f"v{i:04d}.png"), V[..., ::-1])     # flow of frame i -> i+1
            prev_flow = V
            grays[i - 1] = None
    if flow and prev_flow is not None:
        cv2.imwrite(str(maps / f"v{len(frames):04d}.png"), prev_flow[..., ::-1])
    info = {"w": w, "h": h, "n": len(frames), "gain": gain, "edge_norm": round(mnorm, 4), "palette": palette(frames),
            "encoding": {"g": "R=ink (relative DoG line art, 255=line), G=tone (bilateral luminance x gain), B=edge strength",
                         "o": "R,G=128+127*(cos2t, sin2t) edge-tangent direction t, B=coherence",
                         "v": "R,G=128+4*(dx,dy) map px/frame (f->f+1), B=min(255, 8*|flow|)"}}
    prev = json.loads((d / "fields.json").read_text()) if (d / "fields.json").exists() else {}
    if "depth" in prev and (maps / "d0001.png").exists():
        info["depth"] = prev["depth"]          # written by plate_depth.py; keep it across --force re-runs
    (d / "fields.json").write_text(json.dumps(info, indent=1))
    print(f"{pid}: fields for {len(frames)} frames at {w}x{h}; palette {[p['hex'] for p in info['palette']]}")


if __name__ == "__main__":
    a = sys.argv[1:]
    kw = {x[2:].split("=", 1)[0]: (x.split("=", 1)[1] if "=" in x else True) for x in a if x.startswith("--")}
    ids = [x for x in a if not x.startswith("--")] or [p.name for p in sorted(DST.iterdir()) if (p / "frames").is_dir()]
    for pid in ids:
        run(pid, int(kw.get("w", 480)), int(kw.get("h", 270)), bool(kw.get("force")), not kw.get("no-flow"))
