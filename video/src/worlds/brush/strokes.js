// strokes.js: where the brushes go. Hertzmann-style coarse-to-fine painting toward the reference.
//
// For each brush (big to small) the reference is blurred to the brush's scale (never across the silhouette or the
// horizon); wherever a virtual canvas (CPU, analysis resolution) still differs from it by more than a threshold, a
// curved stroke starts and follows the flow field (tangent to edges, turn-limited so strokes stay brush-like), ending
// when it would paint the wrong colour. Focus regions lower the threshold so the small brushes work there; darkness
// raises it (thin, broad, quiet darks like Caravaggio's grounds); the two smallest brushes only work on structural
// edges in the light.
//
// TEMPORAL COHERENCE (12 drawings a second): stroke seeds live in MATERIAL space. Each brush layer has a grid of
// cells in material coordinates (layout px of the content at the shot's reference frame); a cell's jittered seed
// point is mapped to the screen through the source's material map (a camera transform for stills, optical flow
// composed over the shot for video plates, the turning vortex for the sky). So a stroke stays on its patch of helmet
// or cloud as it moves; only a small per-drawing jitter (`boil`) and the content itself change between drawings.
// Thresholds are dithered per cell (strokes appear one by one as the error grows, never all at once) and strokes
// are stacked in a stable per-cell order, so nothing strobes.

import { clamp, lerp, sstep, blur, blurFast, boxBlur, down, up, hash3, hash4, samp, hex01, rgb2lab, lab2rgb } from './util.js';
import { flowAt } from './fields.js';

// ---------------------------------------------------------------- edge-preserving smoothing (guided filter)
function guidedSmooth(R, G, B, Lg, w, h, r = 3, eps = .004) {
  const N = w * h, mI = boxBlur(Lg, w, h, r), II = new Float32Array(N);
  for (let i = 0; i < N; i++) II[i] = Lg[i] * Lg[i];
  const mII = boxBlur(II, w, h, r), out = [];
  const tmp = new Float32Array(N);
  for (const p of [R, G, B]) {
    for (let i = 0; i < N; i++) tmp[i] = Lg[i] * p[i];
    const mp = boxBlur(p, w, h, r), mIp = boxBlur(tmp, w, h, r);
    const A = new Float32Array(N), Bc = new Float32Array(N);
    for (let i = 0; i < N; i++) { const v = mII[i] - mI[i] * mI[i], c = mIp[i] - mI[i] * mp[i], a = c / (v + eps); A[i] = a; Bc[i] = mp[i] - a * mI[i]; }
    const mA = boxBlur(A, w, h, r), mB = boxBlur(Bc, w, h, r), o = new Float32Array(N);
    for (let i = 0; i < N; i++) o[i] = mA[i] * Lg[i] + mB[i];
    out.push(o);
  }
  return out;
}

// region-aware blur: colour never bleeds across the silhouette or the horizon (regions blurred separately). Large
// sigmas run at half / quarter resolution (normalised per region, so upsampling never mixes regions' colours).
function regionBlur(chs, regs, aw, ah, sig) {
  const N = aw * ah;
  if (sig < 1.2) return chs.map(ch => boxBlur(ch, aw, ah, 1));   // the finest brushes: a touch of blur on the smoothed reference
  const outs = chs.map(() => new Float32Array(N));
  if ((regs.length === 1 && regs[0].full) || sig < 2.5) { chs.forEach((ch, c) => blurFast(ch, aw, ah, sig, outs[c])); return outs; }
  const f = sig >= 6 ? 4 : sig >= 2.4 ? 2 : 1, dw = Math.ceil(aw / f), dh = Math.ceil(ah / f), sg = sig / f, DN = dw * dh;
  const t = new Float32Array(N), ratio = new Float32Array(DN);
  for (const w of regs) {
    const wd = f > 1 ? down(w, aw, ah, f) : w, den = blur(wd, dw, dh, sg);
    chs.forEach((ch, c) => {
      for (let i = 0; i < N; i++) t[i] = ch[i] * w[i];
      const td = f > 1 ? down(t, aw, ah, f) : t, num = blur(td, dw, dh, sg);
      for (let i = 0; i < DN; i++) ratio[i] = den[i] > 1e-4 ? num[i] / den[i] : -1;
      const full = f > 1 ? up(ratio, dw, dh, aw, ah, f) : ratio, o = outs[c];
      for (let i = 0; i < N; i++) { const wi = w[i]; if (wi > 0) { const v = full[i]; o[i] += wi * (v >= 0 ? v : ch[i]); } }
    });
  }
  return outs;
}

// ---------------------------------------------------------------- placement
// returns [{pts:[[x,y]...] (screen px), apts (analysis px), r (radius px), c0, c1 (rgb), a, thick, seed, key, layer}]
// mat: {mx, my} material coordinates (layout px) per analysis pixel, or null for identity (x * S, y * S)
export function placeStrokes(F, ref, cfg, drawIdx, mat, eyeMask, W) {
  const { aw, ah, N } = F, S = W / aw, TM = { prep: 0, blur: 0, err: 0, cells: 0, place: 0, paint: 0 }; let tq = performance.now();
  const lap = k => { const n = performance.now(); TM[k] += n - tq; tq = n; };
  const cR = new Float32Array(N), cG = new Float32Array(N), cB = new Float32Array(N), painted = new Uint8Array(N);
  const out = [], perLayer = [];
  const seed = cfg.seed | 0, bseed = seed * 131 + drawIdx * 7919 + 1;
  // regions: figure (matte), sky, land; a region id per pixel lets strokes stop at the boundary
  const fig = new Float32Array(N), skyR = new Float32Array(N), land = new Float32Array(N), rid = new Uint8Array(N);
  let anyFig = false, anySky = false; const wall = F.wall || null;
  for (let i = 0; i < N; i++) {
    fig[i] = F.M && cfg.matteRegion !== false ? sstep(.4, .6, F.M[i]) : 0; skyR[i] = ref.sky ? Math.min(1 - fig[i], sstep(.4, .6, ref.sky[i])) : 0;
    land[i] = Math.max(0, 1 - fig[i] - skyR[i]); rid[i] = (fig[i] > .5 ? 1 : skyR[i] > .5 ? 2 : 0) + (wall ? 4 * wall[i] : 0);
    if (fig[i] > 0) anyFig = true; if (skyR[i] > 0) anySky = true;
  }
  const regs = anyFig || anySky ? [fig, skyR, land].filter((w, k) => k === 2 || (k === 0 ? anyFig : anySky)) : [Object.assign(land, { full: true })];
  // structural edges (strong, coherent) gate the small brushes: texture (pores, hair, grass) is not drawn stroke by stroke
  const eS = new Float32Array(N); for (let i = 0; i < N; i++) eS[i] = F.edge[i] * F.coh[i] * F.coh[i];
  const eImp = blur(eS, aw, ah, 1.4); let em = 1e-6; for (let i = 0; i < N; i++) if (eImp[i] > em) em = eImp[i];
  for (let i = 0; i < N; i++) eImp[i] = Math.min(1, eImp[i] / (em * .35));
  const smoothRef = cfg.smoothRef ? guidedSmooth(ref.R, ref.G, ref.B, ref.L, aw, ah) : [ref.R, ref.G, ref.B];
  lap('prep');
  // material coordinates and their bounding box
  const MX = mat ? mat.mx : null, MY = mat ? mat.my : null;
  let mx0 = 0, my0 = 0, mx1 = W, my1 = ah * S;
  if (MX) { mx0 = 1e9; my0 = 1e9; mx1 = -1e9; my1 = -1e9; for (let i = 0; i < N; i += 3) { const a = MX[i], b = MY[i]; if (a < mx0) mx0 = a; if (a > mx1) mx1 = a; if (b < my0) my0 = b; if (b > my1) my1 = b; } }
  const scale = cfg.strokeScale ?? 1, detail = cfg.detailField || null;
  const D = new Float32Array(N), I = new Float64Array((aw + 1) * (ah + 1));
  const nL = cfg.brushes.length;
  for (let li = 0; li < nL; li++) {
    const Rs = cfg.brushes[li] * scale, Ra = Rs / S, sig = Math.max(.6, cfg.fs * Ra * 1.6);
    const src = li >= 2 ? smoothRef : [ref.R, ref.G, ref.B];
    lap('place'); const [rb, gb, bb] = regionBlur(src, regs, aw, ah, sig); lap('blur');
    for (let i = 0; i < N; i++) {
      if (!painted[i]) { D[i] = 9; continue; }
      const dr = cR[i] - rb[i], dg = cG[i] - gb[i], db = cB[i] - bb[i]; D[i] = Math.sqrt(dr * dr + dg * dg + db * db);
    }
    // integral image of the error for O(1) box means
    for (let y = 0; y < ah; y++) { let row = 0; for (let x = 0; x < aw; x++) { row += D[y * aw + x]; I[(y + 1) * (aw + 1) + x + 1] = I[y * (aw + 1) + x + 1] + row; } }
    const boxMean = (x0, y0, x1, y1) => { x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(aw - 1, x1); y1 = Math.min(ah - 1, y1); if (x1 < x0 || y1 < y0) return 0;
      const A = I[y0 * (aw + 1) + x0], Bq = I[y0 * (aw + 1) + x1 + 1], C = I[(y1 + 1) * (aw + 1) + x0], Dq = I[(y1 + 1) * (aw + 1) + x1 + 1]; return (Dq - Bq - C + A) / ((x1 - x0 + 1) * (y1 - y0 + 1)); };
    lap('err');
    const gL = Math.max(S, cfg.fg[li] * Rs), gA = gL / S, J = Rs >= 12 ? F.Jc : F.J;
    const T0 = cfg.T[li], layer = [];
    // material cells: the screen pixel whose material coordinate is nearest each cell's jittered seed point
    const cx0 = Math.floor(mx0 / gL) - 1, cy0 = Math.floor(my0 / gL) - 1, cw = Math.floor(mx1 / gL) - cx0 + 2, ch = Math.floor(my1 / gL) - cy0 + 2;
    const nC = cw * ch, bestD = new Float32Array(nC).fill(1e9), bestP = new Int32Array(nC).fill(-1);
    const seedPt = (cx, cy, o) => {
      const jx = (hash4(cx, cy, li, seed) - .5) * cfg.jitter + (hash4(cx, cy, li, bseed) - .5) * cfg.boil * 2;
      const jy = (hash4(cy, cx, li, seed + 3) - .5) * cfg.jitter + (hash4(cy, cx, li, bseed + 3) - .5) * cfg.boil * 2;
      o[0] = (cx + .5 + jx * .5) * gL; o[1] = (cy + .5 + jy * .5) * gL; return o;
    };
    const sp = [0, 0];
    if (!MX || gA < 3) {
      // identity material map (or a fine brush): each cell's seed point is directly a screen point; with a material map
      // the per-cell randomness is hashed from the material cell under the point instead (cheap, still content-stable)
      if (!MX) for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
        seedPt(cx + cx0, cy + cy0, sp);
        const x = Math.round(sp[0] / S), y = Math.round(sp[1] / S);
        if (x < 0 || y < 0 || x >= aw || y >= ah) continue;
        bestP[cy * cw + cx] = y * aw + x; bestD[cy * cw + cx] = 0;
      }
      else {
        // screen cells of the same size; the cell id is the material cell under the cell centre
        for (let sy = 0; sy * gA < ah; sy++) for (let sx = 0; sx * gA < aw; sx++) {
          const x0 = Math.min(aw - 1, Math.round((sx + .5) * gA)), y0 = Math.min(ah - 1, Math.round((sy + .5) * gA)), i0 = y0 * aw + x0;
          const mcx = Math.floor(MX[i0] / gL), mcy = Math.floor(MY[i0] / gL), ci = (mcy - cy0) * cw + (mcx - cx0);
          if (ci < 0 || ci >= nC || bestP[ci] >= 0) continue;
          seedPt(mcx, mcy, sp);
          const jx = Math.round(x0 + (sp[0] - (mcx + .5) * gL) / S), jy = Math.round(y0 + (sp[1] - (mcy + .5) * gL) / S);
          bestP[ci] = clamp(jy, 0, ah - 1) * aw + clamp(jx, 0, aw - 1); bestD[ci] = 0;
        }
      }
    } else {
      const step = Math.max(1, Math.floor(gA / 3));
      for (let y = 0; y < ah; y += step) for (let x = 0; x < aw; x += step) {
        const i = y * aw + x, mxv = MX[i], myv = MY[i], cx = Math.floor(mxv / gL), cy = Math.floor(myv / gL);
        const ci = (cy - cy0) * cw + (cx - cx0); if (ci < 0 || ci >= nC) continue;
        seedPt(cx, cy, sp);
        const dd = (mxv - sp[0]) * (mxv - sp[0]) + (myv - sp[1]) * (myv - sp[1]);
        if (dd < bestD[ci]) { bestD[ci] = dd; bestP[ci] = i; }
      }
    }
    lap('cells');
    const hb = Math.max(0, Math.round(gA / 2));
    for (let ci = 0; ci < nC; ci++) {
      const pi = bestP[ci]; if (pi < 0) continue;
      // a cell whose nearest pixel is far from its seed point is not really on screen (left the frame, occluded)
      if (MX && gA >= 3 && bestD[ci] > gL * gL * 1.5) continue;
      const cx = (ci % cw) + cx0, cy = Math.floor(ci / cw) + cy0;
      const gx = pi % aw, gy = (pi / aw) | 0;
      const f = ref.focus[pi] + (detail ? detail[pi] : 0), p = ref.pool[pi], ey = eyeMask ? eyeMask[pi] : 0;
      const dither = .72 + .56 * hash4(cx, cy, li, seed + 23);
      const T = T0 * (1 - cfg.focusGain * Math.min(1, f)) * lerp(cfg.darkRaise, 1, p) * dither;
      if (li > 0 && boxMean(gx - hb, gy - hb, gx + hb, gy + hb) <= T) continue;
      if (li === nL - 2 && Math.max(p * .45, eImp[pi] * Math.max(p, f)) < cfg.midGate) continue;
      if (li === nL - 1 && (eImp[pi] * Math.max(p, Math.min(1, f)) < cfg.fineGate * (1 - .45 * Math.min(1, f)) || ey > .3)) continue;
      layer.push(makeStroke(F, J, gx, gy, Ra, Rs, rb, gb, bb, cR, cG, cB, painted, cfg, li, nL, rid, hash4(cx, cy, li, seed + 11), cx, cy, seed, bseed, p, S));
    }
    lap('place');
    // coverage: the first layer must leave no holes (occlusions in a flow-advected material map can leave a few)
    if (li === 0) {
      // the first layer is painted in placement order (cells, then hole fills); `own` keeps which stroke painted each
      // canvas pixel last, so the GPU's order can honour what this canvas saw (orderFirstLayer)
      const own = ownBuffer(N), tr = { own, j: 0 };
      layer.forEach((s, j) => { tr.j = j; paintVirtual(s, F, cR, cG, cB, painted, S, tr); });
      const g0 = Math.max(2, Math.round(gA * .8));
      for (let y = 0; y < ah; y += g0) for (let x = 0; x < aw; x += g0) {
        let hole = -1;
        for (let yy = y; yy < Math.min(ah, y + g0) && hole < 0; yy++) for (let xx = x; xx < Math.min(aw, x + g0); xx++) if (!painted[yy * aw + xx]) { hole = yy * aw + xx; break; }
        if (hole < 0) continue;
        const hx = hole % aw, hy = (hole / aw) | 0, kx = Math.floor(x / g0) + 100000, ky = Math.floor(y / g0) + 100000;
        const s = makeStroke(F, J, hx, hy, Ra, Rs, rb, gb, bb, cR, cG, cB, painted, cfg, li, nL, rid, hash4(kx, ky, li, seed + 11), kx, ky, seed, bseed, ref.pool[hole], S);
        tr.j = layer.length; paintVirtual(s, F, cR, cG, cB, painted, S, tr); layer.push(s);
      }
      out.l0conflicts = orderFirstLayer(layer, F, cR, cG, cB, painted, S, own, cfg.orderTol ?? .15);
    } else {
      layer.sort((a, b) => a.key - b.key);
      for (const s of layer) paintVirtual(s, F, cR, cG, cB, painted, S);
    }
    lap('paint');
    for (const s of layer) out.push(s);
    perLayer.push(layer.length);
  }
  out.tm = Object.fromEntries(Object.entries(TM).map(([k, v]) => [k, Math.round(v)]));
  out.perLayer = perLayer;
  out.canvas = { cR, cG, cB };
  return out;
}

function makeStroke(F, J, sx, sy, Ra, Rs, rb, gb, bb, cR, cG, cB, painted, cfg, li, nL, rid, h, cx, cy, seed, bseed, p, S) {
  const st = traceStroke(F, J, sx, sy, Ra, rb, gb, bb, cR, cG, cB, painted, cfg, li, h, rid);
  const k = hash4(cx, cy, li, seed + 5), kb = hash4(cx, cy, li, bseed + 5) - .5;
  const cj = ((k - .5) * 2 + kb * cfg.boilColor) * cfg.colorJit, hj = (hash4(cx, cy, li, seed + 9) - .5) * cfg.colorJit;
  // broken colour: each stroke a slightly different mixture (value and a hint of temperature), decisive, little smear
  const c0 = [clamp(st.c[0] * (1 + cj + hj * .5)), clamp(st.c[1] * (1 + cj)), clamp(st.c[2] * (1 + cj - hj * .6))];
  const e = st.pts[st.pts.length - 1];
  const c1e = [samp(F, rb, e[0], e[1]), samp(F, gb, e[0], e[1]), samp(F, bb, e[0], e[1])];
  const lum = .2126 * c0[0] + .7152 * c0[1] + .0722 * c0[2];
  // paint body: thin in the darks, loaded in the lights, lead white piles up (impasto) inside the pool
  const thick = (lerp(cfg.thinDark, cfg.thick, sstep(.12, .55, lum)) * lerp(.45, 1, p) + cfg.thickHi * sstep(.55, .88, lum) * p) * lerp(1.1, .8, li / Math.max(1, nL - 1));
  const eb = cfg.endBlend;
  // water / open ground (groundFlow): long, narrower horizontal flicks rather than round dabs
  const gwk = F.gw ? F.gw[Math.round(sy) * F.aw + Math.round(sx)] || 0 : 0;
  const rr = Rs * (.9 + .2 * hash4(cx, cy, li, seed + 13)) * (li === 0 && st.pts.length <= 2 ? 1.45 : 1) * (1 - .38 * sstep(.3, .7, gwk));
  return { pts: st.pts.map(([x, y]) => [x * S, y * S]), apts: st.pts, ra: Ra, r: rr, c0, c1: [lerp(c0[0], c1e[0], eb), lerp(c0[1], c1e[1], eb), lerp(c0[2], c1e[2], eb)],
    a: .96 + .04 * k, thick: Math.min(.95, thick), seed: hash4(cx, cy, li, seed + 17), key: hash4(cx, cy, li, seed + 29), layer: li };
}

function traceStroke(F, J, x0, y0, Ra, rb, gb, bb, cR, cG, cB, painted, cfg, li, h, rid) {
  const aw = F.aw, c = [samp(F, rb, x0, y0), samp(F, gb, x0, y0), samp(F, bb, x0, y0)];
  const pts = [[x0, y0]], v = [0, 0, 0], r0 = rid[Math.round(y0) * aw + Math.round(x0)];
  let x = x0, y = y0, ldx = 0, ldy = 0;
  let maxL = cfg.maxLen[li], minL = cfg.minLen[li];
  const step = Ra * cfg.step[li] * 1.6, cT = Math.cos(cfg.maxTurn), sT = Math.sin(cfg.maxTurn);
  if (F.gw) { const gw = F.gw[Math.round(y0) * aw + Math.round(x0)]; if (gw > .35) { minL = Math.max(minL, 3); maxL = maxL + 3; } }   // flicks across water
  for (let k = 1; k <= maxL; k++) {
    if (k > minL) {
      const xi = Math.round(x), yi = Math.round(y), i = yi * aw + xi;
      const r = rb[i], g = gb[i], b = bb[i];
      const dS = Math.hypot(r - c[0], g - c[1], b - c[2]);
      const dC = painted[i] ? Math.hypot(r - cR[i], g - cG[i], b - cB[i]) : 9;
      if (dC < dS) break;
    }
    flowAt(F, x, y, v, J);
    let dx = v[0], dy = v[1];
    if (k === 1) { if (h < .5) { dx = -dx; dy = -dy; } }
    else {
      if (dx * ldx + dy * ldy < 0) { dx = -dx; dy = -dy; }
      dx = cfg.fc * dx + (1 - cfg.fc) * ldx; dy = cfg.fc * dy + (1 - cfg.fc) * ldy;
      const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
      const cs = dx * ldx + dy * ldy;                                          // turn limit: a brush cannot hook back
      if (cs < cT) { const sg = (ldx * dy - ldy * dx) >= 0 ? 1 : -1; dx = ldx * cT - ldy * sT * sg; dy = ldy * cT + ldx * sT * sg; }
    }
    const nx2 = x + dx * step, ny2 = y + dy * step;
    if (nx2 < 0 || ny2 < 0 || nx2 > F.aw - 1 || ny2 > F.ah - 1) break;
    if (rid[Math.round(ny2) * aw + Math.round(nx2)] !== r0) break;           // never cross the silhouette or the horizon
    x = nx2; y = ny2; ldx = dx; ldy = dy; pts.push([x, y]);
  }
  if (pts.length === 1) { flowAt(F, x0, y0, v, J); pts.push([x0 + v[0] * step * .6, y0 + v[1] * step * .6]); }   // a dab
  return { pts, c };
}

// THE FIRST LAYER'S ORDER ON THE GPU. The GPU draws a layer by key (stable per cell, overlaps at random); the later
// layers sort before they paint the CPU canvas, so the canvas sees what the GPU draws. The first layer cannot sort first
// (its hole fills depend on what the cells left unpainted), so the canvas saw it in placement order: where two strokes
// of different colours overlap, the GPU could put the other one on top (a sky stroke dragged across a thin dark band
// under a bright sky came out as cream scraps that no later layer covered, since the canvas never showed them). So the
// GPU keeps the key order except where it would contradict the canvas: a stroke is drawn after every stroke it hides
// on the canvas by more than `tol` (RGB, cfg.orderTol, default .15: a difference that reads as a scrap; overlaps of
// near-equal colours keep their order). The smallest-key topological order: with no such overlap it is the key order
// exactly; otherwise only the strokes involved move. Returns the number of constraints. (Not fixable by order: where
// the canvas's capsule footprint is wider than the GPU's ribbon, at a stroke's head, the paint under it can show.)
let OWN = null;
function ownBuffer(N) { if (!OWN || OWN.length < N) OWN = new Int32Array(N); OWN.fill(-1, 0, N); return OWN; }
function orderFirstLayer(layer, F, cR, cG, cB, painted, S, own, tol) {
  const n = layer.length, nin = new Int32Array(n), succ = new Array(n), mark = new Int32Array(n).fill(-1);
  let ne = 0;
  const tr = { own, mark, j: 0, measure: true, tol2: tol * tol, hit: w => { mark[w] = tr.j; (succ[tr.j] || (succ[tr.j] = [])).push(w); nin[w]++; ne++; } };
  for (let j = 0; j < n; j++) { tr.j = j; paintVirtual(layer[j], F, cR, cG, cB, painted, S, tr); }
  if (!ne) { layer.sort((a, b) => a.key - b.key); return 0; }
  // Kahn's algorithm with a binary min-heap on (key, placement index)
  const less = (a, b) => layer[a].key < layer[b].key || (layer[a].key === layer[b].key && a < b);
  const heap = [], push = v => { heap.push(v); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (!less(heap[i], heap[p])) break; [heap[i], heap[p]] = [heap[p], heap[i]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && less(heap[l], heap[m])) m = l; if (r < heap.length && less(heap[r], heap[m])) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
  for (let j = 0; j < n; j++) if (!nin[j]) push(j);
  const order = [];
  while (heap.length) { const j = pop(); order.push(layer[j]); for (const w of succ[j] || []) if (--nin[w] === 0) push(w); }
  for (let j = 0; j < n; j++) layer[j] = order[j];
  return ne;
}

// rasterise a stroke (capsules along its polyline) into the CPU canvas at analysis res: per row, the capsule's
// x-interval is found analytically (two end disks and the swept rectangle), so only covered pixels are touched
const profile = (u, taper) => (.55 + .45 * sstep(0, .16, u)) * (1 - taper * sstep(.5, 1, u));
// tr (optional): {own, j} records stroke j as the last painter of each pixel; {own, mark, j, measure, tol2, hit} paints
// nothing and calls hit(o) once for each stroke o (mark[o] !== j) that the canvas shows over stroke j where their colours
// differ by more than tol
export function paintVirtual(s, F, cR, cG, cB, painted, S, tr = null) {
  const aw = F.aw, ah = F.ah, P = s.apts || s.pts.map(([x, y]) => [x / S, y / S]), n = P.length, taper = s.taper ?? .72;
  const c0 = s.c0, c1 = s.c1, own = tr && tr.own, mark = tr && tr.mark, tj = tr ? tr.j : 0, meas = !!(tr && tr.measure), tol2 = tr ? tr.tol2 : 0;
  for (let k = 0; k < n - 1; k++) {
    const ax = P[k][0], ay = P[k][1], bx = P[k + 1][0], by = P[k + 1][1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-6, L = Math.sqrt(L2);
    const t0 = k / (n - 1), t1 = (k + 1) / (n - 1), nx = -dy / L, ny = dx / L;
    // the segment's radius: the ribbon's width at the segment's middle (the GPU footprint, approximately)
    const r = s.r / S * Math.max(.35, profile((t0 + t1) / 2, taper)), r2 = r * r;
    const y0 = Math.max(0, Math.ceil(Math.min(ay, by) - r)), y1 = Math.min(ah - 1, Math.floor(Math.max(ay, by) + r));
    // the swept rectangle's corners
    const qx = [ax + nx * r, bx + nx * r, bx - nx * r, ax - nx * r], qy = [ay + ny * r, by + ny * r, by - ny * r, ay - ny * r];
    for (let y = y0; y <= y1; y++) {
      let lo = 1e9, hi = -1e9;
      let d = y - ay; if (d * d <= r2) { const w = Math.sqrt(r2 - d * d); lo = Math.min(lo, ax - w); hi = Math.max(hi, ax + w); }
      d = y - by; if (d * d <= r2) { const w = Math.sqrt(r2 - d * d); lo = Math.min(lo, bx - w); hi = Math.max(hi, bx + w); }
      for (let e = 0; e < 4; e++) {
        const e2 = (e + 1) & 3, ya = qy[e], yb = qy[e2];
        if ((ya <= y && yb >= y) || (yb <= y && ya >= y)) {
          const xx = Math.abs(yb - ya) < 1e-9 ? qx[e] : qx[e] + (qx[e2] - qx[e]) * (y - ya) / (yb - ya);
          if (xx < lo) lo = xx; if (xx > hi) hi = xx;
          if (Math.abs(yb - ya) < 1e-9) { if (qx[e2] < lo) lo = qx[e2]; if (qx[e2] > hi) hi = qx[e2]; }
        }
      }
      if (hi < lo) continue;
      const xa = Math.max(0, Math.ceil(lo)), xb = Math.min(aw - 1, Math.floor(hi)), o = y * aw;
      if (!tr) for (let x = xa; x <= xb; x++) {
        let t = ((x - ax) * dx + (y - ay) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const u = t0 + (t1 - t0) * t, i = o + x;
        cR[i] = c0[0] + (c1[0] - c0[0]) * u; cG[i] = c0[1] + (c1[1] - c0[1]) * u; cB[i] = c0[2] + (c1[2] - c0[2]) * u; painted[i] = 1;
      }
      else for (let x = xa; x <= xb; x++) {
        let t = ((x - ax) * dx + (y - ay) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const u = t0 + (t1 - t0) * t, i = o + x, r = c0[0] + (c1[0] - c0[0]) * u, g = c0[1] + (c1[1] - c0[1]) * u, b = c0[2] + (c1[2] - c0[2]) * u;
        if (!meas) { cR[i] = r; cG[i] = g; cB[i] = b; painted[i] = 1; own[i] = tj; continue; }
        const w = own[i];
        if (w !== tj && w >= 0 && mark[w] !== tj) { const er = r - cR[i], eg = g - cG[i], eb = b - cB[i]; if (er * er + eg * eg + eb * eb > tol2) tr.hit(w); }
      }
    }
  }
}

// ---------------------------------------------------------------- accents: impasto on the hottest lights
// thick dabs of lead white / Naples on specular peaks inside the light (bronze rims, crests, blade and spear edges)
// and on the water's sparkle, so the highlights physically stand up off the canvas. Positions are content-anchored
// (local maxima), so they move with the plate; only a tiny jitter changes per drawing.
export function accents(F, ref, cfg, drawIdx, P, W) {
  const { aw, ah } = F, S = W / aw, out = [], v = [0, 0, 0];
  const Lb = blur(F.L, aw, ah, 3), seed = cfg.seed * 17 + 5;
  const lead = P.tube('leadWhite') || [.94, .9, .82], naples = P.tube('naples') || lead;
  const T = cfg.accentThick, A = cfg.accents;
  const push = (x, y, dx, dy, len, r, c, thick, h) => {
    const a0 = [x - dx * len * .5, y - dy * len * .5], a1 = [x + dx * len * .5, y + dy * len * .5];
    out.push({ pts: [[a0[0] * S, a0[1] * S], [a1[0] * S, a1[1] * S]], apts: [a0, a1], ra: 1, r: r * (W / 1920), c0: c, c1: lead, a: .98, thick, seed: h, key: h, layer: 9 });
  };
  for (let y = 3; y < ah - 3; y += 2) for (let x = 3; x < aw - 3; x += 2) {
    const i = y * aw + x, p = ref.pool[i];
    if (ref.sky && ref.sky[i] > .2) continue;
    const L = F.L[i], lc = L - Lb[i], h = hash3(x, y, seed), hb = hash4(x, y, seed, drawIdx * 7919 + 3);
    const warm = F.R[i] - F.B[i] > .12;
    if (p > .4 && L > .62 && lc > .045) {
      let isMax = true;
      for (let j = -2; j <= 2 && isMax; j++) for (let k = -2; k <= 2; k++) if (F.L[i + j * aw + k] > L) { isMax = false; break; }
      if (isMax && h < .7 * A) {
        flowAt(F, x, y, v, F.J);
        const ang = (hb - .5) * .4, ca = Math.cos(ang), sa = Math.sin(ang);
        push(x + (hb - .5) * .6, y + (hash4(x, y, seed + 1, drawIdx) - .5) * .6, v[0] * ca - v[1] * sa, v[0] * sa + v[1] * ca,
          (1.3 + 2.2 * h) * (1 + lc * 3), (1.5 + 1.7 * h) * (.8 + p * .4), warm ? naples : lead, T * (.8 + .4 * p), hash3(x, y, seed + 2));
        continue;
      }
    }
    if (p > .45 && L > .7 && F.edge[i] > .22 && h < .22 * A) {
      flowAt(F, x, y, v, F.J);
      push(x, y, v[0], v[1], 2.5 + 3 * h, 1.3 + 1.1 * h, warm ? naples : lead, T * .9, hash3(x, y, seed + 4));
      continue;
    }
    if (p < .6 && L > .78 && lc > .07 && ref.L[i] > .3 && F.mag[i] / (8 * Math.max(lc, 1e-3)) < .6 && h < .35 * A) {
      if (ref.pool[i] > .3 || (ref.fig && ref.fig[i] > .3)) push(x, y, 1, 0, .6, 1.2 + h, lead, T * .8, hash3(x, y, seed + 6));
    }
  }
  return out;
}

// ---------------------------------------------------------------- eyes, painted with a few deliberate strokes
// upper lid, iris (the most chromatic third of the plate's iris, intensified), pupil, loaded catchlight. Anchored on
// the catchlight near each detected eye (faces with score >= faceMin) or cfg.eyes [{x, y, w}] (uv).
export function eyeGeometry(F, cfg) {
  const out = [];
  for (const f of F.faces || []) if (cfg.faceMin != null && (f.score ?? 1) >= cfg.faceMin && f.eyes && f.eyes.length >= 2) {
    const e1 = [f.eyes[0][0] * F.aw, f.eyes[0][1] * F.ah], e2 = [f.eyes[1][0] * F.aw, f.eyes[1][1] * F.ah];
    const d = Math.hypot(e2[0] - e1[0], e2[1] - e1[1]); if (d < 3) continue;
    const dir = [(e2[0] - e1[0]) / d, (e2[1] - e1[1]) / d];
    for (const e of [e1, e2]) out.push({ x: e[0], y: e[1], w: d * .42, dir });
  }
  for (const e of cfg.eyes || []) out.push({ x: e.x * F.aw, y: e.y * F.ah, w: e.w * F.aw, dir: e.dir || [1, 0] });
  return out;
}
export function eyeMaskOf(F, eyes) {
  if (!eyes.length) return null;
  const m = new Float32Array(F.N);
  for (const e of eyes) {
    const r = e.w * .62;
    for (let y = Math.max(0, Math.floor(e.y - r)); y <= Math.min(F.ah - 1, e.y + r); y++) for (let x = Math.max(0, Math.floor(e.x - r)); x <= Math.min(F.aw - 1, e.x + r); x++) {
      const dd = Math.hypot((x - e.x) / r, (y - e.y) / (r * .7)); m[y * F.aw + x] = Math.max(m[y * F.aw + x], 1 - sstep(.75, 1, dd));
    }
  }
  return m;
}
export function eyeStrokes(F, cfg, eyes, drawIdx, P, W) {
  const S = W / F.aw, out = [], bs = drawIdx * 7919;
  // a local 5x5 box mean of the luminance (only near the eyes): the catchlight is a peak above it
  const LpAt = (x, y) => { let s2 = 0, n = 0; for (let j = -2; j <= 2; j++) for (let q = -2; q <= 2; q++) { const yy = Math.min(F.ah - 1, Math.max(0, y + j)), xx = Math.min(F.aw - 1, Math.max(0, x + q)); s2 += F.L[yy * F.aw + xx]; n++; } return s2 / n; };
  const Lp = { get: LpAt };
  const lead = P.tube('leadWhite'), umber = P.tube('rawUmber'), burnt = P.tube('burntUmber'), black = P.tube('boneBlack');
  if (!lead || !umber || !black) return out;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const add = (pts, r, c0, c1, thick, a = .97, sd = .5) => out.push({ pts: pts.map(([x, y]) => [x * S, y * S]), apts: pts, ra: r / S, r, c0, c1: c1 || c0, a, thick, seed: sd, key: sd, layer: 10 });
  const lab = [0, 0, 0], rgb = [0, 0, 0];
  eyes.forEach((e, k) => {
    const w = e.w, dir = e.dir, up0 = [dir[1], -dir[0]], up = up0[1] < 0 ? up0 : [-up0[0], -up0[1]];
    let cx = -1, cy = -1, best = .04;
    for (let y = Math.max(2, Math.round(e.y - w * .75)); y <= Math.min(F.ah - 3, e.y + w * .45); y++) for (let x = Math.max(2, Math.round(e.x - w * .6)); x <= Math.min(F.aw - 3, e.x + w * .6); x++) {
      const i = y * F.aw + x, pk = F.L[i] - Lp.get(x, y);
      if (F.L[i] > .42 && pk > best) { best = pk; cx = x; cy = y; }
    }
    if (cx < 0) return;
    const ri = w * .17, ix = cx - up[0] * ri * .25, iy = cy - up[1] * ri * .25;
    const cand = [];
    for (let y = Math.round(iy - ri); y <= iy + ri; y++) for (let x = Math.round(ix - ri); x <= ix + ri; x++) {
      const d = Math.hypot(x - ix, y - iy) / ri, i = clamp(y, 0, F.ah - 1) * F.aw + clamp(x, 0, F.aw - 1);
      if (d < .25 || d > .9 || F.L[i] > .7) continue;
      rgb2lab(F.R[i], F.G[i], F.B[i], lab); cand.push([Math.hypot(lab[1], lab[2]), lab[0], lab[1], lab[2]]);
    }
    if (cand.length < 4) return;
    cand.sort((a, b) => b[0] - a[0]);
    let L0 = 0, a0 = 0, b0 = 0; const nTop = Math.max(2, Math.floor(cand.length / 3));
    for (let q = 0; q < nTop; q++) { L0 += cand[q][1]; a0 += cand[q][2]; b0 += cand[q][3]; }
    lab2rgb(L0 / nTop * .92, a0 / nTop * 1.25, b0 / nTop * 1.25, rgb);
    const irisC = P.map(rgb[0], rgb[1], rgb[2], [0, 0, 0]), pupil = mix(black, umber, .3);
    const jit = q => (hash3(k, q, cfg.seed + bs) - .5) * .03 * w;
    add([[ix - up[0] * ri * .3 + jit(1), iy - up[1] * ri * .3], [ix + up[0] * ri * .3, iy + up[1] * ri * .3 + jit(2)]], ri * .85 * S, irisC, mix(irisC, umber, .35), .45, .95, .17);
    add([[ix - .15, iy], [ix + .15, iy]], ri * .36 * S, pupil, pupil, .4, .92, .18);
    const lid = []; for (let t = -1; t <= 1.001; t += .25) { const hh = ri * (1.0 - .45 * t * t); lid.push([ix + dir[0] * t * w * .38 + up[0] * hh, iy + dir[1] * t * w * .38 + up[1] * hh]); }
    add(lid, Math.max(1.3, w * .042 * S), mix(black, burnt, .4), mix(umber, burnt, .5), .4, .78, .19);
    add([[cx - .25, cy], [cx + .25, cy]], Math.max(1.4, w * .042 * S), lead, lead, 1.6, .99, .29);
  });
  return out;
}
export { hex01 };
