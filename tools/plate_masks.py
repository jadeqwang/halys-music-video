"""Subject mattes for plates (rembg): video/plates/<id>/masks/m%04d.png, grey 0..255 (255 = subject).

    python3 tools/plate_masks.py [ids ...] [--model=isnet-anime|isnet-general-use|u2net_human_seg] [--step=2] [--w=480] [--h=270]

--step=2 (default) mattes every other frame (f = 1, 3, 5, ...: the renderer uses the nearest one, which
matches drawing on twos); --step=1 for every frame. The default model is isnet-anime (anime / cel-shaded
plates, like the singer); use isnet-general-use for photoreal plates. Models download from GitHub releases
into ~/.rembg/models (rembg 2.0.8x; older versions use $U2NET_HOME). Speed: ~1-2 s per matte on 4 shared CPUs.
"""
import os, pathlib, sys, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
DST = ROOT / "video" / "plates"


def run(pid, model="isnet-anime", step=2, w=480, h=270, force=False, _ses={}):
    from PIL import Image
    from rembg import remove, new_session
    if model not in _ses:
        _ses[model] = new_session(model)
    d = DST / pid
    frames = sorted((d / "frames").glob("f*.jpg"))
    (d / "masks").mkdir(exist_ok=True)
    todo = [f for f in frames if (int(f.stem[1:]) - 1) % step == 0 and (force or not (d / "masks" / f"m{f.stem[1:]}.png").exists())]
    t0 = time.time()
    for f in todo:
        im = Image.open(f).convert("RGB").resize((w, h), Image.LANCZOS)
        m = remove(im, session=_ses[model], only_mask=True)
        m.save(d / "masks" / f"m{f.stem[1:]}.png", optimize=True)
    if todo:
        print(f"{pid}: {len(todo)} mattes ({model}) in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    a = sys.argv[1:]
    kw = {x[2:].split("=", 1)[0]: (x.split("=", 1)[1] if "=" in x else True) for x in a if x.startswith("--")}
    ids = [x for x in a if not x.startswith("--")] or [p.name for p in sorted(DST.iterdir()) if (p / "frames").is_dir()]
    for pid in ids:
        run(pid, kw.get("model", "isnet-anime"), int(kw.get("step", 2)), int(kw.get("w", 480)), int(kw.get("h", 270)), bool(kw.get("force")))
