// halys-relay: webhook sink + output mirror for background /ai/run jobs (Halys music video).
//
// Why: the build sandbox reaches only api.cloudflare.com, cuts synchronous requests at ~30 s, and cannot
// download from provider output hosts (Seedance -> *.volces.com, Grok -> *.x.ai, ElevenLabs, ...) nor reach
// *.workers.dev. So long generations are submitted with
//     options: { background: true, webhookUrl: "https://<this worker>/hook/<HOOK_SECRET>/<jobId>" }
// AI Gateway POSTs the finished run here ({id, state, result, error, provider, model, usage}). We store the
// body in KV as "res:<jobId>", then copy every https URL found in `result` into KV:
//     "media:<jobId>:<i>"            (files <= 20 MiB)      or
//     "media:<jobId>:<i>:<chunk>"    (bigger files, 20 MiB chunks)
//     "mir:<jobId>"  -> { files: [{ i, key, chunks, bytes, type, host } | { i, error }], t }
// The sandbox polls these keys through the Cloudflare KV REST API (tools/cfai.py).
//
// KV budget (works on the free plan): ~5 writes per job; the cron runs every 10 minutes and lists only the
// small "pend:" prefix to finish mirrors that ctx.waitUntil() did not complete.
// Deployed by tools/relay/relay.py (bindings: JOBS = KV namespace, HOOK_SECRET = secret_text).

const CHUNK = 20 * 1024 * 1024;
const MAX_FILE = 200 * 1024 * 1024;
const TTL = 30 * 86400;

function outputUrls(result) {
  const out = [];
  const visit = (v) => {
    if (!v) return;
    if (typeof v === "string") {
      try {
        const u = new URL(v);
        // https only, no IP literals (results come from AI Gateway, behind the secret path)
        if (u.protocol === "https:" && !/^[\d.]+$|^\[/.test(u.hostname)) out.push(v);
      } catch (e) {}
      return;
    }
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (typeof v === "object") Object.values(v).forEach(visit);
  };
  visit(result);
  return [...new Set(out)];
}

async function mirror(env, jobId, run) {
  const urls = outputUrls(run && run.result);
  const files = [];
  for (let i = 0; i < urls.length; i++) {
    const host = new URL(urls[i]).hostname;
    try {
      const resp = await fetch(urls[i]);
      if (!resp.ok) { files.push({ i, host, error: "fetch " + resp.status }); continue; }
      const buf = await resp.arrayBuffer();
      if (buf.byteLength > MAX_FILE) { files.push({ i, host, error: "too big: " + buf.byteLength }); continue; }
      const n = Math.max(1, Math.ceil(buf.byteLength / CHUNK));
      const key = `media:${jobId}:${i}`;
      for (let c = 0; c < n; c++) {
        await env.JOBS.put(n === 1 ? key : `${key}:${c}`, buf.slice(c * CHUNK, (c + 1) * CHUNK), { expirationTtl: TTL });
      }
      files.push({ i, key, chunks: n, bytes: buf.byteLength, type: resp.headers.get("content-type") || "", host });
    } catch (e) {
      files.push({ i, host, error: String((e && e.message) || e) });
    }
  }
  await env.JOBS.put("mir:" + jobId, JSON.stringify({ files, t: Date.now() }), { expirationTtl: TTL });
  await env.JOBS.delete("pend:" + jobId);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "/health") return new Response("halys relay ok");
    const m = url.pathname.match(/^\/hook\/([^/]+)\/([A-Za-z0-9_.-]{1,200})$/);
    if (!m || !env.HOOK_SECRET || m[1] !== env.HOOK_SECRET) return new Response("not found", { status: 404 });
    if (req.method !== "POST") return new Response("POST only", { status: 405 });
    const jobId = m[2];
    const body = await req.text();
    await env.JOBS.put("res:" + jobId, body, { expirationTtl: TTL });
    let run = null;
    try { run = JSON.parse(body); } catch (e) {}
    if (run && run.state === "Completed" && outputUrls(run.result).length) {
      await env.JOBS.put("pend:" + jobId, String(Date.now()), { expirationTtl: 7 * 86400 });
      ctx.waitUntil(mirror(env, jobId, run));
    }
    return new Response("ok");
  },

  // Every 10 minutes: finish mirrors that waitUntil() ran out of time for (big files, slow provider CDNs).
  async scheduled(event, env, ctx) {
    const list = await env.JOBS.list({ prefix: "pend:", limit: 100 });
    let budget = 3;
    for (const k of list.keys) {
      if (budget <= 0) break;
      const jobId = k.name.slice(5);
      const since = Number(await env.JOBS.get(k.name)) || 0;
      if (Date.now() - since < 120000) continue;          // still being mirrored by its webhook
      if (await env.JOBS.get("mir:" + jobId)) { await env.JOBS.delete(k.name); continue; }
      const run = await env.JOBS.get("res:" + jobId, "json");
      if (!run || run.state !== "Completed") { await env.JOBS.delete(k.name); continue; }
      budget--;
      ctx.waitUntil(mirror(env, jobId, run));
    }
  },
};
