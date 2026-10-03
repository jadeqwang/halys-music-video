// drop2.js: ORBIT, S63-S74 (Drop 2: swords into starships, the eclipse cascade, Earthset, the dive) and S77 (the
// pull-back). Owner: ORBIT agent. Built on the line engine (src/worlds/line/) plus src/worlds/orbit/.
//
// Beat sync: cuts are the shot list's downbeats; kicks (timing.json events.kicks, snapped to the master frame grid by
// audio.js) drive line thickness, the radial push, the gear ticks and the starship's exhaust; the wordless topline
// (curves.vocal, smoothed) lets slow motion breathe. The ring is locked at (W/2, H/2) through S64-S71.
// Type: every scene sets f.type (sun/field/kick/light) for the era captions, HOME and the THROW DOWN chops.

import { scene, shotOverride } from '../registry.js';
import { drawLines, staticMesh, dynLayer, coronaRing, ringU, audio, proc, FL, resolve, sourceFields } from '../worlds/line/index.js';
import { clamp, lerp, sstep, smooth, easeIn, easeInOut, easeOut, hash3, TAU } from '../core.js';
import { FPS } from '../time.js';
import { lockedRing, ringR, RING_CFG, RING_BARE, clipLines, splitLine, mkLine, dot, placeU, affineU, vocalBreath, breathPhase, xform } from '../worlds/orbit/index.js';
import * as ERA from '../worlds/orbit/eras.js';

const snap = audio.snap;
const steer = (f, o) => { f.type = Object.assign(f.type || {}, o); };
// kicks counted from t0 with an eased step on each (clockwork ticks): k kicks done + the ease of the newest
export function kickTicks(t, t0, ease = .14) {
  const K = audio.kickTimes(); let n = 0, last = null;
  for (const k of K) { if (k < t0 - 1e-6) continue; if (k > t + 1e-6) break; n++; last = k; }
  if (!last) return 0;
  return n - 1 + easeOut(clamp((t - last) / ease));
}
const LOOK = { glow: [.22, .08] };
const RING_DIM = { corona: { gain: .6 }, tilt: .42 };

// ================================================================ S64-S71: the cascade, ring locked centre
// one frame of an era: the locked ring + era layers (+ an optional plate), kick pulse, pulses that breathe with the topline
async function eraFrame(f, o) {
  const t = f.t, kick = audio.kickEnv(t, .13), ring = lockedRing(f, kick, { cfg: o.ringCfg || RING_CFG, key: o.ringKey, bright: o.ringBright ?? (.92 + .16 * vocalBreath(t)) });
  const layers = [...(o.under || []), ring.layer, ...(o.layers || [])];
  const r = await drawLines(f, {
    ...(o.plate || {}), layers, kick, kickPush: o.kickPush ?? 14, pushCenter: [ring.cx, ring.cy], phase: audio.flowPhase(t) * .85,
    look: { ...LOOK, ...(o.look || {}) }, disk: o.disk === undefined ? ring.disk : o.disk, palette: o.palette,
  });
  steer(f, { ...ring.type, kick });
  return { r, ring, kick };
}

// ---------------------------------------------------------------- S64: Antikythera, the saros dial spiral is the ring
const S64_T0 = 222.077;
scene('S64', async f => {
  const W = f.W, H = f.H, s = H / 1080, cx = W / 2, cy = H / 2, R = ringR(H), t = f.t;
  const turn = kickTicks(t, S64_T0) + .08 * breathPhase(t, S64_T0);
  const train = ERA.gearTrain(W, H);
  const layers = [];
  const spiral = ERA.sarosSpiral(cx, cy, R);
  layers.push({ mesh: staticMesh(f, 'aky-spiral', () => spiral.lines), u: { uBright: .95 } });
  train.G.forEach((g, i) => {
    const mesh = staticMesh(f, `aky-gear-${i}-${g.teeth}`, () => ERA.gearLines(g.r, g.teeth, { spokes: g.spokes || 0, depth: g.depth, b: 1, w: 1.25 * s + .2, o: .82 }));
    layers.push({ mesh, u: { ...placeU(0, 0, train.angle(g, turn), 1, g.x, g.y), uBright: .9 } });
  });
  // the pointer: one month cell per kick, its pin riding the groove
  const cell = 38 + kickTicks(t, S64_T0, .1), th = cell / spiral.cells * spiral.turns * TAU, rr = spiral.rAt(th), a = spiral.a0 + th;
  const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
  const ptr = [proc.line([[cx + Math.cos(a) * R * 1.12, cy + Math.sin(a) * R * 1.12], [cx + Math.cos(a) * (spiral.r1 + spiral.pitch * .8), cy + Math.sin(a) * (spiral.r1 + spiral.pitch * .8)]], { b: .75, w: 1.6, o: .3 }),
    proc.circle(px, py, spiral.pitch * .24, { b: 1.4, w: 1.4, o: .5 }, 20), dot(px, py, 2.4, 3.2, .4)];
  layers.push(dynLayer(ptr));
  await eraFrame(f, { layers, ringCfg: RING_BARE, ringBright: .9 });
});

// ---------------------------------------------------------------- S65: Halley's 1715 map, the shadow oval is the ring
const S65_T0 = 225.476, S65_T1 = 228.876;
scene('S65', async f => {
  const W = f.W, H = f.H, s = H / 1080, cx = W / 2, cy = H / 2, R = ringR(H), t = f.t;
  const k = clamp((t - S65_T0) / (S65_T1 - S65_T0)), scale = 1.45 * s;                       // px per km: England and Wales fill the frame
  const u = lerp(ERA.PATH_LONDON - 150, ERA.PATH_LONDON + 95, k);                           // the oval moves NE along the path, over London
  const [mx, my, dx, dy] = ERA.pathAt(u), ang = Math.atan2(-dy, dx);
  const map = ERA.halleyLines(W, H, scale, [mx, my]), path = ERA.halleyPath(W, H, scale, [mx, my], u);
  const oval = ERA.shadowOval(cx, cy, R, ang);
  // the oval's earlier positions along the track, fading (Halley marked the shadow minute by minute)
  const ghosts = [];
  for (let j = 1; j <= 3; j++) {
    const [gx, gy] = ERA.pathAt(u - j * 62);
    const sx = cx + (gx - mx) * scale, sy = cy - (gy - my) * scale;
    ghosts.push(proc.ellipse(sx, sy, R * 1.55, R * 1.18, ang, { b: .6 / j, w: .9, o: .5, flags: FL.SHARP }, 120));
  }
  const keep = (x, y) => Math.hypot(x - cx, y - cy) > R * 1.03;
  await eraFrame(f, { layers: [dynLayer(clipLines([...map, ...path, ...ghosts], keep), { uBright: 1 }), dynLayer(oval)], ringCfg: RING_DIM, ringKey: 'orbitRingDim', ringBright: .9, kickPush: 10 });
});

// ---------------------------------------------------------------- S66: Eddington's 1919 plate, displaced stars around the black Sun
const S66_T0 = 228.876, S66_T1 = 232.266;
scene('S66', async f => {
  const W = f.W, H = f.H, s = H / 1080, cx = W / 2, cy = H / 2, R = ringR(H), t = f.t;
  const k = clamp((t - S66_T0) / (S66_T1 - S66_T0));
  const plate = ERA.eddingtonPlate(W, H);
  const stars = ERA.hyades(cx, cy, R, s);
  const bend = easeInOut(clamp(kickTicks(t, S66_T0, .12) / 6));                               // light bends, one kick at a time
  const kick = audio.kickEnv(t, .1);
  const drift = placeU(cx, cy, (-2.2 + 1.4 * k) * Math.PI / 180, 1 + .035 * k, 0, 0);         // the plate on the light table
  const layers = [
    { mesh: staticMesh(f, 'edd-plate', () => plate.lines), u: { ...drift, uBright: .9 } },
    dynLayer(ERA.eddingtonStars(stars, cx, cy, R, s, bend, kick, plate.rect), drift),
    dynLayer(clipLines(ERA.lightRays(cx, cy, R, W, s, .35 + .65 * bend), (x, y) => x > plate.rect[0] + 12 * s && x < plate.rect[2] - 12 * s && y > plate.rect[1] + 12 * s && y < plate.rect[3] - 12 * s), { ...drift, uBright: .8 }),
  ];
  await eraFrame(f, { layers });
});

// ---------------------------------------------------------------- S67: Concorde 001, the eclipse through a round porthole
const S67_T0 = 232.266;
const S67_TRACE = { contourW: [1.1, 2.2], contourB: 1.35, innerB: .9, innerHi: .16, lightDir: [-.3, -1], dsepMin: 3.2, dsepMax: 10, bgSepMin: 16, bgSepMax: 30, bgGain: .32,
  sky: { horizonY: .445, below: .45, useDepth: false }, horizon: 1, horizonBand: .02, minLen: 24 };
scene('S67', async f => {
  const W = f.W, H = f.H, s = H / 1080, cx = W / 2, cy = H / 2, R = ringR(H), t = f.t, Rp = 1.85 * R;
  const src = { plate: 'P35', standin: 'master', win: { cx: .5, cy: .24, zoom: 1.0 }, clamp: false };      // the plane low, the sky its own
  await eraFrame(f, {
    plate: { src, tp: t - S67_T0, chainFrom: 0, trace: S67_TRACE, corona: false, reveal: { x: cx, y: cy, r: Rp - 4 * s, ramp: 6 * s } },
    layers: [{ mesh: staticMesh(f, 'porthole', () => ERA.portholeLines(cx, cy, Rp, s)), u: { uBright: 1 } }],
  });
});

// ---------------------------------------------------------------- S68: a crowd in eclipse glasses looks up (rhymes with 102.21)
const S68_T0 = 235.656;
const S68_TRACE = { contourW: [1.2, 2.4], contourB: 1.85, innerB: 1.15, innerHi: .12, innerLo: .05, lightDir: [0, -1], dsepMin: 2.6, dsepMax: 8, bgSepMin: 14, bgSepMax: 28, bgGain: .3,
  subjBright: [.5, 1.2], rim: 1, sky: { maxDepth: .03, soft: .02, below: .6 }, horizon: 1, horizonBand: .02, minLen: 18 };
scene('S68', async f => {
  const t = f.t;
  const src = { plate: 'P36', standin: 'duelup', win: { cx: .5, cy: .41, zoom: 1.0 }, clamp: false };
  await eraFrame(f, { plate: { src, tp: t - S68_T0 + .10, chainFrom: .10, trace: S68_TRACE, analysis: { gain: 2.1 }, corona: false } });
});

// ---------------------------------------------------------------- S69: Artemis II, the corona around the Moon from Orion's window
const S69_T0 = 239.046, S69_T1 = 242.446;
scene('S69', async f => {
  const W = f.W, H = f.H, s = H / 1080, cx = W / 2, cy = H / 2, R = ringR(H), t = f.t;
  const k = clamp((t - S69_T0) / (S69_T1 - S69_T0));
  const win = ERA.orionWindow(W, H, s);
  // the capsule drifts (attitude hold is never perfect); the ring stays locked
  const dxw = lerp(-26, 30, easeInOut(k)) * s, dyw = 14 * s * Math.sin(k * Math.PI * .9), rot = lerp(-1.6, 1.2, easeInOut(k)) * Math.PI / 180;
  const U = placeU(cx, cy, rot, 1, dxw, dyw);
  const stars = [];
  for (let i = 0; i < 90; i++) { const x = hash3(i, 69, 1) * W, y = hash3(i, 69, 2) * H; if (Math.hypot(x - cx, y - cy) < R * 1.5) continue; stars.push([x, y, .3 + 1.2 * Math.pow(hash3(i, 69, 3), 3)]); }
  // stars only through the glass: the window polygon, moved with the capsule
  const c = Math.cos(rot), sn = Math.sin(rot), glass = win.glass.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * sn + dxw, cy + (x - cx) * sn + (y - cy) * c + dyw]);
  const starLines = stars.filter(([x, y]) => ERA.pointInPoly(x, y, glass)).map(([x, y, b]) => dot(x, y, b, 1.6 + b, 0, FL.TIP | FL.SHARP));
  await eraFrame(f, { layers: [{ mesh: staticMesh(f, 'orion-window', () => win.lines), u: { ...U, uBright: 1 } }, dynLayer(starLines)] });
});

// ---------------------------------------------------------------- S70: Karnak, a black Sun almost overhead
const S70_T0 = 242.446;
// P37 looks straight up: the sky is a cross in the middle of the frame, so the engine's sky mask (sky from the top down)
// cannot find it. Depth does: everything is background, its brightness faded by depth (the far sky goes black)
const S70_TRACE = { contour: 0, innerB: 1.2, innerHi: .11, innerLo: .05, innerW: [.8, 1.4], innerEverywhere: 1, lightDir: [-.5, -.8], subject: 'none', poolMatte: 0,
  bgGain: .95, bgSepMin: 3.4, bgSepMax: 11, bgCut: .12, depthFade: 1, gamma: 1.1, minLen: 18, horizon: 0 };
scene('S70', async f => {
  const t = f.t;
  const src = { plate: 'P37', standin: 'master', win: { cx: .47, cy: .38, zoom: 1.2 }, clamp: false };
  await eraFrame(f, { plate: { src, tp: t - S70_T0, chainFrom: 0, trace: S70_TRACE, corona: false } });
});

// ---------------------------------------------------------------- S71: Phobos, a lumpy potato crossing the Sun over Mars
const S71_T0 = 245.826, S71_T1 = 249.215;
scene('S71', async f => {
  const W = f.W, H = f.H, s = H / 1080, cx = W / 2, cy = H / 2, R = ringR(H), t = f.t;
  const k = clamp((t - S71_T0) / (S71_T1 - S71_T0)), kick = audio.kickEnv(t, .13);
  // Phobos crosses left to right, a little high, never covering the whole disk (an annular-type transit)
  const u = lerp(-1.75, 1.75, k), px = cx + u * R, py = cy - .22 * R + .1 * u * R;
  const potato = ERA.phobosOutline(px, py, R, .35 + .1 * u);
  const inPotato = (x, y) => ERA.pointInPoly(x, y, potato);
  const sun = clipLines(ERA.sunDiskLines(cx, cy, R * (1 + .02 * kick), s), (x, y) => !inPotato(x, y));
  const mars = ERA.marsHorizon(W, H, s);
  await drawLines(f, {
    layers: [{ mesh: staticMesh(f, 'mars', () => mars.lines), u: { uBright: 1 } }, dynLayer(sun, { uBright: 1 })],
    kick, kickPush: 12, pushCenter: [cx, cy], phase: audio.flowPhase(t) * .85, look: { glow: [.26, .1] }, disk: false,
  });
  // the silhouette: crisp, darker than the sky (drawn over the glow)
  const g = f.g;
  g.save(); g.fillStyle = '#04050a'; g.beginPath(); potato.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); g.restore();
  steer(f, { sun: { x: cx, y: cy, r: R }, field: { center: [cx, cy] }, kick });
});

// ================================================================ S72: EARTHSET, the first blue
// The Earth rises over the grey lunar limb (orthographic Moon: its silhouette is a circle, so it occludes the Earth's
// lines with the engine's reveal mask and the blue fill with a circle test). The Earth's line set is projected once
// (a static mesh) and slides up; clouds drift by their travelling pulses. Lit from the west (the 585 BC sun: the dusk
// band lies over Anatolia, on the right). The blue appears on this shot's first frame and nowhere before it.
export const S72_T0 = 249.215, S72_T1 = 255.985;
export const EARTH_SUN = [-60, 21.5];                 // the sub-solar point of the room's sim (16:00 UT, 28 May): dusk over the Halys
const S72_VIEW = { lon0: -16, lat0: 21, roll: -8 };
export function s72Earth(f, t) {
  const H = f.H, W = f.W, yTop = .6 * H, Rs = .36 * H;
  const k = easeInOut(clamp((t - S72_T0) / (S72_T1 - S72_T0 + .4)));
  const cy = lerp(yTop + .42 * Rs, yTop - .5 * Rs, k);
  return { Rs, cx: W / 2, cy, yTop, k };
}
async function moonLimb(f) {
  const { lunarLimb } = await import('../worlds/orbit/moon.js');
  return lunarLimb(f.W, f.H, { RM: 1.6, yTop: .6, sun: [-.9, -.28], seed: 5 });
}
scene('S72', async f => {
  const W = f.W, H = f.H, s = H / 1080, t = f.t, E = await import('../worlds/orbit/earth.js');
  await E.earthReady(0);
  const pos = s72Earth(f, t), kick = audio.kickEnv(t, .14) * .55, breath = vocalBreath(t);
  const M = await moonLimb(f), occ = { x: M.cx, y: M.cy, r: M.RM };
  const ref = { ...S72_VIEW, D: 40, Rs: pos.Rs, cx: W / 2, cy: .5 * H, sun: EARTH_SUN };
  const earthMesh = staticMesh(f, 'earth-s72', () => E.earthLines(E.earthView(ref), { W, H: H * 2, minStep: 2.4, gain: 1 }));
  const V = E.earthView({ ...ref, cy: pos.cy });
  const stars = [];
  for (let i = 0; i < 140; i++) {
    const x = hash3(i, 72, 1) * W, y = hash3(i, 72, 2) * H * .66;
    if (Math.hypot(x - occ.x, y - occ.y) < occ.r + 3 * s || Math.hypot(x - pos.cx, y - pos.cy) < pos.Rs * 1.06) continue;
    stars.push(dot(x, y, .25 + 1.1 * Math.pow(hash3(i, 72, 3), 4), 1.4 + hash3(i, 72, 4), 0, FL.TIP | FL.SHARP));
  }
  const layers = [
    dynLayer(stars, { uBright: .8 }),
    { mesh: earthMesh, u: { ...affineU(1, 0, 0, 1, 0, pos.cy - .5 * H), uReveal: [occ.x, occ.y, occ.r + 1.5 * s, 2.5 * s], uReveal2: [0, 100], uBright: 1 + .1 * breath, uT: breathPhase(t, S72_T0, .3, .4) } },
    { mesh: staticMesh(f, 'moon-s72', () => M.lines), u: { uBright: 1 } },
  ];
  await drawLines(f, { layers, kick, kickWidth: .8, kickPush: 6, pushCenter: [W / 2, pos.cy], phase: audio.flowPhase(t) * .6, look: { glow: [.24, .1] }, disk: false, palette: BLUE });
  await E.earthFill(f, V, { occ });
  steer(f, { kick, light: { dir: [-.85, -.45], elev: .42, color: '#f6efe0', intensity: 1.05, cool: .25 } });
});
const BLUE = { red: '#2a78e4' };

// ================================================================ S73: the Earth rushes at the camera (THROW DOWN x2)
// From Earthset's last framing the globe turns to bring the Halys to the centre and lunges at us on each chop
// (256.405, 257.245); the Moon falls away below. The CHOP fill radiates from the dive's target.
export const S73_T0 = 255.985, S73_T1 = 257.675, CHOP1 = 256.405, CHOP2 = 257.245;
function rushK(t) {                     // the scale factor (x Earthset's radius), with two lunges
  const a = snap(CHOP1), b = snap(CHOP2);
  let k = 1 + .14 * clamp((t - S73_T0) / (a - S73_T0));
  if (t >= a) k = lerp(1.14, 2.0, 1 - Math.exp(-(t - a) / .07)) + .5 * clamp((t - a) / (b - a));
  if (t >= b) k = lerp(2.5, 4.4, 1 - Math.exp(-(t - b) / .08)) + 1.6 * clamp((t - b) / (S73_T1 - b));
  return k;
}
export function s73View(f, t) {
  const W = f.W, H = f.H, p0 = s72Earth(f, S72_T1), k = rushK(t);
  const turn = easeInOut(clamp((t - S73_T0 - .05) / (S73_T1 - S73_T0 - .05)));
  const lon0 = lerp(S72_VIEW.lon0, 34.85, turn), lat0 = lerp(S72_VIEW.lat0, 38.72, turn), roll = lerp(S72_VIEW.roll, 0, turn);
  return { lon0, lat0, roll, D: 40, Rs: p0.Rs * k, cx: W / 2, cy: lerp(p0.cy, H / 2, turn), sun: EARTH_SUN, k, turn };
}
scene('S73', async f => {
  const W = f.W, H = f.H, s = H / 1080, t = f.t, E = await import('../worlds/orbit/earth.js');
  await E.earthReady(1);
  const v = s73View(f, t), V = E.earthView(v), kick = audio.kickEnv(t, .12);
  const M = await moonLimb(f), drop = easeInOut(clamp((t - S73_T0) / (snap(CHOP1) + .25 - S73_T0)));
  const my = drop * .75 * H, fadeM = 1 - drop;
  const occ = fadeM > .02 ? { x: M.cx, y: M.cy + my, r: M.RM } : null;
  const layers = [dynLayer(E.earthLines(V, { W, H, minStep: 2.6, occ }), { uBright: 1.05 })];
  if (fadeM > .02) layers.push({ mesh: staticMesh(f, 'moon-s72', () => M.lines), u: { ...affineU(1, 0, 0, 1, 0, my), uBright: fadeM } });
  const target = E.project(V, E.ll2v(34.85, 38.72));
  await drawLines(f, { layers, kick, kickWidth: 1.1, kickPush: 18, pushCenter: [target[0], target[1]], phase: audio.flowPhase(t), look: { glow: [.24, .1] }, disk: false, palette: BLUE });
  await E.earthFill(f, V, { occ });
  steer(f, { kick, field: { center: [target[0], target[1]], r: 0 }, sun: undefined });
});

// ================================================================ S74: the dive, lines condense into paint (GOLD)
// 257.675 (the hit, the kick stops): down through the cloud deck (white contour layers scaled past the camera), the
// map of Anatolia under it (1:10m coasts, the seas still Earth-blue, the Halys in orange), zooming 1100x into the bend
// near Avanos; then the camera pitches from nadir to level as it drops into the valley, P38's front row appears in
// lines, and the lines widen and condense into the brush engine's GOLD paint of P38's first frame (12 drawings/s, the
// painted world's cadence). Its last frame is paint(P38 frame 1, LANDING_LOOK): S75 (259.36) continues from there.
export const S74_T0 = 257.675, S74_T1 = 259.355;
// the GOLD look of the landing frame (and of S77's first frame): the brush agent's S75/S76 should match it, or export
// theirs as P38_GOLD from chorus2.js and both ends pick it up (see goldLook)
export const LANDING_LOOK = {
  palette: 'gold', lightDir: [-.55, -.8], pool: [{ x: .5, y: .5, rx: .95, ry: .9, feather: .6, k: 1 }], poolFromLight: { k: .7, bg: .45 }, poolMatte: .5,
  envDim: .8, crushFloor: .05, rim: .75, glint: .9, plateKeep: .6, keepDim: .88, faceMin: .3, impasto: .5, eclipse: 0, seed: 38,
};
export const S74_HANDOFF = { t: S74_T1, plate: 'P38', tp: 0, frame: 1, cam: null, look: 'LANDING_LOOK (or chorus2.js P38_GOLD)' };
async function goldLook() {
  try { const m = await import('./chorus2.js'); if (m.P38_GOLD) return m.P38_GOLD; } catch (e) { /* no export yet */ }
  return LANDING_LOOK;
}
// paint(P38 at plate time tp) at the drawing of song time t (12 fps), cached per drawing: a pure function of (tp, drawing)
const PAINTS = new Map();
async function paintP38(f, t, tp) {
  const di = Math.round(t * 12), key = `${f.W}x${f.H}|${di}|${tp}`;
  if (PAINTS.has(key)) { const c = PAINTS.get(key); PAINTS.delete(key); PAINTS.set(key, c); return c; }
  const B = await import('../worlds/brush/index.js'), look = await goldLook();
  const tq = di / 12, ff = { ...f, t: tq, cad: 12, k: 0, lt: 0 };
  const src = await B.resolvePlate(ff, 'P38', { id: 'c_armies' }, null, { keys: [[0, tp], [1e4, tp]] });
  const c = new OffscreenCanvas(f.W, f.H), g2 = c.getContext('2d');
  await B.paint(ff, src, { ...look, target: g2, drawIdx: di });
  PAINTS.set(key, c);
  while (PAINTS.size > 6) PAINTS.delete(PAINTS.keys().next().value);
  return c;
}
const P38_SRC = { plate: 'P38', standin: 'armies' };
const P38_TRACE = { contourW: [1.2, 2.4], contourB: 1.8, innerB: .95, innerHi: .16, lightDir: [-.5, -.8], dsepMin: 3, dsepMax: 9, bgSepMin: 14, bgSepMax: 26, bgGain: .35,
  sky: { horizonY: .43, below: .45, useDepth: false }, horizon: 1, horizonBand: .02, armies: 1, armyMask: [[[0, .43], [1, .43], [1, .6], [0, .6]]], tick: [4, 9],
  minLen: 20 };
let LOD = null;
async function diveLods(f) {
  const D = await import('../worlds/orbit/dive.js');
  if (!LOD) { const t0 = performance.now(); LOD = { A: D.lodA(), B: D.lodB(), C: D.lodC(), clouds: [D.cloudLayer(1.3), D.cloudLayer(4.1), D.cloudLayer(7.7)], R: D.river() }; console.log(`[orbit] dive lods ${Math.round(performance.now() - t0)} ms`); }
  return { D, L: LOD };
}
// the map's rotation: the river horizontal at the landing point, north-ish up
function mapRot(R) { let r = -R.ang; while (r > Math.PI / 2) r -= Math.PI; while (r < -Math.PI / 2) r += Math.PI; return r; }
const mapU = (S, rot, cx, cy) => affineU(S * Math.cos(rot), -S * Math.sin(rot), -S * Math.sin(rot), -S * Math.cos(rot), cx, cy);
const lodW = S => ({ A: (1 - sstep(10, 24, S)), B: sstep(4, 10, S) * (1 - sstep(150, 320, S)), C: sstep(55, 130, S) });
const DIVE = { S0: .4, S1: 380, tp: .95, te: 1.3 };
function diveScale(tau) { const u = clamp(tau / DIVE.tp); return Math.exp(lerp(Math.log(DIVE.S0), Math.log(DIVE.S1), u * u * (1.35 - .35 * u))); }
scene('S74', async f => {
  const W = f.W, H = f.H, s = H / 1080, t = f.t, tau = t - S74_T0, cx = W / 2, cy = H / 2;
  const { D, L } = await diveLods(f), E = await import('../worlds/orbit/earth.js');
  const rot = mapRot(L.R), Fc = 1.2 * W;
  const S = diveScale(tau), w = lodW(S), layers = [];
  const ground = tau > DIVE.tp, gu = clamp((tau - DIVE.tp) / (DIVE.te - DIVE.tp)), ge = easeInOut(gu);
  const groundK = 1 - sstep(1.28, 1.4, tau);
  if (!ground) {
    for (const [k, key] of [['A', 'dive-A'], ['B', 'dive-B'], ['C', 'dive-C']]) if (w[k] > .01) layers.push({ mesh: staticMesh(f, key, () => L[k]), u: { ...mapU(S, rot, cx, cy), uBright: w[k], uPulse: 0 } });
  } else {
    const h0 = Fc / DIVE.S1, cam = { x: 0, y: lerp(0, -.06, ge), h: Math.exp(lerp(Math.log(h0), Math.log(.0018), Math.pow(gu, .7))), pitch: lerp(Math.PI / 2, .006, ge), F: Fc, cx, cy, heading: -rot };
    if (groundK > .01) layers.push(dynLayer([...D.groundLines(L.C, cam, W, H, groundK), ...D.groundLines(L.B, cam, W, H, groundK * (1 - ge))], { uPulse: .2 }));
  }
  // the cloud deck: three layers scaled past the camera
  [-.08, .07, .22].forEach((ti, i) => {
    const d = tau - ti, env = sstep(-.22, -.04, d) * (1 - sstep(.06, .24, d)); if (env <= .01) return;
    const sc = .85 * W * Math.exp(4.8 * d), r0 = .3 * i + .25 * tau, c = Math.cos(r0) * sc, sn = Math.sin(r0) * sc;
    layers.push({ mesh: staticMesh(f, 'cloud-' + i, () => L.clouds[i]), u: { ...affineU(c, sn, -sn, c, cx, cy), uBright: 1.5 * env, uPulse: .3 } });
  });
  // the landing: P38 in lines, then paint
  const plateK = sstep(1.25, 1.37, tau), paintK = sstep(1.37, 1.6, tau);
  const flash = .16 * Math.exp(-Math.max(0, tau) / .035);
  await drawLines(f, {
    ...(plateK > .01 ? { src: P38_SRC, freeze: 0, trace: P38_TRACE, corona: false, plateU: { uBright: 1.3 * plateK } } : {}),
    layers, kick: 0, phase: audio.flowPhase(t) * .8, flash, disk: false, palette: BLUE,
    look: { glow: [.24 * (1 - paintK), .1 * (1 - paintK)], width: 1 + 2.2 * paintK, soft: .45 * paintK, flat: .5 * paintK },
  });
  const seaA = (1 - sstep(7, 22, S)) * sstep(.04, .22, tau) * (ground ? 0 : 1);
  if (seaA > .01) await E.mapFill(f, { cx, cy, S, rot, ll0: D.BEND, k: [111.32 * Math.cos(38.72 * Math.PI / 180), 110.9], shift: L.R.shift }, { alpha: seaA });
  if (paintK > .002) {
    const pc = await paintP38(f, t, 0), g = f.g;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = paintK; g.drawImage(pc, 0, 0, W, H); g.restore();
  }
  steer(f, { kick: 0 });
});

// ================================================================ S77: the pull-back (paint -> light -> ink)
// On the boom (262.72): S76's last painted frame (P38's last frame) evaporates into its lines as the camera booms up;
// the valley drops away (ground camera, level -> nadir), the map of Anatolia recedes, up through the cloud deck, the
// globe (blue again) with the Moon's shadow over Anatolia, the Moon swings past, the Earth settles at the size it has
// on her monitor, and the image shrinks into the monitor's sim panel as the bezel enters; the last frames dissolve into
// S78's first frame (her room), so the cut at 266.12 is invisible. The end framing is room.js's roomHandoff().
export const S77_T0 = 262.724, S77_T1 = 266.124;
shotOverride('S77', { cadence: 60 });
const S77P = { globe: [1.36, 2.72], moon: [1.85, 2.72], bezel: [2.62, 3.3], room: [3.14, 3.37] };
const UMBRA = { ll: [33.9, 38.4], r: 3.2, pen: 9.8, k: 1.15 };   // where the room's sim draws it
let _moonRef = null;
scene('S77', async f => {
  const W = f.W, H = f.H, s = H / 1080, t = f.t, tau = t - S77_T0, cx = W / 2, cy = H / 2;
  const { D, L } = await diveLods(f), E = await import('../worlds/orbit/earth.js');
  const rot = mapRot(L.R), Fc = 1.2 * W;
  // ---- weights of the phases
  const paintK = 1 - sstep(.05, .3, tau);
  const plateK = sstep(0, .08, tau) * (1 - sstep(.4, .54, tau));
  const gu = clamp((tau - .34) / (.8 - .34)), ge = easeInOut(gu), groundK = sstep(.3, .44, tau) * (1 - sstep(.76, .84, tau));
  const mu = clamp((tau - .78) / (1.5 - .78)), S = Math.exp(lerp(Math.log(DIVE.S1), Math.log(DIVE.S0), Math.pow(mu, 1.3)));
  const mapK = sstep(.74, .84, tau) * (1 - sstep(1.34, 1.42, tau));
  const gk = clamp((tau - S77P.globe[0]) / (S77P.globe[1] - S77P.globe[0])), globeK = sstep(S77P.globe[0], S77P.globe[0] + .1, tau);
  const bz = clamp((tau - S77P.bezel[0]) / (S77P.bezel[1] - S77P.bezel[0])), be = easeInOut(bz);
  const roomK = sstep(S77P.room[0], S77P.room[1], tau);
  const R = await import('./room.js'), HO = R.roomHandoff(W, H);
  const Rf = 410 * s, Ec = [W / 2, .44 * H];
  // ---- the world of light for this frame (into f.g, or a layer when it must shrink into the monitor)
  const target = bz > 0 ? f.layer(2) : null, fw = target ? { ...f, g: target.g } : f;
  const layers = [], plates = {};
  let V = null, occ = null;
  if (plateK > .01) Object.assign(plates, { src: P38_SRC, freeze: 5.0, trace: P38_TRACE, corona: false, plateU: { uBright: 1.3 * plateK }, cam: { pitch: -16 * easeIn(clamp(tau / .5)), zoom: 1 - .1 * clamp(tau / .5), pan: [0, 60 * s * clamp(tau / .5)] } });
  if (groundK > .01) {
    const h1 = Fc / DIVE.S1, cam = { x: 0, y: lerp(-.06, 0, ge), h: Math.exp(lerp(Math.log(.0018), Math.log(h1), Math.pow(gu, 1.4))), pitch: lerp(.006, Math.PI / 2, ge), F: Fc, cx, cy, heading: -rot };
    layers.push(dynLayer([...D.groundLines(L.C, cam, W, H, groundK), ...D.groundLines(L.B, cam, W, H, groundK * ge)], { uPulse: .2 }));
  }
  if (mapK > .01) { const w = lodW(S); for (const [k, key] of [['A', 'dive-A'], ['B', 'dive-B'], ['C', 'dive-C']]) if (w[k] > .01) layers.push({ mesh: staticMesh(f, key, () => L[k]), u: { ...mapU(S, rot, cx, cy), uBright: w[k] * mapK, uPulse: 0 } }); }
  // up through the cloud deck (layers shrinking past the camera)
  [1.22, 1.33, 1.44].forEach((ti, i) => {
    const d = tau - ti, env = sstep(-.22, -.04, d) * (1 - sstep(.06, .24, d)); if (env <= .01) return;
    const sc = .85 * W * Math.exp(-4.8 * d + 1.0), r0 = .3 * i - .25 * tau, c = Math.cos(r0) * sc, sn = Math.sin(r0) * sc;
    layers.push({ mesh: staticMesh(f, 'cloud-' + i, () => L.clouds[i]), u: { ...affineU(c, sn, -sn, c, cx, cy), uBright: 1.4 * env, uPulse: .3 } });
  });
  let moon = null;
  if (globeK > .01) {
    await E.earthReady(1);
    const ge2 = easeInOut(gk), Rs = Math.exp(lerp(Math.log(DIVE.S0 * 6371), Math.log(Rf), ge2));
    V = E.earthView({ lon0: lerp(34.85, 22, ge2), lat0: lerp(38.72, 24, ge2), roll: 0, D: 40, Rs, cx: lerp(cx, Ec[0], ge2), cy: lerp(cy, Ec[1], ge2), sun: EARTH_SUN, umbra: UMBRA });
    // the Moon swings past (closer than the Earth: it occludes it), ending small on the Sun's side
    const mk = clamp((tau - S77P.moon[0]) / (S77P.moon[1] - S77P.moon[0]));
    if (mk > 0) {
      const me = easeOut(mk);
      moon = { x: lerp(-.2 * W, .17 * W, me), y: lerp(1.3 * H, .7 * H, me), r: Math.exp(lerp(Math.log(1.05 * H), Math.log(.24 * Rf), me)) };
      occ = moon;
    }
    layers.push(dynLayer(E.earthLines(V, { W, H, minStep: 2.6, occ }), { uBright: globeK }));
    const stars = []; for (let i = 0; i < 160; i++) { const x = hash3(i, 77, 1) * W, y = hash3(i, 77, 2) * H; if (Math.hypot(x - V.cx, y - V.cy) < V.Rs * 1.05 || (moon && Math.hypot(x - moon.x, y - moon.y) < moon.r * 1.05)) continue; stars.push(dot(x, y, (.25 + 1.0 * Math.pow(hash3(i, 77, 3), 4)) * globeK, 1.4 + hash3(i, 77, 4), 0, FL.TIP | FL.SHARP)); }
    layers.push(dynLayer(stars));
    if (moon) {
      const { moonDisk } = await import('../worlds/orbit/moon.js');
      if (!_moonRef) _moonRef = moonDisk(0, 0, 400 * s, { sun: [-.85, -.35], sunZ: .15 });
      const k = moon.r / (400 * s);
      layers.push({ mesh: staticMesh(f, 'moon-disk', () => _moonRef), u: { ...affineU(k, 0, 0, k, moon.x, moon.y), uBright: .95, uPulse: 0 } });
      // the shadow cone from the Moon to the dot on the Earth (faint)
      const u = E.project(V, E.ll2v(...UMBRA.ll));
      if (u[2] > 1 / V.D) {
        const dx = u[0] - moon.x, dy = u[1] - moon.y, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
        const cone = [[[moon.x + nx * moon.r * .98, moon.y + ny * moon.r * .98], [u[0], u[1]]], [[moon.x - nx * moon.r * .98, moon.y - ny * moon.r * .98], [u[0], u[1]]]];
        layers.push(dynLayer(cone.map(pts => mkLine(pts, { b: .22 * mk, w: .8, o: .3, spd: 1.2 }))));
      }
    }
  }
  await drawLines(fw, { ...plates, layers, kick: 0, phase: audio.flowPhase(t) * .8, disk: false, palette: BLUE,
    look: { glow: [.24, .1], width: 1 + 1.6 * paintK, soft: .35 * paintK } });
  const seaA = (1 - sstep(7, 22, S)) * mapK;
  if (seaA > .01) await E.mapFill(fw, { cx, cy, S, rot, ll0: D.BEND, k: [111.32 * Math.cos(38.72 * Math.PI / 180), 110.9], shift: L.R.shift }, { alpha: seaA });
  if (V) await E.earthFill(fw, V, { occ, alpha: globeK });
  if (paintK > .002) { const pc = await paintP38(f, t, 5.0), g = fw.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = paintK; g.drawImage(pc, 0, 0, W, H); g.restore(); }
  // ---- into the monitor: the image shrinks into the sim panel, the bezel enters around it
  if (target) {
    const kEnd = HO.earth.r / Rf, sc = Math.exp(lerp(0, Math.log(kEnd), be));
    const c = [lerp(Ec[0], HO.earth.x, be), lerp(Ec[1], HO.earth.y, be)];
    const Tu = [sc, 0, 0, sc, c[0] - sc * Ec[0], c[1] - sc * Ec[1]];                  // frame -> screen now
    const m = sc / kEnd, Mu = [m, 0, 0, m, c[0] - m * HO.earth.x, c[1] - m * HO.earth.y];   // final screen -> screen now
    const g = f.g;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#06070b'; g.fillRect(0, 0, W, H);
    // the side monitor (bezel), its screen, the sim panel clipped: everything placed by Mu
    g.setTransform(...Mu);
    const q = HO.bezel, poly = (pts, grow = 0) => { const mx = (pts[0][0] + pts[2][0]) / 2, my = (pts[0][1] + pts[2][1]) / 2; g.beginPath(); pts.forEach(([x, y], i) => { const X = x + Math.sign(x - mx) * grow, Y = y + Math.sign(y - my) * grow; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); };
    g.fillStyle = '#15171d'; poly(q, 9 * s); g.fill();
    g.strokeStyle = 'rgba(243,239,230,.18)'; g.lineWidth = 1.2 * s / m; poly(q, 9 * s); g.stroke();
    g.fillStyle = '#0b0c10'; poly(q); g.fill();
    g.save(); poly(HO.panel); g.clip();
    g.setTransform(...Tu); g.drawImage(target.c, 0, 0, W, H);
    g.restore();
    g.restore();
    // the last frames dissolve into her room (S78's first frame, drawn by room.js): the cut is invisible
    if (roomK > .002) {
      const RL = f.layer(3), i78 = Math.ceil(266.12 * FPS - 1e-6);
      await f.drawScene('S78', { t: i78 / FPS, i: i78, d: 0, lt: 0, k: 0 }, RL.g);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = roomK; g.drawImage(RL.c, 0, 0, W, H); g.restore();
    }
  }
  steer(f, { kick: 0 });
});

// ================================================================ S63: swords into starships
// The kick (215.287): S62's sword, spinning at its apex (video/data/sword_handoff.json: {x, y} frame fractions of the
// blade's centre, angle = the blade's direction hilt -> point in degrees clockwise from straight up, len = blade length
// as a fraction of the frame height, spin deg/s; until it exists: frame centre, 30 deg) match-cuts to the starship in
// lines at the same place and angle; it rights itself onto its pad by the next kick and rises on a column of light.
// P34 1:1 from the kick (lift-off at plate ~3.4 s lands on the downbeat 218.677). Fierce: every kick pumps the exhaust
// (length, brightness, Mach diamonds, a pulse running down the column) and the line thickness.
export const S63_T0 = 215.287, S63_T1 = 222.077;
// rocket axis per 2 plate frames (source uv x 1000): [axis x, nose y, engine exit y] (production/review/drop2: measured)
const P34_AXIS = [497,146,876,497,146,876,497,146,876,497,146,876,497,146,876,497,146,876,497,146,874,497,146,874,498,144,874,498,144,874,498,144,872,497,144,872,497,144,870,497,143,868,497,141,868,497,141,867,496,139,865,496,137,863,496,137,861,496,135,859,496,133,857,496,133,856,496,133,854,497,132,852,497,132,848,497,130,846,497,128,843,497,126,839,497,122,835,497,122,830,497,120,826,498,118,822,498,118,820,498,117,815,498,115,811,498,113,806,498,111,800,498,107,794,498,106,787,499,100,778,499,98,770,499,96,767,499,93,757,499,91,752,499,91,748,499,91,739,499,91,737,499,91,732,499,91,726,499,93,722,499,96,718,500,100,715,500,104,711,500,107,706,501,111,702,501,115,694,501,118,691,501,122,685,501,128,680,502,132,676,502,137,670,502,141,663,502,146,656,502,148,648,503,152,641,503,156,630,504,156,620,504,156,609,504,156,598,505,156,585,506,157,576,507,159,565,507,165,557,509,170,550,509,176,543,510,180,533,511,182,524,512,187,515,512,189,507,514,189,494,515,189,485,515,189,474,516,189,463,516,187,452,516,187,446];
function p34Axis(tp) {
  const n = P34_AXIS.length / 3, x = clamp(tp * 12, 0, n - 1), i = Math.min(n - 2, Math.floor(x)), k = x - i, g = j => lerp(P34_AXIS[i * 3 + j], P34_AXIS[(i + 1) * 3 + j], k) / 1000;
  return { x: g(0), nose: g(1), eng: g(2) };
}
let SWORD = null;
async function swordHandoff() {
  if (SWORD) return SWORD;
  const { loadJSON } = await import('../assets.js');
  const j = await loadJSON('data/sword_handoff.json', { optional: true });
  return (SWORD = { x: .5, y: .5, angle: 30, len: .32, spin: 0, ...(j || {}) });
}
const P34_TRACE = { contourW: [1.3, 2.6], contourB: 1.75, innerB: 1.05, innerHi: .13, innerLo: .055, lightDir: [-.6, -.8], dsepMin: 2.6, dsepMax: 8.5, bgSepMin: 14, bgSepMax: 28, bgGain: .32,
  subjBright: [.35, 1.1], rim: 1, sky: { maxDepth: .04, soft: .03, below: .95 }, horizon: 1, horizonBand: .02, minLen: 18 };
// the column of light under the engines (analysis px; s grows away from the engine so pulses run down the column)
function exhaustLines(ex, ey, bottom, s, kick, t, ignite) {
  const out = [], N = 30, L = Math.max(20, (bottom - ey) * (.55 + .45 * ignite) * (1 + .18 * kick)), w0 = 5.5 * s, spread = .16;
  for (let j = 0; j < N; j++) {
    const u = (j / (N - 1) - .5) * 2, core = 1 - u * u, pts = [];
    for (let k = 0; k <= 26; k++) {
      const d = L * Math.pow(k / 26, 1.15), wob = 1.2 * s * Math.sin(d / (9 * s) + j * 1.7 + t * 9) * (d / L);
      pts.push([ex + u * (w0 + d * spread) + wob, ey + d, (.35 + 1.15 * core) * (1 + .9 * kick) * (1 - sstep(.45, 1, d / L)) * (.5 + .5 * ignite)]);
    }
    out.push(mkLine(pts, { w: .8 + .7 * core + .6 * kick, o: pts.map((p, k) => lerp(.05, .75, k / 26)), spd: 2.6 + .8 * core, phase: j * .9 }));
  }
  for (let m = 0; m < 5; m++) {                         // Mach diamonds, pulsing on the kick
    const yc = ey + (7 + m * 13 * (1 + .1 * kick)) * s, r = (5.5 - m * .8) * s * (1 + .25 * kick), b = (1.6 - .25 * m) * (1 + 1.2 * kick) * ignite;
    out.push(mkLine([[ex, yc - r * 1.5], [ex + r * .7, yc], [ex, yc + r * 1.5], [ex - r * .7, yc], [ex, yc - r * 1.5]], { b, w: 1.1, o: .2, flags: FL.NOFADE }));
  }
  return out.filter(Boolean);
}
scene('S63', async f => {
  const W = f.W, H = f.H, s = H / 1080, t = f.t, tp = Math.max(0, t - S63_T0), sw = await swordHandoff();
  const kick = audio.kickEnv(t, .12), aw = Math.round(960 * Math.max(W, H) / 1920), ah = Math.round(aw / (W / H)), S = W / aw;
  const ax = p34Axis(tp), piv = [ax.x * aw, (ax.nose + ax.eng) / 2 * ah];
  // the match cut: at the sword's place and angle, upright by the second kick
  const k2 = snap(audio.kickTimes().find(k => k > S63_T0 + .1) || S63_T0 + .43), u = clamp((t - S63_T0) / (k2 - S63_T0)), e = easeInOut(u);
  const th0 = (sw.angle + (sw.spin || 0) * (t - S63_T0) * (1 - u)) * Math.PI / 180, th = th0 * (1 - e);
  const zoom = lerp(1.16, 1, easeOut(u)), off = [(sw.x * W - piv[0] * S) / S * (1 - e), (sw.y * H - piv[1] * S) / S * (1 - e)];
  const X = placeU(piv[0], piv[1], th, zoom, off[0], off[1]);
  const plateU = { uXf0: X.uXf0, uXf1: X.uXf1 };
  // the column of light: ignition builds over the first bar, every kick pumps it
  const ignite = .35 + .65 * sstep(0, 1.6, tp), bottom = Math.max(ax.eng * ah + 40 * s, tp < 3.3 ? .9 * ah : ah + 60);
  const exh = exhaustLines(piv[0], ax.eng * ah, bottom, aw / 960, kick, t, ignite);
  const engS = [(X.uXf0[0] * piv[0] + X.uXf0[1] * ax.eng * ah + X.uXf0[2]) * S, (X.uXf1[0] * piv[0] + X.uXf1[1] * ax.eng * ah + X.uXf1[2]) * S];
  const flash = .1 * Math.exp(-(t - snap(S63_T0)) / .03);
  await drawLines(f, {
    src: { plate: 'P34', standin: 'master' }, tp, chainFrom: 0, trace: P34_TRACE, corona: false, plateU,
    layers: [{ lines: exh, u: { uXf0: X.uXf0, uXf1: X.uXf1, uS: S, uOff: [0, 0], uT: audio.flowPhase(t) * 2.2, uPulse: .75, uKick: kick, uPush: [engS[0], engS[1], 10 * kick * s, 260 * s] } }],
    kick, kickWidth: 1.35, kickPush: 20, pushCenter: engS, phase: audio.flowPhase(t) * 1.15, flash, disk: false, look: { glow: [.25, .1] },
  });
  steer(f, { kick, field: { center: engS } });
});
