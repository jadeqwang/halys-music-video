// diagrams.js: S53-S54, the gold-leaf construction lines that bloom around Thales. The diagrams are ours; the type
// module draws the lyric and the forecast card.
//   * his theorem: a triangle inscribed in a circle on its diameter, the right angle marked (no eye, no equilateral
//     "Providence" triangle: the right triangle stands beside him, never above his head);
//   * the saros dial: a ring of 223 ticks (223 synodic months) with SAROS · 18 Y 11 D 8 H cut along its arc, turning
//     slowly behind his head;
//   * an Antikythera-style gear whose teeth unravel into lines of code.
// Each element reveals along its own length (a line being drawn), then holds; lines pass behind him (his matte cuts
// them). Gold leaf: an umber shadow, an ochre-gold body, a pale highlight and a restrained warm glow.

import { setFont } from '../../fonts.js';
import { clamp, lerp, sstep } from '../brush/util.js';

const TAU = Math.PI * 2;
// a polyline element: {pts: [[x, y], ...], w (px), closed}
function poly(pts, w, closed = false) { const P = closed ? [...pts, pts[0]] : pts; let L = 0; const cum = [0]; for (let i = 1; i < P.length; i++) { L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); cum.push(L); } return { P, cum, L, w }; }
const circlePts = (cx, cy, r, a0 = 0, a1 = TAU, n = 96) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; };
// the prefix of an element up to fraction k of its length, as a canvas path
function tracePrefix(g, e, k) {
  if (k <= 0) return false;
  const Lk = e.L * clamp(k); g.moveTo(e.P[0][0], e.P[0][1]);
  for (let i = 1; i < e.P.length; i++) {
    if (e.cum[i] <= Lk) { g.lineTo(e.P[i][0], e.P[i][1]); continue; }
    const t = (Lk - e.cum[i - 1]) / Math.max(1e-6, e.cum[i] - e.cum[i - 1]);
    g.lineTo(lerp(e.P[i - 1][0], e.P[i][0], t), lerp(e.P[i - 1][1], e.P[i][1], t)); break;
  }
  return true;
}
// gold-leaf stroke of a list of [element, reveal] pairs onto g
export function gildLines(g, items, u, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0) return;
  const pass = (col, wk, dx, dy, comp = 'source-over', alpha = 1, blur = 0) => {
    g.save(); g.globalCompositeOperation = comp; g.globalAlpha = a * alpha; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
    if (blur) { g.shadowColor = col; g.shadowBlur = blur * u; }
    g.translate(dx * u, dy * u);
    for (const [e, k] of items) { g.beginPath(); if (!tracePrefix(g, e, k)) continue; g.lineWidth = Math.max(.6, e.w * wk * u); g.stroke(); }
    g.restore();
  };
  pass('rgba(38,22,8,0.55)', 1.5, 1.1, 1.6);                  // the umbra shadow under the leaf
  pass('#b98a32', 1, 0, 0);                                   // the leaf
  pass('#f4dc96', .42, -.3, -.4);                             // its burnished edge
  pass('rgba(255,196,110,0.5)', 2.6, 0, 0, 'lighter', .35, 6);   // a restrained glow
}
// gold text along an arc (centre cx, cy, radius r, centred on angle a, reading clockwise)
export function arcText(g, text, cx, cy, r, a, px, u, alpha = 1) {
  if (alpha <= 0) return;
  setFont(g, 'carved', px);
  const ws = [...text].map(ch => g.measureText(ch).width), total = ws.reduce((s, w) => s + w, 0) + px * .12 * (text.length - 1);
  let ang = a - total / r / 2;
  for (let i = 0; i < text.length; i++) {
    const w = ws[i], am = ang + w / 2 / r;
    g.save(); g.translate(cx + Math.cos(am) * r, cy + Math.sin(am) * r); g.rotate(am + Math.PI / 2);
    g.globalAlpha = alpha; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(38,22,8,0.6)'; g.fillText(text[i], 1.1 * u, 1.5 * u);
    g.fillStyle = '#c99a3c'; g.fillText(text[i], 0, 0);
    g.globalAlpha = alpha * .55; g.fillStyle = '#fbe6a8'; g.fillText(text[i], -.4 * u, -.5 * u);
    g.restore();
    ang += (w + px * .12) / r;
  }
}

// the full set at time t (song s) for frame W x H; anchors in frame fractions; returns nothing (draws into g)
// o: {head: [x, y] (his head, frame uv), theorem: [x, y], gear: [x, y], t0 (bloom start), dim (0..1)}
export function thalesDiagrams(g, W, H, t, o = {}) {
  const u = H / 1080, s = H, t0 = o.t0 ?? 183.45, dim = 1 - (o.dim ?? 0) * .35;
  const items = [];
  // the saros dial behind his head, turning slowly
  const [hx, hy] = o.head || [.56, .3], Rr = .33 * s, cx = hx * W, cy = hy * H, rot = -.6 + (t - t0) * .045;
  const kRing = sstep(t0, t0 + 1.2, t);
  items.push([poly(circlePts(cx, cy, Rr, rot, rot + TAU, 160), 1.6), kRing]);
  items.push([poly(circlePts(cx, cy, Rr * .9, rot + .3, rot + .3 + TAU, 160), 1.0), sstep(t0 + .2, t0 + 1.4, t)]);
  const nT = 223;
  for (let j = 0; j < nT; j++) {
    const a = rot + j / nT * TAU, kk = sstep(t0 + j / nT * 1.2, t0 + j / nT * 1.2 + .15, t); if (kk <= 0) continue;
    const l = j % 10 === 0 ? .055 : .025;
    items.push([poly([[cx + Math.cos(a) * Rr * .9, cy + Math.sin(a) * Rr * .9], [cx + Math.cos(a) * Rr * (.9 + l), cy + Math.sin(a) * Rr * (.9 + l)]], j % 10 === 0 ? 1.2 : .8), kk]);
  }
  // his theorem: circle, diameter, the triangle on it, the right angle
  const [tx, ty] = o.theorem || [.2, .36], R = .115 * s, X = tx * W, Y = ty * H, ta = (o.thalesA ?? -.12), tb = 2.05;
  const t1 = t0 + 1.0;
  items.push([poly(circlePts(X, Y, R, -Math.PI / 2, 1.5 * Math.PI, 96), 1.5), sstep(t1, t1 + .7, t)]);
  const A = [X + Math.cos(Math.PI + ta) * R, Y + Math.sin(Math.PI + ta) * R], Bp = [X + Math.cos(ta) * R, Y + Math.sin(ta) * R], P = [X + Math.cos(-tb) * R, Y + Math.sin(-tb) * R];
  items.push([poly([A, Bp], 1.3), sstep(t1 + .5, t1 + .85, t)]);
  items.push([poly([A, P, Bp], 1.5), sstep(t1 + .75, t1 + 1.25, t)]);
  { const d1 = [A[0] - P[0], A[1] - P[1]], d2 = [Bp[0] - P[0], Bp[1] - P[1]], l1 = Math.hypot(...d1), l2 = Math.hypot(...d2), q = .16 * R;
    const p1 = [P[0] + d1[0] / l1 * q, P[1] + d1[1] / l1 * q], p2 = [P[0] + d2[0] / l2 * q, P[1] + d2[1] / l2 * q], p3 = [p1[0] + d2[0] / l2 * q, p1[1] + d2[1] / l2 * q];
    items.push([poly([p1, p3, p2], 1.1), sstep(t1 + 1.15, t1 + 1.4, t)]); }
  // the gear: teeth, rim, four spokes, hub; then its teeth peel off into lines of code
  const [gx, gy] = o.gear || [.84, .64], Rg = .085 * s, GX = gx * W, GY = gy * H, nTeeth = 40, grot = (t - t0) * .25, t2 = t0 + 1.9;
  const tooth = []; for (let j = 0; j < nTeeth; j++) { const a0 = grot + j / nTeeth * TAU, a1 = a0 + TAU / nTeeth * .25, a2 = a0 + TAU / nTeeth * .5, a3 = a0 + TAU / nTeeth * .75;
    for (const [a, r] of [[a0, Rg], [a1, Rg * 1.09], [a2, Rg * 1.09], [a3, Rg]]) tooth.push([GX + Math.cos(a) * r, GY + Math.sin(a) * r]); }
  const peel = sstep(t2 + 1.0, t2 + 2.2, t);
  items.push([poly(tooth, 1.25, true), sstep(t2, t2 + .8, t) * (1 - .55 * peel)]);
  items.push([poly(circlePts(GX, GY, Rg * .78, grot, grot + TAU, 72), 1.0), sstep(t2 + .3, t2 + .9, t)]);
  for (let j = 0; j < 4; j++) { const a = grot + j * Math.PI / 2; items.push([poly([[GX + Math.cos(a) * Rg * .16, GY + Math.sin(a) * Rg * .16], [GX + Math.cos(a) * Rg * .78, GY + Math.sin(a) * Rg * .78]], 1.0), sstep(t2 + .5, t2 + 1.0, t)]); }
  items.push([poly(circlePts(GX, GY, Rg * .16, 0, TAU, 32), 1.0), sstep(t2 + .7, t2 + 1.0, t)]);
  // leader lines from the teeth to the code rows (the gear resolving into code)
  const rows = ['saros = 6585.32  # days', 'for k in range(-3, 4):', '    t = t0 + k * saros', '    if eclipse(t, halys):', '        mark(t)'];
  const cx0 = GX - Rg * 2.9, cy0 = GY + Rg * 1.45, lh = .03 * s;
  rows.forEach((_, j) => {
    const a = grot + (.6 + j * .22) * Math.PI, sx = GX + Math.cos(a) * Rg * 1.09, sy = GY + Math.sin(a) * Rg * 1.09;
    items.push([poly([[sx, sy], [lerp(sx, cx0 - .01 * s, .5), cy0 + j * lh - .006 * s], [cx0 - .008 * s, cy0 + j * lh - .006 * s]], .8), sstep(t2 + 1.1 + j * .12, t2 + 1.5 + j * .12, t)]);
  });
  // draw: lines first, into a layer that his matte cuts (lines pass behind him), then the lettering
  gildLines(g, items, u, { alpha: dim * (o.alpha ?? 1) });
  arcText(g, 'SAROS · 18 Y 11 D 8 H', cx, cy, Rr * 1.045, -Math.PI / 2 - .55 + (t - t0) * .045 * .5, 27 * u, u, dim * sstep(t0 + 1.3, t0 + 1.9, t) * (o.alpha ?? 1));
  // the code rows typing out (JetBrains Mono in gold)
  setFont(g, 'mono', 19 * u);
  rows.forEach((row, j) => {
    const k = sstep(t2 + 1.4 + j * .14, t2 + 1.9 + j * .14, t), n = Math.round(row.length * k); if (n <= 0) return;
    const txt = row.slice(0, n);
    g.save(); g.globalAlpha = dim * (o.alpha ?? 1); g.textBaseline = 'middle';
    g.fillStyle = 'rgba(38,22,8,0.6)'; g.fillText(txt, cx0 + 1 * u, cy0 + j * lh + 1.3 * u);
    g.fillStyle = '#d6aa4c'; g.fillText(txt, cx0, cy0 + j * lh);
    g.restore();
  });
}
