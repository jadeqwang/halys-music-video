// corona.js: CORONA, the same flow field drawn as luminous field lines on navy-black (totality; reality breaks).
//
// 1. lines(): evenly spaced streamlines (Jobard & Lefer) traced through the structure-tensor flow of the shared analysis.
//    Separation shrinks where the plate is bright or edged (dense, bright lines) and grows in the dark (sparse, dim).
//    Lines stop at depth discontinuities and at the sky boundary, so the 3D orbit never stretches a line across a gap.
//    The sky is replaced by a totality corona: the moon's black disc with streamers whose field bends near the limb
//    (helmet loops) and goes radial further out. Rims of the subject matte and the horizon band are signal orange.
// 2. Per frame: every vertex is lifted to 3D from the depth map and the camera orbits a pivot on the subject (±10-15°).
//    Lines are thin additive antialiased ribbons (0.6-1.5 px) in linear light; brightness pulses travel along each line
//    (phase flow) and a `kick` sharpens the pulses into dashes and surges the light, for drops.
// 3. Finish: restrained two-scale glow (half and quarter resolution), soft clip, pearl/orange over #05070c.

import { W, H, TAU, clamp, lerp, sstep, hash, hash3, hexRgb, s2l } from './core.js';
import { blur, samp, ellipseMask } from './analysis.js';
import { skyMask } from './sky.js';

export const DEFAULTS = {
  aw: 960,
  dsepMin: 1.6, dsepMax: 13, dtest: .5, step: .6, maxLen: 900, minLen: 22, maxTurn: 1.5,
  gamma: 1.35, gain: 1.3, darkCut: .04, edgeGain: 1.2, matteGain: .75, sepGamma: .7,
  pool: null, poolMatte: 1, poolBlur: 8, envDim: .2, envSep: .07, depthFade: .45, weightVar: .45,
  particles: 0, partThresh: .035, partGain: 2.2, partSize: [.7, 1.5],
  width: [.6, 1.5], lambda: 70, speed: .5, pulse: .5, kick: 0,
  pearl: '#f3efe6', orange: '#f08a2a', bg: '#05070c',
  rim: 1, rimWidth: 3.5, horizon: 1, horizonBand: .035, glow: [.28, .12], exposure: 1.8, vignette: .35,
  yaw: 0, pitch: 0, zNear: 1, zFar: 2.6, skyZ: 1.25, focal: 1.2, overscan: 1, pivot: null, edgeFade: 40, depthBlur: 2.5, depthSmooth: 6,
  sky: null, sun: null, corona: 1, seed: 3,
};

// ---------------------------------------------------------------- fields for the tracer
function prepFields(F, cfg) {
  const { aw, ah, N } = F;
  const E = blur(F.edge, aw, ah, .8);
  let emax = 1e-6; for (let i = 0; i < N; i++) if (E[i] > emax) emax = E[i];
  const sky = cfg.sky ? skyMask(F, cfg.sky) : new Float32Array(N);
  // light design (as in BRONZE): the subject is plasma, the environment a dim sparse field
  const M = F.M ? blur(F.M, aw, ah, .7) : null;
  let light = new Float32Array(N);
  if (cfg.pool) { for (const e of cfg.pool) { const m = ellipseMask(F, e), k = e.k ?? 1; for (let i = 0; i < N; i++) light[i] = Math.max(light[i], m[i] * k); } light = blur(light, aw, ah, cfg.poolBlur); }
  if (M && cfg.poolMatte) for (let i = 0; i < N; i++) light[i] = Math.max(light[i], sstep(.2, .7, M[i]) * cfg.poolMatte);
  if (!cfg.pool && !(M && cfg.poolMatte)) light.fill(1);
  // tensor: fine where there is detail inside the light, coarse (long, calm lines) everywhere else
  const xx = new Float32Array(N), xy = new Float32Array(N), yy = new Float32Array(N);
  let trF = 0, trC = 0; for (let i = 0; i < N; i++) { trF += F.J.xx[i] + F.J.yy[i]; trC += F.Jc.xx[i] + F.Jc.yy[i]; }
  const kc = trF / Math.max(trC, 1e-9);
  for (let i = 0; i < N; i++) {
    const w = sstep(.2, .55, F.detail[i]) * sstep(.3, .8, light[i]);
    xx[i] = w * F.J.xx[i] + (1 - w) * F.Jc.xx[i] * kc; xy[i] = w * F.J.xy[i] + (1 - w) * F.Jc.xy[i] * kc; yy[i] = w * F.J.yy[i] + (1 - w) * F.Jc.yy[i] * kc;
  }
  // brightness and importance
  const B = new Float32Array(N), imp = new Float32Array(N), O = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = clamp((F.T[i] - cfg.darkCut) / (1 - cfg.darkCut)), l = light[i];
    let b = Math.pow(t, cfg.gamma) * cfg.gain + cfg.edgeGain * (E[i] / emax) * (.25 + .75 * t) * (.4 + .6 * l);
    if (M) b += cfg.matteGain * sstep(.2, .7, M[i]) * (.4 + .6 * t);
    b *= lerp(cfg.envDim, 1, l);
    if (F.D) b *= lerp(1 - cfg.depthFade, 1, sstep(0, .6, F.D[i]));
    B[i] = b; imp[i] = clamp(b * lerp(cfg.envSep, 1, l) / Math.max(.2, lerp(cfg.envDim, 1, l)));
  }
  // particles: where the plate is a crowd (fine texture inside the light), soldiers become points of light, not lines
  let part = null;
  if (cfg.particles) {
    part = new Float32Array(N);
    for (let i = 0; i < N; i++) part[i] = sstep(.42, .7, F.detail[i]) * sstep(.5, .9, light[i]) * cfg.particles;
    part = blur(part, aw, ah, 2);
    for (let i = 0; i < N; i++) { imp[i] *= 1 - .95 * sstep(.3, .6, part[i]); B[i] *= 1 - .7 * sstep(.3, .6, part[i]); }
  }
  // orange: rims of the subject matte (prominences) and the band just under the horizon (360° totality glow)
  if (M && cfg.rim) {
    const g = new Float32Array(N);
    for (let y = 1; y < ah - 1; y++) for (let x = 1; x < aw - 1; x++) { const i = y * aw + x; g[i] = Math.hypot(M[i + 1] - M[i - 1], M[i + aw] - M[i - aw]); }
    const gb = blur(g, aw, ah, cfg.rimWidth * .5);
    let gm = 1e-6; for (let i = 0; i < N; i++) if (gb[i] > gm) gm = gb[i];
    for (let i = 0; i < N; i++) O[i] = Math.max(O[i], sstep(.12, .55, gb[i] / gm) * cfg.rim);
  }
  if (cfg.sky && cfg.horizon) {
    const band = cfg.horizonBand * ah;
    for (let x = 0; x < aw; x++) {
      let hy = 0; while (hy < ah && sky[hy * aw + x] > .5) hy++;
      if (hy >= ah || hy === 0) continue;
      for (let y = hy; y < Math.min(ah, hy + band * 3); y++) { const i = y * aw + x, k = Math.exp(-(y - hy) / band); O[i] = Math.max(O[i], k * cfg.horizon); B[i] = Math.max(B[i], B[i] + .5 * k * cfg.horizon); imp[i] = Math.max(imp[i], .5 * k); }
    }
  }
  // the sky: corona field and brightness (or nothing)
  let sun = null;
  if (cfg.sky) {
    if (cfg.sun) {
      const s = cfg.sun; sun = { x: s.x * aw, y: s.y * ah, r: s.r * aw, tilt: s.tilt ?? .5 };
    }
    for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
      const i = y * aw + x, m = sky[i]; if (m < .01) continue;
      let cb = 0, cxx = 1, cxy = 0, cyy = 0;
      if (sun) {
        const dx = x - sun.x, dy = y - sun.y, d = Math.hypot(dx, dy) + 1e-6, phi = Math.atan2(dy, dx), rr = d / sun.r;
        // streamers: brighter along a tilted equator (helmet streamers), fainter plumes at the poles
        const eq = Math.abs(Math.sin(phi - sun.tilt)), streak = .35 + .65 * Math.pow(1 - eq, 2.5) + .25 * Math.pow(eq, 12);
        const fine = .75 + .25 * Math.sin(phi * 23 + 1.3) * Math.sin(phi * 7.1);
        cb = cfg.corona * Math.pow(Math.max(1, rr), -1.9) * streak * fine * 2.4;
        // field: loops near the limb (bend toward the equator), radial further out
        const bend = .9 * Math.sin(2 * (phi - sun.tilt)) * Math.exp(-(rr - 1) / 1.4);
        const ang = phi + bend, fx = Math.cos(ang), fy = Math.sin(ang), nx = -fy, ny = fx;
        cxx = nx * nx; cxy = nx * ny; cyy = ny * ny;
      }
      const tr = (xx[i] + yy[i]) || 1e-6;
      xx[i] = lerp(xx[i], cxx * tr, m); xy[i] = lerp(xy[i], cxy * tr, m); yy[i] = lerp(yy[i], cyy * tr, m);
      B[i] = lerp(B[i], cb, m); imp[i] = lerp(imp[i], clamp(cb * 1.4), m); O[i] *= 1 - m;
    }
  }
  return { xx, xy, yy, B, imp, O, sky, sun, part, light };
}

// soldiers as particles: luminance blobs (local maxima of L minus its local mean) inside the particle mask
function findParticles(F, f, cfg) {
  if (!f.part) return [];
  const { aw, ah } = F, Lb = blur(F.L, aw, ah, 1.6), out = [];
  for (let y = 2; y < ah - 2; y++) for (let x = 2; x < aw - 2; x++) {
    const i = y * aw + x, m = f.part[i]; if (m < .25) continue;
    const L = F.L[i], lc = L - Lb[i]; if (lc < cfg.partThresh) continue;
    let mx = true; for (let j = -1; j <= 1 && mx; j++) for (let k = -1; k <= 1; k++) if ((j || k) && F.L[i + j * aw + k] > L) { mx = false; break; }
    if (!mx) continue;
    out.push({ x, y, b: Math.min(1.6, (lc * cfg.partGain * 4 + F.T[i] * .6) * m * f.light[i]), d: F.D ? F.D[i] : .5, o: 0 });
  }
  return out;
}

function dirAt(F, f, x, y, out) {
  const a = samp(F, f.xx, x, y), b = samp(F, f.xy, x, y), c = samp(F, f.yy, x, y);
  const th = .5 * Math.atan2(2 * b, a - c) + Math.PI / 2;
  out[0] = Math.cos(th); out[1] = Math.sin(th);
}

// ---------------------------------------------------------------- evenly spaced streamlines (Jobard & Lefer 1997)
export function traceLines(F, f, cfg) {
  const { aw, ah } = F, cell = cfg.dsepMin, gw = Math.ceil(aw / cell) + 1, gh = Math.ceil(ah / cell) + 1;
  const grid = Array.from({ length: gw * gh }, () => []);
  const PX = [], PY = [], PL = [], PI = [];                    // all accepted points: x, y, line id, index along line
  const lines = [], v = [0, 0], v2 = [0, 0];
  const sep = (x, y) => lerp(cfg.dsepMax, cfg.dsepMin, Math.pow(clamp(samp(F, f.imp, x, y)), cfg.sepGamma));
  const D = F.D;
  const sun = f.sun;
  const blocked = (x, y) => sun && Math.hypot(x - sun.x, y - sun.y) < sun.r * 1.02;
  // is (x, y) closer than d to any point of another line (or of this line, far enough back along it)?
  const tooClose = (x, y, d, lid, idx) => {
    const r = Math.ceil(d / cell), cx = Math.floor(x / cell), cy = Math.floor(y / cell), d2 = d * d, near = Math.ceil(2.5 * d / cfg.step);
    for (let j = Math.max(0, cy - r); j <= Math.min(gh - 1, cy + r); j++) for (let i = Math.max(0, cx - r); i <= Math.min(gw - 1, cx + r); i++) {
      const c = grid[j * gw + i];
      for (let k = 0; k < c.length; k++) {
        const p = c[k];
        if (PL[p] === lid && Math.abs(PI[p] - idx) < near) continue;
        const dx = PX[p] - x, dy = PY[p] - y; if (dx * dx + dy * dy < d2) return true;
      }
    }
    return false;
  };
  const insert = (x, y, lid, idx) => { const p = PX.length; PX.push(x); PY.push(y); PL.push(lid); PI.push(idx); grid[Math.floor(y / cell) * gw + Math.floor(x / cell)].push(p); return p; };
  const skyAt = (x, y) => samp(F, f.sky, x, y);
  const grow = (x0, y0) => {
    if (x0 < 1 || y0 < 1 || x0 > aw - 2 || y0 > ah - 2 || blocked(x0, y0)) return null;
    if (samp(F, f.imp, x0, y0) < .015) return null;
    const lid = lines.length;
    if (tooClose(x0, y0, sep(x0, y0) * .95, lid, 0)) return null;
    const start = PX.length;
    insert(x0, y0, lid, 0);
    const branches = [];
    for (const dir of [1, -1]) {
      const pts = [];
      let x = x0, y = y0, px = 0, py = 0, idx = 0;
      dirAt(F, f, x, y, v); px = v[0] * dir; py = v[1] * dir;
      const s0 = skyAt(x, y) > .5, maxN = cfg.maxLen / cfg.step, win = Math.max(4, Math.round(8 / cfg.step)), turns = new Float32Array(win);
      let turnSum = 0;
      for (let k = 0; k < maxN; k++) {
        dirAt(F, f, x, y, v); let dx = v[0], dy = v[1]; if (dx * px + dy * py < 0) { dx = -dx; dy = -dy; }
        dirAt(F, f, x + dx * cfg.step * .5, y + dy * cfg.step * .5, v2); let ex = v2[0], ey = v2[1]; if (ex * dx + ey * dy < 0) { ex = -ex; ey = -ey; }
        if (ex * px + ey * py < .5) break;                                    // a kink: a singularity of the field
        const tq = Math.abs(Math.atan2(px * ey - py * ex, px * ex + py * ey));   // calm lines: limit turning per 8 px
        turnSum += tq - turns[k % win]; turns[k % win] = tq;
        if (turnSum > cfg.maxTurn && !s0) break;
        const nx = x + ex * cfg.step, ny = y + ey * cfg.step;
        if (nx < 1 || ny < 1 || nx > aw - 2 || ny > ah - 2 || blocked(nx, ny)) break;
        if ((skyAt(nx, ny) > .5) !== s0) break;                              // never cross the horizon
        if (D && Math.abs(samp(F, D, nx, ny) - samp(F, D, x, y)) > .03 * cfg.step) break;   // depth discontinuity
        idx += dir;
        if (tooClose(nx, ny, sep(nx, ny) * cfg.dtest, lid, idx)) break;
        if (samp(F, f.imp, nx, ny) < .008) break;
        x = nx; y = ny; px = ex; py = ey;
        insert(x, y, lid, idx); pts.push(x, y);
      }
      branches.push(pts);
    }
    const n = 1 + (branches[0].length + branches[1].length) / 2;
    if (n * cfg.step < (skyAt(x0, y0) > .5 ? 3 : cfg.minLen)) {           // too short: take its points back out of the grid
      for (let p = PX.length - 1; p >= start; p--) { const c = grid[Math.floor(PY[p] / cell) * gw + Math.floor(PX[p] / cell)]; c.pop(); }
      PX.length = PY.length = PL.length = PI.length = start;
      return null;
    }
    const b = branches[1], xy = new Float32Array(n * 2);
    let o = 0;
    for (let k = b.length - 2; k >= 0; k -= 2) { xy[o++] = b[k]; xy[o++] = b[k + 1]; }
    xy[o++] = x0; xy[o++] = y0;
    for (let k = 0; k < branches[0].length; k++) xy[o++] = branches[0][k];
    const L = { xy, n, sky: skyAt(x0, y0) > .5 };
    lines.push(L);
    return L;
  };
  // seed queue: perpendicular offsets from accepted lines; plus a coarse importance-ordered scan for islands
  const queue = [];
  const enqueue = L => {
    const every = Math.max(2, Math.round(2 / cfg.step));
    for (let k = 0; k < L.n; k += every) {
      const k0 = Math.max(0, k - 1), k1 = Math.min(L.n - 1, k + 1);
      let tx = L.xy[k1 * 2] - L.xy[k0 * 2], ty = L.xy[k1 * 2 + 1] - L.xy[k0 * 2 + 1]; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
      const x = L.xy[k * 2], y = L.xy[k * 2 + 1], d = sep(x, y);
      queue.push(x - ty * d, y + tx * d, x + ty * d, y - tx * d);
    }
  };
  const scan = [];
  const sg = cfg.dsepMax * 1.5;
  for (let y = sg / 2; y < ah; y += sg) for (let x = sg / 2; x < aw; x += sg) {
    const xx = x + (hash3(x | 0, y | 0, cfg.seed) - .5) * sg, yy = y + (hash3(y | 0, x | 0, cfg.seed + 1) - .5) * sg;
    scan.push([samp(F, f.imp, xx, yy), xx, yy]);
  }
  scan.sort((a, b) => b[0] - a[0]);
  for (const [, sx, sy] of scan) {
    const L = grow(sx, sy); if (!L) continue;
    enqueue(L);
    for (let q = 0; q < queue.length; q += 2) { const L2 = grow(queue[q], queue[q + 1]); if (L2) enqueue(L2); }
    queue.length = 0;
  }
  return lines;
}

// per-vertex attributes in analysis space: brightness, orange, depth, arc length (screen px), fade near the plate edge
function decorate(F, f, lines, cfg) {
  const S = W / F.aw;
  f.Db = F.D ? blur(F.D, F.aw, F.ah, cfg.depthBlur) : null;
  let li = 0;
  for (const L of lines) {
    const n = L.n, b = new Float32Array(n), o = new Float32Array(n), d = new Float32Array(n), s = new Float32Array(n);
    let acc = 0;
    for (let k = 0; k < n; k++) {
      const x = L.xy[k * 2], y = L.xy[k * 2 + 1];
      if (k) acc += Math.hypot(x - L.xy[k * 2 - 2], y - L.xy[k * 2 - 1]) * S;
      const edge = Math.min(x, y, F.aw - 1 - x, F.ah - 1 - y);
      b[k] = samp(F, f.B, x, y) * sstep(0, cfg.edgeFade, edge);
      o[k] = samp(F, f.O, x, y);
      d[k] = L.sky ? -1 : (f.Db ? samp(F, f.Db, x, y) : .5);
      s[k] = acc;
    }
    // depth smoothed along the line (the 3D lift must not turn depth-map noise into zigzags)
    if (!L.sky && cfg.depthSmooth > 0 && n > 2) {
      const r = cfg.depthSmooth, tmp = d.slice();
      for (let k = 0; k < n; k++) { let a = 0, w = 0; for (let j = Math.max(0, k - r); j <= Math.min(n - 1, k + r); j++) { const q = 1 - Math.abs(j - k) / (r + 1); a += tmp[j] * q; w += q; } d[k] = a / w; }
    }
    // taper the ends so lines are born and die softly
    for (let k = 0; k < n; k++) { const e = Math.min(s[k], acc - s[k]); b[k] *= sstep(0, 10, e); }
    // phases travel outward from the sun in the sky and upward on the land (plasma rising)
    let dir = 1;
    if (L.sky && f.sun) { const d0 = Math.hypot(L.xy[0] - f.sun.x, L.xy[1] - f.sun.y), d1 = Math.hypot(L.xy[n * 2 - 2] - f.sun.x, L.xy[n * 2 - 1] - f.sun.y); dir = d1 >= d0 ? 1 : -1; }
    else dir = L.xy[n * 2 - 1] <= L.xy[1] ? 1 : -1;
    const wgt = 1 + cfg.weightVar * (Math.pow(hash3(li, 11, cfg.seed), 3) * 2.2 - .55);    // a few bright streamers, many faint lines
    for (let k = 0; k < n; k++) b[k] *= wgt;
    Object.assign(L, { b, o, d, s, len: acc, dir, phase: hash3(li, 7, cfg.seed) * TAU, spd: .75 + .5 * hash3(li, 9, cfg.seed) });
    li++;
  }
  return lines;
}

// ---------------------------------------------------------------- camera: lift to 3D from depth, orbit a pivot
function camera(F, cfg, lines) {
  const S = W / F.aw, f = cfg.focal * W, cx = W / 2, cy = H / 2;
  const zn = cfg.zNear, zf = cfg.zFar, zOf = D => D < 0 ? zf * cfg.skyZ : 1 / (D * (1 / zn - 1 / zf) + 1 / zf);
  let Dp = cfg.pivot;
  if (Dp == null) {   // pivot at the subject: median depth under the matte (or the frame centre)
    const vals = [];
    if (F.M && F.D) for (let i = 0; i < F.N; i += 7) if (F.M[i] > .5) vals.push(F.D[i]);
    if (!vals.length && F.D) for (let y = F.ah * .3 | 0; y < F.ah * .7; y += 4) for (let x = F.aw * .3 | 0; x < F.aw * .7; x += 4) vals.push(F.D[y * F.aw + x]);
    vals.sort((a, b) => a - b); Dp = vals.length ? vals[vals.length >> 1] : .5;
  }
  const zp = zOf(Dp), yaw = cfg.yaw * Math.PI / 180, pitch = cfg.pitch * Math.PI / 180;
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return (x, y, D, out) => {
    const z = zOf(D), X = (x * S - cx) / f * z, Y = (y * S - cy) / f * z, Z = z - zp;
    // yaw about the vertical axis through the pivot, then pitch
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
uniform vec3 uPearl, uOrange;
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
  o = vec4(mix(uPearl, uOrange, org) * I * cov, 1.0);
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
  // 9 linear taps = 17-tap gaussian (sigma ~ 3.5 texels)
  const float w0 = 0.1205, w1 = 0.2101, w2 = 0.1460, w3 = 0.0727, w4 = 0.0254;
  const float o1 = 1.4697, o2 = 3.4291, o3 = 5.3884, o4 = 7.3488;
  vec4 c = texture(uSrc, vUv) * w0;
  c += (texture(uSrc, vUv + uDir * o1) + texture(uSrc, vUv - uDir * o1)) * w1;
  c += (texture(uSrc, vUv + uDir * o2) + texture(uSrc, vUv - uDir * o2)) * w2;
  c += (texture(uSrc, vUv + uDir * o3) + texture(uSrc, vUv - uDir * o3)) * w3;
  c += (texture(uSrc, vUv + uDir * o4) + texture(uSrc, vUv - uDir * o4)) * w4;
  o = c / (w0 + 2.0 * (w1 + w2 + w3 + w4));
}`;

const POST_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uLines, uG1, uG2; uniform vec3 uBg; uniform float uExposure, uW1, uW2, uVig, uFlip;
uniform vec2 uRes;
out vec4 o;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 l2s(vec3 c) { c = max(c, 0.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
void main() {
  vec2 uv = vUv; if (uFlip > 0.5) uv.y = 1.0 - uv.y;
  vec3 c = texture(uLines, uv).rgb + uW1 * texture(uG1, uv).rgb + uW2 * texture(uG2, uv).rgb;
  c = 1.0 - exp(-c * uExposure);
  vec2 q = (uv - 0.5) * vec2(1.0, 0.8);
  vec3 bg = uBg * (1.0 - uVig * pow(clamp(length(q) * 1.4, 0.0, 1.0), 2.0));
  vec3 lin = bg + c * (1.0 - bg);
  o = vec4(l2s(lin) + (hash12(uv * uRes) - 0.5) / 255.0, 1.0);
}`;

let TL = null, TH = [], TQ = [];
function targets(glw) {
  if (TL) return;
  TL = glw.target(W, H, 'rgba16f');
  TH = [glw.target(W / 2, H / 2, 'rgba16f'), glw.target(W / 2, H / 2, 'rgba16f')];
  TQ = [glw.target(W / 4, H / 4, 'rgba16f'), glw.target(W / 4, H / 4, 'rgba16f')];
}

const cache = new Map();
export function prepare(F, cfg) {
  const key = F.plate + '|' + JSON.stringify(F.win) + '|' + F.aw + '|' + JSON.stringify({ ...cfg, yaw: 0, pitch: 0, kick: 0, t: 0 });
  let c = cache.get(key);
  if (!c) {
    const t0 = performance.now();
    const f = prepFields(F, cfg);
    const lines = decorate(F, f, traceLines(F, f, cfg), cfg);
    // particles join the line list as dots (two-point lines one pixel long, random phase: they twinkle)
    findParticles(F, f, cfg).forEach((q, j) => {
      const h = hash3(j, 3, cfg.seed), ang = h * TAU, ex = Math.cos(ang) * .25, ey = Math.sin(ang) * .25;
      lines.push({ xy: new Float32Array([q.x - ex, q.y - ey, q.x + ex, q.y + ey]), n: 2, sky: false, b: new Float32Array([q.b, q.b]), o: new Float32Array([0, 0]),
        d: new Float32Array([q.d, q.d]), s: new Float32Array([0, 1]), len: 1, dir: 1, phase: hash3(j, 5, cfg.seed) * TAU, spd: 2 + 3 * hash3(j, 6, cfg.seed), dot: lerp(cfg.partSize[0], cfg.partSize[1], hash3(j, 8, cfg.seed)) });
    });
    c = { f, lines, ms: Math.round(performance.now() - t0) };
    if (cache.size > 3) cache.delete(cache.keys().next().value);
    cache.set(key, c);
  }
  return c;
}

export async function render(glw, F, cfg, ctx) {
  const ms = {};
  let t0 = performance.now();
  const c = prepare(F, cfg);
  ms.lines = Math.round(performance.now() - t0);
  t0 = performance.now();
  targets(glw);
  const proj = camera(F, cfg, c.lines), p = [0, 0, 0];
  let nv = 0, ni = 0;
  for (const L of c.lines) { nv += L.n * 2; ni += (L.n - 1) * 6; }
  const pos = new Float32Array(nv * 2), A = new Float32Array(nv * 4), Bv = new Float32Array(nv * 4), idx = new Uint32Array(ni);
  let vi = 0, ii = 0;
  const [w0, w1] = cfg.width, P = new Float32Array(4096 * 2);
  for (const L of c.lines) {
    const n = L.n; const Q = n * 2 <= P.length ? P : new Float32Array(n * 2);
    for (let k = 0; k < n; k++) { proj(L.xy[k * 2], L.xy[k * 2 + 1], L.d[k], p); Q[k * 2] = p[0]; Q[k * 2 + 1] = p[1]; }
    if (L.dot) { const mx = (Q[0] + Q[2]) / 2, my = (Q[1] + Q[3]) / 2, a = L.phase; Q[0] = mx - Math.cos(a) * L.dot * .8; Q[1] = my - Math.sin(a) * L.dot * .8; Q[2] = mx + Math.cos(a) * L.dot * .8; Q[3] = my + Math.sin(a) * L.dot * .8; }
    const base = vi;
    for (let k = 0; k < n; k++) {
      const k0 = Math.max(0, k - 1), k1 = Math.min(n - 1, k + 1);
      let tx = Q[k1 * 2] - Q[k0 * 2], ty = Q[k1 * 2 + 1] - Q[k0 * 2 + 1]; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
      const b = L.b[k], hw = L.dot ?? .5 * lerp(w0, w1, clamp(b)), ext = hw + 1;
      const s = L.dir > 0 ? L.s[k] : L.len - L.s[k];
      for (const sd of [-1, 1]) {
        pos[vi * 2] = Q[k * 2] - ty * ext * sd; pos[vi * 2 + 1] = Q[k * 2 + 1] + tx * ext * sd;
        A[vi * 4] = sd; A[vi * 4 + 1] = s; A[vi * 4 + 2] = b; A[vi * 4 + 3] = L.o[k];
        Bv[vi * 4] = L.phase; Bv[vi * 4 + 1] = hw; Bv[vi * 4 + 2] = L.spd; Bv[vi * 4 + 3] = 0;
        vi++;
      }
    }
    for (let k = 0; k < n - 1; k++) { const q = base + k * 2; idx[ii++] = q; idx[ii++] = q + 1; idx[ii++] = q + 2; idx[ii++] = q + 1; idx[ii++] = q + 3; idx[ii++] = q + 2; }
  }
  ms.mesh = Math.round(performance.now() - t0);
  t0 = performance.now();
  const lin = h => hexRgb(h).map(s2l);
  const PRG = glw.program(LINE_VS, LINE_FS);
  glw.clear(TL, [0, 0, 0, 0]);
  const M = glw.mesh(PRG, { aPos: { data: pos, size: 2 }, aA: { data: A, size: 4 }, aB: { data: Bv, size: 4 } }, idx);
  glw.draw(PRG, M, { uT: ctx.t ?? 0, uLambda: cfg.lambda, uSpeed: cfg.speed, uPulse: cfg.pulse, uKick: cfg.kick, uPearl: lin(cfg.pearl), uOrange: lin(cfg.orange) }, TL, 'add');
  M.dispose();
  // restrained glow: half-res and quarter-res gaussians
  glw.pass(DOWN_FS, { uSrc: TL.tex[0], uTexel: [1 / W, 1 / H] }, TH[0]);
  glw.pass(BLUR_FS, { uSrc: TH[0].tex[0], uDir: [2 / W, 0] }, TH[1]);
  glw.pass(BLUR_FS, { uSrc: TH[1].tex[0], uDir: [0, 2 / H] }, TH[0]);
  glw.pass(DOWN_FS, { uSrc: TH[0].tex[0], uTexel: [2 / W, 2 / H] }, TQ[0]);
  glw.pass(BLUR_FS, { uSrc: TQ[0].tex[0], uDir: [4 / W, 0] }, TQ[1]);
  glw.pass(BLUR_FS, { uSrc: TQ[1].tex[0], uDir: [0, 4 / H] }, TQ[0]);
  glw.pass(POST_FS, { uLines: TL.tex[0], uG1: TH[0].tex[0], uG2: TQ[0].tex[0], uBg: lin(cfg.bg), uExposure: cfg.exposure, uW1: cfg.glow[0], uW2: cfg.glow[1], uVig: cfg.vignette, uFlip: 1 }, null);
  glw.finish();
  ms.gpu = Math.round(performance.now() - t0);
  return { ms, nLines: c.lines.length, nVerts: nv, linesMs: c.ms };
}
