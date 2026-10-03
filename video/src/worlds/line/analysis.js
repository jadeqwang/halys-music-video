// analysis.js: one analysis of a plate frame (port of the look-dev analysis, video/lab/src/analysis.js).
//
// analyze(imageData, aux) -> F at the analysis size aw x ah:
//   R, G, B, L (sRGB 0..1), T tone, gx/gy/mag gradient, J / Jc structure tensors (fine+prior / coarse) whose minor
//   eigenvector is the FLOW (tangent to edges), coh coherence, edge (thinned), detail, D depth (1 = near), M matte.
// Everything here is pure CPU math on Float32Arrays; nothing touches the frame.

import { clamp, sstep } from '../../core.js';

// ---------------------------------------------------------------- blur
function gaussKernel(sigma) {
  const r = Math.max(1, Math.ceil(sigma * 2.6)), k = new Float32Array(2 * r + 1);
  let s = 0; for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-i * i / (2 * sigma * sigma)); s += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  return { r, k };
}
function boxPass(src, dst, w, h, r, horiz) {
  const inv = 1 / (2 * r + 1);
  if (horiz) {
    for (let y = 0; y < h; y++) {
      const o = y * w; let acc = 0;
      for (let i = -r; i <= r; i++) acc += src[o + clamp(i, 0, w - 1)];
      for (let x = 0; x < w; x++) { dst[o + x] = acc * inv; acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; }
    }
  } else {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += src[clamp(i, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) { dst[y * w + x] = acc * inv; acc += src[Math.min(h - 1, y + r + 1) * w + x] - src[Math.max(0, y - r) * w + x]; }
    }
  }
}
// Gaussian blur of a Float32 field (exact kernel for small sigma, three box passes otherwise)
export function blur(src, w, h, sigma) {
  if (sigma <= 0.05) return src.slice();
  const out = new Float32Array(w * h), tmp = new Float32Array(w * h);
  if (sigma < 3) {
    const { r, k } = gaussKernel(sigma);
    for (let y = 0; y < h; y++) { const o = y * w; for (let x = 0; x < w; x++) { let a = 0; for (let i = -r; i <= r; i++) { const xx = x + i < 0 ? 0 : x + i >= w ? w - 1 : x + i; a += src[o + xx] * k[i + r]; } tmp[o + x] = a; } }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let i = -r; i <= r; i++) { const yy = y + i < 0 ? 0 : y + i >= h ? h - 1 : y + i; a += tmp[yy * w + x] * k[i + r]; } out[y * w + x] = a; }
    return out;
  }
  const nb = 3, wIdeal = Math.sqrt(12 * sigma * sigma / nb + 1);
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sigma * sigma - nb * wl * wl - 4 * nb * wl - 3 * nb) / (-4 * wl - 4));
  out.set(src);
  for (let i = 0; i < nb; i++) { const r = ((i < m ? wl : wl + 2) - 1) / 2; boxPass(out, tmp, w, h, r, true); boxPass(tmp, out, w, h, r, false); }
  return out;
}

// ---------------------------------------------------------------- sampling
export function samp(F, arr, x, y) {
  const aw = F.aw, ah = F.ah;
  x = x < 0 ? 0 : x > aw - 1.001 ? aw - 1.001 : x; y = y < 0 ? 0 : y > ah - 1.001 ? ah - 1.001 : y;
  const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, i = yi * aw + xi;
  return (arr[i] * (1 - fx) + arr[i + 1] * fx) * (1 - fy) + (arr[i + aw] * (1 - fx) + arr[i + aw + 1] * fx) * fy;
}

// ---------------------------------------------------------------- analysis
export function analyze(id, aux = {}, opt = {}) {
  const aw = id.width, ah = id.height, N = aw * ah, d = id.data;
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N), L = new Float32Array(N);
  const gain = opt.gain ?? 1;
  for (let i = 0; i < N; i++) {
    const r = Math.min(1, d[i * 4] / 255 * gain), g = Math.min(1, d[i * 4 + 1] / 255 * gain), b = Math.min(1, d[i * 4 + 2] / 255 * gain);
    R[i] = r; G[i] = g; B[i] = b; L[i] = .2126 * r + .7152 * g + .0722 * b;
  }
  const L1 = blur(L, aw, ah, opt.s1 ?? 1.0);
  const gx = new Float32Array(N), gy = new Float32Array(N), mag = new Float32Array(N);
  let mmax = 1e-6;
  for (let y = 1; y < ah - 1; y++) for (let x = 1; x < aw - 1; x++) {
    const i = y * aw + x;
    const a = L1[i - aw - 1], b = L1[i - aw], c = L1[i - aw + 1], e = L1[i - 1], f = L1[i + 1], g = L1[i + aw - 1], h2 = L1[i + aw], k = L1[i + aw + 1];
    const X = (c + 2 * f + k) - (a + 2 * e + g), Y = (g + 2 * h2 + k) - (a + 2 * b + c);
    gx[i] = X; gy[i] = Y; const m = Math.hypot(X, Y); mag[i] = m; if (m > mmax) mmax = m;
  }
  const Jxx = new Float32Array(N), Jxy = new Float32Array(N), Jyy = new Float32Array(N);
  for (let i = 0; i < N; i++) { Jxx[i] = gx[i] * gx[i]; Jxy[i] = gx[i] * gy[i]; Jyy[i] = gy[i] * gy[i]; }
  const sT = opt.sT ?? 2.5, sTc = opt.sTc ?? 10, prior = opt.prior ?? .35, sTb = opt.sTb ?? 22;
  const fine = { xx: blur(Jxx, aw, ah, sT), xy: blur(Jxy, aw, ah, sT), yy: blur(Jyy, aw, ah, sT) };
  const coarse = { xx: blur(fine.xx, aw, ah, sTc), xy: blur(fine.xy, aw, ah, sTc), yy: blur(fine.yy, aw, ah, sTc) };
  const big = { xx: blur(coarse.xx, aw, ah, sTb), xy: blur(coarse.xy, aw, ah, sTb), yy: blur(coarse.yy, aw, ah, sTb) };
  const J = { xx: new Float32Array(N), xy: new Float32Array(N), yy: new Float32Array(N) };
  const Jc = { xx: new Float32Array(N), xy: new Float32Array(N), yy: new Float32Array(N) };
  for (let i = 0; i < N; i++) {
    J.xx[i] = fine.xx[i] + prior * coarse.xx[i]; J.xy[i] = fine.xy[i] + prior * coarse.xy[i]; J.yy[i] = fine.yy[i] + prior * coarse.yy[i];
    Jc.xx[i] = coarse.xx[i] + .5 * big.xx[i]; Jc.xy[i] = coarse.xy[i] + .5 * big.xy[i]; Jc.yy[i] = coarse.yy[i] + .5 * big.yy[i];
  }
  const coh = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = J.xx[i], b = J.xy[i], c = J.yy[i], tr = a + c, det = Math.sqrt((a - c) * (a - c) + 4 * b * b);
    coh[i] = tr > 1e-9 ? det / tr : 0;
  }
  const edge = new Float32Array(N);
  for (let y = 2; y < ah - 2; y++) for (let x = 2; x < aw - 2; x++) {
    const i = y * aw + x, m = mag[i]; if (m < mmax * .03) continue;
    const dx = gx[i] / (m + 1e-9), dy = gy[i] / (m + 1e-9);
    const m1 = mag[Math.round(y + dy) * aw + Math.round(x + dx)], m2 = mag[Math.round(y - dy) * aw + Math.round(x - dx)];
    if (m >= m1 && m >= m2) edge[i] = m / mmax;
  }
  const T = blur(L, aw, ah, opt.sTone ?? 1.2);
  const dm = new Float32Array(N); for (let i = 0; i < N; i++) dm[i] = mag[i] / mmax;
  const detail = blur(dm, aw, ah, opt.sDetail ?? 4);
  let dmax = 1e-6; for (let i = 0; i < N; i++) if (detail[i] > dmax) dmax = detail[i];
  for (let i = 0; i < N; i++) detail[i] = Math.min(1, detail[i] / (dmax * .55));
  return { aw, ah, N, R, G, B, L, T, gx, gy, mag, mmax, J, Jc, coh, edge, detail, D: aux.depth || null, M: aux.matte || null, faces: aux.faces || [] };
}

// ---------------------------------------------------------------- pixels of a source window
// win = [x0, y0, w, h] in source pixels (may extend past the image: outside reads as edge-clamped). mirror flips x.
const _cv = new OffscreenCanvas(8, 8), _cg = _cv.getContext('2d', { willReadFrequently: true });
export function windowPixels(img, win, aw, ah, mirror = false) {
  _cv.width = aw; _cv.height = ah;
  _cg.setTransform(1, 0, 0, 1, 0, 0); _cg.imageSmoothingEnabled = true; _cg.imageSmoothingQuality = 'high';
  _cg.fillStyle = '#000'; _cg.fillRect(0, 0, aw, ah);
  if (mirror) { _cg.translate(aw, 0); _cg.scale(-1, 1); }
  // clamp the window to the image; the uncovered rest stays black (sources are framed so this does not happen)
  const [x0, y0, w, h] = win, sx = aw / w, sy = ah / h;
  const cx0 = Math.max(0, x0), cy0 = Math.max(0, y0), cx1 = Math.min(img.width, x0 + w), cy1 = Math.min(img.height, y0 + h);
  if (cx1 > cx0 && cy1 > cy0) _cg.drawImage(img, cx0, cy0, cx1 - cx0, cy1 - cy0, (cx0 - x0) * sx, (cy0 - y0) * sy, (cx1 - cx0) * sx, (cy1 - cy0) * sy);
  return _cg.getImageData(0, 0, aw, ah);
}
// one channel of an image window as a Float32 field 0..1
export function windowField(img, win, aw, ah, mirror = false, ch = 0) {
  const d = windowPixels(img, win, aw, ah, mirror).data, out = new Float32Array(aw * ah);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + ch] / 255;
  return out;
}

// ---------------------------------------------------------------- edge chains (hysteresis, smoothed)
export function edgeChains(F, o = {}) {
  const aw = F.aw, ah = F.ah, E = o.E ?? F.edge, hi = o.hi ?? .16, lo = o.lo ?? .07, minLen = o.minLen ?? 8;
  const used = new Uint8Array(aw * ah), out = [];
  const nbr = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const trace = (x, y) => {
    const pts = []; let px = x, py = y, pa = null;
    for (let step = 0; step < 4000; step++) {
      let best = -1, bs = 0;
      for (let k = 0; k < 8; k++) {
        const nx = px + nbr[k][0], ny = py + nbr[k][1];
        if (nx < 1 || ny < 1 || nx >= aw - 1 || ny >= ah - 1) continue;
        const j = ny * aw + nx; if (used[j] || E[j] < lo) continue;
        let sc = E[j];
        if (pa !== null) { const da = Math.abs(((Math.atan2(nbr[k][1], nbr[k][0]) - pa + 3 * Math.PI) % (2 * Math.PI)) - Math.PI); sc *= da < .9 ? 1.5 : da < 1.7 ? .8 : 0; }
        if (sc > bs) { bs = sc; best = k; }
      }
      if (best < 0) break;
      pa = Math.atan2(nbr[best][1], nbr[best][0]);
      px += nbr[best][0]; py += nbr[best][1]; used[py * aw + px] = 1; pts.push([px, py]);
    }
    return pts;
  };
  for (let y = 2; y < ah - 2; y++) for (let x = 2; x < aw - 2; x++) {
    const i = y * aw + x; if (used[i] || E[i] < hi) continue;
    used[i] = 1;
    const f = trace(x, y), b = trace(x, y);
    let pts = b.reverse().concat([[x, y]], f);
    if (pts.length < minLen) continue;
    let es = 0; for (const [qx, qy] of pts) es += E[qy * aw + qx]; es /= pts.length;
    for (let it = 0; it < (o.smooth ?? 3); it++) {
      const q = pts.map(p => p.slice());
      for (let k = 1; k < pts.length - 1; k++) { q[k][0] = (pts[k - 1][0] + 2 * pts[k][0] + pts[k + 1][0]) / 4; q[k][1] = (pts[k - 1][1] + 2 * pts[k][1] + pts[k + 1][1]) / 4; }
      pts = q;
    }
    out.push({ pts, s: es });
  }
  return out;
}

// distance-like soft region from an ellipse {x, y, rx, ry, rot, feather, k} in uv units (rx, ry as fractions of width)
export function ellipseMask(F, e) {
  const out = new Float32Array(F.N), cs = Math.cos(e.rot || 0), sn = Math.sin(e.rot || 0), asp = F.aw / F.ah;
  for (let y = 0; y < F.ah; y++) for (let x = 0; x < F.aw; x++) {
    const u = x / F.aw - e.x, v = (y / F.ah - e.y) / asp;
    const xr = u * cs + v * sn, yr = -u * sn + v * cs;
    const r = Math.hypot(xr / e.rx, yr / (e.ry / asp));
    out[y * F.aw + x] = 1 - sstep(1 - (e.feather ?? .5), 1 + (e.feather ?? .5) * .35, r);
  }
  return out;
}
