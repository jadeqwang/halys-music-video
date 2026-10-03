// expr.js: acting drawn over the close-up's cels (S80/S81), in output space, from the face landmarks of each drawing and
// the cel's eye measurements (eye.js). The expression is the plate's (P58, from the keyframe K80b: the director's
// reference, a closed-lip, one-corner-up, knowing smirk, eyes narrowed, head tilted); tracing thins its two carrying
// lines, so they are drawn here, as an animator would on the key drawing:
//   smirk    the closed mouth as one confident ink line along the landmarks' inner lip line: level on her right (frame
//            left), curling up into the lifted corner on her left (frame right), with the cheek crease beside it and a light
//            lower-lip stroke; the traced mouth under it is painted out
//   narrow   both eyes heavy-lidded (upper lids a little down over the irises, lower lids lifted), the knowing look; as
//            one eye winks the other narrows a touch more. The winking eye's narrowing is handed to drawWink so the
//            eclipse lid starts from it
//   warmth   a light flat blush on both cheeks with three hatch strokes (her sheet's softness)

import { MAT, LINE, LINE_SKIN } from './palette.js';
import { eyeGeom, narrowed } from './eye.js';
import { lidAt, WINK } from './sheets.js';

const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const TAU = Math.PI * 2;
const tw = t => Math.floor(t * 12 + 1e-6) / 12;                  // on twos (a drawing every 1/12 s)

// eye narrowing per side at time t: {t, b} fractions of the opening. The knowing look is constant; the open eye narrows a
// little more while the other one winks.
export const NARROW = { t: .13, b: .12 };
export function narrowAt(t, side) {
  const w = side === WINK.side ? 0 : lidAt(tw(t));
  return { t: NARROW.t + .06 * w, b: NARROW.b + .08 * w };
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

const bez2 = (a, c, b, n = 16) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; });
// Catmull-Rom through points (analysis px), n samples per span
function spline(P, n = 6) {
  const out = [];
  for (let k = 0; k < P.length - 1; k++) {
    const p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(P.length - 1, k + 2)];
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(c => .5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(P[P.length - 1]);
  return out;
}

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

// the smirk: the closed mouth along the landmarks' inner lip line, the lifted corner curling up, the cheek crease
function drawSmirk(g, view, res, fc, u) {
  const L = fc.lines; if (!L.lipI_up || !L.lipI_lo || !L.lipO_up) return;
  const W = res.W, H = res.H, s = view.s, O = p => [view.ox + p[0] * s, view.oy + p[1] * s];
  const n = L.lipI_up.length / 2, mid = [];
  for (let k = 0; k < n; k++) mid.push([(L.lipI_up[2 * k] + L.lipI_lo[2 * k]) / 2 * W, (L.lipI_up[2 * k + 1] + L.lipI_lo[2 * k + 1]) / 2 * H]);
  const A = mid[0], B = mid[n - 1], lw = Math.hypot(B[0] - A[0], B[1] - A[1]);
  if (lw < 8) return;
  // which corner is lifted: the higher one, relative to the line through the corners' mean slope (the head's tilt)
  const ex = [(L.irisL ? L.irisL[0] : 1) * W - (L.irisR ? L.irisR[0] : 0) * W, (L.irisL ? L.irisL[1] : 0) * H - (L.irisR ? L.irisR[1] : 0) * H];
  const tilt = Math.atan2(ex[1], ex[0]), up = [Math.sin(tilt), -Math.cos(tilt)];          // the face's "up" (perpendicular to the eye line)
  const hgt = p => (p[0] - A[0]) * up[0] + (p[1] - A[1]) * up[1];
  const liftR = hgt(B) >= 0;                                                              // the frame-right corner is the lifted one
  const lifted = liftR ? B : A, level = liftR ? A : B, dir = liftR ? 1 : -1;
  // paint the traced mouth out: skin along the line, a little wider than it
  g.save(); g.fillStyle = MAT.skin.base; g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = MAT.skin.base; g.lineWidth = lw * .2 * s;
  g.beginPath(); mid.forEach((p, k) => { const q = O(p); k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke();
  g.restore();
  // the line: level half nearly straight, the lifted half curling up (exaggerated a touch, as an animator would), the corner
  // tucked in with a small hook
  const P = mid.map((p, k) => { const v = k / (n - 1), w = liftR ? v : 1 - v; return [p[0] + up[0] * lw * .05 * w * w, p[1] + up[1] * lw * .05 * w * w]; });
  const tip = [lifted[0] + dir * lw * .06 + up[0] * lw * .1, lifted[1] + up[1] * lw * .1];
  const C = spline(liftR ? [...P, tip] : [tip, ...P], 6).map(O);
  ribbon(g, C, (liftR ? 2.2 : 3.6) * u, (liftR ? 3.6 : 2.2) * u, '#4a2a26');
  // the cheek crease beside the lifted corner: a short curve from above the corner, bowing outward, down past it
  const c0 = [tip[0] + dir * lw * .05 + up[0] * lw * .1, tip[1] + up[1] * lw * .1];
  const c2 = [tip[0] + dir * lw * .07 - up[0] * lw * .1, tip[1] - up[1] * lw * .1];
  const c1 = [tip[0] + dir * lw * .16, tip[1]];
  ribbon(g, bez2(c0, c1, c2, 12).map(O), 1.9 * u, 1.3 * u, LINE_SKIN);
  // the lower lip: a short light stroke under the middle of the mouth
  const m = mid[Math.floor(n / 2)], d = lw * .22;
  ribbon(g, [[m[0] - lw * .14 - up[0] * d, m[1] - up[1] * d], [m[0] + lw * .1 - up[0] * d * .95, m[1] - up[1] * d * .95]].map(O), 2.2 * u, 1.6 * u, '#cf9282');
}

// the close-up's acting. Returns the winking eye's narrowing for drawWink.
export function drawExpression(g, view, res, t, u) {
  const fc = faceOf(res); if (!fc) return null;
  const W = res.W, H = res.H, s = view.s, L = fc.lines;
  const O = (x, y) => [view.ox + x * s, view.oy + y * s];
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
  // 2. the smirk
  drawSmirk(g, view, res, fc, u);
  // 3. both eyes heavy-lidded; the winking eye's upper lid is drawWink's once the eclipse starts
  const winking = lidAt(t) > 0;
  for (const side of ['R', 'L']) narrowEye(g, view, res, side, narrowAt(t, side), u, !(winking && side === WINK.side));
  return narrowAt(t, WINK.side);
}
