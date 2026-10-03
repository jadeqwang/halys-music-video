// decals.js: costume graphics redrawn crisp but kept ON the fabric. The plate's letters would trace as garbled squiggles,
// so the lettering and the patch are drawn by us; WHERE they are comes from the plate, measured on every drawing
// (prep/decals.py -> decals/<plate>_<take>.json): the light-blue circle's ellipse, the RARE EARTH line's cap line and
// baseline, the 1420 MHz patch's ring. So the print moves, turns and bends with the jacket exactly as the fabric does in
// the plate, and the patch rides on her LEFT sleeve, turning (foreshortened) with the arm.
//   circle   stays the plate's own shape: the cel classifies it as the blue material inside the measured ellipse (cel.js
//            allowBlue), with its own fold shadow (one shadow tone)
//   text     RARE EARTH set in Archivo along the measured band (a mesh warp: every column follows the band's cap line and
//            baseline), drawn between the fills and the line art: clipped to her visible jacket (hair, arms and the chair
//            occlude it) and toned by the jacket's fold shadows; the fold creases draw over it
//   patch    a white disc, ink ring and 1420 / MHz mapped onto the measured ellipse (its axes give the turn of the arm),
//            clipped to the visible sleeve and toned by its shadow
// Under each decal the cel paints the plate's marks out (cel.js `clear` zones with keepShade: the material becomes jacket,
// the fold shading carries on underneath, no interior lines).

import { loadJSON, makeCanvas } from '../../assets.js';
import { setFont } from '../../fonts.js';
import { MAT, LINE } from './palette.js';
import { takeStem } from './source.js';

const TAU = Math.PI * 2;
const DEC = {};
export async function initDecals(takes) {
  for (const [id, take] of Object.entries(takes)) DEC[id] = (await loadJSON(`src/worlds/ink/decals/${id}_${takeStem(take)}.json`, { optional: true })) || {};
}

// the region weight of an exposure's redrawn region at a point (setup px), 0 = the held body cel
function regionW(e, x, y, W, H) {
  const r = e.region; if (!r || !e.ref) return 0;
  const d = Math.hypot((x / W - r.cx) / r.rx, (y / H - r.cy) / r.ry), f = Math.max(.01, r.feather ?? .3);
  return Math.min(1, Math.max(0, (1 - d) / f));
}
const mapE = (q, xf) => q && { cx: xf.s * q.cx + xf.tx, cy: xf.s * q.cy + xf.ty, rx: q.rx * xf.s, ry: q.ry * xf.s, rot: q.rot };

// the decals of exposure e in SETUP px: { circle, text: {pts: [[x, top, base] ...]}, patch } (null when not measured)
export function decalGeom(S, e) {
  const D = e && DEC[e.src]; if (!D) return null;
  e._dg ??= {};
  if (S.id in e._dg) return e._dg[S.id];
  const xf = (S.reg && S.reg[e.src]) || { s: 1, tx: 0, ty: 0 };
  const body = D[String(e.ref || e.pf)] || null, own = D[String(e.pf)] || null;
  let out = null;
  if (body) {
    out = { circle: mapE(body.circle, xf), patch: mapE(body.patch, xf),
      text: body.text && { pts: body.text.pts.map(([x, a, b]) => [xf.s * x + xf.tx, xf.s * a + xf.ty, xf.s * b + xf.ty]) } };
    // a redrawn region carries its own patch when the patch lies inside it
    if (own && own.patch && out.patch && regionW(e, out.patch.cx, out.patch.cy, S.w, S.h) > .5) out.patch = mapE(own.patch, xf);
  }
  e._dg[S.id] = out;
  return out;
}

// the band polygon of the lettering (setup px), grown by g px
function bandPoly(T, g = 0) {
  const P = T.pts, top = P.map(([x, a]) => [x, a - g]), bot = P.map(([x, , b]) => [x, b + g]).reverse();
  return [[P[0][0] - g, P[0][1] - g], ...top, [P[P.length - 1][0] + g, P[P.length - 1][1] - g], [P[P.length - 1][0] + g, P[P.length - 1][2] + g], ...bot, [P[0][0] - g, P[0][2] + g]];
}

// cel zones for exposure e: the clear zones under the decals and the circle's blue zone (setup-normalised)
export function decalZones(S, e) {
  const G = decalGeom(S, e); if (!G) return { clear: [] };
  const W = S.w, H = S.h, clear = [];
  if (G.text) clear.push({ poly: bandPoly(G.text, 2.2).map(([x, y]) => [x / W, y / H]), mat: 'jacket', from: ['black', 'brow', 'navy'], keepShade: true });
  if (G.patch) clear.push({ cx: G.patch.cx / W, cy: G.patch.cy / H, rx: (G.patch.rx + .8) / W, ry: (G.patch.ry + .8) / H, rot: G.patch.rot, mat: 'jacket', keepShade: true, solid: true });
  const c = G.circle, allowBlue = c && { cx: c.cx / W, cy: c.cy / H, rx: c.rx * 1.12 / W, ry: c.ry * 1.12 / H, rot: c.rot };
  return { clear, allowBlue };
}

// ---------------------------------------------------------------- drawing
// image src (its rectangle [0, w] x [0, h]) into a mesh: cols x 2 quads given as top[] / bot[] point rows (output px)
function meshWarp(g, src, top, bot) {
  const n = top.length - 1, sw = src.width, sh = src.height;
  const tri = (s0, s1, s2, d0, d1, d2) => {
    const den = s0[0] * (s2[1] - s1[1]) - s1[0] * s2[1] + s2[0] * s1[1] + (s1[0] - s2[0]) * s0[1];
    if (Math.abs(den) < 1e-9) return;
    g.save();
    // grow the clip triangle by ~0.6 px so neighbouring triangles leave no seam
    const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
    const gr = p => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * .6, p[1] + dy / l * .6]; };
    const [e0, e1, e2] = [gr(d0), gr(d1), gr(d2)];
    g.beginPath(); g.moveTo(e0[0], e0[1]); g.lineTo(e1[0], e1[1]); g.lineTo(e2[0], e2[1]); g.closePath(); g.clip();
    const a = -(s0[1] * (d2[0] - d1[0]) - s1[1] * d2[0] + s2[1] * d1[0] + (s1[1] - s2[1]) * d0[0]) / den;
    const b = (s1[1] * d2[1] + s0[1] * (d1[1] - d2[1]) - s2[1] * d1[1] + (s2[1] - s1[1]) * d0[1]) / den;
    const c = (s0[0] * (d2[0] - d1[0]) - s1[0] * d2[0] + s2[0] * d1[0] + (s1[0] - s2[0]) * d0[0]) / den;
    const d = -(s1[0] * d2[1] + s0[0] * (d1[1] - d2[1]) - s2[0] * d1[1] + (s2[0] - s1[0]) * d0[1]) / den;
    const e = (s0[0] * (s2[1] * d1[0] - s1[1] * d2[0]) + s0[1] * (s1[0] * d2[0] - s2[0] * d1[0]) + (s2[0] * s1[1] - s1[0] * s2[1]) * d0[0]) / den;
    const f = (s0[0] * (s2[1] * d1[1] - s1[1] * d2[1]) + s0[1] * (s1[0] * d2[1] - s2[0] * d1[1]) + (s2[0] * s1[1] - s1[0] * s2[1]) * d0[1]) / den;
    g.transform(a, b, c, d, e, f);
    g.drawImage(src, 0, 0);
    g.restore();
  };
  for (let k = 0; k < n; k++) {
    const u0 = k / n * sw, u1 = (k + 1) / n * sw;
    tri([u0, 0], [u1, 0], [u1, sh], top[k], top[k + 1], bot[k + 1]);
    tri([u0, 0], [u1, sh], [u0, sh], top[k], bot[k + 1], bot[k]);
  }
}

// RARE EARTH set flat: cap height = the canvas height (the letters fill it exactly from cap line to baseline)
const _txt = new Map();
function letters(col, capPx) {
  const k = `${col}|${capPx}`; if (_txt.has(k)) return _txt.get(k);
  const c0 = makeCanvas(8, 8), g0 = c0.getContext('2d');
  const fs = capPx / .7;                                     // Archivo cap height ~0.7 em
  setFont(g0, 'chop', fs, { weight: 600 }); g0.fontStretch = 'normal'; g0.letterSpacing = `${(.08 * fs).toFixed(2)}px`;
  const m = g0.measureText('RARE EARTH'), asc = m.actualBoundingBoxAscent, w = Math.ceil(m.actualBoundingBoxRight + m.actualBoundingBoxLeft) + 2;
  const c = makeCanvas(w, Math.ceil(asc) + 1), g = c.getContext('2d');
  setFont(g, 'chop', fs, { weight: 600 }); g.fontStretch = 'normal'; g.letterSpacing = `${(.08 * fs).toFixed(2)}px`;
  g.fillStyle = col; g.textBaseline = 'alphabetic'; g.fillText('RARE EARTH', m.actualBoundingBoxLeft + 1, asc);
  _txt.set(k, c);
  return c;
}

function patchDesign(g, col = MAT.white.base) {   // the design at radius 100, in the patch's own frame (x right, y down)
  g.fillStyle = col; g.beginPath(); g.arc(0, 0, 100, 0, TAU); g.fill();
  g.strokeStyle = LINE; g.lineWidth = 17; g.beginPath(); g.arc(0, 0, 91, 0, TAU); g.stroke();
  g.fillStyle = LINE; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
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

// draw the decals of exposure e into the cel layer cg (between the fills and the line art). maskOf(labelNames) renders
// a full-size alpha mask of those cel labels ('jacket', 'jacket:shadow', ...).
export function drawDecals(cg, view, S, e, u, maskOf) {
  const G = decalGeom(S, e); if (!G || (!G.text && !G.patch)) return;
  const W = cg.canvas.width, H = cg.canvas.height, X = (x, y) => [view.ox + x * view.s, view.oy + y * view.s];
  const lay = makeCanvas(W, H), lg = lay.getContext('2d');                       // base tones
  const sh = makeCanvas(W, H), sg = sh.getContext('2d');                         // shadow tones
  if (G.text) {
    const P = G.text.pts, top = P.map(([x, a]) => X(x, a)), bot = P.map(([x, , b]) => X(x, b));
    const cap = Math.max(8, Math.round(Math.hypot(top[4][0] - bot[4][0], top[4][1] - bot[4][1]) * 3));   // 3x supersampled
    for (const [gg, col] of [[lg, '#1d1f2a'], [sg, '#15161e']]) meshWarp(gg, letters(col, cap), top, bot);
  }
  if (G.patch) {
    const F = patchFrame(G.patch), [cx, cy] = X(G.patch.cx, G.patch.cy), s = view.s;
    for (const [gg, col] of [[lg, MAT.white.base], [sg, MAT.white.shadow]]) {
      gg.save();
      const k = s / 100;
      gg.transform(F.right[0] * F.rr * k, F.right[1] * F.rr * k, F.down[0] * F.ru * k, F.down[1] * F.ru * k, cx, cy);
      patchDesign(gg, col);
      gg.restore();
    }
  }
  // occlusion and fold shading: the base tones where her jacket is visible, the shadow tones where it is in shadow
  const vis = maskOf(['jacket', 'jacket:shadow']), shad = maskOf(['jacket:shadow']);
  lg.globalCompositeOperation = 'destination-in'; lg.drawImage(vis, 0, 0);
  sg.globalCompositeOperation = 'destination-in'; sg.drawImage(shad, 0, 0);
  cg.drawImage(lay, 0, 0); cg.drawImage(sh, 0, 0);
}
