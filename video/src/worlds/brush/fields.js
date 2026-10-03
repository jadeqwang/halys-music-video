// fields.js: ONE analysis of a source frame, shared by everything the brush engine draws.
//
// analyze(src) turns a Source (sources.js: colour at aw x ah plus optional depth, matte, faces, optical flow) into
// fields: colour R, G, B (sRGB 0..1), luminance L, gradient (gx, gy, mag), a multi-scale structure tensor whose minor
// eigenvector is the FLOW (the direction of form, tangent to edges): J (fine + coarse prior), Jc (coarse, for big
// brushes), coherence, thinned edges, local detail, depth D (1 = near), matte M (1 = subject).
// The source pixels themselves are never shown: only marks derived from these fields.

import { blur, down, up, sampleField, clamp } from './util.js';

export function analyze(src, opt = {}) {
  const aw = src.aw, ah = src.ah, N = aw * ah;
  const R = src.R, G = src.G, B = src.B, L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = .2126 * R[i] + .7152 * G[i] + .0722 * B[i];
  const L1 = blur(L, aw, ah, opt.s1 ?? 1.0);
  const gx = new Float32Array(N), gy = new Float32Array(N), mag = new Float32Array(N);
  let mmax = 1e-6;
  for (let y = 1; y < ah - 1; y++) {
    const o = y * aw;
    for (let x = 1; x < aw - 1; x++) {
      const i = o + x;
      const a = L1[i - aw - 1], b = L1[i - aw], c = L1[i - aw + 1], e = L1[i - 1], f = L1[i + 1], g = L1[i + aw - 1], h2 = L1[i + aw], k = L1[i + aw + 1];
      const X = (c + 2 * f + k) - (a + 2 * e + g), Y = (g + 2 * h2 + k) - (a + 2 * b + c);
      gx[i] = X; gy[i] = Y; const m = Math.sqrt(X * X + Y * Y); mag[i] = m; if (m > mmax) mmax = m;
    }
  }
  // structure tensor: fine (sT) with a coarse prior (sTc) that keeps the flow smooth in flat regions; Jc for big brushes
  const Jxx = new Float32Array(N), Jxy = new Float32Array(N), Jyy = new Float32Array(N);
  for (let i = 0; i < N; i++) { const X = gx[i], Y = gy[i]; Jxx[i] = X * X; Jxy[i] = X * Y; Jyy[i] = Y * Y; }
  const sT = opt.sT ?? 2.5, sTc = opt.sTc ?? 10, prior = opt.prior ?? .35, sTb = opt.sTb ?? 22;
  const fxx = blur(Jxx, aw, ah, sT), fxy = blur(Jxy, aw, ah, sT), fyy = blur(Jyy, aw, ah, sT);
  // the coarse prior and the big-brush tensor are very smooth: computed at quarter resolution
  const q = 4, qw = Math.ceil(aw / q), qh = Math.ceil(ah / q);
  const cxx = blur(down(fxx, aw, ah, q), qw, qh, sTc / q), cxy = blur(down(fxy, aw, ah, q), qw, qh, sTc / q), cyy = blur(down(fyy, aw, ah, q), qw, qh, sTc / q);
  const uxx = up(cxx, qw, qh, aw, ah, q, Jxx), uxy = up(cxy, qw, qh, aw, ah, q, Jxy), uyy = up(cyy, qw, qh, aw, ah, q, Jyy);
  const J = { xx: new Float32Array(N), xy: new Float32Array(N), yy: new Float32Array(N), w: aw, h: ah, s: 1 };
  for (let i = 0; i < N; i++) { J.xx[i] = fxx[i] + prior * uxx[i]; J.xy[i] = fxy[i] + prior * uxy[i]; J.yy[i] = fyy[i] + prior * uyy[i]; }
  const bxx = blur(cxx, qw, qh, sTb / q), bxy = blur(cxy, qw, qh, sTb / q), byy = blur(cyy, qw, qh, sTb / q), QN = qw * qh;
  const Jc = { xx: new Float32Array(QN), xy: new Float32Array(QN), yy: new Float32Array(QN), w: qw, h: qh, s: 1 / q };
  for (let i = 0; i < QN; i++) { Jc.xx[i] = cxx[i] + .5 * bxx[i]; Jc.xy[i] = cxy[i] + .5 * bxy[i]; Jc.yy[i] = cyy[i] + .5 * byy[i]; }
  const coh = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = J.xx[i], b = J.xy[i], c = J.yy[i], tr = a + c, det = Math.sqrt((a - c) * (a - c) + 4 * b * b);
    coh[i] = tr > 1e-9 ? det / tr : 0;
  }
  // thinned edges (non-maximum suppression on the gradient magnitude)
  const edge = new Float32Array(N), thr = mmax * .03, inv = 1 / mmax;
  for (let y = 2; y < ah - 2; y++) for (let x = 2; x < aw - 2; x++) {
    const i = y * aw + x, m = mag[i]; if (m < thr) continue;
    const dx = gx[i] / m, dy = gy[i] / m;
    const m1 = mag[Math.round(y + dy) * aw + Math.round(x + dx)], m2 = mag[Math.round(y - dy) * aw + Math.round(x - dx)];
    if (m >= m1 && m >= m2) edge[i] = m * inv;
  }
  const dm = new Float32Array(N); for (let i = 0; i < N; i++) dm[i] = mag[i] * inv;
  const detail = blur(dm, aw, ah, opt.sDetail ?? 4);
  let dmax = 1e-6; for (let i = 0; i < N; i++) if (detail[i] > dmax) dmax = detail[i];
  const dk = 1 / (dmax * .55); for (let i = 0; i < N; i++) detail[i] = Math.min(1, detail[i] * dk);
  return { aw, ah, N, R, G, B, L, gx, gy, mag, mmax, J, Jc, coh, edge, detail,
    D: src.depth || null, M: src.matte || null, faces: src.faces || [], flow: src.flow || null, wall: src.wall || null, key: src.key };
}

// flow direction at (x, y) from the bilinearly interpolated tensor: unit tangent [tx, ty] and coherence
export function flowAt(F, x, y, out, J = F.J) {
  let w = F.aw, h = F.ah;
  if (J.s !== 1 && J.s) { x = (x + .5) * J.s - .5; y = (y + .5) * J.s - .5; w = J.w; h = J.h; }
  x = x < 0 ? 0 : x > w - 1.001 ? w - 1.001 : x; y = y < 0 ? 0 : y > h - 1.001 ? h - 1.001 : y;
  const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, i = yi * w + xi;
  const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
  const a = J.xx[i] * w00 + J.xx[i + 1] * w10 + J.xx[i + w] * w01 + J.xx[i + w + 1] * w11;
  const b = J.xy[i] * w00 + J.xy[i + 1] * w10 + J.xy[i + w] * w01 + J.xy[i + w + 1] * w11;
  const c = J.yy[i] * w00 + J.yy[i + 1] * w10 + J.yy[i + w] * w01 + J.yy[i + w + 1] * w11;
  const th = .5 * Math.atan2(2 * b, a - c) + Math.PI / 2;   // gradient angle + 90 deg = tangent
  out[0] = Math.cos(th); out[1] = Math.sin(th);
  const tr = a + c, det = Math.sqrt((a - c) * (a - c) + 4 * b * b);
  out[2] = tr > 1e-9 ? det / tr : 0;
  return out;
}

// copy of F with its tensors blended toward a designed tensor field T ({xx, xy, yy}, unit-trace) by weight W (0..1)
export function withTensor(F, T, W, gain = 1.5) {
  const N = F.N;
  const meanTr = J => { let t = 0, n = 0; for (let i = 0; i < J.xx.length; i += 7) { t += J.xx[i] + J.yy[i]; n++; } return t / n; };
  const mixT = (J, t) => {
    const n = J.xx.length, o = { xx: new Float32Array(n), xy: new Float32Array(n), yy: new Float32Array(n), w: J.w, h: J.h, s: J.s }, k = t * gain;
    let Tx = T.xx, Ty = T.xy, Tz = T.yy, Wm = W;
    if (n !== N) { const q = Math.round(1 / J.s); Tx = down(T.xx, F.aw, F.ah, q); Ty = down(T.xy, F.aw, F.ah, q); Tz = down(T.yy, F.aw, F.ah, q); Wm = down(W, F.aw, F.ah, q); }
    for (let i = 0; i < n; i++) {
      const m = Wm[i];
      if (m <= 0) { o.xx[i] = J.xx[i]; o.xy[i] = J.xy[i]; o.yy[i] = J.yy[i]; continue; }
      o.xx[i] = J.xx[i] * (1 - m) + Tx[i] * k * m; o.xy[i] = J.xy[i] * (1 - m) + Ty[i] * k * m; o.yy[i] = J.yy[i] * (1 - m) + Tz[i] * k * m;
    }
    return o;
  };
  return { ...F, J: mixT(F.J, meanTr(F.J)), Jc: mixT(F.Jc, meanTr(F.Jc)) };
}

export const fieldAt = (F, arr, x, y) => sampleField(arr, F.aw, F.ah, x, y);
export const clampX = (F, x) => clamp(x, 0, F.aw - 1);
