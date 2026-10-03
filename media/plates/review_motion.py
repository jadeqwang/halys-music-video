"""Review a Seedance plate take: motion-energy curve vs the plate's musical hits, cuts, faces, and a contact sheet.

    python3 media/plates/review_motion.py P12            # latest take
    python3 media/plates/review_motion.py P12:2 P38:1    # specific takes
    options: --faces (MediaPipe blink/smile/jaw per frame; for close-ups and the singer)
             --at=1.3,2.9 (extra plate times to show on the sheet)  --win=0.6 (search window around each hit, s)

For each take writes media/plates/<id>/take<N>.review.jpg (motion plot + frames at the hits, <= 500 KB) and
take<N>.motion.json (per-frame curves + detected events + sync offsets), and prints a summary.

Motion measure: DIS optical flow on 320x180 greyscale frames at 24 fps. `local` is the mean flow magnitude after
removing the median (camera) flow, i.e. subject motion; `glob` is the median flow (camera move). Impacts and
"slams" show as a peak of `local` followed by a sharp fall (the stop), so each hit is matched to the strongest
deceleration (largest negative slope of the smoothed `local` curve) within +-win of the expected plate time, and
also to the nearest `local` peak. Offset = measured plate time - expected plate time (positive = the plate is late).
Plate time = song time - audio t0 (the audio reference is cut at t0 with the plate's own duration).
"""
import importlib.util, io, json, pathlib, subprocess, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
PL = ROOT / "media" / "plates"
W, H, FPS = 320, 180, 24


def specs():
    sp = importlib.util.spec_from_file_location("ps", ROOT / "tools" / "plate_specs.py")
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
    return m.PLATES


def font(s=13):
    for f in (ROOT / "video/fonts/JetBrainsMono-Regular.ttf", pathlib.Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")):
        if f.exists():
            return ImageFont.truetype(str(f), s)
    return ImageFont.load_default()


def frames(mp4, w=W, h=H, color=False):
    """All frames at the native 24 fps, scaled to w x h (BGR or grey uint8)."""
    pix = 3 if color else 1
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(mp4), "-vf", f"scale={w}:{h}:flags=area",
           "-f", "rawvideo", "-pix_fmt", "bgr24" if color else "gray", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    n = len(raw) // (w * h * pix)
    a = np.frombuffer(raw[:n * w * h * pix], np.uint8)
    return a.reshape(n, h, w, pix) if color else a.reshape(n, h, w)


def motion(gray):
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    n = len(gray)
    loc, glob, p95, diff = np.zeros(n), np.zeros(n), np.zeros(n), np.zeros(n)
    for i in range(1, n):
        f = dis.calc(gray[i - 1], gray[i], None)
        med = np.median(f.reshape(-1, 2), 0)
        r = f - med
        mag = np.hypot(r[..., 0], r[..., 1])
        loc[i], glob[i], p95[i] = mag.mean(), float(np.hypot(*med)), np.percentile(mag, 95)
        diff[i] = np.abs(gray[i].astype(np.int16) - gray[i - 1]).mean()
    loc[0], p95[0], glob[0] = loc[1] if n > 1 else 0, p95[1] if n > 1 else 0, glob[1] if n > 1 else 0
    return loc, glob, p95, diff


def smooth(x, k=3):
    if len(x) < k:
        return x
    ker = np.ones(k) / k
    return np.convolve(np.pad(x, (k // 2, k // 2), mode="edge"), ker, mode="valid")


def cuts_from(diff, loc):
    med = np.median(diff[1:]) if len(diff) > 1 else 0
    return [i for i in range(1, len(diff)) if diff[i] > max(18, 5 * med) and diff[i] > 2.5 * max(diff[i - 1], diff[min(i + 1, len(diff) - 1)])]


def peaks(x, min_gap=4):
    idx = [i for i in range(1, len(x) - 1) if x[i] >= x[i - 1] and x[i] > x[i + 1]]
    idx.sort(key=lambda i: -x[i])
    keep = []
    for i in idx:
        if all(abs(i - j) >= min_gap for j in keep):
            keep.append(i)
    return sorted(keep)


def faces_curves(mp4):
    sys.path.insert(0, str(ROOT / "tools"))
    import plate_meta
    col = frames(mp4, 640, 360, color=True)
    out = []
    for fr in col:
        rgb = cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)
        res = plate_meta.detect_faces(rgb)
        if not res:
            out.append(None)
            continue
        lm, bs = max(res, key=lambda r: (r[0][:, 0].max() - r[0][:, 0].min()) * (r[0][:, 1].max() - r[0][:, 1].min()))
        rec = plate_meta.face_record(lm, bs)
        out.append({"blinkL": round(bs.get("eyeBlinkLeft", 0), 3), "blinkR": round(bs.get("eyeBlinkRight", 0), 3),
                    "smile": round((bs.get("mouthSmileLeft", 0) + bs.get("mouthSmileRight", 0)) / 2, 3),
                    "jaw": round(bs.get("jawOpen", 0), 3), "yaw": rec["yaw"], "box": rec["box"]})
    return out


def grab(mp4, t, w=320):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{max(0, t):.3f}", "-i", str(mp4), "-frames:v", "1",
                        "-vf", f"scale={w}:-2", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True)
    return Image.open(io.BytesIO(r.stdout)).convert("RGB") if r.stdout else Image.new("RGB", (w, w * 9 // 16))


def plot(curves, n, events, cuts, w=1296, h=210, face=None):
    im = Image.new("RGB", (w, h), (20, 20, 22))
    d, f = ImageDraw.Draw(im), font(12)
    dur = n / FPS
    X = lambda t: 40 + (w - 50) * t / max(dur, 1e-6)
    for s in range(int(dur) + 1):
        d.line([(X(s), 0), (X(s), h - 16)], fill=(45, 45, 50))
        d.text((X(s) - 3, h - 15), f"{s}", fill=(150, 150, 150), font=f)
    for name, (c, color) in curves.items():
        m = max(1e-6, float(np.max(c)))
        pts = [(X(i / FPS), h - 20 - (h - 34) * v / m) for i, v in enumerate(c)]
        d.line(pts, fill=color, width=2)
    if face:
        for key, color in (("blinkL", (120, 200, 255)), ("blinkR", (60, 140, 255)), ("smile", (255, 170, 60))):
            pts = [(X(i / FPS), h - 20 - (h - 34) * fr[key]) for i, fr in enumerate(face) if fr]
            if len(pts) > 1:
                d.line(pts, fill=color, width=1)
    for c in cuts:
        d.line([(X(c / FPS), 0), (X(c / FPS), h - 16)], fill=(220, 40, 40), width=2)
    for e in events:
        x = X(e["expected"])
        d.line([(x, 0), (x, h - 16)], fill=(240, 220, 120), width=1)
        if e.get("decel") is not None:
            xm = X(e["decel"])
            d.ellipse([xm - 4, 10, xm + 4, 18], fill=(255, 90, 200))
    y = 2
    for name, (c, color) in curves.items():
        d.text((44, y), f"{name} (max {float(np.max(c)):.2f} px/fr)", fill=color, font=f)
        y += 13
    if face:
        d.text((44, y), "blinkL/blinkR/smile", fill=(120, 200, 255), font=f)
    d.text((w - 330, 2), "yellow = expected hit · pink = measured stop · red = cut", fill=(200, 200, 200), font=f)
    return im


def review(pid, take=None, do_faces=False, extra=(), win=0.6):
    sp = specs().get(pid, {})
    d = PL / pid
    takes = sorted(d.glob("take*.mp4"), key=lambda p: int(p.stem[4:]))
    mp4 = d / f"take{take}.mp4" if take else takes[-1]
    tk = int(mp4.stem[4:])
    au = sp.get("audio") or {}
    t0 = au.get("t0", (sp.get("t_song") or [0])[0]) if isinstance(au, dict) else 0
    gray = frames(mp4)
    n = len(gray)
    loc, glob, p95, diff = motion(gray)
    ls = smooth(loc, 3)
    slope = np.gradient(ls)
    cuts = cuts_from(diff, loc)
    events = []
    for st, label in sp.get("sync", []):
        te = st - t0
        if te < 0 or te > n / FPS:
            continue
        i0, i1 = max(1, int((te - win) * FPS)), min(n - 1, int((te + win) * FPS) + 1)
        seg = range(i0, i1)
        dec = min(seg, key=lambda i: slope[i]) if i1 > i0 else None
        pk = max(seg, key=lambda i: ls[i]) if i1 > i0 else None
        events.append({"song_t": st, "event": label, "expected": round(te, 3),
                       "decel": round(dec / FPS, 3) if dec is not None else None,
                       "peak": round(pk / FPS, 3) if pk is not None else None,
                       "offset_decel": round(dec / FPS - te, 3) if dec is not None else None,
                       "offset_peak": round(pk / FPS - te, 3) if pk is not None else None})
    face = faces_curves(mp4) if do_faces else None
    # the sheet: plot + 8 evenly spaced frames + frames at the hits/extra times
    dur = n / FPS
    times = [dur * (i + 0.5) / 8 for i in range(8)]
    labels = [f"{t:.2f}s" for t in times]
    for e in events:
        tt = e["decel"] if e["decel"] is not None else e["expected"]
        times.append(tt)
        labels.append(f"{tt:.2f}s hit@{e['expected']:.2f}")
    for t in extra:
        times.append(t)
        labels.append(f"{t:.2f}s")
    thumbs = [grab(mp4, t) for t in times]
    cols = 4
    tw, th = thumbs[0].size
    rows = (len(thumbs) + cols - 1) // cols
    pl = plot({"local motion": (ls, (90, 220, 120)), "camera": (smooth(glob, 3), (110, 110, 200))}, n, events, cuts, face=face)
    S = Image.new("RGB", (cols * (tw + 4) + 4, 24 + pl.height + 4 + rows * (th + 20)), (16, 16, 18))
    dr, f = ImageDraw.Draw(S), font(13)
    dr.text((6, 4), f"{pid} take{tk}  {n} fr  {dur:.2f}s  audio t0={t0}  cuts={[round(c / FPS, 2) for c in cuts]}", fill=(240, 200, 120), font=f)
    S.paste(pl.resize((S.width - 8, pl.height)), (4, 24))
    for k, (im, lab) in enumerate(zip(thumbs, labels)):
        x, y = 4 + (k % cols) * (tw + 4), 24 + pl.height + 4 + (k // cols) * (th + 20)
        S.paste(im, (x, y))
        dr.text((x + 3, y + th + 2), lab, fill=(220, 220, 220), font=f)
    out = d / f"take{tk}.review.jpg"
    q = 85
    while True:
        S.save(out, quality=q)
        if out.stat().st_size <= 500_000 or q <= 40:
            break
        q -= 10
    rec = {"plate": pid, "take": tk, "frames": n, "dur": round(dur, 3), "t0": t0, "cuts_s": [round(c / FPS, 3) for c in cuts],
           "events": events, "local": [round(float(v), 4) for v in ls], "camera": [round(float(v), 4) for v in smooth(glob, 3)],
           "local_peaks_s": [round(i / FPS, 3) for i in peaks(ls)[:12]], "sheet": str(out.relative_to(ROOT))}
    if face is not None:
        rec["faces"] = face
    (d / f"take{tk}.motion.json").write_text(json.dumps(rec))
    return rec


if __name__ == "__main__":
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    kw = {x[2:].split("=", 1)[0]: (x.split("=", 1)[1] if "=" in x else True) for x in sys.argv[1:] if x.startswith("--")}
    extra = [float(v) for v in str(kw.get("at", "")).split(",") if v]
    for item in args:
        pid, _, tk = item.partition(":")
        r = review(pid, int(tk) if tk else None, bool(kw.get("faces")), extra, float(kw.get("win", 0.6)))
        print(f"== {pid} take{r['take']}  {r['dur']}s  cuts {r['cuts_s']}  local peaks {r['local_peaks_s'][:8]}")
        for e in r["events"]:
            print(f"   {e['song_t']:8.3f}  exp {e['expected']:5.2f}  stop {e['decel']}  ({e['offset_decel']:+.2f})  peak {e['peak']} "
                  f"({e['offset_peak']:+.2f})  {e['event']}")
        print("   sheet:", r["sheet"])
