// sheets.js: the x-sheets of S78, S80 and S81 (the room), per plate take, plus the stand-in sheets. Pure data (no DOM):
// imported by scenes/room.js and production/review/room/check_timing.mjs.
//
// Music events (production/SOUND_DESIGN.md, video/data/timing.json):
//   ticks of the ticking build 266.12-269.62 (the terminal scrolls one line per tick; the type track uses the same times)
//   the final stark chord 270.04 = the cut to S79 (TREATY: the kings swear peace)   the frozen chord from 271.6
//   three key clicks 273.45 / 274.05 / 274.95                                         the wink's ting 276.95
//   audio ends 279.60; the film runs to 281.0 (silent end card)
//
// Plates (v3, the director: she stays in her ORIGINAL anime, composited directly; worlds/ink/direct.js). The drawings are
// the plate's own frames, timed like anime: on twos, real holds, every event on an exact master frame. Only the odd frames
// are prepared (prep/direct.py, prep/mattes.py): the footage itself moves on twos, so an odd frame shows every drawing.
//   S78 = P57 (take 2), from the anime keyframe K78d: the room seen from behind her chair, P39's camera. Only she comes from
//         P57: the room is still P39's painted background, so P57 maps into P39's frame by a measured similarity (SIFT on
//         the room, 789 inliers pooled over 7 frames, 0.77 px median residual; Seedance's camera is static).
//   S80/S81 = P59 (take 2), from the keyframe K59b (the character sheet's own face): the close-up, a soft closed-lip
//         half-smile from the first frame, three blind key taps, and her own wink (the eye shut on frames 87-113).

import { frameAt, hold, seq, seqEnd, sheet, TWOS } from './xsheet.js';

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
  ting: 276.947,               // the tine (cue 276.95): her wink is shut on frame 16617
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

// plate -> setup similarities (960x540 frames): x_setup = s * x_src + tx. P40 only feeds the painted background.
export const REG = {
  'P40:take2.mp4->P39': { s: 1 / 0.95163, tx: -21.31 / 0.95163, ty: -0.242 / 0.95163 },
  'P57:take2.mp4->P39': { s: 1.02186, tx: -6.99, ty: 2.53 },     // prep/register.py P57 --to=P39 --frames=1,16,32,48,64,80,97
};

export const TAKES = { P57: 'take2.mp4', P59: 'take2.mp4' };

// P59 take 2, measured on the plate (iris pixels in her left eye, frame right; median vertical flow on her right shoulder,
// frame left): the eye closes over frames 85-87 and stays shut to frame 113; the shoulder (her hand on the keyboard behind
// her) is up from frame 19, and comes down on three taps, landing on frames 37, 61 and 73.
export const P59 = { closed: [87, 113], closing: 85, presses: [37, 61, 73] };

export function directSheets(takes = {}) {
  const T = EV, F = frameAt, out = {};
  if (takes.P57 !== TAKES.P57 || takes.P59 !== TAKES.P59) return null;

  // S78. She types on the ticks (each tick a new typing drawing, two drawings on twos, then held to the next tick), drifts
  // toward the vertical monitor, and leans in on the tick before dt.shift: four drawings, the lean lands ON the dt.shift
  // tick as the totality band slides onto the Halys. Leaned, she types on the next ticks, settles back from the 268.52
  // tick, and types the commit in a burst on twos; the last drawing holds to the cut (270.04).
  // P57 (measured: head x and the circle on her back): still and settled f1-f19 and f65-f97 (same pose: her typing hand
  // moves in f65-f97), drift f21-f33, lean f35-f45, leaned f45-f51, settling back f53-f63.
  const tk = T.ticks.map(t => F(Math.max(t, T.shots.S78[0])));
  const at = t => tk[T.ticks.reduce((b, x, k) => Math.abs(x - t) < Math.abs(T.ticks[b] - t) ? k : b, 0)];   // the tick nearest t
  const s78 = [
    ...seq(tk[0], 'P57', [65, 67], TWOS, { tag: 'tick' }), ...seq(tk[1], 'P57', [69, 71], TWOS, { tag: 'tick' }),
    ...seq(tk[2], 'P57', [73, 75], TWOS, { tag: 'tick' }),
    ...seq(tk[3], 'P57', [19, 21, 23], 4, { tag: 'drift' }), ...seq(tk[4], 'P57', [25, 27], 3, { tag: 'drift' }),
    ...seq(tk[5], 'P57', [29, 31], 3, { tag: 'drift' }),
    ...seq(tk[6], 'P57', [33, 39, 43], Math.round((F(T.dtShift) - tk[6]) / 3), { tag: 'lean' }),
    ...hold(F(T.dtShift), 'P57', 45, { tag: 'lean-land' }),
    ...seq(at(268.191), 'P57', [47], TWOS, { tag: 'tick' }), ...seq(at(268.299), 'P57', [49, 51], TWOS, { tag: 'tick' }),
    ...seq(at(268.524), 'P57', [53, 55, 57, 59, 61, 63], TWOS, { tag: 'back' }),
    ...seq(at(269.022), 'P57', [65, 67, 69], TWOS, { tag: 'settled' }),
    ...seq(F(T.burst[0]), 'P57', [77, 79, 83, 87, 89, 93, 97], TWOS, { tag: 'burst' }),
  ];
  out.wide = sheet(s78);

  // S80. From the cut her hand is already up on the keyboard behind her and she smiles at us; each key click lands on the
  // drawing where her shoulder comes down (the press), the lift before it on twos. After the enter she lifts her hand off
  // and holds the look; her eye closes on two drawings and is shut ON the ting (S81's first frame).
  const K = T.keys.map(F), Ft = F(T.ting);
  const s80 = [
    ...hold(F(T.shots.S80[0]), 'P59', 29, { tag: 'up' }), ...hold(F(T.shots.S80[0]) + 2, 'P59', 33, { tag: 'press' }),
    ...hold(K[0], 'P59', 37, { tag: 'key' }),
    ...seqEnd(K[1], 'P59', [47, 51, 53, 57, 59, 61], TWOS, { tag: 'lift' }), ...hold(K[1], 'P59', 61, { tag: 'key' }),
    ...seqEnd(K[2], 'P59', [63, 65, 67, 69, 71, 73], TWOS, { tag: 'lift' }), ...hold(K[2], 'P59', 73, { tag: 'key' }),
    ...seq(K[2] + 3 * TWOS, 'P59', [75, 77, 79, 81, 83], TWOS, { tag: 'off' }),
    ...hold(Ft - TWOS, 'P59', P59.closing, { tag: 'closing' }),
    // S81: shut on the ting, the little nod of the wink on twos, to black (277.55)
    ...seq(Ft, 'P59', [87, 89, 91, 93, 95, 97, 99, 101], TWOS, { tag: 'wink' }),
  ];
  out.close = sheet(s80);
  return out;
}

// stand-in sheets (no plates on this machine): the room boards as stills
export function standinSheets() {
  const T = EV, F = frameAt;
  return {
    wide: sheet(hold(F(T.shots.S78[0]), 'sa', 1, { tag: 'tick' })),
    close: sheet(hold(F(T.shots.S80[0]), 'sc', 1, { tag: 'hold' })),
  };
}

// Colour-zone notes for the stand-in stills (the cel path draws them when no plates exist), setup-normalised
const E = (cx, cy, rx, ry) => ({ cx, cy, rx, ry });
export function celZones(e) {
  if (!e) return {};
  if (e.src === 'sa') return { faces: false, skin: [E(.597, .69, .035, .045)], allowBlue: E(.29, .6, .055, .095), navy: null };
  if (e.src === 'sc') return { faces: true, skin: [], navy: null, allowBlue: null };
  return {};
}
