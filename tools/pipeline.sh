#!/usr/bin/env bash
# Refresh everything the renderer derives from the plates, after new takes arrive.
#   tools/pipeline.sh [ids...]              frames -> meta (faces, light, cuts) -> fields (ink/tone/orientation/flow)
#   tools/pipeline.sh --mattes [ids...]     ... + subject mattes (rembg isnet-anime; ~0.7 s/matte, on twos)
#   tools/pipeline.sh --depth [ids...]      ... + monocular depth (Depth Anything V2 S; ~1.3 s/frame, on twos)
#   tools/pipeline.sh --all [ids...]        everything
# Without ids: every plate in media/plates/ (latest take). Steps skip work that is already up to date.
set -euo pipefail
cd "$(dirname "$0")/.."
MATTES=0; DEPTH=0; IDS=()
for a in "$@"; do
  case "$a" in
    --mattes) MATTES=1 ;; --depth) DEPTH=1 ;; --all) MATTES=1; DEPTH=1 ;;
    *) IDS+=("$a") ;;
  esac
done
python3 tools/extract_plates.py "${IDS[@]}"
python3 tools/plate_meta.py "${IDS[@]}" 2>&1 | grep -vE '^(W0000|I0000)|inference_feedback|^$' || true
python3 tools/plate_fields.py "${IDS[@]}"
[ "$MATTES" = 1 ] && python3 tools/plate_masks.py "${IDS[@]}"
[ "$DEPTH" = 1 ] && python3 tools/plate_depth.py "${IDS[@]}"
python3 tools/extract_plates.py --index-only >/dev/null 2>&1 || true
python3 - <<'PY'
import json
idx = json.load(open('video/plates/index.json'))
for k, v in idx.items():
    print(f"{k:24s} frames={v.get('n')} fields={v.get('fields')} mattes={v.get('mattes')} depth={v.get('depth')} take={v.get('take')}")
PY
