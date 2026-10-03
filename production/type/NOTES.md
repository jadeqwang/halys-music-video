# HALYS: the kinetic type system

Every on-screen word, caption, card and HUD element in the film is drawn by `video/src/type/`, over whatever the scene
drew, from a text track built from `production/SHOTLIST.md` and `video/data/timing.json`. Strings are never typed by
hand: the builder takes each one from the shot list by exact match and fails if a cue is missing, unused or doubled.

Look in this folder first:

| file | what |
|---|---|
| `contact_16x9.jpg`, `contact_4x5.jpg` | every text event at its key frame (61 frames), 1920×1080 and 1080×1350, over dark stand-ins |
| `test_00.0-10.0s_hook_title.mp4` | the hook (date, three carved lines, the rewind) and the Altdorfer cartouche title, with the song |
| `test_85.5-97.0s_strange_halo_eye.mp4` | EXCHANGE- / -ING, the letters eclipsed to crescents, A HALO IN THE SKY on its circle, the pupil |
| `test_110.4-118.0s_halo_hal_sky_stutter.mp4` | LOVE backlit, the counter at 00:00, HALO with the HAL frames, IN THE, SKY, SKY, the stutter and inversions, the Glover caption, the HUD |
| `test_140.0-147.0s_chop_cycle.mp4` | chop cycles 1–2 with the ring locked centre |

The backgrounds in the sheets and tests are **stand-ins** (the look-dev stills, graded dark, plus a crude eclipse/pupil
where an effect needs one). The tests and sheets come from the real harness page (`studio.html` → `renderFrame`), so
the frames are what the film will draw. The only difference is a `typebg` URL flag that `render.mjs` never sets.

---

## 1. Files

```
video/src/type/
  index.js        API: drawText(t, f), eventsAt, invertAt, counterAt; registers the 'type-layer' scene
  effects.js      one renderer per fx (carved, plaque, inscr, incised, counter, hud, chop, quote, map, diptych, mirrored,
                  bronze, crescents, ring, pupil, shadow, thales, forecast, spark, era, home, endcard, cartouche, terminal)
  gild.js         CARVED gold leaf: glyph masks -> edge / chisel-height / shadow fields -> WebGL2 lit shader
  chop.js         CHOP: Archivo 900 at width 125, corona streamers in the letters, orange rim, slam, echo, HAL disk
  cartouche.js    the Altdorfer hanging tablet (painted slab, cord, tassel, incised gilded lettering, sway)
  terminal.js     the room's terminal and side panes (ROOM.md + FACTCHECK.md), procedural glyphs, quad warp
  style.js        faces, palette, light presets, kerning-aware layout, balanced line breaking, anchors
  tgl.js          the type layer's own WebGL2 context (one canvas, resized per block)
  standin.js      test scaffolding only (loaded with ?typebg): stand-in backgrounds + scene parameters
  track.gen.js    GENERATED text track (the page imports this copy: render.mjs hashes src/ for stale frames)
video/data/texttrack.json   the same track, for tools
tools/type/
  build_track.py  SHOTLIST.md + timing.json (+ ROOM/FACTCHECK terminal) -> texttrack.json + track.gen.js; reading report
  typetest.mjs    look-dev driver: stills or frame ranges + song -> MP4, through the real harness page, with ?typebg
  sheets.py       both contact sheets (key frames, labels from the track)
  contact.py      tiles stills into a labelled sheet
```

The one edit outside these: `video/src/main.js` imports `drawText` and calls it once per frame, right after the
scene draws, with the scene's own frame context:

```js
const fc = buildContext(fi);
await SCENES.get(fi.shot.scene).draw(fc);
resetCtx(g);
await drawText(fc.t, fc); resetCtx(g);     // type layer (src/type/): every word, over the scene; scenes steer it via fc.type
```

**The placeholder's own cue text.** `scenes/placeholder.js` prints stand-in cue text. The type layer replaces it: the
`type-layer` scene's `init` (run once at boot, after `edit.js`) moves `params.cues` aside to `params.typeCues` on shots
that still use the placeholder, so there is never a second copy of the text. Real scenes are untouched.

---

## 2. API

```js
import { drawText, eventsAt, invertAt, counterAt } from '../type/index.js';
await drawText(t, f)        // main.js does this; a scene that sets f.type.manual = true calls it itself, e.g. under a foreground
eventsAt(t)                 // active events [{id, fx, shot, t0, t1, items:[{key, role, text, t, words:[{w, t, e}]}], ...}]
invertAt(t)                 // true on S36's two-frame inversions: invert the picture on the same frames
f.drawScene('type-layer')   // the type alone, onto any 2D context (for a scene that composites it itself)
```

A scene steers the type by setting fields on its frame context before it returns. Every field is optional, and
anything missing falls back to the track's defaults (which is how the sheets were made).

| `f.type.` | used by | meaning (px are output canvas pixels) |
|---|---|---|
| `light = {dir:[x,y], elev, color, intensity, cool}` | all CARVED | `dir` points **toward** the light (screen, y down, same as the look-dev `lightDir`); `elev` 0..1 is the sine of the elevation (0.42 = raking); `cool` 0..1 swaps gold for the cooler leaf seen under corona light |
| `sun = {x, y, r}` | S28 ring, all CHOP | the eclipse disk. S28's legend runs at 2.75 r around it. CHOP streamers radiate from its centre and stop at its limb |
| `field = {center:[x,y], r}` | CHOP | overrides `sun` for the streamers only |
| `pupil = {x, y, r}` | S29 | the lines are fitted to the circle's chords |
| `front = {p}` or `{y}` | S30, S58 | the shadow front across the type block: `p` 0..1 progress, or `y` the front's screen y |
| `disk = {k, hal}` | S27, S35 | `k` 0..1 forces the crescent pass; `hal: false` suppresses the HAL frames |
| `magnitude` | counter | eclipse magnitude 0..1; the counter then reads `55:28 × (1 − m)` (keeps it in step with the bite) |
| `flash`, `backlit` | CARVED | 0..1: exposure boost (the diamond-ring flash) / letters to silhouettes with a rim (S34's white-out) |
| `invert`, `kick` | CHOP | force an inversion frame / the kick pulse (default: `invertAt` and the beat grid) |
| `screen = {main:[TL,TR,BR,BL], side:[...]}` | S78–S80 | monitor quads (projective warp); rows follow the quad's aspect |
| `plinth = {x, y, w, h, draw}` | S49 | the plinth's front face (x is its centre; fractions of the frame); `draw: false` when the scene paints the stone |
| `place = {[eventId]: {x, y, align, valign, maxW, size}}` | CARVED/PLAQUE | layout override (fractions of the frame; `size` in design px) |
| `hide = [eventId]`, `manual` | all | skip events / skip the main.js call |

---

## 3. The track

`python3 tools/type/build_track.py` (or `--check`). Run it after any SHOTLIST or timing change. It does the following:

* re-parses SHOTLIST.md with `tools/shotlist.parse()` (the checked-in `video/data/shotlist.json` is stale: it still has
  the pre-FACTCHECK S12/S16/S64/S66/S68/S70/S81 strings; re-run `python3 tools/shotlist.py` for the harness);
* applies the `DESIGN` table: which renderer, anchor, holds across cuts, beats for unsung labels, effect parameters;
* matches every sung word to its onset in `timing.json`: the longest consecutive run of lyric words nearest the shot;
* refines chop times to the measured onsets when SHOTLIST's two-decimal time is the same event (within 20 ms);
* takes S36's stutter onsets from `chops[word=stutter]` inside the shot and S78's ticks from `events.snares`;
* builds the terminal timeline from ROOM.md, using FACTCHECK.md's corrected lines where the two differ;
* fails if any SHOTLIST cue is unplaced or doubled; prints characters per second for every item.

Event schema: `{id, fx, shot, t0, t1, world, items: [{key, role, text, t, reveal: words|line|none, words: [{w, t, e}]}],
anchor, ...fx params}`. Bookkeeping items (`ghost: true`) are cues another event renders (S34's `LOVE`, S18's `00:00`).

---

## 4. Roles and how they are drawn

**CARVED** (`gild.js`). Cinzel 600, tracked +0.10 em. The glyph mask is rendered once per block into three fields:
* an edge field (the letterform);
* a chisel height from an exact Euclidean distance transform. Inside distance divided by about 0.06 em gives every
  stroke a V-section with a ridge, like a cut and gilded inscription, not a pillow emboss;
* a soft field for the cast shadow.

The shader lights the chisel normals with the scene's light. A gold ramp runs from umber (facing away) to pale highlight
(facing it), plus a burnished specular, broken into staggered leaf squares with faint seams. The leaf pattern is seeded
per event, so it never changes. The shadow is cast away from the light, longer the lower the light.
* *Boil*: on 12 fps drawings a sub-pixel warp at letter scale plus edge roughness, both seeded per drawing (`f.seed`).
  Consecutive drawings differ by 2–3 grey levels on average, all at the edges: the letters live, they do not strobe.
  MARBLE (30) and the 60 fps worlds do not boil.
* *Gild-in*: a word appears on the drawing that contains its sung onset (up to one 12 fps drawing early, the 2–4 frame
  lead subtitle practice asks for). A slanted glint frontier crosses it in 0.2–0.4 s, then it holds.
* *Incised* (the cartouche, S49): the same field cut in, a V-groove. The wall nearest the light shades the groove, and
  deeper is darker. Stone palette for the plinth.

**PLAQUE**: Cinzel 500 tracked +0.16 em in bone (pearl in the light worlds), with a soft dark underlay for legibility.
Glyphs fade in left to right over about 0.3 s, and lower-left labels get a hairline rule. Cinzel's lowercase are small
capitals, so the mixed-case Glover caption sets as caps and small caps.

**CHOP** (`chop.js`). Archivo 900 at width 125, one word across the safe width. Multi-word chops (THROW DOWN) stack
when one line would be smaller than 20 % of the frame height.
* The fill is the corona's streamers: radial lines from the eclipse centre. They split by octaves, so the spacing stays
  between about 6.3 and 12.6 px (at 1080), and they stop at the Moon's limb, so the black disk shows through the letters. Pearl
  `#f3efe6` on navy-black, with a crisp signal-orange `#f08a2a` rim. Brightness varies with angle like real streamers,
  and a pulse runs outward on each beat.
* Slam: 1.16 → 1.05 → 1.01 → 1.0 over the first three frames, with a fading orange outline echo.
* Stutter (S36): on each of the 31 onsets inside the shot, a 1.075 re-slam, a small jump from a fixed pattern, and the
  two previous positions as fading outlines.
* Inversion: pearl fill and navy lines for two frames on the seven stabs.
* HAL: on frames 0–3 of the first HALO, a true-black disk the width of the O, with a thin pearl limb.

**INSCR**: Cormorant Garamond italic 500 in warm white. 16:9 at 7.2 % of frame height (cap height 4.5 %); portrait by
width, 7.8 % of it (4:5: 6.2 % of the height, cap 3.9 %; 9:16 stays the same size, not a third larger). One or two
balanced lines in the lower third (three in 9:16), each word fading in on its onset.

**MONO**: JetBrains Mono. HUD top-left (`C2 · TOTALITY · 00:00:07` counting real seconds since 110.58). The terminal
(below). The forecast card: a generic hard-edged panel, 1 px pearl rule, zero radius, orange price line, no market's
look, no logo.

---

## 5. The special effects

| event | what it does | scene parameters | default when the scene passes nothing |
|---|---|---|---|
| S05, S24 cartouche | painted tablet hangs on a cord from above the frame; slab thickness, brushwork, craquelure, fillet, iron ring, tasselled pendant. HALYS / JADE WANG on cue; S24 is lowered in (1.1 s, settling bounce), its words gilding on the sung onsets | `light` | 16:9 top centre (34 % / 50 % of the width); portrait 80 % / 90 % |
| S06 map | LYDIA / MEDIA laid flat on the banks (squashed, leaning to the vanishing point), outline engraved in, then gilded, on beats 1–2; sub-labels beat 3; foot label beat 4; slow drift with the descent | `light` | 16:9 centred on each bank; portrait side-aligned and staggered in depth |
| S09 / S22 / S43 divider | gilded moulding down the centre (portrait: across); S09 splits open 23.33–24.63 with the swell; captions under each panel; S43 in pearl and orange lines | — | frame centre |
| S18–S34 counter | `TOTALITY IN 55:28` engraved small caps (tabular digits), holds 0.86 s, then follows the eclipse magnitude to `00:00` at 110.40, held to the cut | `magnitude` | magnitude keys from SHOTLIST (S24 ≈ 30 % of the disk, S27 0.8, S28 0.9–0.95) |
| S25 mirrored | LYDIANS left / MEDES right at equal size, SLEW EACH OTHER ON THE SHORE across the bottom | — | — |
| S26 bronze | SUN BURNING ON THE / BRONZE (half the frame wide) / EXCHANGE-, a strong glint on 84.38, then a slower second glint while held | `light` | — |
| S27 crescents | on "strange" a disk passes right to left over every letter and stops at 0.8 coverage, leaving gold crescents on dark silhouettes; the gold drains toward cool metal | `disk.k` | — |
| S28 ring | coin legend around the sun: A HALO IN THE SKY clockwise over the top, WARRIORS AWED counter-clockwise along the bottom, letter by letter on the sung onsets | `sun` | sun at (0.63, 0.45) r = 0.1 H (portrait (0.5, 0.36) r = 0.11 W) |
| S29 pupil | lines fitted to the pupil's chords (best of all 2–4-line breaks), pale cool light from the reflected crescent | `pupil` | (0.5, 0.47) r = 0.22 H |
| S30 shadow | the umbra edge comes down through the letters: gold to silhouette with a warm rim on the edge still facing the light | `front` | 98.62 → 99.75 |
| S33/S34 LOVE | the line spans the cut; on "love" the other words burn out; LOVE goes backlit as the bead whites out | `backlit`, `flash` | backlit 110.20 → 110.50 |
| S57 spark | white-hot burst with three fine gilt ripples racing out, cooling to gold, then fading as gold dust lifts off | `light` | — |
| S58 shadow (rise) | each letter sits low and dark until the light reaches it, then rises 0.13 em into gold | `front` | 200.55 → 203.45 |
| S49 incised | inscription cut into the plinth face | `plinth` | a marble block running out of the bottom of frame |
| S52 Thales | THALES on its onset; ΘΑΛΗΣ (Cardo 700, half size) gilds in on the next downbeat as an echo; THALES OF MILETUS plaque one beat later | `light` | — |
| S53 card | 186.40–187.65: the question, YES ticking 3¢ → 99¢ in steps from 186.55, NO falling, the price line jumping | — | top right (portrait top) |
| S64–S71 eras | year / place (orange) / fact, staggered 0, 0.16, 0.3 s; the earlier years stacked dim above on a hairline timeline | — | lower left |
| S78–S80 terminal | one line per tick (14 ticks 266.12–269.62); spinner cycling while newest; commit typed in bursts on the ticks and the three key clicks; output on the third; cursor blinking | `screen` | two rectangles (16:9 left/right; portrait top/bottom) |
| S81 end card | HALYS gilds in 277.60, JADE WANG 277.85, the NEXT TOTALITY plaque 278.10, to 281.0 | — | — |

---

## 6. Per-aspect rules

* Sizes are design px at 1080 on the short side × `L.u`, then fitted to the safe area (`L.safe`: 90 % × 86 % of the frame
  in landscape, 86 % × 90 % in portrait). Nothing leaves the safe area except the one-frame slam overshoot.
* 16:9 anchors follow SHOTLIST/TREATMENT: verse and chorus CARVED lines sit big in the left half (≤ 47 % of the width,
  centred on 0.6 H) with the figures composed right. Mirrored and two-shot frames centre at the bottom. Plaques are
  museum labels lower left. INSCR sits in the lower third. The counter is top right, the HUD top left.
* Portrait (4:5 and 9:16 share it) keeps the anchors but moves the text above or below the subject: CARVED lines centre
  in the lower third; the cartouche hangs from the top, clear of the counter; diptychs stack with a horizontal divider;
  S06's labels hug their own bank, staggered in depth; chops stack sooner.
* Holds across cuts: a line keeps its layout when a sentence spans a cut. That covers S01→S02, the S33→S34 LOVE line,
  S51 "chill" (sung 0.11 s before the cut, held to 182.30) and S62 "LOVE" (sung 0.23 s before Drop 2, held 0.9 s into
  S63 and fading).

---

## 7. What in the shot list's text does not quite work

Characters per second, measured from first appearance to exit (target ≤ 15):

| event | chars | window | cps | note |
|---|---|---|---|---|
| S35 Glover caption | 75 | 110.58–113.50 | **25.7** | needs ≈ 5 s, or a shorter credit (`"We just went sci-fi." — V. Glover, Artemis II` = 46 chars). It also competes with the four slams |
| S53 forecast question | 50 | 186.40–187.65 | **40** | inherent to a ≤ 1.3 s card: a pause-frame easter egg, unreadable in real time |
| S64 Antikythera | 65 | 3.4 s | **19.1** | the stacked year / place / fact layout reads faster than one line, but it is long; e.g. `… · A BRONZE ECLIPSE COMPUTER` (55 chars, 16 cps), keeping FACTCHECK's date |
| S66 1919 | 63 | 3.4 s | **18.6** | two sentences in the fact; `1919 · PRÍNCIPE & SOBRAL · EINSTEIN WAS RIGHT` (44 chars, 13 cps) |
| S67 Concorde | 54 | 3.4 s | **15.9** | borderline |
| S81 end-card plaque | 47 | 278.10–281.0 | **16.2** | borderline; needs the film to run to 281.0 (the padded master does) |

Other text issues:
* **Glover "we" / "We"**: SHOTLIST has lowercase `"we just went sci-fi."`. FACTCHECK says the capital W is verbatim and
  lowercase only works as a fragment, which would need a leading ellipsis. The track renders SHOTLIST exactly (small
  caps); change the string if the FACTCHECK form is wanted.
* **Lines sung before their cut**: S53 `FORETOLD THE SUN` is sung 183.34–185.06, so three words appear together at the
  184.64 cut. S62 `HOME` is sung 211.44, before the 211.88 cut. Both catch up on the cut.
* **S36 says 34 stutter onsets**: timing.json has 31 inside 112.31–117.53 (the other three fall after the cut, in S37).
  The 31 are used.
* **Era captions**: the table's Text column has no role (the parser calls them CARVED); the header says PLAQUE, which
  is what is used. The ` · ` separators become line breaks in the stacked year / place / fact layout; spelling is
  untouched.
* **ROOM.md vs FACTCHECK.md**: ROOM.md still has the old `--cal=julian` position, `totality over battlefield` and
  `[sun] magnitude 1.000 · alt 8.9°`. The terminal uses FACTCHECK's corrected lines (`totality at halys bend`,
  `[sun] obscuration 100% · alt 8.8°`).
* **Typography only, not spelling**: straight quotes are set as typographic quotes. The side panes word-wrap with a
  hanging indent; the main pane hard-wraps at 92 columns like a real terminal.
* **Collisions to watch** once the real scenes land: the counter (top right) against anything tall on the right in
  S24–S34, the S53 card against Thales's construction lines, and S35's caption under the slams. In S35/S36 the scene
  should pass `f.type.sun` (the real drop-1 corona sits upper centre); otherwise the streamers radiate from frame centre.

---

## 8. Tools, tests, performance

```bash
python3 tools/type/build_track.py                                       # after any SHOTLIST/timing change
node tools/type/typetest.mjs --stills=S05+1.2,110.67 [--size=1080x1350] # stills over the stand-ins
node tools/type/typetest.mjs --frames=110.4:118 --mp4=production/type/x.mp4   # frames + song -> MP4
python3 tools/type/sheets.py                                            # both contact sheets
node video/render.mjs --stills=110.67                                   # the film path: type over the real scenes
```

Measured cost of the type layer on whole frames (draw + JPEG, 1920×1080, SwiftShader, one page, warm caches):
CARVED drawings 40–110 ms (the cartouche ≈ 85 ms with its tablet; masks and distance fields are cached per block);
CHOP frames 30–180 ms (one word-sized shader pass plus its readback; S36's stutter with echoes is the worst case);
plaques, INSCR, HUD and the terminal 2–40 ms. At 12 fps the type is drawn once per held drawing, so Act I adds about
10 ms per output frame. Drop 1's chop shots are the expensive part: about 1,300 frames × 0.1–0.2 s.

Verified over the real WIP scenes through `render.mjs` (the S05 brush engine, the S35 drop-1 corona, placeholder shots,
the room): no interference. **Determinism** (frames must not depend on which worker drew what before): 29 type-only
frames and 8 full frames hash identically rendered in order, in reverse and each in a fresh page. Three bugs found
on the way, all fixed:
* the first gild after page load drew nothing until `tgl.texture()` selected the texture unit before creating a texture;
* a reused label canvas, only partly cleared, could bleed stale pixels through filtered `drawImage` (now sized
  exactly per label);
* every scratch 2D canvas is software-backed (`willReadFrequently`), so Chromium cannot pick GPU or CPU raster for it
  by its size at first use.
