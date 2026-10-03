// stone.js: a plate becomes statuary. Builds the REFERENCE the brush engine paints toward in the MARBLE world:
// every figure is carved white stone, the land is dark stone, the sky is the totality dome.
//
//   const st = stoneSource(f, src, opts)     // src: any brush-engine Source (plateSource / stillSource / canvasSource)
//   -> a Source { R, G, B (the designed marble reference), depth, matte (the statue mask), sky (the sky mask, for the
//      sun pass), wall (Uint8: strokes never cross the horizon), faces, mat, key, hz (horizon row per column), M, S }
//
// Light (STYLE_BIBLE MARBLE): a cool soft key from above (the corona), a warm orange rim from the 360-degree horizon
// glow behind the figures, a faint orange bounce from the glowing land on down-facing stone, navy ambient. Form comes
// from the plate's depth (edge-preserving normals, a rounded turn at every silhouette) plus the plate's own luminance
// as a band-pass (the carving: folds, scales, curls) with its large-scale colour removed, so a crimson cloak and a
// bronze helmet are the same stone. Eyes are blank (the detected eyes are flattened). A few thin veins live in the
// material space of the shot, so they stay on the stone as the camera drifts.
//
// The reference is written in sRGB, compensated for the engine's warm offsets, so paint() with STONE_PAINT (identity
// relighting) reproduces it before the palette box and the brushes.

import { clamp, lerp, sstep, blur, blurFast, vnoise, hash3, rgb2lab, lab2rgb, s2lf, l2sf } from '../brush/util.js';

const lin = c => [s2lf(c[0]), s2lf(c[1]), s2lf(c[2])];
const HX = h => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

export const STONE_DEFAULTS = {
  // sky: depth below dHi is far; the horizon is found per column scanning up from the bottom
  sky: { dLo: .02, dHi: .06, below: .75, run: 3 }, horizonY: null,
  // statues: plate matte + depth relief over the ground plane of each row
  statue: { matte: 1, relief: [.025, .07], mode: 'relief' },
  relief: 1500, round: 1.2, roundSigma: 2.6, depthSigma: 2.4, inflate: .5, inflateR: 15, inflateSigma: 1.3, split: .012, groove: .55, fog: .4,
  key: [-.42, -.88, .4], keyI: 1.25, keyCol: [.82, .88, 1.0], wrap: .06, spec: .2, specPow: 30, sss: .08,
  ambI: 1, ambCol: [.036, .043, .066],
  rimI: .9, rimCol: [1.0, .64, .36], rimSigma: .65, rimBreak: .42, rimGraz: 0, bounceI: .12, bounceCol: [.5, .28, .12],
  detail: .42, detailSigma: 4, detailClamp: [.35, 2.1], keep: .1, ao: 30, plateShade: .8, depthLight: 1, shadeClamp: [.28, 2.3],
  albedo: "#ece6db", vein: "#6f7178", veins: .95, veinPeriod: 210, veinW: 1.6, veinZone: .42, cloud: .07,
  ground: { albedo: .13, tint: [1.0, .96, .92], glow: .8, glowH: .05, glowFar: .25, detail: .9, keyK: .5, contact: .65 },
  water: { k: .0, lo: .55, hi: .8, col: [1.0, .64, .34] },
  skyCol: { zenith: '#0a0d14', mid: '#151a25', glow: 1.0, band: .03, wide: .1, bandW: .72, az: .3, streak: .035 },
  exposure: 1.0, blankEyes: true, eyeFlat: .95,
};
const merge = (a, b) => { const o = { ...a }; for (const k in b) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' ? { ...a[k], ...b[k] } : b[k]; return o; };

// ---------------------------------------------------------------- horizon / sky / statue masks
function horizonScan(D, aw, ah, sk) {
  const hz = new Float32Array(aw), yMax = Math.floor(sk.below * ah);
  for (let x = 0; x < aw; x++) {
    let y = ah - 1, run = 0, top = 0;
    for (; y >= 0; y--) {
      const far = D[y * aw + x] < sk.dHi;
      if (far && y <= yMax) { run++; if (run >= sk.run) { top = y + run; break; } } else run = 0;
    }
    hz[x] = y < 0 ? 0 : top;
  }
  return hz;
}
// a robust horizon LINE (for the glow band): the true horizon is the lowest sky edge; heads poke above it
function horizonLine(hz, aw, ah, o) {
  if (o.horizonY != null) { const out = new Float32Array(aw); for (let x = 0; x < aw; x++) out[x] = (typeof o.horizonY === 'function' ? o.horizonY(x / aw) : o.horizonY) * ah; return out; }
  const s = Array.from(hz).sort((a, b) => a - b), v = s[Math.floor(s.length * .72)];
  const out = new Float32Array(aw);
  for (let x = 0; x < aw; x++) out[x] = Math.max(hz[x], v - .015 * ah) > v + .02 * ah ? v : Math.max(Math.min(hz[x], v + .01 * ah), v - .01 * ah);
  // smooth
  const t = out.slice(), r = Math.round(aw * .03);
  for (let x = 0; x < aw; x++) { let a = 0, n = 0; for (let j = Math.max(0, x - r); j <= Math.min(aw - 1, x + r); j++) { a += t[j]; n++; } out[x] = a / n; }
  return out;
}

// the ground's depth: per row a robust line g = a + b x over the land (non-sky, non-matte, below the horizon), refit
// without what stands nearer than that plane (the figures), then smoothed down the frame; zero above the horizon line
// (anything there that is not sky is an object: an arrow, a head)
function groundField(D, M0, S, aw, ah, hzL, sc) {
  const N = aw * ah, A = new Float32Array(ah), Bv = new Float32Array(ah), ok = new Uint8Array(ah);
  for (let y = 0; y < ah; y++) {
    let a = 0, b = 0, use = null;
    for (let it = 0; it < 3; it++) {
      let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (let x = 0; x < aw; x += 2) {
        const i = y * aw + x; if (y < hzL[x] + 1 || S[i] > .3 || (M0 && M0[i] > .3)) continue;
        const d = D[i]; if (it > 0 && d - (a + b * x) > (it === 1 ? .035 : .02)) continue;
        n++; sx += x; sy += d; sxx += x * x; sxy += x * d;
      }
      if (n < 12) { use = null; break; }
      const den = n * sxx - sx * sx; b = den > 1e-6 ? (n * sxy - sx * sy) / den : 0; a = (sy - b * sx) / n; use = 1;
    }
    if (use) { A[y] = a; Bv[y] = b; ok[y] = 1; }
  }
  // fill rows without enough land from their neighbours, then smooth vertically
  let last = -1;
  for (let y = 0; y < ah; y++) if (ok[y]) { if (last < 0) for (let j = 0; j < y; j++) { A[j] = A[y]; Bv[j] = Bv[y]; } else for (let j = last + 1; j < y; j++) { const t = (j - last) / (y - last); A[j] = lerp(A[last], A[y], t); Bv[j] = lerp(Bv[last], Bv[y], t); } last = y; }
  if (last >= 0) for (let j = last + 1; j < ah; j++) { A[j] = A[last]; Bv[j] = Bv[last]; }
  const A2 = A.slice(), B2 = Bv.slice(), r = Math.max(1, Math.round(4 * sc));
  for (let y = 0; y < ah; y++) { let sa = 0, sb = 0, n = 0; for (let j = Math.max(0, y - r); j <= Math.min(ah - 1, y + r); j++) { sa += A2[j]; sb += B2[j]; n++; } A[y] = sa / n; Bv[y] = sb / n; }
  const g = new Float32Array(N);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) g[y * aw + x] = y < hzL[x] - 2 || last < 0 ? 0 : A[y] + Bv[y] * x;
  return g;
}

// exact squared Euclidean distance transform (Felzenszwalb & Huttenlocher), in px: distance to the nearest pixel
// where inside[i] is false
function edt1(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s2 = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s2 <= z[k]) { k--; s2 = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s2; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
export function edt(inside, w, h) {
  const INF = 1e10, N = w * h, out = new Float32Array(N), n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = inside[y * w + x] ? INF : 0; edt1(f, h, d, v, z); for (let y = 0; y < h; y++) out[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = out[y * w + x]; edt1(f, w, d, v, z); for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]); }
  return out;
}

// normalised convolution: blur a field inside a weight (never across the silhouette)
function blurIn(F, W, aw, ah, s) {
  const N = aw * ah, a = new Float32Array(N);
  for (let i = 0; i < N; i++) a[i] = F[i] * W[i];
  const num = blurFast(a, aw, ah, s), den = blurFast(W, aw, ah, s), out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = den[i] > 1e-3 ? num[i] / den[i] : F[i];
  return out;
}

// ---------------------------------------------------------------- the totality sky (sRGB out)
// navy-black dome; the 360-degree horizon glow, orange at the line, darker under the sun (WNW) and brightest away from
// it (NNE / SSW, the frame sides); faint horizontal streaks so the brushes run along the bands
export function skyColour(x, y, hzY, aw, ah, sc, sun, out) {
  const dy = Math.max(0, hzY - y) / ah;
  const zen = sc._z, mid = sc._m;
  const dome = Math.exp(-dy / .3);
  let r = lerp(zen[0], mid[0], dome), g = lerp(zen[1], mid[1], dome), b = lerp(zen[2], mid[2], dome);
  const az = sun ? 1 - sc.az * (1 - sstep(.04, .4, Math.abs(x / aw - sun.x))) : 1;
  const band = (sc.bandW * Math.exp(-dy / sc.band) + (1 - sc.bandW) * Math.exp(-dy / sc.wide)) * sc.glow * az;
  const hot = sstep(.35, 1, band);
  // deep ember high up, signal orange in the band, pale gold right at the line
  const gr = lerp(.62, 1.0, hot), gg = lerp(.22, .56 + .2 * hot * hot, hot), gb = lerp(.06, .2 + .25 * hot * hot, hot);
  const bk = clamp(band * .95);
  r = lerp(r, gr * Math.min(1.3, band * 1.15), bk); g = lerp(g, gg * Math.min(1.3, band * 1.15), bk); b = lerp(b, gb * Math.min(1.3, band * 1.15), bk);
  const st = (vnoise(x / aw * 3.1, y / ah * 46, 71) - .5) * sc.streak * (.4 + dome);
  out[0] = r * (1 + st); out[1] = g * (1 + st); out[2] = b * (1 + st);
  return out;
}

// ---------------------------------------------------------------- the plate's form shading without its colours
// Statues are one material. The plate's luminance carries the form (folds, muscles, the turn of a shield) but also the
// costume (crimson cloak, ochre tunic, bronze): the statue pixels are clustered by chroma (OKLab a, b; k-means), and
// each pixel's luminance is taken relative to its cluster's median, so the cloak in shadow stays darker than the cloak
// in the light, but no darker than skin. Soft cluster weights keep costume seams from showing.
function plateShading(R, G, B, Lp, M, aw, ah, o) {
  const N = aw * ah, K = o.clusters ?? 6, lab = [0, 0, 0];
  const A = new Float32Array(N), Bb = new Float32Array(N);
  const samp = [];
  for (let i = 0; i < N; i++) if (M[i] > .3) { rgb2lab(R[i], G[i], B[i], lab); A[i] = lab[1]; Bb[i] = lab[2]; if (i % 7 === 0) samp.push(i); }
  const out = new Float32Array(N).fill(1);
  if (samp.length < 50) return out;
  // init: centres at hue quantiles (deterministic), then Lloyd iterations
  const sorted = samp.slice().sort((p, q) => Math.atan2(Bb[p], A[p]) - Math.atan2(Bb[q], A[q]));
  const ca = new Float32Array(K), cb = new Float32Array(K);
  for (let k = 0; k < K; k++) { const j = sorted[Math.floor((k + .5) / K * sorted.length)]; ca[k] = A[j]; cb[k] = Bb[j]; }
  const asg = new Int32Array(samp.length);
  for (let it = 0; it < 8; it++) {
    const sa = new Float64Array(K), sb = new Float64Array(K), n = new Float64Array(K);
    for (let j = 0; j < samp.length; j++) {
      const i = samp[j]; let best = 0, bd = 1e9;
      for (let k = 0; k < K; k++) { const d = (A[i] - ca[k]) ** 2 + (Bb[i] - cb[k]) ** 2; if (d < bd) { bd = d; best = k; } }
      asg[j] = best; sa[best] += A[i]; sb[best] += Bb[i]; n[best]++;
    }
    for (let k = 0; k < K; k++) if (n[k] > 0) { ca[k] = sa[k] / n[k]; cb[k] = sb[k] / n[k]; }
  }
  // each cluster's median luminance (over its smoothed luminance: shading at the scale of the form survives)
  const med = new Float32Array(K);
  for (let k = 0; k < K; k++) { const v = []; for (let j = 0; j < samp.length; j++) if (asg[j] === k) v.push(Lp[samp[j]]); v.sort((a, b) => a - b); med[k] = v.length ? Math.max(.02, v[v.length >> 1]) : .3; }
  let gm = 0; { const v = Array.from(med).sort((a, b) => a - b); gm = v[K >> 1]; }
  const sig2 = 2 * (o.clusterSigma ?? .03) ** 2, [lo, hi] = o.shadeClamp;
  for (let i = 0; i < N; i++) {
    if (M[i] <= .002) continue;
    let ws = 0, al = 0;
    for (let k = 0; k < K; k++) { const w = Math.exp(-((A[i] - ca[k]) ** 2 + (Bb[i] - cb[k]) ** 2) / sig2) + 1e-6; ws += w; al += w * med[k]; }
    al /= ws;
    out[i] = clamp((Lp[i] + .015) / (al + .015), lo, hi);
  }
  // keep a breath of the costume's value (the shield's blazon, the scale armour read as carving)
  const keepV = o.costume ?? .12;
  if (keepV > 0) for (let i = 0; i < N; i++) if (M[i] > .002) out[i] *= Math.pow(clamp(Lp[i] / Math.max(.02, gm), .3, 3) / out[i] * out[i], 0) * Math.pow(clamp((Lp[i] + .015) / (gm + .015), .3, 3) / out[i], keepV);
  return out;
}

// ---------------------------------------------------------------- the builder
export function stoneSource(f, src, opts = {}) {
  const o = merge(STONE_DEFAULTS, opts);
  const aw = src.aw, ah = src.ah, N = aw * ah, sc = (aw / 960);
  const R = src.R, G = src.G, B = src.B;
  // plate luminance (linear), exposure-normalised by its own 90th percentile
  const Lp = new Float32Array(N);
  for (let i = 0; i < N; i++) Lp[i] = .2126 * s2lf(R[i]) + .7152 * s2lf(G[i]) + .0722 * s2lf(B[i]);
  { const h = new Uint32Array(256); for (let i = 0; i < N; i += 3) h[Math.min(255, Lp[i] * 255 | 0)]++; let a = 0, q = 255; const tot = Math.ceil(N / 3); for (let b = 0; b < 256; b++) { a += h[b]; if (a >= tot * .9) { q = b; break; } }
    const k = .6 / Math.max(.02, (q + .5) / 255); for (let i = 0; i < N; i++) Lp[i] = Math.min(1.5, Lp[i] * k); }
  const D = src.depth || new Float32Array(N).fill(.5);
  // sky
  let S = new Float32Array(N), hz = new Float32Array(aw), hzL = new Float32Array(aw).fill(0);
  if (o.sky && src.depth) {
    hz = horizonScan(D, aw, ah, o.sky);
    for (let x = 0; x < aw; x++) for (let y = 0; y < hz[x]; y++) { const i = y * aw + x; S[i] = 1 - sstep(o.sky.dLo, o.sky.dHi, D[i]); }
    if (src.sky) for (let i = 0; i < N; i++) S[i] = Math.max(S[i], src.sky[i]);
    S = blur(S, aw, ah, .7);
    hzL = horizonLine(hz, aw, ah, o);
  } else if (src.sky) { S = Float32Array.from(src.sky); for (let x = 0; x < aw; x++) { let y = 0; while (y < ah && S[y * aw + x] > .5) y++; hz[x] = y; } hzL = horizonLine(hz, aw, ah, o); }
  else if (o.horizonY != null) hzL = horizonLine(hz, aw, ah, o);
  // statues
  const M0 = src.matte;
  const Mraw = new Float32Array(N);
  if (o.statue.mode === 'all') Mraw.fill(1);
  else {
    const g = o.statue.mode === 'relief' && src.depth ? groundField(D, M0, S, aw, ah, hzL, sc) : null;
    const [rLo, rHi] = o.statue.relief;
    for (let i = 0; i < N; i++) {
      let m = M0 ? M0[i] * o.statue.matte : 0;
      if (g) m = Math.max(m, sstep(rLo, rHi, D[i] - g[i]));
      Mraw[i] = m;
    }
  }
  if (o.statueMask) for (let i = 0; i < N; i++) Mraw[i] = o.statueMask(i % aw, (i / aw) | 0, Mraw[i]);
  let M = blur(Mraw, aw, ah, 1.1);
  for (let i = 0; i < N; i++) M[i] = sstep(.38, .62, M[i]) * (1 - S[i]);
  const Gd = new Float32Array(N); for (let i = 0; i < N; i++) Gd[i] = Math.max(0, 1 - M[i] - S[i]);
  const shadeP = o.plateShade > 0 ? plateShading(R, G, B, Lp, M, aw, ah, o) : null;
  // normals: depth smoothed inside each region, plus a rounded turn at the silhouette
  const Ds = blurIn(D, M, aw, ah, o.depthSigma * sc), Dg = blurIn(D, Gd, aw, ah, 4 * sc);
  // the silhouette inflated into a rounded relief (every limb a cylinder, the torso a barrel): the big form the depth
  // map is too flat to give; h = R sqrt(1 - (1 - d/R)^2) of the distance d to the silhouette, R the local half-width
  let Hi = null; const grooveM = new Float32Array(N);
  if (o.inflate > 0) {
    const ins = new Uint8Array(N); for (let i = 0; i < N; i++) ins[i] = M[i] > .5 ? 1 : 0;
    // internal contours: a step in depth inside the statue (an arm across the chest, a shield before the body) is a
    // silhouette too, so each part rounds by itself and the far side of the step gets a carved groove
    if (o.split > 0) for (let y = 1; y < ah - 1; y++) for (let x = 1; x < aw - 1; x++) {
      const i = y * aw + x; if (!ins[i]) continue;
      const gx = D[i + 1] - D[i - 1], gy = D[i + aw] - D[i - aw];
      if (Math.hypot(gx, gy) > o.split * 2 / sc) { const far = (gx * gx > gy * gy) ? (gx > 0 ? i - 1 : i + 1) : (gy > 0 ? i - aw : i + aw); grooveM[far] = 1; ins[far] = 0; }
    }
    const dist = edt(ins, aw, ah), Rr = o.inflateR * sc;
    // local half-width: the max distance nearby (a thin arm stays thin, a torso swells)
    const dmx = blurFast(dist, aw, ah, 6 * sc);
    Hi = new Float32Array(N);
    for (let i = 0; i < N; i++) { if (!ins[i]) continue; const R0 = Math.min(Rr, Math.max(1.5, dmx[i] * 1.6)), q = Math.min(1, dist[i] / R0); Hi[i] = R0 * Math.sqrt(1 - (1 - q) * (1 - q)); }
    Hi = blur(Hi, aw, ah, o.inflateSigma * sc);
  }
  const groove = blur(grooveM, aw, ah, 1.2 * sc);
  // contact shadows on the land: the statue mask, blurred and pushed down a little
  const Mc = new Float32Array(N); { const mb = blurFast(M, aw, ah, 7 * sc), dy = Math.round(5 * sc); for (let i = dy * aw; i < N; i++) Mc[i] = mb[i - dy * aw]; }
  // aerial perspective among the statues: the farther ones veiled by the night air (relative to the nearest)
  let dNear = .5; { const v = []; for (let i = 0; i < N; i += 11) if (M[i] > .5) v.push(D[i]); if (v.length > 20) { v.sort((a, b) => a - b); dNear = v[Math.floor(v.length * .9)]; } }
  const Mb = blurFast(M, aw, ah, o.roundSigma * sc), Mb2 = blur(M, aw, ah, o.rimSigma * sc);
  const kD = o.relief * sc;
  // detail: the plate's luminance relative to its neighbourhood, per region (statue / rest)
  const Ld = blurIn(Lp, M, aw, ah, o.detailSigma * sc), Lg = blurIn(Lp, Gd, aw, ah, o.detailSigma * sc);
  const Lk = blurIn(Lp, M, aw, ah, 14 * sc);
  let medS = .3; { const v = []; for (let i = 0; i < N; i += 7) if (M[i] > .5) v.push(Lk[i]); if (v.length > 20) { v.sort((a, b) => a - b); medS = Math.max(.03, v[v.length >> 1]); } }
  const cav = blurFast(Ds, aw, ah, 6 * sc);
  // blank eyes: flatten the detail in an ellipse around each detected eye (and the engine sees no pupil)
  const eyeM = new Float32Array(N);
  if (o.blankEyes) for (const q of src.faces || []) if (q.eyes && q.eyes.length >= 2 && (q.score ?? 1) > .3) {
    const fw = (q.box[2] - q.box[0]) * aw, rx = fw * .14, ry = fw * .085;
    for (const [eu, ev] of q.eyes) {
      const ex = eu * aw, ey = ev * ah;
      for (let y = Math.max(0, Math.floor(ey - ry * 2)); y <= Math.min(ah - 1, ey + ry * 2); y++) for (let x = Math.max(0, Math.floor(ex - rx * 2)); x <= Math.min(aw - 1, ex + rx * 2); x++) {
        const d = Math.hypot((x - ex) / rx, (y - ey) / ry), i = y * aw + x;
        eyeM[i] = Math.max(eyeM[i], (1 - sstep(.7, 1.25, d)) * o.eyeFlat);
      }
    }
  }
  // colours
  const Aw = lin(HX(o.albedo)), Av = lin(HX(o.vein));
  const keyL = (() => { const k = o.key, m = Math.hypot(k[0], k[1], k[2]); return [k[0] / m, k[1] / m, k[2] / m]; })();
  const sk = { ...o.skyCol, _z: lin(HX(o.skyCol.zenith)), _m: lin(HX(o.skyCol.mid)) };
  const sun = o.sun || null;
  const mx = src.mat ? src.mat.mx : null, my = src.mat ? src.mat.my : null;
  const vp = o.veinPeriod, gnd = o.ground, wat = o.water;
  const outR = new Float32Array(N), outG = new Float32Array(N), outB = new Float32Array(N);
  const sky = [0, 0, 0], lab = [0, 0, 0], rgb = [0, 0, 0];
  const [dLo, dHi] = o.detailClamp;
  const corona = sun && o.corona !== false ? { x: sun.x * aw, y: sun.y * ah, R: (sun.r * aw) * 1.066, k: o.coronaGlow ?? .55 } : null;
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const i = y * aw + x, m = M[i], s = S[i], gd = Gd[i];
    let r = 0, g = 0, b = 0;
    if (m > .002) {
      // normal
      const xl = x > 0 ? i - 1 : i, xr = x < aw - 1 ? i + 1 : i, yu = y > 0 ? i - aw : i, ydn = y < ah - 1 ? i + aw : i;
      let nx = -(Ds[xr] - Ds[xl]) * .5 * kD, ny = -(Ds[ydn] - Ds[yu]) * .5 * kD;
      nx -= (Mb[xr] - Mb[xl]) * .5 * o.round * sc; ny -= (Mb[ydn] - Mb[yu]) * .5 * o.round * sc;
      if (Hi) { nx -= (Hi[xr] - Hi[xl]) * .5 * o.inflate / sc * .9; ny -= (Hi[ydn] - Hi[yu]) * .5 * o.inflate / sc * .9; }
      const nl = Math.hypot(nx, ny, 1); nx /= nl; ny /= nl; const nz = 1 / nl;
      const ndl = nx * keyL[0] + ny * keyL[1] + nz * keyL[2];
      const kd = clamp((ndl + o.wrap) / (1 + o.wrap));
      const up = Math.max(0, -ny), down = Math.max(0, ny), graz = Math.pow(1 - nz, 2);
      // rim: the horizon glow behind the figure catches the silhouette where it faces sideways or down, broken
      let ex = -(Mb2[xr] - Mb2[xl]), ey = -(Mb2[ydn] - Mb2[yu]); const em = Math.hypot(ex, ey);
      let rim = 0;
      if (em > 1e-4) {
        ex /= em; ey /= em;
        const band = sstep(.12, .9, 1 - Mb2[i]);
        const side = clamp(.3 + .75 * Math.abs(ex) + .6 * Math.max(0, ey)) * (1 - .85 * Math.max(0, -ey));
        const hb = .45 + .55 * Math.exp(-Math.abs(y - (hzL[x] || ah * .5)) / (.22 * ah));
        rim = band * side * hb;
      }
      rim += o.rimGraz * graz * (1 - up);
      if (mx) rim *= sstep(o.rimBreak - .12, o.rimBreak + .12, vnoise(mx[i] / sc * .012 + 5.3, my[i] / sc * .012 + 1.7, 941));
      rim = clamp(rim) * o.rimI;
      const ao = clamp(1 - Math.max(0, cav[i] - Ds[i]) * o.ao);
      let det = clamp((Lp[i] + .02) / (Ld[i] + .02), dLo, dHi);
      det = Math.pow(det, o.detail);
      det = lerp(det, 1, eyeM[i]);
      const keep = Math.pow(clamp(Lk[i] / medS, .3, 2.2), o.keep) * (shadeP ? Math.pow(lerp(1, shadeP[i], 1 - eyeM[i]), o.plateShade) : 1);
      // albedo: marble, veins in material space, faint clouding
      let ar = Aw[0], ag = Aw[1], ab = Aw[2];
      if (o.veins > 0 && mx) {
        const u = mx[i] / sc, v = my[i] / sc;
        const zone = sstep(o.veinZone, o.veinZone + .16, vnoise(u * .0021 + 3.1, v * .0021 + 7.7, 911));
        if (zone > 0) {
          const w1 = vnoise(u * .006, v * .006, 913) * 2.2 + vnoise(u * .019, v * .019, 917) * .7;
          const ph = (u * .83 + v * .55) / vp + w1, sv = Math.abs(Math.sin(Math.PI * ph));
          const fw = Math.PI / vp * 1.0 * (o.veinW * (.5 + 1.2 * vnoise(u * .02, v * .02, 919)));
          const vl = (1 - sstep(0, fw * 1.4, sv)) + .25 * Math.exp(-(sv * sv) / (2 * (fw * 4) * (fw * 4)));
          const vk = clamp(vl * zone * o.veins);
          ar = lerp(ar, Av[0], vk); ag = lerp(ag, Av[1], vk); ab = lerp(ab, Av[2], vk);
        }
        const cl = 1 + o.cloud * (vnoise(u * .004, v * .004, 931) - .5) * 2;
        ar *= cl; ag *= cl; ab *= cl;
      }
      const amb = o.ambI * (.55 + .45 * up + .15 * (1 - graz));
      const li = lerp(1, kd, o.depthLight) * ao * o.keyI;
      // a polished stone's sheen (half vector with the viewer) and a warm subsurface bleed past the terminator
      const hx = keyL[0], hy = keyL[1], hz = keyL[2] + 1, hl = Math.hypot(hx, hy, hz);
      const sp = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hl), o.specPow) * o.spec * ao;
      const ss = o.sss * Math.exp(-Math.pow(ndl + .1, 2) * 18);
      r = ar * (o.ambCol[0] * amb + o.keyCol[0] * li + ss * 1.0) * det * keep + sp * .95 + ar * o.bounceCol[0] * o.bounceI * down;
      g = ag * (o.ambCol[1] * amb + o.keyCol[1] * li + ss * .78) * det * keep + sp * .97 + ag * o.bounceCol[1] * o.bounceI * down;
      b = ab * (o.ambCol[2] * amb + o.keyCol[2] * li + ss * .6) * det * keep + sp * 1.0 + ab * o.bounceCol[2] * o.bounceI * down;
      // the carved groove behind an internal edge
      const gv = 1 - o.groove * clamp(groove[i] * 1.6); r *= gv; g *= gv; b *= gv;
      // rim: the edge lit by the glow, a warm light that lightens the stone (never a brown outline)
      r = lerp(r, o.rimCol[0] * .95, rim * .85); g = lerp(g, o.rimCol[1] * .95, rim * .85); b = lerp(b, o.rimCol[2] * .95, rim * .85);
      // the night air veils the far statues (toward the dark slate of the sky above the glow)
      const fogK = o.fog * sstep(.02, .45, dNear - D[i]);
      r = lerp(r, sk._m[0] * 1.6 + .02, fogK); g = lerp(g, sk._m[1] * 1.6 + .02, fogK); b = lerp(b, sk._m[2] * 1.6 + .025, fogK);
      r *= m; g *= m; b *= m;
    }
    if (gd > .002) {
      // the land: dark stone under the corona, glowing orange toward the horizon, the plate's texture kept faintly
      const hzy = hzL[x], dh = Math.max(0, y - hzy) / ah;
      const det = Math.pow(clamp((Lp[i] + .02) / (Lg[i] + .02), dLo, dHi), gnd.detail * o.detail);
      const xl = x > 0 ? i - 1 : i, xr = x < aw - 1 ? i + 1 : i, yu = y > 0 ? i - aw : i, ydn = y < ah - 1 ? i + aw : i;
      let nx = -(Dg[xr] - Dg[xl]) * .5 * kD * .6, ny = -(Dg[ydn] - Dg[yu]) * .5 * kD * .6 - .9;
      const nl = Math.hypot(nx, ny, .5); nx /= nl; ny /= nl;
      const kd = clamp(nx * keyL[0] + ny * keyL[1] + .5 / nl * keyL[2]) * gnd.keyK + .25;
      const glow = (gnd.glow * Math.exp(-dh / gnd.glowH) + gnd.glowFar * Math.exp(-dh / (gnd.glowH * 4))) * (sun ? 1 - .35 * (1 - sstep(.05, .4, Math.abs(x / aw - sun.x))) : 1);
      // contact shadow: the land darkens under and around the statues standing on it
      const a0 = gnd.albedo * (1 - gnd.contact * clamp(Mc[i] * 1.8));
      let gr = Aw[0] * a0 * gnd.tint[0] * (o.keyCol[0] * kd * o.keyI + o.ambCol[0] * o.ambI) * det + glow * o.rimCol[0] * .55 * (.6 + .4 * det);
      let gg = Aw[1] * a0 * gnd.tint[1] * (o.keyCol[1] * kd * o.keyI + o.ambCol[1] * o.ambI) * det + glow * o.rimCol[1] * .55 * (.6 + .4 * det);
      let gb = Aw[2] * a0 * gnd.tint[2] * (o.keyCol[2] * kd * o.keyI + o.ambCol[2] * o.ambI) * det + glow * o.rimCol[2] * .55 * (.6 + .4 * det);
      if (wat.k > 0) {
        const wk = sstep(wat.lo, wat.hi, Lp[i]) * wat.k * Math.exp(-dh / (gnd.glowH * 2.5));
        gr = lerp(gr, wat.col[0] * (.45 + .55 * Lp[i]), wk); gg = lerp(gg, wat.col[1] * (.45 + .55 * Lp[i]), wk); gb = lerp(gb, wat.col[2] * (.45 + .55 * Lp[i]), wk);
      }
      r += gr * gd; g += gg * gd; b += gb * gd;
    }
    if (s > .002) {
      skyColour(x, y, hzL[x] || ah * .5, aw, ah, sk, sun, sky);
      let sr = sky[0], sg = sky[1], sb = sky[2];
      if (corona) {
        const dx = x - corona.x, dy = y - corona.y, cr = Math.hypot(dx, dy);
        if (cr > corona.R * .98) {
          const ca = Math.atan2(dy, dx), fib = .7 + .6 * vnoise(ca * 11 + 3, Math.log(cr / corona.R) * 5, 61);
          const k = corona.k * Math.pow(corona.R / cr, 2.5) * fib;
          sr += .82 * k; sg += .84 * k; sb += .86 * k;
        }
      }
      r += sr * s; g += sg * s; b += sb * s;
    }
    // exposure, a soft shoulder, back to sRGB, minus the engine's warm offsets (reference(): a +.004, b +.012 in the pool)
    const ex = o.exposure;
    r = r * ex; g = g * ex; b = b * ex;
    r = r / (1 + Math.max(0, r - .7) * .9); g = g / (1 + Math.max(0, g - .7) * .9); b = b / (1 + Math.max(0, b - .7) * .9);
    rgb2lab(l2sf(r), l2sf(g), l2sf(b), lab);
    lab2rgb(lab[0], lab[1] - .004, lab[2] - .012, rgb);
    outR[i] = rgb[0]; outG[i] = rgb[1]; outB[i] = rgb[2];
  }
  const wall = new Uint8Array(N); for (let i = 0; i < N; i++) wall[i] = S[i] > .5 ? 1 : 0;
  return { aw, ah, R: outR, G: outG, B: outB, depth: src.depth, matte: M, sky: S, wall, faces: src.faces || [], mat: src.mat,
    key: `${src.key}|stone|${f.t.toFixed(4)}|${opts.tag || ''}`, info: { ...(src.info || {}), stone: true }, hz: hzL, M, S, Lp, D };
}
