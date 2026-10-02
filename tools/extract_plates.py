"""Extract plate frames for analysis and the renderer.

    python3 tools/extract_plates.py                  # latest take of every plate (skips up-to-date ones)
    python3 tools/extract_plates.py river_wide:2     # a specific take
    python3 tools/extract_plates.py --still=leg_sun:media/stills/sun.png   # a single image as a 1-frame plate
    python3 tools/extract_plates.py --src=media/tests/clip.mp4 --id=smoke   # any video file as plate <id>
    options: --w=960 --h=540 (frame size, default 960x540, letterboxed/cropped to fill) --fps=24

media/plates/<id>/take<N>.mp4 -> video/plates/<id>/frames/f0001.jpg ... (24 fps).
Writes video/plates/index.json: {id: {n, fps, w, h, take, src_w, src_h, dur, mattes, depth, fields, gain}}.
Per-frame maps from the other tools live in video/plates/<id>/maps/ and masks/ (all gitignored); small
metadata (meta.json, stats.json, fields.json) sits in video/plates/<id>/.
"""
import json, pathlib, shutil, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, DST = ROOT / "media" / "plates", ROOT / "video" / "plates"


def probe(mp4):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration",
                        "-of", "json", str(mp4)], capture_output=True, text=True)
    d = json.loads(r.stdout or "{}")
    st = (d.get("streams") or [{}])[0]
    return st.get("width"), st.get("height"), float((d.get("format") or {}).get("duration") or 0)


def counts(out):
    return {"n": len(list((out / "frames").glob("f*.jpg"))), "mattes": len(list((out / "masks").glob("m*.png"))),
            "depth": len(list((out / "maps").glob("d*.png"))), "fields": len(list((out / "maps").glob("g*.png")))}


def extract(pid, take=None, w=960, h=540, fps=24, src=None):
    takes = sorted((SRC / pid).glob("take*.mp4"), key=lambda p: int(p.stem[4:]))
    if not takes and not src:
        return None
    mp4 = pathlib.Path(src) if src else SRC / pid / f"take{take}.mp4" if take else takes[-1]
    out = DST / pid
    stamp = out / ".take"
    sig = f"{mp4.name}|{mp4.stat().st_size}|{w}x{h}@{fps}"
    if not (stamp.exists() and stamp.read_text() == sig and any((out / "frames").glob("f*.jpg"))):
        for sub in ("frames", "maps", "masks"):
            shutil.rmtree(out / sub, ignore_errors=True)
        for f in ("meta.json", "stats.json", "fields.json"):
            (out / f).unlink(missing_ok=True)
        (out / "frames").mkdir(parents=True)
        vf = f"fps={fps},scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,crop={w}:{h}"
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(mp4), "-vf", vf, "-q:v", "2",
                        str(out / "frames" / "f%04d.jpg")], check=True)
        stamp.write_text(sig)
    sw, sh, dur = probe(mp4)
    st = json.loads((out / "stats.json").read_text()) if (out / "stats.json").exists() else {}
    c = counts(out)
    return {**c, "fps": fps, "w": w, "h": h, "take": str(mp4.relative_to(ROOT)) if src else mp4.name, "src_w": sw, "src_h": sh, "dur": round(dur, 3), "gain": st.get("gain", 1.0)}


def still(pid, path, w=960, h=540):
    from PIL import Image, ImageOps
    out = DST / pid
    (out / "frames").mkdir(parents=True, exist_ok=True)
    im = ImageOps.fit(Image.open(ROOT / path).convert("RGB"), (w, h), Image.LANCZOS)
    im.save(out / "frames" / "f0001.jpg", quality=94)
    return {**counts(out), "fps": 24, "w": w, "h": h, "take": "still:" + str(path), "src_w": im.width, "src_h": im.height, "dur": 0, "gain": 1.0}


def update_index(pid=None, info=None):
    DST.mkdir(parents=True, exist_ok=True)
    p = DST / "index.json"
    idx = json.loads(p.read_text()) if p.exists() else {}
    if pid:
        idx[pid] = info
    for k, v in idx.items():          # refresh map counts (other tools add maps after extraction)
        if (DST / k).exists():
            v.update(counts(DST / k))
            st = DST / k / "stats.json"
            if st.exists():
                v["gain"] = json.loads(st.read_text()).get("gain", v.get("gain", 1.0))
    p.write_text(json.dumps(idx, indent=1))
    return idx


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    kw = {a[2:].split("=", 1)[0]: (a.split("=", 1)[1] if "=" in a else True) for a in sys.argv[1:] if a.startswith("--")}
    W, H, FPS = int(kw.get("w", 960)), int(kw.get("h", 540)), int(kw.get("fps", 24))
    if kw.get("index-only"):
        update_index()
        sys.exit()
    if kw.get("src"):
        info = extract(kw["id"], None, W, H, FPS, src=(ROOT / kw["src"]).resolve())
        update_index(kw["id"], info)
        print(kw["id"], info)
        sys.exit()
    if kw.get("still"):
        pid, path = kw["still"].split(":", 1)
        info = still(pid, path, W, H)
        update_index(pid, info)
        print(pid, info)
        sys.exit()
    todo = [a.split(":") for a in args] if args else [[p.name] for p in sorted(SRC.iterdir()) if p.is_dir()] if SRC.exists() else []
    for item in todo:
        pid, take = item[0], (item[1] if len(item) > 1 else None)
        info = extract(pid, take, W, H, FPS)
        if info:
            update_index(pid, info)
            print(f"{pid}: {info}")
    update_index()
