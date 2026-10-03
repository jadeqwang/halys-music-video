# The line engine (CORONA, ORBIT, the light transitions)

`video/src/worlds/line/` draws the film's worlds of light: luminous field lines that trace a plate's structure
(STYLE_BIBLE "The line engine"), the totality corona, the sky's magnetic field, spear-tick armies and procedural line
art, at 60 fps, as a pure function of the frame. Drop 1 (`scenes/drop1.js`) is built on it; ORBIT (Drop 2) and the
transitions should be too. Everything below is the stable API; anything not listed is internal.

## In five lines

```js
import { drawLines, coronaRing, ringU, dynLayer, proc, audio } from '../worlds/line/index.js';
const r = await drawLines(f, { src: { plate: 'P12', standin: 'duelup' }, tp,                    // plate fields -> lines
  trace: { sky, sun, pool, armies, river }, corona: {}, skyField: {},                          // hierarchy + corona + sky field
  cam: { yaw, pitch, zoom }, kick: audio.kickEnv(f.t), phase: audio.flowPhase(f.t), invert,     // 3D orbit, music
  layers: [{ mesh: coronaRing(f, 'ring', { refR }), u: ringU(cx, cy, R) }, dynLayer(proc.gear(...))] });
// r.sun = [x, y, r] on screen (for the type layer: f.type.sun), r.plate = meta
```

## Concepts

* **Source** (`source.js`): `{ plate: 'P14', standin: 'bface', win: {cx, cy, zoom}, standinWin: {...}, mirror }`.
  The production plate `video/plates/P14/` is used as soon as it is listed in `video/plates/index.json`; until then the
  stand-in still in `standins/<id>/` (frame.jpg 1920x1080, depth.png 8-bit, matte.png; made from the look-dev inputs and
  the art-department boards with `video/lab/analysis/prep.py`). `win` frames the plate (uv centre, zoom 1 = the largest
  rect of the output aspect), so 4:5 and 9:16 re-frame instead of crop. Ids: `master` (F2, the master composition),
  `duelup` (F3, both heroes looking up), `bface` (the Lydian looking up), `aduel` (the duel), `armies` (aerial river),
  `kings` (Alyattes | Cyaxares diptych), `hand` (an open palm, for P24).
* **Fields** (`analysis.js`): one analysis per source window at 960 px wide: colour, tone, structure tensor at three
  scales (flow = its minor eigenvector), coherence, thinned edges, detail, depth, matte. Cached per window.
* **Lines** (`trace.js`): `{ xy, n, d, b, w, o, s, len, phase, spd, flags }` in analysis px; `d` = lift depth (1 near,
  -1 = sky/infinity), `b` brightness, `w` width (px at 1080p), `o` colour (0 pearl, 1 signal orange, 2 H-alpha red),
  `s` arc length (px) for travelling pulses, `flags` (`FL.SHARP` never glows, `FL.TIP` a point, `FL.NOFADE`, ...).
  Hierarchy (STYLE_BIBLE): tier 1 matte silhouettes + coherent inner edges (brightest, crisp, tapered, orange where the
  rim faces the light); tier 2 evenly spaced streamlines (Jobard & Lefer) through the flow, spaced by tone; tier 3 a
  sparse dim background; massed soldiers as **spear ticks** with a bright tip (`trace.armies`, `armyMask` polygons);
  a designed river (`trace.river` polygon: orange banks, water flowing to its vanishing point).
* **Corona** (`corona.js`): `coronaLines(sun, opts)`: limb ring, asymmetric helmet streamers (loops + long fraying
  stalks), polar plumes, fibril halo, outer rays, 2-3 H-alpha prominences; the disk is cut analytically (crisp black)
  after the glow. `skyField(sun, opts)`: the F4 sweep, evenly spaced field lines of a tilted dipole + quadrupole +
  active-region dipoles, dense near the sun and sweeping the whole sky; the land occludes it.
* **Temporal coherence** (`temporal.js`): video plates are traced at reference frames (every `refStep` = 4 plate
  frames); reference k is seeded by reference k-4's lines carried by the optical flow (stable ids); any plate time is
  the two bracketing references carried to it (forward / backward through the flow maps, sub-frame) and cross-faded.
  Lines follow the footage at 60 fps from 24 fps plates, never boil, and a line that re-breaks fades over ~10 frames
  instead of flickering (the look-dev's line-end flicker). It is a pure function of plate time: frames render in any
  order. `freeze: tp` holds a video plate still (S36 close-ups, S37's frozen duel).
* **Camera** (vertex shader, `camUniforms` / `project` in JS): lines are lifted to 3D from depth (subject relief
  compressed, `trace.relief`), orbited (`yaw`, `pitch` degrees) about the subject's median depth, zoomed (`zoom` about
  `center`), panned. Static line sets are uploaded once; a frame only changes uniforms.
* **Music** (`audio.js`, all snapped to the master frame grid like cuts): `kickEnv(t, tau)` (1 on the kick frame),
  `onFrames(t, times, 2)` (2-frame stab inversions), `flowPhase(t)` (pulse travel = integral of the low band, so the
  light flows faster with the bass), `stutterTimes()`, `kickTimes()`, `stabTimes()`.
  In `drawLines`: `kick` thickens lines (`kickWidth`), surges and sharpens the pulses and pushes everything radially
  out from the sun (`kickPush` px, `pushCenter`); `invert` renders dark lines on pearl.

## drawLines(f, opts) -> { sun, plate, u, ms }

| opt | meaning |
|---|---|
| `src`, `tp`, `freeze`, `chainFrom` | source spec; plate time; hold a video plate at plate time `freeze`; plate time where the reference chain starts (the shot's first plate time) |
| `trace` | `TRACE_DEFAULTS` overrides: `sky` {horizonY, maxDepth, below}, `sun` {x, y, r (fraction of width), tilt}, `pool` light-pool ellipses (subject when there is no matte), `armies`/`armyMask`, `river`/`riverFlow`, spacing `dsepMin/Max`, `bgSepMin/Max`, `contour`, `innerEdges`, `innerEverywhere`, `lightDir`, `relief`, `calm` |
| `corona`, `skyField` | `false` or option objects (`gain`, `streamers`, `prominences`, ...; `sep0/sep1`, `tilt`, `locals`, ...) |
| `analysis` | `analyze()` options, e.g. `{ gain: 1.7 }` for a dark painting |
| `cam` | `{ yaw, pitch, zoom, pan: [x, y], center: [x, y], focal, pivot }` |
| `kick`, `kickWidth`, `kickPush`, `pushCenter`, `push` | the kick response (0..1 envelope) |
| `phase`, `pulse`, `lambda` | travelling pulses: travel, depth 0..1, wavelength px |
| `invert`, `flash` | dark lines on pearl; a pearl flash 0..1 |
| `look` | `{ exposure, glow: [half, quarter], vignette, fade, bright, flat, white, width, endFade, soft, minW }`; `width`/`flat`/`white`/`soft` are the "widen into strokes" controls (S45) |
| `reveal` | `{ x, y, r, ramp, boost }`: lines inside r are hidden and ignite just outside it (the pupil opening, S35) |
| `disk`, `ring` | the crisp black disk `{x, y, r}` (default: the plate's sun) and a ring of light `{r, w, i}` around it |
| `layers` | extra layers after the plate: `{ mesh | meshes | lines, u, cam, meta }`; `dynLayer(lines)` for lines built this frame, `coronaRing(f, key, {refR, corona, skyField, tilt})` + `ringU(cx, cy, R)` for a placeable corona, `staticMesh(f, key, build)` for cached procedural sets |

`proc.js` (procedural line art in any 2D space): `line`, `circle`, `ellipse`, `gear`, `dial`, `glyphRow`, `orbits`,
`animeEye`, `displace`. ORBIT's Antikythera gear train and Halley's map can be built from these.

## For the type layer

Scenes set `f.type = { sun: {x, y, r}, kick, invert, field: { center } }` (the CHOP fill circles the eclipse, pulses
with the same kick and inverts on the same frames). Drop 1 inverts only on the S36 stabs (same list as the type track).

## Performance (1920x1080, headless Chromium, SwiftShader, 4 cores)

See production/review/drop1/NOTES.md for the measured numbers. A still plate's analysis + trace (0.5-2 s) runs once
per window per page and is cached; a frame then costs the GPU raster + glow + compose. Video plates cost one analysis +
trace per reference (every 4 plate frames = 10 master frames) plus the flow transport per frame.

## Files

`index.js` API · `source.js` plates/stand-ins · `analysis.js` fields · `trace.js` lines · `corona.js` corona + sky field ·
`temporal.js` video coherence · `gpu.js` WebGL2 raster/post · `audio.js` music · `proc.js` procedural shapes ·
`standins/` stand-in stills (temporary, until the plates exist).
