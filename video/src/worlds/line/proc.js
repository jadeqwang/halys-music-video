// proc.js: procedural line generators (no plate): shapes the engine can draw next to plate lines.
// Everything returns engine lines (see trace.js) in whatever 2D space the caller uses (usually screen px, d = .5),
// so ORBIT (Drop 2: gear trains, orbits, maps) and the transitions can reuse them.
//
//   line(pts, attrs)                      polyline [[x, y], ...] -> line (attrs: b, w, o, flags, d, phase, spd, taper)
//   circle(cx, cy, r, attrs, n)           ellipse(cx, cy, rx, ry, rot, attrs, n, a0, a1)
//   gear(cx, cy, r, teeth, angle, attrs)  an involute-ish gear outline + hub + spokes (Antikythera style)
//   dial(cx, cy, r, ticks, attrs)         a ring with tick marks
//   glyphRow(x0, y, width, size, seed, attrs, shift)   a row of small engraved symbols (astronomical tables, not text)
//   orbits(cx, cy, scale, tilt, t, attrs) nested elliptical orbits with planets moving on them
//   animeEye(cx, cy, s, attrs)            line art of the singer's anime eye (her sheet: dark iris, heavy upper lash line)
//   displace(lines, fn)                   move every vertex: fn(x, y) -> [dx, dy] (membranes, ripples)

import { TAU, clamp, lerp, hash3, sstep } from '../../core.js';
import { FL } from './trace.js';

export function line(pts, a = {}) {
  const n = pts.length; if (n < 2) return null;
  const xy = new Float32Array(n * 2), b = new Float32Array(n), w = new Float32Array(n), o = new Float32Array(n), d = new Float32Array(n), s = new Float32Array(n);
  let acc = 0;
  for (let k = 0; k < n; k++) { xy[k * 2] = pts[k][0]; xy[k * 2 + 1] = pts[k][1]; if (k) acc += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]) * (a.scale ?? 1); s[k] = acc; }
  const tp = a.taper ?? 0;
  for (let k = 0; k < n; k++) {
    const u = n > 1 ? k / (n - 1) : 0, tap = tp > 0 ? Math.pow(Math.min(1, Math.min(u, 1 - u) / tp), .7) : 1;
    b[k] = (typeof a.b === 'function' ? a.b(u, k) : (a.b ?? 1)) * (a.taperB === false ? 1 : tap);
    w[k] = (typeof a.w === 'function' ? a.w(u, k) : (a.w ?? 1)) * (tp > 0 ? .35 + .65 * tap : 1);
    o[k] = typeof a.o === 'function' ? a.o(u, k) : (a.o ?? 0);
    d[k] = typeof a.d === 'function' ? a.d(u, k) : (a.d ?? .5);
  }
  return { xy, n, b, w, o, d, s, len: acc, dir: 1, phase: a.phase ?? 0, spd: a.spd ?? 1, flags: a.flags ?? 0, id: a.id ?? 0, rnd: a.rnd };
}
export function ellipse(cx, cy, rx, ry, rot = 0, a = {}, n = 0, a0 = 0, a1 = TAU) {
  n = n || Math.max(24, Math.round(Math.max(rx, ry) * Math.abs(a1 - a0) / 3));
  const c = Math.cos(rot), s = Math.sin(rot), pts = [];
  for (let k = 0; k <= n; k++) { const t = lerp(a0, a1, k / n), x = Math.cos(t) * rx, y = Math.sin(t) * ry; pts.push([cx + x * c - y * s, cy + x * s + y * c]); }
  return line(pts, a);
}
export const circle = (cx, cy, r, a = {}, n = 0) => ellipse(cx, cy, r, r, 0, { ...a, flags: (a.flags ?? 0) | FL.NOFADE }, n);

export function gear(cx, cy, r, teeth, angle, a = {}) {
  const out = [], depth = a.toothDepth ?? r * .09, pts = [], nSub = 6;
  for (let i = 0; i < teeth; i++) {
    const t0 = angle + i / teeth * TAU, dt = TAU / teeth;
    const prof = [[0, 0], [.18, 0], [.3, 1], [.62, 1], [.74, 0], [1, 0]];
    for (let j = 0; j < prof.length - 1; j++) for (let k = 0; k < nSub; k++) {
      const u = lerp(prof[j][0], prof[j + 1][0], k / nSub), hgt = lerp(prof[j][1], prof[j + 1][1], k / nSub), rr = r - depth + hgt * depth, th = t0 + u * dt;
      pts.push([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr]);
    }
  }
  pts.push(pts[0]);
  out.push(line(pts, { ...a, flags: (a.flags ?? 0) | FL.NOFADE }));
  out.push(circle(cx, cy, r * .16, { ...a, b: (a.b ?? 1) * .8 }));
  out.push(circle(cx, cy, r * .62, { ...a, b: (a.b ?? 1) * .55, w: (a.w ?? 1) * .8 }));
  const spokes = a.spokes ?? 4;
  for (let i = 0; i < spokes; i++) { const th = angle + (i + .5) / spokes * TAU, c = Math.cos(th), s = Math.sin(th); out.push(line([[cx + c * r * .17, cy + s * r * .17], [cx + c * r * .61, cy + s * r * .61]], { ...a, b: (a.b ?? 1) * .6 })); }
  return out.filter(Boolean);
}
export function dial(cx, cy, r, ticks, a = {}, angle = 0) {
  const out = [circle(cx, cy, r, a), circle(cx, cy, r * .93, { ...a, b: (a.b ?? 1) * .6 })];
  for (let i = 0; i < ticks; i++) {
    const th = angle + i / ticks * TAU, c = Math.cos(th), s = Math.sin(th), l = i % 5 === 0 ? .1 : .05;
    out.push(line([[cx + c * r * .93, cy + s * r * .93], [cx + c * r * (.93 - l), cy + s * r * (.93 - l)]], { ...a, b: (a.b ?? 1) * .7, w: (a.w ?? 1) * .8 }));
  }
  return out;
}
// small engraved symbols: circle, crescent, tick bars, chevron, dot-ring, cross; deterministic per (seed, index)
export function glyphRow(x0, y, width, size, seed, a = {}, shift = 0) {
  const out = [], step = size * 1.6, n = Math.ceil(width / step) + 2, i0 = Math.floor(shift / step);
  for (let j = -1; j < n; j++) {
    const i = i0 + j, x = x0 + j * step - (shift - i0 * step), kind = Math.floor(hash3(i, seed, 1) * 7), s = size * .5;
    if (x < x0 - step || x > x0 + width + step) continue;
    const A = { ...a, b: (a.b ?? 1) * (.6 + .5 * hash3(i, seed, 2)) };
    if (kind === 0) out.push(circle(x, y, s * .8, A, 16));
    else if (kind === 1) out.push(ellipse(x, y, s * .8, s * .8, 0, A, 14, -1.9, 1.9), ellipse(x + s * .35, y, s * .62, s * .62, 0, A, 12, -1.6, 1.6));
    else if (kind === 2) { const m = 1 + Math.floor(hash3(i, seed, 3) * 4); for (let q = 0; q < m; q++) out.push(line([[x - s + q * s * .5, y - s * .8], [x - s + q * s * .5, y + s * .8]], A)); }
    else if (kind === 3) out.push(line([[x - s, y + s * .6], [x, y - s * .6], [x + s, y + s * .6]], A));
    else if (kind === 4) { out.push(circle(x, y, s * .85, A, 16)); out.push(circle(x, y, s * .2, A, 8)); }
    else if (kind === 5) out.push(line([[x - s, y], [x + s, y]], A), line([[x, y - s], [x, y + s]], A));
    else out.push(line([[x - s, y - s * .7], [x + s, y - s * .7]], A), line([[x - s, y + s * .7], [x + s, y + s * .7]], A));
  }
  return out.filter(Boolean);
}
export function orbits(cx, cy, scale, tilt, t, a = {}, n = 6) {
  const out = [], ry = Math.cos(tilt);
  out.push(circle(cx, cy, scale * .06, { ...a, b: (a.b ?? 1) * 1.6 }));
  for (let i = 0; i < n; i++) {
    const r = scale * (.16 + .15 * i + .02 * hash3(i, 9, 1)), rot = .08 * (hash3(i, 9, 2) - .5);
    out.push(ellipse(cx, cy, r, r * ry, rot, { ...a, b: (a.b ?? 1) * .55 }));
    const ph = hash3(i, 9, 3) * TAU + t * (1.6 / Math.pow(1 + i, 1.5)), px = Math.cos(ph) * r, py = Math.sin(ph) * r * ry;
    const x = cx + px * Math.cos(rot) - py * Math.sin(rot), y = cy + px * Math.sin(rot) + py * Math.cos(rot);
    out.push(circle(x, y, scale * (.012 + .012 * hash3(i, 9, 4)), { ...a, b: (a.b ?? 1) * 1.3 }, 12));
  }
  return out;
}
// the singer's eye (her anime sheet): a heavy upper lash line with a flick at the outer corner, a thin lower lid,
// a large dark iris (two rings + radial fibres), a black pupil and two highlights. s = eye width in px.
export function animeEye(cx, cy, s, a = {}) {
  const out = [], P = (u, v) => [cx + u * s, cy + v * s], A = { b: 1.4, w: 2.2, ...a };
  const upper = [], lower = [];
  for (let k = 0; k <= 40; k++) { const u = k / 40, x = lerp(-.5, .5, u); upper.push(P(x, -.2 * Math.sin(Math.PI * Math.pow(u, .85)) - .03 * u)); }
  out.push(line(upper, { ...A, w: u => A.w * (1.2 + 1.6 * Math.sin(Math.PI * u)), taper: .08, b: A.b * 1.2 }));
  out.push(line([P(.47, -.06), P(.56, -.13), P(.6, -.16)], { ...A, w: A.w * 1.6, taper: .3 }));            // the flick
  out.push(line([P(.42, -.1), P(.5, -.19)], { ...A, w: A.w * 1.1, taper: .3 }));
  for (let k = 0; k <= 28; k++) { const u = k / 28, x = lerp(-.36, .44, u); lower.push(P(x, .17 * Math.sin(Math.PI * u) + .02)); }
  out.push(line(lower, { ...A, w: A.w * .45, b: A.b * .7, taper: .25 }));
  out.push(line([P(-.5, -.02), P(-.43, .05)], { ...A, w: A.w * .5, taper: .3 }));
  // iris: clipped by the lids (approximate: circle points between the lid curves)
  const ir = .2, ic = P(.02, .0);
  const clipIn = (x, y) => { const u = (x - cx) / s, v = (y - cy) / s, k = clamp((u + .5)), top = -.2 * Math.sin(Math.PI * Math.pow(k, .85)) - .03 * k + .015, bot = .17 * Math.sin(Math.PI * clamp((u + .36) / .8)) + .01; return v > top && v < bot; };
  const ring = (r, b, w) => { let cur = []; for (let k = 0; k <= 64; k++) { const t = k / 64 * TAU, x = ic[0] + Math.cos(t) * r * s, y = ic[1] + Math.sin(t) * r * s; if (clipIn(x, y)) cur.push([x, y]); else { if (cur.length > 1) out.push(line(cur, { ...A, b, w })); cur = []; } } if (cur.length > 1) out.push(line(cur, { ...A, b, w })); };
  ring(ir, A.b * .95, A.w * .55); ring(ir * .62, A.b * .55, A.w * .4); ring(ir * .3, A.b * .8, A.w * .5);
  for (let k = 0; k < 26; k++) { const t = k / 26 * TAU + .1, r0 = ir * .34, r1 = ir * (.62 + .3 * hash3(k, 4, 4)); const p0 = [ic[0] + Math.cos(t) * r0 * s, ic[1] + Math.sin(t) * r0 * s], p1 = [ic[0] + Math.cos(t) * r1 * s, ic[1] + Math.sin(t) * r1 * s]; if (clipIn(...p0) && clipIn(...p1)) out.push(line([p0, p1], { ...A, b: A.b * .35, w: A.w * .3, o: .5 })); }
  out.push(circle(ic[0] - .06 * s, ic[1] - .06 * s, .035 * s, { ...A, b: A.b * 1.6, w: A.w * .5 }, 16));
  out.push(circle(ic[0] + .07 * s, ic[1] + .05 * s, .015 * s, { ...A, b: A.b * 1.1, w: A.w * .4 }, 10));
  return out.filter(Boolean);
}
export function displace(lines, fn) {
  for (const L of lines) { if (!L) continue; for (let k = 0; k < L.n; k++) { const d = fn(L.xy[k * 2], L.xy[k * 2 + 1], L, k); L.xy[k * 2] += d[0]; L.xy[k * 2 + 1] += d[1]; } }
  return lines;
}
