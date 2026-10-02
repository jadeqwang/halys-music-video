// core.js: math, deterministic randomness, noise, colour spaces and palettes shared by every material.
// Every render is a pure function of (plate, material, params, t). Nothing carries state between frames
// except caches whose contents never depend on render order.

export const W = 1920, H = 1080, TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = k => k * k * (3 - 2 * k);
export const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a)));
export const frac = x => x - Math.floor(x);

// ---------------------------------------------------------------- hashing / rng
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
export function shuffle(arr, seed) {
  const r = rng(seed);
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}

// ---------------------------------------------------------------- value noise
export function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash3(xi, yi, seed), b = hash3(xi + 1, yi, seed), c = hash3(xi, yi + 1, seed), d = hash3(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, seed = 0, oct = 4, lac = 2.03, gain = .5) {
  let s = 0, a = .5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 17); n += a; a *= gain; f *= lac; }
  return s / n;
}

// ---------------------------------------------------------------- colour
export function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
export const s2l = c => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
export const l2s = c => c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - .055;
// sRGB -> linear lookup for 8-bit inputs
export const S2L8 = new Float32Array(256); for (let i = 0; i < 256; i++) S2L8[i] = s2l(i / 255);

export function lin2oklab(r, g, b) {
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .7936177850 * m - .0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .8086757660 * s];
}
export function oklab2lin(L, a, b) {
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.7076147010 * s];
}
export const srgb2oklab = (r, g, b) => lin2oklab(s2l(r), s2l(g), s2l(b));
export function oklab2srgb(L, a, b) { const c = oklab2lin(L, a, b); return [clamp(l2s(c[0])), clamp(l2s(c[1])), clamp(l2s(c[2]))]; }
export const luma = (r, g, b) => .2126 * r + .7152 * g + .0722 * b;

// ---------------------------------------------------------------- palettes
export const BRONZE_PALETTE = {
  boneBlack: '#0b0806', rawUmber: '#3b2a1a', burntUmber: '#5a3a22', burntSienna: '#8a4a2a', yellowOchre: '#b8862f',
  naples: '#e3c27a', leadWhite: '#efe6d2', vermilion: '#c2361f', madder: '#7d1f24', verdigris: '#4a6a58'
};

// Pigment mixing: linear-light average pulled toward the geometric mean (subtractive darkening of real paint).
export function mixPigment(a, b, t, sub = .45) {
  const out = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const la = s2l(a[i]), lb = s2l(b[i]);
    const lin = la * (1 - t) + lb * t, geo = Math.pow(Math.max(la, 1e-4), 1 - t) * Math.pow(Math.max(lb, 1e-4), t);
    out[i] = l2s(lin * (1 - sub) + geo * sub);
  }
  return out;
}

// A palette "box": every colour a painter could mix from these tubes (pure, pairwise mixes, tints, shades,
// and a few three-way earth mixes), indexed by a 3D LUT over sRGB so mapping a pixel is one lookup.
export class PaletteBox {
  constructor(hexes, o = {}) {
    const tubes = hexes.map(hexRgb);
    const cands = [];
    const add = c => cands.push(c);
    tubes.forEach(add);
    const steps = o.steps ?? [.125, .25, .375, .5, .625, .75, .875];
    for (let i = 0; i < tubes.length; i++) for (let j = i + 1; j < tubes.length; j++) for (const t of steps) add(mixPigment(tubes[i], tubes[j], t));
    // three-way: every pair mixed, then toward white / black (tints and shades of mixtures)
    const white = tubes[o.white ?? 6], black = tubes[o.black ?? 0];
    const base = cands.slice();
    for (const c of base) for (const t of [.2, .4, .6]) { add(mixPigment(c, white, t, .2)); add(mixPigment(c, black, t, .5)); }
    this.cands = cands;
    this.lab = cands.map(c => srgb2oklab(c[0], c[1], c[2]));
    this.wL = o.wL ?? 2.2; this.wC = o.wC ?? 1;
    this.N = o.lut ?? 25;
    this._buildLUT();
  }
  nearest(L, a, b) {
    let best = 0, bd = 1e9;
    const wL = this.wL, wC = this.wC, lab = this.lab;
    for (let i = 0; i < lab.length; i++) {
      const p = lab[i], dL = p[0] - L, da = p[1] - a, db = p[2] - b;
      const d = wL * dL * dL + wC * (da * da + db * db);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  _buildLUT() {
    const N = this.N, lut = new Float32Array(N * N * N * 3);
    for (let bi = 0; bi < N; bi++) for (let gi = 0; gi < N; gi++) for (let ri = 0; ri < N; ri++) {
      const [L, a, b] = srgb2oklab(ri / (N - 1), gi / (N - 1), bi / (N - 1));
      const c = this.cands[this.nearest(L, a, b)], o = ((bi * N + gi) * N + ri) * 3;
      lut[o] = c[0]; lut[o + 1] = c[1]; lut[o + 2] = c[2];
    }
    this.lut = lut;
  }
  // trilinear lookup; out = [r,g,b] in sRGB 0..1
  map(r, g, b, out = [0, 0, 0]) {
    const N = this.N, f = N - 1, lut = this.lut;
    const x = clamp(r) * f, y = clamp(g) * f, z = clamp(b) * f;
    const x0 = Math.min(f - 1, x | 0), y0 = Math.min(f - 1, y | 0), z0 = Math.min(f - 1, z | 0), fx = x - x0, fy = y - y0, fz = z - z0;
    for (let c = 0; c < 3; c++) {
      const i = (z0 * N + y0) * N + x0;
      const c000 = lut[i * 3 + c], c100 = lut[(i + 1) * 3 + c], c010 = lut[(i + N) * 3 + c], c110 = lut[(i + N + 1) * 3 + c];
      const j = i + N * N;
      const c001 = lut[j * 3 + c], c101 = lut[(j + 1) * 3 + c], c011 = lut[(j + N) * 3 + c], c111 = lut[(j + N + 1) * 3 + c];
      out[c] = lerp(lerp(lerp(c000, c100, fx), lerp(c010, c110, fx), fy), lerp(lerp(c001, c101, fx), lerp(c011, c111, fx), fy), fz);
    }
    return out;
  }
}

// ---------------------------------------------------------------- canvases / images
export function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function loadImage(url) { return new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => bad(new Error('img ' + url)); im.src = url; }); }
export async function loadJSON(url, fallback = null) { try { const r = await fetch(url); if (!r.ok) return fallback; return await r.json(); } catch (e) { return fallback; } }
export function imageData(img, w, h, src) {
  const c = makeCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  if (src) g.drawImage(img, src[0], src[1], src[2], src[3], 0, 0, w, h); else g.drawImage(img, 0, 0, w, h);
  return g.getImageData(0, 0, w, h);
}
