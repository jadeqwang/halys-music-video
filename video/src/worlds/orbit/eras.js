// orbit/eras.js: the procedural line worlds of the cascade (S64-S71), each built around the ring locked at frame centre.
// Everything returns engine lines (../line/trace.js format) in output px for a W x H frame; static sets are built once
// per size by the scene (staticMesh), moving parts every frame (dynLayer).
//
//   gearLines(r, teeth, o)                 an Antikythera-style wheel centred at (0, 0): triangular teeth, rim, spokes, hub
//   gearTrain(W, H)                        the S64 wheels: centres, radii, tooth counts, meshing phases (per-wheel angle fn)
//   sarosSpiral(cx, cy, R, o)              the lower back dial: a 4-turn spiral of 223 month cells with eclipse glyphs
//   halleyMap(W, H, o)                     Halley's 1715 broadside in lines: water-lined coasts, graticule, towns, path
//   eddingtonPlate(W, H, o)                the 1919 glass plate: edges, reseau, the Hyades, measured stars
//   portholeLines(cx, cy, Rp, s)           Concorde 001's roof porthole: bezel, rivets, glass glints
//   orionWindow(W, H, s)                   the Orion crew-module window frame and a sliver of cabin
//   marsHorizon(W, H, s)                   Jezero's rim, dunes, rocks (orange)
//   phobosOutline(cx, cy, R, t)            the lumpy potato (polygon, screen px)

import { proc, FL } from '../line/index.js';
import { TAU, clamp, lerp, sstep, hash3, fbm, vnoise } from '../../core.js';
import { mkLine, dot, splitLine } from './index.js';
import { BRITAIN } from './geo.gen.js';

const P = proc.line;

// ---------------------------------------------------------------- S64: the Antikythera mechanism
export function gearLines(r, teeth, o = {}) {
  const out = [], depth = o.depth ?? Math.min(r * .085, 14), pts = [], A = { b: o.b ?? 1, w: o.w ?? 1.2, o: o.o ?? .8 };
  for (let i = 0; i < teeth; i++) {                      // triangular teeth (the mechanism's are filed triangles)
    const a0 = i / teeth * TAU, da = TAU / teeth;
    pts.push([Math.cos(a0) * (r - depth), Math.sin(a0) * (r - depth)]);
    pts.push([Math.cos(a0 + da * .5) * r, Math.sin(a0 + da * .5) * r]);
  }
  pts.push(pts[0]);
  out.push(mkLine(pts, { ...A, flags: FL.NOFADE, spd: .5 }));
  const ring = (rr, b, w, n = 0) => out.push(proc.circle(0, 0, rr, { b: A.b * b, w: A.w * w, o: A.o }, n || Math.max(36, Math.round(rr / 2.5))));
  ring(r - depth * 1.9, .55, .8);                         // rim inner edge
  const spokes = o.spokes ?? (r > 120 ? 4 : 0), hub = r * (o.hub ?? .14);
  ring(hub, .8, .9); ring(hub * .45, .6, .7);
  if (spokes) {
    const rin = r - depth * 1.9, wdt = o.spokeW ?? Math.max(.09, 22 / r);
    for (let i = 0; i < spokes; i++) {                    // broad arms: two edges each, flaring into the rim
      const a = (i + .5) / spokes * TAU;
      for (const sg of [-1, 1]) {
        const e = []; for (let k = 0; k <= 16; k++) { const u = k / 16, rr = lerp(hub * 1.05, rin * .99, u), aa = a + sg * (wdt * (.6 + .9 * u * u)) * (r / rr) * .35; e.push([Math.cos(aa) * rr, Math.sin(aa) * rr]); }
        out.push(mkLine(e, { ...A, b: A.b * .7, w: A.w * .85 }));
      }
    }
  } else if (r > 45) ring(r * .55, .45, .7);
  return out.filter(Boolean);
}
// the wheels of S64 (16:9 design px at 1080, scaled by s): centres chosen so each meshes with its parent at the pitch circle
export function gearTrain(W, H) {
  const s = H / 1080, cx = W / 2, cy = H / 2, pitch = 2 * Math.PI * 255 * s / 96;   // equal tooth pitch for every wheel
  const G = [];
  const add = (x, y, teeth, parent = null, ang = 0, o = {}) => {
    const r = teeth * pitch / TAU;
    if (parent != null) { const p = G[parent], d = p.r + r - p.depth * .55; x = p.x + Math.cos(ang) * d; y = p.y + Math.sin(ang) * d; }
    G.push({ x, y, r, teeth, parent, ang, depth: Math.min(r * .085, 14 * s), ...o });
    return G.length - 1;
  };
  const b1 = add(cx - .62 * W, cy - .2 * H, 96, null, 0, { spokes: 4 });             // the main drive wheel (b1), mostly off left
  const c1 = add(0, 0, 38, b1, -.12, {});
  const c2 = add(0, 0, 48, c1, -.95, {});
  const d1 = add(cx + .36 * W, cy + .34 * H, 64, null, 0, { spokes: 4 });            // lower right train
  const d2 = add(0, 0, 24, d1, -2.25, {});
  const e1 = add(0, 0, 32, d1, -1.15, {});
  const f1 = add(cx + .4 * W, cy - .36 * H, 54, null, 0, { spokes: 4 });             // upper right
  const f2 = add(0, 0, 20, f1, 2.45, {});
  const g1 = add(cx - .4 * W, cy + .42 * H, 40, null, 0, {});                        // lower left
  // rotation: the root of each chain turns at its own rate; meshing wheels turn the other way at r_parent / r
  for (const g of G) {
    if (g.parent == null) { g.rate = g === G[b1] ? .22 : g === G[d1] ? -.3 : g === G[f1] ? .26 : -.34; g.phase0 = hash3(g.teeth, 3, 7) * TAU; }
    else {
      const p = G[g.parent]; g.rate = -p.rate * p.r / g.r;
      // a gap of the child faces a tooth of the parent at the contact point
      const fracP = ((g.ang - p.phase0) / TAU * p.teeth % 1 + 1) % 1;
      g.phase0 = (g.ang + Math.PI) - (fracP + .5) * TAU / g.teeth;
    }
  }
  return { G, angle: (g, turn) => g.phase0 + g.rate * turn };
}
// the saros dial: 4 turns, 223 cells, glyphs in the eclipse months (51 of them)
export function sarosSpiral(cx, cy, R, o = {}) {
  const r0 = o.r0 ?? 1.62 * R, r1 = o.r1 ?? 3.95 * R, turns = 4, cells = 223, out = [];
  const rAt = th => r0 + (r1 - r0) * th / (turns * TAU), pitch = (r1 - r0) / turns;
  const a0 = o.a0 ?? -Math.PI / 2;
  const spiral = (off, b, w) => { const pts = []; for (let k = 0; k <= turns * 360; k++) { const th = k / 360 * TAU, r = rAt(th) + off; pts.push([cx + Math.cos(a0 + th) * r, cy + Math.sin(a0 + th) * r]); } out.push(mkLine(pts, { b, w, o: .04, flags: FL.NOFADE, spd: .35 })); };
  spiral(-pitch * .5, .85, 1.1); spiral(pitch * .5, .85, 1.1);           // the groove's two walls
  spiral(-pitch * .5 - 4, .25, .7);
  // the outer rim of the dial and its scale
  out.push(proc.circle(cx, cy, r1 + pitch * .62, { b: .7, w: 1.2, o: .1 }, 400));
  out.push(proc.circle(cx, cy, r1 + pitch * .75, { b: .35, w: .8, o: .1 }, 400));
  for (let i = 0; i < 180; i++) { const a = i / 180 * TAU, l = i % 5 === 0 ? 14 : 7, rr = r1 + pitch * .75; out.push(P([[cx + Math.cos(a) * rr, cy + Math.sin(a) * rr], [cx + Math.cos(a) * (rr + l), cy + Math.sin(a) * (rr + l)]], { b: .4, w: .7, o: .1 })); }
  const glyphs = [];
  for (let i = 0; i <= cells; i++) {
    const th = i / cells * turns * TAU, r = rAt(th), a = a0 + th, c = Math.cos(a), sn = Math.sin(a);
    out.push(P([[cx + c * (r - pitch * .5), cy + sn * (r - pitch * .5)], [cx + c * (r + pitch * .5), cy + sn * (r + pitch * .5)]], { b: .55, w: .8, o: .04 }));
    if (i < cells && hash3(i, 17, 5) < 51 / 223) {
      const thm = (i + .5) / cells * turns * TAU, rm = rAt(thm), am = a0 + thm, gx = cx + Math.cos(am) * rm, gy = cy + Math.sin(am) * rm, gs = pitch * .17;
      const solar = hash3(i, 18, 5) < .45;                 // H (helios) or S (selene): a disk with a bite, or a ring
      if (solar) { out.push(proc.circle(gx, gy, gs, { b: 1.1, w: .9, o: .9 }, 18)); out.push(proc.ellipse(gx + gs * .55, gy, gs * .75, gs * .75, 0, { b: .9, w: .8, o: .9 }, 14, 2.2, 4.1)); }
      else { out.push(proc.circle(gx, gy, gs * .8, { b: .95, w: .8, o: .35 }, 16)); out.push(dot(gx, gy, 1.2, 1.6, .35)); }
      glyphs.push(i);
    }
  }
  // two rings of engraved glyphs (the dial's inscriptions)
  for (const [rr, sz, sd] of [[r1 + pitch * 1.18, 9, 41], [r0 - pitch * .55, 7, 43]]) {
    const n = Math.round(TAU * rr / (sz * 2.1));
    for (let i = 0; i < n; i++) {
      if (hash3(i, sd, 2) < .18) continue;
      const a = i / n * TAU, gx = cx + Math.cos(a) * rr, gy = cy + Math.sin(a) * rr, tx = -Math.sin(a), ty = Math.cos(a), kind = Math.floor(hash3(i, sd, 1) * 5), h = sz * .5;
      const rot = (u, v) => [gx + tx * u + Math.cos(a) * v, gy + ty * u + Math.sin(a) * v];
      const A = { b: .42 + .25 * hash3(i, sd, 3), w: .75, o: .55 };
      if (kind === 0) out.push(P([rot(-h, -h), rot(-h, h)], A), P([rot(-h, 0), rot(h, 0)], A));
      else if (kind === 1) out.push(P([rot(-h, h), rot(0, -h), rot(h, h)], A));
      else if (kind === 2) out.push(proc.ellipse(gx, gy, h * .8, h * .8, 0, A, 10));
      else if (kind === 3) out.push(P([rot(-h, -h), rot(h, -h), rot(h, h)], A));
      else out.push(P([rot(0, -h), rot(0, h)], A), P([rot(-h, -h * .4), rot(h, -h * .4)], A));
    }
  }
  return { lines: out.filter(Boolean), rAt, a0, r0, r1, pitch, cells, turns, glyphs };
}

// ---------------------------------------------------------------- S65: Halley's 1715 map
// map space: km east/north of London (51.507 N, -0.128 E), equirectangular at 52 N
const LON0 = -.128, LAT0 = 51.507, KX = 111.32 * Math.cos(52 * Math.PI / 180), KY = 110.57;
export const llToKm = (lon, lat) => [(lon - LON0) * KX, (lat - LAT0) * KY];
// the central line of totality, 22 Apr / 3 May 1715 (Cornwall -> London -> the Norfolk coast), km
export const PATH1715 = [[-5.9, 49.85], [-4.2, 50.35], [-2.6, 50.85], [-1.2, 51.25], [-.128, 51.507], [.9, 51.85], [1.75, 52.3], [2.6, 52.85]].map(([a, b]) => llToKm(a, b));
export function pathAt(u) {                    // u: km along the path from its start -> [x, y, dirx, diry]
  let acc = 0;
  for (let i = 1; i < PATH1715.length; i++) {
    const a = PATH1715[i - 1], b = PATH1715[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (acc + l >= u || i === PATH1715.length - 1) { const k = clamp((u - acc) / l, -2, 3); return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), (b[0] - a[0]) / l, (b[1] - a[1]) / l]; }
    acc += l;
  }
}
export const PATH_LONDON = (() => { let acc = 0; for (let i = 1; i <= 4; i++) acc += Math.hypot(PATH1715[i][0] - PATH1715[i - 1][0], PATH1715[i][1] - PATH1715[i - 1][1]); return acc; })();
function smoothPts(pts, n = 2) {
  let p = pts;
  for (let it = 0; it < n; it++) p = p.map((q, i) => i === 0 || i === p.length - 1 ? q : [(p[i - 1][0] + 2 * q[0] + p[i + 1][0]) / 4, (p[i - 1][1] + 2 * q[1] + p[i + 1][1]) / 4]);
  return p;
}
// offset a polyline by d along its normal (positive = to the left of travel in a y-UP space)
function offsetPts(pts, d) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
    out.push([pts[i][0] - ty * d, pts[i][1] + tx * d]);
  }
  return out;
}
// the map in km (y up), cached per water-line offsets (km): coasts with water lines on the sea side, towns
const _halley = new Map();
export function halleyKm(offs = [2.2, 5.2]) {
  const key = offs.join(','); if (_halley.has(key)) return _halley.get(key);
  const coasts = [], water = [];
  for (const piece of BRITAIN) {
    let pts = []; for (let i = 0; i < piece.p.length; i += 2) pts.push(llToKm(piece.p[i] / 1000, piece.p[i + 1] / 1000));
    if (piece.c) pts.push(pts[0]);
    pts = smoothPts(pts, 1);
    coasts.push(pts);
    offs.forEach((d, j) => water.push({ pts: smoothPts(offsetPts(pts, piece.s * d), 2), j }));
  }
  const towns = [[-.128, 51.507, 1], [-1.26, 51.75, .6], [-2.59, 51.45, .7], [1.30, 52.63, .6], [-1.08, 53.96, .55], [-4.14, 50.37, .55], [-2.24, 53.48, .5], [1.08, 51.28, .5], [-1.78, 51.07, .5], [-3.53, 50.72, .5]].map(([a, b, k]) => [...llToKm(a, b), k]);
  const M = { coasts, water, towns }; _halley.set(key, M); return M;
}
// map km -> screen px: the oval (ring) sits at the screen centre over path position u; scale px per km. Crisp (SHARP):
// an engraving, not a glow; the ring keeps the only glow in the frame
export function halleyLines(W, H, scale, centreKm) {
  const s = H / 1080, cx = W / 2, cy = H / 2, M = halleyKm([3.2 * s / scale, 7.4 * s / scale].map(v => +v.toFixed(3))), out = [];
  const X = ([x, y]) => [cx + (x - centreKm[0]) * scale, cy - (y - centreKm[1]) * scale];
  const vis = q => q[0] > -200 * s && q[0] < W + 200 * s && q[1] > -200 * s && q[1] < H + 200 * s;
  const emit = (pts, a) => { let cur = []; for (const p of pts) { const q = X(p); if (vis(q)) cur.push(q); else { if (cur.length > 1) out.push(mkLine(cur, a)); cur = []; } } if (cur.length > 1) out.push(mkLine(cur, a)); };
  for (const c of M.coasts) emit(c, { b: 1.25, w: 1.25, o: .06, flags: FL.NOFADE | FL.SHARP, spd: .4 });
  for (const w of M.water) emit(w.pts, { b: [.5, .3][w.j], w: [.8, .7][w.j], o: .1, flags: FL.SHARP, spd: .3, phase: w.j * 1.3 });
  for (let lon = -11; lon <= 9; lon++) { const pts = []; for (let lat = 48; lat <= 59.5; lat += .1) pts.push(llToKm(lon, lat)); emit(pts, { b: .2, w: .7, o: .3, flags: FL.SHARP }); }
  for (let lat = 48; lat <= 59; lat++) { const pts = []; for (let lon = -11; lon <= 9; lon += .1) pts.push(llToKm(lon, lat)); emit(pts, { b: .2, w: .7, o: .3, flags: FL.SHARP }); }
  for (const [x, y, k] of M.towns) { const q = X([x, y]); if (!vis(q)) continue; out.push(proc.circle(q[0], q[1], (3 + 3 * k) * s, { b: .9 * k + .3, w: .9, o: .2, flags: FL.SHARP | FL.NOFADE }, 14)); out.push(dot(q[0], q[1], 1.2 + k, 2.2, .2, FL.TIP | FL.SHARP)); }
  return out.filter(Boolean);
}
// the path of totality (limits) and its central line, in screen px for the current map placement
export function halleyPath(W, H, scale, centreKm, uNow, halfWidthKm = 95) {
  const cx = W / 2, cy = H / 2, out = [];
  const X = (x, y) => [cx + (x - centreKm[0]) * scale, cy - (y - centreKm[1]) * scale];
  for (const sg of [-1, 1]) {
    const pts = []; for (let u = -250; u <= 1100; u += 6) { const [x, y, dx, dy] = pathAt(u); pts.push(X(x - dy * sg * halfWidthKm, y + dx * sg * halfWidthKm)); }
    out.push(mkLine(pts, { b: 1.05, w: 1.3, o: 1, flags: FL.NOFADE | FL.SHARP, spd: .6 }));
  }
  const cpts = []; for (let u = -250; u <= 1100; u += 6) { const [x, y] = pathAt(u); cpts.push(X(x, y)); }
  out.push(mkLine(cpts, { b: .35, w: .8, o: .9, flags: FL.SHARP, spd: 1.2 }));
  return out;
}
// Halley's shadow oval around the ring: an ellipse along the path, hatched between the ring's limb and the oval
export function shadowOval(cx, cy, R, ang, o = {}) {
  const out = [], ax = R * (o.ax ?? 1.55), ay = R * (o.ay ?? 1.18), c = Math.cos(ang), sn = Math.sin(ang);
  const E = (u, v) => [cx + u * c - v * sn, cy + u * sn + v * c];
  out.push(proc.ellipse(cx, cy, ax, ay, ang, { b: o.b ?? 1.3, w: 1.6, o: .55, flags: FL.NOFADE | FL.SHARP }, 160));
  out.push(proc.ellipse(cx, cy, ax + 7, ay + 7, ang, { b: (o.b ?? 1.3) * .45, w: .9, o: .55, flags: FL.SHARP }, 160));
  const step = o.step ?? 5.5;
  for (let v = -ay; v <= ay; v += step) {                 // engraved hatching across the oval, outside the disk
    const hw = ax * Math.sqrt(Math.max(0, 1 - (v / ay) ** 2)); if (hw < 2) continue;
    const pts = []; for (let k = 0; k <= 24; k++) pts.push(E(lerp(-hw, hw, k / 24), v));
    out.push(...splitLine(mkLine(pts, { b: .62, w: .8, o: .3, flags: FL.SHARP }), (x, y) => Math.hypot(x - cx, y - cy) > R * 1.08));
  }
  return out;
}

// ---------------------------------------------------------------- S66: Eddington's plate
// The 1919 field: the Hyades around the eclipsed Sun (schematic V), the measured stars marked with the published plate's
// paired horizontal ticks; displacements radial, 1.75" at the limb, exaggerated (k = px at the limb at full bend).
export function hyades(cx, cy, R, s, seed = 19) {
  const stars = [];
  const V = [[-3.1, -1.2], [-2.3, -.9], [-1.55, -.55], [-2.6, .35], [-1.8, .2], [1.75, -1.1], [2.6, -1.6], [3.4, -2.05], [2.4, .9], [3.3, 1.35], [-.6, 2.15], [.9, -2.5], [-4.1, -1.6], [4.2, -.4]];
  V.forEach(([u, v], i) => stars.push({ x: cx + u * R, y: cy + v * R, mag: .8 + .7 * hash3(i, seed, 1), measured: true, id: i }));
  for (let i = 0; i < 170; i++) {
    const x = hash3(i, seed, 2), y = hash3(i, seed, 3), r = Math.hypot((x - .5) * 16 / 9, y - .5);
    if (r < .13) continue;
    stars.push({ x: x * cx * 2, y: y * cy * 2, mag: .25 + .5 * Math.pow(hash3(i, seed, 4), 3), measured: false, id: 100 + i });
  }
  return stars;
}
export function eddingtonPlate(W, H, o = {}) {
  const s = H / 1080, cx = W / 2, cy = H / 2, out = [], pw = (o.pw ?? .8) * W, ph = (o.ph ?? .86) * H;
  const x0 = cx - pw / 2, y0 = cy - ph / 2, x1 = cx + pw / 2, y1 = cy + ph / 2, ch = 46 * s;
  // the plate's edge (two lines: the glass's thickness) with a chipped corner
  const edge = [[x0 + ch * .3, y0], [x1, y0], [x1, y1 - ch * 1.2], [x1 - ch * .5, y1 - ch * .4], [x1 - ch, y1 - ch * .7], [x1 - ch * 1.5, y1], [x0, y1], [x0, y0 + ch * .3], [x0 + ch * .3, y0]];
  out.push(mkLine(edge, { b: .95, w: 1.4, o: .05, flags: FL.NOFADE, spd: .3 }));
  out.push(mkLine(edge.map(([x, y]) => [cx + (x - cx) * .985, cy + (y - cy) * .978]), { b: .32, w: .8, o: .05 }));
  // reseau: a fine measuring grid (dim)
  const g = 72 * s;
  for (let x = cx - Math.floor((cx - x0) / g) * g; x < x1 - 4; x += g) out.push(P([[x, y0 + 10 * s], [x, y1 - 10 * s]], { b: .085, w: .6, o: .1 }));
  for (let y = cy - Math.floor((cy - y0) / g) * g; y < y1 - 4; y += g) out.push(P([[x0 + 10 * s, y], [x1 - 10 * s, y]], { b: .085, w: .6, o: .1 }));
  // fiducial crosses at the corners, a scale bar
  for (const [fx, fy] of [[x0 + 40 * s, y0 + 40 * s], [x1 - 40 * s, y0 + 40 * s], [x0 + 40 * s, y1 - 40 * s]]) { out.push(P([[fx - 12 * s, fy], [fx + 12 * s, fy]], { b: .6, w: .9 }), P([[fx, fy - 12 * s], [fx, fy + 12 * s]], { b: .6, w: .9 })); }
  for (let i = 0; i <= 10; i++) { const x = x1 - 330 * s + i * 28 * s; out.push(P([[x, y1 - 34 * s], [x, y1 - (i % 5 ? 42 : 48) * s]], { b: .4, w: .8, o: .4 })); }
  out.push(P([[x1 - 330 * s, y1 - 34 * s], [x1 - 50 * s, y1 - 34 * s]], { b: .4, w: .8, o: .4 }));
  return { lines: out.filter(Boolean), rect: [x0, y0, x1, y1] };
}
// the stars at bend k (0..1): background points, measured stars with their tick pairs, displacement arrows, true rings
export function eddingtonStars(stars, cx, cy, R, s, k, flash = 0, rect = null) {
  const out = [], disp = 30 * s;
  const inPlate = (x, y) => !rect || (x > rect[0] + 8 && x < rect[2] - 8 && y > rect[1] + 8 && y < rect[3] - 8);
  for (const st of stars) {
    const dx = st.x - cx, dy = st.y - cy, r = Math.hypot(dx, dy) || 1;
    if (r < R * 1.25 || !inPlate(st.x, st.y)) continue;
    if (!st.measured) { out.push(dot(st.x, st.y, st.mag * 1.4, 1.6 + st.mag, 0, FL.TIP | FL.SHARP)); continue; }
    const d = disp * k * (R / r) * 1.9, ax = st.x + dx / r * d, ay = st.y + dy / r * d;
    out.push(dot(ax, ay, (2.2 + 1.6 * flash) * st.mag, 3.2 + st.mag, 0, FL.TIP));
    out.push(proc.circle(st.x, st.y, 4.5 * s, { b: .38, w: .7, o: .5 }, 12));                    // where it should have been
    const tw = 13 * s, gap = 9 * s;
    out.push(P([[ax - gap - tw, ay], [ax - gap, ay]], { b: .85, w: 1.1, o: .2 }), P([[ax + gap, ay], [ax + gap + tw, ay]], { b: .85, w: 1.1, o: .2 }));
    if (d > 3) {                                                                                     // the bend, as a small arrow
      const ux = dx / r, uy = dy / r, hx = ax - ux * 3 * s, hy = ay - uy * 3 * s;
      out.push(P([[st.x + ux * 5 * s, st.y + uy * 5 * s], [hx, hy]], { b: .9, w: 1.0, o: 1 }));
      out.push(P([[hx - ux * 6 * s - uy * 4 * s, hy - uy * 6 * s + ux * 4 * s], [hx, hy], [hx - ux * 6 * s + uy * 4 * s, hy - uy * 6 * s - ux * 4 * s]], { b: .9, w: 1.0, o: 1 }));
    }
  }
  return out.filter(Boolean);
}
// light paths grazing the Sun: straight far away, bent toward it near the limb (deflection exaggerated), orange
export function lightRays(cx, cy, R, W, s, k = 1) {
  const out = [];
  for (const [b, sg] of [[1.45, 1], [2.3, 1], [3.4, 1], [1.7, -1], [2.8, -1]]) {
    const bb = b * R * sg, kap = .16 * R * R * k, pts = [];
    for (let x = -W * .62; x <= W * .62; x += 8 * s) { const y = bb - sg * (kap / (b * R)) * (x + Math.sqrt(x * x + bb * bb)) / 1.0; pts.push([cx + x, cy + y]); }
    out.push(...splitLine(mkLine(pts, { b: .3, w: .8, o: 1, spd: 1.6 }), (x, y) => Math.hypot(x - cx, y - cy) > R * 1.1));
  }
  return out;
}

// ---------------------------------------------------------------- S67: Concorde 001's porthole
export function portholeLines(cx, cy, Rp, s) {
  const out = [], A = { o: .08, flags: FL.NOFADE };
  out.push(proc.circle(cx, cy, Rp, { ...A, b: 1.15, w: 1.6 }, 220));
  out.push(proc.circle(cx, cy, Rp + 9 * s, { ...A, b: .55, w: 1.0 }, 220));
  out.push(proc.circle(cx, cy, Rp + 34 * s, { ...A, b: .75, w: 1.3 }, 240));
  out.push(proc.circle(cx, cy, Rp + 40 * s, { ...A, b: .3, w: .8 }, 240));
  for (let i = 0; i < 16; i++) { const a = (i + .5) / 16 * TAU, r = Rp + 22 * s; out.push(proc.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 4.2 * s, { b: .8, w: 1.0, o: .3 }, 12)); }
  // glass glints: two short arcs, upper left
  out.push(proc.ellipse(cx, cy, Rp * .88, Rp * .88, 0, { b: .3, w: 1.2, o: 0 }, 40, 3.55, 3.95));
  out.push(proc.ellipse(cx, cy, Rp * .8, Rp * .8, 0, { b: .18, w: .9, o: 0 }, 30, 3.62, 3.85));
  return out.filter(Boolean);
}

// ---------------------------------------------------------------- S69: Orion's window
// a rounded trapezoid window (wider at the bottom), its thick frame, bolts, and a sliver of cabin around it
function roundedPoly(pts, rad, n = 8) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i + pts.length - 1) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
    const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]], l1 = Math.hypot(...v1), l2 = Math.hypot(...v2);
    const r = Math.min(rad, l1 * .45, l2 * .45), p1 = [b[0] + v1[0] / l1 * r, b[1] + v1[1] / l1 * r], p2 = [b[0] + v2[0] / l2 * r, b[1] + v2[1] / l2 * r];
    for (let k = 0; k <= n; k++) { const u = k / n, q = 1 - u; out.push([q * q * p1[0] + 2 * q * u * b[0] + u * u * p2[0], q * q * p1[1] + 2 * q * u * b[1] + u * u * p2[1]]); }
  }
  out.push(out[0]);
  return out;
}
export function orionWindowShape(cx, cy, s, inset = 0) {
  const tw = 300 * s - inset, bw = 380 * s - inset, h = 270 * s - inset, yo = 8 * s;
  return roundedPoly([[cx - tw, cy - h + yo], [cx + tw, cy - h + yo], [cx + bw, cy + h + yo], [cx - bw, cy + h + yo]], 70 * s - inset * .5, 10);
}
export function orionWindow(W, H, s) {
  const cx = W / 2, cy = H / 2, out = [];
  const glass = orionWindowShape(cx, cy, s, 0);
  // the pane stack: the inner pane's edge, then the frame's deep bevel (the outer panes sit lower-right: depth)
  out.push(mkLine(glass, { b: 1.15, w: 1.7, o: .05, flags: FL.NOFADE | FL.SHARP, spd: .4 }));
  const deep = orionWindowShape(cx + 16 * s, cy + 12 * s, s, 22 * s);
  out.push(mkLine(deep, { b: .42, w: 1.0, o: .1, flags: FL.NOFADE }));
  for (let i = 0; i < glass.length - 1; i += Math.round(glass.length / 4)) {        // bevel edges at the four corners
    const j = Math.round(i * (deep.length - 1) / (glass.length - 1)); out.push(P([glass[i], deep[j]], { b: .3, w: .8, o: .1 }));
  }
  out.push(mkLine(orionWindowShape(cx, cy, s, -16 * s), { b: .55, w: 1.1, o: .05, flags: FL.NOFADE }));
  out.push(mkLine(orionWindowShape(cx, cy, s, -58 * s), { b: .85, w: 1.4, o: .12, flags: FL.NOFADE | FL.SHARP }));
  out.push(mkLine(orionWindowShape(cx, cy, s, -66 * s), { b: .3, w: .8, o: .12, flags: FL.NOFADE }));
  // bolts around the frame
  const fr = orionWindowShape(cx, cy, s, -37 * s);
  let acc = 0, next = 0; for (let i = 1; i < fr.length; i++) { acc += Math.hypot(fr[i][0] - fr[i - 1][0], fr[i][1] - fr[i - 1][1]); if (acc >= next) { out.push(proc.circle(fr[i][0], fr[i][1], 3.8 * s, { b: .75, w: .9, o: .3, flags: FL.SHARP }, 10)); next += 54 * s; } }
  // a glint across the glass
  out.push(P([[cx - 250 * s, cy - 120 * s], [cx - 120 * s, cy - 250 * s]], { b: .16, w: 2.2, o: 0 }), P([[cx - 210 * s, cy - 60 * s], [cx - 40 * s, cy - 230 * s]], { b: .08, w: 1.4, o: 0 }));
  // the cabin: the conical wall's panel seams (arcs around the window), handholds, a strap: dim and warm
  const A = { b: .22, w: .9, o: .3 };
  for (const [rx, ry, a0, a1] of [[560, 470, 3.6, 5.8], [640, 540, 3.5, 5.9], [700, 600, .45, 2.7]]) out.push(proc.ellipse(cx, cy + 20 * s, rx * s, ry * s, 0, A, 90, a0, a1));
  for (const [hx, hy] of [[-560, -40], [560, 60]]) {
    const pts = []; for (let k = 0; k <= 20; k++) { const u = k / 20; pts.push([cx + (hx + 26 * Math.cos(u * Math.PI)) * s, cy + (hy - 150 + 300 * u) * s]); }
    out.push(mkLine(pts, { b: .32, w: 1.6, o: .35 }), mkLine(pts.map(([x, y]) => [x + 9 * s, y]), { b: .16, w: 1, o: .35 }));
  }
  const strap = []; for (let k = 0; k <= 30; k++) { const u = k / 30; strap.push([cx + lerp(330, 760, u) * s, cy + (380 + 70 * Math.sin(Math.PI * u)) * s]); }
  out.push(mkLine(strap, { b: .2, w: 2.2, o: .45 }));
  return { lines: out.filter(Boolean), glass };
}
export function pointInPoly(x, y, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

// ---------------------------------------------------------------- S71: Mars, Phobos crossing the Sun
// Jezero's far rim (jagged), mid-ground dunes, near ripples and rocks, all in signal orange; dusty sky streaks
export function marsHorizon(W, H, s, seed = 71) {
  const out = [], yH = .7 * H;
  // Jezero's far rim: a jagged range, a few strata below its crest
  const rim = [];
  for (let x = -20; x <= W + 20; x += 5 * s) { const u = x / W, h = 30 * s * fbm(u * 5, 1.3, seed, 4) + 16 * s * fbm(u * 17, 2.1, seed + 3, 3) + 34 * s * Math.exp(-(((u - .16) / .08) ** 2)) + 46 * s * Math.exp(-(((u - .8) / .11) ** 2)); rim.push([x, yH - h]); }
  out.push(mkLine(rim, { b: 1.05, w: 1.5, o: 1, flags: FL.NOFADE, spd: .5 }));
  for (let j = 1; j <= 6; j++) out.push(mkLine(rim.map(([x, y]) => [x, y + j * j * 1.9 * s + 4 * s * fbm(x / (80 * s), j, seed + 9, 2)]), { b: .4 / j + .08, w: .8, o: 1 }));
  // a mesa in the middle distance (left), its cliff hatched
  const mesa = []; for (let k = 0; k <= 40; k++) { const u = k / 40, x = lerp(.06, .34, u) * W, top = yH + 18 * s - 52 * s * Math.min(1, Math.min(u, 1 - u) * 9) + 4 * s * fbm(u * 9, 3, seed, 2); mesa.push([x, top]); }
  out.push(mkLine(mesa, { b: .85, w: 1.3, o: .95, flags: FL.NOFADE }));
  for (let k = 3; k < 38; k += 2) { const [x, y] = mesa[k]; out.push(P([[x, y + 3 * s], [x - 3 * s, yH + 20 * s]], { b: .22, w: .7, o: .9 })); }
  for (let j = 0; j < 16; j++) {                       // dunes: long smooth ridges, nearer = brighter and further apart
    const y0 = yH + (26 + j * j * 3.4) * s, amp = (4 + j * 1.8) * s, pts = [];
    for (let x = -20; x <= W + 20; x += 7 * s) pts.push([x, y0 + amp * Math.sin(x / ((120 + 30 * j) * s) + j * 1.7) + amp * .6 * (fbm(x / (200 * s), j * 3, seed + 5, 3) - .5) * 2]);
    out.push(...splitLine(mkLine(pts, { b: .2 + .05 * j, w: .75 + .06 * j, o: .85, spd: .4, phase: j }), (x) => hash3(Math.floor(x / (160 * s)), j, seed) > .2));
  }
  // the rover's wheel tracks, receding to the horizon (two pairs of lines toward a vanishing point)
  const vx = .58 * W, vy = yH + 6 * s;
  for (const off of [-310, -250, 250, 310]) { const pts = []; for (let k = 0; k <= 30; k++) { const u = Math.pow(k / 30, 1.6); pts.push([lerp(vx + off * .02 * s, vx + off * 2.6 * s, u), lerp(vy, H + 40 * s, u)]); } out.push(mkLine(pts, { b: .5, w: .9, o: .75, spd: .7 })); }
  for (let i = 0; i < 34; i++) {                       // rocks: closed lumpy loops, bigger toward us
    const y = yH + (40 + 330 * Math.pow(hash3(i, seed, 12), 1.3)) * s, x = hash3(i, seed, 11) * W, near = (y - yH) / (370 * s), r = (3 + 26 * hash3(i, seed, 13) * near) * s;
    if (Math.abs(x - vx) < 260 * s * near + 20 * s && near > .2) continue;
    const pts = []; for (let k = 0; k <= 18; k++) { const a = k / 18 * TAU, rr = r * (1 + .25 * Math.sin(a * 3 + i) + .12 * Math.sin(a * 5 + i * 2)); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * .55]); }
    out.push(mkLine(pts, { b: .5 + .3 * near, w: .9 + .5 * near, o: .9, flags: FL.NOFADE }));
  }
  for (let j = 0; j < 9; j++) {                        // the dusty sky: a few long faint streaks
    const y = (.08 + .065 * j) * H, pts = []; for (let x = 0; x <= W; x += 12 * s) pts.push([x, y + 8 * s * Math.sin(x / (300 * s) + j)]);
    out.push(...splitLine(mkLine(pts, { b: .07, w: .7, o: .7, spd: .25 }), (x) => vnoise(x / (240 * s), j, seed) > .45));
  }
  return { lines: out.filter(Boolean), yH };
}
// the Sun's disk as light: a bright limb, limb-darkened concentric rings, faint granulation arcs (clipped by Phobos)
export function sunDiskLines(cx, cy, R, s) {
  const out = [];
  out.push(proc.circle(cx, cy, R, { b: 2.4, w: 2.0, o: .15 }, 220));
  out.push(proc.circle(cx, cy, R * .985, { b: 1.0, w: 1.0, o: .1 }, 220));
  // an engraver's sun: dense horizontal hatching, limb-darkened (brighter at the centre)
  const step = 4.2 * s;
  for (let y = -R + step * .5; y < R; y += step) {
    const hw = Math.sqrt(R * R - y * y); if (hw < 3) continue;
    const pts = []; for (let k = 0; k <= 24; k++) { const x = lerp(-hw, hw, k / 24), mu = Math.sqrt(Math.max(0, 1 - (x * x + y * y) / (R * R))); pts.push([cx + x, cy + y, .45 + .75 * Math.pow(mu, .6)]); }
    out.push(mkLine(pts, { w: 1.0, o: .08, spd: .3 }));
  }
  // the dusty aureole: faint rings and short rays
  for (const [k, b] of [[1.32, .28], [1.75, .14], [2.4, .07]]) out.push(proc.circle(cx, cy, R * k, { b, w: 1.0, o: .5 }, 200));
  for (let i = 0; i < 48; i++) { const a = i / 48 * TAU + .03, r0 = R * 1.08, r1 = R * (1.35 + .5 * hash3(i, 7, 7)); out.push(P([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]], { b: .12, w: .7, o: .4 })); }
  return out.filter(Boolean);
}
// Phobos (27 x 22 x 18 km), a lumpy potato with the Stickney dent, seen in silhouette; t: 0..1 across the crossing
export function phobosOutline(cx, cy, R, rot = .35) {
  const ax = .62 * R, ay = .45 * R, pts = [];
  for (let k = 0; k < 72; k++) {
    const a = k / 72 * TAU;
    let r = 1 + .07 * Math.sin(3 * a + .4) + .05 * Math.sin(5 * a + 1.3) + .03 * Math.sin(9 * a + 2);
    r -= .13 * Math.exp(-(((a - 2.3 + TAU) % TAU - Math.PI) ** 2) / .08);       // Stickney
    const x = Math.cos(a) * ax * r, y = Math.sin(a) * ay * r;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return pts;
}
