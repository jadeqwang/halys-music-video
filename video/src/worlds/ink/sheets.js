// sheets.js: the x-sheets of S78-S81 (the room), per plate take, plus the stand-in sheets. Pure data (no DOM): imported by
// scenes/room.js and by the timing check (production/review/room/check_timing.mjs).
//
// Music events (production/SOUND_DESIGN.md, video/data/timing.json):
//   ticks of the ticking build 266.12-269.62 (the terminal scrolls one line per tick; the type track uses the same times)
//   the final stark chord 270.04 (the spin lands: her face is the stinger)   the frozen chord from 271.6
//   three key clicks 273.45 / 274.05 / 274.95                                 the wink's ting 276.95 (glitter from 276.85)
//   audio ends 279.60; the film runs to 281.0 (silent end card)
//
// Plate coordinates. S78 and S79 share one setup in P39's frame: P40 (same camera, 5 % wider, no rotation) maps into it by
// a measured similarity (SIFT on the room, 165 inliers, 0.34 px median residual): x39 = (x40 - 21.31) / 0.95163, so the
// spin plays in the same room as the typing and the S78 -> S79 cut is invisible. S80/S81 are P41's close-up.

import { frameAt, hold, seq, seqEnd, run, sheet, TWOS } from './xsheet.js';

// Event times are the onsets MEASURED in the final mix (media/stems/halys_sd_master.wav, peak spectral flux in each
// event's band; production/review/room/check_timing.mjs re-measures them): the cue sheet's 270.04 / 273.45 / 274.05 /
// 274.95 / 276.95 are the sound designer's nominal times, up to 27 ms off the actual attacks. Picture events land on the
// first master frame at or after the measured onset.
export const EV = {
  ticks: [266.118, 266.551, 267.186, 267.4, 267.628, 267.747, 267.844, 268.081, 268.191, 268.299, 268.524, 269.022, 269.288, 269.622],
  dtShift: 268.081,            // the `dt.shift(+300)` line: the totality band slides north onto the Halys
  burst: [269.288, 269.872],   // `git commit -am "fix(halys): ` typed in a burst (type track)
  chord: 270.013,              // the final stark chord's attack (cue 270.04): the spin lands, her face is the stinger
  freeze: 271.6,
  keys: [273.455, 274.025, 274.927],   // key clicks (cues 273.45 / 274.05 / 274.95)
  enter: 274.95, output: 275.07,
  glitter: 276.85, ting: 276.947,      // the tine (cue 276.95): the eyelid shuts on frame 16617
  black: 277.55,               // the wink holds 0.6 s, then black; the end card type starts 277.55 (type track)
  audioEnd: 279.6, end: 281.0,
  shots: { S78: [266.12, 270.04], S79: [270.04, 273.40], S80: [273.40, 276.95], S81: [276.95, 281.0] },
};
// the ticks follow timing.json's snares (the type track scrolls the terminal on the same list)
export function setEvents(TM) {
  const sn = TM && TM.events && TM.events.snares;
  if (sn && sn.length) { const tk = sn.filter(t => t >= 266.0 && t < 269.8); if (tk.length >= 8) EV.ticks = tk; }
  return EV;
}

// the two smear drawings of the spin (setup px; the streaks trail to the right: her face and the jacket front sweep left
// as she turns to camera). Region: head, hair and shoulders in the P39 setup frame.
const SMEAR_A = { dx: 30, dy: 1, region: { cx: .292, cy: .45, rx: .13, ry: .22 }, drag: .5, lambda: 30, seed: 1, speed: 5 };
const SMEAR_B = { dx: 20, dy: 1, region: { cx: .31, cy: .45, rx: .13, ry: .22 }, drag: .45, lambda: 30, seed: 2, speed: 3 };
// the headphones around her neck after the landing (P40 frames registered into the P39 setup), plate-normalised
const PHONES40 = { cx: .353, cy: .52, rx: .05, ry: .05, feather: .45 };

// P40 (take 2) -> P39 (take 1) plate-space similarity (960x540 frames)
export const REG = { 'P40:take2.mp4->P39': { s: 1 / 0.95163, tx: -21.31 / 0.95163, ty: -0.242 / 0.95163 } };

// ---------------------------------------------------------------- per-take sheets
// Regions are plate-normalised ellipses (u, v in 0..1 of the plate frame).
const ARM39 = { cx: .515, cy: .66, rx: .046, ry: .078, feather: .45 };    // P39: the typing hand (the sleeve patch stays held)
const ARM41 = { cx: .17, cy: .86, rx: .26, ry: .22, feather: .4 };        // P41: her right shoulder/sleeve (frame left)

export function roomSheets(takes = {}) {
  const T = EV, F = frameAt;
  const out = {};
  const t39 = takes.P39 || 'take1.mp4', t40 = takes.P40 || 'take2.mp4', t41 = takes.P41 || 'take4.mp4';
  const known = t39 === 'take1.mp4' && t40 === 'take2.mp4' && t41 === 'take4.mp4';
  if (!known) return null;

  // S78: typing locked to the ticks. Each tick snaps to a new typing drawing, held to the next tick (real holds);
  // the head and back stay on one held cel (ref f40), only the forearm and hand are redrawn. The commit burst runs
  // on twos at speed. Then the spin (P40) starts 0.33 s before the chord and lands on it.
  const poses = [12, 22, 30, 46, 52, 60, 75, 88];
  const s78 = [];
  const tk = T.ticks.filter(t => t < T.burst[0] - 1e-3).map(t => F(Math.max(t, T.shots.S78[0])));
  tk.forEach((Fk, k) => {
    const pose = poses[k % poses.length], prev = k ? poses[(k - 1) % poses.length] : null;
    // an in-between on the way to each new key (when the gap allows and the hand is not wrapping to the start of the
    // cycle): the hand travels instead of popping
    if (prev != null && pose > prev && Fk - tk[k - 1] >= 10) s78.push(...hold(Fk - 4, 'P39', Math.round((prev + pose) / 2), { ref: 40, region: ARM39, tag: 'ib' }));
    s78.push(...hold(Fk, 'P39', pose, { ref: 40, region: ARM39, tag: 'tick' }));
  });
  const Fb = F(T.burst[0]);
  const Fland = F(T.chord);                     // the landing drawing: her face, on the chord
  const Fspin = Fland - 4 * TWOS;               // the turn takes the last 20 frames before it
  s78.push(...run(Fb, Fspin, 'P39', 60, 70, TWOS, { ref: 40, region: ARM39, tag: 'burst' }));
  // the spin: P40 (registered into P39 space). f40 head turning, f49 three-quarter profile, then two smear drawings on
  // threes (the fastest part of the turn: shapes dragged into streaks, features gone, speed lines; smear.js), f67 front
  // with the hair flying out, f79 square to camera = the stinger
  s78.push(...seq(Fspin, 'P40', [40, 49], TWOS, { tag: 'spin' }));
  s78.push({ F: Fspin + 2 * TWOS, src: 'P40', pf: 55, smear: SMEAR_A, tag: 'smear' });
  s78.push({ F: Fspin + 2 * TWOS + 3, src: 'P40', pf: 61, smear: SMEAR_B, tag: 'smear' });
  s78.push(...hold(Fspin + 3 * TWOS + 1, 'P40', 67, { tag: 'spin' }));
  s78.push(...hold(Fland, 'P40', 79, { tag: 'land' }));
  // S79: settle on twos (the hair falls back) while the headphones bob once (they keep going down when she stops, come
  // back up past rest, settle: the region redrawn a few px lower / higher), then one held drawing: deadpan, through the
  // frozen chord
  const s79 = [...hold(Fland, 'P40', 79, { tag: 'land' }),
    ...[[84, 5], [90, 7], [96, 2], [100, -2]].map(([pf, dy], k) => ({ F: Fland + (k + 1) * TWOS, src: 'P40', pf, ref: pf, region: PHONES40, dy, tag: 'settle' })),
    ...hold(Fland + 5 * TWOS, 'P40', 104, { tag: 'deadpan' })];
  out.wide = sheet(s78, s79);

  // S80: P41 close-up. Deadpan held on one cel (ref f22); only her right shoulder/sleeve (frame left) is redrawn as she
  // types blind behind her back. Each key click lands on a dip (the hand pressing down): plate f34 / f48 / f62, the
  // lifts f27 / f41 / f55 and the releases f37 / f51 / f65 in between, on twos.
  const K = T.keys.map(F);
  // the plate's dip is only ~4 px; the key drawings push the sleeve down a little more (anime exaggeration: dy in plate px)
  const r41 = { ref: 22, region: ARM41 }, up = { ...r41, dy: -3 }, dn = { ...r41, dy: 7 }, rel = { ...r41, dy: 2 };
  const s80 = [
    ...hold(F(T.shots.S80[0]), 'P41', 31, { ...up, tag: 'lift' }),
    ...hold(K[0], 'P41', 34, { ...dn, tag: 'key' }), ...seq(K[0] + 2 * TWOS, 'P41', [37, 39], TWOS, { ...rel, tag: 'release' }),
    ...seqEnd(K[1] - TWOS, 'P41', [41, 43, 45], TWOS, { ...up, tag: 'lift' }),
    ...hold(K[1], 'P41', 48, { ...dn, tag: 'key' }), ...seq(K[1] + 2 * TWOS, 'P41', [51, 53], TWOS, { ...rel, tag: 'release' }),
    ...seqEnd(K[2] - TWOS, 'P41', [55, 57, 59], TWOS, { ...up, tag: 'lift' }),
    ...hold(K[2], 'P41', 62, { ...dn, tag: 'key' }), ...seq(K[2] + 2 * TWOS, 'P41', [65, 67], TWOS, { ...rel, tag: 'release' }),
    // deadpan hold after the commit, then the mischievous turn from 276.20 (plate f73-f84 on twos, the drawn smirk and
    // narrowed eyes on top: expr.js), held on f95 from before the eyelid starts (no drawing change during the wink)
    ...hold(K[2] + 4 * TWOS, 'P41', 70, { tag: 'deadpan' }),
  ];
  const Fsmile = F(EXPR.smirk);
  s80.push(...seq(Fsmile, 'P41', [73, 77, 81, 84], TWOS, { tag: 'smile' }));
  s80.push(...hold(Fsmile + 4 * TWOS, 'P41', 95, { tag: 'smile-hold' }));
  out.close = sheet(s80);
  return out;
}

// the eyelid (drawn, not from the plate): closure 0..1 at song time t, on ones (every master frame) because it is the
// eclipse. The lid starts 0.40 s before the ting, crosses the iris with the Moon's limb, the last sliver flares as a
// diamond ring on 276.92-276.95, and the eye is shut exactly on the ting; it stays shut to the cut to black.
export const WINK = { t0: () => EV.ting - .40, t1: () => EV.ting };
// the close-up's acting (expr.js): the smirk and the narrowed eyes start here, ramping over three drawings on twos
export const EXPR = { smirk: 276.20 };
export function lidAt(t) {
  const a = WINK.t0(), b = WINK.t1();
  if (t < a) return 0;
  if (t >= b - 1e-6) return 1;
  return (t - a) / (b - a);                         // linear: a celestial body does not ease (eye.js shapes the lid's lag)
}

// stand-in sheets (no plates on this machine): the room boards as stills
export function standinSheets() {
  const T = EV, F = frameAt, Fland = F(T.chord);
  return {
    wide: sheet(hold(F(T.shots.S78[0]), 'sa', 1, { tag: 'tick' }), hold(Fland, 'sb', 1, { tag: 'land' })),
    close: sheet(hold(F(T.shots.S80[0]), 'sc', 1, { tag: 'deadpan' })),
  };
}

// Colour-zone notes per drawing (the colour designer's marks on the key drawings), in SETUP-normalised coordinates: where
// skin may be (hands; a face the landmarker cannot see in a back or profile view), where the trousers are, where the
// back circle is. Faces seen by the landmarker add their own skin zones automatically (cel.js skinZones).
const E = (cx, cy, rx, ry) => ({ cx, cy, rx, ry });
const SKIN40 = {
  40: [E(.365, .38, .028, .06), E(.53, .76, .038, .055)],
  49: [E(.307, .393, .04, .085), E(.398, .788, .038, .06), E(.366, .97, .038, .075)],
  55: [E(.282, .39, .048, .088), E(.45, .81, .035, .05), E(.36, .985, .036, .07)],
  57: [E(.272, .389, .05, .09), E(.47, .826, .03, .045), E(.357, .99, .035, .065)],
  61: [E(.279, .388, .046, .085), E(.49, .85, .035, .055), E(.36, .98, .035, .065)],
  67: [E(.508, .866, .04, .06), E(.36, .98, .035, .065)],
};
// the desk lamp behind her left shoulder once she faces camera: the matte catches pieces of its orange shade, which
// are background (the lamp is painted in the room), never her
const LAMP40 = { cx: .262, cy: .36, rx: .046, ry: .165 };
const POST40 = [E(.179, .915, .045, .075), E(.48, .933, .045, .075), E(.508, .866, .04, .06)];
export function celZones(e) {
  if (!e) return {};
  if (e.src === 'sa') return { faces: false, skin: [E(.597, .69, .035, .045)], allowBlue: E(.29, .6, .055, .095), navy: null };
  if (e.src === 'sb' || e.src === 'sc') return { faces: true, skin: [], navy: null, allowBlue: null };
  if (e.src === 'P39') return { faces: false, skin: [E(.505, .657, .036, .046)], allowBlue: E(.302, .646, .05, .085), navy: null };
  if (e.src === 'P40') return { faces: true, flatFace: e.pf >= 59 || !!e.smear, skin: SKIN40[e.pf] || POST40, navy: E(.39, .95, .17, .13), allowBlue: null,
    noOrange: e.pf >= 60 ? [LAMP40] : null };
  if (e.src === 'P41') return { faces: true, skin: [], navy: null, allowBlue: null, brows: true };
  return {};
}
