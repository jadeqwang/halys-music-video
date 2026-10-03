"""Art-department driver: reference boards, image generation, finishing, contact sheets, BOARDS.md.

    python3 media/boards/_scripts/boards.py refboards [NAME ...]     # build reference boards (scratchpad)
    python3 media/boards/_scripts/boards.py run ID [ID ...] [--par=4] [--dry]
    python3 media/boards/_scripts/boards.py list
    python3 media/boards/_scripts/boards.py contact                  # media/boards/*_contact.jpg
    python3 media/boards/_scripts/boards.py index                    # production/BOARDS.md

Jobs live in jobs.py (id -> model, folder, prompt, refs). Every generation is logged to media/genlog.jsonl
through tools/cfai.py (submit / wait / save), with `out` pointing at the finished board, and recorded in
media/boards/_scripts/manifest.jsonl (one line per take). Review verdicts live in verdicts.json.
Raw model outputs are kept in the session scratchpad (RAW below); the boards are <=2048 px, <=700 KB JPEGs.
"""
import concurrent.futures as cf_futures
import io, json, os, pathlib, shutil, sys, time, traceback

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import cfai  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
BOARDS = ROOT / "media" / "boards"
SCRATCH = pathlib.Path(os.environ.get("BOARDS_SCRATCH",
                       "/tmp/claude-0/-home-user-halys-music-video/b8664d69-2871-5fba-a7df-659b9d78ccf5/scratchpad"))
RAW = SCRATCH / "raw"
REFB = SCRATCH / "refboards"
MANIFEST = HERE / "manifest.jsonl"
VERDICTS = HERE / "verdicts.json"
REFS = ROOT / "production" / "refs"
MAX_SIDE, MAX_KB = 2048, 700


# ------------------------------------------------------------------ reference boards
def _crop(im, box):
    if not box:
        return im
    w, h = im.size
    x0, y0, x1, y1 = box
    return im.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)))


def make_board(name, items, height=1000, gap=24, bg=(128, 128, 128), max_w=2400):
    """items: [(path, crop_box_or_None), ...] -> one horizontal strip on mid-grey, no text."""
    ims = []
    for path, box in items:
        p = pathlib.Path(path)
        if not p.is_absolute():
            p = (REFS / path) if (REFS / path).exists() else (ROOT / path)
        im = _crop(Image.open(p).convert("RGB"), box)
        r = height / im.size[1]
        ims.append(im.resize((max(1, int(im.size[0] * r)), height), Image.LANCZOS))
    W = sum(i.size[0] for i in ims) + gap * (len(ims) + 1)
    H = height + 2 * gap
    board = Image.new("RGB", (W, H), bg)
    x = gap
    for i in ims:
        board.paste(i, (x, gap))
        x += i.size[0] + gap
    if W > max_w:
        board = board.resize((max_w, int(H * max_w / W)), Image.LANCZOS)
    REFB.mkdir(parents=True, exist_ok=True)
    out = REFB / f"{name}.jpg"
    board.save(out, quality=90)
    return out


def refboard_path(name):
    import jobs
    p = REFB / f"{name}.jpg"
    if not p.exists():
        make_board(name, jobs.REFBOARDS[name])
    return p


def resolve_ref(r):
    """'board:NAME' -> built board; 'chars/x.jpg' etc. -> media/boards/...; otherwise repo/refs path."""
    if r.startswith("board:"):
        return refboard_path(r[6:])
    if r.startswith("raw:"):
        return RAW / r[4:]
    for base in (BOARDS, ROOT, REFS):
        if (base / r).exists():
            return base / r
    raise FileNotFoundError(r)


# ------------------------------------------------------------------ finishing
def finish_jpg(src, dst, max_side=MAX_SIDE, max_kb=MAX_KB):
    im = Image.open(src).convert("RGB")
    s = min(1.0, max_side / max(im.size))
    if s < 1:
        im = im.resize((round(im.size[0] * s), round(im.size[1] * s)), Image.LANCZOS)
    for q in (92, 90, 88, 86, 84, 82, 80, 77, 74, 70, 66, 62):
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
        if buf.tell() <= max_kb * 1024:
            break
    pathlib.Path(dst).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(dst).write_bytes(buf.getvalue())
    return im.size, buf.tell() // 1024, q


# ------------------------------------------------------------------ cost
def est_cost(model, inp, rec):
    usage = (rec or {}).get("usage") or ((rec or {}).get("result") or {}).get("usage") or {}
    if model == "openai/gpt-image-2":
        if usage:
            det = usage.get("input_tokens_details") or {}
            img_in = det.get("image_tokens", 0)
            txt_in = det.get("text_tokens", max(0, usage.get("input_tokens", 0) - img_in))
            out = usage.get("output_tokens", 0)
            return round(txt_in * 5e-6 + img_in * 8e-6 + out * 30e-6, 4)
        q = inp.get("quality", "high")
        base = {"low": 0.02, "medium": 0.06, "high": 0.2, "auto": 0.2}[q]
        return round(base + 0.006 * len(inp.get("images") or []), 4)
    if model.startswith("black-forest-labs/flux-2"):
        first, extra, per_in = {"black-forest-labs/flux-2-max": (0.07, 0.03, 0.03),
                                "black-forest-labs/flux-2-pro-preview": (0.03, 0.015, 0.015),
                                "black-forest-labs/flux-2-flex": (0.05, 0.05, 0.05)}[model]
        mp = (inp.get("width", 1024) * inp.get("height", 1024)) / 1e6
        n_in = len(inp.get("input_images") or [])
        return round(first + extra * max(0.0, mp - 1) + per_in * n_in * 1.0, 4)
    return cfai.est_cost(model, inp, rec)


# ------------------------------------------------------------------ generation
def build_input(job):
    model = job["model"]
    prompt = job["prompt"].strip()
    refs = [resolve_ref(r) for r in job.get("refs", [])]
    uris = [cfai.image_ref(p, max_side=2048) for p in refs]
    p = dict(job.get("params") or {})
    if model == "google/nano-banana-pro":
        inp = {"prompt": prompt, "aspect_ratio": p.get("aspect_ratio", "16:9"), "image_size": p.get("image_size", "2K"),
               "output_format": "jpg"}
        if uris:
            inp["image_input"] = uris[:3]
    elif model in ("google/nano-banana-2", "google/nano-banana-2-lite"):
        inp = {"prompt": prompt, "aspect_ratio": p.get("aspect_ratio", "16:9"), "resolution": p.get("resolution", "2K"),
               "output_format": "jpg"}
        if uris:
            inp["image_input"] = uris[:3]
    elif model == "openai/gpt-image-2":
        inp = {"prompt": prompt, "size": p.get("size", "1536x1024"), "quality": p.get("quality", "high"),
               "output_format": "jpeg", "background": "opaque"}
        if uris:
            inp["images"] = uris[:16]
    elif model == "bytedance/seedream-5-pro":
        inp = {"prompt": prompt, "size": p.get("size", "2560x1440"), "watermark": False}
        if uris:
            inp["image"] = uris if len(uris) > 1 else uris[0]
    elif model.startswith("black-forest-labs/flux-2"):
        inp = {"prompt": prompt, "width": p.get("width", 1920), "height": p.get("height", 1088), "output_format": "jpeg",
               "safety_tolerance": p.get("safety_tolerance", 2)}
        if uris:
            inp["input_images"] = uris[:8]
    else:
        raise ValueError(model)
    return inp, refs


def next_take(jid):
    n = 1
    if MANIFEST.exists():
        for line in MANIFEST.read_text().splitlines():
            try:
                r = json.loads(line)
            except Exception:
                continue
            if r.get("job") == jid:
                n = max(n, r.get("take", 0) + 1)
    return n


def gen(jid, dry=False):
    import jobs
    job = jobs.JOBS[jid]
    model = job["model"]
    inp, refs = build_input(job)
    take = next_take(jid)
    name = f"{jid}_t{take}"
    folder = job["folder"]
    out = BOARDS / folder / f"{name}.jpg"
    if dry:
        print(json.dumps({"id": name, "model": model, "out": str(out.relative_to(ROOT)), "refs": [str(r) for r in refs],
                          "input": cfai.strip_blobs(inp)}, indent=1)[:3000])
        return None
    cfai.validate(model, inp)
    RAW.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    tag = f"boards:{folder}:{name}"
    job_id = cfai.submit(model, inp, tag=tag, out=str(RAW / f"{name}.jpg"))
    try:
        rec = cfai.wait(job_id, timeout=job.get("timeout", 900), quiet=True)
    except TimeoutError:
        cfai.log(f"{name}: timed out; collect later with cfai.py collect {job_id}")
        raise
    ok = rec.get("state") == "Completed"
    paths = cfai.save_outputs(job_id, rec, RAW / f"{name}.jpg") if ok else []
    secs = round(time.time() - t0, 1)
    cost = est_cost(model, inp, rec) if ok else 0.0
    entry = {"t": time.strftime("%Y-%m-%dT%H:%M:%S"), "tag": tag, "model": model, "input": cfai.strip_blobs(inp),
             "out": [str(out.relative_to(ROOT))] if paths else [], "secs": secs, "est_cost_usd": cost, "job": job_id,
             "mode": "bg", "refs": [str(pathlib.Path(r)).replace(str(ROOT) + "/", "") for r in refs],
             "raw": [str(p) for p in paths]}
    if rec.get("usage"):
        entry["usage"] = rec["usage"]
    if not ok:
        entry["error"] = json.dumps(rec.get("error") or rec)[:600]
        entry["state"] = rec.get("state")
    cfai._genlog(entry)
    jf = cfai.JOBS / f"{job_id}.json"
    if jf.exists():
        jf.unlink()
    if not ok:
        raise cfai.CFError(f"{name}: {rec.get('state')} {entry.get('error')}")
    raw = pathlib.Path(paths[0])
    rw, rh = Image.open(raw).size
    size, kb, q = finish_jpg(raw, out)
    m = {"job": jid, "take": take, "name": name, "file": str(out.relative_to(ROOT)), "folder": folder, "model": model,
         "prompt": job["prompt"].strip(), "refs": [r for r in job.get("refs", [])],
         "ref_files": entry["refs"], "raw": str(raw), "raw_size": [rw, rh], "size": list(size), "kb": kb,
         "secs": secs, "est_cost_usd": cost, "t": entry["t"], "cf_job": job_id, "params": job.get("params") or {}}
    with open(MANIFEST, "a") as f:
        f.write(json.dumps(m) + "\n")
    print(f"OK {name}: {model} {rw}x{rh} -> {out.relative_to(ROOT)} {size[0]}x{size[1]} {kb} KB q{q} {secs}s ~${cost}",
          flush=True)
    return m


def run(ids, par=4, dry=False):
    if dry or len(ids) == 1:
        for i in ids:
            try:
                gen(i, dry=dry)
            except Exception as e:
                print(f"FAIL {i}: {e}", flush=True)
        return
    with cf_futures.ThreadPoolExecutor(max_workers=par) as ex:
        futs = {ex.submit(gen, i): i for i in ids}
        for f in cf_futures.as_completed(futs):
            i = futs[f]
            try:
                f.result()
            except Exception as e:
                print(f"FAIL {i}: {e}", flush=True)
                traceback.print_exc()


# ------------------------------------------------------------------ manifest / verdicts
def manifest():
    rows = []
    if MANIFEST.exists():
        for line in MANIFEST.read_text().splitlines():
            try:
                rows.append(json.loads(line))
            except Exception:
                pass
    return rows


def verdicts():
    return json.loads(VERDICTS.read_text()) if VERDICTS.exists() else {}


def _font(sz):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"):
        if os.path.exists(f):
            return ImageFont.truetype(f, sz)
    return ImageFont.load_default()


def contact(folder, cols=4, cw=480):
    """Contact sheet of the kept (non-reject) boards in one folder; canonical ones flagged."""
    V = verdicts()
    rows = [m for m in manifest() if m["folder"] == folder and (BOARDS / folder / f"{m['name']}.jpg").exists()
            and V.get(m["name"], {}).get("verdict", "keep") not in ("reject",)]
    if not rows:
        return None
    ch = int(cw * 9 / 16)
    lab = 34
    n = len(rows)
    r = (n + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw + (cols + 1) * 8, r * (ch + lab) + (r + 1) * 8 + 40), (16, 16, 18))
    d = ImageDraw.Draw(sheet)
    d.text((10, 10), f"HALYS boards: {folder} ({n} kept)", fill=(235, 235, 235), font=_font(20))
    for k, m in enumerate(rows):
        im = Image.open(BOARDS / folder / f"{m['name']}.jpg").convert("RGB")
        im.thumbnail((cw, ch))
        x = 8 + (k % cols) * (cw + 8)
        y = 48 + (k // cols) * (ch + lab + 8)
        sheet.paste(im, (x + (cw - im.size[0]) // 2, y + (ch - im.size[1]) // 2))
        v = V.get(m["name"], {})
        star = "* " if v.get("verdict") == "canonical" else ""
        col = (240, 138, 42) if star else (200, 200, 200)
        d.text((x, y + ch + 4), f"{star}{m['name']}  [{m['model'].split('/')[-1]}]"[:64], fill=col, font=_font(14))
    out = BOARDS / f"{folder}_contact.jpg"
    finish_jpg_img(sheet, out)
    return out


def finish_jpg_img(im, dst, max_side=MAX_SIDE, max_kb=MAX_KB):
    tmp = SCRATCH / "_tmp_contact.png"
    im.save(tmp)
    return finish_jpg(tmp, dst, max_side, max_kb)


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    kw = dict(a[2:].split("=", 1) if "=" in a else (a[2:], True) for a in argv if a.startswith("--"))
    cmd = args[0] if args else "help"
    if cmd == "refboards":
        import jobs
        for n in (args[1:] or list(jobs.REFBOARDS)):
            print(make_board(n, jobs.REFBOARDS[n]))
    elif cmd == "run":
        run(args[1:], par=int(kw.get("par", 4)), dry=bool(kw.get("dry")))
    elif cmd == "list":
        import jobs
        for k, j in jobs.JOBS.items():
            print(f"{k:28s} {j['model']:28s} {j['folder']:7s} refs={len(j.get('refs', []))}")
    elif cmd == "contact":
        for fo in ("chars", "sets", "frames"):
            print(contact(fo))
    elif cmd == "spend":
        tot = sum(m.get("est_cost_usd") or 0 for m in manifest())
        print(f"{len(manifest())} takes, ~${tot:.2f}")
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
