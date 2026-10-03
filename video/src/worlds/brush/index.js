// index.js: the brush engine's public API (see README.md).
//
//   const src = await resolvePlate(f, 'P07', { id: 'a_duel', cam });     // or stillSource / plateSource / canvasSource
//   const look = await paint(f, src, { palette: 'bronze', pool: [...], lightDir: [-.75, -.66], sky: {...}, sun: {...},
//                                      eclipse: .3, impasto: .55, strokeScale: 1, focus: [...], seed: 7 });
//
// paint() draws the whole frame into f.g (or opts.target) and returns `look`: the light (direction, colour, pools),
// the sun/moon disk in frame uv and px, timings and stroke counts: what the type module needs to light CARVED letters.

import { clamp, lerp, sstep, hash4, TAU, mix3, blurFast } from './util.js';
import { getPalette } from './palette.js';
import { analyze, withTensor } from './fields.js';
import { reference, eclipseCfg } from './light.js';
import { skyMask, skyField, sunWarmth } from './sky.js';
import { placeStrokes, accents, eyeGeometry, eyeMaskOf, eyeStrokes } from './strokes.js';
import { getPainter, rasterize } from './raster.js';
import * as eclipse from './eclipse.js';
import { LRU } from './util.js';

export * from './sources.js';
export { eclipse, getPalette };
export { coronaStrokes, beads, diamondRing, sunDisk, moonOffset, magnitude, obscuration, jupiterAt, jupiterVis, C1, C2 } from './eclipse.js';

export const DEFAULTS = {
  palette: 'bronze',
  pool: [{ x: .5, y: .45, rx: .3, ry: .35, rot: 0, feather: .6 }],
  poolMatte: .85, poolBound: null, poolBlur: 4, poolLo: .1, poolHi: .8,
  gammaIn: .9, liftIn: 1.1, contrastIn: 1.22, satIn: 1.2, warmIn: .024, crushFloor: .15, crush: .12, satOut: .55, darkVar: .055,
  glint: .85, glintT: .72, glintReach: 14, envDim: .62, focusLift: .25,
  lightDir: [-.75, -.66], rim: .6, rimBreak: .5, fringe: 1,
  brushes: [26, 14, 8, 4.4, 2.4], fg: [1.75, 1.45, 1.25, 1.1, 1.0], T: [0, .055, .06, .07, .075],
  minLen: [2, 2, 2, 1, 1], maxLen: [4, 4, 4, 3, 3], step: [1.05, 1.0, .95, .85, .8], fc: .45, maxTurn: .38, fs: .5,
  jitter: .8, boil: .3, boilColor: .25, colorJit: .055, endBlend: .15, focusGain: .7, darkRaise: 1.3, midGate: .15, fineGate: .2, smoothRef: 1,
  thinDark: .05, thick: .34, thickHi: .55, impasto: .55, spec: .18, weave: 1, crack: .25, varnish: .85, vignette: .35,
  accents: 1, accentThick: 1.5, eyes: [], eyeStrokes: 1, faceMin: null, seed: 7,
  sky: null, sun: null, eclipse: 0, metal: 0, strokeScale: 1,
};

const _an = new LRU(3);
function analysisOf(src) {
  let F = src.key ? _an.get(src.key) : null;
  if (!F) { F = analyze(src); if (src.key) _an.set(src.key, F); }
  return F;
}

// loose painted glow around the sun: tangential and broken radial strokes bleeding the disk into the sky (no rings)
function sunGlowStrokes(sd, mask, aw, ah, S, pal, cfg, drawIdx, warm) {
  const out = [], seed = (cfg.seed | 0) * 97 + 5, bs = seed + drawIdx * 7919;
  const { cx, cy, r, mx, my, mr, e } = sd;
  const T = n => pal.tube(n) || [1, 1, 1];
  const lead = T('leadWhite'), naples = T('naples'), ochre = T('yellowOchre'), verm = T('vermilion');
  const gold = mix3(naples, verm, .28 * warm), inner = mix3(lead, naples, .35 + .4 * warm), outer = mix3(ochre, verm, .22 * warm);
  const metal = (c, k) => { const m = .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; return [lerp(c[0], m, k), lerp(c[1], m, k), lerp(c[2], m * 1.02, k)]; };
  const inSky = (x, y) => { const ax = clamp(Math.round(x / S), 0, aw - 1), ay = clamp(Math.round(y / S), 0, ah - 1); return mask[ay * aw + ax] > .5; };
  const inMoon = (x, y) => e > .005 && Math.hypot(x - mx, y - my) < mr;
  const add = (pts, w, c0, c1, a, thick, sd2) => out.push({ pts, r: w, c0, c1, a, thick, seed: sd2, key: sd2, layer: 8 });
  const fade = Math.max(0, 1 - e / .75) * (cfg.sun.glowStrokes ?? 0), dim = 1 - .45 * e * e;
  if (fade <= 0) return out;
  for (let j = 0; j < 16; j++) {
    const a0 = hash4(j, 1, seed, 0) * TAU, rad = r * (1.08 + .7 * Math.pow(hash4(j, 2, seed, 0), 1.5)), span = (.18 + .4 * hash4(j, 3, seed, 0)) * (1 + .1 * (hash4(j, 3, bs, 0) - .5));
    const pts = []; for (let q = 0; q <= 5; q++) { const a = a0 + span * q / 5, rr = rad * (1 + .08 * (q / 5) * (hash4(j, 9, seed, 0) - .5)); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; if (!inSky(x, y) || inMoon(x, y)) break; pts.push([x, y]); }
    const t = (rad / r - 1) / .8;
    if (pts.length >= 2) add(pts, Math.max(2, r * (.06 + .06 * hash4(j, 4, seed, 0))), metal(mix3(inner, gold, t), e * .8).map(v => v * dim), metal(mix3(gold, outer, t), e * .8).map(v => v * dim), (.55 + .3 * hash4(j, 6, seed, 0)) * fade, .45, hash4(j, 5, seed, 0));
  }
  for (let j = 0; j < 11; j++) {
    const ang = (j + hash4(j, 11, seed, 0) * .8) / 11 * TAU, len = r * (.6 + 1.3 * hash4(j, 12, seed, 0) + .12 * (hash4(j, 12, bs, 0) - .5));
    let rr = r * (1.02 + .06 * hash4(j, 13, seed, 0)); const pieces = 2 + Math.floor(hash4(j, 14, seed, 0) * 2);
    for (let q = 0; q < pieces && rr < r + len; q++) {
      const segL = len / pieces * (.55 + .35 * hash4(j, 15 + q, seed, 0)), pts = [];
      for (let u = 0; u <= 3; u++) { const rad = rr + segL * u / 3, aa = ang + .04 * Math.sin(u + j); const x = cx + Math.cos(aa) * rad, y = cy + Math.sin(aa) * rad; if (!inSky(x, y) || inMoon(x, y)) break; pts.push([x, y]); }
      const t = (rr - r) / len;
      if (pts.length >= 2) add(pts, Math.max(1.8, r * (.07 - .03 * t)), metal(mix3(inner, gold, t), e * .8).map(v => v * dim), metal(mix3(gold, outer, t + .3), e * .8).map(v => v * dim), (.7 - .3 * t) * fade, .5 * (1 - t), hash4(j, 16 + q, seed, 0));
      rr += segL * (1.25 + .4 * hash4(j, 20 + q, seed, 0));
    }
  }
  return out;
}

// the rewind's whirl: every stroke turns toward the vortex around (cx, cy) about its own centre and is dragged out along
// it (the brushwork whirls, the picture stays legible); the picture itself only drifts a little around the centre
function swirlStrokes(list, sw) {
  const { cx, cy, amount, radius } = sw;
  for (const s of list) {
    const P = s.pts, n = P.length; if (n < 2) continue;
    let mx = 0, my = 0; for (const [x, y] of P) { mx += x; my += y; } mx /= n; my /= n;
    const dx = mx - cx, dy = my - cy, r = Math.hypot(dx, dy) || 1, fall = Math.exp(-r / radius);
    // drift of the stroke centre around the vortex (small)
    const a = amount * .18 * fall, ca = Math.cos(a), sa = Math.sin(a);
    const nx = cx + dx * ca - dy * sa, ny = cy + dx * sa + dy * ca;
    // the stroke's own direction turned toward the tangent (sense of the swirl), by a weight that grows with |amount|
    const ex = P[n - 1][0] - P[0][0], ey = P[n - 1][1] - P[0][1], el = Math.hypot(ex, ey) || 1;
    const sg = amount < 0 ? -1 : 1, tx = -dy / r * sg, ty = dx / r * sg;
    const cur = Math.atan2(ey, ex), want = Math.atan2(ty, tx);
    let d = want - cur; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) > Math.PI / 2) d = d > 0 ? d - Math.PI : d + Math.PI;            // strokes have no head: turn the short way
    const w = Math.min(1, Math.abs(amount) / 2.5) * (.35 + .65 * fall), rot = d * w, cr = Math.cos(rot), sr = Math.sin(rot);
    const stretch = 1 + (sw.smear || 0) * (.6 + 1.4 * fall);
    const ux = Math.cos(cur + rot), uy = Math.sin(cur + rot);
    s.pts = P.map(([x, y]) => {
      let px = x - mx, py = y - my;
      const qx = px * cr - py * sr, qy = px * sr + py * cr;
      const along = qx * ux + qy * uy;                     // stretch along the (turned) stroke direction
      return [nx + qx + ux * along * (stretch - 1), ny + qy + uy * along * (stretch - 1)];
    });
    if (sw.pull) { const k = 1 - sw.pull * fall; s.pts = s.pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]); }
  }
}

export async function paint(f, src, opts = {}) {
  const ms = {}; let t0 = performance.now();
  const W = f.W, H = f.H, u = f.L ? f.L.u : H / 1080;
  const pal = getPalette(opts.palette || 'bronze');
  let cfg = { ...DEFAULTS, ...opts, _pal: pal };
  cfg.ground = opts.ground || pal.spec.ground; cfg.varnishCol = opts.varnishCol || pal.spec.varnish;
  if (u !== 1) cfg.brushes = cfg.brushes.map(b => b * u);
  cfg = eclipseCfg(cfg);
  let F0 = analysisOf(src); ms.analysis = Math.round(performance.now() - t0); t0 = performance.now();
  const { aw, ah, N } = F0, S = W / aw;
  // depth silhouettes as the matte when the plate's matte is missing or weak (crowds, spears)
  if (cfg.matteFromDepth && F0.D) {
    const [lo, hi] = cfg.matteFromDepth, M = new Float32Array(N);
    for (let i = 0; i < N; i++) M[i] = Math.max(F0.M && cfg.keepMatte ? F0.M[i] : 0, sstep(lo, hi, F0.D[i]));
    F0 = { ...F0, M };
  }
  // faces (plate meta / stand-in detections) become focus regions: the small brushes work on the face, eyes and mouth
  if (cfg.faceMin != null) {
    const extra = (F0.faces || []).filter(q => (q.score ?? 1) >= cfg.faceMin && q.eyes && q.eyes.length >= 2).flatMap(q => {
      const [u0, v0, u1, v1] = q.box, ex = (q.eyes[0][0] + q.eyes[1][0]) / 2, ey = (q.eyes[0][1] + q.eyes[1][1]) / 2, k = cfg.faceK ?? 1;
      return [{ x: (u0 + u1) / 2, y: (v0 + v1) / 2, rx: (u1 - u0) * .45, ry: (v1 - v0) * .5, k: .75 * k },
        ...q.eyes.map(e => ({ x: e[0], y: e[1], rx: (u1 - u0) * .12, ry: (v1 - v0) * .1, k })),
        { x: ex, y: ey + (v1 - v0) * .42, rx: (u1 - u0) * .18, ry: (v1 - v0) * .1, k: .8 * k }];
    });
    if (extra.length) cfg = { ...cfg, focus: [...(cfg.focus || []), ...extra] };
  }
  const drawIdx = opts.drawIdx ?? Math.round(f.t * (f.cad || 12));
  // the sun (frame uv) -> analysis px; the moon from the eclipse clock unless the scene scripts it
  let sd = null;
  if (cfg.sun) {
    const s = cfg.sun, off = s.off ?? eclipse.moonOffset(f.t);
    sd = eclipse.sunDisk(s.x * W, s.y * H, s.r * W, off, s.dir || eclipse.MOON_DIR);
    sd.obsc = eclipse.obscuration(off);
  }
  let ref = reference(F0, cfg, pal), F = F0, mat = src.mat || null, skyInfo = null;
  ms.reference = Math.round(performance.now() - t0); t0 = performance.now();
  if (cfg.sky) {
    const mask = src.sky ? Float32Array.from(src.sky) : skyMask(F0, cfg.sky);
    const sunA = sd ? { sx: sd.cx / S, sy: sd.cy / S, sr: sd.r / S, e: sd.e, obsc: sd.obsc } : { sx: aw * .5, sy: ah * .2, sr: 10, e: 0, obsc: 0 };
    const sk = { ...cfg.sky, alt: cfg.sky.alt ?? cfg.sun?.alt ?? 9, layoutScale: S, below: cfg.sky.below };
    if (cfg.corona && sd && cfg.corona.glow !== 0) sk.corona = { x: sd.mx / S, y: sd.my / S, R: sd.mr / S, k: (cfg.corona.k ?? 1) * (cfg.corona.glow ?? .55) };
    const Sf = skyField(F0, mask, sk, sunA, pal, f.t);
    const R = ref.R.slice(), G = ref.G.slice(), B = ref.B.slice(), L = ref.L.slice(), pool = ref.pool.slice(), focus = ref.focus.slice();
    const skyPool = cfg.sky.pool ?? .5;
    for (let i = 0; i < N; i++) {
      const m = mask[i]; if (m <= 0) continue;
      R[i] = lerp(R[i], Sf.R[i], m); G[i] = lerp(G[i], Sf.G[i], m); B[i] = lerp(B[i], Sf.B[i], m);
      L[i] = .2126 * R[i] + .7152 * G[i] + .0722 * B[i]; pool[i] = lerp(pool[i], skyPool, m);
    }
    if (sd) for (let y = Math.max(0, Math.floor(sunA.sy - sunA.sr * 3)); y < Math.min(ah, sunA.sy + sunA.sr * 3); y++)
      for (let x = Math.max(0, Math.floor(sunA.sx - sunA.sr * 3)); x < Math.min(aw, sunA.sx + sunA.sr * 3); x++) {
        const i = y * aw + x, d = Math.hypot(x - sunA.sx, y - sunA.sy) / sunA.sr;
        focus[i] = Math.max(focus[i], (1 - sstep(1, 2.6, d)) * mask[i]);
      }
    F = withTensor(F0, { xx: Sf.txx, xy: Sf.txy, yy: Sf.tyy }, mask);
    if (mat || cfg.sky.advect !== false) {
      const mx = mat ? mat.mx.slice() : new Float32Array(N), my = mat ? mat.my.slice() : new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const m = mask[i];
        if (!mat) { mx[i] = (i % aw) * S; my[i] = Math.floor(i / aw) * S; }
        if (m > .5) { mx[i] = Sf.mx[i]; my[i] = Sf.my[i]; }
      }
      mat = { mx, my };
    }
    ref = { ...ref, R, G, B, L, pool, focus, sky: mask };
    skyInfo = { mask };
  }
  ms.sky = Math.round(performance.now() - t0); t0 = performance.now();
  if (opts.debug) { debugBlit(f, opts.target || f.g, opts.debug, { src, F: F0, ref, mat }); return { ms }; }
  const eyes = cfg.eyeStrokes ? eyeGeometry(F0, cfg) : [];
  const list = placeStrokes(F, ref, cfg, drawIdx, mat, eyeMaskOf(F0, eyes), W);
  const per = list.perLayer;
  if (cfg.accents) list.push(...accents(F0, ref, cfg, drawIdx, pal, W));
  if (sd && skyInfo) list.push(...sunGlowStrokes(sd, skyInfo.mask, aw, ah, S, pal, cfg, drawIdx, sunWarmth(cfg.sun.alt ?? 9)));
  if (eyes.length) list.push(...eyeStrokes(F0, cfg, eyes, drawIdx, pal, W));
  if (cfg.corona && sd) {
    const c = cfg.corona, mask = skyInfo ? skyInfo.mask : null;
    const clip = mask ? (x, y) => { const ax = clamp(Math.round(x / S), 0, aw - 1), ay = clamp(Math.round(y / S), 0, ah - 1); return mask[ay * aw + ax] > .5; } : null;
    list.push(...eclipse.coronaStrokes({ cx: sd.mx, cy: sd.my, R: sd.mr, pal, t: f.t, clip, ...c }));
  }
  if (opts.strokes) { const extra = typeof opts.strokes === 'function' ? opts.strokes({ F: F0, ref, sd, S, aw, ah, pal, drawIdx, mask: skyInfo && skyInfo.mask }) : opts.strokes; list.push(...extra); }
  if (cfg.swirl) swirlStrokes(list, cfg.swirl);
  ms.strokes = Math.round(performance.now() - t0); t0 = performance.now();
  let sunSpec = null;
  if (sd) {
    const s = cfg.sun, mask = skyInfo ? skyInfo.mask : (src.sky || new Float32Array(N).fill(1));
    const jup = s.jupiter ? (() => { const [jx, jy] = s.jupiter.x != null ? [s.jupiter.x * W, s.jupiter.y * H] : eclipse.jupiterAt(sd, s.jupiter.ppd); return [jx, jy, Math.max(2, 2.6 * u * (s.jupiter.size ?? 1)), s.jupiter.k ?? 1]; })() : null;
    sunSpec = { cx: sd.cx, cy: sd.cy, r: sd.r, mx: sd.mx, my: sd.my, mr: sd.mr, e: sd.off >= 1 + eclipse.K ? 0 : sd.e, moonVis: s.moonVis ?? sstep(.975, .995, sd.e),
      beads: s.beads ? eclipse.beads(sd, s.beadSeed ?? 5, s.beads === true ? 1 : s.beads) : [], ring: s.ring ? eclipse.diamondRing(sd, s.ring, s.ringAng) : null,
      jup, limb: s.limb || null, warm: sunWarmth(s.alt ?? 9), blaze: s.blaze ?? 1.45, sunVis: s.vis ?? 1, mask, aw, ah, boil: (drawIdx % 97) * cfg.boil, dark: s.dark };
  }
  // the lay-in under the strokes: the reference blurred at the first brush's scale
  if (cfg.underAlpha !== 0) {
    const sg = cfg.brushes[0] / S * .5, Rb = blurFast(ref.R, aw, ah, sg), Gb = blurFast(ref.G, aw, ah, sg), Bb = blurFast(ref.B, aw, ah, sg);
    const data = new Uint8Array(N * 4);
    for (let i = 0; i < N; i++) { data[i * 4] = Rb[i] * 255; data[i * 4 + 1] = Gb[i] * 255; data[i * 4 + 2] = Bb[i] * 255; data[i * 4 + 3] = 255; }
    cfg._under = { w: aw, h: ah, data };
  }
  const painter = getPainter(W, H);
  const over = opts.overStrokes ? (typeof opts.overStrokes === 'function' ? opts.overStrokes({ F: F0, ref, sd, S, aw, ah, pal, drawIdx }) : opts.overStrokes) : null;
  const st = rasterize(painter, list, cfg, sunSpec, over);
  const target = opts.target || f.g;
  if (target) { target.save(); target.setTransform(1, 0, 0, 1, 0, 0); target.globalAlpha = 1; target.globalCompositeOperation = 'source-over'; target.drawImage(painter.glw.canvas, 0, 0, W, H); target.restore(); }
  ms.gpu = Math.round(performance.now() - t0);
  // what the type module needs: the light (direction, colour), the sun/moon disk
  const look = {
    light: { dir: cfg.lightDir, color: cfg.lightColor || (cfg.eclipse > .6 ? '#d9d4c8' : '#f3c977'), pools: cfg.pool, warm: 1 - clamp(cfg.eclipse ?? 0) },
    sun: sd ? { x: sd.cx / W, y: sd.cy / H, r: sd.r / W, px: [sd.cx, sd.cy, sd.r], moon: [sd.mx, sd.my, sd.mr], e: sd.e, off: sd.off } : null,
    eclipse: cfg.eclipse ?? 0, strokes: st.nStrokes, perLayer: per, ms, gpu: st.tm, ntri: st.ntri, place: list.tm,
  };
  f.look = Object.assign(f.look || {}, look);
  return look;
}

// debug views: 'src' (the plate crop), 'ref' (the relit reference), 'pool' (R pool, G focus, B sky), 'mat' (material grid)
function debugBlit(f, g, mode, { src, F, ref, mat }) {
  const aw = F.aw, ah = F.ah, id = new ImageData(aw, ah), d = id.data;
  for (let i = 0; i < aw * ah; i++) {
    let r, gg, b;
    if (mode === 'src') { r = src.R[i]; gg = src.G[i]; b = src.B[i]; }
    else if (mode === 'pool') { r = ref.pool[i]; gg = ref.focus[i]; b = ref.sky ? ref.sky[i] : 0; }
    else if (mode === 'mat' && mat) { const c = ((Math.floor(mat.mx[i] / 40) + Math.floor(mat.my[i] / 40)) & 1); r = gg = b = c ? .8 : .2; r *= .5 + .5 * (src.R[i]); }
    else if (mode === 'depth') { r = gg = b = F.D ? F.D[i] : 0; }
    else if (mode === 'matte') { r = gg = b = F.M ? F.M[i] : 0; }
    else { r = ref.R[i]; gg = ref.G[i]; b = ref.B[i]; }
    d[i * 4] = r * 255; d[i * 4 + 1] = gg * 255; d[i * 4 + 2] = b * 255; d[i * 4 + 3] = 255;
  }
  const c = new OffscreenCanvas(aw, ah); c.getContext('2d').putImageData(id, 0, 0);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(c, 0, 0, f.W, f.H); g.restore();
}

// the painter's GL canvas (after paint): for transitions that need to keep a painted frame
export const painterCanvas = f => getPainter(f.W, f.H).glw.canvas;
