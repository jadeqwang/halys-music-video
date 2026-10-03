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

export const EV = {
  ticks: [266.118, 266.551, 267.186, 267.4, 267.628, 267.747, 267.844, 268.081, 268.191, 268.299, 268.524, 269.022, 269.288, 269.622],
  dtShift: 268.081,            // the `dt.shift(+300)` line: the totality band slides north onto the Halys
  burst: [269.288, 269.872],   // `git commit -am "fix(halys): ` typed in a burst
  chord: 270.04, freeze: 271.6,
  keys: [273.45, 274.05, 274.95],
  enter: 274.95, output: 275.07,
  glitter: 276.85, ting: 276.95,
  black: 277.55,               // the wink holds 0.6 s, then black; the end card type starts 277.55 (type track)
  audioEnd: 279.6, end: 281.0,
  shots: { S78: [266.12, 270.04], S79: [270.04, 273.40], S80: [273.40, 276.95], S81: [276.95, 281.0] },
};
// events can be refined from timing.json at runtime (scenes/room.js calls this once at boot)
export function setEvents(TM) {
  const sd = TM && TM.raw && TM.raw.sound_design;
  if (sd && sd.wink_ting) EV.ting = +sd.wink_ting;
  const fc = TM && TM.events && TM.events.final_chord;
  if (fc && fc.t) EV.chord = +fc.t;
  const sn = TM && TM.events && TM.events.snares;
  if (sn && sn.length) { const tk = sn.filter(t => t >= 266.0 && t < 269.8); if (tk.length >= 8) EV.ticks = tk; }
  return EV;
}

// P40 (take 2) -> P39 (take 1) plate-space similarity (960x540 frames)
export const REG = { 'P40:take2.mp4->P39': { s: 1 / 0.95163, tx: -21.31 / 0.95163, ty: -0.242 / 0.95163 } };

// ---------------------------------------------------------------- per-take sheets
// Regions are plate-normalised ellipses (u, v in 0..1 of the plate frame).
const ARM39 = { cx: .505, cy: .655, rx: .095, ry: .1, feather: .45 };     // P39: the typing forearm and hand
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
  T.ticks.forEach((t, k) => { if (t < T.burst[0] - 1e-3) s78.push(...hold(F(Math.max(t, T.shots.S78[0])), 'P39', poses[k % poses.length], { ref: 40, region: ARM39, tag: 'tick' })); });
  const Fb = F(T.burst[0]);
  const Fland = F(T.chord);                     // the landing drawing: her face, on the chord
  const Fspin = Fland - 4 * TWOS;               // four drawings of turn before it
  s78.push(...run(Fb, Fspin, 'P39', 60, 70, TWOS, { ref: 40, region: ARM39, tag: 'burst' }));
  // the spin: P40 (registered into P39 space). f40 head turning, f49 profile, f57 three-quarter, f67 front with the
  // hair flying out, f79 square to camera = the stinger
  s78.push(...seq(Fspin, 'P40', [40, 49, 57, 67], TWOS, { tag: 'spin' }));
  s78.push(...hold(Fland, 'P40', 79, { tag: 'land' }));
  // S79: settle on twos (the hair falls back), then one held drawing: deadpan, through the frozen chord
  const s79 = [...hold(Fland, 'P40', 79, { tag: 'land' }), ...seq(Fland + TWOS, 'P40', [84, 90, 96, 100], TWOS, { tag: 'settle' }),
    ...hold(Fland + 5 * TWOS, 'P40', 104, { tag: 'deadpan' })];
  out.wide = sheet(s78, s79);

  // S80: P41 close-up. Deadpan held on one cel (ref f22); only her right shoulder/sleeve (frame left) is redrawn as she
  // types blind behind her back. Each key click lands on a dip (the hand pressing down): plate f34 / f48 / f62, the
  // lifts f27 / f41 / f55 and the releases f37 / f51 / f65 in between, on twos.
  const K = T.keys.map(F);
  const r41 = { ref: 22, region: ARM41 };
  const s80 = [
    ...hold(F(T.shots.S80[0]), 'P41', 31, { ...r41, tag: 'lift' }),
    ...hold(K[0], 'P41', 34, { ...r41, tag: 'key' }), ...seq(K[0] + 2 * TWOS, 'P41', [37, 39], TWOS, { ...r41, tag: 'release' }),
    ...seqEnd(K[1] - TWOS, 'P41', [41, 43, 45], TWOS, { ...r41, tag: 'lift' }),
    ...hold(K[1], 'P41', 48, { ...r41, tag: 'key' }), ...seq(K[1] + 2 * TWOS, 'P41', [51, 53], TWOS, { ...r41, tag: 'release' }),
    ...seqEnd(K[2] - TWOS, 'P41', [55, 57, 59], TWOS, { ...r41, tag: 'lift' }),
    ...hold(K[2], 'P41', 62, { ...r41, tag: 'key' }), ...seq(K[2] + 2 * TWOS, 'P41', [65, 67], TWOS, { ...r41, tag: 'release' }),
    // deadpan hold after the commit, then the sly smile creeps in (plate f73-f85) 0.7 s before the wink and holds
    ...hold(K[2] + 4 * TWOS, 'P41', 70, { tag: 'deadpan' }),
  ];
  const Fsmile = F(T.ting - .70);
  s80.push(...seq(Fsmile, 'P41', [73, 75, 77, 79, 81, 84], TWOS, { tag: 'smile' }));
  s80.push(...hold(Fsmile + 6 * TWOS, 'P41', 95, { tag: 'smile-hold' }));
  out.close = sheet(s80);
  return out;
}

// the eyelid (drawn, not from the plate): closure 0..1 at song time t, on ones (every master frame) because it is the
// eclipse. The lid starts 0.24 s before the ting, crosses the iris with the Moon's limb, the last sliver flares as a
// diamond ring on 276.92-276.95, and the eye is shut exactly on the ting; it stays shut to the cut to black.
export const WINK = { t0: () => EV.ting - .24, t1: () => EV.ting, ring: () => [EV.ting - .05, EV.ting + .10] };
export function lidAt(t) {
  const a = WINK.t0(), b = WINK.t1();
  if (t < a) return 0;
  if (t >= b - 1e-6) return 1;
  const k = (t - a) / (b - a);
  return k * k * (3 - 2 * k) * .35 + k * .65;      // a near-linear sweep (a celestial body does not ease), softened at the start
}

// stand-in sheets (no plates on this machine): the room boards as stills
export function standinSheets() {
  const T = EV, F = frameAt, Fland = F(T.chord);
  return {
    wide: sheet(hold(F(T.shots.S78[0]), 'sa', 1, { tag: 'tick' }), hold(Fland, 'sb', 1, { tag: 'land' })),
    close: sheet(hold(F(T.shots.S80[0]), 'sc', 1, { tag: 'deadpan' })),
  };
}
