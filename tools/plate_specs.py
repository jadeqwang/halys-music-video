"""Seedance plate specs: the director's shot list for reference footage.

Plates are reference only. The JS renderer reads them (motion, composition, faces, physics, light) and
redraws them in its own style; the footage itself never appears in the film. Prompts should therefore
favour *traceable* pictures: one clear action, readable silhouettes, hard directional light, simple
backgrounds, no on-screen text.

Run them with tools/plates.py (see production/TOOLING.md):
    python3 tools/plates.py --list
    python3 tools/plates.py --dry river_wide           # request + cost estimate, no API call
    python3 tools/plates.py river_wide                 # generate (a new take each time it is named)

Fields per plate (only `prompt` is required):
  prompt          str, <= 2000 chars (Seedance 2.5). Name references by order ("the woman in the first reference image").
  model           default "bytedance/seedance-2.5" (also: "bytedance/seedance-2.0", "...-2.0-fast", "...-2.0-mini")
  duration        4..30 seconds, or -1 (model picks). Default 5. Billed per output second.
  resolution      "480p" ($0.1028/s) | "720p" ($0.2312/s, default). 24 fps always.
  aspect_ratio    "16:9" (default) | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "adaptive"
  refs            list of REFS keys or repo paths -> reference_images (max 30; 1-4 works best). Images are
                  flattened to RGB JPEG, <= 2048 px, padded to <= 2.4:1 (wider references are rejected).
  first_frame     REFS key/path -> `image` (image-to-video; aspect_ratio is then forced to adaptive)
  last_frame      REFS key/path -> `last_frame_image` (needs first_frame)
  ref_videos      list of repo paths -> reference_videos (total <= 30 s). Switches billing to the
                  video-input rate: $0.4304/s at 480p, $0.9676/s at 720p (~4x).
  audio           audio reference(s) -> reference_audios (total <= 30 s). Each item is either a path, or
                  {"t0": song seconds, "dur": seconds (default: the plate duration), "src": "song" | "vocals" | path}.
                  "song" = Halys.mp3; "vocals" = the isolated vocal stem (media/stems/, see tools/audio/).
                  The slice is cut by plates.py into media/plates/<id>/audio_<src>_<t0>_<dur>.mp3.
  generate_audio  default False. True gives the plate its own soundtrack (handy to measure where Seedance
                  placed the reference audio), but a soundtrack built from the song can trip the provider's
                  copyright filter.
  avatar          use_virtual_avatar (default False). Routes image refs through ByteDance's virtual-avatar
                  library; set True when a realistic-face reference fails with "...PrivacyInformation".
  seed            int (accepted, reproducibility not guaranteed)
  takes           how many takes to keep for this plate when plates.py runs without ids (default 1)
  t_song          [t0, t1]: where the plate sits in the song (bookkeeping; used by lip-sync checks)
  example         True = never generated unless named explicitly on the command line
  notes           free text
"""

# Reference images, by short key. Paths are relative to the repo root.
REFS = {
    "SHEET": "Pasted image.png",   # the singer as an anime character: front / three-quarter / side / back turnaround
}

# Shared prompt fragments (keep plates consistent; append to prompts as needed).
NO_TEXT = "No on-screen text, no captions, no labels, no watermark."
SINGER = ("the young woman from the reference character sheet (long straight black hair, white cropped jacket with "
          "orange stripes, black crop top, orange headphones around her neck, navy cargo trousers)")
SING = ("She sings the words of the reference audio: her lips move in sync with every word and breath of the vocal, "
        "natural singing mouth shapes, jaw and throat movement.")

PLATES = {
    # An example to copy. It reproduces the 2026-10-02 smoke test (media/tests/seedance25_test_480p_4s.mp4);
    # `example=True` keeps `plates.py` (no ids) from ever spending money on it.
    "example_singer_cu": dict(
        example=True, duration=4, resolution="480p", refs=["SHEET"],
        audio={"t0": 69.12, "dur": 4.0, "src": "song"}, t_song=[69.12, 73.12],
        prompt=(f"Anime style with clean cel shading, exactly like the reference character sheet. Medium close-up of {SINGER} "
                f"singing softly in a dim room lit by a single warm lamp. {SING} Almost static camera with a very slow push-in. "
                + NO_TEXT),
        notes="verse 1: '...lys, on the sixth year of the war'"),
}
