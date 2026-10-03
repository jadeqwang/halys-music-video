// orbit/index.js: ORBIT (Drop 2 and the outro's camera moves), CORONA at cosmic scale, built on the line engine
// (../line/index.js: drawLines, coronaRing, staticMesh, dynLayer, proc). Nothing here edits the line engine: ORBIT adds
// procedural line sets (eras.js), the Earth (earth.js: wind-streamline clouds on a sphere + the one saturated blue,
// composited after the line raster), the Moon (moon.js), and small helpers shared by scenes/drop2.js.
//
// The colour rule (STYLE_BIBLE): pearl lines on navy-black with signal-orange rims, exactly as CORONA, and **the only
// saturated blue in the film is Earth**. Earth-blue lines use the engine's third colour slot (o = 2) with the palette's
// `red` set to EARTH_LINE (drawLines({ palette: BLUE_PALETTE })) in the shots that show Earth and no H-alpha red.
//
//   lockedRing(f, kick, opts)          the K-pop anchor: the corona ring locked at frame centre (S64-S71)
//   splitLine(L, keep) / clipLines     cut engine lines where a predicate fails (occlusion, windows, maps)
//   xform(lines, fn)                    move every vertex of engine lines (in place)
//   affineU(a, b, c, d, e, f)           uniforms that place a static mesh: x' = a x + c y + e, y' = b x + d y + f
//   vocalBreath(t)                      the wordless topline's envelope (0..1, smoothed): line motion breathes with it

import { coronaRing, ringU, proc, FL, audio } from '../line/index.js';
import { curve } from '../../time.js';
import { clamp, lerp, sstep } from '../../core.js';

export const ORBIT = { pearl: '#f3efe6', orange: '#f08a2a', bg: '#05070c', earth: '#2f7fd8', earthLine: '#3d8ae6' };
export const BLUE_PALETTE = { red: '#2a78e4' };       // o = 2 is Earth-blue in the Earth shots (no prominences there)

// ---------------------------------------------------------------- the locked ring (S64-S71)
// Same radius and corona as Drop 1's chop cycles (S41-S44, .105 H): the anchor returns. Exactly at (W/2, H/2).
export const ringR = H => .105 * H;
export const RING_CFG = { corona: { gain: 1.05 }, skyField: { gain: .17, sep0: .17, sep1: 1.2, locals: 5, rmax: 3.6 }, tilt: .42 };
export const RING_BARE = { corona: { gain: 1.05 }, tilt: .42 };                        // corona only (busy eras)
export function lockedRing(f, kick = 0, o = {}) {
  const W = f.W, H = f.H, cx = W / 2, cy = H / 2, s = H / 1080, R = ringR(H);
  const cfg = o.cfg || RING_CFG, key = o.key || (cfg === RING_BARE ? 'orbitRingBare' : 'orbitRing');
  const mesh = coronaRing(f, key, { refR: R, ...cfg });
  const Rk = R * (1 + .022 * kick);
  return {
    R, cx, cy, Rk,
    layer: { mesh, u: { ...ringU(cx, cy, Rk), uBright: o.bright ?? 1, uPush: [cx, cy, 18 * kick * s, 300 * s], ...(o.u || {}) } },
    disk: { x: cx, y: cy, r: Rk },
    type: { sun: { x: cx, y: cy, r: Rk }, field: { center: [cx, cy] } },
  };
}

// ---------------------------------------------------------------- line utilities
// keep(x, y, k) -> bool: the line is cut where it fails; arc length s is kept (travelling pulses do not jump)
export function splitLine(L, keep, minN = 2) {
  const out = [];
  if (!L || L.n < 2) return out;
  let a = -1;
  const flush = (i0, i1) => {
    const n = i1 - i0; if (n < minN) return;
    const sl = A => A ? A.slice(i0, i1) : A;
    const xy = L.xy.slice(i0 * 2, i1 * 2), s = sl(L.s);
    out.push({ ...L, xy, n, b: sl(L.b), w: sl(L.w), o: sl(L.o), d: sl(L.d), s, len: s ? s[n - 1] : L.len });
  };
  for (let k = 0; k < L.n; k++) {
    const ok = keep(L.xy[k * 2], L.xy[k * 2 + 1], k);
    if (ok && a < 0) a = k;
    if (!ok && a >= 0) { flush(a, k); a = -1; }
  }
  if (a >= 0) flush(a, L.n);
  return out;
}
export const clipLines = (lines, keep) => lines.flatMap(L => splitLine(L, keep));
export function xform(lines, fn) {
  const p = [0, 0];
  for (const L of lines) { if (!L) continue; for (let k = 0; k < L.n; k++) { fn(L.xy[k * 2], L.xy[k * 2 + 1], p, k, L); L.xy[k * 2] = p[0]; L.xy[k * 2 + 1] = p[1]; } }
  return lines;
}
// a line from point list + per-point attribute arrays (b, w, o optional numbers or arrays)
export function mkLine(pts, a = {}) {
  const n = pts.length; if (n < 2) return null;
  const xy = new Float32Array(n * 2), b = new Float32Array(n), w = new Float32Array(n), o = new Float32Array(n), d = new Float32Array(n), s = new Float32Array(n);
  let acc = a.s0 ?? 0;
  for (let k = 0; k < n; k++) {
    const P = pts[k]; xy[k * 2] = P[0]; xy[k * 2 + 1] = P[1];
    if (k) acc += Math.hypot(P[0] - pts[k - 1][0], P[1] - pts[k - 1][1]);
    s[k] = acc;
    b[k] = Array.isArray(a.b) || ArrayBuffer.isView(a.b) ? a.b[k] : P[2] ?? (a.b ?? 1);
    w[k] = Array.isArray(a.w) || ArrayBuffer.isView(a.w) ? a.w[k] : (a.w ?? 1);
    o[k] = Array.isArray(a.o) || ArrayBuffer.isView(a.o) ? a.o[k] : (a.o ?? 0);
    d[k] = a.d ?? .5;
  }
  return { xy, n, b, w, o, d, s, len: acc, dir: 1, phase: a.phase ?? 0, spd: a.spd ?? 1, flags: a.flags ?? 0, id: a.id ?? 0 };
}
// a point of light (FL.TIP splat)
export const dot = (x, y, b = 1, w = 2, o = 0, flags = FL.TIP) => proc.line([[x, y], [x + .5, y]], { b, w, o, flags });

// static-mesh placement: x' = a x + c y + e, y' = b x + d y + f (canvas setTransform order)
export const affineU = (a, b, c, d, e, f) => ({ uXf0: [a, c, e], uXf1: [b, d, f], uS: 1, uOff: [0, 0] });
// rotate by th about (px, py), scale k, then translate (tx, ty)
export function placeU(px, py, th = 0, k = 1, tx = 0, ty = 0) {
  const c = Math.cos(th) * k, s = Math.sin(th) * k;
  return affineU(c, s, -s, c, px + tx - (c * px - s * py), py + ty - (s * px + c * py));
}

// ---------------------------------------------------------------- music
// the wordless topline: the vocal envelope, smoothed over ~0.6 s (an average of samples, a pure function of t)
export function vocalBreath(t) {
  let a = 0, n = 0;
  for (let k = -6; k <= 6; k++) { a += curve('vocal', t + k * .05); n++; }
  return clamp(a / n);
}
// a slow travel phase that runs faster while the topline sings (integrated: never runs backwards)
export function breathPhase(t, t0, base = .25, gain = .5) {
  const dt = 1 / 30; let ph = 0;
  for (let x = t0; x < t; x += dt) ph += (base + gain * vocalBreath(Math.min(t, x + dt / 2))) * Math.min(dt, t - x);
  return ph;
}
export const kickAt = (t, tau = .12) => audio.kickEnv(t, tau);
export { clamp, lerp, sstep };
