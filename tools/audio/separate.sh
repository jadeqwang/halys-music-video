#!/usr/bin/env bash
# Stems for the timing analysis. media/stems/ is gitignored; this script regenerates it.
#
#   mix.wav                    Halys.mp3 decoded (sample 0 = t 0.000 s; the MP3's 23 ms encoder delay is skipped)
#   vocals.wav / instrumental.wav   BS-Roformer Viperx-1297 (falls back to MDX-Net Kim_Vocal_2 if the Roformer pass is skipped)
#   vocals_lead.wav / vocals_backing.wav   UVR_MDXNET_KARA_2 run on the vocal stem (lead vs doubled/choir voices)
#   sep/                       raw model outputs, _models/ the downloaded checkpoints (GitHub release mirrors)
#
# needs: pip install "audio-separator[cpu]" (pulls torch; download.pytorch.org is blocked here, PyPI works)
# CPU timings on this 4-core box: MDX 6 min, KARA 3 min, Roformer (overlap 2) ~60 min.
set -euo pipefail
cd "$(dirname "$0")/../.."
S=media/stems; M=$S/_models
mkdir -p $S/sep $M
SEP="audio-separator --model_file_dir $M --output_dir $S/sep --output_format WAV --sample_rate 48000"

[ -f $S/mix.wav ] || ffmpeg -hide_banner -loglevel error -y -i Halys.mp3 -c:a pcm_s16le $S/mix.wav

# 1. MDX-Net vocal model (fast, good)
[ -f $S/sep/kimvoc2_vocals.wav ] || $SEP $S/mix.wav -m Kim_Vocal_2.onnx --mdx_overlap 0.5 \
  --custom_output_names '{"Vocals": "kimvoc2_vocals", "Instrumental": "kimvoc2_instrumental"}'

# 2. BS-Roformer (best public vocal model; slow on CPU). SKIP_ROFORMER=1 to skip.
if [ "${SKIP_ROFORMER:-0}" != 1 ] && [ ! -f $S/sep/bsrof_vocals.wav ]; then
  $SEP $S/mix.wav -m model_bs_roformer_ep_317_sdr_12.9755.ckpt --mdxc_overlap 2 \
    --custom_output_names '{"Vocals": "bsrof_vocals", "Instrumental": "bsrof_instrumental"}'
fi
if [ -f $S/sep/bsrof_vocals.wav ]; then V=bsrof; else V=kimvoc2; fi
cp $S/sep/${V}_vocals.wav $S/vocals.wav
cp $S/sep/${V}_instrumental.wav $S/instrumental.wav

# 3. lead vs backing (karaoke model) on the chosen vocal stem
[ -f $S/sep/kara_lead_from_${V}.wav ] || $SEP $S/vocals.wav -m UVR_MDXNET_KARA_2.onnx \
  --custom_output_names "{\"Vocals\": \"kara_lead_from_${V}\", \"Instrumental\": \"kara_backing_from_${V}\"}"
cp $S/sep/kara_lead_from_${V}.wav $S/vocals_lead.wav
cp $S/sep/kara_backing_from_${V}.wav $S/vocals_backing.wav
echo "stems from: $V"
