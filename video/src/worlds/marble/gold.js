// gold.js: the GOLD world (STYLE_BIBLE): BRONZE in returning golden-hour sunlight. Same palette pushed warm and
// high-key, plus gold leaf #d4a840; the light pool becomes the whole frame; glory clouds are painted (Tiepolo/Rubens,
// never lens-flare rays). Two ways to paint it:
//
//   paint(f, src, { ...GOLD_PAINT, ...goldLook(src, {...}), sky: glorySky({...}), sun: goldSun(t, {...}) })
//       the engine's own relighting with the 'gold' box (chorus2.js, gold_outro.js)
//   goldReference(src, o) -> {R, G, B} arrays already graded and mapped into the gold box (identity mode), so a scene
//       can blend them per pixel with the marble reference: the SPARK (S57) warms marble into gold across a front
//
// The sun after third contact (194.86): the moon slides off to the upper left; the bright part grows from the lower
// right. Film time compresses the egress (RESEARCH 1.4: about 50 min of real golden hour), so the gold sun is a fat
// golden-orange crescent low over the river, bitten at its upper left, never a ringed disk.

import { clamp, lerp, sstep, rgb2lab, lab2rgb, s2lf, l2sf, blurFast } from '../brush/util.js';
import { getPalette, eclipse } from '../brush/index.js';
import { BRONZE_TUBES } from '../brush/palette.js';
import { MARBLE_TUBES } from './palette.js';

export const C3 = 194.86;
export const EGRESS_DIR = [-.5, -.866];                    // sun centre -> moon centre after C3: the moon leaves up-left
// moon offset (sun radii) after third contact: K-1 at C3, then a compressed egress
export function goldOff(t) {
  if (t <= C3) return eclipse.K - 1;
  const s = t - C3;
  return eclipse.K - 1 + .022 * s + .19 * (1 - Math.exp(-s / 2.2)) + .013 * s * s * .1;
}

export const GOLD_PAINT = {
  palette: 'gold',
  gammaIn: .86, liftIn: 1.2, contrastIn: 1.12, satIn: 1.28, warmIn: .05, crushFloor: .17, crush: .2, satOut: .72, darkVar: .05,
  envDim: .9, glint: 1, glintT: .66, glintReach: 22, focusLift: .3, poolBlur: 4, poolLo: .1, poolHi: .8,
  rim: .9, rimBreak: .45, fringe: 1, plateKeep: .5, keepDim: .95,
  impasto: .62, thick: .38, thickHi: .62, spec: .24, varnish: .88, vignette: .28, accents: 1.15, accentThick: 1.6, crack: .2,
  faceMin: .3, eyeStrokes: 1, eclipse: 0,
};

// the whole frame is the pool; faces and the light's own pool on top (act1's plateLook, pushed high-key)
export function goldLook(src, o = {}) {
  const pools = [{ x: .5, y: .5, rx: 1.2, ry: 1.2, feather: .5, k: o.base ?? .78 }, ...(o.pool || [])];
  for (const q of src.faces || []) {
    const [u0, v0, u1, v1] = q.box, w = u1 - u0, h = v1 - v0; if (w < .03) continue;
    pools.push({ x: (u0 + u1) / 2, y: (v0 + v1) / 2, rx: w * .85, ry: h * .75, feather: .7, k: 1, fig: true });
  }
  return {
    lightDir: o.lightDir || [.7, -.7], ...(o.lightPoint ? { lightPoint: o.lightPoint } : {}),
    pool: pools, poolFromLight: { k: o.fromLight ?? .7, bg: o.bg ?? .45 }, poolMatte: o.poolMatte ?? .45,
    ...(o.extra || {}),
  };
}

// glory: bright cream-gold cloud banks with lit rims, wound loosely around the sun's opening (the engine's Altdorfer
// vortex, opened up and lightened)
export function glorySky(o = {}) {
  return { vortex: .3, twist: 1.05, arms: 3, cover: .5, glow: 1.25, glowR: .34, drama: .22, fire: .95, zenith: .42, gapHi: .9, horizon: .85,
    bodyL: .5, rimL: .98, haze: .22, night: 0, ring: 0, rotSpeed: .01, ...o };
}

// the golden sun after third contact (frame uv, r as a fraction of W)
export function goldSun(t, o = {}) {
  return { x: o.x ?? .5, y: o.y ?? .3, r: o.r ?? .028, alt: o.alt ?? 6, off: o.off ?? goldOff(t), dir: EGRESS_DIR, moonVis: 0, beads: false,
    blaze: o.blaze ?? 1.32, ...(o.ring ? { ring: o.ring, ringAng: o.ringAng } : {}), ...(o.extra || {}) };
}

// ---------------------------------------------------------------- gold reference (identity mode)
// The plate graded into golden-hour paint and mapped into the gold box, written in sRGB minus the engine's warm
// offsets (paint() with the identity settings adds them back). sky: Float32 mask; skyCol(x, y, out) designs the sky.
export function goldReference(src, o = {}) {
  const { aw, ah } = src, N = aw * ah, box = getPalette('gold');
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N), lab = [0, 0, 0], rgb = [0, 0, 0], m = [0, 0, 0];
  // exposure: the plate's 85th percentile to a bright value (high key)
  const L = new Float32Array(N); for (let i = 0; i < N; i++) L[i] = .2126 * src.R[i] + .7152 * src.G[i] + .0722 * src.B[i];
  let q = .5; { const h = new Uint32Array(256); for (let i = 0; i < N; i += 3) h[Math.min(255, L[i] * 255 | 0)]++; let a = 0; for (let b = 0; b < 256; b++) { a += h[b]; if (a >= N / 3 * .85) { q = (b + .5) / 255; break; } } }
  const gain = (o.target ?? .82) / Math.max(.08, q), sat = o.sat ?? 1.3, warm = o.warm ?? .035, gam = o.gamma ?? .85;
  const Lb = blurFast(L, aw, ah, 18 * aw / 960);
  const sky = o.sky || null, skyCol = o.skyCol || null;
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const i = y * aw + x;
    let r = Math.min(1, src.R[i] * gain), g = Math.min(1, src.G[i] * gain), b = Math.min(1, src.B[i] * gain);
    rgb2lab(r, g, b, lab);
    // high key with a warm lift; local contrast kept (the light pool is the whole frame, the forms still turn)
    let Lk = Math.pow(clamp(lab[0]), gam);
    Lk = clamp(Lk + (o.local ?? .35) * (L[i] - Lb[i]) * gain * .5, .03, .97);
    let a = lab[1] * sat + warm * .3, bb = lab[2] * sat + warm;
    if (o.light) { const k = o.light(x / aw, y / ah); Lk = clamp(Lk * (1 - .35 * (1 - k)) + .08 * k); }
    lab2rgb(Lk, a, bb, rgb);
    if (sky && sky[i] > .002 && skyCol) { skyCol(x / aw, y / ah, m); const s = sky[i]; rgb[0] = lerp(rgb[0], m[0], s); rgb[1] = lerp(rgb[1], m[1], s); rgb[2] = lerp(rgb[2], m[2], s); }
    box.map(rgb[0], rgb[1], rgb[2], m);
    rgb2lab(m[0], m[1], m[2], lab); lab2rgb(lab[0], lab[1] - .004, lab[2] - .012, rgb);
    R[i] = rgb[0]; G[i] = rgb[1]; B[i] = rgb[2];
  }
  return { R, G, B };
}

// a palette that holds both worlds (the spark paints marble, gold and every mixture between them in one pass)
export const SPARK_PAL = {
  tubes: { ...MARBLE_TUBES, ...Object.fromEntries(Object.entries(BRONZE_TUBES).map(([k, v]) => ['b_' + k, v])), goldLeaf: '#d4a840' },
  white: 'white', black: 'shadow', ground: [.07, .06, .055], varnish: [1, .96, .86], wL: 2.3, wC: 1.3, steps: [.15, .35, .5, .65, .85],
};
