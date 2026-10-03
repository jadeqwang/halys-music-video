# HALYS: reference plates (Seedance 2.5)

The motion reference the JavaScript renderer redraws. Plates are never shown: composition, motion, figure clarity and timing
come from them, so every take was reviewed against its shot before it was chosen. Specs: `tools/plate_specs.py` (P01–P41, plus
P19b and the P22a/P22b pair; first-pass prompts kept as `prompt_v1` where a retake changed them). Per-plate verdicts:
`media/plates/<id>/review.json`. Shot purposes and times: `production/SHOTLIST.md`.

> Status (2026-10-03 02:41): 42 plates delivered, 72 paid takes this pass (720p, 16:9, 24 fps, 393 s of video),
> **$90.86** (genlog estimate at $0.2312/s; 3 real-person-filter rejections cost nothing). Chosen takes run through the
> analysis pipeline into `video/plates/<id>/` and `video/plates/index.json` (`take` = the chosen file).

## How to use a plate

* **Files.** `media/plates/<id>/take<N>.mp4` (gitignored, 1280×720, 24 fps, no audio), `take<N>.json` (exact request and spec),
  `take<N>.sheet.jpg` (8 frames), `take<N>.review.jpg` (motion curve + frames at the musical hits), `take<N>.motion.json` (curves),
  `audio_*.mp3` (the reference slice). Analysis of the chosen take: `video/plates/<id>/frames` (960×540 @ 24), `maps/` (g/o/v fields,
  depth `d*` on odd frames), `masks/` (mattes on odd frames), `meta.json`, `fields.json`, `stats.json`.
* **Plate time.** Each plate's audio reference is the song cut at `t0` with the plate's own length, so the reference clock is
  `plate_t = song_t − t0`. Seedance follows that clock only loosely (measured: actions land 0–1.4 s off, mostly late), so every
  action plate below lists **sync keys** `song_t → plate_t` measured on the chosen take (frame inspection backed by the optical-flow
  curve). Retime piecewise-linearly between keys and hold the last offset outside them; a plate with no keys runs 1:1 from `t0`.
  Offsets are reported, not "fixed": the renderer owns the retiming.
* **Motion measure** (`media/plates/review_motion.py ID[:take] [--faces]`): DIS optical flow on 320×180 frames; `local` = flow
  magnitude minus the median (camera) flow. A hit (impact, slam, release) is the sharp stop after a `local` peak.
* **Mattes.** Photoreal plates use rembg `isnet-general-use` (the matte tool's own advice; `tools/pipeline.sh` defaults to
  `isnet-anime`), the singer plates P39–P41 `isnet-anime`. Same steps and order as `tools/pipeline.sh --all`, run per chosen take.

## What Seedance 2.5 did with these prompts (read before re-generating)

* **Every photoreal identity sheet trips the real-person filter** (`InputImageSensitiveContentDetected.PrivacyInformation`,
  rejected at input, free). The `use_virtual_avatar` route accepts them and keeps face and costume; specs now default to it.
* **A set board in the references acts like a first frame.** P01 opened exactly on `halys_wide3` (parade ranks, no battle) in
  both takes; `halys_shallows_b` (sun in frame) turned side-lit duels into contre-jour and put figures on its dry gravel bar.
  Retakes drop the board where it fought the brief.
* **Timing cues land late and loose** ("at 2.9 s …" → 0.3–1.4 s late). Big simultaneous actions (P20's faces-up, P10's loose)
  can land within 0.1 s of a drum hit in the audio reference.
* **Totality plates draw a black sun with a corona** even when asked for an empty sky (copied from the totality board or
  invented); the renderer paints its own eclipse over it. Dusk plates are dim but analysable (exposure gain in `stats.json`).
* **Two-shot plates with a requested hard cut work** (P11, P15, P32 cut within 0.1–0.6 s of the asked time).
* No stirrups, flags, logos or modern objects appeared in any chosen take; the Median sword sits on the right where visible.

## Weak spots to know about

* **P02** (take 1, pass 3): Land dim (mean 0.12); a black sun + corona is drawn in the sky (renderer paints over); faces-up not readable at army scale.
* **P12** (take 1, pass 3): Contre-jour (sun in frame), faces in shadow; strikes ~0.1-0.8 s late.
* **P18** (take 2, pass 3): 2 Lydians : 4 Medes (not alternating); wave ~1.4 s late.

## Spend (this pass)

| Plate | Takes | USD |
|---|---|---|
| P01 | 2 | 6.94 |
| P02 | 1 | 1.85 |
| P03 | 1 | 1.16 |
| P04 | 1 | 1.16 |
| P05 | 1 | 1.39 |
| P06 | 1 | 1.39 |
| P07 | 2 | 2.31 |
| P08 | 1 | 1.16 |
| P09 | 3 | 3.47 |
| P10 | 1 | 1.16 |
| P11 | 1 | 1.16 |
| P12 | 2 | 3.70 |
| P13 | 2 | 2.31 |
| P14 | 2 | 2.31 |
| P15 | 2 | 3.24 |
| P16 | 1 | 1.16 |
| P17 | 1 | 0.92 |
| P18 | 2 | 1.85 |
| P19 | 1 | 0.92 |
| P19b | 1 | 0.92 |
| P20 | 1 | 0.92 |
| P21 | 3 | 2.77 |
| P22a | 1 | 0.92 |
| P22b | 1 | 0.92 |
| P23 | 2 | 1.85 |
| P24 | 1 | 0.92 |
| P25 | 2 | 4.62 |
| P26 | 1 | 0.92 |
| P27 | 4 | 3.70 |
| P28 | 2 | 2.31 |
| P29 | 2 | 4.16 |
| P30 | 1 | 0.92 |
| P31 | 1 | 0.92 |
| P32 | 2 | 2.31 |
| P33 | 1 | 0.92 |
| P34 | 2 | 3.24 |
| P35 | 3 | 2.77 |
| P36 | 1 | 0.92 |
| P37 | 1 | 0.92 |
| P38 | 4 | 4.62 |
| P39 | 1 | 0.92 |
| P40 | 2 | 2.31 |
| P41 | 4 | 5.55 |
| **total** | **72** | **90.86** |

## Plate table

| Plate | Shots | Chosen | Verdict | t0 | Sync keys song→plate (offset) | Known issues |
|---|---|---|---|---|---|---|
| P01 | S04-06, S16, S20, S24, S30, S35, S44 | - | - | 7.18 | - | - |
| P02 | S01-02 | take1 | pass 3 | 0.0 | 1:1 from t0 | Land dim (mean 0.12); a black sun + corona is drawn in the sky (renderer paints over); faces-up not readable at army scale. |
| P03 | S07 | take1 | pass 4 | 14.19 | 1:1 from t0 | Knucklebone reads dark, not ivory. |
| P04 | S08, S42 | take1 | pass 4 | 17.66 | 1:1 from t0 | Sword not in frame (cropped at the waist). |
| P05 | S09, S22, S43 | take1 | pass 4 | 21.15 | 23.30→2.40 (+0.25) | Bright warm sky behind (low angle), not a dark background. |
| P06 | S09, S22, S43 | take1 | pass 4 | 21.15 | 23.30→2.55 (+0.40) | Bright warm sky behind (low angle); bow/sword not clearly visible. |
| P07 | S10 | take2 | pass 4 | 25.5 | 1:1 from t0 | Sun in the top-right corner, bright sky. |
| P08 | S11 | take1 | pass 4 | 26.0 | 27.24→1.58 (+0.34) | Spray very red; near-frozen slow motion after 1.7 s; bright sky. |
| P09 | S13 | take3 | pass 4 | 32.47 | 1:1 from t0 | - |
| P10 | S14 | take1 | pass 4 | 35.98 | 38.23→2.21 (-0.04) | No standing second rank; bright sky. |
| P11 | S15 | take1 | pass 4 | 39.48 | 41.24→2.00 (+0.24) | Cut at 2.0 s (asked 2.5). |
| P12 | S17, S19, S27, S36, S37 | take1 | pass 3 | 44.73 | 46.06→2.12 (+0.79); 47.56→3.30 (+0.47); 48.91→3.88 (-0.30); 49.53→5.20 (+0.40); 50.63→6.05 (+0.15); 51.48→6.90 (+0.15) | Contre-jour (sun in frame), faces in shadow; strikes ~0.1-0.8 s late. |
| P13 | S21 | take2 | pass 4 | 58.72 | 59.60→1.00 (+0.12); 62.20→3.50 (+0.02) | - |
| P14 | S23, S36, S41, S47 | take2 | pass 4 | 65.67 | 67.73→2.00 (-0.06) | Face dark for the first 1.6 s; upward gaze ~2.8 s (S41/S47 want ~3.4 s). |
| P15 | S25 | take2 | pass 4 | 74.41 | 77.88→3.38 (-0.10) | - |
| P16 | S26, S36 | take1 | pass 4 | 81.36 | 84.38→2.50 (-0.52) | Thin horizontal lens-flare streak at 2.8-3.5 s. |
| P17 | S27 | take1 | pass 4 | 85.91 | 88.69→2.85 (+0.07) | Dapples are round spots (renderer paints the crescents). |
| P18 | S28 | take2 | pass 3 | 89.22 | 89.78→2.00 (+1.44); 91.31→3.50 (+1.41) | 2 Lydians : 4 Medes (not alternating); wave ~1.4 s late. |
| P19 | S29, S36 | take1 | pass 4 | 93.0 | 93.95→0.90 (-0.05) | Eyelid half-lowered in the first 0.3 s. |
| P19b | S42 (and S36) | take1 | pass 4 | 93.0 | 1:1 from t0 | - |
| P20 | S31, S55 | take1 | pass 5 | 100.24 | 102.21→2.04 (+0.07) | - |
| P21 | S32 | take3 | pass 4 | 103.64 | 104.96→2.46 (+1.14) | Flat featureless water horizon; drop +1.1 s late. |
| P22a | S33 (left panel) | take1 | pass 4 | 105.85 | 1:1 from t0 | Hand enters from the right like P22b: flip P22a for the mirrored diptych. |
| P22b | S33 (right panel) | take1 | pass 4 | 105.85 | 1:1 from t0 | Fist partly out of frame for 0.4 s. |
| P23 | S03 | take2 | pass 4 | 3.65 | 1:1 from t0 | Spears grounded upright, not lowered. |
| P24 | S38 | take1 | pass 4 | 124.47 | 1:1 from t0 | Reads as a reach with spread fingers (no head push-through). |
| P25 | S45, S46, S49 | take2 | pass 4 | 153.83 | 1:1 from t0 | Black sun drawn at the end (renderer paints over). |
| P26 | S51 | take1 | pass 4 | 178.66 | 1:1 from t0 | Lydians wear crimson cloaks (not on the sheet). |
| P27 | S52 | take3 | pass 4 | 181.23 | 1:1 from t0 | - |
| P28 | S53, S54 | take1 | pass 5 | 184.64 | 187.65→2.80 (-0.21) | - |
| P29 | S57, S58 | take1 | pass 4 | 194.86 | 200.31→5.85 (+0.40) | Back of the crowd merges slightly. |
| P30 | S59 | take1 | pass 5 | 203.39 | 1:1 from t0 | - |
| P31 | S60 | take1 | pass 4 | 207.4 | 1:1 from t0 | Odd pink-white streaked water texture behind them. |
| P32 | S61 | take1 | pass 4 | 208.7 | 209.94→1.60 (+0.35); 210.18→2.17 (+0.69) | - |
| P33 | S62 (-> S63 match cut) | take1 | pass 4 | 211.88 | 215.29→3.40 (-0.01) | - |
| P34 | S63 | take2 | pass 4 | 215.29 | 1:1 from t0 | Steel ring panels still hint at the real vehicle; silhouette generic. |
| P35 | S67 | take3 | pass 4 | 232.27 | 1:1 from t0 | Wing planform not visible in pure profile. |
| P36 | S68 | take1 | pass 4 | 235.66 | 237.66→2.10 (+0.10) | - |
| P37 | S70 | take1 | pass 4 | 242.45 | 1:1 from t0 | Blue sky (renderer recolours). |
| P38 | S74, S75, S76 | take4 | pass 4 | 257.68 | 259.35→2.00 (+0.33); 260.62→2.35 (-0.59); 261.05→3.60 (+0.23) | Shrug barely visible; the late gap is 1.25 s in the plate vs 0.43 s in the music. |
| P39 | S78 | take1 | pass 4 | 266.12 | 1:1 from t0 | Blue back circle faint. |
| P40 | S79 | take2 | pass 5 | 268.3 | 270.04→2.10 (+0.36) | Deadpan hold 2.9 s (S79 wants 3.36 s: hold the last drawing). |
| P41 | S80, S81 | take4 | pass 4 | 273.4 | 276.95→4.45 (+0.90) | Wink +0.9 s late (retime). |

## Per plate

### P01 · Master composition by day

* **Shots:** S04-06, S16, S20, S24, S30, S35, S44. **Window:** song [7.18, 22.18], audio reference cut at t0 = 7.18 s (Halys.mp3), 15 s, 2 take(s) reviewed.
* Take 1: pass 4: None seen at sheet scale; dense melee in the last 3 s should not be used for figure work.
* Take 2: pass 3: Armies flood the riverbed late; ignores 'stay high'/'battle already raging': the WIDE ref acts as a first frame.

### P02 · Same view as P01 at totality; never too dark to analyse

* **Shots:** S01-02. **Window:** song [0.0, 8.0], audio reference cut at t0 = 0.0 s (Halys.mp3), 8 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P02/take1.mp4`; analysis in `video/plates/P02/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Only take; matches the totality board, frozen armies, analysable.
* **Delivers:** S01-02 base: the master view at totality, matched to halys_totality3 (same river, banks, armies), frozen armies, slow push-in, orange 360-degree horizon glow.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Armies are dark silhouettes (army-level only).; -; The black sun + corona and Jupiter are drawn (copied from the board) although the prompt asked for an empty sky; the renderer paints the eclipse over it. Land is dim: mean 0.12, p95 0.30 (analysable; pipeline gain lifts it).
* **Notes for the renderer:** 1:1 from t0 = 0. Upturned faces are not readable at this scale.
* **Review sheet:** `media/plates/P02/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P02/take1.sheet.jpg`.

### P03 · Faces right; light pool on his face; the knucklebone must read

* **Shots:** S07. **Window:** song [14.19, 19.19], audio reference cut at t0 = 14.19 s (Halys.mp3), 5 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P03/take1.mp4`; analysis in `video/plates/P03/` (frames 121, fields 121, mattes 0, depth 61, gain 1.551). Only take; strong.
* **Delivers:** S07 delivered: seats the crested helmet (0-0.4 s), presses the cheek-pieces (1.0-3.0 s), hands down and looks off frame right (3.6-4.0 s); faces right in a warm light pool; dark riverbank with soldier ranks behind, clean separation.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Matches the sheet: Corinthian helmet pushed up, red/black crest, braids, short beard, bronze scales, crimson tunic, baldric. Knucklebone on its cord reads as a small DARK pendant, not ivory.; Same face as media/chars/lydian.jpg (virtual-avatar route kept identity).; None seen (hands on the helmet clean).
* **Notes for the renderer:** Use 1:1 from t0 (cut-in 14.19 = plate 0.0; S07 cut-out 17.66 = plate 3.47, hands come down at ~3.7). Renderer: paint the knucklebone ivory.
* **Review sheet:** `media/plates/P03/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P03/take1.sheet.jpg`.

### P04 · Mirror of P03: faces left, same light and closeness (equal dignity)

* **Shots:** S08, S42. **Window:** song [17.66, 22.66], audio reference cut at t0 = 17.66 s (Halys.mp3), 5 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P04/take1.mp4`; analysis in `video/plates/P04/` (frames 121, fields 121, mattes 61, depth 61, gain 1.617). Only take; strong mirror of P03.
* **Delivers:** S08 delivered: mirror of P03, three-quarters toward frame left, grips the spear (0.6-0.9 s), stands resolute looking left; dark riverbank with soldier ranks behind.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Red felt cap with ear flaps, black curly beard, long ochre sleeves, iron scale corselet, baldric; the terracotta toy horse is visible at his belt. Sword not in frame (cropped at the waist).; Matches media/chars/mede.jpg.; None.
* **Notes for the renderer:** 1:1 from t0. Light on the broad side of his face (equal to P03).
* **Review sheet:** `media/plates/P04/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P04/take1.sheet.jpg`.

### P05 · Left panel of the kings' diptych; mirrored with P06

* **Shots:** S09, S22, S43. **Window:** song [21.15, 27.15], audio reference cut at t0 = 21.15 s (Halys.mp3), 6 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P05/take1.mp4`; analysis in `video/plates/P05/` (frames 145, fields 145, mattes 73, depth 73, gain 1.2). Only take; mirrors P06.
* **Delivers:** S09/S22 left panel: Alyattes on a chestnut horse facing right, raises his right hand (1.7-2.4 s), turns and shouts at ~4.0 s; gold lion standard on a pole, Lydian spear ranks behind; king centred for the half-frame crop.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 23.300 → 2.40 (+0.25 s) · ostinato stops, rubato swell (plate 2.15) · manual: frame inspection (+ motion curve)
* **Timing notes:** S09 (21.15-25.50): hand rises 1.7-2.4 s (up at 2.4 on the 23.3 swell). S22 (62.20-65.67): use the shout section, plate 3.6-6.0 (mouth opens at 4.0); S43 any section.
* **Checks:** Gold fillet, grey-streaked long hair, full beard, purple mantle with gold meander border over a white chiton (court dress per the sheet); crimson saddlecloth, bronze bridle, no stirrups.; Matches media/chars/alyattes.jpg.; None. Background is a bright warm sky (low angle), not dark.
* **Notes for the renderer:** Matches P06 (same framing, light and timing).
* **Review sheet:** `media/plates/P05/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P05/take1.sheet.jpg`.

### P06 · Right panel of the kings' diptych; mirror of P05 (same audio, same beats)

* **Shots:** S09, S22, S43. **Window:** song [21.15, 27.15], audio reference cut at t0 = 21.15 s (Halys.mp3), 6 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P06/take1.mp4`; analysis in `video/plates/P06/` (frames 145, fields 145, mattes 73, depth 73, gain 1.0). Only take; mirrors P05.
* **Delivers:** S09/S22 right panel: Cyaxares on a dark bay facing left, raises his LEFT hand (2.3-2.6 s), turns toward his men and shouts at ~4.0 s; bronze horse standard on a pole, Median ranks behind; mirror of P05.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 23.300 → 2.55 (+0.40 s) · ostinato stops, rubato swell (plate 2.15) · manual: frame inspection (+ motion curve)
* **Timing notes:** S09: left hand rises 2.3-2.6 s (up at 2.55 on the 23.3 swell). S22: use plate 3.6-6.0 (turns to his men and shouts at ~4.0); mirrors P05.
* **Checks:** Madder cap with gold band, grey curled beard, saffron tunic, ochre kandys as a cape, belt of gold plaques; no stirrups. Sword/bow not clearly visible.; Matches media/chars/cyaxares.jpg.; None. Bright warm sky behind (low angle).
* **Notes for the renderer:** Pairs with P05.
* **Review sheet:** `media/plates/P06/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P06/take1.sheet.jpg`.

### P07 · Crescendo into the 27

* **Shots:** S10. **Window:** song [25.5, 30.5], audio reference cut at t0 = 25.5 s (Halys.mp3), 5 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P07/take2.mp4`; analysis in `video/plates/P07/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Symmetric, as specified (take 1 was two-thirds Lydian).
* **Delivers:** S10 delivered: mirror-symmetric waterline charge: two equal lines (Lydian crests and crimson left, wicker shields right) converge in a V, legs churning the water, the gap closing in the centre, no collision.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Army-level correct.; -; Sun at the top-right corner; bright sky.
* **Notes for the renderer:** Use plate 0-1.74 (up to the boom).
* **Review sheet:** `media/plates/P07/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P07/take2.sheet.jpg`.
* Take 1: pass 3: Not mirror-symmetric (Lydians fill 2/3 of the frame); bright sky.

### P08 · The clash: impact on the boom at 27

* **Shots:** S11. **Window:** song [26.0, 31.0], audio reference cut at t0 = 26.0 s (Halys.mp3), 5 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P08/take1.mp4`; analysis in `video/plates/P08/` (frames 121, fields 121, mattes 61, depth 61, gain 1.0). Only take; impact reads, spray crown.
* **Delivers:** S11 delivered: both lines rush in, the central shields collide and stop dead at plate 1.58, a crown of red-clay spray rises from 1.9 s and hangs in slow motion.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 27.240 → 1.58 (+0.34 s) · BOOM: shields collide (plate 1.24) · manual: frame inspection (+ motion curve)
* **Checks:** Lydian crest/crimson/scales/lion shield vs Mede red cap/ochre/iron scales/wicker shield.; Consistent with the sheets.; The spray is very red (reads as river clay in context); after 1.7 s the shot is near-frozen slow motion. Sun at the right edge, bright sky.
* **Notes for the renderer:** Impact 27.24 = plate 1.58 (+0.34).
* **Review sheet:** `media/plates/P08/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P08/take1.sheet.jpg`.

### P09 · Long spears, saddlecloths, no stirrups

* **Shots:** S13. **Window:** song [32.47, 37.47], audio reference cut at t0 = 32.47 s (Halys.mp3), 5 s, 3 take(s) reviewed.
* **Chosen:** take 3 → `media/plates/P09/take3.mp4`; analysis in `video/plates/P09/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Only take with levelled lances, side light and a dark background (takes 1-2 raised the spears against a bright sky).
* **Delivers:** S13 delivered: five Lydian riders gallop through the knee-deep shallows straight at the camera, side-lit gold from frame right against a dark far bank; lances levelled forward toward the lens; spray lit gold; the lead horse grows to a third of the frame and stays sharp.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Crested open-faced helmets, crimson, ochre cloaks, saddlecloths, no stirrups.; Army-level, consistent with the cavalry sheets.; None.
* **Notes for the renderer:** 1:1 from t0; use plate 0-3.5 for S13.
* **Review sheet:** `media/plates/P09/take3.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P09/take3.sheet.jpg`.
* Take 1: pass 3: Spears held raised, not lowered; sun in frame with a bright sky (SHALLOWS ref); the pass-by (3.5-4.7 s) is motion-blurred.
* Take 2: pass 3: Spears still held raised (not lowered); bright sky behind; the lead horse brushes past at the end.

### P10 · Disciplined, dignified, never a horde

* **Shots:** S14. **Window:** song [35.98, 40.98], audio reference cut at t0 = 35.98 s (Halys.mp3), 5 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P10/take1.mp4`; analysis in `video/plates/P10/` (frames 121, fields 121, mattes 61, depth 61, gain 1.0). Only take; the loose lands on the timpani.
* **Delivers:** S14 delivered: a disciplined kneeling rank of hooded Median archers at full draw (0-2.1 s), all loose in unison at 2.21 s, arrows streak across the sky to frame right, bows lower.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 38.230 → 2.21 (-0.04 s) · timpani: the loose (plate 2.25) · manual: frame inspection (+ motion curve)
* **Checks:** Undyed felt hoods with flaps, ochre tunics, sheepskin cloaks, dark trousers, composite bows; individual faces; sword side not visible.; Matches media/chars/median_archer.jpg.; None. No standing second rank; bright sky behind (low angle).
* **Notes for the renderer:** The loose lands on the 38.23 timpani (-0.04 s).
* **Review sheet:** `media/plates/P10/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P10/take1.sheet.jpg`.

### P11 · Two mirrored singles in one plate; the renderer cuts on beat 3

* **Shots:** S15. **Window:** song [39.48, 44.48], audio reference cut at t0 = 39.48 s (Halys.mp3), 5 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P11/take1.mp4`; analysis in `video/plates/P11/` (frames 121, fields 0, mattes 0, depth 0, gain 1.0). Only take; mirrored singles with a clean cut.
* **Delivers:** S15 delivered: two mirrored singles, hard cut at plate 2.0 (asked 2.5). Shot 1 (0-2.0): the Lydian in a dark melee looks off toward frame right. Shot 2 (2.0-5.0): the Mede turns from frame right to camera-left, recognition; both faces warm-lit, dark melee behind.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 41.240 → 2.00 (+0.24 s) · cut out · manual: frame inspection (+ motion curve)
* **Checks:** Correct on both (crest/braids/scales/crimson; red cap/beard/ochre/iron scales).; Both match their sheets.; None.
* **Notes for the renderer:** Renderer: Lydian = plate 0-2.0, Mede = plate 2.0-5.0; cut S15 on beat 3 wherever needed.
* **Review sheet:** `media/plates/P11/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P11/take1.sheet.jpg`.

### P12 · The duel; also the 3D orbit plate (S37), so keep both men whole and readable with clean depth

* **Shots:** S17, S19, S27, S36, S37. **Window:** song [44.73, 52.73], audio reference cut at t0 = 44.73 s (Halys.mp3), 8 s, 2 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P12/take1.mp4`; analysis in `video/plates/P12/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Clean, symmetric, equal-size exchanges with sharp stops (the first exchange, S17, is clean) and the best geometry for the S37 depth orbit; take 2 has nicer side light but its first exchange is a motion-blurred shield across the lens and the figures are unequal.
* **Delivers:** S17/S19 duel delivered: full figures, mirrored, six readable exchanges with sharp stops.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 46.060 → 2.12 (+0.79 s) · beat: first thrust turned by the lion shield (plate 1.33) · manual: frame inspection (+ motion curve)
  * 47.563 → 3.30 (+0.47 s) · stab (plate 2.83) · manual: frame inspection (+ motion curve)
  * 48.912 → 3.88 (-0.30 s) · stab (plate 4.18) · manual: frame inspection (+ motion curve)
  * 49.533 → 5.20 (+0.40 s) · stab (plate 4.80) · manual: frame inspection (+ motion curve)
  * 50.633 → 6.05 (+0.15 s) · stab + timpani (plate 5.90) · manual: frame inspection (+ motion curve)
  * 51.484 → 6.90 (+0.15 s) · stab (plate 6.75) · manual: frame inspection (+ motion curve)
* **Checks:** Lydian helmet/crest/crimson tunic/scales and lion shield (lion barely visible, backlit); Mede red cap, ochre tunic, iron scales, wicker shield, sword on the right thigh.; Consistent with the sheets; faces small and backlit.; None serious; spears cross in the air at 4.5-4.9 s (plausible). Light is CONTRE-JOUR: the sun sits in frame at the centre (copied from the SHALLOWS ref), not raking from frame right; faces mostly in shadow.
* **Notes for the renderer:** Exchanges at plate 2.12, 3.30, 3.88, 5.20, 6.05, 6.90.
* **Review sheet:** `media/plates/P12/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P12/take1.sheet.jpg`.
* Take 2: pass 3: The Lydian's shield swings across the lens at 2.38-2.88 s with heavy motion blur (this is the first exchange S17 needs); the Lydian is nearer the camera and larger than the Mede (not equal size).

### P13 · Knocked down, spear comes down, rolls clear

* **Shots:** S21. **Window:** song [58.72, 63.72], audio reference cut at t0 = 58.72 s (Halys.mp3), 5 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P13/take2.mp4`; analysis in `video/plates/P13/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Side light and darker background with the same action, closer to the beat than take 1.
* **Delivers:** S21 delivered: side-lit, darker background; the Mede's shield bash knocks the Lydian back into the water with a big splash at ~1.0 s; the spear comes down at ~2.1 s; the Lydian rolls and rises to one knee behind his lion shield by ~3.5 s.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 59.600 → 1.00 (+0.12 s) · timpani: knocked down (plate 0.88) · manual: frame inspection (+ motion curve)
  * 62.200 → 3.50 (+0.02 s) · cut out (plate 3.48) · manual: frame inspection (+ motion curve)
* **Timing notes:** Knock-down splash at plate 1.0 (59.60 timpani, +0.12 s); spear stabs the water at 2.1; up on one knee at 3.5 = S21 cut-out 62.20.
* **Checks:** Correct.; Match.; None.
* **Notes for the renderer:** Knock-down +0.15 s vs the 59.60 timpani.
* **Review sheet:** `media/plates/P13/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P13/take2.sheet.jpg`.
* Take 1: pass 3: Backlit with the sun in frame (SHALLOWS ref); no gore.

### P14 · One face in the chaos; still before the voice; then looking up (reused for S41 lines and S47 marble)

* **Shots:** S23, S36, S41, S47. **Window:** song [65.67, 70.67], audio reference cut at t0 = 65.67 s (Halys.mp3), 5 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P14/take2.mp4`; analysis in `video/plates/P14/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Longer upward gaze in awe (from 2.0 s; S41/S47 need it) and the light grows on his face; take 1 is the alternate with a better-lit opening.
* **Delivers:** S23/S36/S41/S47: breathing in the dark melee (0-1.6 s), eyes rise from 2.0 s, a long upward gaze in awe with wet eyes from 2.8 s to the end; the light grows on his face as he looks up.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 67.730 → 2.00 (-0.06 s) · first sung word: the frame is still (plate 2.06) · manual: frame inspection (+ motion curve)
* **Checks:** Corinthian helmet, braids, scale corselet, crimson tunic.; Matches the sheet.; None; the face is darker in the first 1.6 s.
* **Notes for the renderer:** Chosen candidate: the look-up lasts ~2.8 s (S41/S47 need ~3.4 s: slow or hold the end).
* **Review sheet:** `media/plates/P14/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P14/take2.sheet.jpg`.
* Take 1: pass 4: None.

### P15 · Face-off centred and mirrored (LYDIANS over left, MEDES over right), then the shore melee after the cut

* **Shots:** S25. **Window:** song [74.41, 81.41], audio reference cut at t0 = 74.41 s (Halys.mp3), 7 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P15/take2.mp4`; analysis in `video/plates/P15/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Side-lit symmetric face-off and a readable mirrored shore melee after a cut that lands on 77.88; take 1's melee is tiny and far.
* **Delivers:** S25 delivered: symmetric face-off in the shallows, Lydian left / Mede right in profile, shields up, spears lowered, circling (0-3.375 s); hard cut at 3.375 s to a mirrored side-on wide of the shore melee: a long line of Lydians and Medes clashing on the bank, dust, river in the foreground.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 77.880 → 3.38 (-0.10 s) · cut to the shore melee (plate 3.47) · manual: frame inspection (+ motion curve)
* **Checks:** Correct on both heroes; melee figures read as the two sides at silhouette scale.; Matches the sheets.; None.
* **Notes for the renderer:** The cut lands on 77.88 (-0.10 s): use 1:1 from t0.
* **Review sheet:** `media/plates/P15/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P15/take2.sheet.jpg`.
* Take 1: pass 3: Shot 2 melee is tiny and far (top of frame); bright sky.

### P16 · Bronze macro; the renderer adds the reflected easter-egg figure on the convex bronze

* **Shots:** S26, S36. **Window:** song [81.36, 86.36], audio reference cut at t0 = 81.36 s (Halys.mp3), 5 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P16/take1.mp4`; analysis in `video/plates/P16/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Only take.
* **Delivers:** S26 delivered: macro slide across the crimson lion shield and its convex bronze rim (0-2.2 s), up over the crested Corinthian helmet (2.2-5 s); the low sun's glint flashes across the bronze at ~2.5 s.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 84.380 → 2.50 (-0.52 s) · 'bronze': the glint sweeps (plate 3.02) · manual: frame inspection (+ motion curve)
* **Checks:** Lion blazon and helmet exactly as the sheet.; Sheet props.; A thin horizontal lens-flare streak at 2.8-3.5 s (renderer ignores/repaints).
* **Notes for the renderer:** Glint ~2.5 s vs 'bronze' 84.38 (plate 3.02): -0.5 s.
* **Review sheet:** `media/plates/P16/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P16/take1.sheet.jpg`.

### P17 · The renderer paints the stretched crescent suns; the plate gives the dappled light, the glance down and the look up

* **Shots:** S27. **Window:** song [85.91, 89.91], audio reference cut at t0 = 85.91 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P17/take1.mp4`; analysis in `video/plates/P17/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Only take.
* **Delivers:** S27 delivered: the Lydian beside the edge of a big wicker shield (frame right); small bright dapples of light on his scales, shield and face; glances down at his chest (0.8-1.8 s), lifts his face to the sky toward frame right from ~2.8 s (on 'strange' 88.69).
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 88.690 → 2.85 (+0.07 s) · 'strange': he looks up (plate 2.78) · manual: frame inspection (+ motion curve)
* **Checks:** Correct (helmet, braids, scales, crimson, lion shield).; Matches.; Dapples are round spots (renderer paints the stretched crescents).
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P17/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P17/take1.sheet.jpg`.

### P18 · Faces turn up one after another; all up on the 91

* **Shots:** S28. **Window:** song [89.22, 93.22], audio reference cut at t0 = 89.22 s (Halys.mp3), 4 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P18/take2.mp4`; analysis in `video/plates/P18/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Readable wave of upturned faces (take 1's was invisible).
* **Delivers:** S28: six warriors chest-up against a dark bank (2 Lydians, 4 Medes); faces turn up one after another left to right (first ~2.0 s, all six up by ~3.5 s) and hold.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 89.780 → 2.00 (+1.44 s) · 'halo' (plate 0.56) · manual: frame inspection (+ motion curve)
  * 91.310 → 3.50 (+1.41 s) · boom 'warriors': all faces up (plate 2.09) · manual: frame inspection (+ motion curve)
* **Checks:** Correct.; Consistent.; Not strictly alternating (L, M, M, L, M, M); the wave is late (+1.4 s) and the first part is static.
* **Notes for the renderer:** Retime: the 91.31 boom = all faces up at plate ~3.5.
* **Review sheet:** `media/plates/P18/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P18/take2.sheet.jpg`.
* Take 1: weak 2: Pale beach-like shore and bright sky; subject motion tiny (max 0.18 px/frame).

### P19 · XCU eye; the renderer puts the crescent in the pupil

* **Shots:** S29, S36. **Window:** song [93.0, 97.0], audio reference cut at t0 = 93.0 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P19/take1.mp4`; analysis in `video/plates/P19/` (frames 97, fields 97, mattes 49, depth 0, gain 1.568). Only take.
* **Delivers:** S29 delivered: XCU of the Lydian's eye inside the bronze cheek-piece edge; the eye opens wide by 0.9 s (on 'eye' 93.95) and holds an upward gaze, pupil dark with a sky glint.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 93.950 → 0.90 (-0.05 s) · 'eye' (plate 0.95) · manual: frame inspection (+ motion curve)
* **Checks:** Bronze cheek-piece edge, weathered skin.; Matches.; Eyelid half-lowered in the first 0.3 s (reads as a squint opening).
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P19/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P19/take1.sheet.jpg`.

### P19b · The Mede variant of P19 (equal dignity; S42 the Mede's face in lines)

* **Shots:** S42 (and S36). **Window:** song [93.0, 97.0], audio reference cut at t0 = 93.0 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P19b/take1.mp4`; analysis in `video/plates/P19b/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Only take.
* **Delivers:** S42 Mede variant: XCU of the Mede's eye under the red felt cap edge, brown iris, steady gaze up and to the left.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Red cap edge visible.; Matches.; None.
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P19b/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P19b/take1.sheet.jpg`.

### P20 · The formation moment: all faces up on 102

* **Shots:** S31, S55. **Window:** song [100.24, 104.24], audio reference cut at t0 = 100.24 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P20/take1.mp4`; analysis in `video/plates/P20/` (frames 97, fields 97, mattes 49, depth 49, gain 2.2). Only take; faces-up in unison on the 102.21 boom.
* **Delivers:** S31/S55 delivered: mirrored converging ranks (Lydians left, Medes right) in profile against an orange horizon glow under a dark umber sky (readable dusk); everyone still, then every face lifts in unison peaking at plate 2.04 (the 102.21 boom, +0.07 s) and holds; empty sky in the V for the black sun.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 102.210 → 2.04 (+0.07 s) · BIGGEST BOOM: every face up in unison (plate 1.97) · manual: frame inspection (+ motion curve)
* **Checks:** Correct on both sides (crests, scales, crimson; red caps, beards, ochre, wicker shields).; Army-level.; None.
* **Notes for the renderer:** Use 1:1 from t0.
* **Review sheet:** `media/plates/P20/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P20/take1.sheet.jpg`.

### P21 · The duelists stop; the sword drop must read and land near 104

* **Shots:** S32. **Window:** song [103.64, 107.64], audio reference cut at t0 = 103.64 s (Halys.mp3), 4 s, 3 take(s) reviewed.
* **Chosen:** take 3 → `media/plates/P21/take3.mp4`; analysis in `video/plates/P21/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Only take with the sword falling into the water with a splash (takes 1-2 on dry gravel).
* **Delivers:** S32 delivered: mirrored profile two-shot knee-deep in the river at dusk; frozen, then facing each other; the Lydian's sword drops into the water at ~2.46 s with a clear splash at his feet; still afterwards.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 104.960 → 2.46 (+1.14 s) · 'blade': the sword hits the water (plate 1.32) · manual: frame inspection (+ motion curve)
* **Checks:** Correct.; Match.; Flat, featureless water horizon; mutual gaze is in profile only.
* **Notes for the renderer:** Drop +1.14 s vs 'blade' 104.96.
* **Review sheet:** `media/plates/P21/take3.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P21/take3.sheet.jpg`.
* Take 1: pass 3: They stand on the gravel bank, NOT in the water: the sword falls onto stones, no splash. Mutual gaze is weak.
* Take 2: weak 2: On the bank, not in the water; the drop does not read.

### P22a · Left panel of the hands diptych (mirror of P22b)

* **Shots:** S33 (left panel). **Window:** song [105.85, 109.85], audio reference cut at t0 = 105.85 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P22a/take1.mp4`; analysis in `video/plates/P22a/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Only take (flip for the mirrored diptych).
* **Delivers:** S33 left panel delivered: the Lydian's loose fist (crimson sleeve, bronze scales at frame right) opens from 1.2 s to reveal an ivory, lumpy astragalus on a thin cord; open palm held from 2.3 s.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Knucklebone exactly like the sheet inset (ivory here, unlike P03).; Sheet prop.; Five natural fingers, no artefacts. The hand enters from the RIGHT (same side as P22b), so the pair is not mirrored.
* **Notes for the renderer:** Renderer: flip P22a horizontally for the mirrored diptych (safe: no sword or text in frame).
* **Review sheet:** `media/plates/P22a/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P22a/take1.sheet.jpg`.

### P22b · Right panel of the hands diptych (mirror of P22a)

* **Shots:** S33 (right panel). **Window:** song [105.85, 109.85], audio reference cut at t0 = 105.85 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P22b/take1.mp4`; analysis in `video/plates/P22b/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Only take.
* **Delivers:** S33 right panel delivered: the Mede's fist (ochre sleeve, red rosette cuff) enters from frame right, opens from 2.0 s to reveal the terracotta toy horse in his palm, holds open from 3.0 s; black background, warm rim.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Rosette cuff as on the sheet; toy horse terracotta (reads, slightly lumpy).; Sheet prop.; Fingers count correct; fist partly out of frame in the first 0.4 s.
* **Notes for the renderer:** 1:1 from t0 ('home' 107.02 = plate 1.17, the hand is still closing/opening then).
* **Review sheet:** `media/plates/P22b/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P22b/take1.sheet.jpg`.

### P23 · Cold-open payoff image; frozen, faces up, mirrored

* **Shots:** S03. **Window:** song [3.65, 7.65], audio reference cut at t0 = 3.65 s (Halys.mp3), 4 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P23/take2.mp4`; analysis in `video/plates/P23/` (frames ?, fields ?, mattes ?, depth ?, gain ?). In the water, as specified (take 1 stood on dry gravel).
* **Delivers:** S03 delivered: mirrored two-shot of the heroes standing IN the red-brown water, faces turned up to the dark sky, completely still, a thin orange horizon glow.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Correct on both.; Match.; Spears held upright (grounded) rather than lowered into the water; the river reads as a flat, wide water body.
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P23/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P23/take2.sheet.jpg`.
* Take 1: pass 3: They stand on a dry gravel bank, not in the shallows; spears upright rather than lowered; dusk sky is blue-tinted.

### P24 · Flammarion: the renderer makes the sky a membrane of lines where the palm presses

* **Shots:** S38. **Window:** song [124.47, 128.47], audio reference cut at t0 = 124.47 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P24/take1.mp4`; analysis in `video/plates/P24/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Only take.
* **Delivers:** S38 delivered: the Lydian from behind/side on a ridge against a dark dusk sky with an orange horizon; raises his right arm and pushes his open, spread palm up against the sky (1.0-3.8 s), leaning up into it.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Helmet + crest, braids, scales, crimson, shield rim at frame bottom.; Matches.; The 'glass' press reads as a reach with spread fingers (no head push-through).
* **Notes for the renderer:** Palm reaches the 'membrane' ~1.6-2.3 s (kick returns 126.206 = plate 1.74).
* **Review sheet:** `media/plates/P24/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P24/take1.sheet.jpg`.

### P25 · Frozen-time hero plate: statues mid-action, camera moving (S46 drift; S49 tilt up to the sky)

* **Shots:** S45, S46, S49. **Window:** song [153.83, 163.83], audio reference cut at t0 = 153.83 s (Halys.mp3), 10 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P25/take2.mp4`; analysis in `video/plates/P25/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Central Lydian-vs-Mede duel frozen mid-strike as specified; take 1 has no central duel.
* **Delivers:** S45/S46/S49 delivered: the Lydian frozen mid-thrust against the Mede blocking with his wicker shield at the centre; riders, archers and spearmen frozen around them; arrows hang in the air; the camera orbits left-to-right through the frozen scene (0-5.6 s), then cranes up and tilts to the dark sky (5.6-10 s).
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Correct (crest, crimson, scales, lion shield; red cap, ochre, iron scales, wicker shield).; Heroes consistent with the sheets.; Black sun drawn at the end (renderer paints over); readable warm dusk.
* **Notes for the renderer:** 157.03 'cut closer' = plate ~3.1 (orbit mid-way); tilt-up for S49 at plate 5.6-10.
* **Review sheet:** `media/plates/P25/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P25/take2.sheet.jpg`.
* Take 1: pass 3: A black sun is drawn in the sky at the end (renderer paints over).

### P26 · Only cloth, hair, grass and dust move

* **Shots:** S51. **Window:** song [178.66, 182.66], audio reference cut at t0 = 178.66 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P26/take1.mp4`; analysis in `video/plates/P26/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Only take.
* **Delivers:** S51 delivered: three warriors (two Lydians, a Mede) frozen mid-action on the bank at dusk; only the wind moves: crimson cloaks billow, the ribbons under the gold lion standard stream, feather grass bends.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Correct; the Lydians wear crimson cloaks (not on the sheet, plausible).; Consistent.; None; orange horizon, readable dusk.
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P26/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P26/take1.sheet.jpg`.

### P27 · The only living thing walks between the statues (painted in colour by the renderer)

* **Shots:** S52. **Window:** song [181.23, 185.23], audio reference cut at t0 = 181.23 s (Halys.mp3), 4 s, 4 take(s) reviewed.
* **Chosen:** take 3 → `media/plates/P27/take3.mp4`; analysis in `video/plates/P27/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Clear walk toward a static camera with full, readable frozen figures (takes 1-2 had no walk; take 4 is darker and more cluttered).
* **Delivers:** S52 delivered: static camera; Thales (staff, chiton, terracotta mantle) walks toward the lens from the middle distance to a medium shot between a Lydian frozen mid-thrust and a Mede frozen behind his wicker shield, a line of frozen soldiers far behind; looks up at the sky; dusk.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Per sheet, staff in hand.; Matches thales.jpg.; None; the frozen men do not move.
* **Notes for the renderer:** 1:1 from t0 (name on 182.485 = plate 1.26, mid-walk).
* **Review sheet:** `media/plates/P27/take3.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P27/take3.sheet.jpg`.
* Take 1: pass 3: He does not walk (the model orbited the camera instead).
* Take 2: weak 2: No real walk; sky too bright for totality.
* Take 4: pass 4: Foreground warriors are big dark masses (less readable).

### P28 · He looks up, then glances into the lens in the breath (187

* **Shots:** S53, S54. **Window:** song [184.64, 189.64], audio reference cut at t0 = 184.64 s (Halys.mp3), 5 s, 2 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P28/take1.mp4`; analysis in `video/plates/P28/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Glance into the lens near the breath, no corona behind the head; take 2 drew a huge corona behind him.
* **Delivers:** S53/S54 delivered: Thales (staff, braided fillet, chiton, terracotta mantle) among silhouetted warriors under an orange dusk horizon; looks up studying the sky (0-2.2 s), lowers his gaze and meets the lens with a dry, knowing half-smile from ~2.8 s to the end.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 187.650 → 2.80 (-0.21 s) · the breath: he glances at camera (plate 3.01) · manual: frame inspection (+ motion curve)
* **Checks:** Exactly the sheet.; Matches thales.jpg.; None.
* **Notes for the renderer:** Glance lands ~0.2 s before the 187.65 breath.
* **Review sheet:** `media/plates/P28/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P28/take1.sheet.jpg`.
* Take 2: pass 3: A huge black sun with a bright corona is drawn directly behind his head (would pollute the light/brightness analysis).

### P29 · Light returns: statues to flesh, then the roar on 'Shadow turned to day' (plate 5

* **Shots:** S57, S58. **Window:** song [194.86, 203.86], audio reference cut at t0 = 194.86 s (Halys.mp3), 9 s, 2 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P29/take1.mp4`; analysis in `video/plates/P29/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Clear dusk-to-gold light sweep and statues-to-flesh transition; take 2 starts already golden.
* **Delivers:** S57/S58 delivered: a dense mixed crowd frozen in dim dusk, a wave of golden light sweeps in from the right (1.7-4.0 s) and they come alive, look up and around; both armies roar from ~5.8 s, raising spears and arms, embracing by 8.5 s.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 200.315 → 5.85 (+0.40 s) · 'Shadow turned to day': the roar (plate 5.46) · manual: frame inspection (+ motion curve)
* **Checks:** Crests/crimson/lion shields and red caps/ochre/wicker shields mixed.; Crowd-level; the front figures read as both sides.; Dense crowd at the back merges slightly (fine for a crowd); no stirrups/flags.
* **Notes for the renderer:** Roar ~+0.4 s vs 200.315.
* **Review sheet:** `media/plates/P29/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P29/take1.sheet.jpg`.
* Take 2: pass 3: Light is already golden from the start (no clear dusk-to-gold transition).

### P30 · Baroque glory: golden faces, laughter

* **Shots:** S59. **Window:** song [203.39, 207.39], audio reference cut at t0 = 203.39 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P30/take1.mp4`; analysis in `video/plates/P30/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Only take.
* **Delivers:** S59 delivered: the Lydian and the Mede side by side, faces lit gold, looking up and laughing with relief; the Mede claps the Lydian's shoulder at ~3.3 s; cheering crowd dark behind.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Correct (crest, braids, scales; red cap, beard, ochre, iron scales).; Match the sheets.; None.
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P30/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P30/take1.sheet.jpg`.

### P31 · Face to face, still, weapons in hand

* **Shots:** S60. **Window:** song [207.4, 211.4], audio reference cut at t0 = 207.4 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P31/take1.mp4`; analysis in `video/plates/P31/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Only take.
* **Delivers:** S60 delivered: close mirrored profile two-shot, Lydian left facing right, Mede right facing left, a metre apart, weapons in hand, still, breathing; low sun at the right edge.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Correct.; Match.; The river surface behind them has an odd pink-white streaked texture.
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P31/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P31/take1.sheet.jpg`.

### P32 · Rain of bronze; then one sword sinking during the held 'blade'

* **Shots:** S61. **Window:** song [208.7, 213.7], audio reference cut at t0 = 208.7 s (Halys.mp3), 5 s, 2 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P32/take1.mp4`; analysis in `video/plates/P32/` (frames ?, fields ?, mattes ?, depth ?, gain ?). More blades readable in the air; otherwise equal to take 2.
* **Delivers:** S61 delivered: wide backlit river with both armies hurling swords and spears from both banks, a rain of blades arcing through gold air (0-2.17 s); hard cut at 2.17 s to one bronze sword entering the red water point-first and sinking, hilt last, rings spreading (2.2-5 s).
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 209.945 → 1.60 (+0.35 s) · 'blade' (plate 1.25) · manual: frame inspection (+ motion curve)
  * 210.180 → 2.17 (+0.69 s) · low end out: hold on the sinking sword (plate 1.48) · manual: frame inspection (+ motion curve)
* **Checks:** Army-level correct.; -; None.
* **Notes for the renderer:** Hold the sinking sword (plate 2.2-5) under the held 'blade' (210.18-211.88).
* **Review sheet:** `media/plates/P32/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P32/take1.sheet.jpg`.
* Take 2: pass 4: None.

### P33 · The sword at its apex, point up, match-cuts to the rocket (P34) on the Drop 2 kick

* **Shots:** S62 (-> S63 match cut). **Window:** song [211.88, 215.88], audio reference cut at t0 = 211.88 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P33/take1.mp4`; analysis in `video/plates/P33/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Only take; apex on the Drop 2 kick.
* **Delivers:** S62 delivered: the Lydian on the bank against a golden sky tosses his sword at ~0.8 s; the camera tilts up; the sword spins end over end into the golden clouds and slows to near-still at the apex at ~3.4 s.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 215.287 → 3.40 (-0.01 s) · DROP 2 kick: match cut at the apex (plate 3.41) · manual: frame inspection (+ motion curve)
* **Checks:** Correct.; Matches.; None.
* **Notes for the renderer:** Apex lands on the Drop 2 kick (215.287 = plate 3.41).
* **Review sheet:** `media/plates/P33/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P33/take1.sheet.jpg`.

### P34 · Swords into starships: the spinning sword match-cuts to it

* **Shots:** S63. **Window:** song [215.29, 222.29], audio reference cut at t0 = 215.29 s (Halys.mp3), 7 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P34/take2.mp4`; analysis in `video/plates/P34/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Generic silhouette without the Starship flaps of take 1.
* **Delivers:** S63 delivered: a generic polished-steel rocket (pointed ogive nose, three small fins at the base, no flaps) lifts off at dusk on a white-gold flame, climbs centred and vertical, camera tilting up.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Unbranded: no logos, flags or lettering.; -; Steel ring panels still hint at the real thing, but the silhouette is generic.
* **Notes for the renderer:** Starts on the pad at plate 0 (Drop 2 kick 215.287): 1:1 from t0.
* **Review sheet:** `media/plates/P34/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P34/take2.sheet.jpg`.
* Take 1: weak 2: Silhouette is essentially SpaceX Starship (forward and aft flaps): conflicts with the style bible's no-Musk-iconography rule.

### P35 · 1973 Concorde 001 eclipse chase; the renderer adds the eclipse through a porthole

* **Shots:** S67. **Window:** song [232.27, 236.27], audio reference cut at t0 = 232.27 s (Halys.mp3), 4 s, 3 take(s) reviewed.
* **Chosen:** take 3 → `media/plates/P35/take3.mp4`; analysis in `video/plates/P35/` (frames ?, fields ?, mattes ?, depth ?, gain ?). The only take that reads as a Concorde (no tailplane, needle nose).
* **Delivers:** S67 delivered: a Concorde-type SST in clean side profile above a sea of clouds at dusk (needle nose, slender fuselage with a window row, single swept fin and no tailplane, rectangular under-wing nacelle), camera tracking alongside.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Plain white, no markings.; -; Wing planform not visible in pure profile.
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P35/take3.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P35/take3.sheet.jpg`.
* Take 1: fail 1: Wrong aircraft type.
* Take 2: weak 2: Has a T-tail and podded engines: not a Concorde.

### P36 · 2024 crowd; rhymes with the warriors' faces-up moment (P20)

* **Shots:** S68. **Window:** song [235.66, 239.66], audio reference cut at t0 = 235.66 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P36/take1.mp4`; analysis in `video/plates/P36/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Only take.
* **Delivers:** S68 delivered: a mixed modern crowd in a park in paper eclipse glasses looking up; at ~2.1 s arms go up, a child on shoulders raises both arms, several point up.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 237.660 → 2.10 (+0.10 s) · faces lift together (plate 2.0) · manual: frame inspection (+ motion curve)
* **Checks:** Plain clothes, no logos.; -; None.
* **Notes for the renderer:** Faces-up moment +0.1 s vs plate 2.0.
* **Review sheet:** `media/plates/P36/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P36/take1.sheet.jpg`.

### P37 · Darkness at noon (2027, near Luxor); the renderer paints the black sun near the zenith

* **Shots:** S70. **Window:** song [242.45, 246.45], audio reference cut at t0 = 242.45 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P37/take1.mp4`; analysis in `video/plates/P37/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Only take.
* **Delivers:** S70 delivered: looking straight up between massive carved Karnak columns and architraves at a cross of sky, slow rotation, the sky dims from blue to violet dusk.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** -; -; Blue sky (renderer recolours); carved reliefs, no text.
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P37/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P37/take1.sheet.jpg`.

### P38 · Formation: raise on 259

* **Shots:** S74, S75, S76. **Window:** song [257.68, 262.68], audio reference cut at t0 = 257.68 s (Halys.mp3), 5 s, 4 take(s) reviewed.
* **Chosen:** take 4 → `media/plates/P38/take4.mp4`; analysis in `video/plates/P38/` (frames ?, fields ?, mattes ?, depth ?, gain ?). The only take with a clear, natural straggler and the upright-blade barcode (takes 1-2: no straggler; take 3: straggler frozen for 1.5 s).
* **Delivers:** S75/S76 delivered: nine-man front row (Lydians left, Medes right, a straggler Lydian in the centre) with both armies massed behind on the sand; all raise swords at ~2.0 s; the row stabs its blades point-first into the sand at ~2.35 s; the centre man keeps his raised, glances, and stabs his late at ~3.6 s, leaving a row of upright blades (the barcode).
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 259.350 → 2.00 (+0.33 s) · hit: blades raised (plate 1.67) · manual: frame inspection (+ motion curve)
  * 260.620 → 2.35 (-0.59 s) · BLADE: all blades slam down (plate 2.94) · manual: frame inspection (+ motion curve)
  * 261.050 → 3.60 (+0.23 s) · hit: the straggler's blade lands (plate 3.37) · manual: frame inspection (+ motion curve)
* **Checks:** Correct (crests, crimson, scales; red caps, ochre, iron scales).; Consistent.; The shrug is barely visible (a small settle at 3.8-4.2 s).
* **Notes for the renderer:** Keys: raise 259.35 = plate 2.0, BLADE 260.62 = 2.35, straggler 261.05 = 3.6 (the late gap is 1.25 s in the plate vs 0.43 s in the music: compress it).
* **Review sheet:** `media/plates/P38/take4.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P38/take4.sheet.jpg`.
* Take 3: pass 3: The straggler holds his raised sword for 1.5 s (reads as frozen rather than late); no shrug.
* Take 1: weak 2: No straggler, no shrug; blades lowered to the sides rather than slammed into the ground.
* Take 2: weak 2: No slam; one stray blade falls at ~3.3 s; dense wall of soldiers.

### P39 · From behind the chair; RARE EARTH circle rhymes with Earth

* **Shots:** S78. **Window:** song [266.12, 270.12], audio reference cut at t0 = 266.12 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P39/take1.mp4`; analysis in `video/plates/P39/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Only take.
* **Delivers:** S78 delivered: from behind her chair (room_a), she types at the ultrawide and side monitors; RARE EARTH and the patch on the back of the white jacket face the camera; window with fog and the red-blinking tower.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Per sheet/ROOM.md (blue circle is faint on the back).; Matches.; Screen pseudo-text (renderer replaces).
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P39/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P39/take1.sheet.jpg`.

### P40 · The spin lands on the final chord (270

* **Shots:** S79. **Window:** song [268.3, 273.3], audio reference cut at t0 = 268.3 s (Halys.mp3), 5 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P40/take2.mp4`; analysis in `video/plates/P40/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Spin lands 1.06 s closer to the chord than take 1 and leaves a longer deadpan hold (2.9 s).
* **Delivers:** S79 delivered: typing from behind (0-1.1 s), one smooth half-turn spin (1.2-2.1 s), facing the camera squarely with a perfect deadpan stare from ~2.1 s to the end (2.9 s of hold).
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 270.040 → 2.10 (+0.36 s) · final stark chord: the spin ends facing camera (plate 1.74) · manual: frame inspection (+ motion curve)
* **Checks:** Per sheet.; Matches.; None.
* **Notes for the renderer:** Spin lands ~+0.35 s after the 270.04 chord.
* **Review sheet:** `media/plates/P40/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P40/take2.sheet.jpg`.
* Take 1: pass 4: None; screen pseudo-text (renderer replaces screens).

### P41 · Audio = sound-design master 273

* **Shots:** S80, S81. **Window:** song [273.4, 279.4], audio reference cut at t0 = 273.4 s (sound-design master), 6 s, 4 take(s) reviewed.
* **Chosen:** take 4 → `media/plates/P41/take4.mp4`; analysis in `video/plates/P41/` (frames ?, fields ?, mattes ?, depth ?, gain ?). Typing gesture plus a clean single-eye wink (take 3 has no typing; take 2 closes both eyes before winking; take 1 never winks with one eye).
* **Delivers:** S80/S81 delivered: front-facing close-up, monitors and lamp behind; deadpan stare while her right shoulder and sleeve dip at frame-left as she types blind (0.2-1.8 s); sly smile from ~3.25 s; a clean single-eye wink (frame-left eye closed ~4.4-5.1 s, other eye open), then the sly smile to the end.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 276.950 → 4.45 (+0.90 s) · the 'ting': THE WINK (plate 3.55) · manual: frame inspection (+ motion curve)
* **Checks:** Per sheet (headphones, white bomber, orange stripe, black top).; Matches the sheet.; None.
* **Notes for the renderer:** Wink +0.9 s late: 276.95 ting = plate 4.45 (closed by 4.55).
* **Review sheet:** `media/plates/P41/take4.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P41/take4.sheet.jpg`.
* Take 1: weak 2: The 'wink' is BOTH eyes closing into a happy squint at ~4.85 s (no one-eye wink).
* Take 2: pass 3: 0.4 s of both eyes closed before the wink settles.
* Take 3: pass 4: No blind-typing gesture at all.
