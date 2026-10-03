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

import { clamp, lerp, sstep, rgb2lab, lab2rgb, s2lf, l2sf, blurFast, fbm } from '../brush/util.js';
import { getPalette, eclipse, paint } from '../brush/index.js';
import { BRONZE_TUBES } from '../brush/palette.js';
import { skyMask } from '../brush/sky.js';
import { MARBLE_TUBES } from './palette.js';
import { STONE_PAINT, MVARS } from './paint.js';
import { glory } from './glory.js';
export { glory };

export const C3 = 194.86;
export const EGRESS_DIR = [-.5, -.866];                    // sun centre -> moon centre after C3: the moon leaves up-left
// moon offset (sun radii) after third contact: K-1 at C3, then a compressed egress
export function goldOff(t) {
  if (t <= C3) return eclipse.K - 1;
  const s = t - C3;
  return eclipse.K - 1 + 2.05 * (1 - Math.exp(-s / 4.2));
}

export const GOLD_PAINT = {
  palette: 'gold',
  gammaIn: .9, liftIn: 1.12, contrastIn: 1.2, satIn: 1.04, warmIn: .016, crushFloor: .1, crush: .18, satOut: .6, darkVar: .05,
  envDim: .84, glint: 1, glintT: .66, glintReach: 22, focusLift: .3, poolBlur: 4, poolLo: .1, poolHi: .8,
  rim: .9, rimBreak: .45, fringe: 1, plateKeep: .5, keepDim: .95,
  impasto: .62, thick: .38, thickHi: .62, spec: .24, varnish: .88, vignette: .28, accents: 1.15, accentThick: 1.6, crack: .2,
  faceMin: .3, eyeStrokes: 1, eclipse: 0, underAlpha: .95, underTone: .96, maxLen: [4, 5, 5, 4, 3],
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
  return { vortex: .3, twist: 1.05, arms: 3, cover: .52, glow: 1.3, glowR: .6, drama: .08, fire: 1, zenith: .5, gapHi: .92, horizon: .9,
    bodyL: .66, rimL: .98, haze: .3, night: 0, ring: 0, rotSpeed: .01, ...o };
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

// ---------------------------------------------------------------- the GOLD painter (identity mode)
// The plate graded by goldReference (the same grade the SPARK warms the marble into, so S57 -> S58 is continuous),
// a designed glory sky in the plate's sky region, a painted bloom around everything bright (the glow is in the
// reference, so the strokes carry it), the small brushes on the figures and faces, then the engine paints it as is.
export const GOLD_ID = { ...STONE_PAINT, palette: 'gold', impasto: .32, thick: .26, thickHi: .4, spec: .15, varnish: .8, vignette: .22,
  brushes: [24, 13, 7.5, 4.2, 2.3], T: [0, .045, .05, .06, .07], minLen: [2, 2, 2, 2, 1], maxLen: [5, 7, 7, 6, 4], midGate: .15, fineGate: .2,
  crack: .14, boil: .09, boilColor: .1, colorJit: .03, weave: .85, faceMin: .3, faceK: 1, eyeStrokes: 1, accents: 1.1, accentThick: 1.5 };

// the sky region of a plate. With `horizon` (screen v, or a function of u): everything above that line that is not the
// subject (and, with maxDepth, far); otherwise far depth above `below`, never the subject (the engine's skyMask,
// monotone down each column); null without depth
export function plateSky(src, o = {}) {
  if (o.mask) return o.mask;
  const { aw, ah } = src, N = aw * ah, M = src.matte, D = src.depth;
  if (o.horizon != null) {
    const out = new Float32Array(N), hz = typeof o.horizon === 'function' ? o.horizon : () => o.horizon, dg = o.maxDepth != null && D ? o.maxDepth : null, soft = o.soft ?? .04;
    for (let x = 0; x < aw; x++) {
      const hy = hz(x / aw) * ah;
      for (let y = 0; y < ah; y++) {
        const i = y * aw + x; let sv = 1 - sstep(hy - 1.5, hy + 1.5, y);
        if (sv <= 0) continue;
        if (M && !o.ignoreMatte) sv *= 1 - sstep(.15, .5, M[i]);
        if (dg != null) sv *= 1 - sstep(dg, dg + soft, D[i]);
        out[i] = sv;
      }
    }
    return blurFast(out, aw, ah, o.blur ?? 1.2);
  }
  if (!D) return null;
  return skyMask({ aw, ah, N, D, M, detail: new Float32Array(N) }, { maxDepth: o.maxDepth ?? .06, soft: o.soft ?? .04,
    below: o.below ?? .6, ignoreMatte: !!o.ignoreMatte, blur: o.blur ?? 1.2 });
}

// the visible source rect of a camera (camXform's convention: the source covers the frame)
export function camRectOf(W, H, c, so = 16 / 9) { const oo = W / H; let hU = 1 / c.zoom, wU = oo / so / c.zoom; if (wU > 1 / c.zoom) { wU = 1 / c.zoom; hU = so / oo / c.zoom; } return { wU, hU }; }
// o: cam (the plate camera: the glory is laid out in plate uv), ref (goldReference options), sky (plateSky options, or { mask }), glory (glory options; sun defaults to o.sun),
// sun ({x, y, r, off, blaze} frame uv / fraction of W: the exact disk, its bite painted in the sky's colour), detail
// (small brushes on the figures, 0..1), bloom ({k, thr, sigma}), post(ref, st) (edit the reference), paint (overrides),
// strokes, overStrokes, groundFlow
export async function paintGold(f, src, o = {}) {
  const { aw, ah } = src, N = aw * ah, W = f.W, H = f.H;
  const sky = o.sky === false ? null : plateSky(src, o.sky || {});
  const sunUV = o.sun ? [o.sun.x, o.sun.y] : null;
  // the glory lives in the plate's own uv when the scene passes its camera (the clouds stay put as the camera moves)
  const cam = o.cam || null, cr = cam ? camRectOf(W, H, cam) : null;
  const toP = cam ? (u, v) => [cam.cx + (u - .5) * cr.wU, cam.cy + (v - .5) * cr.hU] : null;
  const sunP = sunUV && toP ? toP(sunUV[0], sunUV[1]) : sunUV;
  const gl0 = sky ? glory({ sun: sunP || [.5, .2], aspect: cam ? 16 / 9 : W / H, t: f.t, ...(o.glory || {}) }) : null;
  const gl = gl0 && toP ? (u, v, out) => { const p = toP(u, v); return gl0(p[0], p[1], out); } : gl0;
  const ref = goldReference(src, { target: .74, sat: 1.06, warm: .018, gamma: .95, local: .55, ...(o.ref || {}), sky, skyCol: gl });
  // bloom: everything bright breathes a warm halo into its surroundings (painted: it is in the reference)
  const bl = { k: .35, thr: .62, sigma: 9, ...(o.bloom || {}) };
  if (bl.k > 0) {
    const Hh = new Float32Array(N); for (let i = 0; i < N; i++) Hh[i] = Math.max(0, .2126 * ref.R[i] + .7152 * ref.G[i] + .0722 * ref.B[i] - bl.thr);
    const Hb = blurFast(Hh, aw, ah, bl.sigma * aw / 480);
    for (let i = 0; i < N; i++) { const k = Hb[i] * bl.k; ref.R[i] = Math.min(1, ref.R[i] + k); ref.G[i] = Math.min(1, ref.G[i] + k * .84); ref.B[i] = Math.min(1, ref.B[i] + k * .56); }
  }
  const st = { ...src, R: ref.R, G: ref.G, B: ref.B, sky, wall: null, key: `${src.key}|gold|${f.t.toFixed(4)}|${o.tag || ''}` };
  if (sky) { const wall = new Uint8Array(N); for (let i = 0; i < N; i++) wall[i] = sky[i] > .5 ? 1 : 0; st.wall = wall; }
  else if (o.sun && src.matte) { const m = new Float32Array(N); for (let i = 0; i < N; i++) m[i] = 1 - src.matte[i]; st.sky = m; }   // (the sun stays behind the figures)
  if (o.post) o.post(st);
  // the small brushes work the figures
  let detailField = null;
  if (src.matte && (o.detail ?? .6) > 0) { const k = o.detail ?? .6; detailField = new Float32Array(N); for (let i = 0; i < N; i++) detailField[i] = src.matte[i] * k; }
  let sunSpec = null;
  if (o.sun) {
    // the moon's bite is the colour of the sky right beside the disk (the reference sampled on a ring at 1.4 r)
    const s = o.sun, dark = [0, 0, 0]; let nd = 0;
    for (let q = 0; q < 24; q++) {
      const a = q / 24 * Math.PI * 2, x = Math.round((s.x * W + Math.cos(a) * s.r * W * 1.4) / W * aw), y = Math.round((s.y * H + Math.sin(a) * s.r * W * 1.4) / H * ah);
      if (x < 0 || y < 0 || x >= aw || y >= ah) continue; const i = y * aw + x; if (src.matte && src.matte[i] > .3) continue;
      dark[0] += st.R[i]; dark[1] += st.G[i]; dark[2] += st.B[i]; nd++;
    }
    if (nd) { dark[0] = Math.min(1, dark[0] / nd * 1.03); dark[1] = Math.min(1, dark[1] / nd * 1.03); dark[2] = Math.min(1, dark[2] / nd * 1.03); } else dark.splice(0, 3, .95, .8, .55);
    sunSpec = { x: s.x, y: s.y, r: s.r, alt: s.alt ?? 6, off: s.off ?? goldOff(f.t), dir: EGRESS_DIR, moonVis: 0, beads: false, blaze: s.blaze ?? 1.3,
      dark, vis: s.vis ?? 1 };
  }
  const dbg = new URLSearchParams(location.search).get('gdebug'), mv = new URLSearchParams(location.search).get('mvar');
  if (dbg === 'sky' || dbg === 'depth') {                  // the sky mask (white) over the matte (red), or the depth
    const id = new ImageData(aw, ah), d = id.data;
    for (let i = 0; i < N; i++) { const sv = sky ? sky[i] : 0, m = src.matte ? src.matte[i] : 0, dd = src.depth ? src.depth[i] : 0;
      if (dbg === 'sky') { d[i * 4] = Math.max(sv, m) * 255; d[i * 4 + 1] = sv * 255; d[i * 4 + 2] = sv * 255; } else { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.min(1, dd * 4) * 255; } d[i * 4 + 3] = 255; }
    const c = new OffscreenCanvas(aw, ah); c.getContext('2d').putImageData(id, 0, 0);
    f.g.save(); f.g.setTransform(1, 0, 0, 1, 0, 0); f.g.drawImage(c, 0, 0, W, H); f.g.restore(); return {};
  }
  return paint(f, st, { ...GOLD_ID, detailField, sun: sunSpec, groundFlow: o.groundFlow || null,
    strokes: o.strokes || null, overStrokes: o.overStrokes || null, ...(o.paint || {}), ...(mv && MVARS[mv] ? MVARS[mv] : {}), ...(dbg === 'canvas' ? { debugCanvas: 1 } : dbg ? { debug: dbg } : {}) });
}
