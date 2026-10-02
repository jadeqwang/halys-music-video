// bronze.js: BRONZE, Baroque oil paint with designed tenebrism.
//
// 1. reference(): the plate's colour is re-lit by a per-shot light pool (outside it values crush to warm near-black,
//    only rim glints survive; inside, warm high-key light), then forced into a fixed palette box (ten tubes, no blue).
// 2. strokes(): Hertzmann-style coarse-to-fine painting. For each brush (big to small) the reference is blurred to the
//    brush's scale; wherever a virtual canvas (CPU, analysis res) still differs from it by more than a threshold, a curved
//    stroke starts at the worst pixel and follows the flow field (tangent to edges), ending when it would paint the wrong
//    colour. Faces/hands (focus) lower the threshold so the small brushes work there; darkness raises it.
//    Layout is anchored to brush grids with region-stable seeds; each drawing (12 per second) re-jitters by `boil`,
//    so strokes shimmer but never strobe.
// 3. render(): strokes become textured ribbons on the GPU (bristle streaks, dry-brush tails, two-tone loads) writing
//    colour and paint height (MRT). A finishing pass lights the height from the upper left (impasto), adds canvas weave
//    where paint is thin, craquelure in the darks and a warm varnish.

import { W, H, clamp, lerp, sstep, hash, hash3, hash4, shuffle, srgb2oklab, oklab2srgb, PaletteBox, BRONZE_PALETTE } from './core.js';
import { blur, samp, flowAt, ellipseMask } from './analysis.js';
import { GLSL_COMMON, noiseTexture } from './gl.js';

let PAL = null;
export const palette = () => (PAL ??= new PaletteBox(Object.values(BRONZE_PALETTE), { white: 6, black: 0, wL: 2.4, wC: 1 }));

export const BRONZE_DEFAULTS = {
  pool: [{ x: .5, y: .45, rx: .3, ry: .35, rot: 0, feather: .6 }],
  poolMatte: .85, poolBound: null, poolBlur: 7,
  gammaIn: .9, liftIn: 1.06, satIn: 1.05, crushFloor: .14, crush: .2, satOut: .45, glint: .9, glintT: .6,
  // brushes (screen px radius), grid factor, threshold, stroke lengths (control points), curvature filter
  brushes: [26, 14, 8, 4.6, 2.7], fg: [1.45, 1.25, 1.1, 1.0, 1.0], T: [0, .055, .06, .065, .075],
  minLen: [2, 2, 2, 1, 1], maxLen: [6, 6, 5, 5, 4], step: [.9, .85, .8, .75, .75], fc: .62, fs: .5,
  jitter: .8, boil: .3, colorJit: .035, focusGain: .65, darkRaise: 1.7,
  thick: .45, thickHi: .9, impasto: 1.15, spec: .22, weave: 1, crack: .55, varnish: 1, vignette: .4,
  accents: 1, ground: [.105, .075, .05], seed: 7
};

// ---------------------------------------------------------------- 1. reference
export function reference(F, cfg) {
  const { aw, ah, N } = F, P = palette();
  let pool = new Float32Array(N);
  for (const e of cfg.pool) { const m = ellipseMask(F, e), k = e.k ?? 1; for (let i = 0; i < N; i++) pool[i] = Math.max(pool[i], m[i] * k); }
  if (F.M && cfg.poolMatte) {
    const mb = blur(F.M, aw, ah, 2.5), bound = cfg.poolBound ? ellipseMask(F, cfg.poolBound) : null;
    for (let i = 0; i < N; i++) pool[i] = Math.max(pool[i], mb[i] * cfg.poolMatte * (bound ? bound[i] : 1));
  }
  pool = blur(pool, aw, ah, cfg.poolBlur);
  let focus = new Float32Array(N);
  for (const e of cfg.focus || []) { const m = ellipseMask(F, e); for (let i = 0; i < N; i++) focus[i] = Math.max(focus[i], m[i] * (e.k ?? 1)); }
  focus = blur(focus, aw, ah, 3);
  const Lb = blur(F.L, aw, ah, 5);
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N), Lr = new Float32Array(N), tmp = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    let [Lk, a, b] = srgb2oklab(F.R[i], F.G[i], F.B[i]);
    const p = pool[i];
    const Lin = clamp(Math.pow(Lk, cfg.gammaIn) * cfg.liftIn);
    const lc = F.L[i] - Lb[i];
    const glint = sstep(cfg.glintT, cfg.glintT + .22, Lk) * sstep(.02, .12, lc) * cfg.glint;
    const Lout = cfg.crushFloor + cfg.crush * Math.pow(Lk, 1.4) + glint * (Lk - cfg.crushFloor) * .8;
    const L2 = lerp(Lout, Lin, p);
    const sat = lerp(cfg.satOut, cfg.satIn, p);
    a = a * sat + lerp(.01, .004, p); b = b * sat + lerp(.022, .012, p);    // warm bias: umber in the dark, golden in the light
    const c = oklab2srgb(L2, a, b);
    P.map(c[0], c[1], c[2], tmp);
    R[i] = tmp[0]; G[i] = tmp[1]; B[i] = tmp[2]; Lr[i] = .2126 * tmp[0] + .7152 * tmp[1] + .0722 * tmp[2];
  }
  return { R, G, B, L: Lr, pool, focus };
}

// ---------------------------------------------------------------- 2. strokes
// returns [{pts:[[x,y]...] (screen px), r (radius px), c0, c1 (rgb), a, thick, seed, layer}]
export function strokes(F, ref, cfg, drawIdx = 0) {
  const { aw, ah, N } = F, S = W / aw;
  const cR = new Float32Array(N), cG = new Float32Array(N), cB = new Float32Array(N), painted = new Uint8Array(N);
  const out = [], v = [0, 0, 0];
  const seed = cfg.seed | 0, boilSeed = seed * 131 + drawIdx * 7919 + 1;
  for (let li = 0; li < cfg.brushes.length; li++) {
    const Rs = cfg.brushes[li], Ra = Rs / S, sig = Math.max(.6, cfg.fs * Ra * 1.6);
    const rb = blur(ref.R, aw, ah, sig), gb = blur(ref.G, aw, ah, sig), bb = blur(ref.B, aw, ah, sig);
    const D = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (!painted[i]) { D[i] = 9; continue; }
      const dr = cR[i] - rb[i], dg = cG[i] - gb[i], db = cB[i] - bb[i]; D[i] = Math.sqrt(dr * dr + dg * dg + db * db);
    }
    const grid = Math.max(1, cfg.fg[li] * Ra), J = Rs >= 12 ? F.Jc : F.J;
    const T0 = cfg.T[li], layer = [];
    const nx = Math.ceil(aw / grid), ny = Math.ceil(ah / grid);
    for (let cy = 0; cy < ny; cy++) for (let cx = 0; cx < nx; cx++) {
      const jx = (hash4(cx, cy, li, seed) - .5) * cfg.jitter + (hash4(cx, cy, li, boilSeed) - .5) * cfg.boil * 2;
      const jy = (hash4(cy, cx, li, seed + 3) - .5) * cfg.jitter + (hash4(cy, cx, li, boilSeed + 3) - .5) * cfg.boil * 2;
      const gx = (cx + .5 + jx * .5) * grid, gy = (cy + .5 + jy * .5) * grid;
      const x0 = Math.max(0, Math.floor(gx - grid / 2)), x1 = Math.min(aw - 1, Math.ceil(gx + grid / 2));
      const y0 = Math.max(0, Math.floor(gy - grid / 2)), y1 = Math.min(ah - 1, Math.ceil(gy + grid / 2));
      let sum = 0, n = 0, best = -1, bi = -1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * aw + x, d = D[i]; sum += d; n++; if (d > best) { best = d; bi = i; } }
      if (!n) continue;
      const ci = Math.round(gy) * aw + Math.round(gx), ii = ci >= 0 && ci < N ? ci : bi;
      // threshold: focus (faces, hands) lowers it; the dark outside the light pool raises it
      const f = ref.focus[ii], p = ref.pool[ii];
      const T = T0 * (1 - cfg.focusGain * f) * lerp(cfg.darkRaise, 1, p);
      if (li > 0 && sum / n <= T) continue;
      // the finest brush only works where it matters (focus, inside the light, high detail)
      if (li === cfg.brushes.length - 1 && Math.max(f, p * F.detail[ii]) < .25) continue;
      const sx = li === 0 ? gx : bi % aw, sy = li === 0 ? gy : Math.floor(bi / aw);
      const st = traceStroke(F, J, sx, sy, Ra, rb, gb, bb, cR, cG, cB, painted, cfg, li, hash4(cx, cy, li, seed + 11));
      const k = hash4(cx, cy, li, boilSeed + 5), cj = (k - .5) * 2 * cfg.colorJit;
      const c0 = [clamp(st.c[0] * (1 + cj)), clamp(st.c[1] * (1 + cj)), clamp(st.c[2] * (1 + cj * .8))];
      const e = st.pts[st.pts.length - 1];
      const c1e = [samp(F, rb, e[0], e[1]), samp(F, gb, e[0], e[1]), samp(F, bb, e[0], e[1])];
      const lum = .2126 * c0[0] + .7152 * c0[1] + .0722 * c0[2];
      const thick = (cfg.thick * lerp(.35, 1, p) + cfg.thickHi * sstep(.55, .9, lum) * p) * lerp(1.15, .75, li / (cfg.brushes.length - 1));
      layer.push({ pts: st.pts.map(([x, y]) => [x * S, y * S]), apts: st.pts, ra: Ra, r: Rs * (.92 + .16 * hash4(cx, cy, li, seed + 13)), c0, c1: [lerp(c0[0], c1e[0], .45), lerp(c0[1], c1e[1], .45), lerp(c0[2], c1e[2], .45)], a: .93 + .07 * k, thick, seed: hash4(cx, cy, li, seed + 17), layer: li });
    }
    shuffle(layer, seed * 31 + li);
    for (const s of layer) paintVirtual(s, F, cR, cG, cB, painted);
    for (const s of layer) out.push(s);
  }
  if (cfg.accents) out.push(...accents(F, ref, cfg, drawIdx));
  return out;
}

function traceStroke(F, J, x0, y0, Ra, rb, gb, bb, cR, cG, cB, painted, cfg, li, h) {
  const aw = F.aw, c = [samp(F, rb, x0, y0), samp(F, gb, x0, y0), samp(F, bb, x0, y0)];
  const pts = [[x0, y0]], v = [0, 0, 0];
  let x = x0, y = y0, ldx = 0, ldy = 0;
  const maxL = cfg.maxLen[li], minL = cfg.minLen[li], step = Ra * 2 * cfg.step[li] * .5 * 1.6;
  for (let k = 1; k <= maxL; k++) {
    if (k > minL) {
      const xi = Math.round(x), yi = Math.round(y), i = yi * aw + xi;
      const r = rb[i], g = gb[i], b = bb[i];
      const dS = Math.hypot(r - c[0], g - c[1], b - c[2]);
      const dC = painted[i] ? Math.hypot(r - cR[i], g - cG[i], b - cB[i]) : 9;
      if (dC < dS) break;
    }
    flowAt(F, x, y, v, J);
    let dx = v[0], dy = v[1];
    if (k === 1) { if (h < .5) { dx = -dx; dy = -dy; } }
    else {
      if (dx * ldx + dy * ldy < 0) { dx = -dx; dy = -dy; }
      dx = cfg.fc * dx + (1 - cfg.fc) * ldx; dy = cfg.fc * dy + (1 - cfg.fc) * ldy;
      const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
    }
    const nx2 = x + dx * step, ny2 = y + dy * step;
    if (nx2 < 0 || ny2 < 0 || nx2 > F.aw - 1 || ny2 > F.ah - 1) break;
    x = nx2; y = ny2; ldx = dx; ldy = dy; pts.push([x, y]);
  }
  if (pts.length === 1) { // a dab: give it a short body along the flow
    flowAt(F, x0, y0, v, J); pts.push([x0 + v[0] * step * .6, y0 + v[1] * step * .6]);
  }
  return { pts, c };
}

// rasterise a stroke (capsules along its polyline) into the CPU canvas at analysis res
function paintVirtual(s, F, cR, cG, cB, painted) {
  const aw = F.aw, ah = F.ah, r = s.r / (W / aw), r2 = r * r, P = s.apts, n = P.length;
  for (let k = 0; k < n - 1; k++) {
    const [ax, ay] = P[k], [bx, by] = P[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-6;
    const t0 = k / (n - 1), t1 = (k + 1) / (n - 1);
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r)), x1 = Math.min(aw - 1, Math.ceil(Math.max(ax, bx) + r));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r)), y1 = Math.min(ah - 1, Math.ceil(Math.max(ay, by) + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / L2), qx = ax + dx * t - x, qy = ay + dy * t - y;
      if (qx * qx + qy * qy > r2) continue;
      const u = lerp(t0, t1, t), i = y * aw + x;
      cR[i] = lerp(s.c0[0], s.c1[0], u); cG[i] = lerp(s.c0[1], s.c1[1], u); cB[i] = lerp(s.c0[2], s.c1[2], u); painted[i] = 1;
    }
  }
}

// thick little strokes of lead white / Naples yellow on the hottest highlights inside the light (bronze, blades, eyes)
function accents(F, ref, cfg, drawIdx) {
  const { aw, ah } = F, S = W / aw, out = [], v = [0, 0, 0];
  const Lb = blur(F.L, aw, ah, 3), seed = cfg.seed * 17 + 5;
  const lead = [.937, .902, .824], naples = [.89, .76, .478];
  for (let y = 3; y < ah - 3; y += 2) for (let x = 3; x < aw - 3; x += 2) {
    const i = y * aw + x, p = ref.pool[i];
    if (p < .35) continue;
    const L = F.L[i], lc = L - Lb[i];
    if (L < .62 || lc < .045) continue;
    // local maximum in a 5x5 window
    let isMax = true;
    for (let j = -2; j <= 2 && isMax; j++) for (let k = -2; k <= 2; k++) if (F.L[i + j * aw + k] > L) { isMax = false; break; }
    if (!isMax) continue;
    const h = hash3(x, y, seed), hb = hash4(x, y, seed, drawIdx * 7919 + 3);
    if (h > .55 * cfg.accents) continue;
    flowAt(F, x, y, v, F.J);
    const len = (1.5 + 2.5 * h) * (1 + lc * 4), ang = (hb - .5) * .5;
    const ca = Math.cos(ang), sa = Math.sin(ang), dx = v[0] * ca - v[1] * sa, dy = v[0] * sa + v[1] * ca;
    const warm = F.R[i] - F.B[i] > .12;
    const c = warm ? naples : lead;
    const ox = (hb - .5) * .8, oy = (hash4(x, y, seed + 1, drawIdx) - .5) * .8;
    const a0 = [x + ox - dx * len * .5, y + oy - dy * len * .5], a1 = [x + ox + dx * len * .5, y + oy + dy * len * .5];
    out.push({ pts: [[a0[0] * S, a0[1] * S], [a1[0] * S, a1[1] * S]], apts: [a0, a1], ra: 1, r: (1.6 + 1.6 * h) * (.8 + p * .4), c0: c, c1: lead, a: .97, thick: 1.0 + .6 * p, seed: hash3(x, y, seed + 2), layer: 9 });
  }
  return out;
}

// ---------------------------------------------------------------- 3. render
const STROKE_VS = `#version 300 es
in vec2 aPos; in vec2 aUV; in vec4 aCol; in vec4 aPar;
uniform vec2 uRes;
out vec2 vUV; out vec4 vCol; out vec4 vPar;
void main() { vUV = aUV; vCol = aCol; vPar = aPar; gl_Position = vec4(aPos / uRes * 2.0 - 1.0, 0.0, 1.0); }`;

const STROKE_FS = `#version 300 es
precision highp float;
in vec2 vUV; in vec4 vCol; in vec4 vPar;
uniform sampler2D uNoise;
layout(location = 0) out vec4 oCol;
layout(location = 1) out vec4 oHgt;
void main() {
  float s = vUV.x, v = vUV.y, Lp = vPar.x, hw = vPar.y, seed = vPar.z, thick = vPar.w;
  float ds = s < 0.0 ? -s : (s > Lp ? s - Lp : 0.0);
  // bristles: high frequency across the stroke, long streaks along it
  float nb = max(3.0, hw * 0.9);
  vec2 q = vec2(v * nb * 0.0039 + seed * 7.13, s * 0.0011 / max(hw, 2.0) * 8.0 + seed * 3.7);
  float b1 = texture(uNoise, q).r, b2 = texture(uNoise, q * vec2(2.3, 1.7) + 0.37).g, b3 = texture(uNoise, vec2(v * nb * 0.011 + seed, s * 0.004 + seed)).b;
  float br = b1 * 0.55 + b2 * 0.3 + b3 * 0.15;
  // ragged contour
  float en = texture(uNoise, vec2(s * 0.006 / max(1.0, hw * 0.08) + seed * 5.1, v > 0.0 ? 0.31 : 0.77)).a;
  float r = length(vec2(ds / hw, v));
  float edge = 1.0 - smoothstep(0.78 - 0.18 * en, 1.0 - 0.06 * en, r);
  // dry brush: the load runs out toward the tail, bristles skip
  float u = clamp(s / max(Lp, 1.0), 0.0, 1.0);
  float dry = smoothstep(0.35, 1.1, u) * (0.55 + 0.45 * fract(seed * 13.7));
  float cover = edge * smoothstep(dry - 0.12, dry + 0.12, br * 0.85 + 0.25 * (1.0 - abs(v)));
  float a = cover * vCol.a;
  // streaky value and a second pigment dragged through some bristles
  vec3 col = vCol.rgb * (0.9 + 0.2 * br);
  float streak = smoothstep(0.72, 0.9, b2);
  col = mix(col, col * vec3(1.06, 1.0, 0.9) + 0.04, streak * 0.35);
  oCol = vec4(col * a, a);
  // paint height: loaded at the start, ridges pushed to the sides, grooves between bristles
  float load = mix(1.25, 0.6, smoothstep(0.0, 1.0, u));
  float ridge = smoothstep(0.5, 0.88, r) * (1.0 - smoothstep(0.88, 1.0, r));
  float h = thick * (0.45 + 0.55 * br + 0.45 * ridge) * load;
  oHgt = vec4(h * a, 0.0, 0.0, a * 0.72);
}`;

const POST_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCol, uHgt;
uniform vec2 uRes; uniform vec3 uGround;
uniform float uImpasto, uSpec, uWeave, uCrack, uVarnish, uVignette, uFlip, uMetal;
out vec4 o;
${GLSL_COMMON}
float weave(vec2 p) {
  vec2 q = p / 3.6;
  vec2 c = floor(q), f = fract(q);
  float top = mod(c.x + c.y, 2.0);
  float tx = sin(f.y * 3.14159), ty = sin(f.x * 3.14159);
  float th = mix(tx, ty, top) * (0.75 + 0.5 * vnoise(p * vec2(0.03, 0.7) + c.x));
  return th * (0.8 + 0.4 * vnoise(p * 0.02));
}
float height(vec2 p) {
  float hp = texture(uHgt, p / uRes).r;
  return hp * 2.2 + uWeave * 0.055 * weave(p) * (1.0 - smoothstep(0.0, 0.35, hp));
}
void main() {
  vec2 uv = vUv; if (uFlip > 0.5) uv.y = 1.0 - uv.y;
  vec2 p = uv * uRes;
  vec4 c = texture(uCol, uv);
  vec3 base = c.rgb + uGround * (1.0 - c.a);
  float e = 1.25;
  float hL = height(p - vec2(e, 0)), hR = height(p + vec2(e, 0)), hU = height(p - vec2(0, e)), hD = height(p + vec2(0, e)), h0 = height(p);
  vec3 N = normalize(vec3(-(hR - hL) / (2.0 * e) * 9.0, -(hD - hU) / (2.0 * e) * 9.0, 1.0));
  vec3 Ld = normalize(vec3(-0.62, -0.68, 0.62));
  float dif = dot(N, Ld), flat0 = Ld.z;
  vec3 lin = s2l(base);
  float lum = luma(lin);
  float shade = 1.0 + uImpasto * (dif - flat0) / flat0;
  lin *= clamp(shade, 0.35, 1.9);
  vec3 Hv = normalize(Ld + vec3(0, 0, 1));
  float sp = pow(max(dot(N, Hv), 0.0), 38.0) * uSpec * (0.15 + smoothstep(0.02, 0.5, lum));
  lin += sp * vec3(1.0, 0.92, 0.78);
  // craquelure: an irregular cell network, strongest in the darks, slightly lifted edges catch the light
  vec2 wq = p + 14.0 * vec2(fbm(p * 0.006), fbm(p * 0.006 + 9.2));
  float d1 = voronoiEdge(wq / 34.0), d2 = voronoiEdge(wq / 11.0 + 3.1);
  float crack = (1.0 - smoothstep(0.0, 0.035, d1)) * 0.9 + (1.0 - smoothstep(0.0, 0.05, d2)) * 0.45 * smoothstep(0.45, 0.65, fbm(p * 0.004));
  float cm = uCrack * (0.25 + 0.75 * (1.0 - smoothstep(0.02, 0.18, lum)));
  lin *= 1.0 - clamp(crack, 0.0, 1.0) * cm * 0.75;
  // varnish: aged amber film, a little depth in the darks, dirt mottling, vignette
  vec3 amber = vec3(1.0, 0.92, 0.74);
  lin *= mix(vec3(1.0), amber, uVarnish * 0.8);
  lin *= 1.0 + uVarnish * 0.06 * (fbm(p * 0.0025) - 0.5);
  vec2 vq = (uv - 0.5) * vec2(1.0, 0.85);
  lin *= 1.0 - uVignette * pow(clamp(length(vq) * 1.35, 0.0, 1.0), 2.4);
  // "light goes strange": colour drains toward metal under the eclipse
  float m = luma(lin);
  lin = mix(lin, vec3(m) * vec3(0.98, 1.0, 1.03), uMetal * 0.7);
  vec3 outc = l2s(lin);
  outc += (hash12(p) - 0.5) / 255.0;
  o = vec4(outc, 1.0);
}`;

// Build the stroke mesh: each stroke a Catmull-Rom ribbon with round caps.
export function strokeMesh(list) {
  let nv = 0, ni = 0;
  const segsOf = s => { let L = 0; for (let k = 1; k < s.pts.length; k++) L += Math.hypot(s.pts[k][0] - s.pts[k - 1][0], s.pts[k][1] - s.pts[k - 1][1]); s._len = L; return Math.max(2, Math.min(14, Math.round((L + s.r * 2) / Math.max(2.2, s.r * .9)))); };
  for (const s of list) { s._seg = segsOf(s); nv += (s._seg + 1) * 2; ni += s._seg * 6; }
  const pos = new Float32Array(nv * 2), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 4), par = new Float32Array(nv * 4), idx = new Uint32Array(ni);
  let vi = 0, ii = 0;
  const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return .5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
  for (const s of list) {
    const P = s.pts, n = P.length, seg = s._seg, L = Math.max(s._len, .5), cap = s.r;
    // sample the curve uniformly in parameter, then extend by caps along the end tangents
    const curve = [];
    const M = seg - 2 > 0 ? seg - 2 : 1;
    for (let k = 0; k <= M; k++) {
      const t = k / M * (n - 1), i = Math.min(n - 2, Math.floor(t)), f = t - i;
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
      curve.push([cr(p0[0], p1[0], p2[0], p3[0], f), cr(p0[1], p1[1], p2[1], p3[1], f)]);
    }
    const tan = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1; return [dx / m, dy / m]; };
    const t0 = tan(curve[0], curve[1]), t1 = tan(curve[curve.length - 2], curve[curve.length - 1]);
    const full = [[curve[0][0] - t0[0] * cap, curve[0][1] - t0[1] * cap], ...curve, [curve[curve.length - 1][0] + t1[0] * cap, curve[curve.length - 1][1] + t1[1] * cap]];
    // arc length (s = 0 at the true start)
    const sArr = [-cap]; for (let k = 1; k < full.length; k++) sArr.push(sArr[k - 1] + Math.hypot(full[k][0] - full[k - 1][0], full[k][1] - full[k - 1][1]));
    const Lc = sArr[full.length - 2];
    const base = vi;
    for (let k = 0; k < full.length; k++) {
      const a = full[Math.max(0, k - 1)], b = full[Math.min(full.length - 1, k + 1)], tn = tan(a, b), nx = -tn[1], ny = tn[0];
      const u = clamp(sArr[k] / Math.max(Lc, 1));
      const prof = (.92 + .08 * Math.sin(Math.min(1, u * 1.3) * Math.PI)) * (1 - .22 * sstep(.6, 1, u));
      const hw = s.r * prof, ext = hw + 1.2;
      const cc = [lerp(s.c0[0], s.c1[0], u), lerp(s.c0[1], s.c1[1], u), lerp(s.c0[2], s.c1[2], u)];
      for (const sd of [-1, 1]) {
        pos[vi * 2] = full[k][0] + nx * ext * sd; pos[vi * 2 + 1] = full[k][1] + ny * ext * sd;
        uv[vi * 2] = sArr[k]; uv[vi * 2 + 1] = sd * ext / hw;
        col[vi * 4] = cc[0]; col[vi * 4 + 1] = cc[1]; col[vi * 4 + 2] = cc[2]; col[vi * 4 + 3] = s.a;
        par[vi * 4] = Lc; par[vi * 4 + 1] = hw; par[vi * 4 + 2] = s.seed; par[vi * 4 + 3] = s.thick;
        vi++;
      }
    }
    for (let k = 0; k < full.length - 1; k++) { const q = base + k * 2; idx[ii++] = q; idx[ii++] = q + 1; idx[ii++] = q + 2; idx[ii++] = q + 1; idx[ii++] = q + 3; idx[ii++] = q + 2; }
  }
  return { attrs: { aPos: { data: pos.subarray(0, vi * 2), size: 2 }, aUV: { data: uv.subarray(0, vi * 2), size: 2 }, aCol: { data: col.subarray(0, vi * 4), size: 4 }, aPar: { data: par.subarray(0, vi * 4), size: 4 } }, idx: idx.subarray(0, ii), nv: vi, ntri: ii / 3 };
}

let NOISE = null, TGT = null;
export function render(glw, list, cfg) {
  const gl = glw.gl;
  NOISE ??= noiseTexture(glw, 256, 11);
  TGT ??= glw.target(W, H, ['rgba8', 'rgba8']);
  glw.clear(TGT, [0, 0, 0, 0]);
  const P = glw.program(STROKE_VS, STROKE_FS);
  const m = strokeMesh(list), M = glw.mesh(P, m.attrs, m.idx);
  glw.draw(P, M, { uNoise: NOISE }, TGT, 'premult');
  M.dispose();
  glw.pass(POST_FS, {
    uCol: TGT.tex[0], uHgt: TGT.tex[1], uGround: cfg.ground, uImpasto: cfg.impasto, uSpec: cfg.spec, uWeave: cfg.weave, uCrack: cfg.crack,
    uVarnish: cfg.varnish, uVignette: cfg.vignette, uFlip: 1, uMetal: cfg.metal ?? 0
  }, null, null);
  return { nStrokes: list.length, ntri: m.ntri };
}
