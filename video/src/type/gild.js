// gild.js: CARVED lettering as gold leaf lit by the scene's light (WebGL2), raised over the painting or incised.
//
//   gild(g, runs, opts) draws positioned glyph runs into the 2D context g and returns the block rect.
//   run  = { text, x, y (baseline, px in g), face, px, m: [a, b, c, d] (optional linear transform about x, y),
//            reveal 0..1 | sweep: {p, band, angle} (the gild-in glint frontier), glint 0..1, boost 0..1, sil 0..1 }
//   opts = { light: {dir, elev, color, intensity, cool}, incised, boil (0..1, per-drawing edge irregularity), seed (per
//            drawing), leaf (per-event seed: the gold-leaf squares never change), exposure, opacity, shadow (0..1),
//            palette: 5 colours, fx2(ctx) (draws silhouette amount into the red channel, in g's coordinates), em }
//
// How it is lit: the glyph mask is blurred at three radii (one 2D canvas, channels R G B): an edge field (the
// letterform, thresholded with seeded noise so edges boil on 12 fps drawings), a bevel field (its gradient gives the
// surface normal: raised letters bulge, incised letters are V-cut grooves) and a soft field for the cast shadow.
// The normal is shaded against the light (dir toward the light, elevation): a gold ramp from umber (facing away) to
// pale highlight (facing it) plus a burnished specular, broken into staggered leaf squares with faint seams.

import { tgl, rgb01 } from './tgl.js';
import { applyFont, textWidth, C } from './style.js';
import { LRU, makeCanvas } from '../assets.js';
import { clamp } from '../core.js';

const FRAG = `
uniform sampler2D uP, uF1, uF2;
uniform vec2 uSize, uShadowOff, uGroove;
uniform vec3 uL, uLight, uAmb, uShadowCol, uC0, uC1, uC2, uC3, uC4, uSil, uRim;
uniform float uIncised, uBoil, uSeed, uLeaf, uEm, uBevelK, uExposure, uOpacity, uShadowOp, uGrooveSh;
vec3 ramp(float r) {
  if (r < .3) return mix(uC0, uC1, r / .3);
  if (r < .58) return mix(uC1, uC2, (r - .3) / .28);
  if (r < .84) return mix(uC2, uC3, (r - .58) / .26);
  return mix(uC3, uC4, (r - .84) / .16);
}
void main() {
  vec2 px = tc() * uSize;
  // boil: a sub-pixel warp at letter scale plus fine edge roughness, both seeded per drawing
  vec2 w = vec2(vn(px / (uEm * .55) + uSeed * 7.13), vn(px / (uEm * .55) + uSeed * 3.71 + 17.3)) - .5;
  vec2 q = px + w * 1.1 * uBoil;
  vec2 e = 1. / uSize, qt = q * e;
  vec4 P = texture(uP, qt);
  float edge = P.r + (vn(q / 2.6 + uSeed * 11.7) - .5) * .28 * uBoil;
  float aa = max(fwidth(edge), 2e-3) * .75;
  float a = smoothstep(.5 - aa, .5 + aa, edge);
  float hx = texture(uP, qt + vec2(e.x, 0.)).g - texture(uP, qt - vec2(e.x, 0.)).g;
  float hy = texture(uP, qt + vec2(0., e.y)).g - texture(uP, qt - vec2(0., e.y)).g;
  vec2 grad = vec2(hx, hy) * .5;
  float sg = uIncised > .5 ? 1. : -1.;
  vec3 N = normalize(vec3(sg * grad * uBevelK, 1.));
  float ndl = dot(N, uL);
  float spec = pow(max(dot(N, normalize(uL + vec3(0., 0., 1.))), 0.), 36.);
  float r = clamp((ndl + .18) / 1.18, 0., 1.);
  vec3 base = ramp(r);
  vec2 lc = px / (uEm * .4) + uLeaf;
  lc.x += h21(vec2(floor(lc.y), 3.1));
  vec2 fl = fract(lc);
  float seam = smoothstep(0., .04, min(min(fl.x, 1. - fl.x), min(fl.y, 1. - fl.y)));
  base *= (.93 + .12 * h21(floor(lc) + 7.7)) * mix(.86, 1., seam) * (.95 + .09 * vn(px / 1.6 + uLeaf * 3.));
  vec3 col = base * uLight + uC4 * spec * uLight * 1.15 + uAmb * (1. - r) * .35;
  if (uIncised > .5) {                       // the wall nearest the light shades the groove floor beside it
    float outside = 1. - smoothstep(.35, .65, texture(uP, qt + uGroove * e).r);
    col *= 1. - uGrooveSh * outside;
  }
  vec4 F1 = texture(uF1, qt), F2 = texture(uF2, qt);
  col += uC4 * F1.g * (.5 + 1.3 * spec + .9 * clamp(length(grad) * uBevelK, 0., 1.)) * uLight;
  float gx = texture(uP, qt + vec2(e.x, 0.)).r - texture(uP, qt - vec2(e.x, 0.)).r;
  float gy = texture(uP, qt + vec2(0., e.y)).r - texture(uP, qt - vec2(0., e.y)).r;
  vec2 outward = -vec2(gx, gy); float gl = length(outward);
  float facing = gl > 1e-4 ? clamp(dot(outward / gl, normalize(uL.xy + 1e-5)), 0., 1.) : 0.;
  float band = smoothstep(.98, .6, P.g) * smoothstep(.0, .25, P.r);
  col = mix(col, uSil + uRim * band * facing, F2.r);
  col *= uExposure * (1. + F1.b * 1.6);
  a *= F1.r * uOpacity;
  vec2 sq = (q - uShadowOff) * e;
  float sa = texture(uP, sq).b * texture(uF1, sq).r * uShadowOp * uOpacity * (1. - uIncised) * (1. - .7 * F2.r);
  o = vec4(clamp(col, 0., 1.) * a + uShadowCol * sa * (1. - a), a + sa * (1. - a));
}`;

const _packs = new LRU(48);
let _mask = null, _tint = null, _fx1 = null, _fx2 = null;
const canvasOf = (c, w, h) => { if (!c) c = makeCanvas(w, h); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; };

function eachRun(c, runs, ox, oy, fn) {
  for (const r of runs) {
    c.save();
    c.translate(r.x - ox, r.y - oy);
    if (r.m) c.transform(r.m[0], r.m[1], r.m[2], r.m[3], 0, 0);
    applyFont(c, r.face, r.px);
    fn(r);
    c.restore();
  }
}

export function runBounds(r) {
  const w = textWidth(r.face, r.px, r.text), a = (r.face.asc + .06) * r.px, d = (r.face.desc + .06) * r.px;
  const pts = [[-.06 * r.px, -a], [w + .06 * r.px, -a], [w + .06 * r.px, d], [-.06 * r.px, d]];
  const m = r.m || [1, 0, 0, 1];
  const xs = pts.map(([x, y]) => r.x + m[0] * x + m[2] * y), ys = pts.map(([x, y]) => r.y + m[1] * x + m[3] * y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), w };
}

function buildPack(runs, ox, oy, bw, bh, sig) {
  _mask = canvasOf(_mask, bw, bh); _tint = canvasOf(_tint, bw, bh);
  const m = _mask.getContext('2d');
  m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, bw, bh); m.fillStyle = '#fff';
  eachRun(m, runs, ox, oy, r => m.fillText(r.text, 0, 0));
  const pack = makeCanvas(bw, bh), p = pack.getContext('2d'), t = _tint.getContext('2d');
  p.fillStyle = '#000'; p.fillRect(0, 0, bw, bh); p.globalCompositeOperation = 'lighter';
  for (const [col, s] of [['#f00', sig.e], ['#0f0', sig.b], ['#00f', sig.s]]) {
    t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, bw, bh); t.drawImage(_mask, 0, 0);
    t.globalCompositeOperation = 'source-in'; t.fillStyle = col; t.fillRect(0, 0, bw, bh);
    p.filter = s > .05 ? `blur(${s.toFixed(2)}px)` : 'none'; p.drawImage(_tint, 0, 0); p.filter = 'none';
  }
  return pack;
}

const byte = v => Math.round(clamp(v) * 255);
function runFill(c, r, w, em) {
  const R = r.reveal ?? 1, G = r.glint ?? 0, B = r.boost ?? 0;
  if (r.shine) {                                     // a glint band crossing a word that is already gilded
    const { k, band = 1.2 * r.px, peak = .8, angle = -.32 } = r.shine;
    const xf = -band + clamp(k) * (w + 2 * band), yc = -.35 * r.px, vx = Math.cos(angle) * band, vy = Math.sin(angle) * band;
    const gr = c.createLinearGradient(xf - vx, yc - vy, xf + vx, yc + vy);
    gr.addColorStop(0, `rgb(${byte(R)},0,${byte(B)})`); gr.addColorStop(.5, `rgb(${byte(R)},${byte(peak)},${byte(B)})`); gr.addColorStop(1, `rgb(${byte(R)},0,${byte(B)})`);
    return gr;
  }
  if (!r.sweep) return `rgb(${byte(R)},${byte(G)},${byte(B)})`;
  const { p, band = .9 * r.px, angle = -.32, peak = 1 } = r.sweep;
  if (p >= 1 && !G) return `rgb(${byte(R)},0,${byte(B)})`;
  const xf = -band + clamp(p) * (w + 2 * band), yc = -.35 * r.px, vx = Math.cos(angle) * band, vy = Math.sin(angle) * band;
  const gr = c.createLinearGradient(xf - vx, yc - vy, xf, yc);
  gr.addColorStop(0, `rgb(${byte(R)},${byte(G)},${byte(B)})`);
  gr.addColorStop(.58, `rgb(${byte(R)},${byte(Math.max(G, peak))},${byte(B)})`);
  gr.addColorStop(1, `rgb(0,0,${byte(B)})`);
  return gr;
}

export function resolveLight(light, cool) {
  const e = Math.asin(clamp(light.elev ?? .45, .05, .99)), ce = Math.cos(e), d = Math.hypot(light.dir[0], light.dir[1]) || 1;
  const col = rgb01(light.color || '#ffe2b0').map(v => v * (light.intensity ?? 1));
  return { L: [light.dir[0] / d * ce, light.dir[1] / d * ce, Math.sin(e)], dir: [light.dir[0] / d, light.dir[1] / d], e, col, cool: light.cool ?? cool ?? 0 };
}

export function gild(g, runs, o = {}) {
  if (!runs.length) return null;
  const em = o.em || Math.max(...runs.map(r => r.px));
  const sig = { e: o.sigE ?? .75, b: o.sigB ?? clamp(.034 * em, 1.1, 7), s: o.sigS ?? clamp(.055 * em, 1.5, 14) };
  const Lr = resolveLight(o.light || { dir: [-.75, -.66], elev: .42 });
  const shLen = o.incised ? 0 : (o.shadowLen ?? clamp(.045 * em / Math.tan(Lr.e), 1, .4 * em));
  const shOff = [-Lr.dir[0] * shLen, -Lr.dir[1] * shLen];
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const ws = runs.map(r => { const b = runBounds(r); x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); return b.w; });
  const pad = Math.ceil(3 * sig.s + shLen + 4 + (o.pad || 0));
  const CW = g.canvas.width, CH = g.canvas.height;
  let ox = Math.floor(x0 - pad), oy = Math.floor(y0 - pad), ex = Math.ceil(x1 + pad), ey = Math.ceil(y1 + pad);
  ox = Math.max(ox, -2); oy = Math.max(oy, -2); ex = Math.min(ex, CW + 2); ey = Math.min(ey, CH + 2);
  const bw = ex - ox, bh = ey - oy;
  if (bw < 2 || bh < 2) return null;
  const key = JSON.stringify([bw, bh, sig, runs.map(r => [r.text, +(r.x - ox).toFixed(2), +(r.y - oy).toFixed(2), r.face.family, r.face.weight, r.face.style, +r.px.toFixed(2), r.m || 0])]);
  let pack = _packs.get(key);
  if (!pack) pack = _packs.set(key, buildPack(runs, ox, oy, bw, bh, sig));
  // FX1: per run reveal / glint / boost, painted as the glyphs themselves (stroked wide so blur halos are covered)
  _fx1 = canvasOf(_fx1, bw, bh);
  const f1 = _fx1.getContext('2d');
  f1.setTransform(1, 0, 0, 1, 0, 0); f1.globalCompositeOperation = 'source-over'; f1.fillStyle = '#000'; f1.fillRect(0, 0, bw, bh);
  let k = 0;
  eachRun(f1, runs, ox, oy, r => {
    const fill = runFill(f1, r, ws[k++], em);
    f1.fillStyle = fill; f1.strokeStyle = fill; f1.lineWidth = 2 * sig.b + 3; f1.lineJoin = 'round';
    f1.fillText(r.text, 0, 0); f1.strokeText(r.text, 0, 0);
  });
  // FX2: silhouette amount (per run, then the caller's per-pixel effects in g's coordinates)
  _fx2 = canvasOf(_fx2, bw, bh);
  const f2 = _fx2.getContext('2d');
  f2.setTransform(1, 0, 0, 1, 0, 0); f2.globalCompositeOperation = 'source-over'; f2.filter = 'none'; f2.fillStyle = '#000'; f2.fillRect(0, 0, bw, bh);
  eachRun(f2, runs, ox, oy, r => {
    if (!r.sil) return;
    f2.fillStyle = f2.strokeStyle = `rgb(${byte(r.sil)},0,0)`; f2.lineWidth = 2 * sig.b + 3; f2.lineJoin = 'round';
    f2.fillText(r.text, 0, 0); f2.strokeText(r.text, 0, 0);
  });
  if (o.fx2) { f2.save(); f2.translate(-ox, -oy); f2.globalCompositeOperation = 'lighten'; o.fx2(f2); f2.restore(); }
  const pal = (o.palette || (Lr.cool > .5 ? C.goldCool : C.gold)).map(rgb01);
  const G = tgl(), P = G.program(FRAG);
  G.size(bw, bh);
  G.texture(0, pack); G.texture(1, _fx1); G.texture(2, _fx2);
  const lc = Lr.col, gr = Math.atan2(Lr.dir[1], Lr.dir[0]);
  G.draw(P, {
    uP: { tex: 0 }, uF1: { tex: 1 }, uF2: { tex: 2 }, uSize: [bw, bh], uL: Lr.L, uLight: lc,
    uAmb: rgb01(o.ambient || '#3a2414'), uShadowCol: rgb01(o.shadowColor || '#0d0704'),
    uC0: pal[0], uC1: pal[1], uC2: pal[2], uC3: pal[3], uC4: pal[4], uSil: rgb01(o.silColor || C.sil), uRim: rgb01(o.rimColor || '#d9a050'),
    uIncised: o.incised ? 1 : 0, uBoil: o.boil || 0, uSeed: ((o.seed || 0) % 9973) / 97.31, uLeaf: ((o.leaf || 0) % 997) / 13.7,
    uEm: em, uBevelK: 3.2 * sig.b * (o.bevel ?? 1), uExposure: o.exposure ?? 1, uOpacity: o.opacity ?? 1,
    uShadowOp: (o.shadow ?? 1) * .6, uShadowOff: shOff,
    uGroove: [Math.cos(gr) * .07 * em, Math.sin(gr) * .07 * em], uGrooveSh: o.incised ? .55 : 0,
  });
  g.drawImage(G.canvas, ox, oy);
  return { ox, oy, bw, bh };
}
