"""Assemble video/data/timing.json (+ the tables for production/AUDIO_MAP.md) from the analysis stages.

usage:  python tools/audio/build_outputs.py [--tables]
reads:  media/stems/analysis/analysis.json (analyze.py), lyrics_aligned.json (align_lyrics.py)
writes: video/data/timing.json; with --tables prints the markdown tables used in AUDIO_MAP.md

timing.json (times in seconds of song time; t = 0 is the first sample of Halys.mp3 as decoded by ffmpeg):
  bpm, bpm_nominal, beat, t0, dur, durExt     orbital-compatible header (bpm = median, see tempo[] for the drift)
  beat_times[] (= beats[]), downbeats[], bars[{n,t0,t1,beats,bpm}], tempo[{t,bpm}] (per bar)
  sections[{id,name,t0,t1,bar0,bar1,desc}]    bar-aligned (cold open starts at 0.0)
  lines[{sec,text,t0,t1,words[[t,word,end]]}] true lyric text, word starts snapped to vocal onsets
  chops[{drop,word,t,end,bar,beat,conf}]      every chopped-vocal occurrence in the drops (+ the stutter onsets)
  events{drop_impacts, kicks, snares, snare_rolls, stabs, low_hits, timpani, choir, vocal_phrases, risers,
         holds, final_chord, key_moments}
  curves{fps, n, t0, rms, low, mid, high, onset, vocal}   0..1 per frame at 24 fps (frame i = song time i/24)
  sound_design{mp3, master, dur, last_sound, wink_ting, ending, loudness, cues[{name,t0,t1,cue}]}   (sound_design.py)
"""
import json
import pathlib
import sys

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
AN = ROOT / "media" / "stems" / "analysis"
OUT = ROOT / "video" / "data" / "timing.json"

# Bar-aligned sections. Bar numbers are 1-based (bar 1 = first downbeat at 0.146 s); bar 14 has 6 beats
# (the intro swell) and bar 155 has 5 (the outro), every other bar has 4.
SECTIONS = [
    ("cold_open", "Cold open: pianissimo cello", 1, 4,
     "solo cello, muted strings, a soft ticking 8th pulse; no low end (sub band ~-65 dB). The hook window."),
    ("intro_a", "Intro A: strings enter", 5, 15,
     "low strings + full string section at bar 5 (7.18 s); 8th-note string ostinato over an F# pedal (V of B minor), "
     "chromatic bass walk from ~19.5 s; ostinato stops ~23.3 s, then a rubato cymbal/string swell (bar 14 = 6 beats) into the boom"),
    ("intro_b", "Intro B: the boom and the build", 16, 38,
     "low orchestral boom on bar 16 (27.24 s); lull bars 17-18 (sub drops out); orchestral build bars 19-26; "
     "bass drops out again bars 27-29 (46.5-51.7 s); full orchestra bars 30-38. Wordless choir swell ~41.5-42.9 s."),
    ("verse1", "Verse 1", 39, 51,
     "hushed close lead vocal over the orchestra; first sung word 'The' at ~67.7 s (bar 39)"),
    ("pre1", "Pre-chorus", 52, 55,
     "'A halo in the sky...': pickup 'A' at 89.2 s in bar 51; dread, tremolo strings, pulsing low 8ths"),
    ("chorus1", "Chorus 1", 56, 63,
     "full orchestra + huge choir; syncopated orchestral hits; 'Throw down' 103.6 s; riser from ~108.0 s into the drop"),
    ("drop1_a", "Drop 1 (8 bars)", 64, 71,
     "orchestral EDM: four-on-the-floor kick from 110.57 s, sub bass, pumping strings, brass stabs. Chops: "
     "HALO / IN THE / SKY / SKY on the 4 beats of bar 64, then an 8th -> 16th stutter bars 65-67; bars 68-71 instrumental"),
    ("drop1_break", "Drop 1 one-bar break", 72, 72, "kick out for exactly one bar (124.48-126.21 s)"),
    ("drop1_b", "Drop 1 (16 bars)", 73, 88,
     "kick back on bar 73; bars 73-80 instrumental; bars 81-88 four 2-bar cycles of the sung chop "
     "(halo on beat 2, in the on beat 4, sky on beat 1, sky on beat 3)"),
    ("breakdown", "Breakdown", 89, 92, "falls back to quiet: piano and soft strings, faint pulse (4 bars)"),
    ("verse2", "Verse 2", 93, 100, "'What was it like...': piano + strings, faint pulse, close vocal"),
    ("shadow", "'a shadow crossed the hills'", 101, 104, "two lines; orchestra thickens"),
    ("thales", "'Thales foretold...' build", 105, 115,
     "strings + choir climbing; breath 187.65-188.55 s; '[rest]' 192.75-193.1 s; 'a sudden SPARK' lands on bar 113 "
     "(194.84 s) and the vowel is held ~5 s (194.9-200.2 s) as the orchestra swells: the diamond ring"),
    ("chorus2", "Final chorus (beat held back)", 116, 124,
     "'Shadow turned to day' 200.3 s; bright layer drops out 207.4-208.5 s; 'Throw down your blade' 208.7 s; "
     "low end OUT for bar 122 (210.18-211.88 s, held 'blade'); pickup 'Home' 211.44, beat returns on bar 123 (211.88); "
     "riser ~212.3 s -> drop"),
    ("drop2", "Drop 2", 125, 149,
     "fierce orchestral EDM drop, kick from 215.28 s; the topline is wordless sustained vocal (bars 125-133, 138-148); "
     "the shouted chops come at its end: THROW DOWN 256.41 / 257.25 (bar 149)"),
    ("outro", "Outro: stop-time hits, final chord", 150, 159,
     "kick stops; hits on bars 150-153 with THROW DOWN 259.78 and BLADE 260.63; boom + held 'throw down' 262.7-266.1 s; "
     "ticking build; final stark chord 270.04 s decaying to silence by ~273.4 s"),
]

KEY_MOMENTS = [  # (bar number -> its downbeat, or a time in s, label)
    (("bar", 5), "low end + full strings enter"),
    (("bar", 16), "intro boom"),
    (67.73, "first sung word 'The'"),
    (("bar", 64), "DROP 1 first kick"),
    (("bar", 72), "Drop 1 one-bar break (kick out)"),
    (("bar", 73), "Drop 1 kick returns"),
    (("bar", 89), "Drop 1 ends -> breakdown"),
    (168.32, "'quiet' (Birds went quiet)"),
    (194.845, "'spark' (on the bar-113 downbeat, vowel held ~5 s)"),
    (200.315, "'Shadow turned to day' - final chorus"),
    (("bar", 122), "beat held back: low end out"),
    (211.44, "'Home' (pickup)"),
    (("bar", 123), "beat returns"),
    (("bar", 125), "DROP 2 first kick"),
    (("bar", 150), "Drop 2 kick stops; stop-time hit"),
    (270.04, "final stark chord"),
]


def main():
    A = json.loads((AN / "analysis.json").read_text())
    L = json.loads((AN / "lyrics_aligned.json").read_text())
    g = np.array(A["beats"])
    dn = A["downbeat_idx"]
    dur = float(A["dur"])
    bars = []
    for i, k in enumerate(dn):
        k1 = dn[i + 1] if i + 1 < len(dn) else len(g)
        t1 = float(g[k1]) if k1 < len(g) else dur
        nb = k1 - k
        bars.append(dict(n=i + 1, t0=round(float(g[k]), 3), t1=round(t1, 3), beats=nb,
                         bpm=round(60.0 * nb / (t1 - g[k]), 2) if k1 < len(g) else None))
    bt = {b["n"]: b for b in bars}

    def bar_of(t):
        for b in bars:
            if b["t0"] - 2e-3 <= t < b["t1"] - 2e-3:
                return b["n"]
        return 0 if t < bars[0]["t0"] else bars[-1]["n"]

    def beat_of(t):
        j = int(np.searchsorted(g, t + 1e-6) - 1)
        return max(j, 0)

    sections = []
    for i, (sid, name, b0, b1, desc) in enumerate(SECTIONS):
        t0 = 0.0 if i == 0 else bt[b0]["t0"]
        t1 = bt[b1]["t1"] if b1 < len(bars) else dur
        sections.append(dict(id=sid, name=name, t0=round(t0, 3), t1=round(t1, 3), bar0=b0, bar1=b1, desc=desc))

    lines = [dict(sec=x["sec"], text=x["text"], t0=x["t0"], t1=x["t1"],
                  words=[[w["t"], w["w"], w["end"]] for w in x["words"]]) for x in L["lines"]]
    chops = []
    for c in L["chops"]:      # label with the NEAREST beat (sung onsets sit a few ms either side of the grid)
        j = int(np.argmin(np.abs(g - c["t"])))
        bn = bar_of(float(g[j]))
        chops.append(dict(drop=c["drop"], word=c["word"], t=c["t"], end=c["end"], bar=bn,
                          beat=j, beat_in_bar=j - dn[bn - 1] + 1, off_beat_ms=round(1000 * (c["t"] - g[j])), conf=c["conf"]))

    # ---- events
    drop_bars = [(64, 71), (73, 88), (125, 149)]

    def in_drop(t):
        return any(bt[a]["t0"] - 0.03 <= t < bt[b]["t1"] - 0.03 for a, b in drop_bars)

    # four-on-the-floor kicks: every grid beat in the drop bars whose low-band percussive flux peaks within +-30 ms of
    # the beat at >= 3x the bar's median flux. Time = the grid beat, which sits on the kick's click (measured on the
    # high-passed instrumental: median |grid - click| < 3 ms inside the drops; the first kick of each drop is masked
    # by the crash/riser and is good to ~10 ms)
    Z = np.load(AN / "envelopes.npz")
    te, lowf = Z["t"], Z["low"]
    kicks = []
    for a, b in drop_bars:
        for j in range(dn[a - 1], dn[b] if b < len(dn) else len(g)):
            w = np.where(np.abs(te - g[j]) <= 0.03)[0]
            bar_n = bar_of(float(g[j]))
            ref = np.median(lowf[(te >= bt[bar_n]["t0"]) & (te < bt[bar_n]["t1"])])
            if len(w) and lowf[w].max() >= 3 * ref:
                kicks.append(round(float(g[j]), 3))
    drop_impacts = [dict(t=kicks[0], name="Drop 1 first kick", bar=64),
                    dict(t=next(k for k in kicks if k > bt[73]["t0"] - 0.05), name="Drop 1 kick returns after the one-bar break", bar=73),
                    dict(t=next(k for k in kicks if k > 215.0), name="Drop 2 first kick", bar=125)]
    low_hits = [dict(t=h["t"], db=round(h["low_db"], 1), jump=round(h["jump"], 1)) for h in A["low_hits"] if not in_drop(h["t"])]
    timpani = [h for h in low_hits if h["jump"] >= 12 and h["db"] > -40]     # timpani / low orchestral hits
    booms = [h for h in low_hits if h["jump"] >= 16 and h["db"] > -30]       # the big ones
    snares = [s["t"] for s in A["snares"] if s["s"] >= 0.35]
    stabs = [dict(t=round(s["t"], 3), s=s["s"]) for s in A["stabs"]]
    choir = [dict(t0=c["start"], t1=c["end"], db=c["back_db"]) for c in A["choir"]]
    phrases = [[x["t0"], x["t1"], x["text"]] for x in lines]
    events = dict(
        drop_impacts=drop_impacts, kicks=kicks, snares=snares, snare_rolls=A["snare_rolls"], stabs=stabs,
        low_hits=low_hits, timpani=timpani, booms=booms, choir=choir, vocal_phrases=phrases,
        risers=[dict(t0=108.0, t1=drop_impacts[0]["t"], into="Drop 1", what="bright noise/cymbal swell (>6 kHz +15 dB) + snare"),
                dict(t0=212.3, t1=drop_impacts[2]["t"], into="Drop 2", what="bright swell (>6 kHz +15 dB)")],
        holds=[dict(t0=bt[72]["t0"], t1=bt[72]["t1"], what="Drop 1 one-bar break: kick out"),
               dict(t0=207.4, t1=208.5, what="final chorus: bright layer + vocal drop out before 'Throw down'"),
               dict(t0=bt[122]["t0"], t1=bt[122]["t1"], what="beat held back: low end out (sub ~-60 dB), 'blade' held"),
               dict(t0=bt[150]["t0"], t1=bt[151]["t0"], what="Drop 2 kick stops; low end out after the hit")],
        final_chord=dict(t=270.04, decay_to=273.4),
        key_moments=[dict(t=bt[t[1]]["t0"] if isinstance(t, tuple) else t, what=w,
                          bar=t[1] if isinstance(t, tuple) else bar_of(float(g[int(np.argmin(np.abs(g - t)))])))
                     for t, w in KEY_MOMENTS],
    )
    cur = A["curves"]
    curves = dict(fps=24, n=len(cur["rms"]), t0=0.0, **{k: cur[k] for k in ("rms", "low", "mid", "high", "onset", "vocal")})
    ib = np.diff(g)
    out = dict(
        song="Halys.mp3", sr=48000, dur=dur, durExt=None,
        bpm=round(float(60 / np.median(ib)), 2), bpm_nominal=136, beat=round(float(np.median(ib)), 5), t0=round(float(g[0]), 3),
        tempo_note="tempo drifts ~136.4 BPM (intro) -> ~142 BPM (Drop 2); use beat_times, never a constant grid",
        beat_times=[round(float(x), 3) for x in g], beats=[round(float(x), 3) for x in g],
        downbeats=[round(float(g[k]), 3) for k in dn], bars=bars,
        tempo=[dict(t=b["t0"], bpm=b["bpm"]) for b in bars if b["bpm"]],
        sections=sections, lines=lines, chops=chops, events=events, curves=curves,
    )
    sdj = ROOT / "media" / "sfx" / "cues.json"          # written by sound_design.py (the extended "updated sound" mix)
    if sdj.exists():
        sd = json.loads(sdj.read_text())
        out["durExt"] = sd["dur_new"]
        out["sound_design"] = dict(
            mp3="release/Halys_sound_design.mp3", master="media/stems/halys_sd_master.wav", dur=sd["dur_new"],
            last_sound=sd["last_sound"], wink_ting=sd["wink_ting"], ending=sd["ending"], loudness=sd["loudness"],
            note="same t = 0 as Halys.mp3; identical to the original up to the crossfade, then the frozen chord tail",
            cues=[dict(name=c["name"], t0=c["t0"], t1=c["t1"], cue=c["cue"]) for c in sd["cues"]])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1e3:.0f} kB): {len(g)} beats, {len(bars)} bars, {len(sections)} sections, "
          f"{len(lines)} lines, {len(chops)} chops, {len(kicks)} drop kicks")
    if "--tables" in sys.argv:
        tables(out)


def mmss(t):
    return f"{int(t // 60)}:{t % 60:05.2f}"


def tables(T):
    print("\n| # | Section | Start | End | Start (s) | End (s) | Bars | What the music does |\n|---|---|---|---|---|---|---|---|")
    for i, s in enumerate(T["sections"]):
        bars = f"{s['bar0']}" if s["bar0"] == s["bar1"] else f"{s['bar0']}-{s['bar1']}"
        print(f"| {i + 1} | {s['name']} | {mmss(s['t0'])} | {mmss(s['t1'])} | {s['t0']:.2f} | {s['t1']:.2f} | {bars} | {s['desc']} |")
    print("\n| Section | Line | Start | End | Start (s) | Bar | Words (s) |\n|---|---|---|---|---|---|---|")
    bars = T["bars"]

    def bar_of(t):
        return next((b["n"] for b in bars if b["t0"] - 1e-6 <= t < b["t1"]), 0)
    for ln in T["lines"]:
        ws = " ".join(f"{w[1]} {w[0]:.2f}" for w in ln["words"])
        print(f"| {ln['sec']} | {ln['text']} | {mmss(ln['t0'])} | {mmss(ln['t1'])} | {ln['t0']:.2f} | {bar_of(ln['t0'])} | {ws} |")
    print("\n| Drop | Bar.beat | Time | s | Chop | Confidence |\n|---|---|---|---|---|---|")
    for c in T["chops"]:
        if c["word"] != "stutter":
            print(f"| {c['drop']} | {c['bar']}.{c['beat_in_bar']} | {mmss(c['t'])} | {c['t']:.2f} | {c['word'].upper()} | {c['conf'].split(':')[0]} |")


if __name__ == "__main__":
    main()
