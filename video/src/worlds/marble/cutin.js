// cutin.js: crisp silhouettes. A painter "cuts in" a statue's edge: after the broad strokes, short strokes of the
// background run along the outside of the silhouette and short strokes of stone along the inside, so the contour is
// a clean decision instead of a halo of broad strokes spilling across it (STYLE_BIBLE MARBLE: crisp silhouettes).
//
//   strokes: ctx => cutInStrokes(ctx, st, { density, len, r })      (paint's `strokes` callback context: F, ref, S, ...)
//
// Edge samples are chosen per material cell (the source's mat), so the same contour points are stroked drawing after
// drawing as the camera drifts: the edge is stable, never crawling.

import { clamp, lerp, hash3, hash4, sampleField } from '../brush/util.js';

export function cutInStrokes(ctx, st, o = {}) {
  const { ref, S } = ctx, aw = st.aw, ah = st.ah, M = st.M, out = [];
  if (!M || !ref) return out;
  const mx = st.mat ? st.mat.mx : null, my = st.mat ? st.mat.my : null;
  const sc = aw / 960, cell = (o.cell ?? 2.6) * sc, seen = new Set(), seed = o.seed ?? 17, dIdx = ctx.drawIdx || 0;
  const rOut = (o.r ?? 1.5) * sc, rIn = (o.rIn ?? 1.15) * sc, len = (o.len ?? 4.2) * sc;
  const samp = (arr, x, y) => sampleField(arr, aw, ah, x, y);
  const edgeThr = o.thr ?? .5, bgW = o.bg ?? 1, inW = o.inner ?? 1;
  for (let y = 2; y < ah - 2; y++) for (let x = 2; x < aw - 2; x++) {
    const i = y * aw + x, m = M[i];
    if (m < edgeThr) continue;
    // an inner contour pixel: a 4-neighbour is outside
    if (M[i - 1] >= edgeThr && M[i + 1] >= edgeThr && M[i - aw] >= edgeThr && M[i + aw] >= edgeThr) continue;
    // one sample per material cell
    const cx = Math.floor((mx ? mx[i] / ctx.S : x) / cell), cy = Math.floor((my ? my[i] / ctx.S : y) / cell), key = cx * 73856093 ^ cy * 19349663;
    if (seen.has(key)) continue; seen.add(key);
    if (hash3(cx, cy, seed) > (o.density ?? .92)) continue;
    // outward normal from the mask gradient (central differences over 2 px)
    let gx = (M[i + 2] || 0) - (M[i - 2] || 0), gy = (M[i + 2 * aw] || 0) - (M[i - 2 * aw] || 0);
    const gm = Math.hypot(gx, gy); if (gm < 1e-3) continue;
    const nx = -gx / gm, ny = -gy / gm, tx = -ny, ty = nx;
    const j = hash4(cx, cy, seed, 3), jb = (hash4(cx, cy, seed, dIdx * 7919 + 1) - .5) * .25;
    const L = len * (.75 + .5 * j);
    // the background just outside (its colour sampled a little farther out, past any halo)
    if (bgW > 0) {
      const ox = x + nx * (rOut + .6), oy = y + ny * (rOut + .6), sx = x + nx * (rOut * 2 + 2.5 * sc), sy = y + ny * (rOut * 2 + 2.5 * sc);
      if (sx > 0 && sy > 0 && sx < aw - 1 && sy < ah - 1 && samp(M, sx, sy) < .3) {
        const c = [samp(ref.R, sx, sy), samp(ref.G, sx, sy), samp(ref.B, sx, sy)];
        const p0 = [(ox - tx * L * (.5 + jb)) * S, (oy - ty * L * (.5 + jb)) * S], p1 = [(ox + tx * L * (.5 - jb)) * S, (oy + ty * L * (.5 - jb)) * S];
        out.push({ pts: [p0, [ox * S, oy * S], p1], r: rOut * S * (.85 + .3 * j), c0: c, c1: c, a: .96 * bgW, thick: .12, seed: hash3(cx, cy, seed + 5), key: hash3(cx, cy, seed + 7), layer: 6, taper: .55, maxSeg: 6 });
      }
    }
    // the stone just inside
    if (inW > 0) {
      const ix = x - nx * (rIn + .25), iy = y - ny * (rIn + .25), sx = x - nx * (rIn * 2 + 1.6 * sc), sy = y - ny * (rIn * 2 + 1.6 * sc);
      if (samp(M, sx, sy) > .6) {
        const c = [samp(ref.R, sx, sy), samp(ref.G, sx, sy), samp(ref.B, sx, sy)];
        const p0 = [(ix - tx * L * (.45 - jb)) * S, (iy - ty * L * (.45 - jb)) * S], p1 = [(ix + tx * L * (.45 + jb)) * S, (iy + ty * L * (.45 + jb)) * S];
        out.push({ pts: [p0, [ix * S, iy * S], p1], r: rIn * S * (.85 + .3 * j), c0: c, c1: c, a: .9 * inW, thick: .22, seed: hash3(cx, cy, seed + 9), key: hash3(cx, cy, seed + 11), layer: 6, taper: .6, maxSeg: 6 });
      }
    }
  }
  // background strokes first, then the stone's edge over them
  out.sort((a, b) => a.thick - b.thick);
  return out;
}
