// trace.js: plate fields -> line sets (polylines in analysis px with per-vertex attributes).
//
// Three tiers (STYLE_BIBLE CORONA hierarchy):
//   1. contours: the subject's matte silhouette + coherent inner edges: brightest, crispest, weighted, tapered
//   2. streamlines: evenly spaced (Jobard & Lefer) through the structure-tensor flow, spaced by tone (dense in light,
//      sparse in half-shade, none in shadow)
//   3. background: the same streamlines, sparse and dim, and a lot of black
// plus spear ticks for crowds (one crisp tick + a bright tip per figure).
//
// A line: { xy: Float32Array(2n) analysis px, n, d: lift depth per vertex (0..1, 1 = near; -1 = sky / infinity),
//   b brightness, w width (output px), o colour (0 pearl .. 1 orange .. 2 H-alpha red), s arc length (output px),
//   len, phase, spd, flags, id }.  flags: SHARP (no glow) | SKY | TIP | CONTOUR | CORONA | TICK

import { clamp, lerp, sstep, hash3, TAU } from '../../core.js';
import { blur, samp, edgeChains, ellipseMask } from './analysis.js';

export const FL = { SHARP: 1, SKY: 2, TIP: 4, CONTOUR: 8, CORONA: 16, TICK: 32, NOFADE: 64, PARTICLE: 128 };

export const TRACE_DEFAULTS = {
  // streamline spacing in analysis px (subject from tone; background its own sparse range)
  dsepMin: 2.2, dsepMax: 7.5, bgSepMin: 13, bgSepMax: 26, dtest: .5, step: .6, maxLen: 900, minLen: 22, maxTurn: 1.0, sepGamma: .8,
  shadowCut: .06, bgCut: .22, gamma: 1.2, gain: 1.1, bgGain: .3, darkCut: .04, depthFade: .45, weightVar: .35,
  subjBright: [.3, .95], width: [.55, 1.15],
  contour: 1, contourW: [1.2, 2.3], contourB: 1.3, innerEdges: 1, innerW: [.75, 1.25], innerB: .8, innerHi: .2, innerLo: .085,
  pool: null, poolMatte: 1, poolBlur: 8, subject: 'matte',
  rim: 1, lightDir: [-.75, -.66], horizon: 1, horizonBand: .035,
  sky: null, sun: null, armies: 0, tick: [5, 13], tickMin: 2, seed: 3,
  depthBlur: 6, depthSmooth: 8, relief: .25, edgeFade: 40, S: 2,
  calm: null,               // [{x, y, rx, ry, k}] regions where streamlines thin out (e.g. text in a stand-in)
  river: null,              // polygon [[u, v], ...] (uv): its edge becomes an orange bank line, inside flows along it
  riverB: 1.2,
};

// ---------------------------------------------------------------- sky
// far depth, never the subject, never below `below`, monotone down each column (no holes punched by depth speckle)
export function skyMask(F, o) {
  const { aw, ah, N } = F, m = new Float32Array(N);
  if (!o) return m;
  const yMax = (o.below ?? .5) * ah, md = o.maxDepth ?? .01, soft = o.soft ?? .01;
  const D = F.D ? blur(F.D, aw, ah, 1) : null;
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const i = y * aw + x;
    let s = D && o.useDepth !== false ? 1 - sstep(md, md + soft, D[i]) : 1;
    if (o.horizonY != null) s = Math.min(s, 1 - sstep(o.horizonY * ah - 1.5, o.horizonY * ah + 1.5, y));
    if (F.M) s *= 1 - sstep(.15, .5, F.M[i]);
    else s *= 1 - sstep(.2, .42, F.detail[i]);          // no matte yet: detailed regions (figures) are never sky
    s *= 1 - sstep(yMax - 4, yMax + 4, y);
    m[i] = s;
  }
  for (let x = 0; x < aw; x++) { let run = 1; for (let y = 0; y < ah; y++) { const i = y * aw + x; run = Math.min(run, m[i] + .04); m[i] = Math.min(m[i], run); } }
  return blur(m, aw, ah, o.blur ?? 1.2);
}
// the horizon row (analysis px) of each column
export function horizonRows(F, sky) {
  const { aw, ah } = F, hz = new Float32Array(aw);
  for (let x = 0; x < aw; x++) { let y = 0; while (y < ah && sky[y * aw + x] > .5) y++; hz[x] = y; }
  return hz;
}
function polyMask(F, poly, feather = 2) {
  const { aw, ah, N } = F, m = new Float32Array(N), P = poly.map(([u, v]) => [u * aw, v * ah]);
  for (let y = 0; y < ah; y++) {
    const xs = [];
    for (let k = 0; k < P.length; k++) { const [x0, y0] = P[k], [x1, y1] = P[(k + 1) % P.length]; if ((y0 <= y) !== (y1 <= y)) xs.push(x0 + (y - y0) / (y1 - y0) * (x1 - x0)); }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(aw - 1, Math.floor(xs[k + 1])); x++) m[y * aw + x] = 1;
  }
  return blur(m, aw, ah, feather);
}

// ---------------------------------------------------------------- source uv -> analysis-window uv
// Every geometric trace option (sky.horizonY/below, sun, river, riverFlow, armyMask, pool, calm, flowBias) is given in
// SOURCE uv (the plate's own frame), so it stays put when a shot re-frames the plate (zoom, 4:5, a diptych half).
export function winMap(F) {
  if (!F.win || !F.srcW) return { x: u => u, y: v => v, sx: 1, sy: 1 };
  const [x0, y0, w, h] = F.win, sx = F.srcW / w, sy = F.srcH / h, m = F.mirror;
  return { x: u => { const a = (u * F.srcW - x0) / w; return m ? 1 - a : a; }, y: v => (v * F.srcH - y0) / h, sx, sy };
}
function mapCfg(F, cfg) {
  const M = winMap(F), P = pts => pts.map(([u, v]) => [M.x(u), M.y(v)]), E = e => ({ ...e, x: M.x(e.x), y: M.y(e.y), rx: e.rx * M.sx, ry: e.ry * M.sy });
  const c = { ...cfg };
  if (cfg.sky) c.sky = { ...cfg.sky, horizonY: cfg.sky.horizonY != null ? M.y(cfg.sky.horizonY) : null, below: M.y(cfg.sky.below ?? .5) };
  if (cfg.sun) c.sun = { ...cfg.sun, x: M.x(cfg.sun.x), y: M.y(cfg.sun.y), r: cfg.sun.r * M.sx };
  if (cfg.river) c.river = P(cfg.river);
  if (cfg.riverFlow) c.riverFlow = { ...cfg.riverFlow, x: M.x(cfg.riverFlow.x), y: M.y(cfg.riverFlow.y) };
  if (cfg.armyMask) c.armyMask = cfg.armyMask.map(P);
  if (cfg.pool) c.pool = cfg.pool.map(E);
  if (cfg.calm) c.calm = cfg.calm.map(E);
  if (cfg.flowBias) c.flowBias = cfg.flowBias.map(E);
  return c;
}

// ---------------------------------------------------------------- fields that shape the lines
export function prepFields(F, cfg0) {
  const { aw, ah, N } = F, cfg = mapCfg(F, cfg0);
  const sky = cfg.sky ? skyMask(F, cfg.sky) : new Float32Array(N);
  const M = F.M ? blur(F.M, aw, ah, .7) : new Float32Array(N);
  let subj = new Float32Array(N);
  if (cfg.subject === 'matte' && F.M && cfg.poolMatte) for (let i = 0; i < N; i++) subj[i] = sstep(.3, .7, M[i]) * cfg.poolMatte;
  else if (cfg.subject === 'matte' && !F.M && !cfg.pool && cfg.autoSubject !== false) {   // plate without a matte yet: detail stands in
    const dB = blur(F.detail, aw, ah, 3);
    for (let i = 0; i < N; i++) subj[i] = sstep(.22, .55, dB[i]) * (1 - sstep(.3, .6, sky[i]));
  }
  if (cfg.pool) {
    let pl = new Float32Array(N);
    for (const e of cfg.pool) { const m = ellipseMask(F, e), k = e.k ?? 1; for (let i = 0; i < N; i++) pl[i] = Math.max(pl[i], m[i] * k); }
    pl = blur(pl, aw, ah, cfg.poolBlur);
    for (let i = 0; i < N; i++) subj[i] = Math.max(subj[i], pl[i]);
  }
  const river = cfg.river ? polyMask(F, cfg.river, 1.5) : null;
  // tensor: fine where there is detail on the subject, coarse (long calm lines) elsewhere; along the river the flow
  // follows the river's axis (a designed prior from the polygon's centre line)
  const xx = new Float32Array(N), xy = new Float32Array(N), yy = new Float32Array(N);
  let trF = 0, trC = 0; for (let i = 0; i < N; i++) { trF += F.J.xx[i] + F.J.yy[i]; trC += F.Jc.xx[i] + F.Jc.yy[i]; }
  const kc = trF / Math.max(trC, 1e-9);
  for (let i = 0; i < N; i++) {
    const w = sstep(.2, .55, F.detail[i]) * sstep(.3, .8, subj[i]);
    xx[i] = w * F.J.xx[i] + (1 - w) * F.Jc.xx[i] * kc; xy[i] = w * F.J.xy[i] + (1 - w) * F.Jc.xy[i] * kc; yy[i] = w * F.J.yy[i] + (1 - w) * F.Jc.yy[i] * kc;
  }
  if (cfg.flowBias) {          // [{x, y, angle (rad, tangent), k, rx, ry}] uv regions with a designed flow direction
    for (const fb of cfg.flowBias) {
      const m = ellipseMask(F, { feather: .6, ...fb }), c = Math.cos(fb.angle + Math.PI / 2), s = Math.sin(fb.angle + Math.PI / 2);
      let tr = 0; for (let i = 0; i < N; i += 7) tr += xx[i] + yy[i]; tr = tr / (N / 7) * (fb.k ?? 3);
      for (let i = 0; i < N; i++) { const a = m[i] * tr; xx[i] += a * c * c; xy[i] += a * c * s; yy[i] += a * s * s; }
    }
  }
  if (river && cfg.riverFlow) {   // inside the river the flow runs along it, toward its vanishing point
    const vx = cfg.riverFlow.x * aw, vy = cfg.riverFlow.y * ah, kk = cfg.riverFlow.k ?? 4;
    let tr = 0; for (let i = 0; i < N; i += 7) tr += xx[i] + yy[i]; tr = tr / (N / 7) * kk;
    for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
      const i = y * aw + x, r = river[i]; if (r < .01) continue;
      let tx = x - vx, ty = y - vy; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
      const nx = -ty, ny = tx, a = r * tr;                 // tensor of the normal: its minor eigenvector is the tangent
      xx[i] += a * nx * nx; xy[i] += a * nx * ny; yy[i] += a * ny * ny;
    }
  }
  const B = new Float32Array(N), sep = new Float32Array(N), ok = new Float32Array(N), O = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = clamp((F.T[i] - cfg.darkCut) / (1 - cfg.darkCut)), s = subj[i];
    const tsub = sstep(cfg.shadowCut, 1, t), tbg = sstep(cfg.bgCut, 1, t);
    const bS = lerp(cfg.subjBright[0], cfg.subjBright[1], Math.pow(t, cfg.gamma)) * cfg.gain;
    let bB = cfg.bgGain * Math.pow(t, cfg.gamma);
    if (F.D) bB *= lerp(1 - cfg.depthFade, 1, sstep(0, .6, F.D[i]));
    B[i] = lerp(bB, bS, s);
    const sS = lerp(cfg.dsepMax, cfg.dsepMin, Math.pow(tsub, cfg.sepGamma)), sB = lerp(cfg.bgSepMax, cfg.bgSepMin, tbg);
    sep[i] = lerp(sB, sS, s);
    ok[i] = Math.max(s > .5 ? tsub : 0, s <= .5 ? tbg : 0) > .01 ? 1 : 0;
  }
  if (cfg.calm) for (const c of cfg.calm) { const m = ellipseMask(F, { feather: .5, ...c }); for (let i = 0; i < N; i++) { sep[i] *= 1 + m[i] * (c.k ?? 3); B[i] *= 1 - .6 * m[i]; } }
  if (river) {
    for (let i = 0; i < N; i++) if (river[i] > .02) {
      const r = river[i];
      B[i] = lerp(B[i], Math.max(B[i], .22 + .5 * Math.pow(clamp(F.T[i] * 1.6), 1.5)), r);
      sep[i] = lerp(sep[i], lerp(9, 4, clamp(F.T[i] * 2)), r);
      ok[i] = Math.max(ok[i], r > .5 ? 1 : 0);
    }
  }
  // horizon band (the 360-degree totality glow): orange lines just under the horizon
  if (cfg.sky && cfg.horizon) {
    const band = cfg.horizonBand * ah;
    for (let x = 0; x < aw; x++) {
      let hy = 0; while (hy < ah && sky[hy * aw + x] > .5) hy++;
      if (hy >= ah || hy === 0) continue;
      for (let y = hy; y < Math.min(ah, hy + band * 3); y++) { const i = y * aw + x, k = Math.exp(-(y - hy) / band); O[i] = Math.max(O[i], k * cfg.horizon); B[i] = Math.max(B[i], .45 * k); ok[i] = Math.max(ok[i], k > .2 ? 1 : 0); sep[i] = Math.min(sep[i], lerp(sep[i], 5, k)); }
    }
  }
  let army = null;
  if (cfg.armies) {
    army = new Float32Array(N);
    const am = cfg.armyMask ? polyUnion(F, cfg.armyMask) : null;
    for (let i = 0; i < N; i++) army[i] = sstep(.42, .7, F.detail[i]) * (am ? am[i] : sstep(.5, .9, subj[i])) * cfg.armies;
    army = blur(army, aw, ah, 2);
    for (let i = 0; i < N; i++) if (army[i] > .35) ok[i] = 0;
  }
  for (let i = 0; i < N; i++) if (sky[i] > .5) ok[i] = 0;
  let sun = null;
  if (cfg.sun) { const s = cfg.sun; sun = { x: s.x * aw, y: s.y * ah, r: s.r * aw, tilt: s.tilt ?? .5 }; }
  return { xx, xy, yy, B, sep, ok, O, sky, sun, subj, M, army, river };
}
function polyUnion(F, polys) {
  const out = new Float32Array(F.N);
  for (const p of polys) { const m = polyMask(F, p, 3); for (let i = 0; i < F.N; i++) out[i] = Math.max(out[i], m[i]); }
  return out;
}

function dirAt(F, f, x, y, out) {
  const a = samp(F, f.xx, x, y), b = samp(F, f.xy, x, y), c = samp(F, f.yy, x, y);
  const th = .5 * Math.atan2(2 * b, a - c) + Math.PI / 2;
  out[0] = Math.cos(th); out[1] = Math.sin(th);
}

// ---------------------------------------------------------------- evenly spaced streamlines (Jobard & Lefer 1997)
// seeds (optional): [{id, x, y, age}] traced first, in the given order (temporal coherence: old lines keep priority)
export function traceLines(F, f, cfg, seeds = null, state = null) {
  const { aw, ah } = F, cell = cfg.dsepMin, gw = Math.ceil(aw / cell) + 1, gh = Math.ceil(ah / cell) + 1;
  const head = new Int32Array(gw * gh).fill(-1);
  // the spatial grid: per point x, y, line, index, next-in-cell and its CELL (stored: recomputing it from the float32
  // copy of x, y can pick the neighbouring cell at a boundary and corrupt the lists)
  let cap = 1 << 16, PX = new Float32Array(cap), PY = new Float32Array(cap), PL = new Int32Array(cap), PI = new Int32Array(cap), NX = new Int32Array(cap), PC = new Int32Array(cap), np = 0;
  const grow2 = () => { cap *= 2; const re = (A, T) => { const n = new T(cap); n.set(A); return n; }; PX = re(PX, Float32Array); PY = re(PY, Float32Array); PL = re(PL, Int32Array); PI = re(PI, Int32Array); NX = re(NX, Int32Array); PC = re(PC, Int32Array); };
  const lines = [], v = [0, 0], v2 = [0, 0];
  const sepAt = (x, y) => samp(F, f.sep, x, y), okAt = (x, y) => samp(F, f.ok, x, y) > .5;
  const D = F.D, sun = f.sun;
  const blocked = (x, y) => sun && Math.hypot(x - sun.x, y - sun.y) < sun.r * 1.02;
  const tooClose = (x, y, d, lid, idx) => {
    const r = Math.ceil(d / cell), cx = Math.floor(x / cell), cy = Math.floor(y / cell), d2 = d * d, near = Math.ceil(2.5 * d / cfg.step);
    for (let j = Math.max(0, cy - r); j <= Math.min(gh - 1, cy + r); j++) for (let i = Math.max(0, cx - r); i <= Math.min(gw - 1, cx + r); i++) {
      for (let p = head[j * gw + i]; p >= 0; p = NX[p]) { if (PL[p] === lid && Math.abs(PI[p] - idx) < near) continue; const dx = PX[p] - x, dy = PY[p] - y; if (dx * dx + dy * dy < d2) return true; }
    }
    return false;
  };
  const insert = (x, y, lid, idx) => { if (np >= cap) grow2(); const c = Math.floor(y / cell) * gw + Math.floor(x / cell); PX[np] = x; PY[np] = y; PL[np] = lid; PI[np] = idx; PC[np] = c; NX[np] = head[c]; head[c] = np; np++; };
  let nextId = state ? state.nextId : 1;
  const maxLines = cfg.maxLines ?? 12000;
  const grow = (x0, y0, id) => {
    if (lines.length >= maxLines) return null;
    if (x0 < 1 || y0 < 1 || x0 > aw - 2 || y0 > ah - 2 || blocked(x0, y0) || !okAt(x0, y0)) return null;
    const lid = lines.length;
    if (tooClose(x0, y0, sepAt(x0, y0) * .95, lid, 0)) return null;
    const start = np;
    insert(x0, y0, lid, 0);
    const branches = [];
    for (const dir of [1, -1]) {
      const pts = [];
      let x = x0, y = y0, px = 0, py = 0, idx = 0;
      dirAt(F, f, x, y, v); px = v[0] * dir; py = v[1] * dir;
      const maxN = cfg.maxLen / cfg.step, win = Math.max(4, Math.round(8 / cfg.step)), turns = new Float32Array(win);
      let turnSum = 0;
      for (let k = 0; k < maxN; k++) {
        dirAt(F, f, x, y, v); let dx = v[0], dy = v[1]; if (dx * px + dy * py < 0) { dx = -dx; dy = -dy; }
        dirAt(F, f, x + dx * cfg.step * .5, y + dy * cfg.step * .5, v2); let ex = v2[0], ey = v2[1]; if (ex * dx + ey * dy < 0) { ex = -ex; ey = -ey; }
        if (ex * px + ey * py < .5) break;
        const tq = Math.abs(Math.atan2(px * ey - py * ex, px * ex + py * ey));
        turnSum += tq - turns[k % win]; turns[k % win] = tq;
        if (turnSum > cfg.maxTurn) break;
        const nx = x + ex * cfg.step, ny = y + ey * cfg.step;
        if (nx < 1 || ny < 1 || nx > aw - 2 || ny > ah - 2 || blocked(nx, ny) || !okAt(nx, ny)) break;
        if (D && Math.abs(samp(F, D, nx, ny) - samp(F, D, x, y)) > .03 * cfg.step) break;
        idx += dir;
        if (tooClose(nx, ny, sepAt(nx, ny) * cfg.dtest, lid, idx)) break;
        x = nx; y = ny; px = ex; py = ey;
        insert(x, y, lid, idx); pts.push(x, y);
      }
      branches.push(pts);
    }
    const n = 1 + (branches[0].length + branches[1].length) / 2;
    if (n * cfg.step < cfg.minLen) {
      for (let p = np - 1; p >= start; p--) head[PC[p]] = NX[p];
      np = start;
      return null;
    }
    const b = branches[1], xy = new Float32Array(n * 2);
    let o = 0;
    for (let k = b.length - 2; k >= 0; k -= 2) { xy[o++] = b[k]; xy[o++] = b[k + 1]; }
    xy[o++] = x0; xy[o++] = y0;
    for (let k = 0; k < branches[0].length; k++) xy[o++] = branches[0][k];
    const L = { xy, n, seedIdx: b.length / 2, x0, y0, id: id ?? nextId++, age: 0 };
    lines.push(L);
    return L;
  };
  const queue = [];
  const enqueue = L => {
    const every = Math.max(2, Math.round(2 / cfg.step));
    for (let k = 0; k < L.n; k += every) {
      const k0 = Math.max(0, k - 1), k1 = Math.min(L.n - 1, k + 1);
      let tx = L.xy[k1 * 2] - L.xy[k0 * 2], ty = L.xy[k1 * 2 + 1] - L.xy[k0 * 2 + 1]; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
      const x = L.xy[k * 2], y = L.xy[k * 2 + 1], d = sepAt(x, y);
      queue.push(x - ty * d, y + tx * d, x + ty * d, y - tx * d);
    }
  };
  const drain = () => { for (let q = 0; q < queue.length; q += 2) { const L2 = grow(queue[q], queue[q + 1]); if (L2) enqueue(L2); } queue.length = 0; };
  if (seeds) for (const s of seeds) { const L = grow(s.x, s.y, s.id); if (L) { L.age = (s.age ?? 0) + 1; enqueue(L); } }
  drain();
  const scan = [], sg = cfg.dsepMax * 1.5;
  for (let y = sg / 2; y < ah; y += sg) for (let x = sg / 2; x < aw; x += sg) {
    const xx = x + (hash3(x | 0, y | 0, cfg.seed) - .5) * sg, yy = y + (hash3(y | 0, x | 0, cfg.seed + 1) - .5) * sg;
    scan.push([samp(F, f.B, xx, yy) * (okAt(xx, yy) ? 1 : 0), xx, yy]);
  }
  scan.sort((a, b) => b[0] - a[0]);
  for (const [w, sx, sy] of scan) { if (w <= 0) break; const L = grow(sx, sy); if (!L) continue; enqueue(L); drain(); }
  if (state) state.nextId = nextId;
  return lines;
}

// per-vertex attributes for streamlines (tier 2/3): brightness, orange, depth, arc length, width
export function decorate(F, f, lines, cfg) {
  const S = cfg.S;
  for (const L of lines) {
    const n = L.n, b = new Float32Array(n), o = new Float32Array(n), d = new Float32Array(n), s = new Float32Array(n), w = new Float32Array(n);
    let acc = 0;
    for (let k = 1; k < n; k++) { acc += Math.hypot(L.xy[k * 2] - L.xy[k * 2 - 2], L.xy[k * 2 + 1] - L.xy[k * 2 - 1]) * S; s[k] = acc; }
    const wgt = 1 + cfg.weightVar * (Math.pow(hash3(L.id, 11, cfg.seed), 3) * 2.2 - .55);
    for (let k = 0; k < n; k++) {
      const x = L.xy[k * 2], y = L.xy[k * 2 + 1];
      const edge = Math.min(x, y, F.aw - 1 - x, F.ah - 1 - y);
      b[k] = samp(F, f.B, x, y) * sstep(0, cfg.edgeFade, edge) * wgt;
      o[k] = samp(F, f.O, x, y);
      d[k] = f.Db ? samp(F, f.Db, x, y) : .5;
      w[k] = lerp(cfg.width[0], cfg.width[1], clamp(b[k]));
    }
    if (cfg.depthSmooth > 0 && n > 2) smooth1(d, cfg.depthSmooth);
    const up = L.xy[n * 2 - 1] <= L.xy[1];
    Object.assign(L, { b, o, d, s, w, len: acc, dir: up ? 1 : -1, phase: hash3(L.id, 7, cfg.seed) * TAU, spd: .75 + .5 * hash3(L.id, 9, cfg.seed), flags: 0 });
    if (!up) { for (let k = 0; k < n; k++) s[k] = acc - s[k]; }   // pulses travel upward on the land (plasma rising)
  }
  return lines;
}
function smooth1(d, r) {
  const n = d.length, tmp = d.slice();
  for (let k = 0; k < n; k++) { let a = 0, ws = 0; for (let j = Math.max(0, k - r); j <= Math.min(n - 1, k + r); j++) { const q = 1 - Math.abs(j - k) / (r + 1); a += tmp[j] * q; ws += q; } d[k] = a / ws; }
}

// tier 1: silhouette + coherent inner edges as weighted, tapered contour lines
export function contourLines(F, f, cfg) {
  const { aw, ah, N } = F, out = [], S = cfg.S;
  const ld = Math.hypot(cfg.lightDir[0], cfg.lightDir[1]) || 1, Lx = cfg.lightDir[0] / ld, Ly = cfg.lightDir[1] / ld;
  const mk = (pts, kind, strength) => {
    const n = pts.length; if (n < 2) return;
    const xy = new Float32Array(n * 2), b = new Float32Array(n), o = new Float32Array(n), d = new Float32Array(n), s = new Float32Array(n), w = new Float32Array(n);
    let acc = 0;
    for (let k = 0; k < n; k++) {
      const [x, y] = pts[k]; xy[k * 2] = x; xy[k * 2 + 1] = y;
      if (k) acc += Math.hypot(x - pts[k - 1][0], y - pts[k - 1][1]) * S;
      s[k] = (x * .7 + y * .7) * S;
      let sx = x, sy = y;
      if (kind === 0 && f.M) {
        const gx = samp(F, f.M, x + 1, y) - samp(F, f.M, x - 1, y), gy = samp(F, f.M, x, y + 1) - samp(F, f.M, x, y - 1), gm = Math.hypot(gx, gy) || 1;
        for (const q of [4, 3, 2, 1]) { const qx = x + gx / gm * q, qy = y + gy / gm * q; if (samp(F, f.M, qx, qy) > .6) { sx = qx; sy = qy; break; } }
      }
      d[k] = f.Db ? samp(F, f.Db, sx, sy) : .5;
    }
    if (n > 2) smooth1(d, 6);
    for (let k = 0; k < n; k++) {
      const [x, y] = pts[k], u = n > 1 ? k / (n - 1) : 0, taper = Math.pow(Math.min(1, Math.min(u, 1 - u) * 5), .6);
      let face = 0;
      if (kind === 0 && f.M) { const gx = samp(F, f.M, x + 1, y) - samp(F, f.M, x - 1, y), gy = samp(F, f.M, x, y + 1) - samp(F, f.M, x, y - 1), gm = Math.hypot(gx, gy) || 1; face = Math.max(0, (-gx / gm) * Lx + (-gy / gm) * Ly); }
      const vary = .8 + .4 * Math.sin(k * .09 + strength * 7) * Math.sin(k * .031 + 1.7);
      const tone = clamp(samp(F, F.T, x, y) * 1.4);
      b[k] = (kind === 0 ? cfg.contourB * (.55 + .45 * face) * (.6 + .4 * tone) : cfg.innerB * (.4 + .6 * tone) * clamp(strength * 2.5)) * taper;
      w[k] = (kind === 0 ? lerp(cfg.contourW[0], cfg.contourW[1], face * vary) : lerp(cfg.innerW[0], cfg.innerW[1], clamp(strength * 2) * vary)) * (.3 + .7 * taper);
      o[k] = kind === 0 ? cfg.rim * Math.pow(face, 2) * .9 : kind === 2 ? 1 : 0;
    }
    out.push({ xy, n, b, o, d, s, w, len: acc, dir: 1, phase: 0, spd: .6, flags: FL.CONTOUR, id: 0 });
  };
  if (F.M && cfg.contour) {
    const g = new Float32Array(N), sil = new Float32Array(N), Mb = f.M;
    for (let y = 1; y < ah - 1; y++) for (let x = 1; x < aw - 1; x++) { const i = y * aw + x; g[i] = Math.hypot(Mb[i + 1] - Mb[i - 1], Mb[i + aw] - Mb[i - aw]); }
    for (let y = 1; y < ah - 1; y++) for (let x = 1; x < aw - 1; x++) {
      const i = y * aw + x, m = g[i]; if (m < .12) continue;
      const dx = Math.round((Mb[i + 1] - Mb[i - 1]) / m), dy = Math.round((Mb[i + aw] - Mb[i - aw]) / m);
      if (m >= g[i + dy * aw + dx] && m >= g[i - dy * aw - dx]) sil[i] = Math.min(1, m);
    }
    for (const ch of edgeChains(F, { E: sil, hi: .25, lo: .1, minLen: 14, smooth: 5 })) mk(ch.pts, 0, ch.s);
  }
  if (cfg.innerEdges) {
    const Ein = new Float32Array(N), sub = cfg.innerEverywhere ? null : f.subj;
    for (let i = 0; i < N; i++) Ein[i] = F.edge[i] * F.coh[i] * F.coh[i] * (sub ? sstep(.4, .8, sub[i]) : 1) * (1 - sstep(.3, .6, f.sky[i])) * (f.army ? 1 - sstep(.3, .5, f.army[i]) : 1);
    for (const ch of edgeChains(F, { E: Ein, hi: cfg.innerHi, lo: cfg.innerLo, minLen: 12, smooth: 3 })) mk(ch.pts, 1, ch.s);
  }
  if (f.river && cfg.river) {
    // the river's banks: the polygon edge as orange rim lines, broken where the land is dark
    const Rm = f.river, E = new Float32Array(N);
    for (let y = 1; y < ah - 1; y++) for (let x = 1; x < aw - 1; x++) { const i = y * aw + x; const gm = Math.hypot(Rm[i + 1] - Rm[i - 1], Rm[i + aw] - Rm[i - aw]); E[i] = gm > .08 ? gm : 0; }
    for (const ch of edgeChains(F, { E, hi: .12, lo: .05, minLen: 20, smooth: 6 })) {
      mk(ch.pts, 2, 1);
      const L = out[out.length - 1];
      for (let k = 0; k < L.n; k++) { const x = L.xy[k * 2], y = L.xy[k * 2 + 1], far = y / ah; L.b[k] = cfg.riverB * (.35 + .65 * sstep(.3, .9, far)) * (.75 + .5 * hash3(k >> 3, 5, 9)) * (L.b[k] > 0 ? 1 : 1); L.w[k] = lerp(.7, 1.9, sstep(.35, 1, far)); L.o[k] = 1; }
    }
  }
  return out;
}

// crowds: each figure a crisp spear tick with a bright tip, at the plate's figure positions (local brightness peaks
// inside the army mask). armyTicks returns DESCRIPTORS ({x, y, ex, ey, len, near, b, bt, w, wt, o, ot, d, ph}, analysis
// px); tickLines(desc, fx) turns them into lines, optionally animated per tick: fx(desc, i) -> {dx, dy, lean, lenK, bK}.
export function armyTicks(F, f, cfg) {
  if (!f.army) return [];
  const { aw, ah } = F, S = cfg.S, Lb = blur(F.L, aw, ah, 1.4), out = [], taken = new Uint8Array(aw * ah);
  const cand = [];
  for (let y = 2; y < ah - 2; y++) for (let x = 2; x < aw - 2; x++) {
    const i = y * aw + x; if (f.army[i] < .35) continue;
    const c = F.L[i] - Lb[i]; if (c < .02) continue;
    let mx = true; for (let j = -1; j <= 1 && mx; j++) for (let k = -1; k <= 1; k++) if ((j || k) && F.L[i + j * aw + k] - Lb[i + j * aw + k] > c) { mx = false; break; }
    if (mx) cand.push([c, x, y]);
  }
  cand.sort((a, b) => b[0] - a[0]);
  for (const [c, x, y] of cand) {
    const i = y * aw + x; if (taken[i]) continue;
    const dep = F.D ? F.D[i] : .5, near = sstep(.05, .5, dep), rad = Math.round(lerp(cfg.tickMin, cfg.tickMin * 2.5, near));
    for (let j = -rad; j <= rad; j++) for (let k = -rad; k <= rad; k++) { const q = (y + j) * aw + x + k; if (q >= 0 && q < taken.length) taken[q] = 1; }
    const len = lerp(cfg.tick[0], cfg.tick[1], near) / S, lean = (hash3(x, y, cfg.seed) - .5) * .14 + (cfg.tickLean || 0);
    const tone = clamp(F.T[i] * 1.3), red = F.R[i] - Math.max(F.G[i], F.B[i]) > .16 ? .55 : 0;
    out.push({ x, y, len, lean, near, b: (.55 + .5 * tone) * (cfg.tickGain ?? 1), bt: (1.5 + .5 * tone) * (cfg.tickGain ?? 1), w: lerp(.6, 1.0, near), wt: lerp(1.1, 1.8, near),
      o: red, ot: red ? 1 : .35 * (cfg.tipOrange ?? 1), d: f.Db ? f.Db[i] : .5, ph: hash3(x, y, cfg.seed + 5) * TAU, spd: 2 + 3 * hash3(x, y, 6), id: out.length });
  }
  return out;
}
export function tickLines(desc, fx = null) {
  const out = [];
  for (let i = 0; i < desc.length; i++) {
    const T = desc[i], A = fx ? fx(T, i) : null; if (A === false) continue;
    const lean = T.lean + (A ? A.lean || 0 : 0), len = T.len * (A ? A.lenK ?? 1 : 1), bK = A ? A.bK ?? 1 : 1;
    const x = T.x + (A ? A.dx || 0 : 0), y = T.y + (A ? A.dy || 0 : 0), ex = Math.sin(lean) * len, ey = -Math.cos(lean) * len;
    const mk = (pts, b, w, flags, o) => { const n = 2, xy = new Float32Array([pts[0][0], pts[0][1], pts[1][0], pts[1][1]]); out.push({ xy, n, b: new Float32Array(n).fill(b), o: new Float32Array(n).fill(o), d: new Float32Array(n).fill(T.d), s: new Float32Array(n), w: new Float32Array(n).fill(w), len: 1, dir: 1, phase: T.ph, spd: T.spd, flags, id: 0 }); };
    mk([[x - ex * .35, y - ey * .35], [x + ex * .65, y + ey * .65]], T.b * bK, T.w, FL.SHARP | FL.TICK, T.o);
    mk([[x + ex * .65, y + ey * .65], [x + ex * .66, y + ey * .66]], T.bt * bK * (A ? A.tipK ?? 1 : 1), T.wt, FL.SHARP | FL.TIP, T.ot);
  }
  return out;
}

// depth for the 3D lift: smoothed separately inside and outside the subject; the subject's relief compressed
export function liftDepth(F, cfg) {
  if (!F.D) return null;
  const { aw, ah, N } = F, m = new Float32Array(N), out = new Float32Array(N);
  for (let i = 0; i < N; i++) m[i] = F.M ? sstep(.3, .7, F.M[i]) : 0;
  for (const inside of [true, false]) {
    const w = new Float32Array(N), t = new Float32Array(N);
    for (let i = 0; i < N; i++) { w[i] = inside ? m[i] : 1 - m[i]; t[i] = F.D[i] * w[i]; }
    const num = blur(t, aw, ah, cfg.depthBlur), den = blur(w, aw, ah, cfg.depthBlur);
    for (let i = 0; i < N; i++) out[i] += w[i] * (den[i] > 1e-4 ? num[i] / den[i] : F.D[i]);
  }
  if (F.M) {
    const vals = []; for (let i = 0; i < N; i += 5) if (m[i] > .5) vals.push(out[i]);
    if (vals.length) { vals.sort((a, b) => a - b); const med = vals[vals.length >> 1]; for (let i = 0; i < N; i++) out[i] = lerp(out[i], med + (out[i] - med) * cfg.relief, m[i]); }
  }
  return out;
}
