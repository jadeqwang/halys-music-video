// orbit/earth.js: the Earth in ORBIT: the first and only saturated blue in the film.
//
// Lines: the weather as field lines. A wind field on the unit sphere (zonal bands, Rossby waves, cyclones with inflow
// and small eddies) is traced once into evenly spaced streamlines (Jobard & Lefer on the sphere, 3D grid), each vertex
// carrying the cloud density and the land fraction under it. Projected per frame (any view, any distance), each
// streamline splits into white cloud runs (pearl, o 0), ocean runs (Earth-blue, o 2 with BLUE_PALETTE) and land runs
// (warm, dim); coastlines are crisp pearl; the sunlit limb gets the signal-orange rim. Two levels: G0 global and G1 a
// finer cap around Anatolia for the close views (the rush, the pull-back).
// Fill: a WebGL pass (gl.js) ray-casts the sphere: deep ocean blue, dark warm land (land_world.png, 1:50m), day/night
// from the Sun, a dusk band, limb haze and a thin blue atmosphere; composited with 'screen' over the line render, so the
// white cloud lines stay white on the blue.
//
//   await earthReady(level)          trace (once per page) the streamlines of level 0 (global) or 1 (+ Anatolia cap)
//   earthView({ lon0, lat0, roll, D, Rs, cx, cy, sun: [lon, lat] }) -> V   a camera at D Earth radii, screen radius Rs
//   project(V, p) -> [x, y, z]       Earth-fixed unit vector -> screen px (+ view z; visible when z > 1/D)
//   earthLines(V, o) -> lines        (o: { gain, clouds, ocean, land, coast, rim, minStep, occ: {x, y, r}, lod })
//   earthFill(f, V, o)               the blue body, 'screen'-composited into f.g (o: { occ, alpha, haze })
//   ll2v(lon, lat), v2ll(p)

import { WORLD, ANATOLIA } from './geo.gen.js';
import { loadImage } from '../../assets.js';
import { getGL } from '../../gl.js';
import { FL } from '../line/index.js';
import { clamp, lerp, sstep } from '../../core.js';

const D2R = Math.PI / 180;
export const ll2v = (lon, lat) => { const a = lon * D2R, b = lat * D2R, c = Math.cos(b); return [c * Math.cos(a), c * Math.sin(a), Math.sin(b)]; };
export const v2ll = p => [Math.atan2(p[1], p[0]) / D2R, Math.asin(clamp(p[2], -1, 1)) / D2R];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const m = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / m, a[1] / m, a[2] / m]; };

// ---------------------------------------------------------------- noise (3D value noise, deterministic)
function h3(x, y, z, s) { let n = (x * 374761393 + y * 668265263 + z * 1274126177 + s * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
function vn3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (i, j, k) => h3(xi + i, yi + j, zi + k, s);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u), x10 = lerp(c(0, 1, 0), c(1, 1, 0), u), x01 = lerp(c(0, 0, 1), c(1, 0, 1), u), x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}
function fbm3(x, y, z, s, oct = 4) { let a = .5, f = 1, t = 0, n = 0; for (let i = 0; i < oct; i++) { t += a * vn3(x * f, y * f, z * f, s + i * 31); n += a; a *= .5; f *= 2.07; } return t / n; }

// ---------------------------------------------------------------- land mask (CPU copy for the streamline colours)
const LAND_URL = new URL('./land_world.png', import.meta.url).href, ANAT_URL = new URL('./land_anatolia.png', import.meta.url).href;
let LAND = null;
async function landMask() {
  if (LAND) return LAND;
  const img = await loadImage(LAND_URL), w = 1440, h = 720, c = new OffscreenCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, a = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = d[i * 4] / 255;
  return (LAND = { w, h, a, img });
}
function landAt(p) {
  if (!LAND) return 0;
  const [lon, lat] = v2ll(p), x = (lon + 180) / 360 * LAND.w - .5, y = (90 - lat) / 180 * LAND.h - .5;
  const xi = Math.floor(x), yi = clamp(Math.floor(y), 0, LAND.h - 2), fx = x - xi, fy = clamp(y - yi, 0, 1), w = LAND.w;
  const X = i => ((i % w) + w) % w, A = LAND.a;
  return lerp(lerp(A[yi * w + X(xi)], A[yi * w + X(xi + 1)], fx), lerp(A[(yi + 1) * w + X(xi)], A[(yi + 1) * w + X(xi + 1)], fx), fy);
}

// ---------------------------------------------------------------- the weather (Earth-fixed): wind and cloud density
const HALYS_V = ll2v(34.85, 38.72);
// cyclones: [lon, lat, radius (deg), strength]; NH lows turn counter-clockwise seen from space, SH lows clockwise
const LOWS = [[37.5, 42.6, 4.2, 1.0], [-28, 56, 9, 1.2], [-48, 44, 7, 1], [-12, 46, 6, .8], [-42, 16, 3.2, 1.6], [-22, -46, 10, 1.1], [8, -52, 8, 1], [-62, -40, 7, .9],
  [148, 42, 9, 1.1], [-150, 48, 10, 1.1], [-165, 18, 3.4, 1.4], [88, 14, 3, 1.2], [120, -48, 9, 1], [60, -44, 8, 1], [-100, 12, 3, 1.2], [168, -22, 4, 1.2]]
  .map(([lon, lat, r, s]) => ({ c: ll2v(lon, lat), r: r * D2R, s: s * (lat >= 0 ? 1 : -1), lat }));
const EDDIES = Array.from({ length: 46 }, (_, i) => { const lon = h3(i, 1, 2, 9) * 360 - 180, lat = Math.asin(h3(i, 3, 4, 9) * 2 - 1) / D2R; return { c: ll2v(lon, lat), r: (2 + 3.5 * h3(i, 5, 6, 9)) * D2R, s: (h3(i, 7, 8, 9) - .5) * .9 }; });
function vortexAdd(v, p, V, kIn) {
  const cd = dot3(V.c, p); if (cd < .2) return;
  const th = Math.acos(clamp(cd, -1, 1)), q = th / V.r; if (q > 4) return;
  const g = q * Math.exp(1 - q) * V.s, t = cross(V.c, p);              // tangential (counter-clockwise about c)
  const tm = Math.hypot(t[0], t[1], t[2]) || 1;
  const inw = [V.c[0] - cd * p[0], V.c[1] - cd * p[1], V.c[2] - cd * p[2]], im = Math.hypot(inw[0], inw[1], inw[2]) || 1;
  const k = kIn * Math.abs(g);
  v[0] += g * 1.6 * t[0] / tm + k * inw[0] / im; v[1] += g * 1.6 * t[1] / tm + k * inw[1] / im; v[2] += g * 1.6 * t[2] / tm + k * inw[2] / im;
}
export function wind(p, out = [0, 0, 0]) {
  const lat = Math.asin(clamp(p[2], -1, 1)), lon = Math.atan2(p[1], p[0]), latD = lat / D2R;
  const e = [-Math.sin(lon), Math.cos(lon), 0], n = [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)];
  const u = -.75 * Math.cos(latD * 4.5 * D2R) * (.75 + .25 * Math.cos(lat)), wave = .38 * Math.sin(5 * lon + 2.2 * Math.sin(3 * lat) + 1.1) * Math.exp(-(((Math.abs(latD) - 45) / 16) ** 2));
  out[0] = u * e[0] + wave * n[0]; out[1] = u * e[1] + wave * n[1]; out[2] = u * e[2] + wave * n[2];
  for (const L of LOWS) vortexAdd(out, p, L, .55);
  for (const E of EDDIES) vortexAdd(out, p, E, .1);
  const d = dot3(out, p); out[0] -= d * p[0]; out[1] -= d * p[1]; out[2] -= d * p[2];  // tangent
  return out;
}
export function cloud(p) {
  const latD = Math.asin(clamp(p[2], -1, 1)) / D2R, al = Math.abs(latD);
  let c = fbm3(p[0] * 2.3 + 11, p[1] * 2.3 - 3, p[2] * 2.3 + 7, 21, 5);
  c += .32 * Math.exp(-(((latD - 6) / 6) ** 2)) * fbm3(p[0] * 6, p[1] * 6, p[2] * 6, 23, 3) * 1.6;   // the ITCZ, patchy
  c -= .2 * Math.exp(-(((al - 24) / 9) ** 2));                                                      // subtropical highs: clear
  c += .2 * Math.exp(-(((al - 52) / 11) ** 2));                                                     // storm tracks
  for (const L of LOWS) {                                                                           // spiral bands, a clear eye
    const cd = dot3(L.c, p); if (cd < .3) continue;
    const th = Math.acos(clamp(cd, -1, 1)), q = th / L.r; if (q > 3.5) continue;
    const ref = Math.abs(L.c[2]) > .95 ? [1, 0, 0] : [0, 0, 1], ax = norm(cross(ref, L.c)), ay = cross(L.c, ax);
    const az = Math.atan2(dot3(p, ay), dot3(p, ax)) * Math.sign(L.s);
    const arms = Math.pow(Math.max(0, Math.cos(2 * (az + 2.6 * Math.log(q + .15)))), 2);
    c += (.55 * arms * Math.exp(-q / 1.4) + .25 * Math.exp(-q * q)) * Math.abs(L.s) - .55 * Math.exp(-((q / .13) ** 2));
  }
  c -= .22 * landAt(p) * (al < 35 ? 1.3 : .7);                                                     // deserts clear
  c -= .45 * Math.exp(-((Math.acos(clamp(dot3(p, HALYS_V), -1, 1)) / (2.2 * D2R)) ** 2));                // clear over the Halys bend
  return clamp((c - .5) * 3.1);
}

// ---------------------------------------------------------------- evenly spaced streamlines on the sphere
// opts: { dsep (rad), step (rad), cap: { c: unit vector, r: rad } | null, maxLen (rad), seed }
function traceSphere(o) {
  const dsep = o.dsep, step = o.step ?? dsep * .32, dtest = o.dtest ?? .55, maxN = Math.round((o.maxLen ?? 1.4) / step);
  const cell = dsep, inv = 1 / cell, HB = 1 << 20, head = new Int32Array(HB).fill(-1);
  let cap = 1 << 18, PX = new Float32Array(cap), PY = new Float32Array(cap), PZ = new Float32Array(cap), PL = new Int32Array(cap), PI = new Int32Array(cap), NX = new Int32Array(cap), np = 0;
  const hkey = (ix, iy, iz) => ((Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791)) >>> 0) & (HB - 1);
  const grow2 = () => { cap *= 2; const re = (A, T) => { const n = new T(cap); n.set(A); return n; }; PX = re(PX, Float32Array); PY = re(PY, Float32Array); PZ = re(PZ, Float32Array); PL = re(PL, Int32Array); PI = re(PI, Int32Array); NX = re(NX, Int32Array); };
  const insert = (p, lid, idx) => { if (np >= cap) grow2(); const k = hkey(Math.floor(p[0] * inv), Math.floor(p[1] * inv), Math.floor(p[2] * inv)); PX[np] = p[0]; PY[np] = p[1]; PZ[np] = p[2]; PL[np] = lid; PI[np] = idx; NX[np] = head[k]; head[k] = np; np++; };
  const tooClose = (p, d, lid, idx) => {
    const d2 = d * d, ix = Math.floor(p[0] * inv), iy = Math.floor(p[1] * inv), iz = Math.floor(p[2] * inv), near = Math.ceil(2.5 * d / step), rr = Math.ceil(d * inv);
    for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) for (let c = -rr; c <= rr; c++) {
      for (let q = head[hkey(ix + a, iy + b, iz + c)]; q >= 0; q = NX[q]) {
        if (PL[q] === lid && Math.abs(PI[q] - idx) < near) continue;
        const dx = PX[q] - p[0], dy = PY[q] - p[1], dz = PZ[q] - p[2]; if (dx * dx + dy * dy + dz * dz < d2) return true;
      }
    }
    return false;
  };
  const inCap = p => !o.cap || dot3(p, o.cap.c) > Math.cos(o.cap.r);
  const lines = [], v = [0, 0, 0], v2 = [0, 0, 0];
  const adv = (p, dir, h) => {
    wind(p, v); let m = Math.hypot(v[0], v[1], v[2]); if (m < 1e-5) return null;
    const mid = norm([p[0] + v[0] / m * h * .5 * dir, p[1] + v[1] / m * h * .5 * dir, p[2] + v[2] / m * h * .5 * dir]);
    wind(mid, v2); m = Math.hypot(v2[0], v2[1], v2[2]); if (m < 1e-5) return null;
    return norm([p[0] + v2[0] / m * h * dir, p[1] + v2[1] / m * h * dir, p[2] + v2[2] / m * h * dir]);
  };
  const grow = p0 => {
    if (!inCap(p0)) return null;
    const lid = lines.length; if (tooClose(p0, dsep * .95, lid, 0)) return null;
    const br = [[], []];
    for (const [bi, dir] of [[0, 1], [1, -1]]) {
      let p = p0, prevT = null;
      for (let k = 1; k < maxN; k++) {
        const q = adv(p, dir, step); if (!q || !inCap(q)) break;
        const t = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
        if (prevT && dot3(norm(t), prevT) < .8) break;                   // a sharp turn (an eye): stop
        if (tooClose(q, dsep * dtest, lid, dir * k)) break;
        prevT = norm(t); p = q; br[bi].push(q);
      }
    }
    const pts = [...br[1].reverse(), p0, ...br[0]];
    if (pts.length * step < (o.minLen ?? dsep * 3)) return null;
    pts.forEach((q, i) => insert(q, lid, i - br[1].length));
    const L = { pts, lid };
    lines.push(L);
    return L;
  };
  const queue = [];
  const enqueue = L => {
    for (let k = 1; k < L.pts.length - 1; k += 2) {
      const p = L.pts[k], a = L.pts[k - 1], b = L.pts[k + 1];
      const t = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), nrm = cross(p, t);
      queue.push(norm([p[0] + nrm[0] * dsep, p[1] + nrm[1] * dsep, p[2] + nrm[2] * dsep]), norm([p[0] - nrm[0] * dsep, p[1] - nrm[1] * dsep, p[2] - nrm[2] * dsep]));
    }
  };
  const drain = () => { while (queue.length) { const q = queue.pop(); const L = grow(q); if (L) enqueue(L); } };
  // seeds: a Fibonacci sphere (spacing ~ 3 dsep), cap only
  const nSeeds = Math.round(4 * Math.PI / ((dsep * 3) ** 2)), ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < nSeeds; i++) {
    const z = 1 - 2 * (i + .5) / nSeeds, r = Math.sqrt(1 - z * z), a = i * ga + (o.seed ?? 0);
    const L = grow([r * Math.cos(a), r * Math.sin(a), z]); if (L) { enqueue(L); drain(); }
  }
  // pack: Float32 xyz + per-vertex cloud density and land; a bounding cap per line for culling
  return lines.map(L => {
    const n = L.pts.length, xyz = new Float32Array(n * 3), cd = new Float32Array(n), ld = new Float32Array(n);
    let cx = 0, cy = 0, cz = 0;
    L.pts.forEach((p, i) => { xyz[i * 3] = p[0]; xyz[i * 3 + 1] = p[1]; xyz[i * 3 + 2] = p[2]; cd[i] = cloud(p); ld[i] = landAt(p); cx += p[0]; cy += p[1]; cz += p[2]; });
    const c = norm([cx, cy, cz]); let rad = 0; for (const p of L.pts) rad = Math.max(rad, Math.acos(clamp(dot3(p, c), -1, 1)));
    return { xyz, n, cd, ld, c, rad, id: L.lid };
  });
}
// coastlines as densified 3D polylines (slerp so long segments stay on the sphere)
function coast3d(rings, closedFlag) {
  const out = [];
  for (const R of rings) {
    const p = R.p, pts = [];
    for (let i = 0; i < p.length; i += 2) pts.push(ll2v(p[i] / 1000, p[i + 1] / 1000));
    if (closedFlag(R)) pts.push(pts[0]);
    const dense = [];
    for (let i = 0; i < pts.length; i++) {
      if (i) { const a = pts[i - 1], b = pts[i], ang = Math.acos(clamp(dot3(a, b), -1, 1)), m = Math.ceil(ang / (.35 * D2R)); for (let k = 1; k < m; k++) dense.push(norm([lerp(a[0], b[0], k / m), lerp(a[1], b[1], k / m), lerp(a[2], b[2], k / m)])); }
      dense.push(pts[i]);
    }
    const n = dense.length, xyz = new Float32Array(n * 3); dense.forEach((q, i) => { xyz[i * 3] = q[0]; xyz[i * 3 + 1] = q[1]; xyz[i * 3 + 2] = q[2]; });
    let c = [0, 0, 0]; for (const q of dense) { c[0] += q[0]; c[1] += q[1]; c[2] += q[2]; } c = norm(c);
    let rad = 0; for (const q of dense) rad = Math.max(rad, Math.acos(clamp(dot3(q, c), -1, 1)));
    out.push({ xyz, n, c, rad });
  }
  return out;
}

// ---------------------------------------------------------------- the model (traced once per page)
export const ANATOLIA_C = [34.85, 38.72];                  // the Halys bend (Avanos): the dive's target
const MODEL = { G0: null, G1: null, coast: null, coastHi: null, promise: {} };
export async function earthReady(level = 0) {
  await landMask();
  if (!MODEL.coast) { MODEL.coast = coast3d(WORLD.filter(r => !r.h), () => true); MODEL.coastHi = coast3d(ANATOLIA, r => !!r.c); }
  if (!MODEL.G0) { const t0 = performance.now(); MODEL.G0 = traceSphere({ dsep: .62 * D2R, seed: .3 }); console.log(`[orbit] earth G0 ${MODEL.G0.length} lines ${Math.round(performance.now() - t0)} ms`); }
  if (level >= 1 && !MODEL.G1) { const t0 = performance.now(); MODEL.G1 = traceSphere({ dsep: .21 * D2R, cap: { c: ll2v(...ANATOLIA_C), r: 30 * D2R }, seed: 1.7, maxLen: .5 }); console.log(`[orbit] earth G1 ${MODEL.G1.length} lines ${Math.round(performance.now() - t0)} ms`); }
  return MODEL;
}

// ---------------------------------------------------------------- the camera
// view basis for a view centre (lon0, lat0) and roll: rows X (east), Y (north), Z (toward the viewer), Earth-fixed
export function earthView(o) {
  const l = o.lon0 * D2R, b = o.lat0 * D2R, Z = ll2v(o.lon0, o.lat0), E = [-Math.sin(l), Math.cos(l), 0], N = [-Math.sin(b) * Math.cos(l), -Math.sin(b) * Math.sin(l), Math.cos(b)];
  const r = (o.roll || 0) * D2R, X = [E[0] * Math.cos(r) + N[0] * Math.sin(r), E[1] * Math.cos(r) + N[1] * Math.sin(r), E[2] * Math.cos(r) + N[2] * Math.sin(r)];
  const Y = [N[0] * Math.cos(r) - E[0] * Math.sin(r), N[1] * Math.cos(r) - E[1] * Math.sin(r), N[2] * Math.cos(r) - E[2] * Math.sin(r)];
  const D = o.D ?? 40, F = o.Rs * Math.sqrt(D * D - 1), sw = ll2v(...(o.sun || [-60, 21.5]));
  const sunV = [dot3(X, sw), dot3(Y, sw), dot3(Z, sw)];
  return { X, Y, Z, D, F, Rs: o.Rs, cx: o.cx, cy: o.cy, sunV, sunW: sw, lon0: o.lon0, lat0: o.lat0 };
}
export function project(V, p) {
  const x = dot3(V.X, p), y = dot3(V.Y, p), z = dot3(V.Z, p), k = V.F / (V.D - z);
  return [V.cx + x * k, V.cy - y * k, z];
}

// ---------------------------------------------------------------- lines for one frame
const BLUE = 2;
export function earthLines(V, o = {}) {
  const out = [], zmin = 1 / V.D, minStep = o.minStep ?? 2.6, W = o.W ?? 1920, H = o.H ?? 1080, gain = o.gain ?? 1, occ = o.occ;
  const gC = (o.clouds ?? 1) * gain, gB = (o.ocean ?? 1) * gain, gL = (o.land ?? 1) * gain, gK = (o.coast ?? 1) * gain;
  const margin = 40, inFrame = (x, y) => x > -margin && x < W + margin && y > -margin && y < H + margin;
  const vis = (x, y) => inFrame(x, y) && (!occ || Math.hypot(x - occ.x, y - occ.y) > occ.r);
  const zc = (c, rad) => { const z = dot3(V.Z, c); return z > Math.cos(Math.acos(clamp(zmin, -1, 1)) + rad) - .02; };
  const sun = V.sunV, sz = Math.max(0, Math.min(1, zmin));
  const sets = [];
  const lod = o.lod ?? (V.Rs > 700 && MODEL.G1 ? 1 : 0);
  const w1 = MODEL.G1 ? clamp((V.Rs - 650) / 600) : 0;
  if (MODEL.G0) sets.push([MODEL.G0, lod >= 1 ? 1 - w1 * .75 : 1, false]);
  if (MODEL.G1 && lod >= 1) sets.push([MODEL.G1, w1, true]);
  // streamlines -> runs per colour channel
  const P = [], B0 = [], B1 = [], B2 = [];
  const flush = (id, ph) => {
    const n = P.length; if (n < 2) { P.length = B0.length = B1.length = B2.length = 0; return; }
    for (const [B, oo, k] of [[B0, 0, gC], [B1, BLUE, gB], [B2, .62, gL]]) {
      if (k <= 0) continue;
      let a = -1;
      for (let i = 0; i <= n; i++) {
        const on = i < n && B[i] > .015;
        if (on && a < 0) a = i;
        if ((!on || i === n) && a >= 0) {
          const m = i - a;
          if (m >= 2) {
            const xy = new Float32Array(m * 2), b = new Float32Array(m), w = new Float32Array(m), ov = new Float32Array(m), d = new Float32Array(m).fill(.5), s = new Float32Array(m);
            let acc = 0;
            for (let j = 0; j < m; j++) { const q = P[a + j]; xy[j * 2] = q[0]; xy[j * 2 + 1] = q[1]; if (j) acc += Math.hypot(q[0] - P[a + j - 1][0], q[1] - P[a + j - 1][1]); s[j] = acc + q[2]; b[j] = B[a + j] * k; w[j] = oo === 0 ? .85 + .5 * B[a + j] : .8; ov[j] = oo; }
            out.push({ xy, n: m, b, w, o: ov, d, s, len: acc, dir: 1, phase: ph, spd: oo === 0 ? .55 : .35, flags: 0, id });
          }
          a = -1;
        }
      }
    }
    P.length = B0.length = B1.length = B2.length = 0;
  };
  for (const [set, wgt, isHi] of sets) {
    if (wgt <= .01) continue;
    for (const L of set) {
      if (!zc(L.c, L.rad)) continue;
      let last = null;
      const ph = (L.id * .618) % 1 * 6.28;
      for (let i = 0; i < L.n; i++) {
        const px = L.xyz[i * 3], py = L.xyz[i * 3 + 1], pz = L.xyz[i * 3 + 2];
        const z = V.Z[0] * px + V.Z[1] * py + V.Z[2] * pz;
        if (z <= zmin + .002) { flush(L.id, ph); last = null; continue; }
        const x = V.X[0] * px + V.X[1] * py + V.X[2] * pz, y = V.Y[0] * px + V.Y[1] * py + V.Y[2] * pz, k = V.F / (V.D - z), sx = V.cx + x * k, sy = V.cy - y * k;
        if (!vis(sx, sy)) { flush(L.id, ph); last = null; continue; }
        if (last && i < L.n - 1 && Math.hypot(sx - last[0], sy - last[1]) < minStep) continue;
        const day = sstep(-.07, .16, sun[0] * x + sun[1] * y + sun[2] * z), limb = sstep(zmin, zmin + .1, z), cd = L.cd[i], ld = L.ld[i];
        const lit = limb * wgt;
        B0.push((.06 + 1.3 * cd * cd) * (.08 + .92 * day) * lit);
        B1.push(.3 * (1 - cd) * (1 - ld) * day * lit);
        B2.push(.1 * (1 - cd) * ld * (.3 + .7 * day) * lit);
        P.push([sx, sy, 0]);
        last = [sx, sy];
      }
      flush(L.id, ph);
    }
  }
  // coastlines (crisp pearl), the fine Anatolian coast in the close views
  const coastSets = [[MODEL.coast, V.Rs > 1400 ? clamp(1 - (V.Rs - 1400) / 800) : 1], [MODEL.coastHi, V.Rs > 900 ? clamp((V.Rs - 900) / 500) : 0]];
  for (const [set, wgt] of coastSets) {
    if (!set || wgt <= .01) continue;
    for (const L of set) {
      if (!zc(L.c, L.rad)) continue;
      let cur = [], bb = [];
      const emit = () => { if (cur.length > 1) { const Ln = { xy: new Float32Array(cur.flat()), n: cur.length, b: new Float32Array(bb), w: new Float32Array(cur.length).fill(1.05), o: new Float32Array(cur.length).fill(.05), d: new Float32Array(cur.length).fill(.5), s: new Float32Array(cur.length), len: 0, dir: 1, phase: 0, spd: .3, flags: FL.NOFADE, id: 0 }; let acc = 0; for (let j = 1; j < cur.length; j++) { acc += Math.hypot(cur[j][0] - cur[j - 1][0], cur[j][1] - cur[j - 1][1]); Ln.s[j] = acc; } Ln.len = acc; out.push(Ln); } cur = []; bb = []; };
      let last = null;
      for (let i = 0; i < L.n; i++) {
        const p = [L.xyz[i * 3], L.xyz[i * 3 + 1], L.xyz[i * 3 + 2]], z = dot3(V.Z, p);
        if (z <= zmin + .002) { emit(); last = null; continue; }
        const [sx, sy] = project(V, p);
        if (!vis(sx, sy)) { emit(); last = null; continue; }
        if (last && i < L.n - 1 && Math.hypot(sx - last[0], sy - last[1]) < minStep * .8) continue;
        const day = sstep(-.07, .16, dot3(sun, [dot3(V.X, p), dot3(V.Y, p), z]));
        cur.push([sx, sy]); bb.push(.95 * gK * wgt * (.22 + .78 * day) * sstep(zmin, zmin + .06, z)); last = [sx, sy];
      }
      emit();
    }
  }
  // the sunlit limb: a thin signal-orange rim (perspective limb = a circle of radius Rs)
  if ((o.rim ?? 1) > 0) {
    const pts = [], bb = [], rho = Math.sqrt(1 - zmin * zmin), n = Math.max(120, Math.round(V.Rs * .8));
    for (let k = 0; k <= n; k++) {
      const a = k / n * Math.PI * 2, q = [rho * Math.cos(a), rho * Math.sin(a), zmin], sx = V.cx + V.Rs * 1.004 * Math.cos(a), sy = V.cy - V.Rs * 1.004 * Math.sin(a);
      const day = sstep(-.12, .25, sun[0] * q[0] + sun[1] * q[1] + sun[2] * q[2]);
      pts.push([sx, sy]); bb.push((o.rim ?? 1) * gain * (.12 + 1.05 * day) * (vis(sx, sy) ? 1 : 0));
    }
    let a = -1;
    for (let i = 0; i <= pts.length; i++) {
      const on = i < pts.length && bb[i] > .01;
      if (on && a < 0) a = i;
      if (!on && a >= 0) { const seg = pts.slice(a, i); if (seg.length > 1) { const m = seg.length, s = new Float32Array(m); let acc = 0; for (let j = 1; j < m; j++) { acc += Math.hypot(seg[j][0] - seg[j - 1][0], seg[j][1] - seg[j - 1][1]); s[j] = acc; } out.push({ xy: new Float32Array(seg.flat()), n: m, b: new Float32Array(bb.slice(a, i)), w: new Float32Array(m).fill(1.5), o: new Float32Array(m).fill(1), d: new Float32Array(m).fill(.5), s, len: acc, dir: 1, phase: 0, spd: .4, flags: FL.NOFADE, id: 0 }); } a = -1; }
    }
  }
  return out;
}

// ---------------------------------------------------------------- the blue body (WebGL fill, 'screen' composite)
const FILL = `
uniform vec2 uRes, uC; uniform float uF, uD, uRs, uAlpha, uHaze, uNight;
uniform vec3 uX, uY, uZ, uSun; uniform vec4 uOcc; uniform sampler2D uLand, uAnat; uniform vec4 uAnatBox; uniform float uAnatOn;
const float PI = 3.14159265;
float landAt(vec3 p) {
  float lon = atan(p.y, p.x), lat = asin(clamp(p.z, -1., 1.));
  float L = texture(uLand, vec2(lon / (2. * PI) + .5, .5 - lat / PI)).r;
  if (uAnatOn > .5) {
    vec2 ll = vec2(degrees(lon), degrees(lat));
    vec2 t = (ll - uAnatBox.xy) / (uAnatBox.zw - uAnatBox.xy);
    if (t.x > 0. && t.x < 1. && t.y > 0. && t.y < 1.) L = texture(uAnat, vec2(t.x, 1. - t.y)).r;
  }
  return L;
}
void main() {
  vec2 px = vec2(uv.x * uRes.x, (1. - uv.y) * uRes.y);
  if (uOcc.w > .5 && length(px - uOcc.xy) < uOcc.z) { o = vec4(0.); return; }
  vec3 dir = normalize(vec3((px.x - uC.x) / uF, (uC.y - px.y) / uF, -1.));
  vec3 org = vec3(0., 0., uD);
  float b = dot(org, dir), c = uD * uD - 1., disc = b * b - c;
  float rpx = length(px - uC);
  if (disc < 0.) {                                   // outside the disk: a thin blue atmosphere on the day side
    vec2 dd = (px - uC) / max(rpx, 1.);
    float rho = sqrt(1. - 1. / (uD * uD));
    vec3 q = vec3(dd.x * rho, -dd.y * rho, 1. / uD);
    float day = smoothstep(-.15, .3, dot(q, uSun));
    float g = exp(-(rpx - uRs) / (uRs * .012)) * .34 + exp(-(rpx - uRs) / (uRs * .06)) * .05;
    vec3 col = vec3(.16, .42, .95) * g * day * uHaze;
    float a = clamp(max(col.r, max(col.g, col.b)), 0., 1.) * uAlpha;
    o = vec4(col * uAlpha, a);
    return;
  }
  float t = -b - sqrt(disc);
  vec3 q = org + dir * t;                            // view coords on the unit sphere
  vec3 p = q.x * uX + q.y * uY + q.z * uZ;           // Earth-fixed
  float mu = clamp(dot(q, -dir), 0., 1.);
  float sd = dot(q, uSun), day = smoothstep(-.1, .16, sd);
  float L = smoothstep(.35, .65, landAt(p));
  vec3 ocean = mix(vec3(.03, .16, .46), vec3(.075, .33, .78), pow(mu, .55));
  vec3 land = vec3(.085, .066, .045);
  vec3 dayc = mix(ocean, land, L);
  dayc += vec3(.2, .45, .95) * pow(1. - mu, 4.) * .35 * uHaze;         // limb haze
  vec3 nightc = mix(vec3(.012, .03, .075), vec3(.01, .01, .012), L) * uNight;
  vec3 col = mix(nightc, dayc, day);
  col += vec3(.94, .54, .16) * .22 * exp(-pow(sd / .07, 2.)) * (1. - L * .5);   // the dusk band
  float edge = smoothstep(uRs + .8, uRs - .8, rpx);
  o = vec4(col * uAlpha * edge, uAlpha * edge);
}`;
let _anatTex = null;
export async function earthFill(f, V, o = {}) {
  const W = f.W, H = f.H, G = getGL(W, H), prog = G.program(FILL);
  if (!LAND) await landMask();
  if (!_anatTex) _anatTex = await loadImage(ANAT_URL);
  const occ = o.occ;
  G.pass(prog, {
    uRes: [W, H], uC: [V.cx, V.cy], uF: V.F, uD: V.D, uRs: V.Rs, uAlpha: o.alpha ?? 1, uHaze: o.haze ?? 1, uNight: o.night ?? 1,
    uX: V.X, uY: V.Y, uZ: V.Z, uSun: V.sunV, uOcc: occ ? [occ.x, occ.y, occ.r, 1] : [0, 0, 0, 0],
    uLand: G.texture(LAND.img, { wrap: 'repeat' }), uAnat: G.texture(_anatTex), uAnatBox: [19, 30.5, 50, 47.5], uAnatOn: V.Rs > 900 ? 1 : 0,
  });
  const g = f.g;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = o.op || 'screen'; g.globalAlpha = 1; g.drawImage(G.canvas, 0, 0, W, H); g.restore();
}
