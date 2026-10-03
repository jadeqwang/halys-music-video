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
const K = eclipse.K;

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
  brushes: [26, 14, 8, 4.4, 2.4], fg: [2.0, 1.5, 1.25, 1.1, 1.0], T: [0, .055, .06, .075, .085],
  minLen: [2, 2, 2, 1, 1], maxLen: [3, 4, 4, 3, 3], step: [1.05, 1.0, .95, .85, .8], fc: .45, maxTurn: .38, fs: .5,
  jitter: .8, boil: .3, boilColor: .25, colorJit: .055, endBlend: .15, focusGain: .7, darkRaise: 1.3, midGate: .18, fineGate: .26, smoothRef: 1,
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

// THE SUN, PAINTED. The sun pass (raster.js SUN_FS) lays the disk in as a flat hot underpaint a little inside the limb;
// these strokes build it and finish its edge in the engine's own brushwork (bristles, impasto, varnish): broad strokes
// of the hottest paint in the core, close in value so it still blazes; loaded strokes that follow the limb and make the
// silhouette, each a little off the circle, deeper gold, varied in length and value; flicks of limb paint lifting off
// along the edge; and sky-coloured strokes cutting back in over it. Laid out in sun-local polar coordinates, every
// stroke indexed and seeded for good (it rides with the sun as it moves and scales); only a small jitter changes per
// drawing, so the limb boils at 12 drawings a second and never strobes. A stroke's seed carries its mode in its integer
// part (raster.js SUNSTROKE_FS): 0 sun paint (the moon's disk turns it dark, so the bite stays a clean curve), 1 limb
// paint lifted into the sky (the moon removes it), 2 sky paint (it stops at the black disk at totality).
// sun.paint (default 1) scales how far the limb breaks; 0 (or false) is the exact flat disk.
function sunPaintStrokes(sun, o) {
  const out = [], k = sun.paint ?? 1, r = sun.r;
  if (!(k > 0) || !(r >= 2.5) || (sun.sunVis ?? 1) <= 0) return out;
  const { pal, cfg, drawIdx, mask, canvas, aw, ah, S } = o, u = o.u || 1;
  const cx = sun.cx, cy = sun.cy, e = sun.e || 0;
  const seed = ((cfg.seed | 0) * 131 + 977) | 0, bs = seed + drawIdx * 7919;
  const H = (j, q) => hash4(j, q, seed, 41), B = (j, q) => hash4(j, q, bs, 43) - .5;
  // the disk's colours, exactly as the sun pass mixes them (golden-orange when low, a pale hot core)
  const T = n => pal.tube(n) || [1, 1, 1];
  const lead = T('leadWhite'), nap = T('naples'), ver = T('vermilion'), ochre = T('yellowOchre');
  const warm = sun.warm ?? 0, blaze = sun.blaze ?? 1.3, metal = (cfg.metal ?? 0) * .5;
  const gold = mix3(nap, ver, .3), core = mix3(lead, nap, .2 + .6 * warm), limbC = mix3(nap, gold, .35 + .55 * warm);
  const met = c => { if (!metal) return c; const l = .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; return [lerp(c[0], l * .98, metal), lerp(c[1], l, metal), lerp(c[2], l * 1.02, metal)]; };
  const sunAt = rho => mix3(core, limbC, .25 + .75 * sstep(.78, 1.02, rho / r));
  const paint = (c, mul) => met([c[0] * mul * blaze, c[1] * mul * blaze, c[2] * mul * blaze]);
  // the limb's irregularity (px): a few % of the radius, never under ~1.5 px. It calms as the crescent thins (its
  // thickness, in radii, is the moon's offset less K - 1), so a thin crescent keeps a clean outer limb and the eclipse's
  // true geometry: the crescent of an actual eclipse
  const off = Math.hypot(sun.mx - cx, sun.my - cy) / r, thin = e > .0005 ? clamp((off - (K - 1)) / .4) : 1;
  if (e > .0005 && off < K - 1 - .002) return out;               // totality: the moon covers it all (the black disk stays exact)
  const rough = k * Math.pow(thin, .85), A = rough * Math.max(.03 * r, 1.6 * u);
  sun.rough = A * .6; sun.paintK = rough;                      // (the underpaint reaches the true limb as the limb calms: raster.js SUN_FS)
  const hwL = clamp(r * .08, 1.3 * u, 14 * u);
  const P = (th, rr) => [cx + Math.cos(th) * rr, cy + Math.sin(th) * rr];
  const arc = (th0, span, rho0, rho1, n) => { const p = []; for (let q = 0; q <= n; q++) { const s = q / n; p.push(P(th0 + span * (s - .5), lerp(rho0, rho1, s))); } return p; };
  const add = (pts, hw, c0, c1, a, thick, mode, sd, taper = .72) => out.push({ pts, r: Math.max(.8, hw), c0, c1, a: a * (sun.sunVis ?? 1), thick, seed: mode + sd * .999, key: 0, layer: 11, taper, maxSeg: 14 });
  const segs = span => clamp(Math.round(Math.abs(span) * 6), 3, 8);
  const dir = (id, span) => H(id, 0) < .8 ? span : -span;          // most strokes go round the same way, as one hand would
  // 1. the core: broad strokes laid round the disk at random places, the hottest paint, close in value (it must blaze)
  const hwC = Math.max(hwL * 2.2, r * .22);
  if (r > 8 * u) {
    const n = Math.round(clamp(.9 * (r / hwC) * (r / hwC), 3, 28));
    for (let j = 0; j < n; j++) {
      const id = 100 + j, rr = r * .7 * Math.sqrt((j + H(id, 1)) / n), th = H(id, 2) * TAU + .04 * B(id, 3), len = hwC * (2.4 + 1.6 * H(id, 4));
      const span = Math.min(2.2, len / Math.max(rr, hwC)), dr = hwC * .6 * (H(id, 5) - .5), c = mix3(sunAt(rr), H(id, 6) < .5 ? lead : nap, .12 * H(id, 7));
      add(arc(th, dir(id, span), rr - dr, rr + dr, segs(span)), hwC * (.85 + .3 * H(id, 8)), paint(c, .99 + .04 * H(id, 9)), paint(c, .98 + .03 * H(id, 10)), .95, 1.02, 0, H(id, 11));
    }
  }
  // 2. the limb: loaded strokes that follow the edge and make the silhouette, each a little off the circle (bulging in
  //    its middle, tapering at its ends) and at its own depth, so no ring of stroke edges lines up; their colour is the
  //    disk's own limb gradient, broken in value; a narrow, broken edge of deeper gold rides the outermost paint
  const nL = Math.round(clamp(TAU * r / (hwL * 3.4), 9, 60));
  if (r > 5 * u) for (let j = 0; j < Math.round(nL * .8); j++) {
    const id = 400 + j, rr = r - hwL * (1.3 + 2.4 * H(id, 1)), th = H(id, 2) * TAU + .05 * B(id, 3), span = (hwL * (2.6 + 2 * H(id, 4))) / rr;
    const c = sunAt(rr - hwL * .3), dr = A * (H(id, 6) - .5);
    add(arc(th, dir(id, span), rr - dr, rr + dr, segs(span)), hwL * (.8 + .5 * H(id, 7)), paint(c, .98 + .05 * H(id, 8)), paint(c, .97 + .04 * H(id, 9)), .95, 1.0, 0, H(id, 10));
  }
  const outerAt = [];
  for (let j = 0; j < nL; j++) {
    const id = 700 + j, th = (j + .75 * H(id, 1) + .2 * B(id, 2)) / nL * TAU, span = TAU / nL * (1.45 + .9 * H(id, 3)) * (1 + .05 * B(id, 4));
    const hw = hwL * (.7 + .5 * H(id, 5)), outer = r + A * (1.1 * H(id, 6) - .45) + .2 * A * B(id, 7), rr = outer - hw * .9, dr = A * 1.2 * (H(id, 8) - .5);
    const tint = H(id, 9), v = .96 + .07 * H(id, 10) + .015 * B(id, 11), c0 = sunAt(rr - hw * .4);
    const c = tint < .15 ? mix3(c0, ochre, .12 + .06 * warm) : tint > .85 ? mix3(c0, core, .3) : c0;
    outerAt.push([th, span, outer]);
    add(arc(th, dir(id, span), rr - dr, rr + dr, segs(span)), hw, paint(c, v), paint(c, v * .96), .97, .97, 0, H(id, 12));
  }
  for (let j = 0; j < nL; j++) {
    if (H(800 + j, 1) < .3) continue;                          // broken: a third of the edge has none
    const id = 800 + j, [th, span, outer] = outerAt[j], hw = Math.max(.9 * u, hwL * (.32 + .22 * H(id, 2))), sp2 = span * (.45 + .4 * H(id, 3));
    const c = mix3(sunAt(r), ochre, .12 * H(id, 4) * (.5 + warm)), v = .93 + .07 * H(id, 5) + .015 * B(id, 6), rr = outer - hw * (.9 + .5 * rough * H(id, 7));
    add(arc(th + span * .25 * (H(id, 8) - .5), dir(id, sp2), rr, rr + A * .3 * (H(id, 9) - .5), segs(sp2)), hw, paint(c, v), paint(c, v * .95), .9, .95, 0, H(id, 10), .85);
  }
  // 3. flicks: a stroke running along the edge that lifts off outward as the brush leaves (short, few: never rays).
  //    Flicks and cut-ins sit in fixed slots round the limb and fade by their own threshold as the limb calms, so as
  //    the eclipse deepens they go one by one and none of the others moves
  const fade = (h, dens) => clamp((dens - h) / .12);
  for (let j = 0; j < nL; j++) {
    const id = 1000 + j, keep = fade(H(id, 20), .3 * rough); if (keep <= 0) continue;
    const th0 = (j + H(id, 1) + .12 * B(id, 2)) / nL * TAU, hw = hwL * (.45 + .3 * H(id, 3)), span = (hwL * (2.5 + 2.5 * H(id, 4))) / r;
    const r0 = r - hw * 1.3, r1 = r + A * (.5 + .9 * H(id, 5)) * (1 + .1 * B(id, 6)) - hw * .4, sg = H(id, 7) < .75 ? 1 : -1;
    const pts = []; for (let q = 0; q <= 4; q++) { const s = q / 4; pts.push(P(th0 + sg * span * s, lerp(r0, r1, s * s))); }
    const c = sunAt(r), v = .93 + .07 * H(id, 8);
    add(pts, hw, paint(c, v), paint(mix3(c, ochre, .2), v * .92), (.55 + .3 * H(id, 9)) * keep, .75, 1, H(id, 10), .55);
  }
  // 4. the sky cutting back in: strokes in the colour the sky was painted with just outside the limb (the virtual
  //    canvas), overlapping the edge from outside
  if (canvas) {
    const sky = [0, 0, 0], dens = .5 * Math.min(1, rough * 1.5);
    const skyAt = (th, rr) => { const x = Math.round((cx + Math.cos(th) * rr) / S), y = Math.round((cy + Math.sin(th) * rr) / S); if (x < 0 || y < 0 || x >= aw || y >= ah) return -1; const i = y * aw + x; return mask && mask[i] < .6 ? -1 : i; };
    for (let j = 0; j < nL; j++) {
      const id = 1300 + j, keep = fade(H(id, 20), dens); if (keep <= 0) continue;
      const th = (j + .5 + .6 * H(id, 1) + .12 * B(id, 2)) / nL * TAU, span = TAU / nL * (.8 + .8 * H(id, 3)), hw = hwL * (.45 + .25 * H(id, 4));
      const inner = r - A * (.3 + 1.0 * H(id, 5)) + .2 * A * B(id, 6), rr = inner + hw * .9, dr = A * .5 * (H(id, 7) - .5);
      let n = 0; sky[0] = sky[1] = sky[2] = 0;
      for (let q = -1; q <= 1; q++) for (const f of [1.3, 2.2]) { const i = skyAt(th + span * .4 * q, r + hw * f + A); if (i < 0) continue; sky[0] += canvas.cR[i]; sky[1] += canvas.cG[i]; sky[2] += canvas.cB[i]; n++; }
      if (n < 3) continue;
      const c = met([sky[0] / n, sky[1] / n, sky[2] / n]);
      add(arc(th, dir(id, span), rr - dr, rr + dr, segs(span)), hw, c, c, .96 * keep, .3, 2, H(id, 8), .6);
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
  let ref = reference(F0, cfg, pal), F = F0, mat = cfg._nomat ? null : (src.mat || null), skyInfo = null;
  ms.reference = Math.round(performance.now() - t0); t0 = performance.now();
  if (cfg.sky) {
    const mask = src.sky ? Float32Array.from(src.sky) : skyMask(F0, cfg.sky);
    const sunA = sd ? { sx: sd.cx / S, sy: sd.cy / S, sr: sd.r / S, e: sd.e, obsc: sd.obsc } : { sx: aw * .5, sy: ah * .2, sr: 10, e: 0, obsc: 0 };
    const sk = { ...cfg.sky, alt: cfg.sky.alt ?? cfg.sun?.alt ?? 9, layoutScale: S, below: cfg.sky.below };
    if (cfg.corona && sd && cfg.corona.glow !== 0) sk.corona = { x: sd.mx / S, y: sd.my / S, R: sd.mr / S, k: (cfg.corona.k ?? 1) * (cfg.corona.glow ?? .9), fall: cfg.corona.fall ?? (1.6 + 1.2 * (1 - (cfg.corona.iris ?? 0))),
      asym: cfg.corona.photo ? (cfg.corona.asym ?? .85) : 0, tilt: cfg.corona.tilt ?? -.35 };
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
  // water and open ground: where the plate has no dominant direction (glitter, pebbles, grass), the brush follows a
  // designed direction (horizontal flicks across the river) instead of dabbing in every direction (the 'filter' look)
  if (cfg.groundFlow) {
    const g = cfg.groundFlow, ang = g.angle ?? 0, sn = Math.sin(ang), cs = Math.cos(ang);
    const T = { xx: new Float32Array(N).fill(sn * sn), xy: new Float32Array(N).fill(-sn * cs), yy: new Float32Array(N).fill(cs * cs) };
    const W2 = new Float32Array(N), y0 = Math.floor((g.y0 ?? 0) * ah), M = F0.M, skyM = ref.sky, kk = g.k ?? .7;
    for (let y = y0; y < ah; y++) for (let x = 0; x < aw; x++) {
      const i = y * aw + x;
      // (ripples are coherent too, so by default the coherence only gates where it is very strong: edges of things)
      W2[i] = kk * (1 - sstep(g.cohLo ?? .75, g.cohHi ?? .97, F0.coh[i])) * (M ? 1 - sstep(.15, .5, M[i]) : 1) * (skyM ? 1 - skyM[i] : 1);
    }
    F = withTensor(F, T, W2, g.gain ?? 1.6);
    F.gw = W2;
  }
  ms.sky = Math.round(performance.now() - t0); t0 = performance.now();
  if (opts.debug) { debugBlit(f, opts.target || f.g, opts.debug, { src, F: F0, ref, mat }); return { ms }; }
  const eyes = cfg.eyeStrokes ? eyeGeometry(F0, cfg) : [];
  const list = placeStrokes(F, ref, cfg, drawIdx, mat, eyeMaskOf(F0, eyes), W);
  const per = list.perLayer;
  if (opts.debugCanvas) {                              // the CPU virtual canvas after placement (what the error map saw)
    const c = list.canvas; debugBlit(f, opts.target || f.g, 'ref', { src, F: F0, ref: { R: c.cR, G: c.cG, B: c.cB }, mat }); return { ms, perLayer: per };
  }
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
      jup, limb: s.limb || null, warm: sunWarmth(s.alt ?? 9), blaze: s.blaze ?? 1.3, sunVis: s.vis ?? 1, mask, aw, ah, boil: (drawIdx % 97) * cfg.boil, dark: s.dark,
      paint: s.paint === false ? 0 : s.paint ?? 1 };
    sunSpec.strokes = sunPaintStrokes(sunSpec, { pal, cfg, drawIdx, mask, canvas: list.canvas, aw, ah, S, u });
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
