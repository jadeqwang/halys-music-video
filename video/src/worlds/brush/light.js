// light.js: the REFERENCE the brushes paint toward. The source's colour is re-lit by designed light pools
// (Caravaggio: one warm, fast-falling pool; outside it values crush to a varied umber and only glints near the light
// survive), a selective, broken rim on the silhouette's lit side, an optional aerial perspective (landscapes), and
// the eclipse (sharper pool edges, colour drain, deeper crush). The result is forced into the world's palette box.

import { clamp, lerp, sstep, blur, blurFast, ellipseInto, polygonInto, noiseField, fbm, rgb2lab, lab2rgb, sampleField } from './util.js';

// eclipse = fraction of the sun's diameter covered (0 full sun .. 1 totality): shadows sharpen, colour drains, the
// lights go metallic and the crush deepens. Applied to a cfg before reference().
export function eclipseCfg(cfg) {
  const e = clamp(cfg.eclipse ?? 0);
  if (!e) return cfg;
  return {
    ...cfg,
    poolBlur: cfg.poolBlur * (1 - .72 * e),
    pool: (cfg.pool || []).map(p => ({ ...p, feather: (p.feather ?? .5) * (1 - .55 * e) })),
    satIn: cfg.satIn * (1 - .6 * e), satOut: cfg.satOut * (1 - .55 * e),
    liftIn: cfg.liftIn * (1 - .38 * e * e), crushFloor: cfg.crushFloor * (1 - .5 * e), contrastIn: cfg.contrastIn * (1 + .3 * e),
    warmIn: cfg.warmIn * (1 - .7 * e), crush: cfg.crush * (1 - .4 * e),
    metal: (cfg.metal ?? 0) + .62 * e * e,
  };
}

// light pools / focus regions: ellipses {x, y, rx, ry, rot, feather, k} or polygons {poly: [[u, v], ...], k, feather}
export function regionField(F, list, blurSigma = 0) {
  const out = new Float32Array(F.N);
  for (const e of list || []) {
    if (e.poly) polygonInto(out, F.aw, F.ah, e.poly, e.k ?? 1, e.feather ?? 3);
    else ellipseInto(out, F.aw, F.ah, e, 'max');
  }
  return blurSigma > 0 ? blurFast(out, F.aw, F.ah, blurSigma) : out;
}

export function reference(F, cfg, P) {
  const { aw, ah, N } = F, seed = (cfg.seed | 0) * 13 + 1;
  // environment light (designed regions, soft) and figure light (the matte, kept sharp so no halo leaks onto the ground)
  let pool = regionField(F, cfg.pool, 0);
  if (cfg.poolField) for (let i = 0; i < N; i++) pool[i] = Math.max(pool[i], cfg.poolField[i]);
  // the plate's own key light as the pool: where it already falls brightest (on the figure when there is a matte)
  if (cfg.poolFromLight) {
    const o = cfg.poolFromLight, Lp = blurFast(F.L, aw, ah, o.sigma ?? 5), Mm = F.M && o.matte !== false ? blurFast(F.M, aw, ah, 2) : null;
    let lo = o.lo, hi = o.hi;
    if (lo == null || hi == null) {                    // relative to this frame: the top ~18 % of its values
      const hist = new Uint32Array(64); for (let i = 0; i < N; i += 3) hist[Math.min(63, Lp[i] * 64 | 0)]++;
      let acc = 0; const tot = Math.ceil(N / 3); let q60 = 0, q92 = 63;
      for (let b = 0; b < 64; b++) { acc += hist[b]; if (acc < tot * .62) q60 = b; if (acc < tot * .94) q92 = b; }
      lo = lo ?? q60 / 64; hi = hi ?? Math.max(lo + .05, q92 / 64);
    }
    for (let i = 0; i < N; i++) pool[i] = Math.max(pool[i], (o.k ?? .9) * sstep(lo, hi, Lp[i]) * (Mm ? sstep(.2, .7, Mm[i]) * (1 - (o.bg ?? .35)) + (o.bg ?? .35) : 1));
  }
  pool = blurFast(pool, aw, ah, cfg.poolBlur);
  const fig = new Float32Array(N);
  // pools flagged {fig: true} (faces) light like the figure: full value, never the environment's dimming
  const figPools = (cfg.pool || []).filter(e => e.fig);
  if (figPools.length) { const fp = regionField(F, figPools, 2); for (let i = 0; i < N; i++) fig[i] = Math.max(fig[i], fp[i]); }
  if (F.M && cfg.poolMatte) {
    const mb = blur(F.M, aw, ah, .8), bound = cfg.poolBound ? regionField(F, [cfg.poolBound]) : null;
    for (let i = 0; i < N; i++) { const fm = sstep(.25, .75, mb[i]) * (bound ? bound[i] : 1); fig[i] = Math.max(fig[i], fm); pool[i] = Math.max(pool[i], fm * cfg.poolMatte); }
  }
  const focus = regionField(F, cfg.focus, 3);
  const reach = blurFast(pool, aw, ah, cfg.glintReach);
  const Lb = blurFast(F.L, aw, ah, 2.5);
  const dvar = cfg.darkVar ? noiseField(aw, ah, 7 / aw, seed + 5, 3, 8) : null;
  const brkF = cfg.rim ? noiseField(aw, ah, .07, seed + 77, 3, 3) : null;
  // depth for aerial perspective (landscapes): far -> lifted toward the haze colour, desaturated
  const aer = cfg.aerial && F.D ? cfg.aerial : null;
  const hazeLab = aer ? rgb2lab(aer.color[0], aer.color[1], aer.color[2], [0, 0, 0]) : null;
  const Mb = F.M ? blur(F.M, aw, ah, 1.1) : null;
  const ld = Math.hypot(cfg.lightDir[0], cfg.lightDir[1]) || 1;
  let Lx = cfg.lightDir[0] / ld, Ly = cfg.lightDir[1] / ld;
  const LP = cfg.lightPoint ? [cfg.lightPoint[0] * aw, cfg.lightPoint[1] * ah] : null;   // a light in frame (the sun, the horizon glow)
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N), Lr = new Float32Array(N), rimF = new Float32Array(N);
  const lab = [0, 0, 0], inn = [0, 0, 0], c = [0, 0, 0], tmp = [0, 0, 0];
  const extraLight = cfg.lightField || null, extraShadow = cfg.shadowField || null;
  const keep = clamp(cfg.plateKeep ?? 0);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const i = y * aw + x;
    rgb2lab(F.R[i], F.G[i], F.B[i], lab);
    let Lk = lab[0], a = lab[1], b = lab[2], rim = 0;
    if (Mb && x > 0 && y > 0 && x < aw - 1 && y < ah - 1 && F.M[i] > .2) {
      const gx = (Mb[i + 1] - Mb[i - 1]) * .5, gy = (Mb[i + aw] - Mb[i - aw]) * .5, em = Math.sqrt(gx * gx + gy * gy);
      if (em > .015) {
        const nx = -gx / em, ny = -gy / em;                                        // outward normal
        // the plate's fringe (bright background bleeding into the figure's edge pixels) takes the value just inside
        const sx = x - nx * 3.5, sy = y - ny * 3.5;
        rgb2lab(sampleField(F.R, aw, ah, sx, sy), sampleField(F.G, aw, ah, sx, sy), sampleField(F.B, aw, ah, sx, sy), inn);
        const band = sstep(.015, .08, em) * cfg.fringe;
        if (Lk > inn[0]) { Lk = lerp(Lk, inn[0], band); a = lerp(a, inn[1], band); b = lerp(b, inn[2], band); }
        // rim light: only where the silhouette faces the light, and broken (never a full outline)
        if (LP) { const qx = LP[0] - x, qy = LP[1] - y, ql = Math.hypot(qx, qy) || 1; Lx = qx / ql; Ly = qy / ql; }
        const face = Math.max(0, nx * Lx + ny * Ly), brk = sstep(cfg.rimBreak - .08, cfg.rimBreak + .08, brkF[i]);
        rim = sstep(.02, .1, em) * Math.pow(face, 1.6) * brk * cfg.rim;
      }
    }
    rimF[i] = rim;
    let p = sstep(cfg.poolLo, cfg.poolHi, pool[i]);
    if (extraLight) p = Math.max(p, extraLight[i]);
    let Lin = Math.pow(clamp(Lk), cfg.gammaIn) * cfg.liftIn;
    if (cfg.liftDark) Lin += cfg.liftDark * (1 - Lin) * Math.pow(1 - clamp(Lk), 2) * p;   // backlit plates: lift the figure's darks inside the pool
    Lin = clamp(.5 + (Lin - .5) * cfg.contrastIn, .04, .97);
    Lin += cfg.focusLift * focus[i] * (.97 - Lin) * sstep(.08, .4, Lk);      // a designed key on faces and hands
    // glints are ridges and specks (bright with little gradient), not the bright side of every step edge
    const lc = F.L[i] - Lb[i], ratio = F.mag[i] / (8 * Math.max(lc, 1e-3));
    const glint = sstep(cfg.glintT, cfg.glintT + .14, Lk) * sstep(.025, .1, lc) * (1 - sstep(.35, .9, ratio)) * cfg.glint * sstep(.04, .45, reach[i]);
    const dv = dvar ? (dvar[i] - .5) * cfg.darkVar : 0;
    const Lout = cfg.crushFloor + dv + cfg.crush * Lk * Lk + glint * Math.max(0, Lk - cfg.crushFloor) * .85;
    let L2 = lerp(Lout, Lin * lerp(cfg.envDim, 1, fig[i]), p);
    // well-lit plates keep part of their own value design (the pool push stays, the subject is not flattened)
    if (keep) { const Lp = clamp(.5 + (Math.pow(clamp(Lk), cfg.gammaIn) * cfg.liftIn - .5) * cfg.contrastIn, .03, .97); L2 = lerp(L2, Lp * lerp(cfg.keepDim ?? .85, 1, Math.max(p, fig[i])), keep); }
    L2 += rim * (.95 - L2) * .85;
    let sat = lerp(cfg.satOut, cfg.satIn, p);
    a = a * sat + lerp(.013, .004 + cfg.warmIn * .35, p) + .01 * rim; b = b * sat + lerp(.026, .012 + cfg.warmIn, p) + .035 * rim;
    if (aer) {
      const far = sstep(aer.near ?? .5, aer.far ?? .05, F.D[i]) * (aer.k ?? .6);
      L2 = lerp(L2, Math.max(L2, hazeLab[0] * (aer.lift ?? 1)), far); a = lerp(a, hazeLab[1], far); b = lerp(b, hazeLab[2], far);
    }
    if (extraShadow) { const s = extraShadow[i]; L2 = lerp(L2, cfg.shadowL ?? .07, s); a *= 1 - .6 * s; b *= 1 - .45 * s; }
    lab2rgb(L2, a, b, c);
    P.map(c[0], c[1], c[2], tmp);
    R[i] = tmp[0]; G[i] = tmp[1]; B[i] = tmp[2]; Lr[i] = .2126 * tmp[0] + .7152 * tmp[1] + .0722 * tmp[2];
  }
  return { R, G, B, L: Lr, pool, focus, fig, rim: rimF, sky: null };
}

// a quick non-allocating value for the light at uv (for the type module and procedural layers)
export function poolValue(pools, u, v, asp = 16 / 9) {
  let m = 0;
  for (const e of pools || []) {
    if (e.poly) continue;
    const cs = Math.cos(e.rot || 0), sn = Math.sin(e.rot || 0), du = u - e.x, dv = (v - e.y) / asp;
    const xr = du * cs + dv * sn, yr = -du * sn + dv * cs, r = Math.hypot(xr / e.rx, yr / (e.ry / asp)), fe = e.feather ?? .5;
    m = Math.max(m, (1 - sstep(1 - fe, 1 + fe * .35, r)) * (e.k ?? 1));
  }
  return m;
}
export { fbm };
