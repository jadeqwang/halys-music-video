# brush: the painting engine (BRONZE, reusable for MARBLE / GOLD)

Every drawing is *painted*, not filtered: a designed light is laid over the source, then strokes are placed
coarse-to-fine (Hertzmann) wherever a CPU "virtual canvas" still differs from that relit reference, and rasterised
on the GPU as bristled ribbons with paint height (impasto), canvas weave and varnish. Seeds live in material space
(advected by the plate's optical flow), so at 12 drawings a second the paint boils and never strobes.

```js
import { paint, resolvePlate, canvasSource } from '../worlds/brush/index.js';
const src  = await resolvePlate(f, 'P07', { id: 'a_duel', cam }, plateCam, { keys });   // plate, or its stand-in
const look = await paint(f, src, { palette: 'bronze', pool, lightDir, sky, sun, eclipse: .3, impasto: .55, seed: 7 });
// look.light {dir, color, pools, warm} · look.sun {x, y, r, px, moon, e} · look.ms timings · look.strokes
```

`paint(f, src, opts)` draws the whole frame into `f.g` (or `opts.target`) and returns `look` (what the type module
needs to light CARVED letters). `f` is the harness frame context (`f.t`, `f.W/H`, `f.cad`, `f.shot`, `f.L.u`).

## Sources (`sources.js`)

A source is `{aw, ah, R, G, B, depth?, matte?, faces, mat {mx, my}, sky?, wall?, key}` at analysis resolution
(`analysisSize`: ~960x540 for a 1080p frame). `mat` = material coordinates (layout px of the shot's first drawing):
strokes seed there, so they stick to the content.

| call | what |
|---|---|
| `resolvePlate(f, id, standin, plateCam, o)` | `video/plates/<id>/` when it exists (index.json), else the stand-in `{id: 'a_duel'|'b_face'|'c_armies', cam}` |
| `plateSource(f, id, cam, o)` | plate frame + depth + matte + MediaPipe faces; material map composed from the plate's forward flow |
| `stillSource(f, id, cam)` | a still (stand-in) with a slow synthetic camera |
| `canvasSource(f, key, draw, {sky, matte, cache})` | procedural canvas (S12, S18, S28 skies...) |
| `diptychSource(f, makeLeft, makeRight)` | two 8:9 panels; a wall at the seam stops every stroke |

Cameras: `{cx, cy, zoom, rot, mirror}` or `k => ({...})` (k = shot progress). Plate timing: `o.keys`
`[[songT, plateT], ...]` (retime, hold, reverse) or `o.at` (song time of plate 0). Plate frames/maps are decoded
once and closed (no ImageBitmap cache: it grows the renderer by GBs over a long render).

## Options (all optional; defaults in `index.js` `DEFAULTS`)

**Palette** `palette: 'bronze'|'gold'|'marble'|{tubes, ground, varnish}`: every reference colour is forced into the
palette's OKLab box (`palette.js`), bible hexes as tubes.

**Light** (Caravaggio: one warm fast-falling pool; outside it a varied umber where only glints survive)
- `pool: [{x, y, rx, ry, rot, feather, k, fig}]` designed pools (uv); `fig: true` = lit like a figure (full value)
- `poolFromLight {k, bg, lo, hi, matte}` the plate's own key light as a pool · `poolMatte` the matte carries light
- `envDim`, `crushFloor`, `crush`, `darkVar`, `glint`, `glintT`, `glintReach`, `focus: [...]` (+ `focusLift`)
- `lightDir` (toward the light), `lightPoint` (a light in frame: rims face it), `rim`, `rimBreak`, `fringe`
- `plateKeep` (0..1) keep the plate's own value design under the push (well-lit plates); `keepDim`
- `liftDark` (backlit plates; compresses darks, use sparingly), `aerial {color, near, far, k}` (needs depth)
- `lightField` / `shadowField` (Float32 per analysis px: crescent light S27, umbra S30), `matteFromDepth [lo, hi]`
- `faceMin` faces from the source (score >= faceMin) become focus regions; `eyes` / `eyeStrokes` catchlights

**Eclipse** `eclipse` (0..1 of the light gone strange): pool edges sharpen, colour drains, lights go metallic, crush
deepens (`light.js eclipseCfg`; how far: `eclipseLift`, `eclipseCrush`, `eclipseContrast`, `metalK`; lit figure plates
at totality use low values so they glow instead of going to mud). The clock itself is `eclipse.js` (first contact 46.49 s, totality 110.58 s, moon
from 5 o'clock, `magnitude`, `moonOffset`, `beads`, `diamondRing`, `jupiterAt`, `coronaStrokes`).

**Sky** `sky: {...}` an Altdorfer vortex wound around the sun (see `sky.js` `SKY_DEFAULTS`: `vortex, twist, arms,
cover, glow, glowR, drama, fire, night, ring, haze`), masked by depth (`maxDepth`), an explicit `horizonLine`
`[[u, v], ...]`, or `src.sky`. Its strokes follow the spiral tensor and turn with it.
`sun: {x, y, r, alt, off, moonVis, beads, ring, ringAng, limb, jupiter {ppd|x,y}, vis, paint}`: a blazing disk,
golden-orange near the horizon, no rings, **painted** (v2): the sun pass lays a hot underpaint and the Sun's own strokes
build it in the engine's brushwork (broad hot strokes in the core, loaded strokes that follow and break the limb, flicks
lifting off it, sky paint cutting back in), seeded per stroke in sun-local polar coordinates with a small boil per
drawing. The moon's bite cuts them along a clean curve (always an actual eclipse); the limb calms as the crescent thins
and the strokes stop at totality, so the black disk stays exact. `paint` (default 1) scales how far the limb breaks; 0
is v1's exact flat disk. Beads, the diamond ring, the totality limb and Jupiter are drawn after the strokes.
`corona {k, photo, scale, tilt, glow, asym}`: `photo: true` paints the corona as a totality photograph shows it (inner
corona, asymmetric helmet streamers, polar plumes, coronal holes, a few prominences) with a matching asymmetric glow;
every Act I corona uses it.

**Strokes** `brushes` (px at 1080p, 5 layers), `strokeScale`, `T` (per-layer error thresholds), `midGate`,
`fineGate` (detail needed for the small brushes), `maxLen`, `minLen`, `fg`, `jitter`, `boil`, `boilColor`,
`colorJit`, `accents`, `groundFlow {y0, k}` (water / open ground: horizontal flicks instead of dabs),
`swirl {cx, cy, amount, radius, smear}` (the rewind), `strokes` / `overStrokes` (extra stroke lists or fns),
`seed`, `drawIdx` (hold a drawing: fixed boil).

**Finish** `impasto`, `thick`, `thickHi`, `thinDark`, `spec`, `weave`, `crack`, `varnish`, `vignette`,
`exposure`, `warmFlash`, `white` (the S34 white-out), `metal`.

## Procedural layers (`procedural.js`)

`crowdStrokes(src, o)` Altdorfer's troops over a painted army (spears with lit tips, helmet/shield glints, standards;
one candidate per material cell from the plate's depth relief) · `bronzeSpecular(o)` a hot specular sweep and the
sun's reflection on metal · `crescentField` / `crescentStrokes2` pinhole crescents · `mirrorFigure` the S26 reflection
· `arrowStrokes`, `umbraField`, `horizonCanvas`. They return stroke lists for `strokes` / `overStrokes`, so they are
painted with the same brushes, impasto and varnish as the rest.

## Temporal coherence ("boil, never strobe")

- Stroke cells are hashed in material space: a plate's material map is composed from its forward flow (backward
  flow by fixed-point `b = -v(p + b)`, smoothed, regularised toward identity where nothing moves), so a stroke
  stays on the cheek it was painted on. Stills and canvases use the camera's affine map; skies their own vortex.
- The boil is a per-drawing jitter (`drawIdx = round(t * cadence)`): positions, colour and thresholds wobble a
  little each drawing; stacking order is stable per cell.
- Inserts that split a shot (S26e, S29b) pass the parent's progress so the seeds do not pop.

## Performance

1920x1080, one core (CPU seconds of the whole browser process tree, robust to other load): ~4.1-4.3 s per drawing
on the heavy shots (S01, S05, S08, S09, S31; budget 6 s). Profile: URL `bvar=timing` logs per-stage ms
(analysis, reference, sky, placement, GPU). Dominant costs: structure tensors (quarter-res coarse), region
blurs (downsampled), stroke placement (span rasteriser), GPU ribbons (MRT RGBA16F colour + R16F height).

## Debug (URL params, act1.js)

`bdebug=src|ref|pool|mat|depth|matte` shows the source crop, the relit reference, pools (R) / focus (G) / sky (B),
the material grid, depth, matte. `blog` logs per-layer stroke counts. `bvar=<name>` applies a test variant.

## Reuse (MARBLE / GOLD)

Nothing in the engine is BRONZE-specific except defaults: pass another `palette`, your own pools/light, and a
`canvasSource` or plate. The sun, sky and eclipse are opt-in (`sun`, `sky`, `corona`).
