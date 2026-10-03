// drop1.js: line engine: S35-S44 (Drop 1) + the opening half of S45. Owner: line-engine agent.
import { scene, shotOverride } from '../registry.js';
import { drawLines, audio } from '../worlds/line/index.js';

const MASTER = {
  src: { plate: 'P01', standin: 'master', win: { cx: .5, cy: .5, zoom: 1 } },
  trace: {
    sky: { horizonY: .335, below: .345, useDepth: false }, sun: { x: .5, y: .343, r: .024, tilt: .35 },
    river: [[.494, .352], [.506, .352], [.60, .52], [.73, 1.0], [.27, 1.0], [.41, .52]],
    armies: 1, armyMask: [[[0, .36], [.48, .36], [.40, .55], [.27, .78], [0, .78]], [[1, .36], [.52, .36], [.60, .55], [.73, .78], [1, .78]]],
    innerEverywhere: 1, innerHi: .16, innerLo: .07, contour: 0, gamma: 1.3, bgGain: .35,
    pool: [{ x: .14, y: .8, rx: .2, ry: .3, k: 1 }, { x: .86, y: .8, rx: .2, ry: .3, k: 1 }],
  },
  corona: {}, skyField: { n: 46, gain: .5 },
};

scene('S35', async f => {
  const k = audio.kickEnv(f.t);
  await drawLines(f, { ...MASTER, kick: k, phase: audio.flowPhase(f.t) });
});
