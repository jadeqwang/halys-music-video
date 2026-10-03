"""Parse production/SHOTLIST.md into video/data/shotlist.json for the render harness (video/src/edit.js).

    python3 tools/shotlist.py            # parse, validate, write video/data/shotlist.json, print a summary
    python3 tools/shotlist.py --check    # parse + validate only (non-zero exit on errors)
    python3 tools/shotlist.py --table    # also print every shot (id, times, worlds, cadence-relevant world, cues)

Reads the shot tables (| Shot | Time | World | Plate | Picture | Text | Sync / FX |). Per shot:
  id "S01", t0/t1 song seconds (t1 null for "end" = the end of the song), world (the first world named, which sets
  the draw cadence), worlds (all worlds named, e.g. CORONA→MARBLE transitions), plates ["P02", ...] (or "proc."),
  cues [{role, t, text}] from the Text column: roles CARVED | PLAQUE | INSCR | CHOP | MONO (a role carries over to
  the following cues of the cell; a cue without a role defaults to CARVED; bare times after a CHOP cue repeat the
  previous shot's chop words), picture, text and sync (the raw cells), section (the "## n · ..." heading).
"same" in the World column repeats the previous shot's worlds; INK (the room) maps to the harness world "room".
Validation: times increase, shots tile the song without gaps or overlaps (warnings), worlds are known.
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "production" / "SHOTLIST.md"
OUT = ROOT / "video" / "data" / "shotlist.json"
WORLDS = {"BRONZE": "bronze", "CORONA": "corona", "MARBLE": "marble", "GOLD": "gold", "ORBIT": "orbit", "INK": "room", "ROOM": "room"}
ROLES = ("CARVED", "PLAQUE", "INSCR", "CHOP", "MONO")
# tokens of a Text cell: `quoted text` | ROLE | a time range 110.58–113.5 | a time 110.66 | a separator (· or ;)
_T = r"\d{1,3}\.\d{1,3}"
TOK = re.compile(r"`([^`]+)`|\b(" + "|".join(ROLES) + r")\b|(?<![\w.:])(" + _T + r")\s*[–-]\s*(" + _T + r"|\d{1,3})(?!\.?\d|\w)"
                 r"|(?<![\w.:])(" + _T + r")(?!\.?\d|\w|:)|(·|;)")


def cells(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def parse_time(s):
    m = re.match(r"\s*(\d+(?:\.\d+)?)\s*[–-]\s*(end|\d+(?:\.\d+)?)", s)
    if not m:
        raise ValueError(f"bad time {s!r}")
    return float(m.group(1)), (None if m.group(2) == "end" else float(m.group(2)))


def parse_cues(text, prev_chops):
    """'PLAQUE 0.20 `28 MAY 585 BC` · CARVED 0.57 `THE SUN WENT OUT`' or 'CHOP `HALO` 110.66 · `IN THE` 110.98' ->
    [{role, t, [t_end], text}]. Cues are separated by · or ; (outside quotes); inside one segment each quoted text takes
    the nearest time token (before or after it); a range a–b gives t=a, t_end=b. A role keyword holds for the following
    segments of the cell; a cue with no role is CARVED."""
    segs, cur, k, last_end = [], [], 0, 0
    for m in TOK.finditer(text):
        q, role, r0, r1, t, sep = m.groups()
        before = text[last_end:m.start()]          # the words between the previous token and this one
        last_end = m.end()
        if sep:
            segs.append(cur); cur = []
        elif role:
            if any(x[0] in ("text", "time", "until") for x in cur):   # a new role inside a segment starts a new cue group
                segs.append(cur); cur = []
            cur.append(("role", k, role.lower()))
        elif r0:
            cur.append(("time", k, (float(r0), float(r1))))
        elif t:
            # "`LOVE` held to 110.56": a time introduced by held to / until / till ends the cue instead of starting it
            until = re.search(r"\b(held to|until|till)\s*$", before, re.I)
            cur.append(("until" if until else "time", k, (float(t), None)))
        else:
            cur.append(("text", k, q))
        k += 1
    segs.append(cur)
    cues, role, bare = [], None, []
    for g in segs:
        role = next((v for kind, _, v in g if kind == "role"), role)
        texts = [(pos, v) for kind, pos, v in g if kind == "text"]
        times = [(pos, v) for kind, pos, v in g if kind == "time"]
        untils = [(pos, v) for kind, pos, v in g if kind == "until"]
        if not texts:
            bare += [v[0] for _, v in times]
            continue
        seg_cues = [{"role": role or "carved", "t": None, "text": tx} for _, tx in texts]
        for tp, (t0, t1) in times:          # each time goes to the nearest quote that has no time yet (ties: the later one)
            free = [(abs(tp - pos), -pos, j) for j, (pos, _) in enumerate(texts) if seg_cues[j]["t"] is None]
            if not free:
                break
            j = min(free)[2]
            seg_cues[j]["t"] = t0
            if t1 is not None:
                seg_cues[j]["t_end"] = t1
        for tp, (t0, _) in untils:          # 'held to' times: the nearest quote ends there
            j = min((abs(tp - pos), -pos, j) for j, (pos, _) in enumerate(texts))[2]
            seg_cues[j]["t_end"] = t0
        cues += seg_cues
    chop_words = [c["text"] for c in cues if c["role"] == "chop"]
    if bare and not cues and prev_chops:
        # '143.94 · 144.80 · 145.23 · 146.10': the previous shot's chop words on new times
        cues = [{"role": "chop", "t": tt, "text": prev_chops[i % len(prev_chops)]} for i, tt in enumerate(bare)]
        chop_words = prev_chops
    return cues, chop_words


def parse(src=SRC):
    shots, section, prev_worlds, prev_chops = [], None, ["bronze"], []
    for line in src.read_text().splitlines():
        if line.startswith("## "):
            section = line[3:].strip()
            continue
        if not re.match(r"^\|\s*S\d+\s*\|", line):
            continue
        c = cells(line)
        if len(c) < 6:
            raise ValueError(f"short row: {line[:80]}")
        sid, tcell, wcell, pcell, picture, text = c[:6]
        sync = c[6] if len(c) > 6 else ""
        t0, t1 = parse_time(tcell)
        if wcell.strip().lower() == "same":
            worlds = list(prev_worlds)
        else:
            worlds = [WORLDS[w] for w in re.findall(r"[A-Z]{3,}", wcell) if w in WORLDS]
            if not worlds:
                raise ValueError(f"{sid}: no known world in {wcell!r}")
        prev_worlds = worlds
        plates = re.findall(r"P\d+[a-z]?", pcell) or ([pcell.strip()] if pcell.strip() not in ("", "—") else [])
        cues, chops = parse_cues(text, prev_chops)
        if chops:
            prev_chops = chops
        shots.append({"id": sid, "t0": t0, "t1": t1, "world": worlds[0], "worlds": worlds, "plates": plates, "cues": cues,
                      "section": section, "picture": picture, "text": text, "sync": sync})
    # a cue timed inside a later shot (a caption that outlives its cut) moves to the shot it plays in
    for s in shots:
        keep = []
        for q in s["cues"]:
            home = next((x for x in shots if q["t"] is not None and x["t0"] - 1e-6 <= q["t"] < (x["t1"] if x["t1"] is not None else 1e9)), None)
            if home is not None and home is not s:
                home["cues"].append({**q, "from": s["id"]})
            else:
                keep.append(q)
        s["cues"] = keep
    for s in shots:
        s["cues"].sort(key=lambda q: (q["t"] is not None, q["t"] or 0))
    return shots


def validate(shots, dur=None):
    errs, warns = [], []
    for a, b in zip(shots, shots[1:]):
        if a["t1"] is None:
            errs.append(f"{a['id']} ends at 'end' but is not the last shot")
            continue
        if b["t0"] < a["t1"] - 1e-6:
            warns.append(f"{a['id']}/{b['id']} overlap: {a['t1']} > {b['t0']}")
        elif b["t0"] > a["t1"] + 1e-6:
            warns.append(f"gap {a['t1']}–{b['t0']} between {a['id']} and {b['id']}")
    for s in shots:
        if s["t1"] is not None and s["t1"] <= s["t0"]:
            errs.append(f"{s['id']}: t1 <= t0")
        for q in s["cues"]:
            if q["t"] is not None and not (s["t0"] - 0.5 <= q["t"] <= (s["t1"] or 1e9) + 0.5):
                warns.append(f"{s['id']}: cue {q['text']!r} at {q['t']} is outside the shot {s['t0']}–{s['t1']}")
    if dur and shots and shots[-1]["t1"] is not None and abs(shots[-1]["t1"] - dur) > 0.05:
        warns.append(f"last shot ends at {shots[-1]['t1']}, song is {dur}")
    return errs, warns


def main(argv):
    shots = parse()
    tj = ROOT / "video" / "data" / "timing.json"
    dur = json.loads(tj.read_text()).get("dur") if tj.exists() else None
    errs, warns = validate(shots, dur)
    if "--table" in argv:
        for s in shots:
            cues = " · ".join(f"{q['role']}{'@' + str(q['t']) if q['t'] is not None else ''} {q['text']!r}" for q in s["cues"])
            print(f"{s['id']:4s} {s['t0']:7.2f}-{(s['t1'] if s['t1'] is not None else 'end')!s:>7}  {'→'.join(s['worlds']):22s} {','.join(s['plates']):14s} {cues[:110]}")
    for w in warns:
        print("warning:", w)
    for e in errs:
        print("ERROR:", e)
    n = {w: sum(1 for s in shots if s["world"] == w) for w in sorted({s["world"] for s in shots})}
    print(f"{len(shots)} shots, {sum(len(s['cues']) for s in shots)} text cues; first-world counts {n}")
    if errs:
        sys.exit(1)
    if "--check" not in argv:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps({"source": str(SRC.relative_to(ROOT)), "title": SRC.read_text().splitlines()[0].lstrip("# ").strip(),
                                   "shots": shots}, indent=1, ensure_ascii=False))
        print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1:])
