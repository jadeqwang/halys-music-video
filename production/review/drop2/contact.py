#!/usr/bin/env python3
"""Tile rendered stills (or frames) into a labelled contact sheet, kept under the review budget (JPG <= 1 MB).

    python3 production/review/drop2/contact.py OUT.jpg IMG [IMG ...] [--cols=4] [--w=480]
    python3 production/review/drop2/contact.py OUT.jpg --frames=video/out/frames_drop2 --times=215.3,216,... [--cols=6]
Labels: the file name (stills) or "t s  fNNNNN" (frames).
"""
import sys, pathlib, math
from PIL import Image, ImageDraw, ImageFont

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    kw = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    out, imgs = args[0], args[1:]
    cols, w = int(kw.get('cols', 4)), int(kw.get('w', 480))
    items = []
    if 'frames' in kw:
        d = pathlib.Path(kw['frames'])
        for t in [float(x) for x in kw['times'].split(',')]:
            i = math.ceil(t * 60 - 1e-6)
            p = d / f'f{i:05d}.jpg'
            if p.exists(): items.append((p, f'{t:.2f}s f{i}'))
    else:
        items = [(pathlib.Path(p), pathlib.Path(p).stem) for p in imgs]
    if not items: sys.exit('nothing to tile')
    im0 = Image.open(items[0][0]); h = round(w * im0.height / im0.width); lab = 18
    rows = math.ceil(len(items) / cols)
    sheet = Image.new('RGB', (cols * w, rows * (h + lab)), (28, 28, 30))
    dr = ImageDraw.Draw(sheet)
    try: font = ImageFont.truetype('/home/user/halys-music-video/video/fonts/JetBrainsMono-Regular.ttf', 12)
    except Exception: font = ImageFont.load_default()
    for k, (p, label) in enumerate(items):
        im = Image.open(p).convert('RGB').resize((w, h), Image.LANCZOS)
        x, y = (k % cols) * w, (k // cols) * (h + lab)
        sheet.paste(im, (x, y)); dr.text((x + 4, y + h + 2), label[:70], fill=(220, 220, 220), font=font)
    q = 88
    while True:
        sheet.save(out, quality=q, optimize=True)
        if pathlib.Path(out).stat().st_size <= 1_000_000 or q <= 40: break
        q -= 6
    print(out, sheet.size, pathlib.Path(out).stat().st_size, 'bytes, q', q)

if __name__ == '__main__':
    main()
