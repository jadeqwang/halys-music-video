# Drop 1 (S35-S45a) review notes: the line engine

Renders of `video/src/scenes/drop1.js` over the line engine `video/src/worlds/line/` (API: its README.md).
Frames: `video/out/frames_drop1/` (1920x1080@60, `nice -n 10 node render.mjs --frames=110.58:157.03 --workers=1 --dir=out/frames_drop1`).

## Files here

| file | what |
|---|---|
| `drop1_r5_108-126.mp4` | hand-off (S34, brush) -> the break -> stutter montage -> orbit -> Flammarion, with the song (720p review encode) |
| `drop1_r5_126-157.mp4` | agents -> eye + tilt -> the four chop cycles -> collapse -> S45 widening to the 157.03 hand-off |
| `drop1_r5_sheet.jpg` | contact sheet (46 frames); `drop1_r1_sheet.jpg` is the round-1 sheet the director's notes were written on |
| `temporal_P04_transport_vs_naive.mp4` | left: the temporal engine on plate P04 (references + flow transport + crossfade); right: naive per-frame tracing |
| `beatcheck.py` | measures cuts / inversions / kick pulses in rendered frames against timing.json |
| `contact.py`, `encode_review.sh`, `make_standins.py` | sheet, review encode, temporary stand-ins from plate takes |

## Plates used (round 5, 2026-10-03 08:00: every plate analysed, with mattes and depth)

Every Drop 1 shot runs on its real plate and chosen take, timed by PLATES.md's sync keys: S35 master P01 (static
master, its own sun at (0.508, 0.25)), IN THE P42 take 2 (plate 0.85 at the cut: arms up at 1.0, splash 1.3), SKY P44
(0.875: the rear at 0.92), SKY P43 take 2 (0.95: forehead to the stones at 1.1); S36 P42-P45 + P14 + P19 + P19b frozen at
the listed reaction times; S37 P46 take 4, 1:1 from 117.53 (its own ~30-degree arc + a little yaw from depth); S38 P24
retimed so the palm meets the membrane on the touch (124.92 -> plate 1.6, then 1:1); S39 formation 0 = P01's armies
(its ranked banks lifted onto the ground plane), S40 procedural; S41 P14 take 2 from plate 1.7 (eyes rise at 2.0, the
gaze runs to the end); S42 P04; S43 P05 + P06; S44 P01's static master; S45 P25 take 2 (hand-off at plate 3.2).
Stand-ins (`src/worlds/line/standins/`, 4.9 MB) are unused now (fallback only) and can be deleted.

## Beat sync (beatcheck.py over the rendered frames 108-156 s)

Round 1:
* shot cuts (SHOTLIST, 11): 11/11 on the event frame (picture 3-13 ms after the sound: the first frame at/after the event)
* S36 cut list (director's change: bar 65 every stutter onset, bars 66-67 every second: 18 cuts): 18/18 within 1 frame, 94 % on the frame
* S36 stab inversions (7): 7/7 start on the stab frame, all exactly 2 frames long
* kick pulses (brightness peak of the band above the type, 77 kicks away from cuts): 91 % peak on the kick frame
* S39 formation snaps: 4/6 jump on the snap frame; 128.80 and 130.97 jumped one frame AFTER the kick flash (the stab
  is 1-7 ms after the kick and crosses a frame boundary) -> round 2 snaps a stab within 12 ms of a kick onto the kick's frame.

## Temporal coherence (tools/temporal_test.mjs, plate P04, 60 master frames from 1.0 s)

| | mean abs frame diff (levels) | line persistence (mean) | worst frame | ms/frame (960x540, loaded machine) |
|---|---|---|---|---|
| temporal engine | **0.63** | **0.950** | **0.857** | 239 |
| naive per-frame tracing | 1.00 | 0.893 | 0.621 | 251 |

The naive version also only changes every 2.5 master frames (24 fps plate): it steps; the temporal engine moves on every
master frame (sub-frame flow transport) and line ends fade over a reference interval instead of popping.

## Round 1 critique (contact sheet drop1_r1_sheet.jpg)

* S35: the pupil collapsing into the sun with the world igniting outside it works; the tick wave is subtle at full frame.
  Reaction cuts read; the busiest action sits above/below the word block.
* S36: reactions read as figures in light; the SKY stutter word owns the centre band (type layer).
* S37: reads as a line drawing turning in 3D, but too dim and empty around the figures.
* S38: membrane, palm and the machinery revealed above the fingertips read; the membrane is a regular grid.
* S39/S40: **too faint**: the formations barely registered (thin sharp dots, no glow). Tilt and the corona rising over
  the horizon with the ground eye below work; the anime eye frames read.
* S41-S44: ring centre-locked, backgrounds per cycle; busy behind the word; the collapse to a point works.
* S45: widening reads; strokes still soft.

## Round 2 (S37, S39-S40 re-rendered)

* Agents: heads are glowing points (3.4 px, x2.6 brightness) with glowing trails; the formations read as a drone show:
  mirrored orange (Lydian) / pearl (Median) blocks, banks, flows, a rosette vortex (counter-rotating log spirals),
  rings, an iris; the S40 eye (almond lids from a third of the agents) and the tilt to the corona over the horizon.
* S39 snaps: a stab within 12 ms of a kick now lands on the kick's frame.
* S37 brighter (subject 0.38-1.05, contours 1.8, more background).
* S35 corona radius 0.028 W.

## Round 3 (the landed plates)

* P42/P44/P01 arrived mid-session without mattes/depth: first render of the reaction cuts was black (the figures were
  "background" and the horizon cap made their upper bodies "sky"). Fixed in the engine: no matte -> subject from local
  detail; the sky never takes detailed regions; image-edge outlines for the reaction trace.
* Stand-in-only geometry (F2's river polygon, army masks, horizon) moved to `standinTrace`, so it never lands on P01;
  the generic master settings (depth/horizon sky, bank light pools for the spear ticks, sun at the vanishing point)
  work on P01, which matches the board's composition (river to the low sun at (0.5, 0.35)).
* S38 on P24 (a soldier from behind, hand raised against the dusk): the contact is found from the matte (fingertips),
  the tear opens into the open sky beside the hand; the membrane bends around the press point (no void).
* S41: P14's face sits at the top of its plate; the window extends past the plate (black) so he looks up at the ring.
* S44: P01 from its first frame at 0.18 speed (the composition barely drifts; the plate itself dives into the melee).

## Round 4 (final: S35-S37, S41, S45 on the real plates)

* S35/S36 pass `f.type.sun` (the drop's eclipse position) so the CHOP fill radiates from the corona (type NOTES request).
* S45: wider, crisper strokes at the hand-off (width x5.6, glow off, no softening).

## Round 5 (director's notes on drop1_r1_sheet; every plate analysed with mattes and depth)

Rendered 110.58-157.03 once (`--workers=1`, `nice -n 10`): 2787 frames in 1472 s = **0.53 s per frame** effective
(engine + type layer + JPEG, load 6-8); S39-S40 re-rendered after the snap fix, 829 frames in 209 s (0.25 s/frame).

1. **S36 reactions read.** 19 segments; Lydian and Median reactions alternate 9 : 9 plus one shot with both (the rearing
   Lydian horse and the Mede calming his); the shot scale changes on every cut (CU face -> MS kneeling -> XCU eye -> wide
   rear -> MS amulet -> CU -> wide prostration -> ...), the wides on the longer segments; each framed with the face or
   gesture in the centre-to-upper area, and its box goes to the type layer as `f.type.avoid` (the hollow stutter SKY
   takes the clear third). Close-ups use a sparser face trace (FACE_TRACE).
2. **Agents.** Every agent was being drawn at x0.23 size (the top-down camera's depth scaled the widths: sub-pixel
   points): that, not the count, made them faint. Now 2 x 2600 crisp points with tiny spear ticks along their facing
   (sharp: they never bloom), formation 0 = P01's armies lifted to the ground plane, hard snaps (0.16 s, overshoot) whose
   first frame is the stab's frame, half-frame trails only while flying, particle bands instead of lattices, bold outlines
   for the ring and the eye.
3. **Hierarchy.** Corona brightest (ring layer 1.25 vs plate 0.5 behind the CHOP words; corona gain up); fewer, brighter
   subject lines (steeper tone curve, wider spacing); sparse dim backgrounds; the sky field thins with distance; behind
   the giant words the faces are contours plus a few lit lines (CHOP_TRACE); S38's membrane thinned and the machinery
   dimmed so it supports the hand.
4. **S35** per chop on the real plates: HALO P01 (eclipse on the plate's own sun), IN THE P42, SKY P44, SKY P43.

Engine changes behind it: subject exposure (`analysis.autoGain`: the matte region's p90 -> 0.85; the per-take gain left
P44, P05/P06, P24 dim); matte contours from the matte's 0.5 iso-line (soft half-resolution mattes seen through a zoomed
window lost most of their silhouette to the old gradient threshold) without the plate's padded edge;
`contourFloor` / `contourToneK`.

Beat sync (beatcheck.py, 108-156 s, final frames):
* shot cuts 11/11 on the event frame; S36 cut list 18/18 within 1 frame (94 % on it)
* S36 stab inversions 7/7 on the stab frame, all 2 frames long
* S39 formation snaps 6/6: the flight starts on the stab frame (diff 21-56x median there, 0.1-1x on the frame before)
* kick pulses (77 kicks): 96 % peak on the kick frame, 97 % within one frame

Critique: close-up faces still read as engraved flow lines (the features are not drawn as crisply as the silhouettes);
P19b (the Mede's eye) has no usable matte, so that XCU is texture without a contour; S38's tear opens beside the hand,
because P24 is a reach, not a push-through; S44's spear ticks are busy behind HALO; the first snap (P01 positions ->
blocks) is a long flight, so it streaks more than the others.
