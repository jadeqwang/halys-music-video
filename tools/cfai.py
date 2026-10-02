"""Client for Cloudflare's unified AI API (POST /accounts/<acc>/ai/run), as reachable from this sandbox.

Facts this client is built around (measured 2026-10-02, see production/TOOLING.md):
  * Only api.cloudflare.com is reachable (plus pypi/npm/GitHub/storage.googleapis.com). The agent proxy
    injects the account's API token, so requests carry no Authorization header.
  * Synchronous /ai/run calls from the sandbox are cut at ~30 s. Long jobs (video, music, Pro images)
    therefore run in the background: options.background=true + webhookUrl pointing at the relay Worker
    (tools/relay/), which stores the webhook body in KV as res:<job> and mirrors the output files into
    KV (index mir:<job>, data media:<job>:<i>[:<chunk>]), because provider output hosts (BytePlus/volces
    for Seedance, x.ai, elevenlabs) and *.workers.dev are blocked from here. We read KV through the API.
  * Every paid call is appended to media/genlog.jsonl (one JSON line: t, tag, model, input minus blobs,
    out, secs, est_cost_usd, ...). Background jobs are also tracked in media/jobs/<job>.json until their
    outputs are saved, so a crashed session can finish them with `cfai.py collect`.

Python:
    import cfai
    paths, rec = cfai.gen("google/nano-banana-2", {"prompt": "...", "resolution": "1K"}, "media/tests/x.jpg", tag="test")
    job = cfai.submit("bytedance/seedance-2.5", inp, tag="plate:x", out="media/plates/x/take1.mp4")
    paths, rec = cfai.collect(job)                # later / from another process

CLI:
    python3 tools/cfai.py gen MODEL OUT '{"prompt": "..."}' [--tag=T] [--mode=bg|sync] [--dry] [--no-validate]
    python3 tools/cfai.py collect [JOB ...]       # finish pending background jobs (all of media/jobs/ by default)
    python3 tools/cfai.py jobs                    # list pending background jobs and their state
    python3 tools/cfai.py schema MODEL            # input schema (cached in tools/cf_schemas/)
    python3 tools/cfai.py catalog [--refresh] [--task=Text-to-Video] [--q=seedance]
    python3 tools/cfai.py cost [--since=2026-10-01]   # spend so far from media/genlog.jsonl
"""
import base64, hashlib, json, mimetypes, os, pathlib, re, secrets, subprocess, sys, threading, time
import urllib.error, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
LOG = ROOT / "media" / "genlog.jsonl"
JOBS = ROOT / "media" / "jobs"
SCHEMAS = TOOLS / "cf_schemas"
RELAY = json.loads((TOOLS / "relay" / "relay.json").read_text())
ACC = os.environ.get("CF_ACCOUNT_ID", RELAY.get("account", "78885e7db58a4c34423a7e62c8471b75"))
API = f"https://api.cloudflare.com/client/v4/accounts/{ACC}"
RUN = API + "/ai/run"
KV = f"{API}/storage/kv/namespaces/{RELAY['kv_namespace']}/values/"
SYNC_CUTOFF = 28            # seconds; the sandbox cuts synchronous requests at ~30 s
DIRECT_HOSTS = ("storage.googleapis.com", ".r2.cloudflarestorage.com")   # output hosts downloadable from here
# (AI Gateway hands Google/ElevenLabs outputs out as R2 presigned URLs: direct; Seedance (volces.com) and
#  x.ai URLs are blocked: those come from the relay's KV mirror)


def log(msg):
    print(f"[cfai] {msg}", file=sys.stderr, flush=True)


# ---------------------------------------------------------------- HTTP / KV
def http(method, url, body=None, headers=None, timeout=60):
    """-> (status, bytes). HTTP errors are returned, network errors raise."""
    h = dict(headers or {})
    data = None
    if body is not None:
        if isinstance(body, (bytes, bytearray)):
            data = bytes(body)
        else:
            data = json.dumps(body).encode()
            h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def jhttp(method, url, body=None, timeout=60):
    st, b = http(method, url, body, timeout=timeout)
    try:
        return st, json.loads(b.decode() or "null")
    except Exception:
        return st, {"success": False, "errors": [{"message": f"HTTP {st}: {b[:300]!r}"}]}


def kv_get(key, timeout=300):
    st, b = http("GET", KV + urllib.parse.quote(key, safe=""), timeout=timeout)
    if st == 404:
        return None
    if st != 200:
        raise RuntimeError(f"KV get {key}: HTTP {st} {b[:200]!r}")
    return b


def kv_put(key, value, ttl=None):
    q = f"?expiration_ttl={int(ttl)}" if ttl else ""
    st, b = http("PUT", KV + urllib.parse.quote(key, safe="") + q, value if isinstance(value, bytes) else str(value).encode(),
                 headers={"Content-Type": "application/octet-stream"})
    if st != 200:
        raise RuntimeError(f"KV put {key}: HTTP {st} {b[:200]!r}")


_SECRET = None


def hook_secret():
    global _SECRET
    if _SECRET is None:
        v = kv_get(RELAY["secret_kv_key"])
        if not v:
            raise RuntimeError("relay hook secret missing from KV; run: python3 tools/relay/relay.py rotate-secret")
        _SECRET = v.decode().strip()
    return _SECRET


# ---------------------------------------------------------------- inputs
def sniff_ext(b):
    if b[:3] == b"\xff\xd8\xff": return ".jpg"
    if b[:8] == b"\x89PNG\r\n\x1a\n": return ".png"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP": return ".webp"
    if b[:4] == b"RIFF" and b[8:12] == b"WAVE": return ".wav"
    if b[4:8] == b"ftyp": return ".mov" if b[8:10] == b"qt" else ".mp4"
    if b[:3] == b"ID3" or (len(b) > 1 and b[0] == 0xFF and (b[1] & 0xE0) == 0xE0): return ".mp3"
    if b[:4] == b"OggS": return ".ogg"
    if b[:4] == b"fLaC": return ".flac"
    return ""


MIME = {".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".flac": "audio/flac",
        ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


def data_uri(path):
    """File -> data: URI (MIME from the real bytes, not the name)."""
    b = pathlib.Path(path).read_bytes()
    ext = sniff_ext(b) or pathlib.Path(path).suffix.lower()
    mime = MIME.get(ext) or mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return f"data:{mime};base64," + base64.b64encode(b).decode()


def image_ref(path, max_side=2048, max_aspect=2.4, quality=92, bg=(255, 255, 255)):
    """Prepare a reference image: RGB (alpha flattened on `bg`), longest side <= max_side, padded so that
    w/h stays within [1/max_aspect, max_aspect] (Seedance rejects references wider than ~2.5:1),
    JPEG-encoded. Returns a data URI. Cached by (path, mtime, params)."""
    from PIL import Image
    import io
    p = pathlib.Path(path)
    key = hashlib.md5(f"{p.resolve()}|{p.stat().st_mtime}|{max_side}|{max_aspect}|{quality}|{bg}".encode()).hexdigest()
    cache = ROOT / "media" / "tmp" / "refs" / f"{key}.jpg"
    if not cache.exists():
        im = Image.open(p)
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            base = Image.new("RGB", im.size, bg)
            base.paste(im, mask=im.split()[-1])
            im = base
        else:
            im = im.convert("RGB")
        w, h = im.size
        if w / h > max_aspect or h / w > max_aspect:
            W, H = (w, int(round(w / max_aspect))) if w > h else (int(round(h / max_aspect)), h)
            canvas = Image.new("RGB", (W, H), bg)
            canvas.paste(im, ((W - w) // 2, (H - h) // 2))
            im = canvas
        s = min(1.0, max_side / max(im.size))
        if s < 1:
            im = im.resize((round(im.size[0] * s), round(im.size[1] * s)), Image.LANCZOS)
        cache.parent.mkdir(parents=True, exist_ok=True)
        im.save(cache, quality=quality)
    return data_uri(cache)


def audio_slice(src, t0, dur, out, sr=48000, kbps=192, fade=0.02):
    """Cut [t0, t0+dur) of an audio file to a stereo MP3 (tiny fades so the cut does not click)."""
    out = pathlib.Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    af = f"afade=t=in:d={fade},afade=t=out:st={max(0.0, dur - fade):.3f}:d={fade}"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t0:.3f}", "-t", f"{dur:.3f}", "-i", str(src),
                    "-af", af, "-ac", "2", "-ar", str(sr), "-b:a", f"{kbps}k", str(out)], check=True)
    return out


def probe_duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return None


def strip_blobs(o):
    """Inputs as logged: base64 blobs shortened to their MIME type and size."""
    if isinstance(o, dict):
        return {k: strip_blobs(v) for k, v in o.items()}
    if isinstance(o, list):
        return [strip_blobs(v) for v in o]
    if isinstance(o, str) and o.startswith("data:"):
        return f"{o[:o.find(',')][:40]}...({len(o) // 1024} KB)"
    if isinstance(o, str) and len(o) > 4000:
        return o[:200] + f"...({len(o)} chars)"
    return o


# ---------------------------------------------------------------- catalog / schemas / validation
def catalog(refresh=False):
    """The unified model catalog (GET /ai/catalog/models, paginated), cached in tools/cf_schemas/catalog.json."""
    cache = SCHEMAS / "catalog.json"
    if cache.exists() and not refresh:
        return json.loads(cache.read_text())
    out, page = [], 1
    while True:
        st, d = jhttp("GET", f"{API}/ai/catalog/models?page={page}&per_page=50", timeout=120)
        rows = (d or {}).get("result") or []
        out += rows
        info = (d or {}).get("result_info") or {}
        if not rows or len(out) >= info.get("total_count", 0):
            break
        page += 1
    slim = [{k: m.get(k) for k in ("model_id", "name", "task", "pricing", "metadata", "supports_async", "description")} for m in out]
    SCHEMAS.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(slim, indent=1))
    return slim


def schema(model, refresh=False):
    """Input/output JSON schema of a model: partner models from /ai/catalog/models/<id>/schema,
    Workers AI (@cf/...) models from /ai/models/schema?model=..."""
    cache = SCHEMAS / (model.replace("/", "__").replace("@", "") + ".json")
    if cache.exists() and not refresh:
        return json.loads(cache.read_text())
    if model.startswith("@cf/"):
        st, d = jhttp("GET", f"{API}/ai/models/schema?model={urllib.parse.quote(model, safe='@/')}")
        sch = (d or {}).get("result")
    else:
        st, d = jhttp("GET", f"{API}/ai/catalog/models/{model}/schema")
        sch = ((d or {}).get("result") or {}).get("schema")
    if not sch:
        raise KeyError(f"no schema for {model}: {json.dumps(d)[:300]}")
    SCHEMAS.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(sch, indent=1))
    return sch


def validate(model, inp):
    """Check an input against the model's schema before paying for it. Raises ValueError."""
    try:
        sch = schema(model)
    except Exception as e:
        log(f"no schema for {model} ({e}); not validated")
        return
    try:
        import jsonschema
    except ImportError:
        return
    s = dict(sch.get("input") or {})
    s.pop("required", None)          # 'required' lists fields that have defaults server-side; do not insist
    errs = sorted(jsonschema.Draft202012Validator(s).iter_errors(inp), key=lambda e: list(e.path))
    if errs:
        raise ValueError(f"{model} input invalid: " + "; ".join(f"{'/'.join(map(str, e.path)) or '(root)'}: {e.message[:200]}" for e in errs[:6]))


def apply_defaults(model, inp):
    inp = dict(inp)
    if model.startswith("bytedance/seedance-2"):
        # fields the schema lists as required (all have documented defaults); explicit is safer
        inp.setdefault("duration", 5)
        inp.setdefault("resolution", "720p")
        inp.setdefault("aspect_ratio", "16:9")
        inp.setdefault("fps", 24)
        inp.setdefault("camera_fixed", False)
        inp.setdefault("watermark", False)
        if model == "bytedance/seedance-2.5":
            inp.setdefault("output_format", "mp4")
        inp.setdefault("use_virtual_avatar", False)
    if model.startswith("xai/grok-imagine-image"):
        inp.setdefault("response_format", "b64_json")   # x.ai URLs are unreachable from the sandbox; b64 needs no mirror
    return inp


# ---------------------------------------------------------------- prices (USD, from the catalog, 2026-10-02)
NB_OUT_TOKENS = {"1K": 1120, "2K": 1680, "4K": 2520}          # Gemini 3.x Flash Image (Nano Banana 2 / 2-lite)
NBP_OUT_TOKENS = {"1K": 1120, "2K": 1120, "4K": 2000}         # Gemini 3 Pro Image (Nano Banana Pro)
SEEDANCE = {  # $/s of output video: (no video input, with reference_videos)
    "bytedance/seedance-2.5": {"480p": (0.1028, 0.4304), "720p": (0.2312, 0.9676)},
    "bytedance/seedance-2.0": {"480p": (0.15, 0.172), "720p": (0.15, 0.372), "1080p": (0.15, 0.914)},
    "bytedance/seedance-2.0-fast": {"480p": (0.06, 0.132), "720p": (0.12, 0.286)},
    "bytedance/seedance-2.0-mini": {"480p": (0.04, 0.084), "720p": (0.09, 0.182)},
}
PER_IMAGE = {"xai/grok-imagine-image": (0.02, 0.002), "xai/grok-imagine-image-2.0": (0.04, 0.01),
             "xai/grok-imagine-image-quality": (0.05, 0.01), "black-forest-labs/flux-1-kontext-pro": (0.04, 0),
             "black-forest-labs/flux-1-kontext-max": (0.08, 0), "bytedance/seedream-5-pro": (0.045, 0.03),
             "pruna/p-image": (0.005, 0), "pruna/p-image-edit": (0.01, 0)}
PER_SECOND = {"xai/grok-imagine-video": {"480p": 0.05, "720p": 0.07}, "xai/grok-imagine-video-1.5-preview": {"480p": 0.08, "720p": 0.14},
              "google/veo-3.1-fast": {"720p": 0.08, "1080p": 0.10}, "elevenlabs/music-v2": {"": 0.0025}}
PER_CHAR = {"elevenlabs/eleven-v3": 0.0001, "elevenlabs/eleven-multilingual-v2": 0.0001, "elevenlabs/eleven-flash-v2-5": 0.00005,
            "elevenlabs/eleven-turbo-v2-5": 0.00005, "xai/grok-tts": 0.000015, "openai/tts-1": 0.000015}
PER_AUDIO_MIN = {"@cf/openai/whisper-large-v3-turbo": 0.000513, "@cf/openai/whisper": 0.000453, "xai/grok-stt": 0.001667,
                 "openai/gpt-4o-transcribe": 0.006, "assemblyai/universal-3.5-pro": 0.0035}


def _count_refs(inp):
    n = 0
    for k in ("image", "last_frame_image", "mask"):
        n += 1 if inp.get(k) else 0
    for k in ("image_input", "images", "reference_images", "input_images"):
        n += len(inp.get(k) or [])
    return n


def est_cost(model, inp, rec=None, paths=()):
    """Best-effort USD estimate from the catalog prices (None when unknown)."""
    try:
        res = (rec or {}).get("result") if isinstance(rec, dict) else None
        if model in SEEDANCE:
            dur = inp.get("duration", 5)
            if dur == -1 or rec:
                for p in paths:
                    d = probe_duration(p) if str(p).endswith((".mp4", ".mov")) else None
                    if d:
                        dur = round(d)
            if dur == -1:
                return None
            rate = SEEDANCE[model].get(inp.get("resolution", "720p"))
            return round(dur * rate[1 if inp.get("reference_videos") or inp.get("reference_video") else 0], 4)
        if model in ("google/nano-banana-2", "google/nano-banana-2-lite", "google/nano-banana", "google/nano-banana-pro"):
            per_m_out = {"google/nano-banana-2": 60, "google/nano-banana-2-lite": 30, "google/nano-banana": 30, "google/nano-banana-pro": 120}[model]
            per_m_in = {"google/nano-banana-2": 0.5, "google/nano-banana-2-lite": 0.25, "google/nano-banana": 0.3, "google/nano-banana-pro": 2}[model]
            size = inp.get("image_size") or inp.get("resolution") or "1K"
            tok = (NBP_OUT_TOKENS if model.endswith("pro") else NB_OUT_TOKENS).get(size, 1290)
            u = (rec or {}).get("usage") or {}
            out_tok = u.get("output_tokens") or u.get("completion_tokens") or u.get("candidatesTokenCount") or tok
            in_tok = u.get("input_tokens") or u.get("prompt_tokens") or u.get("promptTokenCount") or (560 * _count_refs(inp) + len(inp.get("prompt", "")) // 4)
            return round(out_tok * per_m_out / 1e6 + in_tok * per_m_in / 1e6, 4)
        if model in PER_IMAGE:
            per, per_in = PER_IMAGE[model]
            return round(per * inp.get("n", 1) + per_in * _count_refs(inp), 4)
        if model in PER_SECOND:
            rates = PER_SECOND[model]
            if model == "elevenlabs/music-v2":
                dur = (inp.get("music_length_ms") or 30000) / 1000
                for p in paths:
                    dur = probe_duration(p) or dur
                return round(dur * rates[""], 4)
            return round(inp.get("duration", 5) * rates.get(inp.get("resolution", "480p"), max(rates.values())), 4)
        if model in PER_CHAR:
            return round(len(inp.get("text", "")) * PER_CHAR[model], 5)
        if model in PER_AUDIO_MIN:
            dur = (res or {}).get("transcription_info", {}).get("duration") if isinstance(res, dict) else None
            return round((dur or 60) / 60 * PER_AUDIO_MIN[model], 6)
        if model == "pruna/p-image-upscale":
            mp = inp.get("target", 4)
            return next(p for lim, p in ((4, .005), (8, .01), (16, .02), (32, .04), (64, .06), (128, .12)) if mp <= lim)
        if model == "black-forest-labs/flux-video-upscale":
            return None   # $0.07 (precise) / $0.10 (creative) per output megapixel-second
    except Exception as e:
        log(f"cost estimate failed for {model}: {e}")
    return None


# ---------------------------------------------------------------- running
class CFError(RuntimeError):
    pass


def _errmsg(d):
    return json.dumps((d or {}).get("errors") or d)[:800]


RETRYABLE = (429, 500, 502, 503, 504)


def _parse(b):
    try:
        return json.loads(b.decode() or "null")
    except Exception:
        return None


def run_sync(model, inp, timeout=SYNC_CUTOFF + 7, retries=2):
    """Synchronous run. Partner models go through the /ai/run envelope; Workers AI (@cf/...) models use the
    model-in-path endpoint (the envelope would need a cf-aig-gateway-id header). Returns `result`.
    The sandbox cuts requests at ~30 s and answers with an EMPTY 200 body: that is never retried, because
    the run itself may still complete (and be billed) server-side."""
    url, body = (f"{RUN}/{model}", inp) if model.startswith("@cf/") else (RUN, {"model": model, "input": inp})
    last = None
    for attempt in range(retries + 1):
        t0 = time.time()
        try:
            st, b = http("POST", url, body, timeout=timeout)
        except Exception as e:      # our own timeout or a network error: outcome unknown, do not retry
            raise CFError(f"{model}: no response after {time.time() - t0:.0f}s ({e!r}); for long jobs use mode='bg'")
        dt, d = time.time() - t0, _parse(b)
        if isinstance(d, dict) and st == 200 and d.get("success", True) and "result" in d:
            return d["result"]
        if d is None:
            if dt > 25 or not b:
                raise CFError(f"{model}: response cut after {dt:.0f}s (the sandbox's ~30 s limit); use mode='bg'")
            last = f"HTTP {st} unparseable body {b[:200]!r}"
        else:
            last = f"HTTP {st} {_errmsg(d)}"
        log(f"{model} attempt {attempt + 1}: {last}")
        if st not in RETRYABLE or "User Input Error" in last:
            break
        time.sleep(4 * (attempt + 1))
    raise CFError(f"{model} failed: {last}")


def new_job_id(tag=""):
    slug = re.sub(r"[^A-Za-z0-9_.-]+", "-", tag).strip("-")[:60] or "job"
    return f"halys-{slug}-{time.strftime('%Y%m%d-%H%M%S')}-{secrets.token_hex(3)}"


def submit(model, inp, tag="", out=None, job_id=None, meta=None):
    """Start a background run; the relay stores its result in KV. Returns the job id (also recorded in
    media/jobs/<job>.json with everything collect() needs)."""
    job = job_id or new_job_id(tag)
    payload = {"model": model, "input": inp,
               "options": {"background": True, "webhookUrl": f"{RELAY['url']}/hook/{hook_secret()}/{job}"}}
    last = None
    for attempt in range(4):
        try:
            st, b = http("POST", RUN, payload, timeout=300)
        except Exception as e:
            # the request may or may not have been accepted: never blindly resubmit (that could pay twice)
            raise CFError(f"submit {model} {job}: no response ({e!r}); check `cfai.py collect {job}` before resubmitting")
        d = _parse(b)
        if d is None:
            raise CFError(f"submit {model} {job}: HTTP {st} with unparseable body {b[:200]!r}; outcome unknown, "
                          f"check `cfai.py collect {job}` before resubmitting")
        if st in (200, 201, 202) and d.get("success", True):
            break
        last = f"HTTP {st} {_errmsg(d)}"
        log(f"submit {model} attempt {attempt + 1}: {last}")
        if st not in RETRYABLE or "User Input Error" in last:
            raise CFError(f"submit {model} rejected: {last}")
        time.sleep(5 * (attempt + 1))
    else:
        raise CFError(f"submit {model} failed: {last}")
    JOBS.mkdir(parents=True, exist_ok=True)
    rec = {"job": job, "model": model, "tag": tag, "out": str(out) if out else None, "t_submit": time.time(),
           "submitted": time.strftime("%Y-%m-%dT%H:%M:%S"), "run": (d or {}).get("result"), "input": strip_blobs(inp),
           "est_cost_usd": est_cost(model, inp), "meta": meta or {}}
    (JOBS / f"{job}.json").write_text(json.dumps(rec, indent=1))
    log(f"submitted {model} as {job} (run {str(((d or {}).get('result') or {}).get('runId', '?'))[:16]})")
    return job


def poll(job):
    """The relay's record of a finished run (the webhook body), or None while it is still running."""
    b = kv_get("res:" + job)
    if not b:
        return None
    try:
        d = json.loads(b)
    except Exception:
        return {"state": "Unparseable", "raw": b[:500].decode(errors="replace")}
    return d if isinstance(d, dict) and d.get("state") else None


def wait(job, timeout=3600, every=6, quiet=False):
    t0 = time.time()
    n = 0
    while time.time() - t0 < timeout:
        rec = poll(job)
        if rec:
            return rec
        n += 1
        if not quiet and n % 10 == 0:
            log(f"waiting for {job}: {time.time() - t0:.0f}s")
        time.sleep(every)
    raise TimeoutError(f"{job} not finished after {timeout}s (still collectable later: cfai.py collect {job})")


def find_urls(o):
    if isinstance(o, dict):
        for v in o.values():
            yield from find_urls(v)
    elif isinstance(o, list):
        for v in o:
            yield from find_urls(v)
    elif isinstance(o, str) and o.startswith(("http://", "https://")):
        yield o


def find_b64(o, keys=("image", "images", "audio", "video", "b64_json", "data")):
    """Inline outputs: data: URIs anywhere, or long base64 strings under media-ish keys."""
    out = []
    def visit(v, k=None):
        if isinstance(v, dict):
            for kk, vv in v.items():
                visit(vv, kk)
        elif isinstance(v, list):
            for vv in v:
                visit(vv, k)
        elif isinstance(v, str):
            if v.startswith("data:") and ";base64," in v[:100]:
                out.append(v.split(",", 1)[1])
            elif k in keys and len(v) > 512 and re.fullmatch(r"[A-Za-z0-9+/=\s]+", v[:2048]):
                out.append(v)
    visit(o)
    return out


def direct_ok(url):
    h = urllib.parse.urlparse(url).hostname or ""
    return any(h == d or (d.startswith(".") and h.endswith(d)) for d in DIRECT_HOSTS)


def _download(url, timeout=600):
    st, b = http("GET", url, timeout=timeout)
    if st != 200:
        raise RuntimeError(f"GET {urllib.parse.urlparse(url).hostname}: HTTP {st}")
    return b


def _mirror_files(job, n_urls, timeout=900):
    """Reassemble the relay's KV copies of a job's output files (orbital relay format: mir:<job> index with
    {i, key, chunks, bytes, type} entries; data at media:<job>:<i>[:<chunk>])."""
    t0 = time.time()
    while time.time() - t0 < timeout:
        idx = kv_get("mir:" + job)
        if idx:
            idx = json.loads(idx)
            files = []
            for f in sorted(idx.get("files", []), key=lambda f: f.get("i", 0)):
                if f.get("error"):
                    raise RuntimeError(f"relay could not mirror output {f.get('i')} of {job}: {f['error']}")
                if f.get("chunks", 1) == 1:
                    data = kv_get(f["key"])
                else:
                    data = b"".join(kv_get(f"{f['key']}:{c}") for c in range(f["chunks"]))
                if data is None:
                    raise RuntimeError(f"mirror of {job} is missing {f['key']}")
                files.append(data)
            if n_urls and not files:
                raise RuntimeError(f"relay mirrored nothing for {job} (output host not in the Worker's allowlist?)")
            return files
        time.sleep(5)
    raise TimeoutError(f"relay mirror of {job} not ready after {timeout}s")


def save_outputs(job, rec, out):
    """Write a finished run's outputs next to `out` (out, out_1, out_2, ...; the extension follows the
    real file type). Inline base64 first, then direct download (reachable hosts), then the KV mirror."""
    res = rec.get("result")
    out = pathlib.Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    blobs = [base64.b64decode(b) for b in find_b64(res)]
    if not blobs:
        urls = list(dict.fromkeys(find_urls(res)))
        if urls and all(direct_ok(u) for u in urls):
            try:
                blobs = [_download(u) for u in urls]
            except Exception as e:
                if job is None:
                    raise
                log(f"direct download failed ({e}); using the relay mirror")
                blobs = _mirror_files(job, len(urls))
        elif urls:
            if job is None:
                blobs = []
                for u in urls:
                    try:
                        blobs.append(_download(u))
                    except Exception as e:
                        raise RuntimeError(f"sync result {u[:80]} not downloadable from the sandbox ({e}); use mode='bg'")
            else:
                blobs = _mirror_files(job, len(urls))
    paths = []
    for i, b in enumerate(blobs):
        ext = sniff_ext(b) or out.suffix or ".bin"
        p = out.with_name(out.stem + (f"_{i}" if i else "") + ext)
        p.write_bytes(b)
        paths.append(str(p))
    if not paths and isinstance(res, (dict, list, str)):   # text / JSON results (e.g. transcripts)
        p = out if out.suffix == ".json" else out.with_suffix(".json")
        p.write_text(json.dumps(res, indent=1) if not isinstance(res, str) else res)
        paths.append(str(p))
    return paths


_LOG_LOCK = threading.Lock()


def _genlog(entry):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with _LOG_LOCK, open(LOG, "a") as f:
        f.write(json.dumps(entry) + "\n")


def _rel(p):
    try:
        return os.path.relpath(p, ROOT)
    except ValueError:
        return str(p)


def finish(job, rec, out, model, inp_logged, tag, t_start, inp_for_cost=None, extra=None):
    ok = rec.get("state") == "Completed"
    paths = save_outputs(job, rec, out) if ok else []
    secs = round(time.time() - t_start, 1)
    cost = est_cost(model, inp_for_cost or {}, rec, paths) if ok else 0.0
    entry = {"t": time.strftime("%Y-%m-%dT%H:%M:%S"), "tag": tag, "model": model, "input": inp_logged,
             "out": [_rel(p) for p in paths], "secs": secs, "est_cost_usd": cost}
    if job:
        entry["job"] = job
    if rec.get("usage"):
        entry["usage"] = rec["usage"]
    if not ok:
        entry["error"] = json.dumps(rec.get("error") or rec)[:600]
        entry["state"] = rec.get("state")
    entry.update(extra or {})
    _genlog(entry)
    if job and (JOBS / f"{job}.json").exists():
        (JOBS / f"{job}.json").unlink()
    if not ok:
        raise CFError(f"{model} {job or ''} ended {rec.get('state')}: {entry['error']}")
    log(f"{model} -> {[_rel(p) for p in paths]} ({secs}s, ~${cost})")
    return paths


def choose_mode(model, inp):
    """Workers AI models answer fast enough for a synchronous call; partner media models may take longer
    than the sandbox's ~30 s cutoff, so they run in the background."""
    return "sync" if model.startswith("@cf/") else "bg"


def gen(model, inp, out, tag="", mode="auto", timeout=None, check=True, dry=False, extra=None):
    """Run a model and save its outputs at/next to `out`. Returns (paths, record).
    mode: 'auto' | 'sync' | 'bg'. check: validate against the schema first. dry: print, do not run."""
    inp = apply_defaults(model, inp)
    if check:
        validate(model, inp)
    est = est_cost(model, inp)
    if dry:
        print(json.dumps({"model": model, "input": strip_blobs(inp), "out": str(out), "est_cost_usd": est}, indent=1))
        return [], None
    mode = choose_mode(model, inp) if mode == "auto" else mode
    t0 = time.time()
    if mode == "sync":
        try:
            res = run_sync(model, inp, timeout=timeout or SYNC_CUTOFF + 7)
        except CFError as e:
            _genlog({"t": time.strftime("%Y-%m-%dT%H:%M:%S"), "tag": tag, "model": model, "input": strip_blobs(inp), "out": [],
                     "secs": round(time.time() - t0, 1), "est_cost_usd": None, "mode": "sync", "error": str(e)[:600]})
            raise
        rec = {"state": "Completed", "result": res}
        return finish(None, rec, out, model, strip_blobs(inp), tag, t0, inp, {"mode": "sync", **(extra or {})}), rec
    job = submit(model, inp, tag=tag, out=out, meta={"extra": extra or {}})
    rec = wait(job, timeout=timeout or 3600)
    return finish(job, rec, out, model, strip_blobs(inp), tag, t0, inp, {"mode": "bg", **(extra or {})}), rec


def collect(job, out=None, timeout=0):
    """Finish a background job submitted earlier (possibly by another process). Returns (paths, record),
    or (None, None) if it is still running and timeout is 0."""
    jf = JOBS / f"{job}.json"
    meta = json.loads(jf.read_text()) if jf.exists() else {}
    out = out or meta.get("out") or str(ROOT / "media" / "tmp" / job)
    rec = wait(job, timeout=timeout) if timeout else poll(job)
    if not rec:
        return None, None
    # costs are estimated from the logged (blob-stripped) input: durations/resolutions survive stripping
    paths = finish(job, rec, out, meta.get("model", rec.get("model", "?")), meta.get("input", {}), meta.get("tag", ""),
                   meta.get("t_submit", time.time()), meta.get("input", {}), {"mode": "bg", "collected": True, **(meta.get("meta", {}).get("extra") or {})})
    return paths, rec


def pending():
    return sorted(json.loads(p.read_text()) for p in JOBS.glob("*.json")) if JOBS.exists() else []


def spend(since=None):
    tot, rows = 0.0, {}
    if LOG.exists():
        for line in LOG.read_text().splitlines():
            try:
                r = json.loads(line)
            except Exception:
                continue
            if since and r.get("t", "") < since:
                continue
            c = r.get("est_cost_usd") or 0
            tot += c
            m = rows.setdefault(r.get("model", "?"), [0, 0.0, 0.0])
            m[0] += 1; m[1] += c; m[2] += r.get("secs") or 0
    return tot, rows


# ---------------------------------------------------------------- CLI
def _args(argv):
    pos, kw = [], {}
    for a in argv:
        if a.startswith("--"):
            k, _, v = a[2:].partition("=")
            kw[k] = v if _ else True
        else:
            pos.append(a)
    return pos, kw


def main(argv):
    pos, kw = _args(argv)
    cmd = pos[0] if pos else "help"
    if cmd == "gen":
        model, out, inp = pos[1], pos[2], json.loads(pos[3])
        paths, _ = gen(model, inp, out, tag=kw.get("tag", ""), mode=kw.get("mode", "auto"), check=not kw.get("no-validate"),
                       dry=bool(kw.get("dry")), timeout=float(kw["timeout"]) if "timeout" in kw else None)
        print("\n".join(paths))
    elif cmd == "collect":
        ids = pos[1:] or [j["job"] for j in pending()]
        for j in ids:
            try:
                paths, rec = collect(j, timeout=float(kw.get("wait", 0)))
                print(j, "still running" if rec is None else paths)
            except Exception as e:
                print(j, "ERROR", e)
    elif cmd == "jobs":
        for j in pending():
            rec = poll(j["job"])
            print(f"{j['job']:60s} {j['model']:28s} {j['submitted']}  {'running' if rec is None else rec.get('state')}  -> {j.get('out')}")
    elif cmd == "schema":
        print(json.dumps(schema(pos[1], refresh=bool(kw.get("refresh"))), indent=1))
    elif cmd == "catalog":
        rows = catalog(refresh=bool(kw.get("refresh")))
        for m in rows:
            if kw.get("task") and m["task"].lower() != str(kw["task"]).lower():
                continue
            if kw.get("q") and str(kw["q"]).lower() not in m["model_id"].lower():
                continue
            print(f"{m['model_id']:44s} {m['task']:28s} {json.dumps(m.get('pricing'))[:110]}")
    elif cmd == "cost":
        tot, rows = spend(kw.get("since"))
        for m, (n, c, s) in sorted(rows.items(), key=lambda x: -x[1][1]):
            print(f"{m:40s} {n:4d} runs  ${c:8.3f}  {s / max(n, 1):6.0f} s avg")
        print(f"{'total':40s}            ${tot:8.3f}")
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
