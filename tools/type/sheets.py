"""Contact sheets of every text event at its key frame, 16:9 and 4:5, over the type look-dev stand-ins.

    python3 tools/type/sheets.py [--sizes=1920x1080,1080x1350] [--out=production/type]

Renders the stills with tools/type/typetest.mjs (the real harness page with the `typebg` stand-in backgrounds) into
video/out/type_sheet_<W>x<H>/, labels each tile from video/data/texttrack.json, and tiles them with contact.py.
"""
import json, math, pathlib, shutil, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
TRACK = json.loads((ROOT / "video/data/texttrack.json").read_text())
opts = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
SIZES = opts.get("sizes", "1920x1080,1080x1350").split(",")
OUT = ROOT / opts.get("out", "production/type")

# key frames: every event once, plus the moments an effect is about (seconds)
KEYS = [1.30, 2.80, 4.80, 6.70, 9.80, 13.70, 24.40, 31.60, 43.80, 49.20, 63.80, 73.60, 80.20, 85.75, 89.19, 92.85, 96.30,
        99.90, 102.80, 105.70, 109.80, 110.40, 110.67, 111.60, 112.75, 115.00, 121.00, 140.50, 145.30, 148.10, 153.10,
        163.95, 167.40, 170.60, 174.30, 178.60, 182.10, 184.40, 186.95, 192.70, 194.70, 195.25, 203.38, 207.30, 211.70,
        215.20, 224.68, 228.08, 231.48, 234.87, 238.26, 241.65, 245.03, 248.42, 255.50, 257.40, 260.30, 261.40, 269.70,
        276.50, 280.40]
FPS = 60


def label(t):
    evs = [e for e in TRACK["events"] if e["t0"] - 1e-6 <= t < e["t1"] - 1e-6]
    shot = next((e["shot"] for e in evs if e["t0"] <= t), "")
    parts = []
    for e in evs:
        txt = " / ".join(i["text"] for i in e["items"] if not i.get("ghost")) or ("forecast card" if e["fx"] == "forecast" else e["fx"])
        parts.append(f"{e['fx']}: {txt}")
    return f"{t:.2f}s  " + "  |  ".join(parts)


def main():
    for size in SIZES:
        w, h = map(int, size.split("x"))
        d = ROOT / f"video/out/type_sheet_{size}"
        shutil.rmtree(d, ignore_errors=True)
        d.mkdir(parents=True)
        spec = ",".join(f"{t:.3f}" for t in KEYS)
        subprocess.run(["node", str(ROOT / "tools/type/typetest.mjs"), f"--stills={spec}", f"--size={size}", f"--out={d}"], check=True)
        labels = {}
        for f in sorted(d.glob("*.jpg")):
            i = int(f.stem.split("_")[0][1:])
            t = min(KEYS, key=lambda k: abs(math.floor(k * FPS + 1e-6) - i))
            labels[f.name] = label(t)
        (d / "labels.json").write_text(json.dumps(labels, ensure_ascii=False, indent=1))
        tag = "16x9" if w > h else "4x5" if abs(w / h - .8) < .01 else f"{w}x{h}"
        cols, tw = (5, 520) if w > h else (8, 330)
        subprocess.run([sys.executable, str(ROOT / "tools/type/contact.py"), str(d), str(OUT / f"contact_{tag}.jpg"), f"--cols={cols}", f"--w={tw}",
                        f"--labels={d / 'labels.json'}", f"--title=HALYS type system · every text event at its key frame · {size} · stand-in backgrounds"], check=True)


if __name__ == "__main__":
    main()
