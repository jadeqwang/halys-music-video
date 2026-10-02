"""On-demand downloads of the local analysis models (none are committed; all come from hosts reachable
from the sandbox: storage.googleapis.com, GitHub releases, raw.githubusercontent.com).

    python3 tools/models.py            # fetch everything
    python3 tools/models.py depth      # fetch one

Files go to $HALYS_MODELS (default ~/.cache/halys/models). rembg keeps its own cache in $U2NET_HOME
(default ~/.u2net) and downloads from GitHub releases by itself. Hugging Face, download.pytorch.org and
dl.fbaipublicfiles.com are blocked from the sandbox, so every model here is a GitHub/Google-hosted copy.
"""
import os, pathlib, sys, urllib.request

DIR = pathlib.Path(os.environ.get("HALYS_MODELS", pathlib.Path.home() / ".cache" / "halys" / "models"))
MODELS = {
    # MediaPipe face landmarker: 478 landmarks + 52 blendshapes (realistic faces; often misses anime faces)
    "face": ("face_landmarker.task",
             "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"),
    # nagadomi's LBP cascade for anime faces (face boxes only)
    "animeface": ("lbpcascade_animeface.xml",
                  "https://raw.githubusercontent.com/nagadomi/lbpcascade_animeface/master/lbpcascade_animeface.xml"),
    # Depth Anything V2 Small (ViT-S, 24.8M params), ONNX export by fabio-sim, fixed 518x518 input, relative inverse depth
    "depth": ("depth_anything_v2_vits.onnx",
              "https://github.com/fabio-sim/Depth-Anything-ONNX/releases/download/v2.0.0/depth_anything_v2_vits.onnx"),
}


def get(name):
    fn, url = MODELS[name]
    p = DIR / fn
    if not p.exists() or p.stat().st_size < 1000:
        DIR.mkdir(parents=True, exist_ok=True)
        print(f"[models] downloading {name}: {url}", file=sys.stderr, flush=True)
        tmp = p.with_suffix(p.suffix + ".part")
        with urllib.request.urlopen(url, timeout=600) as r, open(tmp, "wb") as f:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                f.write(b)
        tmp.rename(p)
    return p


if __name__ == "__main__":
    for n in (sys.argv[1:] or MODELS):
        print(n, get(n))
