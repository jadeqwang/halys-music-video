// registry.js: scenes (how a world is drawn) and shots (when, at what cadence, with which plate and params).
//
//   scene('placeholder', async f => { ... draw the whole frame into f.g ... }, { init: async () => {...} })
//   shot({ id: 'drop1', t0: 110.6, t1: 152.0, world: 'corona', cadence: 60, scene: 'placeholder',
//          params: {...}, plate: { id: 'river_wide', at: 110.6, speed: 1 }, framing: { '16:9': {...}, '4:5': {...} } })
//
// Shot times are song seconds; finalize() snaps them to the master frame grid (a cut shows on the first frame
// at or after t0; a shot covers frames F0 <= i < F1). When shots overlap, the one defined LAST wins, so an edit
// can lay inserts over a long base shot. Frames no shot covers render black and are reported by --list.
//
// A scene receives one frame context f (see main.js buildContext):
//   f.i master frame · f.t song time of this drawing · f.lt = f.t - shot.t0 · f.k = f.lt / f.dur · f.d drawing index
//   f.cad cadence · f.shot · f.params · f.world · f.framing (per-aspect, resolved) · f.W, f.H, f.L (layout)
//   f.g the 2D context of the output canvas · f.rng() seeded per drawing · f.seed · f.layer(n) pooled canvases
//   f.drawScene(name, overrides, g) draws another scene (transitions through the disk)
// Scenes must be pure functions of f: no state carried between frames (caches are fine).

import { frameAtOrAfter, FPS } from './time.js';

export const WORLDS = {            // default draw cadence per world (TREATMENT.md v0.1: frame rate is a genre signal)
  bronze: 12, gold: 12, marble: 30, corona: 60, orbit: 60, room: 12,
};

export const SCENES = new Map();
export function scene(name, draw, opts = {}) { SCENES.set(name, { name, draw, ...opts }); }

export const SHOTS = [];
export function shot(spec) {
  if (!spec.id) throw new Error('shot needs an id');
  if (SHOTS.some(s => s.id === spec.id)) throw new Error(`duplicate shot id ${spec.id}`);
  const s = { scene: 'placeholder', params: {}, ...spec };
  s.cadence = +(s.cadence || WORLDS[s.world] || 12);
  SHOTS.push(s);
  return s;
}

export function finalize() {
  const warn = [];
  for (const s of SHOTS) {
    if (!(s.t1 > s.t0)) throw new Error(`shot ${s.id}: t1 must be > t0`);
    if (!SCENES.has(s.scene)) throw new Error(`shot ${s.id}: unknown scene "${s.scene}"`);
    s.F0 = frameAtOrAfter(s.t0); s.F1 = frameAtOrAfter(s.t1);
    s.dur = s.t1 - s.t0;
    s.hold = FPS / s.cadence;        // master frames per drawing (fractional for rates that do not divide FPS)
    if (s.F1 <= s.F0) warn.push(`shot ${s.id} is shorter than one frame`);
    if (Math.abs(s.hold - Math.round(s.hold)) > 1e-9) warn.push(`shot ${s.id}: cadence ${s.cadence} does not divide ${FPS} fps (uneven holds)`);
  }
  return warn;
}

export function shotAtFrame(i) {
  for (let k = SHOTS.length - 1; k >= 0; k--) { const s = SHOTS[k]; if (i >= s.F0 && i < s.F1) return s; }
  return null;
}
export const shotById = id => SHOTS.find(s => s.id === id) || null;

// frame ranges no shot covers, as [[F0, F1), ...] within [0, nFrames)
export function gaps(nFrames) {
  const cov = new Uint8Array(nFrames);
  for (const s of SHOTS) for (let i = Math.max(0, s.F0); i < Math.min(nFrames, s.F1); i++) cov[i] = 1;
  const out = []; let a = -1;
  for (let i = 0; i <= nFrames; i++) {
    if (i < nFrames && !cov[i]) { if (a < 0) a = i; } else if (a >= 0) { out.push([a, i]); a = -1; }
  }
  return out;
}
