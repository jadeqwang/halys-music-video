"""Write production/BOARDS.md from manifest.jsonl + verdicts.json (python3 media/boards/_scripts/write_index.py)."""
import json, pathlib, sys
from collections import defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import boards  # noqa: E402
import jobs  # noqa: E402

ROOT = boards.ROOT

CANON_CHARS = [  # subject, media/chars name, board
    ("THE LYDIAN", "lydian", "chars/lydian_e1_t1.jpg"),
    ("THE MEDE", "mede", "chars/mede_e3_t1.jpg"),
    ("LYDIAN CAVALRYMAN", "lydian_cavalryman", "chars/lyd_cav_rider_t1.jpg"),
    ("LYDIAN CAVALRYMAN (mounted)", "lydian_cavalryman_horse", "chars/lyd_cav_horse_t1.jpg"),
    ("MEDIAN ARCHER", "median_archer", "chars/med_archer3_m_t1.jpg"),
    ("MEDIAN CAVALRYMAN (optional)", "median_cavalryman", "chars/med_cav_rider_m_t1.jpg"),
    ("MEDIAN CAVALRYMAN (mounted)", "median_cavalryman_horse", "chars/med_cav_horse_m_t1.jpg"),
    ("THALES", "thales", "chars/thales2_e1_t1.jpg"),
    ("ALYATTES", "alyattes", "chars/alyattes_t1.jpg"),
    ("CYAXARES", "cyaxares", "chars/cyaxares2_m_t1.jpg"),
    ("ARYENIS", "aryenis", "chars/aryenis_t1.jpg"),
    ("ASTYAGES", "astyages", "chars/astyages2_m_t1.jpg"),
    ("LABYNETUS (mediator)", "labynetus", "chars/labynetus_e1_t1.jpg"),
    ("SYENNESIS (mediator)", "syennesis", "chars/syennesis_e1_t1.jpg"),
]


def main():
    V = boards.verdicts()
    rows = boards.manifest()
    by_name = {m["name"]: m for m in rows}
    canon_rows = [(V[n]["subject"], m) for n, m in by_name.items() if V.get(n, {}).get("verdict") == "canonical"]

    gl = [json.loads(l) for l in (ROOT / "media" / "genlog.jsonl").read_text().splitlines() if l.strip()]
    mine = [r for r in gl if str(r.get("tag", "")).startswith("boards:")]
    spend = defaultdict(lambda: [0, 0.0])
    for r in mine:
        if r.get("error"):
            continue
        spend[r["model"]][0] += 1
        spend[r["model"]][1] += r.get("est_cost_usd") or 0
    tot_n = sum(v[0] for v in spend.values())
    tot_c = sum(v[1] for v in spend.values())
    n_comp = sum(1 for m in rows if m["model"] == "composite")
    n_rej = sum(1 for m in rows if V.get(m["name"], {}).get("verdict") == "reject")

    L = []
    L.append("# HALYS: art department boards")
    L.append("")
    L.append("> Character turnaround sheets, set sheets and concept style frames for every later step (Seedance identity "
             "references, plate prompts, the JavaScript renderer's look targets). Built against RESEARCH.md §0, §3–§6, "
             "ROOM.md, TREATMENT.md v0.1/v0.2 and ZEITGEIST.md §2.5, §3.5 and §5.4. v1, 3 Oct 2026.")
    L.append("")
    L.append("**Provenance.** Every image here is AI-generated (Gemini 3 Pro Image / gpt-image-2 / Seedream 5 Pro / FLUX.2 "
             "max, plus a few marked local composites of those outputs). They are **reference only**: per ZEITGEIST §3.5 #11 "
             "and §5.4 #1 none of them may appear, traced or rotoscoped, in the final frames. Google outputs carry C2PA + "
             "SynthID.")
    L.append("")
    L.append(f"**Totals:** {len(rows)} boards indexed ({tot_n} paid generations, one of them a ~$0.005 low-quality size "
             f"probe that is not a board; {n_comp} local composites at $0); {n_rej} rejected and moved to "
             f"`media/boards/_rejects/`. Estimated spend **${tot_c:.2f}**: " +
             ", ".join(f"{k.split('/')[-1]} {v[0]} images ${v[1]:.2f}" for k, v in
                       sorted(spend.items(), key=lambda kv: -kv[1][1])) + ".")
    L.append("")
    L.append("Contact sheets: [`chars`](../media/boards/chars_contact.jpg) · [`sets`](../media/boards/sets_contact.jpg) · "
             "[`frames`](../media/boards/frames_contact.jpg) (canonical picks first, in orange). Driver: "
             "`media/boards/_scripts/` (`boards.py` runs jobs and finishes JPEGs ≤2048 px / ≤700 KB; `jobs_*.py` hold every "
             "prompt; `patch.py` the local composites; `verdicts.json` the review; `manifest.jsonl` one row per take; this "
             "file is written by `write_index.py`). Every paid call is in `media/genlog.jsonl` (tag `boards:<folder>:<take>`).")
    L.append("")

    # ---------------- canonical table
    L.append("## Canonical picks")
    L.append("")
    L.append("### Characters (identity references, copied to `media/chars/`)")
    L.append("")
    L.append("| subject | canonical file | board | model | notes |")
    L.append("|---|---|---|---|---|")
    for subj, name, board in CANON_CHARS:
        nm = pathlib.Path(board).stem
        m = by_name[nm]
        v = V.get(nm, {})
        note = v.get("issues", "").split(". Minor:")
        minor = ("Minor:" + note[1]) if len(note) > 1 else note[0].split(". ")[0].rstrip(".") + "."
        model = m["model"] if m["model"] != "composite" else "composite of nano-banana-pro"
        L.append(f"| {subj} | [`media/chars/{name}.jpg`](../media/chars/{name}.jpg) | `{board}` | {model.split('/')[-1]} | "
                 f"{minor.replace('|', '/')} |")
    L.append("")
    L.append("### Sets and style frames")
    L.append("")
    L.append("| subject | canonical file | model | why |")
    L.append("|---|---|---|---|")
    order = boards.SUBJECT_ORDER
    for subj, m in sorted(canon_rows, key=lambda x: (order.index(x[0]) if x[0] in order else 99, x[1]["name"])):
        if m["folder"] == "chars":
            continue
        v = V[m["name"]]
        why = v["issues"].split(". Minor:")[0]
        model = m["model"].split("/")[-1]
        if model == "composite":
            src = {"room_a_e1p_t1": "nano-banana-pro", "room_b_e1p_t1": "nano-banana-pro",
                   "halys_totality3_gpt_j_t1": "gpt-image-2", "f5_marble_nbp_e2p_t1": "nano-banana-pro",
                   "f6_gold_sdr_c_t1": "seedream-5-pro", "f5_marble2_gpt_j_t1": "gpt-image-2"}.get(m["name"], "?")
            model = f"composite of {src}"
        L.append(f"| {subj} | [`{m['file']}`](../{m['file']}) | {model} | {why.replace('|', '/').rstrip('.')}. |")
    L.append("")

    # ---------------- method
    L.append("## How the boards were made and checked")
    L.append("")
    L.append("* **Sheets.** One actor per sheet, four full-length views (front, three-quarter, profile, back) on one floor "
             "line, two inset panels (head close-up + the character's prop), flat 18 % grey, soft key from upper left, "
             "16:9. Prompts = a shared photographic sheet header + the RESEARCH §3 costume spelled out item by item + an "
             "anti-'AI face' skin clause + period no-gos + no text. Each sheet attaches the brief's museum references as a "
             "single composited **reference board** (Nano Banana Pro takes only three images; see the list below).")
    L.append("* **Review.** Every take was opened at full size and checked against the brief: costume item by item, side of "
             "the sword, period no-gos (fluted crowns, horned helmets, stirrups, armillary spheres, modern shoes), sky "
             "facts (sun 8–10° over the WNW vanishing point, Jupiter 11° above and 5.5° left, glow brightest at the frame "
             "edges, no Venus, no blue before Earth), equal dignity, and AI tells (hands, garbled text, waxy skin, same "
             "faces). Failures were regenerated or edited; rejects stay logged.")
    L.append("* **The akinakes problem.** Herodotus 7.61 puts the Median short sword on the RIGHT thigh. Every model "
             "(Nano Banana Pro, gpt-image-2, fresh takes and edits, explicit left/right and image-space wording) kept "
             "drawing it on the left. Two fixes: (1) per-view image-space edit instructions (worked for THE MEDE, "
             "`mede_e3`); (2) where the sheet was otherwise right, a **horizontal mirror of the whole sheet** "
             "(`*_m_t1`: archer, Cyaxares, Astyages, Median cavalryman). Mirroring keeps all views consistent; side "
             "effects are noted (bow in the right hand, insets on the left, a mole/scar changes side).")
    L.append("* **Local composites (no generation, $0).** `patch.py`: pasting back lettering that an edit garbled (ROOM "
             "sticker `1420.405 MHz`, the poster label), restoring a statue face, moving Jupiter to the computed position "
             "on the frame's own angular scale (and a 4.8° tilt-up reframe when it fell outside the frame), and rotating "
             "the F6 crescent to the 5 o'clock / horns-up-left orientation of RESEARCH §5 #1. Each is described in its "
             "prompt column.")
    L.append("* **Model notes.** Nano Banana Pro (2752×1536) gave the best photoreal faces and costume detail and follows "
             "multi-reference identity; it resists identity-level edits (ageing) and mangles small text in edits. "
             "gpt-image-2 (native 2048×1152) follows spatial/left-right instructions best and won F2, F4, F5, F7, F8, "
             "the HALYS_WIDE master and the totality; it rejects three full-size references (cap at 1280 px). Seedream 5 Pro "
             "(2560×1440) produced the most painterly oil (F3 duel, F6 Tiepolo sky). FLUX.2 max lost the field-line "
             "frames (noisy).")
    L.append("")
    L.append("### Notes for the Seedance plates")
    L.append("")
    L.append("* Feed `media/chars/<name>.jpg` (16:9, 2048 px; `cfai.image_ref()` needs no padding). One sheet per "
             "character; for two-hander plates (the duel, the kings' oath) attach both sheets and name them by order.")
    L.append("* If `PrivacyInformation` trips (photoreal face close-ups), retry with `use_virtual_avatar`, or crop the "
             "sheet to the full-length views without the head inset.")
    L.append("* Mirrored sheets: Cyaxares, Astyages and the archer hold the bow in the RIGHT hand. That is acceptable "
             "(archers shot either way); the sword must stay on the right thigh in every plate prompt.")
    L.append("* THE LYDIAN wears the Corinthian helmet pushed up (face visible); pull it down only for battle beats. His "
             "knucklebone is on a neck cord and in the palm inset; THE MEDE's clay toy horse is tucked in the belt and in "
             "the palm inset. Their builds and heights are matched (≈175 cm, early 30s).")
    L.append("* ROOM lettering follows ROOM.md as written (`1420.405 MHz` sticker, `1420 MHz` patch, `RARE EARTH`). "
             "FACTCHECK.md #7 suggests `1420.4058 MHz` or `1420 MHz` for the sticker; the renderer redraws all lettering, "
             "so change it there if adopted. Screen and poster micro-text in the ROOM sheets is pseudo-text by design.")
    L.append("* Sets: `halys_wide3_gpt_t1` (master, backlit golden hour) and `halys_totality3_gpt_j_t1` (same river, at "
             "totality) are a matched pair for the hook / drop compositions; `halys_shallows_b_t1` is the empty duel ground.")
    L.append("")
    L.append("### Reference boards (what `board:<name>` in the refs column contains)")
    L.append("")
    L.append("| board | composited from `production/refs/` |")
    L.append("|---|---|")
    used = set()
    for m in rows:
        for r in m.get("refs") or []:
            if r.startswith("board:"):
                used.add(r[6:])
    for name in sorted(used):
        srcs = ", ".join(f"`{p.split('/')[-1][:60]}`" + (" (crop)" if box else "") for p, box in jobs.REFBOARDS[name])
        L.append(f"| `{name}` | {srcs} |")
    L.append("")
    L.append("Other refs: `Pasted image.png` = the singer's anime character sheet; `chars/...`, `sets/...`, `frames/...` = "
             "earlier boards (identity or layout carried forward); paths under `median_persian_scythian/` etc. are single "
             "files from `production/refs/`.")
    L.append("")
    L.append("## Every board")
    L.append("")
    L.append("Verdicts: **canonical** = the pick; **alt** = usable alternative or the source of a canonical edit; "
             "**reject** = failed review (file moved to `media/boards/_rejects/<folder>/`).")
    L.append("")
    body = boards.index(canon={}, header="")
    L.append(body.lstrip())
    out = ROOT / "production" / "BOARDS.md"
    out.write_text("\n".join(L).rstrip() + "\n")
    print(out, len(out.read_text().splitlines()), "lines")


if __name__ == "__main__":
    main()
