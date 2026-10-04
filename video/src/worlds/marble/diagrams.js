// diagrams.js: the gold-leaf line style of the marble world's construction drawings. S53's year arc and Thales's two
// attributes (video/src/scenes/marble.js) are stroked with it. An element is a polyline {P, cum, L, w}; gildLines
// reveals each one along its own length (a line being drawn), then holds it. Gold leaf: an umber shadow, an ochre-gold
// body, a pale highlight and a restrained warm glow. (v1's thalesDiagrams, with its theorem, saros dial and
// gear-into-code, and its arcText went with the v2 revision of S53.)

import { clamp, lerp } from '../brush/util.js';

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
