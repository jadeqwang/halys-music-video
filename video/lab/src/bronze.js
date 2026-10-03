// bronze.js: BRONZE, Baroque oil paint with designed tenebrism.
//
// 1. reference(): the plate's colour is re-lit by a per-shot light pool (outside it values crush to warm near-black and
//    only rim glints near the light survive; inside, the plate's own light with more contrast), then forced into a
//    fixed palette box (ten tubes, no blue).
// 2. withSky(): a designed Altdorfer sky (one vortex around the eclipsed sun, horizontal banks, luminous horizon) enters
//    as reference colour AND as a structure tensor, so the same brushes paint it along the vortex.
// 3. strokes(): Hertzmann-style coarse-to-fine painting. For each brush (big to small) the reference is blurred to the
//    brush's scale; wherever a virtual canvas (CPU, analysis res) still differs from it by more than a threshold, a
//    curved stroke starts at the worst pixel and follows the flow field (tangent to edges, turn-limited so strokes stay
//    brush-like), ending when it would paint the wrong colour. Focus regions (faces, hands, blades, the sun) lower the
//    threshold so the small brushes work there; darkness raises it (thin, broad, quiet darks like Caravaggio's grounds).
//    Layout is anchored to brush grids with region-stable seeds; each drawing (12 per second) re-jitters by `boil`,
//    so strokes shimmer but never strobe.
// 4. paint(): strokes become textured ribbons on the GPU (bristle streaks, dry-brush tails on wide strokes) writing
//    colour and paint height (MRT, half float). A finishing pass lights the height from the upper left (impasto, only
//    where paint is thick), shows canvas weave where it is thin, faint craquelure in the darks and a warm varnish.
// 5. The eclipse fraction drives the sun's bite, the sky, and the light: shadows sharpen, colour drains, light goes metallic.

import { W, H, TAU, clamp, lerp, sstep, hash3, hash4, shuffle, srgb2oklab, oklab2srgb, fbm, PaletteBox, BRONZE_PALETTE, hexRgb } from './core.js';
import { blur, samp, flowAt, ellipseMask } from './analysis.js';
import { GLSL_COMMON, noiseTexture, blitFields } from './gl.js';
import { skyMask } from './sky.js';

let PAL = null;
export const palette = () => (PAL ??= new PaletteBox(Object.values(BRONZE_PALETTE), { white: 6, black: 0, wL: 2.2, wC: 1.4 }));

export const DEFAULTS = {
  aw: 960,
  pool: [{ x: .5, y: .45, rx: .3, ry: .35, rot: 0, feather: .6 }],
  poolMatte: .85, poolBound: null, poolBlur: 7,
  // values: inside the pool (gamma, lift, contrast, saturation), outside (floor, crush, saturation), glints near the light
  gammaIn: .95, liftIn: 1.04, contrastIn: 1.18, satIn: 1.18, crushFloor: .13, crush: .17, satOut: .5,
  glint: .85, glintT: .72, glintReach: 16, envDim: .8,
  // brushes (screen px radius), grid factor, threshold, stroke lengths (control points), turn limit, colour blur
  brushes: [24, 13, 7.5, 4.2, 2.4], fg: [1.5, 1.3, 1.15, 1.05, 1.0], T: [0, .05, .055, .06, .065],
  minLen: [2, 2, 2, 1, 1], maxLen: [6, 6, 5, 4, 3], step: [1.0, .95, .9, .85, .8], fc: .5, maxTurn: .42, fs: .5,
  jitter: .8, boil: .3, colorJit: .03, focusGain: .7, darkRaise: 1.8, fineGate: .22,
  // paint body and finish
  thinDark: .05, thick: .32, thickHi: .5, impasto: .5, spec: .16, weave: 1, crack: .25, varnish: .85, vignette: .35,
  accents: 1, ground: [.09, .065, .045], seed: 7,
  sky: null, sun: null, eclipse: 0, metal: 0, drawFps: 12,
};

// ---------------------------------------------------------------- 1. reference
export function reference(F, cfg) {
  const { aw, ah, N } = F, P = palette();
  // environment light (designed ellipses, soft) and figure light (the matte, kept sharp so no halo leaks onto the ground)
  let pool = new Float32Array(N);
  for (const e of cfg.pool) { const m = ellipseMask(F, e), k = e.k ?? 1; for (let i = 0; i < N; i++) pool[i] = Math.max(pool[i], m[i] * k); }
  pool = blur(pool, aw, ah, cfg.poolBlur);
  if (F.M && cfg.poolMatte) {
    const mb = blur(F.M, aw, ah, .8), bound = cfg.poolBound ? ellipseMask(F, cfg.poolBound) : null;
    for (let i = 0; i < N; i++) pool[i] = Math.max(pool[i], sstep(.25, .75, mb[i]) * cfg.poolMatte * (bound ? bound[i] : 1));
  }
  let focus = new Float32Array(N);
  for (const e of cfg.focus || []) { const m = ellipseMask(F, e); for (let i = 0; i < N; i++) focus[i] = Math.max(focus[i], m[i] * (e.k ?? 1)); }
  focus = blur(focus, aw, ah, 3);
  const reach = blur(pool, aw, ah, cfg.glintReach);
  const Lb = blur(F.L, aw, ah, 2.5);
  // figure light (sharp matte) vs environment light: the environment inside the pool is dimmer than the figures
  const fig = new Float32Array(N);
  if (F.M && cfg.poolMatte) { const mb = blur(F.M, aw, ah, .8), bound = cfg.poolBound ? ellipseMask(F, cfg.poolBound) : null; for (let i = 0; i < N; i++) fig[i] = sstep(.25, .75, mb[i]) * (bound ? bound[i] : 1); }
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N), Lr = new Float32Array(N), tmp = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    let [Lk, a, b] = srgb2oklab(F.R[i], F.G[i], F.B[i]);
    const p = sstep(0, 1, pool[i]);
    let Lin = Math.pow(clamp(Lk), cfg.gammaIn) * cfg.liftIn;
    Lin = clamp(.5 + (Lin - .5) * cfg.contrastIn, .04, .97);
    // glints are ridges and specks (bright with little gradient), not the bright side of every step edge
    const lc = F.L[i] - Lb[i], ratio = F.mag[i] / (8 * Math.max(lc, 1e-3));
    const glint = sstep(cfg.glintT, cfg.glintT + .14, Lk) * sstep(.025, .1, lc) * (1 - sstep(.35, .9, ratio)) * cfg.glint * sstep(.04, .45, reach[i]);
    const Lout = cfg.crushFloor + cfg.crush * Lk * Lk + glint * Math.max(0, Lk - cfg.crushFloor) * .85;
    const L2 = lerp(Lout, Lin * lerp(cfg.envDim, 1, fig[i]), p);
    const sat = lerp(cfg.satOut, cfg.satIn, p);
    a = a * sat + lerp(.012, .004, p); b = b * sat + lerp(.024, .012, p);    // warm bias: umber in the dark, golden in the light
    const c = oklab2srgb(L2, a, b);
    P.map(c[0], c[1], c[2], tmp);
    R[i] = tmp[0]; G[i] = tmp[1]; B[i] = tmp[2]; Lr[i] = .2126 * tmp[0] + .7152 * tmp[1] + .0722 * tmp[2];
  }
  return { R, G, B, L: Lr, pool, focus, sky: null };
}

// ---------------------------------------------------------------- 2. strokes
// returns [{pts:[[x,y]...] (screen px), apts (analysis px), r (radius px), c0, c1 (rgb), a, thick, seed, layer}]
// anchor: optional {ox, oy, s} mapping analysis px -> layout space, so a synthetic camera move keeps stroke seeds on the content
export function strokes(F, ref, cfg, drawIdx = 0, anchor = null) {
  const { aw, ah, N } = F, S = W / aw;
  const cR = new Float32Array(N), cG = new Float32Array(N), cB = new Float32Array(N), painted = new Uint8Array(N);
  const out = [], perLayer = [];
  const seed = cfg.seed | 0, boilSeed = seed * 131 + drawIdx * 7919 + 1;
  const A = anchor || { ox: 0, oy: 0, s: 1 };
  for (let li = 0; li < cfg.brushes.length; li++) {
    const Rs = cfg.brushes[li], Ra = Rs / S, sig = Math.max(.6, cfg.fs * Ra * 1.6);
    const rb = blur(ref.R, aw, ah, sig), gb = blur(ref.G, aw, ah, sig), bb = blur(ref.B, aw, ah, sig);
    const D = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (!painted[i]) { D[i] = 9; continue; }
      const dr = cR[i] - rb[i], dg = cG[i] - gb[i], db = cB[i] - bb[i]; D[i] = Math.sqrt(dr * dr + dg * dg + db * db);
    }
    const grid = Math.max(1, cfg.fg[li] * Ra), J = Rs >= 12 ? F.Jc : F.J;
    const T0 = cfg.T[li], layer = [], last = li === cfg.brushes.length - 1;
    // the grid lives in layout space (content-anchored under a synthetic camera); cells are visited in that space
    const gL = grid, lx0 = Math.floor(A.ox / gL) - 1, ly0 = Math.floor(A.oy / gL) - 1;   // fixed cell size in layout space
    const nx = Math.ceil((A.ox + aw * A.s) / gL) + 1, ny = Math.ceil((A.oy + ah * A.s) / gL) + 1;
    for (let cy = ly0; cy < ny; cy++) for (let cx = lx0; cx < nx; cx++) {
      const jx = (hash4(cx, cy, li, seed) - .5) * cfg.jitter + (hash4(cx, cy, li, boilSeed) - .5) * cfg.boil * 2;
      const jy = (hash4(cy, cx, li, seed + 3) - .5) * cfg.jitter + (hash4(cy, cx, li, boilSeed + 3) - .5) * cfg.boil * 2;
      const gx = ((cx + .5 + jx * .5) * gL - A.ox) / A.s, gy = ((cy + .5 + jy * .5) * gL - A.oy) / A.s;
      if (gx < -grid * .5 || gy < -grid * .5 || gx > aw + grid * .5 || gy > ah + grid * .5) continue;
      const x0 = Math.max(0, Math.floor(gx - grid / 2)), x1 = Math.min(aw - 1, Math.ceil(gx + grid / 2));
      const y0 = Math.max(0, Math.floor(gy - grid / 2)), y1 = Math.min(ah - 1, Math.ceil(gy + grid / 2));
      if (x1 < x0 || y1 < y0) continue;
      let sum = 0, n = 0, best = -1, bi = -1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * aw + x, d = D[i]; sum += d; n++; if (d > best) { best = d; bi = i; } }
      if (!n) continue;
      const gxi = clamp(Math.round(gx), 0, aw - 1), gyi = clamp(Math.round(gy), 0, ah - 1), ii = gyi * aw + gxi;
      // threshold: focus (faces, hands) lowers it; the dark outside the light pool raises it
      const f = ref.focus[ii], p = ref.pool[ii];
      const T = T0 * (1 - cfg.focusGain * f) * lerp(cfg.darkRaise, 1, p);
      if (li > 0 && sum / n <= T) continue;
      // the finest brush only works where it matters (focus, inside the light where there is detail)
      if (last && Math.max(f, p * F.detail[ii]) < cfg.fineGate) continue;
      const sx = li === 0 ? clamp(gx, 0, aw - 1) : bi % aw, sy = li === 0 ? clamp(gy, 0, ah - 1) : Math.floor(bi / aw);
      const st = traceStroke(F, J, sx, sy, Ra, rb, gb, bb, cR, cG, cB, painted, cfg, li, hash4(cx, cy, li, seed + 11));
      const k = hash4(cx, cy, li, boilSeed + 5), cj = (k - .5) * 2 * cfg.colorJit;
      const c0 = [clamp(st.c[0] * (1 + cj)), clamp(st.c[1] * (1 + cj)), clamp(st.c[2] * (1 + cj * .8))];
      const e = st.pts[st.pts.length - 1];
      const c1e = [samp(F, rb, e[0], e[1]), samp(F, gb, e[0], e[1]), samp(F, bb, e[0], e[1])];
      const lum = .2126 * c0[0] + .7152 * c0[1] + .0722 * c0[2];
      // paint body: thin in the darks, loaded in the lights, lead white piles up (impasto) inside the pool
      const thick = (lerp(cfg.thinDark, cfg.thick, sstep(.12, .55, lum)) * lerp(.45, 1, p) + cfg.thickHi * sstep(.55, .88, lum) * p) * lerp(1.1, .8, li / (cfg.brushes.length - 1));
      layer.push({ pts: st.pts.map(([x, y]) => [x * S, y * S]), apts: st.pts, ra: Ra, r: Rs * (.9 + .2 * hash4(cx, cy, li, seed + 13)), c0, c1: [lerp(c0[0], c1e[0], .4), lerp(c0[1], c1e[1], .4), lerp(c0[2], c1e[2], .4)], a: .96 + .04 * k, thick: Math.min(.95, thick), seed: hash4(cx, cy, li, seed + 17), layer: li });
    }
    shuffle(layer, seed * 31 + li + drawIdx * 0);
    for (const s of layer) paintVirtual(s, F, cR, cG, cB, painted);
    for (const s of layer) out.push(s);
    perLayer.push(layer.length);
  }
  const acc = cfg.accents ? accents(F, ref, cfg, drawIdx) : [];
  out.push(...acc); perLayer.push(acc.length);
  out.perLayer = perLayer;
  return out;
}

function traceStroke(F, J, x0, y0, Ra, rb, gb, bb, cR, cG, cB, painted, cfg, li, h) {
  const aw = F.aw, c = [samp(F, rb, x0, y0), samp(F, gb, x0, y0), samp(F, bb, x0, y0)];
  const pts = [[x0, y0]], v = [0, 0, 0];
  let x = x0, y = y0, ldx = 0, ldy = 0;
  const maxL = cfg.maxLen[li], minL = cfg.minLen[li], step = Ra * cfg.step[li] * 1.6, cT = Math.cos(cfg.maxTurn), sT = Math.sin(cfg.maxTurn);
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
      let m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
      // turn limit: a brush cannot hook back on itself
      const cs = dx * ldx + dy * ldy;
      if (cs < cT) { const sg = (ldx * dy - ldy * dx) >= 0 ? 1 : -1; dx = ldx * cT - ldy * sT * sg; dy = ldy * cT + ldx * sT * sg; }
    }
    const nx2 = x + dx * step, ny2 = y + dy * step;
    if (nx2 < 0 || ny2 < 0 || nx2 > F.aw - 1 || ny2 > F.ah - 1) break;
    x = nx2; y = ny2; ldx = dx; ldy = dy; pts.push([x, y]);
  }
  if (pts.length === 1) { // a dab: give it a short body along the flow
    flowAt(F, x0, y0, v, J); pts.push([x0 + v[0] * step * .6, y0 + v[1] * step * .6]);
  }
  return { pts, c };
}

// rasterise a stroke (capsules along its polyline) into the CPU canvas at analysis res
function paintVirtual(s, F, cR, cG, cB, painted) {
  const aw = F.aw, ah = F.ah, r = s.r / (W / aw), r2 = r * r, P = s.apts, n = P.length;
  for (let k = 0; k < n - 1; k++) {
    const [ax, ay] = P[k], [bx, by] = P[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-6;
    const t0 = k / (n - 1), t1 = (k + 1) / (n - 1);
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r)), x1 = Math.min(aw - 1, Math.ceil(Math.max(ax, bx) + r));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r)), y1 = Math.min(ah - 1, Math.ceil(Math.max(ay, by) + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / L2), qx = ax + dx * t - x, qy = ay + dy * t - y;
      if (qx * qx + qy * qy > r2) continue;
      const u = lerp(t0, t1, t), i = y * aw + x;
      cR[i] = lerp(s.c0[0], s.c1[0], u); cG[i] = lerp(s.c0[1], s.c1[1], u); cB[i] = lerp(s.c0[2], s.c1[2], u); painted[i] = 1;
    }
  }
}

// thick little strokes of lead white / Naples yellow on the hottest highlights inside the light (bronze, blades, eyes)
function accents(F, ref, cfg, drawIdx) {
  const { aw, ah } = F, S = W / aw, out = [], v = [0, 0, 0];
  const Lb = blur(F.L, aw, ah, 3), seed = cfg.seed * 17 + 5;
  const lead = hexRgb(BRONZE_PALETTE.leadWhite), naples = hexRgb(BRONZE_PALETTE.naples);
  for (let y = 3; y < ah - 3; y += 2) for (let x = 3; x < aw - 3; x += 2) {
    const i = y * aw + x, p = ref.pool[i];
    if (p < .4 || (ref.sky && ref.sky[i] > .2)) continue;
    const L = F.L[i], lc = L - Lb[i];
    if (L < .64 || lc < .05) continue;
    let isMax = true;
    for (let j = -2; j <= 2 && isMax; j++) for (let k = -2; k <= 2; k++) if (F.L[i + j * aw + k] > L) { isMax = false; break; }
    if (!isMax) continue;
    const h = hash3(x, y, seed), hb = hash4(x, y, seed, drawIdx * 7919 + 3);
    if (h > .5 * cfg.accents) continue;
    flowAt(F, x, y, v, F.J);
    const len = (1.2 + 2 * h) * (1 + lc * 3), ang = (hb - .5) * .4;
    const ca = Math.cos(ang), sa = Math.sin(ang), dx = v[0] * ca - v[1] * sa, dy = v[0] * sa + v[1] * ca;
    const c = F.R[i] - F.B[i] > .12 ? naples : lead;
    const ox = (hb - .5) * .6, oy = (hash4(x, y, seed + 1, drawIdx) - .5) * .6;
    const a0 = [x + ox - dx * len * .5, y + oy - dy * len * .5], a1 = [x + ox + dx * len * .5, y + oy + dy * len * .5];
    out.push({ pts: [[a0[0] * S, a0[1] * S], [a1[0] * S, a1[1] * S]], apts: [a0, a1], ra: 1, r: (1.3 + 1.3 * h) * (.8 + p * .4), c0: c, c1: lead, a: .97, thick: .75 + .2 * p, seed: hash3(x, y, seed + 2), layer: 9 });
  }
  return out;
}

// ---------------------------------------------------------------- 3. the eclipse: one parameter, many consequences
// eclipse = fraction of the sun's diameter covered by the moon (0 = full sun, 1 = totality). As the bite grows the
// light pool's edges harden (shadows sharpen), saturation drains, the lights go metallic and the crush deepens.
export function eclipseCfg(cfg) {
  const e = clamp(cfg.eclipse ?? 0);
  if (!e) return cfg;
  return {
    ...cfg,
    poolBlur: cfg.poolBlur * (1 - .72 * e),
    pool: cfg.pool.map(p => ({ ...p, feather: (p.feather ?? .5) * (1 - .55 * e) })),
    satIn: cfg.satIn * (1 - .6 * e), satOut: cfg.satOut * (1 - .55 * e),
    liftIn: cfg.liftIn * (1 - .22 * e * e), crushFloor: cfg.crushFloor * (1 - .35 * e), contrastIn: cfg.contrastIn * (1 + .25 * e),
    metal: (cfg.metal ?? 0) + .9 * e * e,
  };
}

// ---------------------------------------------------------------- 4. the Altdorfer sky
function sunGeom(cfg, aw, ah) {
  const s = cfg.sun || { x: .1, y: .15, r: .04 }, e = clamp(cfg.eclipse ?? 0);
  const sx = s.x * aw, sy = s.y * ah, sr = s.r * aw, ang = s.moonFrom ?? -.6;    // the moon arrives from the upper right
  const off = 2 * sr * (1 - e);
  return { sx, sy, sr, mx: sx + Math.cos(ang) * off, my: sy + Math.sin(ang) * off, mr: sr * 1.03, e };
}

export function skyField(F, cfg, mask) {
  const { aw, ah, N } = F, P = palette(), sg = sunGeom(cfg, aw, ah), e = sg.e;
  const sk = cfg.sky, hzY = (sk.horizon ?? sk.below) * ah, seed = (cfg.seed | 0) * 7 + 3, gain = sk.gain ?? 1;
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  const txx = new Float32Array(N), txy = new Float32Array(N), tyy = new Float32Array(N), tmp = [0, 0, 0];
  const twist = sk.twist ?? 1.6, pitch = sk.pitch ?? .35, vortexR = (sk.vortex ?? .16) * aw, glowR = sk.glowR ?? .2;
  const zen = sk.zenith ?? .26, hor = sk.horizonL ?? .66, cloudAmt = sk.clouds ?? 1;
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const i = y * aw + x; if (mask[i] < .003) continue;
    const dx = x - sg.sx, dy = y - sg.sy, d = Math.hypot(dx, dy) + 1e-3, dn = d / aw;
    // cloud masses: horizontal banks (stretched noise), curled into one vortex close to the sun
    const tw = twist * Math.exp(-d / vortexR), c = Math.cos(tw), s = Math.sin(tw);
    const u = (sg.sx + dx * c - dy * s) / aw, v = (sg.sy + dx * s + dy * c) / aw;
    const n1 = fbm(u * 3.4, v * 11, seed, 5), n2 = fbm(u * 9 + 3.1, v * 22 + 1.7, seed + 9, 4);
    const cloud = sstep(.4, .68, n1 * .8 + n2 * .3) * cloudAmt;
    const hz = clamp(y / Math.max(hzY, 1));
    const glow = Math.exp(-dn / (glowR * .3)) * .5 + Math.exp(-dn / glowR) * .38;
    const near = Math.exp(-dn / (glowR * 1.6));                    // clouds near the sun are lit gold, far ones dark
    let L = lerp(zen, hor, Math.pow(hz, 1.4)) + glow * (1 - .6 * e);
    const rim = cloud * (1 - cloud) * 4;
    L += cloud * lerp(-.17, .1, near) + rim * .1 * near;
    L *= gain * (1 - .5 * Math.pow(e, 1.5));
    const warm = clamp(glow * 1.5 + hz * hz * .6 + near * cloud * .5), chroma = 1 - .7 * e;
    // dark clouds: umber with a breath of madder; zenith: umber-verdigris; glow: Naples; horizon: ochre
    let a = (lerp(-.012, .016, warm) + .03 * cloud * (1 - near)) * chroma, b = (lerp(.018, .09, warm) + .015 * rim * near) * chroma;
    const col = oklab2srgb(clamp(L, .05, .97), a, b);
    P.map(col[0], col[1], col[2], tmp);
    R[i] = tmp[0]; G[i] = tmp[1]; B[i] = tmp[2];
    // flow: log-spiral tangent near the sun, banks elsewhere that follow the cloud shapes (as tensors: orientation-free)
    const rx = dx / d, ry = dy / d;
    const fx = -ry * Math.cos(pitch) + rx * Math.sin(pitch), fy = rx * Math.cos(pitch) + ry * Math.sin(pitch);
    const wv = Math.exp(-d / (vortexR * 1.3));
    const wob = (fbm(x / aw * 4, y / aw * 9, seed + 21, 3) - .5) * 1.1;
    const hx = Math.cos(wob), hy = Math.sin(wob) * .6;
    const hm = Math.hypot(hx, hy), nx2 = -hy / hm, ny2 = hx / hm, nx1 = -fy, ny1 = fx;
    txx[i] = wv * nx1 * nx1 + (1 - wv) * nx2 * nx2; txy[i] = wv * nx1 * ny1 + (1 - wv) * nx2 * ny2; tyy[i] = wv * ny1 * ny1 + (1 - wv) * ny2 * ny2;
  }
  return { R, G, B, txx, txy, tyy, sun: sg };
}

// merge the sky into the reference and the flow tensors (copies; the shared analysis F is never mutated)
function withSky(F, ref, cfg) {
  if (!cfg.sky) return { F, ref, sky: null };
  const mask = skyMask(F, cfg.sky), S = skyField(F, cfg, mask), N = F.N;
  const meanTr = J => { let t = 0; for (let i = 0; i < N; i++) t += J.xx[i] + J.yy[i]; return t / N; };
  const mixT = (J, t) => {
    const o = { xx: new Float32Array(N), xy: new Float32Array(N), yy: new Float32Array(N) }, k = t * 1.5;
    for (let i = 0; i < N; i++) { const m = mask[i]; o.xx[i] = J.xx[i] * (1 - m) + S.txx[i] * k * m; o.xy[i] = J.xy[i] * (1 - m) + S.txy[i] * k * m; o.yy[i] = J.yy[i] * (1 - m) + S.tyy[i] * k * m; }
    return o;
  };
  const R = ref.R.slice(), G = ref.G.slice(), B = ref.B.slice(), L = ref.L.slice(), pool = ref.pool.slice(), focus = ref.focus.slice();
  for (let i = 0; i < N; i++) {
    const m = mask[i]; if (m <= 0) continue;
    R[i] = lerp(R[i], S.R[i], m); G[i] = lerp(G[i], S.G[i], m); B[i] = lerp(B[i], S.B[i], m);
    L[i] = .2126 * R[i] + .7152 * G[i] + .0722 * B[i];
    pool[i] = lerp(pool[i], cfg.sky.pool ?? .5, m);   // the sky is painted with the mid brushes, not the crush rules
  }
  const sg = S.sun;
  for (let y = Math.max(0, Math.floor(sg.sy - sg.sr * 3)); y < Math.min(F.ah, sg.sy + sg.sr * 3); y++)
    for (let x = Math.max(0, Math.floor(sg.sx - sg.sr * 3)); x < Math.min(F.aw, sg.sx + sg.sr * 3); x++) {
      const i = y * F.aw + x, d = Math.hypot(x - sg.sx, y - sg.sy) / sg.sr;
      focus[i] = Math.max(focus[i], (1 - sstep(1, 2.6, d)) * mask[i]);
    }
  const F2 = { ...F, J: mixT(F.J, meanTr(F.J)), Jc: mixT(F.Jc, meanTr(F.Jc)) };
  return { F: F2, ref: { ...ref, R, G, B, L, pool, focus, sky: mask }, sky: { mask, sun: sg } };
}

// The sun painted directly: one loaded dab and rings of lead white for the disc, dark arcs centred on the moon for the
// bite (clipped to the disc: a crisp limb, because the bite is the film's countdown clock), a ring of short tangential
// Naples strokes that hands the disc over to the sky's glow. Everything is clipped to the sky (the land occludes the sun).
function sunStrokes(F, cfg, sky, drawIdx) {
  if (!sky || !cfg.sun) return [];
  const S = W / F.aw, sg = sky.sun, out = [], seed = (cfg.seed | 0) * 97 + 5, bs = seed + drawIdx * 7919;
  const cx = sg.sx * S, cy = sg.sy * S, r = sg.sr * S, mx = sg.mx * S, my = sg.my * S, mr = sg.mr * S, e = sg.e;
  const lead = hexRgb(BRONZE_PALETTE.leadWhite), naples = hexRgb(BRONZE_PALETTE.naples), ochre = hexRgb(BRONZE_PALETTE.yellowOchre);
  const umber = hexRgb(BRONZE_PALETTE.rawUmber), black = hexRgb(BRONZE_PALETTE.boneBlack);
  const metal = (c, k) => { const m = .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; return [lerp(c[0], m, k), lerp(c[1], m, k), lerp(c[2], m * 1.02, k)]; };
  const inSky = (x, y) => { const ax = clamp(Math.round(x / S), 0, F.aw - 1), ay = clamp(Math.round(y / S), 0, F.ah - 1); return sky.mask[ay * F.aw + ax] > .5; };
  const inMoon = (x, y) => e > .005 && Math.hypot(x - mx, y - my) < mr;
  const add = (pts, w, c0, c1, a, thick, sd) => out.push({ pts, r: w, c0, c1, a, thick, seed: sd, layer: 8 });
  // polyline arcs around (ox, oy), split wherever `inside` fails
  const arcs = (ox, oy, rads, inside, colAt, wB, thick, tag, o = {}) => {
    rads.forEach((rad, k) => {
      const n = Math.max(3, Math.round(TAU * rad / Math.max(8, wB * (o.seg ?? 4))));
      for (let j = 0; j < n; j++) {
        if (o.skip && hash4(k, j, tag, seed + 3) < o.skip) continue;
        const a0 = (j + hash4(k, j, tag, seed) * .3 + (hash4(k, j, tag, bs) - .5) * .15) / n * TAU, span = TAU / n * (o.span ?? 1.2);
        let run = [];
        const flush = () => { if (run.length >= 2) add(run, wB * (.9 + .2 * hash4(k, j, tag + 1, seed)), colAt(rad), colAt(rad), o.a ?? .97, thick, hash4(k, j, tag + 2, seed)); run = []; };
        for (let q = 0; q <= 6; q++) {
          const a = a0 + span * q / 6, x = ox + Math.cos(a) * rad, y = oy + Math.sin(a) * rad;
          if (inside(x, y)) run.push([x, y]); else flush();
        }
        flush();
      }
    });
  };
  const dim = 1 - .45 * e * e;
  // glow: a few loose Naples strokes around the limb, following the vortex (tangential, random lengths, low alpha)
  for (let j = 0; j < 14; j++) {
    const a0 = hash4(j, 1, seed, 0) * TAU, rad = r * (1.1 + .5 * hash4(j, 2, seed, 0)), span = (.25 + .35 * hash4(j, 3, seed, 0)) * (1 + .1 * (hash4(j, 3, bs, 0) - .5));
    const pts = []; for (let q = 0; q <= 5; q++) { const a = a0 + span * q / 5, rr = rad * (1 + .06 * q / 5); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; if (!inSky(x, y) || inMoon(x, y)) break; pts.push([x, y]); }
    if (pts.length >= 2) add(pts, Math.max(2, r * (.07 + .05 * hash4(j, 4, seed, 0))), metal(naples, e * .8).map(v => v * dim), metal(ochre, e * .8).map(v => v * dim), .5, .4, hash4(j, 5, seed, 0));
  }
  // the disc and the bite are drawn exactly by SUN_FS in paint() (a crisp limb: the bite is the film's countdown clock)
  return out;
}

// ---------------------------------------------------------------- 5. GPU paint
const STROKE_VS = `#version 300 es
in vec2 aPos; in vec2 aUV; in vec4 aCol; in vec4 aPar;
uniform vec2 uRes;
out vec2 vUV; out vec4 vCol; out vec4 vPar;
void main() { vUV = aUV; vCol = aCol; vPar = aPar; gl_Position = vec4(aPos / uRes * 2.0 - 1.0, 0.0, 1.0); }`;

const STROKE_FS = `#version 300 es
precision highp float;
in vec2 vUV; in vec4 vCol; in vec4 vPar;
uniform sampler2D uNoise;
layout(location = 0) out vec4 oCol;
layout(location = 1) out vec4 oHgt;
void main() {
  float s = vUV.x, v = vUV.y, Lp = vPar.x, hw = vPar.y, seed = vPar.z, thick = vPar.w;
  float u = clamp(s / max(Lp, 1.0), 0.0, 1.0);
  float ds = s < 0.0 ? -s : (s > Lp ? (s - Lp) * 1.5 : 0.0);         // round head, flatter dragged-off tail
  float r = length(vec2(ds / hw, v));
  // bristle tracks: about one per 1.4-3 px across, long streaks along the stroke
  float sp = max(1.4, hw * 0.13);
  float b1 = texture(uNoise, vec2(v * hw / sp * 0.0098 + seed * 7.13, s / sp * 0.00045 + seed * 3.7)).r;
  float b2 = texture(uNoise, vec2(v * hw / sp * 0.0055 + seed * 1.9, s / sp * 0.0011 + seed * 5.3)).g;
  float br = b1 * 0.65 + b2 * 0.35;
  // crisp edge (about one pixel of antialiasing) with a little raggedness from the bristles
  float rag = (texture(uNoise, vec2(s / max(hw, 1.0) * 0.022 + seed * 5.1, v > 0.0 ? 0.31 : 0.77)).a - 0.5) * 0.16;
  float cover = 1.0 - smoothstep(1.0 - 1.3 / hw + rag, 1.0 + rag, r);
  // dry brush: the load runs out toward the tail, some bristle tracks skip (wide strokes only)
  float dry = smoothstep(mix(0.5, 0.85, fract(seed * 13.7)), 1.3, u) * smoothstep(2.5, 7.0, hw);
  cover *= 1.0 - dry * smoothstep(0.32, 0.62, 1.0 - br);
  float a = cover * vCol.a;
  vec3 col = vCol.rgb * (0.955 + 0.09 * br);
  oCol = vec4(col * a, a);
  // paint height: loaded at the head, bristle grooves, a slight ridge where the brush edge pushed paint aside
  float load = mix(1.0, 0.6, u);
  float h = thick * (load * (0.8 + 0.4 * (br - 0.5)) + 0.12 * smoothstep(0.6, 0.95, r));
  oHgt = vec4(h * a, 0.0, 0.0, a);
}`;

const POST_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCol, uHgt;
uniform vec2 uRes; uniform vec3 uGround;
uniform float uImpasto, uSpec, uWeave, uCrack, uVarnish, uVignette, uFlip, uMetal;
out vec4 o;
${GLSL_COMMON}
float weave(vec2 p) {
  vec2 q = p / 3.4;
  vec2 c = floor(q), f = fract(q);
  float top = mod(c.x + c.y, 2.0);
  float th = mix(sin(f.y * 3.14159), sin(f.x * 3.14159), top) * (0.75 + 0.5 * vnoise(p * vec2(0.03, 0.7) + c.x));
  return th * (0.8 + 0.4 * vnoise(p * 0.02));
}
float height(vec2 p) {
  float hp = texture(uHgt, p / uRes).r;
  return hp * 2.0 + uWeave * 0.07 * weave(p) * (1.0 - smoothstep(0.0, 0.3, hp));
}
void main() {
  vec2 uv = vUv; if (uFlip > 0.5) uv.y = 1.0 - uv.y;
  vec2 p = uv * uRes;
  vec4 c = texture(uCol, uv);
  vec3 base = c.rgb + uGround * (1.0 - c.a);
  float h0 = texture(uHgt, uv).r;
  float e = 1.0;
  float hL = height(p - vec2(e, 0)), hR = height(p + vec2(e, 0)), hU = height(p - vec2(0, e)), hD = height(p + vec2(0, e));
  vec3 N = normalize(vec3(-(hR - hL) * 1.6, -(hD - hU) * 1.6, 1.0));
  vec3 Ld = normalize(vec3(-0.6, -0.7, 0.75));
  vec3 lin = s2l(base);
  float lum = luma(lin);
  // impasto: relief lighting, gentle, scaled by how much paint is there
  float relief = (dot(N, Ld) - Ld.z) / Ld.z;
  lin *= clamp(1.0 + uImpasto * relief * (0.35 + 0.65 * smoothstep(0.05, 0.45, h0)), 0.72, 1.4);
  vec3 Hv = normalize(Ld + vec3(0, 0, 1));
  float sp = pow(max(dot(N, Hv), 0.0), 40.0) * uSpec * smoothstep(0.2, 0.6, h0) * (0.2 + smoothstep(0.03, 0.4, lum));
  lin += sp * vec3(1.0, 0.93, 0.8);
  // craquelure: an irregular cell network, mostly in the darks
  vec2 wq = p + 14.0 * vec2(fbm(p * 0.006), fbm(p * 0.006 + 9.2));
  float d1 = voronoiEdge(wq / 38.0), d2 = voronoiEdge(wq / 12.0 + 3.1);
  float crack = (1.0 - smoothstep(0.0, 0.022, d1)) * 0.8 + (1.0 - smoothstep(0.0, 0.035, d2)) * 0.35 * smoothstep(0.5, 0.7, fbm(p * 0.004));
  float cm = uCrack * (0.1 + 0.9 * (1.0 - smoothstep(0.01, 0.12, lum)));
  lin *= 1.0 - clamp(crack, 0.0, 1.0) * cm * 0.6;
  // varnish: an aged amber film, faint mottling, vignette
  lin *= mix(vec3(1.0), vec3(1.0, 0.93, 0.76), uVarnish * 0.75);
  lin *= 1.0 + uVarnish * 0.07 * (fbm(p * 0.0025) - 0.5);
  vec2 vq = (uv - 0.5) * vec2(1.0, 0.85);
  lin *= 1.0 - uVignette * pow(clamp(length(vq) * 1.35, 0.0, 1.0), 2.4);
  // "light goes strange": colour drains toward a cool metallic grey under the eclipse
  float m = luma(lin);
  lin = mix(lin, vec3(m) * vec3(0.97, 1.0, 1.03), uMetal * 0.75);
  vec3 outc = l2s(lin);
  outc += (hash12(p) - 0.5) / 255.0;
  o = vec4(outc, 1.0);
}`;

// The sun's disc and the moon's bite, drawn exactly (antialiased circles) with a painted surface: concentric brush
// streaks, a lead-white core going to Naples at the limb, thick paint (impasto) on the disc, a thinner flat dark bite.
// Clipped by the sky mask, so hills and figures occlude it. Writes colour + height like a stroke (premultiplied).
const SUN_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uRes; uniform vec4 uSun; uniform vec3 uMoon; uniform float uBoil, uMetal;
uniform sampler2D uSky, uNoise;
uniform vec3 uLead, uNaples, uDark;
layout(location = 0) out vec4 oCol;
layout(location = 1) out vec4 oHgt;
void main() {
  vec2 p = vUv * uRes;
  vec2 q = p - uSun.xy; float d = length(q), r = uSun.z, e = uSun.w;
  if (d > r + 3.0) { oCol = vec4(0); oHgt = vec4(0); return; }
  float ang = atan(q.y, q.x);
  // a painted limb: about a pixel of wobble
  float wob = (texture(uNoise, vec2(ang * 0.35 + uBoil * 0.13, 0.5)).a - 0.5) * 1.6;
  float disc = 1.0 - smoothstep(r - 0.8 + wob, r + 0.8 + wob, d);
  float m = length(p - uMoon.xy);
  float bite = e > 0.004 ? 1.0 - smoothstep(uMoon.z - 0.8, uMoon.z + 0.8, m) : 0.0;
  float sky = texture(uSky, vUv).r;
  float a = disc * smoothstep(0.35, 0.65, sky);
  // concentric strokes: bands of radius, streaks along the angle
  float band = floor(d / max(2.5, r * 0.17));
  float st = texture(uNoise, vec2(ang * d * 0.0005 + band * 0.271 + uBoil * 0.071, d * 0.0075 + band * 0.113)).r;
  vec3 c = mix(uLead, uNaples, smoothstep(0.62 * r, r, d) * 0.8) * (0.95 + 0.1 * st);
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, vec3(lum) * vec3(0.98, 1.0, 1.02), uMetal * 0.5);
  float mb = texture(uNoise, vec2(m * 0.01 + uBoil * 0.05, ang * 0.2)).g;
  c = mix(c, uDark * (0.92 + 0.16 * mb), bite);
  float h = mix(0.85 + 0.25 * (st - 0.5) + 0.15 * smoothstep(0.8 * r, r, d), 0.3, bite);
  oCol = vec4(c * a, a);
  oHgt = vec4(h * a, 0.0, 0.0, a);
}`;

// Build the stroke mesh: each stroke a Catmull-Rom ribbon with caps (vertex counts computed exactly).
export function strokeMesh(list) {
  let nv = 0, ni = 0;
  const len = s => { let L = 0; for (let k = 1; k < s.pts.length; k++) L += Math.hypot(s.pts[k][0] - s.pts[k - 1][0], s.pts[k][1] - s.pts[k - 1][1]); return L; };
  for (const s of list) {
    s._len = len(s);
    const seg = Math.max(2, Math.min(16, Math.round((s._len + s.r * 2) / Math.max(2.2, s.r * .8))));
    s._M = Math.max(1, seg - 2);
    nv += (s._M + 3) * 2; ni += (s._M + 2) * 6;
  }
  const pos = new Float32Array(nv * 2), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 4), par = new Float32Array(nv * 4), idx = new Uint32Array(ni);
  let vi = 0, ii = 0;
  const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return .5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
  const tan = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1; return [dx / m, dy / m]; };
  for (const s of list) {
    const P = s.pts, n = P.length, M = s._M, cap = s.r;
    const curve = [];
    for (let k = 0; k <= M; k++) {
      const t = k / M * (n - 1), i = Math.min(n - 2, Math.floor(t)), f = t - i;
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
      curve.push([cr(p0[0], p1[0], p2[0], p3[0], f), cr(p0[1], p1[1], p2[1], p3[1], f)]);
    }
    const t0 = tan(curve[0], curve[1]), t1 = tan(curve[M - 1], curve[M]);
    const full = [[curve[0][0] - t0[0] * cap, curve[0][1] - t0[1] * cap], ...curve, [curve[M][0] + t1[0] * cap, curve[M][1] + t1[1] * cap]];
    const sArr = [-cap]; for (let k = 1; k < full.length; k++) sArr.push(sArr[k - 1] + Math.hypot(full[k][0] - full[k - 1][0], full[k][1] - full[k - 1][1]));
    const Lc = sArr[full.length - 2];
    const base = vi;
    for (let k = 0; k < full.length; k++) {
      const a = full[Math.max(0, k - 1)], b = full[Math.min(full.length - 1, k + 1)], tn = tan(a, b), nx = -tn[1], ny = tn[0];
      const u = clamp(sArr[k] / Math.max(Lc, 1));
      const prof = (.93 + .07 * Math.sin(Math.min(1, u * 1.3) * Math.PI)) * (1 - .2 * sstep(.6, 1, u));
      const hw = s.r * prof, ext = hw + 1.5;
      const cc = [lerp(s.c0[0], s.c1[0], u), lerp(s.c0[1], s.c1[1], u), lerp(s.c0[2], s.c1[2], u)];
      for (const sd of [-1, 1]) {
        pos[vi * 2] = full[k][0] + nx * ext * sd; pos[vi * 2 + 1] = full[k][1] + ny * ext * sd;
        uv[vi * 2] = sArr[k]; uv[vi * 2 + 1] = sd * ext / hw;
        col[vi * 4] = cc[0]; col[vi * 4 + 1] = cc[1]; col[vi * 4 + 2] = cc[2]; col[vi * 4 + 3] = s.a;
        par[vi * 4] = Lc; par[vi * 4 + 1] = hw; par[vi * 4 + 2] = s.seed; par[vi * 4 + 3] = s.thick;
        vi++;
      }
    }
    for (let k = 0; k < full.length - 1; k++) { const q = base + k * 2; idx[ii++] = q; idx[ii++] = q + 1; idx[ii++] = q + 2; idx[ii++] = q + 1; idx[ii++] = q + 3; idx[ii++] = q + 2; }
  }
  if (vi !== nv || ii !== ni) throw new Error(`strokeMesh count mismatch ${vi}/${nv} ${ii}/${ni}`);
  return { attrs: { aPos: { data: pos, size: 2 }, aUV: { data: uv, size: 2 }, aCol: { data: col, size: 4 }, aPar: { data: par, size: 4 } }, idx, nv, ntri: ni / 3 };
}

let NOISE = null, TGT = null;
export function paint(glw, list, cfg, sun = null) {
  NOISE ??= noiseTexture(glw, 256, 11);
  TGT ??= glw.target(W, H, ['rgba16f', 'rgba16f']);
  glw.clear(TGT, [0, 0, 0, 0]);
  const P = glw.program(STROKE_VS, STROKE_FS);
  // draw in chunks so one huge buffer never has to exist
  const CH = 40000;
  let ntri = 0;
  for (let i = 0; i < list.length; i += CH) {
    const m = strokeMesh(list.slice(i, i + CH)), M = glw.mesh(P, m.attrs, m.idx);
    glw.draw(P, M, { uNoise: NOISE }, TGT, 'premult');
    M.dispose(); ntri += m.ntri;
  }
  if (sun) {
    const skyT = glw.fieldTexture(sun.aw, sun.ah, [sun.mask, null, null, null]);
    const hx = c => hexRgb(BRONZE_PALETTE[c]);
    const umb = hx('rawUmber'), blk = hx('boneBlack');
    glw.pass(SUN_FS, {
      uSun: [sun.cx, sun.cy, sun.r, sun.e], uMoon: [sun.mx, sun.my, sun.mr], uBoil: sun.boil, uMetal: cfg.metal ?? 0, uSky: skyT, uNoise: NOISE,
      uLead: hx('leadWhite'), uNaples: hx('naples'), uDark: [umb[0] * .5 + blk[0] * .5, umb[1] * .5 + blk[1] * .5, umb[2] * .5 + blk[2] * .5]
    }, TGT, 'premult');
    glw.deleteTexture(skyT);
  }
  glw.pass(POST_FS, {
    uCol: TGT.tex[0], uHgt: TGT.tex[1], uGround: cfg.ground, uImpasto: cfg.impasto, uSpec: cfg.spec, uWeave: cfg.weave, uCrack: cfg.crack,
    uVarnish: cfg.varnish, uVignette: cfg.vignette, uFlip: 1, uMetal: cfg.metal ?? 0
  }, null, null);
  return { nStrokes: list.length, ntri };
}

// ---------------------------------------------------------------- top level
const refCache = new Map();
export function prepare(F, cfg0) {
  let cfg = eclipseCfg(cfg0);
  if (cfg.faceMin != null) {
    const extra = (F.faces || []).filter(f => f.score >= cfg.faceMin).flatMap(f => {
      const [u0, v0, u1, v1] = f.box, ex = (f.eyes[0][0] + f.eyes[1][0]) / 2, ey = (f.eyes[0][1] + f.eyes[1][1]) / 2, k = cfg.faceK ?? 1;
      return [{ x: (u0 + u1) / 2, y: (v0 + v1) / 2, rx: (u1 - u0) * .45, ry: (v1 - v0) * .5, k: .75 * k },
        ...f.eyes.map(e => ({ x: e[0], y: e[1], rx: (u1 - u0) * .12, ry: (v1 - v0) * .1, k })),
        { x: ex, y: ey + (v1 - v0) * .42, rx: (u1 - u0) * .18, ry: (v1 - v0) * .1, k: .8 * k }];
    });
    cfg = { ...cfg, focus: [...(cfg.focus || []), ...extra] };
  }
  const key = F.plate + '|' + JSON.stringify(F.win) + '|' + F.aw + '|' + JSON.stringify(cfg);
  let base = refCache.get(key);
  if (!base) {
    base = withSky(F, reference(F, cfg), cfg);
    if (refCache.size > 3) refCache.delete(refCache.keys().next().value);
    refCache.set(key, base);
  }
  return { cfg, base };
}

export async function render(glw, F, cfg0, ctx) {
  const ms = {};
  let t0 = performance.now();
  const { cfg, base } = prepare(F, cfg0);
  ms.reference = Math.round(performance.now() - t0);
  if (cfg.debug) {
    const b = base.ref;
    const fields = cfg.debug === 'ref' ? [b.R, b.G, b.B] : cfg.debug === 'pool' ? [b.pool, b.focus, base.sky ? base.sky.mask : b.pool] : [base.sky ? base.sky.mask : b.pool];
    blitFields(glw, F.aw, F.ah, fields);
    return { ms };
  }
  t0 = performance.now();
  const drawIdx = Math.floor((ctx.t ?? 0) * cfg.drawFps + 1e-6);    // on twos: a new drawing 12 times a second
  const list = strokes(base.F, base.ref, cfg, drawIdx, ctx.anchor || null);
  const per = list.perLayer;
  list.push(...sunStrokes(base.F, cfg, base.sky, drawIdx));
  ms.strokes = Math.round(performance.now() - t0);
  t0 = performance.now();
  let sun = null;
  if (base.sky && cfg.sun) {
    const sg = base.sky.sun, S = W / F.aw;
    sun = { cx: sg.sx * S, cy: sg.sy * S, r: sg.sr * S, mx: sg.mx * S, my: sg.my * S, mr: sg.mr * S, e: sg.e, mask: base.sky.mask, aw: F.aw, ah: F.ah, boil: (drawIdx % 97) * cfg.boil };
  }
  const st = paint(glw, list, cfg, sun);
  glw.finish();
  ms.gpu = Math.round(performance.now() - t0);
  return { ms, nStrokes: st.nStrokes, perLayer: per, ntri: st.ntri, drawIdx };
}
