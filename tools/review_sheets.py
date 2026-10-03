"""Contact sheets for reviewing generated plates, any video, and rendered frames.

    python3 tools/review_sheets.py video FILE.mp4 [FILE2 ...] [--n=8] [--cols=4] [--w=480] [--out=sheet.jpg]
    python3 tools/review_sheets.py plates [ids ...] [--n=8]     # all takes of each plate, one row per take
                                                               #   -> media/plates/<id>/takes.sheet.jpg
    python3 tools/review_sheets.py strip FILE.mp4 --from=0.5 --to=2.5 [--step=2]   # every Nth frame of a range
                                                               #   (lip-sync / motion checks) -> FILE.strip.jpg
    python3 tools/review_sheets.py maps ID [--frame=1]     # one plate frame next to every analysis map
                                                               #   -> video/plates/<id>/maps_f<frame>.jpg
    python3 tools/review_sheets.py frames [--every=1.0] [--from=0] [--to=273.6] [--cols=8] [--w=240] [--per=48] [--dir=video/out/frames]
                                                               # rendered film frames (video/out/frames/f%05d.jpg,
                                                               #   master-frame numbered; fps/size from render.json)
                                                               #   -> video/out/review/sheet_<t>.jpg, labelled with
                                                               #   time + shot (video/out/shots.json from
                                                               #   `node render.mjs --list --out=out/shots.json`)
"""
import json, pathlib, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FPS = 24


def font(size=14):
    for f in (ROOT / "video" / "fonts" / "JetBrainsMono-Regular.ttf", ROOT / "video" / "fonts" / "JetBrainsMono_normal_400.ttf",
              pathlib.Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")):
        if f.exists():
            return ImageFont.truetype(str(f), size)
    return ImageFont.load_default()


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate,nb_frames:format=duration",
                        "-of", "json", str(path)], capture_output=True, text=True)
    d = json.loads(r.stdout or "{}")
    st = (d.get("streams") or [{}])[0]
    num, den = (st.get("r_frame_rate") or "24/1").split("/")
    return {"w": st.get("width"), "h": st.get("height"), "fps": float(num) / float(den or 1),
            "dur": float((d.get("format") or {}).get("duration") or 0)}


def grab(path, t, w):
    """One frame at time t, scaled to width w (PIL image)."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{max(0, t):.3f}", "-i", str(path), "-frames:v", "1",
                        "-vf", f"scale={w}:-2", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True)
    import io
    return Image.open(io.BytesIO(r.stdout)).convert("RGB") if r.stdout else None


def tile(images, labels, cols, pad=4, lab_h=18, bg=(28, 28, 30)):
    w = max(im.width for im in images if im) if any(images) else 320
    h = max(im.height for im in images if im) if any(images) else 180
    rows = (len(images) + cols - 1) // cols
    S = Image.new("RGB", (cols * (w + pad) + pad, rows * (h + lab_h + pad) + pad), bg)
    d, f = ImageDraw.Draw(S), font(13)
    for i, (im, lab) in enumerate(zip(images, labels)):
        x, y = pad + (i % cols) * (w + pad), pad + (i // cols) * (h + lab_h + pad)
        if im:
            S.paste(im, (x, y))
        d.text((x + 3, y + h + 2), lab, fill=(225, 225, 225), font=f)
    return S


def video_sheet(path, out=None, n=8, cols=4, w=480, title=None):
    path = pathlib.Path(path)
    info = probe(path)
    dur = info["dur"] or 5
    times = [dur * (i + 0.5) / n for i in range(n)]
    ims = [grab(path, t, w) for t in times]
    S = tile(ims, [f"{t:5.2f}s  f{int(t * info['fps']) + 1}" for t in times], cols)
    if title is not False:
        head = Image.new("RGB", (S.width, 22), (16, 16, 18))
        ImageDraw.Draw(head).text((6, 3), title or f"{path.name}  {info['w']}x{info['h']}  {info['fps']:.0f} fps  {dur:.2f}s", fill=(240, 200, 120), font=font(14))
        S2 = Image.new("RGB", (S.width, S.height + 22)); S2.paste(head, (0, 0)); S2.paste(S, (0, 22)); S = S2
    out = pathlib.Path(out) if out else path.with_suffix(".sheet.jpg")
    S.save(out, quality=88)
    return out


def strip(path, t0, t1, step=2, cols=8, w=240):
    path = pathlib.Path(path)
    info = probe(path)
    f0, f1 = int(t0 * info["fps"]), int(t1 * info["fps"])
    frames = list(range(f0, f1 + 1, step))
    ims = [grab(path, (f + 0.5) / info["fps"], w) for f in frames]
    out = path.with_suffix(".strip.jpg")
    tile(ims, [f"f{f + 1} {f / info['fps']:.2f}s" for f in frames], cols).save(out, quality=88)
    return out


def plates_sheet(pid, n=8, w=320):
    d = ROOT / "media" / "plates" / pid
    takes = sorted(d.glob("take*.mp4"), key=lambda p: int(p.stem[4:]))
    if not takes:
        return None
    rows = []
    for mp4 in takes:
        info = probe(mp4)
        times = [info["dur"] * (i + 0.5) / n for i in range(n)]
        rows.append(([grab(mp4, t, w) for t in times], [f"{mp4.stem} {t:4.1f}s" for t in times]))
    S = tile([im for r in rows for im in r[0]], [lab for r in rows for lab in r[1]], n)
    out = d / "takes.sheet.jpg"
    S.save(out, quality=86)
    return out


def maps_sheet(pid, frame=1, w=480):
    """The plate frame and every map derived from it (ink, tone, edges, orientation, flow, depth, matte, face)."""
    import math
    d = ROOT / "video" / "plates" / pid
    n = frame
    def load(p, mode="RGB"):
        return Image.open(p).convert(mode).resize((w, round(w * 9 / 16)), Image.LANCZOS) if p.exists() else None
    fr = load(d / "frames" / f"f{n:04d}.jpg")
    g = Image.open(d / "maps" / f"g{n:04d}.png").convert("RGB") if (d / "maps" / f"g{n:04d}.png").exists() else None
    tiles, labels = [fr], ["frame"]
    if g:
        R, G, B = g.split()
        tiles += [Image.eval(R, lambda v: 255 - v).convert("RGB"), G.convert("RGB"), B.convert("RGB")]
        labels += ["ink (DoG lines)", "tone", "edge strength"]
    o = d / "maps" / f"o{n:04d}.png"
    if o.exists():
        import numpy as np
        a = np.asarray(Image.open(o).convert("RGB")).astype(np.float32)
        th = np.arctan2(a[..., 1] - 128, a[..., 0] - 128) / 2
        hsv = np.dstack([(th % np.pi) / np.pi * 179, np.full(th.shape, 200), a[..., 2]]).astype(np.uint8)
        import cv2
        tiles.append(Image.fromarray(cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB))); labels.append("orientation (hue) x coherence")
    v = d / "maps" / f"v{n:04d}.png"
    if v.exists():
        import numpy as np, cv2
        a = np.asarray(Image.open(v).convert("RGB")).astype(np.float32)
        dx, dy = (a[..., 0] - 128) / 4, (a[..., 1] - 128) / 4
        ang = (np.arctan2(dy, dx) % (2 * np.pi)) / (2 * np.pi) * 179
        mag = np.clip(np.hypot(dx, dy) * 40, 0, 255)
        tiles.append(Image.fromarray(cv2.cvtColor(np.dstack([ang, np.full(ang.shape, 255), mag]).astype(np.uint8), cv2.COLOR_HSV2RGB)))
        labels.append("motion flow (hue=dir)")
    k = n if n % 2 == 1 else n - 1
    for name, p in (("depth (bright=near)", d / "maps" / f"d{k:04d}.png"), ("matte", d / "masks" / f"m{k:04d}.png")):
        if p.exists():
            tiles.append(Image.open(p).convert("RGB")); labels.append(name)
    meta = d / "meta.json"
    if meta.exists() and fr:
        m = json.loads(meta.read_text())[n - 1]
        im = fr.copy(); dr = ImageDraw.Draw(im)
        for f in m.get("faces", []):
            u0, v0, u1, v1 = f["box"]
            dr.rectangle((u0 * im.width, v0 * im.height, u1 * im.width, v1 * im.height), outline=(255, 200, 0))
            for key, pts in (f.get("lines") or {}).items():
                if key.startswith("iris"):
                    continue
                xy = [(pts[i] * im.width, pts[i + 1] * im.height) for i in range(0, len(pts), 2)]
                dr.line(xy, fill=(0, 255, 120), width=1)
        sx, sy, ss = m.get("sun", [0, 0, 0])
        dr.ellipse((sx * im.width - 6, sy * im.height - 6, sx * im.width + 6, sy * im.height + 6), outline=(255, 60, 60))
        tiles.append(im); labels.append(f"meta: face lines, sun; mouth_open={m['faces'][0].get('mouth_open') if m.get('faces') else '-'}")
    tiles = [t.resize((w, round(w * 9 / 16)), Image.LANCZOS) if t else None for t in tiles]
    out = d / f"maps_f{n:04d}.jpg"
    tile(tiles, labels, 4).save(out, quality=88)
    return out


def frames_sheets(every=1.0, t0=0.0, t1=None, cols=8, w=240, per=48, frames_dir=None):
    fr, outd = pathlib.Path(frames_dir) if frames_dir else ROOT / "video" / "out" / "frames", ROOT / "video" / "out" / "review"
    man = json.loads((fr / "render.json").read_text()) if (fr / "render.json").exists() else {}
    fps = man.get("fps", 60 if man else FPS)          # the render harness writes render.json (60 fps master)
    shots = []
    sp = ROOT / "video" / "out" / "shots.json"
    if sp.exists():
        shots = json.loads(sp.read_text())           # rows [id, t0, t1, ...] (render.mjs --list --out=...)
    def shot_at(t):
        for row in reversed(shots):
            if row[1] <= t < row[2]:
                return row[0]
        return ""
    if t1 is None:
        idx = [int(p.stem[1:]) for p in fr.glob("f*.jpg")]
        t1 = (max(idx) + 1) / fps if idx else 0
    outd.mkdir(parents=True, exist_ok=True)
    times, t = [], t0 + every / 2
    while t < t1:
        times.append(round(t, 3)); t += every
    h = round(w * man.get("h", 1080) / man.get("w", 1920))
    outs = []
    for k in range(0, len(times), per):
        chunk = times[k:k + per]
        ims = []
        for tt in chunk:
            f = fr / f"f{int(tt * fps + 1e-6):05d}.jpg"
            ims.append(Image.open(f).convert("RGB").resize((w, h), Image.LANCZOS) if f.exists() else None)
        out = outd / f"sheet_{chunk[0]:06.1f}.jpg"
        tile(ims, [f"{tt:6.1f} {shot_at(tt)}" for tt in chunk], cols).save(out, quality=88)
        outs.append(out)
        print(out)
    return outs


def main(argv):
    pos = [a for a in argv if not a.startswith("--")]
    kw = {a[2:].split("=", 1)[0]: (a.split("=", 1)[1] if "=" in a else True) for a in argv if a.startswith("--")}
    cmd = pos[0] if pos else "help"
    if cmd == "video":
        for f in pos[1:]:
            print(video_sheet(f, kw.get("out") if len(pos) == 2 else None, n=int(kw.get("n", 8)), cols=int(kw.get("cols", 4)), w=int(kw.get("w", 480))))
    elif cmd == "plates":
        ids = pos[1:] or [p.name for p in sorted((ROOT / "media" / "plates").iterdir()) if p.is_dir()]
        for pid in ids:
            print(pid, plates_sheet(pid, n=int(kw.get("n", 8))))
    elif cmd == "strip":
        print(strip(pos[1], float(kw.get("from", 0)), float(kw.get("to", 2)), step=int(kw.get("step", 2)), cols=int(kw.get("cols", 8)), w=int(kw.get("w", 240))))
    elif cmd == "maps":
        print(maps_sheet(pos[1], int(kw.get("frame", 1))))
    elif cmd == "frames":
        frames_sheets(float(kw.get("every", 1.0)), float(kw.get("from", 0)), float(kw["to"]) if "to" in kw else None,
                      int(kw.get("cols", 8)), int(kw.get("w", 240)), int(kw.get("per", 48)), kw.get("dir"))
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
