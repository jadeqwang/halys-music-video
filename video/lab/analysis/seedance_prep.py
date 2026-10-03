"""Per-frame analysis of a video plate for the CORONA temporal-coherence test.

    python3 video/lab/analysis/seedance_prep.py [--src=media/tests/seedance25_test_480p_4s.mp4] [--frames=48] [--id=seedance]

Writes
  media/lookdev/inputs/<id>/f001.jpg ...            the plate frames (native size)
  media/lookdev/analysis/<id>/f001/{depth,matte}.png, faces.json   (prep.py formats; depth with the fast ViT-S model,
                                                    matte with rembg isnet-anime since the test plate is anime)
  media/lookdev/analysis/<id>/flow_002.bin ...      dense optical flow from frame k-1 to frame k (OpenCV Farneback on
                                                    grey at 480x270), Float32 [dx, dy] interleaved, in units of the
                                                    frame's width/height (resolution independent); header-less.
"""
import sys, json, pathlib, subprocess, time
import numpy as np, cv2
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import prep  # noqa: E402

ROOT = HERE.parents[2]
kw = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
src = ROOT / kw.get("src", "media/tests/seedance25_test_480p_4s.mp4")
n = int(kw.get("frames", 48))
pid = kw.get("id", "seedance")
fin = ROOT / "media" / "lookdev" / "inputs" / pid
fan = ROOT / "media" / "lookdev" / "analysis" / pid
fin.mkdir(parents=True, exist_ok=True)
fan.mkdir(parents=True, exist_ok=True)

if not (fin / f"f{n:03d}.jpg").exists():
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-frames:v", str(n), "-q:v", "2", str(fin / "f%03d.jpg")], check=True)

# fast depth: patch prep's session factory to the small model (~4x faster on CPU; plenty for line breaks and a lift)
_orig = prep.depth_session
prep.depth_session = lambda v="vits": _orig("vits")

FW, FH = 480, 270
prev = None
t0 = time.time()
for k in range(1, n + 1):
    f = fin / f"f{k:03d}.jpg"
    out = fan / f"f{k:03d}"
    out.mkdir(exist_ok=True)
    rgb = np.asarray(Image.open(f).convert("RGB"))
    if not (out / "depth.png").exists():
        prep.save_depth16(prep.depth_map(rgb), out / "depth.png")
    if not (out / "matte.png").exists():
        Image.fromarray(prep.matte(rgb, "isnet-anime")).save(out / "matte.png")
    if not (out / "faces.json").exists():
        (out / "faces.json").write_text("[]")
    g = cv2.cvtColor(cv2.resize(rgb, (FW, FH), interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2GRAY)
    if prev is not None and not (fan / f"flow_{k:03d}.bin").exists():
        fl = cv2.calcOpticalFlowFarneback(prev, g, None, 0.5, 4, 21, 5, 7, 1.5, 0)
        fl[..., 0] /= FW
        fl[..., 1] /= FH
        fl.astype(np.float32).tofile(fan / f"flow_{k:03d}.bin")
    prev = g
    print(f"frame {k}/{n}  {time.time() - t0:.0f} s", flush=True)
(fan / "meta.json").write_text(json.dumps({"frames": n, "flow": [FW, FH], "src": str(src.relative_to(ROOT)), "fps": 24}))
print("done", fan)
