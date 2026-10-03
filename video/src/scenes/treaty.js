// treaty.js: BRONZE, S79 (270.04-273.40 s): back in-universe, the kings swear the peace. Owner: TREATY.
//
// Herodotus 1.74.5 (tr. Godley): "These nations make sworn compacts as do the Greeks; and besides, when they cut the skin
// of their arms, they lick each other's blood." On the final stark chord (270.04) Alyattes of Lydia (left, facing right)
// and Cyaxares of Media (right, facing left) seal the peace with the right-hand clasp (the dexiosis of Greek and Near
// Eastern reliefs) and one firm shake; each bare forearm carries one thin fresh cut. Nobody licks anything; no gore.
// Behind them, at the edges and kept in shadow, the mediators of 1.74.3: Syennesis of Cilicia (left) and Labynetus of
// Babylon (right). One Caravaggio pool on the clasp, the kings' faces in its spill, dusk light after the eclipse: golden,
// with no eclipse drain (the brush engine's clock reads full magnitude after 110.98, so `eclipse` is pinned to 0 here).
// Held at 12 fps through the frozen chord (271.6); a hard cut to her grin (S80) at 273.40. A small plaque names the
// source, drawn with the type module's own PLAQUE renderer so it matches every other plaque in the film.
//
// Plate P55 take 1 (tools/plate_specs.py; song window 269.54-274.54, the chord = plate 0.50). Retimed with KEYS: the
// shake (plate 0.42-0.67) plays on the first three drawings, so the clasp lands on the chord; the hold then runs at
// 0.61x, which halves the plate's push-in (the kings are still; only the camera moves) and keeps both heads in frame.
// MediaPipe finds only Syennesis' frontal face, so the kings' faces, the clasp and the cuts are tracked by hand
// (TRACK, measured on plate frames 11, 17, 33, 49, 63). Until video/plates/P55/ exists the look-dev stand-in renders.
// The room's terminal (track event S78.terminal, 266.12-276.95) and every other event that is not S79's is hidden here.

import { scene, shotOverride } from '../registry.js';
import { paint, resolvePlate, hasPlate, camAt, camXform } from '../worlds/brush/index.js';
import { eventsAt } from '../type/index.js';
import { FX } from '../type/effects.js';

const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => k * k * (3 - 2 * k);
const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a)));
// piecewise-linear keys [[t, v], ...] (held outside); v a number or a (nested) array of numbers
const mixv = (a, b, k) => Array.isArray(a) ? a.map((x, j) => mixv(x, b[j], k)) : lerp(a, b, k);
const keyed = (t, keys) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return mixv(va, vb, (t - a) / (b - a)); }
  return keys[keys.length - 1][1];
};

export const S79 = { t0: 270.04, t1: 273.40, chord: 270.04, freeze: 271.6 };
const PLATE = 'P55', T0 = 269.54;
// song -> plate time
export const KEYS = [[270.04, .42], [270.30, .68], [273.40, 2.58]];
// plate time -> plate uv (0..1 over the 16:9 plate frame)
const TRACK = {
  clasp: [[.42, [.484, .604]], [.67, [.4876, .639]], [1.33, [.4837, .656]], [2.0, [.4857, .674]], [2.58, [.4837, .694]]],
  // each cut as a segment [u0, v0, u1, v1] across the forearm (Alyattes' left of the clasp, Cyaxares' right of it)
  cutA: [[.67, [.380, .618, .4114, .6306]], [1.33, [.3762, .642, .4095, .654]], [2.0, [.3704, .6646, .4055, .679]], [2.58, [.3664, .689, .4036, .703]]],
  cutC: [[.67, [.5345, .604, .5658, .589]], [1.33, [.5365, .626, .5658, .610]], [2.0, [.5392, .649, .5689, .632]], [2.58, [.5404, .670, .5697, .654]]],
  // the kings' faces (eye-to-beard centre): Alyattes, Cyaxares
  faces: [[.42, [[.36, .21], [.649, .236]]], [1.33, [[.352, .217], [.661, .244]]], [2.58, [[.341, .211], [.673, .239]]]],
  // the mediators' faces: Syennesis (left edge), Labynetus (right edge)
  mediators: [[.42, [[.109, .261], [.866, .254]]], [1.33, [[.098, .275], [.881, .261]]], [2.58, [[.082, .275], [.889, .275]]]],
};

shotOverride('S79', { cadence: 12, plate: { id: PLATE, at: T0, keys: KEYS }, params: { label: 'S79 · the oath (Herodotus 1.74) · P55' } });

// frame camera over the plate: a slow counter-zoom against the plate's own push-in (net ~10 % in); portrait frames
// keep the whole plate height and centre between the two faces
const portraitOf = f => f.W / f.H < 1.2;
const cameraFor = f => portraitOf(f) ? (() => ({ cx: .507, cy: .47, zoom: 1.0 })) : (k => ({ cx: .5, cy: .47, zoom: 1.08 - .05 * k }));
// plate uv -> output px through the camera (plate frames are 960x540)
function toFrame(f, cam, u, v) {
  const c = camAt(cam, f), X = camXform(c, 960, 540, f.W, f.H), p = [0, 0];
  X.inv(u * 960, v * 540, p);
  return [p[0] + .5, p[1] + .5];
}
const toUV = (f, cam, u, v) => { const [x, y] = toFrame(f, cam, u, v); return [x / f.W, y / f.H]; };

// the cuts: one thin, fresh, dark-red line across each bare forearm (a madder core, a vermilion lip catching the light).
// They come in as the shake settles (the plate's own cut lines carry the blurred shake drawings).
function cutStrokes(f, cam, tp, pal) {
  const k = sstep(.6, .7, tp); if (k <= 0) return [];
  const T = n => pal.tube(n) || [.5, .1, .1], out = [], u = f.L.u, zs = camAt(cam, f).zoom;
  const madder = T('madder'), verm = T('vermilion'), dark = madder.map(c => c * .62);
  [['cutA', 3], ['cutC', 7]].forEach(([id, seed]) => {
    const [u0, v0, u1, v1] = keyed(tp, TRACK[id]);
    const a = toFrame(f, cam, u0, v0), b = toFrame(f, cam, u1, v1), w = Math.max(1.4, 2.0 * u * zs);
    const n = [-(b[1] - a[1]), b[0] - a[0]], L = Math.hypot(n[0], n[1]) || 1, nx = n[0] / L, ny = n[1] / L;
    const m = [(a[0] + b[0]) / 2 + nx * .5 * w, (a[1] + b[1]) / 2 + ny * .5 * w];
    out.push({ pts: [a, m, b], r: w, c0: dark, c1: dark, a: .85 * k, thick: .22, seed: seed * .1, key: seed * .1, layer: 12, taper: .75, maxSeg: 8 });
    const o = -.75 * w;      // the lit lip, a hair above the cut
    out.push({ pts: [[a[0] + nx * o, a[1] + ny * o], [m[0] + nx * o, m[1] + ny * o], [b[0] + nx * o, b[1] + ny * o]], r: .6 * w, c0: madder, c1: verm,
      a: .42 * k, thick: .12, seed: seed * .1 + .05, key: seed * .1 + .05, layer: 12, taper: .85, maxSeg: 8 });
  });
  return out;
}

// the plaque: the type module's own PLAQUE renderer (small tracked caps, lower left), as in S16/S18
const OATH = { id: 'S79.oath', fx: 'plaque', shot: 'S79', anchor: 'lowerLeft', t0: S79.t0, t1: S79.t1,
  items: [{ key: 'p', role: 'plaque', text: 'THE OATH · HERODOTUS 1.74', reveal: 'line', t: 270.45 }] };
export const PLAQUE = true;

scene('S79', async f => {
  const t = f.t, real = hasPlate(PLATE), cam = cameraFor(f), tp = keyed(t, KEYS);
  // the type layer: nothing of the room (its terminal runs to 276.95) draws over the oath
  f.type = { hide: eventsAt(t).filter(e => e.shot !== 'S79').map(e => e.id).concat('S78.terminal'),
    light: { dir: [-.3, -.95], elev: .5, color: '#f6c878', intensity: 1.0, cool: 0 } };
  const src = await resolvePlate(f, PLATE, { id: 'a_duel', cam: k => ({ cx: .5, cy: .45, zoom: 1.12 + .03 * k }) }, cam, { keys: KEYS });
  const [cx, cy] = real ? toUV(f, cam, ...keyed(tp, TRACK.clasp)) : [.5, .55];
  const faces = real ? keyed(tp, TRACK.faces).map(([u, v]) => toUV(f, cam, u, v)) : [[.4, .3], [.62, .32]];
  const meds = real ? keyed(tp, TRACK.mediators).map(([u, v]) => toUV(f, cam, u, v)) : [];
  const zs = camAt(cam, f).zoom * (portraitOf(f) ? 1 / .45 : 1);       // uv scale of plate distances on screen (x)
  await paint(f, src, {
    palette: 'bronze', eclipse: 0,
    lightDir: [-.3, -.95], lightColor: '#f6c878',
    // one Caravaggio pool on the clasp, the kings' faces in its spill, a low warm fill on the two bodies; the mediators'
    // faces get a dim key (people, not voids) and the rest of them stays in the umber dark. No pool is flagged `fig`:
    // the plate's matte carries full figure value (poolMatte), so the river behind the hands is not lit into a halo.
    pool: [{ x: cx, y: cy, rx: .075 * zs, ry: .14, feather: .7, k: .92 },
      // each king's head, raised to take in the regalia (Alyattes' gold fillet, Cyaxares' cap and its gold band)
      ...faces.map(([x, y], j) => ({ x: x + (j ? .008 : -.008) * zs, y: y - .04, rx: .05 * zs, ry: .13, feather: .75, k: .88 })),
      ...meds.map(([x, y]) => ({ x, y, rx: .028 * zs, ry: .065, feather: .8, k: .5 })),
      { x: .5, y: cy - .16, rx: .27 * zs, ry: .34, feather: .85, k: .58 }],
    poolFromLight: { k: .45, bg: .15 }, poolMatte: .12, envDim: .45, crushFloor: .075, crush: .2, rim: .55,
    plateKeep: real ? .3 : 0, keepDim: .6, faceMin: null, glint: 1.15, glintT: .64, accents: .9, focusLift: .12,
    // the small brushes work the clasp, the cuts and the two faces
    focus: [{ x: cx, y: cy, rx: .05 * zs, ry: .07, k: 1 }, { x: cx, y: cy - .02, rx: .1 * zs, ry: .05, k: .8 },
      ...faces.map(([x, y]) => ({ x, y, rx: .03 * zs, ry: .06, k: .9 })),
      // the regalia that say who they are: Alyattes' gold fillet, Cyaxares' madder cap and its gold band
      ...faces.map(([x, y], j) => ({ x: x + (j ? .012 : -.012) * zs, y: y - (j ? .12 : .085), rx: .04 * zs, ry: .05, k: 1 }))],
    fineGate: .2, midGate: .15,
    groundFlow: { y0: 0, k: .65 },                     // the river behind and the gravel in front: horizontal flicks
    overStrokes: real ? ({ pal }) => cutStrokes(f, cam, tp, pal) : null,
  });
  if (PLAQUE) { const g = f.g; g.save(); try { FX.plaque(g, f, OATH, t); } finally { g.restore(); } }
});

export const TREATY_PLATES = { S79: 'P55' };
