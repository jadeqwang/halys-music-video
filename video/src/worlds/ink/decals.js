// decals.js: the 1420 MHz patch on her LEFT sleeve, redrawn on her own footage in S78 (v3).
//
// S78 shows the plate itself (direct.js): the light-blue circle, RARE EARTH and the jacket's folds are the plate's own, and
// they bend and turn with the fabric because they are the footage. Only the patch's lettering is garbled: Seedance turns
// 1420 MHz into glyphs that change on every frame. So the patch is redrawn on it, WHERE the plate has it: the dark ring's
// ellipse measured on every frame (prep/decals.py -> decals/<plate>_<take>.json, which also keeps the circle, the lettering
// band and the fold field of the earlier cel version), its axes giving the turn of the arm. Drawn in the footage's own
// colours, sampled on that frame (the disc's light and shade as a gradient across it, the ring's ink), clipped to her.

import { loadJSON, makeCanvas } from '../../assets.js';
import { setFont } from '../../fonts.js';
import { LINE } from './palette.js';
import { takeStem } from './source.js';

const TAU = Math.PI * 2;
const DEC = {};
export async function initDecals(takes) {
  for (const [id, take] of Object.entries(takes)) DEC[id] = (await loadJSON(`src/worlds/ink/decals/${id}_${takeStem(take)}.json`, { optional: true })) || {};
}

const mapE = (q, xf) => q && { cx: xf.s * q.cx + xf.tx, cy: xf.s * q.cy + xf.ty, rx: q.rx * xf.s, ry: q.ry * xf.s, rot: q.rot };
// the patch of drawing e in SETUP px ({ cx, cy, rx, ry, rot }), null when not measured
export function patchGeom(S, e) {
  const D = e && DEC[e.src], q = D && D[String(e.pf)] && D[String(e.pf)].patch;
  return q ? mapE(q, (S.reg && S.reg[e.src]) || { s: 1, tx: 0, ty: 0 }) : null;
}

function patchDesign(g, col, ink = LINE) {   // the design at radius 100, in the patch's own frame (x right, y down)
  g.fillStyle = col; g.beginPath(); g.arc(0, 0, 100, 0, TAU); g.fill();
  g.strokeStyle = ink; g.lineWidth = 17; g.beginPath(); g.arc(0, 0, 91, 0, TAU); g.stroke();
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  setFont(g, 'chop', 50, { weight: 800 }); g.fontStretch = 'normal'; g.letterSpacing = '0px'; g.fillText('1420', 0, 2);
  setFont(g, 'chop', 40, { weight: 800 }); g.fontStretch = 'normal'; g.letterSpacing = '0px'; g.fillText('MHz', 0, 44);
}
// the ellipse's axes as (right, up) so the patch reads upright, tilted with the arm
function patchFrame(P) {
  const a1 = [Math.cos(P.rot), Math.sin(P.rot)], a2 = [-Math.sin(P.rot), Math.cos(P.rot)];
  let [up, ru, right, rr] = Math.abs(a1[1]) > Math.abs(a2[1]) ? [a1, P.rx, a2, P.ry] : [a2, P.ry, a1, P.rx];
  if (up[1] > 0) up = [-up[0], -up[1]];
  if (right[0] < 0) right = [-right[0], -right[1]];
  return { right, rr, down: [-up[0], -up[1]], ru };
}

// g: her layer (output px), right after the footage; e = { src, pf } the drawing; D: the drawing (direct.js); P: its
// placement; sample(D, x, y, w, h) -> RGBA bytes of the footage (source px). o.cover: the design's radius over the
// measured ring (a little over 1, so the plate's own ring and glyphs are covered).
export function drawPatchOn(g, view, S, e, D, P, sample, o = {}) {
  const G = patchGeom(S, e), raw = DEC[e.src] && DEC[e.src][String(e.pf)] && DEC[e.src][String(e.pf)].patch;
  if (!G || !raw) return;
  const k = D.w / 960, R = Math.max(raw.rx, raw.ry) * k, cx = raw.cx * k, cy = raw.cy * k;
  const x0 = Math.floor(cx - R - 1), y0 = Math.floor(cy - R - 1), bw = Math.ceil(2 * R + 2), px = sample(D, x0, y0, bw, bw);
  const ca = Math.cos(raw.rot), sa = Math.sin(raw.rot), top = [], bot = [], ring = [];
  for (let j = 0; j < bw; j++) for (let i = 0; i < bw; i++) {
    const n = (j * bw + i) * 4; if (n + 3 >= px.length || px[n + 3] < 250) continue;
    const dx = x0 + i + .5 - cx, dy = y0 + j + .5 - cy, ex = (dx * ca + dy * sa) / (raw.rx * k), ey = (-dx * sa + dy * ca) / (raw.ry * k), rr = Math.hypot(ex, ey);
    const c = [px[n], px[n + 1], px[n + 2]], L = .3 * c[0] + .59 * c[1] + .11 * c[2];
    if (rr < .62) (dy < 0 ? top : bot).push([L, c]); else if (rr > .8 && rr < 1.05) ring.push([L, c]);
  }
  const pick = (a, f) => { if (!a.length) return null; a.sort((m, n) => m[0] - n[0]); return a[Math.min(a.length - 1, Math.floor(a.length * f))][1]; };
  const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const cT = pick(top, .8), cB = pick(bot, .8) || cT, cR = pick(ring, .12);
  if (!cT || !cR) return;
  const F = patchFrame(G), [ox, oy] = P.toOut([G.cx, G.cy]), kk = view.s * (o.cover ?? 1.08) / 100;
  const C = makeCanvas(g.canvas.width, g.canvas.height), cg = C.getContext('2d');
  cg.save();
  cg.transform(F.right[0] * F.rr * kk, F.right[1] * F.rr * kk, F.down[0] * F.ru * kk, F.down[1] * F.ru * kk, ox, oy);
  const gr = cg.createLinearGradient(0, -100, 0, 100); gr.addColorStop(.2, hex(cT)); gr.addColorStop(.8, hex(cB));
  patchDesign(cg, gr, hex(cR));
  cg.restore();
  cg.globalCompositeOperation = 'destination-in'; cg.drawImage(D.im, P.x, P.y, P.w, P.h);
  g.drawImage(C, 0, 0);
}
