// ink.js: INK, the room. Clean anime cel: flat palette, 2-3 tone hard cel bands, crisp black line art of varying
// weight, a softer painted background, monitor glow. Quiet and still: the most stylised world is the "real" one.
//
// Same analysis as every other material: colour (smoothed edge-preserving), tone (cel bands), edges (line art, chained
// with hysteresis and smoothed along the flow), matte (character vs background, silhouette weight), depth (line weight).
//  * CPU (analysis res): an edge-preserving smooth of the plate in OKLab (cross-bilateral, more passes on the background),
//    line chains, silhouette chains, an emissive mask for screens.
//  * GPU (full res): every pixel classifies its smoothed colour into a palette material and a hard tone band (shadow /
//    base / highlight), antialiased with fwidth so region borders are smooth curves; lines are tapered ribbons on top.
// Tells we avoid: soft Ghibli gradients (bands are hard), a yellow cast (whites are neutral #f2f0ea), buttery blends.

import { W, H, clamp, lerp, sstep, hexRgb, s2l, srgb2oklab } from './core.js';
import { blur, edgeChains, ellipseMask } from './analysis.js';
import { GLSL_COMMON } from './gl.js';

// character materials: base, shadow, highlight (sRGB hex); L range (OKLab) the material can occupy under shading; chroma anchor
export const MATERIALS = [
  { name: 'hair', base: '#101114', shadow: '#0b0c0f', hi: '#2a2e3a', L: [0, .34], ab: [0, -.005] },
  { name: 'jacket', base: '#f2f0ea', shadow: '#c3c5cf', hi: '#ffffff', L: [.5, 1.01], ab: [-.004, -.01] },
  { name: 'orange', base: '#f08a2a', shadow: '#c2601b', hi: '#ffab55', L: [.5, .9], ab: [.07, .13] },
  { name: 'navy', base: '#1e2433', shadow: '#151a26', hi: '#2c3549', L: [.12, .42], ab: [-.004, -.03] },
  { name: 'skin', base: '#f0d0b8', shadow: '#d3a28c', hi: '#fbe6d6', L: [.55, .96], ab: [.03, .045] },
];

export const DEFAULTS = {
  aw: 960,
  bilR: 3, bilS: 2.2, bilC: .07, bilIt: 3, bgIt: 3, bgR: 4,
  shadowCut: -.075, hiCut: .1, wL: 3, bandAA: 1,
  line: '#121216', lineBg: '#1b2030', lineW: [.55, 2.3], silW: 2.6, lineHi: .2, lineLo: .09, lineMin: 9, bgLineHi: .34, bgLineMin: 16,
  bgMode: 0, bgLevels: 6, bgK: 11, bgChroma: .95, bgLift: 1.0, glowI: .55, glowR: 10, emissiveT: .55, priorK: .06,
  regions: {},   // per-shot material priors: { skin: [ellipses], navy: [...], jacket: [...], orange: [...] }
  vignette: .25, seed: 9,
};

// ---------------------------------------------------------------- CPU
function bilateral(L, A, B, aw, ah, r, sS, sC, mask = null) {
  const N = aw * ah, oL = new Float32Array(N), oA = new Float32Array(N), oB = new Float32Array(N);
  const ws = []; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) ws.push(Math.exp(-(i * i + j * j) / (2 * sS * sS)));
  const k2 = 1 / (2 * sC * sC);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const c = y * aw + x;
    if (mask && mask[c] < .5) { oL[c] = L[c]; oA[c] = A[c]; oB[c] = B[c]; continue; }
    const l0 = L[c], a0 = A[c], b0 = B[c];
    let sl = 0, sa = 0, sb = 0, sw = 0, q = 0;
    for (let j = -r; j <= r; j++) {
      const yy = y + j < 0 ? 0 : y + j >= ah ? ah - 1 : y + j;
      for (let i = -r; i <= r; i++, q++) {
        const xx = x + i < 0 ? 0 : x + i >= aw ? aw - 1 : x + i, p = yy * aw + xx;
        const dl = L[p] - l0, da = A[p] - a0, db = B[p] - b0;
        const w = ws[q] * Math.exp(-(dl * dl + da * da + db * db) * k2);
        sl += L[p] * w; sa += A[p] * w; sb += B[p] * w; sw += w;
      }
    }
    oL[c] = sl / sw; oA[c] = sa / sw; oB[c] = sb / sw;
  }
  return [oL, oA, oB];
}

function prepFields(F, cfg) {
  const { aw, ah, N } = F;
  let L = new Float32Array(N), A = new Float32Array(N), B = new Float32Array(N);
  for (let i = 0; i < N; i++) { const o = srgb2oklab(F.R[i], F.G[i], F.B[i]); L[i] = o[0]; A[i] = o[1]; B[i] = o[2]; }
  for (let k = 0; k < cfg.bilIt; k++) [L, A, B] = bilateral(L, A, B, aw, ah, cfg.bilR, cfg.bilS, cfg.bilC);
  const M = F.M ? blur(F.M, aw, ah, .6) : new Float32Array(N).fill(1);
  const bg = new Float32Array(N); for (let i = 0; i < N; i++) bg[i] = 1 - sstep(.3, .6, M[i]);
  for (let k = 0; k < cfg.bgIt; k++) [L, A, B] = bilateral(L, A, B, aw, ah, cfg.bgR, cfg.bgR * .8, cfg.bilC * 1.4, bg);
  // emissive: bright screens in the background (light sources), blurred into a glow field
  const em = new Float32Array(N);
  for (let i = 0; i < N; i++) { const c = Math.hypot(A[i], B[i]); em[i] = bg[i] * sstep(cfg.emissiveT, cfg.emissiveT + .15, F.L[i] + c * 1.2) ; }
  const glow = blur(em, aw, ah, cfg.glowR);
  // line chains: interior edges (character: lower thresholds) and the background (higher thresholds, longer)
  const Ec = new Float32Array(N), Eb = new Float32Array(N);
  for (let i = 0; i < N; i++) { Ec[i] = F.edge[i] * (1 - bg[i]); Eb[i] = F.edge[i] * bg[i]; }
  const chC = edgeChains(F, { E: Ec, hi: cfg.lineHi, lo: cfg.lineLo, minLen: cfg.lineMin, smooth: 3 });
  const chB = edgeChains(F, { E: Eb, hi: cfg.bgLineHi, lo: cfg.lineLo * 1.4, minLen: cfg.bgLineMin, smooth: 4 });
  // silhouette: thinned gradient of the matte
  const g = new Float32Array(N), sil = new Float32Array(N);
  for (let y = 1; y < ah - 1; y++) for (let x = 1; x < aw - 1; x++) { const i = y * aw + x; g[i] = Math.hypot(M[i + 1] - M[i - 1], M[i + aw] - M[i - aw]); }
  for (let y = 1; y < ah - 1; y++) for (let x = 1; x < aw - 1; x++) {
    const i = y * aw + x, gx = M[i + 1] - M[i - 1], gy = M[i + aw] - M[i - aw], m = g[i]; if (m < .12) continue;
    const dx = Math.round(gx / m), dy = Math.round(gy / m);
    if (m >= g[i + dy * aw + dx] && m >= g[i - dy * aw - dx]) sil[i] = Math.min(1, m);
  }
  const chS = edgeChains(F, { E: sil, hi: .25, lo: .1, minLen: 12, smooth: 4 });
  // material priors (designed per shot, like BRONZE's light pools): skin, navy, jacket, orange; faces give skin for free
  const pri = [new Float32Array(N), new Float32Array(N), new Float32Array(N), new Float32Array(N)], names = ['skin', 'navy', 'jacket', 'orange'];
  const reg = { ...(cfg.regions || {}) };
  reg.skin = [...(reg.skin || []), ...(F.faces || []).filter(fc => fc.score > .7).map(fc => ({ x: (fc.box[0] + fc.box[2]) / 2, y: (fc.box[1] + fc.box[3]) / 2 + .01, rx: (fc.box[2] - fc.box[0]) * .5, ry: (fc.box[3] - fc.box[1]) * .55, feather: .3 }))];
  names.forEach((nm, k) => { for (const e of reg[nm] || []) { const m = ellipseMask(F, { feather: .4, ...e }); for (let i = 0; i < N; i++) pri[k][i] = Math.max(pri[k][i], m[i] * (e.k ?? 1)); } });
  // background palette: k-means of the smoothed background in OKLab (flat painted shapes, not a blurred photo)
  const K = cfg.bgK, cen = [], samples = [];
  for (let i = 0; i < N; i += 5) if (bg[i] > .5) samples.push(i);
  for (let k = 0; k < K; k++) { const i = samples[Math.floor((k + .5) / K * samples.length)] ?? 0; cen.push([L[i], A[i], B[i]]); }
  // seed by sorted lightness so dark/light ranges are both represented
  samples.sort((a, b) => L[a] - L[b]); for (let k = 0; k < K; k++) { const i = samples[Math.floor((k + .5) / K * samples.length)]; cen[k] = [L[i], A[i], B[i]]; }
  for (let it = 0; it < 12; it++) {
    const acc = cen.map(() => [0, 0, 0, 0]);
    for (const i of samples) { let b = 0, bd = 1e9; for (let k = 0; k < K; k++) { const d = (L[i] - cen[k][0]) ** 2 * 2 + (A[i] - cen[k][1]) ** 2 + (B[i] - cen[k][2]) ** 2; if (d < bd) { bd = d; b = k; } } const a = acc[b]; a[0] += L[i]; a[1] += A[i]; a[2] += B[i]; a[3]++; }
    for (let k = 0; k < K; k++) if (acc[k][3]) cen[k] = [acc[k][0] / acc[k][3], acc[k][1] / acc[k][3], acc[k][2] / acc[k][3]];
  }
  return { L, A, B, M, glow, chC, chB, chS, pri, cen };
}

// ---------------------------------------------------------------- GPU
const LINE_VS = `#version 300 es
in vec2 aPos; in vec3 aA;
uniform vec2 uRes;
out vec3 vA;
void main() { vA = aA; gl_Position = vec4(aPos / uRes * 2.0 - 1.0, 0.0, 1.0); }`;
// r: character line coverage, g: background line coverage (max-combined via the blend equation)
const LINE_FS = `#version 300 es
precision highp float;
in vec3 vA; out vec4 o;
void main() { float hw = vA.y, d = abs(vA.x) * (hw + 1.0); float cov = clamp(hw + 0.5 - d, 0.0, 1.0) * min(1.0, 2.0 * hw);
  o = vA.z > 0.5 ? vec4(0.0, cov, 0.0, 0.0) : vec4(cov, 0.0, 0.0, 0.0); }`;

const COMP_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uC, uX, uLines, uP;
uniform vec2 uRes;
uniform vec3 uBase[5], uShadow[5], uHi[5], uLineC, uLineBg, uBgPal[12];
uniform vec4 uRange[5];
uniform int uK;
uniform float uShadowCut, uHiCut, uWL, uPriorK, uBgChroma, uBgLift, uGlowI, uVig, uFlip, uBgMode, uBgLevels;
out vec4 o;
${GLSL_COMMON}
vec3 oklab2lin(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z, m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z, s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
vec3 celOf(int i, float L) {
  vec4 R = uRange[i];
  float t = L - mix(R.x, R.y, 0.62), aa = max(fwidth(L), 1e-4) * 0.75;
  float sh = 1.0 - smoothstep(uShadowCut - aa, uShadowCut + aa, t), hi = smoothstep(uHiCut - aa, uHiCut + aa, t);
  return mix(mix(uBase[i], uShadow[i], sh), uHi[i], hi * (1.0 - sh));
}
void main() {
  vec2 uv = vUv; if (uFlip > 0.5) uv.y = 1.0 - uv.y;
  vec4 c = texture(uC, uv), x = texture(uX, uv), pr = texture(uP, uv);
  float m = c.a;
  // ---- character: two nearest materials, blended across the decision boundary over about a pixel
  int b1 = 0, b2 = 1; float d1 = 1e9, d2 = 1e9;
  for (int i = 0; i < 5; i++) {
    vec4 R = uRange[i];
    float dl = max(0.0, max(R.x - c.x, c.x - R.y));
    vec2 dab = c.yz - R.zw;
    float d = uWL * dl * dl + dot(dab, dab) * 18.0;
    float p = i == 4 ? pr.r : i == 3 ? pr.g : i == 1 ? pr.b : i == 2 ? pr.a : 0.0;   // skin, navy, jacket, orange
    d -= uPriorK * p;
    if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = i; } else if (d < d2) { d2 = d; b2 = i; }
  }
  float gap = d2 - d1, wB = 0.5 * (1.0 - smoothstep(0.0, max(fwidth(gap), 1e-5) * 1.2, gap));
  vec3 col = mix(celOf(b1, c.x), celOf(b2, c.x), wB);
  // ---- background: flat painted shapes from a k-means palette of the room (antialiased borders), glow from the screens
  int k1 = 0, k2 = 0; float e1 = 1e9, e2 = 1e9;
  for (int k = 0; k < 12; k++) { if (k >= uK) break; vec3 q = uBgPal[k]; vec3 dd = c.xyz - q; float d = dd.x * dd.x * 2.0 + dd.y * dd.y + dd.z * dd.z;
    if (d < e1) { e2 = e1; k2 = k1; e1 = d; k1 = k; } else if (d < e2) { e2 = d; k2 = k; } }
  float gk = e2 - e1, wk = 0.5 * (1.0 - smoothstep(0.0, max(fwidth(gk), 1e-5) * 1.2, gk));
  vec3 q = mix(uBgPal[k1], uBgPal[k2], wk);
  if (uBgMode < 0.5) {   // soft: the edge-preserving smooth with gentle value steps (anime depth of field behind a crisp character)
    float lq = c.x * uBgLevels, st = floor(lq) + smoothstep(0.3, 0.7, fract(lq));
    q = vec3(mix(c.x, st / uBgLevels, 0.6), c.y, c.z);
  }
  vec3 bgc = clamp(oklab2lin(vec3(q.x * uBgLift, q.y * uBgChroma, q.z * uBgChroma)), 0.0, 1.0);
  bgc += uGlowI * x.r * vec3(0.55, 0.75, 0.9) * 0.35;
  vec3 lin = mix(bgc, col, smoothstep(0.42, 0.58, m));
  // ---- line art over everything
  vec4 Ln = texture(uLines, uv);
  lin = mix(lin, uLineBg, clamp(Ln.g, 0.0, 1.0) * 0.85);
  lin = mix(lin, uLineC, clamp(Ln.r, 0.0, 1.0));
  vec2 vq = (uv - 0.5) * vec2(1.0, 0.85);
  lin *= 1.0 - uVig * pow(clamp(length(vq) * 1.35, 0.0, 1.0), 2.4);
  o = vec4(l2s(lin) + (hash12(uv * uRes) - 0.5) / 255.0, 1.0);
}`;

let LT = null;
const cache = new Map();
function prepare(F, cfg) {
  const key = F.plate + '|' + JSON.stringify(F.win) + '|' + F.aw + '|' + JSON.stringify(cfg);
  let c = cache.get(key);
  if (!c) { const t0 = performance.now(); c = { f: prepFields(F, cfg) }; c.ms = Math.round(performance.now() - t0); if (cache.size > 2) cache.delete(cache.keys().next().value); cache.set(key, c); }
  return c;
}

function chainRibbons(F, chains, wFn, kind, out) {
  const S = W / F.aw;
  for (const ch of chains) {
    const P = ch.pts, n = P.length; if (n < 2) continue;
    const w = wFn(ch);
    for (let k = 0; k < n; k++) {
      const k0 = Math.max(0, k - 1), k1 = Math.min(n - 1, k + 1);
      let tx = P[k1][0] - P[k0][0], ty = P[k1][1] - P[k0][1]; const mm = Math.hypot(tx, ty) || 1; tx /= mm; ty /= mm;
      const u = k / (n - 1), taper = Math.pow(Math.min(1, Math.min(u, 1 - u) * 4.5), .7);
      const hw = .5 * w * (.25 + .75 * taper), ext = hw + 1;
      for (const sd of [-1, 1]) out.v.push(P[k][0] * S - ty * ext * sd, P[k][1] * S + tx * ext * sd, sd, hw, kind);
    }
    const base = out.n;
    for (let k = 0; k < n - 1; k++) { const q = base + k * 2; out.i.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    out.n += n * 2;
  }
}

export async function render(glw, F, cfg, ctx) {
  const ms = {};
  let t0 = performance.now();
  const c = prepare(F, cfg), f = c.f;
  ms.fields = Math.round(performance.now() - t0);
  t0 = performance.now();
  LT ??= glw.target(W, H, 'rgba16f');
  const out = { v: [], i: [], n: 0 };
  const depthW = ch => { if (!F.D) return 1; const p = ch.pts[ch.pts.length >> 1]; return lerp(.75, 1.25, F.D[(p[1] | 0) * F.aw + (p[0] | 0)]); };
  chainRibbons(F, f.chC, ch => lerp(cfg.lineW[0], cfg.lineW[1], clamp(ch.s * 2.2)) * depthW(ch), 0, out);
  chainRibbons(F, f.chS, ch => cfg.silW * depthW(ch), 0, out);
  chainRibbons(F, f.chB, ch => lerp(cfg.lineW[0] * .8, cfg.lineW[1] * .55, clamp(ch.s * 1.6)), 1, out);
  const V = new Float32Array(out.v), nv = out.n, pos = new Float32Array(nv * 2), A = new Float32Array(nv * 3);
  for (let k = 0; k < nv; k++) { pos[k * 2] = V[k * 5]; pos[k * 2 + 1] = V[k * 5 + 1]; A[k * 3] = V[k * 5 + 2]; A[k * 3 + 1] = V[k * 5 + 3]; A[k * 3 + 2] = V[k * 5 + 4]; }
  glw.clear(LT, [0, 0, 0, 0]);
  const P = glw.program(LINE_VS, LINE_FS), Mh = glw.mesh(P, { aPos: { data: pos, size: 2 }, aA: { data: A, size: 3 } }, new Uint32Array(out.i));
  const gl = glw.gl;
  glw.bind(LT); gl.useProgram(P.p); gl.enable(gl.BLEND); gl.blendEquation(gl.MAX); gl.blendFunc(gl.ONE, gl.ONE);
  glw.setUniforms(P, { uRes: [W, H] }); gl.bindVertexArray(Mh.vao); gl.drawElements(gl.TRIANGLES, Mh.count, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null);
  gl.blendEquation(gl.FUNC_ADD);
  Mh.dispose();
  const TC = glw.fieldTexture(F.aw, F.ah, [f.L, f.A, f.B, f.M]), TX = glw.fieldTexture(F.aw, F.ah, [f.glow, null, null, null]), TP = glw.fieldTexture(F.aw, F.ah, f.pri);
  const pal = new Float32Array(36); f.cen.slice(0, 12).forEach((cc, k) => { pal[k * 3] = cc[0]; pal[k * 3 + 1] = cc[1]; pal[k * 3 + 2] = cc[2]; });
  const lin = h => hexRgb(h).map(s2l), flat = a => new Float32Array(a.flat());
  glw.pass(COMP_FS, {
    uC: TC, uX: TX, uLines: LT.tex[0],
    uBase: flat(MATERIALS.map(m => lin(m.base))), uShadow: flat(MATERIALS.map(m => lin(m.shadow))), uHi: flat(MATERIALS.map(m => lin(m.hi))),
    uRange: flat(MATERIALS.map(m => [m.L[0], m.L[1], m.ab[0], m.ab[1]])), uLineC: lin(cfg.line), uLineBg: lin(cfg.lineBg),
    uShadowCut: cfg.shadowCut, uHiCut: cfg.hiCut, uWL: cfg.wL, uPriorK: cfg.priorK, uBgChroma: cfg.bgChroma, uBgLift: cfg.bgLift, uGlowI: cfg.glowI, uVig: cfg.vignette, uFlip: 1,
    uP: TP, uBgPal: pal, uK: Math.min(12, f.cen.length), uBgMode: cfg.bgMode, uBgLevels: cfg.bgLevels
  }, null);
  glw.finish();
  glw.deleteTexture(TC); glw.deleteTexture(TX); glw.deleteTexture(TP);
  ms.gpu = Math.round(performance.now() - t0);
  return { ms, nLines: f.chC.length + f.chB.length + f.chS.length, fieldsMs: c.ms };
}
