"""Source sounds for the sound-design layer, from ElevenLabs Music v2 on Cloudflare (logged by cfai.gen).

usage:  python tools/audio/sfx_gen.py [name ...]        (default: every job not on disk yet)
writes: media/sfx/src/<name>.mp3

Cloudflare's catalog has no ElevenLabs sound-effects endpoint (only TTS models and music-v2; checked
2026-10-03 with `cfai.py catalog --refresh`), so SFX come from music-v2 with force_instrumental and a
"sound effects only, no music" prompt, which works for foley (media/tests/sfx_bronze_swords.mp3). Every
result is judged in tools/audio/sound_design.py's report (tonality / rhythm checks) and by spectrogram; wind,
room tone, shimmer, sparkle, clicks fallback and the ending freeze are synthesised procedurally there.
"""
import pathlib
import sys
import threading

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import cfai  # noqa: E402

OUT = ROOT / "media" / "sfx" / "src"
NO_MUSIC = "Sound effects only, realistic field recording. No music, no melody, no musical instruments, no drums, no beat, no singing."
JOBS = {
    "battle_bed": (40000, NO_MUSIC + " A distant ancient battle heard from far away across a wide river valley: far-off bronze "
                   "swords and shields clashing irregularly, horses neighing and galloping in the distance, muffled shouting of "
                   "thousands of soldiers, a broad river flowing nearby, light wind. Distant, diffuse, continuous ambience."),
    "river": (30000, NO_MUSIC + " A broad shallow river flowing over stones and gravel, steady natural water sound, gentle "
              "babbling, outdoors, no birds, no wind."),
    "horses_far": (20000, NO_MUSIC + " Cavalry far away: many horses galloping on open ground in the distance, hoof thunder, "
                   "occasional neighing, distant and muffled, outdoors."),
    "birdsong": (20000, NO_MUSIC + " Sparse evening birdsong in an open meadow at dusk: a blackbird and a few small songbirds "
                 "calling and answering, gentle, natural, no insects, no wind, no water."),
    "army_cheer": (10000, NO_MUSIC + " A huge crowd of ancient soldiers far away across a valley suddenly erupting in a joyful "
                   "roar and cheering, swelling then fading away, distant and diffuse, outdoors."),
    "keyboard": (8000, NO_MUSIC + " A few slow mechanical keyboard key presses in a quiet room at night: close-up tactile "
                 "clicky key switches, single keys with short pauses between them, then the spacebar, then silence."),
    "blade_drop": (3000, NO_MUSIC + " A bronze sword dropped onto wet river stones: one metallic clang with a short bright ring, "
                   "close-up, dry, then silence."),
}


def run(name, ms, prompt):
    out = OUT / f"{name}.mp3"
    inp = {"prompt": prompt, "music_length_ms": ms, "force_instrumental": True, "output_format": "mp3_48000_192"}  # seed + prompt is rejected
    try:
        paths, _ = cfai.gen("elevenlabs/music-v2", inp, str(out), tag=f"sfx:{name}")
        print(f"[sfx_gen] {name}: {paths}", flush=True)
    except Exception as e:  # noqa: BLE001
        print(f"[sfx_gen] {name} FAILED: {e}", flush=True)


def main(names):
    OUT.mkdir(parents=True, exist_ok=True)
    todo = names or [n for n in JOBS if not (OUT / f"{n}.mp3").exists()]
    th = [threading.Thread(target=run, args=(n, *JOBS[n])) for n in todo]
    [t.start() for t in th]
    [t.join() for t in th]


if __name__ == "__main__":
    main(sys.argv[1:])
