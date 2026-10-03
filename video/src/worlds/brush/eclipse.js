// eclipse.js: the film's clock and everything the eclipse paints.
//
// THE CLOCK (song time t -> magnitude m = fraction of the sun's DIAMETER covered):
//   0.00-5.40  cold open at totality (the payoff first); 1.45-1.60 the diamond-ring "blink" (an overlay event)
//   5.40-7.18  the rewind: the eclipse un-happens, the moon slides back off to the lower right
//   7.18-46.49 the full low sun
//   46.49      FIRST CONTACT (17:25 local solar time) at 5 o'clock, lower right; the moon climbs up-left
//   ~71 s 0.30 (S24) · 87.68 0.80 "when light went strange" (S27) · 89.22-93.0 0.90-0.95 (S28) · 100-104 beads (S31)
//   110.58     SECOND CONTACT: totality exactly on Drop 1's first kick
// Geometry (RESEARCH §1.4, §5): moon/sun apparent diameter 33.5'/31.4' (k = 1.066); the bright crescent sits at
// 11 o'clock with horns down-right; C2 beads near the top of the disc; Jupiter 11 deg above and 5.5 deg left.

import { clamp, lerp, sstep, hash3, hash4, TAU } from './util.js';

export const C1 = 46.49, C2 = 110.58, K = 33.5 / 31.4;
// the moon approaches from 5 o'clock: screen direction (x right, y down) from the sun's centre to the moon's
const A5 = Math.PI * 150 / 180;
export const MOON_DIR = [Math.sin(A5), -Math.cos(A5)];   // (0.5, 0.866): lower right

const KEYS = [[C1, 0], [51.72, .07], [57, .17], [64, .24], [71, .30], [80, .5], [86, .72], [87.68, .80], [89.22, .90], [93.0, .95],
  [96.89, .97], [100.24, .985], [103.64, .993], [108.84, .998], [C2, 1.0]];
// monotone cubic (Fritsch-Carlson) through the keys: the bite accelerates smoothly, never kinks
const MT = (() => {
  const n = KEYS.length, x = KEYS.map(k => k[0]), y = KEYS.map(k => k[1]), d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const tau = 3 / Math.sqrt(s); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; }
  }
  return { x, y, m };
})();
function partial(t) {
  const { x, y, m } = MT;
  if (t <= x[0]) return 0;
  if (t >= x[x.length - 1]) return 1;
  let i = 0; while (t > x[i + 1]) i++;
  const h = x[i + 1] - x[i], s = (t - x[i]) / h, s2 = s * s, s3 = s2 * s;
  return clamp((2 * s3 - 3 * s2 + 1) * y[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * y[i + 1] + (s3 - s2) * h * m[i + 1], 0, 1);
}

// moon offset in sun radii (0 = centred, K - 1 = 0.066 at C2/C3, 1 + K = 2.066 at C1/C4)
export function moonOffset(t) {
  if (t < 5.4) return 0;                                       // cold open: mid-totality
  if (t < 7.18) { const k = sstep(5.4, 7.0, t); return lerp(0, 2.4, k * k); }   // the rewind: slow to leave, then gone
  if (t < C1) return 2.4;
  if (t >= C2) return Math.max(0, (K - 1) * (1 - (t - C2) / .4));
  return 1 + K - 2 * partial(t);
}
export const magnitude = t => clamp((1 + K - moonOffset(t)) / 2, 0, 1.04);
// fraction of the sun's AREA hidden (drives how much light is left)
export function obscuration(off) {
  if (off >= 1 + K) return 0;
  if (off <= K - 1) return 1;
  const r1 = 1, r2 = K, d = off;
  const a1 = Math.acos(clamp((d * d + r1 * r1 - r2 * r2) / (2 * d * r1), -1, 1)), a2 = Math.acos(clamp((d * d + r2 * r2 - r1 * r1) / (2 * d * r2), -1, 1));
  const A = r1 * r1 * a1 + r2 * r2 * a2 - .5 * Math.sqrt(Math.max(0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)));
  return clamp(A / Math.PI);
}
// the eclipse "fraction" the light reacts to (STYLE_BIBLE: drives sharpening shadows, colour drain, metallic light).
// The world dims far less than the sun is covered until the very end: follow the magnitude, eased.
export const lightFraction = t => clamp(magnitude(t));
// for the engraved counter (type module): minutes to totality consistent with the bite (real 55:28 at C1)
export const minutesToTotality = t => t >= C2 ? 0 : t < C1 ? 55 + 28 / 60 : (55 + 28 / 60) * (1 - partial(t));
export function geometryAt(t) { const off = moonOffset(t); return { t, off, m: magnitude(t), obsc: obscuration(off), dir: MOON_DIR, k: K }; }

// screen geometry for a sun at (cx, cy) radius r (px): moon centre/radius and the crescent's direction
export function sunDisk(cx, cy, r, off, dir = MOON_DIR) {
  return { cx, cy, r, mx: cx + dir[0] * off * r, my: cy + dir[1] * off * r, mr: r * K, off, e: clamp((1 + K - off) / 2, 0, 1) };
}

// Jupiter: 11 deg above, 5.5 deg left of the sun; ppd = screen px per degree in this shot
export function jupiterAt(sun, ppd) { return [sun.cx - 5.5 * ppd, sun.cy - 11 * ppd]; }
export const jupiterVis = t => t < 7.18 ? 1 : sstep(88.6, 91.6, t);

// Baily's beads: light through lunar valleys where the last sliver breaks up. Returns [{x, y, size, k}]
export function beads(sd, seed = 5, gain = 1) {
  const { cx, cy, r, mx, my, mr, off } = sd;
  if (off > .16 || off < K - 1 - .02) return [];
  const mdir = Math.atan2(my - cy, mx - cx), out = [];
  for (let j = 0; j < 26; j++) {
    const ph = mdir + Math.PI + (hash3(j, 1, seed) - .5) * 2.4;              // around the point opposite the moon
    const lx = cx + Math.cos(ph) * r, ly = cy + Math.sin(ph) * r;
    const gap = Math.hypot(lx - mx, ly - my) - mr;                          // >0: the limb point is uncovered
    const depth = r * (.006 + .03 * Math.pow(hash3(j, 2, seed), 2.2));     // valley depth
    const k = clamp((gap + depth) / (depth * 1.6)) * gain;
    if (k <= .02) continue;
    out.push({ x: lx - Math.cos(ph) * r * .01, y: ly - Math.sin(ph) * r * .01, size: Math.max(.8, r * (.008 + .014 * hash3(j, 3, seed))) * (.6 + .6 * k), k: k * (.7 + .6 * hash3(j, 4, seed)) });
  }
  out.sort((a, b) => b.k - a.k);
  return out.slice(0, 12);
}
// the diamond ring: the brightest last bead (or a scripted point) plus the inner corona coming up
export function diamondRing(sd, strength, ang = null) {
  const a = ang ?? Math.atan2(sd.my - sd.cy, sd.mx - sd.cx) + Math.PI;
  return [sd.cx + Math.cos(a) * sd.r * .995, sd.cy + Math.sin(a) * sd.r * .995, Math.max(1.5, sd.r * .05), strength];
}

// ---------------------------------------------------------------- the painted corona
// Pearl strokes around the black disk, designed after totality photographs and the iris of an eye: a dense ring of
// fine fibres hugging the limb (the "iris"), asymmetric helmet streamers, polar plumes, a few rays and 2-3 small
// madder-pink prominences. `ripple` makes the fibres undulate like iris fibres; t animates it (12 drawings a second).
// opts: {cx, cy, R (moon radius px), k (brightness 0..1), t, seed, iris (0..1: fibre density/eye-likeness), tilt, warm,
//        clip(x, y) -> bool (sky test, optional), pal, scale}
// the corona as a totality photograph shows it (o.photo): a bright pearly inner corona hugging the limb, two or three
// helmet streamers (wide at the limb, tapering into long rays, asymmetric), fans of fine polar plumes, coronal holes
// between them, a few pink prominences. Never a symmetric radial ring (that reads as an iris).
export function coronaPhoto(o) {
  const { cx, cy, R, pal } = o, k = o.k ?? 1, t = o.t ?? 0, seed = o.seed ?? 3, tilt = o.tilt ?? -.35, sc = o.scale ?? 1;
  if (k <= 0.002 || R < 2) return [];
  const T = n => pal.tube(n) || [1, 1, 1];
  const lead = T('leadWhite'), naples = T('naples'), umber = T('rawUmber'), madder = T('madder'), verm = T('vermilion');
  const mixc = (a, b, q) => [lerp(a[0], b[0], q), lerp(a[1], b[1], q), lerp(a[2], b[2], q)];
  const pearl = mixc(lead, naples, .1), cool = mixc(lead, [.78, .82, .9], .25), ash = mixc(pearl, umber, .3);
  const pink = [lerp(madder[0], lead[0], .45), lerp(madder[1], lead[1], .32), lerp(madder[2], lead[2], .34)];
  const out = [], h = (a, b) => hash3(a, b, seed), clip = o.clip || null;
  const col = (c, b) => [clamp(c[0] * b), clamp(c[1] * b), clamp(c[2] * b)];
  const polar = (path, n, w, b, cA, cB, thick, sd, taper = .8, alpha = 1) => {
    let cur = [];
    const flush = () => { if (cur.length >= 2) out.push({ pts: cur, r: w, c0: col(cA, b), c1: col(cB, b * .55), a: clamp(alpha) * Math.min(1, k * 1.3), thick, seed: sd, key: sd, layer: 7, taper, maxSeg: 24 }); cur = []; };
    for (let q = 0; q <= n; q++) { const [r, phi] = path(q / n), x = cx + Math.cos(phi) * r, y = cy + Math.sin(phi) * r; if (clip && !clip(x, y)) { flush(); continue; } cur.push([x, y]); }
    flush();
  };
  const dA = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
  // the streamers: [angle from the tilt axis, half-width at the limb (rad), reach (moon radii), brightness, bend]
  const ST = o.streamers || [[.1, .5, 3.4, 1, .1], [3.0, .42, 2.6, .85, -.12], [2.2, .25, 1.7, .5, .05], [-1.05, .2, 1.45, .4, -.05]];
  const env = phi => {                          // how far / how bright the corona reaches at this position angle
    let e = .16 + .1 * (vn(phi * 1.7 + seed) - .5);
    for (const [da, w, len, b] of ST) { const d = dA(phi, tilt + da); e = Math.max(e, len * b * Math.exp(-(d * d) / (w * w)) * .55); }
    return e;
  };
  // 1. inner corona: dense short radial strokes, brightest at the limb, reach following env (no regular bundles)
  const nI = Math.round(900 * Math.min(2.4, R / 60) * sc);
  for (let j = 0; j < nI; j++) {
    const phi0 = h(j, 1) * TAU, e = env(phi0), q2 = Math.pow(h(j, 2), 2.2);
    const len = R * (.1 + Math.min(1.2, e) * .7 * q2 + .05 * h(j, 3));
    const shimmer = .03 * Math.sin(t * (1.2 + .5 * h(j, 4)) + h(j, 5) * TAU);
    const b = (.7 + .5 * h(j, 6)) * (1 - .5 * q2) * k;
    polar(q => [R * (1.0 + .01 * h(j, 7)) + len * q, phi0 + shimmer * q], 4, Math.max(.8, R * (.008 + .012 * h(j, 8))), b, h(j, 9) < .7 ? pearl : cool, ash, .4, h(j, 10), .85, .3 + .35 * h(j, 11));
  }
  // 2. helmet streamers: many fine strokes from a wide base converging into a long, slightly bent ray
  ST.forEach(([da, w, len, bs, bend], si) => {
    const ax = tilt + da, n = Math.round((60 + 90 * bs) * sc * Math.min(2, R / 50));
    for (let m = 0; m < n; m++) {
      const u = (h(si * 300 + m, 1) * 2 - 1), base = ax + u * w, reach = R * (1.2 + len * (.45 + .55 * Math.pow(h(si * 300 + m, 2), .6)) * (1 - .35 * Math.abs(u)));
      const b = bs * (.35 + .4 * h(si * 300 + m, 3)) * (1 - .4 * Math.abs(u)) * k;
      polar(q => {
        const r = lerp(R * 1.02, reach, Math.pow(q, 1.15)), conv = Math.pow(R / r, .9);       // converge toward the axis with height
        return [r, ax + (base - ax) * (.25 + .75 * conv) + bend * (r - R) / R * .15];
      }, 12, Math.max(.9, R * (.012 + .018 * h(si * 300 + m, 4))), b, pearl, ash, .3, h(si * 300 + m, 5), .92, .28 + .3 * h(si * 300 + m, 6));
    }
  });
  // 3. polar plumes: fans of fine straight rays at both poles, short and faint (the coronal holes stay dark)
  for (const [pi, pole] of [[0, tilt - Math.PI / 2], [1, tilt + Math.PI / 2]]) for (let m = 0; m < Math.round(26 * sc); m++) {
    const u = (m + .5) / 26 * 2 - 1, phi0 = pole + u * .55, rEnd = R * (1.25 + .45 * h(m, 20 + pi) * (1 - .5 * Math.abs(u)));
    polar(q => { const r = lerp(R * 1.03, rEnd, q); return [r, phi0 + u * .5 * (r - R) / R]; }, 6, Math.max(.7, R * .007), (.32 + .3 * h(m, 30 + pi)) * k, cool, cool, .3, h(m, 40 + pi), .9, .45);
  }
  // 4. the limb: a thin bright broken ring
  const nL = Math.round(90 * Math.min(3, R / 40));
  for (let j = 0; j < nL; j++) {
    const a0 = (j + h(j, 21)) / nL * TAU, span = TAU / nL * (1.4 + h(j, 22));
    polar(q => [R * (1.01 + .006 * h(j, 23)), a0 + span * q], 3, Math.max(.8, R * .012), 1.1 * k, lead, pearl, .7, h(j, 24), .4, .9);
  }
  // 5. a few prominences at irregular places (never a regular ring)
  const proms = o.prominences || [[1.25, .06, .09], [2.4, .035, .05], [-2.3, .07, .11], [-.35, .03, .045]];
  proms.forEach(([da, dw, hh], pi) => {
    for (let j = 0; j < 3; j++) {
      const dl = dw * (.5 + .2 * j), ht = R * hh * (.7 + .15 * j);
      polar(q => [R + ht * Math.sin(Math.PI * q), tilt + da - dl + 2 * dl * q], 6, Math.max(.8, R * .011), Math.min(1.1, k * 1.5), pink, [verm[0], verm[1] * .8, verm[2] * .8], .5, h(pi, 31 + j), .5, .9);
    }
  });
  return out;
}
const vn = x => { const i = Math.floor(x), f = x - i, a = hash3(i, 7, 91), b = hash3(i + 1, 7, 91); return a + (b - a) * f * f * (3 - 2 * f); };

export function coronaStrokes(o) {
  if (o.photo) return coronaPhoto(o);
  const { cx, cy, R, pal } = o, k = o.k ?? 1, t = o.t ?? 0, seed = o.seed ?? 3, iris = o.iris ?? 0, tilt = o.tilt ?? -.35, sc = o.scale ?? 1;
  if (k <= 0.002 || R < 2) return [];
  const T = n => pal.tube(n) || [1, 1, 1];
  const lead = T('leadWhite'), naples = T('naples'), ochre = T('yellowOchre'), madder = T('madder'), umber = T('rawUmber'), verm = T('vermilion'), bumber = T('burntUmber');
  const mixc = (a, b, q) => [lerp(a[0], b[0], q), lerp(a[1], b[1], q), lerp(a[2], b[2], q)];
  const pearl = mixc(lead, naples, .16), warmT = mixc(naples, ochre, .4), ash = mixc(pearl, umber, .35);
  const pink = [lerp(madder[0], lead[0], .45), lerp(madder[1], lead[1], .32), lerp(madder[2], lead[2], .34)];
  const out = [], h = (a, b) => hash3(a, b, seed);
  const clip = o.clip || null;
  const col = (c, b) => [clamp(c[0] * b), clamp(c[1] * b), clamp(c[2] * b)];
  const polar = (path, n, w, b, cA, cB, thick, sd, taper = .8, alpha = 1) => {
    let cur = [];
    const flush = () => {
      if (cur.length >= 2) out.push({ pts: cur, r: w, c0: col(cA, b), c1: col(cB, b * .6), a: clamp(alpha) * Math.min(1, k * 1.3), thick, seed: sd, key: sd, layer: 7, taper, maxSeg: 24 });
      cur = [];
    };
    for (let q = 0; q <= n; q++) {
      const [r, phi] = path(q / n), x = cx + Math.cos(phi) * r, y = cy + Math.sin(phi) * r;
      if (clip && !clip(x, y)) { flush(); continue; }
      cur.push([x, y]);
    }
    flush();
  };
  // fibres undulate a little (12 drawings a second): the iris breathing, never tentacles
  const rip = (j, r, amp) => amp * Math.sin(r / R * 5 + t * (1.4 + .6 * h(j, 71)) + h(j, 72) * TAU) * Math.min(1, (r / R - 1) * 1.5);
  const outerR = o.reach ?? (1 + (.5 + .45 * iris));         // where the iris ends (in moon radii)
  const gold = mixc(naples, ochre, .55), silver = mixc(lead, umber, .18);
  // 1. the fibrous body: broad, semi-transparent radial strokes in pearl, Naples and ash, crypts between bundles
  const nF = Math.round((380 + 1400 * iris) * Math.min(2.2, R / 60) * sc);
  for (let j = 0; j < nF; j++) {
    const phi0 = h(j, 1) * TAU, q2 = Math.pow(h(j, 2), iris > .5 ? 2.1 : 1.6), r0 = R * (1.0 + .012 * h(j, 3));   // a ragged outer edge, never a donut
    // the iris breathes: each fibre's reach swells and settles on its own slow phase (alive from the first frame)
    const breath = 1 + (o.breath ?? (iris > .5 ? .07 : 0)) * Math.sin(t * (1.1 + .5 * h(j, 73)) + h(j, 74) * TAU);
    const len = R * (.12 + (outerR - 1.05) * q2) * breath;
    const bundle = .5 + .5 * Math.sin(phi0 * 19 + 2.2 * Math.sin(phi0 * 4 + seed));      // bundles and crypts
    if (iris > .5 && bundle < .2 && h(j, 75) < .6) continue;      // crypts: gaps between the bundles (fewer fibres, never dark ones)
    const crypt = iris <= .5 && iris > .3 && bundle < .22 ? .45 : 1;
    const b = (.62 + .45 * h(j, 5)) * (1 - .35 * q2) * crypt * k;
    const tone = h(j, 9);
    // the eye: pearl at the limb, gold through the middle of the iris, cool silver at the tips (a radial gradient
    // along every fibre); the plain corona keeps its pearl / Naples / ash mix
    const cA = iris > .5 ? (tone < .7 ? mixc(lead, naples, .25) : gold) : tone < .55 ? pearl : tone < .85 ? warmT : ash;
    const cB = iris > .5 ? (q2 > .45 ? mixc(silver, lead, .3) : gold) : mixc(cA, umber, .4);
    polar(q => { const r = r0 + len * q; return [r, phi0 + rip(j, r, .05 * (h(j, 4) - .5)) + .03 * Math.sin(q * 3 + h(j, 6) * 6)]; }, 5,
      Math.max(.9, R * (.012 + .022 * h(j, 7)) * (1 + .5 * iris)), b, cA, cB, .45, h(j, 8), .85, .32 + .38 * h(j, 10));
  }
  // 2. the collarette: a bright, warm, broken ring of short strokes close to the limb
  const nC = Math.round(140 * Math.min(3, R / 40) * sc);
  for (let j = 0; j < nC; j++) {
    const phi0 = (j + h(j, 31)) / nC * TAU, r0 = R * (1.02 + .02 * h(j, 32)), len = R * (.06 + .1 * h(j, 33));
    polar(q => [r0 + len * q, phi0 + .02 * (h(j, 34) - .5)], 2, Math.max(.9, R * .022), (.85 + .3 * h(j, 35)) * k, lead, naples, .6, h(j, 36), .7, .7);
  }
  // 3. streamers: a few long soft brushes along the solar-minimum wings, faint; very few on the eye
  const streamers = o.streamers || [[.12, 2.2, .45, 1], [3.02, 1.9, .4, .85], [3.8, 1.2, .26, .5], [-.8, 1.5, .3, .55]];
  const nS = Math.round((iris > .5 ? 14 : 18) * sc * Math.min(2, R / 50));
  streamers.forEach(([da, len, ws, bs], si) => {
    const ph = tilt + da;
    for (let m = 0; m < nS; m++) {
      const u = (m + .5) / nS * 2 - 1, phi0 = ph + u * ws, rEnd = R * (1 + len * (.4 + .6 * h(si * 50 + m, 6)) * (iris > .5 ? .8 : 1)), r0 = R * outerR * .85;
      polar(q => { const r = lerp(r0, rEnd, Math.pow(q, 1.1)); return [r, ph + (phi0 - ph) * (.4 + .6 * Math.pow(R / r, 1.2))]; }, 10,
        Math.max(1, R * (.025 + .02 * h(si * 50 + m, 8))), bs * (.4 + .3 * h(si * 50 + m, 7)) * k, pearl, ash, .3, h(si * 50 + m, 9), .9, .3);
    }
  });
  // 4. polar plumes (not on the eye)
  if (iris < .5) for (const pole of [tilt - Math.PI / 2, tilt + Math.PI / 2]) for (let m = 0; m < Math.round(12 * sc); m++) {
    const phi0 = pole + (m / 11 - .5) * .9, rEnd = R * (1.3 + .5 * h(m, pole > tilt ? 11 : 12));
    polar(q => { const r = lerp(R * 1.04, rEnd, q); return [r, phi0 + (phi0 - pole) * .4 * (r - R) / R]; }, 6, Math.max(.8, R * .012), .5 * (.5 + .6 * h(m, 13)) * k, pearl, pearl, .35, h(m, 14), .9, .45);
  }
  // 5. the limb: a ring of short tangential strokes, bright
  const nL = Math.round(90 * Math.min(3, R / 40));
  for (let j = 0; j < nL; j++) {
    const a0 = (j + h(j, 21)) / nL * TAU, span = TAU / nL * (1.4 + h(j, 22));
    polar(q => [R * (1.01 + .006 * h(j, 23)), a0 + span * q], 3, Math.max(.8, R * .014), 1.1 * k, lead, pearl, .7, h(j, 24), .4, .9);
  }
  // 6. prominences: a broken ring of small madder-pink tongues on the limb (the eye: more, like f1's ring)
  const proms = o.prominences || (iris > .5 ? Array.from({ length: 11 }, (_, i) => [i / 11 * TAU + h(i, 51) * .4, .04 + .05 * h(i, 52), .04 + .07 * h(i, 53)]) : [[1.15, .07, .11], [2.25, .05, .07], [-2.45, .085, .13]]);
  proms.forEach(([da, dw, hh], pi) => {
    for (let j = 0; j < 3; j++) {
      const dl = dw * (.5 + .2 * j), ht = R * hh * (.7 + .15 * j);
      polar(q => [R * 1.0 + ht * Math.sin(Math.PI * q), tilt + da - dl + 2 * dl * q], 6, Math.max(.8, R * .012), Math.min(1.1, k * 1.5), pink, [verm[0], verm[1] * .8, verm[2] * .8], .5, h(pi, 31 + j), .5, .9);
    }
  });
  // 7. the iris's darker limbal ring (the eye): a broken ring of umber strokes at the fibres' outer edge
  if (iris > .3 && !o.noLimbal) for (let j = 0; j < 120; j++) {
    const a0 = h(j, 41) * TAU, rr = R * (outerR * (.8 + .25 * h(j, 42)));
    polar(q => [rr + R * .04 * Math.sin(q * 3), a0 + .1 * q], 3, Math.max(1, R * .03), .22 * iris, bumber, umber, .3, h(j, 43), .6, .4);
  }
  return out;
}
