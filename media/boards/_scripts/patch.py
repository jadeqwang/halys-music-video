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


def patch(src, dst, boxes, feather=6):
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


def mirror(src_raw, name, folder, note):
    """Horizontally mirror a whole sheet (all views stay mutually consistent); manifest row with model 'composite'."""
    im = Image.open(src_raw).convert("RGB").transpose(Image.FLIP_LEFT_RIGHT)
    raw = boards.RAW / f"{name}.png"
    im.save(raw)
    out = boards.BOARDS / folder / f"{name}.jpg"
    size, kb, q = boards.finish_jpg(raw, out)
    m = {"job": name.rsplit("_t", 1)[0], "take": 1, "name": name, "file": str(out.relative_to(boards.ROOT)), "folder": folder,
         "model": "composite", "prompt": f"Horizontal mirror (no generation) of {pathlib.Path(src_raw).name}: {note}",
         "refs": [], "ref_files": [str(src_raw)], "raw": str(raw), "raw_size": list(im.size), "size": list(size),
         "kb": kb, "secs": 0, "est_cost_usd": 0.0, "t": time.strftime("%Y-%m-%dT%H:%M:%S"), "cf_job": None, "params": {}}
    with open(boards.MANIFEST, "a") as f:
        f.write(json.dumps(m) + "\n")
    print("mirror ->", out, size, kb, "KB")


def move_point(src_raw, name, folder, old_xy, new_xy, r=7, note=""):
    """Move a small bright point (a planet) on a smooth sky: inpaint it at old_xy, add its glow profile at new_xy."""
    a = np.asarray(Image.open(src_raw).convert("RGB")).astype(np.float32)
    H, W = a.shape[:2]
    ox, oy = old_xy
    mask = np.zeros((H, W), np.uint8)
    cv2.circle(mask, (int(round(ox)), int(round(oy))), r, 255, -1)
    base = cv2.inpaint(a.astype(np.uint8), mask, 5, cv2.INPAINT_TELEA).astype(np.float32)
    x0, y0 = int(round(ox)) - r - 2, int(round(oy)) - r - 2
    k = 2 * r + 5
    dot = np.clip(a[y0:y0 + k, x0:x0 + k] - base[y0:y0 + k, x0:x0 + k], 0, 255)
    nx, ny = int(round(new_xy[0])) - r - 2, int(round(new_xy[1])) - r - 2
    out = base.copy()
    out[ny:ny + k, nx:nx + k] = np.clip(out[ny:ny + k, nx:nx + k] + dot, 0, 255)
    im = Image.fromarray(out.astype(np.uint8))
    raw = boards.RAW / f"{name}.png"
    im.save(raw)
    dst = boards.BOARDS / folder / f"{name}.jpg"
    size, kb, q = boards.finish_jpg(raw, dst)
    m = {"job": name.rsplit("_t", 1)[0], "take": 1, "name": name, "file": str(dst.relative_to(boards.ROOT)), "folder": folder,
         "model": "composite", "prompt": f"Local composite (no generation) of {pathlib.Path(src_raw).name}: planet point moved "
         f"from {tuple(round(v) for v in old_xy)} to {tuple(round(v) for v in new_xy)} px. {note}",
         "refs": [], "ref_files": [str(src_raw)], "raw": str(raw), "raw_size": list(im.size), "size": list(size),
         "kb": kb, "secs": 0, "est_cost_usd": 0.0, "t": time.strftime("%Y-%m-%dT%H:%M:%S"), "cf_job": None, "params": {}}
    with open(boards.MANIFEST, "a") as f:
        f.write(json.dumps(m) + "\n")
    print("moved point ->", dst, size, kb, "KB")
    return dst


def tilt_up(src_raw, dst_raw, shift):
    """Reframe as a small camera tilt-up: shift the frame down by `shift` px, fill the new top band by mirroring the
    (near-uniform) top sky and median-filtering out its point stars; the bottom `shift` px of foreground are cropped."""
    a = np.asarray(Image.open(src_raw).convert("RGB"))
    H = a.shape[0]
    band = np.flipud(a[:shift]).copy()
    band = cv2.medianBlur(band, 5)
    out = np.vstack([band, a[:H - shift]])
    seam = np.linspace(0, 1, 12)[:, None, None]
    out[shift - 6:shift + 6] = (out[shift - 6:shift + 6] * seam + cv2.medianBlur(out[shift - 6:shift + 6].copy(), 5) * (1 - seam)).astype(np.uint8)
    Image.fromarray(out).save(dst_raw)
    return dst_raw


def rotate_crescent(src_raw, name, folder, centre, radius, comp_box, angle_deg, note=""):
    """Rotate a painted sun crescent about the disc centre without touching the clouds: fit a smooth quadratic sky
    around the disc (crescent excluded), take the crescent (+ its halo) as an additive layer above that sky, remove it
    and add it back rotated by angle_deg (positive = clockwise on screen)."""
    a = np.asarray(Image.open(src_raw).convert("RGB")).astype(np.float32)
    H, W = a.shape[:2]
    cx, cy = centre
    R = int(radius * 2.2)
    x0, y0, x1, y1 = int(cx - R), int(cy - R), int(cx + R), int(cy + R)
    reg = a[y0:y1, x0:x1]
    g = reg.mean(axis=2)
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    rr = np.hypot(xx - cx, yy - cy)
    # crescent mask: bright vs a heavy blur, within the disc radius + 3 px
    d = g - cv2.GaussianBlur(g, (0, 0), 18)
    m = ((d > 12) & (rr < radius + 3)).astype(np.uint8)
    m = cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=2)
    soft = cv2.GaussianBlur(cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=4).astype(np.float32), (0, 0), 3)
    soft = np.clip(soft * 1.4, 0, 1)
    # quadratic sky fit per channel on pixels outside the dilated crescent and inside the patch
    fitmask = (soft < 0.02) & (rr < R)
    X = np.stack([np.ones_like(xx), xx - cx, yy - cy, (xx - cx) ** 2, (xx - cx) * (yy - cy), (yy - cy) ** 2], -1)
    B = np.zeros_like(reg)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(X[fitmask], reg[..., c][fitmask], rcond=None)
        B[..., c] = X @ coef
    L = np.clip(reg - B, 0, None) * soft[..., None]
    M = cv2.getRotationMatrix2D((cx - x0, cy - y0), -angle_deg, 1.0)
    Lr = cv2.warpAffine(L, M, (x1 - x0, y1 - y0), flags=cv2.INTER_CUBIC, borderValue=0)
    out = a.copy()
    out[y0:y1, x0:x1] = np.clip(reg - L + Lr, 0, 255)
    im = Image.fromarray(out.astype(np.uint8))
    raw = boards.RAW / f"{name}.png"
    im.save(raw)
    dst = boards.BOARDS / folder / f"{name}.jpg"
    size, kb, q = boards.finish_jpg(raw, dst)
    m_ = {"job": name.rsplit("_t", 1)[0], "take": 1, "name": name, "file": str(dst.relative_to(boards.ROOT)), "folder": folder,
          "model": "composite", "prompt": f"Local composite (no generation) of {pathlib.Path(src_raw).name}: sun crescent "
          f"rotated {angle_deg} deg clockwise about the disc centre {tuple(round(v) for v in centre)}. {note}",
          "refs": [], "ref_files": [str(src_raw)], "raw": str(raw), "raw_size": list(im.size), "size": list(size),
          "kb": kb, "secs": 0, "est_cost_usd": 0.0, "t": time.strftime("%Y-%m-%dT%H:%M:%S"), "cf_job": None, "params": {}}
    with open(boards.MANIFEST, "a") as f:
        f.write(json.dumps(m_) + "\n")
    print("rotated crescent ->", dst, size, kb, "KB")
    return raw
