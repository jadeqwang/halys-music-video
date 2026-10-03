// procedural.js: painted elements that no plate provides (reusable by every brush world).
//
//   arrowStrokes(o)          an arrow in flight as a few dark brush strokes (shaft, fletching, head), with motion smear
//   crescentField(aw, ah, o) the pinhole crescents a wicker shield throws (RESEARCH §5 #4): a light field (0..1) of
//                            crescent suns stretched along the shadow direction + matching impasto dabs
//   umbraField(aw, ah, o)    the moon's shadow arriving out of the sunset: darkness beyond a front that runs from the
//                            horizon toward the camera (by depth when the source has it, else by screen row)
//   mirrorFigure(o)          a tiny figure (orange headphones, a Yagi antenna) painted as if reflected in a convex
//                            bronze shield (S26's easter egg)
//   horizonCanvas(o)         a draw(g, aw, ah) for canvasSource: low hills, haze and a distant river under a sky
//                            region the engine replaces (S12, S18, S34)
//   crowdStrokes(src, o)     Altdorfer's troops over a painted army: upright spears with lit tips, helmet and shield
//                            glints, a few animal standards on poles, placed from the plate's figures (depth relief)

import { clamp, lerp, sstep, hash3, hash4, TAU, fbm, mix3, blurFast } from './util.js';

const T = (pal, n) => pal.tube(n) || [.5, .5, .5];

// ---------------------------------------------------------------- the arrow (S12)
// o: {x, y (screen px of the arrowhead tip), ang (flight direction, rad), len (px), pal, k (opacity), smear (px), seed}
export function arrowStrokes(o) {
  const { x, y, ang, len, pal } = o, k = o.k ?? 1, seed = o.seed ?? 3;
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const dark = mix3(T(pal, 'boneBlack'), T(pal, 'rawUmber'), .3), wood = mix3(T(pal, 'burntUmber'), T(pal, 'boneBlack'), .55);
  const out = [];
  const add = (pts, r, c0, c1, thick, a, sd, taper = .4) => out.push({ pts, r, c0, c1: c1 || c0, a: a * k, thick, seed: sd, key: sd, layer: 11, taper, maxSeg: 12 });
  const w = Math.max(1.6, len * .011);
  // shaft (tail -> head), with a faint motion smear trailing behind
  const tail = [x - dx * len, y - dy * len];
  add([tail, [x - dx * len * .5, y - dy * len * .5], [x - dx * len * .08, y - dy * len * .08]], w, wood, dark, .35, .97, hash3(1, 1, seed), .05);
  if (o.smear) add([[tail[0] - dx * o.smear, tail[1] - dy * o.smear], tail], w * .8, wood, wood, .1, .28, hash3(1, 2, seed), .9);
  // the head: a narrow leaf of dark iron
  const hx = x - dx * len * .1, hy = y - dy * len * .1;
  add([[hx, hy], [x - dx * len * .02, y - dy * len * .02]], w * 2.1, dark, dark, .5, 1, hash3(1, 3, seed), .95);
  // fletching: three short strokes splayed back from the tail
  for (let j = -1; j <= 1; j++) {
    const sp = j * .35, fx = tail[0] + dx * len * .1, fy = tail[1] + dy * len * .1;
    const ex = fx - (dx * Math.cos(sp) - dy * Math.sin(sp)) * len * .12 + nx * j * w * 2.2, ey = fy - (dy * Math.cos(sp) + dx * Math.sin(sp)) * len * .12 + ny * j * w * 2.2;
    add([[fx, fy], [ex, ey]], w * 1.4, dark, wood, .25, .9, hash3(2, j + 2, seed), .8);
  }
  return out;
}

// ---------------------------------------------------------------- pinhole crescents (S27)
// A field of crescent suns thrown through a wicker shield's weave. Before totality the projected bright edge sits at
// about 7 o'clock (flipped); on ground they stretch 4-6x along the shadow direction; on a surface facing the sun they
// are round-bodied. Returns {light: Float32Array (0..1), dabs: [{x, y, rx, ry, ang, k}]} in analysis px.
// o: {region: Float32Array|null (where the crescents can land), mag (eclipse magnitude), stretch (1 round .. 6),
//     ang (stretch axis, rad), size (px), density (0..1), seed, t (for a slow drift as the shield moves), offset [x, y]}
export function crescentField(aw, ah, o) {
  const light = new Float32Array(aw * ah), dabs = [];
  const mag = clamp(o.mag ?? .8, 0, .98), st = o.stretch ?? 4, ang = o.ang ?? -.35, size = o.size ?? 6, seed = o.seed ?? 9;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const cellX = size * (o.spacing ?? 2.6) * Math.sqrt(st), cellY = size * (o.spacing ?? 2.6);
  // the moon's offset for this magnitude, in units of the crescent's radius, toward 1 o'clock (the projection flips 7 <-> 1)
  const off = (1 + 1.066 - 2 * mag), ma = -Math.PI / 2 + Math.PI / 6 * 1;        // the dark disk's direction in the image
  const mdx = Math.cos(ma) * off, mdy = Math.sin(ma) * off;
  const ox = (o.offset || [0, 0])[0], oy = (o.offset || [0, 0])[1];
  for (let cy = -2; cy * cellY < ah + cellY * 2; cy++) for (let cx = -2; cx * cellX < aw + cellX * 2; cx++) {
    if (hash3(cx, cy, seed) > (o.density ?? .75)) continue;
    const jx = (hash3(cx, cy, seed + 1) - .5) * cellX * .8, jy = (hash3(cx, cy, seed + 2) - .5) * cellY * .8;
    const x0 = cx * cellX + jx + ox, y0 = cy * cellY + jy + oy;
    const s = size * (.7 + .6 * hash3(cx, cy, seed + 3)), k = .55 + .45 * hash3(cx, cy, seed + 4);
    const ix = Math.round(x0), iy = Math.round(y0);
    if (ix < 0 || iy < 0 || ix >= aw || iy >= ah) continue;
    if (o.region && o.region[iy * aw + ix] < .3) continue;
    dabs.push({ x: x0, y: y0, rx: s * st, ry: s, ang, k });
    const R = Math.ceil(s * st + 2);
    for (let y = Math.max(0, iy - R); y <= Math.min(ah - 1, iy + R); y++) for (let x = Math.max(0, ix - R); x <= Math.min(aw - 1, ix + R); x++) {
      const px = x - x0, py = y - y0, u = (px * ca + py * sa) / st, v = -px * sa + py * ca;   // unstretched disc coords
      const d = Math.hypot(u, v) / s, dm = Math.hypot(u / s - mdx, v / s - mdy) / 1.066;
      const sun = 1 - sstep(.86, 1.06, d), moon = 1 - sstep(.9, 1.1, dm);
      const c = sun * (1 - moon) * k;
      if (c > 0) { const i = y * aw + x; light[i] = Math.max(light[i], c * (o.region ? o.region[i] : 1)); }
    }
  }
  return { light, dabs };
}
// the crescents as loaded strokes (Naples/lead white, thin impasto), in screen px (S = screen px per analysis px)
export function crescentStrokes(dabs, S, pal, o = {}) {
  const lead = T(pal, 'leadWhite'), nap = T(pal, 'naples'), out = [], metal = o.metal ?? .5;
  const col = mix3(mix3(nap, lead, .5), [.82, .83, .84], metal);
  dabs.forEach((d, j) => {
    const ca = Math.cos(d.ang), sa = Math.sin(d.ang), L = d.rx * S * .55;
    const x = d.x * S, y = d.y * S;
    out.push({ pts: [[x - ca * L, y - sa * L], [x + ca * L, y + sa * L]], r: Math.max(1, d.ry * S * .32), c0: col, c1: col, a: .5 * d.k * (o.k ?? 1), thick: .55, seed: hash3(j, 5, 77), key: hash3(j, 6, 77), layer: 9, taper: .6 });
  });
  return out;
}

// ---------------------------------------------------------------- the umbra (S30)
// front: 0 (still at the horizon) .. 1 (past the camera). depth: Float32Array (1 = near) or null; horizonY: row fraction.
// Returns a shadow field (0..1): 1 = inside the umbra. The wall is not a hard cut: a soft penumbral gradient of `soft`.
export function umbraField(aw, ah, o) {
  const out = new Float32Array(aw * ah), f = clamp(o.front ?? 0), soft = o.soft ?? .12, D = o.depth, hz = (o.horizonY ?? .4) * ah;
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const i = y * aw + x;
    let dist;                                      // 0 at the horizon .. 1 at the camera
    if (D) dist = clamp(D[i]);
    else dist = y < hz ? 0 : clamp((y - hz) / (ah - hz));
    const wob = (fbm(x / aw * 6, y / ah * 3, o.seed ?? 4, 2) - .5) * .08;
    out[i] = 1 - sstep(f - soft, f + soft * .3, dist + wob);
  }
  return out;
}

// ---------------------------------------------------------------- S26's easter egg
// A tiny figure seen in a convex mirror: head with orange headphones (#f08a2a), white jacket, holding a Yagi antenna
// (a boom with crossbars). Drawn as a handful of small strokes, compressed by the mirror's barrel distortion toward its
// rim. o: {cx, cy (mirror centre, px), R (mirror radius px), u, v (figure position in the mirror, -1..1), h (figure height
// as a fraction of R), pal, k}
export function mirrorFigure(o) {
  const { cx, cy, R, pal } = o, k = o.k ?? 1, h = (o.h ?? .22) * R, out = [];
  const warp = (u, v) => { const r = Math.hypot(u, v), s = r > 0 ? Math.tanh(r * 1.3) / (r * 1.3) : 1; return [cx + u * s * R, cy + v * s * R]; };
  const P = (du, dv) => warp((o.u ?? .15) + du * h / R, (o.v ?? -.1) + dv * h / R);
  // a reflection, not a sticker: the colours take the surface's tint (o.tint) and lose some contrast; the headphones
  // keep most of their orange (the one thing a freeze-frame hunter should catch)
  const tn = o.tint || [1, 1, 1], tk = o.tintK ?? 0;
  const T = (c, q = 1) => [lerp(c[0], c[0] * tn[0] * .9 + .05, tk * q), lerp(c[1], c[1] * tn[1] * .9 + .04, tk * q), lerp(c[2], c[2] * tn[2] * .9 + .03, tk * q)];
  const orange = T([240 / 255, 138 / 255, 42 / 255], .35), jacket = T([.93, .92, .88]), hair = T([.06, .065, .08]), navy = T([.12, .14, .2]), metal = T([.78, .78, .74]);
  const add = (pts, r, c, thick = .3, a = 1) => out.push({ pts, r: Math.max(.6, r), c0: c, c1: c, a: a * k, thick, seed: hash3(out.length, 1, 51), key: 2 + out.length * 1e-3, layer: 12, taper: .2 });
  // the reflected window of light the figure stands in (soft, curved with the surface)
  if (o.sheen) {
    const sc = o.sheenColor || [.85, .62, .42];
    for (let j = 0; j < 26; j++) {
      const a0 = hash3(j, 7, 53), rr = .25 + .5 * hash3(j, 8, 53), dv = (hash3(j, 9, 53) - .5) * 1.1;
      add([P(-.55 * rr - .1, dv - .05), P(0, dv - .12 * rr), P(.55 * rr + .1, dv - .05)], h * (.05 + .05 * hash3(j, 10, 53)), sc, .15, o.sheen * (.25 + .25 * a0));
    }
  }
  add([P(0, -.42), P(0, -.30)], h * .09, hair);                         // head / hair
  add([P(-.07, -.36), P(-.06, -.33)], h * .045, orange, .5);            // headphones
  add([P(.07, -.36), P(.06, -.33)], h * .045, orange, .5);
  add([P(-.06, -.41), P(0, -.45), P(.06, -.41)], h * .018, orange, .4);
  add([P(0, -.27), P(0, .05)], h * .13, jacket, .4);                    // torso (white jacket)
  add([P(-.03, .05), P(-.04, .42)], h * .05, navy);                     // legs
  add([P(.03, .05), P(.04, .42)], h * .05, navy);
  add([P(.05, -.18), P(.2, -.32)], h * .035, jacket);                   // arm up to the antenna
  // the Yagi: a boom held up and out, with crossbars
  const b0 = [.12, -.36], b1 = [.5, -.62];
  add([P(b0[0], b0[1]), P(b1[0], b1[1])], h * .014, metal, .5);
  for (let j = 0; j < 6; j++) {
    const t = j / 5, bx = lerp(b0[0], b1[0], t), by = lerp(b0[1], b1[1], t), L = .1 * (1 - .4 * t);
    add([P(bx - L * .55, by - L * .85), P(bx + L * .55, by + L * .85)], h * .01, metal, .45);
  }
  return out;
}

// ---------------------------------------------------------------- procedural horizon (S12, S18, S34)
// draw(g, aw, ah): a low land strip (hills, haze, a glint of river) whose top edge is the horizon at horizonY; the sky
// above is left to the engine (canvasSource's `sky` mask says where). Colours are pre-palette (they get relit).
export function horizonCanvas(o = {}) {
  const hz = o.horizonY ?? .78, seed = o.seed ?? 11;
  return (g, aw, ah) => {
    const H0 = hz * ah;
    const sky = g.createLinearGradient(0, 0, 0, H0); sky.addColorStop(0, '#3a2414'); sky.addColorStop(1, '#c8892f');
    g.fillStyle = sky; g.fillRect(0, 0, aw, H0 + 2);
    // far hills: two ridges
    for (let r = 0; r < 2; r++) {
      g.beginPath(); g.moveTo(0, ah);
      for (let x = 0; x <= aw; x += 4) {
        const y = H0 - (r ? 3 : 9) * (o.hill ?? 1) * (aw / 960) * (.5 + fbm(x / aw * (r ? 7 : 3.5), r * 5.3, seed + r, 3)) + r * 4 * (aw / 960);
        g.lineTo(x, y);
      }
      g.lineTo(aw, ah); g.closePath();
      g.fillStyle = r ? '#5a3a22' : '#8a5a34'; g.fill();
    }
    // the plain
    const pl = g.createLinearGradient(0, H0, 0, ah); pl.addColorStop(0, '#6a4428'); pl.addColorStop(1, '#2a1a10');
    g.fillStyle = pl; g.fillRect(0, H0 + 6 * (aw / 960), aw, ah);
    // the river to the vanishing point (a bright path)
    if (o.river !== false) {
      const vx = (o.vanishX ?? .5) * aw;
      g.beginPath(); g.moveTo(vx - 2, H0 + 6); g.lineTo(vx + 2, H0 + 6); g.lineTo(vx + aw * .18, ah); g.lineTo(vx - aw * .18, ah); g.closePath();
      const rv = g.createLinearGradient(0, H0, 0, ah); rv.addColorStop(0, '#e8c070'); rv.addColorStop(1, '#8a3a22');
      g.fillStyle = rv; g.fill();
    }
  };
}
// a sky mask for horizonCanvas (1 above the horizon, soft 1px edge, the hills cut in)
export function horizonSkyMask(o = {}) {
  const hz = o.horizonY ?? .78, seed = o.seed ?? 11;
  return (aw, ah) => {
    const m = new Float32Array(aw * ah), H0 = hz * ah;
    for (let x = 0; x < aw; x++) {
      const y0 = H0 - 9 * (o.hill ?? 1) * (aw / 960) * (.5 + fbm(x / aw * 3.5, 0, seed, 3));
      for (let y = 0; y < ah; y++) m[y * aw + x] = 1 - sstep(y0 - 1, y0 + 1, y);
    }
    return m;
  };
}

// ---------------------------------------------------------------- a crescent sun as paint
// The bright crescent left of a sun of radius R (px) at magnitude mag, its bright side toward angle `ang` (rad, screen),
// as two strokes from its thick middle out to each horn; `stretch` elongates it along `stretchAng` (pinhole images on
// the ground stretch 4-6x along the shadow). Returns strokes in screen px.
export function crescentStrokes2(cx, cy, R, mag, ang, o = {}) {
  const k = 1.066, d = (1 + k - 2 * Math.min(.985, Math.max(.05, mag))) * R, kr = k * R;   // moon offset (toward the dark side)
  const mx = -Math.cos(ang) * d, my = -Math.sin(ang) * d;                                     // moon centre relative to the sun's
  const st = o.stretch ?? 1, sa = o.stretchAng ?? 0, cs = Math.cos(sa), sn = Math.sin(sa);
  const tf = (x, y) => { const u = x * cs + y * sn, v = -x * sn + y * cs; const u2 = u * st; return [cx + u2 * cs - v * sn, cy + u2 * sn + v * cs]; };
  // along a ray from the sun's centre at angle th: the moon's near edge distance (or R if the ray misses the moon)
  const inner = th => {
    const ux = Math.cos(th), uy = Math.sin(th), b = ux * mx + uy * my, c = mx * mx + my * my - kr * kr, disc = b * b - c;
    if (disc < 0) return 0;                                        // the ray misses the moon: bright to the centre
    const t2 = b + Math.sqrt(disc);                                // the moon's far edge along the ray
    return Math.min(R, Math.max(0, t2));
  };
  // horn angle: where inner() reaches R
  let lo = 0, hi = Math.PI;
  for (let it = 0; it < 20; it++) { const m2 = (lo + hi) / 2; if (inner(ang + m2) < R * .999) lo = m2; else hi = m2; }
  const Th = lo, out = [], col = o.color || [.92, .88, .78], th0 = R - inner(ang);
  if (th0 < .3) return out;
  for (const sgn of [1, -1]) {
    const pts = [];
    for (let q = 0; q <= 6; q++) { const th = ang + sgn * Th * q / 6, ri = inner(th), rm = (R + ri) / 2; pts.push(tf(Math.cos(th) * rm, Math.sin(th) * rm)); }
    out.push({ pts, r: Math.max(.6, th0 * .5 * (st > 1.5 ? 1 : 1)), c0: col, c1: col, a: o.a ?? .9, thick: o.thick ?? .7, seed: o.seed ?? .3, key: (o.key ?? 0) + (sgn > 0 ? 0 : .5), layer: 12, taper: .95, maxSeg: 10 });
  }
  return out;
}

// ---------------------------------------------------------------- crowds (the wides)
// Figures are where the plate's depth stands out of the ground plane (soldiers in ranks); one candidate per material
// cell (so the spears ride with the content and never swim), thinned by perspective so a near soldier gets one spear and
// a far rank a dense picket. o: {W, H, pal, horizonY, vanishX, river (half-width at the frame foot, uv), maxV, cell,
// seed, drawIdx, light: 0..1, standards: [{u, v, kind: 'lion'|'horse', h}]}
export function crowdStrokes(src, o) {
  const { aw, ah, R, G, B, depth, mat } = src, out = [];
  if (!depth || !mat) return out;
  const W = o.W, H = o.H, S = W / aw, pal = o.pal, seed = o.seed ?? 7, u1 = H / 1080;
  const hz = o.horizonY ?? .33, vx = o.vanishX ?? .5, river = o.river ?? .16, maxV = o.maxV ?? .8, cell = (o.cell ?? 8) * u1, light = o.light ?? 1;
  const T = n => pal.tube(n) || [.5, .5, .5];
  const shaft = mix3(T('rawUmber'), T('boneBlack'), .45), tip = mix3(T('leadWhite'), T('naples'), .45), glint = mix3(T('leadWhite'), T('naples'), .2);
  const bronze = mix3(T('naples'), T('yellowOchre'), .55), dark = mix3(T('burntUmber'), T('boneBlack'), .6);
  const Db = blurFast(depth, aw, ah, 5);
  const best = new Map();
  const y0 = Math.max(1, Math.ceil(hz * ah) + 1), y1 = Math.min(ah - 2, Math.floor(maxV * ah));
  for (let y = y0; y <= y1; y++) {
    const v = y / ah, p = clamp((v - hz) / (1 - hz)), rw = .012 + river * p;
    for (let x = 1; x < aw - 1; x++) {
      const uu = x / aw; if (Math.abs(uu - vx) < rw) continue;                    // not on the river
      if (o.region && !o.region(uu, v)) continue;                                  // inside the army blocks
      const i = y * aw + x, bump = depth[i] - Db[i];
      if (bump < (o.bump ?? .004)) continue;                                      // a figure stands out of the ground
      const mx = mat.mx[i] / cell, my = mat.my[i] / cell, cx = Math.floor(mx), cy = Math.floor(my);
      const jx = hash3(cx, cy, seed), jy = hash3(cy, cx, seed + 3), d = (mx - cx - jx) ** 2 + (my - cy - jy) ** 2;
      const key = cx * 100003 + cy, b = best.get(key);
      if (!b || d < b.d) best.set(key, { d, x, y, i, cx, cy, p, bump });
    }
  }
  const di = o.drawIdx || 0, lean0 = o.lean ?? 0;
  for (const c of best.values()) {
    const { x, y, i, cx, cy, p } = c, h1 = hash3(cx, cy, seed + 11), h2 = hash3(cx, cy, seed + 13);
    const fh = H * (.014 + .26 * Math.pow(p, 1.2));                               // the figure's height here (layout px)
    const keep = Math.min(1, Math.pow((cell * 1.4) / (fh * .32), 2));                   // ~one candidate per soldier
    if (h1 > keep) continue;
    const L = .2126 * R[i] + .7152 * G[i] + .0722 * B[i];
    const px = x * S, py = y * S, boil = .012 * (hash4(cx, cy, di, seed) - .5);
    // the spear: upright (a slight lean, never in step), its lit tip catching the low sun
    if (h2 < (o.spears ?? .85)) {
      const lean = lean0 + .04 * (hash3(cx, cy, seed + 17) - .5) + boil, len = fh * (.7 + .25 * hash3(cx, cy, seed + 19));
      const bx = px + (h2 - .5) * fh * .1, by = py - fh * .2, tx = bx + Math.sin(lean) * len, ty = by - Math.cos(lean) * len;
      const w = Math.max(.55 * u1, fh * .009), q = .9;
      // a dark shaft with no paint body (a thin ridge would catch the varnish and read as rain), a short lit tip
      out.push({ pts: [[bx, by], [lerp(bx, tx, q), lerp(by, ty, q)]], r: w, c0: shaft, c1: shaft, a: .82, thick: 0, seed: h1, key: 3 + h1 * 1e-3, layer: 11, taper: .15 });
      out.push({ pts: [[lerp(bx, tx, q), lerp(by, ty, q)], [tx, ty]], r: w * 1.2, c0: tip, c1: tip, a: .5 + .4 * light, thick: .15, seed: h2, key: 3.5 + h2 * 1e-3, layer: 12, taper: .5 });
    }
    // helmet glint on the head, a shield's rim catching the light lower down (the lit side of the ranks)
    const g = hash3(cx, cy, seed + 23);
    if (g < .55 + .35 * clamp(L * 2 - .3)) {
      const r = Math.max(.7 * u1, fh * .028);
      out.push({ pts: [[px - r * .6, py - fh * .02], [px + r * .6, py - fh * .03]], r, c0: glint, c1: bronze, a: .6 + .35 * light, thick: .6, seed: g, key: 4 + g * 1e-3, layer: 12, taper: .3 });
    }
    if (g > .7 && p > .08) {
      const r = Math.max(.8 * u1, fh * .06), sx = px + (g - .85) * fh * .3, sy = py + fh * .2;
      out.push({ pts: [[sx - r * .9, sy - r * .5], [sx, sy - r], [sx + r * .9, sy - r * .5]], r: Math.max(.6 * u1, r * .18), c0: bronze, c1: glint, a: .6 * light + .2, thick: .5, seed: g * 7, key: 4.5 + g * 1e-3, layer: 12, taper: .4 });
    }
  }
  // animal standards: a lion over the Lydians, a horse over the Medes, gilt on dark poles above the ranks
  for (const [k, sd] of (o.standards || []).entries()) {
    const h = sd.h * H, x0 = sd.u * W, yb = sd.v * H, yt = yb - h, a = sd.kind === 'horse' ? 1 : 0;
    out.push({ pts: [[x0, yb], [x0, yt]], r: Math.max(.8 * u1, h * .018), c0: dark, c1: dark, a: .9, thick: .35, seed: k + .1, key: 5 + k * 1e-3, layer: 11, taper: .1 });
    const s = h * .3, bx = x0, by = yt - s * .25, col = bronze, w = Math.max(1 * u1, s * .14);
    const shape = a ? [[[-.5, 0], [.45, 0]], [[.35, 0], [.6, -.45]], [[.6, -.45], [.8, -.38]], [[-.45, 0], [-.55, .4]], [[.35, 0], [.4, .42]], [[-.5, -.05], [-.75, .15]]]   // horse
      : [[[-.5, 0], [.4, 0]], [[.4, 0], [.55, -.25]], [[.32, -.12], [.62, -.08]], [[-.45, 0], [-.5, .38]], [[.3, 0], [.35, .38]], [[-.5, -.02], [-.8, -.3]]];   // lion
    for (const [j, seg] of shape.entries()) out.push({ pts: seg.map(([sx, sy]) => [bx + sx * s, by + sy * s]), r: w * (j === 0 ? 1.6 : 1), c0: col, c1: mix3(col, dark, .3), a: .92, thick: .5, seed: k * 10 + j, key: 6 + k * .01 + j * 1e-4, layer: 12, taper: .2 });
  }
  return out;
}

// ---------------------------------------------------------------- burning bronze (S26)
// A hot specular sweep: a band of short lead-white / Naples strokes riding across the metal (along `dir`, at `pos` 0..1
// of the frame), brightest at its core; and the sun's reflection: a hard white point with a short warm smear, where the
// plate's metal is brightest. o: {W, H, pal, sweep: {pos, k, ang, width}, sun: {x, y, r, k}, mask(x, y) -> 0..1, seed}
export function bronzeSpecular(o) {
  const { W, H, pal } = o, out = [], u1 = H / 1080, seed = o.seed ?? 5;
  const T = n => pal.tube(n) || [1, 1, 1];
  const lead = T('leadWhite'), nap = T('naples'), och = T('yellowOchre');
  const hot = mix3(lead, nap, .25), gold = mix3(nap, och, .45);
  const sw = o.sweep;
  if (sw && sw.k > 0) {
    const ca = Math.cos(sw.ang ?? 1.1), sa = Math.sin(sw.ang ?? 1.1), cx = sw.pos * W, width = (sw.width ?? .07) * W;
    for (let j = 0; j < 220; j++) {
      const along = (hash3(j, 1, seed) - .5) * 1.4 * H, across = (hash3(j, 2, seed) - .5) * 2, core = Math.exp(-across * across * 3);
      const x = cx + across * width + along * ca * .25, y = H * .5 + along * sa;
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
      const m = o.mask ? o.mask(x, y) : 1; if (m <= .05) continue;
      const len = (8 + 26 * core) * u1, dx = ca * len * .5, dy = sa * len * .5;
      out.push({ pts: [[x - dx, y - dy], [x + dx, y + dy]], r: (1.8 + 4 * core) * u1, c0: core > .5 ? lead : hot, c1: gold, a: clamp((.5 + .7 * core) * sw.k * Math.sqrt(m)), thick: .6 + .3 * core, seed: hash3(j, 3, seed), key: 7 + j * 1e-4, layer: 12, taper: .45 });
    }
  }
  const sn = o.sun;
  if (sn && sn.k > 0) {
    const r = sn.r * u1;
    out.push({ pts: [[sn.x - r * .3, sn.y], [sn.x + r * .3, sn.y]], r, c0: lead, c1: hot, a: clamp(sn.k), thick: .9, seed: 1.3, key: 8, layer: 12, taper: .2 });
    for (let j = 0; j < 5; j++) {                                    // a short warm smear in the metal's curvature, not rays
      const a = -.5 + (j - 2) * .12, l = r * (2.2 + 1.5 * hash3(j, 9, seed));
      out.push({ pts: [[sn.x, sn.y], [sn.x + Math.cos(a) * l, sn.y + Math.sin(a) * l * .4]], r: r * .35, c0: hot, c1: gold, a: clamp(sn.k * .55), thick: .4, seed: 2 + j, key: 8.1 + j * .01, layer: 12, taper: .8 });
    }
  }
  return out;
}
