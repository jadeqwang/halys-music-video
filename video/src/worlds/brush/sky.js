// sky.js: the sky region of a source and the designed Altdorfer sky that replaces it.
//
// skyMask(): far depth, never the subject matte, never below `below`, monotone down each column (once a column
// leaves the sky it never re-enters it), so depth speckle cannot punch holes in the land. A source may also bring
// its own mask (procedural canvases).
// skyField(): Altdorfer's vortex. Cloud tongues wound in a log spiral around the sun, horizontal banks far from it,
// lit rims on the sides that face the sun, a luminous horizon, and the eclipse: the glow dies with the visible area
// of the sun, colour drains, the zenith goes dark first and, at totality, a 360-degree sunset glow rings the horizon.
// The sky enters the painting twice: as reference colour AND as a tensor field, so the same brushes paint it along
// the vortex.

import { clamp, lerp, sstep, blur, fbm, vnoise, hash3, rgb2lab, lab2rgb } from './util.js';

export function skyMask(F, o) {
  const { aw, ah, N } = F, m = new Float32Array(N);
  if (!o) return m;
  if (o.mask) { m.set(o.mask); return m; }
  const yMax = (o.below ?? .5) * ah, md = o.maxDepth ?? .01, soft = o.soft ?? .01;
  const D = F.D && !o.noDepth ? blur(F.D, aw, ah, 1) : null;
  const Dt = D ? null : blur(F.detail, aw, ah, 2.5);              // without depth: the sky is where the plate is smooth
  const hz = o.horizonLine;   // optional explicit horizon: [[u, v], ...] polyline in uv (sky above it)
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const i = y * aw + x;
    let s;
    if (hz) s = 1 - sstep(-1.5, 1.5, y - horizonY(hz, x / aw) * ah);
    else if (D) s = 1 - sstep(md, md + soft, D[i]);
    else s = (1 - sstep((o.horizonY ?? .45) - .02, (o.horizonY ?? .45) + .03, y / ah)) * (1 - sstep(.12, .3, Dt[i]));   // no depth: smooth + high
    if (F.M && !o.ignoreMatte) s *= 1 - sstep(.15, .5, F.M[i]);
    s *= 1 - sstep(yMax - 4, yMax + 4, y);
    m[i] = s;
  }
  for (let x = 0; x < aw; x++) {
    let run = 1;
    for (let y = 0; y < ah; y++) { const i = y * aw + x; run = Math.min(run, m[i] + .04); m[i] = Math.min(m[i], run); }
  }
  return blur(m, aw, ah, o.blur ?? 1.2);
}
export function horizonY(line, u) {
  if (u <= line[0][0]) return line[0][1];
  for (let k = 1; k < line.length; k++) if (u <= line[k][0]) { const [a, va] = line[k - 1], [b, vb] = line[k]; return va + (vb - va) * (u - a) / (b - a); }
  return line[line.length - 1][1];
}

// the horizon row of each column (first row where the sky mask drops below .5)
export function horizonRows(F, sky) {
  const { aw, ah } = F, hz = new Float32Array(aw);
  for (let x = 0; x < aw; x++) { let y = 0; while (y < ah && sky[y * aw + x] > .5) y++; hz[x] = y; }
  return hz;
}

// sun warmth from its altitude in degrees: golden-orange near the horizon (the Halys totality: ~9 degrees up)
export const sunWarmth = alt => 1 - sstep(4, 32, alt ?? 30);

// SKY STYLE (all optional): see README.md
export const SKY_DEFAULTS = {
  vortex: .2, twist: 1.5, arms: 3, vert: 1.7, rotSpeed: .018, cover: .56, clouds: 1, banks: 1,
  glowR: .2, glow: 1, gapHi: .72, gapLo: .3, zenith: .2, bodyL: .24, rimL: .9, horizon: .6, fire: .8, drama: .5,
  night: 0, ring: 0, haze: 0, seed: 3,
};

// Returns {R, G, B (sky reference colour, palette-mapped later), txx, txy, tyy (unit tensors, normal to the flow),
// mx, my (material coordinates: the vortex turns slowly and its strokes turn with it)}.
// sun: {sx, sy, sr} analysis px; e: eclipse magnitude; obsc: visible-area loss (0..1); t: song time
export function skyField(F, mask, sk0, sun, P, t = 0) {
  const sk = { ...SKY_DEFAULTS, ...sk0 };
  const { aw, ah, N } = F, seed = (sk.seed | 0) * 7 + 3;
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  const txx = new Float32Array(N), txy = new Float32Array(N), tyy = new Float32Array(N), mx = new Float32Array(N), my = new Float32Array(N);
  const hzY = (sk.horizonY ?? sk.below ?? .5) * ah, S = sk.layoutScale ?? 2;
  const e = sun.e ?? 0, vis = 1 - (sun.obsc ?? 0), warm = sk.warm ?? sunWarmth(sk.alt);
  const sx = sun.sx, sy = sun.sy, vortexR = sk.vortex * aw, glowR = sk.glowR, twist = sk.twist, vert = sk.vert;
  const rot = (sk.rot ?? 0) + t * sk.rotSpeed, cr = Math.cos(rot), sr = Math.sin(rot);
  const night = sk.night, fire = sk.fire * (1 - .85 * e), drama = sk.drama;
  // palette anchors (OKLab)
  const T = n => { const c = P.tube(n) || [.5, .5, .5]; return rgb2lab(c[0], c[1], c[2], [0, 0, 0]); };
  const lead = T('leadWhite'), naples = T('naples'), ochre = T('yellowOchre'), sienna = T('burntSienna'), verm = T('vermilion'),
    madder = T('madder'), umber = T('rawUmber'), bumber = T('burntUmber'), verd = T('verdigris'), black = T('boneBlack');
  const mixL = (a, b, k, o) => { o[0] = a[0] + (b[0] - a[0]) * k; o[1] = a[1] + (b[1] - a[1]) * k; o[2] = a[2] + (b[2] - a[2]) * k; return o; };
  const cA = [0, 0, 0], cB = [0, 0, 0], cC = [0, 0, 0], rgb = [0, 0, 0];
  // cloud density in a frame wound around the sun: a log spiral near it, horizontal banks far away
  const dens = (x, y) => {
    const dx = x - sx, dy = (y - sy) * vert, r = Math.sqrt(dx * dx + dy * dy) + 1e-3;
    const wv = Math.exp(-r / vortexR);
    // rotate with time (the vortex turns), then wind: angle advances with log radius
    const ux = dx * cr + dy * sr, uy = -dx * sr + dy * cr;
    const th = Math.atan2(uy, ux), lr = Math.log(r / (vortexR * .25));
    const psi = th - twist * lr;
    const cpsi = Math.cos(psi), spsi = Math.sin(psi);
    // spiral domain: arms along psi, streaks along log r; domain warp keeps the tongues irregular
    const wq = fbm(cpsi * 1.3 + lr * .35 + 7.1, spsi * 1.3 - lr * .2 + 3.3, seed + 31, 3) - .5;
    const arm = .5 + .5 * Math.cos(sk.arms * psi + wq * 4.2);
    const streak = fbm(cpsi * 2.1 + lr * 1.9 + 11, spsi * 2.1 + lr * .6, seed, 4);
    const near = arm * .55 + streak * .75 - .1;
    // banks far from the sun: long horizontal cloud layers that flatten toward the horizon
    const hb = clamp(y / Math.max(hzY, 1)), bx = x / aw, by = y / aw;
    const bank = fbm(bx * 2.6 + .4 * fbm(bx * 1.3, by * 6, seed + 5, 2), by * (9 + 10 * hb), seed + 9, 4) * .85 + fbm(bx * 7 + 2.2, by * 24, seed + 13, 3) * .3;
    const d = lerp(bank * sk.banks, near, wv * .92);
    return sstep(sk.cover - .07, sk.cover + .08, d) * sk.clouds;
  };
  // evaluate on a coarse lattice (step q, the sky is low-frequency) and upsample bilinearly
  const q = sk.step ?? 3, gw = Math.ceil((aw - 1) / q) + 1, gh = Math.ceil((ah - 1) / q) + 1, GN = gw * gh;
  const C = [R, G, B, txx, txy, tyy, mx, my];
  const CG = C.map(() => new Float32Array(GN));
  const [qR, qG, qB, qxx, qxy, qyy, qmx, qmy] = CG;
  // which lattice points are needed: any sky within one lattice step
  const need = new Uint8Array(GN);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) if (mask[y * aw + x] >= .003) {
    const gx = Math.floor(x / q), gy = Math.floor(y / q);
    need[gy * gw + gx] = 1; if (gx + 1 < gw) need[gy * gw + gx + 1] = 1;
    if (gy + 1 < gh) { need[(gy + 1) * gw + gx] = 1; if (gx + 1 < gw) need[(gy + 1) * gw + gx + 1] = 1; }
  }
  const sample = (x, y, i) => {
    const dx = x - sx, dyr = y - sy, dy = dyr * vert, d = Math.sqrt(dx * dx + dy * dy) + 1e-3, dn = d / aw, dr = Math.sqrt(dx * dx + dyr * dyr) + 1e-3;
    const near0 = Math.exp(-dn / (glowR * 1.6));
    const cl = dens(x, y) * (1 - .78 * near0 * vis);                  // the sky opens around the sun
    // the side of a cloud that faces the sun is lit: density falls when stepping toward the sun
    const st = Math.min(8, d * .5), toward = dens(x - dx / dr * st, y - dyr / dr * st) * (1 - .78 * near0 * vis);
    const lit = clamp((cl - toward) * 2.6 + .25 * near0) * cl;
    const hz = clamp(y / Math.max(hzY, 1));
    // glow: an irregular painted halo whose strength follows the sun's visible area
    const ang = Math.atan2(dyr, dx), irr = 1 + .35 * (fbm(Math.cos(ang) * 2.3 + 5, Math.sin(ang) * 2.3 + 9, seed + 41, 3) - .5) * 2;
    const glow = (Math.exp(-dn / (glowR * .28)) * .55 + Math.exp(-dn / (glowR * irr)) * .4) * sk.glow * Math.pow(vis, 1.4);
    // clear sky ("gaps"): gold low and near the sun, darker madder-umber high; the horizon glows
    const gapL = lerp(sk.zenith, sk.gapHi, Math.pow(hz, 1.6) * sk.horizon + glow * .9) * (1 - .55 * e) * (1 - night * .85);
    const warmK = clamp(glow * 1.6 + hz * hz * .7 * sk.horizon);
    mixL(umber, verd, .35 * (1 - warmK), cA);                         // high clear sky: umber with a breath of verdigris
    mixL(cA, ochre, warmK * .9, cA); mixL(cA, naples, clamp(glow * 1.4 - .2), cA); mixL(cA, lead, clamp(glow * 2 - 1.1), cA);
    // cloud bodies: burnt umber / madder, a little lighter near the sun; fiery when drama is up
    const bodyL = lerp(sk.bodyL, sk.bodyL + .22, near0 * vis) * (1 - .5 * e) * (1 - night * .7);
    mixL(bumber, madder, .35 + .3 * drama, cB);
    // rims: lit edges, Naples near the sun, vermilion / sienna further out (Altdorfer's fire)
    const rimK = clamp(near0 * 1.3 + .15);
    mixL(verm, sienna, .4, cC); mixL(cC, ochre, rimK * .8, cC); mixL(cC, naples, clamp(rimK * 1.6 - .8), cC);
    const rimL = lerp(.55, sk.rimL, rimK) * (1 - .55 * e) * (1 - night * .8);
    // compose
    let L = lerp(gapL, bodyL, cl), a = lerp(cA[1], cB[1], cl), b = lerp(cA[2], cB[2], cl);
    const litK = lit * lerp(.55, 1, fire);
    L = lerp(L, rimL, litK); a = lerp(a, cC[1] * lerp(.6, 1.15, fire), litK); b = lerp(b, cC[2] * lerp(.7, 1.1, fire), litK);
    // drama: deepen the clear sky away from the sun so the tongues of fire read against umber (f2_bronze)
    const far = 1 - near0;
    L *= 1 - drama * .45 * far * (1 - cl) * (1 - hz * .6);
    // eclipse drain: chroma falls, a cool steel tint creeps in (before the band and the corona light, which keep theirs)
    const chroma = 1 - .72 * e;
    a *= chroma; b = b * chroma - .006 * e;
    // totality: a luminous 360-degree sunset band on the horizon under the dark dome, brightest away from the sun's
    // azimuth: orange at the line, gold above it, fading into the violet-umber dome
    if (sk.ring > 0) {
      const dyb = (hzY - y) / ah, band = Math.exp(-Math.pow(dyb / (.03 + .045 * sk.ring), 2)) * Math.min(1, sk.ring);
      const az = .7 + .3 * sstep(.05, .45, Math.abs(x - sx) / aw);
      const k = clamp(band * az * (sk.ring > 1 ? 1 + .25 * (sk.ring - 1) : 1));
      const hot = Math.exp(-Math.pow(dyb / .018, 2));                  // the hot line right on the horizon
      L = lerp(L, .66 + .14 * hot, k * .92);
      a = lerp(a, lerp(ochre[1], verm[1], .55 + .25 * hot) * .95, k); b = lerp(b, lerp(naples[2], ochre[2], .5 + .4 * hot), k);
    }
    // the corona's light on the sky (a base for the painted fibres): pearl, falling off fast from the limb, fibrous
    if (sk.corona && sk.corona.k > 0) {
      const C = sk.corona, cdx = x - C.x, cdy = y - C.y, cr = Math.sqrt(cdx * cdx + cdy * cdy);
      if (cr > C.R * .98) {
        const ca = Math.atan2(cdy, cdx), fib = .75 + .5 * vnoise(ca * 9 + 3, Math.log(cr / C.R) * 4, seed + 61);
        // a photograph's corona glow is not round: it follows the streamers (C.asym), the coronal holes stay dark
        let env = 1;
        if (C.asym) {
          const d1 = Math.atan2(Math.sin(ca - (C.tilt ?? -.35) - .1), Math.cos(ca - (C.tilt ?? -.35) - .1)), d2 = Math.atan2(Math.sin(ca - (C.tilt ?? -.35) - 3.0), Math.cos(ca - (C.tilt ?? -.35) - 3.0));
          const reach = .35 + 1.2 * Math.exp(-d1 * d1 / .3) + .9 * Math.exp(-d2 * d2 / .22);
          env = lerp(1, Math.min(1.4, reach) * Math.pow(Math.min(1, reach * C.R / Math.max(cr - C.R * .7, 1e-3)), .6), C.asym);
        }
        const k = C.k * Math.pow(C.R / cr, C.fall ?? 2.6) * fib * env;
        L = lerp(L, .9, clamp(k * .85)); a = lerp(a, naples[1] * .4, clamp(k)); b = lerp(b, naples[2] * .5, clamp(k));
      }
    }
    if (sk.haze > 0) { const hk = sk.haze * Math.pow(hz, 2); L = lerp(L, .55, hk * .5); a = lerp(a, naples[1], hk * .5); b = lerp(b, naples[2], hk * .5); }
    L = clamp(L, .03, .98);
    lab2rgb(L, a, b, rgb);
    P.map(rgb[0], rgb[1], rgb[2], cA);
    qR[i] = cA[0]; qG[i] = cA[1]; qB[i] = cA[2];
    // stroke direction: log-spiral tangent near the sun, banks elsewhere (as unit tensors normal to the flow)
    const wv = Math.exp(-d / (vortexR * 1.25));
    const er0 = dx / d, er1 = dy / d, et0 = -er1, et1 = er0;           // radial / tangential in the flattened frame
    let fx = er0 + twist * et0 * 1.0, fy = er1 + twist * et1 * 1.0;   // along the arm: dr (e_r + twist e_theta)
    fy /= vert; let fm = Math.sqrt(fx * fx + fy * fy) || 1; fx /= fm; fy /= fm;
    const wob = (fbm(x / aw * 4, y / aw * 9, seed + 21, 2) - .5) * .9;
    let hx = Math.cos(wob), hy = Math.sin(wob) * .45; fm = Math.sqrt(hx * hx + hy * hy); hx /= fm; hy /= fm;
    const nx1 = -fy, ny1 = fx, nx2 = -hy, ny2 = hx;
    qxx[i] = wv * nx1 * nx1 + (1 - wv) * nx2 * nx2; qxy[i] = wv * nx1 * ny1 + (1 - wv) * nx2 * ny2; qyy[i] = wv * ny1 * ny1 + (1 - wv) * ny2 * ny2;
    // material coordinates (layout px): turning with the vortex near the sun, drifting slowly far from it
    const ang2 = -rot * wv, c2 = Math.cos(ang2), s2 = Math.sin(ang2);
    qmx[i] = (sx + dx * c2 - dyr * s2) * S + (1 - wv) * t * (sk.drift ?? 3); qmy[i] = (sy + dx * s2 + dyr * c2) * S;
    };
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) { const ci = gy * gw + gx; if (need[ci]) sample(Math.min(aw - 1, gx * q), Math.min(ah - 1, gy * q), ci); }
  const iq = 1 / q;
  for (let y = 0; y < ah; y++) {
    const fy0 = y * iq, gy = Math.min(gh - 2, fy0 | 0), fy = Math.min(1, fy0 - gy);
    for (let x = 0; x < aw; x++) {
      const i = y * aw + x; if (mask[i] < .003) continue;
      const fx0 = x * iq, gx = Math.min(gw - 2, fx0 | 0), fx = Math.min(1, fx0 - gx), o = gy * gw + gx;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      for (let c = 0; c < 8; c++) { const A = CG[c]; C[c][i] = A[o] * w00 + A[o + 1] * w10 + A[o + gw] * w01 + A[o + gw + 1] * w11; }
    }
  }
  return { R, G, B, txx, txy, tyy, mx, my };
}
export { vnoise, hash3 };
