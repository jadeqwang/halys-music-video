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
import { thalesDiagrams } from '../worlds/marble/diagrams.js';
import { goldReference, goldSun, goldOff, SPARK_PAL, EGRESS_DIR, C3 } from '../worlds/marble/gold.js';
import { drawCrystallise, widenAt } from './drop1.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => k * k * (3 - 2 * k);
const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a)));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const easeInOut = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

// plate time 0 = the song time each plate was generated against (production/PLATES.md)
const T0 = { P14: 65.67, P19: 93.0, P20: 100.24, P25: 153.83, P26: 178.66, P27: 181.23, P28: 184.64, P29: 194.86 };
async function plate(f, id, cam, o = {}) {
  const standin = { id: o.standin || 'a_duel', cam };
  return resolvePlate(f, id, standin, cam, o.keys ? { keys: o.keys, ...(o.extra || {}) } : { at: o.at ?? T0[id], ...(o.extra || {}) });
}
// a synthetic camera's map from source uv to screen px (for stars, planets and the sun drawn in plate space)
const camScreen = (f, c) => (u, v) => [((u - c.cx) * c.zoom + .5) * f.W, ((v - c.cy) * c.zoom + .5) * f.H];
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
  await paintStone(f, st, { stars: { toScreen: camScreen(f, cam), n: 170, k: .8 } });
});

// ================================================================ S46: the drift through the frozen battle
// statues mid-strike, arrows hanging, river spray frozen like glass beads
scene('S46', async f => {
  const k = seg(f.t, 160.70, 164.13);
  const cam = { cx: .49 + .03 * k, cy: .5, zoom: 1.08 };
  const src = await plate(f, 'P25', cam, { keys: [[160.70, .35], [164.13, 2.6]] });
  const st = stoneSource(f, src, { sky: { dLo: .02, dHi: .07, below: .72, run: 3 }, water: { k: .7 } });
  await paintStone(f, st, { stars: { toScreen: camScreen(f, cam), n: 170, k: .8 }, overStrokes: ctx => glassBeads(f, st, ctx, { seed: 46 }) });
});

// frozen spray: glass beads hanging in the air near the feet and the water (anchored in the source's material space,
// so they drift with the camera). Each bead: a dark refracting rim, a pale body catching the corona, a hot highlight.
function glassBeads(f, st, ctx, o = {}) {
  const { aw, ah } = st, S = ctx.S, out = [], mx = st.mat && st.mat.mx, my = st.mat && st.mat.my;
  if (!mx) return out;
  const cell = (o.cell ?? 9) * aw / 960, seen = new Set(), seed = o.seed ?? 7;
  for (let y = Math.floor(ah * .5); y < ah - 2; y += 2) for (let x = 2; x < aw - 2; x += 2) {
    const i = y * aw + x; if (st.S[i] > .3) continue;
    // where spray would hang: just above the land around the figures' feet and over the water
    const nearFig = st.M[i] < .5 && (st.M[Math.min(st.aw * st.ah - 1, i + 6 * aw)] > .5 || st.M[Math.max(0, i - 8 * aw)] > .5);
    const water = st.Lp && st.Lp[i] > .55 && st.M[i] < .3;
    if (!nearFig && !water) continue;
    const cx = Math.floor(mx[i] / S / cell), cy = Math.floor(my[i] / S / cell), key = cx * 92821 + cy;
    if (seen.has(key)) continue; seen.add(key);
    if (hash3(cx, cy, seed) > (water ? .32 : .5)) continue;
    const jx = (hash3(cx, cy, seed + 1) - .5) * cell, jy = (hash3(cx, cy, seed + 2) - .5) * cell - (hash3(cx, cy, seed + 3)) * cell * 2.5;
    const px = (x + jx) * S, py = (y + jy) * S, r = (1.2 + 2.4 * Math.pow(hash3(cx, cy, seed + 4), 2)) * f.H / 1080;
    out.push({ pts: [[px - r * .1, py], [px + r * .1, py]], r: r * 1.05, c0: [.16, .17, .2], c1: [.16, .17, .2], a: .85, thick: .3, seed: hash3(cx, cy, 5), key: 9 + hash3(cx, cy, 6), layer: 12, taper: 0, maxSeg: 4 });
    out.push({ pts: [[px - r * .1, py + r * .05], [px + r * .1, py + r * .05]], r: r * .72, c0: [.62, .66, .72], c1: [.78, .62, .45], a: .9, thick: .4, seed: hash3(cx, cy, 7), key: 9.1 + hash3(cx, cy, 8), layer: 12, taper: 0, maxSeg: 4 });
    out.push({ pts: [[px - r * .35, py - r * .38], [px - r * .2, py - r * .42]], r: r * .26, c0: [1, .99, .96], c1: [1, .97, .9], a: 1, thick: 1.2, seed: hash3(cx, cy, 9), key: 9.2 + hash3(cx, cy, 10), layer: 12, taper: .2, maxSeg: 4 });
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
  const cam = { cx: .52, cy: .6 - .17 * k, zoom: 1.18 };
  const src = await plate(frozen(f, 159.23), 'P25', cam, { keys: [[0, 5.4], [999, 5.4]] });
  const toS = camScreen(f, cam), [sx, sy] = toS(...S49.sun), sunUV = { x: sx / f.W, y: sy / f.H, r: .026 };
  // the plinth, drawn into the source: a marble block in the near foreground (statue mask: crisp edges, inflated)
  const P = S49.plinth, plinthSrc = withPlinth(src, cam, P);
  const st = stoneSource(f, plinthSrc, { sky: { dLo: .02, dHi: .07, below: .7, run: 3 }, water: { k: .5 }, sun: sunUV });
  paintPlinth(st, cam, P);
  // the type: the plinth's front face, in frame fractions (centre x, top y, width, height), painted by us
  const [fx0, fy0] = toS(P.u0, P.face), [fx1] = toS(P.u1, P.face);
  f.type = f.type || {};
  f.type.plinth = { x: (fx0 + fx1) / 2 / f.W, y: fy0 / f.H, w: (fx1 - fx0) / f.W, h: .2, draw: false };
  const pts = planetPoints(sx, sy, S49.ppd * f.H / 1080, { jupiterInPass: false, saturn: [-21, 31] });
  await paintStone(f, st, { sun: totalSun(sunUV.x, sunUV.y, sunUV.r), corona: coronaFor(t, { k: .95 }), points: pts,
    stars: { toScreen: (u, v) => toS(u, v * 1.6 - .6), n: 230, k: .85, avoid: [{ x: sx, y: sy, r: sunUV.r * f.W * 3 }] } });
});
// the plinth's own light (designed, not re-lit as a statue): a pale top face under the corona, a bright arris, a cornice
// (fillet and shadowed groove), the front face falling from light to shadow toward the ground, darker vertical edges,
// a few grey veins, the orange horizon glow catching its left edge
function paintPlinth(st, cam, P) {
  const { aw, ah } = st, lab = [0, 0, 0], rgb = [0, 0, 0];
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const u = (x / aw - .5) / cam.zoom + cam.cx, v = (y / ah - .5) / cam.zoom + cam.cy, i = y * aw + x;
    if (u < P.u0 || u > P.u1 || v < P.top) continue;
    const e = Math.min(u - P.u0, P.u1 - u), fu = (u - P.u0) / (P.u1 - P.u0);
    let L;
    if (v < P.face) L = .8 + .06 * (v - P.top) / (P.face - P.top);
    else {
      const dv = v - P.face;
      L = .66 - .3 * sstep(0, .38, dv);
      if (dv < .004) L = .9;                                      // the arris catching the corona
      else if (dv < .012) L = .78;                                // the fillet
      else if (dv < .02) L = .4 + 10 * (dv - .012);               // the groove under the cornice
    }
    L *= 1 - .3 * (1 - sstep(0, .012, e));                        // the vertical edges turning away
    const vein = Math.abs(Math.sin((fu * 2.6 + v * 1.4) * 9 + 2.2 * vnoise(fu * 4, v * 4, 77))), vk = (1 - sstep(0, .05, vein)) * sstep(.45, .6, vnoise(fu * 2.2, v * 2.2, 79));
    L *= 1 - .22 * vk;
    const glow = (1 - sstep(0, .06, u - P.u0)) * .35;            // the horizon glow on its left edge
    let r = L * .93 + glow * .5, g = L * .92 + glow * .22, b = L * .9 + glow * .05;
    rgb2lab(Math.min(1, r), Math.min(1, g), Math.min(1, b), lab); lab2rgb(lab[0], lab[1] - .004, lab[2] - .012, rgb);
    st.R[i] = rgb[0]; st.G[i] = rgb[1]; st.B[i] = rgb[2];
  }
}
// a plinth in plate space: overwrite the source's pixels (light marble base, near depth, matte) inside its outline
function withPlinth(src, cam, P) {
  const { aw, ah } = src, N = aw * ah, R = Float32Array.from(src.R), G = Float32Array.from(src.G), B = Float32Array.from(src.B);
  const depth = src.depth ? Float32Array.from(src.depth) : new Float32Array(N).fill(.5), matte = src.matte ? Float32Array.from(src.matte) : new Float32Array(N);
  const sky = new Float32Array(N);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const u = (x / aw - .5) / cam.zoom + cam.cx, v = (y / ah - .5) / cam.zoom + cam.cy, i = y * aw + x;
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
// middle figure of P27; the whole matte of P28, plus his staff from the depth) is the plate re-lit as living paint and
// mapped into the BRONZE box.
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
    lab2rgb(L, lab[1] * 1.2 + .006, lab[2] * 1.2 + .02, rgb);
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
  const st = stoneSource(f, src, { sky: o.sky, water: { k: .4 }, ...(o.stone || {}) });
  // his region
  let TM;
  if (o.plate === 'P27') TM = src.matte ? componentNear(src.matte, src.aw, src.ah, o.thalesX ?? .47) : new Float32Array(src.aw * src.ah);
  else { TM = new Float32Array(src.aw * src.ah); for (let i = 0; i < TM.length; i++) TM[i] = Math.max(src.matte ? src.matte[i] : 0, src.depth ? sstep(.55, .7, src.depth[i]) : 0) * (1 - st.S[i]); TM = blurFast(TM, src.aw, src.ah, .7); }
  livingRef(st, src, TM, o.living || {});
  const T = f.type || (f.type = {});
  T.light = { dir: [-.6, -.8], elev: .5, color: '#f3dcb0', intensity: 1.0, cool: .25 };
  return { st, TM, src };
}
// S52: Thales walks toward the lens between the Lydian and the Mede (P27, 1:1); his name on 182.49
scene('S52', async f => {
  const k = seg(f.t, 181.23, 183.34), cam = { cx: .5, cy: .5, zoom: 1.03 + .02 * k };
  const { st } = await thalesFrame(f, { plate: 'P27', cam, sky: { dLo: .02, dHi: .08, below: .55, run: 3 } });
  await paintStone(f, st, { stars: { toScreen: camScreen(f, cam), n: 140, k: .75 }, paint: { palette: SPARK_PAL } });
  f.type.light = { dir: [-.6, -.8], elev: .5, color: '#f3dcb0', intensity: 1.0, cool: .25 };
});
// S53: close; the gold construction lines bloom around him (theorem, saros dial, gear into code); S54: the glance
const S53_KEYS = [[183.34, .15], [186.9, 2.0], [187.65, 2.8], [188.51, 3.7]];
async function s53(f, dim) {
  const k = seg(f.t, 183.34, 188.51), cam = { cx: .5, cy: .5, zoom: 1.04 + .03 * k };
  const { st, TM } = await thalesFrame(f, { plate: 'P28', cam, keys: S53_KEYS, sky: { dLo: .02, dHi: .09, below: .6, run: 3 }, stone: { horizonY: .52 } });
  await paintStone(f, st, { stars: { toScreen: camScreen(f, cam), n: 120, k: .7 }, paint: { palette: SPARK_PAL }, statueDetail: .9 });
  // the diagrams, behind him (his matte cuts them)
  const L = f.layer(7);
  thalesDiagrams(L.g, f.W, f.H, f.t, { dial: [.845, .56], dialR: .145, theorem: [.2, .31], gear: [.905, .86], codeAt: 'left', t0: 183.45, dim });
  cutMatte(L, TM, st.aw, st.ah, f);
  const g = f.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(L.c, 0, 0); g.restore();
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
  const st = stoneSource(f, src, { sky: { dLo: .02, dHi: .07, below: .78, run: 3 }, horizonY: (.725 - cam.cy) * cam.zoom + .5, water: { k: .6 }, sun, statue: { mode: 'relief', relief: [.02, .06] } });
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
    const wob = (vnoise(Math.cos(a) * 2.4 + 5, Math.sin(a) * 2.4 + t * .25, 57) - .5) * .14 + (vnoise(u * 6, v * 6, 59) - .5) * .06;
    const e = R + wob - d, light = clamp(e / .16 + .35), flesh = clamp((e - .1) / .24), band = Math.exp(-Math.pow((e - .02) / .03, 2)) * env;
    let r = st.R[i], g = st.G[i], b = st.B[i];
    r = lerp(r, Math.min(1, r * 1.16 + .045), light); g = lerp(g, Math.min(1, g * 1.0 + .015), light); b = lerp(b, b * .74, light);
    r = lerp(r, gref.R[i], flesh); g = lerp(g, gref.G[i], flesh); b = lerp(b, gref.B[i], flesh);
    r = lerp(r, 1, band * .6); g = lerp(g, .9, band * .55); b = lerp(b, .62, band * .5);
    st.R[i] = r; st.G[i] = g; st.B[i] = b;
  }
  st.key += '|spark';
  const ringK = Math.exp(-Math.max(0, t - 194.86) / .55) * 3.2 * sstep(194.84, 194.9, t);
  await paintStone(f, st, { sun: { ...totalSun(sunUV.x, sunUV.y, sunUV.r, { off: goldOff(t), ring: ringK + .25 * (1 - sstep(195, 196.5, t)), ringAng: Math.PI / 3, limb: [1.5 * (1 - sstep(195, 196, t)), 2, 1, Math.PI / 3] }), moonVis: 1 - sstep(195.2, 196.4, t), blaze: 1.35 },
    corona: coronaFor(t, { k: .9 * (1 - sstep(194.9, 195.8, t)), scale: .95 }), paint: { palette: SPARK_PAL, exposure: 1 + .35 * Math.exp(-Math.max(0, t - 194.86) / .4), warmFlash: .2 * Math.exp(-Math.max(0, t - 194.86) / .5) },
    stars: { toScreen: toS, n: 120, k: .7 * (1 - sstep(195, 196.5, t)) }, statueDetail: .7 });
  // ripples racing ahead of the front (exact light over the paint): thin, broken, warm, fading out
  const g = f.g, u = H / 1080; g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
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
  f.type.light = { dir: [.55, -.83], elev: .55, color: '#fff3d8', intensity: 1.1 };
  f.type.sun = { x: sunUV.x * W, y: sunUV.y * H, r: sunUV.r * W };
});
