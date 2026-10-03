# Drop 1 (S35-S45a) review notes: the line engine

Renders of `video/src/scenes/drop1.js` over the line engine `video/src/worlds/line/` (API: its README.md).
Frames: `video/out/frames_drop1/` (1920x1080@60, `node render.mjs --frames=108:156 --workers=3 --dir=out/frames_drop1`).

## Files here

| file | what |
|---|---|
| `drop1_r<N>_108-126.mp4` | hand-off (S34, brush) -> the break -> stutter montage -> orbit -> Flammarion, with the song (720p review encode) |
| `drop1_r<N>_126-156.mp4` | agents -> eye + tilt -> the four chop cycles -> collapse -> S45 widening |
| `drop1_r<N>_sheet.jpg` | contact sheet (44 frames) |
| `temporal_P04_transport_vs_naive.mp4` | left: the temporal engine on plate P04 (references + flow transport + crossfade); right: naive per-frame tracing |
| `beatcheck.py` | measures cuts / inversions / kick pulses in rendered frames against timing.json |
| `contact.py`, `encode_review.sh`, `make_standins.py` | sheet, review encode, temporary stand-ins from plate takes |

## Plates used (final round, 2026-10-03 04:40)

Every Drop 1 plate had landed by the final round and the resolver switched to it by itself: P01 (S35 master, S44),
P04 (S42), P05+P06 (S43 diptych, two plate layers), P14 (S36, S41), P19 (S36 eye), P24 (S38), P25 (S45), P42-P45
(S35 reaction cuts, S36 montage), P46 (S37 tableau, its own orbit). Most arrived WITHOUT mattes/depth yet (P01, P25,
P42-P46): the engine falls back to a detail-based subject and keeps detailed regions out of the sky; contours come from
image edges, so those shots are softer than they will be once the plate unit adds mattes/depth (picked up automatically).
Stand-ins (`src/worlds/line/standins/`, 4.9 MB) are now only a fallback and can be deleted.

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
