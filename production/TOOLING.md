# HALYS: tooling reference

How the generation tools, the plate pipeline and the JavaScript render harness work, with the facts
they are built on (measured in this sandbox on 2026-10-02 unless marked otherwise). Read this before
spending money.

> Status (2026-10-03): models from the cached schemas, the priced catalog and the smoke tests in `media/genlog.jsonl`
> (total spend so far $1.04; this pass made no paid calls). Tools audited, plate pipeline run end to end, render harness
> built and verified (3.6), release encoder verified (4). Contents: 0 sandbox · 1 models · 2 tools · 3 render harness ·
> 4 release encoding.

---

## 0. The sandbox, in five facts

1. **Only `api.cloudflare.com` is reachable** for generation (plus pypi, npm, GitHub, raw.githubusercontent.com,
   storage.googleapis.com). Hugging Face, download.pytorch.org, dl.fbaipublicfiles.com, `*.workers.dev`,
   `*.volces.com` (Seedance outputs), `*.x.ai` and ElevenLabs hosts are blocked.
2. **The agent proxy injects the Cloudflare API token.** Requests carry no `Authorization` header.
   Account `78885e7db58a4c34423a7e62c8471b75` (`tools/relay/relay.json`).
3. **Synchronous `/ai/run` calls are cut at ~30 s** (the sandbox returns an empty 200). A cut call may still
   complete and be billed server-side, so `cfai.py` never retries one.
4. **Long jobs run in the background**: `options.background=true` + `webhookUrl` → the relay Worker
   `halys-relay` (`tools/relay/worker.js`) stores the webhook body in KV (`res:<job>`) and mirrors output files
   into KV (`mir:<job>`, `media:<job>:<i>[:<chunk>]`). `cfai.py` reads KV through the Cloudflare API.
5. **Every paid call is logged** to `media/genlog.jsonl` (one JSON line: `t, tag, model, input` (blobs stripped),
   `out, secs, est_cost_usd`, plus `job, usage, mode`). Pending background jobs sit in `media/jobs/<job>.json`
   until collected. `python3 tools/cfai.py cost` totals the spend ($1.04 after the smoke tests).

---

## 1. Models

All models are called through `tools/cfai.py` (Cloudflare unified API: `POST /accounts/<acc>/ai/run` with
`{"model": ..., "input": ...}`; Workers AI `@cf/...` models use `POST /ai/run/<model>` with the input as body).
Schemas are cached in `tools/cf_schemas/<vendor>__<model>.json` (`python3 tools/cfai.py schema MODEL`), the
priced catalog in `tools/cf_schemas/catalog.json` (`python3 tools/cfai.py catalog --refresh`).
`cfai.gen()` validates every input against the schema before paying.

### 1.1 Seedance 2.5: `bytedance/seedance-2.5` (the plate model)

| | |
|---|---|
| Endpoint | `POST /ai/run` `{"model":"bytedance/seedance-2.5","input":{...}}`, **background mode only** (any real clip takes > 30 s) |
| Modes | text→video; first frame (`image`) [+ `last_frame_image`]→video; multimodal reference→video (`reference_images` / `reference_videos` / `reference_audios`, any mix; **audio-only input is allowed**); video edit/extension (reference video + prompt) |
| `prompt` | ≤ 2000 chars. Optional if any reference is given. Address references by order: "the woman in the first reference image" |
| `duration` | integer **4–30 s**, or `-1` (model picks). When editing an input reference video only `-1` works (output ≈ input length). Billed per output second |
| `resolution` | **`480p` or `720p` only** (no 1080p on 2.5; Seedance 2.0 has 1080p) |
| `aspect_ratio` | `16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `21:9`, `adaptive` (schema default; `cfai` sets `16:9`). First/last-frame runs are always `adaptive` |
| `fps` | **24, fixed** (`const`). An N-second clip has `24·N + 1` frames (4 s → 97 frames, 4.042 s) |
| Output size | measured: 480p 16:9 → **854×480**, H.264 High yuv420p, ~2.4 Mbit/s, mp4, **no audio stream** when `generate_audio` is off. 720p 16:9 → 1280×720 (expected, not yet measured). `output_format: "mov"` for higher colour fidelity |
| `reference_images` | 0–**30** (1–4 work best). URL or data URI. `cfai.image_ref()` flattens alpha, caps the long side at 2048 px and pads to ≤ 2.4:1 because **references wider than ~2.5:1 are rejected** |
| `reference_videos` | 0–**10**, total ≤ **30 s**. Any reference video switches billing to the **video-input rate (~4×)** |
| `reference_audios` | 0–**10**, total ≤ **30 s**, `data:audio/...` URIs or URLs. MP3 slices of the song work (`cfai.audio_slice()`, 48 kHz stereo 192k with 20 ms fades) |
| `generate_audio` | default off in our tools. On = the clip gets its own soundtrack (useful to measure where Seedance placed the reference audio) but a soundtrack rebuilt from the song can trip the provider's copyright filter |
| `use_virtual_avatar` | routes image refs through ByteDance's virtual-avatar library. Turn on when a realistic face fails with `...PrivacyInformation` (the real-person filter; probabilistic, triggered most by face close-up sheets). `plates.py` retries with it automatically |
| `camera_fixed` | accepted, **no effect** (provider does not support it). Ask for camera behaviour in the prompt |
| `seed` | accepted, **not reproducible** |
| `watermark` | `false` (default in our tools) → no visible watermark |
| Price | **480p $0.1028/s, 720p $0.2312/s**; with any reference video **480p $0.4304/s, 720p $0.9676/s**. Image and audio references do not change the rate. 5 s @720p = $1.16; 10 s @720p = $2.31; 4 s @480p = $0.41 (measured) |
| Latency | measured **146 s** wall for 4 s @480p with 1 image + 1 audio reference (submit → webhook → relay mirror → KV read). Expect a few minutes for 10–15 s @720p (the orbital project budgeted 1500 s per job). Run takes in parallel (`PLATE_PAR=4`) |
| Output host | `*.volces.com` (blocked here) → files arrive through the relay's KV mirror (≤ 200 MB per file, 20 MiB KV chunks) |
| Provenance | every mp4 carries a **C2PA manifest** (`uuid` box) signed by *Byteplus Pte. Ltd.* (GlobalSign S/MIME cert), `model_name: dreamina-seedance-2-5`, action `c2pa.created`, `digitalSourceType: trainedAlgorithmicMedia`. ffmpeg re-encodes drop it; plates never appear in the film, so the film carries no C2PA. Honest credit: "drawn in JavaScript over AI-generated motion reference" |

Failure modes seen so far (here and in the orbital project): `PrivacyInformation` (real-person filter → retry with
`use_virtual_avatar`, reshuffle refs, drop face close-ups); copyright filter with `generate_audio` on song material;
wide references rejected; gateway timeouts on submit (never resubmit blindly: `cfai.py collect <job>` first; a lost
response may still be billed); lip sync is close but not frame-exact (mouth-openness vs vocal envelope r ≈ 0.55 on
the smoke plate; plan to redraw mouths from the vocal stem, as orbital did).

Copy-paste (via the spec file; preferred):

```bash
python3 tools/plates.py --list                       # specs, takes, $/take
python3 tools/plates.py --dry example_singer_cu      # request without blobs + estimate, no API call
python3 tools/plates.py example_singer_cu            # one new take -> media/plates/example_singer_cu/take<N>.mp4
python3 tools/plates.py --collect                    # finish takes whose process died
```

Direct:

```bash
python3 tools/cfai.py gen bytedance/seedance-2.5 media/tests/x.mp4 \
  '{"prompt":"...","duration":5,"resolution":"480p","aspect_ratio":"16:9"}' --tag=test:x --dry
```

```python
import sys; sys.path.insert(0, "tools"); import cfai
inp = {"prompt": "...", "duration": 4, "resolution": "480p", "aspect_ratio": "16:9",
       "reference_images": [cfai.image_ref("Pasted image.png")],
       "reference_audios": [cfai.data_uri(cfai.audio_slice("Halys.mp3", 69.12, 4.0, "media/tmp/a.mp3"))]}
paths, rec = cfai.gen("bytedance/seedance-2.5", inp, "media/tests/x.mp4", tag="test:x")   # blocks; bg mode + relay
```

Other Seedance variants on the gateway (not used): `seedance-2.0` (480p/720p/**1080p/4k**, 4–12 s, $0.07/$0.15/$0.37/
$0.78 per s without video input), `seedance-2.0-fast` (480p/720p, $0.06/$0.12), `seedance-2.0-mini` ($0.04/$0.09).
The 2.0 family takes one `reference_video` (singular), at most 4 `reference_images` and **no audio references**, so
lip-synced singer plates need 2.5.

### 1.2 Nano Banana 2 / Pro / 2-lite: `google/nano-banana-2`, `google/nano-banana-pro`, `google/nano-banana-2-lite`

Gemini image models: style frames, character and set sheets, stills that become 1-frame plates.

| | nano-banana-2 | nano-banana-pro |
|---|---|---|
| Inputs | `prompt`, `image_input` (≤ **3** refs), `aspect_ratio` (`match_input_image`, 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9), `resolution` `1K`/`2K`/`4K`, `output_format` jpg/png, `google_search`, `image_search` (grounding) | `prompt`, `image_input` (≤ 3), `aspect_ratio` (no `match_input_image`), `image_size` `1K`/`2K`/`4K` (**note the different field name**), `output_format` jpg/png/webp |
| Price | $0.50 / 1M input tokens, **$60 / 1M output tokens** → measured **$0.09 @1K, $0.12–0.13 @2K** per image | $2 / 1M in, **$120 / 1M out** → ≈ $0.14 @1K/2K, ≈ $0.24 @4K (estimated from token counts) |
| Output size (16:9) | 1K → **1376×768**, 2K → **2752×1536** (measured) | similar (unmeasured) |
| Latency | measured 21–64 s @2K, 27 s @1K → background mode | longer (background) |
| Provenance | C2PA signed by Google LLC ("Created by Google Generative AI") + **invisible SynthID watermark** ("Applied imperceptible SynthID watermark") | same |

`nano-banana-2-lite`: $0.25 / $30 per 1M, JPEG or PNG. Google (and ElevenLabs) outputs come back from AI Gateway as R2
presigned URLs, which are downloadable from the sandbox directly (no relay mirror needed).

```bash
python3 tools/cfai.py gen google/nano-banana-2 media/tests/still.jpg \
  '{"prompt":"...","aspect_ratio":"16:9","resolution":"2K","output_format":"jpg"}' --tag=test:still
```

### 1.3 Grok Imagine: `xai/grok-imagine-image` (+ `-2.0`, `-quality`), `xai/grok-imagine-video` (+ `-1.5-preview`)

| | |
|---|---|
| Image inputs | `prompt`, `n` 1–10, `aspect_ratio` (1:1 … 20:9, `auto`), `resolution` `1k`/`2k`, `quality` low/medium/high, `image` / `images` (≤ 10, objects `{"url": ...}`), `mask`, `response_format` **`b64_json`** (cfai default: x.ai URLs are blocked here) |
| Image price | `grok-imagine-image` **$0.02**/image (+$0.002 per input image); `-2.0` $0.04 (+$0.01, ≤ 5 refs); `-quality` $0.05 (+$0.01) |
| Image latency | measured **8.5 s** sync @1k 16:9 → 1280×720 |
| Video inputs | `_operation` generate/edit/extend, `prompt`, `duration` 1–15 s, `aspect_ratio`, `resolution` 480p/720p or `size`, `image`, `video`, `reference_images` (≤ 10) |
| Video price | `grok-imagine-video` $0.05/s @480p, $0.07/s @720p; `-1.5-preview` $0.08 / $0.14 |
| Provenance | C2PA with a **self-signed "LOCAL USE ONLY" ephemeral cert**, softwareAgent "Grok Imagine" |

```bash
python3 tools/cfai.py gen xai/grok-imagine-image media/tests/g.jpg '{"prompt":"...","aspect_ratio":"16:9","resolution":"1k"}' --mode=sync --tag=test:g
```

### 1.4 ElevenLabs: `elevenlabs/music-v2` (music and sound effects), `elevenlabs/eleven-v3` (speech)

There is **no `music-v3` on the gateway** (catalog checked 2026-10-02: `music-v2`, `eleven-v3`, `eleven-multilingual-v2`,
`eleven-flash-v2-5`, `eleven-turbo-v2-5`). No dedicated sound-effects model is listed either; `music-v2` with a
"sound effect only, no music" prompt works for foley.

| | music-v2 | eleven-v3 (TTS) |
|---|---|---|
| Inputs | `prompt` **or** `composition_plan` (chunks of 3–120 s with styles), `music_length_ms` **3000–600000**, `force_instrumental`, `seed`, `output_format` (`mp3_48000_192` etc., opus, pcm), `store_for_inpainting`, `sign_with_c2pa` | `text` ≤ 10 000 chars, `voice_id` (required), `voice_settings`, `seed`, `language_code`, `previous_text`/`next_text`, `output_format` |
| Price | **$0.0025 per output second** ($0.15/min) | $0.0001 per character |
| Latency | measured **8 s** for a 3 s SFX (background mode) | fast |
| Output | mp3 48 kHz stereo; the SFX came back 3.02 s for 3000 ms; **no C2PA unless `sign_with_c2pa: true`** | mp3/opus |

```bash
python3 tools/cfai.py gen elevenlabs/music-v2 media/sfx/clash.mp3 \
  '{"prompt":"Sound effect only, no music: two bronze swords clash, ringing resonance, dry foley","music_length_ms":3000,"force_instrumental":true,"output_format":"mp3_48000_192"}' --tag=sfx:clash
```

### 1.5 Whisper: `@cf/openai/whisper-large-v3-turbo` (also `@cf/openai/whisper`, `xai/grok-stt`)

| | |
|---|---|
| Inputs | `audio` (base64 string), `task` transcribe/translate, `language`, `initial_prompt` (lyrics help a lot), `prefix`, `beam_size`, `condition_on_previous_text` (**set false** on songs: avoids loops), `vad_filter`, `no_speech_threshold`, `compression_ratio_threshold`, `log_prob_threshold`, `hallucination_silence_threshold` |
| Output | `text`, `segments` (with word timings when available), `transcription_info` (language, duration) |
| Price | $0.000513 per audio minute (essentially free) |
| Latency | 1–12 s **synchronous** (Workers AI path). Send 16 kHz mono MP3 slices to stay small; a full 274 s vocal stem took 11.9 s |
| Used by | `tools/audio/whisper_cf.py` (owned by the audio agent) for word-level lyric timing |

### 1.6 Other generators on the gateway (available, untested here)

* `google/veo-3.1-fast`: ≤ 8 s, 720p/1080p, $0.08/s @720p, $0.10/s @1080p, +$0.02–0.05/s with audio. `veo-3.1` is $0.20–0.40/s.
* `black-forest-labs/flux-2-pro-preview` / `flux-2-max` (≤ 8 refs, ≤ 4 MP; $0.03 / $0.07 first MP), `flux-1-kontext-pro` ($0.04, 1 ref).
* `bytedance/seedream-5-pro` ($0.045/image + $0.03 per ref, ≤ 10 refs).
* `openai/gpt-image-2` (token-priced; good at text in images).
* Upscalers: `pruna/p-image-upscale` ($0.005 for 1–4 MP … $0.12 for 65–128 MP), `black-forest-labs/flux-video-upscale`
  ($0.07 precise / $0.10 creative per output megapixel-second; source ≤ 20 s, ≤ 2560×1440, ≤ 50 MB). A 5 s 480p plate
  upscaled to 1080p (2.07 MP) costs ≈ $0.73 precise.

### 1.7 Depth, mattes, faces: local models (none on the gateway)

Workers AI has **no depth or segmentation models** (searched `depth`, `segment`, `background`: nothing), so these run
locally on CPU. `python3 tools/models.py` downloads them to `~/.cache/halys/models` from GitHub/Google hosts.

| Model | Tool | Speed (4 CPUs) | Notes |
|---|---|---|---|
| Depth Anything V2 Small (ViT-S, ONNX, fabio-sim release v2.0.0, fixed 518×518) | `tools/plate_depth.py` | 1.2 s/frame (measured: 49 frames in 57 s) | relative inverse depth, normalised per plate (2–98 %) so maps do not flicker |
| rembg `isnet-anime` (default), `isnet-general-use`, `u2net_human_seg` | `tools/plate_masks.py` | 1.2 s/matte (measured: 49 in 58 s, plus ~20 s model load) | models download from GitHub releases into `~/.rembg/models` |
| MediaPipe face landmarker (478 landmarks + 52 blendshapes) | `tools/plate_meta.py` | fast | found the anime face on 97/97 smoke frames (with the upscaled-crop retry); needs `libegl1 libgles2` |
| nagadomi `lbpcascade_animeface` | `tools/plate_meta.py` | fast | fallback, box only |

---

## 2. Tools (`tools/`)

All Python tools run from the repo root with the system `python3` (3.11; numpy, opencv 5, onnxruntime, rembg,
mediapipe, jsonschema, Pillow are installed). Audited 2026-10-02: every CLI below was run (`--help`, `--list`,
`--dry`, or a real run on the smoke plate); fixes are noted.

| Tool | What it does | Run |
|---|---|---|
| `cfai.py` | Cloudflare client: schema validation, sync/background runs, relay/KV collection, cost estimates, genlog | `python3 tools/cfai.py gen MODEL OUT '{json}' [--tag=T] [--mode=bg\|sync] [--dry]` · `collect [JOB]` · `jobs` · `schema MODEL [--refresh]` · `catalog [--q=seedance] [--refresh]` · `cost [--since=2026-10-01]` |
| `relay/relay.py` + `relay/worker.js` | the `halys-relay` Worker (webhook sink + output mirror into KV); deploy is idempotent, the hook secret lives in the Worker and in KV (`cfg:hook_secret`) so new sessions never lose it | `python3 tools/relay/relay.py status` (bindings, cron `*/10`, secret present, KV key counts) · `deploy` · `rotate-secret` |
| `plates.py` + `plate_specs.py` | Seedance plates from the shot specs: refs prepared, audio slices cut from the song or vocal stem, budget check, parallel takes, `PrivacyInformation` retry, take metadata + contact sheet | `--list` · `--dry [ids]` · `[ids] [--takes=N]` · `--collect` · `--budget=USD` (default $30) · `--par=N` (4) |
| `extract_plates.py` | take mp4 → `video/plates/<id>/frames/f%04d.jpg` (24 fps, 960×540 cover-crop); maintains `video/plates/index.json` | `[id[:take] ...]` · `--src=FILE --id=ID` (any video) · `--still=ID:IMAGE` · `--index-only` |
| `plate_meta.py` | per frame: luminance, colour, sun/brightest blob, cuts, MediaPipe face landmarks as line work, anime-friendly `mouth_px`; `stats.json` with the exposure gain | `[ids] [--force]` |
| `plate_fields.py` | guide maps per frame at 480×270: `g` (ink, tone, edge), `o` (edge-tangent orientation + coherence), `v` (DIS optical flow); `fields.json` with encodings + 6-colour palette | `[ids] [--w= --h=] [--force] [--no-flow]` |
| `plate_masks.py` | rembg subject mattes (odd frames, step 2) | `[ids] [--model=isnet-anime\|isnet-general-use\|u2net_human_seg] [--step=2]` |
| `plate_depth.py` | Depth Anything V2 S depth (odd frames), normalised per plate | `[ids] [--step=2] [--force]` |
| `pipeline.sh` | runs the above in dependency order: extract → meta (writes the gain) → fields → mattes → depth | `tools/pipeline.sh [--mattes\|--depth\|--all] [ids]` |
| `review_sheets.py` | contact sheets: any video, all takes of a plate, frame strips, one frame next to all its maps, rendered film frames | `video FILE` · `plates [ids]` · `strip FILE --from= --to=` · `maps ID --frame=N` · `frames [--from= --to= --every=]` |
| `models.py` | downloads the local analysis models (face landmarker, anime cascade, Depth Anything ONNX) to `~/.cache/halys/models` | `python3 tools/models.py [face\|animeface\|depth]` |
| `shotlist.py` | parses `production/SHOTLIST.md` (79 shots S01–S79: times, worlds, plate ids, text cues with times and roles) into `video/data/shotlist.json`, which `video/src/edit.js` turns into shots; validates gaps/overlaps | `python3 tools/shotlist.py [--check] [--table]` (re-run after every SHOTLIST.md edit) |
| `encode_release.sh` | release encodes from the rendered frames (section 4) | `tools/encode_release.sh [--hevc\|--h264] [--test=a:b]` |

Fixes made in the audit: `pipeline.sh` no longer hides a `plate_meta.py` crash behind `| grep ... || true` (stderr is
filtered through a process substitution, exit status kept), prints per-step timings and filters the TFLite banner;
`extract_plates.py --src` accepts files outside the repo; `plate_fields.py --force` keeps the `depth` block that
`plate_depth.py` added to `fields.json`; `review_sheets.py frames` reads fps/size from the render manifest (60 fps
master) and the richer `out/shots.json` rows.

**Plate pipeline, measured** on `example_singer_cu` (4.04 s, 97 frames; `take1.mp4` is the smoke-test output, copied
there because the spec reproduces that request): `tools/pipeline.sh --all example_singer_cu` = **2 min 32 s** on 4 CPUs
(extract 0 s, meta 12 s, fields 4 s, mattes 78 s for 49, depth 58 s for 49); a re-run with everything current takes
3 s. Budget ≈ 38 CPU-seconds per plate-second with `--all` (≈ 6 min for a 10 s plate), ≈ 4 s per plate-second without
mattes/depth. Faces were found on 97/97 frames (MediaPipe), exposure gain 1.72. Check any frame with
`python3 tools/review_sheets.py maps example_singer_cu --frame=49`.

Plate workflow, end to end:

```bash
python3 tools/plates.py --dry river_wide          # check the request and the price
python3 tools/plates.py river_wide                # generate a take (logged; media/plates/river_wide/take1.mp4 + sheet)
python3 tools/review_sheets.py plates river_wide  # compare takes
tools/pipeline.sh --all river_wide                # frames + analysis for the renderer (latest take; river_wide:2 for a specific one)
```

---

## 3. Render harness (`video/`)

Every frame of the film is drawn by JavaScript in headless Chromium. The harness is built so that **a frame is a pure
function of (master frame index, output size, master fps)**: frames render in any order, in parallel, resumably, and
bit-identically (verified: frames drawn independently by different workers are byte-identical to the de-duplicated
render).

```
video/
  package.json          playwright-core 1.56.1 (matches /opt/pw-browsers chromium 1194 = Chromium 141); `npm install` once
  render.mjs            the driver (static server + Chromium workers + ffmpeg)
  studio.html           the page: render target (?render) and interactive scrubber with audio
  fonts/                Cinzel, Archivo (variable, wide), Cormorant Garamond italic, Cardo (Greek fallback), Instrument Serif,
                        JetBrains Mono (all OFL; licence files alongside)
  data/timing.json      beat grid / sections / lyric timings (written by tools/audio/, optional for the harness)
  data/shotlist.json    the locked edit, parsed from production/SHOTLIST.md by tools/shotlist.py
  plates/               plate frames + analysis (tools/pipeline.sh; frames/maps/masks are gitignored)
  src/main.js           boot, renderFrame(i), hold keys, window.HALYS API
  src/time.js           60 fps master timeline, cadence quantisation, timing.json loader, beat helpers (beatPos, pulse, curve)
  src/registry.js       scene() / shot() registry, default cadence per world, frame-grid snapping, gaps
  src/edit.js           the edit: one shot() per S## of data/shotlist.json (fallbacks: timing.json sections, a built-in table)
  src/layout.js         size-aware layout: safe areas, type unit, cover/contain with focus, per-aspect pick()
  src/assets.js         fetch/ImageBitmap/JSON loaders with LRU caches, pixels() for map decoding
  src/plates.js         plate frames, maps (g/o/v/d/m), meta, fields; plate-time mapping; numeric field decoding
  src/fonts.js          FontFace loading + type roles (carved, plaque, inscr, chop, mono)
  src/gl.js             shared WebGL2 context per size: programs, textures, full-screen passes
  src/core.js           math, hashing, seeded rng, value noise, colour, world palettes (colour script)
  src/scenes/placeholder.js   the stand-in test card for every world (draws each shot's text cues at their times)
  src/studio.js         the scrubber UI
```

### 3.1 Time model: 60 fps master, per-shot draw cadence

* Master frame `i` shows song time `i / FPS` (FPS = 60; `--fps` / `?fps=` overrides). The film is 273.624 s →
  **16 418 master frames**.
* Every shot declares a **draw cadence** (drawings per second). Defaults by world (TREATMENT.md, "frame rate is a
  genre signal"): BRONZE 12, GOLD 12, MARBLE 30, CORONA 60, ORBIT 60, ROOM 12 (anime on twos). Override per shot with
  `cadence:`. Between drawings the image is **held**: at cadence 12 each drawing stays for 5 master frames, at 30 for 2.
* Drawing `d` of a shot starting at frame `F0` covers frames with `floor((i − F0)·c / FPS) = d` and is drawn at song
  time `F0/FPS + d/c`. Drawings restart at every cut, so each shot opens on a fresh drawing on its first frame.
  Cadences that do not divide 60 (e.g. 24) are allowed and give uneven 3:2 holds (warned by `--list`).
* Shot times are song seconds; they snap to the master grid (a cut shows on the first frame at or after `t0`). When
  shots overlap, the one defined last wins (inserts over a base shot). Uncovered frames render black and are listed.
* **Timing data** (`video/data/timing.json`, written by `tools/audio/`; the harness only reads it): `time.js` exposes
  `TM.beats` (measured; the tempo drifts 136.4 → 142 BPM, never use a constant grid), `TM.downbeats`, `TM.bars`,
  `TM.sections` (`{id, name, t0, t1, bar0, bar1}`, 16 bar-aligned sections), `TM.lines` (lyrics with word timings),
  `TM.chops` (each chopped drop word with its time), `TM.events` (drop impacts, kicks, snares, stabs, timpani, choir,
  risers, final chord, ...), `TM.curves` (24 fps envelopes: rms, low, mid, high, onset, vocal) and helpers
  `beatPos(t)`, `beatTime(n)`, `pulse(t)`, `section(id)`, `sectionAt(t)`, `chopAt(t)`, `curve(name, t)`. Timed events
  land frame-exact at 60 fps: S35's CHOP "HALO" (110.66 s in both SHOTLIST.md and `TM.chops`) first appears on master
  frame 6640, the first frame at or after 110.66 s; "IN THE" on 6659, "SKY" on 6688. At 12 fps a cue can only appear on
  the next drawing (≤ 83 ms late): shots that need sample-exact hits should run at 60.
* **Hold de-duplication.** All frames of one drawing share a key `"<shot>#<d>"`. `render.mjs --frames` renders one frame
  per key and hard-links the held frames (`f06628.jpg … f06632.jpg` → one inode). The locked edit (SHOTLIST v1,
  79 shots) needs **8 529 drawings for 16 418 frames** (12 fps for 140 s, 30 fps for 39 s, 60 fps for 94 s; `--list`
  prints this), so 12 fps sections cost ~3 ms per frame effective. Encoders see identical frames, which compress to
  almost nothing.

### 3.2 Scenes, shots and the frame context

```js
// src/edit.js (imported after timing.json loads, so cuts can use beatTime(n) / TM.sections)
shot({ id: 'drop1', t0: 110.6, t1: 152.0, world: 'corona', scene: 'corona', cadence: 60,
       params: { title: ['HALO', 'IN THE', 'SKY', 'SKY'] },
       plate: { id: 'river_wide', at: 110.6, speed: 1, offset: 0, loop: false },
       framing: { '16:9': { focus: [.5, .4] }, '4:5': { focus: [.62, .35] } } });

// a scene draws the WHOLE frame into f.g (2D context of the output canvas)
scene('corona', async f => {
  // f.i master frame, f.t song time of this drawing, f.lt / f.k local time / progress, f.d drawing index, f.cad,
  // f.shot, f.params, f.world, f.framing (resolved for this aspect), f.W, f.H, f.L (layout), f.rng() (seeded per
  // drawing), f.layer(n) (pooled canvases), f.drawScene(name, overrides, g2) (e.g. the next world inside the disk)
  const tp = plateTime(f.shot, f.t), F = await plateFieldsAt(f.shot.plate.id, tp);   // ink/tone/edge/theta/coh/flow/depth/matte
  ...
});
```

Rules for scenes: no state carried between frames (caches are fine), no `Date.now()`/`performance.now()` in the
picture, randomness from `f.rng()` / `hash*()` (the engine also reseeds `Math.random` per drawing as a safety net).
Scenes are ES modules under `src/scenes/` (import `plateFieldsAt`, `plateMap`, `plateTime` from `../plates.js`,
`getGL` from `../gl.js`, `setFont` from `../fonts.js`) and register themselves when `edit.js` imports them. The
look-dev materials in `video/lab/src/` are ES modules too: port a material by wrapping its draw call in `scene()` and
replacing its fixed 1920×1080 constants with `f.W`, `f.H` and `f.L`.

**The edit** (`src/edit.js`) builds one shot per `S##` of `data/shotlist.json`: times from SHOTLIST.md, `world` = the
first world named (sets the cadence; transitions like `CORONA→MARBLE` keep the full list in `params.worlds`), plate ids
in `params.plates`, and `params.cues` = the Text column as `{role, t, t_end, text}` (CARVED / PLAQUE / INSCR / CHOP /
MONO; a cue timed into the next shot moves there; "held to 110.56" becomes `t_end`). Every shot currently draws with
the placeholder scene, which shows the cues at their times (CHOP: the latest chop only), so the studio already previews
the locked edit's cuts and type timing against the song. To start real work, give a world its scene in `edit.js`.

**Type roles** (`src/fonts.js`, SHOTLIST.md's names): CARVED = Cinzel 700 · PLAQUE = Cinzel 500, small, tracked +0.18 em
· INSCR = Cormorant Garamond italic · CHOP = Archivo 900 at 125 % width · MONO = JetBrains Mono. `setFont(g, role, px)`
sets font, width and tracking. None of the display faces has Greek, so every role falls back to bundled **Cardo** (S52's
ΘΑΛΗΣ); without it the browser would substitute a system font.

### 3.3 Output sizes and aspect ratios

The output canvas is `?w=&h=` (render.mjs `--size=WxH`): 1920×1080 master, 1080×1350 (4:5 X cut), 1080×1920 (9:16
teasers). Nothing is hard-coded: scenes read `f.L` (`layout.js`): `L.safe` / `L.action` rects, `L.u` type unit
(1 px at 1080 on the short side), `L.type(0.05)` (5 % of frame height; subtitles ≥ 4.5 %), `L.cover(srcW, srcH,
focus)` (plate placement that keeps a focus point in frame), and `L.pick({'16:9': a, '4:5': b, '9:16': c})`. Shots
carry per-aspect `framing`. Each size renders into its own frames directory (`out/frames` for 1920×1080@60,
`out/frames_1080x1350`, ...) with a `render.json` manifest, so sizes never mix.

### 3.4 Commands

```bash
cd video && npm install                                   # once (playwright-core only; never "playwright install")
node render.mjs --list [--out=out/shots.json]             # shot table, frame ranges, cadence, gaps, timing status
node render.mjs --probe                                   # WebGL2/fonts/plates check + ms per frame for every shot
node render.mjs --sheet=all --cols=4 --w=480              # contact sheet (items: id, id@0.25, id+1.5, id*4, 12.5, f750, all)
node render.mjs --stills=drop1,200.5 [--png]              # full-size stills -> out/stills/
node render.mjs --clip=110:116                            # quick MP4 with the song, no frames on disk
node render.mjs --frames=0:273.7 --workers=4              # all frames -> out/frames/f%05d.jpg (resumable, hold-linked)
node render.mjs --frames=110:154 --stale                  # after changing a scene: redraw frames drawn from older sources
node render.mjs --encode [--range=108:113]                # frames + Halys.mp3 -> out/halys_1920x1080_60[_range].mp4 (x264 CRF 16)
node render.mjs --frames=0:273.7 --size=1080x1350 && node render.mjs --encode --size=1080x1350   # the 4:5 cut
node render.mjs --serve [--port=8000]                     # studio: http://127.0.0.1:8000/studio.html?t=110&w=960&h=540
```

Options: `--fps=60`, `--q=0.93` (JPEG), `--dir=`, `--song=` (e.g. an extended final mix), `--stale`, `--force`, `--no-dedupe`,
`--shared` (one browser, N pages), `--timeout=180` (s per frame; a hung page is restarted and the frame retried once),
`--chrome=PATH`, `--verbose`, `--debug` (master-frame overlay; disables de-duplication). Interrupt any time: finished
frames are written atomically and a re-run resumes.

**Resume safety (`keys.json`).** Each frames directory keeps a ledger: for every frame file, the drawing key it holds
and a hash of the sources it was drawn from (`src/`, `studio.html`, `data/timing.json`, `data/shotlist.json`,
`plates/index.json`). On a
re-run, frames whose key changed (the edit moved a cut or changed a cadence) are **redrawn automatically**; frames drawn
from older sources, and frames with no ledger entry, are **kept with a warning** (redraw them with `--stale`, or
everything in the range with `--force`), so a scene tweak never silently mixes old and new drawings without you being
told.

Studio (`--serve`): space play/pause (audio via a Range-capable `audio/song.mp3` alias), ←/→ one master frame,
shift+←/→ one second, `[` `]` previous/next shot, size presets (16:9, 4:5, 9:16, half-res for speed), shot buttons.

### 3.5 Headless Chromium, WebGL2 and performance (measured 2026-10-02, 4 CPUs, 15 GB)

* **Binary:** `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell` (default). The full
  `chrome-linux/chrome` renders identically fast but phones home (component updater, google.com) and the proxy logs
  blocked connections.
* **WebGL2 works headless with no flags**: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader
  driver)`, WebGL 2.0, max texture 8192, `EXT_color_buffer_float`, `OES_texture_float_linear`, `EXT_float_blend`.
  **Do not add `--use-angle=swiftshader` / `--enable-unsafe-swiftshader`**: they move 2D canvas onto SwiftShader too and
  `toDataURL` goes from ~35 ms to ~480 ms.
* Costs at 1920×1080: a 6-octave fbm full-screen fragment pass ≈ 45 ms; WebGL→2D composite (readback) ≈ 10–30 ms;
  JPEG encode (q 0.93) 20–45 ms; 2D canvas work is deferred and shows up inside the encode.
* **Placeholder ms/frame** (`node render.mjs --probe`, single worker, warm): 2D-only worlds draw+encode **20–45 ms**;
  the WebGL corona/orbit test card **95–155 ms**; the plate-ink room **~90 ms**.
* **Throughput**: 60 fps WebGL section: 1 worker 104 ms/frame, 2 workers 74, 4 workers 70, 4 shared-browser pages 74,
  6 workers 75 (SwiftShader is already multi-threaded: 4 CPUs saturate at ~2 workers). 12 fps sections: ~3 ms/frame
  effective thanks to hold links. Full placeholder film: see 3.6.
* Disk: JPEG frames of the placeholder are 50–130 KB; painted frames will be 300–600 KB. Held frames are hard links,
  so the full 16 418-frame master needs roughly (unique drawings × frame size) ≈ 2–5 GB.

### 3.6 Proven so far

* **5-second render + encode with the song** (108–113 s, crossing the C2 cut from 12 fps BRONZE to 60 fps WebGL
  CORONA): 300 frames from 177 drawings in 9.5–11 s with 4 workers; `--encode --range=108:113` → H.264 1920×1080 60/1,
  300 frames, 5.000 s, AAC 48 kHz 5.000 s, 1.5 MB, tagged BT.709/tv. The muxed audio matches `Halys.mp3` at
  **108.000 s (0.0 ms offset, correlation 0.998)**; decoded frames match the source JPEGs within ~1 level.
* **The whole placeholder film** (with the earlier section-based edit): `--frames=0:273.7 --workers=4` → 16 418 master
  frames from 8 052 drawings (49 %: the rest are hold links) in ≈ 6 min total (7 360 drawings in 323 s = 21 ms/frame
  effective), 680 MB on disk.
* **Determinism**: 24 frames around the cut drawn independently (`--no-dedupe`, 2 workers) are byte-identical to the
  hold-linked render (3 workers), and `renderAt(t)` returns identical bytes for repeated t.
* 4:5: `--size=1080x1350` frames + encode (1080×1350 60/1); `--fps=30` lists and warns about uneven 12 fps holds.
  Studio boots without page errors and plays with audio.

---

## 4. Release encoding (`tools/encode_release.sh`)

```bash
tools/encode_release.sh                  # release/Halys_1080p60_hevc.mp4 (~94 MB) + release/Halys_720p60_h264.mp4 (~90 MB)
tools/encode_release.sh --hevc           # or --h264
tools/encode_release.sh --test=100:120   # excerpt at the full film's bitrate into video/out/release_test/, projected full size
FRAMES=video/out/frames_1080x1350 NAME=Halys_4x5 tools/encode_release.sh --hevc          # the 4:5 cut
H264_SIZE=1920x1080 H264_MB=240 tools/encode_release.sh --h264                            # an upload master (no cap)
```

* Input: the master frames (`video/out/frames`, fps and size from `render.json`) and the final mix (`AUDIO=`, default
  `Halys.mp3`). It refuses to run if any frame of the range is missing and prints the `render.mjs` command to fill it.
* **Colour:** Chromium's JPEG frames are JFIF (BT.601 matrix, full range) but players decode HD video as BT.709
  limited range. ffmpeg's automatic conversion fixes the range and not the matrix, which shifts the palette on
  playback (measured: green 0,200,80 → 0,172,77; vermilion 194,64,31 → 205,73,28). swscale's direct YUV→YUV matrix
  conversion is no cure either (≈ 3 levels too dark). Every encoder here (`render.mjs --encode/--clip`,
  `encode_release.sh`) goes through RGB with accurate rounding,
  `-vf format=rgb24,scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p`,
  and tags `-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv`: the round trip is within
  ±1 level. Keep this in any new ffmpeg command that reads the frames.
* Two-pass VBR sized for GitHub's 100 MB cap: video kbps = (target MB × 8 × 0.994 / duration) − audio kbps. For
  273.6 s: **HEVC ≈ 2 550 kbps** video + AAC 192k (x265 `slow`, aq-mode 3, keyframe ≥ every 4 s, `hvc1` tag for Apple
  players); **H.264 720p60 ≈ 2 470 kbps** + AAC 160k (x264 `slow`, High). If a full-length file still lands above
  99 MB, pass 2 is re-run once at a proportionally lower bitrate; the final size is checked against the cap.
* The song (273.624 s) ends 9 ms before the last 60 fps frame does, so audio is padded (`-af apad -shortest`): every
  frame is kept and x264's two passes see the same frame count. The script body runs inside `main`, so editing the
  file while an encode runs is safe (bash otherwise keeps reading a running script by byte offset).
* Why two-pass and not CRF: 12 fps painted sections (each drawing held 5 frames) are nearly free, the 60 fps light
  sections are expensive; a size target moves the bits to the drops. Expect the drops (≈ 82 s of 60 fps drawing) to be
  the quality bottleneck at ~2.5 Mbit/s; if they break up, raise `HEVC_MB` only for an off-repo file, or simplify the
  60 fps material (flat blacks and clean field lines compress well, film grain does not).
* **Verified on the full 4:34 film** (the placeholder render, all 16 418 frames; `OUT=video/out/release_test`):
  **`Halys_1080p60_hevc.mp4` 92.2 MB** (HEVC Main, `hvc1`, 1920×1080 60/1, 2.49 Mbit/s video, AAC-LC 48 kHz 192k,
  BT.709/tv, 273.63 s) and **`Halys_720p60_h264.mp4` 87.7 MB** (H.264 High 1280×720 60/1, AAC 160k); no refit was
  needed; audio offset 0.0 ms at 30 s, 150 s and 260 s. Wall time **43 min** for both (x265 two-pass ≈ 30 min, x264
  ≈ 13 min, preset slow, 4 CPUs). Real painted frames are busier than the placeholder, so expect the same sizes (the
  rate control holds them) at visibly lower quality in the 60 fps drops, and somewhat longer encodes.
* Short excerpts overshoot (a 20 s `--test` projected 97.7 MB at a 95 MB target and 98.1 MB at 92 MB), so read `--test`
  projections as a pessimistic bound; the full-length encode is what lands on target.
