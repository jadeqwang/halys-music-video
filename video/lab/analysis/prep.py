"""ML analysis of a plate for the look-dev materials: monocular depth, subject matte, faces.

    python3 video/lab/analysis/prep.py media/lookdev/inputs/a_duel.jpg [more.jpg ...] [--matte=isnet-anime] [--out=DIR]

For plate <dir>/<id>.jpg writes <out>/<id>/ (default media/lookdev/analysis/<id>/):
  depth.png  1920x1080 RGB, 16-bit relative inverse depth packed as R = high byte, G = low byte (near = 1).
             Browsers decode PNGs to 8 bits per channel, so the two-byte packing keeps normals smooth.
  matte.png  1920x1080 grey subject matte (rembg).
  faces.json [{box:[u0,v0,u1,v1], eyes:[[u,v],[u,v]], score}] from MediaPipe's face detector (may be empty).

Depth: Depth-Anything-V2 (ViT-B, ONNX export by fabio-sim, fixed 518x518 input) on CPU. The 16:9 frame is covered by
a squashed global pass plus two overlapping square tiles at 518 px height; each tile is fitted to the global pass with a
least-squares scale/shift and the tiles are feathered together, then guided-filter upsampled with the plate as guide.
Models are cached in ~/.cache/halys-lookdev (downloaded from GitHub releases on first use).
"""
import os, sys, json, pathlib, time, urllib.request
import numpy as np, cv2
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[3]
CACHE = pathlib.Path(os.environ.get("LOOKDEV_CACHE", pathlib.Path.home() / ".cache" / "halys-lookdev"))
os.environ.setdefault("U2NET_HOME", str(CACHE / "u2net"))
DEPTH_URL = "https://github.com/fabio-sim/Depth-Anything-ONNX/releases/download/v2.0.0/depth_anything_v2_{v}.onnx"
FACE_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
MEAN, STD = np.array([0.485, 0.456, 0.406], np.float32), np.array([0.229, 0.224, 0.225], np.float32)


def fetch(url, dst):
    dst = pathlib.Path(dst)
    if not dst.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        print(f"downloading {url}", flush=True)
        with urllib.request.urlopen(url, timeout=600) as r, open(str(dst) + ".part", "wb") as f:
            f.write(r.read())
        os.replace(str(dst) + ".part", dst)
    return dst


_depth = {}


def depth_session(v="vitb"):
    if v not in _depth:
        import onnxruntime as ort
        so = ort.SessionOptions()
        so.intra_op_num_threads = os.cpu_count() or 4
        _depth[v] = ort.InferenceSession(str(fetch(DEPTH_URL.format(v=v), CACHE / f"depth_anything_v2_{v}.onnx")), so,
                                         providers=["CPUExecutionProvider"])
    return _depth[v]


def run_depth(rgb518):
    """rgb518: HxWx3 uint8 at 518x518 -> 518x518 float32 relative inverse depth."""
    x = (rgb518.astype(np.float32) / 255 - MEAN) / STD
    x = x.transpose(2, 0, 1)[None]
    s = depth_session()
    return s.run(None, {s.get_inputs()[0].name: x})[0][0].astype(np.float32)


def fit(a, b, w=None):
    """least-squares scale/shift so that s*a + o ~ b"""
    a, b = a.ravel(), b.ravel()
    w = np.ones_like(a) if w is None else w.ravel()
    A = np.stack([a * w, w], 1)
    s, o = np.linalg.lstsq(A, b * w, rcond=None)[0]
    return s, o


def depth_map(rgb):
    H, W = rgb.shape[:2]
    S = 518
    glob = cv2.resize(run_depth(cv2.resize(rgb, (S, S), interpolation=cv2.INTER_AREA)), (round(W * S / H), S), interpolation=cv2.INTER_CUBIC)
    Wt = glob.shape[1]
    small = cv2.resize(rgb, (Wt, S), interpolation=cv2.INTER_AREA)
    xs = [0, Wt - S] if Wt > S else [0]
    acc, wacc = np.zeros_like(glob), np.zeros_like(glob)
    for x0 in xs:
        d = run_depth(small[:, x0:x0 + S])
        s, o = fit(d, glob[:, x0:x0 + S])
        d = d * s + o
        ramp = np.minimum(1, np.minimum(np.arange(S) + 1, S - np.arange(S)) / (S * .22)).astype(np.float32)[None, :].repeat(S, 0)
        if x0 == 0:
            ramp[:, :S // 2] = 1
        if x0 == Wt - S:
            ramp[:, S // 2:] = 1
        acc[:, x0:x0 + S] += d * ramp
        wacc[:, x0:x0 + S] += ramp
    d = acc / np.maximum(wacc, 1e-6)
    lo, hi = np.percentile(d, 0.5), np.percentile(d, 99.5)
    d = np.clip((d - lo) / max(hi - lo, 1e-6), 0, 1)
    up = cv2.resize(d, (W, H), interpolation=cv2.INTER_CUBIC)
    guide = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    try:
        up = cv2.ximgproc.guidedFilter(guide, up.astype(np.float32), 8, 1e-3)
    except Exception as e:
        print("guided filter unavailable:", e)
    return np.clip(up, 0, 1)


def save_depth16(d, path):
    q = np.round(np.clip(d, 0, 1) * 65535).astype(np.uint32)
    rgb = np.stack([(q >> 8) & 255, q & 255, np.zeros_like(q)], -1).astype(np.uint8)
    Image.fromarray(rgb, "RGB").save(path, optimize=False, compress_level=6)


def matte(rgb, model="isnet-general-use"):
    from rembg import remove, new_session
    ses = new_session(model)
    H, W = rgb.shape[:2]
    im = Image.fromarray(rgb).resize((1024, 576), Image.LANCZOS)
    m = remove(im, session=ses, only_mask=True)
    return np.asarray(m.resize((W, H), Image.LANCZOS))


def faces(rgb):
    try:
        import mediapipe as mp
        from mediapipe.tasks import python as mpt
        from mediapipe.tasks.python import vision
    except Exception as e:
        print("mediapipe unavailable:", e)
        return []
    model = fetch(FACE_URL, CACHE / "blaze_face_short_range.tflite")
    det = vision.FaceDetector.create_from_options(vision.FaceDetectorOptions(base_options=mpt.BaseOptions(model_asset_path=str(model)), min_detection_confidence=.35))
    H, W = rgb.shape[:2]
    out = []
    # full frame plus a 2x2 grid of upscaled crops (small faces in wide shots)
    crops = [(0, 0, W, H)] + [(x, y, x + W // 2, y + H // 2) for x in (0, W // 4, W // 2) for y in (0, H // 4, H // 2)]
    for (x0, y0, x1, y1) in crops:
        crop = np.ascontiguousarray(rgb[y0:y1, x0:x1])
        r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=crop))
        for d in r.detections:
            b = d.bounding_box
            u0, v0 = (x0 + b.origin_x) / W, (y0 + b.origin_y) / H
            u1, v1 = (x0 + b.origin_x + b.width) / W, (y0 + b.origin_y + b.height) / H
            kp = [[(x0 + k.x * (x1 - x0)) / W, (y0 + k.y * (y1 - y0)) / H] for k in d.keypoints[:2]]
            sc = float(d.categories[0].score) if d.categories else 0
            out.append({"box": [round(u0, 4), round(v0, 4), round(u1, 4), round(v1, 4)], "eyes": [[round(a, 4), round(b2, 4)] for a, b2 in kp], "score": round(sc, 3)})
    # merge detections of the same face from overlapping crops (keep the best score)
    def iou(a, b):
        ix = max(0, min(a[2], b[2]) - max(a[0], b[0])); iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
        inter = ix * iy
        return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9)
    keep = []
    for f in sorted(out, key=lambda f: -f["score"]):
        if all(iou(f["box"], k["box"]) < .25 for k in keep):
            keep.append(f)
    return keep


def prep(path, out_root=None, matte_model="isnet-general-use", skip=()):
    path = pathlib.Path(path)
    pid = path.stem
    out = pathlib.Path(out_root or ROOT / "media" / "lookdev" / "analysis") / pid
    out.mkdir(parents=True, exist_ok=True)
    rgb = np.asarray(Image.open(path).convert("RGB"))
    info = {}
    if "depth" not in skip:
        t0 = time.time()
        save_depth16(depth_map(rgb), out / "depth.png")
        info["depth_s"] = round(time.time() - t0, 1)
    if "matte" not in skip:
        t0 = time.time()
        Image.fromarray(matte(rgb, matte_model)).save(out / "matte.png")
        info["matte_s"] = round(time.time() - t0, 1)
    if "faces" not in skip:
        fs = faces(rgb)
        (out / "faces.json").write_text(json.dumps(fs))
        info["faces"] = len(fs)
    print(pid, info, flush=True)
    return out


if __name__ == "__main__":
    kw = dict(a[2:].split("=", 1) if "=" in a else (a[2:], True) for a in sys.argv[1:] if a.startswith("--"))
    files = [a for a in sys.argv[1:] if not a.startswith("--")]
    skip = tuple(str(kw.get("skip", "")).split(",")) if kw.get("skip") else ()
    for f in files:
        prep(f, kw.get("out"), kw.get("matte", "isnet-general-use"), skip)
