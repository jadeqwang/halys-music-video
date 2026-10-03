// sheets.js: the x-sheets of S78, S80 and S81 (the room), per plate take, plus the stand-in sheets. Pure data (no DOM):
// imported by scenes/room.js.
//
// Music events (production/SOUND_DESIGN.md, video/data/timing.json):
//   ticks of the ticking build 266.12-269.62 (the terminal scrolls one line per tick; the type track uses the same times)
//   the final stark chord 270.04 = the cut to S79 (TREATY: the kings swear peace)   the frozen chord from 271.6
//   three key clicks 273.45 / 274.05 / 274.95                                         the wink's ting 276.95
//   audio ends 279.60; the film runs to 281.0 (silent end card)
//
// Plates (REVISION_V2 decisions 6 and 8: she is anime). S78 = P57 (take 2), from the anime keyframe K78d: the room seen from
// behind her chair, P39's camera. Only she comes from P57: the room is still P39's painted background, so P57 maps into P39's
// frame by a measured similarity (SIFT on the room, 789 inliers pooled over 7 frames, 0.77 px median residual; Seedance's
// camera is static). S80/S81 = P58 (take 2), from the keyframe K80b: the close-up with the closed-lip, one-corner-up smirk.

import { frameAt, hold, seq, seqEnd, run, sheet, TWOS } from './xsheet.js';

// Event times are the onsets MEASURED in the final mix (media/stems/halys_sd_master.wav, peak spectral flux in each
// event's band): the cue sheet's 273.45 / 274.05 / 274.95 / 276.95 are the sound designer's nominal times, up to 27 ms off
// the actual attacks. Picture events land on the first master frame at or after the measured onset.
export const EV = {
  ticks: [266.118, 266.551, 267.186, 267.4, 267.628, 267.747, 267.844, 268.081, 268.191, 268.299, 268.524, 269.022, 269.288, 269.622],
  dtShift: 268.081,            // the `dt.shift(+300)` line: the totality band slides north onto the Halys (and she leans in)
  burst: [269.288, 269.872],   // `git commit -am "fix(halys): ` typed in a burst (type track)
  chord: 270.013,              // the final stark chord's attack (cue 270.04): the cut to S79
  freeze: 271.6,
  keys: [273.455, 274.025, 274.927],   // key clicks (cues 273.45 / 274.05 / 274.95)
  enter: 274.95, output: 275.07,
  glitter: 276.85, ting: 276.947,      // the tine (cue 276.95): the eyelid shuts on frame 16617
  black: 277.55,               // the wink holds 0.6 s, then black; the end card type starts 277.55 (type track)
  audioEnd: 279.6, end: 281.0,
  shots: { S78: [266.12, 270.04], S80: [273.40, 276.95], S81: [276.95, 281.0] },
};
// the ticks follow timing.json's snares (the type track scrolls the terminal on the same list)
export function setEvents(TM) {
  const sn = TM && TM.events && TM.events.snares;
  if (sn && sn.length) { const tk = sn.filter(t => t >= 266.0 && t < 269.8); if (tk.length >= 8) EV.ticks = tk; }
  return EV;
}

// plate -> setup similarities (960x540 frames): x_setup = s * x_src + tx. P40 only feeds the painted background now.
export const REG = {
  'P40:take2.mp4->P39': { s: 1 / 0.95163, tx: -21.31 / 0.95163, ty: -0.242 / 0.95163 },
  'P57:take2.mp4->P39': { s: 1.02186, tx: -6.99, ty: 2.53 },     // prep/register.py P57 --to=P39 --frames=1,16,32,48,64,80,97
};

// ---------------------------------------------------------------- per-take sheets
// Regions are setup-normalised ellipses (the drawing is built in setup space). S78: her right forearm and typing hand
// (frame right), per body drawing; the back, the hair and the patch stay on the held body cel.
const HAND_A = { cx: .492, cy: .655, rx: .056, ry: .088, feather: .45 };     // seated (body f13)
const HAND_C = { cx: .503, cy: .652, rx: .056, ry: .088, feather: .45 };     // leaned in toward the side monitor (body f49)
const HAND_E = { cx: .478, cy: .656, rx: .056, ry: .088, feather: .45 };     // seated again (body f69)
// S80: her right shoulder and sleeve (frame left) as she reaches back to the keyboard behind her
const ARM58 = { cx: .15, cy: .86, rx: .24, ry: .22, feather: .4 };

export const TAKES = { P57: 'take2.mp4', P58: 'take2.mp4' };

export function roomSheets(takes = {}) {
  const T = EV, F = frameAt, out = {};
  if (takes.P57 !== TAKES.P57 || takes.P58 !== TAKES.P58) return null;

  // S78: anime limited animation. Each tick snaps to a new typing drawing held to the next tick (real holds): only the
  // forearm and hand are redrawn over the held body cel. On the tick before dt.shift she leans in toward the vertical
  // monitor (four drawings on twos, P57 f33-f45) and the lean lands ON the dt.shift tick, when the totality band slides
  // onto the Halys; she settles back in the long gap before the commit (f55-f67), then the commit burst runs on twos.
  const tk = T.ticks.map(t => F(Math.max(t, T.shots.S78[0])));
  const Fland = F(T.dtShift), Flean = tk[tk.indexOf(Fland) - 1] ?? Fland - 14;
  const s78 = [];
  const poseA = [5, 21, 9, 25, 17, 29], poseC = [51, 47, 53], poseE = [73, 81, 77, 89];
  let a = 0, c = 0, e = 0;
  for (const Fk of tk) {
    if (Fk < Flean) s78.push(...hold(Fk, 'P57', poseA[a++ % poseA.length], { ref: 13, region: HAND_A, tag: 'tick' }));
    else if (Fk === Flean) [33, 38, 42].forEach((pf, k) => s78.push({ F: Flean + Math.round(k * (Fland - Flean) / 3), src: 'P57', pf, tag: 'lean' }));
    else if (Fk === Fland) s78.push(...hold(Fk, 'P57', 45, { tag: 'lean-land' }));
    else if (Fk < F(268.6)) s78.push(...hold(Fk, 'P57', poseC[c++ % poseC.length], { ref: 49, region: HAND_C, tag: 'tick' }));
    else if (Fk < F(T.burst[0])) s78.push(...hold(Fk, 'P57', poseE[e++ % poseE.length], { ref: 69, region: HAND_E, tag: 'tick' }));
  }
  // settling back (after the 268.524 tick's drawing has been seen for six frames)
  const Fback = tk.find(f => f >= F(268.5)) + 6;
  s78.push(...seq(Fback, 'P57', [55, 59, 63, 67], TWOS, { tag: 'back' }));
  // fill the rest of the gap before the 269.022 tick with the settled body
  s78.push(...hold(Fback + 4 * TWOS, 'P57', 69, { tag: 'settled' }));
  // the commit burst: typing on twos at speed, then the last drawing holds to the cut (270.04)
  s78.push(...run(F(T.burst[0]), F(T.burst[1]), 'P57', 71, 95, TWOS, { ref: 69, region: HAND_E, tag: 'burst' }));
  s78.push(...hold(F(T.burst[1]), 'P57', 85, { ref: 69, region: HAND_E, tag: 'tick' }));
  out.wide = sheet(s78);

  // S80: P58 close-up. The smirk is there from the cut (the plate holds it throughout); the face is one held cel (ref f30)
  // and only her right shoulder and sleeve (frame left) are redrawn as she types blind. Each key click lands on a press
  // drawing (the shoulder back down, pushed a little lower: anime exaggeration, dy in px), the lifts before it on twos:
  // plate lifts f12-f18 / f39-f45 / f69-f78, presses f24 / f48 / f84 (measured: median vertical flow in the region).
  const K = T.keys.map(F);
  const r58 = { ref: 30, region: ARM58 }, up = { ...r58, dy: -4 }, dn = { ...r58, dy: 6 }, rel = { ...r58, dy: 1 };
  const s80 = [
    ...hold(F(T.shots.S80[0]), 'P58', 18, { ...up, tag: 'lift' }),
    ...hold(K[0], 'P58', 24, { ...dn, tag: 'key' }), ...seq(K[0] + 2 * TWOS, 'P58', [27, 30], TWOS, { ...rel, tag: 'release' }),
    ...seqEnd(K[1] - TWOS, 'P58', [39, 42, 45], TWOS, { ...up, tag: 'lift' }),
    ...hold(K[1], 'P58', 48, { ...dn, tag: 'key' }), ...seq(K[1] + 2 * TWOS, 'P58', [51, 54], TWOS, { ...rel, tag: 'release' }),
    ...seqEnd(K[2] - TWOS, 'P58', [69, 72, 75, 78], TWOS, { ...up, tag: 'lift' }),
    ...hold(K[2], 'P58', 84, { ...dn, tag: 'key' }), ...seq(K[2] + 2 * TWOS, 'P58', [87, 90], TWOS, { ...rel, tag: 'release' }),
    // the commit is in; she holds the look (one drawing, no change during the wink)
    ...hold(K[2] + 4 * TWOS, 'P58', 30, { tag: 'hold' }),
  ];
  out.close = sheet(s80);
  return out;
}

// the eyelid (drawn, not from the plate): closure 0..1 at song time t, on ones (every master frame) because it is the
// eclipse. The lid starts 0.40 s before the ting, crosses the iris with the Moon's limb, the last sliver flares as a
// diamond ring on 276.92-276.95, and the eye is shut exactly on the ting; it stays shut to the cut to black.
export const WINK = { t0: () => EV.ting - .40, t1: () => EV.ting, side: 'L' };   // her left eye (frame right): the smirk's side
export function lidAt(t) {
  const a = WINK.t0(), b = WINK.t1();
  if (t < a) return 0;
  if (t >= b - 1e-6) return 1;
  return (t - a) / (b - a);                         // linear: a celestial body does not ease (eye.js shapes the lid's lag)
}

// stand-in sheets (no plates on this machine): the room boards as stills
export function standinSheets() {
  const T = EV, F = frameAt;
  return {
    wide: sheet(hold(F(T.shots.S78[0]), 'sa', 1, { tag: 'tick' })),
    close: sheet(hold(F(T.shots.S80[0]), 'sc', 1, { tag: 'hold' })),
  };
}

// Colour-zone notes per drawing (the colour designer's marks on the key drawings), in SETUP-normalised coordinates: where
// skin may be (hands; a face the landmarker cannot see in a back view), where the back circle may be. Faces seen by the
// landmarker add their own skin zones automatically (cel.js skinZones). The circle zone follows the measured print
// (decals.js adds it per drawing).
const E = (cx, cy, rx, ry) => ({ cx, cy, rx, ry });
// P57's typing hand per body drawing (seated f13, leaned f49, seated again f69), measured on the plate in setup px, with
// room for the typing poses; the sliver of her cheek beside her hair when seated; the chair back (its trim is chair, not
// her orange)
const HAND57 = { 13: E(.502, .652, .04, .046), 49: E(.515, .654, .036, .042), 69: E(.481, .646, .036, .044) };
const CHEEK57 = E(.39, .402, .011, .044);
const CHAIR57 = { poly: [[60, 372], [330, 378], [352, 540], [40, 540]].map(([x, y]) => [x / 960, y / 540]), mat: 'black', from: ['orange'] };
export function celZones(e) {
  if (!e) return {};
  if (e.src === 'sa') return { faces: false, skin: [E(.597, .69, .035, .045)], allowBlue: E(.29, .6, .055, .095), navy: null };
  if (e.src === 'sc') return { faces: true, skin: [], navy: null, allowBlue: null };
  if (e.src === 'P57') {
    const body = e.ref || e.pf, near = [13, 49, 69].reduce((b, k) => Math.abs(k - body) < Math.abs(b - body) ? k : b, 13);
    return { faces: false, skin: near === 49 ? [HAND57[49]] : [HAND57[near], CHEEK57], navy: null, allowBlue: null, clear: [CHAIR57], darkStrands: true };
  }
  if (e.src === 'P58') return { faces: true, skin: [], navy: null, allowBlue: null, brows: true };
  return {};
}
