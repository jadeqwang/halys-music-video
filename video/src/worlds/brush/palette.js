// palette.js: a painter's palette "box" for each world. Every colour a painter could mix from the world's tubes
// (pure tubes, pairwise mixes, tints and shades of the mixes), indexed by a 3D LUT over sRGB so mapping a pixel to
// the nearest paintable colour is one trilinear lookup. MARBLE and GOLD pass their own tubes (see README.md).

import { clamp, lerp, hex01, s2l, l2s, srgb2oklab } from './util.js';

// STYLE_BIBLE.md, BRONZE: Greek four-colour palette logic, no saturated blue.
export const BRONZE_TUBES = {
  boneBlack: '#0b0806', rawUmber: '#3b2a1a', burntUmber: '#5a3a22', burntSienna: '#8a4a2a', yellowOchre: '#b8862f',
  naples: '#e3c27a', leadWhite: '#efe6d2', vermilion: '#c2361f', madder: '#7d1f24', verdigris: '#4a6a58',
};
export const PALETTES = {
  bronze: { tubes: BRONZE_TUBES, white: 'leadWhite', black: 'boneBlack', ground: [.09, .065, .045], varnish: [1, .93, .76], wL: 2.2, wC: 1.4 },
  // GOLD (later agent): BRONZE pushed warm + gold leaf
  gold: { tubes: { ...BRONZE_TUBES, goldLeaf: '#d4a840' }, white: 'leadWhite', black: 'boneBlack', ground: [.11, .075, .045], varnish: [1, .95, .8], wL: 2.2, wC: 1.4 },
  // MARBLE (later agent): painted statuary
  marble: { tubes: { white: '#ece6db', bone: '#d9d6cf', grey: '#8a8c90', shadow: '#16161c', navy: '#0d1018', orange: '#f08a2a', umber: '#3b2a1a' },
    white: 'white', black: 'shadow', ground: [.06, .06, .07], varnish: [1, .98, .95], wL: 2.4, wC: 1.2 },
};

// pigment mixing: linear-light average pulled toward the geometric mean (the subtractive darkening of real paint)
export function mixPigment(a, b, t, sub = .45) {
  const out = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const la = s2l(a[i]), lb = s2l(b[i]);
    const lin = la * (1 - t) + lb * t, geo = Math.pow(Math.max(la, 1e-4), 1 - t) * Math.pow(Math.max(lb, 1e-4), t);
    out[i] = l2s(lin * (1 - sub) + geo * sub);
  }
  return out;
}

export class PaletteBox {
  constructor(spec) {
    const names = Object.keys(spec.tubes), tubes = names.map(n => hex01(spec.tubes[n]));
    this.spec = spec; this.names = names; this.tubes = Object.fromEntries(names.map((n, i) => [n, tubes[i]]));
    const cands = [], steps = spec.steps ?? [.125, .25, .375, .5, .625, .75, .875];
    tubes.forEach(c => cands.push(c));
    for (let i = 0; i < tubes.length; i++) for (let j = i + 1; j < tubes.length; j++) for (const t of steps) cands.push(mixPigment(tubes[i], tubes[j], t));
    const white = this.tubes[spec.white] || tubes[0], black = this.tubes[spec.black] || tubes[0];
    const base = cands.slice();
    for (const c of base) for (const t of [.2, .4, .6]) { cands.push(mixPigment(c, white, t, .2)); cands.push(mixPigment(c, black, t, .5)); }
    this.cands = cands;
    this.lab = new Float32Array(cands.length * 3);
    cands.forEach((c, i) => { const l = srgb2oklab(c[0], c[1], c[2]); this.lab[i * 3] = l[0]; this.lab[i * 3 + 1] = l[1]; this.lab[i * 3 + 2] = l[2]; });
    this.wL = spec.wL ?? 2.2; this.wC = spec.wC ?? 1;
    this.N = spec.lut ?? 25;
    this._buildLUT();
  }
  nearest(L, a, b) {
    let best = 0, bd = 1e9;
    const wL = this.wL, wC = this.wC, lab = this.lab, n = lab.length / 3;
    for (let i = 0; i < n; i++) {
      const dL = lab[i * 3] - L, da = lab[i * 3 + 1] - a, db = lab[i * 3 + 2] - b;
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
  // trilinear lookup; writes sRGB 0..1 into out
  map(r, g, b, out) {
    const N = this.N, f = N - 1, lut = this.lut;
    const x = clamp(r) * f, y = clamp(g) * f, z = clamp(b) * f;
    const x0 = Math.min(f - 1, x | 0), y0 = Math.min(f - 1, y | 0), z0 = Math.min(f - 1, z | 0), fx = x - x0, fy = y - y0, fz = z - z0;
    const i = (z0 * N + y0) * N + x0, j = i + N * N;
    for (let c = 0; c < 3; c++) {
      const c000 = lut[i * 3 + c], c100 = lut[(i + 1) * 3 + c], c010 = lut[(i + N) * 3 + c], c110 = lut[(i + N + 1) * 3 + c];
      const c001 = lut[j * 3 + c], c101 = lut[(j + 1) * 3 + c], c011 = lut[(j + N) * 3 + c], c111 = lut[(j + N + 1) * 3 + c];
      const a0 = c000 + (c100 - c000) * fx, a1 = c010 + (c110 - c010) * fx, b0 = c001 + (c101 - c001) * fx, b1 = c011 + (c111 - c011) * fx;
      const p = a0 + (a1 - a0) * fy, q = b0 + (b1 - b0) * fy;
      out[c] = p + (q - p) * fz;
    }
    return out;
  }
  tube(name) { return this.tubes[name]; }
}

const _boxes = new Map();
// getPalette('bronze') or getPalette({tubes: {...}, white, black, ground, varnish}) (cached per spec)
export function getPalette(p = 'bronze') {
  const spec = typeof p === 'string' ? PALETTES[p] : p;
  if (!spec) throw new Error(`unknown palette ${p}`);
  const key = typeof p === 'string' ? p : JSON.stringify(spec);
  let b = _boxes.get(key);
  if (!b) { b = new PaletteBox(spec); _boxes.set(key, b); }
  return b;
}
export const tubeMix = (pal, a, b, t) => { const A = pal.tube(a), B = pal.tube(b); return [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]; };
