#!/usr/bin/env bash
# Run a heavy command under a machine-wide lock, so parallel agents do not overload this 4-core / 15 GB box
# (a Chromium render page can reach ~3 GB; the plate pipeline's depth and matte models a few GB more):
#
#   tools/slot.sh CMD...              one of 2 render slots: node render.mjs --sheet/--stills/--clip, ffmpeg, encodes
#   tools/slot.sh --pipeline CMD...   the single plate-pipeline slot: tools/pipeline.sh, tools/extract_plates.py
#
# Waits for a free slot (no polling), then runs CMD at nice 10 and exits with its status.
set -uo pipefail
D=/tmp/halys-locks; mkdir -p "$D"
if [ "${1:-}" = "--pipeline" ]; then shift; exec flock "$D/pipeline" nice -n 10 "$@"; fi
[ $# -gt 0 ] || { sed -n '2,9p' "$0"; exit 2; }
while :; do
  for s in 1 2; do
    flock -n -E 75 "$D/render$s" nice -n 10 "$@"; rc=$?
    [ "$rc" -ne 75 ] && exit "$rc"
  done
  flock -w 20 "$D/render1" true 2>/dev/null   # block until slot 1 frees (or 20 s), then try both again
done
