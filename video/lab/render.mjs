// render.mjs: drive the look-dev lab (lab.html) in headless Chromium (CPU-only: WebGL2 on SwiftShader).
//
//   node render.mjs --still=a_duel:bronze,b_face:bronze [--set='{"eclipse":.3}'] [--tag=v2] [--out=../../production/lookdev] [--q=90]
//   node render.mjs --clip=bronze_boil [--out=../../production/lookdev/bronze_boil.mp4] [--frames=0:48]
//   node render.mjs --bench=a_duel:bronze [--n=3]        repeat renders, report ms/frame
//
// Files: <out>/<plate>_<material>[_<tag>].jpg. Timings (analysis, render) are appended to <out>/timings.jsonl.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, existsSync, statSync, createReadStream, appendFileSync } from 'node:fs';
import { dirname, resolve, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const s = a.replace(/^--/, ''), i = s.indexOf('='); return i < 0 ? [s, true] : [s.slice(0, i), s.slice(i + 1)]; }));
const CHROME = args.chrome || process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT_ARG = resolve(args.out || join(ROOT, 'production/lookdev'));
const OUT = OUT_ARG.endsWith('.mp4') ? dirname(OUT_ARG) : OUT_ARG;      // directory for stills, logs, frame dumps
const Q = +(args.q || 90) / 100;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer((req, res) => {
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const browser = await chromium.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update', '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb',
    '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--js-flags=--max-old-space-size=6144']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', m => { if (['error', 'warning'].includes(m.type()) || args.verbose) console.log('[page]', m.text()); });
page.on('pageerror', e => console.log('[page error]', e.message));
page.setDefaultTimeout(0);
await page.goto(`http://127.0.0.1:${PORT}/video/lab/lab.html?headless`, { waitUntil: 'load' });
await page.waitForFunction('window.ready === true', null, { timeout: 120000, polling: 200 });

const b64 = url => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
const set = args.set ? JSON.parse(args.set) : {};
const logT = (rec) => { mkdirSync(OUT, { recursive: true }); appendFileSync(join(OUT, 'timings.jsonl'), JSON.stringify({ when: new Date().toISOString(), ...rec }) + '\n'); };

try {
  if (args.still || args.bench) {
    const jobs = String(args.still || args.bench).split(',').map(s => s.split(':'));
    mkdirSync(OUT, { recursive: true });
    for (const [plate, material] of jobs) {
      const n = args.bench ? +(args.n || 3) : 1;
      for (let k = 0; k < n; k++) {
        const t0 = Date.now();
        const r = await page.evaluate(s => window.renderStill(s), { plate, material, params: set, t: +(args.t || 0), quality: Q });
        const f = join(OUT, `${plate}_${material}${args.tag ? '_' + args.tag : ''}.jpg`);
        if (!args.bench) writeFileSync(f, b64(r.url));
        console.log(`${args.bench ? '[bench ' + k + ']' : f}  wall ${Date.now() - t0} ms  ${JSON.stringify(r.ms)}  ${JSON.stringify(r.stats)}`);
        if (!args.nolog) logT({ plate, material, tag: args.tag || null, ms: r.ms, stats: r.stats, wall: Date.now() - t0 });
      }
    }
  } else if (args.clip) {
    const info = await page.evaluate(n => window.clipInfo(n), args.clip);
    const out = OUT_ARG.endsWith('.mp4') ? OUT_ARG : join(OUT, `${args.clip}.mp4`);
    mkdirSync(dirname(out), { recursive: true });
    const [a, b] = args.frames ? String(args.frames).split(':').map(Number) : [0, info.frames];
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(info.fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf || 20), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const start = Date.now(); let held = null, heldKey = null; const ms = [];
    for (let i = a; i < b; i++) {
      // drawings held on twos (or more) are rendered once and repeated
      const key = await page.evaluate(([n, i]) => window.clipDrawKey(n, i), [args.clip, i]);
      if (key !== heldKey) {
        const r = await page.evaluate(([n, i, q]) => window.renderClipFrame(n, i, q), [args.clip, i, Q]);
        held = b64(r.url); heldKey = key; ms.push(r.ms);
        if (args.dump) { mkdirSync(join(OUT, 'frames_' + args.clip), { recursive: true }); writeFileSync(join(OUT, 'frames_' + args.clip, `f${String(i).padStart(3, '0')}.jpg`), held); }
      }
      if (!ff.stdin.write(held)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 12 === 0 || i === b - 1) console.log(`frame ${i + 1}/${b}  ${((Date.now() - start) / (i - a + 1)).toFixed(0)} ms/frame wall  last ${JSON.stringify(ms[ms.length - 1])}`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    const avg = k => Math.round(ms.reduce((s, m) => s + (m[k] || 0), 0) / ms.length);
    console.log(`wrote ${out}  drawings ${ms.length}  avg analysis ${avg('analysis')} ms  render ${avg('render')} ms`);
    logT({ clip: args.clip, drawings: ms.length, analysis: avg('analysis'), render: avg('render'), wall: Date.now() - start });
  }
} finally {
  await browser.close();
  server.close();
}
