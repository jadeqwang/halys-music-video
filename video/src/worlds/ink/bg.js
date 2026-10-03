// bg.js: the painted background. INK backgrounds are flat-shape paintings: hard-edged washes, no depth-of-field blur, no
// Ghibli gradients, no yellow cast, no saturated blue (STYLE_BIBLE). Built once per setup (cached), held for the whole
// shot like a real background painting under the cels.
//
//   1. clean plate: every listed frame of the setup's plates, in setup space, where her (dilated) matte says "room";
//      averaged per pixel; what she always covers is filled by push-pull from around it
//   2. flat shapes: OKLab, edge-preserving smoothing, k-means into ~16 colours, a majority filter and island merging, so
//      the room becomes a few dozen clean flat shapes (the shapes follow the room's edges, not the generator's blur)
//   3. colour design: every shape's colour graded into the night palette (blue chroma clamped to navy-black, warm lamp
//      light kept, whites neutral), then drawn through the same antialiased label renderer as the cels
// Procedural parts (window, screens, props) are drawn over it by the scene (props.js).

import { setupFrame } from './source.js';
import { S2L, lin2oklab, oklab2hex, gradeRoom } from './palette.js';
import { bilateral3, boxBlur, modeFilter, cleanSmall, felzenszwalb, gauss, thin, traceSkeleton, smoothPts, resample } from './img.js';
import { drawFills, drawChains } from './render.js';
import { makeCanvas } from '../../assets.js';

// push-pull hole filling: values v (n channels interleaved, W x H) with weights w (0/1)
function pushPull(chans, w, W, H) {
  const levels = [{ W, H, c: chans, w }];
  while (levels[levels.length - 1].W > 4 && levels[levels.length - 1].H > 4) {
    const P = levels[levels.length - 1], w2 = Math.ceil(P.W / 2), h2 = Math.ceil(P.H / 2);
    const c2 = P.c.map(() => new Float32Array(w2 * h2)), ww = new Float32Array(w2 * h2);
    for (let y = 0; y < P.H; y++) for (let x = 0; x < P.W; x++) {
      const i = y * P.W + x, j = (y >> 1) * w2 + (x >> 1), k = P.w[i];
      if (!k) continue; ww[j] += k; for (let c = 0; c < c2.length; c++) c2[c][j] += P.c[c][i] * k;
    }
    for (let j = 0; j < w2 * h2; j++) if (ww[j] > 0) { for (let c = 0; c < c2.length; c++) c2[c][j] /= ww[j]; ww[j] = Math.min(1, ww[j]); }
    levels.push({ W: w2, H: h2, c: c2, w: ww });
  }
  for (let l = levels.length - 2; l >= 0; l--) {
    const P = levels[l], Q = levels[l + 1];
    for (let y = 0; y < P.H; y++) for (let x = 0; x < P.W; x++) {
      const i = y * P.W + x; if (P.w[i] >= 1) continue;
      const j = Math.min(Q.H - 1, y >> 1) * Q.W + Math.min(Q.W - 1, x >> 1), k = P.w[i];
      for (let c = 0; c < P.c.length; c++) P.c[c][i] = P.c[c][i] * k + Q.c[c][j] * (1 - k);
      P.w[i] = 1;
    }
  }
  return levels[0].c;
}

function dilate(m, W, H, r) {
  const b = boxBlur(m, W, H, r), out = new Float32Array(W * H);
  for (let i = 0; i < out.length; i++) out[i] = b[i] > .02 ? 1 : 0;
  return out;
}

// deterministic k-means in OKLab (lightness weighted)
function kmeans(L, A, B, N, K, step = 5, iters = 14, wL = 1.6) {
  const idx = []; for (let i = 0; i < N; i += step) idx.push(i);
  const sorted = idx.slice().sort((a, b) => L[a] - L[b]);
  let cen = Array.from({ length: K }, (_, k) => { const i = sorted[Math.floor((k + .5) / K * sorted.length)]; return [L[i], A[i], B[i]]; });
  for (let it = 0; it < iters; it++) {
    const acc = cen.map(() => [0, 0, 0, 0]);
    for (const i of idx) {
      let b = 0, bd = 1e9;
      for (let k = 0; k < K; k++) { const c = cen[k], d = wL * (L[i] - c[0]) ** 2 + (A[i] - c[1]) ** 2 + (B[i] - c[2]) ** 2; if (d < bd) { bd = d; b = k; } }
      const a = acc[b]; a[0] += L[i]; a[1] += A[i]; a[2] += B[i]; a[3]++;
    }
    cen = cen.map((c, k) => acc[k][3] ? [acc[k][0] / acc[k][3], acc[k][1] / acc[k][3], acc[k][2] / acc[k][3]] : c);
  }
  return cen;
}

const _bg = new Map();
// point in polygon (setup px)
function inPoly(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// cfg: { frames: [{src, pf, tier}], zone: polygon (setup px) where her matte may exclude pixels, K, gain, dark, seg: [k, minSize] }
// Lower tiers fill first; a higher tier only fills pixels no lower tier saw (P39 is the room; P40 fills behind her).
export async function paintBG(S, cfg) {
  const key = `${S.id}|${JSON.stringify(cfg)}`;
  if (_bg.has(key)) return _bg.get(key);
  const p = (async () => {
    const W = S.w, H = S.h, N = W * H;
    const R = new Float32Array(N), G = new Float32Array(N), Bc = new Float32Array(N), wv = new Float32Array(N);
    const tiers = [...new Set(cfg.frames.map(f => f.tier || 0))].sort();
    const zone = new Uint8Array(N);
    if (cfg.zone) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) zone[y * W + x] = inPoly(cfg.zone, x, y) ? 1 : 0;
    for (const tier of tiers) {
      const sr = new Float32Array(N), sg = new Float32Array(N), sb = new Float32Array(N), sw = new Float32Array(N);
      for (const fr of cfg.frames.filter(f => (f.tier || 0) === tier)) {
        const F = await setupFrame(S, fr.src, fr.pf); if (!F) continue;
        const m = F.matte ? dilate(F.matte.map(v => v > .25 ? 1 : 0), W, H, cfg.dilate ?? 4) : null;
        const gain = cfg.gain ?? 1;
        for (let i = 0; i < N; i++) {
          if (zone[i] && (!m || m[i] > 0)) continue;            // her (inside the zone, under the matte)
          if (fr.zoneOnly && !zone[i]) continue;
          sr[i] += S2L[F.rgba[i * 4]] * gain; sg[i] += S2L[F.rgba[i * 4 + 1]] * gain; sb[i] += S2L[F.rgba[i * 4 + 2]] * gain; sw[i]++;
        }
      }
      for (let i = 0; i < N; i++) if (!wv[i] && sw[i]) { R[i] = sr[i] / sw[i]; G[i] = sg[i] / sw[i]; Bc[i] = sb[i] / sw[i]; wv[i] = 1; }
    }
    if (!wv.some(v => v > 0)) { wv.fill(1); R.fill(.012); G.fill(.014); Bc.fill(.022); }     // no source at all: a flat night wall
    const [R2, G2, B2] = pushPull([R, G, Bc], wv, W, H);
    let L = new Float32Array(N), A = new Float32Array(N), B = new Float32Array(N);
    for (let i = 0; i < N; i++) { const o = lin2oklab(Math.min(1, R2[i]), Math.min(1, G2[i]), Math.min(1, B2[i])); L[i] = o[0]; A[i] = o[1]; B[i] = o[2]; }
    // the room's drawn outlines (the plate's BG is line-and-wash anime art, like the art department's boards): dark ridges
    // of the lightly smoothed clean plate, long chains only, outside her zone and the procedural parts
    const lines = cfg.lines === false ? [] : bgLines(L, W, H, zone, cfg);
    for (let k = 0; k < (cfg.smooth ?? 2); k++) [L, A, B] = bilateral3(L, A, B, W, H, 3, 2.2, .04);
    // edge-aligned segments, each flattened to its median colour, then the segment colours clustered into K paints
    const [sk, smin] = cfg.seg || [.3, 60];
    const seg = felzenszwalb(L, A, B, W, H, sk, smin, 1.4, 1.4);
    const n = seg.n, cnt = new Float32Array(n), sl = new Float32Array(n), sa = new Float32Array(n), sbb = new Float32Array(n);
    for (let i = 0; i < N; i++) { const r = seg.lab[i]; cnt[r]++; sl[r] += L[i]; sa[r] += A[i]; sbb[r] += B[i]; }
    for (let r = 0; r < n; r++) { sl[r] /= cnt[r]; sa[r] /= cnt[r]; sbb[r] /= cnt[r]; }
    const K = Math.min(cfg.K || 18, 20);
    const cen = kmeansW(sl, sa, sbb, cnt, n, K);
    const segK = new Uint8Array(n);
    for (let r = 0; r < n; r++) { let b = 0, bd = 1e9; for (let k = 0; k < K; k++) { const c = cen[k], d = 1.6 * (sl[r] - c[0]) ** 2 + (sa[r] - c[1]) ** 2 + (sbb[r] - c[2]) ** 2; if (d < bd) { bd = d; b = k; } } segK[r] = b; }
    let lab = new Uint8Array(N);
    for (let i = 0; i < N; i++) lab[i] = segK[seg.lab[i]];
    lab = modeFilter(lab, W, H, 1, K, null, 1);
    lab = cleanSmall(lab, W, H, cfg.minArea ?? 40, K);
    const grade = cfg.grade || gradeRoom, dark = cfg.dark ?? .92;
    const pal = cen.map(c => { const g = grade(c); return oklab2hex(g[0] * dark, g[1], g[2]); });
    return { W, H, lab, pal, cen, nSeg: n, lines };
  })();
  _bg.set(key, p);
  return p;
}

function bgLines(L, W, H, zone, cfg) {
  const N = W * H, g1 = gauss(L, W, H, .9), g2 = gauss(L, W, H, 2.4), R = new Float32Array(N);
  const skip = new Uint8Array(N);
  for (const q of cfg.noLines || []) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inPoly(q, x, y)) skip[y * W + x] = 1;
  for (let i = 0; i < N; i++) R[i] = zone[i] || skip[i] ? 0 : Math.max(0, g2[i] - g1[i]);
  const hi = cfg.lineHi ?? .05, lo = cfg.lineLo ?? .028, keep = new Uint8Array(N), stack = [];
  for (let i = 0; i < N; i++) if (R[i] > hi) { keep[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop(), x = i % W, y = (i / W) | 0;
    for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const xx = x + k, yy = y + j; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const q = yy * W + xx; if (!keep[q] && R[q] > lo) { keep[q] = 1; stack.push(q); }
    }
  }
  thin(keep, W, H);
  const out = [];
  for (const ch of traceSkeleton(keep, W, H, 3)) {
    let len = 0; for (let k = 1; k < ch.pts.length; k++) len += Math.hypot(ch.pts[k][0] - ch.pts[k - 1][0], ch.pts[k][1] - ch.pts[k - 1][1]);
    if (len < (cfg.lineMin ?? 16)) continue;
    let st = 0; for (const [x, y] of ch.pts) st += R[Math.round(y) * W + Math.round(x)]; st /= ch.pts.length;
    out.push({ pts: smoothPts(resample(ch.pts, 1), 1.3, !!ch.closed), kind: 'bg', w: .7 + Math.min(1, (st - lo) / (hi * 2)) * .8, col: 'bg' });
  }
  return out;
}

// k-means over weighted points (segment colours, weighted by area); deterministic init by lightness quantiles
function kmeansW(L, A, B, w, n, K, iters = 16, wL = 1.6) {
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => L[a] - L[b]);
  const tot = w.reduce((s, v) => s + v, 0);
  let cen = [], acc = 0, j = 0;
  for (let k = 0; k < K; k++) { const target = (k + .5) / K * tot; while (j < n - 1 && acc + w[idx[j]] < target) { acc += w[idx[j]]; j++; } const i = idx[j]; cen.push([L[i], A[i], B[i]]); }
  for (let it = 0; it < iters; it++) {
    const s = cen.map(() => [0, 0, 0, 0]);
    for (let r = 0; r < n; r++) {
      let b = 0, bd = 1e9;
      for (let k = 0; k < K; k++) { const c = cen[k], d = wL * (L[r] - c[0]) ** 2 + (A[r] - c[1]) ** 2 + (B[r] - c[2]) ** 2; if (d < bd) { bd = d; b = k; } }
      const q = s[b]; q[0] += L[r] * w[r]; q[1] += A[r] * w[r]; q[2] += B[r] * w[r]; q[3] += w[r];
    }
    cen = cen.map((c, k) => s[k][3] ? [s[k][0] / s[k][3], s[k][1] / s[k][3], s[k][2] / s[k][3]] : c);
  }
  return cen;
}

// draw the painted background into g through view (analysis px -> output px); cached per output size and view
const _drawn = new Map();
export function drawBG(g, bg, view) {
  const W = g.canvas.width, H = g.canvas.height, k = `${W}x${H}|${view.ox.toFixed(2)},${view.oy.toFixed(2)},${view.s.toFixed(4)}|${bg.pal.join()}`;
  let c = _drawn.get(bg) && _drawn.get(bg).get(k);
  if (!c) {
    c = makeCanvas(W, H);
    const cg = c.getContext('2d');
    bg.packed = drawFills(cg, bg.lab, bg.W, bg.H, bg.pal, bg.pal.map(() => 1), view, { packed: bg.packed });
    if (bg.lines && bg.lines.length) drawChains(cg, bg.lines, view, H / 1080, { bg: '#0b0d13', ink: '#0b0d13' });
    if (!_drawn.has(bg)) _drawn.set(bg, new Map());
    _drawn.get(bg).set(k, c);
  }
  g.drawImage(c, 0, 0);
}
