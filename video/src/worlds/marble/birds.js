// birds.js: S48's flock stopped mid-air against the corona ("Birds went quiet"). Procedural: swallows and turtle doves
// (Anatolian steppe birds, RESEARCH 1.6 #16) caught at every phase of the wingbeat, scattered in depth along a loose
// band that sweeps past the black sun. Drawn as silhouettes with carved feather lines into a source that stone.js turns
// into marble (inflated forms lit from above, rim from the horizon glow); the camera drifts and nearer birds move more.
//
//   const src = flockSource(f, { k (shot progress), drift, seed })    -> a brush Source (R, G, B, depth, matte, sky, mat)

import { clamp, lerp, hash3 } from '../brush/util.js';
import { analysisSize } from '../brush/index.js';

const TAU = Math.PI * 2;
export function flockList(seed = 11, n = 36) {
  const out = [];
  for (let j = 0; j < n; j++) {
    const h = q => hash3(j, q, seed);
    // a band from lower left to upper right, passing the corona; depth sets size and parallax
    const s = h(1), along = s, off = (h(2) - .5) * .5 * (1 - .4 * Math.abs(s - .45));
    const x = lerp(-.05, 1.05, along) + off * .25, y = lerp(.9, .08, along) + off;
    const z = .25 + .75 * Math.pow(h(3), 1.6);
    out.push({ x, y, z, head: -.35 + (h(4) - .5) * 1.1, phase: h(5), kind: h(6) < .62 ? 'swallow' : 'dove', flip: h(7) < .5, tilt: (h(8) - .5) * .7, seed: j });
  }
  return out.sort((a, b) => a.z - b.z);              // far first
}

// one bird into a 2D context: (x, y) px, span px (wingtip to wingtip when spread), heading rad (screen), wing phase 0..1
// (0 up, .5 level, 1 down), kind; fills with `col` (the caller passes white for the matte, grey for the base)
function drawBird(g, b, x, y, span, col, lines) {
  const ph = b.phase, up = Math.cos(ph * TAU);           // +1 wings raised, -1 lowered
  const sw = b.kind === 'swallow';
  const L = span * (sw ? .36 : .4), bw = span * (sw ? .055 : .085);
  g.save(); g.translate(x, y); g.rotate(b.head); if (b.flip) g.scale(1, -1);
  g.fillStyle = col; g.strokeStyle = col;
  // body: a tapered spindle along +x (head forward)
  g.beginPath();
  g.moveTo(L * .55, 0);
  g.bezierCurveTo(L * .45, -bw * 1.1, -L * .2, -bw, -L * .45, -bw * .35);
  g.lineTo(-L * .45, bw * .35);
  g.bezierCurveTo(-L * .2, bw, L * .45, bw * 1.1, L * .55, 0);
  g.fill();
  // head
  g.beginPath(); g.arc(L * .5, 0, bw * (sw ? .9 : 1.05), 0, TAU); g.fill();
  // tail: a deep fork (swallow) or a fan (dove)
  g.beginPath();
  if (sw) { g.moveTo(-L * .4, -bw * .3); g.lineTo(-L * 1.05, -bw * 1.6); g.lineTo(-L * .62, 0); g.lineTo(-L * 1.05, bw * 1.6); g.lineTo(-L * .4, bw * .3); }
  else { g.moveTo(-L * .4, -bw * .4); g.quadraticCurveTo(-L * .85, -bw * 1.9, -L * .95, -bw * .2); g.quadraticCurveTo(-L * .98, 0, -L * .95, bw * .2); g.quadraticCurveTo(-L * .85, bw * 1.9, -L * .4, bw * .4); }
  g.fill();
  // wings: the near one full, the far one foreshortened by the wingbeat; swept back
  for (const side of [-1, 1]) {
    const fore = side < 0 ? 1 : lerp(.45, 1, .5 + .5 * Math.abs(up)) * (1 - .25 * b.tilt * side);
    const reach = span * .5 * fore * (side < 0 ? lerp(.55, 1, .5 + .5 * Math.abs(up)) : 1);
    const sweep = sw ? .55 : .3, rootF = L * .18, rootB = -L * .12;
    const tipX = -reach * sweep * (1.1 - .3 * up), tipY = side * reach * (.8 + .2 * up);
    g.beginPath();
    g.moveTo(rootF, side * bw * .6);
    if (sw) {
      g.bezierCurveTo(rootF + reach * .15, side * reach * .45, tipX * .4, tipY * .95, tipX, tipY);
      g.bezierCurveTo(tipX * .6, tipY * .7, rootB, side * reach * .25, rootB, side * bw * .5);
    } else {
      g.bezierCurveTo(rootF + reach * .2, side * reach * .5, tipX * .5 + reach * .05, tipY * 1.02, tipX, tipY);
      // the trailing edge of a dove's wing: a few broad primaries
      const n = 4; let px = tipX, py = tipY;
      for (let q = 1; q <= n; q++) { const t = q / n, ex = lerp(tipX, rootB, t), ey = lerp(tipY, side * bw * .5, t) * (1 - .12 * Math.sin(t * Math.PI)); g.quadraticCurveTo((px + ex) / 2 + reach * .04, (py + ey) / 2 - side * reach * .05, ex, ey); px = ex; py = ey; }
    }
    g.fill();
    if (lines) {                                           // carved feather lines (the stone's detail)
      g.save(); g.globalAlpha = .55; g.lineWidth = Math.max(.6, span * .006); g.strokeStyle = lines;
      for (let q = 1; q <= (sw ? 3 : 5); q++) { const t = q / (sw ? 4 : 6); g.beginPath(); g.moveTo(lerp(rootF, rootB, t), side * bw * .6); g.lineTo(lerp(tipX, rootB, t * .7) * (1 - .1 * t), lerp(tipY, side * bw, t * .6)); g.stroke(); }
      g.restore();
    }
  }
  g.restore();
}

// the flock as a brush Source at analysis resolution
const _c = { c: null, g: null, c2: null, g2: null };
export function flockSource(f, o = {}) {
  const [aw, ah] = analysisSize(f.W, f.H), N = aw * ah, S = f.W / aw;
  if (!_c.c || _c.c.width !== aw || _c.c.height !== ah) {
    _c.c = new OffscreenCanvas(aw, ah); _c.g = _c.c.getContext('2d', { willReadFrequently: true });
    _c.c2 = new OffscreenCanvas(aw, ah); _c.g2 = _c.c2.getContext('2d', { willReadFrequently: true });
  }
  const g = _c.g, g2 = _c.g2, list = flockList(o.seed ?? 11, o.n ?? 36), k = o.k ?? 0, drift = o.drift ?? [-.045, .012];
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, aw, ah);
  g2.setTransform(1, 0, 0, 1, 0, 0); g2.fillStyle = '#000'; g2.fillRect(0, 0, aw, ah);
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N), depth = new Float32Array(N), matte = new Float32Array(N), mx = new Float32Array(N), my = new Float32Array(N);
  for (let i = 0; i < N; i++) { mx[i] = (i % aw) * S; my[i] = Math.floor(i / aw) * S; }
  // birds far to near; each drawn into the matte canvas (white) and the base canvas (stone grey, carved lines)
  const birds = [];
  list.forEach((b, j) => {
    const span = (.028 + .085 * b.z) * aw * (o.scale ?? 1);
    const x = (b.x + drift[0] * b.z * k) * aw, y = (b.y + drift[1] * b.z * k) * ah;
    const x0 = b.x * aw, y0 = b.y * ah;                  // where it was on the shot's first drawing (material space)
    if (x < -span || x > aw + span || y < -span || y > ah + span) return;
    birds.push({ b, x, y, span, dx: (x - x0) * S, dy: (y - y0) * S, z: b.z });
  });
  for (const q of birds) {
    // id pass: draw this bird alone, record its pixels (near birds overwrite far ones)
    g2.fillStyle = '#000'; g2.fillRect(Math.max(0, q.x - q.span), Math.max(0, q.y - q.span), q.span * 2, q.span * 2);
    drawBird(g2, q.b, q.x, q.y, q.span, '#fff', null);
    drawBird(g, q.b, q.x, q.y, q.span, `rgb(${190 + 30 * q.z | 0},${188 + 30 * q.z | 0},${184 + 30 * q.z | 0})`, '#5c5d61');
    const x0 = Math.max(0, Math.floor(q.x - q.span)), y0 = Math.max(0, Math.floor(q.y - q.span)), x1 = Math.min(aw, Math.ceil(q.x + q.span)), y1 = Math.min(ah, Math.ceil(q.y + q.span));
    if (x1 <= x0 || y1 <= y0) continue;
    const d = g2.getImageData(x0, y0, x1 - x0, y1 - y0).data, w = x1 - x0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const a = d[((yy - y0) * w + (xx - x0)) * 4] / 255; if (a < .02) continue;
      const i = yy * aw + xx;
      if (a > matte[i] * .5) { depth[i] = .45 + .5 * q.z; mx[i] = xx * S - q.dx + 5000 * (q.b.seed + 1); my[i] = yy * S - q.dy; }
      matte[i] = Math.max(matte[i], a);
    }
  }
  const d = g.getImageData(0, 0, aw, ah).data;
  for (let i = 0; i < N; i++) { R[i] = d[i * 4] / 255; G[i] = d[i * 4 + 1] / 255; B[i] = d[i * 4 + 2] / 255; }
  const sky = new Float32Array(N); for (let i = 0; i < N; i++) sky[i] = 1 - matte[i];
  return { aw, ah, R, G, B, depth, matte, sky, faces: [], mat: { mx, my }, key: `flock|${f.t.toFixed(4)}|${aw}`, info: { kind: 'flock' } };
}
