"""Write production/AUDIO_MAP.md from video/data/timing.json (tables are generated, prose lives here).

usage:  python tools/audio/audio_map.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
T = json.loads((ROOT / "video" / "data" / "timing.json").read_text())
OUT = ROOT / "production" / "AUDIO_MAP.md"


def mmss(t):
    return f"{int(t // 60)}:{t % 60:05.2f}"


def bar(n):
    return T["bars"][n - 1]


def frame(t):
    import math
    return math.ceil(t * 24 - 1e-6)


def section_table():
    import statistics
    rows = ["| # | Section | Start | End | Start (s) | End (s) | Bars | BPM | What the music does |", "|---|---|---|---|---|---|---|---|---|"]
    for i, s in enumerate(T["sections"]):
        b = f"{s['bar0']}" if s["bar0"] == s["bar1"] else f"{s['bar0']}–{s['bar1']}"
        bp = [x["bpm"] for x in T["bars"] if x["bpm"] and x["beats"] == 4 and s["bar0"] <= x["n"] <= s["bar1"]]
        bpm = f"{statistics.median(bp):.1f}" if bp else "–"
        rows.append(f"| {i + 1} | **{s['name']}** | {mmss(s['t0'])} | {mmss(s['t1'])} | {s['t0']:.2f} | {s['t1']:.2f} | {b} | {bpm} | {s['desc']} |")
    return "\n".join(rows)


def bar_of(t):
    return next((b["n"] for b in T["bars"] if b["t0"] - 2e-3 <= t < b["t1"] - 2e-3), 0)


def lyric_table():
    rows = ["| Section | Line (true text) | Start | End | Start (s) | End (s) | Bar | Word starts (s) |", "|---|---|---|---|---|---|---|---|"]
    for ln in T["lines"]:
        ws = " · ".join(f"{w[1]} {w[0]:.2f}" for w in ln["words"])
        rows.append(f"| {ln['sec']} | {ln['text']} | {mmss(ln['t0'])} | {mmss(ln['t1'])} | {ln['t0']:.2f} | {ln['t1']:.2f} | {bar_of(ln['t0'])} | {ws} |")
    return "\n".join(rows)


def chop_table():
    rows = ["| Drop | Bar.beat | Time | Start (s) | End (s) | Chop | Confidence |", "|---|---|---|---|---|---|---|"]
    for c in T["chops"]:
        if c["word"] == "stutter":
            continue
        rows.append(f"| {c['drop']} | {c['bar']}.{c['beat_in_bar']} | {mmss(c['t'])} | {c['t']:.2f} | {c['end']:.2f} | **{c['word'].upper()}** | {c['conf'].split(':')[0]} |")
    st = [c["t"] for c in T["chops"] if c["word"] == "stutter"]
    return "\n".join(rows) + (f"\n\nStutter onsets, Drop 1 bars 65–67 ({len(st)}; 8th notes in bar 65, 16ths in bars 66–67; "
                              f"`chops[]` with `word: \"stutter\"`): " + ", ".join(f"{x:.2f}" for x in st))


def moments_table():
    rows = ["| Time | s | Frame @24 | Bar | Moment |", "|---|---|---|---|---|"]
    for m in T["events"]["key_moments"]:
        rows.append(f"| {mmss(m['t'])} | {m['t']:.2f} | {frame(m['t'])} | {m['bar']} | {m['what']} |")
    return "\n".join(rows)


def main():
    E = T["events"]
    d1, d1r, d2 = E["drop_impacts"]
    bpms = [b["bpm"] for b in T["bars"] if b["bpm"]]
    booms = ", ".join(f"{h['t']:.2f}" for h in E["booms"])
    stabs = sorted(E["stabs"], key=lambda s: -s["s"])[:16]
    stabs = ", ".join(f"{s['t']:.2f}" for s in sorted(stabs, key=lambda s: s["t"]))
    choir = ", ".join(f"{c['t0']:.1f}–{c['t1']:.1f}" for c in E["choir"])
    durx = T.get("durExt")
    md = f"""# HALYS: audio map

The timing reference for the edit. All times are song time in seconds from the first sample of `Halys.mp3`
(48 kHz, {T['dur']:.2f} s; `ffmpeg` decode, encoder delay already skipped). Frame numbers are at 24 fps
(frame = ceil(t × 24), the first frame at or after the event). Machine-readable: [`video/data/timing.json`](../video/data/timing.json).
Overview plot: [`audio_overview.png`](audio_overview.png). Pipeline: `tools/audio/` (see the end of this file).

## The numbers to cut on

| | Time | s | Frame | Bar |
|---|---|---|---|---|
| **Drop 1 first kick** (totality, "we just went sci-fi") | **{mmss(d1['t'])}** | {d1['t']:.3f} | {frame(d1['t'])} | 64 |
| Drop 1 one-bar break (kick out) | {mmss(bar(72)['t0'])} → {mmss(bar(73)['t0'])} | {bar(72)['t0']:.3f} → {d1r['t']:.3f} | {frame(bar(72)['t0'])} → {frame(d1r['t'])} | 72 |
| "a sudden **spark**" (diamond ring; vowel held to 200.2 s) | {mmss(194.84)} | 194.84 | {frame(194.84)} | 113 |
| Beat held back (low end out) → beat returns on "Home" | {mmss(bar(122)['t0'])} → {mmss(bar(123)['t0'])} | {bar(122)['t0']:.3f} → {bar(123)['t0']:.3f} | {frame(bar(122)['t0'])} → {frame(bar(123)['t0'])} | 122 → 123 |
| **Drop 2 first kick** (swords → starships) | **{mmss(d2['t'])}** | {d2['t']:.3f} | {frame(d2['t'])} | 125 |
| Final stark chord (the wink) | {mmss(E['final_chord']['t'])} | {E['final_chord']['t']:.2f} | {frame(E['final_chord']['t'])} | 157 |

Drop kicks: the grid beats sit on the kick click (median error < 3 ms inside the drops); the very first kick of each drop
is masked by the crash/riser and is good to about ±10 ms. Risers: {E['risers'][0]['t0']:.1f} s → Drop 1 and {E['risers'][1]['t0']:.1f} s → Drop 2
(a bright cymbal/noise swell, +15 dB above 6 kHz). There is no true digital silence anywhere before the final decay.

## Big surprises vs the lyric sheet / zeitgeist brief

1. **The intro is 67 s long.** Nothing is sung until **1:07.7** ("The River Halys"). The brief's "verse 1 at ≈0:28" is wrong:
   0:28–0:31 is the lull after an orchestral boom at 0:27.24. The cold open (0:00–0:07.18) is still the pianissimo hook,
   and the "sun's growing bite" countdown has a full minute of instrumental music before the first lyric.
2. **Tempo is not a steady 136 BPM.** It starts at ~136.4 BPM and drifts up to ~141–142 BPM by Drop 2 (median
   {T['bpm']:.1f}; per-section values in the table below; Suno does not lock to a grid). Use `beat_times`/`downbeats`,
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

{section_table()}

## Key moments

{moments_table()}

## Lyrics, word by word

True lyric text (from the lyric sheet; Suno sang "Hailys", "warriors odd", "Thaylees"). Word starts are snapped to
lead-vocal onsets: about ±0.05 s on consonant attacks and phrase starts, ±0.15 s inside long legato lines (e.g.
"Sun burning on the bronze"). `words[]` in timing.json are `[start, word, end]`; a line's end is where its last
note stops (capped at the next line's start).

{lyric_table()}

## Chopped vocals (every occurrence)

Suno sang the chops as varying phrases rather than one repeated sample, so they were located from vocal-stem onsets,
the bar grid and short-window Whisper passes, not by template matching. *high* = rhythm + Whisper agree;
*pattern* = same 2-bar rhythm as the confirmed cycles; *medium/low* = see `conf` in timing.json.

{chop_table()}

## Notable hits and textures

* **Drop kicks:** {len(E['kicks'])} (every beat of bars 64–71, 73–88, 125–149) in `events.kicks`.
* **Big low booms / timpani hits** (outside the drops, low-band jump ≥ 16 dB): {booms}.
  The two biggest: **102.21** (chorus 1, "eye of gods above" → "Throw down") and **203.60** (final chorus, after "day");
  also 211.84 (the impact at the end of the held-back bar) and 259.35 (outro). `events.timpani` has the full list (≥ 12 dB).
* **Strongest brass/string stabs** (drops): {stabs} (`events.stabs`, 258 in all).
* **Choir / backing-vocal entrances:** {choir} (`events.choir`).
* **Snare rolls / dense snare-band runs:** `events.snare_rolls` (e.g. 111.2–117.0 under the Drop 1 stutter, 154.2–160.3 in the breakdown).
* **Silences / holds:** `events.holds` (Drop 1 break, final-chorus drop-out 207.4–208.5, beat held back bar 122, outro stop at 257.68).
* **Ending:** kick stops 257.68 with a hit; stop-time hits 259.35 and 261.05; boom 262.72; ticking build from 266.1;
  final hits 266.99–269.8; **final stark chord 270.04**, decaying to silence by ~273.4 (file ends 273.60).
  {"Sound-design version runs to " + f"{durx:.2f} s (see SOUND_DESIGN.md)." if durx else ""}

## Curves (24 fps)

`curves` holds one value per video frame (frame i = song time i/24, n = {T['curves']['n']}), each normalised 0–1:
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
* Sound design (the "updated sound" mp3): `sfx_gen.py` (ElevenLabs sources) → `sound_design.py` (cues, freeze ending,
  loudness match → `release/Halys_sound_design.mp3`, `media/stems/halys_sd_master.wav`) → `sound_design_doc.py`
  (`production/SOUND_DESIGN.md`). `timing.json` → `durExt`, `sound_design{{}}` carry its duration and cue times.
* Stems used: MDX-Net Kim_Vocal_2 vocals/instrumental + UVR KARA_2 lead/backing split (clean enough for every
  measurement here; the interrupted BS-Roformer re-separation was not needed).
"""
    OUT.write_text(md)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
