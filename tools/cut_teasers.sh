#!/usr/bin/env bash
# Cut the social teasers from the rendered master frames + the sound-design master. Each window starts and ends on a
# cut (frame numbers from `node render.mjs --list`), so the loop X plays is cut to cut:
#
#   T1 the eye                  0.000- 10.700 s  frames     0-641    cold open, "THE SUN WENT OUT", the title card
#   T2 the switch             101.617-124.483 s  frames  6097-7468   the arm-pull, the drop, 8 bars of Drop 1
#   T3 throw down your blade  208.700-228.883 s  frames 12522-13732  the river of blades, 8 bars of Drop 2
#
#   tools/cut_teasers.sh          16:9 from video/out/frames
#   tools/cut_teasers.sh --4x5    4:5 from video/out/frames_1080x1350, rendered with
#                                 node render.mjs --frames=0:10.7 --size=1080x1350   (and 101.6167:124.4834, 208.7:228.8834)
#
# H.264 High, 60 fps, CRF 20, AAC 192k, faststart: within X's upload limits (1920x1200, 60 fps, 2:20). Colour goes
# through RGB to BT.709 limited range like tools/encode_release.sh (the JPEG frames are full-range BT.601).
# The audio gets a 20 ms fade-in and a 250 ms fade-out so the loop point does not click.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AUDIO="${AUDIO:-$ROOT/media/stems/halys_sd_master.wav}"
[ -f "$AUDIO" ] || AUDIO="$ROOT/release/Halys_sound_design.mp3"
FRAMES="$ROOT/video/out/frames"; TAG=16x9
case "${1:-}" in
  --4x5) FRAMES="$ROOT/video/out/frames_1080x1350"; TAG=4x5 ;;
  "") ;;
  *) echo "usage: $0 [--4x5]" >&2; exit 2 ;;
esac
OUT="$ROOT/release/teasers"; mkdir -p "$OUT"

cut() {   # name first_frame last_frame
  local name=$1 a=$2 b=$3 n=$(($3 - $2 + 1)) i ss d fo
  for ((i = a; i <= b; i++)); do [ -s "$(printf '%s/f%05d.jpg' "$FRAMES" "$i")" ] || { echo "missing frame $i in $FRAMES" >&2; exit 1; }; done
  ss=$(python3 -c "print(f'{$a / 60:.6f}')"); d=$(python3 -c "print(f'{$n / 60:.6f}')"); fo=$(python3 -c "print(f'{$n / 60 - .25:.6f}')")
  ffmpeg -hide_banner -loglevel error -y -framerate 60 -start_number "$a" -i "$FRAMES/f%05d.jpg" -ss "$ss" -t "$d" -i "$AUDIO" \
    -map 0:v -map 1:a -frames:v "$n" \
    -vf format=rgb24,scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p \
    -c:v libx264 -preset slow -crf 20 -profile:v high -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -af "afade=t=in:d=0.02,afade=t=out:st=$fo:d=0.25" -c:a aac -b:a 192k -ar 48000 -movflags +faststart \
    "$OUT/Halys_${name}_${TAG}.mp4"
  echo "  $OUT/Halys_${name}_${TAG}.mp4  $(stat -c %s "$OUT/Halys_${name}_${TAG}.mp4" | awk '{printf "%.1f MB", $1 / 1e6}')  $n frames = $d s"
}

cut T1_the_eye 0 641
cut T2_the_switch 6097 7468
cut T3_throw_down_your_blade 12522 13732
