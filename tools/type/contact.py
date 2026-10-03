"""Tile type stills into a labelled contact sheet.

    python3 tools/type/contact.py DIR OUT.jpg [--cols=4] [--w=640] [--labels=labels.json] [--title=...]

Tiles every *.jpg in DIR (sorted). Labels: from labels.json ({filename: "S05 7.18 HALYS ..."}) when given, else from the
filename (f00480_S05_9.jpg -> "S05 · 8.00 s").
"""
import json, pathlib, sys
from PIL import Image, ImageDraw, ImageFont

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opts = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
src, out = pathlib.Path(args[0]), pathlib.Path(args[1])
cols, tw = int(opts.get("cols", 4)), int(opts.get("w", 640))
labels = json.loads(pathlib.Path(opts["labels"]).read_text()) if "labels" in opts else {}
files = sorted(p for p in src.glob("*.jpg"))
if not files:
    sys.exit(f"no stills in {src}")
im0 = Image.open(files[0])
th = round(tw * im0.height / im0.width)
lab = 44
title = opts.get("title")
top = 56 if title else 0
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw + (cols + 1) * 6, top + rows * (th + lab) + (rows + 1) * 6), (22, 22, 24))
d = ImageDraw.Draw(sheet)
fdir = pathlib.Path(__file__).resolve().parents[2] / "video/fonts"
font = ImageFont.truetype(str(fdir / "JetBrainsMono-Regular.ttf"), 13)
tfont = ImageFont.truetype(str(fdir / "JetBrainsMono-Bold.ttf"), 24)
if title:
    d.text((8, 14), title, font=tfont, fill=(236, 230, 218))
for k, f in enumerate(files):
    x, y = 6 + (k % cols) * (tw + 6), top + 6 + (k // cols) * (th + lab + 6)
    im = Image.open(f).convert("RGB").resize((tw, th), Image.LANCZOS)
    sheet.paste(im, (x, y))
    if f.name in labels:
        text = labels[f.name]
    else:
        parts = f.stem.split("_")
        try:
            text = f"{parts[1] if len(parts) > 1 else ''} · {int(parts[0][1:]) / 60:.2f} s"
        except ValueError:
            text = f.stem
    per = max(10, int((tw - 8) / 7.85))                       # characters per line at 13 px JetBrains Mono
    lines = [text[i:i + per] for i in range(0, len(text), per)][:2]
    if len(text) > 2 * per:
        lines[1] = lines[1][:-1] + "…"
    for j, ln in enumerate(lines):
        d.text((x + 4, y + th + 5 + j * 17), ln, font=font, fill=(214, 208, 198))
out.parent.mkdir(parents=True, exist_ok=True)
sheet.save(out, quality=88)
print(f"{out}  {len(files)} tiles, {sheet.width}x{sheet.height}")
