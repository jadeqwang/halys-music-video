// arrows.js: the arrows hanging in the frozen sky (S45b, S46, S49), repainted as crisp stone. The plate's arrows are
// small, thin statue components above the horizon; the brushes alone smear them into comets. Each is found (an
// elongated connected component of the statue mask, in the sky band), measured (centroid, axis, length) and painted
// over the strokes as a carved arrow: a pale shaft lit from above with a darker underside, a leaf head, three
// fletching vanes. The head goes at the end where the plate is darker (bronze and iron read darker than the shaft).

import { clamp, hash3, blurFast } from '../brush/util.js';

export function findArrows(st, o = {}) {
  const { aw, ah } = st, N = aw * ah, M = st.M, out = [];
  if (!M) return out;
  const yMax = o.yMax ?? .75, lab = new Int32Array(N).fill(-1), minA = o.minArea ?? 6 * (aw / 960) ** 2, maxA = o.maxArea ?? .006 * N;
  let id = 0;
  for (let s = 0; s < N; s++) {
    if (lab[s] >= 0 || M[s] < .5) continue;
    const sy = (s / aw) | 0; if (sy > yMax * ah) continue;
    const stack = [s], pix = []; lab[s] = id; let touchesLand = false;
    while (stack.length) {
      const i = stack.pop(); pix.push(i); if (pix.length > maxA) break;
      const x = i % aw, y = (i / aw) | 0;
      if (st.hz && y >= st.hz[x] - 1) touchesLand = true;
      for (const j of [i - 1, i + 1, i - aw, i + aw]) { if (j < 0 || j >= N || lab[j] >= 0 || M[j] < .5) continue; if ((j === i - 1 && x === 0) || (j === i + 1 && x === aw - 1)) continue; lab[j] = id; stack.push(j); }
    }
    id++;
    if (pix.length < minA || pix.length > maxA || touchesLand) continue;
    let mx = 0, my = 0; for (const i of pix) { mx += i % aw; my += (i / aw) | 0; } mx /= pix.length; my /= pix.length;
    let sxx = 0, sxy = 0, syy = 0; for (const i of pix) { const dx = i % aw - mx, dy = ((i / aw) | 0) - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
    const tr = sxx + syy, det = Math.sqrt((sxx - syy) ** 2 + 4 * sxy * sxy), l1 = (tr + det) / 2, l2 = Math.max(1e-6, (tr - det) / 2);
    if (Math.sqrt(l1 / l2) < (o.minElong ?? 4)) { out.junk = out.junk || []; out.junk.push(pix); continue; }   // floating blur debris: painted out, not redrawn
    const ang = .5 * Math.atan2(2 * sxy, sxx - syy), ax = Math.cos(ang), ay = Math.sin(ang);
    let smin = 1e9, smax = -1e9; for (const i of pix) { const s2 = (i % aw - mx) * ax + (((i / aw) | 0) - my) * ay; if (s2 < smin) smin = s2; if (s2 > smax) smax = s2; }
    // which end is the head: darker plate luminance near that end
    let la = 0, na = 0, lb = 0, nb = 0;
    if (st.Lp) for (const i of pix) { const s2 = (i % aw - mx) * ax + (((i / aw) | 0) - my) * ay; if (s2 < smin + (smax - smin) * .2) { la += st.Lp[i]; na++; } else if (s2 > smax - (smax - smin) * .2) { lb += st.Lp[i]; nb++; } }
    const headPlus = na && nb ? lb / nb < la / na : ax > 0;
    out.push({ x: mx, y: my, ax, ay, len: smax - smin, c: (smax + smin) / 2, head: headPlus ? 1 : -1, n: pix.length, pix });
  }
  return out;
}

// the plate's own arrows out of the reference (they would paint as fat blurred rods under the crisp ones): each
// component, dilated, is filled from the sky around it and leaves the statue mask
export function paintOutArrows(st, arrows) {
  const { aw, ah } = st, N = aw * ah, mk = new Float32Array(N);
  for (const a of arrows) for (const i of a.pix) mk[i] = 1;
  if (arrows.junk) for (const pix of arrows.junk) for (const i of pix) mk[i] = 1;
  const md = blurFast(mk, aw, ah, 1.6), W = new Float32Array(N);
  for (let i = 0; i < N; i++) W[i] = md[i] > .03 ? 0 : 1;
  for (const ch of [st.R, st.G, st.B]) {
    const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = ch[i] * W[i];
    const num = blurFast(a, aw, ah, 4), den = blurFast(W, aw, ah, 4);
    for (let i = 0; i < N; i++) if (W[i] === 0) ch[i] = den[i] > 1e-3 ? num[i] / den[i] : ch[i];
  }
  for (let i = 0; i < N; i++) if (W[i] === 0) { if (st.M) st.M[i] = 0; if (st.matte && st.matte !== st.M) st.matte[i] = 0; }
  st.key += '|noArrows';
}

// the arrows as painted strokes (screen px); S = screen px per analysis px
export function arrowStrokes(arrows, S, u, o = {}) {
  const out = [], lit = o.lit || [.86, .86, .88], dark = o.dark || [.36, .37, .41], head = o.headCol || [.5, .51, .55], rim = o.rim || [.98, .7, .42];
  arrows.forEach((a, j) => {
    const L = a.len * S * 1.05, cx = (a.x + a.ax * a.c) * S, cy = (a.y + a.ay * a.c) * S, dx = a.ax * a.head, dy = a.ay * a.head, nx = -dy, ny = dx;
    const P = (s, q) => [cx + dx * s * L + nx * q, cy + dy * s * L + ny * q];
    const w = Math.max(1.1 * u, L * .012), k = 50 + j * .01, sd = q => hash3(j, q, 91);
    // the underside (dark) then the lit top of the shaft (the key comes from above: the top edge catches it)
    const up = ny < 0 ? 1 : -1;
    out.push({ pts: [P(-.5, 0), P(0, 0), P(.36, 0)], r: w, c0: dark, c1: dark, a: .95, thick: .3, seed: sd(1), key: k, layer: 13, taper: .05, maxSeg: 8 });
    out.push({ pts: [P(-.48, up * w * .45), P(0, up * w * .45), P(.35, up * w * .45)], r: w * .55, c0: lit, c1: lit, a: .95, thick: .5, seed: sd(2), key: k + .001, layer: 13, taper: .1, maxSeg: 8 });
    // the leaf head
    out.push({ pts: [P(.34, 0), P(.43, 0), P(.5, 0)], r: w * 2.1, c0: head, c1: dark, a: .97, thick: .55, seed: sd(3), key: k + .002, layer: 13, taper: .95, maxSeg: 6 });
    out.push({ pts: [P(.35, up * w * .7), P(.46, up * w * .4)], r: w * .6, c0: lit, c1: lit, a: .9, thick: .7, seed: sd(4), key: k + .003, layer: 13, taper: .8, maxSeg: 4 });
    // three fletching vanes swept back from the tail
    for (const q of [-1, 0, 1]) {
      const b0 = P(-.44, 0), b1 = P(-.5, q * w * 2.6);
      out.push({ pts: [P(-.36, q * w * .6), b0, b1], r: w * .9, c0: q === 0 ? lit : dark, c1: q === 0 ? lit : dark, a: .9, thick: .3, seed: sd(5 + q), key: k + .004 + q * .0001, layer: 13, taper: .6, maxSeg: 5 });
    }
    // a hair of warm horizon light along the underside
    if (o.rimK !== 0) out.push({ pts: [P(-.45, -up * w * .7), P(.3, -up * w * .7)], r: w * .35, c0: rim, c1: rim, a: .5 * (o.rimK ?? 1), thick: .2, seed: sd(9), key: k + .006, layer: 13, taper: .3, maxSeg: 6 });
  });
  return out;
}
