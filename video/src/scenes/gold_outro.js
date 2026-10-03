// gold_outro.js: GOLD, S75-S76 (259.36-262.72 s): the battle line lets go. Owner: the GOLD agent (v2: REVISION_V2
// decision 5: "bronze was precious: nobody throws it away"; and "the warriors are still serious dudes": no formation
// pose, no shrug). The dive (S74, the line engine) lands at 259.36 on P54 (take 5): a battle line of both armies seen
// along its length, Lydians on the left facing right, Medes on the right facing left (mirrored, equal dignity), the red
// river behind them in the low golden light.
//
//   259.36 the hit       caught mid-fight: shields slam, swords up all along the line
//   259.775 THROW DOWN   (the chop) still fighting; at 260.45 they stop dead and their hands open
//   260.62 BLADE         every blade falls at once: S76 opens on the falling swords, which strike the sand with the sound
//                        design's clang (260.685)
//   261.05 hit           a late one: the nearest Lydian, the only man still holding his sword, lets go; it lands on the hit
//   -> 262.72            they stand empty-handed, facing each other; S77's pull-back starts from S76's last drawing
// P54's own timing is loose (its late drop comes 1.6 s after the others against 0.43 s in the music), so it is retimed
// with keys: the fight a little faster than the plate, the main drop at plate speed on BLADE, the long held sword
// compressed into the 0.4 s before the hit, then the stillness slowed to fill the bar.

import { scene } from '../registry.js';
import { resolvePlate, hasPlate, plateTimeOf } from '../worlds/brush/index.js';
import { plateMetaAt } from '../plates.js';
import { paintGold } from '../worlds/marble/gold.js';

const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));

// keys (song s -> plate s, take 5): mid-fight from the hit; the hands open at 260.45 (plate 1.58), so the cut on BLADE
// catches the swords in the air and they strike the sand with the clang (1.90 = 260.72); the Lydian's held sword,
// lowering (1.90-3.54), is compressed into one drawing; his hand opens (3.54 = 260.83) and his sword falls, a little
// slowed, to hit the sand at his feet (3.71, the frame's bottom edge) on the 261.05 hit (the drawing at 261.037)
export const P54_KEYS = [[259.36, .20], [260.45, 1.58], [260.72, 1.90], [260.83, 3.54], [261.04, 3.715], [262.72, 5.0]];
// the framing: landscape holds the mirrored line (a slow push); portrait (a 0.45-wide window on the plate) starts on the
// corridor between the two lines and drifts left onto the nearest Lydian for the late drop
function cam(f, t) {
  const k = seg(t, 259.36, 262.72);
  if (f.W / f.H > 1.2) return { cx: .5, cy: .5, zoom: 1.02 + .02 * k };
  const p = seg(t, 260.45, 260.8), e = p * p * (3 - 2 * p);
  return { cx: lerp(.5, .29, e), cy: .5, zoom: 1.02 + .02 * k };
}
// S74's dive lands on S75's first drawing; S77's pull-back starts from S76's last one (drop2.js S77 traces s76End() in
// lines). trace: the line engine's horizon for this plate (the far bank, source uv)
const TRACE = { sky: { horizonY: .21, below: .25, useDepth: false } };       // (P54 take 5: the far bank's crest; the river below it)
export const s75Start = (W, H) => ({ plate: 'P54', tp: P54_KEYS[0][1], cam: cam({ W, H }, 259.36), trace: TRACE });
export const s76End = (W, H) => ({ plate: 'P54', tp: P54_KEYS[P54_KEYS.length - 1][1], cam: cam({ W, H }, 262.72), trace: TRACE });

async function battle(f) {
  const t = f.t, c = cam(f, t);
  const src = await resolvePlate(f, 'P54', { id: 'c_armies', cam: c }, c, { keys: P54_KEYS });
  // the light: the low sun beyond the right edge, behind the Medes (the plate's brightest blob, through the camera)
  let sun = [1.05, .25];
  if (hasPlate('P54')) {
    const meta = await plateMetaAt('P54', plateTimeOf(f.shot, t, { keys: P54_KEYS }));
    if (meta && meta.sun && meta.sun[2] > .2) { const oo = f.W / f.H, so = 16 / 9; let hU = 1 / c.zoom, wU = oo / so / c.zoom; if (wU > 1 / c.zoom) { wU = 1 / c.zoom; hU = so / oo / c.zoom; } sun = [(meta.sun[0] - c.cx) / wU + .5, (meta.sun[1] - c.cy) / hU + .5]; }
  }
  // (the plate's own golden sky is kept; the sun itself is out of the frame, so no disk. No painted catchlights: MediaPipe
  // reads the round shields, boss for a nose, as faces, and the eye strokes would draw eyelids on them)
  await paintGold(f, src, { cam: c, sky: false, groundFlow: { y0: .66, k: .6 }, detail: .9, tag: 'P54', paint: { eyeStrokes: 0 } });
  const T = f.type || (f.type = {}), sx = clamp(sun[0], .05, .95) * f.W, sy = clamp(sun[1], -.2, .4) * f.H;
  T.light = { dir: [.55, -.83], elev: .55, color: '#fff0c8', intensity: 1.12 };
  T.field = { center: [sx, sy], r: 0 };                    // the chop's streamers radiate from the light
  // the chops ride high, over the far line and the river, so the sand where the blades fall stays clear
  T.place = { ...(T.place || {}), 'S75.chop': { x: .5, y: .25 }, 'S76.chop': { x: .5, y: .25 } };
}
scene('S75', battle);
scene('S76', battle);
