// anatolia.js: S50's strategy board. A marble relief map of Asia Minor on a table, seen from the south-east at a raking
// angle: the coasts raised out of polished dark seas, the Pontic and Taurus ranges, Erciyes and Hasan Dag as cones,
// Tuz Golu as a pale salt pan, the Halys (Kizilirmak) carved as a groove through its great arc, and two tiny armies of
// pawns on either bank at the bend between Avanos and Hirfanli (Lydians west, Medes east, equal in number). The moon's
// umbra sweeps in from the WNW, out of the sunset edge of the board, and crosses toward the ESE (RESEARCH 1.4: 113 deg):
// a long dark oval (at a sun altitude of 8.6 deg the shadow on the ground is drawn out along its track) with a soft
// penumbra, crossing the armies. The board is lit like the statues: a cool key from above, the orange horizon glow from
// the west raking across the relief.
//
//   const src = mapSource(f, { cam, shadow: {u, v, ...}, ... })   -> a brush Source for stone.js's 'all' mode

import { clamp, lerp, sstep, vnoise, fbm, hash3 } from '../brush/util.js';
import { analysisSize } from '../brush/index.js';

// coastline of Asia Minor (lon, lat), clockwise from the Bosphorus; the east is cut by the board's edge
const COAST = [[29.05, 41.15], [29.9, 41.15], [30.6, 41.1], [31.3, 41.25], [31.8, 41.45], [32.3, 41.72], [33.0, 41.95], [33.8, 41.98], [34.6, 41.95], [35.0, 42.08],
  [35.2, 42.0], [35.5, 41.7], [35.9, 41.72], [36.3, 41.3], [36.6, 41.35], [36.95, 41.4], [37.4, 41.1], [38.0, 40.97], [38.6, 40.95], [39.3, 41.05], [39.8, 41.0],
  [40.6, 41.05], [41.5, 41.5], [44, 41.5], [44, 36.6], [36.6, 36.75], [36.2, 36.9], [35.8, 36.75], [35.5, 36.6], [34.9, 36.75], [34.6, 36.8], [34.1, 36.5], [33.9, 36.3],
  [33.3, 36.15], [32.8, 36.03], [32.3, 36.3], [32.0, 36.55], [31.4, 36.75], [30.7, 36.88], [30.55, 36.5], [30.45, 36.2], [30.0, 36.25], [29.6, 36.2], [29.3, 36.3],
  [29.1, 36.6], [28.6, 36.75], [28.2, 36.8], [27.75, 36.7], [27.4, 37.0], [27.25, 37.35], [27.3, 37.55], [27.25, 37.9], [26.9, 38.1], [26.3, 38.3], [26.75, 38.45],
  [27.05, 38.45], [26.75, 38.75], [26.85, 39.0], [26.65, 39.3], [26.9, 39.55], [26.15, 39.5], [26.2, 39.95], [26.4, 40.15], [26.7, 40.35], [27.3, 40.4], [27.9, 40.35],
  [28.4, 40.4], [28.95, 40.38], [29.15, 40.65], [29.9, 40.75], [29.4, 40.85], [29.05, 41.0]];
// Thrace across the straits (a sliver of Europe in the north-west corner)
const THRACE = [[26.0, 40.6], [26.7, 40.4], [27.5, 40.95], [28.6, 41.0], [29.05, 41.2], [28.0, 42.0], [26.0, 42.5], [24.8, 42.5], [24.8, 40.7]];
// the Halys from its source to the Black Sea
export const HALYS = [[38.4, 39.85], [37.8, 39.78], [37.0, 39.75], [36.3, 39.4], [35.8, 39.1], [35.35, 38.82], [34.85, 38.72], [34.3, 38.95], [33.9, 39.2], [33.55, 39.6],
  [33.5, 39.85], [33.4, 40.1], [33.75, 40.55], [34.2, 40.8], [34.8, 40.98], [35.2, 41.2], [35.55, 41.45], [35.9, 41.72]];
export const BATTLE = [34.42, 38.88];                       // on the river between Avanos and Hirfanli
const PEAKS = [[35.45, 38.53, 1.0, .22], [34.17, 38.13, .8, .2], [33.85, 37.5, .45, .3]];   // Erciyes, Hasan Dag, Karadag
const LAKES = [[33.4, 38.75, .2, .38], [30.6, 37.85, .25, .18], [31.5, 38.25, .22, .12]];    // Tuz Golu, Burdur/Egirdir-ish, Aksehir
const LON0 = 24.8, LON1 = 44, LAT0 = 35.2, LAT1 = 43.0, KX = Math.cos(39 * Math.PI / 180);
// board coords: u east (0..1 over the lon span, scaled by cos lat), v south (0 north .. 1 south)
export const toBoard = (lon, lat) => [(lon - LON0) / (LON1 - LON0), (LAT1 - lat) / (LAT1 - LAT0)];
const BOARD_AR = (LON1 - LON0) * KX / (LAT1 - LAT0);         // board width / depth

function inPoly(P, x, y) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function segDist(P, x, y) { let d = 1e9; for (let i = 0; i < P.length - 1; i++) { const [ax, ay] = P[i], [bx, by] = P[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, t = clamp(((x - ax) * dx + (y - ay) * dy) / L2); d = Math.min(d, Math.hypot(ax + dx * t - x, ay + dy * t - y)); } return d; }

// the heightfield on a grid (board uv), cached: h (0 sea .. 1 peaks), land mask, river groove, lake mask
let _H = null;
function heightGrid(n = 640) {
  if (_H && _H.n === n) return _H;
  const m = Math.round(n / BOARD_AR), H = new Float32Array(n * m), land = new Float32Array(n * m), river = new Float32Array(n * m), lake = new Float32Array(n * m);
  const coast = COAST.map(([a, b]) => toBoard(a, b)), thr = THRACE.map(([a, b]) => toBoard(a, b)), hal = HALYS.map(([a, b]) => toBoard(a, b));
  const pk = PEAKS.map(([a, b, h, r]) => [...toBoard(a, b), h, r * KX / (LON1 - LON0)]), lk = LAKES.map(([a, b, rx, ry]) => [...toBoard(a, b), rx / (LON1 - LON0), ry / (LAT1 - LAT0)]);
  const cd = new Float32Array(n * m);
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const u = (i + .5) / n, v = (j + .5) / m, k = j * n + i;
    const isL = inPoly(coast, u, v) || inPoly(thr, u, v);
    land[k] = isL ? 1 : 0;
    // distance to the coast (board units) for the raised shoreline and the ranges that hug it
    cd[k] = Math.min(segDist(coast, u, v), segDist(thr, u, v));
    river[k] = segDist(hal, u, v);
  }
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const u = (i + .5) / n, v = (j + .5) / m, k = j * n + i;
    if (!land[k]) { H[k] = -.04 - .05 * sstep(0, .03, cd[k]); continue; }
    const d = cd[k];
    // plateau rising from the coast; Pontic range along the north coast, Taurus along the south
    let h = .12 + .1 * sstep(0, .06, d);
    const north = sstep(.62, .3, v), south = sstep(.55, .85, v);
    h += .3 * Math.exp(-Math.pow((d - .035) / .03, 2)) * (north * .9 + south * 1.0) * (.55 + .9 * fbm(u * 18, v * 18, 7, 3));
    h += .06 * (fbm(u * 9, v * 9, 3, 4) - .5) + .04 * (fbm(u * 40, v * 40, 5, 2) - .5);
    for (const [pu, pv, ph, pr] of pk) { const r = Math.hypot((u - pu) * 1, (v - pv) * BOARD_AR * KX) / pr; h += ph * .35 * Math.exp(-r * r * 3.5); }
    // the river carved in: a groove that widens toward the sea
    const rw = .0035 + .002 * sstep(.6, .2, v);
    river[k] = 1 - sstep(rw * .4, rw, river[k]);
    h -= .05 * river[k];
    for (const [lu, lv, lrx, lry] of lk) { const r = Math.hypot((u - lu) / lrx, (v - lv) / lry); if (r < 1.15) lake[k] = Math.max(lake[k], 1 - sstep(.85, 1.15, r)); }
    h = lerp(h, .1, lake[k] * .8);
    H[k] = h;
  }
  _H = { n, m, H, land, river, lake };
  return _H;
}
const gs = (A, n, m, u, v) => { const x = clamp(u * n - .5, 0, n - 1.001), y = clamp(v * m - .5, 0, m - 1.001), xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, k = yi * n + xi; return (A[k] * (1 - fx) + A[k + 1] * fx) * (1 - fy) + (A[k + n] * (1 - fx) + A[k + n + 1] * fx) * fy; };

// camera over the board: looking north-west across it from the south-east, raised (pitch), with a focal length
// cam: {u, v (board point at the frame centre), dist, pitch (deg), yaw (deg, 0 = looking north), fov (deg)}
export function boardRay(cam, aw, ah) {
  const yaw = cam.yaw * Math.PI / 180, pitch = cam.pitch * Math.PI / 180, f = .5 / Math.tan(cam.fov * Math.PI / 360);
  // board space: x east (u * BOARD_AR), y north (-v), z up; the camera sits back from the target along -forward
  const tx = cam.u * BOARD_AR, ty = -cam.v;
  const fwd = [Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), -Math.sin(pitch)];
  const right = [Math.cos(yaw), -Math.sin(yaw), 0], up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
  const eye = [tx - fwd[0] * cam.dist, ty - fwd[1] * cam.dist, -fwd[2] * cam.dist];
  return (x, y) => {                                  // pixel -> board (u, v) on the z = 0 plane, or null (sky)
    const sx = (x / aw - .5) * (aw / ah), sy = -(y / ah - .5);
    const d = [fwd[0] * f + right[0] * sx + up[0] * sy, fwd[1] * f + right[1] * sx + up[1] * sy, fwd[2] * f + right[2] * sx + up[2] * sy];
    if (d[2] >= -1e-4) return null;
    const t = -eye[2] / d[2];
    return [(eye[0] + d[0] * t) / BOARD_AR, -(eye[1] + d[1] * t), t];
  };
}
// board (u, v) -> screen px (the inverse, for placing pawns and the type)
export function boardToScreen(cam, aw, ah) {
  const yaw = cam.yaw * Math.PI / 180, pitch = cam.pitch * Math.PI / 180, f = .5 / Math.tan(cam.fov * Math.PI / 360);
  const tx = cam.u * BOARD_AR, ty = -cam.v;
  const fwd = [Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), -Math.sin(pitch)];
  const right = [Math.cos(yaw), -Math.sin(yaw), 0], up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
  const eye = [tx - fwd[0] * cam.dist, ty - fwd[1] * cam.dist, -fwd[2] * cam.dist];
  return (u, v, z = 0) => {
    const p = [u * BOARD_AR - eye[0], -v - eye[1], z - eye[2]];
    const zc = p[0] * fwd[0] + p[1] * fwd[1] + p[2] * fwd[2]; if (zc <= 1e-4) return null;
    const sx = (p[0] * right[0] + p[1] * right[1] + p[2] * right[2]) / zc * f, sy = (p[0] * up[0] + p[1] * up[1] + p[2] * up[2]) / zc * f;
    return [(sx / (aw / ah) + .5) * aw, (.5 - sy) * ah, zc];
  };
}

// the umbra on the board: a long oval along the track (ESE), centre (u, v), half-length a, half-width b (board units)
export function umbraAt(u, v, sh) {
  const ang = sh.ang ?? (23 * Math.PI / 180);          // heading 113 deg = 23 deg south of east
  const dx = (u - sh.u) * BOARD_AR, dy = (v - sh.v), ca = Math.cos(ang), sa = Math.sin(ang);
  const along = dx * ca + dy * sa, across = -dx * sa + dy * ca;
  const r = Math.hypot(along / (sh.a * BOARD_AR), across / sh.b);
  return { umbra: 1 - sstep(.82, 1.08, r), pen: 1 - sstep(1, 3.4, r) };
}

// the board as a Source: lit marble reference written directly (sRGB), depth, matte (the board and pawns are stone),
// sky (beyond the table's far edge), mat (board coordinates: strokes stay on the map as the camera moves)
export function mapSource(f, o = {}) {
  const [aw, ah] = analysisSize(f.W, f.H), N = aw * ah, S = f.W / aw;
  const G = heightGrid(o.res ?? 640), { n, m } = G, cam = o.cam, ray = boardRay(cam, aw, ah);
  const R = new Float32Array(N), Gc = new Float32Array(N), B = new Float32Array(N), depth = new Float32Array(N), matte = new Float32Array(N), sky = new Float32Array(N), mx = new Float32Array(N), my = new Float32Array(N);
  const key = (() => { const k = [-.55, .45, .62], l = Math.hypot(...k); return k.map(c => c / l); })();   // from the north-west, raking
  const west = [-.92, .1, .28];                          // the sunset glow rakes in from the west edge of the board
  const sh = o.shadow || null;
  const eps = 1 / n;
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const i = y * aw + x, p = ray(x, y);
    if (!p || p[0] < -.08 || p[0] > 1.08 || p[1] < -.1 || p[1] > 1.12) { sky[i] = 1; mx[i] = x * S; my[i] = y * S; continue; }
    const [u, v, dist] = p;
    // the table edge: a dark moulded rim around the board
    const edge = Math.min(u + .08, 1.08 - u, v + .1, 1.12 - v), onBoard = u > 0 && u < 1 && v > 0 && v < 1;
    const h = onBoard ? gs(G.H, n, m, u, v) : -.02;
    const hx = onBoard ? (gs(G.H, n, m, u + eps, v) - gs(G.H, n, m, u - eps, v)) / (2 * eps) : 0, hy = onBoard ? (gs(G.H, n, m, u, v + eps) - gs(G.H, n, m, u, v - eps)) / (2 * eps) : 0;
    const rel = o.relief ?? 3.2;
    let nx = -hx * rel * .06, ny = hy * rel * .06, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;   // board space: x east, y north
    const land = onBoard ? gs(G.land, n, m, u, v) : 0, riv = onBoard ? gs(G.river, n, m, u, v) : 0, lake = onBoard ? gs(G.lake, n, m, u, v) : 0;
    // marble: land a warm white, the sea a polished darker grey-violet slab, the rim dark
    let alb = lerp(.2, .8, land) * (1 - .6 * riv) * (1 + .06 * (vnoise(u * 160, v * 160, 3) - .5));
    alb = lerp(alb, .7, lake * .6);
    const veins = Math.abs(Math.sin((u * 3.1 + v * 1.7) * 22 + 3 * fbm(u * 6, v * 6, 9, 3))); alb *= 1 - .18 * (1 - sstep(0, .045, veins)) * land;
    const kd = clamp(nx * key[0] + ny * key[1] + nz * key[2]);
    const kw = clamp(nx * west[0] + ny * west[1] + nz * west[2]) * sstep(.85, .1, u) * .9;    // the glow from the western (sunset) edge
    const tint = land > .5 ? [1.0, .97, .92] : [.86, .9, 1.0];
    let r = alb * (.06 + .95 * kd) * .9 * tint[0] + kw * .85 * alb;
    let g = alb * (.06 + .95 * kd) * .9 * tint[1] + kw * .45 * alb;
    let b = alb * (.08 + .95 * kd) * .9 * tint[2] + kw * .16 * alb;
    // specular sheen on the polished sea
    if (!land && onBoard) { const s = Math.pow(clamp(1 - Math.abs(u - .25) * 2) * clamp(1 - Math.abs(v - .45) * 2), 3) * .25; r += s; g += s * .9; b += s * .85; }
    if (!onBoard) { const k = sstep(-.08, 0, Math.min(u, v)) * sstep(1.08, 1, u) * sstep(1.12, 1, v); r = g = b = .04 + .08 * k; r += .06 * sstep(.3, -.08, u); }
    // the umbra and its penumbra
    if (sh) { const q = umbraAt(u, v, sh); const dk = 1 - .88 * q.umbra - .3 * q.pen * (1 - q.umbra); r *= dk; g *= dk * .98; b *= dk * .97; }
    // to sRGB (simple gamma), a soft shoulder
    const tone = c => Math.pow(clamp(c / (1 + Math.max(0, c - .75))), 1 / 2.2);
    R[i] = tone(r); Gc[i] = tone(g); B[i] = tone(b);
    depth[i] = clamp(1 - dist / (cam.dist * 2.2));
    matte[i] = onBoard ? 1 : 0;
    mx[i] = u * 1600; my[i] = v * 1600 / BOARD_AR;
  }
  return { aw, ah, R, G: Gc, B, depth, matte, sky, faces: [], mat: { mx, my }, key: `map|${f.t.toFixed(4)}|${aw}`, info: { kind: 'map' } };
}

// the two tiny armies: pawns (a small cylinder with a round head) in two blocks on either bank at the bend
export function armyPawns(f, cam, aw, ah, o = {}) {
  const P = [], toS = boardToScreen(cam, aw, ah), [bu, bv] = toBoard(...BATTLE), S = f.W / aw;
  for (const side of [-1, 1]) for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    const u = bu + side * (.012 + .0045 * r) + (hash3(r, c, side + 5) - .5) * .001, v = bv - .012 + .0048 * c + (side < 0 ? .002 : -.002);
    const base = toS(u, v, 0), top = toS(u, v, .006); if (!base || !top) continue;
    P.push({ x: base[0] * S, y: base[1] * S, tx: top[0] * S, ty: top[1] * S, side, z: base[2] });
  }
  return P.sort((a, b) => b.z - a.z);
}
