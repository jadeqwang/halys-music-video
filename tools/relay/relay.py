"""Deploy and inspect the relay Worker that background /ai/run jobs report to (see worker.js for why it exists).

    python3 tools/relay/relay.py status                     # config, bindings, schedule, secret present?
    python3 tools/relay/relay.py deploy [--name=halys-relay] [--kv-title=halys-jobs]
    python3 tools/relay/relay.py rotate-secret              # new HOOK_SECRET (worker + KV copy)

deploy is idempotent: it finds or creates the KV namespace by title, keeps the existing hook secret (read
from KV) so in-flight jobs still land, uploads worker.js with bindings JOBS (KV) and HOOK_SECRET
(secret_text), sets the cron schedule, enables the workers.dev route and rewrites relay.json.

The hook secret is stored twice: as the Worker's secret_text binding (what the Worker checks) and in the
relay's own KV namespace under "cfg:hook_secret", where tools/cfai.py reads it through the API. That way a
new sandbox session never loses it (the previous projects kept it in /tmp and lost it with the container).
All calls go to api.cloudflare.com with the token the agent proxy injects.
"""
import json, pathlib, secrets, sys, urllib.parse, uuid

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import cfai  # noqa: E402

CFG_PATH = HERE / "relay.json"
COMPAT = "2026-09-01"
CRON = "*/10 * * * *"
SECRET_KEY = "cfg:hook_secret"


def api(method, path, body=None, raw=None, headers=None, timeout=120):
    url = f"https://api.cloudflare.com/client/v4/accounts/{cfai.ACC}{path}"
    st, b = cfai.http(method, url, raw if raw is not None else body, headers=headers, timeout=timeout)
    try:
        d = json.loads(b.decode() or "null")
    except Exception:
        d = {"raw": b[:300].decode(errors="replace")}
    return st, d


def find_or_create_kv(title):
    page = 1
    while True:
        st, d = api("GET", f"/storage/kv/namespaces?per_page=100&page={page}")
        rows = (d or {}).get("result") or []
        for ns in rows:
            if ns.get("title") == title:
                return ns["id"], False
        if len(rows) < 100:
            break
        page += 1
    st, d = api("POST", "/storage/kv/namespaces", {"title": title})
    if not (d or {}).get("success"):
        raise SystemExit(f"could not create KV namespace {title}: {d}")
    return d["result"]["id"], True


def kv_get(ns, key):
    st, b = cfai.http("GET", f"https://api.cloudflare.com/client/v4/accounts/{cfai.ACC}/storage/kv/namespaces/{ns}/values/{urllib.parse.quote(key, safe='')}")
    return b.decode().strip() if st == 200 else None


def kv_put(ns, key, value):
    st, b = cfai.http("PUT", f"https://api.cloudflare.com/client/v4/accounts/{cfai.ACC}/storage/kv/namespaces/{ns}/values/{urllib.parse.quote(key, safe='')}",
                      value.encode(), headers={"Content-Type": "text/plain"})
    if st != 200:
        raise SystemExit(f"KV put failed: {st} {b[:200]!r}")


def upload_script(name, code, bindings):
    boundary = "----halys" + uuid.uuid4().hex
    meta = {"main_module": "worker.js", "compatibility_date": COMPAT, "bindings": bindings}
    parts = [
        (f'Content-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n', json.dumps(meta).encode()),
        (f'Content-Disposition: form-data; name="worker.js"; filename="worker.js"\r\nContent-Type: application/javascript+module\r\n\r\n', code.encode()),
    ]
    body = b""
    for head, data in parts:
        body += f"--{boundary}\r\n".encode() + head.encode() + data + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    st, d = api("PUT", f"/workers/scripts/{name}", raw=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    if not (d or {}).get("success"):
        raise SystemExit(f"script upload failed: HTTP {st} {json.dumps(d)[:800]}")
    return d["result"]


def subdomain():
    st, d = api("GET", "/workers/subdomain")
    return ((d or {}).get("result") or {}).get("subdomain")


def deploy(name, kv_title):
    ns, created = find_or_create_kv(kv_title)
    print(f"KV namespace {kv_title}: {ns} ({'created' if created else 'exists'})")
    secret = kv_get(ns, SECRET_KEY) or secrets.token_urlsafe(32)
    kv_put(ns, SECRET_KEY, secret)
    code = (HERE / "worker.js").read_text()
    bindings = [{"type": "kv_namespace", "name": "JOBS", "namespace_id": ns},
                {"type": "secret_text", "name": "HOOK_SECRET", "text": secret}]
    r = upload_script(name, code, bindings)
    print(f"uploaded {name} (etag {str(r.get('etag', ''))[:12]})")
    st, d = api("PUT", f"/workers/scripts/{name}/schedules", [{"cron": CRON}])
    print(f"schedule {CRON}: {'ok' if (d or {}).get('success') else d}")
    st, d = api("POST", f"/workers/scripts/{name}/subdomain", {"enabled": True, "previews_enabled": False})
    print(f"workers.dev route: {'ok' if (d or {}).get('success') else d}")
    sub = subdomain()
    cfg = {"_comment": json.loads(CFG_PATH.read_text()).get("_comment") if CFG_PATH.exists() else "",
           "account": cfai.ACC, "worker": name, "url": f"https://{name}.{sub}.workers.dev", "kv_namespace": ns,
           "secret_kv_key": SECRET_KEY, "source": "tools/relay/worker.js"}
    CFG_PATH.write_text(json.dumps(cfg, indent=2) + "\n")
    print(f"wrote {CFG_PATH.relative_to(cfai.ROOT)}: {cfg['url']}")


def rotate_secret():
    cfg = json.loads(CFG_PATH.read_text())
    secret = secrets.token_urlsafe(32)
    st, d = api("PUT", f"/workers/scripts/{cfg['worker']}/secrets", {"name": "HOOK_SECRET", "text": secret, "type": "secret_text"})
    if not (d or {}).get("success"):
        raise SystemExit(f"secret update failed: {d}")
    kv_put(cfg["kv_namespace"], SECRET_KEY, secret)
    print(f"rotated HOOK_SECRET of {cfg['worker']} (copy in KV {SECRET_KEY}); jobs submitted with the old secret will not report")


def status():
    cfg = json.loads(CFG_PATH.read_text())
    print(json.dumps({k: v for k, v in cfg.items() if not k.startswith("_")}, indent=1))
    st, d = api("GET", f"/workers/scripts/{cfg['worker']}/settings")
    r = (d or {}).get("result") or {}
    print("bindings:", [(b.get("type"), b.get("name")) for b in r.get("bindings", [])], "compat:", r.get("compatibility_date"))
    st, d = api("GET", f"/workers/scripts/{cfg['worker']}/schedules")
    print("schedules:", [s.get("cron") for s in ((d or {}).get("result") or {}).get("schedules", [])])
    print("secret in KV:", bool(kv_get(cfg["kv_namespace"], cfg["secret_kv_key"])))
    st, d = api("GET", f"/storage/kv/namespaces/{cfg['kv_namespace']}/keys?limit=1000")
    keys = [k["name"] for k in (d or {}).get("result") or []]
    print(f"KV keys: {len(keys)} (res: {sum(k.startswith('res:') for k in keys)}, mir: {sum(k.startswith('mir:') for k in keys)}, "
          f"pend: {sum(k.startswith('pend:') for k in keys)})")


if __name__ == "__main__":
    pos = [a for a in sys.argv[1:] if not a.startswith("--")]
    kw = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
    cmd = pos[0] if pos else "status"
    if cmd == "deploy":
        deploy(kw.get("name", "halys-relay"), kw.get("kv-title", "halys-jobs"))
    elif cmd == "rotate-secret":
        rotate_secret()
    else:
        status()
