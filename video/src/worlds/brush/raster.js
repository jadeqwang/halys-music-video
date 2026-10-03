// raster.js: strokes become paint on the GPU.
//
// 1. Strokes are Catmull-Rom ribbons with round heads and dragged-off tails, textured with bristle tracks and dry-brush
//    skips, writing colour and paint height (MRT, half float, premultiplied).
// 2. The sun pass draws what must be exact: the flat blazing disk, the moon's bite, the black disk at totality with
//    its crisp limb, Baily's beads, the diamond ring and Jupiter.
// 3. The finish lights the height from the upper left (impasto where the paint is thick), shows canvas weave where it
//    is thin, craquelure in the darks, an aged varnish, vignette, the eclipse's metallic drain, and scene-level
//    flashes (white, warm). Weave, cracks and mottling are a property of the canvas: baked once per output size.

import { GL, GLSL_COMMON, noiseTexture } from './gl.js';
import { clamp, lerp, sstep } from './util.js';

const STROKE_VS = `#version 300 es
in vec2 aPos; in vec2 aUV; in vec4 aCol; in vec4 aPar;
uniform vec2 uRes;
out vec2 vUV; out vec4 vCol; out vec4 vPar;
void main() { vUV = aUV; vCol = aCol; vPar = aPar; gl_Position = vec4(aPos / uRes * 2.0 - 1.0, 0.0, 1.0); }`;

const STROKE_FS = `#version 300 es
precision highp float;
in vec2 vUV; in vec4 vCol; in vec4 vPar;
uniform sampler2D uNoise;
uniform float uBristle;
layout(location = 0) out vec4 oCol;
layout(location = 1) out vec4 oHgt;
void main() {
  float s = vUV.x, v = vUV.y, Lp = vPar.x, hw = vPar.y, seed = vPar.z, thick = vPar.w;
  float u = clamp(s / max(Lp, 1.0), 0.0, 1.0);
  float ds = s < 0.0 ? -s : (s > Lp ? (s - Lp) * 1.5 : 0.0);         // round head, flatter dragged-off tail
  float r = length(vec2(ds / hw, v));
  float sp = max(1.4, hw * 0.13);
  // bristle tracks (two scales in one fetch: long streaks along the stroke, about one per 1.4-3 px across)
  vec4 nz = texture(uNoise, vec2(v * hw / sp * 0.0098 + seed * 7.13, s / sp * 0.00045 + seed * 3.7));
  float br = nz.r * 0.65 + nz.g * 0.35;
  float rag = (texture(uNoise, vec2(s / max(hw, 1.0) * 0.022 + seed * 5.1, v > 0.0 ? 0.31 : 0.77)).a - 0.5) * 0.16;
  float cover = 1.0 - smoothstep(1.0 - 1.3 / hw + rag, 1.0 + rag, r);
  float dry = smoothstep(mix(0.42, 0.8, fract(seed * 13.7)), 1.2, u) * smoothstep(2.5, 7.0, hw);
  cover *= 1.0 - dry * smoothstep(0.3, 0.6, 1.0 - br);
  float a = cover * vCol.a;
  vec3 col = vCol.rgb * (1.0 - 0.09 * uBristle + 0.18 * uBristle * br);
  oCol = vec4(col * a, a);
  float h = thick * (mix(1.0, 0.6, u) * (0.8 + 0.4 * (br - 0.5)) + 0.12 * smoothstep(0.6, 0.95, r));
  oHgt = vec4(h * a, 0.0, 0.0, a);
}`;

// the lay-in: the reference blurred and toned down, under every stroke (gaps show local colour, never black ground)
const UNDER_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uUnder; uniform float uAlpha, uTone;
layout(location = 0) out vec4 oCol;
layout(location = 1) out vec4 oHgt;
void main() {
  vec3 c = texture(uUnder, vUv).rgb * uTone;
  oCol = vec4(c * uAlpha, uAlpha);
  oHgt = vec4(0.02 * uAlpha, 0.0, 0.0, uAlpha);
}`;

// exact sun / moon / beads / diamond ring / Jupiter (premultiplied over the strokes; glows are additive: alpha 0)
const SUN_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uRes; uniform vec4 uSun; uniform vec4 uMoon; uniform float uBoil, uMetal, uWarm, uBlaze, uSunVis;
uniform sampler2D uSky, uNoise;
uniform vec3 uLead, uNaples, uGold, uDark, uPink;
uniform vec4 uBead[12]; uniform int uNBead;
uniform vec4 uRing; uniform vec4 uJup; uniform vec4 uLimb;
layout(location = 0) out vec4 oCol;
layout(location = 1) out vec4 oHgt;
void main() {
  vec2 p = vUv * uRes;
  float sky = texture(uSky, vUv).r;
  float skyK = smoothstep(0.35, 0.65, sky);
  vec3 col = vec3(0.0); float alpha = 0.0, hgt = 0.0; vec3 glow = vec3(0.0);
  vec2 q = p - uSun.xy; float d = length(q), r = uSun.z, e = uSun.w;
  float ang = atan(q.y, q.x);
  float m = length(p - uMoon.xy), mr = uMoon.z;
  float inMoon = 1.0 - smoothstep(mr - 0.8, mr + 0.8, m);
  // the disk (only where the moon does not cover it), and the moon: its bite inside the disk always, the whole black
  // disk once the sky is dark enough (uMoon.w)
  float disc = 0.0; vec3 sunC = vec3(0.0); float sunH = 0.0;
  if (d < r + 3.0 && uSunVis > 0.0) {
    float wob = (texture(uNoise, vec2(ang * 0.35 + uBoil * 0.13, 0.5)).a - 0.5) * 1.2 * smoothstep(20.0, 60.0, r);
    disc = 1.0 - smoothstep(r - 0.8 + wob, r + 0.8 + wob, d);
    vec2 un = q / r;
    float marks = texture(uNoise, un * vec2(0.22, 0.07) + vec2(0.31, uBoil * 0.017)).r * 0.65 + texture(uNoise, un * 0.12 + 0.7).g * 0.35;
    vec3 core = mix(uLead, uNaples, 0.18 * uWarm);
    vec3 limb = mix(uNaples, uGold, 0.25 + 0.55 * uWarm);
    sunC = mix(core, limb, smoothstep(0.5 * r, 1.02 * r, d)) * (0.975 + 0.05 * marks) * uBlaze;
    float lum = dot(sunC, vec3(0.2126, 0.7152, 0.0722));
    sunC = mix(sunC, vec3(lum) * vec3(0.98, 1.0, 1.02), uMetal * 0.5);
    sunH = 1.05 + 0.15 * (marks - 0.5);
  }
  float sunA = disc * skyK * uSunVis * (e > 0.0005 ? 1.0 - inMoon : 1.0);
  float moonA = inMoon * skyK * max(uMoon.w, e > 0.0005 ? disc * uSunVis : 0.0);
  float mb = texture(uNoise, vec2(m * 0.01 + uBoil * 0.05, ang * 0.2)).g;
  vec3 dk = uDark * (0.9 + 0.2 * mb);
  alpha = clamp(sunA + moonA, 0.0, 1.0);
  col = alpha > 0.0 ? (sunC * sunA + dk * moonA) / max(alpha, 1e-4) : vec3(0.0);
  hgt = alpha > 0.0 ? (sunH * sunA + 0.3 * moonA) / max(alpha, 1e-4) : 0.0;
  // the limb at totality: a thin, intensely bright inner-corona ring hugging the black disk, pink chromosphere near the contact
  if (uLimb.x > 0.0) {
    float rr = m - mr;
    float ring = exp(-max(rr, 0.0) / max(1.0, uLimb.y)) * smoothstep(-1.0, 0.6, rr) * uLimb.x;
    vec2 cdir = vec2(cos(uLimb.w), sin(uLimb.w));
    vec2 mq = normalize(p - uMoon.xy + 1e-4);
    float near = pow(max(dot(mq, cdir), 0.0), 6.0) * uLimb.z;
    glow += (mix(uLead, uPink, near * 0.8) * ring * (0.75 + 0.5 * texture(uNoise, vec2(atan(mq.y, mq.x) * 1.7, 0.2)).r)) * skyK;
  }
  // Baily's beads and the diamond ring: brilliant points with a painted bloom
  for (int i = 0; i < 12; i++) {
    if (i >= uNBead) break;
    vec4 b = uBead[i]; float bd = length(p - b.xy);
    glow += uLead * b.w * (exp(-bd / max(0.6, b.z)) * 1.6 + exp(-bd / (b.z * 6.0)) * 0.35) * skyK;
  }
  if (uRing.w > 0.0) {
    float bd = length(p - uRing.xy);
    float burst = exp(-bd / max(1.0, uRing.z)) * 2.4 + exp(-bd / (uRing.z * 5.0)) * 0.9 + exp(-bd / (uRing.z * 22.0)) * 0.35;
    glow += mix(uLead, vec3(1.0, 0.97, 0.9), 0.5) * burst * uRing.w * skyK;
  }
  if (uJup.w > 0.0) {
    float jd = length(p - uJup.xy);
    glow += vec3(1.0, 0.97, 0.9) * uJup.w * (1.0 - smoothstep(uJup.z * 0.6, uJup.z, jd) + exp(-jd / (uJup.z * 2.2)) * 0.25) * skyK;
  }
  oCol = vec4(col * alpha + glow, alpha);
  oHgt = vec4(hgt * alpha, 0.0, 0.0, alpha);
}`;

// the canvas itself (weave, cracks, varnish mottling, grain): baked once per output size
const CANVAS_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uRes;
out vec4 o;
${GLSL_COMMON}
float weave(vec2 p) {
  vec2 q = p / 3.4;
  vec2 c = floor(q), f = fract(q);
  float top = mod(c.x + c.y, 2.0);
  float th = mix(sin(f.y * 3.14159), sin(f.x * 3.14159), top) * (0.75 + 0.5 * vnoise(p * vec2(0.03, 0.7) + c.x));
  return th * (0.8 + 0.4 * vnoise(p * 0.02));
}
void main() {
  vec2 p = vUv * uRes * (1920.0 / max(uRes.x, uRes.y * 1.0));
  vec2 wq = p + 14.0 * vec2(fbm(p * 0.006), fbm(p * 0.006 + 9.2));
  float d1 = voronoiEdge(wq / 38.0), d2 = voronoiEdge(wq / 12.0 + 3.1);
  float crack = (1.0 - smoothstep(0.0, 0.022, d1)) * 0.8 + (1.0 - smoothstep(0.0, 0.035, d2)) * 0.35 * smoothstep(0.5, 0.7, fbm(p * 0.004));
  o = vec4(clamp(weave(p), 0.0, 1.0), clamp(crack, 0.0, 1.0), fbm(p * 0.0025), hash12(p));
}`;

const POST_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCol, uHgt, uCanvas;
uniform vec2 uRes; uniform vec3 uGround, uVarnishCol;
uniform float uImpasto, uSpec, uWeave, uCrack, uVarnish, uVignette, uFlip, uMetal, uWhite, uWarmFlash, uExposure, uBlack;
out vec4 o;
${GLSL_COMMON}
float height(vec2 uv) {
  float hp = texture(uHgt, uv).r;
  return hp * 2.0 + uWeave * 0.07 * texture(uCanvas, uv).r * (1.0 - smoothstep(0.0, 0.3, hp));
}
void main() {
  vec2 uv = vUv; if (uFlip > 0.5) uv.y = 1.0 - uv.y;
  vec2 px = 1.0 / uRes;
  vec4 c = texture(uCol, uv);
  vec4 cv = texture(uCanvas, uv);
  vec3 base = c.rgb + uGround * (1.0 - min(c.a, 1.0));
  float h0 = texture(uHgt, uv).r;
  float hL = height(uv - vec2(px.x, 0)), hR = height(uv + vec2(px.x, 0)), hU = height(uv - vec2(0, px.y)), hD = height(uv + vec2(0, px.y));
  vec3 N = normalize(vec3(-(hR - hL) * 1.6, -(hD - hU) * 1.6, 1.0));
  vec3 Ld = normalize(vec3(-0.6, -0.7, 0.75));
  vec3 lin = s2l(min(base, vec3(4.0)));
  float lum = luma(lin);
  float relief = (dot(N, Ld) - Ld.z) / Ld.z;
  lin *= clamp(1.0 + uImpasto * relief * (0.35 + 0.65 * smoothstep(0.05, 0.45, h0)), 0.72, 1.4);
  vec3 Hv = normalize(Ld + vec3(0, 0, 1));
  float sp = pow(max(dot(N, Hv), 0.0), 40.0) * uSpec * smoothstep(0.2, 0.6, h0) * (0.2 + smoothstep(0.03, 0.4, lum));
  lin += sp * vec3(1.0, 0.93, 0.8);
  lin *= 1.0 - uWeave * 0.1 * (cv.r - 0.55) * (1.0 - smoothstep(0.02, 0.22, h0));
  float cm = uCrack * (0.1 + 0.9 * (1.0 - smoothstep(0.01, 0.12, lum)));
  lin *= 1.0 - cv.g * cm * 0.6;
  lin *= mix(vec3(1.0), uVarnishCol, uVarnish * 0.75);
  lin *= 1.0 + uVarnish * 0.07 * (cv.b - 0.5);
  vec2 vq = (uv - 0.5) * vec2(1.0, 0.85);
  lin *= 1.0 - uVignette * pow(clamp(length(vq) * 1.35, 0.0, 1.0), 2.4);
  float m = luma(lin);
  lin = mix(lin, vec3(m) * vec3(0.97, 1.0, 1.03), uMetal * 0.75);
  lin = lin * uExposure;
  lin += vec3(1.0, 0.62, 0.3) * uWarmFlash * (0.35 + lum);
  lin = mix(lin, vec3(1.0, 0.985, 0.95), uWhite);
  lin = mix(lin, vec3(0.0), uBlack);
  vec3 outc = l2s(lin);
  outc += (cv.a - 0.5) / 255.0;
  o = vec4(outc, 1.0);
}`;

// ---------------------------------------------------------------- stroke mesh (reusable typed arrays)
let MB = null;
function ensure(nv, ni) {
  if (MB && MB.nv >= nv && MB.ni >= ni) return MB;
  const v = Math.max(nv, (MB?.nv || 0) * 1.5 | 0), i = Math.max(ni, (MB?.ni || 0) * 1.5 | 0);
  MB = { nv: v, ni: i, pos: new Float32Array(v * 2), uv: new Float32Array(v * 2), col: new Float32Array(v * 4), par: new Float32Array(v * 4), idx: new Uint32Array(i) };
  return MB;
}
export function strokeMesh(list) {
  let nv = 0, ni = 0;
  for (const s of list) {
    let L = 0; const P = s.pts; for (let k = 1; k < P.length; k++) L += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]);
    s._len = L;
    const seg = Math.max(2, Math.min(s.maxSeg ?? 16, Math.round((L + s.r * 2) / Math.max(4, s.r * 1.1))));
    s._M = Math.max(1, seg - 2);
    nv += (s._M + 3) * 2; ni += (s._M + 2) * 6;
  }
  const B = ensure(nv, ni), pos = B.pos, uv = B.uv, col = B.col, par = B.par, idx = B.idx;
  let vi = 0, ii = 0;
  const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return .5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
  const cx = new Float32Array(48), cy = new Float32Array(48), sA = new Float32Array(48);
  for (const s of list) {
    const P = s.pts, n = P.length, M = s._M, cap = s.r;
    for (let k = 0; k <= M; k++) {
      const t = k / M * (n - 1), i = Math.min(n - 2, Math.floor(t)), f = t - i;
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
      cx[k + 1] = cr(p0[0], p1[0], p2[0], p3[0], f); cy[k + 1] = cr(p0[1], p1[1], p2[1], p3[1], f);
    }
    let tx = cx[2] - cx[1], ty = cy[2] - cy[1], tm = Math.hypot(tx, ty) || 1; cx[0] = cx[1] - tx / tm * cap; cy[0] = cy[1] - ty / tm * cap;
    tx = cx[M + 1] - cx[M]; ty = cy[M + 1] - cy[M]; tm = Math.hypot(tx, ty) || 1; cx[M + 2] = cx[M + 1] + tx / tm * cap; cy[M + 2] = cy[M + 1] + ty / tm * cap;
    const nf = M + 3;
    sA[0] = -cap; for (let k = 1; k < nf; k++) sA[k] = sA[k - 1] + Math.hypot(cx[k] - cx[k - 1], cy[k] - cy[k - 1]);
    const Lc = sA[nf - 2], base = vi;
    const c0 = s.c0, c1 = s.c1;
    for (let k = 0; k < nf; k++) {
      const a = Math.max(0, k - 1), b = Math.min(nf - 1, k + 1);
      let ex = cx[b] - cx[a], ey = cy[b] - cy[a]; const em = Math.hypot(ex, ey) || 1; ex /= em; ey /= em;
      const nx = -ey, ny = ex;
      const u = clamp(sA[k] / Math.max(Lc, 1));
      const prof = (.55 + .45 * sstep(0, .16, u)) * (1 - (s.taper ?? .72) * sstep(.5, 1, u));
      const hw = Math.max(.35, s.r * prof), ext = hw + 1.0;
      const r = c0[0] + (c1[0] - c0[0]) * u, g = c0[1] + (c1[1] - c0[1]) * u, bl = c0[2] + (c1[2] - c0[2]) * u;
      for (let sd = -1; sd <= 1; sd += 2) {
        pos[vi * 2] = cx[k] + nx * ext * sd; pos[vi * 2 + 1] = cy[k] + ny * ext * sd;
        uv[vi * 2] = sA[k]; uv[vi * 2 + 1] = sd * ext / hw;
        col[vi * 4] = r; col[vi * 4 + 1] = g; col[vi * 4 + 2] = bl; col[vi * 4 + 3] = s.a;
        par[vi * 4] = Lc; par[vi * 4 + 1] = hw; par[vi * 4 + 2] = s.seed; par[vi * 4 + 3] = s.thick;
        vi++;
      }
    }
    for (let k = 0; k < nf - 1; k++) { const q = base + k * 2; idx[ii++] = q; idx[ii++] = q + 1; idx[ii++] = q + 2; idx[ii++] = q + 1; idx[ii++] = q + 3; idx[ii++] = q + 2; }
  }
  return { attrs: { aPos: { data: pos.subarray(0, vi * 2), size: 2 }, aUV: { data: uv.subarray(0, vi * 2), size: 2 }, aCol: { data: col.subarray(0, vi * 4), size: 4 }, aPar: { data: par.subarray(0, vi * 4), size: 4 } }, idx, ni: ii, ntri: ii / 3 };
}

// the screen box the sun pass can touch (render-target rows are image rows: row 0 = top)
function sunBox(sun, W, H) {
  let R = Math.max(sun.r, sun.mr) * 1.2 + 6;
  if (sun.limb && sun.limb[0] > 0) R = Math.max(R, sun.mr + sun.limb[1] * 8);
  if (sun.beads && sun.beads.length) R = Math.max(R, sun.r + Math.max(...sun.beads.map(b => b.size * 14)));
  if (sun.ring && sun.ring[3] > 0) R = Math.max(R, sun.r + sun.ring[2] * 90);
  let x0 = sun.cx - R, y0 = sun.cy - R, x1 = sun.cx + R, y1 = sun.cy + R;
  if (sun.jup && sun.jup[3] > 0) { const jr = sun.jup[2] * 8; x0 = Math.min(x0, sun.jup[0] - jr); y0 = Math.min(y0, sun.jup[1] - jr); x1 = Math.max(x1, sun.jup[0] + jr); y1 = Math.max(y1, sun.jup[1] + jr); }
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
  return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : [0, 0, 0, 0];
}

// ---------------------------------------------------------------- the painter (one per output size)
const PAINTERS = new Map();
export function getPainter(W, H) {
  const k = `${W}x${H}`;
  if (PAINTERS.has(k)) return PAINTERS.get(k);
  const glw = new GL(W, H);
  const P = { glw, W, H, noise: noiseTexture(glw, 256, 11), tgt: glw.target(W, H, ['rgba16f', 'r16f']), canvasTex: null, skyTex: null };
  P.canvasTex = glw.target(W, H, ['rgba8']);
  glw.pass(CANVAS_FS, {}, P.canvasTex, null);
  PAINTERS.set(k, P);
  return P;
}

// paint a stroke list (+ optional exact sun) and finish into the painter's canvas; returns stats
export function rasterize(Pn, list, cfg, sun = null, over = null) {
  const { glw, tgt } = Pn, gl = glw.gl, tm = {}; let t0 = performance.now(), tMesh = 0;
  glw.clear(tgt, [0, 0, 0, 0]);
  if (cfg._under) {
    const U = cfg._under;
    if (!Pn.underTex || Pn.underTex.w !== U.w || Pn.underTex.h !== U.h) Pn.underTex = glw.texture(U.w, U.h, { fmt: 'rgba8' });
    glw.upload(Pn.underTex, U.data);
    glw.pass(UNDER_FS, { uUnder: Pn.underTex, uAlpha: cfg.underAlpha ?? .9, uTone: cfg.underTone ?? .8 }, tgt, null);
  }
  const prog = glw.program(STROKE_VS, STROKE_FS);
  const CH = 30000;
  let ntri = 0;
  for (let i = 0; i < list.length; i += CH) {
    const tq = performance.now(); const m = strokeMesh(list.slice(i, i + CH)); tMesh += performance.now() - tq;
    glw.meshDraw(prog, m.attrs, m.idx, m.ni, { uNoise: Pn.noise, uBristle: cfg.bristle ?? 1 }, tgt, 'premult');
    ntri += m.ntri;
  }
  if (cfg.timing) { glw.finish(); tm.strokes = Math.round(performance.now() - t0); tm.mesh = Math.round(tMesh); t0 = performance.now(); }
  if (sun) {
    // sky mask texture at analysis resolution (land and figures occlude the sun)
    if (!Pn.skyTex || Pn.skyTex.w !== sun.aw || Pn.skyTex.h !== sun.ah) Pn.skyTex = glw.texture(sun.aw, sun.ah, { fmt: 'r32f' });
    glw.upload(Pn.skyTex, sun.mask);
    const pal = cfg._pal, tube = n => pal.tube(n) || [1, 1, 1];
    const umb = tube('rawUmber'), blk = tube('boneBlack'), nap = tube('naples'), ver = tube('vermilion'), lead = tube('leadWhite'), mad = tube('madder');
    const beads = new Float32Array(48); const nb = Math.min(12, (sun.beads || []).length);
    for (let i = 0; i < nb; i++) { const b = sun.beads[i]; beads.set([b.x, b.y, b.size, b.k], i * 4); }
    glw.pass(SUN_FS, {
      uSun: [sun.cx, sun.cy, sun.r, sun.e], uMoon: [sun.mx, sun.my, sun.mr, sun.moonVis ?? 0], uBoil: sun.boil, uMetal: cfg.metal ?? 0, uSky: Pn.skyTex, uNoise: Pn.noise,
      uLead: lead, uNaples: nap, uDark: sun.dark || [umb[0] * .35 + blk[0] * .65, umb[1] * .35 + blk[1] * .65, umb[2] * .35 + blk[2] * .65],
      uGold: [0, 1, 2].map(k => lerp(nap[k], ver[k], .3)), uPink: [0, 1, 2].map(k => lerp(mad[k], lead[k], .45)),
      uWarm: sun.warm ?? 0, uBlaze: sun.blaze ?? 1.45, uSunVis: sun.sunVis ?? 1,
      uBead: beads, uNBead: nb, uRing: sun.ring || [0, 0, 1, 0], uJup: sun.jup || [0, 0, 1, 0], uLimb: sun.limb || [0, 1, 0, 0],
    }, tgt, 'premult', sunBox(sun, glw.w, glw.h));
  }
  if (over && over.length) {                 // strokes in front of the sun (an arrow across the disk, a foreground)
    for (let i = 0; i < over.length; i += CH) {
      const m = strokeMesh(over.slice(i, i + CH));
      glw.meshDraw(prog, m.attrs, m.idx, m.ni, { uNoise: Pn.noise, uBristle: cfg.bristle ?? 1 }, tgt, 'premult');
      ntri += m.ntri;
    }
  }
  if (cfg.timing) { glw.finish(); tm.sun = Math.round(performance.now() - t0); t0 = performance.now(); }
  glw.pass(POST_FS, {
    uCol: tgt.tex[0], uHgt: tgt.tex[1], uCanvas: Pn.canvasTex.tex[0], uGround: cfg.ground, uImpasto: cfg.impasto, uSpec: cfg.spec, uWeave: cfg.weave,
    uCrack: cfg.crack, uVarnish: cfg.varnish, uVarnishCol: cfg.varnishCol || [1, .93, .76], uVignette: cfg.vignette, uFlip: 1, uMetal: cfg.metal ?? 0,
    uWhite: cfg.white ?? 0, uWarmFlash: cfg.warmFlash ?? 0, uExposure: cfg.exposure ?? 1, uBlack: cfg.black ?? 0,
  }, null, null);
  if (cfg.timing) { glw.finish(); tm.post = Math.round(performance.now() - t0); }
  return { nStrokes: list.length, ntri, tm };
}
