"""Local composite fixes (no generation): paste regions of an earlier take into a later edit of the same frame
(e.g. lettering that an edit pass garbled). Alignment is checked by phase correlation; the paste is feathered.

    python3 media/boards/_scripts/patch.py SRC_RAW DST_RAW OUT_NAME FOLDER x0,y0,x1,y1 [x0,y0,x1,y1 ...]
    (boxes as fractions of the frame; OUT_NAME gets a manifest row with model "composite")
"""
import json, pathlib, sys, time
import numpy as np
import cv2
from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import boards  # noqa: E402


def patch(src, dst, boxes, feather=12):
    a = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    b = np.asarray(Image.open(dst).convert("RGB")).astype(np.float32)
    H, W = b.shape[:2]
    out = b.copy()
    report = []
    for (x0, y0, x1, y1) in boxes:
        X0, Y0, X1, Y1 = int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)
        pad = 40
        ga = cv2.cvtColor(a[max(0, Y0 - pad):Y1 + pad, max(0, X0 - pad):X1 + pad].astype(np.uint8), cv2.COLOR_RGB2GRAY)
        gb = cv2.cvtColor(b[max(0, Y0 - pad):Y1 + pad, max(0, X0 - pad):X1 + pad].astype(np.uint8), cv2.COLOR_RGB2GRAY)
        (dx, dy), resp = cv2.phaseCorrelate(np.float32(ga), np.float32(gb))
        M = np.float32([[1, 0, dx], [0, 1, dy]])
        shifted = cv2.warpAffine(a, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        mask = np.zeros((H, W), np.float32)
        mask[Y0:Y1, X0:X1] = 1
        mask = cv2.GaussianBlur(mask, (0, 0), feather)[..., None]
        out = out * (1 - mask) + shifted * mask
        report.append({"box": [x0, y0, x1, y1], "shift_px": [round(dx, 2), round(dy, 2)], "response": round(resp, 3)})
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)), report


def main(argv):
    src, dst, name, folder = argv[:4]
    boxes = [tuple(float(v) for v in s.split(",")) for s in argv[4:]]
    im, rep = patch(src, dst, boxes)
    raw = boards.RAW / f"{name}.png"
    im.save(raw)
    out = boards.BOARDS / folder / f"{name}.jpg"
    size, kb, q = boards.finish_jpg(raw, out)
    m = {"job": name.rsplit("_t", 1)[0], "take": 1, "name": name, "file": str(out.relative_to(boards.ROOT)), "folder": folder,
         "model": "composite", "prompt": f"Local composite (no generation): regions {boxes} of {pathlib.Path(src).name} "
         f"pasted into {pathlib.Path(dst).name} with phase-correlation alignment {rep}",
         "refs": [], "ref_files": [str(src), str(dst)], "raw": str(raw), "raw_size": list(im.size), "size": list(size),
         "kb": kb, "secs": 0, "est_cost_usd": 0.0, "t": time.strftime("%Y-%m-%dT%H:%M:%S"), "cf_job": None, "params": {}}
    with open(boards.MANIFEST, "a") as f:
        f.write(json.dumps(m) + "\n")
    print(json.dumps(rep), "->", out, size, kb, "KB")


if __name__ == "__main__":
    main(sys.argv[1:])
