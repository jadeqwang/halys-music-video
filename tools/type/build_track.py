"""Build the film's text track: every on-screen word, caption, card and HUD element, timed.

    python3 tools/type/build_track.py            # write video/data/texttrack.json + video/src/type/track.gen.js, print the report
    python3 tools/type/build_track.py --check    # validate only (non-zero exit on errors)

Sources
  production/SHOTLIST.md   the spec: every text cue (exact strings, roles, times), parsed with tools/shotlist.parse()
                           (re-parsed here on every build, so the track never depends on a stale video/data/shotlist.json)
  video/data/timing.json   word-level lyric onsets (lines[].words = [start, word, end]), chops, beats, stabs, ticks
  production/ROOM.md + FACTCHECK.md   the terminal (FACTCHECK's corrected lines replace ROOM.md's where they differ)

Design
  DESIGN below is the per-event typographic design: which renderer (fx), where (anchor, per aspect in the JS), when
  (holds across cuts, beats for unsung labels) and effect parameters. Strings are never typed here: every item names
  a SHOTLIST cue by its exact text, and the build fails if a cue is missing, unused or used twice.

Output (same data twice): video/data/texttrack.json for tools, and video/src/type/track.gen.js for the page (render.mjs
hashes src/ for its stale-frame ledger but not data/texttrack.json, so the page imports the JS copy).
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import shotlist  # noqa: E402  (tools/shotlist.py: the SHOTLIST.md parser the harness uses)

TIMING = json.loads((ROOT / "video/data/timing.json").read_text())
OUT_JSON = ROOT / "video/data/texttrack.json"
OUT_JS = ROOT / "video/src/type/track.gen.js"
CPS_MAX = 15.0

# ---------------------------------------------------------------- timing helpers
LYRIC = [(w[0], w[1], w[2]) for ln in TIMING["lines"] for w in ln["words"]]
BEATS = TIMING["beats"]
DOWNBEATS = TIMING["downbeats"]


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower())


def beat_after(t, n=1):
    """the n-th beat at or after t"""
    bs = [b for b in BEATS if b >= t - 1e-6]
    return round(bs[n - 1], 3)


def match_words(tokens, t_from, t_to):
    """tokens (display words, e.g. ['-ING', 'TURNS']) -> [{w, t, e}] with their sung onsets. The words must be sung
    consecutively; of all such runs the one nearest the window [t_from, t_to] wins (lines often start before their cut).
    Punctuation-only tokens ('…') get no onset."""
    keys = [(i, norm(tok)) for i, tok in enumerate(tokens) if norm(tok)]
    n = len(keys)
    best = None
    for s0 in range(len(LYRIC) - n + 1):
        if all(norm(LYRIC[s0 + j][1]) == k for j, (_, k) in enumerate(keys)):
            t = LYRIC[s0][0]
            dist = 0 if t_from <= t <= t_to else min(abs(t - t_from), abs(t - t_to))
            if best is None or dist < best[0]:
                best = (dist, s0)
    if best is None or best[0] > 3.0:
        raise ValueError(f"no sung run {' '.join(tokens)!r} near {t_from}-{t_to}")
    out = [{"w": tok, "t": None, "e": None} for tok in tokens]
    for j, (i, _) in enumerate(keys):
        w = LYRIC[best[1] + j]
        out[i] = {"w": tokens[i], "t": round(w[0], 3), "e": round(w[2], 3)}
    return out


def chop_time(t, word=None, tol=0.02):
    """refine a SHOTLIST chop time (2 decimals) to the measured onset in timing.json when they are the same event"""
    best = min(TIMING["chops"], key=lambda c: abs(c["t"] - t))
    return round(best["t"], 3) if abs(best["t"] - t) <= tol else t


# ---------------------------------------------------------------- the design
# item: (cue text, {key, shot (if not the event's), reveal: words|line|stroke|none, t (override), role (override), ...})
# event: id, fx, shot, t0/t1 (visibility; default = the shot), anchor, items, params
D = []


def ev(id, fx, shot, items=(), **kw):
    D.append({"id": id, "fx": fx, "shot": shot, "items": list(items), **kw})


# 1 · cold open: one sentence over three shots, bracketed by the date; it rewinds out with the picture
ev("S01.date", "plaque", "S01", [("28 MAY 585 BC", {"key": "date", "reveal": "line"})], t1=3.65, anchor="top", size="hook")
ev("S01.hook", "carved", "S01", [("THE SUN WENT OUT", {"key": "l1", "reveal": "line"}),
                                 ("IN THE MIDDLE OF A BATTLE.", {"key": "l2", "shot": "S02", "reveal": "line"})],
   t1=3.65, anchor="bottom", size="hook")
ev("S03.home", "carved", "S03", [("AND BOTH ARMIES WENT HOME.", {"key": "l1", "reveal": "line"})],
   t1=5.85, anchor="bottom", size="hook", rewind=[5.40, 5.85])
ev("S04.earlier", "plaque", "S04", [("ONE HOUR EARLIER", {"key": "p", "reveal": "line"})], anchor="bottom", size="hook")

# 2 · intro A
ev("S05.title", "cartouche", "S05", [("HALYS", {"key": "title", "reveal": "line"}),
                                      ("JADE WANG", {"key": "byline", "reveal": "line", "size": "small"})], enter="cut")
ev("S06.map", "map", "S06", [("LYDIA", {"key": "west", "t": beat_after(10.69, 1)}),
                             ("MEDIA", {"key": "east", "t": beat_after(10.69, 2)}),
                             ("KING ALYATTES · SARDIS", {"key": "west_sub", "t": beat_after(10.69, 3)}),
                             ("KING CYAXARES · ECBATANA", {"key": "east_sub", "t": beat_after(10.69, 3)}),
                             ("THE SIXTH YEAR OF THE WAR", {"key": "foot", "t": beat_after(10.69, 4)})])
ev("S09.kings", "diptych", "S09", [("ALYATTES · KING OF LYDIA", {"key": "left", "t": beat_after(21.15, 2)}),
                                   ("CYAXARES · KING OF THE MEDES", {"key": "right", "t": beat_after(21.15, 3)})],
   split=[23.325, 24.63])
ev("S22.divider", "diptych", "S22", [])
ev("S43.divider", "diptych", "S43", [], palette="corona")

# 3 · intro B
ev("S12.herodotus", "inscr", "S12", [('"…suddenly the day became night."', {"key": "quote", "reveal": "line", "t": beat_after(28.98, 2)}),
                                     ("HERODOTUS 1.74 · TR. MACAULAY", {"key": "credit", "role": "plaque", "reveal": "line", "t": beat_after(28.98, 4)})],
   anchor="lower")
ev("S16.sky", "plaque", "S16", [("THE SKY DATES THIS BATTLE TO THE DAY", {"key": "p", "reveal": "line", "t": 41.52})], anchor="lowerLeft")
ev("S18.contact", "plaque", "S18", [("17:25 · FIRST CONTACT", {"key": "p", "reveal": "line", "t": beat_after(46.49, 1)})], anchor="lowerLeft")
# the counter: TOTALITY IN 55:28 at its first drawing, then the eclipse magnitude drives it to 00:00 at 110.40, held to the
# C2 cut (110.58). Magnitude keys follow SHOTLIST (S24 ~30 % of the disk by area, S27 0.8, S28 0.9 -> 0.95, totality on the
# kick); a scene that knows its own eclipse passes f.type.magnitude instead. The SHOTLIST's "00:00 at 110.58" cue is this.
ev("S18.counter", "counter", "S18", [("TOTALITY IN 55:28", {"key": "counter", "reveal": "line", "t": beat_after(46.49, 1)}),
                                     ("00:00", {"key": "zero", "shot": "S35", "reveal": "none", "t": 110.40, "ghost": True})],
   t1=110.58, anchor="corner", total=55 * 60 + 28, hold=0.86, zero=110.40,
   magnitude=[[46.93, 0.0], [67.42, 0.40], [85.91, 0.80], [89.22, 0.90], [93.0, 0.95], [110.40, 1.0]])

# 4 · verse 1
ev("S24.cartouche", "cartouche", "S24", [("THE RIVER HALYS,", {"key": "l1", "reveal": "words"}),
                                          ("ON THE SIXTH YEAR OF THE WAR", {"key": "l2", "reveal": "words"})], enter="descend")
ev("S24.plaque", "plaque", "S24", [('KIZILIRMAK · "RED RIVER" · ANATOLIA', {"key": "p", "reveal": "line", "t": DOWNBEATS[[round(x, 3) for x in DOWNBEATS].index(70.915)]})],
   anchor="lowerLeft")
ev("S25.mirror", "mirrored", "S25", [("LYDIANS", {"key": "left", "reveal": "words"}),
                                     ("MEDES", {"key": "right", "reveal": "words"}),
                                     ("SLEW EACH OTHER ON THE SHORE", {"key": "foot", "reveal": "words"})])
ev("S26.bronze", "bronze", "S26", [("SUN BURNING ON THE", {"key": "above", "reveal": "words"}),
                                   ("BRONZE", {"key": "big", "reveal": "words"}),
                                   ("EXCHANGE-", {"key": "below", "reveal": "words"})], glint=84.38)
ev("S27.strange", "crescents", "S27", [("-ING TURNS AND STRIKES", {"key": "l1", "reveal": "words"}),
                                       ("WHEN LIGHT WENT STRANGE", {"key": "l2", "reveal": "words"})],
   eclipse=[88.69, 89.17], coverage=0.8)

# 5 · pre-chorus
ev("S28.halo", "ring", "S28", [("A HALO IN THE SKY", {"key": "top", "reveal": "words"}),
                               ("WARRIORS AWED", {"key": "bottom", "reveal": "words"})])
ev("S29.eye", "pupil", "S29", [("BY THE VACANT EYE OF A GOD", {"key": "l", "reveal": "words"})])

# 6 · chorus 1
ev("S30.shade", "shadow", "S30", [("DAYLIGHT TURNED TO SHADE", {"key": "l", "reveal": "words"})], front=[98.62, 99.75], direction="down")
ev("S31.gods", "carved", "S31", [("EYE OF GODS ABOVE", {"key": "l", "reveal": "words"})], anchor="left", light="corona")
ev("S32.blade", "carved", "S32", [("THROW DOWN YOUR BLADE", {"key": "l", "reveal": "words"})], anchor="bottom")
# "GO HOME TO THE ONES YOU LOVE" is sung across the S33/S34 cut ("you" 109.45, "love" 110.24): one line over both shots;
# from "love" the other words burn out and LOVE is held alone to 110.56 (the S34 cue), going backlit as the bead whites out
ev("S33.love", "carved", "S33", [("GO HOME TO THE ONES YOU LOVE", {"key": "l", "reveal": "words"}),
                                 ("LOVE", {"key": "love", "shot": "S34", "reveal": "none", "ghost": True})],
   t1=110.56, anchor="bottom", isolate=["LOVE", 110.24], backlit=[110.20, 110.50])

# 7 · drop 1
ev("S35.chops", "chop", "S35", [("HALO", {"key": "c1", "hal": True}), ("IN THE", {"key": "c2"}), ("SKY", {"key": "c3"}), ("SKY", {"key": "c4"})],
   t1=112.31)
ev("S35.glover", "quote", "S35", [('"We just went sci-fi." — V. Glover, Artemis II, during totality, 6 Apr 2026', {"key": "q", "reveal": "line"})],
   anchor="lower")
ev("S36.stutter", "chop", "S36", [("SKY", {"key": "sky"})], stutter=True,
   invert=[112.74, 113.173, 113.607, 115.783, 116.217, 116.652, 117.086])
ev("S37.hud", "hud", "S37", [("C2 · TOTALITY · 00:00:07", {"key": "hud", "reveal": "line"})], c2=110.58, anchor="corner")
# chop cycles: the corona ring is locked centre (SHOTLIST S41), so by default the words' streamers radiate from the frame
# centre and the Moon's disk shows through the letters (ring: true); elsewhere the scene passes f.type.sun
for sid in ("S41", "S42", "S43", "S44"):
    ev(f"{sid}.chops", "chop", sid, [("HALO", {"key": "c1"}), ("IN THE", {"key": "c2"}), ("SKY", {"key": "c3"}), ("SKY", {"key": "c4"})], ring=True)

# 9 · verse 2 (marble, small italic lower thirds; the last one cut into a plinth)
ev("S46.v", "inscr", "S46", [("What was it like when reality suddenly broke", {"key": "l", "reveal": "words"})], anchor="lower")
ev("S47.v", "inscr", "S47", [("the silent eye, how the gods suddenly spoke", {"key": "l", "reveal": "words"})], anchor="lower")
ev("S48.v", "inscr", "S48", [("Birds went quiet, air suddenly cold", {"key": "l", "reveal": "words"})], anchor="lower")
ev("S49.v", "incised", "S49", [("what we do next is how history unfolds", {"key": "l", "reveal": "words"})], anchor="plinth")
ev("S50.v", "inscr", "S50", [("a shadow crossed the hills", {"key": "l", "reveal": "words"})], anchor="lower")
# "chill" is sung at 181.12, 0.11 s before the cut to Thales: hold the line to the end of the word (182.28)
ev("S51.v", "inscr", "S51", [("the wind picked up a chill", {"key": "l", "reveal": "words"})], anchor="lower", t1=182.30)

# 11 · Thales
ev("S52.thales", "thales", "S52", [("THALES", {"key": "name", "reveal": "words"}),
                                   ("ΘΑΛΗΣ", {"key": "greek", "reveal": "line", "t": beat_after(182.49, 2)}),
                                   ("THALES OF MILETUS", {"key": "plaque", "reveal": "line", "t": beat_after(182.49, 3)})])
ev("S53.foretold", "carved", "S53", [("FORETOLD THE SUN WOULD GO DARK", {"key": "l", "reveal": "words"})], anchor="left", light="marble")
ev("S53.card", "forecast", "S53", [], t0=186.40, t1=187.65,
   question="Will the sun go dark over the Halys before sunset?", yes=[3, 99], jump=186.55)
ev("S55.behold", "carved", "S55", [("WARRIORS BEHOLD …", {"key": "l", "reveal": "words"})], anchor="left", light="marble", ellipsis=[190.55, 192.45])
ev("S56.sudden", "carved", "S56", [("A SUDDEN", {"key": "l", "reveal": "words"})], anchor="left", light="beads")
ev("S57.spark", "spark", "S57", [("SPARK", {"key": "l", "reveal": "none", "t": 194.86})])

# 12 · final chorus (gold)
ev("S58.day", "shadow", "S58", [("SHADOW TURNED TO DAY", {"key": "l", "reveal": "words"})], front=[200.55, 203.45], direction="rise")
ev("S59.above", "carved", "S59", [("SUNLIGHT FROM ABOVE", {"key": "l", "reveal": "words"})], anchor="left", light="above")
ev("S61.blade", "carved", "S61", [("THROW DOWN YOUR BLADE", {"key": "l", "reveal": "words"})], anchor="left", light="gold", sink=["BLADE", 210.18, 211.42])
# "love" is sung at 215.06, 0.23 s before the Drop 2 cut: hold the line 0.9 s into S63, fading on the way out
ev("S62.home", "carved", "S62", [("HOME TO THE ONES YOU LOVE", {"key": "l", "reveal": "words"})], anchor="left", light="gold", t1=216.20, fadeout=0.45)

# 13 · drop 2: the era captions (the table's Text column is PLAQUE: year · place · fact)
ERAS = [("S64", "2ND–1ST C. BC · ANTIKYTHERA · A BRONZE COMPUTER PREDICTS ECLIPSES"),
        ("S65", "1715 · LONDON · HALLEY MAPS THE MOON'S SHADOW"),
        ("S66", "1919 · PRÍNCIPE & SOBRAL · STARLIGHT BENDS. EINSTEIN WAS RIGHT."),
        ("S67", "1973 · CONCORDE 001 · 74 MINUTES OF TOTALITY AT MACH 2"),
        ("S68", "2024 · USA · 31.6 MILLION LIVE IN THE PATH"),
        ("S69", "2026 · ARTEMIS II · TOTALITY FROM DEEP SPACE"),
        ("S70", "2027 · NEAR LUXOR · NEXT: 6 MIN 23 S"),
        ("S71", "MARS · PHOBOS · ECLIPSES ON OTHER WORLDS")]
for k, (sid, txt) in enumerate(ERAS):
    ev(f"{sid}.era", "era", sid, [(txt, {"key": "e", "role": "plaque", "reveal": "line"})], index=k, history=[e[1].split(" · ")[0] for e in ERAS[:k]])
ev("S72.home", "home", "S72", [("HOME", {"key": "l", "reveal": "line", "t": DOWNBEATS[[round(x, 3) for x in DOWNBEATS].index(252.595)]})])
ev("S73.chops", "chop", "S73", [("THROW DOWN", {"key": "c1"}), ("THROW DOWN", {"key": "c2"})])
ev("S75.chop", "chop", "S75", [("THROW DOWN", {"key": "c1"})])
ev("S76.chop", "chop", "S76", [("BLADE", {"key": "c1"})])

# 14 · outro: the terminal (built below from ROOM.md + FACTCHECK.md) and the end card
ev("S81.end", "endcard", "S81", [("HALYS", {"key": "title", "reveal": "line", "t": 277.60}),
                                 ("JADE WANG", {"key": "byline", "reveal": "line", "t": 277.85}),
                                 ("NEXT TOTALITY · 2027-08-02 · NEAR LUXOR · 6M23S", {"key": "next", "reveal": "line", "t": 278.10})],
   t0=277.55)

# ---------------------------------------------------------------- the terminal (S78–S80)
TICKS = [round(x, 3) for x in TIMING["events"]["snares"] if 266.1 <= x < 269.8]
PROMPT = "jade@rare-earth:~/sims/earth (main)$ "
# ROOM.md main pane with FACTCHECK.md's corrected lines (run flags order, "totality at halys bend") applied
MAIN = [
    (None, PROMPT + "./halys run --seed=-585 --region=anatolia --from=-0584-05-28T15:00 --cal=julian"),
    (0, "loaded world: 8,412,066 agents · terrain: halys basin · weather: clear"),
    (1, "t=-0584-05-28T15:02 LAT  lydia ⟷ media  war.year=6"),
    (2, "warn: casualties rising at halys.ford (0.8/min)"),
    (3, ""), (3, "› make them stop. nobody else gets hurt."),
    (4, ""), (4, "◑ syzygizing… 14s"),
    (5, ""), (5, "  moon.align(saros=57)                                      ok"),
    (6, '  eclipse.schedule("-0584-05-28T18:21 LAT", over="halys")    ok'),
    (7, "  dt.shift(+300)   # nudge the path north so it's total at the river"),
    (8, '  thales.notify("the sun goes dark this year")              ok   # he will take credit'),
    (9, ""), (9, "  totality at halys bend: 1m19s · sun 8.9° WNW · jupiter visible"),
    (10, ""), (10, "war.status = RESOLVED   treaty: border=halys · aryenis ⚭ astyages"),
    (11, ""), (11, PROMPT),
]
SIDE = ["[lydians] 18:21  laying down arms · walking home",
        "[medes]   18:21  laying down arms · walking home",
        "[sun]     obscuration 100% · alt 8.8° · corona visible · birds: silent",
        "[moon]    on schedule ✓",
        "[1420 MHz]  6EQUJ5"]
COMMIT = 'git commit -am "fix(halys): schedule eclipse to end war (#585)"'
# typed in bursts: during the last ticks (from behind the chair), then blind on the three key clicks of S80 (Enter on the third)
KEYS = [round(c["t0"] + 0.06, 3) for c in TIMING["sound_design"]["cues"] if c["name"].startswith("g3_key_")]
TYPING = [[TICKS[12], TICKS[13] + 0.25, 'git commit -am "fix(halys): '], [KEYS[0], KEYS[0] + 0.32, "schedule eclipse to end war"],
          [KEYS[1], KEYS[1] + 0.16, ' (#585)"']]
OUTPUT_AT = round(KEYS[2] + 0.12, 3)
TERMINAL = {
    "t0": 266.12, "t1": 276.95, "ticks": TICKS, "prompt": PROMPT, "cols": 92,
    "main": [{"t": (266.12 if k is None else TICKS[k]), "text": s} for k, s in MAIN],
    "side": SIDE, "typing": TYPING, "enter": KEYS[2], "commit": COMMIT,
    "output": [{"t": OUTPUT_AT, "text": "[main 585ec1a] fix(halys): schedule eclipse to end war (#585)"},
               {"t": OUTPUT_AT, "text": " 1 file changed, 1 insertion(+), 1 deletion(-)"},
               {"t": round(OUTPUT_AT + 0.35, 3), "text": PROMPT}],
    "spinner": "◐◓◑◒",
}
ev("S78.terminal", "terminal", "S78", [], t0=266.12, t1=276.95, terminal=TERMINAL)


# ---------------------------------------------------------------- build
def build():
    shots = {s["id"]: s for s in shotlist.parse()}
    order = list(shots)
    cues = {(sid, q["text"], k): q for sid, s in shots.items() for k, q in enumerate(s["cues"])}
    used, errors, events = set(), [], []

    def take(sid, text):
        for (s, tx, k), q in cues.items():
            if s == sid and tx == text and (s, tx, k) not in used:
                used.add((s, tx, k))
                return q
        raise ValueError(f"{sid}: no unused cue with the exact text {text!r}")

    for d in D:
        sh = shots[d["shot"]]
        e = {k: v for k, v in d.items() if k not in ("items",)}
        e["t0"] = d.get("t0", sh["t0"])
        e["t1"] = d.get("t1", sh["t1"] if sh["t1"] is not None else TIMING.get("durExt", 281.0))
        e["world"] = sh["world"]
        e["worlds"] = sh["worlds"]
        items = []
        for text, o in d["items"]:
            sid = o.get("shot", d["shot"])
            try:
                q = take(sid, text)
            except ValueError as x:
                errors.append(str(x)); continue
            it = {"key": o["key"], "role": o.get("role", "plaque" if d["fx"] == "era" else q["role"]), "text": text}
            for k in ("size", "hal", "ghost"):
                if k in o: it[k] = o[k]
            reveal = o.get("reveal", "line")
            it["reveal"] = reveal
            t = o.get("t", q.get("t"))
            if q["role"] == "chop" or d["fx"] == "chop":
                t = chop_time(q["t"]) if q.get("t") is not None else None
            if reveal == "words":
                it["words"] = match_words(text.split(" "), shots[sid]["t0"], shots[sid]["t1"] or 999)
                t = next((w["t"] for w in it["words"] if w["t"] is not None), t)
            it["t"] = t if t is not None else e["t0"]
            if q.get("t_end") is not None:
                it["t_end"] = q["t_end"]
            items.append(it)
        e["items"] = items
        if "t1" not in d and any("t_end" in it for it in items):
            e["t1"] = max(it["t_end"] for it in items if "t_end" in it)
        if d["fx"] == "chop" and d.get("stutter"):
            # SKY re-slams where the picture cuts (SHOTLIST S36): every stutter onset in bar 65 (8ths), every second one from
            # bar 66 on (16ths)
            st = [c for c in TIMING["chops"] if c["word"] == "stutter" and sh["t0"] <= c["t"] < sh["t1"]]
            later = [c for c in st if c["bar"] >= 66]
            e["onsets"] = sorted([round(c["t"], 3) for c in st if c["bar"] < 66] + [round(c["t"], 3) for c in later[::2]])
        events.append(e)

    unused = [(s, tx) for (s, tx, k) in cues if (s, tx, k) not in used]
    for s, tx in unused:
        errors.append(f"{s}: SHOTLIST cue {tx!r} is not placed in the type track")
    events.sort(key=lambda e: (e["t0"], order.index(e["shot"])))
    return events, errors


def reading_report(events):
    """characters per second from each item's first appearance to the end of its event (CHOP and HUD excluded)"""
    rows = []
    for e in events:
        if e["fx"] in ("chop", "hud", "counter", "terminal", "diptych"):
            continue
        for it in e["items"]:
            if it["reveal"] == "none" or it.get("ghost"):
                continue
            t_in = it["t"]
            n = len(it["text"])
            dt = e["t1"] - t_in
            rows.append((e["id"], it["key"], n, round(t_in, 2), round(e["t1"], 2), round(dt, 2), round(n / dt, 1) if dt > 0 else 99, it["text"]))
        if e["fx"] == "forecast":
            n = len(e["question"]); dt = e["t1"] - e["t0"]
            rows.append((e["id"], "question", n, e["t0"], e["t1"], round(dt, 2), round(n / dt, 1), e["question"]))
    return rows


def main():
    events, errors = build()
    if errors:
        print("ERRORS:\n  " + "\n  ".join(errors))
        sys.exit(1)
    rows = reading_report(events)
    print(f"{len(events)} events, {sum(len(e['items']) for e in events)} text items")
    print(f"{'event':16} {'item':9} {'chars':>5} {'in':>7} {'out':>7} {'secs':>5} {'cps':>5}")
    for r in rows:
        flag = "  <-- over 15 cps" if r[6] > CPS_MAX else ""
        print(f"{r[0]:16} {r[1]:9} {r[2]:5} {r[3]:7.2f} {r[4]:7.2f} {r[5]:5.2f} {r[6]:5.1f}{flag}")
    if "--check" in sys.argv:
        return
    track = {"version": 1, "source": "production/SHOTLIST.md + video/data/timing.json (tools/type/build_track.py)", "cps_max": CPS_MAX,
             "events": events}
    OUT_JSON.write_text(json.dumps(track, ensure_ascii=False, indent=1))
    OUT_JS.write_text("// GENERATED by tools/type/build_track.py from production/SHOTLIST.md + video/data/timing.json. Do not edit:\n"
                      "// change the SHOTLIST or the DESIGN table in the builder and re-run it.\n"
                      "export default " + json.dumps(track, ensure_ascii=False) + ";\n")
    print(f"wrote {OUT_JSON.relative_to(ROOT)} and {OUT_JS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
