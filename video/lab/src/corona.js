// corona.js: CORONA, the same flow field drawn as luminous field lines on navy-black (totality; reality breaks).
//
// Hierarchy (three tiers, all from the shared analysis):
//  1. the subject's silhouette (matte contour) and its coherent inner edges: bright, crisp, weighted, tapered lines;
//  2. interior form: evenly spaced streamlines (Jobard & Lefer) through the structure-tensor flow, spaced by tone (dense
//     in light, sparse in half-shade, absent in shadow), medium weight;
//  3. background: a sparse, dim field and a lot of black.
// The sky becomes a designed totality corona (limb rings, asymmetric helmet streamers, polar plumes, fibrils, small
// Hα prominences) around a perfectly crisp black disk. Crowds become structured light: one spear tick and a tip glint
// per figure. Lines are lifted to 3D from depth (orbit), pulses travel along them, and the kick thickens lines, pushes
// everything outward from the sun and can invert the frame for brass stabs.
// Temporal mode (video plates): seeds keep stable IDs and are advected by optical flow; fields are smoothed over time;
// new lines fade in. Lines do not boil.

import { W, H, TAU, clamp, lerp, sstep, hash3, hexRgb, s2l } from './core.js';
import { blur, samp, ellipseMask, edgeChains } from './analysis.js';
import { skyMask } from './sky.js';

export const DEFAULTS = {
  aw: 960,
  // streamlines: separation in analysis px (subject from tone; background its own sparse range)
  dsepMin: 2.2, dsepMax: 7.5, bgSepMin: 13, bgSepMax: 26, dtest: .5, step: .6, maxLen: 900, minLen: 22, maxTurn: 1.0, sepGamma: .8,
  shadowCut: .06, bgCut: .22, gamma: 1.2, gain: 1.1, bgGain: .3, darkCut: .04, depthFade: .45, weightVar: .35,
  subjBright: [.3, .95], width: [.55, 1.15],
  contour: 1, contourW: [1.2, 2.3], contourB: 1.3, innerEdges: 1, innerW: [.75, 1.25], innerB: .8,
  pool: null, poolMatte: 1, poolBlur: 8, subject: 'matte',
  lambda: 70, speed: .5, pulse: .5, kick: 0, kickWidth: 1.2, kickPush: 26, invert: 0,
  pearl: '#f3efe6', orange: '#f08a2a', red: '#d6452c', bg: '#05070c',
  rim: 1, lightDir: [-.75, -.66], horizon: 1, horizonBand: .035, glow: [.26, .1], exposure: 1.6, vignette: .35,
  yaw: 0, pitch: 0, zNear: 1, zFar: 2.6, skyZ: 1.25, focal: 1.2, overscan: 1, pivot: null, edgeFade: 40, depthBlur: 6, depthSmooth: 8, relief: .25,
  sky: null, sun: null, corona: 1, armies: 0, tick: [5, 13], seed: 3,
  temporal: 0, tAlpha: .45,
};

// ---------------------------------------------------------------- fields
function prepFields(F, cfg) {
  const { aw, ah, N } = F;
  const sky = cfg.sky ? skyMask(F, cfg.sky) : new Float32Array(N);
  const M = F.M ? blur(F.M, aw, ah, .7) : new Float32Array(N);
  // the subject: the matte, or (for crowds) the designed light pools
  let subj = new Float32Array(N);
  if (cfg.subject === 'matte' && F.M && cfg.poolMatte) for (let i = 0; i < N; i++) subj[i] = sstep(.3, .7, M[i]);
  if (cfg.pool) { let pl = new Float32Array(N); for (const e of cfg.pool) { const m = ellipseMask(F, e), k = e.k ?? 1; for (let i = 0; i < N; i++) pl[i] = Math.max(pl[i], m[i] * k); } pl = blur(pl, aw, ah, cfg.poolBlur); for (let i = 0; i < N; i++) subj[i] = Math.max(subj[i], pl[i]); }
  // tensor: fine where there is detail on the subject, coarse (long, calm lines) everywhere else
  const xx = new Float32Array(N), xy = new Float32Array(N), yy = new Float32Array(N);
  let trF = 0, trC = 0; for (let i = 0; i < N; i++) { trF += F.J.xx[i] + F.J.yy[i]; trC += F.Jc.xx[i] + F.Jc.yy[i]; }
  const kc = trF / Math.max(trC, 1e-9);
  for (let i = 0; i < N; i++) {
    const w = sstep(.2, .55, F.detail[i]) * sstep(.3, .8, subj[i]);
    xx[i] = w * F.J.xx[i] + (1 - w) * F.Jc.xx[i] * kc; xy[i] = w * F.J.xy[i] + (1 - w) * F.Jc.xy[i] * kc; yy[i] = w * F.J.yy[i] + (1 - w) * F.Jc.yy[i] * kc;
  }
  // brightness B, separation sep (analysis px), validity ok; dense in light, sparse in shade, nothing in shadow
  const B = new Float32Array(N), sep = new Float32Array(N), ok = new Float32Array(N), O = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = clamp((F.T[i] - cfg.darkCut) / (1 - cfg.darkCut)), s = subj[i];
    const tsub = sstep(cfg.shadowCut, 1, t), tbg = sstep(cfg.bgCut, 1, t);
    let bS = lerp(cfg.subjBright[0], cfg.subjBright[1], Math.pow(t, cfg.gamma)) * cfg.gain, bB = cfg.bgGain * Math.pow(t, cfg.gamma);
    if (F.D) bB *= lerp(1 - cfg.depthFade, 1, sstep(0, .6, F.D[i]));
    B[i] = lerp(bB, bS, s);
    const sS = lerp(cfg.dsepMax, cfg.dsepMin, Math.pow(tsub, cfg.sepGamma)), sB = lerp(cfg.bgSepMax, cfg.bgSepMin, tbg);
    sep[i] = lerp(sB, sS, s);
    ok[i] = Math.max(s > .5 ? tsub : 0, s <= .5 ? tbg : 0) > .01 ? 1 : 0;
  }
  // horizon band (the 360° totality glow): orange lines just under the horizon
  if (cfg.sky && cfg.horizon) {
    const band = cfg.horizonBand * ah;
    for (let x = 0; x < aw; x++) {
      let hy = 0; while (hy < ah && sky[hy * aw + x] > .5) hy++;
      if (hy >= ah || hy === 0) continue;
      for (let y = hy; y < Math.min(ah, hy + band * 3); y++) { const i = y * aw + x, k = Math.exp(-(y - hy) / band); O[i] = Math.max(O[i], k * cfg.horizon); B[i] = Math.max(B[i], .45 * k); ok[i] = Math.max(ok[i], k > .2 ? 1 : 0); sep[i] = Math.min(sep[i], lerp(sep[i], 5, k)); }
    }
  }
  // crowds (armies): no field lines there; the figures become ticks
  let army = null;
  if (cfg.armies) {
    army = new Float32Array(N);
    for (let i = 0; i < N; i++) army[i] = sstep(.42, .7, F.detail[i]) * sstep(.5, .9, subj[i]) * cfg.armies;
    army = blur(army, aw, ah, 2);
    for (let i = 0; i < N; i++) if (army[i] > .35) ok[i] = 0;
  }
  // the sky carries only the designed corona
  for (let i = 0; i < N; i++) if (sky[i] > .5) ok[i] = 0;
  let sun = null;
  if (cfg.sky && cfg.sun) { const s = cfg.sun; sun = { x: s.x * aw, y: s.y * ah, r: s.r * aw, tilt: s.tilt ?? .5 }; }
  return { xx, xy, yy, B, sep, ok, O, sky, sun, subj, M, army };
}

// temporal smoothing: exponential moving average of the fields that shape the lines
function smoothFields(f, prev, a) {
  if (!prev) return f;
  for (const k of ['xx', 'xy', 'yy', 'B', 'sep', 'O', 'M', 'subj']) { const A = f[k], P = prev[k]; if (!A || !P || A.length !== P.length) continue; for (let i = 0; i < A.length; i++) A[i] = a * A[i] + (1 - a) * P[i]; }
  return f;
}

function dirAt(F, f, x, y, out) {
  const a = samp(F, f.xx, x, y), b = samp(F, f.xy, x, y), c = samp(F, f.yy, x, y);
  const th = .5 * Math.atan2(2 * b, a - c) + Math.PI / 2;
  out[0] = Math.cos(th); out[1] = Math.sin(th);
}

// ---------------------------------------------------------------- evenly spaced streamlines (Jobard & Lefer 1997)
// seeds (optional): [{id, x, y}] traced first, in ID order (temporal coherence: old lines keep priority)
export function traceLines(F, f, cfg, seeds = null, state = null) {
  const { aw, ah } = F, cell = cfg.dsepMin, gw = Math.ceil(aw / cell) + 1, gh = Math.ceil(ah / cell) + 1;
  const grid = Array.from({ length: gw * gh }, () => []);
  const PX = [], PY = [], PL = [], PI = [];
  const lines = [], v = [0, 0], v2 = [0, 0];
  const sepAt = (x, y) => samp(F, f.sep, x, y), okAt = (x, y) => samp(F, f.ok, x, y) > .5;
  const D = F.D, sun = f.sun;
  const blocked = (x, y) => sun && Math.hypot(x - sun.x, y - sun.y) < sun.r * 1.02;
  const tooClose = (x, y, d, lid, idx) => {
    const r = Math.ceil(d / cell), cx = Math.floor(x / cell), cy = Math.floor(y / cell), d2 = d * d, near = Math.ceil(2.5 * d / cfg.step);
    for (let j = Math.max(0, cy - r); j <= Math.min(gh - 1, cy + r); j++) for (let i = Math.max(0, cx - r); i <= Math.min(gw - 1, cx + r); i++) {
      const c = grid[j * gw + i];
      for (let k = 0; k < c.length; k++) { const p = c[k]; if (PL[p] === lid && Math.abs(PI[p] - idx) < near) continue; const dx = PX[p] - x, dy = PY[p] - y; if (dx * dx + dy * dy < d2) return true; }
    }
    return false;
  };
  const insert = (x, y, lid, idx) => { const p = PX.length; PX.push(x); PY.push(y); PL.push(lid); PI.push(idx); grid[Math.floor(y / cell) * gw + Math.floor(x / cell)].push(p); };
  let nextId = state ? state.nextId : 1;
  const grow = (x0, y0, id) => {
    if (x0 < 1 || y0 < 1 || x0 > aw - 2 || y0 > ah - 2 || blocked(x0, y0) || !okAt(x0, y0)) return null;
    const lid = lines.length;
    if (tooClose(x0, y0, sepAt(x0, y0) * .95, lid, 0)) return null;
    const start = PX.length;
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
      for (let p = PX.length - 1; p >= start; p--) grid[Math.floor(PY[p] / cell) * gw + Math.floor(PX[p] / cell)].pop();
      PX.length = PY.length = PL.length = PI.length = start;
      return null;
    }
    const b = branches[1], xy = new Float32Array(n * 2);
    let o = 0;
    for (let k = b.length - 2; k >= 0; k -= 2) { xy[o++] = b[k]; xy[o++] = b[k + 1]; }
    xy[o++] = x0; xy[o++] = y0;
    for (let k = 0; k < branches[0].length; k++) xy[o++] = branches[0][k];
    const L = { xy, n, seedIdx: b.length / 2, x0, y0, id: id ?? nextId++, age: state ? 0 : undefined };
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
  // 1. persistent seeds first (stable order), 2. their neighbours, 3. an importance-ordered scan for islands
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

// per-vertex attributes for streamlines (tier 2/3): brightness, orange, depth, arc length from the seed, width
function decorate(F, f, lines, cfg) {
  const S = W / F.aw;
  for (const L of lines) {
    const n = L.n, b = new Float32Array(n), o = new Float32Array(n), d = new Float32Array(n), s = new Float32Array(n), w = new Float32Array(n);
    let acc = 0; const arc = new Float32Array(n);
    for (let k = 1; k < n; k++) { acc += Math.hypot(L.xy[k * 2] - L.xy[k * 2 - 2], L.xy[k * 2 + 1] - L.xy[k * 2 - 1]) * S; arc[k] = acc; }
    const s0 = arc[L.seedIdx] || 0;
    const wgt = 1 + cfg.weightVar * (Math.pow(hash3(L.id, 11, cfg.seed), 3) * 2.2 - .55);
    for (let k = 0; k < n; k++) {
      const x = L.xy[k * 2], y = L.xy[k * 2 + 1];
      const edge = Math.min(x, y, F.aw - 1 - x, F.ah - 1 - y);
      const e = Math.min(arc[k], acc - arc[k]);
      b[k] = samp(F, f.B, x, y) * sstep(0, cfg.edgeFade, edge) * sstep(0, 10, e) * wgt * Math.min(1, .35 + .65 * (L.age ?? 3) / 3);
      o[k] = samp(F, f.O, x, y);
      d[k] = f.Db ? samp(F, f.Db, x, y) : .5;
      s[k] = arc[k] - s0;
      w[k] = lerp(cfg.width[0], cfg.width[1], clamp(b[k]));
    }
    if (cfg.depthSmooth > 0 && n > 2) {
      const r = cfg.depthSmooth, tmp = d.slice();
      for (let k = 0; k < n; k++) { let a = 0, ws = 0; for (let j = Math.max(0, k - r); j <= Math.min(n - 1, k + r); j++) { const q = 1 - Math.abs(j - k) / (r + 1); a += tmp[j] * q; ws += q; } d[k] = a / ws; }
    }
    // pulses travel upward on the land (plasma rising)
    const dir = L.xy[n * 2 - 1] <= L.xy[1] ? 1 : -1;
    Object.assign(L, { b, o, d, s, w, len: acc, dir, phase: hash3(L.id, 7, cfg.seed) * TAU, spd: .75 + .5 * hash3(L.id, 9, cfg.seed) });
  }
  return lines;
}

// tier 1: the silhouette and the coherent inner edges as weighted, tapered contour lines (pulses run across space, so
// they stay stable when chains re-break from frame to frame)
function contourLines(F, f, cfg) {
  const { aw, ah, N } = F, out = [], S = W / aw;
  if (!F.M && !cfg.innerEdges) return out;
  const ld = Math.hypot(cfg.lightDir[0], cfg.lightDir[1]) || 1, Lx = cfg.lightDir[0] / ld, Ly = cfg.lightDir[1] / ld;
  const mk = (pts, kind, strength) => {
    const n = pts.length; if (n < 2) return;
    const xy = new Float32Array(n * 2), b = new Float32Array(n), o = new Float32Array(n), d = new Float32Array(n), s = new Float32Array(n), w = new Float32Array(n);
    let acc = 0;
    for (let k = 0; k < n; k++) {
      const [x, y] = pts[k]; xy[k * 2] = x; xy[k * 2 + 1] = y;
      if (k) acc += Math.hypot(x - pts[k - 1][0], y - pts[k - 1][1]) * S;
      s[k] = (x * .7 + y * .7) * S;                                     // spatial phase: travelling bands across the subject
      // depth: a contour sits on the depth discontinuity, so sample a few px inside the subject (not across the edge)
      let sx = x, sy = y;
      if (kind === 0 && f.M) {
        const gx = samp(F, f.M, x + 1, y) - samp(F, f.M, x - 1, y), gy = samp(F, f.M, x, y + 1) - samp(F, f.M, x, y - 1), gm = Math.hypot(gx, gy) || 1;
        for (const o of [4, 3, 2, 1]) { const qx = x + gx / gm * o, qy = y + gy / gm * o; if (samp(F, f.M, qx, qy) > .6) { sx = qx; sy = qy; break; } }   // thin objects: stay inside
      }
      d[k] = f.Db ? samp(F, f.Db, sx, sy) : .5;
    }
    if (n > 2) { const r = 6, tmp = d.slice(); for (let k = 0; k < n; k++) { let a = 0, ws = 0; for (let j = Math.max(0, k - r); j <= Math.min(n - 1, k + r); j++) { const q = 1 - Math.abs(j - k) / (r + 1); a += tmp[j] * q; ws += q; } d[k] = a / ws; } }
    for (let k = 0; k < n; k++) {
      const [x, y] = pts[k], u = Math.min(acc ? (k / (n - 1)) : 0, 1), taper = Math.pow(Math.min(1, Math.min(u, 1 - u) * 5), .6);
      const k0 = Math.max(0, k - 2), k1 = Math.min(n - 1, k + 2), tx = pts[k1][0] - pts[k0][0], ty = pts[k1][1] - pts[k0][1], tm = Math.hypot(tx, ty) || 1;
      // weight: stronger where the edge is strong and where it faces the light; slow variation along the line
      let face = 0;
      if (kind === 0 && f.M) { const gx = samp(F, f.M, x + 1, y) - samp(F, f.M, x - 1, y), gy = samp(F, f.M, x, y + 1) - samp(F, f.M, x, y - 1), gm = Math.hypot(gx, gy) || 1; face = Math.max(0, (-gx / gm) * Lx + (-gy / gm) * Ly); }
      const vary = .8 + .4 * Math.sin(k * .09 + strength * 7) * Math.sin(k * .031 + 1.7);
      const tone = clamp(samp(F, F.T, x, y) * 1.4);
      b[k] = (kind === 0 ? cfg.contourB * (.55 + .45 * face) * (.6 + .4 * tone) : cfg.innerB * (.4 + .6 * tone) * clamp(strength * 2.5)) * taper;
      w[k] = (kind === 0 ? lerp(cfg.contourW[0], cfg.contourW[1], face * vary) : lerp(cfg.innerW[0], cfg.innerW[1], clamp(strength * 2) * vary)) * (.3 + .7 * taper);
      o[k] = kind === 0 ? cfg.rim * Math.pow(face, 2) * .9 : 0;
    }
    out.push({ xy, n, b, o, d, s, w, len: acc, dir: 1, phase: 0, spd: .6, contour: true });
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
    const Ein = new Float32Array(N);
    for (let i = 0; i < N; i++) Ein[i] = F.edge[i] * F.coh[i] * F.coh[i] * sstep(.4, .8, f.subj[i]) * (1 - sstep(.3, .6, f.sky[i]));
    for (const ch of edgeChains(F, { E: Ein, hi: .2, lo: .085, minLen: 12, smooth: 3 })) mk(ch.pts, 1, ch.s);
  }
  return out;
}

// the corona, designed after totality photographs and drawn as field lines
function coronaLines(F, f, cfg) {
  const sun = f.sun; if (!sun || !cfg.corona) return [];
  const R = sun.r, out = [], S = W / F.aw, sd = cfg.seed * 977 + 13, h = (a, b) => hash3(a, b, sd);
  const inSky = (x, y) => x >= 0 && y >= 0 && x < F.aw - 1 && y < F.ah - 1 && samp(F, f.sky, x, y) > .5;
  // a polyline from a polar path, split wherever the land occludes it; bFn/wFn/oFn give per-vertex brightness/width/tint
  const polar = (path, n, bFn, wFn, oFn, extra = {}) => {
    let cur = [];
    const flush = () => {
      if (cur.length >= 2) {
        const m = cur.length, xy = new Float32Array(m * 2), b = new Float32Array(m), w = new Float32Array(m), o = new Float32Array(m), d = new Float32Array(m).fill(-1), s = new Float32Array(m);
        cur.forEach((c, k) => { xy[k * 2] = c.x; xy[k * 2 + 1] = c.y; b[k] = c.b; w[k] = c.w; o[k] = c.o; s[k] = c.s; });
        out.push({ xy, n: m, b, w, o, d, s, len: s[m - 1], dir: 1, phase: h(out.length, 3) * TAU, spd: .8 + .4 * h(out.length, 4), sky: true, ...extra });
      }
      cur = [];
    };
    let acc = 0, px = null, py = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n, [r, phi] = path(t), x = sun.x + Math.cos(phi) * r, y = sun.y + Math.sin(phi) * r;
      if (px !== null) acc += Math.hypot(x - px, y - py) * S;
      px = x; py = y;
      if (!inSky(x, y)) { flush(); continue; }
      cur.push({ x, y, b: bFn(t, r), w: wFn(t, r), o: oFn ? oFn(t) : .04, s: acc });
    }
    flush();
  };
  const tilt = sun.tilt, warm = .04;
  // limb: a thin, intensely bright inner ring and a fainter second ring
  polar(t => [R * 1.012, t * TAU], 360, t => 2.4 * (.85 + .3 * h(Math.floor(t * 48), 1)), () => 1.5, () => warm, { ring: true });
  polar(t => [R * 1.045, t * TAU], 360, t => .95 * (.7 + .5 * h(Math.floor(t * 30), 2)), () => .9, () => warm);
  // helmet streamers: a bulbous base of nested loops, then a bundle of open lines that converges slowly (never to a
  // point) and frays out at ragged radii. Five, asymmetric: two big equatorial wings, three smaller.
  const streamers = cfg.streamers || [[.12, 3.4, .5, 1], [3.02, 2.8, .42, .85], [3.8, 1.6, .26, .5], [-.8, 2.1, .3, .58], [1.85, 1.25, .22, .42]];
  streamers.forEach(([da, len, ws, bs], si) => {
    const ph = tilt + da, dome = q => R * (.08 + .55 * Math.max(0, 1 - Math.pow(q, 2)));     // helmet height over the foot point
    for (let j = 0; j < 20; j++) {                                          // the helmet: the brightest part of a streamer
      const dl = ws * (.14 + .044 * j), hh = R * (.04 + .46 * Math.pow(dl / ws, 1.4));
      polar(t => [R * 1.01 + hh * Math.pow(Math.sin(Math.PI * t), .8), ph - dl + 2 * dl * t], 60, (t, r) => bs * 1.9 * Math.pow(R / r, 1.0) * (.75 + .5 * h(si * 90 + j, 40)), () => .8, () => warm);
    }
    const nOpen = 30;
    for (let m = 0; m < nOpen; m++) {
      const u = (m + .5) / nOpen * 2 - 1, phi0 = ph + u * ws * 1.25 + .05 * ws * (h(si * 50 + m, 5) - .5), q = Math.abs(u) / .9;
      const r0 = R * 1.01 + (q < 1 ? dome(q) : 0), rEnd = R * (1 + len * (.3 + .7 * Math.pow(h(si * 50 + m, 6), .7))), fib = .45 + 1.0 * h(si * 50 + m, 7);
      polar(t => { const r = lerp(r0, rEnd, Math.pow(t, 1.25)); return [r, ph + (phi0 - ph) * (.36 + .64 * Math.pow(R / r, 1.25))]; }, 90,
        (t, r) => bs * 1.3 * fib * Math.pow(R / r, 1.5) * (1 - sstep(.6, 1, t)), (t) => lerp(.95, .55, t), () => warm);
    }
  });
  // faint outer rays between the streamers: the corona's extent without spikes
  for (let m = 0; m < 70; m++) {
    const phi0 = h(m, 30) * TAU, rEnd = R * (1.6 + 1.2 * h(m, 31));
    polar(t => [lerp(R * 1.05, rEnd, t), phi0 + .04 * (h(m, 32) - .5) * t], 30, (t, r) => .32 * (.4 + h(m, 33)) * Math.pow(R / r, 1.8) * (1 - sstep(.5, 1, t)), () => .55, () => warm);
  }
  // polar plumes: fine, near-straight, slightly superradial brush lines at both poles
  for (const pole of [tilt - Math.PI / 2, tilt + Math.PI / 2]) for (let m = 0; m < 30; m++) {
    const phi0 = pole + (m / 29 - .5) * 1.0 + .03 * (h(m, pole > tilt ? 9 : 10) - .5), rEnd = R * (1.3 + .8 * h(m, pole > tilt ? 11 : 12));
    polar(t => { const r = lerp(R * 1.02, rEnd, t); return [r, phi0 + (phi0 - pole) * .4 * (r - R) / R]; }, 40, (t, r) => .6 * (.5 + .9 * h(m, 13)) * Math.pow(R / r, 2.3) * (1 - sstep(.6, 1, t)), () => .6, () => warm);
  }
  // fibrils: the dense fine radial texture of the inner corona, a fuzzy halo hugging the limb
  for (let m = 0; m < 420; m++) {
    const phi0 = h(m, 14) * TAU, rEnd = R * (1.06 + .55 * Math.pow(h(m, 15), 2.2));
    polar(t => [lerp(R * 1.015, rEnd, t), phi0], 12, (t, r) => .95 * (.3 + h(m, 16)) * Math.pow(R / r, 3.2) * (1 - sstep(.45, 1, t)), () => .52, () => warm);
  }
  // prominences: two or three tiny arches of Hα red on the limb
  const proms = cfg.prominences || [[1.15, .07, .11], [2.25, .05, .07], [-2.45, .085, .13]];
  proms.forEach(([da, dw, hh], pi) => {
    for (let j = 0; j < 4; j++) {
      const dl = dw * (.55 + .15 * j), ht = R * hh * (.7 + .12 * j);
      polar(t => [R * 1.0 + ht * Math.sin(Math.PI * t), tilt + da - dl + 2 * dl * t], 24, () => 1.7, () => 1.05, () => 1.9);
    }
  });
  return out;
}

// crowds: each figure a crisp spear tick with a bright tip, at the plate's figure positions (Altdorfer's massed troops, in light)
function armyTicks(F, f, cfg) {
  if (!f.army) return [];
  const { aw, ah } = F, S = W / aw, Lb = blur(F.L, aw, ah, 1.4), out = [], taken = new Uint8Array(aw * ah);
  const cand = [];
  for (let y = 2; y < ah - 2; y++) for (let x = 2; x < aw - 2; x++) {
    const i = y * aw + x; if (f.army[i] < .35) continue;
    const c = Math.abs(F.L[i] - Lb[i]); if (c < .03) continue;
    let mx = true; for (let j = -1; j <= 1 && mx; j++) for (let k = -1; k <= 1; k++) if ((j || k) && Math.abs(F.L[i + j * aw + k] - Lb[i + j * aw + k]) > c) { mx = false; break; }
    if (mx) cand.push([c, x, y]);
  }
  cand.sort((a, b) => b[0] - a[0]);
  for (const [c, x, y] of cand) {
    const i = y * aw + x; if (taken[i]) continue;
    for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) { const q = (y + j) * aw + x + k; if (q >= 0 && q < taken.length) taken[q] = 1; }
    const dep = f.Db ? f.Db[i] : .5, len = lerp(cfg.tick[0], cfg.tick[1], sstep(.05, .3, F.D ? F.D[i] : .5)) / S, lean = (hash3(x, y, cfg.seed) - .5) * .12;
    const ex = Math.sin(lean) * len, ey = -Math.cos(lean) * len;
    const tone = clamp(F.T[i] * 1.3), red = F.R[i] - Math.max(F.G[i], F.B[i]) > .16 ? .9 : 0, b = .65 + .45 * tone, bd = (dep - .2);
    const mkL = (pts, bb, ww, sharpTip) => {
      const n = pts.length, xy = new Float32Array(n * 2); pts.forEach((p, k) => { xy[k * 2] = p[0]; xy[k * 2 + 1] = p[1]; });
      out.push({ xy, n, b: new Float32Array(n).fill(bb), o: new Float32Array(n).fill(red), d: new Float32Array(n).fill(dep), s: new Float32Array(n), w: new Float32Array(n).fill(ww), len: 1, dir: 1, phase: hash3(x, y, cfg.seed + 5) * TAU, spd: 2 + 3 * hash3(x, y, 6), sharp: true, tip: sharpTip });
    };
    mkL([[x - ex * .3, y - ey * .3], [x + ex * .7, y + ey * .7]], b, .78, false);
    mkL([[x + ex * .7 - .12, y + ey * .7], [x + ex * .7 + .12, y + ey * .7]], 1.5 + .4 * tone, 1.35, true);
    void bd;
  }
  return out;
}

// ---------------------------------------------------------------- camera: lift to 3D from depth, orbit a pivot
function camera(F, cfg) {
  const S = W / F.aw, f = cfg.focal * W, cx = W / 2, cy = H / 2;
  const zn = cfg.zNear, zf = cfg.zFar, zOf = D => D < 0 ? zf * cfg.skyZ : 1 / (D * (1 / zn - 1 / zf) + 1 / zf);
  let Dp = cfg.pivot;
  if (Dp == null) {
    const vals = [];
    if (F.M && F.D) for (let i = 0; i < F.N; i += 7) if (F.M[i] > .5) vals.push(F.D[i]);
    if (!vals.length && F.D) for (let y = F.ah * .3 | 0; y < F.ah * .7; y += 4) for (let x = F.aw * .3 | 0; x < F.aw * .7; x += 4) vals.push(F.D[y * F.aw + x]);
    vals.sort((a, b) => a - b); Dp = vals.length ? vals[vals.length >> 1] : .5;
  }
  const zp = zOf(Dp), yaw = cfg.yaw * Math.PI / 180, pitch = cfg.pitch * Math.PI / 180;
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return (x, y, D, out) => {
    const z = zOf(D), X = (x * S - cx) / f * z, Y = (y * S - cy) / f * z, Z = z - zp;
    const x1 = X * cyw + Z * syw, z1 = -X * syw + Z * cyw;
    const y2 = Y * cp - z1 * sp, z2 = Y * sp + z1 * cp + zp;
    out[0] = cx + f * cfg.overscan * x1 / z2; out[1] = cy + f * cfg.overscan * y2 / z2; out[2] = z2;
    return out;
  };
}

// ---------------------------------------------------------------- GPU
const LINE_VS = `#version 300 es
in vec2 aPos; in vec4 aA; in vec4 aB;
uniform vec2 uRes;
out vec4 vA; out vec4 vB;
void main() { vA = aA; vB = aB; gl_Position = vec4(aPos / uRes * 2.0 - 1.0, 0.0, 1.0); }`;

const LINE_FS = `#version 300 es
precision highp float;
in vec4 vA; in vec4 vB;
uniform float uT, uLambda, uSpeed, uPulse, uKick;
uniform vec3 uPearl, uOrange, uRed;
out vec4 o;
void main() {
  float v = vA.x, s = vA.y, b = vA.z, org = vA.w, phase = vB.x, hw = vB.y, spd = vB.z;
  float dpx = abs(v) * (hw + 1.0);
  float cov = clamp(hw + 0.5 - dpx, 0.0, 1.0) * min(1.0, 2.0 * hw);
  if (cov <= 0.002) discard;
  float lam = uLambda * (1.0 - 0.35 * uKick);
  float w = 0.5 + 0.5 * cos(6.2831853 * (s / lam - uT * uSpeed * spd) + phase);
  float pulse = (1.0 - uPulse) + uPulse * 1.7 * pow(w, mix(1.6, 6.0, uKick));
  float I = b * pulse * (1.0 + 0.9 * uKick);
  vec3 col = org <= 1.0 ? mix(uPearl, uOrange, org) : mix(uOrange, uRed, min(1.0, org - 1.0));
  o = vec4(col * I * cov, 1.0);
}`;

const DOWN_FS = `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uSrc; uniform vec2 uTexel; out vec4 o;
void main() { vec2 d = uTexel * 0.5;
  o = 0.25 * (texture(uSrc, vUv + vec2(-d.x, -d.y)) + texture(uSrc, vUv + vec2(d.x, -d.y)) + texture(uSrc, vUv + vec2(-d.x, d.y)) + texture(uSrc, vUv + vec2(d.x, d.y))); }`;

const BLUR_FS = `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uSrc; uniform vec2 uDir; out vec4 o;
void main() {
  const float w0 = 0.1205, w1 = 0.2101, w2 = 0.1460, w3 = 0.0727, w4 = 0.0254;
  const float o1 = 1.4697, o2 = 3.4291, o3 = 5.3884, o4 = 7.3488;
  vec4 c = texture(uSrc, vUv) * w0;
  c += (texture(uSrc, vUv + uDir * o1) + texture(uSrc, vUv - uDir * o1)) * w1;
  c += (texture(uSrc, vUv + uDir * o2) + texture(uSrc, vUv - uDir * o2)) * w2;
  c += (texture(uSrc, vUv + uDir * o3) + texture(uSrc, vUv - uDir * o3)) * w3;
  c += (texture(uSrc, vUv + uDir * o4) + texture(uSrc, vUv - uDir * o4)) * w4;
  o = c / (w0 + 2.0 * (w1 + w2 + w3 + w4));
}`;

// lines + restrained glow + sharp (unglowed) lines; a perfectly crisp black disk; optional inversion (black on pearl)
const POST_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uLines, uSharp, uG1, uG2; uniform vec3 uBg, uPearl; uniform float uExposure, uW1, uW2, uVig, uFlip, uInvert;
uniform vec3 uDisk;
uniform vec2 uRes;
out vec4 o;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 l2s(vec3 c) { c = max(c, 0.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
void main() {
  vec2 uv = vUv; if (uFlip > 0.5) uv.y = 1.0 - uv.y;
  vec3 c = texture(uLines, uv).rgb + texture(uSharp, uv).rgb + uW1 * texture(uG1, uv).rgb + uW2 * texture(uG2, uv).rgb;
  vec2 p = uv * uRes;
  if (uDisk.z > 0.0) { float dk = length(p - uDisk.xy) - uDisk.z; c *= smoothstep(-0.6, 0.6, dk); }
  c = 1.0 - exp(-c * uExposure);
  vec2 q = (uv - 0.5) * vec2(1.0, 0.8);
  float vig = 1.0 - uVig * pow(clamp(length(q) * 1.4, 0.0, 1.0), 2.0);
  vec3 bg = uBg * vig;
  vec3 lin = bg + c * (1.0 - bg);
  if (uInvert > 0.5) lin = uPearl * (1.0 - 0.94 * clamp(dot(c, vec3(0.3333)) * 1.25, 0.0, 1.0)) * mix(0.92, 1.0, vig);
  o = vec4(l2s(lin) + (hash12(p) - 0.5) / 255.0, 1.0);
}`;

let TL = null, TS = null, TH = [], TQ = [];
function targets(glw) {
  if (TL) return;
  TL = glw.target(W, H, 'rgba16f'); TS = glw.target(W, H, 'rgba16f');
  TH = [glw.target(W / 2, H / 2, 'rgba16f'), glw.target(W / 2, H / 2, 'rgba16f')];
  TQ = [glw.target(W / 4, H / 4, 'rgba16f'), glw.target(W / 4, H / 4, 'rgba16f')];
}

// ---------------------------------------------------------------- lines for a frame (cached for stills, stateful for video)
const cache = new Map(), temporalState = new Map();
// depth for the 3D lift: smoothed separately inside and outside the subject (the silhouette's depth step survives, the
// depth map's texture does not), and the subject's internal relief compressed around its median: the orbit should turn
// the figures as low reliefs, not crumple them with depth-map noise
function liftDepth(F, cfg) {
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

function buildLines(F, cfg, seeds, state) {
  const f = prepFields(F, cfg);
  if (state && cfg.temporal) smoothFields(f, state.prev, cfg.tAlpha);
  f.Db = liftDepth(F, cfg);
  const stream = decorate(F, f, traceLines(F, f, cfg, seeds, state), cfg);
  const lines = [...stream, ...contourLines(F, f, cfg), ...coronaLines(F, f, cfg), ...armyTicks(F, f, cfg)];
  return { f, stream, lines };
}
export function prepare(F, cfg) {
  const key = F.plate + '|' + JSON.stringify(F.win) + '|' + F.aw + '|' + JSON.stringify({ ...cfg, yaw: 0, pitch: 0, kick: 0, invert: 0, t: 0 });
  let c = cache.get(key);
  if (!c) {
    const t0 = performance.now();
    c = buildLines(F, cfg, null, null);
    c.ms = Math.round(performance.now() - t0);
    if (cache.size > 3) cache.delete(cache.keys().next().value);
    cache.set(key, c);
  }
  return c;
}

async function loadFlow(url) {
  try { const r = await fetch(url); if (!r.ok) return null; return new Float32Array(await r.arrayBuffer()); } catch (e) { return null; }
}

// temporal: seeds advected by optical flow from the previous frame, fields smoothed over time
async function prepareTemporal(F, cfg, tctx) {
  let st = temporalState.get(tctx.key);
  if (!st || tctx.frame !== st.frame + 1) st = { frame: tctx.frame - 1, seeds: null, prev: null, nextId: 1 };
  let seeds = null;
  if (st.seeds && tctx.flowUrl) {
    const fl = await loadFlow(tctx.flowUrl), [fw, fh] = tctx.flowSize || [480, 270];
    seeds = st.seeds.map(s => {
      if (!fl) return s;
      const u = clamp(s.x / F.aw * fw - .5, 0, fw - 1.001), v = clamp(s.y / F.ah * fh - .5, 0, fh - 1.001), xi = u | 0, yi = v | 0, ax = u - xi, ay = v - yi;
      const at = (xx, yy, c) => fl[(yy * fw + xx) * 2 + c];
      const dx = (at(xi, yi, 0) * (1 - ax) + at(xi + 1, yi, 0) * ax) * (1 - ay) + (at(xi, yi + 1, 0) * (1 - ax) + at(xi + 1, yi + 1, 0) * ax) * ay;
      const dy = (at(xi, yi, 1) * (1 - ax) + at(xi + 1, yi, 1) * ax) * (1 - ay) + (at(xi, yi + 1, 1) * (1 - ax) + at(xi + 1, yi + 1, 1) * ax) * ay;
      return { ...s, x: s.x + dx * F.aw, y: s.y + dy * F.ah };
    });
  } else if (st.seeds) seeds = st.seeds;
  const t0 = performance.now();
  const c = buildLines(F, cfg, seeds, st);
  c.ms = Math.round(performance.now() - t0);
  st.seeds = c.stream.map(L => ({ id: L.id, x: L.x0, y: L.y0, age: L.age ?? 0 }));
  st.prev = c.f; st.frame = tctx.frame;
  temporalState.set(tctx.key, st);
  return c;
}

export async function render(glw, F, cfg, ctx) {
  const ms = {};
  let t0 = performance.now();
  const c = ctx.temporal ? await prepareTemporal(F, cfg, ctx.temporal) : prepare(F, cfg);
  ms.lines = Math.round(performance.now() - t0);
  t0 = performance.now();
  targets(glw);
  const proj = camera(F, cfg), p = [0, 0, 0], S = W / F.aw;
  // the sun on screen (sky depth), for the black disk and the kick's radial push
  let sunS = null;
  if (c.f.sun) { proj(c.f.sun.x, c.f.sun.y, -1, p); sunS = [p[0], p[1], c.f.sun.r * S * cfg.overscan]; }
  const push = cfg.kickPush * cfg.kick, pushC = sunS || [W / 2, H / 2], wk = 1 + cfg.kickWidth * cfg.kick;
  const meshOf = sharp => {
    let nv = 0, ni = 0;
    for (const L of c.lines) if (!!L.sharp === sharp) { nv += L.n * 2; ni += (L.n - 1) * 6; }
    const pos = new Float32Array(nv * 2), A = new Float32Array(nv * 4), Bv = new Float32Array(nv * 4), idx = new Uint32Array(ni);
    let vi = 0, ii = 0, Q = new Float32Array(8192);
    for (const L of c.lines) {
      if (!!L.sharp !== sharp) continue;
      const n = L.n; if (n * 2 > Q.length) Q = new Float32Array(n * 2);
      for (let k = 0; k < n; k++) {
        proj(L.xy[k * 2], L.xy[k * 2 + 1], L.d[k], p);
        if (push) { const dx = p[0] - pushC[0], dy = p[1] - pushC[1], dd = Math.hypot(dx, dy) || 1, a = push * (.4 + .6 * Math.exp(-dd / 500)); p[0] += dx / dd * a; p[1] += dy / dd * a; }
        Q[k * 2] = p[0]; Q[k * 2 + 1] = p[1];
      }
      if (L.tip) { const mx = (Q[0] + Q[2]) / 2, my = (Q[1] + Q[3]) / 2; Q[0] = mx - .5; Q[2] = mx + .5; Q[1] = Q[3] = my; }
      const base = vi;
      for (let k = 0; k < n; k++) {
        const k0 = Math.max(0, k - 1), k1 = Math.min(n - 1, k + 1);
        let tx = Q[k1 * 2] - Q[k0 * 2], ty = Q[k1 * 2 + 1] - Q[k0 * 2 + 1]; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
        const hw = .5 * L.w[k] * wk, ext = hw + 1, s = L.dir > 0 ? L.s[k] : L.len - L.s[k];
        for (const sd of [-1, 1]) {
          pos[vi * 2] = Q[k * 2] - ty * ext * sd; pos[vi * 2 + 1] = Q[k * 2 + 1] + tx * ext * sd;
          A[vi * 4] = sd; A[vi * 4 + 1] = s; A[vi * 4 + 2] = L.b[k]; A[vi * 4 + 3] = L.o[k];
          Bv[vi * 4] = L.phase; Bv[vi * 4 + 1] = hw; Bv[vi * 4 + 2] = L.spd; Bv[vi * 4 + 3] = 0;
          vi++;
        }
      }
      for (let k = 0; k < n - 1; k++) { const q = base + k * 2; idx[ii++] = q; idx[ii++] = q + 1; idx[ii++] = q + 2; idx[ii++] = q + 1; idx[ii++] = q + 3; idx[ii++] = q + 2; }
    }
    return { pos, A, Bv, idx, nv };
  };
  const lin = h => hexRgb(h).map(s2l);
  const PRG = glw.program(LINE_VS, LINE_FS);
  const uni = { uT: ctx.t ?? 0, uLambda: cfg.lambda, uSpeed: cfg.speed, uPulse: cfg.pulse, uKick: cfg.kick, uPearl: lin(cfg.pearl), uOrange: lin(cfg.orange), uRed: lin(cfg.red) };
  let nVerts = 0;
  for (const [sharp, T] of [[false, TL], [true, TS]]) {
    glw.clear(T, [0, 0, 0, 0]);
    const m = meshOf(sharp); nVerts += m.nv;
    if (!m.nv) continue;
    const M = glw.mesh(PRG, { aPos: { data: m.pos, size: 2 }, aA: { data: m.A, size: 4 }, aB: { data: m.Bv, size: 4 } }, m.idx);
    glw.draw(PRG, M, uni, T, 'add'); M.dispose();
  }
  ms.mesh = Math.round(performance.now() - t0);
  t0 = performance.now();
  glw.pass(DOWN_FS, { uSrc: TL.tex[0], uTexel: [1 / W, 1 / H] }, TH[0]);
  glw.pass(BLUR_FS, { uSrc: TH[0].tex[0], uDir: [2 / W, 0] }, TH[1]);
  glw.pass(BLUR_FS, { uSrc: TH[1].tex[0], uDir: [0, 2 / H] }, TH[0]);
  glw.pass(DOWN_FS, { uSrc: TH[0].tex[0], uTexel: [2 / W, 2 / H] }, TQ[0]);
  glw.pass(BLUR_FS, { uSrc: TQ[0].tex[0], uDir: [4 / W, 0] }, TQ[1]);
  glw.pass(BLUR_FS, { uSrc: TQ[1].tex[0], uDir: [0, 4 / H] }, TQ[0]);
  glw.pass(POST_FS, {
    uLines: TL.tex[0], uSharp: TS.tex[0], uG1: TH[0].tex[0], uG2: TQ[0].tex[0], uBg: lin(cfg.bg), uPearl: lin(cfg.pearl), uExposure: cfg.exposure,
    uW1: cfg.glow[0], uW2: cfg.glow[1], uVig: cfg.vignette, uFlip: 1, uInvert: cfg.invert ? 1 : 0, uDisk: sunS ? [sunS[0], sunS[1], sunS[2]] : [0, 0, 0]
  }, null);
  glw.finish();
  ms.gpu = Math.round(performance.now() - t0);
  return { ms, nLines: c.lines.length, nStream: c.stream.length, nVerts, linesMs: c.ms };
}
