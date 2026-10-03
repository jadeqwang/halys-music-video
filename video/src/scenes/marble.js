// marble.js: MARBLE, S45 (second half) - S57 (153.83-199.98 s): the breakdown, verse 2, the shadow, Thales, the spark.
// Owner: the marble/gold agent. Built on the brush engine (video/src/worlds/brush/, unchanged) through the marble world
// helpers in video/src/worlds/marble/ (stone.js: plates become statuary; paint.js: the stone brushwork; birds.js,
// anatolia.js, diagrams.js: the procedural pieces; gold.js: the GOLD side of the spark).
//
// The world: the battle frozen as painted statuary at mid-totality (de Chirico's stillness, not a 3D render). A cool
// soft key from above (the corona), a warm orange rim from the 360-degree horizon glow, a desaturated navy-black sky
// with stars, Jupiter, Saturn and Mars. Drawn at 30 fps with a quiet boil (time is frozen; the camera drifts).
//
// Timing (SHOTLIST v1): S45 153.83 (the line engine's widen; stone fills the forms from 155.75) | S45b 157.03 cut closer
// on the boom | S46 160.70 drift | S47 164.13 the face | S48 167.55 the flock | S49 170.73 tilt up, the plinth | S50
// 174.39 the board | S51 178.66 wind | S52 181.23 Thales walks | S53 183.34 the diagrams | S54 187.65 the glance |
// S55 188.51 statues gaze up | S56 193.16 Baily's beads | S57 194.86 SPARK (marble warms into gold behind a front).

import { scene, shot, shotOverride } from '../registry.js';
import { resolvePlate, hasPlate, eclipse, getPalette } from '../worlds/brush/index.js';
import { clamp as uclamp, lerp as ulerp, rgb2lab, lab2rgb, blurFast, vnoise, hash3 } from '../worlds/brush/util.js';
import { stoneSource, asStone } from '../worlds/marble/stone.js';
import { paintStone, planetPoints, STONE_PAINT } from '../worlds/marble/paint.js';
import { flockSource } from '../worlds/marble/birds.js';
import { mapSource, armyPawns, toBoard, BATTLE, boardToScreen } from '../worlds/marble/anatolia.js';
import { gildLines } from '../worlds/marble/diagrams.js';
import { setFont } from '../fonts.js';
import { goldReference, goldSun, goldOff, SPARK_PAL, EGRESS_DIR, C3 } from '../worlds/marble/gold.js';
import { drawCrystallise, widenAt } from './drop1.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => k * k * (3 - 2 * k);
const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a)));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const easeInOut = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const kfl = (t, keys) => { if (t <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return va + (vb - va) * (t - a) / (b - a); } return keys[keys.length - 1][1]; };

// plate time 0 = the song time each plate was generated against (production/PLATES.md)
const T0 = { P14: 65.67, P19: 93.0, P20: 100.24, P25: 153.83, P26: 178.66, P27: 181.23, P28: 184.64, P29: 194.86 };
async function plate(f, id, cam, o = {}) {
  const standin = { id: o.standin || 'a_duel', cam };
  return resolvePlate(f, id, standin, cam, o.keys ? { keys: o.keys, ...(o.extra || {}) } : { at: o.at ?? T0[id], ...(o.extra || {}) });
}
// a synthetic camera's map from source uv to screen px (for stars, planets and the sun drawn in plate space)
// the visible source rect of a camera (camXform's convention: the source covers the frame) and source uv -> screen px
const camRect = (f, c, so = 16 / 9) => { const oo = f.W / f.H; let hU = 1 / c.zoom, wU = oo / so / c.zoom; if (wU > 1 / c.zoom) { wU = 1 / c.zoom; hU = so / oo / c.zoom; } return { wU, hU }; };
const camScreen = (f, c, so) => { const { wU, hU } = camRect(f, c, so); return (u, v) => [((u - c.cx) / wU + .5) * f.W, ((v - c.cy) / hU + .5) * f.H]; };
const frozen = (f, t) => ({ ...f, t, k: f.k });       // a frame context that reads the plate at a held time

// the sun in the marble world: mid-totality (centred moon), the limb's thin bright ring, pink near the C3 contact
function totalSun(x, y, r, o = {}) {
  return { x, y, r, off: o.off ?? 0, dir: o.dir || EGRESS_DIR, moonVis: 1, limb: o.limb || [1.25, 1.6, .55, Math.PI / 3], beads: o.beads || false,
    ring: o.ring || 0, ringAng: o.ringAng, jupiter: o.jupiter || null };
}
const coronaFor = (t, o = {}) => ({ k: o.k ?? .9, iris: o.iris ?? .25, scale: o.scale ?? .95, tilt: o.tilt ?? -.35, t: (o.t ?? t) * .3, ...o });

// ================================================================ S45: crystallise (153.83-157.03 at 60 fps), then stone
// The line engine (drop1.js drawCrystallise) slows and widens its lines into long white strokes; from 155.75 the stone
// fills the forms under them (the same plate, the same framing), so at the boom the battle is statuary. 157.03: cut
// closer, the marble world takes over (S45b, 30 fps).
shotOverride('S45', { t1: 157.03 });
shot({ id: 'S45b', t0: 157.03, t1: 160.70, world: 'marble', cadence: 30, scene: 'S45b', parent: 'S45', params: { label: 'S45 marble: cut closer on the boom' } });
const _fill = { key: null, c: null };
scene('S45', async f => {
  await drawCrystallise(f, { widen: widenAt(f.t), t: f.t });
  const k = sstep(155.75, 157.0, f.t);
  if (k <= 0) return;
  // the stone layer at 30 drawings a second (cached between the two master frames of a drawing)
  const tq = Math.floor(f.t * 30 + 1e-6) / 30, key = `${tq.toFixed(4)}|${f.W}x${f.H}`;
  if (_fill.key !== key) {
    const L = f.layer(6), ff = { ...f, t: tq, g: L.g, type: {} };
    const cam = { cx: .5, cy: .5, zoom: 1 };
    const src = await plate(ff, 'P25', cam, { keys: [[153.83, 0], [157.03, 3.2]] });
    const st = stoneSource(ff, src, { sky: { dLo: .02, dHi: .07, below: .7, run: 3 }, water: { k: .6 } });
    await paintStone(ff, st, { target: L.g, paint: { drawIdx: Math.round(tq * 30) } });
    if (!_fill.c || _fill.c.width !== f.W || _fill.c.height !== f.H) { _fill.c = new OffscreenCanvas(f.W, f.H); }
    const g2 = _fill.c.getContext('2d'); g2.setTransform(1, 0, 0, 1, 0, 0); g2.globalCompositeOperation = 'copy'; g2.drawImage(L.c, 0, 0); _fill.key = key;
  }
  const g = f.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  // the stone rises under the white strokes: lighten (the strokes stay, the dark between them fills with stone)
  g.globalCompositeOperation = 'lighten'; g.globalAlpha = k; g.drawImage(_fill.c, 0, 0);
  // and in the last moments it settles over them (the strokes become its veins)
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = .55 * sstep(156.5, 157.02, f.t); g.drawImage(_fill.c, 0, 0);
  g.restore();
});

// ---------------------------------------------------------------- S45b: cut closer on the 157.03 boom
scene('S45b', async f => {
  const k = seg(f.t, 157.03, 160.70);
  const cam = { cx: .54, cy: .47, zoom: 1.42 + .08 * smooth(k) };
  const src = await plate(f, 'P25', cam, { keys: [[157.03, 3.2], [160.70, 4.25]] });
  const st = stoneSource(f, src, { sky: { dLo: .02, dHi: .07, below: .75, run: 3 }, water: { k: .6 } });
  await paintStone(f, st, { stars: { toScreen: camScreen(f, cam), n: 170, k: .8 }, arrows: true });
});

// ================================================================ S46: the drift through the frozen battle
// statues mid-strike, arrows hanging, river spray frozen like glass beads
scene('S46', async f => {
  const k = seg(f.t, 160.70, 164.13);
  const cam = { cx: .49 + .03 * k, cy: .5, zoom: 1.08 };
  const src = await plate(f, 'P25', cam, { keys: [[160.70, .35], [164.13, 2.6]] });
  const st = stoneSource(f, src, { sky: { dLo: .02, dHi: .07, below: .72, run: 3 }, water: { k: .7 } });
  await paintStone(f, st, { stars: { toScreen: camScreen(f, cam), n: 170, k: .8 }, arrows: true, overStrokes: ctx => glassBeads(f, st, ctx, { seed: 46 }) });
});

// frozen spray: glass beads hanging in the air where the feet strike the ground, strung on little frozen arcs (the
// feet are found per drawing: the lowest points of the statue mask; each splash is seeded from the material cell under
// its foot, so it stays put as the camera drifts). Each bead: a pale glassy body catching the corona, a hot highlight
// up and to the left, a thin dark refraction on its lower right, a warm speck of the horizon glow at its foot.
function glassBeads(f, st, ctx, o = {}) {
  const { aw, ah } = st, S = ctx.S, out = [], mx = st.mat && st.mat.mx, my = st.mat && st.mat.my;
  if (!mx) return out;
  const seed = o.seed ?? 7, u = f.H / 1080, low = new Int32Array(aw).fill(-1);
  for (let x = 0; x < aw; x++) for (let y = ah - 2; y > ah * .5; y--) if (st.M[y * aw + x] > .5) { low[x] = y; break; }
  const feet = [], win = Math.round(aw * .02);
  for (let x = win; x < aw - win; x++) {
    const y = low[x]; if (y < ah * .62) continue;
    let ok = true; for (let d = -win; d <= win && ok; d++) if (low[x + d] > y) ok = false;
    if (ok && !feet.some(p => Math.abs(p.x - x) < aw * .06)) feet.push({ x, y });
  }
  feet.sort((a, b) => b.y - a.y);
  for (const p of feet.slice(0, o.n ?? 5)) {
    const i = p.y * aw + p.x, cx = Math.floor(mx[i] / (S * 30)), cy = Math.floor(my[i] / (S * 30));
    const nArc = 3, side = hash3(cx, cy, seed + 2) < .5 ? -1 : 1;
    for (let a = 0; a < nArc; a++) {
      const ang = -Math.PI / 2 + side * (.25 + .45 * a) + (hash3(cx, cy, seed + 3 + a) - .5) * .3, reach = (34 + 46 * hash3(cx, cy, seed + 7 + a)) * u;
      const nb = 4 + (hash3(cx, cy, seed + 11 + a) * 3 | 0);
      for (let k = 1; k <= nb; k++) {
        const q = k / (nb + 1), hk = hash3(cx * 7 + a, cy * 13 + k, seed + 19);
        const px = p.x * S + Math.cos(ang) * reach * q * 1.6, py = p.y * S + Math.sin(ang) * reach * q * 1.4 + reach * 1.1 * q * q;   // a parabola
        const r = (3 + 4.5 * (1 - q) * (.6 + .8 * hk)) * u, kk = 9 + hk * .5;
        out.push({ pts: [[px - r * .1, py], [px + r * .1, py]], r: r * .98, c0: [.62, .66, .72], c1: [.76, .79, .84], a: .92, thick: .45, seed: hk, key: kk, layer: 12, taper: 0, maxSeg: 4 });
        out.push({ pts: [[px + r * .35, py + r * .4], [px + r * .5, py + r * .2]], r: r * .32, c0: [.12, .13, .16], c1: [.12, .13, .16], a: .7, thick: .3, seed: hk + .1, key: kk + .01, layer: 12, taper: .3, maxSeg: 3 });
        out.push({ pts: [[px - r * .1, py + r * .62], [px + r * .1, py + r * .62]], r: r * .22, c0: [1, .66, .36], c1: [1, .6, .3], a: .6, thick: .3, seed: hk + .2, key: kk + .02, layer: 12, taper: 0, maxSeg: 3 });
        out.push({ pts: [[px - r * .38, py - r * .36], [px - r * .24, py - r * .44]], r: r * .28, c0: [1, .99, .96], c1: [1, .98, .92], a: 1, thick: 1.2, seed: hk + .3, key: kk + .03, layer: 12, taper: .2, maxSeg: 3 });
      }
    }
  }
  return out;
}

// ================================================================ S47: a marble face looking up at the black sun
// P14 frozen while he looks up (plate 3.9 s), a slow push; blank carved eyes; the eclipse hangs upper right where his
// gaze goes; the far battlefield behind him becomes the totality sky.
scene('S47', async f => {
  const k = seg(f.t, 164.13, 167.55);
  const cam = { cx: .5, cy: .47, zoom: 1.06 + .07 * smooth(k) };
  const src = await plate(frozen(f, 165.0), 'P14', cam, { keys: [[0, 3.9], [999, 3.9]], standin: 'b_face' });
  const sun = { x: .8 - .015 * k, y: .17 + .01 * k, r: .028 };
  const st = stoneSource(f, src, {
    sky: { dLo: .12, dHi: .3, below: 1, run: 4 }, horizonY: 1.15, statue: { mode: 'all' },
    sun, relief: 1200, inflate: .35, inflateR: 30, detail: .5, plateShade: .9, key: [-.3, -.9, .45], rimI: .8,
  });
  await paintStone(f, st, { sun: totalSun(sun.x, sun.y, sun.r), corona: coronaFor(f.t, { k: .85, scale: .9 }), stars: { toScreen: camScreen(f, cam), n: 90, k: .7, avoid: [{ x: sun.x * f.W, y: sun.y * f.H, r: sun.r * f.W * 3 }] }, statueDetail: 1 });
});

// ================================================================ S48: a flock stopped mid-air against the corona
scene('S48', async f => {
  const k = seg(f.t, 167.55, 170.73), sun = { x: .38, y: .4, r: .042 };
  const src = flockSource(f, { k, seed: 11, n: 38, drift: [-.05, .015] });
  const st = stoneSource(f, src, { sky: false, horizonY: 1.25, statue: { mode: 'matte', matte: 1 }, sun, relief: 0, inflate: 1.1, inflateR: 12, inflateSigma: 1.0,
    plateShade: 0, detail: .8, detailSigma: 2.5, rimI: 1.0, key: [-.35, -.9, .4], veins: .6, veinPeriod: 120, groove: 0, fog: 0 });
  const toS = (u, v) => [(u - .04 * k) * f.W, (v + .01 * k) * f.H];
  await paintStone(f, st, { sun: totalSun(sun.x, sun.y, sun.r, { limb: [1.35, 1.7, .5, Math.PI / 3] }), corona: coronaFor(f.t, { k: 1, scale: 1.05, iris: .3 }),
    stars: { toScreen: toS, n: 140, k: .85, avoid: [{ x: sun.x * f.W, y: sun.y * f.H, r: sun.r * f.W * 3.2 }] }, statueDetail: 1, groundFlow: false });
});

// ================================================================ S49: tilt up from the statues to the sky; the plinth
// P25 held (plate 5.4); the camera tilts up (a held frame panned: a pure rotation has no parallax). In front a marble
// plinth carries the incised inscription (the type module cuts it: f.type.plinth, draw: false). The black sun rises into
// frame; then Jupiter, Mars and Saturn climb the ecliptic above it (positions after RESEARCH 1.6, compressed for the
// lens); Pollux and Castor stand over the dead sun.
const S49 = { plinth: { u0: .3, u1: .74, top: .705, face: .722 }, sun: [.63, .32], ppd: 8.5 };
scene('S49', async f => {
  const t = f.t, k = easeInOut(seg(t, 171.3, 174.39));
  const cam = { cx: .52, cy: .6 - .1 * k, zoom: 1.18 };       // (the tilt stops while the inscription is still whole)
  const src = await plate(frozen(f, 159.23), 'P25', cam, { keys: [[0, 5.4], [999, 5.4]] });
  const toS = camScreen(f, cam), [sx, sy] = toS(...S49.sun), sunUV = { x: sx / f.W, y: sy / f.H, r: .026 };
  // the plinth, drawn into the source: a marble block in the near foreground (statue mask: crisp edges, inflated)
  const P = S49.plinth, R49 = camRect(f, cam), plinthSrc = withPlinth(src, cam, P, R49);
  const st = stoneSource(f, plinthSrc, { sky: { dLo: .02, dHi: .07, below: .7, run: 3 }, water: { k: .5 }, sun: sunUV });
  paintPlinth(st, cam, P, R49);
  // the type: the plinth's front face, in frame fractions (centre x, top y, width, height), painted by us
  // (the inscription sits in the recessed panel)
  const Q = plinthPanel(P), [fx0, fy0] = toS(Q.u0, Q.v0), [fx1, fy1] = toS(Q.u1, Q.v1);
  f.type = f.type || {};
  f.type.plinth = { x: (fx0 + fx1) / 2 / f.W, y: fy0 / f.H, w: (fx1 - fx0) / f.W, h: (fy1 - fy0) / f.H, draw: false };
  const pts = planetPoints(sx, sy, S49.ppd * f.H / 1080, { jupiterInPass: false, saturn: [-21, 31] });
  await paintStone(f, st, { sun: totalSun(sunUV.x, sunUV.y, sunUV.r), corona: coronaFor(t, { k: .95 }), points: pts, arrows: true,
    stars: { toScreen: (u, v) => toS(u, v * 1.6 - .6), n: 230, k: .85, avoid: [{ x: sx, y: sy, r: sunUV.r * f.W * 3 }] } });
});
// the plinth's own light (designed, not re-lit as a statue): a classical inscribed base. A pale top face under the
// corona, a chipped bright arris, a cornice (fillet, shadowed groove, cyma), the front face falling from light to shadow
// toward the ground, a recessed panel for the inscription (its upper wall in shadow, its lower wall catching the light,
// a raised fillet around it), mottling and grey veins, weathering low down, darker vertical edges, the orange horizon
// glow catching its left edge
function plinthPanel(P) { return { u0: P.u0 + .05, u1: P.u1 - .05, v0: P.face + .04, v1: P.face + .18 }; }
function paintPlinth(st, cam, P, R) {
  const { aw, ah } = st, lab = [0, 0, 0], rgb = [0, 0, 0], Q = plinthPanel(P), bw = .0055;
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const u = (x / aw - .5) * R.wU + cam.cx, v = (y / ah - .5) * R.hU + cam.cy, i = y * aw + x;
    if (u < P.u0 || u > P.u1 || v < P.top) continue;
    const e = Math.min(u - P.u0, P.u1 - u), fu = (u - P.u0) / (P.u1 - P.u0);
    let L;
    if (v < P.face) L = .8 + .05 * (v - P.top) / (P.face - P.top);
    else {
      const dv = v - P.face;
      L = .6 - .26 * sstep(.02, .42, dv);
      if (dv < .004) L = .9;                                      // the arris catching the corona
      else if (dv < .01) L = .78;                                 // the fillet
      else if (dv < .018) L = .36 + 8 * (dv - .01);               // the groove under the cornice
      else if (dv < .03) L = lerp(.68, .58, (dv - .018) / .012);  // the cyma
      // the recessed panel: walls lit from above (the upper wall in shadow, the lower one in light), a raised fillet
      const inU = u > Q.u0 && u < Q.u1, inV = v > Q.v0 && v < Q.v1;
      const dO = Math.max(Q.u0 - u, u - Q.u1, Q.v0 - v, v - Q.v1);   // > 0 outside the panel
      if (dO > 0 && dO < .006) L = Math.max(L, .7 - 20 * Math.abs(dO - .003));
      if (inU && inV) {
        const dT = v - Q.v0, dB = Q.v1 - v, dL = u - Q.u0, dR = Q.u1 - u, m = Math.min(dT, dB, dL, dR);
        L = .5 - .06 * sstep(Q.v0, Q.v1, v);
        if (m < bw) L = m === dT ? .3 : m === dB ? .8 : m === dL ? .44 : .52;
      }
      L *= 1 - .12 * sstep(.24, .5, dv);                          // weathering toward the ground
    }
    L *= 1 + .07 * (vnoise(fu * 7, v * 9, 81) - .5) + .04 * (vnoise(fu * 26, v * 30, 83) - .5);   // mottling
    if (v >= P.face && v < P.face + .006 && hash3(Math.floor(fu * 90), 7, 49) < .18) L *= .72;     // chips in the arris
    L *= 1 - .3 * (1 - sstep(0, .012, e));                        // the vertical edges turning away
    const vein = Math.abs(Math.sin((fu * 2.6 + v * 1.4) * 9 + 2.2 * vnoise(fu * 4, v * 4, 77))), vk = (1 - sstep(0, .05, vein)) * sstep(.42, .58, vnoise(fu * 2.2, v * 2.2, 79));
    L *= 1 - .3 * vk;
    const glow = (1 - sstep(0, .06, u - P.u0)) * .35;            // the horizon glow on its left edge
    let r = L * .93 + glow * .5, g = L * .92 + glow * .22, b = L * .9 + glow * .05;
    rgb2lab(Math.min(1, r), Math.min(1, g), Math.min(1, b), lab); lab2rgb(lab[0], lab[1] - .004, lab[2] - .012, rgb);
    st.R[i] = rgb[0]; st.G[i] = rgb[1]; st.B[i] = rgb[2];
  }
}
// a plinth in plate space: overwrite the source's pixels (light marble base, near depth, matte) inside its outline
function withPlinth(src, cam, P, RC) {
  const { aw, ah } = src, N = aw * ah, R = Float32Array.from(src.R), G = Float32Array.from(src.G), B = Float32Array.from(src.B);
  const depth = src.depth ? Float32Array.from(src.depth) : new Float32Array(N).fill(.5), matte = src.matte ? Float32Array.from(src.matte) : new Float32Array(N);
  const sky = new Float32Array(N);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const u = (x / aw - .5) * RC.wU + cam.cx, v = (y / ah - .5) * RC.hU + cam.cy, i = y * aw + x;
    if (u < P.u0 || u > P.u1 || v < P.top) continue;
    const front = v >= P.face, e = Math.min(u - P.u0, P.u1 - u);
    // top face lighter (lit from above), the front a little darker, a carved moulding line under the top
    const base = front ? .62 - .25 * sstep(P.face, P.face + .5, v) - (Math.abs(v - P.face - .012) < .004 ? .2 : 0) : .86;
    const edgeDk = 1 - .18 * (1 - sstep(0, .02, e));
    R[i] = G[i] = B[i] = base * edgeDk; depth[i] = .97; matte[i] = 1; sky[i] = 0;
  }
  return { ...src, R, G, B, depth, matte, key: src.key + '|plinth' };
}

// ================================================================ S50: the strategy board (a shadow crossed the hills)
scene('S50', async f => {
  const t = f.t, k = seg(t, 174.39, 178.66);
  // the camera drifts over the board toward the bend; the umbra crosses from the WNW (sunset edge) to the ESE
  const [bu, bv] = toBoard(...BATTLE);
  let cam = { u: lerp(.5, bu, smooth(k)), v: lerp(.5, bv + .02, smooth(k)), dist: lerp(2.05, 1.2, smooth(k)), pitch: lerp(64, 56, smooth(k)), yaw: lerp(0, -5, k), fov: 38 };
  const MC = new URLSearchParams(location.search).get('mapcam'); if (MC) cam = { ...cam, ...JSON.parse(MC) };
  const p = seg(t, 174.7, 178.5), ang = 23 * Math.PI / 180;
  const along = lerp(-.62, .62, p);                      // board units along the track, 0 = over the armies
  const shadow = { u: bu + along * Math.cos(ang) / 1.91, v: bv + along * Math.sin(ang) - .004, a: .16, b: .055, ang };
  const src = mapSource(f, { cam, shadow });
  const st = asStone(f, src);
  const S = f.W / src.aw, pawns = armyPawns(f, cam, src.aw, src.ah);
  await paintStone(f, st, { statueDetail: .5, cutIn: false, groundFlow: false, paint: { brushes: [20, 11, 6.5, 3.6, 2.0], T: [0, .04, .045, .05, .06] },
    overStrokes: ({ pal }) => pawnStrokes(f, pawns, shadow, cam, src.aw, src.ah),
    stars: { toScreen: (u, v) => [u * f.W, v * f.H * .3], n: 60, k: .6 } });
});
const horizonOfBoard = cam => { const toS = boardToScreen(cam, 960, 540); const p = toS(.5, -.12); return p ? clamp(p[1] / 540, -.5, 1.5) : .1; };
// the pawns: stone cylinders with round heads, Lydians on the west bank, Medes on the east, darkening under the umbra
function pawnStrokes(f, pawns, shadow, cam, aw, ah) {
  const out = [], u = f.H / 1080;
  pawns.forEach((p, j) => {
    const h = Math.hypot(p.tx - p.x, p.ty - p.y), r = Math.max(1.2, h * .22);
    const lit = [.9, .88, .84], dk = [.42, .43, .46];
    out.push({ pts: [[p.x, p.y], [p.tx, p.ty]], r, c0: dk, c1: lit, a: .97, thick: .5, seed: hash3(j, 1, 50), key: 20 + j * 1e-3, layer: 12, taper: .1, maxSeg: 4 });
    out.push({ pts: [[p.tx - r * .2, p.ty - r * .3], [p.tx + r * .2, p.ty - r * .3]], r: r * 1.05, c0: lit, c1: lit, a: .98, thick: .6, seed: hash3(j, 2, 50), key: 20.5 + j * 1e-3, layer: 12, taper: 0, maxSeg: 4 });
  });
  return out;
}

// ================================================================ S51: the wind moves banners and cloaks; bodies frozen
scene('S51', async f => {
  const k = seg(f.t, 178.66, 181.23);
  const cam = { cx: .5, cy: .5, zoom: 1.04 + .02 * k };
  const src = await plate(f, 'P26', cam);
  const st = stoneSource(f, src, { sky: { dLo: .02, dHi: .08, below: .62, run: 3 }, water: { k: .55 } });
  await paintStone(f, st, { stars: { toScreen: camScreen(f, cam), n: 150, k: .8 }, overStrokes: ctx => dustStrokes(f, ctx, f.t - 178.66) });
});
// dust lifting in the wind: pale specks streaming right and up, turbulent (positions are a pure function of time)
function dustStrokes(f, ctx, lt) {
  const out = [], u = f.H / 1080, W = f.W, H = f.H;
  for (let j = 0; j < 260; j++) {
    const h = q => hash3(j, q, 51), life = 1.6 + 1.6 * h(1), ph = (lt / life + h(2)) % 1, gen = Math.floor(lt / life + h(2));
    const x0 = (h(3) + gen * .37) % 1 * W * .9, y0 = H * (.62 + .36 * h(4));
    const x = x0 + ph * W * (.12 + .1 * h(5)) + Math.sin(ph * 6 + j) * 8 * u, y = y0 - ph * H * (.05 + .08 * h(6)) + Math.cos(ph * 5 + j) * 5 * u;
    const a = Math.sin(Math.PI * ph) * (.25 + .35 * h(7)), r = (1 + 2.2 * h(8)) * u, dx = (6 + 10 * h(9)) * u;
    out.push({ pts: [[x - dx, y + dx * .2], [x, y]], r, c0: [.72, .66, .58], c1: [.86, .8, .72], a, thick: .15, seed: h(10), key: 30 + h(11), layer: 12, taper: .7, maxSeg: 4 });
  }
  return out;
}

// ================================================================ S52-S54: Thales, the only living thing, in BRONZE
// One paint pass with a palette that holds both worlds: the statues are the stone reference, Thales (his matte: the
// middle figure of P27; the whole matte of P28, wax tablet and short gnomon included) is the plate re-lit as living
// paint and mapped into the BRONZE box (the saffron himation paints as yellow ochre and Naples over umber shadows).
// The redesigned Thales (2026-10-03): short curly hair with a fillet, trimmed beard, saffron himation with a dark
// border, a wax tablet and a short gnomon; no staff.
const BRONZE = () => getPalette('bronze');
function livingRef(st, src, TM, o = {}) {
  const { aw, ah } = src, N = aw * ah, box = BRONZE(), lab = [0, 0, 0], rgb = [0, 0, 0], m = [0, 0, 0];
  let q = .5; { const h = new Uint32Array(256); let n = 0; for (let i = 0; i < N; i += 2) if (TM[i] > .5) { h[Math.min(255, (.2126 * src.R[i] + .7152 * src.G[i] + .0722 * src.B[i]) * 255 | 0)]++; n++; } let a = 0; for (let b = 0; b < 256; b++) { a += h[b]; if (a >= n * .9) { q = (b + .5) / 255; break; } } }
  const gain = (o.target ?? .78) / Math.max(.06, q);
  // a warm key from the upper left across his figure (his own light: the colour of life among the stone)
  let bx0 = aw, bx1 = 0, by0 = ah, by1 = 0; for (let i = 0; i < N; i += 3) if (TM[i] > .5) { const x = i % aw, y = (i / aw) | 0; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  for (let i = 0; i < N; i++) {
    const tm = TM[i]; if (tm <= .002) continue;
    const x = i % aw, y = (i / aw) | 0, kx = (x - bx0) / Math.max(1, bx1 - bx0), ky = (y - by0) / Math.max(1, by1 - by0);
    const keyK = clamp(1.15 - .55 * kx - .45 * ky);
    rgb2lab(Math.min(1, src.R[i] * gain), Math.min(1, src.G[i] * gain), Math.min(1, src.B[i] * gain), lab);
    const L = clamp(Math.pow(clamp(lab[0]), .92) * lerp(.7, 1.08, keyK), .04, .95);
    // (chroma kept, the red pulled back: the saffron himation lands on yellow ochre and Naples, its folds in umber)
    const aC = lab[1] > .02 ? .02 + (lab[1] - .02) * (o.redK ?? .62) : lab[1] * 1.1;
    lab2rgb(L, aC + .004, lab[2] * 1.18 + .016, rgb);
    box.map(rgb[0], rgb[1], rgb[2], m);
    rgb2lab(m[0], m[1], m[2], lab); lab2rgb(lab[0], lab[1] - .004, lab[2] - .012, rgb);
    st.R[i] = lerp(st.R[i], rgb[0], tm); st.G[i] = lerp(st.G[i], rgb[1], tm); st.B[i] = lerp(st.B[i], rgb[2], tm);
  }
}
// connected component of the matte whose centroid is nearest x = cx (frame uv): P27's middle figure
function componentNear(M, aw, ah, cx, thr = .5) {
  const lab = new Int32Array(aw * ah).fill(-1), comps = [];
  for (let s = 0; s < aw * ah; s++) {
    if (lab[s] >= 0 || M[s] < thr) continue;
    const id = comps.length, stack = [s]; lab[s] = id; let n = 0, sx = 0;
    while (stack.length) { const i = stack.pop(); n++; sx += i % aw; const x = i % aw; for (const j of [i - 1, i + 1, i - aw, i + aw]) { if (j < 0 || j >= aw * ah || lab[j] >= 0 || M[j] < thr) continue; if ((j === i - 1 && x === 0) || (j === i + 1 && x === aw - 1)) continue; lab[j] = id; stack.push(j); } }
    comps.push({ n, cx: sx / n / aw });
  }
  let best = -1, bd = 1e9; comps.forEach((c, id) => { if (c.n < aw * ah * .004) return; const d = Math.abs(c.cx - cx); if (d < bd) { bd = d; best = id; } });
  const out = new Float32Array(aw * ah); if (best < 0) return out;
  for (let i = 0; i < aw * ah; i++) if (lab[i] === best) out[i] = 1;
  return blurFast(out, aw, ah, .8);
}
async function thalesFrame(f, o) {
  const src = await plate(f, o.plate, o.cam, { keys: o.keys });
  // P28's dark sky has a depth gradient the relief would carve into stone: the sky is everything above the silhouetted
  // crowd (its line sinks a little as the plate pushes in), never Thales
  if (o.skyLine != null) {
    const { aw, ah } = src, sk = new Float32Array(aw * ah), R0 = camRect(f, o.cam);
    for (let y = 0; y < ah; y++) { const V = (y / ah - .5) * R0.hU + o.cam.cy; const k = 1 - sstep(o.skyLine - .025, o.skyLine + .004, V);
      for (let x = 0; x < aw; x++) { const i = y * aw + x; sk[i] = k * (1 - (src.matte ? src.matte[i] : 0)); } }
    src.sky = sk; src.key += '|skyLine' + o.skyLine.toFixed(3);
    // the silhouetted crowd under that line becomes the marble statues behind him: dark against the horizon glow in a
    // band below the line (the glow between their heads stays sky-bright land), the dark mass below them stone too
    const crowd = new Float32Array(aw * ah);
    for (let y = 0; y < ah; y++) {
      const V = (y / ah - .5) * R0.hU + o.cam.cy; if (V < o.skyLine - .01 || V > o.skyLine + .2) continue;
      let mx = 0; for (let x = 0; x < aw; x++) { const i = y * aw + x, l = .2126 * src.R[i] + .7152 * src.G[i] + .0722 * src.B[i]; if (l > mx) mx = l; }
      const deep = sstep(o.skyLine + .07, o.skyLine + .12, V) * (1 - sstep(o.skyLine + .15, o.skyLine + .2, V));
      for (let x = 0; x < aw; x++) { const i = y * aw + x, l = .2126 * src.R[i] + .7152 * src.G[i] + .0722 * src.B[i];
        crowd[i] = Math.max(1 - sstep(mx * .38, mx * .62, l), deep) * (1 - sk[i]); }
    }
    o.stone = { ...(o.stone || {}), statueMask: (x, y, m) => Math.max(m, crowd[y * aw + x]) };
  }
  const st = stoneSource(f, src, { sky: o.sky, water: { k: .4 }, ...(o.stone || {}) });
  // his region
  let TM;
  if (o.plate === 'P27') TM = src.matte ? componentNear(src.matte, src.aw, src.ah, o.thalesX ?? .47) : new Float32Array(src.aw * src.ah);
  else { TM = new Float32Array(src.aw * src.ah); for (let i = 0; i < TM.length; i++) TM[i] = (src.matte ? src.matte[i] : 0) * (1 - st.S[i]); TM = blurFast(TM, src.aw, src.ah, .7); }
  livingRef(st, src, TM, o.living || {});
  const T = f.type || (f.type = {});
  T.light = { dir: [-.6, -.8], elev: .5, color: '#f3dcb0', intensity: 1.0, cool: .25 };
  return { st, TM, src };
}
// S52: Thales walks toward the lens between the Lydian and the Mede (P27 from 0.42 s, 1:1: before that his matte
// joins the warriors' spears); his name on 182.49
const S52_KEYS = [[181.23, .42], [183.34, 2.53]];
scene('S52', async f => {
  const k = seg(f.t, 181.23, 183.34), cam = { cx: .5, cy: .5, zoom: 1.03 + .02 * k };
  const { st } = await thalesFrame(f, { plate: 'P27', cam, keys: S52_KEYS, sky: { dLo: .02, dHi: .08, below: .55, run: 3 } });
  await paintStone(f, st, { stars: { toScreen: camScreen(f, cam), n: 140, k: .75 }, paint: { palette: SPARK_PAL } });
  f.type.light = { dir: [-.6, -.8], elev: .5, color: '#f3dcb0', intensity: 1.0, cool: .25 };
});
// S53: close; Thales's geometry blooms around him in gold (v2: what the sources credit him with); S54: the glance.
// P28: he studies the sky 0-2.2 (played slower, under the bloom), lowers his head with a blink 2.25-2.7 at plate speed,
// his eyes meet the lens on 187.65 (2.75), then 1:1 into the sly half-smile (~3.25)
const S53_KEYS = [[183.34, .05], [187.13, 2.23], [187.65, 2.75], [188.51, 3.61]];
async function s53(f, dim) {
  const k = seg(f.t, 183.34, 188.51), cam = { cx: .5, cy: .5, zoom: 1.04 + .03 * k };
  const tp = kfl(f.t, S53_KEYS), line = .405 + .011 * tp, hzF = (line - cam.cy) / camRect(f, cam).hU + .5;
  const { st, TM } = await thalesFrame(f, { plate: 'P28', cam, keys: S53_KEYS, skyLine: line, sky: { dLo: .02, dHi: .05, below: .55, run: 3 }, stone: { horizonY: hzF + .035 } });
  await paintStone(f, st, { stars: { toScreen: camScreen(f, cam), n: 120, k: .7 }, paint: { palette: SPARK_PAL }, statueDetail: .9 });
  // the geometry, behind him (his matte cuts it) and under the lyric (the type layer draws after the scene)
  const L = f.layer(7);
  thalesGeometry(L.g, f.W, f.H, f.t, { dim, scratch: f.layer(8) });
  cutMatte(L, TM, st.aw, st.ah, f);
  const g = f.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(L.c, 0, 0); g.restore();
}

// ---------------------------------------------------------------- S53 v2: Thales's geometry (REVISION_V2, decision #4)
// No forecast card. Gold incised construction in the existing gold-leaf style (diagrams.js gildLines), lettered in the
// Greek manner with one sequence across the page (Α ... Ξ), behind him and under the lyric:
//   * THE PAYOFF, upper right where v1's card was. Diogenes Laertius 1.24 (tr. Hicks): "according to some the first to
//     declare the size of the sun to be one seven hundred and twentieth part of the solar circle, and the size of the
//     moon to be the same fraction of the lunar circle." About Α (the eye) the compass draws the solar circle and the
//     nearer lunar circle, each ruled into 720 parts; on "sun" (184.51) the Sun's disk lights, exactly one part ΒΓ of its
//     circle; the Moon is one part ΔΕ of its own. The view pushes in on ΒΓ until both disks read; the Moon moves into
//     the two lines from Α through Β and Γ, its image (the dark disk it shows the eye on the Sun's circle, the same
//     size because it is the same fraction) slides over the Sun, and covers it exactly on "dark" (186.38). Label 1⁄720
//     on both arcs; nothing else.
//   * HIS THEOREM, upper left (v1's place and timing): the triangle in a semicircle ΖΗΘ, right angle at Θ (Pamphila in
//     D.L. 1.24-25).
//   * THE SHADOW STICK, lower right where v1's gear was: the pyramid's height ΚΛ and its shadow ΛΜ, the stick ΜΝ set
//     upright at the end of that shadow and its own shadow ΜΞ, the parallel rays ΚΜ and ΝΞ: two similar triangles
//     (Plutarch, Banquet of the Seven Sages 147A; Hieronymus in D.L. 1.27).
// v1's saros ring and its gear-into-code are gone: the ring read as "Thales used the saros" (RESEARCH §7: do not say)
// and the code computed this eclipse; nothing on screen may claim more than Herodotus 1.74 (he foretold the year).
const DIV = TAU / 720;                                   // one part of a circle in 720
const TG = {
  t0: 183.40, solar: [183.42, 184.16], lunar: [183.84, 184.46], sight: [184.20, 184.51], sun: 184.51, moon: 184.56,
  zoom: [184.72, 185.86], close: [185.30, 186.38], dark: 186.38, letters: 185.22, labelSun: 185.48, labelMoon: 185.80,
  theorem: 184.50, stick: 183.56,
};
// per aspect, in px (u = the short side / 1080). ratio: the full view about C0 (radius R0) pushes in until the Sun (at
// angle phi from Α) sits at S1 with the lunar arc `reach` px nearer Α (rm = lunar / solar radius); the Moon starts moonA
// off the Sun's line and stands moonD px (signed) off it when the push-in ends; it lives in a soft ellipse (mask).
function geoLayout(W, H) {
  const P = H > W * 1.02, u = (P ? W : H) / 1080;
  if (!P) return { P, u,
    ratio: { C0: [.8125 * W, .222 * H], R0: 186 * u, phi: 0, S1: [.915 * W, .222 * H], reach: 650 * u, rm: .86, moonA: -.62, moonD: 125 * u,
      mask: { x: .74 * W, y: .215 * H, rx: 560 * u, ry: 205 * u, soft: 120 * u }, letter: 31 * u, label: 34 * u },
    theorem: { x: .17 * W, y: .33 * H, R: .1 * H, letter: 27 * u },
    stick: { x: .785 * W, y: .89 * H, s: u, letter: 25 * u },
  };
  return { P, u,
    ratio: { C0: [.873 * W, .118 * H], R0: 104 * u, phi: -Math.PI / 2, S1: [.8 * W, .1 * H], reach: 325 * u, rm: .88, moonA: .55, moonD: -60 * u,
      mask: { x: .79 * W, y: .19 * H, rx: 290 * u, ry: 225 * u, soft: 90 * u }, letter: 29 * u, label: 32 * u },
    theorem: null, stick: null,                       // (no room beside his head in portrait: the payoff alone)
  };
}
// a stroked element in diagrams.js's format ({P, cum, L, w}: gildLines reveals it along its length)
function elem(pts, w, closed = false) {
  const P = closed ? [...pts, pts[0]] : pts; let L = 0; const cum = [0];
  for (let i = 1; i < P.length; i++) { L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); cum.push(L); }
  return { P, cum, L, w };
}
// many short gold strokes of one width in four batched passes (the same passes as gildLines: umber shadow, leaf,
// burnished edge, restrained glow)
function gildSegs(g, segs, w, u, alpha = 1) {
  if (!segs.length || alpha <= 0) return;
  const pass = (col, wk, dx, dy, comp, a, blur) => {
    g.save(); g.globalCompositeOperation = comp; g.globalAlpha = alpha * a; g.strokeStyle = col; g.lineCap = 'round';
    if (blur) { g.shadowColor = col; g.shadowBlur = blur * u; }
    g.lineWidth = Math.max(.6, w * wk * u); g.beginPath();
    for (const s of segs) { g.moveTo(s[0] + dx * u, s[1] + dy * u); g.lineTo(s[2] + dx * u, s[3] + dy * u); }
    g.stroke(); g.restore();
  };
  pass('rgba(38,22,8,0.55)', 1.5, 1.1, 1.6, 'source-over', 1, 0);
  pass('#b98a32', 1, 0, 0, 'source-over', 1, 0);
  pass('#f4dc96', .42, -.3, -.4, 'source-over', 1, 0);
  pass('rgba(255,196,110,0.5)', 2.6, 0, 0, 'lighter', .35, 6);
}
// incised gold lettering (as diagrams.js arcText): umber shadow, ochre body, pale highlight. role 'greek' = Cardo 700
function goldText(g, text, x, y, px, u, a = 1, o = {}) {
  if (a <= 0.01) return;
  g.save();
  if (o.role === 'greek') { g.font = `700 ${Math.round(px)}px "Cardo"`; g.letterSpacing = '0px'; } else setFont(g, 'carved', px);
  g.textAlign = o.align || 'center'; g.textBaseline = o.baseline || 'middle';
  g.globalAlpha = a; g.fillStyle = 'rgba(38,22,8,0.62)'; g.fillText(text, x + 1.1 * u, y + 1.5 * u);
  g.fillStyle = '#c99a3c'; g.fillText(text, x, y);
  g.globalAlpha = a * .55; g.fillStyle = '#fbe6a8'; g.fillText(text, x - .4 * u, y - .5 * u);
  g.restore();
}
// "1⁄720" as a true diagonal fraction (Cinzel has the fraction slash but no numerator / denominator figures): the
// numerator raised, the denominator on the baseline, both at 0.68 of the slash; centred on (x, y)
function goldFraction(g, x, y, px, u, a = 1) {
  if (a <= 0.01) return;
  const s = px * .68, cap = .7;
  g.save(); setFont(g, 'carved', s); const wn = g.measureText('1').width, wd = g.measureText('720').width;
  setFont(g, 'carved', px); const ws = g.measureText('⁄').width; g.restore();
  const tot = wn + ws * .55 + wd, x0 = x - tot / 2, base = y + cap * px / 2;
  goldText(g, '1', x0 + wn / 2, base - cap * px + cap * s, s, u, a, { baseline: 'alphabetic' });
  goldText(g, '⁄', x0 + wn + ws * .275, base, px, u, a, { baseline: 'alphabetic' });
  goldText(g, '720', x0 + wn + ws * .55 + wd / 2, base, s, u, a, { baseline: 'alphabetic' });
}
// the angular window of a circle (centre ox, oy, radius r) that can show inside the mask ellipse's bounding circle:
// null = none, [a, a + TAU] = all of it
function arcWindow(ox, oy, r, M) {
  const Rb = Math.max(M.rx, M.ry) + M.soft, dx = M.x - ox, dy = M.y - oy, d = Math.hypot(dx, dy);
  if (d < 1e-6) return r <= Rb ? [0, TAU] : null;
  const c = (d * d + r * r - Rb * Rb) / (2 * d * r);
  if (c >= 1) return null;
  const am = Math.atan2(dy, dx);
  if (c <= -1) return [am - Math.PI, am + Math.PI];
  const hw = Math.acos(c); return [am - hw, am + hw];
}
// wrap angle a into [lo, lo + TAU)
const wrapA = (a, lo) => a - TAU * Math.floor((a - lo) / TAU);

export function thalesGeometry(g, W, H, t, o = {}) {
  const lay = geoLayout(W, H), u = lay.u, dim = 1 - (o.dim ?? 0) * .35;
  if (t < TG.t0) return;
  // the payoff lives in its own soft-edged layer (the push-in sweeps its arcs out of the frame)
  const S = o.scratch || (() => { const c = new OffscreenCanvas(W, H); return { c, g: c.getContext('2d') }; })();
  ratioFigure(S.g, t, lay.ratio, u);
  const M = lay.ratio.mask;
  S.g.save(); S.g.globalCompositeOperation = 'destination-in';
  S.g.setTransform(M.rx + M.soft, 0, 0, M.ry + M.soft, M.x, M.y);
  const gr = S.g.createRadialGradient(0, 0, 0, 0, 0, 1);
  gr.addColorStop(0, '#fff'); gr.addColorStop(Math.min(M.rx / (M.rx + M.soft), M.ry / (M.ry + M.soft)), '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  S.g.fillStyle = gr; S.g.fillRect(-40, -40, 80, 80); S.g.restore();
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = dim; g.drawImage(S.c, 0, 0); g.restore();
  if (lay.theorem) theoremFigure(g, t, lay.theorem, u, dim);
  if (lay.stick) stickFigure(g, t, lay.stick, u, dim);
}

// the payoff: the solar and lunar circles in 720 parts, the push-in, totality on "dark"
function ratioFigure(g, t, R, u) {
  const k = easeInOut(seg(t, TG.zoom[0], TG.zoom[1]));
  const z1 = R.reach / (1 - R.rm), z = R.R0 * Math.pow(z1 / R.R0, k);
  const cphi = Math.cos(R.phi), sphi = Math.sin(R.phi);
  const sx = lerp(R.C0[0] + R.R0 * cphi, R.S1[0], k), sy = lerp(R.C0[1] + R.R0 * sphi, R.S1[1], k);
  const ox = sx - z * cphi, oy = sy - z * sphi;                                // Α on screen
  const at = (r, a) => [ox + z * r * Math.cos(a), oy + z * r * Math.sin(a)];
  const M = R.mask, rm = R.rm;
  // the Moon: moonA off the Sun's line in the full view, moonD px off it when the push-in ends, closing to 0 on "dark"
  const d0 = -R.R0 * rm * Math.sin(R.moonA);
  const dM = lerp(d0, R.moonD, k) * (1 - smooth(seg(t, TG.close[0], TG.dark)));
  const th = t < TG.zoom[0] ? R.phi + R.moonA : R.phi - Math.asin(clamp(dM / (z * rm), -1, 1));
  const lines = [];
  // the two circles, swept by the compass from the Sun's line (the solar one closes where the Sun will light)
  const circle = (r, kRev, w, a0) => {
    if (kRev <= 0) return;
    const win = arcWindow(ox, oy, z * r, M); if (!win) return;
    const aEnd = a0, aStart = a0 - kRev * TAU;                                  // swept toward decreasing angles
    // sample the revealed sweep [aStart, aEnd] where it falls inside the window
    const step = Math.max(DIV / 8, Math.min(.02, 5 / (z * r)));
    let run = [];
    for (let a = aStart; a <= aEnd + 1e-9; a += step) {
      const aw = wrapA(a, win[0]), inside = aw <= win[1];
      if (inside) run.push(at(r, a)); else if (run.length) { if (run.length > 1) lines.push([elem(run, w), 1]); run = []; }
    }
    if (run.length) run.push(at(r, aEnd));
    if (run.length > 1) lines.push([elem(run, w), 1]);
  };
  const kS = easeInOut(seg(t, TG.solar[0], TG.solar[1])), kL = easeInOut(seg(t, TG.lunar[0], TG.lunar[1]));
  circle(1, kS, 1.5, R.phi);
  circle(rm, kL, 1.3, R.phi);
  // the 720 parts: ticks (pointing away from Α) appear as the compass passes them; every 10th and 60th longer,
  // the two that bound the Sun's part longest
  const divPx = z * DIV, ticks = (r, kRev, dir, segs, segsMajor) => {
    if (kRev <= 0) return;
    const win = arcWindow(ox, oy, z * r, M); if (!win) return;
    const base = clamp(.42 * divPx * r, 3.2 * u, 15 * u);
    for (let m = 0; m < 720; m++) {
      const a = R.phi + (m - .5) * DIV, sm = (((.5 - m) * DIV) % TAU + TAU) % TAU / TAU;   // sweep fraction at this tick
      const vis = clamp((kRev - sm) / .04); if (vis <= 0) continue;
      if (wrapA(a, win[0]) > win[1]) continue;
      const lenK = m === 0 || m === 1 ? 2.6 : m % 60 === 0 ? 2.2 : m % 10 === 0 ? 1.55 : 1;   // (m 0, 1: the parts ΒΓ, ΔΕ)
      const len = base * lenK * vis, c = Math.cos(a), s = Math.sin(a), r0 = z * r, r1 = r0 + dir * len;
      (lenK > 1 ? segsMajor : segs).push([ox + r0 * c, oy + r0 * s, ox + r1 * c, oy + r1 * s]);
    }
  };
  const tS = [], tSM = [], tL = [], tLM = [];
  ticks(1, kS, 1, tS, tSM); ticks(rm, kL, 1, tL, tLM);
  // Α, the eye at the centre
  const A = [ox, oy], kA = sstep(TG.t0, TG.t0 + .2, t);
  // the Sun's line: the radii ΑΒ and ΑΓ (one line in the full view, a wedge once pushed in), ruled outward to the Sun
  const kSight = easeInOut(seg(t, TG.sight[0], TG.sight[1]));
  for (const e of [-.5, .5]) { const a = R.phi + e * DIV; lines.push([elem([A, at(1 + 2.8 * clamp(.42 * divPx, 3.2 * u, 15 * u) / z, a)], 1.05), kSight]); }
  // the Moon's lines from Α through its part ΔΕ, out to the Sun's circle (where they cut off the Moon's image)
  const kMoon = sstep(TG.moon, TG.moon + .25, t);
  if (kMoon > 0) for (const e of [-.5, .5]) { const a = th + e * DIV; lines.push([elem([A, at(1, a)], .75), easeInOut(seg(t, TG.moon, TG.moon + .4))]); }
  gildLines(g, lines, u);
  gildSegs(g, tS, .8, u); gildSegs(g, tSM, 1.15, u); gildSegs(g, tL, .7, u); gildSegs(g, tLM, 1.0, u);
  // the eye
  if (kA > 0) { g.save(); g.globalAlpha = kA; g.fillStyle = 'rgba(38,22,8,0.6)'; g.beginPath(); g.arc(A[0] + 1.1 * u, A[1] + 1.5 * u, 3.6 * u, 0, TAU); g.fill();
    g.fillStyle = '#d9b05a'; g.beginPath(); g.arc(A[0], A[1], 3.4 * u, 0, TAU); g.fill(); g.restore();
    goldText(g, 'Α', A[0] - 16 * u, A[1] + 18 * u, R.letter, u, kA, { role: 'greek' }); }
  // the disks: the Sun (one part of its circle), the Moon (one part of its own, lit on the side toward the Sun) and the
  // Moon's image on the Sun's circle (the disk the eye sees: the same size, because it is the same fraction)
  const rS = z * Math.sin(DIV / 2), rMo = z * rm * Math.sin(DIV / 2);
  const [sunX, sunY] = at(1, R.phi), [mX, mY] = at(rm, th), [iX, iY] = at(1, th);
  const kSun = sstep(TG.sun, TG.sun + .14, t), tot = t >= TG.dark - 1e-6;
  if (kSun > 0) sunDisk(g, sunX, sunY, Math.max(rS, 1.2 * u), u, kSun, tot);
  if (kMoon > 0) {
    moonDisk(g, mX, mY, Math.max(rMo, 1.4 * u), R.phi, u, kMoon);
    imageDisk(g, iX, iY, Math.max(rS, 1.6 * u), u, kMoon * sstep(1.2, 4, rS / u), tot);
  }
  // letters at the ends of the two parts (Β Γ on the Sun's circle, Δ Ε on the Moon's, all four on the lines from Α),
  // once the parts read; then 1⁄720 beside each disk, on the side away from the Moon's approach
  const kLet = sstep(TG.letters, TG.letters + .25, t) * sstep(9, 16, divPx / u);
  if (kLet > 0) {
    const off = (r, a, out) => at(r + out / z, a), px = R.letter;
    const nrm = [-Math.sin(R.phi), Math.cos(R.phi)], ax = [Math.cos(R.phi), Math.sin(R.phi)];   // + = increasing angle; outward
    const tickS = 2.6 * clamp(.42 * divPx, 3.2 * u, 15 * u), tickM = 2.6 * clamp(.42 * divPx * rm, 3.2 * u, 15 * u), gap = px * .62;
    const put = (ch, p, sgn, a) => goldText(g, ch, p[0] + sgn * nrm[0] * px * .42, p[1] + sgn * nrm[1] * px * .42, px, u, a, { role: 'greek' });
    put('Β', off(1, R.phi - .5 * DIV, tickS + gap), -1, kLet); put('Γ', off(1, R.phi + .5 * DIV, tickS + gap), 1, kLet);
    const kLetM = kLet * sstep(TG.letters + .3, TG.letters + .55, t);
    put('Δ', off(rm, R.phi - .5 * DIV, tickM + gap), -1, kLetM); put('Ε', off(rm, R.phi + .5 * DIV, tickM + gap), 1, kLetM);
    const side = Math.sign(R.moonD) || 1, lab = (x, y, r) => [x + side * nrm[0] * (r + px * 1.2) - ax[0] * px * .35, y + side * nrm[1] * (r + px * 1.2) - ax[1] * px * .35];
    const kLs = sstep(TG.labelSun, TG.labelSun + .3, t) * kLet, kLm = sstep(TG.labelMoon, TG.labelMoon + .3, t) * kLet;
    const [lx, ly] = lab(sunX, sunY, rS), [mxL, myL] = lab(...at(rm, R.phi), rMo);
    goldFraction(g, lx, ly, R.label, u, kLs);
    goldFraction(g, mxL, myL, R.label, u, kLm);
  }
}
// the Sun: a gilded disk with a soft glow; at totality only its limb shows round the Moon's image, with a corona glow
function sunDisk(g, x, y, r, u, a, tot) {
  g.save(); g.globalAlpha = a;
  g.fillStyle = 'rgba(38,22,8,0.55)'; g.beginPath(); g.arc(x + 1.1 * u, y + 1.6 * u, r, 0, TAU); g.fill();
  const gr = g.createRadialGradient(x - .35 * r, y - .4 * r, r * .08, x, y, r);
  gr.addColorStop(0, '#fff2c4'); gr.addColorStop(.55, '#e6b95e'); gr.addColorStop(1, '#a9782c');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.globalCompositeOperation = 'lighter';
  const R2 = r * (tot ? 2.6 : 2.0), gl = g.createRadialGradient(x, y, r * .9, x, y, R2);
  gl.addColorStop(0, `rgba(255,214,140,${tot ? .5 : .32})`); gl.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(x, y, R2, 0, TAU); g.fill();
  // while the disk is too small to read (the full view: one part is ~1.6 px), its light marks it like a star
  const star = 1 - sstep(4, 10, r / u);
  if (star > 0) {
    const Rs = 13 * u, gs = g.createRadialGradient(x, y, 0, x, y, Rs);
    gs.addColorStop(0, `rgba(255,246,214,${.95 * star})`); gs.addColorStop(.18, `rgba(255,222,150,${.55 * star})`); gs.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gs; g.beginPath(); g.arc(x, y, Rs, 0, TAU); g.fill();
  }
  g.restore();
}
// the Moon on its own circle: dark toward the eye, lit gold on the half toward the Sun (it is new)
function moonDisk(g, x, y, r, phi, u, a) {
  g.save(); g.globalAlpha = a;
  g.fillStyle = 'rgba(38,22,8,0.55)'; g.beginPath(); g.arc(x + 1.1 * u, y + 1.6 * u, r, 0, TAU); g.fill();
  g.fillStyle = '#0d1018'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.fillStyle = '#c99a3c'; g.beginPath(); g.arc(x, y, r, phi - Math.PI / 2, phi + Math.PI / 2); g.closePath(); g.fill();
  g.strokeStyle = '#f4dc96'; g.lineWidth = Math.max(.7, 1 * u); g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  g.restore();
}
// the Moon's image on the Sun's circle: a dark disk (it hides what is behind it), a fine gold rim
function imageDisk(g, x, y, r, u, a, tot) {
  if (a <= 0.01) return;
  g.save(); g.globalAlpha = a;
  g.fillStyle = '#080a10'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = tot ? '#fff1c8' : '#d8b062'; g.lineWidth = Math.max(.7, (tot ? 1.6 : .9) * u); g.stroke();
  g.restore();
}

// his theorem: the triangle in a semicircle (v1's figure and timing, now lettered): circle, diameter ΖΗ, Θ on the arc,
// the right angle at Θ
function theoremFigure(g, t, T, u, dim) {
  const t1 = TG.theorem; if (t < t1) return;
  const X = T.x, Y = T.y, R = T.R, ta = -.12, tb = 2.05, items = [];
  const circ = []; for (let i = 0; i <= 96; i++) { const a = -Math.PI / 2 + TAU * i / 96; circ.push([X + Math.cos(a) * R, Y + Math.sin(a) * R]); }
  items.push([elem(circ, 1.5), sstep(t1, t1 + .7, t)]);
  const Z = [X + Math.cos(Math.PI + ta) * R, Y + Math.sin(Math.PI + ta) * R], Hh = [X + Math.cos(ta) * R, Y + Math.sin(ta) * R], Th = [X + Math.cos(-tb) * R, Y + Math.sin(-tb) * R];
  items.push([elem([Z, Hh], 1.3), sstep(t1 + .5, t1 + .85, t)]);
  items.push([elem([Z, Th, Hh], 1.5), sstep(t1 + .75, t1 + 1.25, t)]);
  { const d1 = [Z[0] - Th[0], Z[1] - Th[1]], d2 = [Hh[0] - Th[0], Hh[1] - Th[1]], l1 = Math.hypot(...d1), l2 = Math.hypot(...d2), q = .16 * R;
    const p1 = [Th[0] + d1[0] / l1 * q, Th[1] + d1[1] / l1 * q], p2 = [Th[0] + d2[0] / l2 * q, Th[1] + d2[1] / l2 * q], p3 = [p1[0] + d2[0] / l2 * q, p1[1] + d2[1] / l2 * q];
    items.push([elem([p1, p3, p2], 1.1), sstep(t1 + 1.15, t1 + 1.4, t)]); }
  gildLines(g, items, u, { alpha: dim });
  const out = (p, k) => [X + (p[0] - X) * k, Y + (p[1] - Y) * k], px = T.letter;
  const kZH = sstep(t1 + .62, t1 + .85, t), kT = sstep(t1 + 1.0, t1 + 1.25, t);
  const z2 = out(Z, 1 + .55 * px / R), h2 = out(Hh, 1 + .55 * px / R), th2 = out(Th, 1 + .6 * px / R);
  goldText(g, 'Ζ', z2[0], z2[1], px, u, kZH * dim, { role: 'greek' });
  goldText(g, 'Η', h2[0], h2[1], px, u, kZH * dim, { role: 'greek' });
  goldText(g, 'Θ', th2[0], th2[1], px, u, kT * dim, { role: 'greek' });
}

// the shadow stick (Plutarch 147A): ground, the pyramid ΚΛ and its shadow to Μ, the stick ΜΝ at the shadow's end and its
// shadow to Ξ, the two parallel rays; drawn early, while the circles are ruled, then held
function stickFigure(g, t, T, u, dim) {
  const t1 = TG.stick; if (t < t1) return;
  const s = T.s, x0 = T.x, y0 = T.y, P = (x, y) => [x0 + x * s, y0 + y * s];
  const base = 68, h = 128, sh = 172, st = 52, ssh = st * sh / h;               // ΚΛ : ΛΜ = ΜΝ : ΜΞ
  const Lp = P(base + 6, 0), K = P(base + 6, -h), Mp = P(base + 6 + sh, 0), N = P(base + 6 + sh, -st), X = P(base + 6 + sh + ssh, 0);
  const items = [];
  items.push([elem([P(-4, 0), P(base + 6 + sh + ssh + 26, 0)], 1.3), sstep(t1, t1 + .4, t)]);                    // the ground
  items.push([elem([P(6, 0), K, P(2 * base + 6, 0)], 1.5), sstep(t1 + .2, t1 + .6, t)]);                          // the pyramid
  items.push([elem([K, Lp], .8), sstep(t1 + .5, t1 + .7, t)]);                                                    // its height
  items.push([elem([P(base + 6 - 40 * sh / h, -h - 40), Mp], 1.0), sstep(t1 + .55, t1 + .85, t)]);                // the ray over its apex
  items.push([elem([Mp, N], 1.6), sstep(t1 + .8, t1 + .95, t)]);                                                  // the stick
  items.push([elem([P(base + 6 + sh - 40 * ssh / st, -st - 40), X], 1.0), sstep(t1 + .9, t1 + 1.15, t)]);         // the ray over its top
  gildLines(g, items, u, { alpha: dim });
  const px = T.letter, kA = sstep(t1 + .55, t1 + .8, t), kB = sstep(t1 + .95, t1 + 1.2, t);
  goldText(g, 'Κ', K[0] - .62 * px, K[1] - .2 * px, px, u, kA * dim, { role: 'greek' });
  goldText(g, 'Λ', Lp[0], Lp[1] + .7 * px, px, u, kA * dim, { role: 'greek' });
  goldText(g, 'Μ', Mp[0], Mp[1] + .7 * px, px, u, kB * dim, { role: 'greek' });
  goldText(g, 'Ν', N[0] + .55 * px, N[1] - .45 * px, px, u, kB * dim, { role: 'greek' });
  goldText(g, 'Ξ', X[0], X[1] + .7 * px, px, u, kB * dim, { role: 'greek' });
}
function cutMatte(L, M, aw, ah, f) {
  const id = new ImageData(aw, ah), d = id.data;
  for (let i = 0; i < aw * ah; i++) { d[i * 4 + 3] = Math.round(clamp(M[i] * 1.3) * 255); }
  const c = new OffscreenCanvas(aw, ah); c.getContext('2d').putImageData(id, 0, 0);
  L.g.save(); L.g.setTransform(1, 0, 0, 1, 0, 0); L.g.globalCompositeOperation = 'destination-out'; L.g.imageSmoothingEnabled = true; L.g.drawImage(c, 0, 0, f.W, f.H); L.g.restore();
}
scene('S53', async f => { await s53(f, 0); });
scene('S54', async f => { await s53(f, sstep(187.65, 188.0, f.t)); });

// ================================================================ S55: every statue gazes up; the limb begins to bead
// P20 held after the unison look-up (plate 2.6), a slow push; the black sun over the gap between the ranks, its lower
// right limb (third contact, RESEARCH 5 #8) warming pink and starting to bead in the last second.
const C3off = t => (eclipse.K - 1) * Math.pow(sstep(189.5, 194.86, t), 1.6);
scene('S55', async f => {
  const t = f.t, k = seg(t, 188.51, 193.16);
  const cam = { cx: .5, cy: .48, zoom: 1.04 + .05 * smooth(k) };
  const src = await plate(frozen(f, 103.0), 'P20', cam, { keys: [[0, 2.6], [999, 2.6]], standin: 'c_armies' });
  const toS = camScreen(f, cam), [sx, sy] = toS(.5, .3), sun = { x: sx / f.W, y: sy / f.H, r: .034 * cam.zoom };
  const st = stoneSource(f, src, { sky: { dLo: .02, dHi: .07, below: .78, run: 3 }, horizonY: (.725 - cam.cy) / camRect(f, cam).hU + .5, water: { k: .6 }, sun, statue: { mode: 'relief', relief: [.02, .06] } });
  const off = C3off(t), pink = sstep(190, 193.2, t);
  await paintStone(f, st, { sun: totalSun(sun.x, sun.y, sun.r, { off, beads: off > .045, limb: [1.25 + .6 * pink, 1.7, .5 + .5 * pink, Math.PI / 3] }), corona: coronaFor(t, { k: .95, scale: 1 }),
    stars: { toScreen: toS, n: 160, k: .8, avoid: [{ x: sx, y: sy, r: sun.r * f.W * 3 }] }, points: planetPoints(sx, sy, 12 * f.H / 1080, { saturn: [-24, 30] }).filter(p => p.name === 'jupiter' || p.name === 'pollux' || p.name === 'castor') });
});

// ================================================================ S56: tight on the limb: Baily's beads
// The disk huge at upper left; its lower right limb crosses the frame; the beads string along it, brightening until
// the spark. The inner corona and three small prominences; nothing else.
scene('S56', async f => {
  const t = f.t, k = seg(t, 193.16, 194.86);
  const W = f.W, H = f.H, rS = .62 * H / W / eclipse.K;                   // moon radius 0.62 H
  const cx = .17 - .01 * k, cy = .02 - .01 * k;
  const off = lerp(.05, eclipse.K - 1 + .002, Math.pow(k, 1.3));
  const src = skySource(f, { sun: { x: cx, y: cy, r: rS } });
  const st = stoneSource(f, src, { sky: false, horizonY: 1.6, statue: { mode: 'matte', matte: 0 }, sun: { x: cx, y: cy, r: rS }, coronaGlow: .5, coronaFall: 9 });
  await paintStone(f, st, { sun: totalSun(cx, cy, rS, { off, beads: 1.2 + 1.5 * k, beadSeed: 9, limb: [1.6 + 1.2 * k, 3.2, 1, Math.PI / 3] }),
    corona: coronaFor(t, { k: .3, scale: .12, iris: 0, streamers: [], prominences: [[1.05 + .35, .03, .05], [.65 + .35, .022, .035], [1.65 + .35, .025, .042]], tilt: .35 }),
    stars: { toScreen: (u, v) => [u * W, v * H], n: 40, k: .5 }, groundFlow: false, cutIn: false, statueDetail: 0 });
  f.type.light = { dir: [.85, -.5], elev: .35, color: '#fff6e0', intensity: 1.05 };
});
// an empty totality sky as a Source (for the procedural sky shots)
function skySource(f, o = {}) {
  const aw = Math.round(f.W / 2), ah = Math.round(f.H / 2), N = aw * ah;
  const v = new Float32Array(N).fill(.05), sky = new Float32Array(N).fill(1);
  return { aw, ah, R: v, G: v, B: v, depth: new Float32Array(N), matte: new Float32Array(N), sky, faces: [], mat: null, key: `sky|${f.t.toFixed(4)}`, info: { kind: 'sky' } };
}

// ================================================================ S57: SPARK (marble warms into gold)
// 194.86: the diamond ring bursts on the lower right limb; its light ripples outward across the crowd of statues (P29)
// and, as it arrives, the marble palette warms into BRONZE/GOLD: one paint pass whose reference is the stone reference
// and the gold reference blended across an irregular radial front (the palette holds both worlds), so every stroke
// warms in place. A hot band rides the front; behind it the people of P29 come alive (the plate runs). 5 s, held vowel.
const SPARK = { sun: [.73, .2], r: .028, t0: C3 };
function frontRadius(t) { const s = Math.max(0, t - SPARK.t0); return s < 4.4 ? 1.62 * Math.pow(s / 4.4, .72) : 1.62 + .1 * (s - 4.4); }
scene('S57', async f => {
  const t = f.t, W = f.W, H = f.H;
  const cam = { cx: .5, cy: .32, zoom: 1.2 };
  const src = await plate(f, 'P29', cam, { keys: [[194.86, 0], [200.315, 5.85]], standin: 'c_armies' });
  const toS = camScreen(f, { cx: .5, cy: .5, zoom: 1 });
  const sunUV = { x: SPARK.sun[0], y: SPARK.sun[1], r: SPARK.r };
  // the stone world
  const st = stoneSource(f, src, { sky: { dLo: .03, dHi: .12, below: .62, run: 3 }, horizonY: .44, sun: sunUV, statue: { mode: 'relief', relief: [.02, .06] }, coronaGlow: .5 * (1 - sstep(194.9, 195.6, t)) });
  // the gold world (graded plate + a golden twilight sky brightening around the sun)
  const gref = goldReference(src, { target: .74, sat: 1.06, warm: .018, gamma: .95, local: .55, sky: st.S, skyCol: (u, v, out) => {
    const d = Math.hypot((u - sunUV.x) * W / H, v - sunUV.y), glow = Math.exp(-d / .32), hz = sstep(.15, .45, v);
    out[0] = .32 + .62 * glow + .25 * hz; out[1] = .2 + .5 * glow + .16 * hz; out[2] = .1 + .3 * glow + .06 * hz; return out; } });
  // the front: an irregular ring from the burst point; a hot band rides it
  const bx = sunUV.x + Math.cos(Math.PI / 3) * sunUV.r, by = sunUV.y + Math.sin(Math.PI / 3) * sunUV.r * W / H;
  // three zones behind the front: the light arrives (marble lit gold), then the stone turns to flesh and paint
  const R = frontRadius(t), aw = st.aw, ah = st.ah, env = sstep(194.86, 195.05, t) * (1 - sstep(198.8, 199.95, t));
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const i = y * aw + x, u = x / aw, v = y / ah, dx = (u - bx) * W / H, dy = v - by, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    // (the front's irregularity grows with it: a small front is round, a big one is torn)
    const wk = clamp(R / .45), wob = ((vnoise(Math.cos(a) * 2.4 + 5, Math.sin(a) * 2.4 + t * .25, 57) - .5) * .14 + (vnoise(u * 6, v * 6, 59) - .5) * .06) * wk;
    const e = R + wob - d, light = clamp(e / .16 + .35), flesh = clamp((e - .1) / .24), band = Math.exp(-Math.pow((e - .03) / .055, 2)) * env;
    let r = st.R[i], g = st.G[i], b = st.B[i];
    r = lerp(r, Math.min(1, r * 1.16 + .045), light); g = lerp(g, Math.min(1, g * 1.0 + .015), light); b = lerp(b, b * .74, light);
    r = lerp(r, gref.R[i], flesh); g = lerp(g, gref.G[i], flesh); b = lerp(b, gref.B[i], flesh);
    r = lerp(r, 1, band * .7); g = lerp(g, .88, band * .62); b = lerp(b, .58, band * .55);
    st.R[i] = r; st.G[i] = g; st.B[i] = b;
  }
  st.key += '|spark';
  const ringK = Math.exp(-Math.max(0, t - 194.86) / .55) * 3.2 * sstep(194.84, 194.9, t);
  // (once the sky is bright the moon's bite is the colour of the sky beside the sun, never a black notch)
  const bite = sstep(195.3, 196.6, t), dark = [lerp(.012, .85, bite), lerp(.013, .64, bite), lerp(.018, .38, bite)];
  await paintStone(f, st, { sun: { ...totalSun(sunUV.x, sunUV.y, sunUV.r, { off: goldOff(t), ring: ringK + .25 * (1 - sstep(195, 196.5, t)), ringAng: Math.PI / 3, limb: [1.5 * (1 - sstep(195, 196, t)), 2, 1, Math.PI / 3] }), moonVis: 1 - sstep(195.2, 196.4, t), blaze: 1.35, dark },
    corona: coronaFor(t, { k: .9 * (1 - sstep(194.9, 195.8, t)), scale: .95 }), paint: { palette: SPARK_PAL, exposure: 1 + .1 * Math.exp(-Math.max(0, t - 194.86) / .3) },
    stars: { toScreen: toS, n: 120, k: .7 * (1 - sstep(195, 196.5, t)) }, statueDetail: .7 });
  // the burst: the diamond ring's light floods the sky from the bead (exact light over the paint, white-hot to gold),
  // a near white-out on the cut that recedes over half a second, then a lingering glow while the sun returns
  const g = f.g, u = H / 1080, dt = Math.max(0, t - 194.86);
  { const bk = sstep(194.84, 194.875, t) * (Math.exp(-dt / .42) + .18 * Math.exp(-dt / 2.2)), px = bx * W, py = by * H, rr = H * 1.15;
    if (bk > .005) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(px, py, 0, px, py, rr);
      gr.addColorStop(0, `rgba(255,252,240,${Math.min(1, bk * 1.2)})`); gr.addColorStop(.025, `rgba(255,246,222,${.95 * bk})`);
      gr.addColorStop(.09, `rgba(255,228,175,${.62 * bk})`); gr.addColorStop(.24, `rgba(255,200,130,${.32 * bk})`);
      gr.addColorStop(.55, `rgba(240,160,90,${.12 * bk})`); gr.addColorStop(1, 'rgba(220,140,80,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
    } }
  // gold flecks lifting off where the front passes (painted dabs, a pure function of time)
  { const env2 = sstep(194.95, 195.2, t) * (1 - sstep(198.6, 199.8, t));
    if (env2 > .01) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (let j = 0; j < 220; j++) {
        const h = q => hash3(j, q, 571), a = h(1) * TAU, birth = 194.95 + h(2) * 3.6, age = t - birth; if (age < 0 || age > 1.1) continue;
        const Rb = frontRadius(birth), rad = (Rb - .02 + .06 * h(3)) * H, x = bx * W + Math.cos(a) * rad * 1.0, y0 = by * H + Math.sin(a) * rad;
        if (x < -10 || x > W + 10 || y0 < -10 || y0 > H + 10) continue;
        const y = y0 - age * (40 + 70 * h(4)) * u, xx = x + Math.sin(age * 5 + j) * 6 * u, al = env2 * Math.sin(Math.PI * Math.min(1, age / 1.1)) * (.35 + .5 * h(5)), len = (2 + 5 * h(6)) * u;
        g.strokeStyle = `rgba(255,${200 + 40 * h(7) | 0},${110 + 60 * h(8) | 0},${al})`; g.lineWidth = (1 + 1.6 * h(9)) * u;
        g.beginPath(); g.moveTo(xx, y + len); g.lineTo(xx + len * .3, y); g.stroke();
      }
      g.restore();
    } }
  // ripples racing ahead of the front (exact light over the paint): thin, broken, warm, fading out
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (let q = 0; q < 3; q++) {
    const rq = (R + .04 + .1 * q) * H, aq = .45 * Math.exp(-q * .7) * (1 - sstep(196.8, 198.4, t)) * sstep(194.86, 194.95, t);
    if (aq <= .01) continue;
    for (let j = 0; j < 64; j++) {
      const a0 = j / 64 * TAU, a1 = a0 + TAU / 64 * (.55 + .4 * hash3(j, q, 3)); if (hash3(j, q, 5) < .25) continue;
      g.strokeStyle = `rgba(255,${228 - q * 18},${170 - q * 30},${aq * (.5 + .5 * hash3(j, q, 7))})`; g.lineWidth = (2.2 - .5 * q) * u;
      g.beginPath(); g.arc(bx * W, by * H, rq, a0, a1); g.stroke();
    }
  }
  g.restore();
  const T = f.type || (f.type = {});
  T.light = { dir: [.55, -.83], elev: .55, color: '#fff3d8', intensity: 1.1 };
  T.sun = { x: sunUV.x * W, y: sunUV.y * H, r: sunUV.r * W };
});
