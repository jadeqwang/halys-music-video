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
        out.push({ xy, n: m, b, w, o, d, s, len: s[m - 1], dir: 1, phase: hash3(out.length, 3, base) * TAU, spd: .8 + .4 * hash3(out.length, 4, base), flags: FL.CORONA | FL.SKY, id: out.length, ...extra });
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
  seed: 5, n: 64, Lmin: 1.9, Lmax: 60, tilt: .0, quad: .18, gain: .55, width: .8, falloff: .75, jitter: .25,
  extent: 4000, step: 3, minB: .035, fadeIn: 1.3, warm: .03, octupole: .05, open: 0,
};
// field lines of a tilted dipole (+ quadrupole/octupole wrinkles), r = L sin^2(theta) generalised: lobes on both sides
export function skyField(sun, opt = {}) {
  const o = { ...SKY_DEFAULTS, ...opt }, out = [], R = sun.r, scale = o.scale ?? 1, sd = o.seed * 131 + 7, h = (a, b) => hash3(a, b, sd);
  const emit = emitter(out, o.visible, scale, sd);
  const tilt = o.tilt;
  for (const side of [-1, 1]) for (let k = 0; k < o.n; k++) {
    const u = (k + .5 + o.jitter * (h(k * 2 + (side > 0 ? 1 : 0), 1) - .5)) / o.n;
    const L = R * o.Lmin * Math.pow(o.Lmax / o.Lmin, Math.pow(u, 1.15));                 // log-spaced lobe sizes
    const bLine = (.6 + .8 * h(k, side > 0 ? 3 : 4)) * o.gain;
    const wob = (h(k, side > 0 ? 5 : 6) - .5) * 2;
    const pts = [];
    // theta from the dipole axis (up), the full loop from the north footpoint to the south one
    const th0 = Math.asin(Math.min(1, Math.sqrt(R * 1.02 / L)));
    const nS = Math.max(40, Math.min(900, Math.round(L * 2.2 / (o.step * R / 10 + 1))));
    for (let j = 0; j <= nS; j++) {
      const th = lerp(th0, Math.PI - th0, j / nS);
      const sn = Math.sin(th), cs = Math.cos(th);
      // generalised radius: dipole + quadrupole (asymmetric north/south and per side) + a little octupole wrinkle
      const rr = L * sn * sn * (1 + o.quad * cs * side + o.octupole * Math.sin(3 * th + wob) );
      if (rr < R * 1.01) continue;
      const a = th * side + tilt;                          // angle from vertical (screen up), mirrored per side
      const x = sun.x + Math.sin(a) * rr, y = sun.y - Math.cos(a) * rr;
      if (Math.abs(x - sun.x) > o.extent || Math.abs(y - sun.y) > o.extent) continue;
      const fall = Math.pow(R * 2.2 / Math.max(rr, R * 2.2), o.falloff);
      const b = bLine * fall * sstep(R * 1.0, R * o.fadeIn * 1.6, rr);
      pts.push({ x, y, b: Math.max(b, o.minB * bLine), w: o.width * (.75 + .5 * fall), o: o.warm, s: Math.min(j, nS - j) / nS * L * scale * 2 });
    }
    emit(pts);
  }
  return out;
}
