// paint.js: the MARBLE world's brush settings and the paint wrapper (the engine itself is ../brush/, unchanged).
//
//   const st = stoneSource(f, src, {...});                       // stone.js: the designed marble reference
//   const look = await paintStone(f, st, { sun, corona, stars, planets, paint: {...overrides}, strokes, overStrokes });
//
// STONE_PAINT runs the engine's relighting as an identity (one pool over the whole frame, no crush, no rim, no warm
// shift: the stone reference is already lit), so the look is decided by stone.js and the brushes: long smooth
// strokes, little impasto, crisp silhouettes (the statue mask and the horizon are stroke walls), a quiet boil (time is
// frozen), a cool varnish. The exact things are drawn after the strokes: the black disk, its limb, Baily's beads and
// the diamond ring by the engine's sun pass; the stars, Saturn and Mars here.

import { paint, eclipse } from '../brush/index.js';
import { clamp, lerp, sstep, hash3 } from '../brush/util.js';
import { MARBLE_PAL, marbleBox } from './palette.js';
import { cutInStrokes } from './cutin.js';

export const STONE_PAINT = {
  palette: MARBLE_PAL,
  // identity relighting
  pool: [{ x: .5, y: .5, rx: 4, ry: 4, feather: .05, k: 1 }], poolMatte: 0, poolBlur: 0, poolLo: 0, poolHi: .5, poolFromLight: null,
  gammaIn: 1, liftIn: 1, contrastIn: 1, satIn: 1, satOut: 1, warmIn: 0, crushFloor: 0, crush: 0, darkVar: 0, glint: 0, envDim: 1,
  focusLift: 0, rim: 1e-4, fringe: 0, plateKeep: 0, eclipse: 0, metal: 0, liftDark: 0, aerial: null,
  // stone brushwork: long smooth strokes, little impasto, broken colour kept low
  brushes: [24, 13, 7.5, 4.2, 2.3], fg: [2.0, 1.5, 1.25, 1.1, 1.0], T: [0, .045, .05, .06, .07],
  minLen: [2, 2, 2, 2, 1], maxLen: [5, 7, 7, 6, 4], step: [1.05, 1.0, .95, .85, .8], fc: .5, maxTurn: .3,
  jitter: .6, boil: .07, boilColor: .08, colorJit: .026, endBlend: .25, focusGain: .7, darkRaise: 1, midGate: .15, fineGate: .2,
  thinDark: .05, thick: .22, thickHi: .3, impasto: .22, spec: .12, weave: .8, crack: .1, varnish: .5, vignette: .38,
  accents: 0, eyeStrokes: 0, faceMin: null, underAlpha: .95, underTone: .95, bristle: .8, smoothRef: 0,
};

// ---------------------------------------------------------------- sky points
// stars: hashed in a sky space (u, v in 0..1 of the plate/canvas, mapped by toScreen), brightest few, many faint
export function starList(seed = 3, n = 150) {
  const out = [];
  for (let j = 0; j < n; j++) {
    const u = hash3(j, 1, seed), v = hash3(j, 2, seed), m = Math.pow(hash3(j, 3, seed), 5.5);
    out.push({ u, v, k: .18 + .82 * m, warm: hash3(j, 4, seed) });
  }
  return out;
}
// draw exact points onto f.g; P = [{x, y (px), r (px), k, col: [r,g,b] 0..255, halo}] ; sky mask in analysis px
export function drawPoints(f, P, sky, aw, ah) {
  const g = f.g, u = f.L ? f.L.u : f.H / 1080;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const p of P) {
    if (p.x < -10 || p.y < -10 || p.x > f.W + 10 || p.y > f.H + 10) continue;
    if (sky) { const ax = clamp(Math.round(p.x / f.W * aw), 0, aw - 1), ay = clamp(Math.round(p.y / f.H * ah), 0, ah - 1); const s = sky[ay * aw + ax]; if (s < .5) continue; p.k *= sstep(.5, .9, s); }
    const r = Math.max(.5, p.r * u), c = p.col || [235, 236, 240], hr = r * (p.halo ?? 3.2);
    const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, hr);
    gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${clamp(p.k)})`);
    gr.addColorStop(clamp(r / hr), `rgba(${c[0]},${c[1]},${c[2]},${clamp(p.k * .55)})`);
    gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, hr, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
// the starfield for a shot: toScreen(u, v) -> [x, y] px; fades toward the horizon glow (hz px rows per analysis column)
export function starPoints(f, st, toScreen, o = {}) {
  const out = [];
  for (const s of starList(o.seed ?? 3, o.n ?? 150)) {
    const [x, y] = toScreen(s.u, s.v); if (x < 0 || y < 0 || x > f.W || y > f.H) continue;
    let k = s.k * (o.k ?? 1);
    if (st && st.hz) { const ax = clamp(Math.round(x / f.W * st.aw), 0, st.aw - 1), hzy = st.hz[ax] / st.ah * f.H; k *= sstep(.02 * f.H, .2 * f.H, hzy - y); }
    if (o.avoid) for (const a of o.avoid) k *= sstep(a.r, a.r * 1.8, Math.hypot(x - a.x, y - a.y));
    if (k < .03) continue;
    const w = s.warm;
    out.push({ x, y, r: .55 + 1.2 * s.k, k: k * .9, col: w > .8 ? [255, 226, 196] : w < .2 ? [214, 222, 240] : [236, 236, 238], halo: 2.6 });
  }
  return out;
}

// ---------------------------------------------------------------- the wrapper
// o.sun: {x, y, r (fraction of W), off = 0, dir, limb, beads, ring, ringAng, jupiter} (frame uv) -> engine sun pass
// o.corona: {k, iris, scale, tilt, t, streamers, prominences} painted fibres (marble pearl) clipped to the sky
// o.points: extra exact points (planets) [{x, y, r, k, col}] px ; o.stars: {toScreen, n, k, seed} ; o.paint: overrides
const DBG = new URLSearchParams(location.search).get('mdebug'), MVAR = new URLSearchParams(location.search).get('mvar');
// look-dev variants (URL mvar=name)
const MVARS = {
  fine: { T: [0, .03, .035, .04, .045], fineGate: 0, midGate: 0 },
  fine2: { T: [0, .03, .035, .04, .045], fineGate: 0, midGate: 0, maxLen: [5, 6, 5, 4, 3], brushes: [24, 13, 7, 3.6, 1.8] },
  short: { maxLen: [4, 5, 4, 3, 2], fineGate: .05 },
  nojit: { jitter: .3, colorJit: .015 },
};
// debug views (URL mdebug=ref|mask|sky|depth): the stone reference itself, the statue (R) / sky (B) masks, depth
function debugStone(f, st, mode) {
  const { aw, ah } = st, id = new ImageData(aw, ah), d = id.data;
  for (let i = 0; i < aw * ah; i++) {
    let r, g, b;
    if (mode === 'mask') { r = st.M[i]; g = 0; b = st.S[i]; }
    else if (mode === 'depth') { r = g = b = st.D ? st.D[i] : 0; }
    else { r = st.R[i]; g = st.G[i]; b = st.B[i]; }
    d[i * 4] = r * 255; d[i * 4 + 1] = g * 255; d[i * 4 + 2] = b * 255; d[i * 4 + 3] = 255;
  }
  const c = new OffscreenCanvas(aw, ah); c.getContext('2d').putImageData(id, 0, 0);
  f.g.save(); f.g.setTransform(1, 0, 0, 1, 0, 0); f.g.drawImage(c, 0, 0, f.W, f.H); f.g.restore();
}
export async function paintStone(f, st, o = {}) {
  const pal = marbleBox(), W = f.W, H = f.H;
  if (DBG && st.M && DBG !== 'eref' && DBG !== 'canvas') { debugStone(f, st, DBG); return {}; }
  let sunSpec = null;
  if (o.sun) {
    const s = o.sun;
    sunSpec = { alt: 9, off: s.off ?? 0, dir: s.dir, moonVis: s.moonVis ?? 1, limb: s.limb ?? [1.25, 1.7, .5, -Math.PI * .66], beads: s.beads || false, beadSeed: s.beadSeed,
      ring: s.ring || 0, ringAng: s.ringAng, jupiter: s.jupiter || null, vis: s.vis ?? 1, blaze: s.blaze ?? 1.25, dark: s.dark || [.012, .013, .018], x: s.x, y: s.y, r: s.r };
  }
  const clipSky = st.sky ? (x, y) => { const ax = clamp(Math.round(x / W * st.aw), 0, st.aw - 1), ay = clamp(Math.round(y / H * st.ah), 0, st.ah - 1); return st.sky[ay * st.aw + ax] > .5; } : null;
  const extra = ctx => {
    const out = [];
    if (o.sun && o.corona && o.corona.k > 0) {
      const s = o.sun, off = s.off ?? 0, dir = s.dir || eclipse.MOON_DIR, sd = eclipse.sunDisk(s.x * W, s.y * H, s.r * W, off, dir);
      out.push(...eclipse.coronaStrokes({ cx: sd.mx, cy: sd.my, R: sd.mr, pal, t: o.corona.t ?? 0, clip: clipSky, ...o.corona }));
    }
    if (o.cutIn !== false && st.M) out.push(...cutInStrokes(ctx, st, o.cutIn || {}));
    if (o.strokes) out.push(...(typeof o.strokes === 'function' ? o.strokes({ ...ctx, pal }) : o.strokes));
    return out;
  };
  // the small brushes work the statues (their carving), the big ones the sky and the land
  let detailField = null;
  if (st.M && (o.statueDetail ?? .85) > 0) { const k = o.statueDetail ?? .85; detailField = new Float32Array(st.M.length); for (let i = 0; i < detailField.length; i++) detailField[i] = st.M[i] * k; }
  // open ground: horizontal flicks below the horizon (not the plate's pebble texture)
  let groundFlow = null;
  if (st.hz && o.groundFlow !== false) { let h = 1; for (let x = 0; x < st.aw; x++) h = Math.min(h, st.hz[x] / st.ah); if (h > .05 && h < .95) groundFlow = { y0: h, k: .85, angle: 0, cohLo: .5, cohHi: .9, ...(o.groundFlow || {}) }; }
  const look = await paint(f, st, { ...STONE_PAINT, detailField, groundFlow, ...(o.paint || {}), sun: sunSpec, strokes: extra, overStrokes: o.overStrokes || null, target: o.target,
    ...(DBG === 'eref' ? { debug: 'ref' } : DBG === 'canvas' ? { debugCanvas: 1 } : {}), ...(MVAR ? MVARS[MVAR] : {}) });
  if (DBG === 'eref' || DBG === 'canvas') return look;
  if (new URLSearchParams(location.search).has('mlog')) console.log('marble', f.shot && f.shot.id, JSON.stringify(look.perLayer), look.strokes, JSON.stringify(look.ms));
  // the exact sky points, over the finish
  if (!o.target) {
    const P = [];
    if (o.stars) P.push(...starPoints(f, st, o.stars.toScreen, o.stars));
    if (o.points) P.push(...o.points);
    if (P.length) drawPoints(f, P, st.sky, st.aw, st.ah);
  }
  // the type layer: cool light from above, the eclipse disk
  const T = f.type || (f.type = {});
  T.light = T.light || { dir: [-.3, -.95], elev: .65, color: '#e9ebf0', intensity: .95, cool: .7 };
  if (o.sun && !T.sun) T.sun = { x: o.sun.x * W, y: o.sun.y * H, r: o.sun.r * W * eclipse.K };
  return look;
}

// planets around a sun at (sx, sy) px with ppd px per degree (RESEARCH 1.6: Jupiter 11 deg above / 5.5 left, Mars
// 22.6 above / 9.4 left, Saturn high in the south-west, brought into frame at (-26, +34) deg; Pollux and Castor 19 deg
// above the dead sun). Returns exact points (Jupiter is drawn by the engine's sun pass when `jupiterInPass`).
export function planetPoints(sx, sy, ppd, o = {}) {
  const P = [], u = o.u ?? 1;
  const at = (dx, dy) => [sx + dx * ppd, sy - dy * ppd];
  if (!o.jupiterInPass) { const [x, y] = at(-5.5, 11); P.push({ x, y, r: 2.4 * (o.size ?? 1), k: 1, col: [255, 250, 238], halo: 3.6, name: 'jupiter' }); }
  { const [x, y] = at(-9.4, 22.6); P.push({ x, y, r: 1.35 * (o.size ?? 1), k: .8, col: [255, 196, 160], halo: 3, name: 'mars' }); }
  { const [x, y] = at(o.saturn ? o.saturn[0] : -26, o.saturn ? o.saturn[1] : 34); P.push({ x, y, r: 1.6 * (o.size ?? 1), k: .85, col: [255, 238, 205], halo: 3, name: 'saturn' }); }
  if (o.twins !== false) { let [x, y] = at(0, 19); P.push({ x, y, r: 1.25, k: .72, col: [255, 236, 214], halo: 2.6, name: 'pollux' }); [x, y] = at(2.2, 17.6); P.push({ x, y, r: 1.0, k: .55, col: [236, 238, 246], halo: 2.4, name: 'castor' }); }
  return P;
}
