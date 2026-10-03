// index.js: the brush engine's public API (see README.md).
//
//   const src = await resolvePlate(f, 'P07', { id: 'a_duel', cam });     // or stillSource / plateSource / canvasSource
//   const look = await paint(f, src, { palette: 'bronze', pool: [...], lightDir: [-.75, -.66], sky: {...}, sun: {...},
//                                      eclipse: .3, impasto: .55, strokeScale: 1, focus: [...], seed: 7 });
//
// paint() draws the whole frame into f.g (or opts.target) and returns `look`: the light (direction, colour, pools),
// the sun/moon disk in frame uv and px, timings and stroke counts: what the type module needs to light CARVED letters.

import { clamp, lerp, sstep, hash4, TAU, mix3 } from './util.js';
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
  brushes: [26, 14, 8, 4.4, 2.4], fg: [1.45, 1.3, 1.15, 1.05, 1.0], T: [0, .055, .06, .07, .075],
  minLen: [2, 2, 2, 1, 1], maxLen: [6, 6, 5, 4, 3], step: [1.05, 1.0, .95, .85, .8], fc: .45, maxTurn: .38, fs: .5,
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
  const fade = Math.max(0, 1 - e / .75) * (cfg.sun.glowStrokes ?? 1), dim = 1 - .45 * e * e;
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

// rotate stroke points about a centre by an angle that falls off with radius (the rewind's swirl)
function swirlStrokes(list, sw) {
  const { cx, cy, amount, radius } = sw, rs = radius;
  for (const s of list) {
    s.pts = s.pts.map(([x, y]) => {
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy), a = amount * Math.exp(-r / rs) * (sw.falloff ? 1 : 1);
      const c = Math.cos(a), sn = Math.sin(a);
      const k = sw.pull ? 1 - sw.pull * Math.exp(-r / rs) : 1;
      return [cx + (dx * c - dy * sn) * k, cy + (dx * sn + dy * c) * k];
    });
    if (sw.smear && s.pts.length >= 2) {           // smear: drag the tail backwards along the swirl
      const [x, y] = s.pts[s.pts.length - 1], dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy) || 1, a = -sw.smear * Math.exp(-r / rs);
      s.pts.push([cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]);
    }
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
  const F0 = analysisOf(src); ms.analysis = Math.round(performance.now() - t0); t0 = performance.now();
  const { aw, ah, N } = F0, S = W / aw;
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
    const jup = s.jupiter ? (() => { const [jx, jy] = eclipse.jupiterAt(sd, s.jupiter.ppd); return [jx, jy, Math.max(2, 2.6 * u * (s.jupiter.size ?? 1)), s.jupiter.k ?? 1]; })() : null;
    sunSpec = { cx: sd.cx, cy: sd.cy, r: sd.r, mx: sd.mx, my: sd.my, mr: sd.mr, e: sd.off >= 1 + eclipse.K ? 0 : sd.e, moonVis: s.moonVis ?? sstep(.975, .995, sd.e),
      beads: s.beads ? eclipse.beads(sd, s.beadSeed ?? 5, s.beads === true ? 1 : s.beads) : [], ring: s.ring ? eclipse.diamondRing(sd, s.ring, s.ringAng) : null,
      jup, limb: s.limb || null, warm: sunWarmth(s.alt ?? 9), blaze: s.blaze ?? 1.45, sunVis: s.vis ?? 1, mask, aw, ah, boil: (drawIdx % 97) * cfg.boil, dark: s.dark };
  }
  const painter = getPainter(W, H);
  const st = rasterize(painter, list, cfg, sunSpec);
  const target = opts.target || f.g;
  if (target) { target.save(); target.setTransform(1, 0, 0, 1, 0, 0); target.globalAlpha = 1; target.globalCompositeOperation = 'source-over'; target.drawImage(painter.glw.canvas, 0, 0, W, H); target.restore(); }
  ms.gpu = Math.round(performance.now() - t0);
  // what the type module needs: the light (direction, colour), the sun/moon disk
  const look = {
    light: { dir: cfg.lightDir, color: cfg.lightColor || (cfg.eclipse > .6 ? '#d9d4c8' : '#f3c977'), pools: cfg.pool, warm: 1 - clamp(cfg.eclipse ?? 0) },
    sun: sd ? { x: sd.cx / W, y: sd.cy / H, r: sd.r / W, px: [sd.cx, sd.cy, sd.r], moon: [sd.mx, sd.my, sd.mr], e: sd.e, off: sd.off } : null,
    eclipse: cfg.eclipse ?? 0, strokes: st.nStrokes, perLayer: per, ms,
  };
  f.look = Object.assign(f.look || {}, look);
  return look;
}

// the painter's GL canvas (after paint): for transitions that need to keep a painted frame
export const painterCanvas = f => getPainter(f.W, f.H).glw.canvas;
