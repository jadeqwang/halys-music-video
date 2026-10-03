// marble.js: MARBLE, the battle frozen into polished white marble at night (mid-totality; time paused).
//
// Deferred shading over the shared analysis, all in one full-resolution pass:
//  * shape: normals from the depth map at two scales (fine = carving, coarse = the soft wrap light of subsurface
//    scattering) plus a bas-relief from the plate's luminance gradient (carved detail the depth map lacks) and a cavity
//    term (AO) from depth and tone;
//  * albedo: warm white #ece6db with fine grey veining that follows the SAME flow field (sparse streamlines from the
//    CORONA tracer, drawn as thin cool-grey veins of varying weight) and a faint cloudy variation;
//  * light: cool soft key from above, a warm orange rim from the 360° horizon behind, a polished specular, navy ambient;
//    eyes get flat albedo and no specular (statues have carved, blank eyes: never glowing ones);
//  * background: the subject matte is cut crisp; the sky is a totality sky (desaturated navy-black, an orange 360°
//    horizon band low in frame, a few planets, faint stars); the rest of the land is dark stone under the same light.

import { W, H, clamp, lerp, sstep, hash3, hexRgb, s2l } from './core.js';
import { blur, ellipseMask } from './analysis.js';
import { skyMask, horizonRows } from './sky.js';
import { traceLines } from './corona.js';
import { GLSL_COMMON } from './gl.js';

export const DEFAULTS = {
  aw: 960,
  white: '#ece6db', grey: '#8a8c90', shadow: '#16161c', orange: '#f08a2a', navy: '#0b0e16', navyTop: '#05060a',
  depthK: 2600, depthBlur: 1.6, reliefK: 3.2, reliefBlur: 1.8, coarse: 7, wrap: .6, soft: .6, sss: .12,
  key: [.12, -1, .55], keyCol: [.86, .91, 1.0], keyI: 1.15, rimI: .65, rimW: 1.6, bounceI: .035, ambI: .16, specI: .28, specPow: 45, sheen: .07,
  aoK: 9, aoL: .35, veinDsep: 34, veinAmt: .55, veinW: [.5, 1.7], cloud: .06,
  landAlbedo: .025, landSpec: .06, matteSharp: .5,
  sky: null, horizonBand: .05, horizonI: 1.4, planets: [], stars: 140, exposure: 1.0, vignette: .4,
  eyeFlat: 1, faceMin: .7, eyes: [], seed: 5,
};

// ---------------------------------------------------------------- CPU fields (analysis res)
function prepFields(F, cfg) {
  const { aw, ah, N } = F;
  const Db = F.D ? blur(F.D, aw, ah, cfg.depthBlur) : new Float32Array(N).fill(.5);
  const Lb = blur(F.L, aw, ah, cfg.reliefBlur);
  const sky = cfg.sky ? skyMask(F, cfg.sky) : new Float32Array(N);
  const M = F.M ? blur(F.M, aw, ah, cfg.matteSharp) : new Float32Array(N).fill(1);
  // cavity: deeper than the neighbourhood (depth) and darker than the neighbourhood (tone)
  const Dw = blur(Db, aw, ah, cfg.aoK), Lw = blur(F.L, aw, ah, 5);
  const ao = new Float32Array(N);
  for (let i = 0; i < N; i++) ao[i] = clamp(1 - Math.max(0, Dw[i] - Db[i]) * 14 - Math.max(0, Lw[i] - F.L[i]) * cfg.aoL * 2);
  // horizon band (per column, from the sky mask) for the totality glow
  const band = new Float32Array(N);
  if (cfg.sky) {
    const hz0 = horizonRows(F, sky), bh = cfg.horizonBand * ah, hz = new Float32Array(aw), win = [];
    for (let x = 0; x < aw; x++) { win.length = 0; for (let j = Math.max(0, x - 18); j <= Math.min(aw - 1, x + 18); j++) win.push(hz0[j]); win.sort((a, b) => a - b); hz[x] = win[win.length >> 1]; }
    const hzs = hz.slice(); for (let x = 0; x < aw; x++) { let a = 0, n = 0; for (let j = Math.max(0, x - 10); j <= Math.min(aw - 1, x + 10); j++) { a += hzs[j]; n++; } hz[x] = a / n; }
    for (let x = 0; x < aw; x++) for (let y = 0; y < ah; y++) { const dy = hz[x] - y; band[y * aw + x] = dy >= 0 ? Math.exp(-dy / bh) : Math.exp(dy / (bh * .25)) * .6; }
  }
  // eyes: flat, matte, blank
  const eyes = new Float32Array(N);
  const eyeList = [...(cfg.eyes || [])];
  for (const f of F.faces || []) if (f.score >= cfg.faceMin) for (const e of f.eyes) eyeList.push({ x: e[0], y: e[1], rx: (f.box[2] - f.box[0]) * .13, ry: (f.box[3] - f.box[1]) * .09 });
  for (const e of eyeList) { const m = ellipseMask(F, { feather: .6, ...e }); for (let i = 0; i < N; i++) eyes[i] = Math.max(eyes[i], m[i] * cfg.eyeFlat); }
  return { Db, Lb, sky, M, ao, band, eyes };
}

// veins: sparse streamlines through the coarse flow (long, sweeping), only on stone (not the sky)
function veinLines(F, f, cfg) {
  const N = F.N, imp = new Float32Array(N);
  for (let i = 0; i < N; i++) imp[i] = (1 - f.sky[i]) * sstep(.3, .7, f.M[i]);
  const vf = { xx: F.Jc.xx, xy: F.Jc.xy, yy: F.Jc.yy, imp, sky: f.sky, sun: null };
  const lines = traceLines(F, vf, { dsepMin: cfg.veinDsep * .55, dsepMax: cfg.veinDsep, dtest: .6, step: .7, maxLen: 600, minLen: 30, maxTurn: 2.2, sepGamma: 1, seed: cfg.seed });
  const S = W / F.aw;
  return lines.map((L, j) => {
    const h = hash3(j, 1, cfg.seed), main = h > .86;
    return { xy: L.xy, n: L.n, w: main ? lerp(cfg.veinW[1] * .8, cfg.veinW[1] * 1.6, hash3(j, 2, cfg.seed)) : lerp(cfg.veinW[0], cfg.veinW[1], Math.pow(hash3(j, 3, cfg.seed), 2)),
      a: main ? .9 : lerp(.25, .7, hash3(j, 4, cfg.seed)), S };
  });
}

// ---------------------------------------------------------------- GPU
const VEIN_VS = `#version 300 es
in vec2 aPos; in vec2 aA;
uniform vec2 uRes;
out vec2 vA;
void main() { vA = aA; gl_Position = vec4(aPos / uRes * 2.0 - 1.0, 0.0, 1.0); }`;
const VEIN_FS = `#version 300 es
precision highp float;
in vec2 vA; out vec4 o;
void main() { float hw = vA.y, ext = hw + 4.0; float d = abs(vA.x) * ext;
  float cov = clamp(hw + 0.5 - d, 0.0, 1.0) * min(1.0, 2.0 * hw);
  float halo = exp(-d * d / (2.0 * (hw + 1.6) * (hw + 1.6))) * 0.35;
  o = vec4(max(cov, halo), 0, 0, 1.0); }`;

const SHADE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uF0, uF1, uVein, uImg;
uniform vec2 uRes, uARes;
uniform vec3 uWhite, uGrey, uShadow, uOrange, uNavy, uNavyTop, uKey, uKeyCol;
uniform float uDepthK, uReliefK, uCoarse, uWrap, uSoft, uKeyI, uRimI, uRimW, uBounceI, uAmbI, uSpecI, uSpecPow, uSheen, uVeinAmt, uCloud;
uniform float uLandAlbedo, uLandSpec, uHorizonI, uExposure, uVig, uFlip, uSeed, uSss;
uniform vec4 uPlanets[4]; uniform int uNPlanets; uniform float uStars;
out vec4 o;
${GLSL_COMMON}
float D(vec2 uv) { return texture(uF0, uv).r; }
float Lr(vec2 uv) { return texture(uF0, uv).g; }
void main() {
  vec2 uv = vUv; if (uFlip > 0.5) uv.y = 1.0 - uv.y;
  vec2 px = 1.0 / uRes;
  vec4 f0 = texture(uF0, uv), f1 = texture(uF1, uv);
  float m = f0.b, sky = f0.a, ao = mix(texture(uF1, uv).r, 1.0, 0.7 * texture(uF1, uv).b), band = f1.g, eye = f1.b;
  // ---- totality sky
  vec3 skyc = mix(uNavyTop, uNavy, smoothstep(0.0, 1.0, pow(clamp(uv.y / 0.6, 0.0, 1.0), 0.8)));
  skyc += uOrange * uHorizonI * band * band * (0.8 + 0.2 * vnoise(vec2(uv.x * 40.0, 3.0)));
  skyc += vec3(1.0, 0.85, 0.6) * uHorizonI * 0.35 * pow(band, 6.0);
  vec2 sp = uv * uRes;
  // stars: sparse hashed points, faint
  vec2 cell = floor(sp / 9.0); float hs = hash12(cell + uSeed);
  if (hs > 1.0 - uStars * 0.0004) { vec2 c = (cell + hash22(cell + 3.1)) * 9.0; float d = length(sp - c); skyc += vec3(0.75, 0.78, 0.85) * exp(-d * d / 0.9) * (0.25 + 0.5 * hash12(cell + 7.7)); }
  for (int i = 0; i < 4; i++) { if (i >= uNPlanets) break; vec4 P = uPlanets[i]; float d = length(sp - P.xy * uRes);
    skyc += vec3(1.0, 0.96, 0.88) * P.z * (exp(-d * d / (P.w * P.w)) + 0.08 * exp(-d / (P.w * 4.0))); }
  // ---- surface normal: depth at two scales + luminance relief
  float k = uDepthK;
  vec2 e1 = px * 1.5, e2 = px * uCoarse;
  vec3 nF = normalize(vec3(-(D(uv + vec2(e1.x, 0)) - D(uv - vec2(e1.x, 0))) / (2.0 * e1.x * uRes.x) * k,
                           -(D(uv + vec2(0, e1.y)) - D(uv - vec2(0, e1.y))) / (2.0 * e1.y * uRes.y) * k, 1.0));
  vec3 nC = normalize(vec3(-(D(uv + vec2(e2.x, 0)) - D(uv - vec2(e2.x, 0))) / (2.0 * e2.x * uRes.x) * k,
                           -(D(uv + vec2(0, e2.y)) - D(uv - vec2(0, e2.y))) / (2.0 * e2.y * uRes.y) * k, 1.0));
  float rk = uReliefK * (1.0 - 0.8 * eye);
  vec2 g = vec2(Lr(uv + vec2(e1.x, 0)) - Lr(uv - vec2(e1.x, 0)), Lr(uv + vec2(0, e1.y)) - Lr(uv - vec2(0, e1.y)));
  vec3 n = normalize(nF + vec3(-g * rk, 0.0));
  // ---- albedo: marble with veins along the flow field, faint clouding; the land is dark stone
  float vein = texture(uVein, uv).r;
  float cloud = fbm(sp * 0.004 + uSeed) - 0.5;
  vec3 alb = uWhite * (1.0 + uCloud * cloud);
  alb = mix(alb, uGrey, clamp(vein * uVeinAmt, 0.0, 0.85));
  float land = 1.0 - m;
  alb *= mix(1.0, uLandAlbedo, land);
  // ---- light
  vec3 L = normalize(uKey), V = vec3(0, 0, 1);
  float wF = clamp((dot(n, L) + uWrap) / (1.0 + uWrap), 0.0, 1.0), wC = clamp((dot(normalize(nC + vec3(-g * rk * 0.3, 0.0)), L) + uWrap) / (1.0 + uWrap), 0.0, 1.0);
  float dif = mix(wF, wC, uSoft);
  dif = dif * dif * (3.0 - 2.0 * dif);
  vec3 col = alb * uKeyCol * uKeyI * dif * mix(0.55, 1.0, ao);
  col += alb * mix(uShadow * 2.2, uNavy * 3.0, 0.5) * uAmbI * ao;
  // rim from the horizon behind: silhouettes and surfaces turned away, a thin band at the matte edge
  float edgeM = clamp(length(vec2(texture(uF0, uv + vec2(px.x * uRimW, 0)).b - texture(uF0, uv - vec2(px.x * uRimW, 0)).b,
                                  texture(uF0, uv + vec2(0, px.y * uRimW)).b - texture(uF0, uv - vec2(0, px.y * uRimW)).b)) * 2.0, 0.0, 1.0);
  float side = pow(1.0 - clamp(n.z, 0.0, 1.0), 1.5);
  float rim = clamp(edgeM * (0.35 + 0.65 * side) * (0.45 + 0.55 * clamp(n.y + 0.5, 0.0, 1.0)), 0.0, 1.0) * m;
  col += uOrange * uRimI * rim * (1.0 - 0.6 * dif);
  // subsurface: light scattered into the terminator (marble glows a little where light turns to shadow)
  col += alb * uKeyCol * uSss * (wC * (1.0 - wC) * 4.0) * m;
  // the 360° horizon glow is low: a faint orange bounce on surfaces turned down and sideways
  col += alb * uOrange * uBounceI * clamp(n.y, 0.0, 1.0) * smoothstep(0.35, 0.9, uv.y) * m * ao;
  // polished specular (none on the eyes)
  vec3 Hh = normalize(L + V);
  float nh = max(dot(n, Hh), 0.0);
  float spec = (pow(nh, uSpecPow) * uSpecI + pow(nh, 8.0) * uSheen) * mix(1.0, uLandSpec, land) * (1.0 - eye) * ao;
  col += uKeyCol * spec;
  // ---- composite: crisp matte silhouettes over the sky; land everywhere else
  vec3 outc = mix(col, skyc, sky * (1.0 - m));
  outc *= uExposure;
  vec2 q = (uv - 0.5) * vec2(1.0, 0.85);
  outc *= 1.0 - uVig * pow(clamp(length(q) * 1.35, 0.0, 1.0), 2.2);
  outc = outc / (1.0 + 0.12 * outc);
  o = vec4(l2s(outc) + (hash12(sp) - 0.5) / 255.0, 1.0);
}`;

let VEIN = null;
const cache = new Map();
function prepare(F, cfg) {
  const key = F.plate + '|' + JSON.stringify(F.win) + '|' + F.aw + '|' + JSON.stringify(cfg);
  let c = cache.get(key);
  if (!c) {
    const t0 = performance.now();
    const f = prepFields(F, cfg);
    const veins = veinLines(F, f, cfg);
    c = { f, veins, ms: Math.round(performance.now() - t0) };
    if (cache.size > 3) cache.delete(cache.keys().next().value);
    cache.set(key, c);
  }
  return c;
}

export async function render(glw, F, cfg, ctx) {
  const ms = {};
  let t0 = performance.now();
  const c = prepare(F, cfg), f = c.f;
  ms.fields = Math.round(performance.now() - t0);
  t0 = performance.now();
  VEIN ??= glw.target(W, H, 'rgba16f');
  // veins into a coverage buffer (max-blended by additive + clamp in the shader)
  let nv = 0, ni = 0; for (const L of c.veins) { nv += L.n * 2; ni += (L.n - 1) * 6; }
  const pos = new Float32Array(nv * 2), A = new Float32Array(nv * 2), idx = new Uint32Array(ni);
  let vi = 0, ii = 0;
  for (const L of c.veins) {
    const n = L.n, S = L.S, base = vi;
    for (let k = 0; k < n; k++) {
      const k0 = Math.max(0, k - 1), k1 = Math.min(n - 1, k + 1);
      let tx = L.xy[k1 * 2] - L.xy[k0 * 2], ty = L.xy[k1 * 2 + 1] - L.xy[k0 * 2 + 1]; const mm = Math.hypot(tx, ty) || 1; tx /= mm; ty /= mm;
      const u = k / (n - 1), taper = Math.min(1, Math.min(u, 1 - u) * 5);
      const wob = Math.max(0, .55 + .9 * Math.sin(k * .045 + L.a * 9) * Math.sin(k * .017 + L.w * 3) + .35 * Math.sin(k * .21 + L.a));
      const hw = .5 * L.w * taper * wob * L.a + .04, ext = hw + 4;
      for (const sd of [-1, 1]) { pos[vi * 2] = L.xy[k * 2] * S - ty * ext * sd; pos[vi * 2 + 1] = L.xy[k * 2 + 1] * S + tx * ext * sd; A[vi * 2] = sd; A[vi * 2 + 1] = hw; vi++; }
    }
    for (let k = 0; k < n - 1; k++) { const q = base + k * 2; idx[ii++] = q; idx[ii++] = q + 1; idx[ii++] = q + 2; idx[ii++] = q + 1; idx[ii++] = q + 3; idx[ii++] = q + 2; }
  }
  glw.clear(VEIN, [0, 0, 0, 0]);
  const P = glw.program(VEIN_VS, VEIN_FS), Mv = glw.mesh(P, { aPos: { data: pos, size: 2 }, aA: { data: A, size: 2 } }, idx);
  glw.draw(P, Mv, {}, VEIN, 'add'); Mv.dispose();
  // fields at analysis res
  const T0 = glw.fieldTexture(F.aw, F.ah, [f.Db, f.Lb, f.M, f.sky]), T1 = glw.fieldTexture(F.aw, F.ah, [f.ao, f.band, f.eyes, null]);
  const lin = h => hexRgb(h).map(s2l);
  const pl = new Float32Array(16); (cfg.planets || []).slice(0, 4).forEach((p, i) => { pl[i * 4] = p.x; pl[i * 4 + 1] = p.y; pl[i * 4 + 2] = p.i ?? 1; pl[i * 4 + 3] = p.r ?? 1.6; });
  glw.pass(SHADE_FS, {
    uF0: T0, uF1: T1, uVein: VEIN.tex[0], uARes: [F.aw, F.ah],
    uWhite: lin(cfg.white), uGrey: lin(cfg.grey), uShadow: lin(cfg.shadow), uOrange: lin(cfg.orange), uNavy: lin(cfg.navy), uNavyTop: lin(cfg.navyTop),
    uKey: cfg.key, uKeyCol: cfg.keyCol, uDepthK: cfg.depthK, uReliefK: cfg.reliefK, uCoarse: cfg.coarse, uWrap: cfg.wrap, uSoft: cfg.soft,
    uKeyI: cfg.keyI, uRimI: cfg.rimI, uRimW: cfg.rimW, uBounceI: cfg.bounceI, uAmbI: cfg.ambI, uSpecI: cfg.specI, uSpecPow: cfg.specPow, uSheen: cfg.sheen, uVeinAmt: cfg.veinAmt, uCloud: cfg.cloud,
    uLandAlbedo: cfg.landAlbedo, uLandSpec: cfg.landSpec, uSss: cfg.sss, uHorizonI: cfg.horizonI, uExposure: cfg.exposure, uVig: cfg.vignette, uFlip: 1, uSeed: cfg.seed,
    uPlanets: pl, uNPlanets: Math.min(4, (cfg.planets || []).length), uStars: cfg.stars
  }, null);
  glw.finish();
  glw.deleteTexture(T0); glw.deleteTexture(T1);
  ms.gpu = Math.round(performance.now() - t0);
  return { ms, nVeins: c.veins.length, fieldsMs: c.ms };
}
