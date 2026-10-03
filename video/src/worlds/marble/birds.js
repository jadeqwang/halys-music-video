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
    const z = j < 3 ? 1.35 + .35 * h(3) : .25 + .75 * Math.pow(h(3), 1.6);
    out.push({ x, y, z, head: -.35 + (h(4) - .5) * 1.1, phase: h(5), kind: h(6) < .62 ? 'swallow' : 'dove', flip: h(7) < .5, tilt: (h(8) - .5) * .7, seed: j });
  }
  return out.sort((a, b) => a.z - b.z);              // far first
}

// one bird into a 2D context, built in a tiny 3-D frame (forward f, right r, up u) and projected: the heading turns
// the bird in the picture, the roll shows it from below (wings spread) or from the side (wings up / down), and the
// wingbeat phase sets the wing elevation with a bend at the wrist (the M of a raised wing, the flat V of a glide).
// (x, y) px, span px (tip to tip), fills with `col`; `lines` adds carved feather lines (the stone's detail)
function drawBird(g, b, x, y, span, col, lines) {
  const sw = b.kind === 'swallow', ph = b.phase;
  const elev0 = Math.sin(ph * TAU) * .62 + .12, bend = -Math.sin(ph * TAU) * .7 + .15;   // radians: shoulder lift, wrist bend
  const hd = b.head, roll = b.tilt * .9 + (b.flip ? .42 : -.42);
  const fx = Math.cos(hd), fy = Math.sin(hd), px = -fy, py = fx;                     // forward and perpendicular in the picture
  const rr = Math.cos(roll), ru = Math.sin(roll);                                    // how much "right" and "up" project onto the perpendicular
  const P = (af, ar, au) => [x + fx * af + px * (ar * rr + au * ru), y + fy * af + py * (ar * rr + au * ru)];
  const L = span * (sw ? .19 : .23), half = span * .5, chord = span * (sw ? .12 : .19), sweep = sw ? .5 : .22;
  g.save(); g.fillStyle = col; g.strokeStyle = col; g.lineJoin = 'round';
  // the wings: leading edge out to the tip, trailing edge back (pointed for swallows, fingered for doves)
  for (const side of [-1, 1]) {
    const lead = [], trail = [];
    for (let q = 0; q <= 10; q++) {
      const sq = q / 10, el = elev0 + (sq > .45 ? bend * (sq - .45) * 1.8 : 0);
      const ar = side * half * sq * Math.cos(el), au = half * sq * Math.sin(el), af = L * .12 - sweep * half * sq * sq;
      lead.push(P(af, ar, au));
      const c = chord * (sw ? (1 - .92 * sq) : (1 - .45 * sq) * (sq > .8 ? 1 - (sq - .8) * 2.5 : 1));
      trail.push(P(af - c, ar * (1 - .03 * sq), au));
    }
    g.beginPath(); g.moveTo(...lead[0]);
    for (const p of lead) g.lineTo(...p);
    if (!sw) { const tp = lead[10], tq = trail[8]; for (let k = 1; k <= 3; k++) { const t2 = k / 4; g.lineTo(lerp(tp[0], tq[0], t2) + (k % 2 ? 1 : -1) * span * .006, lerp(tp[1], tq[1], t2)); } }
    for (let q = 10; q >= 0; q--) g.lineTo(...trail[q]);
    g.closePath(); g.fill();
    if (lines) {
      g.save(); g.globalAlpha = .5; g.lineWidth = Math.max(.6, span * .005); g.strokeStyle = lines;
      for (let k = 1; k <= (sw ? 3 : 4); k++) { const q = 3 + k * 1.6 | 0, a = lead[Math.min(10, q)], c = trail[Math.min(10, q)]; g.beginPath(); g.moveTo(...a); g.lineTo(lerp(a[0], c[0], .9), lerp(a[1], c[1], .9)); g.stroke(); }
      g.restore();
    }
  }
  // body: a spindle along the heading, the head forward, the tail behind (a fork or a fan)
  const bw = span * (sw ? .04 : .06);
  g.beginPath();
  const body = []; for (let q = 0; q <= 12; q++) { const a = q / 12 * TAU, r = (Math.cos(a) > 0 ? L * .55 : L * .45); body.push(P(Math.cos(a) * r, Math.sin(a) * bw * (1 - .4 * Math.max(0, -Math.cos(a))), 0)); }
  g.moveTo(...body[0]); for (const p of body) g.lineTo(...p); g.fill();
  g.beginPath(); { const c = P(L * .55, 0, 0); g.arc(c[0], c[1], bw * (sw ? .95 : 1.1), 0, TAU); } g.fill();
  g.beginPath();
  if (sw) { const a = P(-L * .4, -bw * .3, 0), b2 = P(-L * 1.25, -bw * 2.4, 0), c = P(-L * .72, 0, 0), d = P(-L * 1.25, bw * 2.4, 0), e = P(-L * .4, bw * .3, 0); g.moveTo(...a); g.lineTo(...b2); g.lineTo(...c); g.lineTo(...d); g.lineTo(...e); }
  else { const a = P(-L * .38, -bw * .45, 0), b2 = P(-L * .92, -bw * 1.5, 0), c = P(-L * 1.0, 0, 0), d = P(-L * .92, bw * 1.5, 0), e = P(-L * .38, bw * .45, 0); g.moveTo(...a); g.quadraticCurveTo(...b2, ...c); g.quadraticCurveTo(...d, ...e); }
  g.fill();
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
    const span = (.032 + .09 * b.z) * aw * (o.scale ?? 1);
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
