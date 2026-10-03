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
export function coronaStrokes(o) {
  const { cx, cy, R, pal } = o, k = o.k ?? 1, t = o.t ?? 0, seed = o.seed ?? 3, iris = o.iris ?? 0, tilt = o.tilt ?? -.35, sc = o.scale ?? 1;
  if (k <= 0.002 || R < 2) return [];
  const T = n => pal.tube(n) || [1, 1, 1];
  const lead = T('leadWhite'), naples = T('naples'), ochre = T('yellowOchre'), madder = T('madder'), umber = T('rawUmber'), verm = T('vermilion');
  const pearl = [lerp(lead[0], naples[0], .18), lerp(lead[1], naples[1], .18), lerp(lead[2], naples[2], .22)];
  const warmT = [lerp(naples[0], ochre[0], .35), lerp(naples[1], ochre[1], .35), lerp(naples[2], ochre[2], .35)];
  const pink = [lerp(madder[0], lead[0], .42), lerp(madder[1], lead[1], .3), lerp(madder[2], lead[2], .32)];
  const out = [], h = (a, b) => hash3(a, b, seed);
  const clip = o.clip || null;
  const col = (c, b) => [clamp(c[0] * b), clamp(c[1] * b), clamp(c[2] * b)];
  // a polar path -> stroke(s), split where clipped; w in px; b brightness (0..1.3)
  const polar = (path, n, w, b, cA, cB, thick, sd, taper = .8) => {
    let cur = [];
    const flush = () => {
      if (cur.length >= 2) out.push({ pts: cur, r: w, c0: col(cA, b), c1: col(cB, b * .55), a: clamp(.55 + .45 * b) * Math.min(1, k * 1.4), thick, seed: sd, key: sd, layer: 7, taper, maxSeg: 28 });
      cur = [];
    };
    for (let q = 0; q <= n; q++) {
      const [r, phi] = path(q / n), x = cx + Math.cos(phi) * r, y = cy + Math.sin(phi) * r;
      if (clip && !clip(x, y)) { flush(); continue; }
      cur.push([x, y]);
    }
    flush();
  };
  const rip = (j, r, amp) => amp * Math.sin(r / R * 7 + t * (1.6 + .8 * h(j, 71)) + h(j, 72) * TAU) * (r / R - 1);
  // 1. iris fibres: dense fine radial strokes hugging the limb, waving
  const nF = Math.round((260 + 1500 * iris) * Math.min(2.2, R / 60) * sc);
  for (let j = 0; j < nF; j++) {
    const phi0 = h(j, 1) * TAU, len = R * (.12 + (.5 + .9 * iris) * Math.pow(h(j, 2), 1.7)), r0 = R * (1.0 + .012 * h(j, 3));
    const amp = (.04 + .1 * iris) * (h(j, 4) - .5);
    const b = (.55 + .6 * h(j, 5)) * Math.pow(Math.min(1, R * .6 / len), .25) * k;
    const crypt = iris > 0 && Math.sin(phi0 * 23 + 2 * Math.sin(phi0 * 5)) > .55 ? .45 : 1;   // darker crypts between bundles
    polar(q => { const r = r0 + len * q; return [r, phi0 + rip(j, r, amp) + .04 * Math.sin(q * 3 + h(j, 6) * 6)]; }, 6,
      Math.max(.7, R * (.006 + .01 * h(j, 7)) * (1 + iris)), b * crypt, pearl, warmT, .5, h(j, 8), .9);
  }
  // 2. helmet streamers: bulbous bases of curved strokes, then long open strokes converging slowly and fraying
  const streamers = o.streamers || [[.12, 3.0, .5, 1], [3.02, 2.5, .42, .85], [3.8, 1.5, .26, .55], [-.8, 1.9, .3, .6], [1.85, 1.2, .22, .45]];
  streamers.forEach(([da, len, ws, bs], si) => {
    const ph = tilt + da;
    for (let m = 0; m < Math.round(26 * sc * Math.min(2, R / 50)); m++) {
      const u = (m + .5) / 26 * 2 - 1, phi0 = ph + u * ws * 1.1 + .05 * ws * (h(si * 50 + m, 5) - .5), q0 = Math.abs(u);
      const rEnd = R * (1 + len * (.35 + .65 * Math.pow(h(si * 50 + m, 6), .7))), r0 = R * (1.01 + .25 * Math.max(0, 1 - q0 * q0));
      const b = bs * (.6 + .5 * h(si * 50 + m, 7)) * k;
      polar(q => { const r = lerp(r0, rEnd, Math.pow(q, 1.15)); return [r, ph + (phi0 - ph) * (.35 + .65 * Math.pow(R / r, 1.2)) + rip(si * 50 + m, r, .03)]; }, 14,
        Math.max(.9, R * (.012 + .012 * h(si * 50 + m, 8))), b, pearl, warmT, .45, h(si * 50 + m, 9), .85);
    }
  });
  // 3. polar plumes: fine near-straight brush lines at both poles
  for (const pole of [tilt - Math.PI / 2, tilt + Math.PI / 2]) for (let m = 0; m < Math.round(18 * sc); m++) {
    const phi0 = pole + (m / 17 - .5) * 1.0, rEnd = R * (1.25 + .6 * h(m, pole > tilt ? 11 : 12));
    polar(q => { const r = lerp(R * 1.02, rEnd, q); return [r, phi0 + (phi0 - pole) * .4 * (r - R) / R]; }, 6, Math.max(.7, R * .008), .55 * (.5 + .7 * h(m, 13)) * k, pearl, pearl, .4, h(m, 14), .9);
  }
  // 4. the limb: a ring of short tangential strokes, bright
  const nL = Math.round(90 * Math.min(3, R / 40));
  for (let j = 0; j < nL; j++) {
    const a0 = (j + h(j, 21)) / nL * TAU, span = TAU / nL * (1.4 + h(j, 22));
    polar(q => [R * (1.012 + .006 * h(j, 23)), a0 + span * q], 3, Math.max(.8, R * .016), 1.15 * k, lead, pearl, .7, h(j, 24), .4);
  }
  // 5. prominences: small madder-pink tongues on the limb
  const proms = o.prominences || [[1.15, .07, .11], [2.25, .05, .07], [-2.45, .085, .13]];
  proms.forEach(([da, dw, hh], pi) => {
    for (let j = 0; j < 3; j++) {
      const dl = dw * (.5 + .2 * j), ht = R * hh * (.7 + .15 * j);
      polar(q => [R * 1.0 + ht * Math.sin(Math.PI * q), tilt + da - dl + 2 * dl * q], 6, Math.max(.8, R * .012), 1.0 * Math.min(1, k * 1.5), pink, [verm[0], verm[1] * .8, verm[2] * .8], .5, h(pi, 31 + j), .5);
    }
  });
  // 6. the darker limbal ring of the iris (S01): a broken ring of umber strokes at the fibres' outer edge
  if (iris > .3) for (let j = 0; j < 160; j++) {
    const a0 = h(j, 41) * TAU, rr = R * (1.6 + .35 * iris + .12 * (h(j, 42) - .5));
    polar(q => [rr + R * .05 * Math.sin(q * 3), a0 + .12 * q], 3, Math.max(1, R * .03), .5 * iris, umber, umber, .3, h(j, 43), .6);
  }
  return out;
}
