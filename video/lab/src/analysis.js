// analysis.js: one analysis of a plate frame, shared by all four materials.
//
// analyze() turns an RGB frame (plus the offline depth and matte from analysis/prep.py) into fields at an
// analysis resolution aw x ah:  colour (R,G,B, sRGB 0..1), luminance L, tone T, gradient (gx, gy, mag),
// a multi-scale structure tensor (Jxx, Jxy, Jyy) whose minor eigenvector is the FLOW (the direction of form,
// tangent to edges), coherence, thinned edges, local detail, depth D and matte M.
// The plate itself is never displayed by any material: only marks derived from these fields.

import { clamp, lerp, sstep, hash, hash3, makeCanvas } from './core.js';

// ---------------------------------------------------------------- blur
function gaussKernel(sigma) {
  const r = Math.max(1, Math.ceil(sigma * 2.6)), k = new Float32Array(2 * r + 1);
  let s = 0; for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-i * i / (2 * sigma * sigma)); s += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  return { r, k };
}
function boxPass(src, dst, w, h, r, horiz) {
  const n = 2 * r + 1, inv = 1 / n;
  if (horiz) {
    for (let y = 0; y < h; y++) {
      const o = y * w; let acc = 0;
      for (let i = -r; i <= r; i++) acc += src[o + clamp(i, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        dst[o + x] = acc * inv;
        acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
      }
    }
  } else {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += src[clamp(i, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        dst[y * w + x] = acc * inv;
        acc += src[Math.min(h - 1, y + r + 1) * w + x] - src[Math.max(0, y - r) * w + x];
      }
    }
  }
}
// Gaussian blur of a Float32 field (exact kernel for small sigma, three box passes for large sigma)
export function blur(src, w, h, sigma) {
  if (sigma <= 0.05) return src.slice();
  const out = new Float32Array(w * h), tmp = new Float32Array(w * h);
  if (sigma < 3) {
    const { r, k } = gaussKernel(sigma);
    for (let y = 0; y < h; y++) { const o = y * w; for (let x = 0; x < w; x++) { let a = 0; for (let i = -r; i <= r; i++) { const xx = x + i < 0 ? 0 : x + i >= w ? w - 1 : x + i; a += src[o + xx] * k[i + r]; } tmp[o + x] = a; } }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let i = -r; i <= r; i++) { const yy = y + i < 0 ? 0 : y + i >= h ? h - 1 : y + i; a += tmp[yy * w + x] * k[i + r]; } out[y * w + x] = a; }
    return out;
  }
  // three box blurs approximate a Gaussian (sizes from Kovesi)
  const nb = 3, wIdeal = Math.sqrt(12 * sigma * sigma / nb + 1);
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sigma * sigma - nb * wl * wl - 4 * nb * wl - 3 * nb) / (-4 * wl - 4));
  out.set(src);
  for (let i = 0; i < nb; i++) {
    const r = ((i < m ? wl : wl + 2) - 1) / 2;
    boxPass(out, tmp, w, h, r, true); boxPass(tmp, out, w, h, r, false);
  }
  return out;
}

// ---------------------------------------------------------------- sampling
export function samp(F, arr, x, y) {
  const aw = F.aw, ah = F.ah;
  x = x < 0 ? 0 : x > aw - 1.001 ? aw - 1.001 : x; y = y < 0 ? 0 : y > ah - 1.001 ? ah - 1.001 : y;
  const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, i = yi * aw + xi;
  return (arr[i] * (1 - fx) + arr[i + 1] * fx) * (1 - fy) + (arr[i + aw] * (1 - fx) + arr[i + aw + 1] * fx) * fy;
}
// flow direction at (x, y) from the bilinearly interpolated tensor: unit tangent [tx, ty] and coherence
export function flowAt(F, x, y, out = [0, 0, 0], J = F.J) {
  const a = samp(F, J.xx, x, y), b = samp(F, J.xy, x, y), c = samp(F, J.yy, x, y);
  const th = .5 * Math.atan2(2 * b, a - c) + Math.PI / 2;   // gradient angle + 90 deg = tangent
  out[0] = Math.cos(th); out[1] = Math.sin(th);
  const tr = a + c, det = Math.sqrt((a - c) * (a - c) + 4 * b * b);
  out[2] = tr > 1e-9 ? det / tr : 0;
  return out;
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
  const s1 = opt.s1 ?? 1.0;
  const L1 = blur(L, aw, ah, s1);
  const gx = new Float32Array(N), gy = new Float32Array(N), mag = new Float32Array(N);
  let mmax = 1e-6;
  for (let y = 1; y < ah - 1; y++) for (let x = 1; x < aw - 1; x++) {
    const i = y * aw + x;
    const a = L1[i - aw - 1], b = L1[i - aw], c = L1[i - aw + 1], e = L1[i - 1], f = L1[i + 1], g = L1[i + aw - 1], h2 = L1[i + aw], k = L1[i + aw + 1];
    const X = (c + 2 * f + k) - (a + 2 * e + g), Y = (g + 2 * h2 + k) - (a + 2 * b + c);
    gx[i] = X; gy[i] = Y; const m = Math.hypot(X, Y); mag[i] = m; if (m > mmax) mmax = m;
  }
  // structure tensor at two scales; the coarse one is a prior that keeps the flow smooth in flat regions
  const Jxx = new Float32Array(N), Jxy = new Float32Array(N), Jyy = new Float32Array(N);
  for (let i = 0; i < N; i++) { Jxx[i] = gx[i] * gx[i]; Jxy[i] = gx[i] * gy[i]; Jyy[i] = gy[i] * gy[i]; }
  const sT = opt.sT ?? 2.5, sTc = opt.sTc ?? 10, prior = opt.prior ?? .35;
  const fine = { xx: blur(Jxx, aw, ah, sT), xy: blur(Jxy, aw, ah, sT), yy: blur(Jyy, aw, ah, sT) };
  const coarse = { xx: blur(fine.xx, aw, ah, sTc), xy: blur(fine.xy, aw, ah, sTc), yy: blur(fine.yy, aw, ah, sTc) };
  const J = { xx: new Float32Array(N), xy: new Float32Array(N), yy: new Float32Array(N) };
  const Jc = { xx: new Float32Array(N), xy: new Float32Array(N), yy: new Float32Array(N) };
  for (let i = 0; i < N; i++) {
    J.xx[i] = fine.xx[i] + prior * coarse.xx[i]; J.xy[i] = fine.xy[i] + prior * coarse.xy[i]; J.yy[i] = fine.yy[i] + prior * coarse.yy[i];
  }
  // an even coarser flow for big brushes and long field lines
  const sTb = opt.sTb ?? 22;
  const big = { xx: blur(coarse.xx, aw, ah, sTb), xy: blur(coarse.xy, aw, ah, sTb), yy: blur(coarse.yy, aw, ah, sTb) };
  for (let i = 0; i < N; i++) { Jc.xx[i] = coarse.xx[i] + .5 * big.xx[i]; Jc.xy[i] = coarse.xy[i] + .5 * big.xy[i]; Jc.yy[i] = coarse.yy[i] + .5 * big.yy[i]; }
  const coh = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = J.xx[i], b = J.xy[i], c = J.yy[i], tr = a + c, det = Math.sqrt((a - c) * (a - c) + 4 * b * b);
    coh[i] = tr > 1e-9 ? det / tr : 0;
  }
  // thinned edges (non-maximum suppression on the gradient magnitude)
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
  const F = { aw, ah, N, R, G, B, L, T, gx, gy, mag, mmax, J, Jc, coh, edge, detail };
  F.D = aux.depth ? resampleField(aux.depth, aw, ah) : null;
  F.M = aux.matte ? resampleField(aux.matte, aw, ah) : null;
  F.faces = aux.faces || [];
  return F;
}

// resample a {w,h,data:Float32Array} field to aw x ah (box filter when shrinking)
export function resampleField(f, aw, ah) {
  if (f.w === aw && f.h === ah) return f.data;
  const out = new Float32Array(aw * ah), sx = f.w / aw, sy = f.h / ah;
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx)), y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    let s = 0, n = 0;
    for (let yy = y0; yy < y1 && yy < f.h; yy++) for (let xx = x0; xx < x1 && xx < f.w; xx++) { s += f.data[yy * f.w + xx]; n++; }
    out[y * aw + x] = n ? s / n : 0;
  }
  return out;
}

// decode the two-byte packed depth PNG (R = high byte, G = low byte) into a Float32 field
export function decodeDepth(img) {
  const c = makeCanvas(img.width, img.height), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data, out = new Float32Array(img.width * img.height);
  for (let i = 0; i < out.length; i++) out[i] = (d[i * 4] * 256 + d[i * 4 + 1]) / 65535;
  return { w: img.width, h: img.height, data: out };
}
export function decodeGrey(img, w = img.width, h = img.height) {
  const c = makeCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
  return { w, h, data: out };
}

// ---------------------------------------------------------------- fields helpers
// distance-like soft region from an elliptical spec {x, y, rx, ry, rot, feather} in uv (0..1) units
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

// Trace a streamline through the flow (RK2), both directions. Returns array of [x, y] in analysis px.
// o: { step, maxLen, J, stop(x,y)->bool, minCoh }
export function streamline(F, x0, y0, o = {}) {
  const step = o.step ?? 1, maxN = Math.ceil((o.maxLen ?? 120) / step), J = o.J ?? F.J;
  const fw = [], bw = [], v = [0, 0, 0], v2 = [0, 0, 0];
  for (const dir of [1, -1]) {
    let x = x0, y = y0, px = 0, py = 0;
    flowAt(F, x, y, v, J); px = v[0] * dir; py = v[1] * dir;
    const pts = dir > 0 ? fw : bw;
    for (let k = 0; k < maxN; k++) {
      flowAt(F, x, y, v, J);
      let dx = v[0], dy = v[1]; if (dx * px + dy * py < 0) { dx = -dx; dy = -dy; }
      const mx = x + dx * step * .5, my = y + dy * step * .5;
      flowAt(F, mx, my, v2, J);
      let ex = v2[0], ey = v2[1]; if (ex * dx + ey * dy < 0) { ex = -ex; ey = -ey; }
      if (o.bend) { const bb = o.bend(x, y, ex, ey); ex = bb[0]; ey = bb[1]; }
      const nx = x + ex * step, ny = y + ey * step;
      if (nx < 1 || ny < 1 || nx > F.aw - 2 || ny > F.ah - 2) break;
      if (o.stop && o.stop(nx, ny, k)) break;
      x = nx; y = ny; px = ex; py = ey;
      pts.push([x, y]);
    }
  }
  return bw.reverse().concat([[x0, y0]], fw);
}

// Chain thinned edges into polylines (hysteresis), smoothed. Returns [{pts:[[x,y]...], s: mean strength}]
export function edgeChains(F, o = {}) {
  const aw = F.aw, ah = F.ah, E = o.E ?? F.edge, hi = o.hi ?? .16, lo = o.lo ?? .07, minLen = o.minLen ?? 8;
  const used = new Uint8Array(aw * ah), out = [];
  const nbr = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const trace = (x, y) => {
    const pts = []; let px = x, py = y, pa = null;
    for (let step = 0; step < 2000; step++) {
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

// Line integral convolution of a noise field along the flow (for veining and streak textures)
export function lic(F, noise, o = {}) {
  const aw = F.aw, ah = F.ah, L = o.len ?? 12, J = o.J ?? F.J, out = new Float32Array(F.N), v = [0, 0, 0];
  // precompute unit flow per pixel
  const fx = new Float32Array(F.N), fy = new Float32Array(F.N);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) { flowAt(F, x, y, v, J); fx[y * aw + x] = v[0]; fy[y * aw + x] = v[1]; }
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    let s = noise[y * aw + x], n = 1;
    for (const dir of [1, -1]) {
      let px = x + .5, py = y + .5, dx = fx[y * aw + x] * dir, dy = fy[y * aw + x] * dir;
      for (let k = 1; k <= L; k++) {
        const xi = px | 0, yi = py | 0; if (xi < 0 || yi < 0 || xi >= aw || yi >= ah) break;
        let ex = fx[yi * aw + xi], ey = fy[yi * aw + xi]; if (ex * dx + ey * dy < 0) { ex = -ex; ey = -ey; }
        dx = ex; dy = ey; px += dx; py += dy;
        const xj = px | 0, yj = py | 0; if (xj < 0 || yj < 0 || xj >= aw || yj >= ah) break;
        const wgt = 1 - k / (L + 1);
        s += noise[yj * aw + xj] * wgt; n += wgt;
      }
    }
    out[y * aw + x] = s / n;
  }
  return out;
}
