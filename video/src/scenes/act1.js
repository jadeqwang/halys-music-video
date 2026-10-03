// act1.js: brush engine: S01-S34 (cold open to chorus 1). [bring-up test]
import { scene } from '../registry.js';
import { paint, resolvePlate } from '../worlds/brush/index.js';

scene('S07', async f => {
  const src = await resolvePlate(f, 'P03', { id: 'b_face', cam: k => ({ cx: .55, cy: .45, zoom: 1.0 + .04 * k, mirror: true }) });
  const look = await paint(f, src, { pool: [{ x: .44, y: .45, rx: .2, ry: .5, rot: .25, feather: .7 }], poolMatte: .55, poolBound: { x: .4, y: .45, rx: .3, ry: .6, feather: .5 },
    faceMin: .7, crushFloor: .1, brushes: [24, 13, 7.5, 4.2, 2.4] });
  console.log('S07', JSON.stringify(look.ms), look.strokes, JSON.stringify(look.perLayer));
});

scene('S05', async f => {
  const src = await resolvePlate(f, 'P01', { id: 'c_armies', cam: k => ({ cx: .5, cy: .5, zoom: 1.0 + .03 * k }) });
  const look = await paint(f, src, {
    pool: [{ x: .5, y: .7, rx: .66, ry: .42, rot: .08, feather: .8, k: .62 }, { x: .56, y: .68, rx: .1, ry: .42, rot: -.3, feather: .7, k: .95 }],
    poolMatte: 0, envDim: .9, sky: { maxDepth: .012, soft: .02, below: .34, horizonY: .27 }, sun: { x: .5, y: .2, r: .03, alt: 9 },
    crushFloor: .17, crush: .3, satOut: .6, glintReach: 30, accents: .45 });
  console.log('S05', JSON.stringify(look.ms), look.strokes, JSON.stringify(look.perLayer));
});
