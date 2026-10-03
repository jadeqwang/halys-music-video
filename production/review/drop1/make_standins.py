#!/usr/bin/env python3
"""Temporary stand-in stills for the line engine (video/src/worlds/line/standins/<id>/), made from plate takes that are
generated but not yet extracted to video/plates/ (the resolver switches to video/plates/P## by itself when they land).

    python3 production/review/drop1/make_standins.py            # all entries of STANDINS
    python3 production/review/drop1/make_standins.py r42kneel   # one

Each stand-in: frame.jpg (the take frame, 1280x720 q80), depth.png (8-bit, near = 255, 640x360), matte.png (640x360),
from video/lab/analysis/prep.py (Depth-Anything V2 + rembg, CPU). Delete standins/ once every plate it stands in for exists.
"""
import json, pathlib, subprocess, sys, tempfile
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[3]
DST = ROOT / "video/src/worlds/line/standins"
PREP = ROOT / "video/lab/analysis/prep.py"
# id: (plate, take file, time in the take, note)
STANDINS = {
    "r42kneel": ("P42", "take2.mp4", 0.95, "Lydian sinks to his knees, arms raised (S35 IN THE)"),
    "r42eyes": ("P42", "take2.mp4", 2.84, "Lydian covers his eyes; the kneeler prays"),
    "r42spin": ("P42", "take2.mp4", 2.21, "Lydian spun round, staring"),
    "r43pros": ("P43", "take2.mp4", 1.58, "Mede prostrate, forehead to the stones; amulet prayer (S35 second SKY)"),
    "r43arm": ("P43", "take2.mp4", 4.73, "Mede grabs his neighbour's arm"),
    "r43bow": ("P43", "take2.mp4", 3.47, "the archer has let his bow fall"),
    "r44rear": ("P44", "take1.mp4", 1.58, "the Lydian rider's horse rears (S35 first SKY)"),
    "r44calm": ("P44", "take1.mp4", 2.84, "the Median rider calms his horse"),
    "r45lyd": ("P45", "take1.mp4", 0.32, "the Lydian looks around wildly"),
    "r45lydup": ("P45", "take1.mp4", 1.58, "the Lydian looks up"),
    "r45mede": ("P45", "take1.mp4", 2.21, "the Mede whips his head round"),
    "r45medeup": ("P45", "take1.mp4", 2.84, "the Mede looks up"),
    "r45aly": ("P45", "take1.mp4", 3.47, "Alyattes in shock"),
    "r45cya": ("P45", "take1.mp4", 4.73, "Cyaxares in shock"),
}


def make(sid):
    plate, take, t, note = STANDINS[sid]
    src = ROOT / "media/plates" / plate / take
    if not src.exists():
        print(f"{sid}: {src} missing, skipped")
        return
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        jpg = tmp / f"{sid}.jpg"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", str(src), "-frames:v", "1", "-q:v", "2", str(jpg)], check=True)
        im = Image.open(jpg).convert("RGB").resize((1280, 720), Image.LANCZOS)
        im.save(jpg, quality=95)
        subprocess.run([sys.executable, str(PREP), str(jpg), f"--out={tmp}", "--skip=faces"], check=True, capture_output=True)
        out = DST / sid
        out.mkdir(parents=True, exist_ok=True)
        im.save(out / "frame.jpg", quality=80, optimize=True)
        d = np.asarray(Image.open(tmp / sid / "depth.png").convert("RGB")).astype(np.float32)
        dv = (d[..., 0] * 256 + d[..., 1]) / 65535.0
        Image.fromarray(np.round(dv * 255).astype(np.uint8)).resize((640, 360), Image.BILINEAR).save(out / "depth.png", optimize=True)
        Image.open(tmp / sid / "matte.png").convert("L").resize((640, 360), Image.BILINEAR).save(out / "matte.png", optimize=True)
    idx = json.loads((DST / "index.json").read_text())
    idx[sid] = {"w": 1280, "h": 720, "faces": [], "from": f"media/plates/{plate}/{take} @ {t:.2f} s", "plate": plate, "note": note}
    (DST / "index.json").write_text(json.dumps(idx, indent=1))
    print(f"{sid}: {plate} {take} @ {t:.2f} s -> {out}")


if __name__ == "__main__":
    for sid in (sys.argv[1:] or STANDINS):
        make(sid)
