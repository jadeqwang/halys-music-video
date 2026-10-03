// util.js: math, hashing, colour spaces, blurs and field sampling for the brush engine.
// Everything here is allocation-light and deterministic (frames render out of order in parallel workers).

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = k => k * k * (3 - 2 * k);
export const sstep = (a, b, x) => { const k = (x - a) / (b - a); return k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k); };
export const frac = x => x - Math.floor(x);
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// piecewise keyframes: kf(t, [[t0, v0], [t1, v1], ...], ease); values numbers or arrays
export function kf(t, keys, fn = smooth) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i], k = fn((t - a) / (b - a));
      return Array.isArray(va) ? va.map((v, j) => v + (vb[j] - v) * k) : va + (vb - va) * k;
    }
  }
  return keys[keys.length - 1][1];
}
export const linear = k => k;

// ---------------------------------------------------------------- hashing
export function hash(n) {
  n = (n | 0) ^ 0x9e3779b9; n = Math.imul(n ^ (n >>> 16), 0x85ebca6b); n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35); n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
export const hash2 = (a, b) => hash(Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1));
export const hash3 = (a, b, c) => hash(Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1));
export const hash4 = (a, b, c, d) => hash(Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1) ^ Math.imul(d | 0, 0x85ebca77));
export function rng(seed) {
  let s = (seed | 0) ^ 0x6d2b79f5;
  return () => { s = (s + 0x6d2b79f5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
export function strSeed(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---------------------------------------------------------------- noise
export function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash3(xi, yi, seed), b = hash3(xi + 1, yi, seed), c = hash3(xi, yi + 1, seed), d = hash3(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, seed = 0, oct = 4, lac = 2.03, gain = .5) {
  let s = 0, a = .5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 17); n += a; a *= gain; f *= lac; }
  return s / n;
}
// a smooth fbm field at w x h computed on a coarse lattice (step px) and bilinearly upsampled: cheap low-frequency noise
export function noiseField(w, h, scale, seed, oct = 3, step = 6) {
  const gw = Math.ceil(w / step) + 2, gh = Math.ceil(h / step) + 2, G = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) G[j * gw + i] = fbm(i * step * scale, j * step * scale, seed, oct);
  const out = new Float32Array(w * h), inv = 1 / step;
  for (let y = 0; y < h; y++) {
    const gy = y * inv, j = gy | 0, fy = gy - j;
    for (let x = 0; x < w; x++) {
      const gx = x * inv, i = gx | 0, fx = gx - i, o = j * gw + i;
      out[y * w + x] = (G[o] * (1 - fx) + G[o + 1] * fx) * (1 - fy) + (G[o + gw] * (1 - fx) + G[o + gw + 1] * fx) * fy;
    }
  }
  return out;
}

// ---------------------------------------------------------------- colour
export function hex01(h) { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
export const s2l = c => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
export const l2s = c => c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - .055;
export const luma = (r, g, b) => .2126 * r + .7152 * g + .0722 * b;
// sRGB (0..1) -> linear via a 4096-entry table (fast path for per-pixel work)
const S2L_N = 4096, S2L_T = new Float32Array(S2L_N + 1);
for (let i = 0; i <= S2L_N; i++) S2L_T[i] = s2l(i / S2L_N);
export const s2lf = c => S2L_T[(c <= 0 ? 0 : c >= 1 ? S2L_N : (c * S2L_N + .5) | 0)];
// linear -> sRGB table (linear domain sampled finely near black)
const L2S_N = 8192, L2S_T = new Float32Array(L2S_N + 1);
for (let i = 0; i <= L2S_N; i++) L2S_T[i] = l2s(Math.pow(i / L2S_N, 2));
export const l2sf = c => c <= 0 ? 0 : c >= 1 ? 1 : L2S_T[(Math.sqrt(c) * L2S_N + .5) | 0];

// OKLab, writing into `out` (no allocation)
export function rgb2lab(r, g, b, out) {
  r = s2lf(r); g = s2lf(g); b = s2lf(b);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  out[0] = .2104542553 * l + .7936177850 * m - .0040720468 * s;
  out[1] = 1.9779984951 * l - 2.4285922050 * m + .4505937099 * s;
  out[2] = .0259040371 * l + .7827717662 * m - .8086757660 * s;
  return out;
}
export function lab2rgb(L, a, b, out) {
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.2914855480 * b) ** 3;
  out[0] = l2sf(4.0767416621 * l - 3.3077115913 * m + .2309699292 * s);
  out[1] = l2sf(-1.2684380046 * l + 2.6097574011 * m - .3413193965 * s);
  out[2] = l2sf(-.0041960863 * l - .7034186147 * m + 1.7076147010 * s);
  return out;
}
export const srgb2oklab = (r, g, b) => rgb2lab(r, g, b, [0, 0, 0]);
export const oklab2srgb = (L, a, b) => lab2rgb(L, a, b, [0, 0, 0]);

// ---------------------------------------------------------------- blur
const _tmp = { a: null, n: 0 };
function scratch(n) { if (_tmp.n < n) { _tmp.a = new Float32Array(n); _tmp.n = n; } return _tmp.a; }
function gaussKernel(sigma) {
  const r = Math.max(1, Math.ceil(sigma * 2.6)), k = new Float32Array(2 * r + 1);
  let s = 0; for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-i * i / (2 * sigma * sigma)); s += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  return { r, k };
}
function boxH(src, dst, w, h, r) {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const o = y * w; let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[o + (i < 0 ? 0 : i >= w ? w - 1 : i)];
    for (let x = 0; x < w; x++) {
      dst[o + x] = acc * inv;
      const a = x + r + 1, b = x - r;
      acc += src[o + (a >= w ? w - 1 : a)] - src[o + (b < 0 ? 0 : b)];
    }
  }
}
function boxV(src, dst, w, h, r) {
  const inv = 1 / (2 * r + 1);
  const acc = new Float64Array(w);
  for (let i = -r; i <= r; i++) { const yy = i < 0 ? 0 : i >= h ? h - 1 : i, o = yy * w; for (let x = 0; x < w; x++) acc[x] += src[o + x]; }
  for (let y = 0; y < h; y++) {
    const o = y * w, a = (y + r + 1 >= h ? h - 1 : y + r + 1) * w, b = (y - r < 0 ? 0 : y - r) * w;
    for (let x = 0; x < w; x++) { dst[o + x] = acc[x] * inv; acc[x] += src[a + x] - src[b + x]; }
  }
}
// true box blur of radius r (two running-sum passes)
export function boxBlur(src, w, h, r, out = null) {
  const N = w * h; out = out || new Float32Array(N);
  if (r < 1) { out.set(src.subarray(0, N)); return out; }
  const tmp = scratch(N); boxH(src, tmp, w, h, r); boxV(tmp, out, w, h, r); return out;
}
// 2x / 4x box downsample and bilinear upsample (for blurs at large sigma)
export function down(src, w, h, f) {
  const dw = Math.ceil(w / f), dh = Math.ceil(h / f), out = new Float32Array(dw * dh), inv = 1 / (f * f);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    let s = 0;
    for (let j = 0; j < f; j++) { const yy = Math.min(h - 1, y * f + j) * w; for (let i = 0; i < f; i++) s += src[yy + Math.min(w - 1, x * f + i)]; }
    out[y * dw + x] = s * inv;
  }
  return out;
}
export function up(src, dw, dh, w, h, f, out = null) {
  out = out || new Float32Array(w * h);
  const inv = 1 / f, o = .5 / f - .5;
  for (let y = 0; y < h; y++) {
    let fy = y * inv + o; if (fy < 0) fy = 0; if (fy > dh - 1.001) fy = dh - 1.001;
    const yi = fy | 0, ty = fy - yi, r0 = yi * dw, r1 = Math.min(dh - 1, yi + 1) * dw;
    for (let x = 0; x < w; x++) {
      let fx = x * inv + o; if (fx < 0) fx = 0; if (fx > dw - 1.001) fx = dw - 1.001;
      const xi = fx | 0, tx = fx - xi, x1 = Math.min(dw - 1, xi + 1);
      out[y * w + x] = (src[r0 + xi] * (1 - tx) + src[r0 + x1] * tx) * (1 - ty) + (src[r1 + xi] * (1 - tx) + src[r1 + x1] * tx) * ty;
    }
  }
  return out;
}
// Gaussian blur that drops to half / quarter resolution for large sigma (the result is smooth anyway)
export function blurFast(src, w, h, sigma, out = null) {
  const f = sigma >= 7 ? 4 : sigma >= 3 ? 2 : 1;
  if (f === 1) return blur(src, w, h, sigma, out);
  const dw = Math.ceil(w / f), dh = Math.ceil(h / f), d = down(src, w, h, f), b = blur(d, dw, dh, sigma / f);
  return up(b, dw, dh, w, h, f, out);
}

// Gaussian blur of a Float32 field (exact kernel below sigma 3, three box passes above). Returns a new array
// (or writes into `out` when given; out may not alias src).
export function blur(src, w, h, sigma, out = null) {
  const N = w * h;
  out = out || new Float32Array(N);
  if (sigma <= 0.05) { out.set(src.subarray ? src.subarray(0, N) : src); return out; }
  const tmp = scratch(N);
  if (sigma < 1.8) {
    const { r, k } = gaussKernel(sigma);
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = 0; x < w; x++) {
        let a = 0;
        if (x >= r && x < w - r) { for (let i = -r; i <= r; i++) a += src[o + x + i] * k[i + r]; }
        else for (let i = -r; i <= r; i++) { const xx = x + i < 0 ? 0 : x + i >= w ? w - 1 : x + i; a += src[o + xx] * k[i + r]; }
        tmp[o + x] = a;
      }
    }
    for (let y = 0; y < h; y++) {
      const o = y * w;
      if (y >= r && y < h - r) {
        for (let x = 0; x < w; x++) out[o + x] = 0;
        for (let i = -r; i <= r; i++) { const kk = k[i + r], oo = (y + i) * w; for (let x = 0; x < w; x++) out[o + x] += tmp[oo + x] * kk; }
      } else {
        for (let x = 0; x < w; x++) { let a = 0; for (let i = -r; i <= r; i++) { const yy = y + i < 0 ? 0 : y + i >= h ? h - 1 : y + i; a += tmp[yy * w + x] * k[i + r]; } out[o + x] = a; }
      }
    }
    return out;
  }
  const nb = 3, wIdeal = Math.sqrt(12 * sigma * sigma / nb + 1);
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sigma * sigma - nb * wl * wl - 4 * nb * wl - 3 * nb) / (-4 * wl - 4));
  out.set(src.subarray ? src.subarray(0, N) : src);
  for (let i = 0; i < nb; i++) {
    const r = ((i < m ? wl : wl + 2) - 1) / 2;
    boxH(out, tmp, w, h, r); boxV(tmp, out, w, h, r);
  }
  return out;
}

// ---------------------------------------------------------------- sampling
// bilinear sample of a w x h field at fractional (x, y), clamped
export function sampleField(arr, w, h, x, y) {
  x = x < 0 ? 0 : x > w - 1.001 ? w - 1.001 : x; y = y < 0 ? 0 : y > h - 1.001 ? h - 1.001 : y;
  const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, i = yi * w + xi;
  return (arr[i] * (1 - fx) + arr[i + 1] * fx) * (1 - fy) + (arr[i + w] * (1 - fx) + arr[i + w + 1] * fx) * fy;
}
export const samp = (F, arr, x, y) => sampleField(arr, F.aw, F.ah, x, y);

// resample a field (box filter when shrinking, bilinear when growing)
export function resample(src, sw, sh, dw, dh) {
  if (sw === dw && sh === dh) return src;
  const out = new Float32Array(dw * dh);
  if (dw <= sw && dh <= sh) {
    const sx = sw / dw, sy = sh / dh;
    for (let y = 0; y < dh; y++) {
      const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
      for (let x = 0; x < dw; x++) {
        const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
        let s = 0, n = 0;
        for (let yy = y0; yy < y1 && yy < sh; yy++) for (let xx = x0; xx < x1 && xx < sw; xx++) { s += src[yy * sw + xx]; n++; }
        out[y * dw + x] = n ? s / n : 0;
      }
    }
    return out;
  }
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++)
    out[y * dw + x] = sampleField(src, sw, sh, (x + .5) * sw / dw - .5, (y + .5) * sh / dh - .5);
  return out;
}

// soft elliptical region {x, y, rx, ry, rot, feather, k} in frame uv (rx as a fraction of width, ry of height)
export function ellipseInto(out, w, h, e, op = 'max') {
  const cs = Math.cos(e.rot || 0), sn = Math.sin(e.rot || 0), asp = w / h, fe = e.feather ?? .5, k = e.k ?? 1;
  const rx = e.rx, ry = e.ry / asp;
  // bounding box (generous) to skip far pixels
  const R = Math.max(rx, ry) * (1 + fe * .35) * w + 2;
  const x0 = Math.max(0, Math.floor(e.x * w - R)), x1 = Math.min(w - 1, Math.ceil(e.x * w + R));
  const y0 = Math.max(0, Math.floor(e.y * h - R)), y1 = Math.min(h - 1, Math.ceil(e.y * h + R));
  const lo = 1 - fe, hi = 1 + fe * .35;
  for (let y = y0; y <= y1; y++) {
    const v = (y / h - e.y) / asp;
    for (let x = x0; x <= x1; x++) {
      const u = x / w - e.x, xr = u * cs + v * sn, yr = -u * sn + v * cs;
      const r = Math.sqrt((xr / rx) * (xr / rx) + (yr / ry) * (yr / ry));
      const m = (1 - sstep(lo, hi, r)) * k, i = y * w + x;
      if (op === 'max') { if (m > out[i]) out[i] = m; } else if (op === 'add') out[i] += m; else if (op === 'mul') out[i] *= 1 - m;
    }
  }
  return out;
}

// polygon (uv points) rasterised with a soft edge of `feather` px: for designed regions (river, banks, shield)
export function polygonInto(out, w, h, pts, k = 1, feather = 2) {
  const P = pts.map(([u, v]) => [u * w, v * h]);
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (const [x, y] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  x0 = Math.max(0, Math.floor(x0 - feather - 1)); x1 = Math.min(w - 1, Math.ceil(x1 + feather + 1));
  y0 = Math.max(0, Math.floor(y0 - feather - 1)); y1 = Math.min(h - 1, Math.ceil(y1 + feather + 1));
  const n = P.length;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let inside = false, dmin = 1e9;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
      const dx = xj - xi, dy = yj - yi, L2 = dx * dx + dy * dy || 1, t = clamp(((x - xi) * dx + (y - yi) * dy) / L2);
      const qx = xi + dx * t - x, qy = yi + dy * t - y; dmin = Math.min(dmin, qx * qx + qy * qy);
    }
    const d = Math.sqrt(dmin) * (inside ? -1 : 1), m = (1 - sstep(-feather, feather, d)) * k, i = y * w + x;
    if (m > out[i]) out[i] = m;
  }
  return out;
}

export function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// LRU cache (values left to the GC on eviction)
export class LRU {
  constructor(max = 8) { this.max = max; this.m = new Map(); }
  get(k) { if (!this.m.has(k)) return undefined; const v = this.m.get(k); this.m.delete(k); this.m.set(k, v); return v; }
  set(k, v) { this.m.set(k, v); while (this.m.size > this.max) this.m.delete(this.m.keys().next().value); return v; }
  has(k) { return this.m.has(k); }
}
