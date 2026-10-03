// decals.js: costume graphics redrawn crisp but kept ON the fabric. The plate's letters would trace as garbled squiggles,
// so the print and the patch are drawn by us; WHERE they are comes from the plate, measured on every drawing
// (prep/decals.py -> decals/<plate>_<take>.json): the light-blue circle's ellipse, the RARE EARTH line's cap line and
// baseline, the 1420 MHz patch's ring, and over the print the jacket's fold field (fold depth from the plate's shading,
// carried along the folds' axis) and its shade (the folds plus the hair's cast shadow).
//   print    the circle and RARE EARTH are one printed piece of fabric. One warp maps them onto her back: (1) a cylinder
//            wrap about her spine (the axis runs down through the circle's centre, square to the lettering): the print
//            compresses toward the side of the back that turns away (she is seen from behind her left shoulder), and seen
//            from above the convex back bends the baseline into a gentle arc; the circle becomes a turned, foreshortened
//            shape; (2) where a fold crosses the print, the print kinks into it (displaced along the view, in proportion to
//            the fold's depth). Shading: the print's own shadow tone wherever the fold shade (or the cel's jacket shadow)
//            lies on it, with crisp antialiased edges. Drawn between the fills and the line art, clipped to her visible
//            jacket (hair, arms and the chair occlude it); the fold creases draw over it.
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

// the print's wrap: cylinder radius in circle radii, the turn of the back at the print's centre (rad, + = the frame-right
// side turns away), the camera's elevation (sin), the fold kink (setup px at full depth, per 40 px of circle radius) and the
// direction a fold valley shifts the print in the picture (seen from above: down)
export const WRAP = { k: 2.1, phi: .32, elev: .36, kink: 3.2, view: [.2 / Math.hypot(.2, 1), 1 / Math.hypot(.2, 1)] };

const _b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
function foldOf(D, xf) {
  const F = D && D.fold; if (!F) return null;
  F._sh ??= _b64(F.shade); F._fd ??= _b64(F.fold);
  return { ...F, xf };
}
// a fold-field value (0..1) at setup px (x, y): bilinear on the 2 px plate grid, 0 outside it
function sampleField(F, which, x, y) {
  if (!F) return 0;
  const xp = (x - F.xf.tx) / F.xf.s, yp = (y - F.xf.ty) / F.xf.s;
  const gx = (xp - F.x0) / F.step, gy = (yp - F.y0) / F.step;
  if (gx < 0 || gy < 0 || gx > F.nx - 1 || gy > F.ny - 1) return 0;
  const i = Math.min(F.nx - 2, Math.floor(gx)), j = Math.min(F.ny - 2, Math.floor(gy)), fx = gx - i, fy = gy - j, A = which === 'fold' ? F._fd : F._sh, n = F.nx;
  return ((A[j * n + i] * (1 - fx) + A[j * n + i + 1] * fx) * (1 - fy) + (A[(j + 1) * n + i] * (1 - fx) + A[(j + 1) * n + i + 1] * fx) * fy) / 255;
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
    out = { circle: mapE(body.circle, xf), patch: mapE(body.patch, xf), fold: foldOf(body, xf),
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

// cel zones for exposure e: the clear zones under the decals (setup-normalised). The plate's circle becomes plain jacket
// (its blue only; her hair over it stays hair, so it occludes the drawn print)
export function decalZones(S, e) {
  const G = decalGeom(S, e); if (!G) return { clear: [] };
  const W = S.w, H = S.h, clear = [];
  if (G.circle) clear.push({ cx: G.circle.cx / W, cy: G.circle.cy / H, rx: (G.circle.rx * 1.06 + 1.5) / W, ry: (G.circle.ry * 1.06 + 1.5) / H, rot: G.circle.rot, mat: 'jacket', from: ['blue', 'white', 'skin'], keepShade: true });
  if (G.text) clear.push({ poly: bandPoly(G.text, 2.2).map(([x, y]) => [x / W, y / H]), mat: 'jacket', from: ['black', 'brow', 'navy'], keepShade: true });
  if (G.patch) clear.push({ cx: G.patch.cx / W, cy: G.patch.cy / H, rx: (G.patch.rx + .8) / W, ry: (G.patch.ry + .8) / H, rot: G.patch.rot, mat: 'jacket', keepShade: true, solid: true });
  return { clear };
}

// the print's warp (setup px -> setup px): the cylinder wrap about her spine, then the fold kink
export function printWarp(G) {
  const C = G && G.circle; if (!C) return p => p;
  const P = G.text && G.text.pts;
  let es = [1, 0];
  if (P) { const a = P[0], b = P[P.length - 1], dx = b[0] - a[0], dy = (b[1] + b[2] - a[1] - a[2]) / 2, m = Math.hypot(dx, dy) || 1; es = [dx / m, dy / m]; }
  const et = [-es[1], es[0]], r = Math.max(C.rx, C.ry), R = WRAP.k * r, phi = WRAP.phi, sa = WRAP.elev, A = WRAP.kink * r / 40, v = WRAP.view, F = G.fold;
  const sp = Math.sin(phi), cp = Math.cos(phi);
  return ([x, y]) => {
    const dx = x - C.cx, dy = y - C.cy, s = dx * es[0] + dy * es[1], t = dx * et[0] + dy * et[1];
    const th = s / R + phi, s2 = R * (Math.sin(th) - sp), t2 = t + R * (Math.cos(th) - cp) * sa;
    let X = C.cx + s2 * es[0] + t2 * et[0], Y = C.cy + s2 * es[1] + t2 * et[1];
    const f = sampleField(F, 'fold', X, Y);
    return [X + A * f * v[0], Y + A * f * v[1]];
  };
}

// ---------------------------------------------------------------- drawing
// image src (its rectangle [0, w] x [0, h]) into a mesh of point rows (output px): rows[0] its top edge ... rows[m] its bottom
function meshRows(g, src, rows) { for (let k = 0; k < rows.length - 1; k++) meshWarp(g, src, rows[k], rows[k + 1], k / (rows.length - 1), (k + 1) / (rows.length - 1)); }
function meshWarp(g, src, top, bot, v0 = 0, v1 = 1) {
  const n = top.length - 1, sw = src.width, sh = src.height, h0 = v0 * sh, h1 = v1 * sh;
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
    tri([u0, h0], [u1, h0], [u1, h1], top[k], top[k + 1], bot[k + 1]);
    tri([u0, h0], [u1, h1], [u0, h1], top[k], bot[k + 1], bot[k]);
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

// the band's cap line / baseline at x (setup px), interpolated between the measured samples
function bandAt(P, x, k) {
  if (x <= P[0][0]) return P[0][k];
  for (let i = 1; i < P.length; i++) if (x <= P[i][0]) { const f = (x - P[i - 1][0]) / (P[i][0] - P[i - 1][0] || 1); return P[i - 1][k] * (1 - f) + P[i][k] * f; }
  return P[P.length - 1][k];
}

// the fold shade over the print as an alpha mask (output size), crisp: the field thresholded with a one-pixel antialiased
// edge (the field's gradient), like the cel fills
function shadeMask(W, H, view, G, warpPts, t = .45) {
  const F = G.fold; if (!F) return null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of warpPts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  x0 = Math.max(0, Math.floor(x0 - 4)); y0 = Math.max(0, Math.floor(y0 - 4)); x1 = Math.min(W - 1, Math.ceil(x1 + 4)); y1 = Math.min(H - 1, Math.ceil(y1 + 4));
  if (x1 <= x0 || y1 <= y0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, c = makeCanvas(W, H), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const hv = (X, Y) => sampleField(F, 'shade', (X - view.ox) / view.s, (Y - view.oy) / view.s);
  let any = false;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x0 + i + .5, Y = y0 + j + .5, v = hv(X, Y);
    if (v < t - .2) continue;
    const gr = Math.hypot(hv(X + 1, Y) - v, hv(X, Y + 1) - v), a = Math.min(1, Math.max(0, .5 + (v - t) / Math.max(gr, 1e-4)));
    if (a > 0) { d[(j * w + i) * 4 + 3] = Math.round(a * 255); any = true; }
  }
  if (!any) return null;
  g.putImageData(img, x0, y0);
  return c;
}

// draw the decals of exposure e into the cel layer cg (between the fills and the line art). maskOf(labelNames) renders
// a full-size alpha mask of those cel labels ('jacket', 'jacket:shadow', ...).
export function drawDecals(cg, view, S, e, u, maskOf) {
  const G = decalGeom(S, e); if (!G || (!G.text && !G.patch && !G.circle)) return;
  const W = cg.canvas.width, H = cg.canvas.height, X = ([x, y]) => [view.ox + x * view.s, view.oy + y * view.s];
  const lay = makeCanvas(W, H), lg = lay.getContext('2d');                       // base tones
  const sh = makeCanvas(W, H), sg = sh.getContext('2d');                         // shadow tones
  const pw = printWarp(G), printPts = [];
  if (G.circle) {   // the circle: the measured ellipse, wrapped and kinked, as one crisp shape
    const C = G.circle, ca = Math.cos(C.rot), sa = Math.sin(C.rot), N = 144, Q = [];
    for (let k = 0; k < N; k++) { const a = k / N * TAU, ex = C.rx * Math.cos(a), ey = C.ry * Math.sin(a); Q.push(X(pw([C.cx + ex * ca - ey * sa, C.cy + ex * sa + ey * ca]))); }
    printPts.push(...Q);
    for (const [gg, col] of [[lg, MAT.blue.base], [sg, MAT.blue.shadow]]) { gg.fillStyle = col; gg.beginPath(); Q.forEach((q, k) => k ? gg.lineTo(q[0], q[1]) : gg.moveTo(q[0], q[1])); gg.closePath(); gg.fill(); }
  }
  if (G.text) {     // the lettering: a 32 x 3 mesh along the measured band, wrapped and kinked with the circle
    const P = G.text.pts, xa = P[0][0], xb = P[P.length - 1][0], NC = 32, NR = 3, rows = [];
    for (let r = 0; r <= NR; r++) {
      const row = [];
      for (let k = 0; k <= NC; k++) { const x = xa + (xb - xa) * k / NC, tp = bandAt(P, x, 1), bs = bandAt(P, x, 2); row.push(X(pw([x, tp + (bs - tp) * r / NR]))); }
      rows.push(row);
    }
    printPts.push(...rows[0], ...rows[NR]);
    const mid = rows[0][NC >> 1], midB = rows[NR][NC >> 1];
    const cap = Math.max(8, Math.round(Math.hypot(mid[0] - midB[0], mid[1] - midB[1]) * 3));   // 3x supersampled
    for (const [gg, col] of [[lg, '#1d1f2a'], [sg, '#15161e']]) meshRows(gg, letters(col, cap), rows);
  }
  if (G.patch) {
    const F = patchFrame(G.patch), [cx, cy] = X([G.patch.cx, G.patch.cy]), s = view.s;
    for (const [gg, col] of [[lg, MAT.white.base], [sg, MAT.white.shadow]]) {
      gg.save();
      const k = s / 100;
      gg.transform(F.right[0] * F.rr * k, F.right[1] * F.rr * k, F.down[0] * F.ru * k, F.down[1] * F.ru * k, cx, cy);
      patchDesign(gg, col);
      gg.restore();
    }
  }
  // occlusion and shading: the base tones where her jacket is visible; the shadow tones where the fold shade or the cel's
  // jacket shadow lies on it (and it is visible)
  const vis = maskOf(['jacket', 'jacket:shadow']), shad = maskOf(['jacket:shadow']), fm = printPts.length ? shadeMask(W, H, view, G, printPts) : null;
  if (fm) { const g2 = shad.getContext('2d'); g2.drawImage(fm, 0, 0); }
  lg.globalCompositeOperation = 'destination-in'; lg.drawImage(vis, 0, 0);
  sg.globalCompositeOperation = 'destination-in'; sg.drawImage(shad, 0, 0); sg.drawImage(vis, 0, 0);
  cg.drawImage(lay, 0, 0); cg.drawImage(sh, 0, 0);
}
