#!/usr/bin/env node
// typetest.mjs: look-dev driver for the kinetic type system (video/src/type/). It loads the real harness page
// (video/studio.html -> src/main.js -> renderFrame, the same path render.mjs uses) with one extra URL flag, `typebg`,
// which makes the type layer paint a dark painterly stand-in background under the type on shots that still use the
// placeholder scene (production/lookdev stills, graded per world). Film renders (render.mjs) never set the flag.
//
//   node tools/type/typetest.mjs --stills=S05+1.2,110.7 [--size=1080x1350] [--out=DIR]      full-size JPEG stills
//   node tools/type/typetest.mjs --frames=0:10 --mp4=production/type/test_0-10s.mp4 [--workers=3]
//                                                            frames (one render per drawing, held frames reused) + song
//   options: --size=WxH (1920x1080) · --q=0.92 · --nobg (no stand-in) · --song=FILE · --keep (keep the frame dir)
import { chromium } from '../../video/node_modules/playwright-core/index.mjs';
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, createReadStream, rmSync, linkSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const VIDEO = join(ROOT, 'video');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const s = a.replace(/^--/, ''), i = s.indexOf('='); return i < 0 ? [s, true] : [s.slice(0, i), s.slice(i + 1)]; }));
const CHROME = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const [W, H] = String(args.size || '1920x1080').split('x').map(Number);
const Q = +(args.q || .92);
const SONG = resolve(args.song || ['media/stems/halys_sd_master.wav', 'release/Halys_sound_design.mp3', 'Halys.mp3'].map(f => join(ROOT, f)).find(existsSync));
const DUR = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', SONG]).toString().trim();
const FPS = 60;

// stand-in backgrounds: /__standin/<name> -> look-dev stills (read only)
const STANDIN = {
  'a_duel_bronze.jpg': 'production/lookdev/a_duel_bronze.jpg', 'b_face_bronze.jpg': 'production/lookdev/b_face_bronze.jpg',
  'c_armies_bronze.jpg': 'production/lookdev/c_armies_bronze.jpg', 'a_duel_corona.jpg': 'production/lookdev/a_duel_corona.jpg',
  'c_armies_corona.jpg': 'production/lookdev/c_armies_corona.jpg', 'a_duel_marble.jpg': 'production/lookdev/a_duel_marble.jpg',
  'b_face_marble.jpg': 'production/lookdev/b_face_marble.jpg', 'd_room_ink.jpg': 'production/lookdev/d_room_ink.jpg',
};
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg' };
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let p = null;
  if (url.startsWith('/__standin/')) { const f = STANDIN[url.slice(11)]; if (f) p = join(ROOT, f); }
  else if (url.startsWith('/media/lookdev/')) p = join(ROOT, url);          // as render.mjs: the designated stand-in plates
  else p = join(VIDEO, url);
  const okRoot = p && (p.startsWith(VIDEO + '/') || p.startsWith(join(ROOT, 'media/lookdev') + '/') || url.startsWith('/__standin/'));
  if (!okRoot || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(p).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const browsers = [];
async function openPage() {
  const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--force-color-profile=srgb', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  browsers.push(b);
  const page = await b.newPage({ viewport: { width: 800, height: 600 } });
  page.on('console', m => { if (m.type() === 'error' || args.verbose) console.log(`[page] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => console.log(`[page error] ${e.message}`));
  const q = new URLSearchParams({ render: '', w: W, h: H, fps: FPS, dur: DUR });
  if (!args.nobg) q.set('typebg', '1');
  await page.goto(`http://127.0.0.1:${PORT}/studio.html?${q}`);
  const st = await page.waitForFunction(() => window.HALYS && (window.HALYS.ready || window.HALYS.error) && { ready: window.HALYS.ready, error: window.HALYS.error }, null, { timeout: 300000, polling: 100 }).then(h => h.jsonValue());
  if (st.error) throw new Error(st.error);
  return page;
}
const b64 = url => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
const frame = (page, i) => page.evaluate(([i, q]) => window.HALYS.frame(i, 'image/jpeg', q), [i, Q]);
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(`${cmd} exited ${c}`)) : ok()); });

try {
  if (args.stills) {
    const out = resolve(args.out || join(ROOT, 'video/out/type_stills'));
    mkdirSync(out, { recursive: true });
    const page = await openPage();
    const items = await page.evaluate(s => window.HALYS.resolve(s), String(args.stills));
    for (const i of items) {
      const r = await frame(page, i), name = args.name && items.length === 1 ? args.name : `f${String(i).padStart(5, '0')}_${r.key.replace(/[^\w.-]+/g, '_')}`;
      const f = join(out, `${name}.jpg`);
      writeFileSync(f, b64(r.url));
      console.log(`${f}  draw ${r.drawMs.toFixed(0)} ms`);
    }
  } else if (args.frames) {
    const [a, b] = String(args.frames).split(':').map(Number);
    const first = Math.round(a * FPS), last = Math.min(Math.ceil(DUR * FPS) - 1, Math.round(b * FPS) - 1), n = last - first + 1;
    const mp4 = resolve(args.mp4 || join(ROOT, `video/out/type_${a}-${b}s.mp4`));
    const dir = join(VIDEO, `out/typetest_${W}x${H}_${a}-${b}`);
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    const page0 = await openPage();
    const keys = await page0.evaluate(([x, y]) => window.HALYS.keys(x, y), [first, last]);
    const groups = new Map(); keys.forEach((k, j) => { if (!groups.has(k)) groups.set(k, []); groups.get(k).push(first + j); });
    const tasks = [...groups.values()], workers = Math.max(1, Math.min(+(args.workers || 3), tasks.length));
    console.log(`${n} frames, ${tasks.length} drawings, ${workers} workers -> ${dir}`);
    let next = 0, done = 0; const t0 = Date.now();
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const page = w === 0 ? page0 : await openPage();
      while (next < tasks.length) {
        const idx = tasks[next++], r = await frame(page, idx[0]);
        const f0 = join(dir, `f${String(idx[0]).padStart(5, '0')}.jpg`);
        writeFileSync(f0, b64(r.url));
        for (const i of idx.slice(1)) linkSync(f0, join(dir, `f${String(i).padStart(5, '0')}.jpg`));
        if (++done % 50 === 0) console.log(`  ${done}/${tasks.length} drawings  ${((Date.now() - t0) / done).toFixed(0)} ms/drawing`);
      }
    }));
    mkdirSync(dirname(mp4), { recursive: true });
    // Chromium's JPEGs are JFIF (BT.601 full range): convert through RGB to BT.709 limited range (as render.mjs does)
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-start_number', String(first), '-i', join(dir, 'f%05d.jpg'),
      '-ss', (first / FPS).toFixed(6), '-t', (n / FPS).toFixed(6), '-i', SONG, '-map', '0:v:0', '-map', '1:a:0', '-frames:v', String(n),
      '-vf', 'format=rgb24,scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', String(args.crf || 18), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-af', 'apad', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', mp4]);
    console.log(`wrote ${mp4} (${(statSync(mp4).size / 1e6).toFixed(1)} MB) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    if (!args.keep) rmSync(dir, { recursive: true, force: true });
  } else console.log('usage: --stills=SPEC | --frames=a:b --mp4=FILE  [--size=WxH] [--nobg]');
} catch (e) { console.error('error:', e.message); process.exitCode = 1; }
for (const b of browsers) try { await b.close(); } catch (e) { }
server.close();
