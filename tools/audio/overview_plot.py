"""production/audio_overview.png: the whole song on one page (2400 x 900).

usage:  python tools/audio/overview_plot.py
Lanes (one shared time axis): sections (drops washed violet) with bar numbers / mix energy (24 fps rms) /
low band 30-150 Hz (kick, sub, timpani) / lyric lines / chopped vocals. Drop impacts and the final chord are
marked through every lane. Palette = the dataviz reference slots (blue, orange, violet), validated light-mode.
"""
import json
import pathlib

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]
T = json.loads((ROOT / "video" / "data" / "timing.json").read_text())
OUT = ROOT / "production" / "audio_overview.png"

SURF, INK, INK2, MUTED, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#8a8984", "#e4e3df"
BLUE, ORANGE, VIOLET = "#2a78d6", "#eb6834", "#4a3aa7"
SHORT = {"cold_open": "cold\nopen", "intro_a": "intro A", "intro_b": "intro B (the boom, the build)", "verse1": "verse 1",
         "pre1": "pre", "chorus1": "chorus 1", "drop1_a": "DROP 1", "drop1_break": "", "drop1_b": "DROP 1 (16)",
         "breakdown": "brk", "verse2": "verse 2", "shadow": "shadow", "thales": "Thales → spark",
         "chorus2": "final chorus", "drop2": "DROP 2", "outro": "outro"}


def mmss(t):
    return f"{int(t // 60)}:{int(t % 60):02d}"


def main():
    dur = T["dur"] + 0.4
    cur = T["curves"]
    ft = np.arange(cur["n"]) / cur["fps"]
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 11, "axes.edgecolor": GRID, "axes.labelcolor": INK2,
                         "xtick.color": INK2, "ytick.color": INK2, "text.color": INK})
    fig = plt.figure(figsize=(24, 9), dpi=100, facecolor=SURF)
    gs = fig.add_gridspec(5, 1, height_ratios=[0.9, 2.2, 1.7, 1.45, 0.8], hspace=0.08, left=0.045, right=0.99, top=0.875, bottom=0.07)
    ax = [fig.add_subplot(gs[i]) for i in range(5)]
    for a in ax:
        a.set_facecolor(SURF)
        a.set_xlim(0, dur)
        for s in ("top", "right", "left"):
            a.spines[s].set_visible(False)
        a.tick_params(length=0)
        a.set_xticks(np.arange(0, dur, 15))
        a.set_xticklabels([])
        a.grid(axis="x", color=GRID, lw=1)
        a.set_axisbelow(True)
    # sections lane: alternating neutral bands, drops washed violet, bar numbers at each section start
    a = ax[0]
    a.set_ylim(0, 1)
    a.set_yticks([])
    for i, s in enumerate(T["sections"]):
        drop = s["id"].startswith("drop") and s["id"] != "drop1_break"
        for b in ax:
            b.axvspan(s["t0"], s["t1"], color=VIOLET if drop else ("#f0efec" if i % 2 else SURF), alpha=0.10 if drop else 1.0, lw=0, zorder=0)
        mid = (s["t0"] + s["t1"]) / 2
        a.text(mid, 0.62, SHORT.get(s["id"], s["id"]), ha="center", va="center", fontsize=11 if drop else 10,
               fontweight="bold" if drop else "normal", color=INK if drop else INK2)
        if s["t1"] - s["t0"] > 3.0:
            a.text(s["t0"] + 0.4, 0.12, f"b{s['bar0']}", ha="left", va="bottom", fontsize=8, color=MUTED)
        for b in ax:
            b.axvline(s["t0"], color="#d6d5d0", lw=1, zorder=1)
    # energy
    a = ax[1]
    rms = np.array(cur["rms"])
    a.fill_between(ft, 0, rms, color=BLUE, alpha=0.10, lw=0)
    a.plot(ft, rms, color=BLUE, lw=1.2)
    a.set_ylim(0, 1.08)
    a.set_yticks([0, 0.5, 1])
    a.set_ylabel("mix energy\n(rms, 45 dB → 0–1)", fontsize=10)
    a.grid(axis="y", color=GRID, lw=1)
    # low band
    a = ax[2]
    low = np.array(cur["low"])
    a.fill_between(ft, 0, low, color=ORANGE, alpha=0.10, lw=0)
    a.plot(ft, low, color=ORANGE, lw=1.2)
    a.set_ylim(0, 1.18)
    a.set_yticks([0, 0.5, 1])
    a.set_ylabel("low band 30–150 Hz\n(kick · sub · timpani)", fontsize=10)
    a.grid(axis="y", color=GRID, lw=1)
    for h in T["events"]["booms"]:
        a.plot([h["t"]], [1.1], marker="v", ms=7, color=INK2, mec=SURF, mew=2, zorder=5)
    a.text(dur - 0.5, 1.1, "▼ big low booms", ha="right", va="center", fontsize=8, color=INK2)
    # lyric lines: thin ink bars, labels staggered on two rows
    a = ax[3]
    a.set_ylim(0, 1)
    a.set_yticks([])
    a.set_ylabel("lyrics", fontsize=10)
    busy = [-1e9, -1e9, -1e9]     # greedy row packing: a label never starts before the previous one on its row ends
    for ln in T["lines"]:
        words = ln["text"].replace("…", "").replace(",", "").split()
        lab = " ".join(words[:2]) + "…"
        width = 0.78 * len(lab) + 1.2          # seconds of axis a label of this length covers at 8 pt
        r = next((k for k in range(3) if busy[k] <= ln["t0"]), int(np.argmin(busy)))
        busy[r] = max(ln["t0"] + width, ln["t1"] + 0.5)
        y = (0.76, 0.46, 0.16)[r]
        a.plot([ln["t0"], ln["t1"]], [y, y], color=INK2, lw=4, solid_capstyle="round")
        a.text(ln["t0"], y + 0.07, lab, fontsize=8, color=INK, ha="left", va="bottom")
    # chops
    a = ax[4]
    a.set_ylim(0, 1)
    a.set_yticks([])
    a.set_ylabel("chops", fontsize=10)
    for c in T["chops"]:
        st = c["word"] == "stutter"
        a.plot([c["t"], c["t"]], [0.15, 0.45 if st else 0.75], color=MUTED if st else INK, lw=1 if st else 1.6)
    groups = [(110.66, "HALO·IN THE·SKY·SKY + stutter", "left"), (140.45, "HALO·IN THE·SKY·SKY ×4 (beats 2·4·1·3)", "left"),
              (255.6, "THROW DOWN ×3 · BLADE (260.62) · held 'throw down' →", "right")]
    for t, lab, ha in groups:
        a.text(t, 0.82, lab, fontsize=8.2, color=INK, ha=ha, va="bottom")
    a.text(217.0, 0.40, "Drop 2 topline: wordless sustained vocal (no chops)", fontsize=8.2, color=MUTED, ha="left", va="center")
    # impacts through every lane
    marks = [(T["events"]["drop_impacts"][0]["t"], "DROP 1 · first kick"), (T["events"]["drop_impacts"][2]["t"], "DROP 2 · first kick"),
             (194.84, "“spark”"), (210.177, "beat held back"), (T["events"]["final_chord"]["t"], "final chord")]
    rows = {"DROP 1 · first kick": (1.30, "center"), "DROP 2 · first kick": (1.30, "left"), "“spark”": (1.05, "right"),
            "beat held back": (1.05, "left"), "final chord": (1.05, "right")}
    for t, lab in marks:
        for b in ax:
            b.axvline(t, color=INK, lw=1.4 if "DROP" in lab else 1.0, zorder=6)
        y, ha = rows[lab]
        ax[0].text(t + (0.6 if ha == "left" else -0.6 if ha == "right" else 0), y, f"{lab}  {mmss(t)}.{int(round((t % 1) * 100)):02d}",
                   transform=ax[0].get_xaxis_transform(), ha=ha, va="bottom", fontsize=9.5,
                   fontweight="bold" if "DROP" in lab else "normal", color=INK)
    ax[-1].set_xticklabels([mmss(x) for x in np.arange(0, dur, 15)], fontsize=10)
    ax[-1].set_xlabel("song time (Halys.mp3, 273.6 s; bar numbers b# from video/data/timing.json)", fontsize=10, color=INK2)
    fig.suptitle("HALYS: audio overview", x=0.045, y=0.985, ha="left", fontsize=16, fontweight="bold", color=INK)
    fig.text(0.99, 0.985, f"{T['bpm']:.1f} BPM median (136.4 → 142 drift) · B minor · 159 bars · energy and low band at 24 fps",
             ha="right", va="top", fontsize=10, color=INK2)
    fig.savefig(OUT, dpi=100, facecolor=SURF)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
