// temporal.js: line sets on VIDEO plates that hold still at 60 fps (no boil, no line-end flicker), as a pure
// function of plate time (frames render in any order, in parallel).
//
//   references   every R plate frames (refStep, default 4 = 6 a second at 24 fps) the plate is analysed and traced.
//                Reference k's streamlines are seeded first by reference k-R's lines (stable ids, old lines keep
//                priority), carried to frame k by the plate's optical flow: a deterministic chain from the shot's
//                first reference (computed once per page, then cached).
//   transport    at plate time q (fractional frames) the two bracketing references k0 <= q <= k1 are carried to q:
//                k0 forward and k1 backward through the per-frame flow maps (vertex advection, sub-frame for the
//                fraction), so lines follow the footage smoothly at 60 fps although the plate is 24 fps.
//   crossfade    A (from k0) is drawn with weight 1 - u and B (from k1) with weight u, u = (q - k0) / (k1 - k0). Lines that
//                exist in both coincide (same id, same place), so their sum is constant; a line that breaks, grows or
//                shrinks between references fades over ~10 master frames instead of popping: the line-end flicker
//                the look-dev noted is gone by construction.
//
// videoLines(f, src, tp, opts, build) -> { lines, meta, refs: [k0, k1], u }   (build = trace function of plate.js)

import { resolve, sourceFields, plateFlow } from './source.js';
import { LRU } from '../../assets.js';

const REFS = new LRU(400);   // per reference: { lines, seeds, meta }

function sampFlow(fl, mx, my) {
  const w = fl.w, h = fl.h, x = Math.max(0, Math.min(w - 1.001, mx - .5)), y = Math.max(0, Math.min(h - 1.001, my - .5)), xi = x | 0, yi = y | 0, ax = x - xi, ay = y - yi, i = yi * w + xi;
  const fx = (fl.fx[i] * (1 - ax) + fl.fx[i + 1] * ax) * (1 - ay) + (fl.fx[i + w] * (1 - ax) + fl.fx[i + w + 1] * ax) * ay;
  const fy = (fl.fy[i] * (1 - ax) + fl.fy[i + 1] * ax) * (1 - ay) + (fl.fy[i + w] * (1 - ax) + fl.fy[i + w + 1] * ax) * ay;
  return [fx, fy];
}
// analysis px <-> flow-map px for a source window
function mapper(meta, fl) {
  const [wx, wy, ww, wh] = meta.win, sx = ww / meta.aw, sy = wh / meta.ah, mx = fl.w / meta.srcW, my = fl.h / meta.srcH;
  return {
    toMap: (x, y) => [(wx + x * sx) * mx, (wy + y * sy) * my],
    disp: (fx, fy) => [fx / mx / sx, fy / my / sy],
  };
}
// advect points (Float32Array xy, in place) from frame a to frame b (0-based, fractional b allowed; b < a = backward)
async function advect(id, meta, xy, a, b) {
  if (Math.abs(b - a) < 1e-6) return xy;
  const n = xy.length >> 1;
  if (b > a) {
    for (let j = Math.floor(a); j < b - 1e-6; j++) {
      const fl = await plateFlow(id, j + 1); if (!fl) break;
      const M = mapper(meta, fl), frac = Math.min(1, b - j);
      for (let i = 0; i < n; i++) { const [mx, my] = M.toMap(xy[i * 2], xy[i * 2 + 1]), [fx, fy] = sampFlow(fl, mx, my), [dx, dy] = M.disp(fx, fy); xy[i * 2] += dx * frac; xy[i * 2 + 1] += dy * frac; }
    }
  } else {
    for (let j = Math.ceil(a) - 1; j >= Math.floor(b); j--) {
      const fl = await plateFlow(id, j + 1); if (!fl) break;
      const M = mapper(meta, fl), frac = Math.min(1, (j + 1) - Math.max(b, j));
      for (let i = 0; i < n; i++) {
        let px = xy[i * 2], py = xy[i * 2 + 1];
        for (let it = 0; it < 2; it++) { const [mx, my] = M.toMap(px, py), [fx, fy] = sampFlow(fl, mx, my), [dx, dy] = M.disp(fx, fy); px = xy[i * 2] - dx * frac; py = xy[i * 2 + 1] - dy * frac; }
        xy[i * 2] = px; xy[i * 2 + 1] = py;
      }
    }
  }
  return xy;
}

// the reference at plate frame k (0-based), chained from `start`
async function reference(f, src, k, start, R, opts, build) {
  const key = `${src.plate}|${JSON.stringify(src.win || {})}|${f.W}x${f.H}|${k}|${start}|${R}|${opts.cfgKey}`;
  const hit = REFS.get(key); if (hit) return hit;
  const p = (async () => {
    let seeds = null;
    if (k - R >= start) {
      const prev = await reference(f, src, k - R, start, R, opts, build);
      const xy = new Float32Array(prev.seeds.length * 2); prev.seeds.forEach((s, i) => { xy[i * 2] = s.x; xy[i * 2 + 1] = s.y; });
      await advect(src.plate, prev.meta, xy, k - R, k);
      seeds = prev.seeds.map((s, i) => ({ id: s.id, age: s.age, x: xy[i * 2], y: xy[i * 2 + 1] }));
    }
    const F = await sourceFields(src, k / opts.fps + 1e-4, opts.aw ?? Math.round(960 * Math.max(f.W, f.H) / 1920), f.W / f.H, opts.analysis || {});
    const state = { nextId: seeds ? Math.max(1, ...seeds.map(s => s.id)) + 1 : 1 };
    const res = build(F, seeds, state);
    res.seeds = res.stream.map(L => ({ id: L.id, x: L.x0, y: L.y0, age: L.age ?? 0 })).sort((a, b) => b.age - a.age || a.id - b.id);
    res.meta = { ...res.meta, win: F.win, aw: F.aw, ah: F.ah, srcW: F.srcW, srcH: F.srcH };
    return res;
  })();
  REFS.set(key, p);
  return p;
}

function weighted(lines, wgt) {
  return lines.map(L => { const b = new Float32Array(L.n); for (let i = 0; i < L.n; i++) b[i] = L.b[i] * wgt; return { ...L, xy: L.xy.slice(), b }; });
}
async function carry(id, meta, lines, a, b) {
  let n = 0; for (const L of lines) n += L.n;
  const xy = new Float32Array(n * 2); let o = 0;
  for (const L of lines) { xy.set(L.xy, o); o += L.n * 2; }
  await advect(id, meta, xy, a, b);
  o = 0; for (const L of lines) { L.xy = xy.subarray(o, o + L.n * 2); o += L.n * 2; }
  return lines;
}

export async function videoLines(f, src, tp, opts, build) {
  const r = resolve(src), fps = r.fps || 24, R = opts.refStep ?? 4, n = r.n || 1;
  const q = Math.max(0, Math.min(n - 1, tp * fps));
  const start = Math.floor(Math.max(0, Math.min(n - 1, (opts.chainFrom ?? 0) * fps)) / R) * R;
  const k0 = Math.max(start, Math.floor(q / R) * R), k1 = Math.min(Math.ceil((n - 1) / R) * R, k0 + R);
  const o2 = { ...opts, fps };
  const A = await reference(f, src, k0, start, R, o2, build);
  const u = k1 > k0 ? Math.max(0, Math.min(1, (q - k0) / (k1 - k0))) : 0;
  const movA = A.lines.filter(L => !L.static), statA = A.lines.filter(L => L.static);
  const outA = await carry(src.plate, A.meta, weighted(movA, 1 - u), k0, q);
  let outB = [];
  if (u > 1e-4 && k1 !== k0) {
    const B = await reference(f, src, k1, start, R, o2, build);
    outB = await carry(src.plate, B.meta, weighted(B.lines.filter(L => !L.static), u), Math.min(k1, n - 1), q);
  }
  return { lines: [...outA, ...outB, ...statA], meta: A.meta, refs: [k0, k1], u };
}
