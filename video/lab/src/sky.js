// sky.js: the sky region of a plate, shared by every material that replaces the sky (BRONZE's Altdorfer sky,
// MARBLE's totality sky, CORONA's black). Far depth, never the subject matte, never below `below`, and monotone down
// each column (once a column leaves the sky it does not re-enter it), so depth speckle cannot punch holes in the land.

import { sstep } from './core.js';
import { blur } from './analysis.js';

export function skyMask(F, o) {
  const { aw, ah, N } = F, m = new Float32Array(N);
  if (!o) return m;
  const yMax = (o.below ?? .5) * ah, md = o.maxDepth ?? .01, soft = o.soft ?? .01;
  const D = F.D ? blur(F.D, aw, ah, 1) : null;
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const i = y * aw + x;
    let s = D ? 1 - sstep(md, md + soft, D[i]) : 1 - sstep(.45, .6, y / ah);
    if (F.M) s *= 1 - sstep(.15, .5, F.M[i]);
    s *= 1 - sstep(yMax - 4, yMax + 4, y);
    m[i] = s;
  }
  for (let x = 0; x < aw; x++) {
    let run = 1;
    for (let y = 0; y < ah; y++) { const i = y * aw + x; run = Math.min(run, m[i] + .04); m[i] = Math.min(m[i], run); }
  }
  return blur(m, aw, ah, o.blur ?? 1.2);
}

// the horizon row (analysis px) of each column: the first row where the sky mask drops below .5
export function horizonRows(F, sky) {
  const { aw, ah } = F, hz = new Float32Array(aw);
  for (let x = 0; x < aw; x++) { let y = 0; while (y < ah && sky[y * aw + x] > .5) y++; hz[x] = y; }
  return hz;
}
