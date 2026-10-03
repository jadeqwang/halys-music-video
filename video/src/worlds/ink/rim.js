// rim.js: the monitors' rim light on her hair (S78). From behind the chair her black hair sits against the dark terminal
// and its silhouette line (ink on near-black) disappears; a cel animator separates the shapes with a thin rim highlight in
// the light's colour. We draw it along the cel's own silhouette, only where the inside is hair, the outside is the room,
// the edge faces the screens (outward normal pointing up or right) and it lies inside the head zone: one tapered pearl
// stroke per run, just inside the line.

const matOf = l => l ? ((l - 1) >> 1) + 1 : 0;
function inPolyN(P, u, v) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > v) !== (yj > v) && u < (xj - xi) * (v - yi) / (yj - yi) + xi) c = !c; }
  return c;
}

function ribbon(g, P, w, col) {
  const n = P.length; if (n < 2) return;
  const Lp = [], Rp = [];
  for (let j = 0; j < n; j++) {
    const a = P[Math.max(0, j - 1)], b = P[Math.min(n - 1, j + 1)], tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1;
    const v = j / (n - 1), k = Math.min(1, Math.sin(Math.PI * Math.min(.98, Math.max(.02, v))) * 1.8), hw = w * k / 2;
    Lp.push([P[j][0] - ty / m * hw, P[j][1] + tx / m * hw]); Rp.push([P[j][0] + ty / m * hw, P[j][1] - tx / m * hw]);
  }
  g.fillStyle = col; g.beginPath(); g.moveTo(Lp[0][0], Lp[0][1]); for (const p of Lp) g.lineTo(p[0], p[1]); for (let j = n - 1; j >= 0; j--) g.lineTo(Rp[j][0], Rp[j][1]); g.closePath(); g.fill();
}

// res: a cel analysis (cel.js); zone: {poly} setup-normalised; view: analysis px -> output px; u: output px per 1080p px
export function drawRim(g, view, res, zone, u, col = '#aeb6c8') {
  if (!res || !res.chains || !res.lab) return;
  const { W, H, lab } = res, X = p => [view.ox + p[0] * view.s, view.oy + p[1] * view.s];
  const at = (x, y) => { const xi = Math.round(x), yi = Math.round(y); return xi < 0 || yi < 0 || xi >= W || yi >= H ? 0 : lab[yi * W + xi]; };
  for (const c of res.chains) {
    if (c.kind !== 'sil') continue;
    let run = [];
    const flush = () => { if (run.length >= 10) ribbon(g, run.map(X), 2.3 * u, col); run = []; };
    for (let k = 0; k < c.pts.length; k++) {
      const p = c.pts[k], q = c.pts[Math.max(0, k - 2)], r = c.pts[Math.min(c.pts.length - 1, k + 2)];
      const tx = r[0] - q[0], ty = r[1] - q[1], m = Math.hypot(tx, ty) || 1, nx = -ty / m, ny = tx / m;
      const a = at(p[0] + nx * 2.5, p[1] + ny * 2.5), b = at(p[0] - nx * 2.5, p[1] - ny * 2.5);
      let ok = (!!a) !== (!!b);                                         // her on one side only: the silhouette
      const inx = a ? nx : -nx, iny = a ? ny : -ny, lin = a || b;      // the inward normal and the label inside
      ok = ok && matOf(lin) === 1 && (-inx > .25 || -iny < -.45) && inPolyN(zone.poly, p[0] / W, p[1] / H);
      if (ok) run.push([p[0] + inx * 1.1, p[1] + iny * 1.1]); else flush();
    }
    flush();
  }
}
