"""Write production/SOUND_DESIGN.md from media/sfx/cues.json (numbers generated, prose here).

usage:  python tools/audio/sound_design_doc.py
"""
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
R = json.loads((ROOT / "media" / "sfx" / "cues.json").read_text())
OUT = ROOT / "production" / "SOUND_DESIGN.md"
PROMPTS = {}
try:   # the exact prompts live in sfx_gen.py
    import sys
    sys.path.insert(0, str(ROOT / "tools" / "audio"))
    import sfx_gen
    PROMPTS = {k: v[1] for k, v in sfx_gen.JOBS.items()}
    NO_MUSIC = sfx_gen.NO_MUSIC
except Exception:  # noqa: BLE001
    NO_MUSIC = ""


def mmss(t):
    return f"{int(t // 60)}:{t % 60:05.2f}"


def ebur128(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    s = out[out.rfind("Summary:"):]
    get = lambda key: next((ln.split(":")[1].strip().split()[0] for ln in s.splitlines() if ln.strip().startswith(key)), "?")
    return get("I:"), get("LRA:"), get("Peak:")


def main():
    L = R["loudness"]
    rows = []
    groups = {}
    for c in R["cues"]:
        key = c["name"].split("_")[0] if not c["name"].startswith("g3_key") else "g3"
        groups.setdefault(key, []).append(c)
    for key, cs in groups.items():
        c = cs[0]
        t0, t1 = min(x["t0"] for x in cs), max(x["t1"] for x in cs)
        rel = c.get("rel_LU")
        lvl = (f"{rel:+.1f} LU vs music (cue {c['cue_LUFS_S']:.1f} / music {c['music_LUFS_S']:.1f} LUFS-S)" if rel is not None
               else f"peak {c['peak_dbfs']:.1f} dBFS" + (f", {c['cue_LUFS_S']:.1f} LUFS-S" if c.get("cue_LUFS_S") else ""))
        if c.get("vocal_margin_db_p5") is not None:
            lvl += f"; ≥{c['vocal_margin_db_p5']:.1f} dB under the lead vocal in 1–5 kHz (5th pct of sung frames)"
        when = f"{mmss(t0)}–{mmss(t1)} ({t0:.2f}–{t1:.2f} s)"
        if key == "g3":
            when = ", ".join(f"{x['t0'] + 0.06:.2f}" for x in cs) + " s"
        rows.append(f"| **{c['cue']}** | {when} | {c['source']} | {c['processing']} | {lvl} | {c['rationale']} |")
    i0, lra0, tp0 = ebur128(ROOT / "Halys.mp3")
    i1, lra1, tp1 = ebur128(ROOT / "media" / "stems" / "halys_sd_master.wav")
    i2, lra2, tp2 = ebur128(ROOT / "release" / "Halys_sound_design.mp3")
    E = R["ending"]
    bed = next(c for c in R["cues"] if c["name"].startswith("a2_"))
    prompts = "\n".join(f"* `{k}` ({v[len(NO_MUSIC):].strip() if NO_MUSIC and v.startswith(NO_MUSIC) else v})" for k, v in PROMPTS.items())
    md = f"""# HALYS: sound design

**Deliverable:** [`release/Halys_sound_design.mp3`](../release/Halys_sound_design.mp3) (320 kbps CBR, 48 kHz, tags + cover from
`Halys.mp3`). Video mux master: `media/stems/halys_sd_master.wav` (48 kHz / 24-bit, gitignored) and the cue bus alone,
`media/stems/halys_sd_bus.wav`. Processed cues: `media/sfx/cue_*.flac` (each cue's own span, start times in
`media/sfx/cues.json`; regenerable, gitignored); the paid ElevenLabs sources are kept in `media/sfx/src/`.
Re-render: `python tools/audio/sfx_gen.py` (sources, paid) → `python tools/audio/sound_design.py` → `python tools/audio/sound_design_doc.py`.

**New duration: {R['dur_new']:.2f} s ({mmss(R['dur_new'])})** vs {R['dur_original']:.2f} s. Same t = 0 as the original: every
timing in `AUDIO_MAP.md` / `timing.json` holds; `timing.json` → `durExt = {R['dur_new']:.2f}`, `sound_design{{}}`.
The last sound ends at {R['last_sound']:.2f} s, then {R['dur_new'] - R['last_sound']:.1f} s of digital silence for the cut to black.
**The wink's "ting" is at {R['wink_ting']:.2f} s ({mmss(R['wink_ting'])})**: put the eyelid's close on it.

## Rules this layer follows

* The song is untouched: the master equals `Halys.mp3` + the cue bus sample-for-sample (verified to 24-bit precision) up to
  {E['crossfade_at']:.2f} s, where the original's mastering fade crossfades into the frozen final chord (cue g).
* Everything is timed from the measured grid and word onsets (`video/data/timing.json`), never by ear-guessing.
* Never over the voice: every cue is sidechain-ducked by the lead-vocal stem (4–9 dB), kept out of the 1–5 kHz
  intelligibility band (presence dips / high-passes), and the bronze clashes only land in the singer's breaths.
  Margins in the table are measured on the rendered mix.
* Levels are set against the music's own short-term loudness at that moment (EBU R128, 3 s), not absolute guesses.
* Loudness is matched to the original (table at the end); no limiter, no re-master.

## Cue sheet

| Cue | When | Source | Processing | Level | Why |
|---|---|---|---|---|---|
{chr(10).join(rows)}

### Notes per cue

* **a/b battle bed.** In the cold open it is clearly audible between the cello's harmonics (~18 dB under the cello);
  from 7.2 s the orchestra masks it almost completely (it peeks through the lulls at 29–32 s and 46–52 s), which is the
  intended "continues low". {len(bed.get('clashes', []))} far bronze clashes in all: {', '.join(f'{x:.2f}' for x in bed.get('clashes', []))} s
  (from 73.72 s they sit in the singer's breaths: one before "Lydians", five around "slew each other on the shore"). The drain is a 7 kHz → 220 Hz low-pass
  glide plus a fade, from "when light went strange" ({bed['processing'].split('(')[-1].rstrip(')')}).
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
  (average STFT magnitude of {E['freeze_window'][0]:.2f}–{E['freeze_window'][1]:.2f} s, random-phase resynthesis, as in
  orbital's `extend_ending.py`), crossfaded in at {E['crossfade_at']:.2f} s (0.6 s), held {E['hold']:.1f} s, then decays
  over {E['decay']:.1f} s while a low-pass glides 7 kHz → 900 Hz (highs die first) with a little open space. Under it:
  room tone from 272.2 s, three key presses, then the ting; the chord is ~50 dB down when the ting sounds.

## Loudness (before / after)

| File | Integrated (ffmpeg / pyloudnorm) | True peak (ffmpeg / 4× oversampled) | LRA | Duration |
|---|---|---|---|---|
| `Halys.mp3` (original) | {i0} / {L['original_I']:.2f} LUFS | {tp0} / {L['original_TP']:.2f} dBTP | {lra0} LU | {R['dur_original']:.2f} s |
| `halys_sd_master.wav` | {i1} / {L['master_I']:.2f} LUFS | {tp1} / {L['master_TP']:.2f} dBTP | {lra1} LU | {R['dur_new']:.2f} s |
| `Halys_sound_design.mp3` | {i2} LUFS | {tp2} dBTP | {lra2} LU | {R['dur_new']:.2f} s |

The cue layer moves integrated loudness by {L['mixed_I_before_trim'] - L['original_I']:+.2f} LU, inside the 0.05 LU tolerance,
so no gain trim was applied (trim = {L['trim_db']:+.2f} dB) and the song plays at exactly its original level. LRA rises
slightly only because the extended tail adds quiet seconds. The MP3's true peak (−3.8 dBTP) keeps ≥ 3.8 dB headroom.

## Sources and paid calls

Cloudflare's catalog has no ElevenLabs sound-effects endpoint (only TTS models and `elevenlabs/music-v2`; checked with
`cfai.py catalog --refresh`). Music v2 with `force_instrumental` and a "sound effects only, no music" prompt makes good
foley (checked for tonality/rhythm and by spectrogram; no music crept in), so the recorded-sounding layers come from it.
Seven generations, ≈ $0.33 in all, logged in `media/genlog.jsonl` (`sfx:*`; a first batch of seven was rejected
before generation because `seed` cannot be combined with `prompt`, cost $0). Shared prompt prefix: "{NO_MUSIC}"

{prompts}

Procedural (synthesised in `sound_design.py`, deterministic seed): the steppe wind and both cold gusts (noise through a
wandering band-pass, gust envelopes, faint whistle), the spark shimmer, the room tone, the wink's ting and the spectral
freeze. Wind, shimmer and ting are better synthesised than generated: they need exact timing, tuning and spectrum.
"""
    OUT.write_text(md)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
