#!/usr/bin/env bash
# Review MP4s for Drop 2 from rendered frames (video/out/frames_drop2, 1920x1080@60) + the final mix, downscaled to fit
# the review budget (each MP4 <= 25 MB).
#   bash production/review/drop2/encode_review.sh 213 235 drop2_r1_213-235 [crf] [height]
set -euo pipefail
cd "$(dirname "$0")/../../../video"
T0=$1; T1=$2; NAME=$3; CRF=${4:-25}; HGT=${5:-720}
FR=out/frames_drop2
SONG=../media/stems/halys_sd_master.wav; [ -f "$SONG" ] || SONG=../release/Halys_sound_design.mp3; [ -f "$SONG" ] || SONG=../Halys.mp3
A=$(python3 -c "import math;print(math.ceil($T0*60-1e-6))"); B=$(python3 -c "import math;print(math.ceil($T1*60-1e-6))")
N=$((B-A))
OUT=../production/review/drop2/$NAME.mp4
nice -n 10 ffmpeg -y -hide_banner -loglevel error -framerate 60 -start_number $A -i $FR/f%05d.jpg -ss $(python3 -c "print($A/60)") -t $(python3 -c "print($N/60)") -i "$SONG" \
  -map 0:v:0 -map 1:a:0 -frames:v $N -vf "format=rgb24,scale=-2:$HGT:flags=lanczos,scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p" -c:v libx264 -preset slow -crf $CRF -tune film -threads 2 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a aac -b:a 160k -movflags +faststart -shortest "$OUT"
ls -la "$OUT"
