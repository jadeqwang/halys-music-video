// orbit/moon.js: the grey line-drawn Moon of Earthset (S72) and the pull-back (S77).
//
// lunarLimb(W, H, o): the Moon seen edge-on from low orbit, orthographic (so its silhouette is an exact circle and can
// occlude the Earth with a circle test): centre (cx, cy), radius RM (px), the limb's top at (W/2, yTop). The surface is
// a height field on the sphere (broad relief + a power-law crater population with bowls and raised rims), contoured in
// SCREEN space (marching squares on a 4 px grid: the sphere's own foreshortening crowds the lines toward the limb, as in
// the board), plus explicit bright rims for the larger craters lit from the Sun's side, and the limb itself.
// moonDisk(cx, cy, R, o): a whole Moon (the pull-back passes it): limb, maria outlines, craters, terminator.

import { proc, FL } from '../line/index.js';
import { clamp, lerp, sstep } from '../../core.js';
import { mkLine } from './index.js';

function h3(x, y, z, s) { let n = (x * 374761393 + y * 668265263 + z * 1274126177 + s * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
function vn3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf), c = (i, j, k) => h3(xi + i, yi + j, zi + k, s);
  return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v), lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
const fbm = (x, y, z, s, o = 4) => { let a = .5, f = 1, t = 0, n = 0; for (let i = 0; i < o; i++) { t += a * vn3(x * f, y * f, z * f, s + i * 13); n += a; a *= .5; f *= 2.1; } return t / n; };

// marching squares over a scalar grid -> polylines (segments joined greedily)
export function contours(Hf, gw, gh, levels, toXY) {
  const out = [];
  for (const lv of levels) {
    const segs = new Map(), key = (x, y) => `${Math.round(x * 64)},${Math.round(y * 64)}`;
    const edge = (x0, y0, v0, x1, y1, v1) => { const t = (lv - v0) / (v1 - v0); return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]; };
    const list = [];
    for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
      const a = Hf[j * gw + i], b = Hf[j * gw + i + 1], c = Hf[(j + 1) * gw + i + 1], d = Hf[(j + 1) * gw + i];
      if (Number.isNaN(a + b + c + d)) continue;
      const k = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0); if (k === 0 || k === 15) continue;
      const T = edge(i, j, a, i + 1, j, b), R = edge(i + 1, j, b, i + 1, j + 1, c), B = edge(i, j + 1, d, i + 1, j + 1, c), L = edge(i, j, a, i, j + 1, d);
      const S = { 1: [[L, B]], 2: [[B, R]], 3: [[L, R]], 4: [[T, R]], 5: [[L, T], [B, R]], 6: [[T, B]], 7: [[L, T]], 8: [[L, T]], 9: [[T, B]], 10: [[T, R], [L, B]], 11: [[T, R]], 12: [[L, R]], 13: [[B, R]], 14: [[L, B]] }[k];
      for (const s of S) list.push(s);
    }
    // join segments into polylines
    const adj = new Map();
    list.forEach((s, i) => { for (const e of [0, 1]) { const k = key(...s[e]); if (!adj.has(k)) adj.set(k, []); adj.get(k).push(i); } });
    const used = new Uint8Array(list.length);
    for (let i = 0; i < list.length; i++) {
      if (used[i]) continue; used[i] = 1;
      const line = [list[i][0], list[i][1]];
      for (const dirEnd of [1, 0]) {
        for (;;) {
          const end = dirEnd ? line[line.length - 1] : line[0], cand = adj.get(key(...end)) || [];
          let nxt = -1; for (const c of cand) if (!used[c]) { nxt = c; break; }
          if (nxt < 0) break;
          used[nxt] = 1; const s = list[nxt], other = key(...s[0]) === key(...end) ? s[1] : s[0];
          dirEnd ? line.push(other) : line.unshift(other);
        }
      }
      if (line.length >= 3) out.push({ lv, pts: line.map(([x, y]) => toXY(x, y)) });
    }
  }
  return out;
}

// the crater population on the near cap (unit normals in the Moon's screen-aligned frame: x right, y down, z to us)
function craters(seed, n, region) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = h3(i, 1, seed, 3), v = h3(i, 2, seed, 3), sz = Math.pow(h3(i, 3, seed, 3), 3.2);
    const nx = lerp(region[0], region[1], u), ny = lerp(region[2], region[3], v), z2 = 1 - nx * nx - ny * ny; if (z2 <= .0004) continue;
    out.push({ n: [nx, ny, Math.sqrt(z2)], r: .0035 + .055 * sz, depth: .6 + .4 * h3(i, 4, seed, 3), id: i });
  }
  return out.sort((a, b) => b.r - a.r);
}
function heightAt(n, CR, seed) {
  let h = .55 * fbm(n[0] * 9 + 3, n[1] * 9 - 1, n[2] * 9 + 5, seed, 5) + .25 * fbm(n[0] * 30, n[1] * 30, n[2] * 30, seed + 7, 3);
  for (const c of CR) {
    const dx = n[0] - c.n[0], dy = n[1] - c.n[1], dz = n[2] - c.n[2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) / c.r;
    if (d > 1.9) continue;
    h += c.r * 5 * c.depth * (d < 1 ? (d * d - 1) * .9 : .35 * Math.exp(-(((d - 1) / .22) ** 2)));     // bowl + raised rim
  }
  return h;
}

// sun: screen direction toward the Sun (x right, y down), e.g. [-.9, -.3] = from the upper left
export function lunarLimb(W, H, o = {}) {
  const s = H / 1080, RM = (o.RM ?? 1.6) * W, yTop = (o.yTop ?? .6) * H, cx = W / 2, cy = yTop + RM, seed = o.seed ?? 5;
  const sun = o.sun ?? [-.85, -.25], out = [];
  const region = [-(W / 2 + 40) / RM, (W / 2 + 40) / RM, -1, (H + 40 - cy) / RM];
  const CR = craters(seed, o.nCraters ?? 520, region);
  // height field on a screen grid over the visible surface
  const cell = (o.cell ?? 4) * s, gw = Math.ceil(W / cell) + 3, y0 = yTop - 2 * cell, gh = Math.ceil((H - y0) / cell) + 3, Hf = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const x = (i - 1) * cell, y = y0 + j * cell, nx = (x - cx) / RM, ny = (y - cy) / RM, z2 = 1 - nx * nx - ny * ny;
    Hf[j * gw + i] = z2 <= 0 ? NaN : heightAt([nx, ny, Math.sqrt(z2)], CR, seed);
  }
  let lo = Infinity, hi = -Infinity; for (const v of Hf) if (!Number.isNaN(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const nl = o.levels ?? 26, levels = Array.from({ length: nl }, (_, k) => lerp(lo, hi, (k + .5) / nl));
  const toXY = (i, j) => [(i - 1) * cell, y0 + j * cell];
  for (const c of contours(Hf, gw, gh, levels, toXY)) {
    // brightness: lit slopes brighter (the gradient faces the Sun), dimmer toward the bottom of the frame
    const pts = c.pts, b = pts.map(([x, y], k) => {
      const nz2 = 1 - ((x - cx) / RM) ** 2 - ((y - cy) / RM) ** 2, near = 1 - sstep(.0, .6, Math.sqrt(Math.max(0, nz2)));
      const p = pts[Math.max(0, k - 1)], q = pts[Math.min(pts.length - 1, k + 1)], tx = q[0] - p[0], ty = q[1] - p[1], tm = Math.hypot(tx, ty) || 1;
      const face = .55 + .45 * ((-ty / tm) * sun[0] + (tx / tm) * sun[1]);
      return (o.gain ?? 1) * (.1 + .17 * near) * (.45 + .75 * face * face) * (1 - .45 * sstep(.25 * H, H, y - yTop));
    });
    out.push(mkLine(pts, { b, w: .85, o: .03, spd: .35, phase: c.lv * 7 }));
  }
  // explicit rims for the larger craters: bright on the far wall (facing the Sun), the near wall in shadow
  for (const c of CR) {
    if (c.r < .016) continue;
    const ref = [0, 0, 1], t1 = norm3(cross3(ref, c.n)), t2 = cross3(c.n, t1), pts = [], bb = [];
    for (let k = 0; k <= 72; k++) {
      const a = k / 72 * Math.PI * 2, v = norm3([c.n[0] + c.r * (Math.cos(a) * t1[0] + Math.sin(a) * t2[0]), c.n[1] + c.r * (Math.cos(a) * t1[1] + Math.sin(a) * t2[1]), c.n[2] + c.r * (Math.cos(a) * t1[2] + Math.sin(a) * t2[2])]);
      if (v[2] <= 0) continue;
      const x = cx + RM * v[0], y = cy + RM * v[1]; pts.push([x, y]);
      const dx = v[0] - c.n[0], dy = v[1] - c.n[1], dm = Math.hypot(dx, dy) || 1;
      bb.push((o.gain ?? 1) * (.12 + .48 * Math.pow(Math.max(0, -(dx / dm * sun[0] + dy / dm * sun[1])), 1.5)) * (1 - .45 * sstep(.25 * H, H, y - yTop)));
    }
    if (pts.length > 2) out.push(mkLine(pts, { b: bb, w: 1.0 + .6 * clamp(c.r / .04), o: .05, flags: FL.NOFADE, spd: .3 }));
  }
  // the limb: crisp, bright, a touch of orange (the CORONA horizon)
  const limb = [];
  for (let x = -20; x <= W + 20; x += 6 * s) { const dx = (x - cx) / RM; if (Math.abs(dx) >= 1) continue; limb.push([x, cy - RM * Math.sqrt(1 - dx * dx)]); }
  out.push(mkLine(limb, { b: 1.25 * (o.gain ?? 1), w: 1.6, o: .22, flags: FL.NOFADE, spd: .4 }));
  out.push(mkLine(limb.map(([x, y]) => [x, y + 2.5 * s]), { b: .35 * (o.gain ?? 1), w: 1.0, o: .1 }));
  return { lines: out.filter(Boolean), cx, cy, RM, yTop };
}
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = a => { const m = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / m, a[1] / m, a[2] / m]; };

// a whole Moon disk in lines (the pull-back): limb, terminator-lit craters, a few maria outlines; sun: screen dir
export function moonDisk(cx, cy, R, o = {}) {
  const out = [], seed = o.seed ?? 9, sun = o.sun ?? [-.8, -.3], sunZ = o.sunZ ?? .2;
  const CR = craters(seed, o.nCraters ?? 160, [-1, 1, -1, 1]).filter(c => c.r > .02);
  const lit = n => clamp((n[0] * sun[0] + n[1] * sun[1] + n[2] * sunZ) * 3 + .5);
  out.push(proc.circle(cx, cy, R, { b: 1.1, w: 1.5, o: .15 }, Math.max(90, Math.round(R * .7))));
  for (const c of CR) {
    const t1 = norm3(cross3([0, 0, 1], c.n)), t2 = cross3(c.n, t1), pts = [];
    for (let k = 0; k <= 40; k++) { const a = k / 40 * Math.PI * 2, v = norm3([c.n[0] + c.r * 1.6 * (Math.cos(a) * t1[0] + Math.sin(a) * t2[0]), c.n[1] + c.r * 1.6 * (Math.cos(a) * t1[1] + Math.sin(a) * t2[1]), c.n[2] + c.r * 1.6 * (Math.cos(a) * t1[2] + Math.sin(a) * t2[2])]); if (v[2] > 0) pts.push([cx + R * v[0], cy + R * v[1]]); }
    if (pts.length > 2) out.push(mkLine(pts, { b: .55 * lit(c.n), w: .9, o: .04 }));
  }
  // maria: soft closed blobs (contours of a low-frequency field)
  const g = 64, Hf = new Float32Array(g * g);
  for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) { const nx = (i / (g - 1)) * 2 - 1, ny = (j / (g - 1)) * 2 - 1, z2 = 1 - nx * nx - ny * ny; Hf[j * g + i] = z2 <= .02 ? NaN : fbm(nx * 2.2 + 4, ny * 2.2 + 1, Math.sqrt(z2) * 2.2, seed + 3, 3); }
  for (const c of contours(Hf, g, g, [.5, .56], (i, j) => [cx + ((i / (g - 1)) * 2 - 1) * R, cy + ((j / (g - 1)) * 2 - 1) * R])) out.push(mkLine(c.pts, { b: .4, w: .9, o: .05 }));
  return out.filter(Boolean);
}
