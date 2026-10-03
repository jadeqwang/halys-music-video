"""Neural beat + downbeat activations (madmom RNNs) and a DBN beat track, for analyze.py.

usage:  python tools/audio/madmom_beats.py
writes: media/stems/analysis/madmom.npz  (beat_act/down_act for mix + instrumental at 100 fps, DBN beats)

madmom is not on PyPI for Python 3.11 / numpy 2, and its pip build fails on this box (setuptools
"install_layout"). It builds fine in place from GitHub (models are a git submodule):
    git clone --depth 1 --recurse-submodules https://github.com/CPJKU/madmom.git $SCRATCH/madmom
    cd $SCRATCH/madmom && python3 setup.py build_ext --inplace && pip install mido cython
    # madmom/__init__.py: wrap  __version__ = distribution("madmom").version  in try/except
    PYTHONPATH=$SCRATCH/madmom python3 tools/audio/madmom_beats.py
Why: the first grid (librosa DP beat tracker + spline) squeezed an extra beat into chorus 1, the final chorus
and the intro swell (local "tempo" 146 BPM). madmom's RNN+DBN keeps the true steady pulse there; its beats
land on more onsets (lead-vocal onset score 0.198 vs 0.144 in chorus 1) and its bar phase then runs straight
from verse 1 into Drop 1 (see production/AUDIO_MAP.md, "Beat grid").
"""
import pathlib

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
ST = ROOT / "media" / "stems"
OUT = ST / "analysis" / "madmom.npz"


def main():
    from madmom.features.beats import DBNBeatTrackingProcessor, RNNBeatProcessor
    from madmom.features.downbeats import RNNDownBeatProcessor
    res = {}
    for name in ("mix", "instrumental"):
        wav = str(ST / f"{name}.wav")
        res[f"down_act_{name}"] = RNNDownBeatProcessor()(wav)      # (n, 2): beat, downbeat activations
        res[f"beat_act_{name}"] = RNNBeatProcessor()(wav)
        print(f"[madmom] {name} done", flush=True)
    res["beats"] = DBNBeatTrackingProcessor(min_bpm=120, max_bpm=160, fps=100, transition_lambda=100)(res["beat_act_mix"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(OUT, **res)
    print(f"[madmom] {len(res['beats'])} beats -> {OUT}")


if __name__ == "__main__":
    main()
