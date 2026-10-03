// marble.js: MARBLE, S45 (second half) - S57 (153.83-199.98 s): the breakdown, verse 2, the shadow, Thales, the spark.
// Owner: the marble/gold agent. Built on the brush engine (video/src/worlds/brush/, unchanged) through the marble world
// helpers in video/src/worlds/marble/.

import { scene, shot, shotOverride } from '../registry.js';
import { resolvePlate, hasPlate } from '../worlds/brush/index.js';
import { stoneSource } from '../worlds/marble/stone.js';
import { paintStone } from '../worlds/marble/paint.js';

const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => k * k * (3 - 2 * k);
const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a)));

// ---------------------------------------------------------------- S46: drift through the frozen battle
scene('S46', async f => {
  const keys = [[160.70, .3], [164.13, 2.7]];
  const cam = k => ({ cx: .5 + .02 * k, cy: .5, zoom: 1.06 });
  const src = await resolvePlate(f, 'P25', { id: 'a_duel', cam }, cam, { keys });
  const st = stoneSource(f, src, { sky: { dLo: .02, dHi: .07, below: .7, run: 3 }, water: { k: .7 } });
  await paintStone(f, st, { stars: { toScreen: (u, v) => [u * f.W, v * f.H * .6], n: 160 } });
});
