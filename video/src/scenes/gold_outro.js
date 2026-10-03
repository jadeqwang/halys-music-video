// gold_outro.js: GOLD, S75-S76 (259.36-262.72 s): blades up, blades down, one straggler. Owner: the marble/gold agent.
// The dive (S74, the line engine) lands at 259.36 on P38's opening composition: the front rows of both armies on the
// sand, Lydians left, Medes right, mirrored (equal dignity), golden-hour light behind them.
//
//   259.35 hit   every blade rises together into the formation pose (the raise lands on the hit, high by 259.56)
//   260.62 BLADE every blade slams down at once (S76 opens on the impact drawing; the plate's slam is at 2.35 s)
//   261.05 hit   the straggler in the centre, still holding his blade up, drops it late (plate 3.60), then shrugs
// The plate's own timing is loose (its late gap is 1.25 s against 0.43 s in the music), so P38 is retimed with keys:
// a fast raise, a slow hold, the slam on the cut, the gap compressed, the shrug at plate speed.

import { scene, shotOverride } from '../registry.js';
import { paint, resolvePlate, hasPlate, plateTimeOf } from '../worlds/brush/index.js';
import { plateMetaAt } from '../plates.js';
import { paintGold } from '../worlds/marble/gold.js';

const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));

// (the hold sits on the plate's readable drawings, 1.95-2.0 s, where the blades stand clear against the sky; the
// wind-up that follows foreshortens them, so it is played fast just before the slam)
export const P38_KEYS = [[259.36, 1.55], [259.56, 1.95], [260.30, 2.0], [260.52, 2.2], [260.62, 2.35], [261.05, 3.6], [262.72, 5.0]];
async function blades(f) {
  const t = f.t, k = seg(t, 259.36, 262.72), cam = { cx: .5, cy: .5, zoom: 1.03 + .015 * k };
  const src = await resolvePlate(f, 'P38', { id: 'c_armies', cam }, cam, { keys: P38_KEYS });
  // the plate's sun (behind the army) through the camera
  let sun = [.5, .2];
  if (hasPlate('P38')) {
    const meta = await plateMetaAt('P38', plateTimeOf(f.shot, t, { keys: P38_KEYS }));
    if (meta && meta.sun && meta.sun[2] > .2) { const oo = f.W / f.H, so = 16 / 9; let hU = 1 / cam.zoom, wU = oo / so / cam.zoom; if (wU > 1 / cam.zoom) { wU = 1 / cam.zoom; hU = so / oo / cam.zoom; } sun = [(meta.sun[0] - cam.cx) / wU + .5, (meta.sun[1] - cam.cy) / hU + .5]; }
  }
  // (the plate's own golden sky is kept: a designed sky would eat the thin raised blades; the sun itself is out of the
  // plate's frame, so no disk: the light comes from behind them, up to the right)
  await paintGold(f, src, { cam, sky: false, groundFlow: { y0: .62, k: .6 }, detail: .9, tag: 'P38' });
  const T = f.type || (f.type = {}), sx = clamp(sun[0], .05, .95) * f.W, sy = clamp(sun[1], -.2, .4) * f.H;
  T.light = { dir: [.55, -.83], elev: .55, color: '#fff0c8', intensity: 1.12 };
  T.field = { center: [sx, sy], r: 0 };                    // the chop's streamers radiate from the light
}
scene('S75', blades);
scene('S76', blades);
