// face.js: the small face. In the wide shot her face is ~75 px tall on the plate and the eyes ~15 px wide: traced from the
// plate they come out as mush, and at that size an animator draws a simplified model-sheet face anyway. So when the
// landmarker sees her (MediaPipe on the plate, plate_meta.py) and the iris is small, we draw the features as clean vector
// shapes in output space, at the landmarks' positions: almond eyes with a heavy upper lash line and the outer flick, a
// two-tone brown iris with the pupil and catchlight (looking where the plate looks), brows, a nose tick, a flat
// deadpan mouth. Big faces (the close-up) keep the plate-traced features (cel.js), which are better there.

import { MAT, LINE } from './palette.js';

const TAU = Math.PI * 2;
const pts = (arr, W, H) => { const o = []; for (let i = 0; i + 1 < arr.length; i += 2) o.push([arr[i] * W, arr[i + 1] * H]); return o; };

export function smallFace(res, maxIris = 10) {
  if (!res || !res.inp || !res.inp.faces) return null;
  if (res._sf !== undefined) return res._sf;
  const fc = res.inp.faces[0], W = res.W, H = res.H;
  let out = null;
  if (fc && fc.src === 'mp' && fc.lines && fc.lines.irisR && fc.lines.irisL) {
    const L = fc.lines, ri = Math.max(L.irisR[2], L.irisL[2]) * W * 1.3;
    if (ri < maxIris && ri > 1.5) {
      const eye = side => {
        const ir = L[`iris${side}`], up = pts(L[`eye${side}_up`], W, H);
        const c = [ir[0] * W, ir[1] * H], a = up[0], b = up[up.length - 1];
        // widen the human-proportioned landmark eye to an anime eye, about the iris centre
        const k = 1.18, cxm = (a[0] + b[0]) / 2;
        const A = [cxm + (a[0] - cxm) * k, c[1] + ri * .1 + (a[1] - c[1]) * .3], B = [cxm + (b[0] - cxm) * k, c[1] + ri * .1 + (b[1] - c[1]) * .3];
        return { c, ri, A, B, side };
      };
      out = { R: eye('R'), L: eye('L'), browR: pts(L.browRu || L.browR, W, H), browL: pts(L.browLu || L.browL, W, H), browR2: pts(L.browR, W, H), browL2: pts(L.browL, W, H),
        nose: pts(L.nose, W, H), lipU: pts(L.lipI_up || L.lipO_up, W, H), lipL: pts(L.lipI_lo || L.lipO_lo, W, H), ri };
    }
  }
  res._sf = out;
  return out;
}

function stroke(g, P, w0, w1, col) {   // a tapered polyline ribbon from width w0 to w1
  const n = P.length; if (n < 2) return;
  const Lp = [], Rp = [];
  for (let j = 0; j < n; j++) {
    const a = P[Math.max(0, j - 1)], b = P[Math.min(n - 1, j + 1)], tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1;
    const v = j / (n - 1), w = (w0 + (w1 - w0) * v) * Math.min(1, Math.sin(Math.PI * Math.min(.98, Math.max(.02, v))) * 2.2);
    Lp.push([P[j][0] - ty / m * w / 2, P[j][1] + tx / m * w / 2]); Rp.push([P[j][0] + ty / m * w / 2, P[j][1] - tx / m * w / 2]);
  }
  g.fillStyle = col; g.beginPath(); g.moveTo(Lp[0][0], Lp[0][1]); for (const p of Lp) g.lineTo(p[0], p[1]); for (let j = n - 1; j >= 0; j--) g.lineTo(Rp[j][0], Rp[j][1]); g.closePath(); g.fill();
}
const quad = (a, c, b, n = 16) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; });

// draw the small face's features into g (output space) through view
export function drawSmallFace(g, view, res, u, opts = {}) {
  const F = smallFace(res); if (!F) return false;
  const s = view.s, X = p => [view.ox + p[0] * s, view.oy + p[1] * s];
  for (const E of [F.R, F.L]) {
    const c = X(E.c), ri = E.ri * s, A = X(E.A), B = X(E.B);
    const outer = E.side === 'R' ? A : B, inner = E.side === 'R' ? B : A, dir = E.side === 'R' ? -1 : 1;
    const upC = [c[0] - dir * ri * .1, c[1] - ri * 1.75], loC = [c[0], c[1] + ri * 1.35];
    const upper = quad(outer, upC, inner), lower = quad(inner, loC, outer);
    // white of the eye, then the iris clipped to it
    g.save();
    g.beginPath(); for (const p of upper) g.lineTo(p[0], p[1]); for (const p of lower) g.lineTo(p[0], p[1]); g.closePath();
    g.fillStyle = MAT.white.base; g.fill(); g.clip();
    g.fillStyle = MAT.iris.base; g.beginPath(); g.ellipse(c[0], c[1], ri, ri * 1.12, 0, 0, TAU); g.fill();
    g.fillStyle = MAT.iris.shadow; g.beginPath(); g.ellipse(c[0], c[1], ri, ri * 1.12, 0, Math.PI * 1.08, Math.PI * 1.92); g.lineTo(c[0] + ri, c[1] - ri * .05); g.lineTo(c[0] - ri, c[1] - ri * .05); g.closePath(); g.fill();
    g.fillStyle = '#24130b'; g.beginPath(); g.ellipse(c[0], c[1] + ri * .05, ri * .42, ri * .55, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(c[0] + dir * ri * .38, c[1] - ri * .42, ri * .28, 0, TAU); g.fill();
    g.fillStyle = '#c99a72'; g.beginPath(); g.arc(c[0] - dir * ri * .3, c[1] + ri * .52, ri * .14, 0, TAU); g.fill();
    g.restore();
    // heavy upper lash line with the outer flick; thin lower line on the outer half
    const lash = upper.map(p => p);
    stroke(g, E.side === 'R' ? lash : lash.slice().reverse(), ri * .62, ri * .3, LINE);
    stroke(g, [outer, [outer[0] + dir * ri * .45, outer[1] - ri * .32]], ri * .34, ri * .05, LINE);
    const lo = lower.slice(E.side === 'R' ? 7 : 0, E.side === 'R' ? 17 : 10);
    stroke(g, lo, ri * .16, ri * .16, '#3a2420');
  }
  // brows: tapered dark strokes along the landmark brow (mid-line of the upper and lower brow polylines)
  for (const [B1, B2, side] of [[F.browR, F.browR2, 'R'], [F.browL, F.browL2, 'L']]) {
    if (!B1.length) continue;
    const mid = B1.map((p, i) => { const q = B2[Math.min(B2.length - 1, i)] || p; return X([(p[0] * .6 + q[0] * .4), (p[1] * .6 + q[1] * .4)]); });
    stroke(g, side === 'R' ? mid : mid, F.ri * s * .38, F.ri * s * .2, '#1d1517');
  }
  // nose tick (colour trace) and the flat deadpan mouth
  if (F.nose.length) { const t = X(F.nose[F.nose.length - 1]); stroke(g, [[t[0] + F.ri * s * .1, t[1] - F.ri * s * .35], [t[0] - F.ri * s * .15, t[1] + F.ri * s * .05]], F.ri * s * .2, F.ri * s * .12, '#b97e6c'); }
  if (F.lipU.length && F.lipL.length) {
    const a = F.lipU[0], b = F.lipU[F.lipU.length - 1], mU = F.lipU[F.lipU.length >> 1], mL = F.lipL[F.lipL.length >> 1];
    const cy = (mU[1] + mL[1]) / 2, cx = (a[0] + b[0]) / 2, hw = (b[0] - a[0]) * .36, sm = opts.smile || 0;
    const P = quad([cx - hw, cy - sm * F.ri * .2], [cx, cy + sm * F.ri * .35], [cx + hw, cy - sm * F.ri * .2], 8).map(X);
    stroke(g, P, F.ri * s * .22, F.ri * s * .22, '#5a302c');
  }
  return true;
}
