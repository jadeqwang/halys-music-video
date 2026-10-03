"""Contact sheets for the look-dev renders: one sheet per material, each row = stand-in plate | render.

    python3 video/lab/tools/contact.py [bronze corona marble ink] [--dir=production/lookdev]

Reads <dir>/<plate>_<material>.jpg and the plate media/lookdev/inputs/<plate>.jpg; timings from <dir>/timings.jsonl
(latest entry per plate/material, untagged) are printed under each row. Writes <dir>/sheet_<material>.jpg (q88).
"""
import sys, json, pathlib
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[3]
kw = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
mats = [a for a in sys.argv[1:] if not a.startswith("--")] or ["bronze", "corona", "marble", "ink"]
D = ROOT / kw.get("dir", "production/lookdev")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
TITLE = {"bronze": "BRONZE  ·  Baroque oil, tenebrism, Altdorfer sky", "corona": "CORONA  ·  luminous field lines on navy-black",
         "marble": "MARBLE  ·  polished marble at totality", "ink": "INK  ·  clean anime cel"}

timings = {}
tf = D / "timings.jsonl"
if tf.exists():
    for line in tf.read_text().splitlines():
        try:
            r = json.loads(line)
        except Exception:
            continue
        if r.get("plate") and not r.get("tag"):
            timings[(r["plate"], r["material"])] = r


def sheet(mat):
    files = sorted(p for p in D.glob(f"*_{mat}.jpg") if not p.name.startswith(("sheet_", "compare_")))
    if not files:
        print("no renders for", mat)
        return
    tw, th = 640, 360
    W = 32 + tw // 2 + 16 + tw * 2 + 32
    rowh = th * 2 + 56
    H = 90 + rowh * len(files) + 16
    im = Image.new("RGB", (W, H), (14, 14, 16))
    d = ImageDraw.Draw(im)
    f1, f2 = ImageFont.truetype(FONT, 30), ImageFont.truetype(FONT, 18)
    d.text((32, 28), TITLE.get(mat, mat.upper()), font=f1, fill=(236, 230, 219))
    y = 90
    for p in files:
        plate = p.stem[: -len(mat) - 1]
        src = ROOT / "media" / "lookdev" / "inputs" / f"{plate}.jpg"
        if src.exists():
            im.paste(Image.open(src).convert("RGB").resize((tw // 2, th // 2), Image.LANCZOS), (32, y))
            d.text((32, y + th // 2 + 8), f"stand-in plate: {plate}", font=f2, fill=(150, 150, 150))
        im.paste(Image.open(p).convert("RGB").resize((tw * 2, th * 2), Image.LANCZOS), (32 + tw // 2 + 16, y))
        t = timings.get((plate, mat))
        if t:
            ms = t["ms"]
            load = f", load {t['load1']:.1f} on {t.get('cores', 4)} cores" if 'load1' in t else ""
            note = f"{plate} · {mat} · analysis {ms.get('analysis', 0)} ms + render {ms.get('render', 0)} ms at 1920×1080, headless SwiftShader (CPU){load}"
        else:
            note = f"{plate} · {mat}"
        d.text((32 + tw // 2 + 16, y + th * 2 + 10), note, font=f2, fill=(190, 186, 178))
        y += rowh
    out = D / f"sheet_{mat}.jpg"
    im.save(out, quality=88)
    print(out, im.size)


def compare(names):
    """round 1 vs round 2: <name>_r1.jpg beside <name>.jpg"""
    tw, th = 800, 450
    rows = [n for n in names if (D / f"{n}_r1.jpg").exists() and (D / f"{n}.jpg").exists()]
    im = Image.new("RGB", (32 + tw * 2 + 16 + 32, 70 + len(rows) * (th + 44)), (14, 14, 16))
    d = ImageDraw.Draw(im)
    f1, f2 = ImageFont.truetype(FONT, 28), ImageFont.truetype(FONT, 18)
    d.text((32, 20), "Look-dev round 1 (left) vs round 2 (right)", font=f1, fill=(236, 230, 219))
    y = 70
    for n in rows:
        for k, f in enumerate([f"{n}_r1.jpg", f"{n}.jpg"]):
            a = Image.open(D / f).convert("RGB")
            a = a.resize((tw, round(tw * a.height / a.width)), Image.LANCZOS).crop((0, 0, tw, th))
            im.paste(a, (32 + k * (tw + 16), y))
        d.text((32, y + th + 8), n, font=f2, fill=(190, 186, 178))
        y += th + 44
    im.save(D / "compare_r1_r2.jpg", quality=85)
    print(D / "compare_r1_r2.jpg", im.size)


if kw.get("compare"):
    compare(["b_face_bronze", "a_duel_bronze", "c_armies_bronze", "c_armies_corona", "a_duel_corona", "b_face_marble", "a_duel_marble", "d_room_ink"])
else:
    for m in mats:
        sheet(m)
