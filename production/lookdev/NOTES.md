# HALYS look-dev: one flow field, four materials

Every image here is drawn by JavaScript from **one analysis** of a stand-in plate (Nano Banana stills in
`media/lookdev/inputs/`, depth/matte/faces from `video/lab/analysis/prep.py`). The plate itself never appears: only
marks derived from its fields (structure-tensor flow, edges, tone, colour, matte, depth).

**Round 2** (director's notes, 3 Oct) is the current state. Every reviewed image was re-rendered; the round-1 version
of each sits beside it as `<name>_r1.jpg` / `_r1.mp4`, and `compare_r1_r2.jpg` shows them side by side.

| file | what |
|---|---|
| `a_duel_bronze.jpg` `b_face_bronze.jpg` `c_armies_bronze.jpg` | BRONZE stills (1920×1080, q90) |
| `bronze_eclipse_strip.jpg` | c_armies at eclipse = 0.05 / 0.50 / 0.80 / 0.95: one parameter drives bite, light and colour |
| `bronze_boil.mp4` | 2 s, 24 fps, drawn on twos (24 drawings), slow 4.5 % push-in over a_duel; between drawings the low-pass change is 1.6 grey levels vs 4.7 at stroke scale: boil, not strobe |
| `a_duel_corona.jpg` `c_armies_corona.jpg` | CORONA stills |
| `corona_flow.mp4` | 2 s on ones: ±11° depth orbit of a_duel, phase flow, a kick every beat (120 bpm): line-thickness pulse + radial push from the sun; the third beat is a 2-frame inversion (brass stab) |
| `corona_seedance.mp4` | **new**: CORONA on 48 consecutive frames of the Seedance test clip with flow-advected seeds (temporal coherence test), kicks at 0.5/1/1.5 s |
| `a_duel_marble.jpg` `b_face_marble.jpg` | MARBLE stills |
| `d_room_ink.jpg` | INK still |
| `sheet_<material>.jpg`, `compare_r1_r2.jpg` | contact sheets (plate beside render, with timings and machine load); round 1 vs round 2 |

## Pipeline (`video/lab/`)

```
plate (still or video frame) + offline depth / matte / faces   (analysis/prep.py; analysis/seedance_prep.py for video:
                                                                 per-frame depth (ViT-S), anime matte, Farneback flow)
  └─► src/analysis.js  ONE analysis at 960×540: colour, tone, gradient, structure tensor at three scales (flow = minor
                       eigenvector), coherence, thinned edges, detail, depth, matte, faces  (~0.4-0.6 s per frame)
        ├─► src/bronze.js  strokes laid along the flow        Baroque oil, tenebrism, Altdorfer sky, eclipse
        ├─► src/corona.js  contours + streamlines of the flow   field lines on navy-black, corona, 3D orbit, kicks
        ├─► src/marble.js  depth normals, veins warped by flow  polished marble at totality
        └─► src/ink.js     edges + tone bands + flat palette  clean anime cel
src/sky.js (shared sky mask), src/shots.js (per-shot design), src/gl.js (WebGL2), src/core.js (colour, palette box)
render.mjs drives lab.html in headless Chromium (playwright-core, WebGL2 on SwiftShader: CPU only)
```

```bash
cd video/lab
node render.mjs --still=a_duel:bronze,c_armies:corona            # → production/lookdev/<plate>_<material>.jpg (+ timings.jsonl)
node render.mjs --still=c_armies:bronze --set='{"eclipse":.8}' --tag=e80
node render.mjs --clip=bronze_boil | corona_flow | corona_seedance   # clips are defined in src/main.js (CLIPS)
node render.mjs --clip=corona_seedance --set='{"kick":0}'          # --set overrides material params in clips too
python3 analysis/seedance_prep.py                                   # per-frame analysis of the Seedance clip (CPU, ~8 min)
python3 tools/contact.py ; python3 tools/contact.py --compare=1      # sheets; round-1 vs round-2 comparison
```

Every frame is a pure function of (plate, camera, material, params, t), except CORONA's temporal mode, which carries
seed positions from frame to frame (the clip renders frames in order). Per-shot design (light pools, focus, sky, sun
and its altitude, eclipse fraction, material priors) is data in `src/shots.js`.

## Speed (1920×1080, headless Chromium, SwiftShader, 4 CPU cores, no GPU)

`timings.jsonl` logs every render with the machine's 1-minute load average (another agent's x265 encode ran for part of
the session, load ≈ 5-6). Numbers below are from an idle machine unless marked.

| material | per new frame | what dominates |
|---|---|---|
| BRONZE | **6.0-7.4 s per drawing** (analysis 0.4-0.5 s + render 5.5-7.0 s, load ≈ 2); on twos ≈ 3-3.7 s per output frame | strokes (CPU, incl. edge-preserving reference smooth) ~1.6 s, GPU raster + finish 2-3 s; 34k-82k strokes (round 1: 46k-116k) |
| CORONA | 1.6-1.9 s for a new plate frame (load 2); **≈0.45 s** for further frames over a held plate; **≈1.0 s/frame** on video with temporal seeds | line tracing 0.2-0.6 s, GPU 0.3-0.6 s |
| MARBLE | ≈3.0 s | fields (bilateral depth, LIC, sky) ~2.0 s, GPU ~0.5 s |
| INK | ≈4.4 s | bilateral smoothing + k-means + mode filter ~3.2 s (single-threaded JS) |

---

## BRONZE: Baroque oil, tenebrism, Altdorfer sky

**Round-2 changes (director's notes 1-5)**
1. *The sun is a blazing disk, not a record.* `SUN_FS` draws a flat disk: lead-white core going to Naples and then
   golden-orange at the limb, warmer the lower the sun (`sun.alt`, 9° for the Halys totality), pushed above lead white
   (`blaze` 1.45) so the varnish cannot dull it, with only faint broad brush marks (no rings). The glow is an irregular
   painted halo in the sky field plus 16 loose tangential strokes and 11 broken radial strokes (2-3 tapering pieces each)
   bleeding into the sky; they fade out by eclipse 0.75. The bite geometry is unchanged (exact circles).
2. *No cut-out outline.* The halo came from the plate (a backlit bright fringe on every silhouette) plus colour bleeding
   across the silhouette in the per-brush blur. Now: edge pixels that are brighter than 3.5 px inside the figure take the
   inside value (`fringe`); the reference is blurred separately per region (figure / sky / land) and strokes stop at
   region boundaries; a rim light is added only where the silhouette's normal faces the light (`lightDir`) and is broken
   up by noise (`rim`, `rimBreak`).
3. *Harder tenebrism.* The pool is brighter and warmer (gamma 0.9, lift 1.1, contrast 1.22, `warmIn`), falls off faster
   (`poolBlur` 4, `poolLo/Hi`), the environment inside the light is dimmer (`envDim` 0.62); the darks are a varied umber
   (`crushFloor` 0.15 + `darkVar`), and thin paint shows the canvas weave as texture, so they read as paint.
4. *Brush economy.* Bigger first brushes (26 px); the two smallest brushes only work on *structural* edges (edge ×
   coherence²) inside the light (`midGate`, `fineGate`); they paint from an edge-preserving smooth of the reference
   (`smoothRef`), so pores, stubble and hair strands are not copied stroke by stroke. Strokes land slightly narrow and
   lift off to a point, bristle tracks are stronger, colour is broken per stroke (`colorJit` 0.055 plus a temperature
   jitter), and strokes no longer smear toward their end colour (`endBlend` 0.15). Stroke counts fell 30-45 %.
   *Eyes* are painted with a few deliberate strokes anchored on the detected catchlight: one iris dab (colour = the most
   chromatic third of the plate's iris, intensified), a pupil, an upper-lid arc and a loaded lead-white catchlight.
5. *Impasto.* Thick lead-white / Naples dabs (`accentThick` 1.5) on specular peaks, bright metal edges (rims, crests,
   blade and spear edges) and the water's sparkle near the light, so highlights stand up in the relief lighting.

Unchanged from round 1: the palette box (ten tubes, no blue), the Altdorfer vortex sky entering as colour and tensor,
the Hertzmann coarse-to-fine painting, impasto/weave/craquelure/varnish finish, the eclipse parameter (bite, sharper
shadows, colour drain, metallic light), drawn on twos with plate-anchored seeds (boil, not strobe).

**Critique**
- b_face: much closer to Caravaggio: a hot, warm key on the face out of a deep umber dark; skin is now planes, not
  pores. The painted eyes read at full size but are subtle; the beard is still busy.
- a_duel: the cut-out outline is gone (rims only on the sunward side); the duel sits in a stronger pool. The large flat
  water at bottom left and the background soldiers are still weak; the Mede's face is small and soft.
- c_armies and the eclipse strip: the blazing sun works and the colour drain is intact. At eclipse 0.05 the loose glow
  strokes can still read as a broken ring of arcs; the far hills are better but not yet Altdorfer's decisive drawing.
- Still a filter at heart: composition, drawing errors and "painted decisions" come from the plate.

---

## CORONA: field lines on navy-black

**Round-2 changes (director's notes 1-5)**
1. *Hierarchy.* Three tiers: (a) the subject's matte contour and its coherent inner edges as bright, crisp, weighted,
   tapered lines (1.2-2.3 px contours, brighter and orange where they face the light; 0.75-1.25 px inner edges); (b) the
   interior as streamlines spaced by tone (2.2-7.5 px apart in light, nothing below the shadow cut); (c) a sparse, dim
   background (13-26 px apart, `bgGain` 0.3) and a lot of black. No more uniform zebra/maze over the whole frame.
2. *The corona as totality photography in lines:* a thin, intensely bright limb ring (+ a fainter second ring); five
   asymmetric helmet streamers (dense bright helmet loops at the base, 30 open lines per streamer converging into a stalk,
   frayed ends at 1.3-4.4 solar radii); fine polar plumes at both poles; 420 fibrils hugging the limb; faint outer rays;
   three tiny Hα-red prominences on the limb; pearl with a ~4 % warm tint; a perfectly crisp black disk (analytic, cut
   after the glow).
3. *Armies as structured light:* every figure is found as a local contrast peak inside the army mask and drawn as a
   crisp vertical spear tick (5-13 px by depth, slight random lean) with a bright tip point, in an unglowed pass; red
   where the plate's banners/tunics are red.
4. *Temporal coherence:* in temporal mode seeds keep stable IDs, are advected by dense optical flow (Farneback at
   480×270, `analysis/seedance_prep.py`) from the previous frame and re-traced first, in ID order; the fields that shape
   the lines are smoothed over time (EMA, `tAlpha` 0.45); new lines fade in over three frames. On the Seedance clip
   (kicks off): **line persistence frame to frame 0.963 vs 0.870** for naive per-frame tracing, mean absolute frame
   difference **2.84 vs 5.00** (−43 %). The 3D lift now uses depth smoothed separately inside/outside the subject with
   the subject's relief compressed to 25 % (`relief`), so the ±11° orbit turns figures as low reliefs instead of
   crumpling them.
5. *Kick response* (all parameters): `kick` 0..1 sharpens pulses into dashes and surges the light; `kickWidth` thickens
   lines (×2.2 at kick 1); `kickPush` pushes everything outward from the sun (26 px at kick 1); `invert` renders black
   lines on pearl (used for 2 frames in `corona_flow.mp4`).

**Critique**
- The c_armies corona is now the best thing in the frame: crisp disk, limb ring, plumes, prominences.
  The helmet loops still read slightly like petals (too regular), and the streamer stalks could run longer and fainter.
- The armies read as massed spears in light: much better than dots, but in dense blocks the ticks become a uniform
  hatch (no rank structure, no cavalry).
- a_duel: the silhouettes and rims now lead; interiors are calmer, but the wicker shield still traces a maze and the
  orbit shows 2.5D shear at the extremes.
- Temporal: lines no longer boil, but line ends still flicker a little when a line re-breaks (worst 5 % of frames:
  persistence 0.93); Farneback flow is noisy in flat anime regions. A production pass should keep whole lines (not only
  seeds) and fade their ends.

---

## MARBLE: polished marble at totality

**Round-2 changes (director's notes 1-4)**
1. *Carved form from depth.* Normals come from an edge-preserving (bilateral, never across the matte) smooth of the
   depth map; plate luminance enters only as a low-weight band-pass at the scale of carved features (1.4-6 px), weaker
   on the land; the matte is opened so hair strands vanish. Pores, stubble and strands are gone; the beard is masses.
2. *Material:* warm white; **a few** thin irregular veins (domain-warped bands running through the block, warped by
   turbulence and by the flow field's LIC texture, gated into zones, hairline to ~2.5 px with a soft grey bleed), so they
   cross the carving instead of tracing it like contour lines; crystalline grain (albedo grain plus tiny calcite
   sparkles in the light); a warm subsurface bleed past the terminator into the shadows; small, tight specular highlights.
3. *Light:* cool soft key from above (the corona); a warm orange rim only where the silhouette faces down/sideways
   (the horizon glow behind and below); a faint orange bounce on downward faces.
4. *Background:* aerial perspective measured relative to the subject's depth (the far land is veiled by night air),
   other statues' silhouettes catch a faint orange rim at depth edges (never along the hero's edge); the horizon glow is
   a two-scale soft gradient fading upward and no longer bleeds onto the land.

**Critique**
- b_face reads as a carved bust in a misty night, with ghostly standing figures behind: the topo-map lines are gone.
  The stone is still a little glossy on the cheek and helmet, and forms are soft because Depth-Anything's normals are
  blobby; the beard is massed, not truly carved into curls.
- a_duel: statues read as statues, but faces are blank blobs and the background figures do not resolve; the narrow sky
  band still reads as a stripe of glow.

---

## INK: clean anime cel (the room)

**Round-2 changes (optional notes):** the background is now flat painted shapes (k-means palette + a two-pass mode
filter on the label map: hard-edged flat washes, no added blur), with the screens keeping their content through an
emissive mask; the character is flat fills plus one shadow tone (highlight band off), a constant 2.4 px silhouette and
thinner 0.5-1.15 px interior lines.

**Critique:** the character is cleaner and more cel-like. The background is flat but blobby, because the stand-in plate's
background is optically blurred by the generator: a true painted anime background needs a plate generated with an
in-focus background (or a separate background plate). Garbled plate text (patch, screens) should be replaced with type.

---

## Honest overall verdict

- BRONZE and CORONA addressed every note; the sun, the outline, the tenebrism and the corona changed the most.
  CORONA's temporal coherence is measured, not just claimed, but it is not yet production-clean at line ends.
- MARBLE improved from resin-with-contour-lines to soft carved stone; it is still the weakest material.
- INK remains bound by its plate.
- Not done: GOLD, typography, a CORONA pass that keeps whole lines alive across frames, MARBLE's suspended arrows/birds.
