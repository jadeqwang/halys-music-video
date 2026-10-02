"""Monocular depth for plates: Depth Anything V2 Small (ONNX, CPU) -> video/plates/<id>/maps/d%04d.png.

    python3 tools/plate_depth.py [ids ...] [--step=2] [--w=480] [--h=270] [--force]

Grey 0..255 = relative inverse depth (255 = nearest), normalised once per plate (2nd..98th percentile over
all processed frames) so the maps do not flicker. --step=2 (default) does frames 1, 3, 5, ... (the renderer
takes the nearest). The model takes a fixed 518x518 input (frames are squashed to it and the result is
resized back). ~1.3 s per frame on 4 CPUs. Model: tools/models.py `depth` (GitHub release of
fabio-sim/Depth-Anything-ONNX; Hugging Face is blocked from the sandbox).
"""
import json, os, pathlib, sys, time
import numpy as np, cv2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import models  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
DST = ROOT / "video" / "plates"
MEAN, STD = np.array([0.485, 0.456, 0.406], np.float32), np.array([0.229, 0.224, 0.225], np.float32)
_s = None


def session():
    global _s
    if _s is None:
        import onnxruntime as ort
        so = ort.SessionOptions()
        so.intra_op_num_threads = os.cpu_count() or 4
        _s = ort.InferenceSession(str(models.get("depth")), so, providers=["CPUExecutionProvider"])
    return _s


def depth(bgr):
    s = session()
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255
    x = (cv2.resize(rgb, (518, 518), interpolation=cv2.INTER_CUBIC) - MEAN) / STD
    y = s.run(None, {s.get_inputs()[0].name: x.transpose(2, 0, 1)[None].astype(np.float32)})[0]
    return y.reshape(518, 518)


def run(pid, step=2, w=480, h=270, force=False):
    d = DST / pid
    frames = sorted((d / "frames").glob("f*.jpg"))
    (d / "maps").mkdir(exist_ok=True)
    todo = [f for f in frames if (int(f.stem[1:]) - 1) % step == 0]
    if not force and todo and all((d / "maps" / f"d{f.stem[1:]}.png").exists() for f in todo):
        return
    t0 = time.time()
    raw = {}
    for f in todo:
        raw[f.stem[1:]] = cv2.resize(depth(cv2.imread(str(f))), (w, h), interpolation=cv2.INTER_LINEAR).astype(np.float16)
    allv = np.concatenate([v.ravel()[::7].astype(np.float32) for v in raw.values()])
    lo, hi = np.percentile(allv, 2), np.percentile(allv, 98)
    for k, v in raw.items():
        g = np.clip((v.astype(np.float32) - lo) / max(hi - lo, 1e-6), 0, 1)
        cv2.imwrite(str(d / "maps" / f"d{k}.png"), (g * 255).astype(np.uint8))
    info = json.loads((d / "fields.json").read_text()) if (d / "fields.json").exists() else {}
    info["depth"] = {"step": step, "w": w, "h": h, "model": "depth_anything_v2_vits (518x518)", "range": [round(float(lo), 4), round(float(hi), 4)],
                     "encoding": "grey 0..255 = relative inverse depth, 255 = nearest (per-plate 2..98 percentile)"}
    (d / "fields.json").write_text(json.dumps(info, indent=1))
    print(f"{pid}: depth for {len(todo)} frames in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    a = sys.argv[1:]
    kw = {x[2:].split("=", 1)[0]: (x.split("=", 1)[1] if "=" in x else True) for x in a if x.startswith("--")}
    ids = [x for x in a if not x.startswith("--")] or [p.name for p in sorted(DST.iterdir()) if (p / "frames").is_dir()]
    for pid in ids:
        run(pid, int(kw.get("step", 2)), int(kw.get("w", 480)), int(kw.get("h", 270)), bool(kw.get("force")))
