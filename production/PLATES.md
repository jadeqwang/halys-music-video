# HALYS: reference plates (Seedance 2.5)

The motion reference the JavaScript renderer redraws. Plates are never shown: composition, motion, figure clarity and timing
come from them, so every take was reviewed against its shot before it was chosen. Specs: `tools/plate_specs.py`: the shot
list's P01–P41 (with P22 split into P22a/P22b and a Mede eye variant P19b) plus the director's Drop 1 reaction plates P42–P46 and the singer's arm-pull P47;
where a retake changed a prompt, the first-pass prompt is kept as `prompt_v1` with a `retake_note`. **Thales was redesigned**
(2026-10-03, he read as Jesus): the canonical sheet `media/chars/thales.jpg` is now the philosopher-herm design (short curly hair
with a thin fillet, trimmed curly beard, saffron himation with a dark woven border, wax tablet and a short gnomon; the old sheet
is `media/chars/thales_v1.jpg`), and P27/P28 were regenerated with it (their previous prompts are kept as `prompt_v2`). Per-plate verdicts:
`media/plates/<id>/review.json`. Shot purposes and times: `production/SHOTLIST.md` (as of the 02:43 commit e899de3).

> Status (2026-10-03 13:29): 49 plates delivered, 88 paid takes this pass (720p, 16:9, 24 fps, 483 s of video),
> **$111.67** (genlog estimate at $0.2312/s; 3 real-person-filter rejections cost nothing; +$3.47 only if the provider
> ever bills the abandoned P01 take 3; the two Thales sheet candidates added $0.34 of nano-banana-pro). All 49 chosen
> takes are fully analysed (frames, fields, mattes, depth, meta) in `video/plates/<id>/`, and `video/plates/index.json` lists
> each with `take` = the chosen file, plus `P27_v1`/`P28_v1`: the old-design Thales plates, kept analysed in
> `video/plates/P27_v1/` and `P28_v1/` (their `take` is the repo path of the old file).

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
* **A redesigned identity sheet carries straight through.** The new Thales sheet (fillet, trimmed beard, saffron himation with
  a dark border, tablet, short gnomon) held in all four P27/P28 takes on the first pass; none drifted back to a staff or long hair.
* No stirrups, flags, logos or modern objects appeared in any chosen take; the Median sword sits on the right where visible.
* **"Let go, never throw" works; an odd one out in a unison action is hard** (v2 GOLD, P51–P54). With "Nobody throws anything: the weapons
  simply fall straight down out of the opening hands" every one of the 11 takes dropped its weapons and none threw them. A single late
  man was ignored in 3 of 5 P54 takes (everyone dropped together, or the front pair turned to pose for the camera); it came only when the
  prompt described two separate drops ("FIRST, at 1.3 s … SECOND, at 2.0 s") and named the late man by costume and place (P54 v3, 2 of 2).
  Swords dropped point-first onto sand stick upright; on a wet bank they fall flat.
* **A first frame and an audio reference can be combined** (`first_frame` + `audio` in a spec; v2 P57/P58, 4/4 takes accepted): the take opens
  on the keyframe and keeps its drawing (hair length, the print, the patch side, the expression) for the whole clip.
* **Image edits for keyframes (Nano Banana Pro):** a descriptive "redraw her" prompt on a plate frame changes almost nothing; an explicit numbered
  edit list works for big changes (hair length) but can ignore small ones (moving a patch to the other arm); a crude paint-over of the change on the
  frame, then "clean this up", carries it reliably (K78b → K78d).

## Shot map (which plate, which part)

Plate times are seconds into the chosen take; `→` keys are song → plate (see each plate below for all keys).

| Shots | Plate (take) | Use |
|---|---|---|
| S01–S02 | P02 (1) | 1:1 from 0; frozen armies, the renderer paints the eclipse |
| S03 | P23 (2) | plate 0–1.75: heroes in the water, faces up |
| S04–S06 | P01 (1) | S05 = plate 0–3.5 (static master) at 1:1 from 7.18; the descent starts at ~4.5 (key 10.69 → 4.5 to open S06 on the move); S04's rewind can run the master backwards |
| S07 / S08 | P03 (1) / P04 (1) | 1:1 (helmet on; spear grip, toy horse) |
| S09 / S22 / S43 | P05 (1) + P06 (1) | S09: hands up at 2.40 / 2.55 (→ 23.3 swell); S22: the shout section, plate 3.6–6.0; S43: any |
| S10 | P07 (2) | plate 0–1.74, the lines must not meet before the boom |
| S11 | P08 (1) | impact 27.24 → 1.58 |
| S13 | P09 (3) | plate 0–3.5 (levelled lances) |
| S14 | P10 (1) | loose 38.23 → 2.21 |
| S15 | P11 (1) | Lydian = plate 0–2.0, Mede = 2.0–5.0 (hard cut) |
| S16, S20, S24, S30, S44 | P01 (1) | the static master, plate 0–4.5 (slow/hold for S24's 7 s) |
| S17 | P48 (1) | v2, the first exchange in the middle of the battle: the lion shield turns the thrust 46.057 → 2.00 (1:1 from 44.06; S17 = plate 0.67–2.43) |
| S18 | P49 (2) | v2, the battle line on the horizon: silhouettes keyed above v 0.868, 1:1 from 0.70 s in (46.49 → 0.70) |
| S19, S27 | P12 (1) | strikes 46.06 → 2.12, 47.56 → 3.30, 48.91 → 3.88, 49.53 → 5.20, 50.63 → 6.05, 51.48 → 6.90 (v1 S17/S18 also read these) |
| S21 | P13 (2) | knock-down 59.60 → 1.00; up on one knee at 3.5 (= 62.20) |
| S23, S41, S47 | P14 (2) | breathing 0–1.6, still ~1.6–2.0, the long upward gaze from 2.0 (→ 67.73) |
| S25 | P15 (2) | face-off 0–3.375, cut on 77.88 to the shore melee 3.375–7.0 |
| S26 | P16 (1) | glint 84.38 → 2.50 |
| S27 ("light went strange") | P17 (1) | looks up 88.69 → 2.85 |
| S28 | P50 (2) | v2, caught mid-fight (P18 is unused): fighting 0–1.7, faces up left to right 89.78 → 1.90, 90.20 → 2.25, 90.60 → 2.60, 90.87 → 2.90, all up 91.31 → 3.30 (cut to the sky, S28b) |
| S29 / S42 | P19 (1) / P19b (1) | eye opens 93.95 → 0.90 / the Mede's eye |
| S31, S55 | P20 (1) | every face up 102.21 → 2.04 |
| S31b | P47 (2) | the arm-pull: grab 102.21 → 1.90, striker turns ~2.6, both Lydians look up ~3.6, comrade points ~4.8 (far ranks static: borrow P20's look-up) |
| S32 | P21 (3) | sword into the water 104.96 → 2.46 |
| S33 | P22a (1, flip it) + P22b (1) | hands open 1.2–2.3 / 2.0–3.0 |
| S35 | P01 + P42 (2) + P44 (1) + P43 (2) | IN THE → P42 kneel at ~1.0; SKY → P44 rear 0.92; SKY → P43 prostration ~1.1 |
| S36 | P42–P45, P14, P19, P19b | P42: kneel 1.0, spin 1.6, eyes 2.9, spear 4.5 · P43: prostrate 1.1, amulet 1.8, bow 3.5, arm 4.3 · P44: rear 0.9, calming 1.9–3.4 · P45: Lydian 0–1.79, Mede 1.79–3.08, Alyattes 3.08–4.38, Cyaxares 4.38–5.04 |
| S37 | P46 (4) + depth | 1:1 from 117.53; ~25–30° arc around the frozen group |
| S38 | P24 (1) | palm meets the "glass" ~1.6–2.3 |
| S45, S46, S49 | P25 (2) | orbit through the frozen battle 0–5.6; crane/tilt to the sky 5.6–10 (S49) |
| S51 | P26 (1) | 1:1 (only wind moves) |
| S52 | P27 (6) | start 0.42 s in (181.23 → 0.42), then 1:1: plate 0.42–2.53 keeps the new Thales's matte clear of both statues (x ≈ 0.42–0.65) |
| S53–S54 | P28 (4) | looks up 0–2.2, head down 2.25–2.7, eyes on the lens 187.65 → 2.75, face square ~3.2, sly half-smile from ~3.25 |
| S57–S58 | P29 (1) | light sweep 1.7–4.0; the roar 200.315 → 5.85 |
| S59 / S60 | P30 (1) / P31 (1) | 1:1 |
| S61 / S61b | P51 (1) / P52 (2) | v2: caught mid-fight, they stop (209.10 → 1.38), the hands open (209.55 → 2.28), the weapons land on "blade" (209.945 → 2.66); S61b: the hand opens 210.42 → 2.88, the guard meets the water 211.30 → 3.92 |
| S62 | P53 (2) | v2: 1:1 from 0.10 s in (211.44 → 0.10); the upright sword, eased to the frame centre by 214.85, match-cuts to P34 (video/data/sword_handoff.json) |
| S63 / S67 / S68 / S70 | P34 (2) / P35 (3) / P36 (1) / P37 (1) | 1:1 (P36 faces up 237.66 → 2.10) |
| S74 | P38 (4) | the dive lands on P38 frame 1.55 in lines (drop2.js S74, not GOLD's): until it reads gold_outro.js `s75Start()`, its last 0.7 s dissolves P38's formation into S75's P54 |
| S75–S76 (+ S77's first 0.6 s in lines) | P54 (5) | v2: mid-fight from the hit (259.36 → 0.20); the hands open 260.45 → 1.58; the swords hit the sand 260.72 → 1.90; the late Lydian lets go 260.83 → 3.54, his sword lands 261.04 → 3.715; still to 262.72 → 5.0 (S77 traces this frame) |
| S78 | P57 (2) + P39 (1) | v2: she is P57 (registered into P39's frame), the room is P39's painted background. Typing poses on the ticks over held bodies f13 / f49 / f69; the lean f33→f45 lands on dt.shift 268.081; back f55→f67; the commit burst f71→f92 |
| S79 | P55 (1) | v2, the kings' oath (P40 is unused): the clasp's shake 270.04 → 0.42, settled by 270.30 → 0.68; the hold runs at 0.61x to 273.40 → 2.58 |
| S80–S81 | P58 (2) | v2: the face held on f30 (the smirk throughout); the shoulder redrawn on the clicks: lifts f12–f18 / f39–f45 / f69–f78, presses f24 / f48 / f84 on 273.455 / 274.025 / 274.927; the wink is drawn (eye.js), shut on 276.947 |

## Weak spots to know about

* **P02** (take 1, pass 3): Land dim (mean 0.12); a black sun + corona is drawn in the sky (renderer paints over); faces-up not readable at army scale.
* **P12** (take 1, pass 3): Contre-jour (sun in frame), faces in shadow; strikes ~0.1-0.8 s late.
* **P18** (take 2, pass 3): 2 Lydians : 4 Medes (not alternating); wave ~1.4 s late.
* **P01** (take 1, pass 4): the brief's *mass battle at the ford, seen from high* is missing: the high part is the static master with armies in ranks, and the fighting only appears as the camera descends. A no-board retake (take 3) never came back from the provider. The renderer can animate the high wides or composite P01's later frames.

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
| P27 | 6 | 5.55 |
| P28 | 4 | 4.62 |
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
| P42 | 2 | 2.31 |
| P43 | 2 | 2.31 |
| P44 | 1 | 1.16 |
| P45 | 1 | 1.16 |
| P46 | 4 | 7.40 |
| P47 | 2 | 2.31 |
| **total** | **88** | **111.67** |

## Plate table

| Plate | Shots | Chosen | Verdict | t0 | Sync keys song→plate (offset) | Known issues |
|---|---|---|---|---|---|---|
| P01 | S04-06, S16, S20, S24, S30, S35, S44 | take1 | pass 4 | 7.18 | 10.69→4.50 (+0.99) | Parade ranks (no battle) in the high part (plate 0-4.5 s); the camera then descends into the melee. |
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
| P12 | S19, S27 (v2: S17 is P48, S18 P49; S36/S37 moved to P42-P46 in the 02:43 shot list) | take1 | pass 3 | 44.73 | 46.06→2.12 (+0.79); 47.56→3.30 (+0.47); 48.91→3.88 (-0.30); 49.53→5.20 (+0.40); 50.63→6.05 (+0.15); 51.48→6.90 (+0.15) | Contre-jour (sun in frame), faces in shadow; strikes ~0.1-0.8 s late. |
| P13 | S21 | take2 | pass 4 | 58.72 | 59.60→1.00 (+0.12); 62.20→3.50 (+0.02) | - |
| P14 | S23, S36, S41, S47 | take2 | pass 4 | 65.67 | 67.73→2.00 (-0.06) | Face dark for the first 1.6 s; upward gaze ~2.8 s (S41/S47 want ~3.4 s). |
| P15 | S25 | take2 | pass 4 | 74.41 | 77.88→3.38 (-0.10) | - |
| P16 | S26 | take1 | pass 4 | 81.36 | 84.38→2.50 (-0.52) | Thin horizontal lens-flare streak at 2.8-3.5 s. |
| P17 | S27 | take1 | pass 4 | 85.91 | 88.69→2.85 (+0.07) | Dapples are round spots (renderer paints the crescents). |
| P18 | unused since v2 (S28 is P50) | take2 | pass 3 | 89.22 | 89.78→2.00 (+1.44); 91.31→3.50 (+1.41) | 2 Lydians : 4 Medes (not alternating); wave ~1.4 s late. |
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
| P27 | S52 | take6 | pass 5 | 181.23 | 181.23→0.42 (+0.42) | Matte joins him to the warriors at 0-0.33 s and after 2.67 s: start S52 at plate 0.42. |
| P28 | S53, S54 | take4 | pass 5 | 184.64 | 187.65→2.75 (-0.26) | Darker frame (silhouetted crowd); no staff any more (short gnomon). |
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
| P39 | S78 (the painted room since v2; she is P57) | take1 | pass 4 | 266.12 | 1:1 from t0 | Blue back circle faint. |
| P40 | unused since v2 (S79 is P55) | take2 | pass 5 | 268.3 | 270.04→2.10 (+0.36) | The v1 chair spin; no shot reads it. |
| P41 | unused since v2 (S80–S81 are P58) | take4 | pass 4 | 273.4 | 276.95→4.45 (+0.90) | The v1 deadpan close-up; no shot reads it. |
| P42 | S35, S36 | take2 | pass 4 | 110.58 | 110.98→1.00 (+0.60); 111.44→1.60 (+0.74); 111.86→2.90 (+1.61); 112.31→4.50 (+2.77) | Reactions spread over 1.0-4.5 s rather than on consecutive kicks. |
| P43 | S35, S36 | take2 | pass 4 | 110.58 | 111.89→1.10 (-0.21); 111.44→1.80 (+0.94); 111.86→3.50 (+2.21); 112.31→4.30 (+2.58) | Amulet small, arm grab subtle; reactions spread over 1.1-4.3 s. |
| P44 | S35, S36 | take1 | pass 4 | 110.58 | 111.45→0.92 (+0.04) | The Mede is already dismounted at the start. |
| P45 | S36 | take1 | pass 4 | 112.31 | 1:1 from t0 | Cuts at 1.79/3.08/4.38 s (asked 1.25/2.5/3.75); Cyaxares' shot is 0.66 s. |
| P46 | S37 | take4 | pass 4 | 117.53 | 1:1 from t0 | Both crossed spears held by Lydians (the central Mede kneels); 4:3 figures. |
| P47 | S31b | take2 | pass 4 | 100.24 | 102.21→1.90 (-0.07) | Comrade bareheaded; background ranks static (no readable faces-up wave). |
| P48 | S17 (v2) | take1 | pass 4 | 44.06 | 46.06→2.00 (+0.00) | Golden dust haze over the far melee (asked for clear air): the renderer paints its sky and sun into it. Take 2 renamed `rejected_take2.*`. |
| P49 | S18 (v2) | take2 | pass 4 | 46.49 | 1:1 from 0.70 s in (46.49→0.70) | The plate's sun sits on the horizon behind the fighters: S18 keys the silhouettes and paints its own sun higher. |
| P50 | S28 (v2) | take2 | pass 4 | 88.28 | 89.78→1.90 (+0.40); 90.20→2.25 (+0.33); 90.60→2.60 (+0.28); 90.87→2.90 (+0.31); 91.31→3.30 (+0.27) | The central Mede stays behind his wicker shield: five faces turn up, not six. |
| P51 | S61 (v2) | take1 | pass 4 | 208.7 | 209.10→1.38 (+0.98); 209.55→2.28 (+1.43); 209.945→2.66 (+1.42); 210.18→2.95 (+1.47) | The stop and the drop land ~1.4 s late (retimed). At army scale the drop reads mainly through the centre Lydian's sword and the empty hands. MediaPipe takes the Mede's wicker shield for a face (S61 paints no eyes). |
| P52 | S61b (v2) | take2 | pass 4 | 210.18 | 210.18→2.50 (+2.50); 210.42→2.88 (+2.64); 211.30→3.92 (+2.80); 211.44→4.04 (+2.78) | The hand holds still for 2.8 s before it opens: S61b uses the plate's last 1.5 s. |
| P53 | S62 (v2) | take2 | pass 4 | 211.44 | 1:1 from 0.10 s in (211.44→0.10) | The brush engine paints cream scraps onto the thin dark far bank under the walking men, so S62 forces the second brush layer everywhere. |
| P54 | S75, S76 (v2) | take5 | pass 4 | 259.355 | 259.36→0.20 (+0.20); 260.45→1.58 (+0.49); 260.72→1.90 (+0.54); 260.83→3.54 (+2.07); 261.04→3.715 (+2.03); 262.72→5.0 (+1.64) | The late drop comes 1.65 s after the others in the plate, against 0.43 s in the music: the held sword is squeezed into one drawing. The swords stick upright in the sand. |
| P55 | S79 (v2) | take1 | pass 4 | 269.54 | 270.04→0.42 (-0.08); 270.30→0.68; 273.40→2.58 (the hold slowed to 0.61x) | Profile faces: MediaPipe finds only Syennesis, so the faces, clasp and cuts are tracked by hand in treaty.js; Cyaxares' akinakes is at his left hip. |
| P57 | S78 (v2) | take2 | pass 4 | 266.12 | poses by hand: lean stop 1.79 s → 268.081 (dt.shift); typing poses per tick (x-sheet) | Starts on keyframe K78d (first frame). The lamp is unlit in the keyframe (only she is used). The plate's print is flat: the renderer wraps it round her back and kinks and shades it with the plate's measured folds. |
| P58 | S80, S81 (v2) | take2 | pass 4 | 273.4 | presses f24 / f48 / f84 → 273.455 / 274.025 / 274.927 | Starts on keyframe K80b. Tracing thins the smirk and the narrowed lids: the renderer draws the mouth line, crease, heavy lids and catchlights (expr.js). |

## Per plate

### P01 · Master composition by day

* **Shots:** S04-06, S16, S20, S24, S30, S35, S44. **Window:** song [7.18, 22.18], audio reference cut at t0 = 7.18 s (Halys.mp3), 15 s, 2 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P01/take1.mp4`; analysis in `video/plates/P01/` (frames 361, fields 361, mattes 181, depth 181, gain 1.027). Opens exactly on the canonical master composition (halys_wide3) and holds it for 4.5 s, then a clean descent while the armies surge into the ford; the river stays visible. Take 2 floods the riverbed. Take 3 (no-board retake for a high drift over a battle already raging) never came back from the provider and was abandoned.
* **Delivers:** Opens exactly on the canonical master composition (halys_wide3): river straight to the sun at the vanishing point, Lydians left, Medes right, mirrored, armies in parade ranks; this static master holds for plate 0-4.5 s. Then the camera descends (4.5-8.5 s) as both armies surge into the river, ending in a ground-level melee in the ford (8.5-15 s).
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 10.690 → 4.50 (+0.99 s) · S06 descent begins
* **Timing notes:** S05 (7.18-10.69) = plate 0-3.5 at 1:1. The descent starts at plate ~4.5: key 10.69 -> 4.5 to open S06 on the move (at plain 1:1, S06 = plate 3.5-7.0 and opens with ~1 s of the static master). Later wides (S16, S20, S24, S30, S35, S44): the static master, plate 0-4.5 (slow or hold it for S24's 7 s). The armies charge into the ford at 6.5-9 s.
* **Checks:** Lydians crested helmets, crimson tunics, crimson lion shields; Medes red caps, ochre tunics, wicker shields; standards on poles (lion, horse), no flags · Army-level; the close melee figures at 12-15 s read as the two sides · None seen at sheet scale; dense melee in the last 3 s should not be used for figure work
* **Notes for the renderer:** No battle at the ford in the high part (armies stand in ranks); the fighting only appears as the camera comes down. Do not use the dense melee of the last 3 s for figure work.
* **Review sheet:** `media/plates/P01/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P01/take1.sheet.jpg`.
* Take 2: pass 3: Armies flood the riverbed late; ignores 'stay high'/'battle already raging': the WIDE ref acts as a first frame.
* Take 3: abandoned: Never returned by the provider (abandoned after 5.5 h).

### P02 · Master view at totality

* **Shots:** S01-02. **Window:** song [0.0, 8.0], audio reference cut at t0 = 0.0 s (Halys.mp3), 8 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P02/take1.mp4`; analysis in `video/plates/P02/` (frames 193, fields 193, mattes 97, depth 97, gain 2.2). Only take; matches the totality board, frozen armies, analysable.
* **Delivers:** S01-02 base: the master view at totality, matched to halys_totality3 (same river, banks, armies), frozen armies, slow push-in, orange 360-degree horizon glow.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Armies are dark silhouettes (army-level only) · The black sun + corona and Jupiter are drawn (copied from the board) although the prompt asked for an empty sky; the renderer paints the eclipse over it. Land is dim: mean 0.12, p95 0.30 (analysable; pipeline gain lifts it)
* **Notes for the renderer:** 1:1 from t0 = 0. Upturned faces are not readable at this scale.
* **Review sheet:** `media/plates/P02/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P02/take1.sheet.jpg`.

### P03 · The Lydian arms

* **Shots:** S07. **Window:** song [14.19, 19.19], audio reference cut at t0 = 14.19 s (Halys.mp3), 5 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P03/take1.mp4`; analysis in `video/plates/P03/` (frames 121, fields 121, mattes 61, depth 61, gain 1.551). Only take; strong.
* **Delivers:** S07 delivered: seats the crested helmet (0-0.4 s), presses the cheek-pieces (1.0-3.0 s), hands down and looks off frame right (3.6-4.0 s); faces right in a warm light pool; dark riverbank with soldier ranks behind, clean separation.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Matches the sheet: Corinthian helmet pushed up, red/black crest, braids, short beard, bronze scales, crimson tunic, baldric. Knucklebone on its cord reads as a small DARK pendant, not ivory · Same face as media/chars/lydian.jpg (virtual-avatar route kept identity) · None seen (hands on the helmet clean)
* **Notes for the renderer:** Use 1:1 from t0 (cut-in 14.19 = plate 0.0; S07 cut-out 17.66 = plate 3.47, hands come down at ~3.7). Renderer: paint the knucklebone ivory.
* **Review sheet:** `media/plates/P03/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P03/take1.sheet.jpg`.

### P04 · The Mede, his mirror

* **Shots:** S08, S42. **Window:** song [17.66, 22.66], audio reference cut at t0 = 17.66 s (Halys.mp3), 5 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P04/take1.mp4`; analysis in `video/plates/P04/` (frames 121, fields 121, mattes 61, depth 61, gain 1.617). Only take; strong mirror of P03.
* **Delivers:** S08 delivered: mirror of P03, three-quarters toward frame left, grips the spear (0.6-0.9 s), stands resolute looking left; dark riverbank with soldier ranks behind.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Red felt cap with ear flaps, black curly beard, long ochre sleeves, iron scale corselet, baldric; the terracotta toy horse is visible at his belt. Sword not in frame (cropped at the waist) · Matches media/chars/mede.jpg · None
* **Notes for the renderer:** 1:1 from t0. Light on the broad side of his face (equal to P03).
* **Review sheet:** `media/plates/P04/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P04/take1.sheet.jpg`.

### P05 · Alyattes on horseback (diptych left)

* **Shots:** S09, S22, S43. **Window:** song [21.15, 27.15], audio reference cut at t0 = 21.15 s (Halys.mp3), 6 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P05/take1.mp4`; analysis in `video/plates/P05/` (frames 145, fields 145, mattes 73, depth 73, gain 1.2). Only take; mirrors P06.
* **Delivers:** S09/S22 left panel: Alyattes on a chestnut horse facing right, raises his right hand (1.7-2.4 s), turns and shouts at ~4.0 s; gold lion standard on a pole, Lydian spear ranks behind; king centred for the half-frame crop.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 23.300 → 2.40 (+0.25 s) · ostinato stops, rubato swell
* **Timing notes:** S09 (21.15-25.50): hand rises 1.7-2.4 s (up at 2.4 on the 23.3 swell). S22 (62.20-65.67): use the shout section, plate 3.6-6.0 (mouth opens at 4.0); S43 any section.
* **Checks:** Gold fillet, grey-streaked long hair, full beard, purple mantle with gold meander border over a white chiton (court dress per the sheet); crimson saddlecloth, bronze bridle, no stirrups · Matches media/chars/alyattes.jpg · None. Background is a bright warm sky (low angle), not dark
* **Notes for the renderer:** Matches P06 (same framing, light and timing).
* **Review sheet:** `media/plates/P05/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P05/take1.sheet.jpg`.

### P06 · Cyaxares on horseback (diptych right)

* **Shots:** S09, S22, S43. **Window:** song [21.15, 27.15], audio reference cut at t0 = 21.15 s (Halys.mp3), 6 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P06/take1.mp4`; analysis in `video/plates/P06/` (frames 145, fields 145, mattes 73, depth 73, gain 1.0). Only take; mirrors P05.
* **Delivers:** S09/S22 right panel: Cyaxares on a dark bay facing left, raises his LEFT hand (2.3-2.6 s), turns toward his men and shouts at ~4.0 s; bronze horse standard on a pole, Median ranks behind; mirror of P05.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 23.300 → 2.55 (+0.40 s) · ostinato stops, rubato swell
* **Timing notes:** S09: left hand rises 2.3-2.6 s (up at 2.55 on the 23.3 swell). S22: use plate 3.6-6.0 (turns to his men and shouts at ~4.0); mirrors P05.
* **Checks:** Madder cap with gold band, grey curled beard, saffron tunic, ochre kandys as a cape, belt of gold plaques; no stirrups. Sword/bow not clearly visible · Matches media/chars/cyaxares.jpg · None. Bright warm sky behind (low angle)
* **Notes for the renderer:** Pairs with P05.
* **Review sheet:** `media/plates/P06/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P06/take1.sheet.jpg`.

### P07 · Front lines surge into the river

* **Shots:** S10. **Window:** song [25.5, 30.5], audio reference cut at t0 = 25.5 s (Halys.mp3), 5 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P07/take2.mp4`; analysis in `video/plates/P07/` (frames 121, fields 121, mattes 61, depth 61, gain 1.0). Symmetric, as specified (take 1 was two-thirds Lydian).
* **Delivers:** S10 delivered: mirror-symmetric waterline charge: two equal lines (Lydian crests and crimson left, wicker shields right) converge in a V, legs churning the water, the gap closing in the centre, no collision.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Army-level correct · Sun at the top-right corner; bright sky
* **Notes for the renderer:** Use plate 0-1.74 (up to the boom).
* **Review sheet:** `media/plates/P07/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P07/take2.sheet.jpg`.
* Take 1: pass 3: Not mirror-symmetric (Lydians fill 2/3 of the frame); bright sky.

### P08 · The clash on the boom

* **Shots:** S11. **Window:** song [26.0, 31.0], audio reference cut at t0 = 26.0 s (Halys.mp3), 5 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P08/take1.mp4`; analysis in `video/plates/P08/` (frames 121, fields 121, mattes 61, depth 61, gain 1.0). Only take; impact reads, spray crown.
* **Delivers:** S11 delivered: both lines rush in, the central shields collide and stop dead at plate 1.58, a crown of red-clay spray rises from 1.9 s and hangs in slow motion.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 27.240 → 1.58 (+0.34 s) · BOOM: shields collide
* **Checks:** Lydian crest/crimson/scales/lion shield vs Mede red cap/ochre/iron scales/wicker shield · Consistent with the sheets · The spray is very red (reads as river clay in context); after 1.7 s the shot is near-frozen slow motion. Sun at the right edge, bright sky
* **Notes for the renderer:** Impact 27.24 = plate 1.58 (+0.34).
* **Review sheet:** `media/plates/P08/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P08/take1.sheet.jpg`.

### P09 · Lydian cavalry charge

* **Shots:** S13. **Window:** song [32.47, 37.47], audio reference cut at t0 = 32.47 s (Halys.mp3), 5 s, 3 take(s) reviewed.
* **Chosen:** take 3 → `media/plates/P09/take3.mp4`; analysis in `video/plates/P09/` (frames 121, fields 121, mattes 61, depth 61, gain 1.011). Only take with levelled lances, side light and a dark background (takes 1-2 raised the spears against a bright sky).
* **Delivers:** S13 delivered: five Lydian riders gallop through the knee-deep shallows straight at the camera, side-lit gold from frame right against a dark far bank; lances levelled forward toward the lens; spray lit gold; the lead horse grows to a third of the frame and stays sharp.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Crested open-faced helmets, crimson, ochre cloaks, saddlecloths, no stirrups · Army-level, consistent with the cavalry sheets · None
* **Notes for the renderer:** 1:1 from t0; use plate 0-3.5 for S13.
* **Review sheet:** `media/plates/P09/take3.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P09/take3.sheet.jpg`.
* Take 1: pass 3: Spears held raised, not lowered; sun in frame with a bright sky (SHALLOWS ref); the pass-by (3.5-4.7 s) is motion-blurred.
* Take 2: pass 3: Spears still held raised (not lowered); bright sky behind; the lead horse brushes past at the end.

### P10 · Median archers loose

* **Shots:** S14. **Window:** song [35.98, 40.98], audio reference cut at t0 = 35.98 s (Halys.mp3), 5 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P10/take1.mp4`; analysis in `video/plates/P10/` (frames 121, fields 121, mattes 61, depth 61, gain 1.0). Only take; the loose lands on the timpani.
* **Delivers:** S14 delivered: a disciplined kneeling rank of hooded Median archers at full draw (0-2.1 s), all loose in unison at 2.21 s, arrows streak across the sky to frame right, bows lower.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 38.230 → 2.21 (-0.04 s) · timpani: the loose
* **Checks:** Undyed felt hoods with flaps, ochre tunics, sheepskin cloaks, dark trousers, composite bows; individual faces; sword side not visible · Matches media/chars/median_archer.jpg · None. No standing second rank; bright sky behind (low angle)
* **Notes for the renderer:** The loose lands on the 38.23 timpani (-0.04 s).
* **Review sheet:** `media/plates/P10/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P10/take1.sheet.jpg`.

### P11 · They see each other (two singles)

* **Shots:** S15. **Window:** song [39.48, 44.48], audio reference cut at t0 = 39.48 s (Halys.mp3), 5 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P11/take1.mp4`; analysis in `video/plates/P11/` (frames 121, fields 121, mattes 61, depth 61, gain 1.788). Only take; mirrored singles with a clean cut.
* **Delivers:** S15 delivered: two mirrored singles, hard cut at plate 2.0 (asked 2.5). Shot 1 (0-2.0): the Lydian in a dark melee looks off toward frame right. Shot 2 (2.0-5.0): the Mede turns from frame right to camera-left, recognition; both faces warm-lit, dark melee behind.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 41.240 → 2.00 (+0.24 s) · cut out
* **Checks:** Correct on both (crest/braids/scales/crimson; red cap/beard/ochre/iron scales) · Both match their sheets · None
* **Notes for the renderer:** Renderer: Lydian = plate 0-2.0, Mede = plate 2.0-5.0; cut S15 on beat 3 wherever needed.
* **Review sheet:** `media/plates/P11/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P11/take1.sheet.jpg`.

### P12 · The duel

* **Shots:** S17, S19, S27 (S36/S37 moved to P42-P46 in the 02:43 shot list). **Window:** song [44.73, 52.73], audio reference cut at t0 = 44.73 s (Halys.mp3), 8 s, 2 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P12/take1.mp4`; analysis in `video/plates/P12/` (frames 193, fields 193, mattes 97, depth 97, gain 1.0). Clean, symmetric, equal-size exchanges with sharp stops; its first exchange (S17: the thrust turned by the lion shield) is clean, whereas take 2's is a motion-blurred shield across the lens and its figures are unequal. Take 2 has nicer side light (alternate for S19/S27). (S37's orbit now uses P46.)
* **Delivers:** S17/S19 duel delivered: full figures, mirrored, six readable exchanges with sharp stops.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 46.060 → 2.12 (+0.79 s) · beat: first thrust turned by the lion shield
  * 47.563 → 3.30 (+0.47 s) · stab
  * 48.912 → 3.88 (-0.30 s) · stab
  * 49.533 → 5.20 (+0.40 s) · stab
  * 50.633 → 6.05 (+0.15 s) · stab + timpani
  * 51.484 → 6.90 (+0.15 s) · stab
* **Checks:** Lydian helmet/crest/crimson tunic/scales and lion shield (lion barely visible, backlit); Mede red cap, ochre tunic, iron scales, wicker shield, sword on the right thigh · Consistent with the sheets; faces small and backlit · None serious; spears cross in the air at 4.5-4.9 s (plausible). Light is CONTRE-JOUR: the sun sits in frame at the centre (copied from the SHALLOWS ref), not raking from frame right; faces mostly in shadow
* **Notes for the renderer:** Exchanges at plate 2.12, 3.30, 3.88, 5.20, 6.05, 6.90.
* **Review sheet:** `media/plates/P12/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P12/take1.sheet.jpg`.
* Take 2: pass 3: The Lydian's shield swings across the lens at 2.38-2.88 s with heavy motion blur (this is the first exchange S17 needs); the Lydian is nearer the camera and larger than the Mede (not equal size).

### P13 · Knocked into the water

* **Shots:** S21. **Window:** song [58.72, 63.72], audio reference cut at t0 = 58.72 s (Halys.mp3), 5 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P13/take2.mp4`; analysis in `video/plates/P13/` (frames 121, fields 121, mattes 61, depth 61, gain 1.214). Side light and darker background with the same action, closer to the beat than take 1.
* **Delivers:** S21 delivered: side-lit, darker background; the Mede's shield bash knocks the Lydian back into the water with a big splash at ~1.0 s; the spear comes down at ~2.1 s; the Lydian rolls and rises to one knee behind his lion shield by ~3.5 s.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 59.600 → 1.00 (+0.12 s) · timpani: knocked down
  * 62.200 → 3.50 (+0.02 s) · cut out
* **Timing notes:** Knock-down splash at plate 1.0 (59.60 timpani, +0.12 s); spear stabs the water at 2.1; up on one knee at 3.5 = S21 cut-out 62.20.
* **Checks:** Correct · Match · None
* **Notes for the renderer:** Knock-down +0.15 s vs the 59.60 timpani.
* **Review sheet:** `media/plates/P13/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P13/take2.sheet.jpg`.
* Take 1: pass 3: Backlit with the sun in frame (SHALLOWS ref); no gore.

### P14 · One face in the chaos

* **Shots:** S23, S36, S41, S47. **Window:** song [65.67, 70.67], audio reference cut at t0 = 65.67 s (Halys.mp3), 5 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P14/take2.mp4`; analysis in `video/plates/P14/` (frames 121, fields 121, mattes 61, depth 61, gain 1.709). Longer upward gaze in awe (from 2.0 s; S41/S47 need it) and the light grows on his face; take 1 is the alternate with a better-lit opening.
* **Delivers:** S23/S36/S41/S47: breathing in the dark melee (0-1.6 s), eyes rise from 2.0 s, a long upward gaze in awe with wet eyes from 2.8 s to the end; the light grows on his face as he looks up.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 67.730 → 2.00 (-0.06 s) · first sung word: the frame is still
* **Checks:** Corinthian helmet, braids, scale corselet, crimson tunic · Matches the sheet · None; the face is darker in the first 1.6 s
* **Notes for the renderer:** Chosen candidate: the look-up lasts ~2.8 s (S41/S47 need ~3.4 s: slow or hold the end).
* **Review sheet:** `media/plates/P14/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P14/take2.sheet.jpg`.
* Take 1: pass 4: None.

### P15 · Face-off, then the shore melee

* **Shots:** S25. **Window:** song [74.41, 81.41], audio reference cut at t0 = 74.41 s (Halys.mp3), 7 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P15/take2.mp4`; analysis in `video/plates/P15/` (frames 169, fields 169, mattes 85, depth 85, gain 1.052). Side-lit symmetric face-off and a readable mirrored shore melee after a cut that lands on 77.88; take 1's melee is tiny and far.
* **Delivers:** S25 delivered: symmetric face-off in the shallows, Lydian left / Mede right in profile, shields up, spears lowered, circling (0-3.375 s); hard cut at 3.375 s to a mirrored side-on wide of the shore melee: a long line of Lydians and Medes clashing on the bank, dust, river in the foreground.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 77.880 → 3.38 (-0.10 s) · cut to the shore melee
* **Checks:** Correct on both heroes; melee figures read as the two sides at silhouette scale · Matches the sheets · None
* **Notes for the renderer:** The cut lands on 77.88 (-0.10 s): use 1:1 from t0.
* **Review sheet:** `media/plates/P15/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P15/take2.sheet.jpg`.
* Take 1: pass 3: Shot 2 melee is tiny and far (top of frame); bright sky.

### P16 · Bronze macro

* **Shots:** S26. **Window:** song [81.36, 86.36], audio reference cut at t0 = 81.36 s (Halys.mp3), 5 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P16/take1.mp4`; analysis in `video/plates/P16/` (frames 121, fields 121, mattes 61, depth 61, gain 1.466). Only take.
* **Delivers:** S26 delivered: macro slide across the crimson lion shield and its convex bronze rim (0-2.2 s), up over the crested Corinthian helmet (2.2-5 s); the low sun's glint flashes across the bronze at ~2.5 s.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 84.380 → 2.50 (-0.52 s) · 'bronze': the glint sweeps
* **Checks:** Lion blazon and helmet exactly as the sheet · Sheet props · A thin horizontal lens-flare streak at 2.8-3.5 s (renderer ignores/repaints)
* **Notes for the renderer:** Glint ~2.5 s vs 'bronze' 84.38 (plate 3.02): -0.5 s.
* **Review sheet:** `media/plates/P16/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P16/take1.sheet.jpg`.

### P17 · Light went strange

* **Shots:** S27. **Window:** song [85.91, 89.91], audio reference cut at t0 = 85.91 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P17/take1.mp4`; analysis in `video/plates/P17/` (frames 97, fields 97, mattes 49, depth 49, gain 1.608). Only take.
* **Delivers:** S27 delivered: the Lydian beside the edge of a big wicker shield (frame right); small bright dapples of light on his scales, shield and face; glances down at his chest (0.8-1.8 s), lifts his face to the sky toward frame right from ~2.8 s (on 'strange' 88.69).
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 88.690 → 2.85 (+0.07 s) · 'strange': he looks up
* **Checks:** Correct (helmet, braids, scales, crimson, lion shield) · Matches · Dapples are round spots (renderer paints the stretched crescents)
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P17/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P17/take1.sheet.jpg`.

### P18 · Faces turn up one after another

* **Shots:** S28. **Window:** song [89.22, 93.22], audio reference cut at t0 = 89.22 s (Halys.mp3), 4 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P18/take2.mp4`; analysis in `video/plates/P18/` (frames 97, fields 97, mattes 49, depth 49, gain 2.144). Readable wave of upturned faces (take 1's was invisible).
* **Delivers:** S28: six warriors chest-up against a dark bank (2 Lydians, 4 Medes); faces turn up one after another left to right (first ~2.0 s, all six up by ~3.5 s) and hold.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 89.780 → 2.00 (+1.44 s) · 'halo'
  * 91.310 → 3.50 (+1.41 s) · boom 'warriors': all faces up
* **Checks:** Correct · Consistent · Not strictly alternating (L, M, M, L, M, M); the wave is late (+1.4 s) and the first part is static
* **Notes for the renderer:** Retime: the 91.31 boom = all faces up at plate ~3.5.
* **Review sheet:** `media/plates/P18/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P18/take2.sheet.jpg`.
* Take 1: weak 2: Pale beach-like shore and bright sky; subject motion tiny (max 0.18 px/frame).

### P19 · The Lydian's eye

* **Shots:** S29, S36. **Window:** song [93.0, 97.0], audio reference cut at t0 = 93.0 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P19/take1.mp4`; analysis in `video/plates/P19/` (frames 97, fields 97, mattes 49, depth 49, gain 1.568). Only take.
* **Delivers:** S29 delivered: XCU of the Lydian's eye inside the bronze cheek-piece edge; the eye opens wide by 0.9 s (on 'eye' 93.95) and holds an upward gaze, pupil dark with a sky glint.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 93.950 → 0.90 (-0.05 s) · 'eye'
* **Checks:** Bronze cheek-piece edge, weathered skin · Matches · Eyelid half-lowered in the first 0.3 s (reads as a squint opening)
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P19/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P19/take1.sheet.jpg`.

### P19b · The Mede's eye

* **Shots:** S42 (and S36). **Window:** song [93.0, 97.0], audio reference cut at t0 = 93.0 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P19b/take1.mp4`; analysis in `video/plates/P19b/` (frames 97, fields 97, mattes 49, depth 49, gain 1.627). Only take.
* **Delivers:** S42 Mede variant: XCU of the Mede's eye under the red felt cap edge, brown iris, steady gaze up and to the left.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Red cap edge visible · Matches · None
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P19b/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P19b/take1.sheet.jpg`.

### P20 · Every face up on the boom

* **Shots:** S31, S55. **Window:** song [100.24, 104.24], audio reference cut at t0 = 100.24 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P20/take1.mp4`; analysis in `video/plates/P20/` (frames 97, fields 97, mattes 49, depth 49, gain 2.2). Only take; faces-up in unison on the 102.21 boom.
* **Delivers:** S31/S55 delivered: mirrored converging ranks (Lydians left, Medes right) in profile against an orange horizon glow under a dark umber sky (readable dusk); everyone still, then every face lifts in unison peaking at plate 2.04 (the 102.21 boom, +0.07 s) and holds; empty sky in the V for the black sun.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 102.210 → 2.04 (+0.07 s) · BIGGEST BOOM: every face up in unison
* **Checks:** Correct on both sides (crests, scales, crimson; red caps, beards, ochre, wicker shields) · Army-level · None
* **Notes for the renderer:** Use 1:1 from t0.
* **Review sheet:** `media/plates/P20/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P20/take1.sheet.jpg`.

### P21 · Throw down your blade

* **Shots:** S32. **Window:** song [103.64, 107.64], audio reference cut at t0 = 103.64 s (Halys.mp3), 4 s, 3 take(s) reviewed.
* **Chosen:** take 3 → `media/plates/P21/take3.mp4`; analysis in `video/plates/P21/` (frames 97, fields 97, mattes 49, depth 49, gain 2.2). Only take with the sword falling into the water with a splash (takes 1-2 on dry gravel).
* **Delivers:** S32 delivered: mirrored profile two-shot knee-deep in the river at dusk; frozen, then facing each other; the Lydian's sword drops into the water at ~2.46 s with a clear splash at his feet; still afterwards.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 104.960 → 2.46 (+1.14 s) · 'blade': the sword hits the water
* **Checks:** Correct · Match · Flat, featureless water horizon; mutual gaze is in profile only
* **Notes for the renderer:** Drop +1.14 s vs 'blade' 104.96.
* **Review sheet:** `media/plates/P21/take3.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P21/take3.sheet.jpg`.
* Take 1: pass 3: They stand on the gravel bank, NOT in the water: the sword falls onto stones, no splash. Mutual gaze is weak.
* Take 2: weak 2: On the bank, not in the water; the drop does not read.

### P22a · Hand opens: the knucklebone

* **Shots:** S33 (left panel). **Window:** song [105.85, 109.85], audio reference cut at t0 = 105.85 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P22a/take1.mp4`; analysis in `video/plates/P22a/` (frames 97, fields 97, mattes 49, depth 49, gain 1.596). Only take (flip for the mirrored diptych).
* **Delivers:** S33 left panel delivered: the Lydian's loose fist (crimson sleeve, bronze scales at frame right) opens from 1.2 s to reveal an ivory, lumpy astragalus on a thin cord; open palm held from 2.3 s.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Knucklebone exactly like the sheet inset (ivory here, unlike P03) · Sheet prop · Five natural fingers, no artefacts. The hand enters from the RIGHT (same side as P22b), so the pair is not mirrored
* **Notes for the renderer:** Renderer: flip P22a horizontally for the mirrored diptych (safe: no sword or text in frame).
* **Review sheet:** `media/plates/P22a/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P22a/take1.sheet.jpg`.

### P22b · Hand opens: the clay horse

* **Shots:** S33 (right panel). **Window:** song [105.85, 109.85], audio reference cut at t0 = 105.85 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P22b/take1.mp4`; analysis in `video/plates/P22b/` (frames 97, fields 97, mattes 49, depth 49, gain 1.896). Only take.
* **Delivers:** S33 right panel delivered: the Mede's fist (ochre sleeve, red rosette cuff) enters from frame right, opens from 2.0 s to reveal the terracotta toy horse in his palm, holds open from 3.0 s; black background, warm rim.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Rosette cuff as on the sheet; toy horse terracotta (reads, slightly lumpy) · Sheet prop · Fingers count correct; fist partly out of frame in the first 0.4 s
* **Notes for the renderer:** 1:1 from t0 ('home' 107.02 = plate 1.17, the hand is still closing/opening then).
* **Review sheet:** `media/plates/P22b/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P22b/take1.sheet.jpg`.

### P23 · The heroes at totality (cold open)

* **Shots:** S03. **Window:** song [3.65, 7.65], audio reference cut at t0 = 3.65 s (Halys.mp3), 4 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P23/take2.mp4`; analysis in `video/plates/P23/` (frames 97, fields 97, mattes 49, depth 49, gain 2.15). In the water, as specified (take 1 stood on dry gravel).
* **Delivers:** S03 delivered: mirrored two-shot of the heroes standing IN the red-brown water, faces turned up to the dark sky, completely still, a thin orange horizon glow.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Correct on both · Match · Spears held upright (grounded) rather than lowered into the water; the river reads as a flat, wide water body
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P23/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P23/take2.sheet.jpg`.
* Take 1: pass 3: They stand on a dry gravel bank, not in the shallows; spears upright rather than lowered; dusk sky is blue-tinted.

### P24 · Flammarion: palm against the sky

* **Shots:** S38. **Window:** song [124.47, 128.47], audio reference cut at t0 = 124.47 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P24/take1.mp4`; analysis in `video/plates/P24/` (frames 97, fields 97, mattes 49, depth 49, gain 2.073). Only take.
* **Delivers:** S38 delivered: the Lydian from behind/side on a ridge against a dark dusk sky with an orange horizon; raises his right arm and pushes his open, spread palm up against the sky (1.0-3.8 s), leaning up into it.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Helmet + crest, braids, scales, crimson, shield rim at frame bottom · Matches · The 'glass' press reads as a reach with spread fingers (no head push-through)
* **Notes for the renderer:** Palm reaches the 'membrane' ~1.6-2.3 s (kick returns 126.206 = plate 1.74).
* **Review sheet:** `media/plates/P24/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P24/take1.sheet.jpg`.

### P25 · Frozen battle, moving camera

* **Shots:** S45, S46, S49. **Window:** song [153.83, 163.83], audio reference cut at t0 = 153.83 s (Halys.mp3), 10 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P25/take2.mp4`; analysis in `video/plates/P25/` (frames 241, fields 241, mattes 121, depth 121, gain 1.917). Central Lydian-vs-Mede duel frozen mid-strike as specified; take 1 has no central duel.
* **Delivers:** S45/S46/S49 delivered: the Lydian frozen mid-thrust against the Mede blocking with his wicker shield at the centre; riders, archers and spearmen frozen around them; arrows hang in the air; the camera orbits left-to-right through the frozen scene (0-5.6 s), then cranes up and tilts to the dark sky (5.6-10 s).
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Correct (crest, crimson, scales, lion shield; red cap, ochre, iron scales, wicker shield) · Heroes consistent with the sheets · Black sun drawn at the end (renderer paints over); readable warm dusk
* **Notes for the renderer:** 157.03 'cut closer' = plate ~3.1 (orbit mid-way); tilt-up for S49 at plate 5.6-10.
* **Review sheet:** `media/plates/P25/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P25/take2.sheet.jpg`.
* Take 1: pass 3: A black sun is drawn in the sky at the end (renderer paints over).

### P26 · Wind on frozen bodies

* **Shots:** S51. **Window:** song [178.66, 182.66], audio reference cut at t0 = 178.66 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P26/take1.mp4`; analysis in `video/plates/P26/` (frames 97, fields 97, mattes 49, depth 49, gain 1.669). Only take.
* **Delivers:** S51 delivered: three warriors (two Lydians, a Mede) frozen mid-action on the bank at dusk; only the wind moves: crimson cloaks billow, the ribbons under the gold lion standard stream, feather grass bends.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Correct; the Lydians wear crimson cloaks (not on the sheet, plausible) · Consistent · None; orange horizon, readable dusk
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P26/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P26/take1.sheet.jpg`.

### P27 · Thales walks between the statues

* **Shots:** S52. **Window:** song [181.23, 185.23], audio reference cut at t0 = 181.23 s (Halys.mp3), 4 s, 6 take(s) reviewed.
* **Chosen:** take 6 → `media/plates/P27/take6.mp4`; analysis in `video/plates/P27/` (frames 97, fields 97, mattes 49, depth 49, gain 1.69). The new Thales reads clearly in S52's window: a larger figure, fillet and border visible, frozen statues framing him, ending in the medium shot asked for; take 5 is static and clean but Thales is small.
* **Delivers:** S52 with the new Thales: on a riverbank path at dusk he walks toward the lens between a frozen Lydian mid-thrust on the left (crested helmet, crimson tunic, bronze scales, black lion on a crimson shield) and a frozen Mede on the right (red cap, black beard, ochre tunic, iron scales, wicker shield), frozen fighters along the water behind; face tilted up with amused curiosity, shadow-stick in his right hand, tablet in his left; he ends in a medium shot.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 181.230 → 0.42 (+0.42 s) · S52 starts 0.42 s into the plate (before that the matte joins Thales to both warriors' spears)
* **Checks:** Matches the new sheet: short curly dark hair with the thin fillet visible, trimmed curly beard, saffron himation with a dark woven border over a cream chiton, wooden tablet and a short stick (no staff, no red robe, no long hair). Lydian and Mede per sheets; the Mede's sword on his right side · Three distinct men; Thales reads as an Ionian philosopher of the herm type, not as Jesus · Very slight camera drift (~8 px at 1280 over 4 s). Matte: the component nearest the centre joins Thales to the warriors at plate 0-0.33 s (crossing spears) and from 2.67 s (his tablet over the Mede's shield); clean in between
* **Notes for the renderer:** Start S52 0.42 s into the plate (key 181.23 -> 0.42, constant offset), so S52 (2.11 s) runs on plate 0.42-2.53, where the matte component nearest x 0.47 is Thales alone (x 0.42-0.65 with his tablet). No staff any more: a short gnomon and the tablet.
* **Review sheet:** `media/plates/P27/take6.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P27/take6.sheet.jpg`.
* **Previous design:** take 3 (old sheet `media/chars/thales_v1.jpg`) stays analysed in `video/plates/P27_v1/` (index key `P27_v1`, `take` = `media/plates/P27/take3.mp4`); all takes side by side: `media/plates/P27/takes.sheet.jpg`.
* Take 1: pass 3: Old Thales design (thales_v1.jpg); he does not walk (the model orbited the camera instead).
* Take 2: weak 2: Old Thales design (thales_v1.jpg); no real walk; sky too bright for totality.
* Take 3: pass 4: Old Thales design (thales_v1.jpg); clean walk, the frozen men stay still. Chosen until the redesign.
* Take 4: pass 4: Old Thales design (thales_v1.jpg); foreground warriors are big dark masses (less readable).
* Take 5: pass 4: Static and clean, but Thales is small; ends full-figure, not medium.

### P28 · Thales looks into the lens

* **Shots:** S53, S54. **Window:** song [184.64, 189.64], audio reference cut at t0 = 184.64 s (Halys.mp3), 5 s, 4 take(s) reviewed.
* **Chosen:** take 4 → `media/plates/P28/take4.mp4`; analysis in `video/plates/P28/` (frames 121, fields 121, mattes 61, depth 61, gain 1.911). The knowing glance lands at 2.75 (-0.26 s) with only a hint of a sly smile, and the tablet reads as a wax tablet; take 3's smile grows into a broad grin and its tablet looks like a book.
* **Delivers:** S53-S54 with the new Thales: medium close-up before a dark crowd of helmeted silhouettes against the orange eclipse horizon; 0-2.2 s he studies the sky with quick eyes, tapping the shadow-stick on a hinged wooden wax tablet; 2.25-2.7 s he lowers his head with a slow blink; at ~2.75 his eyes meet the lens, his face squares to camera by ~3.2 s, and a sly, knowing half-smile with a slightly raised brow builds from ~3.25 s and holds to the end; slow push-in.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 187.650 → 2.75 (-0.26 s) · the breath: he glances at camera
* **Checks:** Matches the new sheet: short curly hair with the thin fillet, trimmed curly beard, saffron himation with a dark woven border over an undyed chiton; hinged wooden tablet and a short stick (no staff) · Reads as an Ionian philosopher, lively and amused, not saintly · None notable; a darker frame than take 3 (eclipse glow behind), the face well lit
* **Notes for the renderer:** Glance 187.65 -> 2.75 (-0.26 s); the old take 1 glanced at 2.80, so S53's keys barely move. No staff any more (marble.js takes 'his staff from the depth'): a short stick and the tablet.
* **Review sheet:** `media/plates/P28/take4.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P28/take4.sheet.jpg`.
* **Previous design:** take 1 (old sheet `media/chars/thales_v1.jpg`) stays analysed in `video/plates/P28_v1/` (index key `P28_v1`, `take` = `media/plates/P28/take1.mp4`); all takes side by side: `media/plates/P28/takes.sheet.jpg`.
* Take 1: pass 5: Old Thales design (thales_v1.jpg); glance at 2.80, no corona. Chosen until the redesign.
* Take 2: pass 3: Old Thales design (thales_v1.jpg); a huge black sun with a corona drawn right behind his head.
* Take 3: pass 4: Glance 0.4 s early; the smile turns into a broad grin by 4.5 s; tablet looks like a book.

### P29 · Light returns: statues to flesh, the roar

* **Shots:** S57, S58. **Window:** song [194.86, 203.86], audio reference cut at t0 = 194.86 s (Halys.mp3), 9 s, 2 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P29/take1.mp4`; analysis in `video/plates/P29/` (frames 217, fields 217, mattes 109, depth 109, gain 1.35). Clear dusk-to-gold light sweep and statues-to-flesh transition; take 2 starts already golden.
* **Delivers:** S57/S58 delivered: a dense mixed crowd frozen in dim dusk, a wave of golden light sweeps in from the right (1.7-4.0 s) and they come alive, look up and around; both armies roar from ~5.8 s, raising spears and arms, embracing by 8.5 s.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 200.315 → 5.85 (+0.40 s) · 'Shadow turned to day': the roar
* **Checks:** Crests/crimson/lion shields and red caps/ochre/wicker shields mixed · Crowd-level; the front figures read as both sides · Dense crowd at the back merges slightly (fine for a crowd); no stirrups/flags
* **Notes for the renderer:** Roar ~+0.4 s vs 200.315.
* **Review sheet:** `media/plates/P29/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P29/take1.sheet.jpg`.
* Take 2: pass 3: Light is already golden from the start (no clear dusk-to-gold transition).

### P30 · Golden faces, laughter

* **Shots:** S59. **Window:** song [203.39, 207.39], audio reference cut at t0 = 203.39 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P30/take1.mp4`; analysis in `video/plates/P30/` (frames 97, fields 97, mattes 49, depth 49, gain 1.351). Only take.
* **Delivers:** S59 delivered: the Lydian and the Mede side by side, faces lit gold, looking up and laughing with relief; the Mede claps the Lydian's shoulder at ~3.3 s; cheering crowd dark behind.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Correct (crest, braids, scales; red cap, beard, ochre, iron scales) · Match the sheets · None
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P30/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P30/take1.sheet.jpg`.

### P31 · Face to face, still

* **Shots:** S60. **Window:** song [207.4, 211.4], audio reference cut at t0 = 207.4 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P31/take1.mp4`; analysis in `video/plates/P31/` (frames 97, fields 97, mattes 49, depth 49, gain 1.0). Only take.
* **Delivers:** S60 delivered: close mirrored profile two-shot, Lydian left facing right, Mede right facing left, a metre apart, weapons in hand, still, breathing; low sun at the right edge.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Correct · Match · The river surface behind them has an odd pink-white streaked texture
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P31/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P31/take1.sheet.jpg`.

### P32 · Rain of bronze, one sword sinking

* **Shots:** S61. **Window:** song [208.7, 213.7], audio reference cut at t0 = 208.7 s (Halys.mp3), 5 s, 2 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P32/take1.mp4`; analysis in `video/plates/P32/` (frames 121, fields 121, mattes 61, depth 61, gain 1.112). More blades readable in the air; otherwise equal to take 2.
* **Delivers:** S61 delivered: wide backlit river with both armies hurling swords and spears from both banks, a rain of blades arcing through gold air (0-2.17 s); hard cut at 2.17 s to one bronze sword entering the red water point-first and sinking, hilt last, rings spreading (2.2-5 s).
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 209.945 → 1.60 (+0.35 s) · 'blade'
  * 210.180 → 2.17 (+0.69 s) · low end out: hold on the sinking sword
* **Checks:** Army-level correct · None
* **Notes for the renderer:** Hold the sinking sword (plate 2.2-5) under the held 'blade' (210.18-211.88).
* **Review sheet:** `media/plates/P32/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P32/take1.sheet.jpg`.
* Take 2: pass 4: None.

### P33 · A sword tossed into the sky

* **Shots:** S62 (-> S63 match cut). **Window:** song [211.88, 215.88], audio reference cut at t0 = 211.88 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P33/take1.mp4`; analysis in `video/plates/P33/` (frames 97, fields 97, mattes 49, depth 49, gain 1.072). Only take; apex on the Drop 2 kick.
* **Delivers:** S62 delivered: the Lydian on the bank against a golden sky tosses his sword at ~0.8 s; the camera tilts up; the sword spins end over end into the golden clouds and slows to near-still at the apex at ~3.4 s.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 215.287 → 3.40 (-0.01 s) · DROP 2 kick: match cut at the apex
* **Checks:** Correct · Matches · None
* **Notes for the renderer:** Apex lands on the Drop 2 kick (215.287 = plate 3.41).
* **Review sheet:** `media/plates/P33/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P33/take1.sheet.jpg`.

### P34 · Swords into starships

* **Shots:** S63. **Window:** song [215.29, 222.29], audio reference cut at t0 = 215.29 s (Halys.mp3), 7 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P34/take2.mp4`; analysis in `video/plates/P34/` (frames 169, fields 169, mattes 85, depth 85, gain 2.053). Generic silhouette without the Starship flaps of take 1.
* **Delivers:** S63 delivered: a generic polished-steel rocket (pointed ogive nose, three small fins at the base, no flaps) lifts off at dusk on a white-gold flame, climbs centred and vertical, camera tilting up.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Unbranded: no logos, flags or lettering · Steel ring panels still hint at the real thing, but the silhouette is generic
* **Notes for the renderer:** Starts on the pad at plate 0 (Drop 2 kick 215.287): 1:1 from t0.
* **Review sheet:** `media/plates/P34/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P34/take2.sheet.jpg`.
* Take 1: weak 2: Silhouette is essentially SpaceX Starship (forward and aft flaps): conflicts with the style bible's no-Musk-iconography rule.

### P35 · Concorde above the clouds

* **Shots:** S67. **Window:** song [232.27, 236.27], audio reference cut at t0 = 232.27 s (Halys.mp3), 4 s, 3 take(s) reviewed.
* **Chosen:** take 3 → `media/plates/P35/take3.mp4`; analysis in `video/plates/P35/` (frames 97, fields 97, mattes 49, depth 49, gain 1.103). The only take that reads as a Concorde (no tailplane, needle nose).
* **Delivers:** S67 delivered: a Concorde-type SST in clean side profile above a sea of clouds at dusk (needle nose, slender fuselage with a window row, single swept fin and no tailplane, rectangular under-wing nacelle), camera tracking alongside.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Plain white, no markings · Wing planform not visible in pure profile
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P35/take3.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P35/take3.sheet.jpg`.
* Take 1: fail 1: Wrong aircraft type.
* Take 2: weak 2: Has a T-tail and podded engines: not a Concorde.

### P36 · A modern crowd looks up

* **Shots:** S68. **Window:** song [235.66, 239.66], audio reference cut at t0 = 235.66 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P36/take1.mp4`; analysis in `video/plates/P36/` (frames 97, fields 97, mattes 49, depth 49, gain 1.413). Only take.
* **Delivers:** S68 delivered: a mixed modern crowd in a park in paper eclipse glasses looking up; at ~2.1 s arms go up, a child on shoulders raises both arms, several point up.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 237.660 → 2.10 (+0.10 s) · faces lift together
* **Checks:** Plain clothes, no logos · None
* **Notes for the renderer:** Faces-up moment +0.1 s vs plate 2.0.
* **Review sheet:** `media/plates/P36/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P36/take1.sheet.jpg`.

### P37 · Karnak, darkness at noon

* **Shots:** S70. **Window:** song [242.45, 246.45], audio reference cut at t0 = 242.45 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P37/take1.mp4`; analysis in `video/plates/P37/` (frames 97, fields 97, mattes 49, depth 49, gain 1.143). Only take.
* **Delivers:** S70 delivered: looking straight up between massive carved Karnak columns and architraves at a cross of sky, slow rotation, the sky dims from blue to violet dusk.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Blue sky (renderer recolours); carved reliefs, no text
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P37/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P37/take1.sheet.jpg`.

### P38 · Blades up, blades down, one straggler

* **Shots:** S74, S75, S76. **Window:** song [257.68, 262.68], audio reference cut at t0 = 257.68 s (Halys.mp3), 5 s, 4 take(s) reviewed.
* **Chosen:** take 4 → `media/plates/P38/take4.mp4`; analysis in `video/plates/P38/` (frames 121, fields 121, mattes 61, depth 61, gain 1.0). The only take with a clear, natural straggler and the upright-blade barcode (takes 1-2: no straggler; take 3: straggler frozen for 1.5 s).
* **Delivers:** S75/S76 delivered: nine-man front row (Lydians left, Medes right, a straggler Lydian in the centre) with both armies massed behind on the sand; all raise swords at ~2.0 s; the row stabs its blades point-first into the sand at ~2.35 s; the centre man keeps his raised, glances, and stabs his late at ~3.6 s, leaving a row of upright blades (the barcode).
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 259.350 → 2.00 (+0.33 s) · hit: blades raised
  * 260.620 → 2.35 (-0.59 s) · BLADE: all blades slam down
  * 261.050 → 3.60 (+0.23 s) · hit: the straggler's blade lands
* **Checks:** Correct (crests, crimson, scales; red caps, ochre, iron scales) · Consistent · The shrug is barely visible (a small settle at 3.8-4.2 s)
* **Notes for the renderer:** Keys: raise 259.35 = plate 2.0, BLADE 260.62 = 2.35, straggler 261.05 = 3.6 (the late gap is 1.25 s in the plate vs 0.43 s in the music: compress it).
* **Review sheet:** `media/plates/P38/take4.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P38/take4.sheet.jpg`.
* Take 3: pass 3: The straggler holds his raised sword for 1.5 s (reads as frozen rather than late); no shrug.
* Take 1: weak 2: No straggler, no shrug; blades lowered to the sides rather than slammed into the ground.
* Take 2: weak 2: No slam; one stray blade falls at ~3.3 s; dense wall of soldiers.

### P39 · The room, from behind her chair

* **Shots:** S78. **Window:** song [266.12, 270.12], audio reference cut at t0 = 266.12 s (Halys.mp3), 4 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P39/take1.mp4`; analysis in `video/plates/P39/` (frames 97, fields 97, mattes 49, depth 49, gain 1.45). Only take.
* **Delivers:** S78 delivered: from behind her chair (room_a), she types at the ultrawide and side monitors; RARE EARTH and the patch on the back of the white jacket face the camera; window with fog and the red-blinking tower.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Per sheet/ROOM.md (blue circle is faint on the back) · Matches · Screen pseudo-text (renderer replaces)
* **Notes for the renderer:** 1:1 from t0.
* **Review sheet:** `media/plates/P39/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P39/take1.sheet.jpg`.

### P40 · She spins the chair: deadpan

* **Shots:** S79. **Window:** song [268.3, 273.3], audio reference cut at t0 = 268.3 s (Halys.mp3), 5 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P40/take2.mp4`; analysis in `video/plates/P40/` (frames 121, fields 121, mattes 61, depth 61, gain 1.443). Spin lands 1.06 s closer to the chord than take 1 and leaves a longer deadpan hold (2.9 s).
* **Delivers:** S79 delivered: typing from behind (0-1.1 s), one smooth half-turn spin (1.2-2.1 s), facing the camera squarely with a perfect deadpan stare from ~2.1 s to the end (2.9 s of hold).
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 270.040 → 2.10 (+0.36 s) · final stark chord: the spin ends facing camera
* **Checks:** Per sheet · Matches · None
* **Notes for the renderer:** Spin lands ~+0.35 s after the 270.04 chord.
* **Review sheet:** `media/plates/P40/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P40/take2.sheet.jpg`.
* Take 1: pass 4: None; screen pseudo-text (renderer replaces screens).

### P41 · Blind typing and the wink

* **Shots:** S80, S81. **Window:** song [273.4, 279.4], audio reference cut at t0 = 273.4 s (sound-design master), 6 s, 4 take(s) reviewed.
* **Chosen:** take 4 → `media/plates/P41/take4.mp4`; analysis in `video/plates/P41/` (frames 145, fields 145, mattes 73, depth 73, gain 1.0). Typing gesture plus a clean single-eye wink (take 3 has no typing; take 2 closes both eyes before winking; take 1 never winks with one eye).
* **Delivers:** S80/S81 delivered: front-facing close-up, monitors and lamp behind; deadpan stare while her right shoulder and sleeve dip at frame-left as she types blind (0.2-1.8 s); sly smile from ~3.25 s; a clean single-eye wink (frame-left eye closed ~4.4-5.1 s, other eye open), then the sly smile to the end.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 276.950 → 4.45 (+0.90 s) · the 'ting': THE WINK
* **Checks:** Per sheet (headphones, white bomber, orange stripe, black top) · Matches the sheet · None
* **Notes for the renderer:** Wink +0.9 s late: 276.95 ting = plate 4.45 (closed by 4.55).
* **Review sheet:** `media/plates/P41/take4.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P41/take4.sheet.jpg`.
* Take 1: weak 2: The 'wink' is BOTH eyes closing into a happy squint at ~4.85 s (no one-eye wink).
* Take 2: pass 3: 0.4 s of both eyes closed before the wink settles.
* Take 3: pass 4: No blind-typing gesture at all.

### P42 · Lydian reactions: prayer, terror, eyes covered, spear dropped

* **Shots:** S35, S36. **Window:** song [110.58, 115.58], audio reference cut at t0 = 110.58 s (Halys.mp3), 5 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P42/take2.mp4`; analysis in `video/plates/P42/` (frames 121, fields 121, mattes 61, depth 61, gain 2.186). All four reactions, in order, the kneeling prayer first (take 1 bunches them into the last 2 s).
* **Delivers:** S35/S36 delivered: four Lydians knee-deep at dusk, each reaction readable and separate: the second man sinks to his knees with both arms up, palms open (Greek prayer, arms up ~1.0 s, splash 1.3 s); the foreground man spins round staring in terror (~1.6 s); the third throws his forearm over his eyes (~2.9 s); the fourth's spear falls into the water (~4.5 s).
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 110.980 → 1.00 (+0.60 s) · IN THE: the kneeling man's arms go up (S35 cut)
  * 111.435 → 1.60 (+0.74 s) · kick: the spin round
  * 111.865 → 2.90 (+1.61 s) · kick: eyes covered
  * 112.305 → 4.50 (+2.77 s) · kick: the spear drops
* **Timing notes:** Each reaction is a separate moment for the S36 montage: the keys say where each one happens in the plate (mapped to the kick it was asked for); cut each onto whichever stutter onset the edit needs.
* **Checks:** Crested helmets, braids, scales, crimson, lion shields · Consistent with lydian.jpg · Reactions spread over the whole plate rather than on consecutive kicks
* **Notes for the renderer:** For S35's IN THE (110.98) use the kneel at plate ~1.0.
* **Review sheet:** `media/plates/P42/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P42/take2.sheet.jpg`.
* Take 1: pass 3: Reactions bunched into the last 2 s; no clear spin.

### P43 · Median reactions: proskynesis, amulet, bow dropped, arm grabbed

* **Shots:** S35, S36. **Window:** song [110.58, 115.58], audio reference cut at t0 = 110.58 s (Halys.mp3), 5 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P43/take2.mp4`; analysis in `video/plates/P43/` (frames 121, fields 121, mattes 61, depth 61, gain 2.17). All four reactions in order, proskynesis first (take 1 has only a late prostration).
* **Delivers:** S35/S36 delivered (mirror of P42): four Medes by a gravel bar at dusk: the far-right man drops to his knees and prostrates, forehead on the river stones (~1.1 s); the second clasps his hands at his chest over an amulet and prays (~1.8 s); the hooded archer's bow splashes into the water (~3.5 s); the third grabs his neighbour's arm (~4.3 s).
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 111.890 → 1.10 (-0.21 s) · SKY: the prostration (S35 cut)
  * 111.435 → 1.80 (+0.94 s) · kick: the amulet prayer
  * 111.865 → 3.50 (+2.21 s) · kick: the bow falls
  * 112.305 → 4.30 (+2.58 s) · kick: grabs his neighbour's arm
* **Timing notes:** Each reaction is a separate moment for the S36 montage: the keys say where each one happens in the plate (mapped to the kick it was asked for); cut each onto whichever stutter onset the edit needs.
* **Checks:** Red caps, black beards, ochre tunics, iron scales, wicker shields; archer hood, sheepskin, bow · Consistent with mede.jpg / median_archer.jpg · The amulet itself is small; arm grab is subtle
* **Notes for the renderer:** For S35's last SKY (111.89) use the prostration at plate ~1.1.
* **Review sheet:** `media/plates/P43/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P43/take2.sheet.jpg`.
* Take 1: pass 3: Other three reactions not readable; late.

### P44 · Horses: the rear and the calming

* **Shots:** S35, S36. **Window:** song [110.58, 115.58], audio reference cut at t0 = 110.58 s (Halys.mp3), 5 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P44/take1.mp4`; analysis in `video/plates/P44/` (frames 121, fields 121, mattes 61, depth 61, gain 1.281). Only take; both horse beats read.
* **Delivers:** S35/S36 delivered: at dusk on the bank the Lydian rider's chestnut rears high on its hind legs (~0.9 s, right on the S35 'SKY' 111.455) while he grips the reins; behind, the Median rider stands at his bay's head holding it against his chest to calm it.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 111.455 → 0.92 (+0.04 s) · SKY: the horse rears (S35 cut)
* **Checks:** Crested helmet, crimson, ochre cloak, saddlecloth, no stirrups; Median hood and ochre tunic, topknot horse · Consistent with the cavalry sheets · The Mede is already dismounted at the start (no swing-down)
* **Notes for the renderer:** Rear lands +0.04 s on 111.455.
* **Review sheet:** `media/plates/P44/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P44/take1.sheet.jpg`.

### P45 · Faces in shock (Lydian, Mede, Alyattes, Cyaxares)

* **Shots:** S36. **Window:** song [112.31, 117.31], audio reference cut at t0 = 112.31 s (Halys.mp3), 5 s, 1 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P45/take1.mp4`; analysis in `video/plates/P45/` (frames 121, fields 121, mattes 61, depth 61, gain 2.085). Only take; four readable faces.
* **Delivers:** S36 delivered: four tight dusk close-ups with hard cuts at 1.79, 3.08 and 4.38 s: the Lydian looks around wildly then up (0-1.79); the Mede whips round then looks up (1.79-3.08); Alyattes in shock looking up (3.08-4.38); Cyaxares eyes wide looking up (4.38-5.04).
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Timing notes:** Segments: Lydian 0-1.79, Mede 1.79-3.08, Alyattes 3.08-4.38, Cyaxares 4.38-5.04 (hard cuts).
* **Checks:** Helmet + braids; red cap + beard; Alyattes' fillet and purple; Cyaxares' madder cap with gold band · All four match their sheets · Cuts later than asked (1.25/2.5/3.75); Cyaxares' shot is short (0.66 s)
* **Notes for the renderer:** Segment the plate at the cuts for the stutter montage.
* **Review sheet:** `media/plates/P45/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P45/take1.sheet.jpg`.

### P46 · Frozen reaction tableau, 30-degree orbit

* **Shots:** S37. **Window:** song [117.53, 125.53], audio reference cut at t0 = 117.53 s (Halys.mp3), 8 s, 4 take(s) reviewed.
* **Chosen:** take 4 → `media/plates/P46/take4.mp4`; analysis in `video/plates/P46/` (frames 193, fields 193, mattes 97, depth 97, gain 1.836). Balanced prayer/terror poses on both sides, a real rear, empty sky and the widest clean arc (take 3 put every kneeling pose on the Medes and the horse never reared; take 2 drew a corona; take 1's duel is unclear).
* **Delivers:** S37 delivered: a frozen Baroque reaction group on a stony bank under an empty dark sky with an orange horizon, reflected in the water: a Lydian kneeling with arms raised (palms up), a Mede pointing up, spears crossed at the centre, a Mede kneeling with arms raised, a Lydian covering his eyes, a Lydian rider whose horse is frozen high on its hind legs, a Mede prostrate on the stones; everyone statue-still while the camera arcs ~25-30 degrees left to right.
* **Sync:** no musical hit to land; use 1:1 from t0 (plate = song − t0).
* **Checks:** Correct (crests/crimson/scales; red caps/ochre/iron scales) · Consistent with the sheets · The crossed spears are both held by Lydians (the central Mede kneels rather than duels); 4 Lydian : 3 Median figures
* **Notes for the renderer:** 1:1 from t0; clean depth layers (water, group, rider) for the S37 orbit.
* **Review sheet:** `media/plates/P46/take4.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P46/take4.sheet.jpg`.
* Take 1: pass 3: Reactions skew Lydian; the duel at the centre does not read as two duelists faces-up; a low sun appears on the horizon at the end.
* Take 2: pass 3: Reactions skew Median (Lydian kneeler and pointer missing); a large bright black-sun corona is drawn at the top centre.
* Take 3: pass 3: Every kneeling/prostrate/eyes-covered pose is Median (Lydians stand): unequal; the horse stands instead of rearing; small orbit.

### P47 · The arm-pull

* **Shots:** S31b. **Window:** song [100.24, 105.0], audio reference cut at t0 = 100.24 s (Halys.mp3), 5 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P47/take2.mp4`; analysis in `video/plates/P47/` (frames 121, fields 121, mattes 61, depth 61, gain 2.145). The grab lands on the boom (-0.07 s) with a readable lunge; take 1 grabs ~0.4 s early.
* **Delivers:** S31b delivered: knee-deep at dusk, the Lydian hero (crested helmet, crimson tunic, scales) stands over the Mede (red cap, black beard, ochre tunic, iron scales, wicker shield) kneeling in the water, sword raised; the comrade lunges in with a splash and his hands close on the raised forearm at ~1.9 s, pulling it back; the striker turns to him (~2.6 s); both Lydians look up (~3.6 s), the comrade points skyward (~4.8 s); the Mede looks up too.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 102.210 → 1.90 (-0.07 s) · BOOM: the comrade grabs the raised forearm
* **Checks:** Hero and Mede match the sheets; the comrade wears the Lydian crimson tunic and bronze scales but is bareheaded (helmet off), which keeps the three men distinct · Three clearly distinct men · The far-bank ranks are a static wall: their faces-up wave is not readable (borrow P20's unison look-up)
* **Notes for the renderer:** Grab 102.21 -> plate 1.90 (-0.07 s).
* **Review sheet:** `media/plates/P47/take2.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P47/take2.sheet.jpg`.
* Take 1: pass 3: Grab ~0.4 s early; background ranks static.

### P55 · The oath: the kings clasp hands (v2, TREATY; REVISION_V2 decision 7)

* **Shots:** S79 (v2, replaces P40's chair spin). **Window:** song [269.54, 274.54], audio reference cut at t0 = 269.54 s from the sound-design master (`media/stems/halys_sd_master.wav`; the final chord 270.04 = plate 0.50), 5 s, 2 takes reviewed. **Spend:** $2.31 for the two takes, plus $0.93 for five keyframe stills = **$3.24**.
* **Refs:** (1) the keyframe `media/plates/P55/key_t4.jpg`, which acts as the first frame, as boards do; (2) `ALYATTES`; (3) `CYAXARES`; (4) `media/plates/P55/ref_mediators.jpg`, a local composite of the Syennesis and Labynetus sheets (Nano Banana Pro takes only three references). `use_virtual_avatar` on. Keyframes were made with Nano Banana Pro from refs 2–4, five candidates: t1 had the kings an arm's length apart (lost in 4:5), a thumb-hook grip, Cyaxares gripping his sword, and capless mediators (Labynetus read as a Jesus figure); t2 and t3 had the upright "arm-wrestle" grip; t5 lost both kings' headgear. **t4** was chosen: a level right-hand clasp, a cut on each forearm, calm faces, Alyattes' left hand on his heart, both mediators capped.
* **Chosen:** take 1 → `media/plates/P55/take1.mp4`; analysis in `video/plates/P55/` (frames 121, fields 121, mattes 61 with `isnet-general-use`, depth 61, gain 1.322), run per chosen take like the other photoreal plates. On the chord the clasped hands give one firm pump (plate 0.42–0.67; subject motion peaks at 0.62, +0.12 s), then hold still and solemn while the camera slowly pushes in (~27 % over 3.4 s at 1:1).
* **Delivers:** a medium two-shot on a gravel bank of the red-brown river at dusk. On the left Alyattes, facing right: gold fillet, crimped grey tresses, white chiton, purple mantle with a gold meander, lion bracelet, left hand on his heart. On the right Cyaxares, facing left: madder cap with a gold diadem band, roll of curls, curled grey beard, saffron tunic with winged lions, ochre cape, lion torque. They clasp right hands, with a thin cut on each bare forearm. Syennesis (left edge) and Labynetus (right edge) watch.
* **Sync keys** (song s → plate s):
  * 270.040 → 0.42 · the pump plays on S79's first three drawings and is settled by 270.30 → 0.68
  * 273.400 → 2.58 · the hold runs at 0.61x: the kings are still, so this halves the push-in and keeps both heads in frame
* **Checks:** Costumes match the sheets. Cyaxares' akinakes hangs at his left hip, on the camera side (it is in shadow in the painting). No licking, no gore.
* **Notes for the renderer:** MediaPipe finds only Syennesis' frontal face, so `video/src/scenes/treaty.js` tracks the kings' faces, the mediators' faces, the clasp and both cuts by hand (`TRACK`, measured on plate frames 11, 17, 33, 49 and 63). It also re-paints the cuts as thin madder lines once the pump settles.
* **Review sheet:** `media/plates/P55/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P55/take1.sheet.jpg`.
* Take 2: no shake on the chord (the clasp is static to 1.2 s), a late bump at ~4 s, and its push drops the clasp out of frame by 3.3 s. Its files are renamed `media/plates/P55/rejected_take2.*`, so a pipeline run without ids can never extract it over take 1 (the genlog still records the original `take2.mp4` path).

### P57 · The room, her: from behind the chair, anime (v2, ROOM; REVISION_V2 decision 6)

* **Shots:** S78 (v2; P39 stays the painted room). **Window:** song [266.12, 270.16], audio reference = the song cut at t0 = 266.12 s, 4 s, 2 takes reviewed. **Spend:** $1.85 for the two takes, plus $0.64 for four keyframe stills (K78a–d) = **$2.49**.
* **Keyframe (first frame):** `media/plates/P57/K78d_ff.jpg` (16:9 crop of `K78d.jpg`; prompts and refs in the `.json` beside each). Nano Banana Pro edits of P39 frame 40 with the sheet's back view: K78a barely changed her; K78b (an explicit edit list) shortened the hair and showed the circle but kept the patch on her right arm; K78c (a rough paint-over: hair cut, circle, patch moved) moved the patch but re-grew the hair; **K78d** = K78b with the patch move painted over and cleaned up: hair ending at the top of the circle, the light-blue circle and RARE EARTH fully visible, the round 1420 MHz patch on her LEFT sleeve, the right sleeve with only its stripe.
* **Chosen:** take 2 → `media/plates/P57/take2.mp4`; analysis in `video/plates/P57/` (frames 97, fields 97, mattes 49, depth 49, gain 1.211), plus INK 3-model mattes (`video/src/worlds/ink/mattes/P57_take2/`, odd frames; the pipeline's isnet-anime matte grabs the desk lamp) and the decal measurements (`video/src/worlds/ink/decals/P57_take2.json`, every frame: the circle's ellipse, the RARE EARTH band, the patch ring). Registered into P39's frame by a similarity (s 1.02186, tx −6.99, ty 2.53; SIFT on the room pooled over 7 frames, 789/907 inliers, 0.77 px median; `prep/register.py`).
* **Delivers:** she types with both hands, leans toward the vertical monitor (1.3–1.8 s, stop at 1.79) and settles back (2.2–2.6 s), then types on; the circle and the lettering shift, tilt and foreshorten with the jacket as she leans; the patch stays on the left sleeve and turns with the arm. Camera static (median flow ≤ 0.01 px/frame).
* **Sync keys:** the lean's stop (plate 1.79 s) is placed on dt.shift 268.081 by the x-sheet; the typing poses are chosen per tick (no 1:1 playback).
* **Checks:** Hair, jacket, stripes, circle, lettering and patch side match the sheet's back view · Same room layout as P39 (registration) · The plate's own lettering and patch text are only measured, never traced.
* **Review sheet:** `media/plates/P57/take2.review.jpg`; 8-frame contact `media/plates/P57/take2.sheet.jpg`.
* Take 1: pass 4: same action with a smaller lean (stop 2.46 s); the stronger lean of take 2 shows the print travelling with the cloth better.

### P58 · The grin: the anime close-up (v2, ROOM; REVISION_V2 decision 8)

* **Shots:** S80, S81 (v2; replaces P41). **Window:** song [273.4, 278.4], audio reference = the sound-design master cut at t0 = 273.4 s (keys 0.05 / 0.65 / 1.55 s, the ting 3.55 s), 5 s, 2 takes reviewed. **Spend:** $2.31 for the two takes, plus $0.30 for two keyframe stills (K80a–b) = **$2.61**.
* **Keyframe (first frame):** `media/plates/P58/K80b_ff.jpg` (16:9 crop of `K80b.jpg`). Nano Banana Pro edit of P41 frame 22 with the sheet's three-quarter face and, as the expression reference only, a face crop of the director's reference photo (`refs/jade/IMG_20170223_162015.jpg`; the hat and the photo were never sent to Seedance). K80a smiled with teeth and a frown (smug); **K80b**: lips closed, her left corner curled up with a cheek crease, eyes narrowed and engaged, head tilted a little.
* **Chosen:** take 2 → `media/plates/P58/take2.mp4`; analysis in `video/plates/P58/` (frames 121, fields 121, mattes 61, depth 61, gain 1.0; MediaPipe faces on 121/121), plus INK isnet-anime mattes at full size (`video/src/worlds/ink/mattes/P58_take2/`, odd frames).
* **Delivers:** the smirk held the whole 5 s with the tilt; no blink, no wink (both takes, MediaPipe blink curves flat); her right shoulder (frame left) lifts and drops four times (median vertical flow in the region: lifts at f12–f18, f39–f45, f69–f78, f93; presses back at f24, f48, f84, f99).
* **Sync keys:** presses f24 / f48 / f84 → the key clicks 273.455 / 274.025 / 274.927 (x-sheet, hybrid drawings over the held face f30); the wink is the renderer's, shut on 276.947.
* **Checks:** Face, hair, headphones and jacket match the sheet and P41's look · The expression is the reference's, not a deadpan · Clean eyes for the drawn wink.
* **Review sheet:** `media/plates/P58/take2.review.jpg`; 8-frame contact `media/plates/P58/take2.sheet.jpg`.
* Take 1: pass 4: the same smirk with a smoother shoulder drift (no clear presses).

### P48 · The first exchange, in the middle of the battle (v2, ACT1; REVISION_V2 decision 2)

* **Shots:** S17. **Window:** song [44.06, 49.06], audio reference cut at t0 = 44.06 s (Halys.mp3), 5 s, 2 take(s) reviewed.
* **Chosen:** take 1 → `media/plates/P48/take1.mp4`; analysis in `video/plates/P48/` (frames 121, fields 121, mattes 61, depth 61, gain 1.105). The lion shield swings across face-on and turns the spear exactly on the asked beat, with a burst of spray; take 2 turns it with the shield's edge and its background reads as men wading in rather than fighting.
* **Delivers:** S17 v2: side-on at waist height in the knee-deep shallows; the Lydian (left, facing right) and the Mede (right, facing left) circle (0-1.6 s); the Mede lunges (1.6-1.9 s) and the Lydian swings his lion shield across, lion to camera, and turns the point aside at 2.00 s (f49); recovery and circling (2.2-4.4 s); the Lydian's counter-thrust at ~4.7 s. Behind them both lines fight in the shallows across the whole frame (pairs thrusting, shields up, spray), a dense crowd beyond in golden dust.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 46.057 → 2.00 (+0.00 s) · beat: the Mede's thrust turned by the lion shield
* **Timing notes:** S17 = plate 0.67-2.43 at 1:1 (in during the circling, the turn on the 46.06 beat, out on the recovery). The motion curve's peak (1.75) is the lunge; the turn itself is the frame-exact 2.00.
* **Checks:** Correct (crest, braids, crimson tunic, bronze scales, lion shield; red cap, black beard, ochre tunic, iron scales, wicker shield, sword on the right thigh) · Match the sheets · Golden dust haze over the far melee (asked for clear air): the renderer paints its sky and the low sun into it.
* **Notes for the renderer:** 1:1 from t0 (keys in act1.js); the sun is ours, at the top right (v1's place).
* **Review sheet:** `media/plates/P48/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P48/take1.sheet.jpg`.
* Take 2: pass 3: The spear is turned by the shield's edge (lion barely seen, +0.04 s); the background reads as men wading in. Its files are renamed `media/plates/P48/rejected_take2.*`, so a pipeline run without ids can never extract it over take 1 (the genlog still records `take2.mp4`).

### P49 · The battle line on the horizon (v2, ACT1; REVISION_V2 decision 2)

* **Shots:** S18. **Window:** song [46.49, 52.49], audio reference cut at t0 = 46.49 s (Halys.mp3), 6 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P49/take2.mp4`; analysis in `video/plates/P49/` (frames 145, fields 145, mattes 73, depth 73, gain 1.029). A large low sun on a flat horizon behind a continuous fighting line in crisp black silhouette, separate pairs and groups, figures 0.11-0.15 of the frame tall; take 1's line is a dense frieze of tiny figures under a sun lost in haze.
* **Delivers:** S18 v2: extreme telephoto at ground level; the horizon at v 0.868; along the whole width Lydians (crested helmets, round shields, spears) and Medes (soft caps, wicker shields) fight in pairs and small groups (thrusts, shield clashes, swords swung, grappling) and never stop or look up; sparse for the first ~0.7 s, then the line fills.
* **Sync:** no hit to land (S18: "the bite is the only event"); 1:1 from 0.7 s in (46.49 → 0.70, 51.72 → 5.93).
* **Checks:** Silhouette shapes correct (crests, round shields, spears; soft caps, wicker shields) · Silhouettes only · The plate's own sun sits on the horizon behind the fighters: the renderer keys the silhouettes and paints its own sun higher (v1's place), so the bite at 5 o'clock stays clear above their heads.
* **Notes for the renderer:** Key = luminance < 0.3 above the horizon row (sky p5 = 0.40, figures < 0.1); the silhouettes stand on S18's horizon at the plate's own scale.
* **Review sheet:** `media/plates/P49/take2.review.jpg` (motion curve; the head turns are measured by frame inspection, the curve follows the bodies); 8-frame contact `media/plates/P49/take2.sheet.jpg`.
* Take 1: pass 3: A dense frieze of tiny figures (~1/12 of the frame) on a bright water line; the sun is a diffuse glow, no disk.

### P50 · Caught mid-fight, faces turn up (v2, ACT1; REVISION_V2 decision 3)

* **Shots:** S28 (replaces P18's row of six). **Window:** song [88.28, 93.28], audio reference cut at t0 = 88.28 s (Halys.mp3), 5 s, 2 take(s) reviewed.
* **Chosen:** take 2 → `media/plates/P50/take2.mp4`; analysis in `video/plates/P50/` (frames 121, fields 121, mattes 61, depth 61, gain 1.849). All three asked actions read (a Mede's spear thrust caught on a Lydian's lion shield, a raised sword over a Mede braced under his wicker shield, a Lydian and a Mede grappling), and the poses hold while the faces turn up left to right; take 1 muddles the left group (two Medes on one Lydian, who also holds the sword) and its look-ups are small.
* **Delivers:** S28 v2: low angle at waist height in the shallows, cold silvery light from the sun beyond the top right corner, a steel-blue sky; 0-1.7 s all three pairs fight (the sword swings, the grapplers shove, the spear grinds on the shield); then the faces turn up one after another: the left Lydian ~1.9 s, the sword-bearer ~2.2, the right Lydian ~2.55, the right Mede ~2.75, the left Mede ~2.85; all up by ~3.0 and holding, the sword still raised, the spear still on the shield, the hands still locked. The central Mede stays hidden behind his shield.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 89.780 → 1.90 (+0.40 s) · 'halo': the left Lydian looks up
  * 90.200 → 2.25 (+0.33 s) · 'in': the sword-bearer
  * 90.600 → 2.60 (+0.28 s) · 'the': the right Lydian
  * 90.870 → 2.90 (+0.31 s) · 'sky': the right Mede, then the left Mede
  * 91.310 → 3.30 (+0.27 s) · boom 'warriors': all up, cut to the sky (S28b)
* **Checks:** Correct (crests, crimson, bronze scales, lion shield; red caps, black beards, ochre, iron scales, wicker shields) · Match the sheets · The central Mede's face is never seen (behind his shield): five faces turn, not six.
* **Notes for the renderer:** S28 = plate 1.3-3.3 through the keys (fighting at the cut-in, one face per word, all up on the boom). MediaPipe locks onto the lion shield as a face from frame 45 on, so act1.js ignores the plate's faces and keys the five heads by hand.
* **Review sheet:** `media/plates/P50/take2.review.jpg` (motion curve; the head turns are measured by frame inspection, the curve follows the bodies); 8-frame contact `media/plates/P50/take2.sheet.jpg`.
* Take 1: pass 3: The left group is two Medes against the Lydian who also raises the sword; the turn-ups are small; more open sky.

### P51 · Caught mid-fight, they let go (v2, GOLD; REVISION_V2 decision 5)

* **Shots:** S61 (v2, replaces P32's rain of thrown blades). **Window:** song [208.70, 213.70], audio reference cut at t0 = 208.70 s (Halys.mp3), 5 s, 2 takes reviewed. **Spend:** $2.31.
* **Chosen:** take 1 → `media/plates/P51/take1.mp4`; analysis in `video/plates/P51/` (frames 121, fields 121, mattes 61 with `isnet-general-use`, depth 61, gain 1.313). Both lines at the water's edge, mirrored and equal in weight, with a clear stop and a clear drop.
* **Delivers:** a wide shot at the edge of the red river in low golden backlight. Lydians (crests, crimson, lion shields) come from the left, Medes (red caps, ochre, wicker shields) from the right, and a Lydian and a Mede are locked in the centre. They fight from 0 to 1.3 s (a sword on a shield, spear thrusts, spray). At about 1.4 s they stop dead, and the motion falls from 1.3 to 0.4 by 1.5 s. The hands open at 2.0–2.3 s. Swords and spears fall into the shallows and onto the bank by about 2.7 s, and then the men stand empty-handed.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 208.700 → 0.55 (+0.55 s) · "Throw": cut in mid-swing
  * 209.100 → 1.38 (+0.98 s) · they stop dead
  * 209.550 → 2.28 (+1.43 s) · "your": the hands open
  * 209.945 → 2.66 (+1.42 s) · "blade": the weapons land
  * 210.180 → 2.95 (+1.47 s) · low end out: cut to S61b
* **Checks:** Costumes match the sheets · Equal numbers on both sides · Nobody throws.
* **Notes for the renderer:** MediaPipe takes the Mede's wicker shield (its boss reads as a nose) for a face, so S61 paints no eyes (`eyeStrokes: 0`). The water's glare is pulled toward red ochre (`redRiver(src, .45, .85, .6)`).
* **Review sheet:** `media/plates/P51/take1.review.jpg` (motion curve + frames at the hits); 8-frame contact `media/plates/P51/take1.sheet.jpg`.
* Take 2: pass 3: a medium shot with one Lydian against many Medes (unequal), and the drop is hard to see.

### P52 · One hand lets go (v2, GOLD; REVISION_V2 decision 5)

* **Shots:** S61b, under the held "blade" (210.18–211.44). **Window:** song [210.18, 214.18], audio reference cut at t0 = 210.18 s, 4 s, 2 takes reviewed. **Spend:** $1.85.
* **Chosen:** take 2 → `media/plates/P52/take2.mp4`; analysis in `video/plates/P52/` (frames 97, fields 97, mattes 49 with `isnet-general-use`, depth 49, gain 1.396). It has golden backlight, red water, a rim light on the arm, and the release.
* **Delivers:** a close shot at water level. The Lydian's arm comes in from the right (crimson sleeve, bronze scales) and holds a short sword point-down, its tip in the red water. At about 2.85 s the fingers open and the sword slides down point-first. It stands in the mud, and its guard meets the surface with a small splash at about 3.9 s. The open hand stays above it.
* **Sync keys:** 210.180 → 2.50 (+2.50 s) · 210.420 → 2.88 (+2.64 s), the fingers open · 211.300 → 3.92 (+2.80 s), the guard meets the water · 211.440 → 4.04 (+2.78 s), "Home": cut out.
* **Checks:** Correct sleeve and scales · Anatomically correct hand · No throwing.
* **Notes for the renderer:** In landscape the sword sits right of centre (x 0.66), clear of the lyric block on the left. In portrait it sits at x 0.8, beside the short lyric lines, and the camera tilts down with it so that the hilt comes to rest above the last line.
* **Review sheet:** `media/plates/P52/take2.review.jpg`; contact `media/plates/P52/take2.sheet.jpg`.
* Take 1: pass 3: flat front light, olive-green water, and the arm comes in from the left. The drop (2.3–2.8 s) is fine.

### P53 · The sword stays; its owner walks home (v2, GOLD; REVISION_V2 decision 5)

* **Shots:** S62 (v2, replaces P33's toss), the match cut to P34 at 215.29. **Window:** song [211.44, 216.44], audio reference cut at t0 = 211.44 s, 5 s, 2 takes reviewed. **Spend:** $2.31.
* **Chosen:** take 2 → `media/plates/P53/take2.mp4`; analysis in `video/plates/P53/` (frames 121, fields 121, mattes 61 with `isnet-general-use`, depth 61, gain 1.0). The blade is long, straight and centred, and the sun stays out of frame.
* **Delivers:** a low shot at the water's edge under golden clouds. A sword (steel-grey blade, bronze guard, dark grip, round pommel) stands upright and perfectly still, point down in the mud where the water laps the bank. Measured in plate uv: axis u 0.533, pommel top v 0.110, waterline v 0.865. Its owner (the Lydian: crest, crimson, scale corselet, lion shield) stands beside it. At about 0.4 s he turns and walks away up the bank toward the right without looking back, and by about 4 s he is a small full figure. Other men walk off along the horizon, and the red water reflects them.
* **Sync:** 1:1 from 0.10 s in (211.44 → 0.10). The camera eases in until the blade is the vertical where P34's starship stands on its pad: frame x 0.5, pommel at 0.105 H, waterline at 0.917 H, settled by 214.85 (`video/data/sword_handoff.json`, read by drop2.js S63).
* **Checks:** Costume correct · The sword never moves · No sun disk in frame.
* **Notes for the renderer:** The brush engine paints first-layer sky colour onto the thin dark far bank under the walking men (cream scraps). The scraps are not in the reference or in the engine's CPU canvas, so no later layer covers them. S62 therefore forces the second brush layer everywhere (`T[1]` ≈ 0) and makes a sky stroke region above the far bank's crest (v 0.445). The engine itself is reported to its owner.
* **Review sheet:** `media/plates/P53/take2.review.jpg`; contact `media/plates/P53/take2.sheet.jpg`.
* Take 1: pass 3: the sun is in frame with rays, and the sword is shorter, left of centre and looks wooden. The walk is good.

### P54 · The battle line lets go (v2, GOLD; REVISION_V2 decision 5)

* **Shots:** S75, S76 (v2, replaces P38's formation and shrug). S77's pull-back starts from P54's last frame in lines (drop2.js S77 reads gold_outro.js `s76End()`). **Window:** song [259.355, 264.355], audio reference cut at t0 = 259.355 s, 5 s, 5 takes reviewed (prompts v1, v2, v3 in `tools/plate_specs.py`). The submit of take 3 came back HTTP 502, and its job (`halys-plate-P54-20261003-223511-f790c4`) still reads as running. **Spend:** $5.78, plus $1.16 if the provider bills take 3.
* **Chosen:** take 5 (prompt v3) → `media/plates/P54/take5.mp4`; analysis in `video/plates/P54/` (frames 121, fields 121, mattes 61 with `isnet-general-use`, depth 61, gain 1.044). It has one wave of falling blades and a single, clear late man.
* **Delivers:** the battle line seen down its length on a sandy bank in golden light, with the red river behind. Lydians stand on the left facing right and Medes on the right facing left, the nearest pair full-figure. They fight hard from 0 to 1.5 s. At about 1.55 s every hand but one opens and the swords fall point-first into the sand, where they stand at angles; all have landed by about 1.9 s, and the motion falls from 2.6 to 0.3. The nearest Lydian keeps his sword, lowers it (1.9–3.5 s) and lets go at about 3.55 s, and it lands at his feet at about 3.7 s. Then they all stand still, empty-handed, facing each other, with serious faces. Nobody shrugs or poses.
* **Sync keys** (song s → plate s, offset = plate − (song − t0)):
  * 259.360 → 0.20 (+0.20 s) · the hit: cut in mid-fight
  * 260.450 → 1.58 (+0.49 s) · the hands open
  * 260.720 → 1.90 (+0.54 s) · BLADE: the swords hit the sand (the clang is at 260.685)
  * 260.830 → 3.54 (+2.07 s) · the held sword, squeezed into one drawing; his hand opens
  * 261.040 → 3.715 (+2.03 s) · the 261.05 hit: the late sword lands at the frame's foot
  * 262.720 → 5.00 (+1.64 s) · still, to the boom
* **Checks:** Costumes correct (crests, crimson, scales; red caps, black beards, ochre, iron scales, wicker shields) · Mirrored, equal · No shrug, no smile, no posing.
* **Notes for the renderer:** Portrait drifts onto the nearest Lydian for the late drop (cx 0.5 → 0.29, 260.45–260.8). The chops sit at y 0.4, clear of the near faces and of the sand where the blades fall. No eyes are painted, because MediaPipe takes the round shields for faces. drop2.js S74 still traces P38 for the dive's landing, so it should read gold_outro.js `s75Start()` (plate P54, plate time 0.2, the S75 camera).
* **Review sheet:** `media/plates/P54/take5.review.jpg`; contact `media/plates/P54/take5.sheet.jpg`.
* Take 6 (v3): pass 3 (alternate): a late Lydian holds his sword out (1.8–2.6 s) and drops it at about 2.7 s, but the sky is red-pink rather than gold.
* Take 4 (v2): weak 2: every blade drops at once, including the near Mede who was named as the late one.
* Take 2 (v1): weak 2: the best unison drop (swords flat on the sand), but there is no late one.
* Take 1 (v1): fail 1: the front pair turns to face the camera and stands posed.
