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
import { mkLine, splitLine } from './index.js';

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
    out.push({ n: [nx, ny, Math.sqrt(z2)], r: .003 + .06 * Math.pow(sz, 1.25), depth: .6 + .4 * h3(i, 4, seed, 3), id: i });
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

// The surface as RIDGE LINES: rings of equal distance from the camera (orthographic: concentric arcs parallel to the
// limb, crowding toward it as the sphere foreshortens), each lifted by the height field and cut by the nearer ones
// (floating horizon, near to far). Calm, directional, a horizon you could walk to: craters read as dents with lit far
// rims, the limb itself carries the relief in profile (kept below the reference circle, so the circle test that
// occludes the Earth never leaves a gap). sun: screen direction toward the Sun (x right, y down).
function lunarHeight(n, CR, seed) {
  let h = .0022 * (fbm(n[0] * 7 + 3, n[1] * 7 - 1, n[2] * 7 + 5, seed, 4) - .5) + .0009 * (fbm(n[0] * 26, n[1] * 26, n[2] * 26, seed + 7, 3) - .5);
  for (const c of CR) {
    const dx = n[0] - c.n[0], dy = n[1] - c.n[1], dz = n[2] - c.n[2], d2 = (dx * dx + dy * dy + dz * dz) / (c.r * c.r);
    if (d2 > 3.6) continue;
    const d = Math.sqrt(d2);
    h += c.r * c.depth * (d < 1 ? .2 * (d * d - 1) : .07 * Math.exp(-(((d - 1) / .3) ** 2)));      // bowl + raised rim
  }
  return h;
}
export function lunarLimb(W, H, o = {}) {
  const s = H / 1080, RM = (o.RM ?? 1.6) * W, yTop = (o.yTop ?? .6) * H, cx = W / 2, cy = yTop + RM, seed = o.seed ?? 5, gain = o.gain ?? 1;
  const sun = o.sun ?? [-.85, -.25], out = [];
  const th0 = -Math.PI / 2 - Math.asin(Math.min(1, (W / 2 + 40) / RM)), th1 = -Math.PI / 2 + Math.asin(Math.min(1, (W / 2 + 40) / RM));
  const nT = Math.ceil((th1 - th0) * RM / (2.2 * s)), dT = (th1 - th0) / nT;
  const region = [-(W / 2 + 80) / RM, (W / 2 + 80) / RM, -1, (H + 60 - cy) / RM];
  const CR = craters(seed, o.nCraters ?? 150, region).map(c => ({ ...c, r: c.r * .8 }));
  // ridge radii: from the limb (j = 0) toward the camera, spacing growing ~1.5 px -> ~11 px at the frame's bottom
  const D = (H + 50 * s) - yTop, nR = o.ridges ?? 66, rho = j => RM - D * Math.pow(j / (nR - 1), 1.45);
  const hmax = .0013;                                   // relief is measured downward from the reference sphere
  const rmax = new Float32Array(nT + 1).fill(-1e9);
  const rows = [];
  for (let j = nR - 1; j >= 0; j--) {
    const c0 = rho(j) / RM, z = Math.sqrt(Math.max(0, 1 - c0 * c0)), pts = [], vis = [], bb = [];
    let hp = 0;
    for (let i = 0; i <= nT; i++) {
      const th = th0 + i * dT, nx = c0 * Math.cos(th), ny = c0 * Math.sin(th), h = lunarHeight([nx, ny, z], CR, seed) - hmax;
      const r = RM * (1 + h) * c0, x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
      const ok = r > rmax[i] + .25 * s; if (r > rmax[i]) rmax[i] = r;
      // light: the slope along the ridge facing the low Sun (from the left) is lit; dents' far walls catch it
      const slope = i ? (h - hp) * RM / (dT * RM) : 0; hp = h;
      const face = clamp(.5 - 1.5 * slope * Math.sign(sun[0] || -1));
      const far = 1 - j / (nR - 1);
      pts.push([x, y]); vis.push(ok);
      bb.push(gain * (.1 + .2 * far + .02) * (.45 + 1.1 * face * face) * (1 - .45 * sstep(.15 * H, H, y - yTop)));
    }
    rows.push({ j, pts, vis, bb });
  }
  for (const R of rows) {
    const L = mkLine(R.pts, { b: R.bb, w: (.75 + .2 * (R.j === 0)) * s + .2, o: .03, spd: .3, phase: R.j * .37, flags: FL.SHARP });
    if (!L) continue;
    if (R.j === 0) { L.b = L.b.map(v => v * 0 + 1.2 * gain); L.w.fill(1.6 * s); L.o.fill(.22); L.flags = FL.NOFADE; out.push(L); continue; }   // the limb: crisp, bright, a touch of orange
    for (const piece of splitLine(L, (x, y, k) => R.vis[k], 3)) out.push(piece);
  }
  // a soft second limb line just inside (the glow of the sunlit horizon)
  const limb = rows.find(R => R.j === 0);
  out.push(mkLine(limb.pts.map(([x, y]) => [x, y + 2.5 * s]), { b: .32 * gain, w: 1.0, o: .1 }));
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
