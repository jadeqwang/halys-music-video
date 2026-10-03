#!/usr/bin/env node
// render.mjs: drive studio.html in headless Chromium (Playwright, browsers in /opt/pw-browsers; never run
// "playwright install"). Every frame is a pure function of (master frame, size, fps), so frames render in any
// order, in parallel and resumably.
//
//   node render.mjs --list [--out=out/shots.json]                shot table (+ gaps, warnings)
//   node render.mjs --sheet=cold_open,drop1@.25,f6700,12.5 [--cols=4] [--w=480] [--out=out/sheet.jpg]
//                                                                contact sheet; items: shot id (midpoint), id@frac,
//                                                                id+seconds, id*N (N samples), seconds, fNNN, all
//   node render.mjs --stills=drop1,200.5 [--png] [--out=out/stills]   full-size stills
//   node render.mjs --frames=0:273.6 [--workers=4] [--stale] [--force] [--no-dedupe]
//                                                                JPEG frames -> out/frames/f%05d.jpg (resumable;
//                                                                held frames are hard links to their drawing;
//                                                                keys.json redraws frames the edit moved; --stale
//                                                                also redraws frames drawn from older sources)
//   node render.mjs --encode [--range=a:b] [--crf=16] [--out=out/halys_1920x1080_60.mp4]
//                                                                frames + song -> H.264 MP4 (review master;
//                                                                tools/encode_release.sh makes the release files)
//   node render.mjs --clip=110:116 [--out=out/clip.mp4]          render straight into an MP4 with the song
//   node render.mjs --probe                                      WebGL2 / fonts / plates check + ms per frame
//   node render.mjs --serve [--port=8000]                        static server for studio.html (+ the song)
// Common: --size=1920x1080 (or 1080x1350, 1080x1920) · --fps=60 (master rate) · --q=0.93 (JPEG)
//         --dir=out/frames (frames dir; default out/frames for 1920x1080@60, else out/frames_<W>x<H>[_<fps>])
//         --song=../Halys.mp3 · --chrome=PATH (or $CHROME) · --shared (one browser, N pages) · --timeout=180
//         --verbose (page console) · --debug (frame-number overlay; disables hold de-duplication)
import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync, renameSync, readdirSync, createReadStream, linkSync, copyFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
process.chdir(HERE);
const args = Object.fromEntries(process.argv.slice(2).map(a => { const s = a.replace(/^--/, ''), i = s.indexOf('='); return i < 0 ? [s, true] : [s.slice(0, i), s.slice(i + 1)]; }));
// chromium-headless-shell 1194 (= Chromium 141, the build playwright-core 1.56.1 expects). The full
// chrome-linux/chrome binary works too (--chrome=...) but contacts Google services the sandbox blocks.
const CHROME = args.chrome || process.env.CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const SONG = resolve(args.song || '../Halys.mp3');
const probeDur = f => { try { return +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim(); } catch (e) { return 273.6; } };
const DUR = probeDur(SONG);
const FPS = +(args.fps || 60);
const [W, H] = String(args.size || '1920x1080').split('x').map(Number);   // (--w is the sheet tile width, not the output size)
if (W % 2 || H % 2) throw new Error(`size ${W}x${H}: both sides must be even (yuv420p)`);
const Qj = +(args.q || .93);
const FRAMES_DIR = args.dir || (W === 1920 && H === 1080 && FPS === 60 ? 'out/frames' : `out/frames_${W}x${H}${FPS !== 60 ? '_' + FPS : ''}`);
const TIMEOUT = +(args.timeout || 180) * 1000;
const pad5 = i => String(i).padStart(5, '0');
const fpath = i => `${FRAMES_DIR}/f${pad5(i)}.jpg`;
const b64 = url => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(`${cmd} exited ${c}`)) : ok()); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Chromium's JPEGs are JFIF: BT.601 matrix, full range. Players decode HD video as BT.709 limited range, so convert
// explicitly (ffmpeg's automatic conversion fixes the range but not the matrix: greens and reds would shift). Going
// through RGB with accurate rounding round-trips within +-1 level; swscale's direct YUV->YUV matrix path is ~3 dark.
const TO709 = 'format=rgb24,scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p';
const TAG709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
const withTimeout = (p, ms, what) => Promise.race([p, sleep(ms).then(() => { throw new Error(`${what}: timed out after ${ms / 1000}s`); })]);

// ---------------------------------------------------------------- encode (no browser needed)
function manifest(dir) { try { return JSON.parse(readFileSync(`${dir}/render.json`, 'utf8')); } catch (e) { return null; } }
if (args.encode) {
  const man = manifest(FRAMES_DIR) || { fps: FPS, w: W, h: H };
  const fps = man.fps;
  const have = new Set(readdirSync(FRAMES_DIR).filter(f => /^f\d{5}\.jpg$/.test(f)).map(f => +f.slice(1, 6)));
  if (!have.size) throw new Error(`no frames in ${FRAMES_DIR}`);
  let a, b;
  if (args.range) { const [x, y] = String(args.range).split(':').map(Number); a = Math.round(x * fps); b = Math.min(Math.round(y * fps), Math.ceil(DUR * fps)) - 1; }
  else { a = Math.min(...have); b = Math.max(...have); }
  const missing = []; for (let i = a; i <= b; i++) if (!have.has(i)) missing.push(i);
  if (missing.length) throw new Error(`${missing.length} frames missing in ${FRAMES_DIR} between f${pad5(a)} and f${pad5(b)} (first: ${missing.slice(0, 5).join(', ')}); run --frames first`);
  const n = b - a + 1, t0 = a / fps;
  const tag = a === 0 && b + 1 >= Math.ceil(DUR * fps) ? '' : `_${t0.toFixed(2)}-${((b + 1) / fps).toFixed(2)}s`;
  const out = args.out || `out/halys_${man.w}x${man.h}_${fps}${tag}.mp4`;
  mkdirSync(dirname(out), { recursive: true });
  console.log(`encoding ${n} frames (${(n / fps).toFixed(2)} s from ${t0.toFixed(3)} s) at ${fps} fps + ${relative(HERE, SONG)} -> ${out}`);
  const t = Date.now();
  await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-stats',
    '-framerate', String(fps), '-start_number', String(a), '-i', `${FRAMES_DIR}/f%05d.jpg`,
    '-ss', t0.toFixed(6), '-t', (n / fps).toFixed(6), '-i', SONG,
    '-map', '0:v:0', '-map', '1:a:0', '-frames:v', String(n),
    '-vf', TO709, '-c:v', 'libx264', '-preset', args.preset || 'slow', '-crf', String(args.crf || 16), ...TAG709,
    '-af', 'apad', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', out]);
  const sz = statSync(out).size;
  console.log(`wrote ${out}  ${(sz / 1e6).toFixed(1)} MB  (${((Date.now() - t) / 1000).toFixed(1)} s)`);
  process.exit(0);
}

// ---------------------------------------------------------------- static server
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.bin': 'application/octet-stream', '.txt': 'text/plain' };
const MISSING = new Set();   // 404s (optional files such as data/timing.json); reported once at the end
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const p = url === '/audio/song.mp3' ? SONG : join(HERE, url);
  if ((!p.startsWith(HERE + '/') && p !== SONG) || !existsSync(p) || statSync(p).isDirectory()) {
    if (args.verbose) console.log('404 ' + req.url);
    MISSING.add(url);
    res.writeHead(404); res.end(); return;
  }
  const size = statSync(p).size, type = MIME[extname(p).toLowerCase()] || 'application/octet-stream';
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m) {                                          // Range support: the studio's <audio> needs it to seek
    const a = m[1] ? +m[1] : size - +m[2], b = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(p, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
  if (req.method === 'HEAD') return res.end();
  createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(args.serve ? +(args.port || 8000) : 0, '127.0.0.1', r));
const PORT = server.address().port;
if (args.serve) {
  console.log(`studio: http://127.0.0.1:${PORT}/studio.html   (song: ${relative(HERE, SONG)}; ctrl-c to stop)`);
  console.log(`        add ?w=1080&h=1350 for 4:5, &t=110 to start at a time, &fps=30 for another master rate`);
  await new Promise(() => { });
}

// ---------------------------------------------------------------- browsers / pages
// (on top of Playwright's defaults, which already disable background networking, component updates, translate, ...)
const LAUNCH_ARGS = ['--no-sandbox', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
  '--disable-sync', '--force-color-profile=srgb', '--mute-audio', '--js-flags=--max-old-space-size=4096'];
// NB: no GL flags. Chromium 141 headless already runs WebGL2 on SwiftShader (ANGLE/Vulkan); forcing
// --use-angle=swiftshader also moves 2D canvas onto SwiftShader, which makes toDataURL ~7x slower.
const browsers = [];
async function launch() { const b = await chromium.launch({ executablePath: CHROME, headless: true, args: LAUNCH_ARGS }); browsers.push(b); return b; }
let shared = null;
async function openPage(tag = '') {
  const browser = args.shared ? (shared ||= await launch()) : await launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('console', m => {
    if (!args.verbose && (m.type() !== 'error' || /Failed to load resource.*404/.test(m.text()))) return;   // 404s are summarised at exit
    console.log(`[page${tag}] ${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', e => console.log(`[page error${tag}] ${e.message}`));
  const q = new URLSearchParams({ render: '', w: W, h: H, fps: FPS, dur: DUR });
  if (args.debug) q.set('debug', '');
  await page.goto(`http://127.0.0.1:${PORT}/studio.html?${q}`, { waitUntil: 'load' });
  const st = await page.waitForFunction(() => window.HALYS && (window.HALYS.ready || window.HALYS.error) && { ready: window.HALYS.ready, error: window.HALYS.error }, null, { timeout: 300000, polling: 100 }).then(h => h.jsonValue());
  if (st.error) throw new Error(`page failed to boot: ${st.error}`);
  page._browser = browser;
  return page;
}
async function closePage(page) { try { await page.close(); } catch (e) { } if (!args.shared && page._browser) try { await page._browser.close(); } catch (e) { } }
const frameOf = (page, i, type = 'image/jpeg', q = Qj) => withTimeout(page.evaluate(([i, type, q]) => window.HALYS.frame(i, type, q), [i, type, q]), TIMEOUT, `frame ${i}`);

function writeAtomic(f, buf) { writeFileSync(f + '.tmp', buf); renameSync(f + '.tmp', f); }
function linkAtomic(src, dst) {
  if (src === dst) return;
  const tmp = dst + '.lnk';
  try { if (existsSync(tmp)) unlinkSync(tmp); linkSync(src, tmp); } catch (e) { copyFileSync(src, tmp); }
  renameSync(tmp, dst);
}

let exitCode = 0;
const cleanup = async () => {
  for (const b of browsers) try { await b.close(); } catch (e) { }
  server.close();
  if (MISSING.size) console.log(`not found (optional, skipped): ${[...MISSING].slice(0, 8).join(', ')}${MISSING.size > 8 ? ` +${MISSING.size - 8} more` : ''}`);
  MISSING.clear();
};
let flushLedger = null;
process.on('SIGINT', async () => { console.log('\ninterrupted; finished frames are kept (rerun to resume)'); if (flushLedger) flushLedger(); await cleanup(); process.exit(130); });

// Hash of everything a frame's pixels depend on besides its index: the page sources, timing data, plate index.
function hashSources() {
  const h = createHash('sha1');
  const walk = d => { for (const f of readdirSync(d, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name))) {
    const p = join(d, f.name); if (f.isDirectory()) walk(p); else { h.update(p); h.update(readFileSync(p)); } } };
  walk('src');
  for (const f of ['studio.html', 'data/timing.json', 'data/shotlist.json', 'plates/index.json']) if (existsSync(f)) { h.update(f); h.update(readFileSync(f)); }
  return h.digest('hex').slice(0, 10);
}

try {
  if (args.list || args.probe) {
    const page = await openPage();
    const info = await page.evaluate(() => window.HALYS.info());
    const shots = await page.evaluate(() => window.HALYS.shots());
    if (args.list) {
      console.log(`${'shot'.padEnd(16)} ${'t0'.padStart(8)} ${'t1'.padStart(8)}  ${'dur'.padStart(6)}  frames        draw   world   scene        plate`);
      for (const s of shots) console.log(`${s.id.padEnd(16)} ${s.t0.toFixed(2).padStart(8)} ${s.t1.toFixed(2).padStart(8)}  ${(s.t1 - s.t0).toFixed(2).padStart(6)}  ${String(s.F0).padStart(5)}-${String(s.F1 - 1).padEnd(6)} ${String(s.cadence).padStart(3)} fps  ${s.world.padEnd(7)} ${s.scene.padEnd(12)} ${s.plate || ''}`);
      const nd = new Set(await page.evaluate(n => window.HALYS.keys(0, n - 1), info.frames)).size;
      const byCad = {}; for (const s of shots) byCad[s.cadence] = (byCad[s.cadence] || 0) + (s.F1 - s.F0) / info.FPS;
      console.log(`${shots.length} shots, ${info.frames} master frames at ${info.FPS} fps (${info.dur.toFixed(3)} s), ${info.W}x${info.H}; ${nd} unique drawings ` +
        `(${(100 * nd / info.frames).toFixed(0)} %; the rest are held); seconds per cadence: ${Object.entries(byCad).map(([c, t]) => `${c} fps ${t.toFixed(1)} s`).join(', ')}`);
      console.log(`timing.json ${info.timing ? 'loaded' : 'MISSING (constant 140 BPM grid)'}; plates: ${info.plates.join(', ') || 'none'}`);
      if (info.gaps.length) console.log(`gaps (black): ${info.gaps.map(([a, b]) => `${a.toFixed(2)}-${b.toFixed(2)}`).join(', ')}`);
      for (const w of info.warnings || []) console.log('warning: ' + w);
      if (args.out) { mkdirSync(dirname(args.out), { recursive: true }); writeFileSync(args.out, JSON.stringify(shots.map(s => [s.id, s.t0, s.t1, s.cadence, s.world]))); console.log('wrote ' + args.out); }
    } else {
      console.log(JSON.stringify(info, null, 1));
      // per shot: three consecutive drawings from its midpoint (the first pays for caches / shader compiles)
      const items = await page.evaluate(() => window.HALYS.resolve('all'));
      for (const i of items) {
        const fi = await page.evaluate(i => window.HALYS.frameInfo(i), i), s = shots.find(x => x.id === fi.shot), hold = Math.ceil(FPS / s.cadence);
        const r = []; for (let k = 0; k < 3; k++) r.push(await frameOf(page, Math.min(s.F1 - 1, i + k * hold)));
        const warm = r.slice(1), dm = warm.reduce((x, y) => x + y.drawMs, 0) / warm.length, em = warm.reduce((x, y) => x + y.encMs, 0) / warm.length;
        console.log(`f${pad5(i)} ${fi.shot.padEnd(14)} ${String(s.cadence).padStart(2)} fps  first ${(r[0].drawMs + r[0].encMs).toFixed(0).padStart(5)} ms   then draw ${dm.toFixed(0).padStart(4)} ms + jpeg ${em.toFixed(0).padStart(3)} ms  ${(b64(r[2].url).length / 1024).toFixed(0)} KB`);
      }
    }
  } else if (args.sheet) {
    const page = await openPage(), out = args.out || 'out/sheet.jpg';
    mkdirSync(dirname(out), { recursive: true });
    const r = await withTimeout(page.evaluate(([s, c, w]) => window.HALYS.sheet(s, c, w), [String(args.sheet), +(args.cols || 4), +(args.w || 480)]), TIMEOUT * 4, 'sheet');
    writeFileSync(out, b64(r.url));
    console.log(`${out}  ${r.items.length} frames, ms/frame: ${r.ms.map(x => x.toFixed(0)).join(' ')}`);
  } else if (args.stills) {
    const page = await openPage(), out = args.out || 'out/stills', png = !!args.png;
    mkdirSync(out, { recursive: true });
    for (const i of await page.evaluate(s => window.HALYS.resolve(s), String(args.stills))) {
      const r = await frameOf(page, i, png ? 'image/png' : 'image/jpeg', png ? undefined : .95);
      const f = `${out}/f${pad5(i)}_${r.key.replace(/[^\w.-]+/g, '_')}.${png ? 'png' : 'jpg'}`;
      writeFileSync(f, b64(r.url));
      console.log(`${f}  draw ${r.drawMs.toFixed(0)} ms + encode ${r.encMs.toFixed(0)} ms`);
    }
  } else if (args.frames) {
    // ---- parallel, resumable, hold-aware frame rendering
    const [a, b] = String(args.frames).split(':').map(Number), workers = +(args.workers || 4);
    const first = Math.max(0, Math.round(a * FPS)), last = Math.min(Math.ceil(DUR * FPS) - 1, Math.round(b * FPS) - 1);
    if (last < first) throw new Error(`empty frame range ${args.frames}`);
    mkdirSync(FRAMES_DIR, { recursive: true });
    const man = manifest(FRAMES_DIR), want = { w: W, h: H, fps: FPS, song: relative(HERE, SONG), dur: DUR };
    if (man && (man.w !== W || man.h !== H || man.fps !== FPS)) throw new Error(`${FRAMES_DIR} holds ${man.w}x${man.h}@${man.fps} frames; use --dir= for ${W}x${H}@${FPS}`);
    writeFileSync(`${FRAMES_DIR}/render.json`, JSON.stringify({ ...want, updated: new Date().toISOString() }, null, 1));
    const page0 = await openPage('#0');
    const keys = await page0.evaluate(([x, y]) => window.HALYS.keys(x, y), [first, last]);
    const groups = new Map();
    keys.forEach((k, j) => { const key = args['no-dedupe'] ? `${k}@${first + j}` : k; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(first + j); });
    // Ledger (keys.json): for every frame file, "<drawing key>|<source hash>" it was drawn with. A frame whose key
    // changed (the edit moved a cut, a cadence changed) is redrawn automatically; a frame drawn from older sources
    // (scene code, timing.json, plates) is kept with a warning unless --stale (or --force) is given.
    const SRC = hashSources(), LEDGER = `${FRAMES_DIR}/keys.json`;
    let ledger = {}; try { ledger = JSON.parse(readFileSync(LEDGER, 'utf8')); } catch (e) { }
    flushLedger = () => writeAtomic(LEDGER, JSON.stringify(ledger));
    const keyOf = i => keys[i - first];
    const exists = i => { try { return statSync(fpath(i)).size > 0; } catch (e) { return false; } };
    const state = i => {                 // 'missing' | 'ok' | 'moved' (key changed) | 'old' (older sources) | 'legacy' (no record)
      if (!exists(i)) return 'missing';
      const rec = ledger[i]; if (!rec) return 'legacy';
      const [k, h] = rec.split('|');
      return k !== keyOf(i) ? 'moved' : h !== SRC ? 'old' : 'ok';
    };
    const tasks = [], count = { moved: 0, old: 0, legacy: 0 };
    let linkedNow = 0;
    for (const [key, idx] of groups) {
      if (args.force) { tasks.push({ key, idx }); continue; }
      const st = idx.map(state);
      for (const x of st) if (x in count) count[x]++;
      const good = idx.filter((i, j) => st[j] === 'ok' || ((st[j] === 'old' || st[j] === 'legacy') && !args.stale));
      if (good.length === idx.length) continue;
      if (good.length) { for (const i of idx) if (!good.includes(i)) { linkAtomic(fpath(good[0]), fpath(i)); ledger[i] = ledger[good[0]] || `${keyOf(i)}|${SRC}`; linkedNow++; } continue; }
      tasks.push({ key, idx });
    }
    if (count.moved) console.log(`${count.moved} frames hold a drawing the edit no longer puts there: redrawing them`);
    if (count.old) console.log(`${count.old} frames were drawn from older sources (src/, data/*.json or the plate index changed): ${args.stale ? 'redrawing them (--stale)' : 'KEPT; pass --stale to redraw them, or --force for everything in the range'}`);
    if (count.legacy) console.log(`${count.legacy} frames have no ledger entry (drawn before keys.json existed): ${args.stale ? 'redrawing them (--stale)' : 'KEPT; pass --stale to redraw them'}`);
    const nFrames = last - first + 1, todoFrames = tasks.reduce((s, t) => s + t.idx.length, 0);
    console.log(`${FRAMES_DIR}: frames ${first}-${last} (${nFrames}) at ${W}x${H}@${FPS}: ${groups.size} drawings; ${tasks.length} to render (${todoFrames} frames), ` +
      `${nFrames - todoFrames - linkedNow} already done${linkedNow ? `, ${linkedNow} re-linked` : ''}; ${Math.min(workers, tasks.length)} workers`);
    let next = 0, done = 0, framesOut = 0, drawMs = 0, encMs = 0, lastLog = Date.now();
    const start = Date.now(), failed = [];
    const work = async w => {
      if (next >= tasks.length) return;
      let page = w === 0 ? page0 : await openPage('#' + w);
      while (next < tasks.length) {
        const task = tasks[next++], lead = task.idx[0];
        let r;
        for (let attempt = 0; attempt < 2 && !r; attempt++) {
          try { r = await frameOf(page, lead); }
          catch (e) {
            console.log(`worker ${w}: frame ${lead} failed (${e.message.split('\n')[0]}); ${attempt ? 'giving up on it' : 'restarting the page'}`);
            await closePage(page); page = await openPage('#' + w);
          }
        }
        if (!r) { failed.push(lead); continue; }
        writeAtomic(fpath(lead), b64(r.url));
        for (const i of task.idx.slice(1)) linkAtomic(fpath(lead), fpath(i));
        for (const i of task.idx) ledger[i] = `${keyOf(i)}|${SRC}`;
        done++; framesOut += task.idx.length; drawMs += r.drawMs; encMs += r.encMs;
        if (Date.now() - lastLog > 5000 || done === tasks.length) {
          lastLog = Date.now(); flushLedger();
          const el = (Date.now() - start) / 1000;
          console.log(`  ${done}/${tasks.length} drawings (${framesOut}/${todoFrames} frames)  page: draw ${(drawMs / done).toFixed(0)} ms + jpeg ${(encMs / done).toFixed(0)} ms  ` +
            `wall ${(el * 1000 / done).toFixed(0)} ms/drawing, ${(el * 1000 / framesOut).toFixed(0)} ms/frame  eta ${((tasks.length - done) * el / done / 60).toFixed(1)} min`);
        }
      }
      if (w !== 0) await closePage(page);
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(workers, tasks.length)) }, (_, w) => work(w)));
    flushLedger();
    const el = (Date.now() - start) / 1000;
    if (done) console.log(`rendered ${done} drawings -> ${framesOut} frames in ${el.toFixed(1)} s (${(el / framesOut * 1000).toFixed(0)} ms/frame effective with ${workers} workers)`);
    if (failed.length) { console.log(`FAILED frames: ${failed.join(', ')} (rerun to retry)`); exitCode = 1; }
  } else if (args.clip) {
    // ---- straight to MP4 (no frames on disk); one drawing per hold group
    const page = await openPage();
    const [a, b] = String(args.clip).split(':').map(Number);
    const first = Math.round(a * FPS), last = Math.min(Math.ceil(DUR * FPS) - 1, Math.round(b * FPS) - 1), n = last - first + 1;
    const out = args.out || `out/clip_${a}-${b}s.mp4`; mkdirSync(dirname(out), { recursive: true });
    const keys = await page.evaluate(([x, y]) => window.HALYS.keys(x, y), [first, last]);
    const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-ss', (first / FPS).toFixed(6), '-t', (n / FPS).toFixed(6), '-i', SONG, '-map', '0:v', '-map', '1:a',
      '-vf', TO709, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', ...TAG709, '-af', 'apad', '-c:a', 'aac', '-b:a', '192k', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    let buf = null, prevKey = null, drawn = 0; const start = Date.now();
    for (let j = 0; j < n; j++) {
      if (keys[j] !== prevKey || args['no-dedupe']) { buf = b64((await frameOf(page, first + j)).url); prevKey = keys[j]; drawn++; }
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    console.log(`wrote ${out}: ${n} frames from ${drawn} drawings in ${((Date.now() - start) / 1000).toFixed(1)} s`);
  } else {
    const src = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1);
    console.log(src.slice(0, src.findIndex(l => !l.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  }
} catch (e) {
  console.error(`error: ${String(e.message || e).split('\n')[0]}`);
  exitCode = 1;
} finally {
  await cleanup();
}
process.exit(exitCode);
