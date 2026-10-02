// orbital-sunrise-relay: webhook sink for background /ai/run jobs.
//
// Requests from the build sandbox to api.cloudflare.com are cut at ~30 s, so long generations
// (Seedance video, high-res images) are started with options.background=true and
// webhookUrl=https://<this worker>/hook/<HOOK_SECRET>/<jobId>. The finished run is POSTed here and
// stored in KV as "res:<jobId>". Provider outputs live on hosts the sandbox cannot reach (e.g. the
// Seedance CDN), so the files named in that payload are copied into KV as
// "media:<jobId>:<n>[:<chunk>]" with an index at "mir:<jobId>". The sandbox reads everything back
// through the Cloudflare KV API. Only URLs from the AI result payload, on provider-output hosts,
// are ever fetched.
const CHUNK = 20 * 1024 * 1024;
const TTL = 30 * 86400;
const OUTPUT_HOSTS = [/\.volces\.com$/, /\.r2\.cloudflarestorage\.com$/, /\.byteplus\.com$/, /\.bytepluses\.com$/,
  /^storage\.googleapis\.com$/, /\.googleusercontent\.com$/, /\.x\.ai$/, /\.elevenlabs\.io$/];

function outputUrls(result) {
  const out = [];
  const visit = (v) => {
    if (!v) return;
    if (typeof v === "string") {
      try { const u = new URL(v); if (u.protocol === "https:" && OUTPUT_HOSTS.some(r => r.test(u.hostname))) out.push(v); } catch (e) {}
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
    try {
      const resp = await fetch(urls[i]);
      if (!resp.ok) { files.push({ i, error: "fetch " + resp.status }); continue; }
      const buf = await resp.arrayBuffer();
      const n = Math.max(1, Math.ceil(buf.byteLength / CHUNK));
      const key = `media:${jobId}:${i}`;
      for (let c = 0; c < n; c++) {
        await env.JOBS.put(n === 1 ? key : `${key}:${c}`, buf.slice(c * CHUNK, (c + 1) * CHUNK), { expirationTtl: TTL });
      }
      files.push({ i, key, chunks: n, bytes: buf.byteLength, type: resp.headers.get("content-type") || "" });
    } catch (e) {
      files.push({ i, error: String((e && e.message) || e) });
    }
  }
  await env.JOBS.put("mir:" + jobId, JSON.stringify({ files, t: Date.now() }), { expirationTtl: TTL });
}

export default {
  async fetch(req, env, ctx) {
    const m = new URL(req.url).pathname.match(/^\/hook\/([^/]+)\/([A-Za-z0-9_.-]{1,200})$/);
    if (!m || m[1] !== env.HOOK_SECRET) return new Response("not found", { status: 404 });
    if (req.method !== "POST") return new Response("POST only", { status: 405 });
    const body = await req.text();
    const jobId = m[2];
    await env.JOBS.put("res:" + jobId, body, { expirationTtl: TTL });
    let run = null;
    try { run = JSON.parse(body); } catch (e) {}
    if (run && run.state === "Completed") ctx.waitUntil(mirror(env, jobId, run));
    return new Response("ok");
  },

  // Fallback: once a minute, mirror any completed result whose copy is missing (waitUntil can run out of time).
  async scheduled(event, env, ctx) {
    const list = await env.JOBS.list({ prefix: "res:", limit: 1000 });
    let budget = 3;
    for (const k of list.keys) {
      if (budget <= 0) break;
      const jobId = k.name.slice(4);
      if (await env.JOBS.get("mir:" + jobId)) continue;
      const run = await env.JOBS.get(k.name, "json");
      if (!run || run.state !== "Completed" || !outputUrls(run.result).length) continue;
      budget--;
      await mirror(env, jobId, run);
    }
  },
};
