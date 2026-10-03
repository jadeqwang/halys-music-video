#!/usr/bin/env bash
# Refresh everything the renderer derives from the plates, after new takes arrive.
#   tools/pipeline.sh [ids...]              frames -> meta (faces, light, cuts, exposure gain) -> fields (ink/tone/orientation/flow)
#   tools/pipeline.sh --mattes [ids...]     ... + subject mattes (rembg isnet-anime; ~0.7 s/matte, on twos)
#   tools/pipeline.sh --depth [ids...]      ... + monocular depth (Depth Anything V2 S; ~1.3 s/frame, on twos)
#   tools/pipeline.sh --all [ids...]        everything
# Without ids: every plate in media/plates/ (latest take) plus every already-extracted plate in video/plates/.
# Steps skip work that is already up to date. Order matters: plate_meta writes stats.json (exposure gain),
# which plate_fields reads, so meta runs before fields. A failing step stops the script (set -e).
set -euo pipefail
cd "$(dirname "$0")/.."
MATTES=0; DEPTH=0; IDS=()
for a in "$@"; do
  case "$a" in
    --mattes) MATTES=1 ;; --depth) DEPTH=1 ;; --all) MATTES=1; DEPTH=1 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) IDS+=("$a") ;;
  esac
done
step() { local t0=$SECONDS; echo "== $1"; shift; "$@"; echo "   ($((SECONDS - t0)) s)"; }
# MediaPipe/TFLite chatter goes to stderr; drop it without hiding real errors or the exit status
quiet() { "$@" 2> >(grep -vE '^(W0000|I0000)|inference_feedback|^WARNING: Logging before InitGoogle|^INFO: Created TensorFlow Lite|^$' >&2); }

step "extract frames" python3 tools/extract_plates.py "${IDS[@]}"
step "meta (faces, light, cuts, gain)" quiet python3 tools/plate_meta.py "${IDS[@]}"
step "fields (ink, tone, orientation, flow)" python3 tools/plate_fields.py "${IDS[@]}"
if [ "$MATTES" = 1 ]; then step "mattes (rembg)" python3 tools/plate_masks.py "${IDS[@]}"; fi
if [ "$DEPTH" = 1 ]; then step "depth (Depth Anything V2 S)" python3 tools/plate_depth.py "${IDS[@]}"; fi
python3 tools/extract_plates.py --index-only >/dev/null
python3 - <<'PY'
import json
idx = json.load(open('video/plates/index.json'))
for k, v in idx.items():
    print(f"{k:24s} frames={v.get('n')} fields={v.get('fields')} mattes={v.get('mattes')} depth={v.get('depth')} take={v.get('take')}")
PY
