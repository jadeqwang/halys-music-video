// expr.js: acting drawn over the cels, in output space, on twos.
//
// Close-up (S80/S81), from the face landmarks of each drawing and the cel's eye measurements (eye.js):
//   warmth   a light flat blush on both cheeks with three hatch strokes (her sheet's softness), always on
//   smirk    from EXPR.smirk (276.20), over three drawings: the corner of her mouth on the winking side (her right,
//            frame left) lifts with a small cheek crease, the rest of the mouth stays flat: mischief, not a grin
//   narrow   both eyes narrow a touch with it (upper lids down, lower lids up); during the wink the open eye narrows
//            further, as the plate's does. The winking eye's narrowing is handed to drawWink so the eclipse lid starts
//            from it.
// Wide (S79): one lock of hair, flung out by the spin, swings back and settles on the side of her head.

import { MAT, LINE, LINE_SKIN } from './palette.js';
import { eyeGeom, narrowed } from './eye.js';
import { EXPR, lidAt } from './sheets.js';

const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const TAU = Math.PI * 2;
const tw = t => Math.floor(t * 12 + 1e-6) / 12;                  // on twos (a drawing every 1/12 s)

export function smirkAt(t) {
  if (t < EXPR.smirk - 1e-6) return 0;
  const k = Math.floor((t - EXPR.smirk) * 12 + 1e-6);
  return [.45, .8, 1][Math.min(2, k)];
}
// eye narrowing per side at time t: {t, b} fractions of the opening
export function narrowAt(t, side) {
  const s = smirkAt(t), w = side === 'R' ? 0 : lidAt(tw(t));
  return { t: .09 * s + .06 * w, b: .15 * s + .09 * w };
}

// a tapered ribbon through points (output px), widths w0 -> w1 with pointed ends
function ribbon(g, P, w0, w1, col) {
  const n = P.length; if (n < 2) return;
  const Lp = [], Rp = [];
  for (let j = 0; j < n; j++) {
    const a = P[Math.max(0, j - 1)], b = P[Math.min(n - 1, j + 1)], tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1;
    const v = j / (n - 1), w = (w0 + (w1 - w0) * v) * Math.min(1, Math.sin(Math.PI * clamp(v, .03, .97)) * 2.4);
    Lp.push([P[j][0] - ty / m * w / 2, P[j][1] + tx / m * w / 2]); Rp.push([P[j][0] + ty / m * w / 2, P[j][1] - tx / m * w / 2]);
  }
  g.fillStyle = col; g.beginPath(); g.moveTo(Lp[0][0], Lp[0][1]); for (const p of Lp) g.lineTo(p[0], p[1]); for (let j = n - 1; j >= 0; j--) g.lineTo(Rp[j][0], Rp[j][1]); g.closePath(); g.fill();
}
const bez3 = (a, b, c, d, n = 20) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]; });
const bez2 = (a, c, b, n = 16) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; });

function faceOf(res) {
  const fc = res && !res.noFace && res.inp && res.inp.faces && res.inp.faces[0];
  return fc && fc.src === 'mp' && fc.lines ? fc : null;
}

// the narrowed eye: skin over the cel's lash and lids down/up to the new opening, a new lash line and lower lid line
function narrowEye(g, view, res, side, nar, u, upper = true) {
  const E = eyeGeom(res, side); if (!E || (nar.t <= 0 && nar.b <= 0)) return;
  const NP = narrowed(E, nar), s = view.s, X = x => view.ox + x * s, Y = y => view.oy + y * s, M = 2.6;
  const N = Math.max(8, Math.round((NP.x1 - NP.x0) * 2)), XS = [];
  for (let j = 0; j <= N; j++) XS.push(NP.x0 + (NP.x1 - NP.x0) * j / N);
  // lower lid: skin from below the old opening up to the raised edge, a thin lid line on the middle of it
  if (nar.b > 0) {
    g.fillStyle = MAT.skin.base; g.beginPath();
    XS.forEach((x, j) => j ? g.lineTo(X(x), Y(NP.bot(x))) : g.moveTo(X(x), Y(NP.bot(x))));
    for (let j = N; j >= 0; j--) g.lineTo(X(XS[j]), Y(NP.bot0(XS[j]) + M));
    g.closePath(); g.fill();
    const lo = XS.filter((_, j) => j > N * .12 && j < N * .88).map(x => [X(x), Y(NP.bot(x) + .4)]);
    ribbon(g, lo, 1.7 * u, 1.7 * u, '#7c4a42');
  }
  if (!upper || nar.t <= 0) return;
  // upper lid: skin from above the cel's lash down to the lowered edge, then the lash line along it
  const lashTop = x => NP.top0(x) - E.lash - 2;
  g.fillStyle = MAT.skin.base; g.beginPath();
  g.moveTo(X(NP.x0 - M), Y(lashTop(NP.x0)));
  for (const x of XS) g.lineTo(X(x), Y(lashTop(x) - 1.5));
  g.lineTo(X(NP.x1 + M), Y(lashTop(NP.x1)));
  for (let j = N; j >= 0; j--) g.lineTo(X(XS[j]), Y(NP.top(XS[j])));
  g.closePath(); g.fill();
  const wMax = Math.max(5.6 * u, E.lash * s * 1.1);
  const P = XS.map(x => [X(x), Y(NP.top(x))]), Lp = [], Rp = [];
  for (let j = 0; j <= N; j++) {
    const a = P[Math.max(0, j - 1)], b = P[Math.min(N, j + 1)], tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1;
    const v = j / N, toOuter = side === 'R' ? 1 - v : v;
    const w = wMax * (.18 + .82 * Math.pow(Math.sin(Math.PI * clamp(v * 1.04 - .02)), .5)) * (.72 + .4 * toOuter);
    Lp.push([P[j][0] - ty / m * w / 2, P[j][1] + tx / m * w / 2]); Rp.push([P[j][0] + ty / m * w / 2, P[j][1] - tx / m * w / 2]);
  }
  g.fillStyle = LINE; g.beginPath(); g.moveTo(Lp[0][0], Lp[0][1]); for (const p of Lp) g.lineTo(p[0], p[1]); for (let j = N; j >= 0; j--) g.lineTo(Rp[j][0], Rp[j][1]); g.closePath(); g.fill();
}

// the close-up's acting. Returns the winking eye's narrowing for drawWink.
export function drawExpression(g, view, res, t, u) {
  const fc = faceOf(res); if (!fc) return null;
  const W = res.W, H = res.H, s = view.s, L = fc.lines;
  const O = (x, y) => [view.ox + x * s, view.oy + y * s];
  const pt = (arr, k) => [arr[k * 2] * W, arr[k * 2 + 1] * H];
  const sm = smirkAt(t);
  // 1. warmth: a light flat blush under each eye, three hatch strokes
  for (const side of ['R', 'L']) {
    const ir = L[`iris${side}`], lo = L[`eye${side}_lo`]; if (!ir || !lo) continue;
    let yb = 0; for (let i = 1; i < lo.length; i += 2) yb = Math.max(yb, lo[i] * H);
    const r = ir[2] * W, out = side === 'R' ? -1 : 1, cx = ir[0] * W + out * r * .35, cy = yb + r * 1.55;
    const [bx, by] = O(cx, cy);
    g.fillStyle = 'rgba(236, 132, 112, .16)'; g.beginPath(); g.ellipse(bx, by, r * 1.4 * s, r * .5 * s, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(214, 104, 88, .42)'; g.lineWidth = 1.5 * u; g.lineCap = 'round';
    for (let j = -1; j <= 1; j++) { const x = bx + j * r * .55 * s; g.beginPath(); g.moveTo(x - r * .12 * s, by + r * .2 * s); g.lineTo(x + r * .14 * s, by - r * .2 * s); g.stroke(); }
  }
  // 2. the mouth: the plate's line replaced by ours (flat when sm = 0, the right-side smirk as sm rises)
  if (L.lipO_up && L.lipI_up && L.lipI_lo) {
    const n = L.lipO_up.length / 2, A = pt(L.lipO_up, 0), B = pt(L.lipO_up, n - 1);
    const ni = L.lipI_up.length / 2;
    let my = 0; for (let k = 0; k < ni; k++) my += (L.lipI_up[k * 2 + 1] + L.lipI_lo[k * 2 + 1]) * H / 2; my /= ni;
    const lw = Math.hypot(B[0] - A[0], B[1] - A[1]), mx = (A[0] + B[0]) / 2, hw = lw * .3;
    if (sm > 0) {   // only the smirk replaces the plate's mouth (the deadpan keeps the drawn one)
      const [ex, ey] = O(mx - lw * .03, my + lw * .04);
      g.fillStyle = MAT.skin.base; g.beginPath(); g.ellipse(ex, ey, lw * .45 * s, lw * .21 * s, 0, 0, TAU); g.fill();
      // her right corner (frame left) lifts; the other half stays a flat deadpan line
      const Lc = [mx - hw * (1.02 + .1 * sm), my - sm * .7 * hw], Rc = [mx + hw * .8, my + sm * .04 * hw];
      const P = bez3(Rc, [mx + hw * .1, my + sm * .04 * hw], [mx - hw * .62, my + hw * .02], Lc).map(p => O(...p));
      ribbon(g, P, 2.3 * u, 3.0 * u, LINE_SKIN);
      if (sm >= .75) {   // the cheek crease beside the lifted corner
        const C = bez2([Lc[0] - hw * .1, Lc[1] - hw * .2], [Lc[0] - hw * .26, Lc[1] + hw * .02], [Lc[0] - hw * .14, Lc[1] + hw * .26]).map(p => O(...p));
        ribbon(g, C, 1.7 * u, 1.2 * u, LINE_SKIN);
      }
      // the lower lip: a short light stroke under the middle
      const lp = [[mx - hw * .32, my + hw * .62], [mx + hw * .2, my + hw * .58]].map(p => O(...p));
      ribbon(g, lp, 2.0 * u, 1.6 * u, '#cf9282');
    }
  }
  // 3. the eyes narrow with the smirk (the winking eye's upper lid is drawWink's once the eclipse starts)
  const nL = narrowAt(t, 'L'), nR = narrowAt(t, 'R'), winking = lidAt(t) > 0;
  narrowEye(g, view, res, 'L', nL, u, true);
  narrowEye(g, view, res, 'R', nR, u, !winking);
  return nR;
}

// ---------------------------------------------------------------- S79: the lock of hair settling after the spin
// Placed on the face box of each drawing (it follows her head through the settle drawings): rooted on the crown's outer
// contour on the frame-left side, at rest a loose lock just outside the hair; flung out to the left on the landing and
// swinging back with a damped oscillation, on twos.
export function drawSettleStrand(g, view, res, i, Fland, u) {
  const fc = res && !res.noFace && res.inp && res.inp.faces && res.inp.faces[0];
  if (!fc || !fc.box || i < Fland) return;
  const W = res.W, H = res.H, s = view.s;
  const [bx0, by0, bx1, by1] = fc.box, fw = (bx1 - bx0) * W, fh = (by1 - by0) * H, x0 = bx0 * W, y0 = by0 * H;
  const tau = Math.floor((i - Fland) / 5) * 5 / 60;
  const a = Math.exp(-tau / .3) * Math.cos(TAU * tau / .55);
  // at rest a loose flyaway lock just outside the hair's outer contour (it bulges a few px off it against the room)
  const root = [x0 - .3 * fw, y0 - .2 * fh], ctrl = [x0 - .95 * fw - 18 * a, y0 + .55 * fh - 4 * Math.abs(a)], tip = [x0 - .98 * fw - 40 * a, y0 + 1.5 * fh - 12 * Math.abs(a)];
  const P = bez2(root, ctrl, tip, 28).map(([x, y]) => [view.ox + x * s, view.oy + y * s]);
  ribbon(g, P, 2.6 * u * s, .3 * u * s, MAT.black.base);
}
