# HALYS: audio map

The timing reference for the edit. All times are song time in seconds from the first sample of `Halys.mp3`
(48 kHz, 273.60 s; `ffmpeg` decode, encoder delay already skipped). Frame numbers are at 24 fps
(frame = ceil(t × 24), the first frame at or after the event). Machine-readable: [`video/data/timing.json`](../video/data/timing.json).
Overview plot: [`audio_overview.png`](audio_overview.png). Pipeline: `tools/audio/` (see the end of this file).

## The numbers to cut on

| | Time | s | Frame | Bar |
|---|---|---|---|---|
| **Drop 1 first kick** (totality, "we just went sci-fi") | **1:50.58** | 110.575 | 2654 | 64 |
| Drop 1 one-bar break (kick out) | 2:04.47 → 2:06.21 | 124.475 → 126.206 | 2988 → 3029 | 72 |
| "a sudden **spark**" (diamond ring; vowel held to 200.2 s) | 3:14.84 | 194.84 | 4677 | 113 |
| Beat held back (low end out) → beat returns on "Home" | 3:30.18 → 3:31.88 | 210.177 → 211.877 | 5045 → 5086 | 122 → 123 |
| **Drop 2 first kick** (swords → starships) | **3:35.29** | 215.287 | 5167 | 125 |
| Final stark chord (the wink) | 4:30.04 | 270.04 | 6481 | 157 |

Drop kicks: the grid beats sit on the kick click (median error < 3 ms inside the drops); the very first kick of each drop
is masked by the crash/riser and is good to about ±10 ms. Risers: 108.0 s → Drop 1 and 212.3 s → Drop 2
(a bright cymbal/noise swell, +15 dB above 6 kHz). There is no true digital silence anywhere before the final decay.

## Big surprises vs the lyric sheet / zeitgeist brief

1. **The intro is 67 s long.** Nothing is sung until **1:07.7** ("The River Halys"). The brief's "verse 1 at ≈0:28" is wrong:
   0:28–0:31 is the lull after an orchestral boom at 0:27.24. The cold open (0:00–0:07.18) is still the pianissimo hook,
   and the "sun's growing bite" countdown has a full minute of instrumental music before the first lyric.
2. **Tempo is not a steady 136 BPM.** It starts at ~136.4 BPM and drifts up to ~141–142 BPM by Drop 2 (median
   139.5; per-section values in the table below; Suno does not lock to a grid). Use `beat_times`/`downbeats`,
   never a constant grid: a 136-BPM grid laid from the first beat is 1.6 s (≈4 beats) late at Drop 1 and 4.5 s late at
   Drop 2. Feel: half-time backbeat outside the drops, four-on-the-floor kick in them.
3. **Key: B minor throughout.** The final chorus is *not* in C♯ minor: its chroma matches chorus 1 at zero
   transposition (r = 0.79 vs 0.38 one whole step up), and Drop 2 matches Drop 1 the same way (0.85). Don't stage a key change.
4. **"a sudden spark" is sung once**, after a rest, and the vowel of "spark" is held ~5 s (194.9–200.2 s) under the
   swell; "Shadow turned to day" starts at 200.31. (Prompted Whisper passes hallucinate two extra repeats; unprompted
   passes and the lead-stem spectrogram show one.)
5. **"Throw down your blade" is held through the beat-held-back bar**: "blade" sustains 209.9 → 211.4 while the low end
   is out (bar 122), and the beat comes back with "**Home** to the ones you love" (bar 123). The final chorus also has a
   short drop-out of the bright layer and the vocal at 207.4–208.5 s, right before "Throw down".
6. **Drop 2 has almost no chopped words.** Bars 125–148 carry a wordless, sustained vocal topline (the "new
   counter-melody"); the chops are *shouted at the end*: THROW DOWN on beats 2 and 4 of bar 149 (256.40, 257.25), then
   THROW DOWN 259.77 + **BLADE 260.62** in the stop-time outro, and a held "throw down" from 263.15. No clear "your".
   For the blade-drop choreography the one unambiguous **BLADE** is **4:20.62 (260.62 s, bar 151 beat 4)**.
7. **Drop 1's chops come in two shapes**: HALO / IN THE / SKY / SKY once on the four beats of bar 64, then an 8th → 16th
   stutter (bars 65–67); and four sung 2-bar cycles in bars 81–88 with HALO on beat 2, IN THE on beat 4, SKY on the next
   downbeat and SKY on beat 3. Bars 68–80 are instrumental.
8. **Structure is 8 + 1 + 16 bars for Drop 1** (as the brief guessed) and **25 bars for Drop 2** (24 + the shout bar);
   the breakdown is only 4 bars (2:33.83–2:40.70).
9. **Two irregular bars** (everything else is 4/4): bar 14 has 6 beats (the pulse-less swell into the 0:27.24 boom) and
   bar 155 in the outro has 5. Bar numbering below includes them.

## Sections

| # | Section | Start | End | Start (s) | End (s) | Bars | BPM | What the music does |
|---|---|---|---|---|---|---|---|---|
| 1 | **Cold open: pianissimo cello** | 0:00.00 | 0:07.18 | 0.00 | 7.18 | 1–4 | 136.4 | solo cello, muted strings, a soft ticking 8th pulse; no low end (sub band ~-65 dB). The hook window. |
| 2 | **Intro A: strings enter** | 0:07.18 | 0:27.24 | 7.18 | 27.24 | 5–15 | 137.9 | low strings + full string section at bar 5 (7.18 s); 8th-note string ostinato over an F# pedal (V of B minor), chromatic bass walk from ~19.5 s; ostinato stops ~23.3 s, then a rubato cymbal/string swell (bar 14 = 6 beats) into the boom |
| 3 | **Intro B: the boom and the build** | 0:27.24 | 1:07.42 | 27.24 | 67.42 | 16–38 | 137.9 | low orchestral boom on bar 16 (27.24 s); lull bars 17-18 (sub drops out); orchestral build bars 19-26; bass drops out again bars 27-29 (46.5-51.7 s); full orchestra bars 30-38. Wordless choir swell ~41.5-42.9 s. |
| 4 | **Verse 1** | 1:07.42 | 1:30.03 | 67.42 | 90.03 | 39–51 | 137.9 | hushed close lead vocal over the orchestra; first sung word 'The' at ~67.7 s (bar 39) |
| 5 | **Pre-chorus** | 1:30.03 | 1:36.89 | 90.03 | 96.89 | 52–55 | 139.5 | 'A halo in the sky...': pickup 'A' at 89.2 s in bar 51; dread, tremolo strings, pulsing low 8ths |
| 6 | **Chorus 1** | 1:36.89 | 1:50.58 | 96.89 | 110.58 | 56–63 | 139.5 | full orchestra + huge choir; syncopated orchestral hits; 'Throw down' 103.6 s; riser from ~108.0 s into the drop |
| 7 | **Drop 1 (8 bars)** | 1:50.58 | 2:04.47 | 110.58 | 124.47 | 64–71 | 137.9 | orchestral EDM: four-on-the-floor kick from 110.57 s, sub bass, pumping strings, brass stabs. Chops: HALO / IN THE / SKY / SKY on the 4 beats of bar 64, then an 8th -> 16th stutter bars 65-67; bars 68-71 instrumental |
| 8 | **Drop 1 one-bar break** | 2:04.47 | 2:06.21 | 124.47 | 126.21 | 72 | 138.7 | kick out for exactly one bar (124.48-126.21 s) |
| 9 | **Drop 1 (16 bars)** | 2:06.21 | 2:33.83 | 126.21 | 153.83 | 73–88 | 138.7 | kick back on bar 73; bars 73-80 instrumental; bars 81-88 four 2-bar cycles of the sung chop (halo on beat 2, in the on beat 4, sky on beat 1, sky on beat 3) |
| 10 | **Breakdown** | 2:33.83 | 2:40.70 | 153.83 | 160.70 | 89–92 | 139.9 | falls back to quiet: piano and soft strings, faint pulse (4 bars) |
| 11 | **Verse 2** | 2:40.70 | 2:54.39 | 160.70 | 174.39 | 93–100 | 140.3 | 'What was it like...': piano + strings, faint pulse, close vocal |
| 12 | **'a shadow crossed the hills'** | 2:54.39 | 3:01.23 | 174.39 | 181.23 | 101–104 | 140.3 | two lines; orchestra thickens |
| 13 | **'Thales foretold...' build** | 3:01.23 | 3:19.98 | 181.23 | 199.98 | 105–115 | 140.4 | strings + choir climbing; breath 187.65-188.55 s; '[rest]' 192.75-193.1 s; 'a sudden SPARK' lands on bar 113 (194.84 s) and the vowel is held ~5 s (194.9-200.2 s) as the orchestra swells: the diamond ring |
| 14 | **Final chorus (beat held back)** | 3:19.98 | 3:35.29 | 199.98 | 215.29 | 116–124 | 141.2 | 'Shadow turned to day' 200.3 s; bright layer drops out 207.4-208.5 s; 'Throw down your blade' 208.7 s; low end OUT for bar 122 (210.18-211.88 s, held 'blade'); beat returns bar 123 with 'Home'; riser ~212.3 s -> drop |
| 15 | **Drop 2** | 3:35.29 | 4:17.68 | 215.29 | 257.68 | 125–149 | 141.2 | fierce orchestral EDM drop, kick from 215.28 s; the topline is wordless sustained vocal (bars 125-133, 138-148); the shouted chops come at its end: THROW DOWN 256.41 / 257.25 (bar 149) |
| 16 | **Outro: stop-time hits, final chord** | 4:17.68 | 4:33.60 | 257.68 | 273.60 | 150–159 | 141.6 | kick stops; hits on bars 150-153 with THROW DOWN 259.78 and BLADE 260.63; boom + held 'throw down' 262.7-266.1 s; ticking build; final stark chord 270.04 s decaying to silence by ~273.4 s |

## Key moments

| Time | s | Frame @24 | Bar | Moment |
|---|---|---|---|---|
| 0:07.16 | 7.16 | 172 | 4 | low end + full strings enter (bar 5) |
| 0:27.24 | 27.24 | 654 | 16 | intro boom (bar 16) |
| 1:07.73 | 67.73 | 1626 | 39 | first sung word 'The' |
| 1:50.57 | 110.57 | 2654 | 63 | DROP 1 first kick (bar 64) |
| 2:04.47 | 124.47 | 2988 | 72 | Drop 1 one-bar break (bar 72) |
| 2:06.21 | 126.21 | 3029 | 73 | Drop 1 kick returns (bar 73) |
| 2:33.83 | 153.83 | 3692 | 89 | Drop 1 ends -> breakdown (bar 89) |
| 2:48.32 | 168.32 | 4040 | 97 | 'quiet' (Birds went quiet) |
| 3:14.84 | 194.84 | 4677 | 112 | 'spark' (bar 113, held ~5 s) |
| 3:20.31 | 200.31 | 4808 | 116 | 'Shadow turned to day' - final chorus |
| 3:30.18 | 210.18 | 5045 | 122 | beat held back: low end out (bar 122) |
| 3:31.88 | 211.88 | 5086 | 123 | beat returns (bar 123) |
| 3:35.28 | 215.28 | 5167 | 124 | DROP 2 first kick (bar 125) |
| 4:17.68 | 257.68 | 6185 | 150 | Drop 2 kick stops; stop-time hit (bar 150) |
| 4:30.04 | 270.04 | 6481 | 157 | final stark chord |

## Lyrics, word by word

True lyric text (from the lyric sheet; Suno sang "Hailys", "warriors odd", "Thaylees"). Word starts are snapped to
lead-vocal onsets: about ±0.05 s on consonant attacks and phrase starts, ±0.15 s inside long legato lines (e.g.
"Sun burning on the bronze"). `words[]` in timing.json are `[start, word, end]`; a line's end is where its last
note stops (capped at the next line's start).

| Section | Line (true text) | Start | End | Start (s) | End (s) | Bar | Word starts (s) |
|---|---|---|---|---|---|---|---|
| verse1 | The River Halys, on the sixth year of the war | 1:07.73 | 1:13.22 | 67.73 | 73.22 | 39 | The 67.73 · River 68.07 · Halys, 68.52 · on 70.00 · the 70.42 · sixth 70.61 · year 70.84 · of 71.47 · the 72.05 · war 72.20 |
| verse1 | Lydians and Medes, slew each other on the shore | 1:14.66 | 1:19.56 | 74.66 | 79.56 | 43 | Lydians 74.66 · and 75.52 · Medes, 75.92 · slew 76.79 · each 77.22 · other 77.69 · on 78.31 · the 79.08 · shore 79.15 |
| verse1 | Sun burning on the bronze exchange- | 1:21.50 | 1:25.91 | 81.50 | 85.91 | 47 | Sun 81.50 · burning 82.65 · on 83.74 · the 84.31 · bronze 84.38 · exchange- 85.06 |
| verse1 | ing turns and strikes when light went strange. | 1:25.93 | 1:29.22 | 85.93 | 89.22 | 49 | ing 85.93 · turns 86.06 · and 86.77 · strikes 87.20 · when 87.68 · light 87.84 · went 88.43 · strange. 88.69 |
| pre1 | A halo in the sky warriors awed | 1:29.23 | 1:32.98 | 89.23 | 92.98 | 51 | A 89.23 · halo 89.78 · in 90.22 · the 90.61 · sky 90.87 · warriors 91.31 · awed 92.39 |
| pre1 | by the vacant eye of a god | 1:33.00 | 1:36.80 | 93.00 | 96.80 | 53 | by 93.00 · the 93.24 · vacant 93.31 · eye 93.95 · of 94.77 · a 94.96 · god 95.19 |
| chorus1 | Daylight turned to shade | 1:36.92 | 1:38.87 | 96.92 | 98.87 | 56 | Daylight 96.92 · turned 97.53 · to 98.08 · shade 98.41 |
| chorus1 | eye of gods above | 1:40.24 | 1:42.22 | 100.24 | 102.22 | 57 | eye 100.24 · of 100.50 · gods 101.14 · above 101.61 |
| chorus1 | Throw down your blade | 1:43.64 | 1:45.83 | 103.64 | 105.83 | 59 | Throw 103.64 · down 104.26 · your 104.88 · blade 104.96 |
| chorus1 | Go home to the ones you love | 1:45.85 | 1:50.56 | 105.85 | 110.56 | 61 | Go 105.85 · home 107.02 · to 107.72 · the 108.23 · ones 108.41 · you 109.45 · love 110.24 |
| verse2 | What was it like when reality suddenly broke | 2:40.71 | 2:43.81 | 160.71 | 163.81 | 93 | What 160.71 · was 161.08 · it 161.30 · like 161.56 · when 161.86 · reality 162.19 · suddenly 162.83 · broke 163.55 |
| verse2 | the silent eye, how the gods suddenly spoke | 2:44.34 | 2:47.26 | 164.34 | 167.26 | 95 | the 164.34 · silent 164.56 · eye, 164.91 · how 165.38 · the 165.62 · gods 165.78 · suddenly 166.25 · spoke 167.04 |
| verse2 | Birds went quiet, air suddenly cold | 2:47.88 | 2:50.71 | 167.88 | 170.71 | 97 | Birds 167.88 · went 168.12 · quiet, 168.32 · air 168.97 · suddenly 169.04 · cold 169.69 |
| verse2 | what we do next is how history unfolds | 2:50.73 | 2:54.06 | 170.73 | 174.06 | 98 | what 170.73 · we 170.91 · do 171.40 · next 171.59 · is 172.04 · how 172.25 · history 172.56 · unfolds 173.10 |
| shadow | a shadow crossed the hills | 2:55.25 | 2:58.64 | 175.25 | 178.64 | 101 | a 175.25 · shadow 175.80 · crossed 176.60 · the 177.38 · hills 177.74 |
| shadow | the wind picked up a chill | 2:58.66 | 3:02.28 | 178.66 | 182.28 | 103 | the 178.66 · wind 179.23 · picked 179.91 · up 180.25 · a 180.79 · chill 181.12 |
| thales | Thales foretold the sun would go dark | 3:02.49 | 3:07.69 | 182.49 | 187.69 | 105 | Thales 182.49 · foretold 183.34 · the 184.21 · sun 184.51 · would 185.07 · go 185.88 · dark 186.38 |
| thales | Warriors behold … a sudden spark | 3:08.51 | 3:20.29 | 188.51 | 200.29 | 109 | Warriors 188.51 · behold 189.73 · a 193.25 · sudden 193.56 · spark 194.84 |
| chorus2 | Shadow turned to day | 3:20.31 | 3:23.62 | 200.31 | 203.62 | 116 | Shadow 200.31 · turned 202.25 · to 202.88 · day 203.18 |
| chorus2 | Sunlight from above | 3:24.85 | 3:27.03 | 204.85 | 207.03 | 118 | Sunlight 204.85 · from 205.75 · above 206.35 |
| chorus2 | Throw down your blade | 3:28.70 | 3:31.42 | 208.70 | 211.42 | 121 | Throw 208.70 · down 209.18 · your 209.56 · blade 209.94 |
| chorus2 | Home to the ones you love | 3:31.44 | 3:36.84 | 211.44 | 216.84 | 122 | Home 211.44 · to 212.06 · the 212.94 · ones 213.16 · you 214.31 · love 215.06 |

## Chopped vocals (every occurrence)

Suno sang the chops as varying phrases rather than one repeated sample, so they were located from vocal-stem onsets,
the bar grid and short-window Whisper passes, not by template matching. *high* = rhythm + Whisper agree;
*pattern* = same 2-bar rhythm as the confirmed cycles; *medium/low* = see `conf` in timing.json.

| Drop | Bar.beat | Time | Start (s) | End (s) | Chop | Confidence |
|---|---|---|---|---|---|---|
| 1 | 64.1 | 1:50.66 | 110.66 | 110.84 | **HALO** | medium |
| 1 | 64.2 | 1:50.98 | 110.98 | 111.27 | **IN THE** | medium |
| 1 | 64.3 | 1:51.45 | 111.45 | 111.89 | **SKY** | medium |
| 1 | 64.4 | 1:51.89 | 111.89 | 112.28 | **SKY** | medium |
| 1 | 81.2 | 2:20.45 | 140.45 | 141.35 | **HALO** | high |
| 1 | 81.4 | 2:21.35 | 141.35 | 141.75 | **IN THE** | high |
| 1 | 82.1 | 2:21.75 | 141.75 | 142.65 | **SKY** | high |
| 1 | 82.3 | 2:22.65 | 142.65 | 143.62 | **SKY** | high |
| 1 | 83.2 | 2:23.94 | 143.94 | 144.53 | **HALO** | high |
| 1 | 83.4 | 2:24.80 | 144.80 | 145.23 | **IN THE** | high |
| 1 | 84.1 | 2:25.23 | 145.23 | 146.10 | **SKY** | high |
| 1 | 84.3 | 2:26.10 | 146.10 | 147.10 | **SKY** | high |
| 1 | 85.2 | 2:27.34 | 147.34 | 147.94 | **HALO** | pattern |
| 1 | 85.3 | 2:27.94 | 147.94 | 148.22 | **IN THE** | pattern |
| 1 | 86.1 | 2:28.67 | 148.67 | 149.56 | **SKY** | pattern |
| 1 | 86.3 | 2:29.56 | 149.56 | 150.76 | **SKY** | pattern |
| 1 | 87.2 | 2:30.84 | 150.84 | 151.69 | **HALO** | pattern |
| 1 | 87.4 | 2:31.69 | 151.69 | 152.12 | **IN THE** | pattern |
| 1 | 88.1 | 2:32.12 | 152.12 | 153.03 | **SKY** | pattern |
| 1 | 88.3 | 2:33.03 | 153.03 | 153.87 | **SKY** | pattern |
| 2 | 149.2 | 4:16.40 | 256.40 | 256.91 | **THROW DOWN** | high |
| 2 | 149.4 | 4:17.25 | 257.25 | 257.85 | **THROW DOWN** | high |
| 2 | 151.2 | 4:19.77 | 259.77 | 260.62 | **THROW DOWN** | medium |
| 2 | 151.4 | 4:20.62 | 260.62 | 261.05 | **BLADE** | medium |
| 2 | 153.2 | 4:23.15 | 263.15 | 264.15 | **THROW DOWN** | low |

Stutter onsets, Drop 1 bars 65–67 (34; 8th notes in bar 65, 16ths in bars 66–67; `chops[]` with `word: "stutter"`): 112.53, 112.96, 113.08, 113.72, 114.15, 114.25, 114.39, 114.50, 114.59, 114.70, 114.80, 114.94, 115.14, 115.25, 115.39, 115.46, 115.58, 115.69, 115.80, 116.01, 116.12, 116.34, 116.44, 116.56, 116.77, 116.88, 116.98, 117.11, 117.19, 117.31, 117.42, 117.75, 117.87, 117.94

## Notable hits and textures

* **Drop kicks:** 196 (every beat of bars 64–71, 73–88, 125–149) in `events.kicks`.
* **Big low booms / timpani hits** (outside the drops, low-band jump ≥ 16 dB): 8.69, 9.78, 27.23, 91.31, 100.27, 102.21, 157.03, 167.54, 169.87, 170.54, 172.68, 203.60, 205.08, 207.00, 257.67, 259.35.
  The two biggest: **102.21** (chorus 1, "eye of gods above" → "Throw down") and **203.60** (final chorus, after "day");
  also 211.84 (the impact at the end of the held-back bar) and 259.35 (outro). `events.timpani` has the full list (≥ 12 dB).
* **Strongest brass/string stabs** (drops): 112.74, 113.17, 113.61, 115.78, 116.22, 116.65, 117.09, 119.69, 127.50, 128.80, 129.24, 130.97, 131.83, 132.69, 145.21, 147.80 (`events.stabs`, 258 in all).
* **Choir / backing-vocal entrances:** 41.5–42.9, 78.0–81.1, 81.9–84.1, 86.4–89.4, 97.3–99.1, 100.2–102.3, 103.6–106.8, 110.7–114.9, 140.5–153.8, 160.9–167.9, 172.3–181.1, 195.7–198.3, 199.0–203.8, 204.8–207.2, 208.7–211.9, 215.3–229.4, 238.5–249.7, 251.5–258.3, 259.8–261.7, 263.1–267.0 (`events.choir`).
* **Snare rolls / dense snare-band runs:** `events.snare_rolls` (e.g. 111.2–117.0 under the Drop 1 stutter, 154.2–160.3 in the breakdown).
* **Silences / holds:** `events.holds` (Drop 1 break, final-chorus drop-out 207.4–208.5, beat held back bar 122, outro stop at 257.68).
* **Ending:** kick stops 257.68 with a hit; stop-time hits 259.35 and 261.05; boom 262.72; ticking build from 266.1;
  final hits 266.99–269.8; **final stark chord 270.04**, decaying to silence by ~273.4 (file ends 273.60).
  

## Curves (24 fps)

`curves` holds one value per video frame (frame i = song time i/24, n = 6567), each normalised 0–1:
`rms` (mix level, 45 dB range), `low` (30–150 Hz: kick/sub/timpani), `mid` (150–2500 Hz), `high` (2.5–16 kHz),
`onset` (spectral flux, peak-held per frame) and `vocal` (lead-vocal stem level, 40 dB range).

## Beat grid: how it was made and how far to trust it

* Backbone: madmom's RNN + DBN beat tracker (built from GitHub; `tools/audio/madmom_beats.py`), then local phase
  alignment against attack-calibrated onset envelopes. Inside the drops the grid sits on the kick click (< 3 ms);
  elsewhere ±10–20 ms.
* The previous grid (librosa DP tracker) had squeezed an extra beat into chorus 1, the final chorus and the intro
  swell (a fake "146 BPM push") and so needed three phase jumps; madmom's beats score better on onsets there (lead-vocal
  onset score 0.198 vs 0.144 in chorus 1) and its bar phase runs straight from verse 1 into Drop 1. Kept for reference:
  `media/stems/analysis/analysis_v1_dpgrid.json`.
* The intro swell (~23.3–27.2 s) has no pulse at all; its beats are a steady interpolation (14 beats from bar 13 to the
  boom), which is why bar 14 has 6 beats. The outro after 270 s is a decaying chord; beats there are extrapolated.
* Downbeats: Viterbi over bar position (4-beat bars, penalised 2/3/5/6-beat bars) on madmom's downbeat activation +
  chord/bass change + low-band hits. Both drops, both verses and the boom land on bar 1.

## Files

* `video/data/timing.json`: bpm, beat_times (= beats), downbeats, bars, tempo, sections, lines/words, chops, events, curves.
* `production/audio_overview.png`: energy, low band, sections, lyric lines, chops, drop impacts.
* Pipeline (`tools/audio/`): `separate.sh` (stems) → `madmom_beats.py` → `analyze.py` (grid, bars, events, curves) →
  `whisper_cf.py` (Cloudflare Whisper passes, logged in `media/genlog.jsonl`) → `align_lyrics.py` (true words, onset
  snapping, chops) → `build_outputs.py` (timing.json) → `audio_map.py` (this file) → `overview_plot.py`.
* Stems used: MDX-Net Kim_Vocal_2 vocals/instrumental + UVR KARA_2 lead/backing split (clean enough for every
  measurement here; the interrupted BS-Roformer re-separation was not needed).
