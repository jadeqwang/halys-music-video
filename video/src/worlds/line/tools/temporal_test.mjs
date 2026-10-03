// node src/worlds/line/tools/temporal_test.mjs [plate] [t0] [n] [outdir]: runs temporal_test.html headless, prints the
// metrics and writes the frames side by side (temporal | naive) as JPEGs + an MP4 for review.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, extname, dirname } from 'node:path';
import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const [plate = 'P04', t0 = '1', n = '60', outdir = ''] = process.argv.slice(2);
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = createServer((q, r) => { const p = join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!existsSync(p) || statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p)); });
await new Promise(r => srv.listen(0, r));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', args: ['--no-sandbox'] });
const pg = await b.newPage(); pg.on('pageerror', e => console.log('page error', e.message));
await pg.goto(`http://127.0.0.1:${srv.address().port}/src/worlds/line/tools/temporal_test.html?plate=${plate}&t0=${t0}&n=${n}`);
const res = await pg.waitForFunction(() => window.RESULT, null, { timeout: 1800000, polling: 500 }).then(h => h.jsonValue());
console.log(JSON.stringify(res, null, 1));
if (outdir) {
  mkdirSync(outdir, { recursive: true });
  const F = await pg.evaluate(() => window.FRAMES);
  F.temporal.forEach((u, k) => { writeFileSync(`${outdir}/t${String(k).padStart(3, '0')}.jpg`, Buffer.from(u.split(',')[1], 'base64')); writeFileSync(`${outdir}/n${String(k).padStart(3, '0')}.jpg`, Buffer.from(F.naive[k].split(',')[1], 'base64')); });
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '60', '-i', `${outdir}/t%03d.jpg`, '-framerate', '60', '-i', `${outdir}/n%03d.jpg`, '-filter_complex', 'hstack=inputs=2,format=yuv420p', '-c:v', 'libx264', '-crf', '20', `${outdir}/temporal_vs_naive.mp4`]);
  console.log('wrote', `${outdir}/temporal_vs_naive.mp4`);
}
await b.close(); srv.close();
