// act1.js: BRONZE, S01-S34 (0.00-110.58 s): the cold open, the intro, the boom, first contact, verse 1, the
// pre-chorus and chorus 1, painted by the brush engine (video/src/worlds/brush/). Owner: the brush-engine agent.
//
// Every shot resolves its plate (video/plates/P##/ when index.json lists it, else its designated look-dev stand-in
// under a slow synthetic camera), designs its light pool, and lets the eclipse clock (brush/eclipse.js: first contact
// 46.49, totality exactly 110.58) drive the bite, the colour drain and the metallic light. The sky, the sun, the bite,
// Jupiter, Baily's beads, the diamond ring, the corona, the umbra, the crescents and the arrow are procedural paint.
// Type is drawn by video/src/type/ after the scene; each scene hands it f.type (light, sun disk, front, pupil, disk).
//
// Inserts: three moments need frame-exact timing inside 12 fps shots, so they run as short 60 fps insert shots:
// the diamond-ring blink (S02f, 1.45-1.60), the clash flash (S11f, 2 frames at 27.24) and the orange-disc intrusion
// (S29i, 10 frames at 93.95). The parent shots are trimmed around them with shotOverride.

import { scene, shot, shotOverride } from '../registry.js';
import { PLATES, plateMetaAt } from '../plates.js';
import { paint, resolvePlate, canvasSource, diptychSource, hasPlate, eclipse, plateTimeOf, camAt, camXform } from '../worlds/brush/index.js';
import * as PR from '../worlds/brush/procedural.js';
import { rewindSwirl, blackPupil, pupilAt } from '../worlds/transitions.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => k * k * (3 - 2 * k);
const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a)));
const kf = (t, keys) => { if (t <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return va + (vb - va) * smooth((t - a) / (b - a)); } return keys[keys.length - 1][1]; };
const seg = (t, a, b) => clamp((t - a) / (b - a));
const DBG = new URLSearchParams(location.search).get('bdebug'), LOG = new URLSearchParams(location.search).has('blog'), VAR = new URLSearchParams(location.search).get('bvar');
const VARS = { timing: { timing: 1 }, canvas: { debugCanvas: 1 }, nomat: { _nomat: 1 }, lab: { fg: [1.45, 1.3, 1.15, 1.05, 1.0], maxLen: [6, 6, 5, 4, 3] }, nounder: { underAlpha: 0 }, nofine: { smoothRef: 0 } };

// plate time 0 = the start of the song window each plate was generated against (tools/plate_specs.py t_song)
const T0 = { P01: 7.18, P02: 0, P03: 14.19, P04: 17.66, P05: 21.15, P06: 21.15, P07: 25.5, P08: 26.0, P09: 32.47, P10: 35.98, P11: 39.48, P12: 44.73,
  P13: 58.72, P14: 65.67, P15: 74.41, P16: 81.36, P17: 85.91, P18: 89.22, P19: 93.0, P20: 100.24, P21: 103.64, P22a: 105.85, P22b: 105.85, P23: 3.65 };
// shots that reuse a plate at another song time map song -> plate time explicitly (keys [[songT, plateT], ...])
const KEYS = {
  S04: { P01: [[5.40, 1.78], [7.18, 0]] },              // the rewind runs the plate backwards
  S06: { P01: [[10.69, 3.51], [14.19, 7.01]] }, S16: { P01: [[41.24, 7.0], [44.73, 10.49]] }, S20: { P01: [[55.22, 10.5], [58.72, 14.0]] },
  S24: { P01: [[67.42, 3.0], [74.41, 9.99]] }, S30: { P01: [[96.89, 11.0], [100.24, 14.35]] },
  S19: { P12: [[51.72, 4.5], [55.22, 8.0]] }, S27: { P12: [[84.83, .9], [87.68, 3.75]] },   // S27 starts on the bar-49 downbeat (84.83) S18: { P12: [[46.49, 1.5], [51.72, 6.73]] },
  S22: { P05: [[62.2, 2.5], [65.67, 5.97]], P06: [[62.2, 2.5], [65.67, 5.97]] },
  S15: { P11: [[39.48, .5], [40.357, 1.6], [40.358, 3.3], [41.24, 4.4]] },   // the plate itself cuts from the Lydian to the Mede
  S31: { P20: [[100.24, 0], [102.21, 2.0], [103.64, 3.4]] },
};
// resolvePlate with this act's plate timing
function rp(f, id, standin, cam, o = {}) {
  const sid = f.shot.parent || f.shot.id, keys = KEYS[sid] && KEYS[sid][id];
  return resolvePlate(f, id, standin, cam, keys ? { keys, ...o } : { at: T0[id], ...o });
}

// ---------------------------------------------------------------- the eclipse state at song time t
// m: magnitude (fraction of the diameter covered); eL: how far the light has gone strange (colour drain, metallic,
// sharper shadows: nothing until ~45 %, then fast); night: the sky's darkness near totality; ring: the 360° horizon glow
export function E(t) {
  const off = eclipse.moonOffset(t), m = eclipse.magnitude(t);
  return { off, m, eL: sstep(.45, 1.0, m), night: sstep(.94, 1.0, m), ring: sstep(.96, 1.0, m), jup: eclipse.jupiterVis(t), obsc: eclipse.obscuration(off) };
}

// the Altdorfer sky through the day: a fiery vortex around the low sun; near totality the dome darkens, colour drains
// and a sunset glow rings the horizon
function SKY(t, o = {}) {
  const e = E(t);
  return { vortex: .22, twist: 1.45, arms: 3, cover: .55, glow: 1, drama: .6, fire: .9, glowR: .2, zenith: .16, gapHi: .74, horizon: .7,
    night: e.night * .92, ring: e.ring, ...o };
}
// the sun: position (frame uv), radius (fraction of width); the moon from the eclipse clock unless scripted
function SUN(t, o = {}) {
  const e = E(t);
  const s = { alt: 9, off: e.off, beads: e.m > .975 && e.m < 1.02, ...o };
  if (o.ppd && e.jup > 0 && o.jupiter !== false) s.jupiter = { ppd: o.ppd, k: e.jup };
  return s;
}

// light pools from the source's detected faces (plate meta / stand-in faces.json): a key on each face and a softer pool
// on the body below it; falls back to the designed pools when nothing is detected
function facePools(src, o = {}) {
  const out = [];
  for (const q of src.faces || []) {
    const [u0, v0, u1, v1] = q.box, w = u1 - u0, h = v1 - v0;
    if (w < (o.minW ?? .03)) continue;
    const x = (u0 + u1) / 2 + (o.shift || 0) * w, y = (v0 + v1) / 2;
    out.push({ x, y, rx: w * (o.face ?? .8), ry: h * .72, feather: .7, k: o.kFace ?? 1, fig: true });
    if (o.body !== 0) out.push({ x: x + (o.bodyShift || 0) * w, y: y + h * 1.9, rx: w * 1.5, ry: h * 2.0, feather: .8, k: o.body ?? .6 });
  }
  return out.length ? out : (o.fallback || []);
}

// paint + hand the scene's light to the type module
async function bronze(f, src, o) {
  const e = E(f.t);
  const mfd = o.matteFromDepth !== undefined ? o.matteFromDepth : (!src.matte && src.depth && src.info && src.info.kind === 'plate' ? [.3, .5] : null);
  const look = await paint(f, src, { eclipse: o.eclipse ?? e.eL, ...o, ...(VAR ? VARS[VAR] : {}), matteFromDepth: mfd, debug: DBG || o.debug });
  if (LOG) console.log(f.shot.id, f.d, JSON.stringify(look.perLayer), look.strokes, look.ntri, JSON.stringify(look.ms), JSON.stringify(look.place || {}), JSON.stringify(look.gpu || {}));
  const T = f.type || (f.type = {});
  const eL = o.eclipse ?? e.eL;
  T.light = T.light || { dir: o.lightDir || [-.75, -.66], elev: o.lightElev ?? .42, color: eL > .55 ? '#dcd6ca' : o.lightColor || '#f6c878', intensity: o.typeIntensity ?? (1.05 - .35 * eL), cool: clamp(eL * 1.1) };
  T.magnitude = e.m;
  if (look.sun && !T.sun) T.sun = { x: look.sun.px[0], y: look.sun.px[1], r: look.sun.px[2] };
  return look;
}

// a plate's own sun (meta: brightest blob) mapped through the camera into frame uv; null when the plate has none
async function plateSunUV(f, id, cam) {
  if (!hasPlate(id)) return null;
  const sid = f.shot.parent || f.shot.id, keys = KEYS[sid] && KEYS[sid][id];
  const P = PLATES[id], tp = plateTimeOf(f.shot, f.t, keys ? { keys } : { at: T0[id] }), meta = await plateMetaAt(id, tp);
  if (!meta || !meta.sun || meta.sun[2] < .25) return null;
  const c = camAt(cam, f), X = camXform(c, P.w, P.h, f.W / 2, f.H / 2), p = [0, 0];
  X.inv(meta.sun[0] * P.w, meta.sun[1] * P.h, p);
  return [(p[0] + .5) / (f.W / 2), (p[1] + .5) / (f.H / 2)];
}

// ---------------------------------------------------------------- the master composition (P01 by day, P02 at totality)
// Looking downstream WNW: the red river runs straight to the low sun at the vanishing point, Lydians on the left bank,
// Medes on the right. Stand-in until P01 lands: c_armies (river toward a far bend under the sun).
const WIDE = {
  standin: { id: 'c_armies' },
  sunStandin: [.515, .19], horizonStandin: .285,
  // light: the glitter path of the river under the sun, the two front lines rim-lit equally, the far valley glowing
  poolsStandin: [{ x: .53, y: .62, rx: .1, ry: .5, rot: -.15, feather: .8, k: .95 }, { x: .5, y: .36, rx: .5, ry: .1, feather: .9, k: .7 },
    { x: .3, y: .62, rx: .22, ry: .16, rot: .35, feather: .8, k: .75 }, { x: .78, y: .68, rx: .2, ry: .2, rot: -.2, feather: .8, k: .75 }],
  poolsPlate: [{ x: .5, y: .62, rx: .12, ry: .45, feather: .8, k: .95 }, { x: .5, y: .42, rx: .55, ry: .12, feather: .9, k: .7 },
    { x: .22, y: .7, rx: .2, ry: .25, rot: .3, feather: .8, k: .72 }, { x: .78, y: .7, rx: .2, ry: .25, rot: -.3, feather: .8, k: .72 }],
};
async function wideSource(f, cam, plate = 'P01', standinCam = null) {
  return rp(f, plate, { id: WIDE.standin.id, cam: standinCam || cam }, cam);
}
async function wideLook(f, cam, o = {}) {
  const plate = o.plate || 'P01', real = hasPlate(plate);
  let sun = real ? await plateSunUV(f, plate, cam) : null;
  const sc = camAt(o.standinCam || cam, f);
  if (!sun) {                                          // stand-in (or a plate without a visible sun): the designed position
    const [u, v] = real ? (o.sunPlate || [.5, .3]) : WIDE.sunStandin;
    sun = [(u - sc.cx) * sc.zoom + .5, (v - sc.cy) * sc.zoom + .5];
  }
  const hz = real ? (o.horizonPlate ?? .4) : (WIDE.horizonStandin - sc.cy) * sc.zoom + .5;
  const pools = (real ? WIDE.poolsPlate : WIDE.poolsStandin).map(p => real ? { ...p } : { ...p, x: (p.x - sc.cx) * sc.zoom + .5, y: (p.y - sc.cy) * sc.zoom + .5, rx: p.rx * sc.zoom, ry: p.ry * sc.zoom });
  return { sun, hz, pools, real };
}
const wideOpts = (t, L, o = {}) => ({
  pool: L.pools, poolMatte: 0, envDim: .85, lightDir: [L.sun[0] - .5, L.sun[1] - .62],
  sky: SKY(t, { maxDepth: L.real ? .02 : .012, soft: .02, below: L.hz + .04, horizonY: L.hz, ...(o.sky || {}) }),
  sun: SUN(t, { x: L.sun[0], y: L.sun[1], r: o.sunR ?? .026, ppd: o.ppd ?? 16, ...(o.sun || {}) }),
  crushFloor: .14, crush: .3, satOut: .6, glintReach: 30, accents: .5, aerial: { color: [.72, .52, .32], near: .45, far: .05, k: .45 },
  T: [0, .06, .07, .095, .11], midGate: .2, fineGate: .3, ...o.extra,
});

// ---------------------------------------------------------------- S01 THE EYE · S02 the blink · the battlefield at totality
// The eclipse fills ~60 % of the frame: a black pupil, an iris of painted corona fibres that ripple, a broken ring of
// madder-pink prominences, Jupiter a hard point upper left; the dark battlefield (master composition at totality) below.
const EYE = { x: .5, y: .4, rMoon: .118 };              // moon radius as a fraction of frame HEIGHT
async function eyeFrame(f, o = {}) {
  const t = f.t, W = f.W, H = f.H, hzTarget = .79;
  const real = hasPlate('P02');
  const z = 1.25, cam = real ? { cx: .5, cy: .52 - (hzTarget - .5) / z, zoom: z } : { cx: .5, cy: WIDE.horizonStandin - (hzTarget - .5) / z, zoom: z };
  const src = await rp(f, 'P02', { id: 'c_armies', cam }, cam);
  const rSun = EYE.rMoon * H / eclipse.K / W;
  return bronze(f, src, {
    eclipse: 1, pool: [{ x: .5, y: .86, rx: .5, ry: .08, feather: .9, k: .55 }], poolMatte: 0, envDim: .7, lightDir: [0, -1],
    sky: SKY(t, { maxDepth: real ? .02 : .012, soft: .02, below: hzTarget + .03, horizonY: hzTarget, night: .96, ring: 1, glow: 0, drama: .2, cover: .62, fire: .2 }),
    sun: { x: EYE.x, y: EYE.y, r: rSun, off: o.off ?? 0, moonVis: 1, limb: [1.6 + (o.ring || 0) * 2, 2.2, 1, -Math.PI * .66], ring: o.ring || 0,
      ringAng: -Math.PI * .66, jupiter: { x: .2, y: .14 }, vis: 0 },
    corona: { k: o.corona ?? 1, iris: 1, scale: 1.25, tilt: -.35, t },
    crushFloor: .08, crush: .25, satOut: .5, accents: .2, crack: .3, T: [0, .07, .08, .1, .12], midGate: .3, fineGate: .4,
    exposure: o.exposure ?? 1, ...o.extra,
  });
}
scene('S01', async f => { await eyeFrame(f); f.type.sun = { x: f.W * EYE.x, y: f.H * EYE.y, r: f.H * EYE.rMoon }; });

// the blink (1.45-1.60, 60 fps insert): a diamond ring bursts on the limb at 11 o'clock, the brightest event of the opening
shot({ id: 'S02f', t0: 1.45, t1: 1.60, world: 'bronze', cadence: 60, scene: 'S02f', parent: 'S02', params: { label: 'S02 diamond-ring blink' } });
scene('S02f', async f => {
  const k = seg(f.t, 1.45, 1.60), burst = Math.pow(Math.sin(Math.PI * clamp(k * 1.15)), .7);
  await eyeFrame(f, { ring: 3.2 * burst + .2, off: .07, exposure: 1 + .5 * burst, corona: 1 - .4 * burst, extra: { drawIdx: Math.round(1.45 * 12) } });
  f.type.flash = burst;
});
// the frozen battlefield at totality (1.60-3.65): the master composition painted dark, the black sun at the vanishing point
shotOverride('S02', { t0: 1.60 });
scene('S02', async f => {
  const t = f.t, cam = { cx: .5, cy: .5, zoom: 1.04 - .02 * f.k }, plate = hasPlate('P02') ? 'P02' : 'P01';
  const L = await wideLook(f, cam, { plate, sunPlate: [.5, .34], horizonPlate: .5 });
  const src = await wideSource(f, cam, plate);
  await bronze(f, src, wideOpts(t, L, {
    sunR: .022, ppd: 17, sky: { night: .95, ring: 1, glow: 0, drama: .25, fire: .25 },
    sun: { off: 0, moonVis: 1, limb: [1.4, 1.6, .6, -Math.PI * .66], beads: false },
    extra: { eclipse: 1, corona: { k: .9, iris: .25, scale: .8 }, crushFloor: .07, envDim: .55, pool: L.pools.map(p => ({ ...p, k: p.k * .55 })) },
  }));
});

// ---------------------------------------------------------------- S03: the two heroes in the shallows, faces turned up (totality)
scene('S03', async f => {
  const cam = k => ({ cx: .5, cy: .44, zoom: 1.12 + .03 * k });
  const src = await rp(f, 'P23', { id: 'a_duel', cam }, { cx: .5, cy: .5, zoom: 1.02 + .02 * f.k });
  await bronze(f, src, {
    eclipse: 1, lightDir: [0, -1], lightColor: '#dcd6ca',
    pool: [{ x: .4, y: .3, rx: .1, ry: .22, feather: .7, k: .8 }, { x: .62, y: .32, rx: .1, ry: .22, feather: .7, k: .8 }, { x: .5, y: .55, rx: .3, ry: .4, feather: .8, k: .45 }],
    poolMatte: .35, envDim: .55, faceMin: .4, crushFloor: .07, crush: .2,
    sky: SKY(f.t, { maxDepth: .006, soft: .01, below: .16, horizonY: .12, night: .95, ring: 1, glow: 0, fire: .2 }),
  });
});

// ---------------------------------------------------------------- S04: the rewind (the eclipse un-happens)
// The strokes wind backwards around the sun while the moon slides back off it; the light returns to full gold.
scene('S04', async f => {
  const t = f.t, cam = { cx: .5, cy: .5, zoom: 1.06 - .04 * f.k };
  const L = await wideLook(f, cam);
  const src = await wideSource(f, cam);
  const W = f.W, H = f.H, sx = L.sun[0] * W, sy = L.sun[1] * H;
  const e = E(t);
  await bronze(f, src, wideOpts(t, L, {
    sun: { beads: e.off < .16, moonVis: sstep(.25, .08, e.off), limb: e.off < .2 ? [1.2 * sstep(.2, .07, e.off), 1.5, .5, -Math.PI * .66] : null },
    extra: { swirl: rewindSwirl(f.k, sx, sy, W, { amount: 3.4 }), corona: e.off < .3 ? { k: sstep(.3, .06, e.off), iris: .2, scale: .7 } : null },
  }));
});

// ---------------------------------------------------------------- S05 title · S06 descent · S16 · S20 · S24 (the master wide by day)
scene('S05', async f => {
  const cam = { cx: .5, cy: .5, zoom: 1.0 + .025 * f.k };
  const L = await wideLook(f, cam);
  await bronze(f, await wideSource(f, cam), wideOpts(f.t, L, { sky: { drama: .55 } }));
});
scene('S06', async f => {
  // slow descent toward the river: tilt down and push in, the horizon rising out of frame
  const k = smooth(f.k), cam = { cx: .5, cy: .5 + .1 * k, zoom: 1.0 + .22 * k };
  const L = await wideLook(f, cam);
  await bronze(f, await wideSource(f, cam), wideOpts(f.t, L, {}));
});
scene('S16', async f => {
  const cam = { cx: .5, cy: .5, zoom: 1.0 + .02 * f.k };
  const L = await wideLook(f, cam);
  await bronze(f, await wideSource(f, cam), wideOpts(f.t, L, { sunR: .034, sky: { drama: .7, fire: 1, vortex: .26 } }));
});
scene('S20', async f => {
  const cam = { cx: .5, cy: .5, zoom: 1.04 - .02 * f.k };
  const L = await wideLook(f, cam);
  await bronze(f, await wideSource(f, cam), wideOpts(f.t, L, { sunR: .03 }));
});
scene('S24', async f => {
  const cam = { cx: .5, cy: .5, zoom: 1.0 + .03 * f.k };
  const L = await wideLook(f, cam);
  await bronze(f, await wideSource(f, cam), wideOpts(f.t, L, { sunR: .03, sky: { drama: .65 } }));
});

// ---------------------------------------------------------------- S07 the Lydian arms · S08 the Mede, his mirror
scene('S07', async f => {
  const real = hasPlate('P03');
  const src = await rp(f, 'P03', { id: 'b_face', cam: k => ({ cx: .58, cy: .45, zoom: 1.0 + .04 * k, mirror: true }) }, k => ({ cx: .44, cy: .44, zoom: 1.1 + .04 * k }));
  // P03: lit from screen right; the key on his face (tracked from the plate's face detection), the knucklebone at his
  // chest catching the light, the soldiers on the horizon and the sky gone to umber
  await bronze(f, src, real ? {
    lightDir: [.92, -.38], pool: facePools(src, { shift: .15, body: .4, fallback: [{ x: .42, y: .3, rx: .12, ry: .3, feather: .7, k: 1 }] }),
    poolFromLight: { k: .9, bg: .25 }, poolMatte: .2, faceMin: .3, crushFloor: .08, crush: .16, envDim: .7, rim: .8, glintReach: 18,
  } : {
    lightDir: [.75, -.66], pool: [{ x: .44, y: .45, rx: .2, ry: .5, rot: .25, feather: .7 }], poolMatte: .55, poolBound: { x: .42, y: .45, rx: .3, ry: .6, feather: .5 },
    faceMin: .7, crushFloor: .1, brushes: [24, 13, 7.5, 4.2, 2.4],
  });
});
scene('S08', async f => {
  const real = hasPlate('P04');
  const src = await rp(f, 'P04', { id: 'b_face', cam: k => ({ cx: .55, cy: .45, zoom: 1.0 + .04 * k }) }, k => ({ cx: .58, cy: .44, zoom: 1.1 + .04 * k }));
  // P04, the mirror of P03: the Mede faces left, lit from screen left; his spear a vertical bar of light
  await bronze(f, src, real ? {
    lightDir: [-.92, -.38], pool: facePools(src, { shift: -.15, body: .4, fallback: [{ x: .62, y: .3, rx: .12, ry: .3, feather: .7, k: 1 }] }),
    poolFromLight: { k: .9, bg: .25 }, poolMatte: .2, faceMin: .3, crushFloor: .08, crush: .16, envDim: .7, rim: .8, glintReach: 18,
  } : {
    lightDir: [-.75, -.66], pool: [{ x: .56, y: .45, rx: .2, ry: .5, rot: -.25, feather: .7 }], poolMatte: .55, poolBound: { x: .58, y: .45, rx: .3, ry: .6, feather: .5 },
    faceMin: .7, crushFloor: .1, brushes: [24, 13, 7.5, 4.2, 2.4],
  });
});

// ---------------------------------------------------------------- S09 / S22 / S33: diptychs (the type module draws the gold divider)
async function diptych(f, A, B, o) {
  const src = await diptychSource(f,
    sz => rp(f, A.plate, A.standin, A.cam, sz),
    sz => rp(f, B.plate, B.standin, B.cam, sz));
  return bronze(f, src, typeof o === 'function' ? o(src) : o);
}
// Alyattes (P05, left, facing right) and Cyaxares (P06, right, facing left): each plate framed as an 8:9 panel on the king
const KINGS = {
  A: { plate: 'P05', standin: { id: 'a_duel', cam: k => ({ cx: .385, cy: .4, zoom: 1.65 + .05 * k }) }, cam: k => ({ cx: .41, cy: .45, zoom: 1.04 + .03 * k }) },
  B: { plate: 'P06', standin: { id: 'a_duel', cam: k => ({ cx: .63, cy: .42, zoom: 1.65 + .05 * k }) }, cam: k => ({ cx: .5, cy: .45, zoom: 1.04 + .03 * k }) },
};
const kingsOpts = src => ({
  lightDir: [-.6, -.8], poolMatte: .35, poolFromLight: { k: .85, bg: .25 },
  pool: [...facePools(src, { body: .55 }), { x: .25, y: .3, rx: .12, ry: .3, feather: .7, k: .6 }, { x: .75, y: .3, rx: .12, ry: .3, feather: .7, k: .6 }],
  faceMin: .3, crushFloor: .09, crush: .18, envDim: .62, sky: SKY(0, { maxDepth: .03, soft: .03, below: .6, horizonY: .55, drama: .4, glow: .6 }),
});
scene('S09', async f => { await diptych(f, KINGS.A, KINGS.B, kingsOpts); });
scene('S22', async f => { await diptych(f, KINGS.A, KINGS.B, kingsOpts); });

// ---------------------------------------------------------------- S10 the front lines surge into the river · S11 the clash
scene('S10', async f => {
  const src = await rp(f, 'P07', { id: 'a_duel', cam: k => ({ cx: .5, cy: .66 - .03 * k, zoom: 1.35 + .05 * k }) }, k => ({ cx: .5, cy: .5, zoom: 1.02 + .03 * k }));
  await bronze(f, src, { lightDir: [-.7, -.7], pool: [{ x: .5, y: .45, rx: .4, ry: .35, feather: .8, k: .9 }, { x: .5, y: .85, rx: .45, ry: .2, feather: .8, k: .6 }], poolMatte: .6, envDim: .65, crushFloor: .1 });
});
// the clash: shields slam on the boom; a crown of red spray explodes up into the light pool; a 2-frame warm flash at 27.24
shot({ id: 'S11f', t0: 27.24, t1: 27.24 + 2 / 60, world: 'bronze', cadence: 60, scene: 'S11', parent: 'S11', params: { label: 'S11 warm flash', flash: 1 } });
shotOverride('S11', { t0: 27.24 + 2 / 60 });
scene('S11', async f => {
  const real = hasPlate('P08'), pcam = k => ({ cx: .52, cy: .52, zoom: 1.06 + .06 * Math.sqrt(k) });
  const src = await rp(f, 'P08', { id: 'a_duel', cam: k => ({ cx: .5, cy: .56, zoom: 1.28 + .1 * Math.sqrt(k) }) }, pcam);
  const flash = f.params.flash ? 1 : 0;
  const sun = real ? (await plateSunUV(f, 'P08', pcam)) || [.88, .27] : null;
  // P08: the sun low behind the Medes; the key is ours: one warm pool on the shields meeting and the red spray above them
  await bronze(f, src, real ? {
    lightDir: [.7, -.7], lightPoint: sun,
    pool: [{ x: .5, y: .5, rx: .22, ry: .42, feather: .7, k: 1, fig: true }, { x: .5, y: .16, rx: .16, ry: .2, feather: .7, k: .95 }, ...facePools(src, { body: .4 })],
    poolFromLight: { k: .6, bg: .2 }, liftDark: .45, poolMatte: .3, envDim: .6, crushFloor: .08, rim: .9, faceMin: .3,
    sky: SKY(f.t, { maxDepth: .03, soft: .03, below: .32, horizonY: .26, drama: .45, glow: 1.1 }),
    sun: SUN(f.t, { x: sun[0], y: sun[1], r: .024 }),
    warmFlash: flash * .55, exposure: 1 + flash * .35, accents: 1.2, drawIdx: flash ? 9999 : undefined,
  } : {
    lightDir: [-.7, -.7], pool: [{ x: .5, y: .62, rx: .3, ry: .4, feather: .7, k: 1 }, { x: .5, y: .3, rx: .3, ry: .25, feather: .8, k: .7 }], poolMatte: .6, envDim: .65, crushFloor: .1,
    warmFlash: flash * .55, exposure: 1 + flash * .35, accents: 1.2, drawIdx: flash ? 9999 : undefined,
  });
});

// ---------------------------------------------------------------- S12: lull, one arrow arcs across the low golden disk
const BIGSUN = { x: .5, y: .47, r: .13, hz: .83 };
scene('S12', async f => {
  const t = f.t, k = f.k;
  const src = await canvasSource(f, 'horizon-s12', PR.horizonCanvas({ horizonY: BIGSUN.hz, vanishX: .5 }), { sky: PR.horizonSkyMask({ horizonY: BIGSUN.hz }), cache: true });
  // the arrow: a slow arc across the disk (ease in-out), seen dark against the sun; its shaft tilts with the arc
  const W = f.W, H = f.H, arcY = u => (BIGSUN.y + .24 - .5 * Math.sin(Math.PI * clamp(u * .9 + .05))) * H;
  const u = lerp(-.12, 1.12, smooth(k)), px = u * W, py = arcY(u), ang = Math.atan2(arcY(u + .01) - py, W * .01);
  await bronze(f, src, {
    lightDir: [0, -1], pool: [{ x: .5, y: .92, rx: .5, ry: .12, feather: .8, k: .6 }], poolMatte: 0, crushFloor: .12,
    sky: SKY(t, { horizonY: BIGSUN.hz, glowR: .32, glow: 1.1, drama: .25, cover: .6, vortex: .35, twist: .6, haze: .4, fire: .6 }),
    sun: { x: BIGSUN.x, y: BIGSUN.y, r: BIGSUN.r, alt: 6, off: 2.4 },
    overStrokes: ({ pal }) => PR.arrowStrokes({ x: px, y: py, ang, len: W * .16, pal, smear: W * .02 }),
    accents: 0, T: [0, .06, .07, .1, .12],
  });
});

// ---------------------------------------------------------------- S13 Lydian cavalry · S14 Median archers loose a volley · S15 they see each other
scene('S13', async f => {
  const src = await rp(f, 'P09', { id: 'c_armies', cam: k => ({ cx: .16 + .03 * k, cy: .79, zoom: 2.6 + .1 * k }) }, k => ({ cx: .5, cy: .5, zoom: 1.02 + .04 * k }));
  await bronze(f, src, { lightDir: [-.6, -.8], pool: [{ x: .5, y: .5, rx: .45, ry: .4, feather: .8, k: .9 }], poolMatte: .5, envDim: .7, crushFloor: .11, accents: .9,
    sky: hasPlate('P09') ? SKY(f.t, { maxDepth: .02, soft: .02, below: .45, horizonY: .35 }) : null });
});
scene('S14', async f => {
  const src = await rp(f, 'P10', { id: 'c_armies', cam: k => ({ cx: .79 - .02 * k, cy: .63, zoom: 2.3 + .08 * k }) }, k => ({ cx: .5, cy: .5, zoom: 1.02 + .04 * k }));
  const W = f.W, H = f.H, vk = seg(f.t, 37.3, 39.4);
  const real = hasPlate('P10');
  await bronze(f, src, { lightDir: real ? [.85, -.5] : [-.6, -.8], lightPoint: real ? [1.15, .3] : null,
    pool: real ? [...facePools(src, { body: .45, kFace: 1 }), { x: .3, y: .4, rx: .25, ry: .35, feather: .8, k: .7, fig: true }] : [{ x: .5, y: .45, rx: .45, ry: .4, feather: .8, k: .9 }],
    poolFromLight: real ? { k: .7, bg: .25 } : null, liftDark: real ? .4 : 0, poolMatte: .3, envDim: .62, crushFloor: .08, faceMin: .3, rim: .9,
    sky: real ? SKY(f.t, { maxDepth: .03, soft: .03, below: .5, horizonY: .45, drama: .45 }) : null,
    // the volley: arrows rising across the upper frame in a disciplined sheaf
    overStrokes: vk > 0 && vk < 1 ? ({ pal }) => {
      const out = [];
      for (let j = 0; j < 14; j++) {
        const ph = (j * .37) % 1, u = clamp(vk * 1.25 - ph * .25); if (u <= 0 || u >= 1) continue;
        const x = W * (.92 - .95 * u) + (j % 5) * W * .015, y = H * (.42 - .36 * Math.sin(Math.PI * u * .8)) + (j % 3) * H * .02;
        out.push(...PR.arrowStrokes({ x, y, ang: Math.PI + .35 - .9 * u, len: W * .045, pal, seed: j, k: .9 }));
      }
      return out;
    } : null,
  });
});
scene('S15', async f => {
  const second = f.t >= 40.358, real = hasPlate('P11');   // cut on beat 3: the Lydian sees the Mede, then the Mede sees him
  const src = real
    ? await rp(f, 'P11', null, k => ({ cx: second ? .58 : .42, cy: .45, zoom: 1.06 + .03 * k }))
    : second ? await rp(f, 'P11', { id: 'a_duel', cam: { cx: .6, cy: .3, zoom: 2.5 } }, null) : await rp(f, 'P11', { id: 'a_duel', cam: { cx: .41, cy: .29, zoom: 2.5 } }, null);
  await bronze(f, src, real ? {
    lightDir: second ? [-.7, -.7] : [.7, -.7], pool: facePools(src, { body: .45, fallback: [{ x: second ? .58 : .42, y: .35, rx: .14, ry: .3, feather: .7, k: 1, fig: true }] }),
    poolFromLight: { k: .7, bg: .25 }, poolMatte: .3, envDim: .6, faceMin: .3, crushFloor: .08, rim: .8,
  } : { lightDir: second ? [-.8, -.6] : [.8, -.6], pool: [{ x: second ? .58 : .42, y: .45, rx: .18, ry: .45, feather: .7, k: 1 }], poolMatte: .5, envDim: .55, faceMin: .3, crushFloor: .09 });
});

// ---------------------------------------------------------------- S17 / S19 / S21: the duel
const DUEL_LIGHT = { lightDir: [-.7, -.7], pool: [{ x: .47, y: .5, rx: .25, ry: .46, rot: -.35, feather: .6, k: .7 }, { x: .4, y: .3, rx: .1, ry: .2, feather: .6, k: .9 }],
  poolMatte: 1, poolBound: { x: .52, y: .5, rx: .42, ry: .62, feather: .4 }, focus: [{ x: .395, y: .27, rx: .045, ry: .11, k: 1 }, { x: .615, y: .3, rx: .04, ry: .1, k: 1 }], crushFloor: .12 };
scene('S17', async f => {
  const src = await rp(f, 'P12', { id: 'a_duel', cam: k => ({ cx: .5, cy: .48, zoom: 1.05 + .06 * k }) }, k => ({ cx: .5, cy: .5, zoom: 1.02 + .04 * k }));
  await bronze(f, src, { ...DUEL_LIGHT, sky: SKY(f.t, { maxDepth: .006, soft: .01, below: .16, horizonY: .11 }), sun: SUN(f.t, { x: .12, y: .05, r: .03 }) });
});
scene('S19', async f => {
  const src = await rp(f, 'P12', { id: 'a_duel', cam: k => ({ cx: .47 + .02 * Math.sin(k * 3), cy: .46, zoom: 1.2 + .05 * k }) }, k => ({ cx: .5, cy: .5, zoom: 1.06 + .03 * k }));
  await bronze(f, src, { ...DUEL_LIGHT });
});
scene('S21', async f => {
  const src = await rp(f, 'P13', { id: 'a_duel', cam: k => ({ cx: .42, cy: .58, zoom: 1.5 + .1 * k }) }, k => ({ cx: .5, cy: .52, zoom: 1.04 + .05 * k }));
  await bronze(f, src, { ...DUEL_LIGHT, pool: [{ x: .45, y: .55, rx: .3, ry: .45, feather: .7, k: .9 }] });
});

// ---------------------------------------------------------------- S18: first contact (tight on the low sun; nobody notices)
scene('S18', async f => {
  const t = f.t;
  // the land strip and, on it, the duel's silhouettes (the plate's matte, small, dark against the sky)
  const fig = await rp(f, 'P12', { id: 'a_duel', cam: { cx: .5, cy: .5, zoom: .95 } }, { cx: .5, cy: .5, zoom: 1 });
  const aw = fig.aw, ah = fig.ah, hz = .8;
  const silh = new Float32Array(aw * ah);
  if (fig.matte) for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const sx = ((x / aw) - .5) / .42 + .5, sy = (y / ah - hz) / .3 + .62;             // the figures shrunk onto the horizon
    if (sx < 0 || sx > 1 || sy < 0 || sy > 1) continue;
    silh[y * aw + x] = fig.matte[Math.min(ah - 1, Math.floor(sy * ah)) * aw + Math.min(aw - 1, Math.floor(sx * aw))];
  }
  const horizonDraw = PR.horizonCanvas({ horizonY: hz, vanishX: .5 });
  const src = await canvasSource(f, `s18|${fig.key}`, async (g, w, h) => {
    horizonDraw(g, w, h);
    const id = g.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < w * h; i++) if (silh[i] > .05) { const a = clamp(silh[i] * 1.4); d[i * 4] *= 1 - .9 * a; d[i * 4 + 1] *= 1 - .9 * a; d[i * 4 + 2] *= 1 - .9 * a; }
    g.putImageData(id, 0, 0);
  }, { sky: (w, h) => { const m = PR.horizonSkyMask({ horizonY: hz })(w, h); for (let i = 0; i < w * h; i++) m[i] *= 1 - clamp(silh[i] * 2); return m; }, matte: silh });
  await bronze(f, src, {
    lightDir: [0, -1], pool: [{ x: .5, y: .9, rx: .5, ry: .12, feather: .8, k: .5 }], poolMatte: 0, crushFloor: .1,
    sky: SKY(t, { horizonY: hz, glowR: .3, glow: 1.1, drama: .3, cover: .58, vortex: .32, twist: .9, haze: .3 }),
    sun: SUN(t, { x: .5, y: .44, r: .1, alt: 19 }),
    accents: 0, T: [0, .06, .07, .1, .12],
  });
});

// ---------------------------------------------------------------- S23: one face in the chaos, and the frame goes still
scene('S23', async f => {
  const still = f.t >= 66.95;                          // the frame goes still before the voice
  const tt = still ? 66.95 : f.t, k = (tt - 65.67) / (67.42 - 65.67);
  const ff = still ? { ...f, t: tt, k } : f;
  const src = await resolvePlate(ff, 'P14', { id: 'b_face', cam: { cx: .58, cy: .44, zoom: 1.05 + .05 * k } }, { cx: .5, cy: .45, zoom: 1.06 + .04 * k });
  await bronze(f, src, { lightDir: [-.75, -.66], pool: [{ x: .56, y: .45, rx: .2, ry: .5, rot: -.25, feather: .7 }], poolMatte: .55, poolBound: { x: .6, y: .45, rx: .3, ry: .6, feather: .5 },
    faceMin: .5, crushFloor: .1, brushes: [24, 13, 7.5, 4.2, 2.4], drawIdx: still ? 5000 : undefined });
});

// ---------------------------------------------------------------- S25: the face-off, centred and mirrored; cut at 77.88 to the shore melee
scene('S25', async f => {
  const melee = f.t >= 77.875;
  const src = melee
    ? await rp(f, 'P15', { id: 'c_armies', cam: k => ({ cx: .73 - .03 * k, cy: .7, zoom: 3.0 }) }, k => ({ cx: .5, cy: .4, zoom: 1.5 + .05 * k }))
    : await rp(f, 'P15', { id: 'a_duel', cam: k => ({ cx: .5, cy: .45, zoom: 1.12 + .04 * k }) }, k => ({ cx: .5, cy: .5, zoom: 1.02 + .03 * k }));
  await bronze(f, src, melee
    ? { lightDir: [-.6, -.8], pool: [{ x: .5, y: .5, rx: .45, ry: .4, feather: .8, k: .85 }], poolMatte: .4, envDim: .65, crushFloor: .1 }
    : { ...DUEL_LIGHT, pool: [{ x: .5, y: .45, rx: .32, ry: .45, feather: .7, k: .9 }], poolBound: null });
});

// ---------------------------------------------------------------- S26: bronze macro (the low sun burns across a convex shield)
// Easter egg: at 84.38 ("bronze"), for 10 master frames (2 drawings), the shield reflects a tiny figure in orange
// headphones holding a Yagi antenna (Van Eyck's Arnolfini mirror).
scene('S26', async f => {
  const t = f.t, real = hasPlate('P16');
  const cam = k => ({ cx: .465, cy: .5, zoom: 3.0 + .25 * k }), pcam = k => ({ cx: .5, cy: .5, zoom: 1.04 + .05 * k });
  const src = await rp(f, 'P16', { id: 'a_duel', cam }, pcam);
  const egg = t >= 84.38 - 1e-6 && t < 84.38 + 10 / 60 - 1e-6;
  const gk = seg(t, 84.2, 84.82), gx = lerp(.25, .8, smooth(gk));              // the glint sweeps across on "bronze", before the 84.83 cut
  const mirror = real ? { cx: .5, cy: .5, R: .34 } : { cx: .48, cy: .5, R: .42 };
  await bronze(f, src, {
    lightDir: [-.85, -.5], pool: [{ x: .45, y: .45, rx: .5, ry: .5, feather: .8, k: .95 }, { x: gx, y: .42, rx: .08, ry: .3, rot: .4, feather: .6, k: gk > 0 && gk < 1 ? 1 : 0 }],
    poolMatte: .3, crushFloor: .1, accents: 1.4, accentThick: 1.8, glint: 1, impasto: .7,
    overStrokes: egg ? ({ pal }) => PR.mirrorFigure({ cx: f.W * mirror.cx, cy: f.H * mirror.cy, R: f.H * mirror.R, u: .22, v: -.12, h: .3, pal }) : null,
  });
});

// ---------------------------------------------------------------- S27: "-ing turns and strikes when light went strange" (eclipse ~0.8)
scene('S27', async f => {
  const t = f.t;
  if (t < 87.68) {                                     // 84.83 "exchang-": the duel; strikes cut on "turns" 86.06 and "strikes" 87.20
    const part = t < 86.06 ? 0 : t < 87.205 ? 1 : 2;
    const cams = [{ cx: .5, cy: .46, zoom: 1.25 }, { cx: .4, cy: .38, zoom: 1.7 }, { cx: .56, cy: .48, zoom: 1.45 }];
    const pc = [{ cx: .5, cy: .5, zoom: 1.08 }, { cx: .4, cy: .45, zoom: 1.4 }, { cx: .58, cy: .5, zoom: 1.25 }][part];
    const src = await rp(f, 'P12', { id: 'a_duel', cam: cams[part] }, pc);
    await bronze(f, src, { ...DUEL_LIGHT, poolBound: null });
    return;
  }
  // a wicker shield throws a field of crescent suns across the Lydian's bronze; he looks up on "strange"
  const k = seg(t, 87.68, 89.22), real = hasPlate('P17'), e = E(t);
  const src = await rp(f, 'P17', { id: 'b_face', cam: { cx: .6, cy: .42, zoom: 1.12 + .04 * k } }, { cx: .45, cy: .5, zoom: 1.12 + .05 * k });
  // where the crescents land: specks of the plate's own dappled light on the figure (local maxima), else a field
  const aw = src.aw, ah = src.ah, specks = [];
  if (real) {
    const L = new Float32Array(aw * ah); for (let i = 0; i < aw * ah; i++) L[i] = .2126 * src.R[i] + .7152 * src.G[i] + .0722 * src.B[i];
    for (let y = 4; y < ah - 4; y += 2) for (let x = 4; x < aw - 4; x += 2) {
      const i = y * aw + x, v = L[i]; if (v < .55) continue;
      let mx = true; for (let j = -3; j <= 3 && mx; j++) for (let q = -3; q <= 3; q++) if (L[i + j * aw + q] > v) { mx = false; break; }
      if (mx && (!src.depth || src.depth[i] > .25)) specks.push([x, y, v]);
    }
    specks.sort((a, b) => b[2] - a[2]); specks.length = Math.min(specks.length, 70);
  }
  // soft crescent light on the figure (round-bodied: his bronze faces the sun), drifting a little as the shield moves
  const fig = src.matte || (src.depth ? src.depth.map(v => sstep(.3, .5, v)) : null);
  const cf = PR.crescentField(aw, ah, { mag: e.m, stretch: 1.25, ang: -.45, size: aw * .013, density: .55, spacing: 3.2, seed: 21, region: fig, offset: [k * aw * .03, -k * ah * .02] });
  const S2 = f.W / aw;
  await bronze(f, src, {
    lightDir: [.6, -.8], lightPoint: real ? [.85, .05] : null,
    pool: real ? [...facePools(src, { body: .4, kFace: .7 }), { x: .45, y: .55, rx: .2, ry: .4, feather: .7, k: .5, fig: true }] : [{ x: .56, y: .45, rx: .18, ry: .45, rot: -.25, feather: .7, k: .45 }],
    poolFromLight: real ? { k: .5, bg: .2 } : null, poolMatte: .25, envDim: .6, faceMin: .3, crushFloor: .075, rim: .7, lightField: cf.light.map(v => v * .85),
    strokes: ({ pal }) => {
      // the brightest specks of the plate's own dappled light, repainted as crisp crescents (bright edge at 7 o'clock:
      // pinhole images are flipped)
      const col = [.88, .86, .8], out = [];
      specks.slice(0, 26).forEach(([x, y, v], j) => out.push(...PR.crescentStrokes2(x * S2, y * S2, f.H * (.011 + .008 * hashS(j)), e.m, Math.PI * .75, { color: col, stretch: 1.1, stretchAng: -.4, a: .8, thick: .8, key: 3 + j * .01, seed: hashS(j + 7) })));
      return out;
    },
  });
  f.type.disk = { k: seg(t, 87.68, 88.9) };
});
const hashS = j => { let n = (j * 2654435761) >>> 0; n ^= n >>> 15; n = Math.imul(n, 2246822519) >>> 0; n ^= n >>> 13; return (n >>> 0) / 4294967296; };

// ---------------------------------------------------------------- S28: faces turn upward; cut on the 91.31 boom to the sky
scene('S28', async f => {
  const t = f.t;
  if (t < 91.325) {
    const k = seg(t, 89.22, 91.325);
    const src = await rp(f, 'P18', { id: 'b_face', cam: { cx: .52, cy: .5, zoom: 1.0 + .05 * k } }, { cx: .5, cy: .5, zoom: 1.03 + .03 * k });
    await bronze(f, src, { lightDir: [-.5, -.85], pool: [{ x: .5, y: .35, rx: .3, ry: .4, feather: .8, k: .8 }], poolMatte: .5, faceMin: .4, crushFloor: .085, envDim: .6 });
    return;
  }
  // the sky: the thin crescent, Jupiter beside it (11 deg above, 5.5 deg left), the land a dark strip at the foot
  const hz = .93, sun = { x: .6, y: .52, r: .055 };
  const src = await canvasSource(f, 'sky-s28', PR.horizonCanvas({ horizonY: hz, river: false, hill: 1.6 }), { sky: PR.horizonSkyMask({ horizonY: hz, hill: 1.6 }), cache: true });
  await bronze(f, src, {
    lightDir: [.2, -1], pool: [{ x: .5, y: .97, rx: .5, ry: .05, feather: .8, k: .4 }], poolMatte: 0,
    sky: SKY(t, { horizonY: hz, glowR: .22, drama: .45, cover: .56, vortex: .3 }),
    sun: SUN(t, { x: sun.x, y: sun.y, r: sun.r, ppd: 34 }), accents: 0,
  });
  f.type.sun = { x: sun.x * f.W, y: sun.y * f.H, r: sun.r * f.W };
});

// ---------------------------------------------------------------- S29: the eye, the crescent reflected · the intrusion · the sky as an eye
const EYEXCU = { cx: .5165, cy: .335, zoom: 4.2 };    // b_face's (image-left) eye (stand-in)
async function s29Eye(f, k) {
  const real = hasPlate('P19');
  // P19: the eye in extreme close-up; we push toward the iris so the pupil holds the inscription
  const pc = { cx: .44, cy: .5, zoom: 1.12 + .22 * k };
  const src = await rp(f, 'P19', { id: 'b_face', cam: { ...EYEXCU, zoom: EYEXCU.zoom + .25 * k } }, pc);
  const W = f.W, H = f.H;
  // the pupil on screen: P19's iris centre (about uv .405, .51) through the camera
  const pu = real ? [(.405 - pc.cx) * pc.zoom + .5, (.51 - pc.cy) * pc.zoom + .5] : [.515, .43];
  const rp2 = real ? .055 * pc.zoom : .03;
  const rc = { x: pu[0] * W, y: pu[1] * H, r: rp2 * H * .8 };                  // the crescent reflected across the pupil
  await bronze(f, src, {
    lightDir: [-.8, -.4], pool: real ? [{ x: pu[0], y: pu[1], rx: .34, ry: .5, feather: .8, k: 1, fig: true }, { x: pu[0] - .12, y: pu[1] - .3, rx: .4, ry: .28, feather: .8, k: .7, fig: true }]
      : [{ x: .5, y: .45, rx: .35, ry: .4, feather: .7, k: .85 }],
    eclipse: .55, poolFromLight: real ? { k: .85, bg: 1, matte: false } : null, poolMatte: 0, matteFromDepth: null, crushFloor: .085, faceMin: null, eyeStrokes: 0, envDim: .85, liftDark: .25,
    brushes: [22, 12, 7, 4, 2.2], focus: [{ x: pu[0], y: pu[1], rx: .09, ry: .16, k: 1 }],
    overStrokes: ({ pal }) => PR.crescentStrokes2(rc.x, rc.y, rc.r, E(f.t).m, -Math.PI * .66, { color: [.97, .94, .86], a: .95, thick: 1.1 }),
  });
  return { ...rc, pupil: { x: rc.x, y: rc.y, r: rp2 * H } };
}
shotOverride('S29', { t1: 93.95 });
shot({ id: 'S29b', t0: 93.95 + 10 / 60, t1: 96.89, world: 'bronze', cadence: 12, scene: 'S29', parent: 'S29', params: { label: 'S29 (after the intrusion)' } });
scene('S29', async f => {
  const t = f.t;
  if (t < 95.0) {
    const rc = await s29Eye(f, seg(t, 93.0, 95.0));
    f.type.pupil = rc.pupil;
    return;
  }
  // the sky itself reads as an eye: the thin crescent around the dark disk, the glow an iris, the umber dome its socket
  const hz = .95, sun = { x: .5, y: .45, r: .1 };
  const src = await canvasSource(f, 'sky-s29', PR.horizonCanvas({ horizonY: hz, river: false }), { sky: PR.horizonSkyMask({ horizonY: hz }), cache: true });
  await bronze(f, src, {
    lightDir: [0, -1], pool: [], poolMatte: 0,
    sky: SKY(t, { horizonY: hz, glowR: .26, drama: .55, vortex: .4, twist: 2.2, arms: 5, cover: .52, vert: 1.0 }),
    sun: SUN(t, { x: sun.x, y: sun.y, r: sun.r }), accents: 0,
  });
  f.type.pupil = { x: sun.x * f.W, y: sun.y * f.H, r: sun.r * f.W * eclipse.K };
});
// the intrusion (93.95, 10 frames at 60 fps): a vector-flat orange disc slides over the painted sun. It must look foreign:
// no stroke, no texture, no varnish, a perfect edge, the one flat #f08a2a thing in the painting.
shot({ id: 'S29i', t0: 93.95, t1: 93.95 + 10 / 60, world: 'bronze', cadence: 60, scene: 'S29i', parent: 'S29', params: { label: 'S29 orange-disc intrusion' } });
scene('S29i', async f => {
  const ff = { ...f, t: 93.95, k: seg(93.95, 93.0, 95.0), shot: { ...f.shot, t0: 93.0, t1: 96.89, dur: 3.89, id: 'S29' } };
  const rc = await s29Eye(ff, seg(93.95, 93.0, 95.0));
  f.type = ff.type;
  const k = clamp((f.t - 93.95) / (10 / 60)), g = f.g;
  const x = rc.x + (k * 2.2 - 1.1) * rc.r * 2.2, y = rc.y + (k - .5) * rc.r * .4;
  g.save(); g.fillStyle = '#f08a2a'; g.beginPath(); g.arc(x, y, rc.r * 1.02, 0, TAU); g.fill(); g.restore();
});

// ---------------------------------------------------------------- S30: the darkness comes out of the sunset
scene('S30', async f => {
  const t = f.t, cam = { cx: .5, cy: .5, zoom: 1.02 };
  const L = await wideLook(f, cam);
  const src = await wideSource(f, cam);
  // the umbra wall rises over the horizon under the sun and races toward camera (accelerating), swallowing both armies:
  // shadow where the land is farther than the front (depth 1 = near)
  const front = Math.pow(seg(t, 97.2, 99.9), 1.6);
  const D = src.depth, aw = src.aw, ah = src.ah, sh = new Float32Array(aw * ah);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const i = y * aw + x, near = D ? clamp((D[i] - .02) / .9) : clamp((y / ah - L.hz) / (1 - L.hz));
    sh[i] = 1 - sstep(front - .1, front + .03, near);
  }
  await bronze(f, src, wideOpts(t, L, { sunR: .028, sky: { night: lerp(.5, .95, front), ring: lerp(.4, 1, front) }, extra: { shadowField: sh, shadowL: .045 } }));
  f.type.front = { p: front };
});

// ---------------------------------------------------------------- S31: the black sun with Baily's beads, over the armies; the unison look-up at 102.21
scene('S31', async f => {
  const t = f.t, real = hasPlate('P20');
  const src = await rp(f, 'P20', { id: 'c_armies', cam: { cx: .5, cy: .32, zoom: 1.4 } }, { cx: .5, cy: .5, zoom: 1.0 });
  const up = sstep(102.1, 102.45, t);                  // the formation moment: every face catches the pale light
  const sun = real ? { x: .5, y: .34, r: .042 } : { x: .515, y: .14, r: .036 };
  await bronze(f, src, {
    lightDir: [0, -1], lightColor: '#dcd6ca',
    pool: real ? [...facePools(src, { body: .35, kFace: .6 + .4 * up }), { x: .5, y: .75, rx: .35, ry: .08, feather: .8, k: .6 }] : [{ x: .5, y: .6, rx: .5, ry: .3, feather: .8, k: .5 }],
    poolFromLight: real ? { k: .45 + .3 * up, bg: .5 } : null, poolMatte: .3 + .25 * up, envDim: .6, crushFloor: .07, faceMin: .4,
    matteFromDepth: real ? [.22, .4] : null, lightPoint: real ? [.5, .74] : null, rim: 1.0, liftDark: real ? .3 + .2 * up : 0,
    sky: SKY(t, { maxDepth: real ? .02 : .012, soft: .02, below: real ? .74 : .3, horizonY: real ? .72 : .285, night: .9, ring: 1, glow: .25, drama: .3 }),
    sun: SUN(t, { x: sun.x, y: sun.y, r: sun.r, moonVis: 1, beads: true, limb: [1.1 + .8 * up, 1.6, .9, -Math.PI * .66], ppd: real ? 22 : 16 }),
    corona: { k: lerp(.35, .85, seg(t, 100.24, 103.6)), iris: .3, scale: .9 },
  });
});

// ---------------------------------------------------------------- S32 the duelists lower their weapons · S33 hands opening
scene('S32', async f => {
  const src = await rp(f, 'P21', { id: 'a_duel', cam: k => ({ cx: .5, cy: .45, zoom: 1.15 + .03 * k }) }, k => ({ cx: .5, cy: .5, zoom: 1.02 + .03 * k }));
  await bronze(f, src, { lightDir: [0, -1], lightColor: '#dcd6ca', pool: [{ x: .4, y: .32, rx: .12, ry: .3, feather: .7, k: .8 }, { x: .62, y: .34, rx: .12, ry: .3, feather: .7, k: .8 }],
    poolMatte: .4, envDim: .55, faceMin: .4, crushFloor: .07,
    sky: SKY(f.t, { maxDepth: .006, soft: .01, below: .16, horizonY: .11, night: .9, ring: 1, glow: .1 }) });
});
scene('S33', async f => {
  const A = { plate: 'P22a', standin: { id: 'a_duel', cam: k => ({ cx: .3, cy: .22, zoom: 3.4 + .1 * k }) }, cam: k => ({ cx: .5, cy: .5, zoom: 1.02 + .03 * k }) };
  const B = { plate: 'P22b', standin: { id: 'a_duel', cam: k => ({ cx: .52, cy: .48, zoom: 3.4 + .1 * k }) }, cam: k => ({ cx: .5, cy: .5, zoom: 1.02 + .03 * k }) };
  await diptych(f, A, B, { lightDir: [0, -1], lightColor: '#dcd6ca', pool: [{ x: .25, y: .5, rx: .2, ry: .4, feather: .7, k: .85 }, { x: .75, y: .5, rx: .2, ry: .4, feather: .7, k: .85 }], poolMatte: .5, crushFloor: .07, envDim: .55 });
});

// ---------------------------------------------------------------- S34: last light (beads, the diamond ring, white, the black pupil at 110.58)
scene('S34', async f => {
  const t = f.t, W = f.W, H = f.H;
  // scripted second contact: the sliver breaks into beads, the last bead swells into the diamond ring, we push into it
  const off = kf(t, [[108.84, .12], [109.55, .085], [110.05, .068], [110.58, .062]]);
  const ring = sstep(109.35, 109.9, t) * (1 + 2.5 * sstep(109.9, 110.3, t));
  const push = Math.pow(sstep(109.75, 110.5, t), 2);
  const P0 = pupilAt(W, H), ang = -Math.PI * .66;
  const rS = P0.r / eclipse.K / W;
  const bx = P0.x + Math.cos(ang) * P0.r / eclipse.K, by = P0.y + Math.sin(ang) * P0.r / eclipse.K, z = 1 + 5 * push;   // push toward the bead
  const sx = (bx + (P0.x - bx) * z) / W, sy = (by + (P0.y - by) * z) / H;
  const hz = Math.min(1.3, .82 + .4 * push);
  const src = await canvasSource(f, `s34|${hz.toFixed(3)}`, PR.horizonCanvas({ horizonY: hz }), { sky: PR.horizonSkyMask({ horizonY: hz }) });
  const white = sstep(110.18, 110.42, t);
  await bronze(f, src, {
    eclipse: .97, lightDir: [0, -1], pool: [{ x: .5, y: .95, rx: .5, ry: .1, feather: .8, k: .35 }], poolMatte: 0,
    sky: SKY(t, { horizonY: hz, night: .93, ring: 1, glow: .15 + .3 * ring, drama: .25 }),
    sun: { x: sx, y: sy, r: rS * z, alt: 9, off, moonVis: 1, beads: t < 109.9, ring: ring * (1 + 3 * push), ringAng: ang, limb: [1 + ring, 1.8 * z, 1, ang], jupiter: { x: .2 - push, y: .14 } },
    corona: { k: .25 + .35 * sstep(109.3, 110.0, t), iris: .2, scale: .9 },
    accents: 0, white,
  });
  if (t >= 110.46) blackPupil(f.g, P0.x, P0.y, P0.r * sstep(110.44, 110.54, t));
  f.type.sun = { x: P0.x, y: P0.y, r: P0.r };
  f.type.flash = white;
});

// which plate each shot reads (for the report); hasPlate() decides at render time
export const ACT1_PLATES = { S01: 'P02', S02: 'P02', S03: 'P23', S04: 'P01', S05: 'P01', S06: 'P01', S07: 'P03', S08: 'P04', S09: 'P05+P06', S10: 'P07', S11: 'P08',
  S12: 'proc', S13: 'P09', S14: 'P10', S15: 'P11', S16: 'P01', S17: 'P12', S18: 'proc+P12', S19: 'P12', S20: 'P01', S21: 'P13', S22: 'P05+P06', S23: 'P14', S24: 'P01',
  S25: 'P15', S26: 'P16', S27: 'P12+P17', S28: 'P18', S29: 'P19', S30: 'P01', S31: 'P20', S32: 'P21', S33: 'P22a+P22b', S34: 'proc' };
