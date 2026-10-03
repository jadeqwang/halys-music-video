// core.js: math, deterministic randomness, noise and colour helpers shared by every scene.
//
// The film is a pure function of (master frame, output size). Frames render out of order in parallel
// workers, so nothing may carry state from one frame to the next. Caches are fine as long as results never
// depend on what was rendered before. Use rng(seed) / hash*(…) instead of Math.random() (main.js reseeds
// Math.random per draw as a safety net, but explicit seeds keep scenes readable).

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, k) => a + (b - a) * k;
export const inv = (a, b, x) => (x - a) / (b - a);
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = k => k * k * (3 - 2 * k);
export const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a)));
export const frac = x => x - Math.floor(x);
export const easeIn = k => k * k * k;
export const easeOut = k => 1 - Math.pow(1 - k, 3);
export const easeInOut = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
export const expoOut = k => k >= 1 ? 1 : 1 - Math.pow(2, -10 * k);
export const mix = (a, b, k) => Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], k)) : lerp(a, b, k);

// keyframes: kf(t, [[t0, v0], [t1, v1], ...], easeFn); values may be numbers or arrays
export function kf(t, keys, fn = smooth) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i];
      return mix(va, vb, fn((t - a) / (b - a)));
    }
  }
  return keys[keys.length - 1][1];
}

// ---------------------------------------------------------------- hashing / rng
export function hash(n) { // int -> [0, 1)
  n = (n | 0) ^ 0x9e3779b9; n = Math.imul(n ^ (n >>> 16), 0x85ebca6b); n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35); n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
export const hash2 = (a, b) => hash(Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1));
export const hash3 = (a, b, c) => hash(Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1));
export function rng(seed) { // mulberry32
  let s = (seed | 0) ^ 0x6d2b79f5;
  return () => { s = (s + 0x6d2b79f5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
export function strSeed(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---------------------------------------------------------------- value noise
export function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash3(xi, yi, seed), b = hash3(xi + 1, yi, seed), c = hash3(xi, yi + 1, seed), d = hash3(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, seed = 0, oct = 4) {
  let s = 0, a = .5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 17); n += a; a *= .5; f *= 2.03; }
  return s / n;
}

// ---------------------------------------------------------------- colour
export function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function rgbHex(r, g, b) { return '#' + ((1 << 24) | (clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8) | clamp(Math.round(b), 0, 255)).toString(16).slice(1); }
export function mixHex(a, b, k) { const A = hexRgb(a), B = hexRgb(b); return rgbHex(lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k)); }
export function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }

// The colour script (TREATMENT.md): no blue until Earth. One palette per world; scenes pick from these.
export const PAL = {
  bronze: { bg: '#120c08', umber: '#3b2414', ochre: '#b8792e', verm: '#c2401f', bronze: '#a8743a', lead: '#e9e0cc', ink: '#0b0806' },
  corona: { bg: '#030304', pearl: '#efe9dc', orange: '#ff7a1a', navy: '#0b1430', ha: '#e0405a' },   // Jade's palette; H-alpha only as accent
  marble: { bg: '#0e0d0c', stone: '#d9d2c4', vein: '#7d756a', glow: '#ff8a3a', corona: '#efe9dc' },
  gold: { bg: '#1a0f05', gold: '#f1b545', red: '#9c2b1b', light: '#fff1c9', clay: '#8a3b22' },
  orbit: { bg: '#020203', pearl: '#efe9dc', orange: '#ff7a1a', navy: '#0b1430', earth: '#2f7de1' },  // the first blue in the film
  room: { bg: '#0b0d14', line: '#11121a', paper: '#f4efe6', orange: '#ff7a1a', screen: '#9fe6b0', navy: '#1a2238' },
};
