// corona.js: the totality corona and the sky's magnetic field, drawn as lines.
//
// coronaLines(sun, opt): the photographic corona in lines (after totality photographs): a thin intensely bright limb
//   ring, asymmetric helmet streamers (nested loops at the base, open stalks fraying out), polar plumes, a fibril halo,
//   faint outer rays and 2-3 tiny H-alpha prominences. The disk itself is left empty: the post pass cuts a crisp black
//   disk (analytic) after the glow.
// skyField(sun, opt): the field lines that sweep the whole sky (style frame F4): a tilted dipole with a weak quadrupole,
//   traced as nested lobes from footpoints on the limb out to the frame edges and back down to the horizon, dense
//   near the sun and sparse far out; the land occludes them.
//
// Both return lines in the caller's 2D space (sun = {x, y, r} in that space, `scale` = output px per unit) with
// d = -1 (infinitely far: the 3D lift leaves them in the sky) and flags CORONA | SKY. visible(x, y) splits a line where the
// land hides it. Everything is deterministic in opt.seed.

import { clamp, lerp, sstep, hash3, TAU } from '../../core.js';
import { FL } from './trace.js';

function emitter(out, visible, scale, base) {
  // polyline from points [{x, y, b, w, o}], split where invisible; s = arc length in output px from the start
  return (pts, extra = {}) => {
    let cur = [], acc = 0, px = null, py = null;
    const flush = () => {
      if (cur.length >= 2) {
        const m = cur.length, xy = new Float32Array(m * 2), b = new Float32Array(m), w = new Float32Array(m), o = new Float32Array(m), d = new Float32Array(m).fill(-1), s = new Float32Array(m);
        cur.forEach((c, k) => { xy[k * 2] = c.x; xy[k * 2 + 1] = c.y; b[k] = c.b; w[k] = c.w; o[k] = c.o; s[k] = c.s; });
        let smax = 0; for (let k = 0; k < m; k++) smax = Math.max(smax, s[k]);
        out.push({ xy, n: m, b, w, o, d, s, len: smax, dir: 1, phase: hash3(out.length, 3, base) * TAU, spd: .8 + .4 * hash3(out.length, 4, base), flags: FL.CORONA | FL.SKY, id: out.length, ...extra });
      }
      cur = [];
    };
    for (const p of pts) {
      if (px !== null) acc += Math.hypot(p.x - px, p.y - py) * scale;
      px = p.x; py = p.y;
      if (visible && !visible(p.x, p.y)) { flush(); continue; }
      cur.push({ ...p, s: p.s ?? acc });
    }
    flush();
  };
}

export const CORONA_DEFAULTS = {
  seed: 3, warm: .04, limb: 2.4, limbW: 1.5,
  // [angle offset from tilt (rad), length (solar radii), half-width (rad), brightness]
  streamers: [[.12, 4.6, .5, 1], [3.02, 3.9, .42, .85], [3.8, 2.2, .26, .5], [-.8, 2.6, .3, .58], [1.85, 1.6, .22, .42]],
  prominences: [[1.15, .07, .11], [2.25, .05, .07], [-2.45, .085, .13]],
  nFibrils: 420, nRays: 70, nPlume: 30, gain: 1, widthK: 1,
};

export function coronaLines(sun, opt = {}) {
  const o = { ...CORONA_DEFAULTS, ...opt }, out = [], R = sun.r, scale = o.scale ?? 1, sd = o.seed * 977 + 13, h = (a, b) => hash3(a, b, sd);
  const tilt = sun.tilt ?? .5, warm = o.warm, G = o.gain, WK = o.widthK * (o.pxWidth ?? 1);
  const emit = emitter(out, o.visible, scale, sd);
  const polar = (path, n, bFn, wFn, oFn = () => warm, extra) => {
    const pts = [];
    for (let k = 0; k <= n; k++) { const t = k / n, [r, phi] = path(t); pts.push({ x: sun.x + Math.cos(phi) * r, y: sun.y + Math.sin(phi) * r, b: bFn(t, r) * G, w: wFn(t, r) * WK, o: oFn(t) }); }
    emit(pts, extra);
  };
  // limb: a thin, intensely bright inner ring and a fainter second ring (brightness broken into beads)
  polar(t => [R * 1.012, t * TAU], 360, t => o.limb * (.85 + .3 * h(Math.floor(t * 48), 1)), () => o.limbW, undefined, { ring: 1 });
  polar(t => [R * 1.045, t * TAU], 360, t => .95 * (.7 + .5 * h(Math.floor(t * 30), 2)), () => .9);
  // helmet streamers: a bulbous base of nested loops (irregular heights and spacing, skewed), then a bundle of open
  // lines converging slowly into a long stalk that frays out at ragged radii
  o.streamers.forEach(([da, len, ws, bs], si) => {
    const ph = tilt + da, skew = (h(si, 77) - .5) * .5, dome = q => R * (.08 + .55 * Math.max(0, 1 - Math.pow(q, 2)));
    const nl = 16 + Math.floor(h(si, 78) * 8);
    for (let j = 0; j < nl; j++) {
      const jj = (j + .35 * (h(si * 90 + j, 41) - .5)) / nl, dl = ws * (.12 + .95 * jj) * (.9 + .2 * h(si * 90 + j, 42));
      const hh = R * (.03 + (.42 + .18 * h(si * 90 + j, 43)) * Math.pow(dl / ws, 1.35));
      polar(t => [R * 1.01 + hh * Math.pow(Math.sin(Math.PI * t), .8) * (1 + skew * (t - .5)), ph + skew * .15 * hh / R - dl + 2 * dl * t], 64,
        (t, r) => bs * 1.75 * Math.pow(R / r, 1.0) * (.7 + .55 * h(si * 90 + j, 40)), () => .8);
    }
    const nOpen = 30;
    for (let m = 0; m < nOpen; m++) {
      const u = (m + .5) / nOpen * 2 - 1, phi0 = ph + u * ws * 1.25 + .05 * ws * (h(si * 50 + m, 5) - .5), q = Math.abs(u) / .9;
      const r0 = R * 1.01 + (q < 1 ? dome(q) : 0), rEnd = R * (1 + len * (.3 + .7 * Math.pow(h(si * 50 + m, 6), .7))), fib = .45 + 1.0 * h(si * 50 + m, 7);
      const curl = (h(si * 50 + m, 8) - .5) * .06;
      polar(t => { const r = lerp(r0, rEnd, Math.pow(t, 1.25)); return [r, ph + (phi0 - ph) * (.36 + .64 * Math.pow(R / r, 1.25)) + curl * t * t]; }, 110,
        (t, r) => bs * 1.3 * fib * Math.pow(R / r, 1.35) * (1 - sstep(.55, 1, t)), t => lerp(.95, .5, t));
    }
  });
  // faint outer rays between the streamers
  for (let m = 0; m < o.nRays; m++) {
    const phi0 = h(m, 30) * TAU, rEnd = R * (1.6 + 1.5 * h(m, 31));
    polar(t => [lerp(R * 1.05, rEnd, t), phi0 + .04 * (h(m, 32) - .5) * t], 30, (t, r) => .3 * (.4 + h(m, 33)) * Math.pow(R / r, 1.7) * (1 - sstep(.5, 1, t)), () => .55);
  }
  // polar plumes: fine, near-straight, slightly superradial lines at both poles
  for (const pole of [tilt - Math.PI / 2, tilt + Math.PI / 2]) for (let m = 0; m < o.nPlume; m++) {
    const k = pole > tilt ? 1 : 0, phi0 = pole + (m / (o.nPlume - 1) - .5) * 1.0 + .03 * (h(m, 9 + k) - .5), rEnd = R * (1.3 + .9 * h(m, 11 + k));
    polar(t => { const r = lerp(R * 1.02, rEnd, t); return [r, phi0 + (phi0 - pole) * .4 * (r - R) / R]; }, 40, (t, r) => .6 * (.5 + .9 * h(m, 13)) * Math.pow(R / r, 2.3) * (1 - sstep(.6, 1, t)), () => .6);
  }
  // fibrils: the dense fine radial texture of the inner corona, hugging the limb
  for (let m = 0; m < o.nFibrils; m++) {
    const phi0 = h(m, 14) * TAU, rEnd = R * (1.06 + .55 * Math.pow(h(m, 15), 2.2));
    polar(t => [lerp(R * 1.015, rEnd, t), phi0], 12, (t, r) => .95 * (.3 + h(m, 16)) * Math.pow(R / r, 3.2) * (1 - sstep(.45, 1, t)), () => .52);
  }
  // prominences: tiny arches of H-alpha red on the limb
  (o.prominences || []).forEach(([da, dw, hh]) => {
    for (let j = 0; j < 4; j++) {
      const dl = dw * (.55 + .15 * j), ht = R * hh * (.7 + .12 * j);
      polar(t => [R * 1.0 + ht * Math.sin(Math.PI * t), tilt + da - dl + 2 * dl * t], 24, () => 1.7, () => 1.05, () => 1.9);
    }
  });
  return out;
}

export const SKY_DEFAULTS = {
  seed: 5, tilt: .12, gain: .5, width: .8, falloff: .8, warm: .03,
  sep0: .1, sepGamma: .95, sep1: 1.5, dtest: .55, step: .05, maxLen: 120,   // in solar radii
  locals: 6, localK: .07, quad: .25, uniform: 0, rmax: 40, minLen: .8,
  bounds: null,            // [x0, y0, x1, y1] in the caller's space (default: +-rmax solar radii)
};
// the sky's magnetic field (style frame F4): evenly spaced field lines (Jobard & Lefer) of a tilted dipole + a weak
// quadrupole + small active-region dipoles just inside the limb (loops near the sun) [+ an optional uniform field that
// opens the far lines upward]. Spacing grows with distance from the sun, so the field is dense near the corona and
// sweeps the whole sky with a few long lines; field lines never cross or bundle.
export function skyField(sun, opt = {}) {
  const o = { ...SKY_DEFAULTS, ...opt }, out = [], R = sun.r, scale = o.scale ?? 1, sd = o.seed * 131 + 7, h = (a, b) => hash3(a, b, sd);
  const emit = emitter(out, o.visible, scale, sd);
  // sources in solar units (y up)
  const src = [{ x: 0, y: 0, mx: Math.sin(o.tilt), my: Math.cos(o.tilt), k: 1 }];
  src.push({ x: .25 * Math.cos(o.tilt + 1.2), y: .25 * Math.sin(o.tilt + 1.2), mx: -Math.sin(o.tilt + .9), my: Math.cos(o.tilt + .9), k: o.quad });
  for (let i = 0; i < o.locals; i++) {
    const a = h(i, 1) * TAU, rr = .8 + .12 * h(i, 2), k = o.localK * (.4 + h(i, 3));
    src.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, mx: -Math.sin(a) * (h(i, 4) > .5 ? 1 : -1), my: Math.cos(a) * (h(i, 4) > .5 ? 1 : -1), k });
  }
  const field = (x, y, v) => {
    let bx = 0, by = o.uniform;
    for (const s of src) {
      const dx = x - s.x, dy = y - s.y, r2 = dx * dx + dy * dy + 1e-6, r = Math.sqrt(r2), r3 = r2 * r, ux = dx / r, uy = dy / r, md = s.mx * ux + s.my * uy;
      bx += s.k * (3 * md * ux - s.mx) / r3; by += s.k * (3 * md * uy - s.my) / r3;
    }
    const m = Math.hypot(bx, by); v[0] = bx / (m || 1); v[1] = by / (m || 1); return m;
  };
  // bounds in solar units (screen y down -> math y up)
  const bb = o.bounds ? [(o.bounds[0] - sun.x) / R, -(o.bounds[3] - sun.y) / R, (o.bounds[2] - sun.x) / R, -(o.bounds[1] - sun.y) / R] : [-o.rmax, -o.rmax, o.rmax, o.rmax];
  const sepAt = (x, y) => Math.min(o.sep1, o.sep0 * Math.pow(Math.max(1, Math.hypot(x, y)), o.sepGamma));
  const okAt = (x, y) => x > bb[0] && x < bb[2] && y > bb[1] && y < bb[3] && Math.hypot(x, y) > 1.04 && (!o.visible || o.visible(sun.x + x * R, sun.y - y * R));
  const cell = o.sep0, gx0 = bb[0], gy0 = bb[1], gw = Math.ceil((bb[2] - bb[0]) / cell) + 1, gh = Math.ceil((bb[3] - bb[1]) / cell) + 1;
  const grid = new Map(), cellOf = (x, y) => Math.floor((y - gy0) / cell) * gw + Math.floor((x - gx0) / cell);
  const pts = [];  // [x, y, lineId, idx]
  const tooClose = (x, y, d, lid, idx) => {
    const r = Math.ceil(d / cell), cx = Math.floor((x - gx0) / cell), cy = Math.floor((y - gy0) / cell), d2 = d * d, near = Math.ceil(2.5 * d / o.step);
    for (let j = Math.max(0, cy - r); j <= Math.min(gh - 1, cy + r); j++) for (let i = Math.max(0, cx - r); i <= Math.min(gw - 1, cx + r); i++) {
      const c = grid.get(j * gw + i); if (!c) continue;
      for (const p of c) { if (p[2] === lid && Math.abs(p[3] - idx) < near) continue; const dx = p[0] - x, dy = p[1] - y; if (dx * dx + dy * dy < d2) return true; }
    }
    return false;
  };
  const insert = (x, y, lid, idx) => { const k = cellOf(x, y); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push([x, y, lid, idx]); };
  const lines = [], v = [0, 0], v2 = [0, 0];
  const grow = (x0, y0) => {
    if (!okAt(x0, y0)) return null;
    const lid = lines.length; if (tooClose(x0, y0, sepAt(x0, y0) * .95, lid, 0)) return null;
    const br = [];
    const tmp = [];
    for (const dir of [1, -1]) {
      const P = []; let x = x0, y = y0, idx = 0;
      for (let k = 0; k < o.maxLen / o.step; k++) {
        const m = field(x, y, v); if (m < 1e-7) break;
        const mx = x + v[0] * o.step * .5 * dir, my = y + v[1] * o.step * .5 * dir;
        field(mx, my, v2);
        const st = o.step * Math.min(4, Math.max(1, Math.hypot(x, y) * .25));          // longer steps far out
        const nx = x + v2[0] * st * dir, ny = y + v2[1] * st * dir;
        if (!okAt(nx, ny)) break;
        idx += dir;
        if (tooClose(nx, ny, sepAt(nx, ny) * o.dtest, lid, idx)) break;
        x = nx; y = ny; P.push(x, y, idx); tmp.push([x, y, idx]);
      }
      br.push(P);
    }
    const n = 1 + (br[0].length + br[1].length) / 3;
    // arc length check
    let len = 0; const all = [];
    for (let k = br[1].length - 3; k >= 0; k -= 3) all.push([br[1][k], br[1][k + 1]]);
    all.push([x0, y0]);
    for (let k = 0; k < br[0].length; k += 3) all.push([br[0][k], br[0][k + 1]]);
    for (let k = 1; k < all.length; k++) len += Math.hypot(all[k][0] - all[k - 1][0], all[k][1] - all[k - 1][1]);
    if (len < o.minLen) return null;
    insert(x0, y0, lid, 0); for (const [x, y, idx] of tmp) insert(x, y, lid, idx);
    const L = { pts: all, lid, n };
    lines.push(L);
    return L;
  };
  // neighbour seeds every ~half a spacing along each new line; a FIFO with a read pointer (no shift(): O(n))
  const queue = []; let qi = 0;
  const enqueue = L => {
    let acc = 0;
    for (let k = 1; k < L.pts.length; k++) {
      const [x, y] = L.pts[k], d = sepAt(x, y); acc += Math.hypot(x - L.pts[k - 1][0], y - L.pts[k - 1][1]);
      if (acc < d * .9) continue; acc = 0;
      let tx = x - L.pts[k - 1][0], ty = y - L.pts[k - 1][1]; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
      queue.push([x - ty * d, y + tx * d], [x + ty * d, y - tx * d]);
    }
  };
  const maxLines = o.maxLines ?? 1400;
  const drain = () => { while (qi < queue.length && lines.length < maxLines) { const q = queue[qi++]; const L2 = grow(q[0], q[1]); if (L2) enqueue(L2); } };
  // seeds: a ring just outside the limb, then neighbours, then a coarse scan of the sky for islands
  for (let i = 0; i < 90 && lines.length < maxLines; i++) { const a = i / 90 * TAU + .013; const L = grow(Math.cos(a) * 1.08, Math.sin(a) * 1.08); if (L) enqueue(L); drain(); }
  for (let y = bb[1]; y < bb[3] && lines.length < maxLines; y += 1.2) for (let x = bb[0]; x < bb[2]; x += 1.2) { const L = grow(x + .3 * (h(x * 7 | 0, y * 7 | 0) - .5), y); if (L) { enqueue(L); drain(); } }
  // emit: brightness falls off with distance from the sun; pulses travel outward (s grows away from the sun)
  for (const L of lines) {
    const bLine = (.65 + .7 * h(L.lid, 7)) * o.gain;
    let iMin = 0, rMin = 1e9; L.pts.forEach((p, k) => { const r = Math.hypot(p[0], p[1]); if (r < rMin) { rMin = r; iMin = k; } });
    const P = L.pts.map(([x, y]) => {
      const r = Math.hypot(x, y), fall = Math.pow(2.2 / Math.max(r, 2.2), o.falloff);
      return { x: sun.x + x * R, y: sun.y - y * R, b: bLine * fall * sstep(1.0, 1.5, r), w: o.width * (.7 + .5 * fall), o: o.warm };
    });
    let acc = 0; const sArr = new Float32Array(P.length);
    for (let k = iMin + 1; k < P.length; k++) { acc += Math.hypot(P[k].x - P[k - 1].x, P[k].y - P[k - 1].y) * scale; sArr[k] = acc; }
    acc = 0; for (let k = iMin - 1; k >= 0; k--) { acc += Math.hypot(P[k].x - P[k + 1].x, P[k].y - P[k + 1].y) * scale; sArr[k] = acc; }
    P.forEach((p, k) => p.s = sArr[k]);
    // taper both ends (arc length from each end, output px)
    let tot = 0; const fromStart = new Float32Array(P.length);
    for (let k = 1; k < P.length; k++) { tot += Math.hypot(P[k].x - P[k - 1].x, P[k].y - P[k - 1].y) * scale; fromStart[k] = tot; }
    P.forEach((p, k) => { p.b *= sstep(0, 14, fromStart[k]) * sstep(0, 14, tot - fromStart[k]); });
    emit(P, { flags: FL.CORONA | FL.SKY | FL.NOFADE });
  }
  return out;
}
