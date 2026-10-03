// drop2.js: ORBIT, S63-S74 (Drop 2: swords into starships, the eclipse cascade, Earthset, the dive) and S77 (the
// pull-back). Owner: ORBIT agent. Built on the line engine (src/worlds/line/) plus src/worlds/orbit/.
//
// Beat sync: cuts are the shot list's downbeats; kicks (timing.json events.kicks, snapped to the master frame grid by
// audio.js) drive line thickness, the radial push, the gear ticks and the starship's exhaust; the wordless topline
// (curves.vocal, smoothed) lets slow motion breathe. The ring is locked at (W/2, H/2) through S64-S71.
// Type: every scene sets f.type (sun/field/kick/light) for the era captions, HOME and the THROW DOWN chops.

import { scene, shotOverride } from '../registry.js';
import { drawLines, staticMesh, dynLayer, coronaRing, ringU, audio, proc, FL, resolve, sourceFields } from '../worlds/line/index.js';
import { clamp, lerp, sstep, smooth, easeInOut, easeOut, hash3, TAU } from '../core.js';
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
