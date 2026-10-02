"""Stand-in plates for look development (Nano Banana 2 through Cloudflare, via tools/cfai.py).

    python3 video/lab/analysis/gen_plates.py [a b c d] [--force]

Writes media/lookdev/inputs/<id>_raw.<ext> (model output) and <id>.jpg (1920x1080 centre crop, q95).
Every paid call is logged by cfai.gen() as one JSON line in media/genlog.jsonl (t, tag, model, input, out, secs, est cost).
Schema validation is skipped (check=False) so nothing is written under tools/ (owned by another agent).
"""
import sys, pathlib, concurrent.futures as cf
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools"))
import cfai  # noqa: E402

OUT = ROOT / "media" / "lookdev" / "inputs"
SHEET = ROOT / "Pasted image.png"

COMMON = ("Cinematic photoreal film still, shot on 35mm anamorphic, natural film grain, historically grounded "
          "(Anatolia, 585 BC, the River Halys). No text, no watermark, no modern objects.")

PLATES = {
    "a_duel": dict(
        prompt=("Medium-wide shot. In the knee-deep shallows of a reddish clay river, an ancient Lydian warrior and a Median warrior clash mid-strike. "
                "The Lydian, on the left: bronze helmet with a horsehair crest and cheek guards, bronze muscle cuirass over a red tunic, round bronze-faced shield, "
                "short iron sword raised. The Mede, on the right: soft felt cap with side flaps tied under the chin, long-sleeved patterned tunic, trousers, "
                "wicker shield, short akinakes sword, lunging. Spray and splashing red-brown water around their legs. Late-afternoon raking sunlight from the "
                "left, low and golden, long shadows across the water, hot glints on the bronze. Dust in the air; other fighters soft and out of focus in the "
                "background on the far bank. Both full figures visible, centred, filling two thirds of the frame height. " + COMMON),
        aspect_ratio="16:9"),
    "b_face": dict(
        prompt=("Close-up portrait. A bearded ancient Lydian warrior in a battered bronze helmet with cheek guards turns his face up toward the sky in awe, "
                "eyes wide, lips parted, catching the light. Sweat, dust and a small cut on his cheek; grey-streaked black beard; worn leather strap. "
                "Warm late-afternoon light falls on his face from the upper left; the background is dark and out of focus. 85 mm lens, shallow depth of "
                "field, face fills most of the frame, slightly off-centre to the right, looking up and to the left. " + COMMON),
        aspect_ratio="16:9"),
    "c_armies": dict(
        prompt=("Wide high aerial view. Two ancient armies, thousands of soldiers in dense blocks with spears, banners and cavalry, drawn up on opposite banks "
                "of a broad winding river of red clay water snaking through a wide Anatolian steppe valley. Ochre and olive hills, dry grass, a few "
                "poplars along the river, dust rising from the ranks. Late-afternoon sun low on the left, long raking shadows, a dramatic sky of towering "
                "cumulus clouds above a distant mountain ridge on the horizon in the top fifth of the frame. Epic scale, like a historical epic film. " + COMMON),
        aspect_ratio="16:9"),
    "d_room": dict(
        prompt=("Use the character in the reference sheet exactly: same face, long straight black hair, cropped white jacket with orange stripes on the "
                "sleeves and a round '1420 MHz' patch, black crop top, orange headphones around her neck, navy cargo pants with orange straps. "
                "Draw her as a frame from a modern anime feature film: she sits at a desk in a dark bedroom at night, three-quarter view from behind her "
                "right shoulder turning toward camera, one hand on the keyboard. Three glowing monitors show star charts, an orbit diagram and green "
                "terminal text; their glow lights her face and jacket. A Yagi antenna leans against the wall, star charts pinned up, a small desk lamp off. "
                "Soft painted shading, cinematic lighting, 16:9, no speech bubbles, no captions."),
        aspect_ratio="16:9", ref=True),
}


def cover_1080(src, dst):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    s = max(1920 / w, 1080 / h)
    im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    x0, y0 = (im.size[0] - 1920) // 2, (im.size[1] - 1080) // 2
    im.crop((x0, y0, x0 + 1920, y0 + 1080)).save(dst, quality=95)


def gen_one(pid, force=False):
    spec = PLATES[pid]
    dst = OUT / f"{pid}.jpg"
    if dst.exists() and not force:
        return pid, str(dst), "exists"
    inp = {"prompt": spec["prompt"], "aspect_ratio": spec["aspect_ratio"], "output_format": "jpg", "resolution": "2K"}
    if spec.get("ref"):
        ref = OUT / "ref_sheet.jpg"          # flattened JPEG copy of the character sheet (keeps tool caches out of media/tmp)
        if not ref.exists():
            Image.open(SHEET).convert("RGB").save(ref, quality=92)
        inp["image_input"] = [cfai.data_uri(ref)]
    paths, _ = cfai.gen("google/nano-banana-2", inp, str(OUT / f"{pid}_raw.jpg"), tag=f"lookdev:plate:{pid}", check=False)
    cover_1080(paths[0], dst)
    return pid, str(dst), paths


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    ids = args or list(PLATES)
    OUT.mkdir(parents=True, exist_ok=True)
    with cf.ThreadPoolExecutor(len(ids)) as ex:
        for fut in cf.as_completed([ex.submit(gen_one, i, force) for i in ids]):
            try:
                print(fut.result(), flush=True)
            except Exception as e:
                print("FAILED", e, flush=True)
