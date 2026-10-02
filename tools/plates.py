"""Generate Seedance reference plates from the shot specs in tools/plate_specs.py (or --specs=FILE).

    python3 tools/plates.py --list                    # specs, takes on disk, estimated cost per take
    python3 tools/plates.py --dry [ids]               # print the requests (blobs stripped) + cost; no API call
    python3 tools/plates.py                           # every non-example spec with fewer takes than `takes`
    python3 tools/plates.py id1 id2                   # named plates: one NEW take each (also examples)
    python3 tools/plates.py id1 --takes=3             # named plate: 3 new takes
    python3 tools/plates.py --collect                 # finish takes whose jobs were submitted by a process that died
    options: --budget=USD (refuse a batch estimated above it; default $PLATE_BUDGET or 30)
             --par=N (parallel jobs; default $PLATE_PAR or 4)  --specs=path.py|path.json  --yes (skip budget prompt)

Each take lands in media/plates/<id>/take<N>.mp4 with take<N>.json (spec snapshot, request without blobs,
job id, seconds, estimated cost) and take<N>.sheet.jpg (8-frame contact sheet). Audio references are cut
from the song (or the vocal stem) into media/plates/<id>/audio_*.mp3. Every run is also in media/genlog.jsonl.
"""
import concurrent.futures as cf
import importlib.util, json, os, pathlib, sys, threading, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cfai  # noqa: E402

ROOT = cfai.ROOT
OUT = ROOT / "media" / "plates"
SONG = ROOT / "Halys.mp3"
DEFAULT_MODEL = "bytedance/seedance-2.5"
_lock = threading.Lock()


def load_specs(path=None):
    path = pathlib.Path(path or os.environ.get("PLATE_SPECS") or ROOT / "tools" / "plate_specs.py")
    if path.suffix == ".json":
        d = json.loads(path.read_text())
        return d.get("REFS", {}), d.get("PLATES", d)
    spec = importlib.util.spec_from_file_location("plate_specs_mod", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return getattr(mod, "REFS", {}), mod.PLATES


def find_stem(kind="vocals"):
    """The isolated vocal stem written by tools/audio/ (path may be overridden with $HALYS_VOCALS)."""
    env = os.environ.get("HALYS_VOCALS")
    if env and pathlib.Path(env).exists():
        return pathlib.Path(env)
    cands = [ROOT / "media" / "stems" / f"{kind}.wav", ROOT / "media" / "stems" / f"{kind}.flac"]
    cands += sorted((ROOT / "media" / "stems").glob(f"**/*{kind}*.wav"), key=lambda p: -p.stat().st_mtime)
    for c in cands:
        if c.exists():
            return c
    raise FileNotFoundError(f"no {kind} stem under media/stems/ (set HALYS_VOCALS=path)")


def audio_refs(pid, spec):
    items = spec.get("audio")
    if not items:
        return [], []
    items = items if isinstance(items, list) else [items]
    paths, info = [], []
    for it in items:
        if isinstance(it, str):
            p = ROOT / it
            paths.append(p); info.append({"file": it})
            continue
        src = it.get("src", "song")
        dur = float(it.get("dur") or spec.get("duration", 5))
        if dur <= 0:
            raise ValueError(f"{pid}: audio dur must be given when duration is -1")
        srcp = SONG if src == "song" else find_stem("vocals") if src == "vocals" else ROOT / src
        tag = "song" if src == "song" else "vocals" if src == "vocals" else pathlib.Path(src).stem
        out = OUT / pid / f"audio_{tag}_{float(it['t0']):07.2f}_{dur:.2f}.mp3"
        if not out.exists():
            cfai.audio_slice(srcp, float(it["t0"]), dur, out)
        paths.append(out); info.append({"src": cfai._rel(srcp), "t0": float(it["t0"]), "dur": dur, "file": cfai._rel(out)})
    total = sum(cfai.probe_duration(p) or 0 for p in paths)
    if total > 30.5:
        raise ValueError(f"{pid}: reference audio totals {total:.1f}s (max 30 s)")
    return paths, info


def ref_path(refs, key):
    p = refs.get(key, key)
    full = ROOT / p
    if not full.exists():
        raise FileNotFoundError(f"reference {key!r} -> {p} not found")
    return full


def build_input(pid, spec, refs):
    model = spec.get("model", DEFAULT_MODEL)
    inp = {"prompt": spec["prompt"], "duration": spec.get("duration", 5), "resolution": spec.get("resolution", "720p"),
           "aspect_ratio": spec.get("aspect_ratio", "16:9"), "generate_audio": bool(spec.get("generate_audio", False)),
           "use_virtual_avatar": bool(spec.get("avatar", False))}
    if spec.get("refs"):
        inp["reference_images"] = [cfai.image_ref(ref_path(refs, r)) for r in spec["refs"]]
    if spec.get("first_frame"):
        inp["image"] = cfai.image_ref(ref_path(refs, spec["first_frame"]))
        inp["aspect_ratio"] = "adaptive"
    if spec.get("last_frame"):
        inp["last_frame_image"] = cfai.image_ref(ref_path(refs, spec["last_frame"]))
    if spec.get("ref_videos"):
        key = "reference_videos" if model == "bytedance/seedance-2.5" else "reference_video"
        vids = [cfai.data_uri(ROOT / v) for v in spec["ref_videos"]]
        inp[key] = vids if key == "reference_videos" else vids[0]
    apaths, ainfo = audio_refs(pid, spec)
    if apaths:
        inp["reference_audios"] = [cfai.data_uri(p) for p in apaths]
    if "seed" in spec:
        inp["seed"] = int(spec["seed"])
    return model, cfai.apply_defaults(model, inp), ainfo


def takes(pid):
    d = OUT / pid
    return sorted(d.glob("take*.mp4"), key=lambda p: int(p.stem[4:])) if d.exists() else []


def pending_for(pid):
    return [j for j in cfai.pending() if (j.get("meta", {}).get("extra") or {}).get("plate") == pid]


def next_take(pid):
    with _lock:
        used = [int(p.stem[4:]) for p in takes(pid)]
        used += [(j["meta"]["extra"] or {}).get("take", 0) for j in pending_for(pid)]
        # takes being generated right now (placeholders younger than 2 h; stale ones from a crash are ignored)
        used += [int(r.stem[4:]) for r in (OUT / pid).glob("take*.reserved") if time.time() - r.stat().st_mtime < 7200]
        n = max(used, default=0) + 1
        # reserve the number with a placeholder so parallel takes of one plate do not collide
        (OUT / pid).mkdir(parents=True, exist_ok=True)
        (OUT / pid / f"take{n}.reserved").write_text(str(time.time()))
        return n


def sheet(mp4, n=8, cols=4, w=480):
    from review_sheets import video_sheet
    return video_sheet(mp4, mp4.with_suffix(".sheet.jpg"), n=n, cols=cols, w=w)


def write_take_meta(pid, n, spec, model, inp, ainfo, job, secs, cost, paths):
    mp4 = OUT / pid / f"take{n}.mp4"
    meta = {"plate": pid, "take": n, "model": model, "job": job, "secs": secs, "est_cost_usd": cost,
            "duration_s": cfai.probe_duration(mp4) if mp4.exists() else None, "audio_refs": ainfo,
            "spec": {k: v for k, v in spec.items()}, "request": cfai.strip_blobs(inp),
            "t": time.strftime("%Y-%m-%dT%H:%M:%S")}
    (OUT / pid / f"take{n}.json").write_text(json.dumps(meta, indent=1))
    (OUT / pid / f"take{n}.reserved").unlink(missing_ok=True)
    try:
        sheet(mp4)
    except Exception as e:
        print(f"[plate] {pid}: sheet failed: {e}", flush=True)


def run_take(pid, spec, refs):
    model, inp, ainfo = build_input(pid, spec, refs)
    n = next_take(pid)
    out = OUT / pid / f"take{n}.mp4"
    t0 = time.time()
    extra = {"plate": pid, "take": n}
    try:
        for attempt in range(3):
            try:
                paths, rec = cfai.gen(model, inp, out, tag=f"plate:{pid}", extra=extra, timeout=3600)
                break
            except cfai.CFError as e:
                msg = str(e)
                if "PrivacyInformation" in msg and not inp.get("use_virtual_avatar"):
                    print(f"[plate] {pid}: real-person filter; retrying with use_virtual_avatar", flush=True)
                    inp["use_virtual_avatar"] = True
                    continue
                if "timed out" in msg.lower() and attempt < 2:
                    print(f"[plate] {pid}: gateway timeout; resubmitting", flush=True)
                    continue
                raise
        else:
            raise cfai.CFError("retries exhausted")
    except Exception as e:
        (OUT / pid / f"take{n}.reserved").unlink(missing_ok=True)
        return pid, None, f"ERR {str(e)[:400]}"
    secs = round(time.time() - t0, 1)
    real = pathlib.Path(paths[0]) if paths else out
    if real != out and real.exists():
        real.rename(out)
    cost = cfai.est_cost(model, inp, rec, [out])
    write_take_meta(pid, n, spec, model, inp, ainfo, None, secs, cost, [out])
    return pid, str(out), f"ok take{n} {secs:.0f}s ~${cost}"


def collect(specs_refs):
    refs, plates = specs_refs
    for j in cfai.pending():
        ex = (j.get("meta", {}).get("extra") or {})
        pid, n = ex.get("plate"), ex.get("take")
        if not pid:
            continue
        paths, rec = cfai.collect(j["job"])
        if rec is None:
            print(f"[plate] {pid} take{n}: still running ({j['job']})")
            continue
        out = OUT / pid / f"take{n}.mp4"
        if paths and pathlib.Path(paths[0]) != out:
            pathlib.Path(paths[0]).rename(out)
        spec = plates.get(pid, {})
        write_take_meta(pid, n, spec, j["model"], j.get("input", {}), [], j["job"], round(time.time() - j["t_submit"]),
                        cfai.est_cost(j["model"], j.get("input", {}), rec, [out]), [out])
        print(f"[plate] {pid} take{n}: collected -> {out}")


def main(argv):
    pos = [a for a in argv if not a.startswith("--")]
    kw = {a[2:].split("=", 1)[0]: (a.split("=", 1)[1] if "=" in a else True) for a in argv if a.startswith("--")}
    refs, plates = load_specs(kw.get("specs"))
    if kw.get("collect"):
        return collect((refs, plates))
    if kw.get("list"):
        for k, v in plates.items():
            m = v.get("model", DEFAULT_MODEL)
            est = cfai.est_cost(m, cfai.apply_defaults(m, {"duration": v.get("duration", 5), "resolution": v.get("resolution", "720p"),
                                                       **({"reference_videos": [1]} if v.get("ref_videos") else {})}))
            au = v.get("audio")
            au = au if isinstance(au, list) else [au] if au else []
            print(f"{k:24s} {v.get('duration', 5):>3}s {v.get('resolution', '720p'):>5} refs={len(v.get('refs', []))} "
                  f"audio={'+'.join(str(a.get('t0')) if isinstance(a, dict) else 'file' for a in au) or '-':>8} "
                  f"takes={len(takes(k))}/{v.get('takes', 1)} ~${est}/take{'  (example)' if v.get('example') else ''}  {v['prompt'][:60]}")
        return
    if pos:
        missing = [p for p in pos if p not in plates]
        if missing:
            raise SystemExit(f"unknown plate ids: {missing}")
        jobs = [(p, int(kw.get("takes", 1))) for p in pos]
    else:
        jobs = [(k, v.get("takes", 1) - len(takes(k)) - len(pending_for(k))) for k, v in plates.items() if not v.get("example")]
        jobs = [(k, n) for k, n in jobs if n > 0]
    if not jobs:
        print("nothing to generate")
        return
    todo = [p for p, n in jobs for _ in range(n)]
    total = 0.0
    for p in todo:
        m, inp, _ = build_input(p, plates[p], refs)
        cfai.validate(m, inp)
        total += cfai.est_cost(m, inp) or 0
        if kw.get("dry"):
            print(json.dumps({"plate": p, "model": m, "input": cfai.strip_blobs(inp), "est_cost_usd": cfai.est_cost(m, inp)}, indent=1))
    budget = float(kw.get("budget") or os.environ.get("PLATE_BUDGET", 30))
    print(f"{len(todo)} take(s): {todo}  estimated ${total:.2f} (budget ${budget:.2f})")
    if kw.get("dry"):
        return
    if total > budget and not kw.get("yes"):
        raise SystemExit(f"estimated ${total:.2f} exceeds the budget; pass --budget=... or --yes")
    par = int(kw.get("par") or os.environ.get("PLATE_PAR", 4))
    with cf.ThreadPoolExecutor(par) as ex:
        futs = [ex.submit(run_take, p, plates[p], refs) for p in todo]
        for f in cf.as_completed(futs):
            pid, path, status = f.result()
            print(f"[plate] {pid}: {status} {path or ''}", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:])
