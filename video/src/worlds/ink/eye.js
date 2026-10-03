// eye.js: THE WINK. We draw the closing eyelid ourselves over the cel: the eclipse in miniature.
//
// Her right eye (frame left) is measured on the cel (cel.js labels inside the landmark eye zone): the iris circle (centre,
// radius from its full width), the eye opening's top and bottom profiles, the upper lash weight. The lid is the union of
//   the Moon: a disk 1.066 x the iris radius (the Moon's and the Sun's apparent sizes on 28 May 585 BC: 33.5' / 31.4'),
//             sliding down across the iris at a constant rate like a body in the sky, leaving the iris's lower, lighter
//             crescent visible, and
//   the lid:  the rest of the eyelid, lagging behind and closing the white of the eye.
// Skin above the combined edge, the heavy lash line along it. The last sliver of iris flares as Baily's beads and the
// diamond ring on the glitter (276.85-276.95), and the eye shuts exactly on the ting (276.95) with a small four-point
// sparkle, the last light in the film. Afterwards the closed lid line settles into a sly smile curve.

import { MAT, MATS, LINE } from './palette.js';

const ID = Object.fromEntries(MATS.map(m => [m.name, m.id]));
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const TAU = Math.PI * 2;

export function eyeGeom(res, side = 'R') {
  if (!res) return null;
  res._eye ||= {};
  if (side in res._eye) return res._eye[side];
  const z = res.eyes && res.eyes.find(e => e.side === side);
  let out = null;
  if (z) {
    const { W, H } = res, lab = res.lab, matOf = l => l ? ((l - 1) >> 1) + 1 : 0;
    const bx0 = Math.max(0, Math.floor((z.cx - z.rx * 1.3) * W)), bx1 = Math.min(W - 1, Math.ceil((z.cx + z.rx * 1.3) * W));
    const by0 = Math.max(0, Math.floor((z.cy - z.ry * 1.4) * H)), by1 = Math.min(H - 1, Math.ceil((z.cy + z.ry * 1.4) * H));
    let ix0 = 1e9, ix1 = -1, iy0 = 1e9, iy1 = -1, n = 0;
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (matOf(lab[y * W + x]) === ID.iris) { n++; ix0 = Math.min(ix0, x); ix1 = Math.max(ix1, x); iy0 = Math.min(iy0, y); iy1 = Math.max(iy1, y); }
    if (n > 20) {
      const r = (ix1 - ix0 + 1) / 2, cx = (ix0 + ix1 + 1) / 2, cy = Math.max(iy0 + r * .85, iy1 + 1 - r);
      // the opening: white + iris + the pupil/dark iris inside the iris box
      const top = new Map(), bot = new Map();
      for (let x = bx0; x <= bx1; x++) {
        let t0 = -1, b0 = -1;
        for (let y = by0; y <= by1; y++) {
          const m = matOf(lab[y * W + x]);
          const inIris = x >= ix0 && x <= ix1 && y >= iy0 && y <= iy1;
          if (m === ID.white || m === ID.iris || (inIris && m === ID.black)) { if (t0 < 0) t0 = y; b0 = y; }
        }
        if (t0 >= 0) { top.set(x, t0); bot.set(x, b0 + 1); }
      }
      const xs = [...top.keys()].sort((a, b) => a - b);
      if (xs.length > 6) {
        const ox0 = xs[0], ox1 = xs[xs.length - 1];
        const sm = (M, rad = 3) => { const o = new Map(); for (const x of xs) { let s = 0, c = 0; for (let k = -rad; k <= rad; k++) if (M.has(x + k)) { s += M.get(x + k); c++; } o.set(x, s / c); } return o; };
        const T = sm(top), B = sm(bot);
        // upper lash weight: dark run above the opening at the iris centre
        let lash = 0; const xc = Math.round(cx);
        if (T.has(xc)) for (let y = Math.round(T.get(xc)) - 1; y > by0 && matOf(lab[y * W + xc]) === ID.black; y--) lash++;
        out = { cx, cy, r, ox0, ox1, top: T, bot: B, lash: clamp(lash, 2, 9), xs };
      }
    }
  }
  res._eye[side] = out;
  return out;
}

// lid schedule from the wink progress k (0 open -> 1 shut on the ting)
function phases(k) {
  const kd = clamp(k / .9);                                   // the Moon disk: uniform motion, totality at k = .9
  const ks = Math.pow(clamp((k - .2) / .8), 1.35);            // the lid sheet lags, catches up at the close
  return { kd, ks };
}

export function drawWink(g, view, res, k, t, u, EV, side = 'R') {
  if (!res || k <= 0) return;
  const E = eyeGeom(res, side); if (!E) return;
  const s = view.s, X = x => view.ox + x * s, Y = y => view.oy + y * s;
  const { kd, ks } = phases(k);
  // smooth, interpolated opening profiles
  const xs0 = E.xs, x0 = xs0[0], x1 = xs0[xs0.length - 1];
  const prof = M => { const a = xs0.map(x => M.get(x)); const o = a.map((_, j) => { let sum = 0, c = 0; for (let q = -4; q <= 4; q++) { const v = a[j + q]; if (v != null) { const w = Math.exp(-q * q / 8); sum += v * w; c += w; } } return sum / c; }); return x => { const f = Math.max(0, Math.min(o.length - 1.001, x - x0)), i = Math.floor(f), r = f - i; return o[i] * (1 - r) + o[i + 1] * r; }; };
  const top = prof(E.top), bot = prof(E.bot);
  const Rm = E.r * 1.066;
  // the Moon's path: from first contact (tangent above the iris, a little to the upper right) to concentric (totality)
  const c0 = [E.cx + E.r * .55, top(E.cx) - Rm * .98], c1 = [E.cx, E.cy];
  const mc = [c0[0] + (c1[0] - c0[0]) * kd, c0[1] + (c1[1] - c0[1]) * kd];
  const shut = k >= 1;
  let settle = 0;
  if (shut && EV) settle = clamp(Math.floor((t - EV.ting) * 12) / 12 / .25);     // the lid line settles into a smile, on twos
  const xm = (x0 + x1) / 2, hw = (x1 - x0) / 2;
  const edgeOpen = x => {
    let e = top(x) + ks * (bot(x) - top(x));
    const dx = x - mc[0];
    if (Math.abs(dx) < Rm) e = Math.max(e, mc[1] + Math.sqrt(Rm * Rm - dx * dx));
    return Math.min(bot(x), Math.max(top(x), e));
  };
  // the closed lid: a clean curve between the eye corners, a soft sag (◡) settling into a sly smile curve (⌒)
  const yc0 = (top(x0) + bot(x0)) / 2, yc1 = (top(x1) + bot(x1)) / 2, ymid = bot(xm) - E.r * .15;
  const closedY = x => { const v = (x - xm) / hw, base = yc0 + (yc1 - yc0) * (x - x0) / (x1 - x0); const sag = (ymid - (yc0 + yc1) / 2) * (1 - 2 * settle) ; return base + (1 - v * v) * (sag - settle * E.r * .1); };
  // sample the edge finely and smooth it (the disk is analytic; the opening profiles carry pixel noise)
  const N = Math.max(8, Math.round((x1 - x0) * 2)), XS = [], EY = [];
  for (let j = 0; j <= N; j++) { const x = x0 + (x1 - x0) * j / N; XS.push(x); EY.push(shut ? closedY(x) : edgeOpen(x)); }
  const EYs = EY.map((_, j) => { let sum = 0, c = 0; for (let q = -3; q <= 3; q++) { const v = EY[j + q]; if (v != null) { const w = Math.exp(-q * q / 4); sum += v * w; c += w; } } return sum / c; });
  const lashTop = x => top(x) - E.lash - 2, M = 2.6;
  g.save();
  // 1. the lid: skin from above the old lash line down to the edge (when shut, down past the lower lid line)
  g.fillStyle = MAT.skin.base;
  g.beginPath();
  g.moveTo(X(x0 - M), Y(lashTop(x0)));
  for (let j = 0; j <= N; j++) g.lineTo(X(XS[j]), Y(lashTop(XS[j]) - 1.5));
  g.lineTo(X(x1 + M), Y(lashTop(x1)));
  const low = j => shut ? Math.max(EYs[j], bot(XS[j])) + M : EYs[j];
  g.lineTo(X(x1 + M), Y(low(N)));
  for (let j = N; j >= 0; j--) g.lineTo(X(XS[j]), Y(low(j)));
  g.lineTo(X(x0 - M), Y(low(0)));
  g.closePath(); g.fill();
  // 2. the lash line along the edge: one clean tapered stroke, heaviest toward the outer corner
  const wMax = Math.max((shut ? 4.6 : 5.6) * u, E.lash * s * (shut ? .85 : 1.1));
  const pts = XS.map((x, j) => [X(x), Y(EYs[j])]);
  const Lp = [], Rp = [];
  for (let j = 0; j <= N; j++) {
    const a = pts[Math.max(0, j - 1)], b = pts[Math.min(N, j + 1)], tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1;
    const v = j / N, toOuter = side === 'R' ? 1 - v : v;
    const w = wMax * (.18 + .82 * Math.pow(Math.sin(Math.PI * clamp(v * 1.04 - .02)), .5)) * (.72 + .4 * toOuter);
    Lp.push([pts[j][0] - ty / m * w / 2, pts[j][1] + tx / m * w / 2]); Rp.push([pts[j][0] + ty / m * w / 2, pts[j][1] - tx / m * w / 2]);
  }
  g.fillStyle = LINE; g.beginPath(); g.moveTo(Lp[0][0], Lp[0][1]); for (const p of Lp) g.lineTo(p[0], p[1]); for (let j = N; j >= 0; j--) g.lineTo(Rp[j][0], Rp[j][1]); g.closePath(); g.fill();
  if (shut) {   // two short lashes flicking off the outer corner
    g.strokeStyle = LINE; g.lineCap = 'round'; g.lineWidth = wMax * .42;
    const jo = side === 'R' ? 0 : N, ox = XS[jo], oy = EYs[jo], dir = side === 'R' ? -1 : 1;
    for (const [a, l] of [[-.42, 1.0], [.05, .78]]) { g.beginPath(); g.moveTo(X(ox + dir * .5), Y(oy)); g.lineTo(X(ox + dir * (.5 + E.r * .55 * l)), Y(oy + E.r * a * l)); g.stroke(); }
  }
  // 3. the last light: Baily's beads, then the diamond ring at the close, then a fading four-point sparkle
  const ring = EV ? (t - EV.ting) : (k - 1);
  const bead = !shut && kd > .78;
  if (bead || (shut && ring < .34)) {
    // the last visible point of the iris: its boundary farthest from the Moon's centre (the bottom limb)
    const ang = Math.atan2(E.cy - mc[1], E.cx - mc[0]) || Math.PI / 2;
    const bxp = shut ? E.cx : E.cx + Math.cos(ang) * E.r * .96, byp = shut ? closedY(E.cx) : E.cy + Math.sin(ang) * E.r * .96;
    // the sparkle pops on the ting, holds two drawings, shrinks away by +0.34 s (scale, never a fade: flat cel FX on twos)
    const rq = Math.floor(Math.max(0, ring) * 12) / 12;
    const pk = shut ? (rq < .17 ? 1 : Math.max(0, 1 - (rq - .17) / .17)) : clamp((kd - .78) / .22);
    const R = E.r * (shut ? 1.6 * pk * (1 + rq * .6) : .55 + .95 * pk) * s;
    const cxp = X(bxp), cyp = Y(byp);
    const ray = (a, len, wid) => { g.beginPath(); g.moveTo(cxp + Math.cos(a) * len, cyp + Math.sin(a) * len); g.lineTo(cxp + Math.cos(a + Math.PI / 2) * wid, cyp + Math.sin(a + Math.PI / 2) * wid); g.lineTo(cxp - Math.cos(a) * len, cyp - Math.sin(a) * len); g.lineTo(cxp - Math.cos(a + Math.PI / 2) * wid, cyp - Math.sin(a + Math.PI / 2) * wid); g.closePath(); g.fill(); };
    if (R < .5) { g.restore(); return; }
    g.fillStyle = MAT.orange.base;
    ray(-Math.PI / 2 + .2, R * 1.32 * (shut ? 1 : pk + .25), R * .2);
    ray(.2, R * .9 * (shut ? 1 : pk + .25), R * .17);
    g.fillStyle = '#fffaf0';
    ray(-Math.PI / 2 + .2, R * 1.2 * (shut ? 1 : pk + .25), R * .12);
    ray(.2, R * .8 * (shut ? 1 : pk + .25), R * .1);
    g.beginPath(); g.arc(cxp, cyp, R * (shut ? .2 : .26), 0, TAU); g.fill();
  }
  g.restore();
}
