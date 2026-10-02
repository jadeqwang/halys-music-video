"""Per-frame plate measurements the renderer uses to lock drawn layers onto the footage.

    python3 tools/plate_meta.py [ids ...] [--force] [--faces=3]

For every extracted frame (video/plates/<id>/frames/f*.jpg) record, in video/plates/<id>/meta.json:
  lum     mean luminance 0..1             hot   fraction of near-white pixels (flash / glare)
  rgb     mean colour [r, g, b] 0..1      diff  mean abs difference to the previous frame (cuts, motion)
  sun     [u, v, strength]: centroid of the brightest blob (u, v in 0..1 of the frame; the eclipse corona, a lamp)
  faces   list (largest first) of {src: "mp" | "anime", box: [u0, v0, u1, v1], ...}; MediaPipe faces add
          jaw (blendshape jawOpen), mouth_open (inner-lip gap / face height), mouth_px (dark pixels in the
          mouth box: the metric that works on drawn/anime mouths), eyeL, eyeR, mouth ([u, v]),
          yaw (rough, -1 left .. 1 right), lines: {oval, eyeL_up, ..., lipI_lo: flat [u, v, ...] polylines,
          irisL/irisR: [u, v, r]} for drawing faces as line work.
and in stats.json: p95 luminance, exposure gain (p95 -> 0.85, never darkens), cut frames, face ratio.

Face model: MediaPipe face landmarker (tools/models.py `face`). It finds anime faces too (97/97 frames
on the Seedance smoke test) with the upscaled-crop retry; nagadomi's anime LBP cascade is the fallback
(box only). mediapipe >= 1.0 needs libEGL: `apt-get install -y libegl1 libgles2`.
"""
import json, os, pathlib, sys
import numpy as np, cv2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import models  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
DST = ROOT / "video" / "plates"
_fl, _casc = None, None

# ordered MediaPipe face-mesh indices for line work (same polylines as the orbital-sunrise renderer)
FEATURES = {
    "oval": [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10],
    "eyeR_up": [33, 246, 161, 160, 159, 158, 157, 173, 133], "eyeR_lo": [33, 7, 163, 144, 145, 153, 154, 155, 133],
    "eyeL_up": [362, 398, 384, 385, 386, 387, 388, 466, 263], "eyeL_lo": [362, 382, 381, 380, 374, 373, 390, 249, 263],
    "browR": [46, 53, 52, 65, 55], "browRu": [70, 63, 105, 66, 107], "browL": [276, 283, 282, 295, 285], "browLu": [300, 293, 334, 296, 336],
    "nose": [168, 6, 197, 195, 5, 4], "noseB": [64, 98, 97, 2, 326, 327, 294],
    "lipO_up": [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291], "lipO_lo": [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
    "lipI_up": [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308], "lipI_lo": [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
}
IRIS = {"irisR": [468, 469, 470, 471, 472], "irisL": [473, 474, 475, 476, 477]}


def landmarker(num_faces=3):
    global _fl
    if _fl is None:
        import mediapipe as mp
        from mediapipe.tasks import python as mpt
        from mediapipe.tasks.python import vision
        opts = vision.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=str(models.get("face"))),
                                            output_face_blendshapes=True, running_mode=vision.RunningMode.IMAGE, num_faces=num_faces,
                                            min_face_detection_confidence=0.25, min_face_presence_confidence=0.25)
        _fl = (mp, vision.FaceLandmarker.create_from_options(opts))
    return _fl


def anime_cascade():
    global _casc
    if _casc is None:
        _casc = cv2.CascadeClassifier(str(models.get("animeface")))
    return _casc


def _detect(rgb):
    mp, det = landmarker()
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb)))
    return [(np.array([[p.x, p.y] for p in lms]), {b.category_name: b.score for b in bss})
            for lms, bss in zip(r.face_landmarks, r.face_blendshapes or [[]] * len(r.face_landmarks))]


def detect_faces(rgb):
    """Full frame first; then 2-3x upscaled crops and small rotations (small, tilted or upturned faces)."""
    found = _detect(rgb)
    if found:
        return found
    H, W = rgb.shape[:2]
    for (x0, y0, x1, y1) in [(.25, 0, .75, .6), (.15, 0, .85, .75), (0, 0, .6, .7), (.4, 0, 1, .7), (.25, .1, .75, .9)]:
        X0, Y0, X1, Y1 = int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)
        k = 3 if (X1 - X0) < 400 else 2
        crop = cv2.resize(rgb[Y0:Y1, X0:X1], None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC)
        for ang in (0, 12, -12):
            if ang:
                M = cv2.getRotationMatrix2D((crop.shape[1] / 2, crop.shape[0] / 2), ang, 1.0)
                img = cv2.warpAffine(crop, M, (crop.shape[1], crop.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
                Mi = cv2.invertAffineTransform(M)
            else:
                img, Mi = crop, None
            res = _detect(img)
            if res:
                out = []
                for lm, bs in res:
                    px, py = lm[:, 0] * img.shape[1], lm[:, 1] * img.shape[0]
                    if Mi is not None:
                        px, py = Mi[0, 0] * px + Mi[0, 1] * py + Mi[0, 2], Mi[1, 0] * px + Mi[1, 1] * py + Mi[1, 2]
                    out.append((np.stack([(X0 + px / k) / W, (Y0 + py / k) / H], 1), bs))
                return out
    return []


def mouth_px(gray, box, mouth):
    """Anime-friendly mouth openness: fraction of pixels in a mouth box (placed by the landmarks) darker than
    0.6 x the skin between nose and mouth. MediaPipe's lip gap barely moves on drawn mouths; this does
    (r = 0.55 against the vocal envelope on the Seedance smoke plate)."""
    H, W = gray.shape
    u0, v0, u1, v1 = box
    fw, fh = (u1 - u0) * W, (v1 - v0) * H
    mx, my = mouth[0] * W, mouth[1] * H
    roi = gray[max(0, int(my - .10 * fh)):int(my + .10 * fh) + 1, max(0, int(mx - .20 * fw)):int(mx + .20 * fw) + 1]
    skin = gray[max(0, int(my - .22 * fh)):max(1, int(my - .12 * fh)), max(0, int(mx - .12 * fw)):int(mx + .12 * fw)]
    if roi.size == 0 or skin.size == 0:
        return 0.0
    return round(float((roi < 0.6 * np.median(skin)).mean()), 4)


def face_record(lm, bs, gray=None):
    (u0, v0), (u1, v1) = lm.min(0), lm.max(0)
    h = max(v1 - v0, 1e-3)
    up, lo = lm[[82, 13, 312]], lm[[87, 14, 317]]
    gap = float(np.mean(lo[:, 1] - up[:, 1]) / h)
    eyeR, eyeL, mouth = lm[[33, 133]].mean(0), lm[[362, 263]].mean(0), lm[[13, 14]].mean(0)
    nose = lm[4]
    yaw = float(np.clip(((nose[0] - u0) / max(u1 - u0, 1e-3) - .5) * 2.5, -1, 1))
    r = lambda x: round(float(x), 4)
    rec = {"src": "mp", "box": [r(u0), r(v0), r(u1), r(v1)], "jaw": r(bs.get("jawOpen", 0)), "mouth_open": r(max(0.0, gap)),
           "eyeL": [r(eyeL[0]), r(eyeL[1])], "eyeR": [r(eyeR[0]), r(eyeR[1])], "mouth": [r(mouth[0]), r(mouth[1])], "yaw": round(yaw, 3),
           "lines": {k: [r(c) for i in idx for c in lm[i]] for k, idx in FEATURES.items()}}
    if gray is not None:
        rec["mouth_px"] = mouth_px(gray, rec["box"], rec["mouth"])
    if len(lm) >= 478:
        for k, idx in IRIS.items():
            c = lm[idx[0]]
            rec["lines"][k] = [r(c[0]), r(c[1]), r(np.mean(np.linalg.norm(lm[idx[1:]] - c, axis=1)))]
    return rec


def anime_faces(bgr):
    g = cv2.equalizeHist(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY))
    H, W = g.shape
    fs = anime_cascade().detectMultiScale(g, scaleFactor=1.05, minNeighbors=4, minSize=(max(24, W // 30), max(24, W // 30)))
    out = [{"src": "anime", "box": [round(x / W, 4), round(y / H, 4), round((x + w) / W, 4), round((y + h) / H, 4)]} for (x, y, w, h) in fs]
    return sorted(out, key=lambda f: -(f["box"][2] - f["box"][0]) * (f["box"][3] - f["box"][1]))


def measure(path, prev_small=None):
    bgr = cv2.imread(str(path))
    small = cv2.resize(bgr, (320, 180), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    L = small[..., 2] * .2126 + small[..., 1] * .7152 + small[..., 0] * .0722
    hot = (L > .92).astype(np.float32)
    Lb = cv2.GaussianBlur(L, (0, 0), 3)
    y, x = np.unravel_index(np.argmax(Lb), Lb.shape)
    peak = float(Lb[y, x])
    if hot.sum() > 3:
        ys, xs = np.nonzero(cv2.GaussianBlur(hot, (0, 0), 2) > .5)
        if len(xs):
            d = (xs - x) ** 2 + (ys - y) ** 2
            sel = d < (d.min() + 400)
            x, y = xs[sel].mean(), ys[sel].mean()
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    faces = [face_record(lm, bs, gray) for lm, bs in detect_faces(rgb)]
    faces.sort(key=lambda f: -(f["box"][2] - f["box"][0]) * (f["box"][3] - f["box"][1]))
    if not faces:
        faces = anime_faces(bgr)
    m = {"lum": round(float(L.mean()), 4), "hot": round(float(hot.mean()), 5),
         "rgb": [round(float(small[..., c].mean()), 4) for c in (2, 1, 0)],
         "diff": round(float(np.abs(small - prev_small).mean()), 4) if prev_small is not None else 0.0,
         "sun": [round(float(x) / 320, 4), round(float(y) / 180, 4), round(min(1.0, max(0.0, (peak - .6) / .4)), 3)],
         "faces": faces}
    return m, small


def stats(pid, meta):
    d = DST / pid
    frames = sorted((d / "frames").glob("f*.jpg"))
    pick = frames[::max(1, len(frames) // 12)]
    p95 = []
    for f in pick:
        im = cv2.resize(cv2.imread(str(f)), (320, 180), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
        p95.append(np.percentile(im[..., 2] * .2126 + im[..., 1] * .7152 + im[..., 0] * .0722, 95))
    gain = float(np.clip(.85 / max(np.median(p95), 1e-3), 1.0, 2.2))
    diffs = np.array([m["diff"] for m in meta])
    med = float(np.median(diffs[1:])) if len(diffs) > 2 else 0
    cuts = [i + 1 for i, v in enumerate(diffs) if i > 0 and v > max(0.08, 6 * med)]
    st = {"p95": round(float(np.median(p95)), 3), "gain": round(gain, 3), "cuts": cuts,
          "face_ratio": round(sum(1 for m in meta if m["faces"]) / max(1, len(meta)), 3),
          "mp_face_ratio": round(sum(1 for m in meta if m["faces"] and m["faces"][0]["src"] == "mp") / max(1, len(meta)), 3)}
    (d / "stats.json").write_text(json.dumps(st))
    return st


def run(pid, force=False):
    d = DST / pid
    frames = sorted((d / "frames").glob("f*.jpg"))
    out = d / "meta.json"
    if out.exists() and not force:
        try:
            if len(json.loads(out.read_text())) == len(frames):
                return
        except Exception:
            pass
    meta, prev = [], None
    for f in frames:
        m, prev = measure(f, prev)
        meta.append(m)
    out.write_text(json.dumps(meta, separators=(",", ":")))
    st = stats(pid, meta)
    print(f"{pid}: {len(meta)} frames, faces in {st['face_ratio']:.0%} (MediaPipe {st['mp_face_ratio']:.0%}), "
          f"gain {st['gain']}, cuts {st['cuts'] or 'none'}")


if __name__ == "__main__":
    a = sys.argv[1:]
    ids = [x for x in a if not x.startswith("--")] or [p.name for p in sorted(DST.iterdir()) if (p / "frames").is_dir()]
    for pid in ids:
        run(pid, "--force" in a)
