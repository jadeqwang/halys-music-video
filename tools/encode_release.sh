#!/usr/bin/env bash
# Encode the rendered master frames (video/out/frames, 60 fps, f%05d.jpg numbered by master frame) + the song
# into the release files, two-pass, sized to stay under GitHub's 100 MB per-file limit:
#
#   release/Halys_1080p60_hevc.mp4    HEVC Main (hvc1) 1920x1080 60 fps, AAC 192k   ~94 MB   best quality under the cap
#   release/Halys_720p60_h264.mp4     H.264 High 1280x720 60 fps, AAC 160k          ~90 MB   plays and uploads anywhere
#
#   tools/encode_release.sh                     both files
#   tools/encode_release.sh --hevc | --h264     one of them
#   tools/encode_release.sh --test=108:128      encode only that excerpt (seconds) at the bitrate the full film gets,
#                                               into video/out/release_test/, and print the projected full-length size
# Environment overrides:
#   FRAMES=video/out/frames   AUDIO=Halys.mp3 (the final mix)   PRESET=slow (x265/x264 preset)
#   HEVC_MB=94  H264_MB=90 (targets, MB = 10^6 bytes; a full-length file that still lands above 99 MB gets pass 2
#   re-run once at a proportionally lower bitrate)   H264_SIZE=1280x720 (e.g. 1920x1080 with H264_MB=240 for an
#   upload master that does not need to fit the cap)   OUT=release   NAME=Halys
# A 4:5 cut: FRAMES=video/out/frames_1080x1350 NAME=Halys_4x5 tools/encode_release.sh --hevc (sizes follow render.json).
#
# Why two-pass VBR: the film mixes 12 fps painted sections (each drawing held for 5 master frames: almost free to
# encode) with 60 fps light sections (every frame new, expensive). A size-targeted two-pass encode moves bits to
# where the picture changes; a CRF encode cannot promise the 100 MB cap.
set -euo pipefail

# video kbps for a target size over the FULL film (MB = 1e6 bytes), minus audio and ~0.6 % container overhead
bits() { python3 -c "print(int(($1 * 8e6 * 0.994 / $DUR - $2 * 1e3) / 1e3))"; }

report() {   # file, cap MB: print what was made (projected to full length for excerpts); fail above the cap
  local f="$1" sz; sz=$(stat -c %s "$f")
  python3 - "$f" "$sz" "$2" "$DUR" "$SECS" <<'PY'
import sys, subprocess, json
f, sz, cap, dur, secs = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5])
d = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,profile,width,height,r_frame_rate,nb_frames:format=duration",
                               "-of", "json", f], capture_output=True, text=True).stdout)
v = [s for s in d["streams"] if s.get("width")][0]
proj = sz * dur / secs
print(f"  {f}: {sz / 1e6:.1f} MB, {v['codec_name']} {v.get('profile')} {v['width']}x{v['height']} {v['r_frame_rate']} {v.get('nb_frames')} frames, "
      f"{float(d['format']['duration']):.2f} s" + (f"; projected full film {proj / 1e6:.1f} MB" if secs < dur - 0.1 else ""))
if proj > cap * 1e6:
    print(f"  WARNING: {'projected ' if secs < dur - 0.1 else ''}size {proj / 1e6:.1f} MB exceeds the {cap:.0f} MB cap"); sys.exit(3)
PY
}

# refit FILE KBPS LIMIT_MB: for a full-length encode above LIMIT_MB, print a proportionally lower video bitrate
# (3 % margin) and succeed; otherwise fail (nothing to do). Excerpts (--test) are only projected, never refit.
refit() {
  [ -z "$TEST" ] || return 1
  python3 - "$(stat -c %s "$1")" "$2" "$3" <<'PY'
import sys
size, vb, lim = int(sys.argv[1]), int(sys.argv[2]), float(sys.argv[3])
if size <= lim * 1e6: sys.exit(1)
print(int(vb * 0.97 * lim * 1e6 / size))
PY
}

main() {   # (everything runs inside main, so bash has parsed the whole script before it starts: safe to edit while running)
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  FRAMES="${FRAMES:-$ROOT/video/out/frames}"; FRAMES="$(cd "$FRAMES" && pwd)"
  AUDIO="${AUDIO:-$ROOT/Halys.mp3}"
  NAME="${NAME:-Halys}"; PRESET="${PRESET:-slow}"
  HEVC_MB="${HEVC_MB:-94}"; H264_MB="${H264_MB:-90}"; H264_SIZE="${H264_SIZE:-1280x720}"
  DO_HEVC=1; DO_H264=1; TEST=""
  for a in "$@"; do
    case "$a" in
      --hevc) DO_H264=0 ;; --h264) DO_HEVC=0 ;; --test=*) TEST="${a#--test=}" ;;
      -h|--help) sed -n '2,21p' "$0"; return 0 ;;
      *) echo "unknown option $a" >&2; return 2 ;;
    esac
  done
  [ -f "$AUDIO" ] || { echo "no audio at $AUDIO" >&2; return 1; }
  read -r FPS W H < <(python3 -c "import json,sys; m=json.load(open(sys.argv[1])); print(m['fps'], m['w'], m['h'])" "$FRAMES/render.json" 2>/dev/null || echo "60 1920 1080")
  DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$AUDIO")
  local NFULL A B SUFFIX N MISSING VB VB2 F X265 HW HH CAP   # (TMP stays global: the EXIT trap needs it)
  NFULL=$(python3 -c "import math; print(math.ceil($DUR * $FPS - 1e-6))")
  # frame range: the whole film, or the --test excerpt (test files go to the gitignored video/out/, never release/)
  if [ -n "$TEST" ]; then
    A=$(python3 -c "print(round(${TEST%%:*} * $FPS))"); B=$(python3 -c "print(min(round(${TEST##*:} * $FPS), $NFULL) - 1)")
    OUT="${OUT:-$ROOT/video/out/release_test}"; SUFFIX="_test_${TEST/:/-}s"
  else
    A=0; B=$((NFULL - 1)); SUFFIX=""; OUT="${OUT:-$ROOT/release}"
  fi
  N=$((B - A + 1)); T0=$(python3 -c "print($A / $FPS)"); SECS=$(python3 -c "print($N / $FPS)")
  MISSING=$(python3 - "$FRAMES" "$A" "$B" <<'PY'
import os, sys
d, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
miss = [i for i in range(a, b + 1) if not os.path.exists(f"{d}/f{i:05d}.jpg")]
print(f"{len(miss)} (first: {miss[:5]})" if miss else "0")
PY
)
  if [ "$MISSING" != "0" ]; then
    echo "$FRAMES: $MISSING frames missing in f$(printf %05d "$A")..f$(printf %05d "$B"); render them first:" >&2
    echo "  cd video && node render.mjs --frames=$T0:$(python3 -c "print(($B + 1) / $FPS)") --workers=4" >&2
    return 1
  fi
  mkdir -p "$OUT"
  TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
  IN=(-framerate "$FPS" -start_number "$A" -i "$FRAMES/f%05d.jpg")
  AIN=(-ss "$T0" -t "$SECS" -i "$AUDIO")
  GOP=$((FPS * 4))          # a keyframe at least every 4 s (seeking, streaming)
  # Chromium's JPEG frames are JFIF (BT.601 matrix, full range); players decode HD as BT.709 limited range. Convert the
  # matrix explicitly (ffmpeg's automatic conversion only fixes the range: greens/reds would shift) and tag the result.
  # Via RGB with accurate rounding: round trip within +-1 level (swscale's direct YUV->YUV matrix path runs ~3 levels dark).
  TO709="out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int"
  TAG709=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
  echo "frames f$(printf %05d "$A")..f$(printf %05d "$B") ($N at $FPS fps = ${SECS}s of ${DUR}s) ${W}x${H}, audio $(basename "$AUDIO")"

  if [ "$DO_HEVC" = 1 ]; then
    VB=$(bits "$HEVC_MB" 192)
    F="$OUT/${NAME}_$([ "$W$H" = 19201080 ] && echo "1080p$FPS" || echo "${W}x${H}_$FPS")_hevc$SUFFIX.mp4"
    X265="aq-mode=3:keyint=$GOP:min-keyint=$FPS:log-level=error"
    VF=(-vf "format=rgb24,scale=$TO709,format=yuv420p")
    echo "HEVC ${W}x${H}: ${VB} kbps video (target ${HEVC_MB} MB for the full film), preset $PRESET"
    ffmpeg -y -hide_banner -loglevel error -stats "${IN[@]}" -frames:v "$N" -an "${VF[@]}" -c:v libx265 -preset "$PRESET" -b:v "${VB}k" \
      -x265-params "pass=1:stats=$TMP/x265.log:$X265" -f null /dev/null
    hevc2() { ffmpeg -y -hide_banner -loglevel error -stats "${IN[@]}" "${AIN[@]}" -map 0:v:0 -map 1:a:0 -frames:v "$N" "${VF[@]}" \
      -c:v libx265 -preset "$PRESET" -b:v "${1}k" -x265-params "pass=2:stats=$TMP/x265.log:$X265" -tag:v hvc1 \
      "${TAG709[@]}" -c:a aac -b:a 192k -movflags +faststart -shortest "$F"; }
    hevc2 "$VB"
    if VB2=$(refit "$F" "$VB" 99); then echo "  $(stat -c %s "$F") bytes > 99 MB: pass 2 again at ${VB2} kbps"; hevc2 "$VB2"; fi
    report "$F" 100
  fi

  if [ "$DO_H264" = 1 ]; then
    VB=$(bits "$H264_MB" 160)
    HW="${H264_SIZE%x*}"; HH="${H264_SIZE#*x}"
    F="$OUT/${NAME}_$([ "$HW$HH" = 1280720 ] && echo "720p$FPS" || echo "${HW}x${HH}_$FPS")_h264$SUFFIX.mp4"
    if [ "$HW$HH" != "$W$H" ]; then VF=(-vf "format=rgb24,scale=$HW:$HH:$TO709+lanczos,format=yuv420p"); else VF=(-vf "format=rgb24,scale=$TO709,format=yuv420p"); fi
    echo "H.264 ${HW}x${HH}: ${VB} kbps video (target ${H264_MB} MB for the full film), preset $PRESET"
    ffmpeg -y -hide_banner -loglevel error -stats "${IN[@]}" -frames:v "$N" -an "${VF[@]}" -c:v libx264 -preset "$PRESET" -profile:v high \
      -b:v "${VB}k" -g "$GOP" -pass 1 -passlogfile "$TMP/x264" -f null /dev/null
    h2642() { ffmpeg -y -hide_banner -loglevel error -stats "${IN[@]}" "${AIN[@]}" -map 0:v:0 -map 1:a:0 -frames:v "$N" "${VF[@]}" \
      -c:v libx264 -preset "$PRESET" -profile:v high -b:v "${1}k" -g "$GOP" -pass 2 -passlogfile "$TMP/x264" \
      "${TAG709[@]}" -c:a aac -b:a 160k -movflags +faststart -shortest "$F"; }
    h2642 "$VB"
    # the cap applies to files meant for the repo; an explicitly bigger H264_MB is an upload master
    CAP=$(python3 -c "print(max(100, $H264_MB * 1.05))")
    if VB2=$(refit "$F" "$VB" "$(python3 -c "print($CAP - 1)")"); then echo "  over the cap: pass 2 again at ${VB2} kbps"; h2642 "$VB2"; fi
    report "$F" "$CAP"
  fi
  ls -la "$OUT"
}

main "$@"; exit $?
