// smear.js: smear drawings for the spin. A fast turn in cel animation gets one or two drawings that are motion rather than
// poses: the shapes dragged into streaks along the move, the features gone, a few speed lines. We make them from a plate
// drawing's cel (the in-between plate frame): inside a region around her head and shoulders the cel is flattened (one
// tone per material, the face's features become skin), then every label is dragged back along the motion by a length
// that varies smoothly down the rows (two slow waves), so the trailing edge breaks into a few broad tapered sweeps and
// the inner edges (hair against face, collar against hair) shear with it; a majority filter cleans the edges. The
// silhouette is redrawn from the smeared shape, the interior lines inside the region go, a few speed lines trail behind.
// Pure (no DOM): label map in, label map out.
//
// sm = { dx, dy: the trailing direction and length in analysis px (where the shapes come from), region: setup-normalised
//        ellipse {cx, cy, rx, ry}, drag: 0..1 how far the interior shears (fraction of the streak), lambda: rows per
//        sweep, seed, speed: number of speed lines }

import { gauss, contours, smoothPts, resample, modeFilter } from './img.js';
import { MAT, NLAB, label } from './palette.js';

const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const matOf = l => l ? ((l - 1) >> 1) + 1 : 0;
const FACE = new Set([MAT.iris.id, MAT.white.id, MAT.brow.id]);

export function smearCel(res, sm) {
  const { W, H } = res, N = W * H;
  const dx = sm.dx || 0, dy = sm.dy || 0, D = Math.hypot(dx, dy) || 1, ux = dx / D, uy = dy / D, r = sm.region;
  const seed = sm.seed || 0, drag = sm.drag ?? .5;
  const inReg = (x, y) => { const a = (x / W - r.cx) / r.rx, b = (y / H - r.cy) / r.ry; return a * a + b * b <= 1; };
  // the area the smear can touch: the region and the region pushed along the streak
  const inArea = (x, y) => inReg(x, y) || inReg(x - dx, y - dy);
  const bx0 = Math.max(0, Math.floor((r.cx - r.rx) * W - Math.max(0, -dx) - 2)), bx1 = Math.min(W - 1, Math.ceil((r.cx + r.rx) * W + Math.max(0, dx) + 2));
  const by0 = Math.max(0, Math.floor((r.cy - r.ry) * H - Math.max(0, -dy) - 2)), by1 = Math.min(H - 1, Math.ceil((r.cy + r.ry) * H + Math.max(0, dy) + 2));
  // 1. flatten inside the smear: one tone per material, the face's features gone (a smear is shapes, not detail)
  const mask = new Uint8Array(N), lab0 = new Uint8Array(res.lab);
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
    if (!inArea(x, y)) continue;
    const i = y * W + x; mask[i] = 1;
    const l = lab0[i]; if (!l) continue;
    const m = matOf(l); lab0[i] = label(FACE.has(m) ? MAT.skin.id : m, false);
  }
  const lab = modeFilter(lab0, W, H, 2, NLAB, mask, 2);
  // 2. streak length per row: smooth lobes (two low-frequency waves), so the trailing edge breaks into a few broad
  //    tapered sweeps rather than scanlines
  const lam = sm.lambda || 26, ph1 = hash(seed) * 6.28, ph2 = hash(seed + 9) * 6.28;
  const lenK = y => { const a = .5 + .5 * Math.sin(6.2832 * y / lam + ph1), b = .5 + .5 * Math.sin(6.2832 * y / (lam * .43) + ph2); return .28 + .72 * a * a * (.7 + .3 * b); };
  let out = new Uint8Array(lab);
  for (let y = by0; y <= by1; y++) {
    const L = lenK(y) * D, n = Math.ceil(L), kIn = Math.round(L * drag);
    for (let x = bx0; x <= bx1; x++) {
      const i = y * W + x;
      if (!inArea(x, y)) continue;
      if (lab[i]) {
        // interior shear: take the label from kIn px back along the streak, if that is still her
        if (kIn > 0) {
          const sx = Math.round(x - ux * kIn), sy = Math.round(y - uy * kIn);
          if (sx >= 0 && sy >= 0 && sx < W && sy < H && inReg(sx, sy)) { const l = lab[sy * W + sx]; if (l) out[i] = l; }
        }
        continue;
      }
      // trailing streak into the background: the nearest of her pixels up to L px back along the streak
      for (let j = 1; j <= n; j++) {
        const sx = Math.round(x - ux * j), sy = Math.round(y - uy * j);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) break;
        if (!inReg(sx, sy)) continue;
        const l = lab[sy * W + sx];
        if (l) { out[i] = l; break; }
      }
    }
  }
  out = modeFilter(out, W, H, 2, NLAB, mask, 2);     // 3. clean edges
  // lines: the old ones leave the smear area; the new silhouette of the smeared shape inside it; speed lines behind
  const keep = [];
  for (const ch of res.chains) {
    let run = [];
    const flush = () => { if (run.length >= 4) keep.push({ ...ch, pts: run }); run = []; };
    for (const p of ch.pts) { if (inArea(p[0], p[1])) flush(); else run.push(p); }
    flush();
  }
  const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = out[i] ? 1 : 0;
  const al = gauss(a, W, H, .8);
  for (const c of contours(al, W, H, .5)) {
    let run = [];
    const flush = () => { if (run.length > 6) keep.push({ pts: smoothPts(resample(run, 1.2), 1.6, false), kind: 'sil', w: (sm.silW || 2.6) }); run = []; };
    for (const p of c.pts) {
      const edge = p[0] < 2 || p[1] < 2 || p[0] > W - 3 || p[1] > H - 3;
      if (edge || !inArea(p[0], p[1])) flush(); else run.push(p);
    }
    flush();
  }
  // speed lines: thin, straight, tapered, trailing past the streak ends on a few rows
  const ns = sm.speed ?? 5;
  for (let k = 0, tries = 0; k < ns && tries < 60; tries++) {
    const y = Math.round(by0 + (by1 - by0) * (.12 + .7 * hash(seed * 11.3 + tries * 3.7)));
    // the end of her (smeared) shape on this row, along the streak
    let xe = -1;
    if (ux >= 0) { for (let x = bx1; x >= bx0; x--) if (out[y * W + x] && inArea(x, y)) { xe = x; break; } }
    else { for (let x = bx0; x <= bx1; x++) if (out[y * W + x] && inArea(x, y)) { xe = x; break; } }
    if (xe < 0) continue;
    const gap = 3 + 5 * hash(tries + seed), len = D * (.7 + .8 * hash(tries * 1.7 + seed * 5));
    const x0 = xe + Math.sign(ux || 1) * (gap - D * .35), pts = [];
    for (let s = 0; s <= len; s += 2) pts.push([x0 + ux * s, y + uy * s]);
    if (pts.length > 3) { keep.push({ pts, kind: 'speed', w: 1.15, col: 'ink' }); k++; }
  }
  return { ...res, lab: out, chains: keep, eyes: [], packed: null, noFace: true, _eye: undefined, _sf: null };
}
