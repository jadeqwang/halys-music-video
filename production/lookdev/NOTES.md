# HALYS look-dev: one flow field, four materials

Every image here is drawn by JavaScript from **one analysis** of a stand-in plate (Nano Banana stills in
`media/lookdev/inputs/`, depth/matte/faces from `video/lab/analysis/prep.py`). The plate itself never appears: only
marks derived from its fields (structure-tensor flow, edges, tone, colour, matte, depth).

| file | what |
|---|---|
| `a_duel_bronze.jpg` `b_face_bronze.jpg` `c_armies_bronze.jpg` | BRONZE stills (1920×1080, q90) |
| `bronze_eclipse_strip.jpg` | c_armies at eclipse = 0.05 / 0.50 / 0.80 / 0.95: one parameter drives bite, light and colour |
| `bronze_boil.mp4` | 2 s, 24 fps, drawn on twos (24 drawings), slow 4.5 % push-in over a_duel |
| `a_duel_corona.jpg` `c_armies_corona.jpg` | CORONA stills |
| `corona_flow.mp4` | 2 s, 24 fps on ones: ±11° depth orbit of a_duel, phase flow along lines, a kick every beat (120 bpm) |
| `a_duel_marble.jpg` `b_face_marble.jpg` | MARBLE stills |
| `d_room_ink.jpg` | INK still |
| `sheet_bronze.jpg` … `sheet_ink.jpg` | contact sheets: stand-in plate beside the render, with timings |

## Pipeline (`video/lab/`)

```
plate (still or video frame) + offline depth / matte / faces   (analysis/prep.py: Depth-Anything-V2 ViT-B, rembg, MediaPipe)
  └─► src/analysis.js  ONE analysis at 960×540: colour, tone, gradient, structure tensor at three scales (flow = minor
                       eigenvector; fine field near detail, coarse field for long calm lines), coherence, thinned edges,
                       detail, depth, matte, faces  (~0.4-0.6 s per frame)
        ├─► src/bronze.js  strokes laid along the flow        Baroque oil, tenebrism, Altdorfer sky, eclipse
        ├─► src/corona.js  streamlines of the flow, lit       field lines on navy-black, 3D orbit, phase flow, kicks
        ├─► src/marble.js  veins along the flow + depth       polished marble at totality
        └─► src/ink.js     edges + tone bands + flat palette  clean anime cel
src/sky.js (shared sky mask), src/shots.js (per-shot design), src/gl.js (WebGL2 toolkit), src/core.js (colour, palette box)
render.mjs drives lab.html in headless Chromium (playwright-core, WebGL2 on SwiftShader: CPU only)
```

```bash
cd video/lab
node render.mjs --still=a_duel:bronze,c_armies:corona            # → production/lookdev/<plate>_<material>.jpg (+ timings.jsonl)
node render.mjs --still=c_armies:bronze --set='{"eclipse":.8}' --tag=e80
node render.mjs --clip=bronze_boil                                # clips are defined in src/main.js (CLIPS)
node render.mjs --clip=corona_flow
python3 tools/contact.py                                          # sheet_<material>.jpg
```

Every frame is a pure function of (plate, camera, material, params, t): frames render in any order. Per-shot design
(light pools, focus, sky, sun, eclipse fraction, material priors) is data in `src/shots.js`; defaults sit at the top of
each material module. Open `video/lab/lab.html` through any static server rooted at the repo to render interactively.

## Speed (1920×1080, headless Chromium, SwiftShader, 4 CPU cores, no GPU)

Two sets of numbers, because from 00:15 another agent's x265 encode occupied ~3 of the 4 cores (load ≈ 6).
`timings.jsonl` records every render with the 1-minute load average; the contact sheets print it.

| material | idle machine (first renders) | final renders under load ≈ 6 | what dominates |
|---|---|---|---|
| BRONZE | analysis 0.4-0.55 s + render 4.3-6.0 s = **4.7-6.5 s per drawing** | 6.1-9.1 s | GPU stroke raster + finish 2.6-4.3 s (idle), strokes 1.0-1.2 s, reference+sky 0.65-0.8 s; 46k-116k strokes, 0.6-1.4 M triangles |
| CORONA | analysis 0.4-0.9 s + render 1.2-1.5 s = **1.6-2.4 s first frame**; **≈0.55 s** per further frame over a held plate | 1.7-1.8 s | streamline tracing 0.5-0.75 s (once per plate frame); per frame only projection (~40 ms) + GPU (0.4-0.85 s) |
| MARBLE | **≈2-3 s** | 1.9-2.3 s (analysis shared) | fields incl. LIC veins ~1.0 s, GPU 0.45-0.7 s |
| INK | **≈4.5 s** | 4.4 s | bilateral smoothing ~3 s (single-threaded JS) |

Clips: `bronze_boil.mp4` 24 drawings at 5.7 s (partly idle) to 8.2 s (loaded) each, held on twos; `corona_flow.mp4`
48 frames at ≈0.55 s each after one 1.3 s line trace. Act I in BRONZE (~110 s on twos ≈ 1,300 drawings) is about 2 h
on this box when idle. The real bottleneck for video is the offline analysis: Depth-Anything + rembg on CPU cost
several seconds per plate frame (prep.py), so per-frame depth for Seedance plates wants batching or a GPU.

---

## BRONZE: Baroque oil, tenebrism, Altdorfer sky

**What it does**
1. *Designed light* (`reference`): the plate is re-lit per shot. Environment light = soft ellipses (`pool`, each with a
   strength `k`, dimmed by `envDim`); figure light = the subject matte kept sharp (so no halo leaks onto the water);
   a key on faces/hands (`focus` ellipses + `focusLift`, plus detected faces with `faceMin`). Outside the light, values
   crush to warm near-black (`crushFloor`, `crush`); only **glints** survive, and only near the light (`glintReach`):
   ridges and specks (bright with little gradient), never the bright side of every edge. Everything is then forced into
   the **palette box** (`core.js PaletteBox`): the ten tubes, their pairwise mixes, tints and shades, looked up through a
   3D LUT in OKLab. No saturated blue exists in the box.
2. *Altdorfer sky* (`skyField`, `withSky`): the plate's sky region (far depth, never the matte, monotone down columns)
   is replaced by a designed sky: one vortex of cloud around the sun, horizontal banks elsewhere, umber-and-verdigris
   zenith, luminous ochre horizon, cloud rims lit on the side facing the sun (density sampled toward the sun), dark
   umber-madder bodies far from it, faint rays. It enters as reference colour **and** as a structure tensor, so the same
   brushes paint it along the vortex.
3. *Painting* (`strokes`, Hertzmann-style coarse to fine): five brushes (24 → 2.4 px radius). For each, the reference
   is blurred to the brush's scale; wherever the CPU "virtual canvas" still differs by more than a threshold `T`, a
   stroke starts at the worst pixel of the grid cell and follows the flow (turn-limited by `maxTurn` so it stays a brush
   stroke, not a worm), ending when it would paint the wrong colour. Focus lowers `T`, darkness raises it (`darkRaise`),
   the finest brush only works in focus / lit detail (`fineGate`). Paint body: thin in the darks, loaded in the lights.
4. *GPU paint* (`paint`): Catmull-Rom ribbons with bristle tracks, ragged edges, dry-brush tails on wide strokes, written
   to colour + height targets (half float). The sun disc and the moon's bite are drawn exactly (`SUN_FS`: antialiased
   circles, concentric brush texture, impasto) because the bite is the film's countdown clock. Finish: impasto lit from
   the upper left (only where paint is thick), canvas weave where it is thin, faint craquelure in the darks, amber
   varnish, vignette.
5. *Eclipse* (`eclipse` 0..1 = fraction of the diameter covered): moves the moon, darkens and desaturates the sky,
   shrinks the light pool's feather and blur (**shadows sharpen**), cuts saturation (**colour drains**), adds `metal`
   (**light turns metallic**), deepens the crush. See `bronze_eclipse_strip.jpg`.
6. *Drawn on twos, boil not strobe*: a drawing is `floor(t·12)`. Stroke seeds live on brush grids in plate-anchored
   layout space (`anchor`, so a camera move does not make strokes swim); each drawing only re-jitters positions by
   `boil` (0.3 of a cell) and colour by `colorJit`. In `bronze_boil.mp4` the low-pass (σ = 12 px) change between
   consecutive drawings is ≈1.3 grey levels (mostly the push-in itself) while the stroke-scale change is ≈3.9, and the
   two frames of each drawing are identical: the paint shimmers, the picture holds.

**Critique**
- b_face is the strongest frame: a Rembrandt-like head out of warm darkness, eyes and beard resolved by small brushes.
- a_duel reads as a lit duel in a dark world; the sun with its bite sits in a dramatic band of cloud. Weak spots: thin
  bright rims still trace parts of the silhouettes (plate haze + matte edge), the water at bottom left is a big flat
  dark field, and the background soldiers are photographic smudges rather than painted decisions.
- c_armies: a good Altdorfer read (the luminous corridor along the horizon leads to the river's bend, both armies get the
  same light: equal dignity). The sky is procedural, not composed: it lacks Altdorfer's specific architecture (the
  tablet, the curving earth). The crowds are rendered as stroke texture, not soldiers.
- Brushwork is convincing at 1:1 but reads smoother/more "filtered" at small sizes than Loving Vincent's discrete
  strokes; push `thick`, `colorJit` and bristle contrast if the film wants louder paint.
- The disc's concentric texture can read like a vinyl record at large sizes.
- 5-6 s per drawing is fine for lookdev; a production pass should cache the reference/sky across drawings of a held
  plate (already cached by key) and move the virtual canvas to the GPU.

---

## CORONA: field lines on navy-black

**What it does**
1. *Fields* (`prepFields`): brightness = tone^γ + edges + matte boost, multiplied by a designed light (pools + matte,
   `envDim`) and a depth fade; line importance sets the local separation (`dsepMin`..`dsepMax`, `envSep`): dense,
   bright lines on the subject, a sparse dim field elsewhere. The tensor uses the fine field only where there is
   detail inside the light, the coarse field elsewhere (long, calm lines). Orange (#f08a2a): the subject matte's rim
   (prominences) and a band under the horizon (the 360° totality glow). The sky becomes a **corona**: the moon's black
   disc with streamers whose field loops near the limb and goes radial further out, brightness ∝ r^-1.9, brighter along
   a tilted equator (helmet streamers).
2. *Evenly spaced streamlines* (`traceLines`, Jobard & Lefer): RK2 tracing both ways, stopped by proximity (`dtest`),
   kinks, accumulated turning (`maxTurn` per 8 px: no squiggles), the horizon, and **depth discontinuities** (so the
   orbit never stretches a line across a gap). Crowds (`particles`): where the plate is fine texture inside the light
   (c_armies' armies) soldiers become points of light that twinkle, not lines.
3. *Per frame*: vertices are lifted to 3D from a blurred depth, smoothed along each line (no depth-noise zigzags), and
   the camera orbits a pivot at the subject's median depth (`yaw`, `pitch`, compressed `zNear..zFar`, `overscan`).
   Lines are additive antialiased ribbons 0.6-1.5 px wide in linear light; brightness pulses travel along each line
   (`lambda`, `speed`: outward from the sun, upward on the land); `kick` (0..1) sharpens pulses into dashes and surges
   the light (+20 % mean brightness at each beat in the clip, decaying in ~0.2 s).
4. *Finish*: restrained glow (half- and quarter-resolution gaussians, weights 0.28/0.12), soft clip, pearl #f3efe6
   and orange over #05070c with a slight vignette.

**Critique**
- c_armies is the strongest: two armies of particles on either bank, the river as calm parallel field lines, the corona
  and the orange horizon. It reads as "agents in the simulation" without saying so.
- a_duel: the duelists become plasma with orange rims; the orbit genuinely turns the painting into a 3D object. But
  interiors can read as zebra stripes, and the wicker shield's rectangular edges trace a maze. At the ends of the orbit
  the 2.5D relief shears and internal lines cross: it is a depth-map lift, not a model.
- The corona is small in a_duel because the plate's sky band is thin; for the payoff shot it wants more sky.
- No temporal coherence yet between *different* plate frames: on Seedance video the lines are re-traced per frame
  and would boil. For CORONA (machine-smooth, 60 fps) seeds must be advected with optical flow before production.

---

## MARBLE: polished marble at totality

**What it does** (one deferred-shading pass): normals from the depth map at two scales (fine = carving, coarse = the
soft wrap light of subsurface scattering) plus a bas-relief from the plate's luminance gradient and a cavity term from
depth and tone; albedo warm white #ece6db with fine grey veins that follow the **same flow field** (iso-lines of a
noise smeared along the flow by LIC, rotated `veinAngle` off the contours so they cross the carving, clustered in
zones, with a soft halo) and a faint flow-aligned mottle; a cool soft key from above, a thin warm orange rim from the
horizon behind (only at the matte silhouette), a faint orange bounce on downward faces, polished specular plus sheen,
a little terminator glow (`sss`). **Eyes** (detected faces + `eyes` list) get flat albedo, no cavity darkening and no
specular: carved blank eyes, never glowing ones. The sky is a totality sky (desaturated navy-black, orange 360° band
low along the smoothed horizon, planets, faint stars); the land is dark stone with the horizon light grazing it. In
a_duel the river is a dark mirror that catches the horizon glow under the far bank (`water`, `waterY`), and the
plate's brightest specks close to the bodies become frozen spray, small glass glints (`glassT`, `glassReach`).

**Critique**
- b_face works as a carved marble bust under the totality sky; the blank eyes read as sculpture.
- The surface still reads more like glossy resin than stone: Depth-Anything normals are blobby, real marble's
  translucency (light bleeding into thin edges) is only approximated, and the luminance relief adds lumps.
- a_duel's statues still look like white figurines; the dark-mirror river and the spray glints around the legs give
  the scene its night, but suspended arrows and birds (the treatment's frozen battle) are not attempted.
- Veins are much better than the first contour-line attempt but still look drawn; real Carrara veining is more
  fractured.

---

## INK: clean anime cel (the room)

**What it does**: an edge-preserving smooth of the plate in OKLab (cross-bilateral; extra passes on the background),
then per full-resolution pixel the smoothed colour is classified into a palette material (hair #101114, jacket
#f2f0ea, orange #f08a2a, navy #1e2433, warm skin) using lightness ranges and chroma anchors plus per-shot **region
priors** (faces give skin for free), blended across the decision boundary over about a pixel, then a hard 2-3 tone cel
band (shadow / base / highlight; per-material cuts). Line art: hysteresis edge chains (lower thresholds on the
character, higher on the background) and the matte silhouette as tapered ribbons, weight from edge strength and depth.
Background: the soft smooth with gentle value steps (anime depth of field), the screens' colour kept, plus monitor
glow. No flow field for strokes (the treatment's "no flow field at all"); the flow only orders the edge chaining.

**Critique**
- The character reads as clean cel: neutral whites (no yellow cast), hard bands (no Ghibli-soft gradients), crisp lines.
- It leans on the plate already being anime: on a photographic plate this would need real segmentation. Material
  classification under coloured monitor light needed the hand-placed priors.
- Tone bands are absolute lightness cuts per material (`L` ranges, `cuts`): the monitor-lit face needed the skin range
  shifted down to get a proper base/shadow split. A per-material key (median lightness of the region) would be sturdier.
  The hair highlight band is barely visible.
- The soft background is close to the "blurred photo behind a sharp character" AI-anime tell; a painted background pass
  (flat shapes, hand-chosen palette) is the obvious next step (a k-means mode exists, `bgMode: 1`, but read as a posterise
  filter).
- Garbled text (the patch, the screens) is inherited from the plate and should be replaced by real type.

---

## Honest overall verdict

- BRONZE and CORONA are close to a usable production look; the eclipse parameter and the boil-without-strobe behaviour
  are the two things the film depends on and both work. MARBLE is a credible sketch, INK a competent cleanup filter.
- The four materials do cohere: they visibly share one field (BRONZE strokes and CORONA lines run the same way over the
  same shield; MARBLE's veins are that field turned ~30° so they cross the carving instead of tracing it).
- Not done: CORONA temporal coherence on real video, MARBLE's suspended arrows and birds, INK's painted background and
  hair highlight design, a GOLD pass, typography, tests on real Seedance plates (all frames here are stills).
