#!/usr/bin/env python3
"""Contact sheet of rendered Drop 1 frames (video/out/frames_drop1) with time/shot labels, kept under 1 MB.

    python3 production/review/drop1/contact.py OUT.jpg [t0:t1:n | t,t,t ...] [--cols=6] [--w=320]
"""
import json, math, pathlib, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[3]
FR = ROOT / "video/out/frames_drop1"
SHOTS = [(s["id"], s["t0"], s["t1"]) for s in json.loads((ROOT / "video/data/shotlist.json").read_text())["shots"]]


def shot_at(t):
    for sid, a, b in SHOTS:
        if a <= t < b:
            return sid
    return "?"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    kw = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
    out, spec = args[0], args[1]
    if spec.count(":") == 2:
        a, b, n = spec.split(":")
        a, b, n = float(a), float(b), int(n)
        times = [a + (b - a) * (k + .5) / n for k in range(n)]
    else:
        times = [float(x) for x in spec.split(",")]
    cols, w = int(kw.get("cols", 6)), int(kw.get("w", 320))
    h, lab = round(w * 9 / 16), 16
    rows = math.ceil(len(times) / cols)
    S = Image.new("RGB", (cols * w, rows * (h + lab)), (24, 24, 26))
    d = ImageDraw.Draw(S)
    try:
        font = ImageFont.truetype(str(ROOT / "video/fonts/JetBrainsMono-Regular.ttf"), 11)
    except Exception:
        font = ImageFont.load_default()
    for k, t in enumerate(times):
        i = math.floor(t * 60 + 1e-6)
        f = FR / f"f{i:05d}.jpg"
        x, y = (k % cols) * w, (k // cols) * (h + lab)
        if f.exists():
            S.paste(Image.open(f).convert("RGB").resize((w, h), Image.LANCZOS), (x, y))
        d.text((x + 4, y + h + 2), f"{t:.2f}s f{i} {shot_at(t)}", fill=(220, 220, 220), font=font)
    q = 88
    while True:
        S.save(out, quality=q, optimize=True)
        if pathlib.Path(out).stat().st_size <= 1_000_000 or q <= 50:
            break
        q -= 6
    print(out, pathlib.Path(out).stat().st_size // 1024, "KB", f"q{q}")


if __name__ == "__main__":
    main()
