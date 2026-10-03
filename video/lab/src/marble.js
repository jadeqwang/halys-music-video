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
import { blur, ellipseMask, lic } from './analysis.js';
import { skyMask, horizonRows } from './sky.js';
import { traceLines } from './corona.js';
import { GLSL_COMMON } from './gl.js';

export const DEFAULTS = {
  aw: 960,
  white: '#ece6db', grey: '#8a8c90', shadow: '#16161c', orange: '#f08a2a', navy: '#0b0e16', navyTop: '#05060a',
  // form: depth normals from an edge-preserving smooth of the depth map; luminance only as a low-weight band-pass carving
  depthK: 2600, dBilR: 4, dBilS: 3, dBilC: .025, dBilIt: 2, reliefK: 1.5, carveFine: 1.4, carveCoarse: 6, fineK: .15,
  coarse: 7, wrap: .6, soft: .55,
  key: [.12, -1, .55], keyCol: [.86, .91, 1.0], keyI: 1.15, rimI: .5, rimW: 1.6, bounceI: .04, ambI: .16,
  specI: .3, specPow: 170, sheen: .02, grain: .035, sparkle: .45,
  sss: .16, sssCol: [1.0, .8, .62],
  aoK: 9, aoL: .2,
  // veins: a few thin irregular veins running through the block (warped by the flow field), gated into zones
  veinAmt: .6, veinPeriod: 300, veinWarp: 2.4, veinFlow: .9, veinZoneLo: .45, veinW: 1.0, cloud: .03, mottle: .05,
  veinScale: 7, veinAngle: .5, veinLen: 45,
  landAlbedo: .2, landSpec: .1, fogLo: .05, fogHi: .6, fogI: .06, depthRim: .4, matteSharp: 1.5,
  glassT: .1, glassI: 2.0, glassReach: 10, glassY: .55, water: 0, waterY: .6,
  sky: null, horizonBand: .03, horizonWide: .15, horizonI: 1.15, planets: [], stars: 140, exposure: 1.0, vignette: .4,
  eyeFlat: 1, faceMin: .7, eyes: [], seed: 5,
};

// ---------------------------------------------------------------- CPU fields (analysis res)
function prepFields(F, cfg) {
  const { aw, ah, N } = F;
  // the matte, opened: thin strands (hair) vanish, silhouettes stay crisp
  const M = new Float32Array(N);
  if (F.M) { const mb = blur(F.M, aw, ah, cfg.matteSharp); for (let i = 0; i < N; i++) M[i] = sstep(.42, .58, mb[i]); } else M.fill(1);
  // depth: bilateral (edge-preserving) smooth, separately inside and outside the subject: carved form without noise
  let Db = F.D ? F.D.slice() : new Float32Array(N).fill(.5);
  if (F.D) for (let it = 0; it < cfg.dBilIt; it++) Db = bilateral1(Db, M, aw, ah, cfg.dBilR, cfg.dBilS, cfg.dBilC);
  // carving: a band-pass of luminance at the scale of carved features (eyes, lips, curls), not strands or pores
  const L1 = blur(F.L, aw, ah, cfg.carveFine), L2 = blur(F.L, aw, ah, cfg.carveCoarse), Lb = new Float32Array(N);
  for (let i = 0; i < N; i++) Lb[i] = (L1[i] - L2[i]) + cfg.fineK * (F.L[i] - L1[i]);
  const sky = cfg.sky ? skyMask(F, cfg.sky) : new Float32Array(N);
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
    const bw = cfg.horizonWide * ah;
    for (let x = 0; x < aw; x++) for (let y = 0; y < ah; y++) { const dy = hz[x] - y; band[y * aw + x] = dy >= 0 ? .62 * Math.exp(-dy / bh) + .38 * Math.exp(-dy / bw) : 0; }
  }
  // eyes: flat, matte, blank
  const eyes = new Float32Array(N);
  const eyeList = [...(cfg.eyes || [])];
  for (const f of F.faces || []) if (f.score >= cfg.faceMin) for (const e of f.eyes) eyeList.push({ x: e[0], y: e[1], rx: (f.box[2] - f.box[0]) * .13, ry: (f.box[3] - f.box[1]) * .09 });
  for (const e of eyeList) { const m = ellipseMask(F, { feather: .6, ...e }); for (let i = 0; i < N; i++) eyes[i] = Math.max(eyes[i], m[i] * cfg.eyeFlat); }
  // mottling: line-integral convolution of a soft noise along the flow, a cloudy grey drift that follows the form
  const nz = new Float32Array(N); let h = (cfg.seed * 2654435761) >>> 0;
  for (let i = 0; i < N; i++) { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; nz[i] = (h & 65535) / 65535; }
  const nzb = blur(nz, aw, ah, cfg.veinScale);
  const c2 = Math.cos(2 * cfg.veinAngle), s2 = Math.sin(2 * cfg.veinAngle), J = { xx: new Float32Array(N), xy: new Float32Array(N), yy: new Float32Array(N) };
  for (let i = 0; i < N; i++) { const a = F.Jc.xx[i], b = F.Jc.xy[i], c = F.Jc.yy[i], m = (a + c) / 2, d = (a - c) / 2, d2 = d * c2 - b * s2; J.xx[i] = m + d2; J.yy[i] = m - d2; J.xy[i] = d * s2 + b * c2; }
  const mot0 = lic(F, nzb, { len: cfg.veinLen, J });
  // normalise by percentiles so the iso-levels sit in the populated range
  const srt = Float32Array.from(mot0).sort(), lo = srt[Math.floor(N * .02)], hi = srt[Math.floor(N * .98)];
  const mot = new Float32Array(N); for (let i = 0; i < N; i++) mot[i] = clamp((mot0[i] - lo) / Math.max(1e-6, hi - lo));
  // frozen spray: the plate's bright specks (droplets, splashes) become glass glints hanging in the dark
  const Lg = blur(F.L, aw, ah, 2), gl = new Float32Array(N);
  const ring = blur(M, aw, ah, cfg.glassReach);            // spray hangs only close to the bodies, not over the whole river
  for (let y = 1; y < ah - 1; y++) for (let x = 1; x < aw - 1; x++) {
    const i = y * aw + x, L = F.L[i], lc = L - Lg[i]; if (lc < cfg.glassT || sky[i] > .5 || L < .55 || ring[i] < .12 || y < ah * cfg.glassY) continue;
    let mx = true; for (let j = -1; j <= 1 && mx; j++) for (let k = -1; k <= 1; k++) if ((j || k) && F.L[i + j * aw + k] > L) { mx = false; break; }
    if (mx) gl[i] = Math.min(1, (lc - cfg.glassT) * 8) * (1 - .6 * M[i]);
  }
  // the water: where the land lies low and flat in frame (below the subject's feet line), a dark mirror of the horizon band
  const nearM = blur(M, aw, ah, 4);
  const dv = []; for (let i = 0; i < N; i += 5) if (M[i] > .5) dv.push(Db[i]);
  dv.sort((a, b) => a - b); const dSubj = dv.length ? dv[dv.length >> 1] : .5;
  return { Db, Lb, sky, M, ao, band, eyes, mot, glass: blur(gl, aw, ah, .6), nearM, dSubj };
}

// bilateral filter on a scalar field, never mixing across the matte boundary
function bilateral1(D, M, aw, ah, r, sS, sC) {
  const out = new Float32Array(aw * ah), ws = [], k2 = 1 / (2 * sC * sC);
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) ws.push(Math.exp(-(i * i + j * j) / (2 * sS * sS)));
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const c = y * aw + x, d0 = D[c], m0 = M[c] > .5; let sd = 0, sw = 0, q = 0;
    for (let j = -r; j <= r; j++) { const yy = y + j < 0 ? 0 : y + j >= ah ? ah - 1 : y + j;
      for (let i = -r; i <= r; i++, q++) { const xx = x + i < 0 ? 0 : x + i >= aw ? aw - 1 : x + i, p = yy * aw + xx;
        if ((M[p] > .5) !== m0) continue; const dd = D[p] - d0, w = ws[q] * Math.exp(-dd * dd * k2); sd += D[p] * w; sw += w; } }
    out[c] = sd / sw;
  }
  return out;
}

// veins: sparse streamlines through the coarse flow (long, sweeping), only on stone (not the sky)
function veinLines(F, f, cfg) {
  const N = F.N, imp = new Float32Array(N);
  for (let i = 0; i < N; i++) imp[i] = (1 - f.sky[i]) * sstep(.3, .7, f.M[i]);
  // rotate the coarse tensor: veins run at an angle to the carved contours (still the same field, not topographic lines)
  const c2 = Math.cos(2 * cfg.veinAngle), s2 = Math.sin(2 * cfg.veinAngle), xx = new Float32Array(N), xy = new Float32Array(N), yy = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = F.Jc.xx[i], b = F.Jc.xy[i], c = F.Jc.yy[i], m = (a + c) / 2, d = (a - c) / 2;
    const d2 = d * c2 - b * s2, b2 = d * s2 + b * c2; xx[i] = m + d2; yy[i] = m - d2; xy[i] = b2;
  }
  const vf = { xx, xy, yy, imp, sky: f.sky, sun: null };
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
uniform sampler2D uF0, uF1, uVein, uImg, uF2;
uniform vec2 uRes, uARes;
uniform vec3 uWhite, uGrey, uShadow, uOrange, uNavy, uNavyTop, uKey, uKeyCol;
uniform float uDepthK, uReliefK, uCoarse, uWrap, uSoft, uKeyI, uRimI, uRimW, uBounceI, uAmbI, uSpecI, uSpecPow, uSheen, uVeinAmt, uCloud;
uniform float uLandAlbedo, uLandSpec, uHorizonI, uExposure, uVig, uFlip, uSeed, uSss, uMottle, uGlassI, uWater, uWaterY;
uniform float uGrain, uSparkle, uFogLo, uFogHi, uDSubj, uFogI, uDepthRim, uVeinPeriod, uVeinWarp, uVeinFlow, uVeinZoneLo, uVeinW;
uniform vec3 uSssCol;
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
  // ---- totality sky: navy-black, the 360° horizon glow fading softly upward (orange-gold at the line, deep orange above)
  vec3 skyc = mix(uNavyTop, uNavy, smoothstep(0.0, 1.0, pow(clamp(uv.y / 0.6, 0.0, 1.0), 0.8)));
  vec3 glowCol = mix(uOrange * vec3(0.85, 0.55, 0.45), uOrange, smoothstep(0.15, 0.7, band));
  skyc += glowCol * uHorizonI * band * (0.9 + 0.1 * vnoise(vec2(uv.x * 30.0, 3.0)));
  skyc += vec3(1.0, 0.82, 0.55) * uHorizonI * 0.3 * pow(band, 5.0);
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
  float rk = uReliefK * (1.0 - 0.8 * eye) * mix(0.2, 1.0, f0.b);
  vec2 g = vec2(Lr(uv + vec2(e1.x, 0)) - Lr(uv - vec2(e1.x, 0)), Lr(uv + vec2(0, e1.y)) - Lr(uv - vec2(0, e1.y)));
  vec3 n = normalize(nF + vec3(-g * rk, 0.0));
  // ---- albedo: marble with veins along the flow field, faint clouding; the land is dark stone
  // veins: a few thin, irregular veins running through the block, warped by turbulence and by the flow field (LIC noise),
  // so they cross the carved form like real veining instead of tracing it; gated into zones so only a few show
  float mv = f1.a;
  float ph = (dot(sp, vec2(0.83, 0.55)) / uVeinPeriod + uVeinWarp * fbm(sp * 0.0022 + uSeed) + uVeinFlow * mv) * 3.14159;
  float sv = abs(sin(ph)), fw = max(fwidth(ph), 1e-4);
  float zone = smoothstep(uVeinZoneLo, uVeinZoneLo + 0.2, fbm(sp * 0.0016 + uSeed * 3.1 + 7.0));
  float wv = uVeinW * (0.5 + 1.6 * zone * fbm(sp * 0.01 + 3.3));                       // hairline to ~2.5 px, varying
  float vein = (1.0 - smoothstep(0.0, fw * wv, sv)) * zone;
  vein = max(vein, exp(-sv * sv / (2.0 * pow(fw * wv * 3.5, 2.0))) * 0.22 * zone);    // a soft grey bleed around it
  vein = vein * uVeinAmt + smoothstep(0.65, 0.95, mv) * uMottle;
  float cloud = fbm(sp * 0.004 + uSeed) - 0.5;
  vec3 alb = uWhite * (1.0 + uCloud * cloud);
  alb = mix(alb, uGrey, clamp(vein * m, 0.0, 0.85));
  float land = 1.0 - m;
  // crystalline grain: marble is a mass of calcite crystals (faint albedo grain, tiny sparkles in the light)
  float gr = hash12(floor(sp * 0.8) + uSeed);
  alb *= 1.0 + uGrain * (gr - 0.5);
  // the land and the other statues: the same stone; distance is handled below by aerial perspective
  float near = smoothstep(uFogLo, uFogHi, D(uv) / uDSubj);              // distance relative to the subject
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
  // subsurface: light scattered into the stone bleeds past the terminator into the shadows, warm
  float wide = clamp((dot(normalize(nC), L) + 1.0) / 2.0, 0.0, 1.0);
  col += alb * uSssCol * uSss * (wide * (1.0 - dif) * 1.4 + wC * (1.0 - wC) * 1.5) * (0.4 + 0.6 * m);
  // the 360° horizon glow is low: a faint orange bounce on surfaces turned down and sideways
  col += alb * uOrange * uBounceI * clamp(n.y, 0.0, 1.0) * smoothstep(0.35, 0.9, uv.y) * m * ao;
  // polished specular (none on the eyes)
  vec3 Hh = normalize(L + V);
  float nh = max(dot(n, Hh), 0.0);
  float spec = (pow(nh, uSpecPow) * uSpecI + pow(nh, 8.0) * uSheen) * mix(1.0, uLandSpec, land) * (1.0 - eye) * ao;
  spec += uSparkle * step(0.993, gr) * smoothstep(0.55, 0.9, dif) * m * (1.0 - eye);    // calcite sparkles
  col += uKeyCol * spec;
  // other statues: their silhouettes against what lies behind catch the horizon glow (depth edges in the land)
  float dE = clamp(length(vec2(D(uv + vec2(px.x * 2.0, 0)) - D(uv - vec2(px.x * 2.0, 0)), D(uv + vec2(0, px.y * 2.0)) - D(uv - vec2(0, px.y * 2.0)))) * 18.0, 0.0, 1.0);
  float awayM = 1.0 - smoothstep(0.02, 0.15, texture(uF2, uv).g);                       // never along the subject's edge
  col += uOrange * uDepthRim * dE * land * (1.0 - sky) * awayM;
  // aerial perspective: the far land is veiled by night air lit faintly by the horizon glow, near forms stay dark stone
  vec3 fogC = uNavy * 2.6 + uOrange * uFogI;
  col = mix(col, fogC, land * (1.0 - sky) * (1.0 - near) * 0.85);
  // ---- composite: crisp matte silhouettes over the sky; land everywhere else
  col += uOrange * uHorizonI * 0.05 * smoothstep(0.0, 1.0, band) * land * (1.0 - sky);
  // water: a dark mirror, the orange horizon band reflected as a soft streak near the far bank, ripples break it
  float wz = uWater * land * (1.0 - sky) * smoothstep(uWaterY - 0.12, uWaterY + 0.05, uv.y);
  float ripple = 0.55 + 0.45 * vnoise(vec2(sp.x * 0.004, sp.y * 0.09));
  float refl = exp(-max(0.0, uv.y - uWaterY) / 0.045) * ripple;                 // the far bank's horizon glow, mirrored
  col = mix(col, uShadow * 0.45 + uOrange * 0.22 * refl, wz * 0.85);
  // frozen spray: tiny glass glints with a small cool halo
  float gls = texture(uF2, uv).r;
  col += vec3(0.92, 0.95, 1.0) * uGlassI * gls * gls + uOrange * 0.25 * gls;
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
    const veins = [];
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
  const T0 = glw.fieldTexture(F.aw, F.ah, [f.Db, f.Lb, f.M, f.sky]), T1 = glw.fieldTexture(F.aw, F.ah, [f.ao, f.band, f.eyes, f.mot]), T2 = glw.fieldTexture(F.aw, F.ah, [f.glass, f.nearM, null, null]);
  const lin = h => hexRgb(h).map(s2l);
  const pl = new Float32Array(16); (cfg.planets || []).slice(0, 4).forEach((p, i) => { pl[i * 4] = p.x; pl[i * 4 + 1] = p.y; pl[i * 4 + 2] = p.i ?? 1; pl[i * 4 + 3] = p.r ?? 1.6; });
  glw.pass(SHADE_FS, {
    uF0: T0, uF1: T1, uF2: T2, uVein: VEIN.tex[0], uARes: [F.aw, F.ah], uGlassI: cfg.glassI, uWater: cfg.water, uWaterY: cfg.waterY,
    uWhite: lin(cfg.white), uGrey: lin(cfg.grey), uShadow: lin(cfg.shadow), uOrange: lin(cfg.orange), uNavy: lin(cfg.navy), uNavyTop: lin(cfg.navyTop),
    uKey: cfg.key, uKeyCol: cfg.keyCol, uDepthK: cfg.depthK, uReliefK: cfg.reliefK, uCoarse: cfg.coarse, uWrap: cfg.wrap, uSoft: cfg.soft,
    uKeyI: cfg.keyI, uRimI: cfg.rimI, uRimW: cfg.rimW, uBounceI: cfg.bounceI, uAmbI: cfg.ambI, uSpecI: cfg.specI, uSpecPow: cfg.specPow, uSheen: cfg.sheen, uVeinAmt: cfg.veinAmt, uCloud: cfg.cloud,
    uLandAlbedo: cfg.landAlbedo, uLandSpec: cfg.landSpec, uSss: cfg.sss, uMottle: cfg.mottle, uGrain: cfg.grain, uSparkle: cfg.sparkle, uFogLo: cfg.fogLo, uFogHi: cfg.fogHi, uDSubj: f.dSubj, uFogI: cfg.fogI, uDepthRim: cfg.depthRim,
    uVeinPeriod: cfg.veinPeriod, uVeinWarp: cfg.veinWarp, uVeinFlow: cfg.veinFlow, uVeinZoneLo: cfg.veinZoneLo, uVeinW: cfg.veinW, uSssCol: cfg.sssCol, uHorizonI: cfg.horizonI, uExposure: cfg.exposure, uVig: cfg.vignette, uFlip: 1, uSeed: cfg.seed,
    uPlanets: pl, uNPlanets: Math.min(4, (cfg.planets || []).length), uStars: cfg.stars
  }, null);
  glw.finish();
  glw.deleteTexture(T0); glw.deleteTexture(T1); glw.deleteTexture(T2);
  ms.gpu = Math.round(performance.now() - t0);
  return { ms, nVeins: c.veins.length, fieldsMs: c.ms };
}
