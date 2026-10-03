# HALYS — music video

**Song:** *Halys* by Jade Wang
**Video:** every frame drawn by JavaScript, at 4:41 and 1920×1080, 60 fps

* ▶ **[`release/Halys_1080p60_hevc.mp4`](release/Halys_1080p60_hevc.mp4)** — 1920×1080, 60 fps, HEVC (two-pass, sized under GitHub's 100 MB limit)
* [`release/Halys_720p60_h264.mp4`](release/Halys_720p60_h264.mp4) — 1280×720, 60 fps, H.264, for players and sites that need H.264
* [`release/Halys_sound_design.mp3`](release/Halys_sound_design.mp3) — the song with the film's sound-design layer (loudness-matched, 4:39.6)

> 28 May 585 BC. Two armies were killing each other by a red river in Anatolia.
> Then the sun went out. They laid down their weapons and went home.

In the sixth year of the war between Lydia and Media, a total solar eclipse arrived in the middle of a battle. Herodotus (1.74) says both sides stopped fighting,
made peace, made the Halys their border and sealed it with a marriage. Thales of Miletus is said to have predicted it.
The film follows that legend and then breaks reality on the drop.

## The film

**The eclipse is a real eclipse, and the only eyelid is hers.** The four contact points of a solar eclipse are the act breaks, so every genre switch
has a physical cause:

| | Sky | Song | World | Genre |
|---|---|---|---|---|
| C1 | the Moon's first bite | intro → chorus 1 | **BRONZE**: Baroque oil paint, Caravaggio light, Altdorfer sky | war epic |
| C2 | totality | Drop 1 | **CORONA**: the world redrawn as luminous field lines, 60 fps | reality breaks |
| | mid-totality | verse 2 → Thales | **MARBLE**: the battle frozen as painted statuary | time stopped |
| C3 | the diamond ring, *"a sudden spark"* | final chorus | **GOLD**: paint in returning sunlight | triumph |
| C4 | the Sun whole again | Drop 2 → outro | **ORBIT** → **INK**: eclipses through history, Earth, and the room | cosmic → comedy |

What happens:
- The sun's growing bite is the countdown through Act I, and totality lands exactly on the first kick of Drop 1.
- Drop 2 runs every time humanity looked up at the same ring: the Antikythera mechanism, Halley's 1715 map, Eddington in 1919,
  Concorde in 1973, the 2024 crowds, Artemis II, Luxor 2027 and a Phobos eclipse on Mars. Then Earthset, the first blue in the film.
- In the room, she spins to camera on the final chord, holds a deadpan stare, types `git commit -am "fix(halys): schedule eclipse to end war (#585)"`
  without looking, and winks. Her eyelid crosses her eye like the Moon crossing the Sun.

Facts on screen are checked in [`production/FACTCHECK.md`](production/FACTCHECK.md). The eclipse geometry (sunset totality, Sun 8.6° above the WNW horizon,
Jupiter beside it, Saros 57) is computed in [`production/RESEARCH.md`](production/RESEARCH.md). The terminal admits the one liberty: under standard ΔT the Halys
itself only reached 96–99 %, hence `dt.shift(+300)`.

| Production documents | |
|---|---|
| Treatment | [`production/TREATMENT.md`](production/TREATMENT.md) |
| Style bible | [`production/STYLE_BIBLE.md`](production/STYLE_BIBLE.md) |
| Shot list, locked to the beat grid | [`production/SHOTLIST.md`](production/SHOTLIST.md) |
| Audio map (beats, sections, word timings) | [`production/AUDIO_MAP.md`](production/AUDIO_MAP.md) |
| Sound design cue sheet | [`production/SOUND_DESIGN.md`](production/SOUND_DESIGN.md) |
| History and costume research | [`production/RESEARCH.md`](production/RESEARCH.md) |
| Zeitgeist brief | [`production/ZEITGEIST.md`](production/ZEITGEIST.md) |
| The room and its terminal | [`production/ROOM.md`](production/ROOM.md) |
| Boards: character sheets, sets, style frames | [`production/BOARDS.md`](production/BOARDS.md), `media/boards/` |
| Reference plates | [`production/PLATES.md`](production/PLATES.md) |

## How it was made (and what is AI)

```
song ──► stems, beat grid, word timings ──────────────────────────────────────────┐
research ──► character, set and style boards (image models) ──► reference plates (Seedance 2.5, song slices as audio reference)
                                                                  └──► analysis: flow · edges · tone · depth · mattes
                                                                         └──► JS renderers (brush · line · ink) + kinetic type ──► 16,860 frames ──► MP4
```

1. **The song.** Stems, a beat grid with drift (136→142 BPM), sections and word-level lyric timings (Whisper, force-corrected to the true lyric):
   [`video/data/timing.json`](video/data/timing.json). Every cut and every word on screen is keyed to it.
2. **Boards.** Historical character turnarounds, set sheets and style frames were generated with image models (Nano Banana Pro, GPT Image 2, Seedream)
   from the research briefs, with costume accuracy reviewed against Herodotus, the Persepolis reliefs and museum references.
3. **Reference plates.** 49 short clips generated with **Seedance 2.5** on Cloudflare, each conditioned on the boards and on the matching slice of the song.
   **They are never shown.** The renderer reads them only as data: optical flow, structure, edges, depth, subject mattes and timing.
4. **The drawing.** Three engines draw every frame from that data as a pure function of song time (`renderAt(t)`), in headless Chromium:
   * **brush** (`video/src/worlds/brush/`): coarse-to-fine painterly strokes along the flow field, designed light pools, impasto, canvas, varnish;
     drawn at 12 fps so the paint boils without strobing. BRONZE, MARBLE and GOLD share it.
   * **line** (`video/src/worlds/line/`): flow-advected field lines, a corona modelled on totality photographs, particles, 3D orbits from depth; 60 fps.
   * **ink** (`video/src/worlds/ink/`): flat cel animation on twos for the room, with the eyelid drawn by hand.
   * **type** (`video/src/type/`): gilded carved capitals lit by each scene, chopped words filled with corona streamers, inscriptions, the terminal.
5. **Sound.** The song is untouched. A light layer of wind, a distant battle, birds that stop on "quiet", a roar, a blade, keys and one sparkle
   (ElevenLabs via Cloudflare plus procedural synthesis) is mixed 15–35 dB under it and loudness-matched (−15.4 LUFS).

The honest provenance line: **drawn in JavaScript over AI-generated motion reference (Seedance 2.5); boards made with image models; sound-design layer partly
AI-generated.** Generation spend is logged call by call in `media/genlog.jsonl` (≈ $127 total, $112 of it on Seedance plates).

## Render it

```bash
cd video && npm install
node render.mjs --list                                   # the shot table
node render.mjs --sheet=S01,S35,S57,S81 --cols=4         # quick contact sheet
node render.mjs --frames=0:281 --workers=3 --recycle=60  # all frames -> out/frames (resumable)
cd .. && tools/encode_release.sh                         # the release files
```

`--size=1080x1350` re-renders natively in 4:5 (type re-flows per aspect). Plate frames and analysis maps are regenerated from the Seedance takes with
`tools/pipeline.sh`; the takes themselves are not committed.
