# HALYS: sound design

**Deliverable:** [`release/Halys_sound_design.mp3`](../release/Halys_sound_design.mp3) (320 kbps CBR, 48 kHz, tags + cover from
`Halys.mp3`). Video mux master: `media/stems/halys_sd_master.wav` (48 kHz / 24-bit, gitignored) and the cue bus alone,
`media/stems/halys_sd_bus.wav`. Processed cues: `media/sfx/cue_*.flac` (each cue's own span, start times in
`media/sfx/cues.json`; regenerable, gitignored); the paid ElevenLabs sources are kept in `media/sfx/src/`.
Re-render: `python tools/audio/sfx_gen.py` (sources, paid) → `python tools/audio/sound_design.py` → `python tools/audio/sound_design_doc.py`.

**New duration: 279.60 s (4:39.60)** vs 273.60 s. Same t = 0 as the original: every
timing in `AUDIO_MAP.md` / `timing.json` holds; `timing.json` → `durExt = 279.60`, `sound_design{}`.
The last sound ends at 278.80 s, then 0.8 s of digital silence for the cut to black.
**The wink's "ting" is at 276.95 s (4:36.95)**: put the eyelid's close on it.

## Rules this layer follows

* The song is untouched: the master equals `Halys.mp3` + the cue bus sample-for-sample (verified to 24-bit precision) up to
  271.60 s, where the original's mastering fade crossfades into the frozen final chord (cue g).
* Everything is timed from the measured grid and word onsets (`video/data/timing.json`), never by ear-guessing.
* Never over the voice: every cue is sidechain-ducked by the lead-vocal stem (4–9 dB), kept out of the 1–5 kHz
  intelligibility band (presence dips / high-passes), and the bronze clashes only land in the singer's breaths.
  Margins in the table are measured on the rendered mix.
* Levels are set against the music's own short-term loudness at that moment (EBU R128, 3 s), not absolute guesses.
* Loudness is matched to the original (table at the end); no limiter, no re-master.

## Cue sheet

| Cue | When | Source | Processing | Level | Why |
|---|---|---|---|---|---|
| **a. Cold open: steppe wind from frame 0** | 0:00.00–0:09.00 (0.00–9.00 s) | procedural (noise through a wandering band-pass, gusts, faint whistle) | HP 90 Hz; in from frame 0 (40 ms de-click), out under the strings at 7.2 s (gone by 9.0 s) | -23.5 LU vs music (cue -49.5 / music -25.9 LUFS-S) | air before the picture; the cello alone reads as a void, the wind gives it a place |
| **a/b. Distant battle bed: in at 1.7 s, low under the intro and verse 1, swell on 'slew each other on the shore', drains from 'when light went strange' to silence by 'warriors awed'** | 0:01.00–1:33.50 (1.00–93.50 s) | ElevenLabs music-v2 (sfx:battle_bed, sfx:horses_far, sfx:river, sfx:blade_drop + test sfx_bronze_swords) | crowd/rumble LP 1.3 kHz, cavalry LP 1.6 kHz, river BP 250-2600 Hz, stitched without loop points; 34 far bronze clashes (pitched -3..+1 st, LP 1.4-2.8 kHz, 75% wet open-air tail, random pan, only in vocal gaps); presence dip -5 dB @ 2.6 kHz; ducked 4 dB under the lead vocal; drain = low-pass glide 7 kHz -> 220 Hz + gain to silence (87.68 -> 92.39 s) | -17.3 LU vs music (cue -37.1 / music -19.9 LUFS-S); ≥16.5 dB under the lead vocal in 1–5 kHz (5th pct of sung frames) | the war is going on out of frame; when the light goes strange the world loses its top end and goes quiet |
| **c. Verse 2: faint evening birdsong from the first bar of verse 2, cut dead on 'quiet' (Birds went quiet)** | 2:40.70–2:48.53 (160.70–168.53 s) | ElevenLabs music-v2 (sfx:birdsong) | liveliest 7.8 s of the take; BP 2.6-9.5 kHz; short air (RT 1.1 s, -12 dB); fade in 0.9 s; ducked 9 dB under the vocal; hard cut at 168.325 s (2 ms ramp, no reverb tail) | -23.7 LU vs music (cue -41.7 / music -18.1 LUFS-S); ≥13.2 dB under the lead vocal in 1–5 kHz (5th pct of sung frames) | the strangest real report from eclipses: birds stop singing. The cut is the event |
| **c. Cold wind gust: 'air suddenly cold'** | 2:48.37–2:52.09 (168.37–172.09 s) | procedural wind (higher, faster band than the steppe wind, faint whistle) | HP 300 Hz, dips -9 dB @ 2.3 kHz and -6 dB @ 4.2 kHz, ducked 7 dB under the vocal, L->R sweep, swell to peak at 169.94 s, out by 172.09 s | -26.6 LU vs music (cue -43.8 / music -17.2 LUFS-S); ≥11.4 dB under the lead vocal in 1–5 kHz (5th pct of sung frames) | temperature drops in totality; the second gust is the shadow arriving |
| **c. Cold wind gust: 'the wind picked up a chill'** | 2:58.83–3:03.72 (178.83–183.72 s) | procedural wind (higher, faster band than the steppe wind, faint whistle) | HP 300 Hz, dips -9 dB @ 2.3 kHz and -6 dB @ 4.2 kHz, ducked 9 dB under the vocal, L->R sweep, swell to peak at 181.42 s, out by 183.72 s | -25.7 LU vs music (cue -41.7 / music -15.9 LUFS-S); ≥10.4 dB under the lead vocal in 1–5 kHz (5th pct of sung frames) | temperature drops in totality; the second gust is the shadow arriving |
| **d. 'a sudden spark': crystalline shimmer / light-burst on 'spark' (the diamond ring)** | 3:14.40–3:18.44 (194.40–198.44 s) | procedural (bell partials B7-F#8-B8-D9 + glass, 90 high glitter grains, open tail; reversed-tail pre-swell) | pre-swell 0.45 s into the word, burst at 194.845 s, HP 3.2 kHz (above the voice's intelligibility band), ~3 s decay | -19.1 LU vs music (cue -32.7 / music -13.6 LUFS-S); ≥8.6 dB under the lead vocal in 1–5 kHz (5th pct of sung frames) | the first point of light; tuned to B so it rings with the held 'spaaark' |
| **e. 'Shadow turned to day': distant roar of two armies as the light returns** | 3:20.31–3:28.90 (200.31–208.90 s) | ElevenLabs music-v2 (sfx:army_cheer) | loudest 4 s of the take; HP 180 Hz, LP 1.6 kHz, 70% wet open-air tail (RT 2.8 s), presence dip -6 dB; swell 0 -> +1.3 s, gone by +4.0 s; ducked 6 dB under the vocal | -23.7 LU vs music (cue -38.2 / music -14.4 LUFS-S); ≥15.3 dB under the lead vocal in 1–5 kHz (5th pct of sung frames) | the Reykjavik-crowd beat from the brief, kept far away so the choir stays in front |
| **f. Outro chop 'BLADE' (260.6 s): one metallic blade-drop transient** | 4:20.69–4:22.58 (260.69–262.58 s) | ElevenLabs music-v2 (sfx:blade_drop) | HP 2.2 kHz (no low-end clutter, above the shout's body), short room (RT 1.2 s), 60 ms after the chop onset, ~20 LU under the music | -20.9 LU vs music (cue -35.8 / music -14.9 LUFS-S); ≥9.6 dB under the lead vocal in 1–5 kHz (5th pct of sung frames) | the only clearly sung 'blade' in Drop 2/outro; the stop-time gap leaves room for one clean ring |
| **g. Ending: quiet room tone under the frozen chord** | 4:32.20–4:38.80 (272.20–278.80 s) | procedural (fan air + faint hum) | in 272.2 -> 273.7 s, -58 dBFS RMS, out by 278.4 s | peak -45.1 dBFS, -56.0 LUFS-S | the reveal is a real room; its air is the first non-musical space in the film |
| **g. Ending: mechanical-keyboard click** | 273.45, 274.05, 274.95 s | ElevenLabs music-v2 (sfx:keyboard) | one key press (down+up) from the take, HP 250 Hz, close and dry | peak -24.0 dBFS | someone is at a terminal |
| **g. Ending: one small bright sparkle / 'ting' for the wink** | 4:36.85–4:38.80 (276.85–278.80 s) | procedural (F#7-B7 tine partials + a 0.1 s rising glitter) | glitter from 276.85 s, tine at 276.95 s, HP 2 kHz, ~1.5 s ring, peak -20 dBFS | peak -20.0 dBFS, -29.8 LUFS-S | the eyelid closes like the Moon over the Sun: the last light in the film |

### Notes per cue

* **a/b battle bed.** In the cold open it is clearly audible between the cello's harmonics (~18 dB under the cello);
  from 7.2 s the orchestra masks it almost completely (it peeks through the lulls at 29–32 s and 46–52 s), which is the
  intended "continues low". 34 far bronze clashes in all: 3.77, 5.00, 5.41, 6.85, 12.53, 13.55, 13.91, 15.24, 17.16, 19.46, 21.00, 22.12, 25.91, 28.88, 29.71, 30.11, 31.78, 40.13, 44.18, 45.56, 50.69, 52.40, 56.51, 57.05, 57.41, 58.12, 59.67, 62.47, 73.72, 76.69, 77.43, 77.94, 78.24, 79.06 s
  (from 73.72 s they sit in the singer's breaths: one before "Lydians", five around "slew each other on the shore"). The drain is a 7 kHz → 220 Hz low-pass
  glide plus a fade, from "when light went strange" (87.68 -> 92.39 s).
* **c birdsong** is cut dead on the onset of "quiet" (no reverb tail: the silence is the event); the two cold gusts
  peak on "cold" and "chill" and sweep left to right.
* **d spark** is tuned to B (B7 F♯8 B8 D9, with glass partials) and sits entirely above 3.2 kHz, so it rings with the
  held "spaaark" without touching the vowel; a reversed-tail swell gathers into the word.
* **e roar** is kept far (low-passed, mostly reverb) and ducked so the choir stays in front; it is gone 4 s after
  "Shadow".
* **f blade**: Drop 2 has no chopped "blade" inside the drop (its topline is wordless, see AUDIO_MAP.md); the only clear
  sung BLADE is in the stop-time outro at 260.62 s, which leaves a gap for one clean ring. The other "throw down"
  shouts were left alone (no clutter).
* **g ending.** The original fades the final B5 chord out from 271.8 s and cuts at 273.6 s. Here the chord is frozen
  (average STFT magnitude of 270.59–271.59 s, random-phase resynthesis, as in
  orbital's `extend_ending.py`), crossfaded in at 271.60 s (0.6 s), held 1.2 s, then decays
  over 4.6 s while a low-pass glides 7 kHz → 900 Hz (highs die first) with a little open space. Under it:
  room tone from 272.2 s, three key presses, then the ting; the chord is ~50 dB down when the ting sounds.

## Loudness (before / after)

| File | Integrated (ffmpeg / pyloudnorm) | True peak (ffmpeg / 4× oversampled) | LRA | Duration |
|---|---|---|---|---|
| `Halys.mp3` (original) | -15.4 / -15.42 LUFS | -3.9 / -3.88 dBTP | 5.4 LU | 273.60 s |
| `halys_sd_master.wav` | -15.4 / -15.44 LUFS | -3.9 / -3.88 dBTP | 6.1 LU | 279.60 s |
| `Halys_sound_design.mp3` | -15.4 LUFS | -3.8 dBTP | 6.1 LU | 279.60 s |

The cue layer moves integrated loudness by -0.02 LU, inside the 0.05 LU tolerance,
so no gain trim was applied (trim = +0.00 dB) and the song plays at exactly its original level. LRA rises
slightly only because the extended tail adds quiet seconds. The MP3's true peak (−3.8 dBTP) keeps ≥ 3.8 dB headroom.

## Sources and paid calls

Cloudflare's catalog has no ElevenLabs sound-effects endpoint (only TTS models and `elevenlabs/music-v2`; checked with
`cfai.py catalog --refresh`). Music v2 with `force_instrumental` and a "sound effects only, no music" prompt makes good
foley (checked for tonality/rhythm and by spectrogram; no music crept in), so the recorded-sounding layers come from it.
Seven generations, ≈ $0.33 in all, logged in `media/genlog.jsonl` (`sfx:*`; a first batch of seven was rejected
before generation because `seed` cannot be combined with `prompt`, cost $0). Shared prompt prefix: "Sound effects only, realistic field recording. No music, no melody, no musical instruments, no drums, no beat, no singing."

* `battle_bed` (A distant ancient battle heard from far away across a wide river valley: far-off bronze swords and shields clashing irregularly, horses neighing and galloping in the distance, muffled shouting of thousands of soldiers, a broad river flowing nearby, light wind. Distant, diffuse, continuous ambience.)
* `river` (A broad shallow river flowing over stones and gravel, steady natural water sound, gentle babbling, outdoors, no birds, no wind.)
* `horses_far` (Cavalry far away: many horses galloping on open ground in the distance, hoof thunder, occasional neighing, distant and muffled, outdoors.)
* `birdsong` (Sparse evening birdsong in an open meadow at dusk: a blackbird and a few small songbirds calling and answering, gentle, natural, no insects, no wind, no water.)
* `army_cheer` (A huge crowd of ancient soldiers far away across a valley suddenly erupting in a joyful roar and cheering, swelling then fading away, distant and diffuse, outdoors.)
* `keyboard` (A few slow mechanical keyboard key presses in a quiet room at night: close-up tactile clicky key switches, single keys with short pauses between them, then the spacebar, then silence.)
* `blade_drop` (A bronze sword dropped onto wet river stones: one metallic clang with a short bright ring, close-up, dry, then silence.)

Procedural (synthesised in `sound_design.py`, deterministic seed): the steppe wind and both cold gusts (noise through a
wandering band-pass, gust envelopes, faint whistle), the spark shimmer, the room tone, the wink's ting and the spectral
freeze. Wind, shimmer and ting are better synthesised than generated: they need exact timing, tuning and spectrum.
