// chop.js: CHOP, the drop words. Archivo at weight 900 and width 125 (expanded black), one word filling the safe width,
// letters filled with dense field lines in pearl on navy-black, crisp edges, a signal-orange rim.
//
// The fill is a field, not a texture: isolines of a stream function psi = |p - centre| / spacing, warped by slow noise,
// in SCREEN coordinates around the corona's centre (f.type.field.center, else the sun, else the frame centre). So the
// lines are concentric halos around the eclipse, continuous from letter to letter and from word to word across cuts,
// and they drift outward (phase) with a push on every kick. Line width is constant in pixels (fwidth), so they stay
// crisp at any size; the slam scales the letterforms in the shader, not the lines.
//
//   chopWord(g, f, { word, cx, cy, px, scale, invert, opacity, center, kick, t, palette, rim })

import { tgl, rgb01 } from './tgl.js';
import { FACE, applyFont, textWidth, C } from './style.js';
import { LRU, makeCanvas } from '../assets.js';
import { clamp } from '../core.js';

const FRAG = `
uniform sampler2D uP;
uniform vec2 uSize, uOrigin, uCenter, uPivot;
uniform float uSpacing, uLineW, uPhase, uTime, uInvert, uScale, uWarp, uHalo, uOpacity, uRimOn;
uniform vec3 uPearl, uNavy, uOrange;
void main() {
  vec2 px = tc() * uSize;
  vec2 q = uPivot + (px - uPivot) / uScale;
  vec4 P = texture(uP, q / uSize);
  float aa = max(fwidth(P.r), 2e-3) * .7;
  float fill = smoothstep(.5 - aa, .5 + aa, P.r);
  float rim = fill * smoothstep(.4, .6, P.g) * uRimOn;
  vec2 d = (uOrigin + px - uCenter) / uSpacing;
  float n = fbm(d * .035 + vec2(uTime * .09, -uTime * .06)) - .5;
  float psi = length(d) + uWarp * n * 9. - uPhase;
  float fw = max(fwidth(psi), 1e-4);
  float fr = fract(psi);
  float dist = min(fr, 1. - fr) / fw;
  float line = 1. - smoothstep(uLineW * .5 - .55, uLineW * .5 + .55, dist);
  vec3 bg = mix(uNavy, uPearl, uInvert), fg = mix(uPearl, uNavy, uInvert);
  vec3 col = mix(bg, fg, line * .94);
  col = mix(col, uOrange, rim);
  float a = fill * uOpacity;
  float ha = (1. - fill) * P.b * uHalo * uOpacity;
  o = vec4(col * a + bg * ha * (1. - a), a + ha * (1. - a));
}`;

const _packs = new LRU(24);
let _mask = null, _tint = null;
const canvasOf = (c, w, h) => { if (!c) c = makeCanvas(w, h); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; };

// fit one chop word (or a stack of words) to the safe width: returns {lines, px}
export function chopFit(L, text, { maxH = .62, minCap = .2 } = {}) {
  const face = FACE.chop, words = text.split(' '), sw = L.safe.w * (L.portrait ? .98 : .94);
  const one = px => textWidth(face, px, text);
  let px = sw / one(100) * 100;                       // one line across the safe width
  const capOne = face.cap * px / L.H;
  if (words.length > 1 && capOne < minCap) {            // too small on one line: stack the words
    const pxs = Math.min(...words.map(w => sw / textWidth(face, 100, w) * 100));
    const lead = .96, n = words.length, cap = face.cap * pxs, h = cap + (n - 1) * pxs * lead;
    const k = Math.min(1, maxH * L.H / h);
    return { lines: words.map(w => [w]), px: pxs * k, lead };
  }
  const cap = face.cap * px;
  if (cap > maxH * L.H) px *= maxH * L.H / cap;
  return { lines: [words], px, lead: .96 };
}

function buildPack(lines, px, lead, bw, bh, cx, cy, rimW) {
  const face = FACE.chop;
  _mask = canvasOf(_mask, bw, bh); _tint = canvasOf(_tint, bw, bh);
  const m = _mask.getContext('2d');
  const n = lines.length, lh = px * lead, cap = face.cap * px, y0 = cy - (cap + (n - 1) * lh) / 2 + cap;
  const draw = (c, fn) => lines.forEach((ws, i) => { const s = ws.join(' '); applyFont(c, face, px); fn(s, cx - textWidth(face, px, s) / 2, y0 + i * lh); });
  const pack = makeCanvas(bw, bh), p = pack.getContext('2d'), t = _tint.getContext('2d');
  p.fillStyle = '#000'; p.fillRect(0, 0, bw, bh); p.globalCompositeOperation = 'lighter';
  const layer = (col, blur, paint) => {
    m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, bw, bh); m.fillStyle = m.strokeStyle = '#fff'; m.lineJoin = 'miter';
    paint();
    t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, bw, bh); t.drawImage(_mask, 0, 0);
    t.globalCompositeOperation = 'source-in'; t.fillStyle = col; t.fillRect(0, 0, bw, bh);
    p.filter = blur > .05 ? `blur(${blur.toFixed(2)}px)` : 'none'; p.drawImage(_tint, 0, 0); p.filter = 'none';
  };
  layer('#f00', .6, () => draw(m, (s, x, y) => m.fillText(s, x, y)));
  layer('#0f0', 0, () => draw(m, (s, x, y) => { m.lineWidth = 2 * rimW; m.strokeText(s, x, y); }));
  layer('#00f', Math.max(2, .045 * px), () => draw(m, (s, x, y) => m.fillText(s, x, y)));
  return { pack, y0, lh };
}

export function chopWord(g, f, o) {
  const { L } = f, face = FACE.chop;
  const fit = o.fit || chopFit(L, o.word);
  const { lines, px, lead } = fit;
  const scale = o.scale ?? 1, n = lines.length, lh = px * lead, cap = face.cap * px;
  const wMax = Math.max(...lines.map(ws => textWidth(face, px, ws.join(' '))));
  const hBlock = cap + (n - 1) * lh;
  const pad = Math.ceil(Math.max(.06 * px, 6));
  // block (unscaled extent + slam headroom), clamped to the frame
  const sx = Math.max(scale, 1), halfW = wMax / 2 * sx + pad, halfH = hBlock / 2 * sx + pad + .1 * px;
  const cx = o.cx ?? L.cx, cy = o.cy ?? L.cy;
  let ox = Math.floor(cx - halfW), oy = Math.floor(cy - halfH), ex = Math.ceil(cx + halfW), ey = Math.ceil(cy + halfH);
  ox = Math.max(ox, 0); oy = Math.max(oy, 0); ex = Math.min(ex, L.W); ey = Math.min(ey, L.H);
  const bw = ex - ox, bh = ey - oy;
  if (bw < 4 || bh < 4) return null;
  // the pack holds the UNSCALED word centred at (cx, cy) in block coordinates
  const rimW = Math.max(1.6, .013 * px) * (o.rimScale ?? 1);
  const key = JSON.stringify([lines, +px.toFixed(2), bw, bh, +(cx - ox).toFixed(2), +(cy - oy).toFixed(2), +rimW.toFixed(2)]);
  let P = _packs.get(key);
  if (!P) P = _packs.set(key, buildPack(lines, px, lead, bw, bh, cx - ox, cy - oy, rimW));
  const G = tgl(), prog = G.program(FRAG);
  G.size(bw, bh); G.texture(0, P.pack);
  const pal = o.palette || {};
  const center = o.center || [L.cx, L.cy];
  const u = L.u, kick = o.kick || 0;
  G.draw(prog, {
    uP: { tex: 0 }, uSize: [bw, bh], uOrigin: [ox, oy], uCenter: center, uPivot: [cx - ox, cy - oy],
    uSpacing: (o.spacing ?? 6.2) * u * (1 + .18 * kick), uLineW: Math.max(1, (1.35 + .9 * kick) * u), uPhase: o.phase ?? 0, uTime: o.t ?? 0,
    uInvert: o.invert ? 1 : 0, uScale: scale, uWarp: o.warp ?? 1, uHalo: o.halo ?? .78, uOpacity: o.opacity ?? 1, uRimOn: o.rim === false ? 0 : 1,
    uPearl: rgb01(pal.pearl || C.pearl), uNavy: rgb01(pal.navy || C.navyBlack), uOrange: rgb01(pal.orange || C.orange),
  });
  g.drawImage(G.canvas, ox, oy);
  return { ox, oy, bw, bh, px, lines, lead, cx, cy, y0: cy - hBlock / 2 + cap, lh, wMax, hBlock };
}

// an echo: the word's outline only (orange, crisp), at another scale/offset, fading
export function chopEcho(g, L, fit, cx, cy, scale, alpha, color = C.orange, width = 1.6) {
  if (alpha <= .01) return;
  const face = FACE.chop, { lines, px, lead } = fit, n = lines.length, lh = px * lead, cap = face.cap * px, y0 = -(cap + (n - 1) * lh) / 2 + cap;
  g.save();
  g.translate(cx, cy); g.scale(scale, scale);
  applyFont(g, face, px);
  g.globalAlpha = clamp(alpha); g.strokeStyle = color; g.lineWidth = width * L.u / scale; g.lineJoin = 'miter';
  lines.forEach((ws, i) => { const s = ws.join(' '); g.strokeText(s, -textWidth(face, px, s) / 2, y0 + i * lh); });
  g.restore();
}

// HAL: the O of the first HALO eclipsed for a few frames. A disk the O's width (it overhangs cap height: an eclipse disk
// is round, the expanded O is not) in navy-black, with the faintest pearl limb.
export function halDisk(g, L, res, word, k) {
  if (!res) return;
  const face = FACE.chop, s = res.lines[0].join(' '), i = s.indexOf('O');
  if (i < 0) return;
  applyFont(g, face, res.px);
  const x0 = res.cx - textWidth(face, res.px, s) / 2;
  const pre = i ? g.measureText(s.slice(0, i)).width : 0, ow = textWidth(face, res.px, 'O');
  const ox = x0 + pre + ow / 2, oy = res.y0 - face.cap * res.px / 2;
  const r = ow * .56;
  g.save();
  g.fillStyle = C.navyBlack;
  g.beginPath(); g.arc(ox + (k - .5) * .05 * ow, oy, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(243,239,230,.55)'; g.lineWidth = Math.max(1, 1.2 * L.u);
  g.beginPath(); g.arc(ox + (k - .5) * .05 * ow, oy, r + .6 * L.u, 0, Math.PI * 2); g.stroke();
  g.restore();
}
