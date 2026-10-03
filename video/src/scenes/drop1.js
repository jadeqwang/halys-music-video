// drop1.js: line engine: S35-S44 (Drop 1) + the opening half of S45. Owner: line-engine agent.
//
// Drop 1 is the genre switch: at totality the Baroque painting becomes a world drawn in light, at 60 fps, and the
// warriors react to the sky going out at the same moment the audience does (director's change, SHOTLIST 2026-10-03).
// Every shot draws through the line engine (src/worlds/line/, README.md there). Plates resolve to video/plates/P##
// as soon as the plate unit lands them; until then each setup names a stand-in (src/worlds/line/standins/).
// Beat sync: every pulse, cut, snap and inversion is keyed to timing.json events, snapped to the master frame grid
// (audio.js); production/review/drop1/beatcheck.py measures the rendered result against the same events.
//
// For the type layer (src/type/) every scene sets f.type = { sun: {x, y, r}, kick, invert, field: {center} }, so the
// CHOP words' field lines circle the eclipse, pulse with the same kick and invert on the same frames.
// For the marble world: drawCrystallise(f, { widen }) and S45_HANDOFF (S45 section below).

import { scene, shotOverride } from '../registry.js';
import { drawLines, plateLines, sourceFields, coronaRing, ringU, staticMesh, dynLayer, audio, proc, FL, camUniforms, project, PALETTE, resolve, CORONA_DEFAULTS } from '../worlds/line/index.js';
import { clamp, lerp, sstep, smooth, easeInOut, easeOut, hash3, TAU } from '../core.js';
import { FPS } from '../time.js';

const snap = audio.snap;
const STAB36 = [112.74, 113.173, 113.607, 115.783, 116.217, 116.652, 117.086];   // SHOTLIST S36 inversions (timing.json stabs)
const steer = (f, o) => { f.type = Object.assign(f.type || {}, o); };
const typeSun = s => s ? { x: s[0], y: s[1], r: s[2] } : undefined;
const segAt = (t, cuts) => { let i = 0; while (i < cuts.length && snap(cuts[i]) <= t + 1e-6) i++; return i; };

// ---------------------------------------------------------------- looks
// Hierarchy (director's notes on round 1): the corona is the brightest element of any frame it is in; subject contours
// lead everything else; few, bright interior lines (a steep tone curve: lit planes get lines, mid-greys get none); a
// sparse, dim background; lots of black.
const CU_TRACE = { contourW: [1.5, 2.9], contourB: 2.0, contourFloor: .8, contourToneK: .2, innerB: 1.0, innerHi: .2, innerLo: .09, rim: 1, lightDir: [-.4, -.9],
  dsepMin: 4.4, dsepMax: 12.5, bgSepMin: 34, bgSepMax: 60, bgGain: .1, bgCut: .3, subjBright: [.16, .85], gamma: 1.6, shadowCut: .1, minLen: 30 };
// behind the giant CHOP words (S41-S44): the face by its contours and a handful of lit lines, almost no background
const CHOP_TRACE = { ...CU_TRACE, dsepMin: 6, dsepMax: 16, subjBright: [.12, .72], gamma: 1.9, innerB: .75, innerHi: .26, bgGain: .03, bgCut: .45 };
// the master composition on P01: sky by depth, the eclipse on the plate's own sun (meta: 0.508, 0.247), the armies'
// light pools on both banks as the subject (P01's matte is the river's glare, not the armies: poolMatte 0). The board's
// geometry (F2's river, army masks, horizon, its sun at the vanishing point) is stand-in only (standinTrace).
const MASTER_TRACE = {
  sky: { maxDepth: .03, soft: .02, horizonY: .37, below: .40 }, sun: { x: .508, y: .25, r: .028, tilt: .35 }, poolMatte: 0,
  innerEverywhere: 1, innerHi: .15, innerLo: .065, contour: 0, gamma: 1.5, bgGain: .3, bgCut: .3, shadowCut: .05, tick: [6, 15], tickMin: 2,
  dsepMin: 3, dsepMax: 9, bgSepMin: 18, bgSepMax: 34,
  armies: 1, pool: [{ x: .2, y: .62, rx: .23, ry: .3, k: 1 }, { x: .8, y: .62, rx: .23, ry: .3, k: 1 }],      // both banks (equal light)
};
const MASTER_STANDIN = {
  sky: { horizonY: .335, below: .345, useDepth: false }, sun: { x: .5, y: .343, r: .028, tilt: .35 }, poolMatte: 1,
  river: [[.497, .352], [.49, .38], [.485, .40], [.47, .42], [.475, .45], [.455, .50], [.43, .55], [.40, .60], [.375, .65], [.35, .70], [.32, .78], [.29, .88], [.27, 1.0],
    [.70, 1.0], [.66, .90], [.63, .80], [.615, .70], [.605, .62], [.58, .56], [.55, .50], [.525, .45], [.515, .42], [.51, .40], [.505, .38], [.503, .352]],
  riverFlow: { x: .5, y: .35, k: 2.5 }, riverB: 1.1,
  armies: 1, armyMask: [[[0, .37], [.46, .37], [.44, .42], [.38, .48], [.30, .55], [.22, .62], [.12, .70], [0, .75]], [[1, .37], [.54, .37], [.56, .42], [.62, .48], [.70, .55], [.78, .62], [.88, .70], [1, .75]]],
  pool: [{ x: .12, y: .82, rx: .2, ry: .32, k: 1 }, { x: .88, y: .82, rx: .2, ry: .32, k: 1 }],
};
// the field lines sweep the whole sky, dense at the corona and thinning fast with distance (lots of black)
const MASTER = { src: { plate: 'P01', standin: 'master' }, trace: MASTER_TRACE, standinTrace: MASTER_STANDIN, corona: { gain: 1.15 }, skyField: { gain: .42, sep0: .14, sep1: 2.4, falloff: 1.0 } };
const masterSun = () => resolve(MASTER.src).kind === 'standin' ? MASTER_STANDIN.sun : MASTER_TRACE.sun;
// where the eclipse hangs in the drop's opening (the master composition): the CHOP fill radiates from it in S35-S36
const dropSun = f => { const s = masterSun(); return { x: s.x * f.W, y: s.y * f.H, r: s.r * f.W }; };
// reaction plates (P42-P45): dark dusk skies (no lines) with the orange horizon glow behind the wides; the matte figures
// carry the contours; eyes in extreme close-up have no meaningful matte edge (contour off, edges everywhere)
const RX_TRACE = { ...CU_TRACE, horizon: 0 };
const SUBJ_EXPOSE = { autoGain: .85 };            // expose each plate window for its matte subject (source.js)
// faces in close-up: wide-spaced lit lines (shadows go black), the features (inner edges) and the head's contour brightest
const FACE_TRACE = { dsepMin: 6.5, dsepMax: 16, subjBright: [.1, .8], gamma: 1.8, innerB: 1.4, innerHi: .17, innerLo: .075, contourB: 2.4, contourW: [1.8, 3.3] };
const rxSky = (y, horizon = 1) => ({ sky: { horizonY: y, below: y + .03, useDepth: false }, horizon, horizonBand: .015 });
const SKY42 = rxSky(.47), SKY43 = rxSky(.44), SKY44 = rxSky(.57), SKY45 = rxSky(.9, 0);
const EYE_TRACE = { contour: 0, innerEverywhere: 1, innerHi: .14, innerLo: .06 };
// plate-uv box(es) [x, y, w, h] -> screen fractions through a window (16:9 plate, 16:9 frame): the type's f.type.avoid
function boxesOnScreen(boxes, win = {}, clampInside = true) {
  const z = win.zoom || 1, w = 1 / z;
  let x0 = (win.cx ?? .5) - w / 2, y0 = (win.cy ?? .5) - w / 2;
  if (clampInside) { x0 = clamp(x0, 0, 1 - w); y0 = clamp(y0, 0, 1 - w); }
  return (boxes || []).map(([x, y, bw, bh]) => ({ x: (x - x0) * z, y: (y - y0) * z, w: bw * z, h: bh * z }));
}

// ---------------------------------------------------------------- S35: the break, and the whole battlefield reacts
// 110.58 the world returns as light from the black pupil (master composition, P01) while the armies ripple: spear ticks
// tilt and fall as men drop to their knees, others scatter, a wave running out from the eclipse. Then one chop-cut per
// word on the real reaction plates, each landing its reaction on the cut (PLATES.md sync keys): IN THE (110.98) a Lydian
// sinks to his knees, arms raised (P42); SKY (111.455) a rearing horse (P44); SKY (111.89) a Mede prostrate (P43). The
// raised arms, the horse's head and the faces sit above the word block; the bodies go under the words.
const S35_CUTS = [110.98, 111.455, 111.89];
const S35_SUB = [
  null,
  { src: { plate: 'P42', standin: 'r42kneel', win: { cx: .43, cy: .4, zoom: 1.5 } }, tp0: .85, trace: SKY42 },      // P42 110.98 -> 1.0 (arms up), splash 1.3
  { src: { plate: 'P44', standin: 'r44rear', win: { cx: .42, cy: .45, zoom: 1.1 } }, tp0: .875, trace: SKY44 },     // P44 111.455 -> 0.92 (the rear)
  { src: { plate: 'P43', standin: 'r43pros', win: { cx: .6, cy: .55, zoom: 1.2 } }, tp0: .95, trace: SKY43 },       // P43 111.89 -> 1.1 (forehead down)
];
// the reaction wave on the master's spear ticks: arrival time grows with distance from the sun
function waveFx(t, sunA, S) {
  const t0 = snap(110.58) + .02, v = 1500 / S;          // analysis px per second
  return (T, i) => {
    const r = Math.hypot(T.x - sunA[0], (T.y - sunA[1]) * 1.6), ta = t0 + r / v, k = (t - ta) / .24;
    if (k <= 0) return null;
    const e = easeOut(clamp(k)), hsh = hash3(i, 31, 7), side = T.x < sunA[0] ? -1 : 1, flash = Math.exp(-(t - ta) / .07);
    if (hsh < .45) return { lean: (hash3(i, 32, 7) - .5) * .25 * e, lenK: 1 - .42 * e, dy: T.len * .3 * e, bK: 1 + .6 * flash, tipK: 1 + 2.2 * flash };      // kneel
    if (hsh < .8) return { lean: side * (.9 + .5 * hash3(i, 33, 7)) * e, bK: 1 + .5 * flash, tipK: 1 + 2.2 * flash };                                   // the spear falls
    return { dx: side * (5 + 14 * hash3(i, 34, 7)) * e, dy: (hash3(i, 35, 7) - .5) * 6 * e, lean: side * .35 * e, bK: 1 + .5 * flash, tipK: 1 + 2.2 * flash };  // scatter
  };
}
scene('S35', async f => {
  const W = f.W, H = f.H, s = H / 1080, kick = audio.kickEnv(f.t, .13), sub = segAt(f.t, S35_CUTS), phase = audio.flowPhase(f.t);
  if (sub === 0) {
    const t0 = snap(f.shot.t0), lt = Math.max(0, f.t - t0), SUN = masterSun();
    const sunRest = [SUN.x * W, SUN.y * H], Rs = SUN.r * W;
    const pull = Math.exp(-lt / .085), zoom = 1 + .55 * Math.exp(-lt / .2);
    const Rfull = .5 * Math.hypot(W, H) * 1.02 + Math.hypot(sunRest[0] - W / 2, sunRest[1] - H / 2), rP = Rs * zoom + (Rfull - Rs * zoom) * pull, ign = Math.exp(-lt / .22);
    const aw = 960, sunA = [SUN.x * aw, SUN.y * aw / (W / H)];
    const r = await drawLines(f, {
      ...MASTER, cam: { zoom, center: sunRest }, kick, kickPush: 30, phase, tickFx: waveFx(f.t, sunA, W / aw),
      reveal: { x: sunRest[0], y: sunRest[1], r: rP, ramp: 220 * s, boost: 1.6 * ign },
      disk: { x: sunRest[0], y: sunRest[1], r: Math.max(rP, Rs * zoom) }, ring: { r: rP, w: 2.4 * s, i: 1.6 * Math.exp(-lt / .35) + .1 },
      look: { bright: 1 + .5 * ign, glow: [.22 + .25 * ign, .08 + .12 * ign] },
    });
    steer(f, { sun: typeSun(r.sun), kick, field: { center: sunRest } });
    return;
  }
  const S = S35_SUB[sub], ts = snap(S35_CUTS[sub - 1]), lt = f.t - ts;
  await drawLines(f, { src: S.src, tp: S.tp0 + lt, chainFrom: S.tp0, trace: { ...RX_TRACE, dsepMin: 5.2, dsepMax: 14, ...S.trace }, analysis: SUBJ_EXPOSE, corona: false, cam: { zoom: 1 + .05 * Math.exp(-lt / .06) },
    kick, kickPush: 16, phase, look: { glow: [.18, .06] } });
  steer(f, { kick, sun: dropSun(f) });
});

// ---------------------------------------------------------------- S36: the "WTF" montage
// A hard cut on the stutter onsets, every cut a different human reaction: bar 65 (8ths) on every onset, bars 66-67
// (16ths) on every second onset; 2-frame inversions on the stabs. A rapid human chorus: Lydian (L) and Median (M)
// reactions alternate (9 each, plus one shot with both: the rearing Lydian horse and the Mede calming his), and the
// shot scale changes on every cut (CU face, XCU eye, MS gesture, wide group). Each reaction is framed with the face or
// gesture in the centre-to-upper area; `focus` (plate uv boxes) goes to the type layer as f.type.avoid, so the stutter
// SKY takes the clear third. Plate times from the chosen takes (PLATES.md: P42 kneel 1.0 / spin 1.6 / eyes 2.9 /
// spear 4.5; P43 prostration 1.1 / amulet 1.8 / bow 3.5 / arm 4.3; P44 rear 0.9 / calming 1.9-3.4; P45 Lydian 0-1.79,
// Mede 1.79-3.08, Alyattes 3.08-4.38, Cyaxares 4.38-5.04).
const RX = {
  medeWhip:   { side: 'M', scale: 'CU', src: { plate: 'P45', standin: 'r45mede', win: { cx: .5, cy: .55, zoom: 1.12 } }, tp: 2.2, trace: SKY45, focus: [[.33, .05, .34, .7]] },
  lydKneel:   { side: 'L', scale: 'MS', src: { plate: 'P42', standin: 'r42kneel', win: { cx: .43, cy: .45, zoom: 1.7 } }, tp: 1.6, trace: SKY42, focus: [[.32, .17, .22, .43]] },
  medeEye:    { side: 'M', scale: 'XCU', src: { plate: 'P19b', standin: 'r45medeup', win: { cx: .55, cy: .47, zoom: 1.45 } }, tp: 3.3, trace: { ...EYE_TRACE, poolMatte: 0, pool: [{ x: .55, y: .5, rx: .42, ry: .5, k: 1 }] }, focus: [[.35, .32, .4, .3]] },
  lydHorse:   { side: 'L', scale: 'W', src: { plate: 'P44', standin: 'r44rear', win: { cx: .42, cy: .47, zoom: 1.05 } }, tp: 1.3, trace: SKY44, focus: [[.05, 0, .55, .9]] },
  medeAmulet: { side: 'M', scale: 'MS', src: { plate: 'P43', standin: 'r43pros', win: { cx: .43, cy: .34, zoom: 2.6 } }, tp: 2.3, trace: SKY43, focus: [[.37, .18, .13, .27]] },
  lydLook:    { side: 'L', scale: 'CU', src: { plate: 'P45', standin: 'r45lyd', win: { cx: .5, cy: .55, zoom: 1.12 } }, tp: .3, trace: SKY45, focus: [[.33, .05, .34, .7]] },
  medePros:   { side: 'M', scale: 'W', src: { plate: 'P43', standin: 'r43pros', win: { cx: .56, cy: .5, zoom: 1 } }, tp: 1.9, trace: SKY43, focus: [[.66, .66, .26, .29], [.22, .15, .45, .2]] },
  lydEyes:    { side: 'L', scale: 'MS', src: { plate: 'P42', standin: 'r42eyes', win: { cx: .6, cy: .38, zoom: 2.3 } }, tp: 3.3, trace: SKY42, focus: [[.55, .2, .15, .25]] },
  cyaxares:   { side: 'M', scale: 'CU', src: { plate: 'P45', standin: 'r45cya', win: { cx: .5, cy: .56, zoom: 1.2 } }, tp: 4.8, trace: SKY45, focus: [[.33, .02, .34, .7]] },
  lydSpin:    { side: 'L', scale: 'MS', src: { plate: 'P42', standin: 'r42spin', win: { cx: .2, cy: .27, zoom: 2.4 } }, tp: 2.5, trace: SKY42, focus: [[.05, .05, .17, .25]] },
  medeUp:     { side: 'M', scale: 'CU', src: { plate: 'P45', standin: 'r45medeup', win: { cx: .5, cy: .5, zoom: 1.45 } }, tp: 2.95, trace: SKY45, focus: [[.35, .1, .3, .55]] },
  lydWide:    { side: 'L', scale: 'W', src: { plate: 'P42', standin: 'r42eyes', win: { cx: .5, cy: .45, zoom: 1.05 } }, tp: 4.5, trace: SKY42, focus: [[.05, .05, .85, .3]] },
  armsGrip:   { side: 'M', scale: 'MS', src: { plate: 'P43', standin: 'r43arm', win: { cx: .5, cy: .36, zoom: 2.0 } }, tp: 4.6, trace: SKY43, focus: [[.38, .2, .28, .35]] },
  alyattes:   { side: 'L', scale: 'CU', src: { plate: 'P45', standin: 'r45aly', win: { cx: .5, cy: .55, zoom: 1.15 } }, tp: 3.9, trace: SKY45, focus: [[.3, .05, .4, .7]] },
  horses:     { side: 'LM', scale: 'W', src: { plate: 'P44', standin: 'r44calm', win: { cx: .5, cy: .5, zoom: 1 } }, tp: 2.4, trace: SKY44, focus: [[.05, 0, .55, .9], [.75, .4, .17, .5]] },
  lydEye:     { side: 'L', scale: 'XCU', src: { plate: 'P19', standin: 'bface', standinWin: { cx: .64, cy: .325, zoom: 4.6 }, win: { cx: .45, cy: .45, zoom: 1.5 } }, tp: 3.3, trace: EYE_TRACE, focus: [[.28, .3, .34, .3]] },
  medeBow:    { side: 'M', scale: 'MS', src: { plate: 'P43', standin: 'r43bow', win: { cx: .32, cy: .52, zoom: 1.4 } }, tp: 3.35, trace: SKY43, focus: [[.22, .2, .14, .7]] },
  lydAwe:     { side: 'L', scale: 'CU', src: { plate: 'P14', standin: 'bface', standinWin: { cx: .6, cy: .45, zoom: 1.45 }, win: { cx: .45, cy: .4, zoom: 1.3 } }, tp: 4.9, focus: [[.3, 0, .32, .6]] },
  medeCalm:   { side: 'M', scale: 'MS', src: { plate: 'P44', standin: 'r44calm', win: { cx: .8, cy: .52, zoom: 2.2 } }, tp: 2.8, trace: SKY44, focus: [[.7, .35, .22, .55]] },
};
// 19 segments: sides alternate M L M L ... (the both-sides wide on slot 14), scales never repeat on adjacent cuts, the
// wides on the longer segments (113.08's 0.64 s holds the rearing horse)
const ORDER36 = ['medeWhip', 'lydKneel', 'medeEye', 'lydHorse', 'medeAmulet', 'lydLook', 'medePros', 'lydEyes', 'cyaxares', 'lydSpin',
  'medeUp', 'lydWide', 'armsGrip', 'alyattes', 'horses', 'lydEye', 'medeBow', 'lydAwe', 'medeCalm'];
// the S36 cut list: every stutter onset in bar 65, every second onset in bars 66-67
export function s36Cuts() {
  const st = audio.stutterTimes().filter(t => t < 117.53 - 1e-6), bar66 = 114.045;
  const a = st.filter(t => t < bar66), b = st.filter(t => t >= bar66).filter((t, i) => i % 2 === 0);
  return [...a, ...b];
}
scene('S36', async f => {
  const cuts = s36Cuts(), i = segAt(f.t, cuts), start = i ? snap(cuts[i - 1]) : snap(f.shot.t0), lt = f.t - start;
  const R = RX[ORDER36[i % ORDER36.length]], kick = audio.kickEnv(f.t, .12);
  const invert = audio.onFrames(f.t, STAB36, 2);
  const live = resolve(R.src).kind === 'plate';
  await drawLines(f, {
    src: R.src, freeze: R.tp, trace: { ...RX_TRACE, ...(R.scale === 'CU' || R.scale === 'XCU' ? FACE_TRACE : {}), ...(R.trace || {}) }, analysis: { ...SUBJ_EXPOSE, ...(R.analysis || {}) }, corona: false,
    cam: { zoom: (1 + .06 * Math.exp(-lt / .045)) * (1 + .03 * lt) }, kick, kickPush: 14, phase: audio.flowPhase(f.t), invert, look: { glow: [.16, .05] },
  });
  steer(f, { kick, invert, sun: dropSun(f), avoid: live ? boxesOnScreen(R.focus, R.src.win) : [] });
});

// ---------------------------------------------------------------- S37: the orbit around a frozen reaction tableau
// P46 is a frozen tableau with its own ~30-degree camera orbit: when it lands it plays through the temporal engine (its
// own parallax) plus a gentle extra yaw from depth. Until then the stand-in (both duelists looking up) orbits in 3D from
// its depth map. Kick pulse throughout.
const TABLEAU = { src: { plate: 'P46', standin: 'duelup' },
  trace: { ...CU_TRACE, sky: { maxDepth: .05, soft: .03, below: .62 }, sun: { x: .22, y: .1, r: .022, tilt: .7 }, lightDir: [-.6, -.8], bgGain: .16, bgCut: .22, depthBlur: 5, relief: .3,
    subjBright: [.2, .9], contourB: 1.5, innerB: .9, dsepMin: 3.6, dsepMax: 11 },
  corona: { gain: 1.25 }, skyField: { gain: .3, sep0: .14, sep1: 2.2, rmax: 16 }, analysis: SUBJ_EXPOSE };
export function s37Cam(t, live) {
  const k = clamp((t - 117.53) / (124.47 - 117.53)), e = easeInOut(k);
  return live ? { yaw: lerp(-3, 3, e), pitch: .8 * Math.sin(k * Math.PI), zoom: 1.04 } : { yaw: lerp(-12, 13, e), pitch: 2.2 * Math.sin(k * Math.PI), zoom: 1.1 };
}
scene('S37', async f => {
  const kick = audio.kickEnv(f.t, .13), live = resolve(TABLEAU.src).kind === 'plate';
  const r = await drawLines(f, { ...TABLEAU, tp: f.t - 117.53, chainFrom: 0, freeze: live ? undefined : 0, cam: s37Cam(f.t, live), kick, kickPush: 22, phase: audio.flowPhase(f.t) });
  steer(f, { sun: typeSun(r.sun), kick });
});

// ---------------------------------------------------------------- S41-S44: the four chop cycles, the ring locked centre
const ringR = H => .105 * H;
const RING = { corona: { gain: 1.05 }, skyField: { gain: .17, sep0: .17, sep1: 1.2, locals: 5, rmax: 3.6 }, tilt: .42 };
const RING44 = { ...RING, skyField: { ...RING.skyField, rmax: 9, gain: .24, sep1: 1.6, bounds: [-30, -30, 30, 0] } };   // above the horizon only
const CYCLE = {
  // P14 (take 2): breathing to 1.6, the eyes rise from 2.0, the long upward gaze from 2.8 to the end (5.04): plate 1.7 at
  // the cut, so he looks up at the ring through the whole cycle (window past the plate's top: black above his helmet)
  S41: { src: { plate: 'P14', standin: 'bface', standinWin: { cx: .58, cy: .45, zoom: 1.12 }, win: { cx: .4, cy: .2, zoom: 1.3 }, clamp: false }, tp0: 1.7, trace: { ...CHOP_TRACE } },
  S42: { src: { plate: 'P04', standin: 'duelup', standinWin: { cx: .64, cy: .3, zoom: 2.1 }, win: { cx: .6, cy: .42, zoom: 1.5 } }, trace: { ...CHOP_TRACE } },
  S43: { plates: [
    { src: { plate: 'P05', standin: 'kings', standinWin: { cx: .25, cy: .5, zoom: 1 }, win: { cx: .3, cy: .5, zoom: 1.05 } }, rect: [0, 0, .5, 1], trace: { ...CHOP_TRACE, lightDir: [.3, -1] } },
    { src: { plate: 'P06', standin: 'kings', standinWin: { cx: .75, cy: .5, zoom: 1 }, win: { cx: .56, cy: .5, zoom: 1.05 } }, rect: [.5, 0, .5, 1], trace: { ...CHOP_TRACE, lightDir: [-.3, -1] } }] },
  // P01's static master (plate 0-4.5 s), barely drifting
  S44: { src: { plate: 'P01', standin: 'master', standinWin: { cx: .5, cy: .343, zoom: 1.5 }, win: { cx: .5, cy: .35, zoom: 1.5 } }, speed: .18,
    trace: { ...MASTER_TRACE, sun: null, bgGain: .14, bgCut: .4, dsepMin: 4, dsepMax: 12, tickGain: .8 }, standinTrace: MASTER_STANDIN, analysis: {} },
};
async function chopCycle(f, id) {
  const W = f.W, H = f.H, cx = W / 2, cy = H / 2, kick = audio.kickEnv(f.t, .13), s = H / 1080;
  let R = ringR(H), bright = 1.25, bgFade = .5, point = 0;
  if (id === 'S44') {                       // on the last SKY the ring collapses to a point
    const tc = snap(153.03), k = clamp((f.t - tc) / .32);
    if (f.t >= tc) { R *= 1 - Math.pow(k, 1.6); bright = 1.25 + 2.2 * k; bgFade *= 1 - sstep(0, .8, k); point = sstep(.55, 1, k) * Math.exp(-Math.max(0, f.t - tc - .32) / .9); }
  }
  const C = CYCLE[id];
  const ring = coronaRing(f, id === 'S44' ? 'ring44' : 'ring', { refR: ringR(H), ...(id === 'S44' ? RING44 : RING) });
  const layers = [];
  if (R > .5) layers.push({ mesh: ring, u: { ...ringU(cx, cy, R * (1 + .025 * kick)), uBright: bright, uPush: [cx, cy, 22 * kick * s, 300 * s] } });
  if (point > 0) layers.push(dynLayer([proc.circle(cx, cy, 2.2 * s, { b: 3 * point, w: 2.4 }, 10), proc.line([[cx, cy], [cx + .5, cy]], { b: 6 * point, w: 3.5, flags: FL.TIP })]));
  const tp = (C.tp0 ?? 0) + (f.t - f.shot.t0) * (C.speed ?? 1);
  const plates = C.plates ? C.plates.map(p => ({ analysis: SUBJ_EXPOSE, ...p, tp, chainFrom: C.tp0 ?? 0 })) : [{ src: C.src, tp, chainFrom: C.tp0 ?? 0, trace: C.trace, standinTrace: C.standinTrace, analysis: C.analysis ?? SUBJ_EXPOSE }];
  await drawLines(f, {
    plates, corona: false, kick, kickPush: 14, pushCenter: [cx, cy], phase: audio.flowPhase(f.t), look: { bright: bgFade, glow: [.22, .08] }, layers,
    disk: R > .5 ? { x: cx, y: cy, r: R } : false,
  });
  steer(f, { sun: { x: cx, y: cy, r: Math.max(R, 1) }, kick, field: { center: [cx, cy] } });
}
for (const id of ['S41', 'S42', 'S43', 'S44']) scene(id, f => chopCycle(f, id));

// ---------------------------------------------------------------- S45 (opening half): the lines slow and widen into strokes
export const S45_T0 = 153.83, S45_CUT = 157.03;           // the marble world takes over at the 157.03 boom (cut closer)
export const S45_PLATE = { plate: 'P25', standin: 'aduel' };
const S45_TRACE = { ...CU_TRACE, sky: { maxDepth: .02, soft: .02, below: .5 }, bgGain: .32, dsepMin: 3.8, dsepMax: 11 };
export const widenAt = t => sstep(S45_T0 + .25, S45_CUT, t);
// pulse travel that decelerates to a stop as widen -> 1 (integrated, so it never runs backwards)
function slowPhase(t) {
  const a = S45_T0, b = Math.min(t, S45_CUT), dt = 1 / 120; let ph = audio.flowPhase(a);
  for (let x = a; x < b; x += dt) { const w = widenAt(x + dt / 2); ph += (audio.flowPhase(x + dt) - audio.flowPhase(x)) * (1 - w) * (1 - w); }
  return ph;
}
// draw the line world of S45 at a given widen (0 = Drop 1 lines, 1 = the hand-off: long soft white strokes)
export async function drawCrystallise(f, { widen = widenAt(f.t), t = f.t, tp = Math.max(0, t - S45_T0) } = {}) {
  const w = clamp(widen);
  return drawLines(f, {
    src: S45_PLATE, tp, chainFrom: 0, trace: S45_TRACE, analysis: SUBJ_EXPOSE, corona: false, phase: slowPhase(t), pulse: .5 * (1 - w),
    look: { width: 1 + 4.6 * w * w, flat: .85 * w, white: .7 * w, glow: [.22 * (1 - w) + .03 * w, .08 * (1 - w)], endFade: 10 + 60 * w, exposure: 1.6 - .15 * w },
  });
}
// the stable hand-off: plate time and widen at the cut (the marble agent continues from here)
export const S45_HANDOFF = { t: S45_CUT, widen: 1, plate: S45_PLATE, tp: S45_CUT - S45_T0 };
scene('S45', async f => {
  const t = Math.min(f.t, S45_CUT - 1 / FPS);
  await drawCrystallise(f, { widen: widenAt(t), t });
});

// ================================================================ S38: Flammarion (kick out, one bar)
// A soldier's hand presses into the sky: the firmament is a membrane of lines; it dents and ripples around the palm,
// tears open on the stab (125.11) with recoiling line ends, and widens on the second stab (125.99): beyond it, the
// machinery of the heavens (orbits, gear trains, dials, rows of engraved glyphs), all in lines.
const S38 = { t0: 124.475, touch: 124.92, tear: 125.109, tear2: 125.991, t1: 126.206 };
// P24 (take 1) raises the arm 1.0-3.8 s and presses the spread palm ~1.6-2.3 s: retimed so the palm meets the membrane
// on the touch (124.92 -> plate 1.6), then 1:1 through the bar (126.21 -> 2.9)
const handTp = t => t < S38.touch ? lerp(.95, 1.6, clamp((t - S38.t0) / (S38.touch - S38.t0))) : 1.6 + (t - S38.touch);
const HAND = { src: { plate: 'P24', standin: 'hand' }, trace: { ...CU_TRACE, lightDir: [-.3, -1], contourW: [1.8, 3.0], contourB: 1.9, bgGain: 0, dsepMin: 5.5, dsepMax: 14, subjBright: [.15, .55], innerHi: .3 }, corona: false, analysis: { autoGain: .75 } };
function membraneLines(W, H, s) {
  const out = [], n = 42;
  for (let i = 0; i < n; i++) {                         // the firmament: a dome of latitude lines seen from below
    const v = i / (n - 1), y0 = lerp(-.12, .92, Math.pow(v, 1.25)) * H, bow = lerp(.2, .06, v) * H, pts = [];
    for (let k = 0; k <= 120; k++) { const u = k / 120, x = lerp(-.05, 1.05, u) * W; pts.push([x, y0 - bow * Math.sin(Math.PI * u) + .005 * H * Math.sin(u * 9 + i * 1.7)]); }
    out.push(proc.line(pts, { b: (u) => (.4 + .25 * hash3(i, 3, 1)) * lerp(1, .5, v) * (.45 + .55 * Math.exp(-Math.pow((u - .55) / .3, 2))), w: .9, o: .04, phase: hash3(i, 3, 2) * TAU, spd: .6, id: i + 1 }));
  }
  for (let i = 0; i < 14; i++) {                        // meridians converging at the zenith (off the top of frame)
    const a = lerp(-1.25, 1.25, i / 13), pts = []; for (let k = 0; k <= 60; k++) { const r = lerp(.15, 1.25, k / 60) * H; pts.push([W / 2 + Math.sin(a) * r * 1.4, -.35 * H + Math.cos(a) * r]); }
    out.push(proc.line(pts, { b: .2, w: .8, o: .04, phase: i, spd: .5 }));
  }
  for (let k = 0; k < 260; k++) { const x = hash3(k, 7, 1) * W, y = hash3(k, 7, 2) * H; out.push(proc.line([[x, y], [x + .5, y]], { b: .35 + .9 * Math.pow(hash3(k, 7, 3), 3), w: 1.3 + 1.2 * hash3(k, 7, 4), flags: FL.TIP | FL.SHARP })); }
  return out;
}
function machinery(cx, cy, s, t, hole) {
  // the machinery supports the hand and the tear (dimmer than the membrane's torn edges and the hand's contours)
  const out = [], A = { w: 1, b: .62, o: 1 };
  out.push(...proc.dial(cx, cy, 300 * s, 72, { ...A, o: .9, b: .45 }, t * .05));
  out.push(...proc.gear(cx - 120 * s, cy + 40 * s, 110 * s, 24, t * .9, { ...A, b: .68 }));
  out.push(...proc.gear(cx + 62 * s, cy - 58 * s, 75 * s, 16, -t * .9 * 24 / 16 + .1, { ...A, b: .62 }));
  out.push(...proc.gear(cx + 170 * s, cy + 98 * s, 62 * s, 13, t * .9 * 24 / 13, { ...A, b: .55 }));
  out.push(...proc.orbits(cx + 40 * s, cy + 10 * s, 260 * s, 1.15, t, { w: .85, b: .5, o: .1 }));
  for (let r = 0; r < 4; r++) out.push(...proc.glyphRow(cx - 340 * s, cy - 210 * s + r * 140 * s, 680 * s, 15 * s, 11 + r, { w: .85, b: .36, o: .25 }, (r % 2 ? -1 : 1) * t * 60 * s));
  // keep only what lies inside the hole (clip by splitting)
  const res = [];
  for (const L of out) {
    if (!L) continue;
    let cur = [];
    for (let k = 0; k < L.n; k++) { const x = L.xy[k * 2], y = L.xy[k * 2 + 1]; if (hole(x, y)) cur.push([x, y]); else { if (cur.length > 1) res.push(proc.line(cur, { b: L.b[0], w: L.w[0], o: L.o[0] })); cur = []; } }
    if (cur.length > 1) res.push(proc.line(cur, { b: L.b[0], w: L.w[0], o: L.o[0] }));
  }
  return res;
}
scene('S38', async f => {
  const W = f.W, H = f.H, s = H / 1080, t = f.t;
  const rise = easeOut(clamp((t - S38.t0) / (S38.touch - S38.t0)));
  const live = resolve(HAND.src).kind === 'plate';
  const handY = live ? 0 : lerp(.85, .34, rise) * H;
  const press = sstep(S38.touch - .08, S38.tear, t), tear = t >= S38.tear ? easeOut(clamp((t - S38.tear) / .55)) : 0, tear2 = t >= S38.tear2 ? easeOut(clamp((t - S38.tear2) / .25)) : 0;
  // the hand's silhouette (its matte, in screen px) occludes the membrane
  const F = await sourceFields(HAND.src, live ? handTp(t) : 0, 960, W / H), M = F.M, hand = { meta: { S: W / F.aw } };
  // the contact: the topmost point of the hand's matte (fingertips), in screen px
  let contact = [W * .5, H * .06 + handY];
  if (M) { let best = null; for (let y = 2; y < F.ah && !best; y++) for (let x = 2; x < F.aw - 2; x++) if (M[y * F.aw + x] > .5) { best = [x * hand.meta.S, y * hand.meta.S + handY]; break; } if (best) contact = best; }
  // the tear opens into the open sky: above the fingertips (stand-in), beside the raised hand (P24: hand high, sky to its left)
  const Rh = (tear * 300 + tear2 * 170) * s, hole = live ? [Math.max(.3 * W, contact[0] - .2 * W), Math.min(.55 * H, contact[1] + .25 * H)] : [contact[0], contact[1] - .1 * H];
  const inHand = (x, y) => { if (!M) return false; const ax = x / hand.meta.S, ay = (y - handY) / hand.meta.S; if (ax < 0 || ay < 0 || ax >= F.aw - 1 || ay >= F.ah - 1) return ay >= F.ah - 1 && Math.abs(ax - F.aw / 2) < F.aw * .12; return M[(ay | 0) * F.aw + (ax | 0)] > .45; };
  // membrane: dent + spreading ripples around the contact, tear around the hand
  const mem = membraneLines(W, H, s), tc = S38.touch;
  proc.displace(mem, (x, y) => {
    const dx = x - contact[0], dy = y - contact[1], r = Math.hypot(dx, dy) + 1e-3;
    const sg = 150 * s, dent = 60 * s * press * (r / sg) * Math.exp(-r * r / (2 * sg * sg));      // zero at the contact: lines bend around it
    const age = t - tc, rip = age > 0 ? 9 * s * Math.sin((r - 900 * s * age) / (34 * s)) * Math.exp(-r / (520 * s)) * Math.exp(-age / .9) * sstep(0, 900 * s * age, 900 * s * age - r + 60 * s) : 0;
    const recoil = Rh > 0 && r < Rh * 1.6 ? (Rh * 1.6 - r) * .35 * (1 - .4 * tear2) : 0;
    return [dx / r * (dent + rip + recoil), dy / r * (dent + rip + recoil)];
  });
  // split the membrane where the hand covers it or the hole has opened; mark cut ends with bright tips
  const memOut = [];
  for (const L of mem) {
    if (L.flags & FL.TIP) { const x = L.xy[0], y = L.xy[1]; if (!inHand(x, y) && Math.hypot(x - contact[0], y - contact[1]) > Rh) memOut.push(L); continue; }
    let cur = [];
    const flush = (cut) => { if (cur.length > 1) { const l = proc.line(cur, { b: L.b[0] * (1 + .6 * press), w: L.w[0], o: L.o[0], phase: L.phase, spd: L.spd, taper: .02 }); memOut.push(l); if (cut && tear > 0) { const e = cur[cur.length - 1]; memOut.push(proc.line([e, [e[0] + .5, e[1]]], { b: 2.2, w: 2.2, o: .6, flags: FL.TIP | FL.SHARP })); } } cur = []; };
    for (let k = 0; k < L.n; k++) {
      const x = L.xy[k * 2], y = L.xy[k * 2 + 1], inHole = Rh > 0 && Math.hypot(x - hole[0], (y - hole[1]) * 1.35) < Rh;
      if (inHole || inHand(x, y)) flush(inHole); else { if (!cur.length && k > 0 && Rh > 0 && tear > 0) { const pts = [x, y]; memOut.push(proc.line([pts, [x + .5, y]], { b: 2.2, w: 2.2, o: .6, flags: FL.TIP | FL.SHARP })); } cur.push([x, y]); }
    }
    flush(false);
  }
  const layers = [dynLayer(memOut, { uT: audio.flowPhase(t) * .6 })];
  if (Rh > 2) layers.push(dynLayer(machinery(hole[0], hole[1] - 60 * s, s, t - S38.tear, (x, y) => Math.hypot(x - hole[0], (y - hole[1]) * 1.35) < Rh * .97 && !inHand(x, y)), { uBright: .95 + .5 * tear2 }));
  await drawLines(f, { ...HAND, tp: live ? handTp(t) : 0, chainFrom: .95, cam: { pan: [0, handY] }, phase: audio.flowPhase(t), layers, look: { glow: [.2, .07] }, disk: false });
  steer(f, { kick: 0 });
});

// ================================================================ S39-S40: the agents
// Top-down, the soldiers become particles and re-form on the beat like a drone show. Formation 0 is the armies where
// they stand in the master composition (P01's ranked banks lifted onto the ground plane); then, snapping on the listed
// stabs: two mirrored blocks -> streams along the banks -> a vortex -> rings -> one bold ring around the river bend ->
// the ring tightens onto the limb of a black disk. S40: the ring fills into a REAL eclipse made of particles (a crisp
// black disk, a dense bright limb, red prominences, helmet streamers flowing outward, polar plumes, the inner corona),
// built from the same streamer table and tilt as the sky's corona, so it mirrors the eclipse in the sky; the camera
// tilts up from the eclipse on the ground to the real one (which lands exactly where S41's centre-locked ring is). No
// eye shapes and no eyelids anywhere: the eclipse always looks like an actual eclipse (SHOTLIST S40). Every soldier is
// a crisp point with a tiny spear tick (2 x 2600 of them, sharp, no bloom); a snap streaks them for a few frames
// (motion trails), then they hold still and sharp. Design space: 1920 x 1080 "map px", (960, 540) = the bend.
const NP = 2600;                                   // agents per side (Lydians sigma = -1 west, Medes sigma = +1 east)
const riverX = y => 960 + 150 * Math.sin(Math.PI * (y - 540) / 980);
// formation snaps on the listed stabs; a stab 1-10 ms after a kick lands on the kick's frame (one visual hit, not two)
const onKick = t => { for (const k of audio.kickTimes()) if (Math.abs(k - t) < .012) return Math.min(k, snap(t)); return snap(t); };
const SNAPS = [126.206, 127.505, 128.803, 129.236, 130.967, 131.828, 132.694, 133.126].map(onKick);
const easeBack = k => { const c = 1.7; k = clamp(k); return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
// P01's armies from above: samples of the master plate's detailed (ranked) bank regions, lifted onto the ground plane
// (pinhole camera, horizon through the river's vanishing point) and laid along the stylised river: lateral distance from
// the river -> distance from riverX (compressed), log depth -> map y (near at the bottom). Cached per page.
const P01_VP = [.5, .355];
let P01POS = null;
async function p01Positions() {
  if (P01POS) return P01POS;
  const pos = { '-1': null, '1': null };
  let F = null;
  try { F = await sourceFields(MASTER.src, 1.0, 480, 16 / 9); } catch (e) { F = null; }
  if (F && F.kind === 'plate') {
    const { aw, ah } = F, [vx, vy] = P01_VP, vn = .8, vf = .38, lz = Math.log((vn - vy) / (vf - vy));
    const at = (u, v) => { const x = clamp(u * aw | 0, 0, aw - 1), y = clamp(v * ah | 0, 0, ah - 1), i = y * aw + x; return F.detail[i] * (F.M ? 1 - sstep(.15, .4, F.M[i]) : 1); };
    for (const sg of [-1, 1]) {
      const out = [];
      for (let n = 0; out.length < NP && n < NP * 80; n++) {
        const v = vy + (vn - vy) * Math.exp(-hash3(n, sg > 0 ? 47 : 53, 5) * lz), edge = .03 + .281 * (v - vy);   // uniform in log depth; the river's half-width at v
        const u = sg < 0 ? (vx - edge) * hash3(n, 41, 3) : vx + edge + (1 - vx - edge) * hash3(n, 43, 3);
        if (at(u, v) < .3 + .4 * hash3(n, sg, 77)) continue;                                                         // denser where the ranks are detailed
        const X = Math.abs(u - vx) * (16 / 9) / (v - vy), zeta = clamp(Math.log((vn - vy) / (v - vy)) / lz);
        const y = 1050 - zeta * 1010, x = riverX(y) + sg * (92 + 380 * (1 - Math.exp(-Math.max(0, X - .5) / 2.4))) + 8 * (hash3(n, sg, 13) - .5);
        out.push([x, y]);
      }
      if (out.length >= NP * .5) { while (out.length < NP) { const q = out[out.length % Math.max(1, out.length)]; out.push([q[0] + 3 * (hash3(out.length, sg, 9) - .5), q[1] + 3 * (hash3(out.length, sg, 11) - .5)]); } }
      out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      pos[String(sg)] = out.length >= NP ? out : null;
    }
  }
  return (P01POS = pos);
}
function formation(F, j, sg, t, ts) {
  const dt = t - ts;
  switch (F) {
    case 0: { const P = P01POS && P01POS[String(sg)]; if (P) return [P[j][0], P[j][1], -sg, 0];
      const r = j % 12, i = Math.floor(j / 12), y = 70 + i * (940 / (NP / 12 - 1)); return [riverX(y) + sg * (95 + r * 24), y, -sg, 0]; }       // ranks along the banks
    case 1: { const col = j % 60, row = Math.floor(j / 60); return [960 + sg * (560 + (col - 29.5) * 8.4) + 2.6 * (hash3(j, sg, 21) - .5), 540 + (row - 21.5) * 10.4 + 2.6 * (hash3(j, sg, 22) - .5), -sg, 0]; }   // two mirrored blocks
    case 2: { const r = j % 10, i = Math.floor(j / 10), span = 1040, y0 = i * (span / (NP / 10 - 1)) - sg * 150 * dt * (1 + .15 * (r % 3)); const y = ((y0 % span) + span) % span - 20; return [riverX(y) + sg * (95 + r * 27 + 10 * Math.sin(y / 70 + r)), y, 0, -sg]; }
    case 3: { const a = j % 6, u = Math.floor(j / 6) / (NP / 6), r = 140 + 430 * u + 30 * (hash3(j, sg, 23) - .5), th = a * TAU / 6 + (sg > 0 ? Math.PI / 6 : 0) + 1.9 * Math.log(r / 140) * -sg + -sg * .85 * dt + .11 * (hash3(j, sg, 24) - .5); return [960 + r * Math.cos(th), 540 + r * Math.sin(th), -Math.sin(th) * -sg, Math.cos(th) * -sg]; }
    case 4: { const kk = 2 * (j % 4) + (sg > 0 ? 1 : 0), m = Math.floor(j / 4), r = 210 + kk * 19 + 9 * (hash3(j, sg, 25) - .5), th = m / (NP / 4) * TAU + -sg * .6 * dt + kk * .3; return [960 + r * Math.cos(th), 540 + r * Math.sin(th), -Math.sin(th) * -sg, Math.cos(th) * -sg]; }
    case 5: { const kk = sg > 0 ? 1 : 0, r = 236 + kk * 46 + (j % 5) * 7, th = j / NP * TAU + -sg * 1.3 * dt; return [960 + r * Math.cos(th), 540 + r * Math.sin(th), -Math.sin(th) * -sg, Math.cos(th) * -sg]; }   // the ring: two bold bands
    case 6: { const q = 2 * j + (sg > 0 ? 1 : 0), r = R0 + 2 + 70 * Math.pow(hash3(q, 28, 61), 2.2), th = q / (2 * NP) * TAU + .02 * (hash3(q, 27, 61) - .5);   // the ring tightens onto the limb
      return [960 + r * Math.cos(th), 540 + r * Math.sin(th), Math.cos(th), Math.sin(th)]; }
    case 7: return eclipseAt(j, sg, t);
  }
  return [960, 540, 0, -1];
}
// the ground eclipse: disk radius (map px) and the sky corona's own streamer / prominence table and tilt (the mirror)
const R0 = 150;
const EC = { tilt: RING.tilt, streamers: CORONA_DEFAULTS.streamers, prominences: CORONA_DEFAULTS.prominences };
const EC_W = (() => { const w = EC.streamers.map(S => S[3] * Math.sqrt(S[1])), tot = w.reduce((a, b) => a + b, 0); let acc = 0; return w.map(v => (acc += v / tot)); })();
// agent j of side sg in the particle eclipse: [x, y, dirx, diry, colour (0 pearl, 1 orange, 2 H-alpha red), brightness]
function eclipseAt(j, sg, t) {
  const q = 2 * j + (sg > 0 ? 1 : 0), h = a => hash3(q, a, 61), u = h(1), flow = Math.max(0, t - SNAPS[7]);
  let r, th, o = .04, b;
  if (u < .2) { r = R0 + 1.5 + 5 * h(2) * h(3); th = h(4) * TAU; b = 1.25; }                                   // the limb: a dense bright ring
  else if (u < .26) {                                                                                         // prominences: small red arches on the limb
    const P = EC.prominences[Math.floor(h(2) * EC.prominences.length)], s = h(3), lay = .55 + .15 * Math.floor(h(4) * 4);
    r = R0 + 2 + R0 * P[2] * 2.2 * lay * Math.sin(Math.PI * s); th = EC.tilt + P[0] + P[1] * 1.5 * lay * (2 * s - 1); o = 2; b = 1.15;
  } else if (u < .62) {                                                                                       // helmet streamers: wide domed base, long stalk
    let si = 0; while (si < EC_W.length - 1 && h(2) > EC_W[si]) si++;
    const S = EC.streamers[si], s = (h(3) + .035 * flow) % 1, hw = S[2] * (.12 + .88 * Math.pow(1 - s, 1.7));
    r = R0 * (1.02 + S[1] * Math.pow(s, 1.25)); th = EC.tilt + S[0] + hw * (2 * h(4) - 1) * Math.sqrt(h(5));
    b = S[3] * 1.35 * Math.pow(R0 / r, .85) * sstep(0, .05, s) * (1 - sstep(.75, 1, s));
  } else if (u < .85) { r = R0 * (1.02 - .28 * Math.log(1 - .96 * h(2))); th = h(3) * TAU; b = .9 * Math.pow(R0 / r, 1.5); }     // the inner corona
  else if (u < .95) {                                                                                         // polar plumes
    const pole = EC.tilt + (h(2) < .5 ? -1 : 1) * Math.PI / 2, s = h(3), a0 = pole + (h(4) - .5);
    r = R0 * (1.02 + .9 * s); th = a0 + (a0 - pole) * .4 * (r - R0) / R0; b = .75 * Math.pow(R0 / r, 2) * (1 - sstep(.6, 1, s));
  } else { const s = (h(2) + .025 * flow) % 1; th = h(3) * TAU; r = R0 * (1.05 + 2.4 * s); b = .45 * Math.pow(R0 / r, 1.2) * sstep(0, .08, s) * (1 - sstep(.6, 1, s)); }   // faint outer rays
  const c = Math.cos(th), sn = Math.sin(th);
  return [960 + r * c, 540 + r * sn, c, sn, o, b];
}
// agent j of side sg at time t: a hard snap (fast, overshooting) from the previous formation after each listed stab;
// the eclipse (k = 7) fills outward from the limb instead (agents bound for the outer corona leave later)
function agentAt(j, sg, t) {
  let k = 0; while (k + 1 < SNAPS.length && t >= SNAPS[k + 1] - 1e-6) k++;
  const ts = SNAPS[k], side = sg < 0 ? .85 : .12, full = v => (v.length < 6 ? [v[0], v[1], v[2], v[3], v[4] ?? side, v[5] ?? 1] : v);
  const B = full(formation(k, j, sg, t, ts));
  if (k === 0) return B;
  // the snap frame is the flight's first frame (every agent has moved on it: the hit lands on the stab's frame)
  const D = k === 7 ? .9 : .16, st = k === 7 ? .5 * clamp((Math.hypot(B[0] - 960, B[1] - 540) - R0) / (3.2 * R0)) : .012 * hash3(j, sg > 0 ? 3 : 4, 9);
  const tf = t - ts + 1 / FPS - st, e = k === 7 ? easeInOut(clamp(tf / D)) : easeBack(tf / D);
  if (e >= 1 && (k === 7 || tf >= D)) return B;
  const A = full(formation(k - 1, j, sg, t, SNAPS[k - 1]));
  return A.map((v, i) => lerp(v, B[i], e));
}
// map-space lines with the disk (960, 540, r) cut out: the ground eclipse's disk is crisp black
function clipDisk(lines, r) {
  const out = [];
  for (const L of lines) {
    if (!L) continue;
    let cur = [];
    const flush = () => { if (cur.length > 1) out.push(proc.line(cur, { b: L.b[0], w: L.w[0], o: L.o[0], phase: L.phase, spd: L.spd, flags: L.flags })); cur = []; };
    for (let k = 0; k < L.n; k++) { const x = L.xy[k * 2], y = L.xy[k * 2 + 1]; if (Math.hypot(x - 960, y - 540) < r) flush(); else cur.push([x, y]); }
    flush();
  }
  return out;
}
function groundLines() {                          // the river (orange banks, flowing water) and a sparse map of the land
  const out = [];
  for (const sg of [-1, 1]) {
    const bank = []; for (let y = -40; y <= 1120; y += 6) bank.push([riverX(y) + sg * (40 + 5 * Math.sin(y / 47 + sg)), y]);
    out.push(proc.line(bank, { b: .8, w: 1.5, o: 1, flags: FL.NOFADE }));
    for (let r = 1; r <= 3; r++) { const pts = []; for (let y = -40; y <= 1120; y += 10) pts.push([riverX(y) + sg * (40 + r * r * 22 + 90 * r + 14 * Math.sin(y / (90 + 13 * r) + r)), y]); out.push(proc.line(pts, { b: .07 - .015 * r, w: .7, o: .05, phase: r, spd: .4 })); }
  }
  for (let i = -3; i <= 3; i++) { const pts = []; for (let y = -40; y <= 1120; y += 8) pts.push([riverX(y) + i * 10 + 3 * Math.sin(y / 30 + i * 2), y]); out.push(proc.line(pts, { b: .24, w: .8, o: .03, phase: i * 1.3, spd: 1.4 })); }
  return out;
}
// map px -> screen: orthographic top-down (S39) or the S40 tilt camera
function mapCam(f, t) {
  const W = f.W, H = f.H, s = H / 1080, F = 1.2 * W;
  const k = clamp((t - snap(135.716)) / (snap(138.316) - snap(135.716))), e = easeInOut(k);
  const th = lerp(-90, 6, e) * Math.PI / 180, wk = 1 / 540;
  const camY = lerp(F / (H / 2) * 1.0, .55, e), camZ = lerp(0, 5.5, Math.pow(e, .8));
  const ct = Math.cos(th), st = Math.sin(th);
  const proj = (x, y, Y = 0) => {
    const X = (x - 960) * wk, Z = (y - 540) * wk, rx = X, ry = Y - camY, rz = Z - camZ;
    const xc = rx, yc = ry * ct + rz * st, zc = ry * st - rz * ct;
    return zc > .02 ? [W / 2 + F * xc / zc, H / 2 - F * yc / zc, zc] : null;
  };
  const alt = 6 * Math.PI / 180, ya = alt - th;
  const sun = Math.cos(ya) > .05 ? [W / 2, H / 2 - F * Math.tan(ya)] : null;
  const horizon = Math.cos(-th) > .05 ? H / 2 - F * Math.tan(-th) : null;
  return { proj, sun, horizon, e, F, top: k <= 0, z0: F / (H / 2) };
}
function projectLines(lines, C, f) {
  const out = [];
  for (const L of lines) {
    if (!L) continue;
    let cur = [];
    const flush = () => { if (cur.length > 1) out.push(proc.line(cur, { b: (u, k) => L.b[cur.k0 + k] ?? L.b[0], w: L.w[0], o: L.o[0], phase: L.phase, spd: L.spd, flags: L.flags })); cur = []; };
    for (let k = 0; k < L.n; k++) { const p = C.proj(L.xy[k * 2], L.xy[k * 2 + 1]); if (!p || p[1] < -200 || p[1] > f.H + 400) { flush(); continue; } if (!cur.length) cur.k0 = k; cur.push([p[0], p[1]]); }
    flush();
  }
  return out;
}
// every agent: a crisp point and a tiny spear tick along its facing (both sharp: they never bloom); while a snap is in
// flight a short trail (where it was three frames ago) streaks behind it
function agentLines(f, t, C) {
  const out = [], s = f.H / 1080, kick = audio.kickEnv(t, .12);
  let ki = 0; while (ki + 1 < SNAPS.length && t >= SNAPS[ki + 1] - 1e-6) ki++;
  const ds = t - SNAPS[ki], flash = 1 + 1.2 * Math.exp(-ds / .06) * (ki > 0 ? 1 : 0), flying = ki > 0 && ds < (ki === 7 ? 1.5 : .26);
  // the corona breathes with the kick: everything outside the limb pushed radially out from the disk (the disk stays put)
  const breath = 1 + .12 * kick;
  const pump = p => { const dx = p[0] - 960, dy = p[1] - 540, r = Math.hypot(dx, dy); if (r > R0 + 1) { const k = (R0 + (r - R0) * breath) / r; p[0] = 960 + dx * k; p[1] = 540 + dy * k; } return p; };
  for (const sg of [-1, 1]) for (let j = 0; j < NP; j++) {
    const a = agentAt(j, sg, t); if (t >= SNAPS[6]) pump(a);
    const pa = C.proj(a[0], a[1]); if (!pa) continue;
    const dk = Math.min(1.8, C.z0 / pa[2]) * s, o = clamp(a[4], 0, 2);
    const b0 = (1.45 + .45 * hash3(j, sg, 1)) * flash * (1 + .45 * kick) * a[5];
    if (b0 < .02) continue;
    if (flying) {
      const b = agentAt(j, sg, t - .5 / FPS); if (t - .5 / FPS >= SNAPS[6]) pump(b);
      const pb = C.proj(b[0], b[1]);
      if (pb) { const len = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]); if (len > 4 * s && len < 420 * s) out.push(proc.line([[pb[0], pb[1]], [pa[0], pa[1]]], { b: u => b0 * .3 * u, w: 1.2 * dk, o, flags: FL.SHARP })); }
    }
    const fl = Math.hypot(a[2], a[3]) || 1, tip = C.proj(a[0] + a[2] / fl * 10, a[1] + a[3] / fl * 10);
    if (tip) out.push(proc.line([[pa[0], pa[1]], [tip[0], tip[1]]], { b: b0 * .8, w: 1.3 * dk, o, flags: FL.SHARP }));             // the spear tick
    out.push(proc.line([[pa[0], pa[1]], [pa[0] + .5, pa[1]]], { b: b0 * 2.1, w: 3.6 * dk, o, flags: FL.TIP | FL.SHARP }));       // the soldier: a point of light
  }
  return out;
}
// the bold outlines that make the ring and the eclipse read at a glance (phone size): drawn once the agents have landed
function boldShapes(t) {
  const out = [], kick = audio.kickEnv(t, .13);
  const circ = (r, b, w, o) => { const pts = []; for (let k = 0; k <= 180; k++) { const a = k / 180 * TAU; pts.push([960 + r * Math.cos(a), 540 + r * Math.sin(a)]); } return proc.line(pts, { b, w, o, flags: FL.NOFADE | FL.SHARP }); };
  const ringK = t >= SNAPS[5] && t < SNAPS[6] ? sstep(SNAPS[5] + .1, SNAPS[5] + .3, t) : 0;
  if (ringK > 0) { out.push(circ(229, 1.1 * ringK, 2.8, .85), circ(271, .7 * ringK, 1.6, .5), circ(317, 1.1 * ringK, 2.8, .12)); }
  // from the ring tightening on: the limb of the ground eclipse, a crisp bright circle at the black disk's edge
  const limbK = t >= SNAPS[6] ? sstep(SNAPS[6] + .08, SNAPS[6] + .2, t) : 0;
  if (limbK > 0) out.push(circ(R0 + 1, 1.5 * limbK, 2.6, .06));
  return out;
}
const diskOn = t => t >= SNAPS[6] + .08;
scene('S39', async f => {
  const t = f.t, C = mapCam(f, 0), s = f.H / 1080; await p01Positions();
  const ground = projectLines(diskOn(t) ? clipDisk(groundLines(), R0) : groundLines(), C, f), kick = audio.kickEnv(t, .12);
  await drawLines(f, { layers: [dynLayer(ground, { uT: audio.flowPhase(t) }), dynLayer(projectLines(boldShapes(t), C, f), {}), dynLayer(agentLines(f, t, C), {})], kick, kickWidth: .5, look: { glow: [.08, .03] },
    disk: diskOn(t) ? { x: f.W / 2, y: f.H / 2, r: R0 * s } : false });
  steer(f, { kick });
});
scene('S40', async f => {
  const t = f.t, W = f.W, H = f.H, s = H / 1080, C = mapCam(f, t), kick = audio.kickEnv(t, .13);
  const layers = [dynLayer(projectLines(clipDisk(groundLines(), R0), C, f), { uT: audio.flowPhase(t) }), dynLayer(projectLines(boldShapes(t), C, f), {}), dynLayer(agentLines(f, t, C), {})];
  // top-down: the ground eclipse's disk is cut analytically (crisp black); once the sky's eclipse rises into view, its disk
  let disk = C.top ? { x: W / 2, y: H / 2, r: R0 * s } : false, sun = C.top ? [W / 2, H / 2, R0 * s] : null;
  if (C.horizon != null) layers.push(dynLayer([proc.line([[-50, C.horizon], [W + 50, C.horizon]], { b: .9, w: 1.4, o: 1, flags: FL.NOFADE }), proc.line([[-50, C.horizon + 6 * s], [W + 50, C.horizon + 6 * s]], { b: .3, w: 1, o: 1, flags: FL.NOFADE })], {}));
  if (C.sun && C.sun[1] < H + 300 * s) {
    const R = ringR(H); sun = [C.sun[0], C.sun[1], R];
    layers.push({ mesh: coronaRing(f, 'ring', { refR: R, ...RING }), u: { ...ringU(C.sun[0], C.sun[1], R * (1 + .025 * kick)), uBright: 1.25, uPush: [C.sun[0], C.sun[1], 22 * kick * s, 300 * s] } });
    disk = { x: C.sun[0], y: C.sun[1], r: R };
  }
  await drawLines(f, { layers, kick, kickWidth: .5, look: { glow: [.14, .05] }, disk });
  steer(f, { kick, sun: sun ? typeSun(sun) : undefined });
});
