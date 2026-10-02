"""Whisper (Cloudflare Workers AI) on the vocal stem -> raw word timings.

Auth is injected by the session proxy for api.cloudflare.com (same approach as
orbital-sunrise-video/tools/cfai.py); the account id is looked up from /accounts.
Every call is appended to media/genlog.jsonl (t, tag, model, input minus blobs, out, secs).

usage:
  python tools/audio/whisper_cf.py media/stems/vocals_lead.wav full            # whole song
  python tools/audio/whisper_cf.py media/stems/vocals_lead.wav sec 6.0 52.0 "prompt words"   # one window
Raw responses land in tools/audio/whisper/<name>.json (times already offset to song time).
"""
import base64, json, os, pathlib, subprocess, sys, tempfile, time, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
LOG = ROOT / "media" / "genlog.jsonl"
OUT = ROOT / "tools" / "audio" / "whisper"
MODEL = "@cf/openai/whisper-large-v3-turbo"
API = "https://api.cloudflare.com/client/v4"


def account_id():
    with urllib.request.urlopen(API + "/accounts", timeout=30) as r:
        d = json.loads(r.read())
    return d["result"][0]["id"]


def encode_clip(src, t0=None, t1=None):
    """16 kHz mono MP3 (small enough for a JSON/base64 body)."""
    fd, tmp = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
    if t0 is not None:
        cmd += ["-ss", f"{t0:.3f}", "-to", f"{t1:.3f}"]
    cmd += ["-i", str(src), "-ac", "1", "-ar", "16000", "-b:a", "96k", tmp]
    subprocess.run(cmd, check=True)
    b = open(tmp, "rb").read()
    os.remove(tmp)
    return b


def run(src, name, t0=None, t1=None, prompt=None, extra=None):
    acc = account_id()
    audio = encode_clip(src, t0, t1)
    inp = {"audio": base64.b64encode(audio).decode(), "task": "transcribe", "language": "en",
           "condition_on_previous_text": False, "beam_size": 5}
    if prompt:
        inp["initial_prompt"] = prompt
    if extra:
        inp.update(extra)
    url = f"{API}/accounts/{acc}/ai/run/{MODEL}"
    body = json.dumps(inp).encode()
    t_start = time.time()
    res = None
    for attempt in range(3):
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                res = json.loads(r.read())
        except urllib.error.HTTPError as e:
            try:
                res = json.loads(e.read())
            except Exception:
                res = {"success": False, "errors": [{"message": f"HTTP {e.code}"}]}
        if res.get("success"):
            break
        print(f"[whisper] attempt {attempt + 1} failed: {json.dumps(res.get('errors'))[:400]}", file=sys.stderr)
        time.sleep(5 * (attempt + 1))
    dt = time.time() - t_start
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f"{name}.json"
    logged = {k: v for k, v in inp.items() if k != "audio"}
    logged["audio"] = f"<{os.path.relpath(src, ROOT)} {t0 if t0 is not None else 0:.2f}-{t1 if t1 is not None else 'end'} s, 16k mono mp3, {len(audio)} bytes>"
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG, "a") as f:  # log every paid call, before anything can fail
        f.write(json.dumps({"t": time.strftime("%Y-%m-%dT%H:%M:%S"), "tag": f"lyrics-align:{name}", "model": MODEL,
                            "input": logged, "out": [os.path.relpath(p, ROOT)] if res.get("success") else [],
                            "secs": round(dt, 1)}) + "\n")
    if not res.get("success"):
        raise RuntimeError(json.dumps(res)[:1000])
    out = res["result"]
    off = t0 or 0.0
    for s in out.get("segments") or []:  # shift to song time
        s["start"] = round(s["start"] + off, 3)
        s["end"] = round(s["end"] + off, 3)
        s["words"] = s.get("words") or []
        for w in s["words"]:
            w["start"] = round(w["start"] + off, 3)
            w["end"] = round(w["end"] + off, 3)
    out["_meta"] = {"src": os.path.relpath(src, ROOT), "t0": t0, "t1": t1, "prompt": prompt, "model": MODEL}
    p.write_text(json.dumps(out, indent=1))
    print(f"[whisper] {name}: {len(out.get('segments') or [])} segments ({dt:.1f}s) -> {p}")
    return out


if __name__ == "__main__":
    src, mode = sys.argv[1], sys.argv[2]
    if mode == "full":
        run(src, sys.argv[3] if len(sys.argv) > 3 else "full", prompt=sys.argv[4] if len(sys.argv) > 4 else None)
    else:
        t0, t1 = float(sys.argv[3]), float(sys.argv[4])
        run(src, sys.argv[6] if len(sys.argv) > 6 else f"win_{t0:07.2f}", t0, t1, prompt=sys.argv[5] if len(sys.argv) > 5 else None)
