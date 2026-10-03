// orbit/dive.js: the dive (S74) and the pull-back (S77) between orbit and the Halys valley.
//
// Map space: km east/north of the landing point on the Halys near Avanos (equirectangular at 38.72 N). Three static line
// sets (levels of detail) are built once and placed per frame with an affine (scale = px per km):
//   A  Anatolia: the 1:10m coasts, the Halys (orange), Lake Tuz, relief contours of a designed height field (the Pontic
//      and Taurus ranges, Erciyes and Hasan as cones, the plateau, the river's incised valley)
//   B  the bend, 1.2 deg around it: finer contours, the meandering river (two banks + a flow line)
//   C  the valley floor, 9 km: banks at their real width, sandbars, terraces, field plots
// cloudDeck(): white contour layers in unit space, scaled up past the camera (flying down through cloud).
// ground(): the same map lines in perspective from a camera that pitches from nadir to level (the landing / the boom).

import { FL } from '../line/index.js';
import { clamp, lerp, sstep } from '../../core.js';
import { ANATOLIA } from './geo.gen.js';
import { contours } from './moon.js';
import { mkLine, splitLine } from './index.js';

export const BEND = [34.85, 38.72];
const KX = 111.32 * Math.cos(38.72 * Math.PI / 180), KY = 110.9;
export const llKm = (lon, lat) => [(lon - BEND[0]) * KX, (lat - BEND[1]) * KY];
export const kmLL = (x, y) => [BEND[0] + x / KX, BEND[1] + y / KY];

function h2(x, y, s) { let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
function vn(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(h2(xi, yi, s), h2(xi + 1, yi, s), u), lerp(h2(xi, yi + 1, s), h2(xi + 1, yi + 1, s), u), v); }
const fbm = (x, y, s, o = 5) => { let a = .5, f = 1, t = 0, n = 0; for (let i = 0; i < o; i++) { t += a * vn(x * f, y * f, s + i * 7); n += a; a *= .5; f *= 2.03; } return t / n; };

// ---------------------------------------------------------------- the Halys (Kizilirmak), source to the Black Sea
const HALYS_LL = [[38.30, 39.92], [38.05, 39.88], [37.75, 39.87], [37.45, 39.80], [37.10, 39.76], [36.80, 39.63], [36.50, 39.46], [36.20, 39.28], [35.90, 39.12],
  [35.60, 38.98], [35.30, 38.86], [35.05, 38.78], [34.85, 38.72], [34.62, 38.75], [34.40, 38.86], [34.15, 39.02], [33.90, 39.20], [33.62, 39.32], [33.48, 39.50],
  [33.47, 39.72], [33.55, 39.90], [33.72, 40.10], [33.90, 40.32], [34.02, 40.55], [34.20, 40.80], [34.45, 41.08], [34.62, 41.02], [34.80, 40.97], [35.05, 41.02],
  [35.35, 41.10], [35.60, 41.25], [35.78, 41.42], [35.88, 41.58], [35.96, 41.74]];
const TUZ_LL = [[33.30, 39.02], [33.42, 38.95], [33.55, 38.80], [33.62, 38.62], [33.58, 38.48], [33.45, 38.45], [33.32, 38.58], [33.22, 38.75], [33.20, 38.90], [33.30, 39.02]];
function catmull(P, per = 8) {
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < per; k++) { const t = k / per, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
  }
  out.push(P[P.length - 1]);
  return out;
}
// the river in km: a spline through the course, meandering near the landing site (wavelengths 3.2 km and 0.42 km)
let _river = null;
export function river() {
  if (_river) return _river;
  const base = catmull(HALYS_LL.map(([a, b]) => llKm(a, b)), 24);
  // resample to 25 m steps within 40 km of the landing point, 1 km elsewhere
  const pts = []; let acc = 0;
  for (let i = 0; i < base.length - 1; i++) {
    const a = base[i], b = base[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), near = Math.hypot(a[0], a[1]) < 45, st = near ? .025 : 1, n = Math.max(1, Math.ceil(L / st));
    for (let k = 0; k < n; k++) pts.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n), acc + L * k / n]);
    acc += L;
  }
  pts.push([...base[base.length - 1], acc]);
  // the landing point: the river point nearest the bend apex; s measured from there
  let iL = 0, best = 1e9; pts.forEach((p, i) => { const d = Math.hypot(p[0], p[1]); if (d < best) { best = d; iL = i; } });
  const sL = pts[iL][2];
  const out = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1, nx = -ty / m, ny = tx / m;
    const s = p[2] - sL, calm = 1 - Math.exp(-((s / 2.2) ** 2)), w = Math.exp(-((s / 30) ** 2)) * calm, wl = Math.exp(-((s / 5) ** 2)) * (1 - Math.exp(-((s / 1.1) ** 2)));
    const d = w * (.55 * Math.sin(s / 3.2 * 6.283) + .22 * Math.sin(s / 1.3 * 6.283 + 1.1)) + wl * .045 * Math.sin(s / .42 * 6.283);
    return [p[0] + nx * d, p[1] + ny * d, s];
  });
  // re-centre: the landing point at the origin; the reach's direction over +-3 km (a straight reach: no meanders there)
  const L0 = out[iL], a = out.find(p => p[2] > -3) || out[0], b = out.find(p => p[2] > 3) || out[out.length - 1];
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const fin = out.map(([x, y, s]) => [x - L0[0], y - L0[1], s]);
  return (_river = { pts: fin, iL, ang, shift: [L0[0], L0[1]] });
}
// ---------------------------------------------------------------- the land (km, relative to the landing point)
const RIDGES = [  // [lon0, lat0, lon1, lat1, width km, height m]
  [27.5, 41.0, 41.5, 41.0, 60, 1900], [29.0, 37.0, 36.0, 36.9, 70, 2400], [36.0, 37.5, 39.0, 38.6, 60, 2100], [30.0, 39.6, 33.0, 40.1, 50, 1300]];
const CONES = [[35.45, 38.53, 3917, 14], [34.17, 38.13, 3268, 10], [34.53, 37.65, 2900, 8]];   // Erciyes, Hasan, Melendiz
function landH(x, y) {                         // metres; x, y km from the landing point
  const R = river(), [lon, lat] = kmLL(x + R.shift[0], y + R.shift[1]);
  let h = 1050 + 260 * (fbm(lon * .9, lat * .9, 3) - .5) * 2 + 140 * (fbm(lon * 4, lat * 4, 5) - .5) * 2 + 40 * (fbm(lon * 30, lat * 30, 7) - .5) * 2;
  for (const [a0, b0, a1, b1, wkm, hm] of RIDGES) {
    const p0 = llKm(a0, b0), p1 = llKm(a1, b1), q = llKm(lon, lat), vx = p1[0] - p0[0], vy = p1[1] - p0[1], t = clamp(((q[0] - p0[0]) * vx + (q[1] - p0[1]) * vy) / (vx * vx + vy * vy));
    const d = Math.hypot(q[0] - p0[0] - vx * t, q[1] - p0[1] - vy * t);
    h += hm * Math.exp(-((d / wkm) ** 2)) * (.7 + .6 * fbm(lon * 3, lat * 3, 11));
  }
  for (const [a, b, hm, rkm] of CONES) { const c = llKm(a, b), q = llKm(lon, lat), d = Math.hypot(q[0] - c[0], q[1] - c[1]); h += (hm - 1100) * Math.exp(-d / rkm); }
  return h;
}
// distance (km) to the river on a grid: seed the cells the river passes, then a two-pass chamfer transform (O(cells))
function riverDistGrid(x0, y0, x1, y1, gw, gh, R) {
  const D = new Float32Array(gw * gh).fill(1e9), sx = (x1 - x0) / (gw - 1), sy = (y1 - y0) / (gh - 1);
  for (const p of R.pts) {
    const i = Math.round((p[0] - x0) / sx), j = Math.round((y1 - p[1]) / sy);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
      const d = Math.hypot(x0 + ii * sx - p[0], y1 - jj * sy - p[1]), k = jj * gw + ii; if (d < D[k]) D[k] = d;
    }
  }
  const dd = Math.hypot(sx, sy);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const k = j * gw + i; let v = D[k]; if (i) v = Math.min(v, D[k - 1] + sx); if (j) v = Math.min(v, D[k - gw] + sy); if (i && j) v = Math.min(v, D[k - gw - 1] + dd); if (j && i < gw - 1) v = Math.min(v, D[k - gw + 1] + dd); D[k] = v; }
  for (let j = gh - 1; j >= 0; j--) for (let i = gw - 1; i >= 0; i--) { const k = j * gw + i; let v = D[k]; if (i < gw - 1) v = Math.min(v, D[k + 1] + sx); if (j < gh - 1) v = Math.min(v, D[k + gw] + sy); if (i < gw - 1 && j < gh - 1) v = Math.min(v, D[k + gw + 1] + dd); if (j < gh - 1 && i) v = Math.min(v, D[k + gw - 1] + dd); D[k] = v; }
  return D;
}
const valley = (h, d, depth, wkm) => h - depth * Math.exp(-((d / wkm) ** 2));

// contours of hFn(x, y, d) on a gw-wide grid over [x0, x1] x [y0, y1] (km, y up); d = distance to the river
function contourSet(x0, y0, x1, y1, n, hFn, levels, attrs) {
  const gw = n, gh = Math.max(3, Math.round(n * (y1 - y0) / (x1 - x0))), Hf = new Float32Array(gw * gh), R = river();
  const D = riverDistGrid(x0, y0, x1, y1, gw, gh, R);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) Hf[j * gw + i] = hFn(lerp(x0, x1, i / (gw - 1)), lerp(y1, y0, j / (gh - 1)), D[j * gw + i]);
  return contours(Hf, gw, gh, levels, (i, j) => [lerp(x0, x1, i / (gw - 1)), lerp(y1, y0, j / (gh - 1))]).map(c => mkLine(c.pts, typeof attrs === 'function' ? attrs(c.lv) : attrs));
}
function plainContours(x0, y0, x1, y1, n, hFn, levels, attrs) {
  const gw = n, gh = Math.max(3, Math.round(n * (y1 - y0) / (x1 - x0))), Hf = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) Hf[j * gw + i] = hFn(lerp(x0, x1, i / (gw - 1)), lerp(y1, y0, j / (gh - 1)));
  return contours(Hf, gw, gh, levels, (i, j) => [lerp(x0, x1, i / (gw - 1)), lerp(y1, y0, j / (gh - 1))]).map(c => mkLine(c.pts, typeof attrs === 'function' ? attrs(c.lv) : attrs));
}

// LOD A: Anatolia (km from the landing point)
export function lodA() {
  const R = river(), out = [], sh = R.shift, K = (lon, lat) => { const p = llKm(lon, lat); return [p[0] - sh[0], p[1] - sh[1]]; };
  for (const piece of ANATOLIA) { const pts = []; for (let i = 0; i < piece.p.length; i += 2) pts.push(K(piece.p[i] / 1000, piece.p[i + 1] / 1000)); if (piece.c) pts.push(pts[0]); out.push(mkLine(pts, { b: 1.15, w: 1.25, o: .05, flags: FL.NOFADE | FL.SHARP })); }
  const rv = R.pts.filter((p, i) => i % 6 === 0 || i === R.pts.length - 1);
  out.push(mkLine(rv.map(p => [p[0], p[1]]), { b: 1.5, w: 2.1, o: 1, flags: FL.NOFADE, spd: .8 }));
  out.push(mkLine(TUZ_LL.map(([a, b]) => K(a, b)), { b: .8, w: 1.1, o: .15, flags: FL.NOFADE }));
  const levels = [700, 950, 1200, 1450, 1700, 2000, 2350, 2700, 3100, 3500];
  out.push(...contourSet(-560, -420, 920, 420, 420, (x, y, d) => valley(landH(x, y), d, 180, 6), levels, lv => ({ b: .16 + .1 * clamp((lv - 700) / 2800), w: .8, o: .35 + .3 * clamp((lv - 1200) / 2400), spd: .3 })));
  return out.filter(Boolean);
}
// LOD B: the bend (130 x 90 km)
export function lodB() {
  const R = river(), out = [];
  const near = R.pts.filter(p => Math.abs(p[0]) < 90 && Math.abs(p[1]) < 70);
  out.push(mkLine(near.map(p => [p[0], p[1]]), { b: 1.4, w: 1.8, o: 1, flags: FL.NOFADE, spd: .9 }));
  const levels = []; for (let h = 860; h < 1700; h += 45) levels.push(h);
  out.push(...contourSet(-65, -45, 65, 45, 360, (x, y, d) => valley(landH(x, y), d, 120, 2.2), levels, lv => ({ b: .14 + .12 * clamp((lv - 860) / 600), w: .75, o: .4, spd: .3 })));
  return out.filter(Boolean);
}
// LOD C: the valley floor (9 x 6 km): banks at their width, sandbars, terraces, fields
export function lodC() {
  const R = river(), out = [];
  const seg = R.pts.filter(p => Math.abs(p[0]) < 6 && Math.abs(p[1]) < 4.5), half = .022;
  for (const sg of [-1, 1]) {
    const bank = seg.map((p, i) => { const a = seg[Math.max(0, i - 1)], b = seg[Math.min(seg.length - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1; return [p[0] - ty / m * half * sg, p[1] + tx / m * half * sg]; });
    out.push(mkLine(bank, { b: 1.3, w: 1.5, o: 1, flags: FL.NOFADE, spd: .7 }));
  }
  for (let j = -2; j <= 2; j++) {                                // water: flow lines inside the banks
    const fl = seg.map((p, i) => { const a = seg[Math.max(0, i - 1)], b = seg[Math.min(seg.length - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1, o = j * half * .36; return [p[0] - ty / m * o, p[1] + tx / m * o]; });
    out.push(...splitLine(mkLine(fl, { b: .45, w: .8, o: .05, spd: 1.6, phase: j }), (x, y, k) => h2(k >> 5, j + 9, 3) > .25));
  }
  const levels = []; for (let h = 900; h < 1150; h += 6) levels.push(h);
  out.push(...contourSet(-6, -4.5, 6, 4.5, 420, (x, y, d) => valley(landH(x, y), d, 55, .9) + 18 * sstep(.25, .32, d) + 10 * sstep(.8, .9, d), levels, { b: .17, w: .75, o: .4, spd: .3 }));
  for (let i = 0; i < 46; i++) {                                 // field plots on the terraces: small skewed quads
    const x = (h2(i, 1, 51) - .5) * 10, y = (h2(i, 2, 51) - .5) * 7.5; if (R.pts.some(p => Math.abs(p[0] - x) < .45 && Math.abs(p[1] - y) < .45)) continue;
    const a = h2(i, 3, 51) * 3.14, w = .15 + .3 * h2(i, 4, 51), hh = .1 + .2 * h2(i, 5, 51), c = Math.cos(a), sn = Math.sin(a);
    const q = [[-w, -hh], [w, -hh], [w, hh], [-w, hh], [-w, -hh]].map(([u, v]) => [x + u * c - v * sn, y + u * sn + v * c]);
    out.push(mkLine(q, { b: .2, w: .7, o: .55 }));
  }
  return out.filter(Boolean);
}

// ---------------------------------------------------------------- the cloud deck (unit space, centred at 0)
export function cloudLayer(seed, n = 170) {
  const levels = [.5, .54, .58, .62, .66, .7, .74];
  return plainContours(-1, -1, 1, 1, n, (x, y) => { const r = Math.hypot(x, y); return fbm(x * 2.4 + seed, y * 2.4 - seed, seed + 3, 5) + .12 * Math.cos(r * 9 + seed) - .25 * sstep(.95, 1.4, r); }, levels, lv => ({ b: .5 + 1.4 * (lv - .5), w: 1.0, o: 0, spd: .5 }));
}

// ---------------------------------------------------------------- the ground camera (perspective, heading = +y)
// cam: { x, y (km), h (km), pitch (rad down from level: pi/2 = nadir), F (px), cx, cy, heading (rad, map rotation) }
export function groundProject(cam, x, y, z = 0) {
  const c = Math.cos(cam.heading || 0), s = Math.sin(cam.heading || 0);
  const dx0 = x - cam.x, dy0 = y - cam.y, dx = dx0 * c + dy0 * s, dy = -dx0 * s + dy0 * c, dz = z - cam.h;
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const Zc = dy * cp - dz * sp, Yc = dy * sp + dz * cp;            // forward (pitched down), up
  if (Zc < 1e-4) return null;
  return [cam.cx + cam.F * dx / Zc, cam.cy - cam.F * Yc / Zc, Zc];
}
// re-project a static km line set through the ground camera (split at the near plane and off-screen)
export function groundLines(lines, cam, W, H, bK = 1) {
  const out = [];
  for (const L of lines) {
    if (!L) continue;
    let cur = [], bb = [];
    const flush = () => { if (cur.length > 1) out.push(mkLine(cur, { b: bb, w: L.w[0], o: L.o[0], flags: L.flags, spd: L.spd, phase: L.phase })); cur = []; bb = []; };
    for (let k = 0; k < L.n; k++) {
      const q = groundProject(cam, L.xy[k * 2], L.xy[k * 2 + 1]);
      if (!q || q[0] < -300 || q[0] > W + 300 || q[1] < -300 || q[1] > H + 300) { flush(); continue; }
      if (cur.length && Math.hypot(q[0] - cur[cur.length - 1][0], q[1] - cur[cur.length - 1][1]) < 1.5 && k < L.n - 1) continue;
      cur.push([q[0], q[1]]); bb.push(L.b[k] * bK * clamp(2.2 / Math.max(.4, q[2] / Math.max(cam.h, .002)) ** .35));
    }
    flush();
  }
  return out;
}
