// props.js: the room's designed elements, drawn as flat INK shapes in setup space (plate px -> output px via `view`).
//   window   SF fog in flat bands, the hills, Sutro Tower's three-pronged silhouette and its blinking red beacons
//   screens  bezels; the line-drawn Earth (the hand-off from S77: the same light-blue circle as the one on her back,
//            pearl line continents, the night side, the umbra dot over Anatolia); the ΔT map whose totality band slides
//            north onto the Halys on `dt.shift(+300)`
//   closeBG  the close-up's background (P41): wall, the ultrawide monitor behind her, the desk lamp, desk, pen cup
// Geometry is in the setup plate's 960x540 frame; every helper takes `view` = { ox, oy, s }.

import { ROOM, MAT } from './palette.js';
import { setFont } from '../../fonts.js';

const TAU = Math.PI * 2;
export const P = (view, x, y) => [view.ox + x * view.s, view.oy + y * view.s];
export function poly(g, view, pts) { g.beginPath(); pts.forEach(([x, y], k) => { const [X, Y] = P(view, x, y); k ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); }
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const ease = k => 1 - Math.pow(1 - clamp(k), 3);

// ---------------------------------------------------------------- the window (wide setup, P39 space)
export const WIN39 = {
  panes: [[[0, -5], [30, -5], [30, 283], [0, 286]], [[51, -5], [186, -5], [185, 256], [51, 278]]],
  ridge: [[40, 160], [62, 152], [80, 143], [95, 147], [108, 145], [118, 140], [132, 141], [150, 149], [170, 151], [190, 155]],
  tower: { x: 127, base: 147, top: 47, crossY: 72, w: 25 },
};
export function drawWindow(g, view, t, W = WIN39) {
  g.save();
  g.beginPath(); for (const p of W.panes) { p.forEach(([x, y], k) => { const [X, Y] = P(view, x, y); k ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); }
  g.clip();
  const s = view.s, tt = Math.floor(t * 12) / 12;          // the fog drifts on twos
  // night sky over SF fog: a dull grey glow (city light on the fog), no blue
  g.fillStyle = '#4b4c53'; g.fillRect(...P(view, -10, -10), 220 * s, 320 * s);
  g.fillStyle = '#56575d'; poly(g, view, [[-10, 95], [200, 88], [200, 300], [-10, 300]]); g.fill();
  // the hills and Sutro Tower (silhouettes)
  g.fillStyle = ROOM.hill;
  poly(g, view, [[-10, 170], ...W.ridge, [200, 160], [200, 300], [-10, 300]]); g.fill();
  const T = W.tower, lw = Math.max(1.1, 1.1 * s);
  g.strokeStyle = ROOM.tower; g.lineCap = 'round'; g.lineJoin = 'round';
  const seg = (a, b, w = lw) => { g.lineWidth = w; g.beginPath(); g.moveTo(...P(view, a[0], a[1])); g.lineTo(...P(view, b[0], b[1])); g.stroke(); };
  const xl = T.x - T.w * .5, xr = T.x + T.w * .5;
  seg([T.x - 9, T.base], [T.x - 4.5, T.crossY + 4]); seg([T.x + 9, T.base], [T.x + 4.5, T.crossY + 4]); seg([T.x, T.base - 2], [T.x, T.crossY + 4], lw * .8);
  for (const yy of [T.base - 26, T.base - 50]) { const k = (T.base - yy) / (T.base - T.crossY), hw = 9 - 4.5 * k; seg([T.x - hw, yy], [T.x + hw, yy], lw * .7); seg([T.x - hw, yy], [T.x + hw * .6, yy - 12], lw * .5); }
  seg([xl + 3, T.crossY], [xr - 3, T.crossY], lw * 1.3);
  seg([xl + 5, T.crossY + 5], [xr - 5, T.crossY + 5], lw);
  const prongs = [[T.x - 8.5, T.top + 4], [T.x, T.top], [T.x + 8.5, T.top + 4]];
  for (const [px, py] of prongs) seg([px, T.crossY], [px, py], lw * .95);
  // fog banks: scalloped flat shapes (anime cloud silhouettes), three tones, slowly drifting
  const bank = (y0, r, col, ph, sp) => {
    g.fillStyle = col; g.beginPath();
    const x0 = -30 + ((tt * sp + ph) % (2 * r)), [sx, sy] = P(view, x0, y0 + r);
    g.moveTo(sx, sy);
    for (let x = x0, k = 0; x < 230; x += 2 * r, k++) {
      const rr = r * (.75 + .5 * ((k * 7 + Math.round(ph)) % 5) / 5);
      g.arc(...P(view, x + r, y0 + r), rr * s, Math.PI, 0);
    }
    g.lineTo(...P(view, 230, 320)); g.lineTo(...P(view, -30, 320)); g.closePath(); g.fill();
  };
  bank(150, 9, ROOM.fog[1], 0, 1.2);
  // city below the fog: dark blocks with a few warm windows
  g.fillStyle = '#2e3036';
  poly(g, view, [[-5, 200], [24, 200], [24, 300], [-5, 300]]); g.fill();
  poly(g, view, [[82, 232], [106, 232], [106, 300], [82, 300]]); g.fill();
  poly(g, view, [[140, 244], [168, 244], [168, 300], [140, 300]]); g.fill();
  g.fillStyle = '#e8b072';
  for (const [x, y] of [[6, 216], [14, 232], [90, 242], [148, 252], [156, 262]]) g.fillRect(...P(view, x, y), 3 * s, 4 * s);
  bank(176, 11, ROOM.fog[2], 6, .8);
  bank(222, 13, ROOM.fog[3], 3, .5);
  // beacons: steady red on the prong tips, the crossbar one blinking (FAA-style), phase-locked to song time
  const blink = (Math.floor(t / .75) % 2) === 0;
  const dot = (x, y, r, on) => { g.fillStyle = on ? ROOM.beacon : '#4a2422'; g.beginPath(); g.arc(...P(view, x, y), r * s, 0, TAU); g.fill(); };
  for (const [px, py] of prongs) dot(px, py - .5, 1.25, true);
  if (blink) { g.fillStyle = '#7a2a24'; g.beginPath(); g.arc(...P(view, T.x, T.crossY - 1), 3.4 * s, 0, TAU); g.fill(); }
  dot(T.x, T.crossY - 1, 1.35, blink);
  g.restore();
}

// the desk lamp (wide setup, P39 space): hard-edged warm pools on the wall and desk, the arm, the orange shade, the bulb
export function drawLamp39(g, view) {
  const s = view.s;
  // light pools first (flat washes, two steps each)
  // the lamp lights the wall behind it: a warm wash in two hard-edged steps (covers the plate's glow)
  g.fillStyle = '#252029'; poly(g, view, [[196, 64], [306, 60], [306, 298], [196, 306]]); g.fill();
  g.fillStyle = '#3b2c2c'; g.beginPath(); g.ellipse(...P(view, 236, 200), 64 * s, 92 * s, .12, 0, TAU); g.fill();
  g.fillStyle = '#4a3530'; g.beginPath(); g.ellipse(...P(view, 240, 196), 38 * s, 54 * s, .12, 0, TAU); g.fill();
  g.fillStyle = '#7a5040'; poly(g, view, [[120, 318], [300, 300], [320, 342], [110, 372]]); g.fill();
  g.fillStyle = '#9a6448'; poly(g, view, [[160, 318], [275, 307], [290, 333], [150, 352]]); g.fill();
  // arm: base, two struts, the joint
  const seg = (a, b, w, c) => { g.strokeStyle = c; g.lineWidth = w * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(...P(view, a[0], a[1])); g.lineTo(...P(view, b[0], b[1])); g.stroke(); };
  g.fillStyle = '#c8641d'; g.beginPath(); g.ellipse(...P(view, 208, 312), 24 * s, 6.5 * s, -.08, 0, TAU); g.fill();
  g.fillStyle = '#f08a2a'; g.beginPath(); g.ellipse(...P(view, 208, 309), 22 * s, 5 * s, -.08, 0, TAU); g.fill();
  seg([205, 306], [174, 208], 4.2, '#7c3d16'); seg([205, 306], [174, 208], 2, '#c8641d');
  seg([174, 208], [212, 132], 4.2, '#7c3d16'); seg([174, 208], [212, 132], 2, '#c8641d');
  g.fillStyle = '#5a2c12'; g.beginPath(); g.arc(...P(view, 174, 208), 4.5 * s, 0, TAU); g.fill();
  // shade: orange cone, lit side and shadow side, the bulb in its mouth
  g.fillStyle = '#c8641d'; poly(g, view, [[204, 128], [236, 116], [267, 170], [206, 193]]); g.fill();
  g.fillStyle = '#f08a2a'; poly(g, view, [[214, 125], [236, 116], [262, 166], [228, 178]]); g.fill();
  g.fillStyle = '#ffd9a6'; g.beginPath(); g.ellipse(...P(view, 236, 181), 31 * s, 8.5 * s, -.36, 0, TAU); g.fill();
  g.fillStyle = '#fff4e2'; g.beginPath(); g.ellipse(...P(view, 238, 180), 15 * s, 4.5 * s, -.36, 0, TAU); g.fill();
}

// ---------------------------------------------------------------- screens
export const SCR39 = {
  main: [[309, 86], [660, 77.5], [661, 279], [309, 261]],
  side: [[675, 59], [814, 54], [814, 325], [676, 325]],
};
// bilinear point inside a quad [TL, TR, BR, BL] at (u, v)
export const qpt = (q, u, v) => [
  (1 - v) * ((1 - u) * q[0][0] + u * q[1][0]) + v * ((1 - u) * q[3][0] + u * q[2][0]),
  (1 - v) * ((1 - u) * q[0][1] + u * q[1][1]) + v * ((1 - u) * q[3][1] + u * q[2][1])];
export const subQuad = (q, u0, v0, u1, v1) => [qpt(q, u0, v0), qpt(q, u1, v0), qpt(q, u1, v1), qpt(q, u0, v1)];
export const toOut = (view, q) => q.map(([x, y]) => P(view, x, y));

export function screenBase(g, view, q, col = ROOM.screenOff) { g.fillStyle = col; poly(g, view, q); g.fill(); }

// an affine frame for drawing flat content inside a (near-rectangular) quad: maps local [0,1]^2 to the quad's TL/TR/BL
function quadFrame(g, view, q) {
  const [a, b, , d] = toOut(view, q);
  g.transform(b[0] - a[0], b[1] - a[1], d[0] - a[0], d[1] - a[1], a[0], a[1]);
}

// the ultrawide's left quarter (mostly behind her head): a sim sidebar, flat
export function drawSidebar(g, view, q) {
  screenBase(g, view, q, '#080b12');
  const Q = toOut(view, q), w = Math.hypot(Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]), h = Math.hypot(Q[3][0] - Q[0][0], Q[3][1] - Q[0][1]);
  g.fillStyle = 'rgba(243,239,230,.14)';
  for (let k = 0; k < 14; k++) { const a = qpt(Q, .1, .08 + k * .062); g.fillRect(a[0], a[1], w * (.3 + .5 * ((k * 37) % 7) / 7), Math.max(1, h * .012)); }
  g.fillStyle = 'rgba(240,138,42,.6)'; const b = qpt(Q, .1, .08 + 4 * .062); g.fillRect(b[0], b[1], w * .55, Math.max(1, h * .012));
}

// ---------------------------------------------------------------- the line-drawn Earth
const COAST = {
  africa: [[-17, 21], [-16, 12], [-12, 7], [-5, 5], [5, 5], [9, 4], [10, -1], [13, -12], [12, -18], [15, -27], [18, -34], [20, -35], [25, -34], [32, -29], [35, -24], [35, -17], [40, -15], [40, -10], [39, -5], [42, 0], [51, 11], [43, 12], [39, 16], [35, 23], [33, 28], [32, 31], [25, 32], [20, 31], [15, 32], [10, 34], [10, 37], [3, 37], [-6, 36], [-10, 31], [-14, 26], [-17, 21]],
  europe: [[-9, 37], [-9, 43], [-2, 43], [-1, 46], [-5, 48], [0, 49], [2, 51], [5, 53], [8, 54], [9, 57], [11, 55], [13, 54], [20, 55], [23, 60], [29, 60], [24, 65], [25, 70], [30, 70], [40, 68], [45, 66], [55, 68], [60, 62], [60, 50], [50, 47], [47, 45], [42, 47], [39, 47], [37, 46], [35, 45], [33, 46], [31, 46.5], [30, 45], [28.5, 43.5], [28, 42], [26, 41], [26, 40.5], [24, 40.5], [23, 39.5], [23, 37], [21.5, 37], [20, 39.5], [19, 41.8], [16, 43.5], [13.5, 45.5], [12.3, 45], [12.5, 44], [14, 42], [15.6, 40], [16, 38], [15.6, 38.2], [16.5, 39.6], [15, 41.8], [12, 42.5], [10.5, 43.8], [9, 44.4], [7, 43.6], [4, 43.4], [3, 42.5], [1, 41], [0, 39], [-.5, 38], [-2, 36.7], [-5, 36], [-6, 36.5], [-9, 37]],
  anatolia: [[26, 40.5], [27, 37], [29, 36.6], [31, 36.8], [33, 36.2], [36, 36.6], [36.2, 37], [40, 37], [44, 37.2], [48, 38.5], [49.5, 40.5], [49, 42], [46, 42], [42, 41.5], [41.5, 41.5], [39, 41], [36, 41.6], [35, 42], [33, 41.8], [30, 41.2], [29, 41], [26, 40.5]],
  arabia: [[32, 31], [35, 29.5], [39, 22], [43, 13], [45, 12.8], [52, 15.5], [57, 18.5], [59, 22.5], [56, 26], [52, 24], [51, 26], [48, 29.5], [48, 30], [44, 31], [40, 33], [38, 36], [36.2, 37], [36, 36.6], [35, 33], [34, 31.5], [32, 31]],
  caspian: [[47, 45], [50, 46.5], [53, 46.5], [53, 42], [54, 40], [53.5, 37.5], [51, 36.7], [49, 37.5], [49.5, 40.5], [48, 42.5], [47, 45]],
};
function ortho(lon, lat, lon0, lat0) {
  const r = Math.PI / 180, cl = Math.cos(lat * r), x = cl * Math.sin((lon - lon0) * r);
  const y = Math.cos(lat0 * r) * Math.sin(lat * r) - Math.sin(lat0 * r) * cl * Math.cos((lon - lon0) * r);
  const z = Math.sin(lat0 * r) * Math.sin(lat * r) + Math.cos(lat0 * r) * cl * Math.cos((lon - lon0) * r);
  return [x, -y, z];
}
// The Earth on her monitor: centre (cx, cy) radius R in OUTPUT px. The sub-solar point at ~16:00 UT on 28 May
// (60 W, 21.5 N) puts the terminator right over Anatolia, where the umbra dot sits.
const _earth = new Map();
function earthDisk(R, lon0, lat0) {
  const k = `${Math.round(R)}|${lon0}|${lat0}`; if (_earth.has(k)) return _earth.get(k);
  const n = Math.ceil(R * 2) + 2, c = document.createElement('canvas'); c.width = c.height = n;
  const cg = c.getContext('2d'), img = cg.createImageData(n, n), d = img.data;
  const sun = ortho(-60, 21.5, lon0, lat0), day = [0x86, 0xb5, 0xe6], night = [0x5b, 0x8f, 0xcc];
  const r = Math.PI / 180, cl0 = Math.cos(lat0 * r), sl0 = Math.sin(lat0 * r);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + .5 - n / 2) / R, v = (y + .5 - n / 2) / R, rr = u * u + v * v, i = (y * n + x) * 4;
    if (rr > 1) continue;
    const z = Math.sqrt(1 - rr);
    // screen (u, -v, z) -> the dot with the sun's screen vector decides day / night (both in the same view frame)
    const dot = u * sun[0] + v * sun[1] + z * sun[2];
    const col = dot >= 0 ? day : night, a = Math.min(1, (1 - Math.sqrt(rr)) * R * 1.2);
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255 * a;
  }
  cg.putImageData(img, 0, 0);
  _earth.set(k, c); return c;
}
export function drawEarth(g, cx, cy, R, o = {}) {
  const lon0 = o.lon0 ?? 22, lat0 = o.lat0 ?? 24, lw = Math.max(1, R * .02);
  const disk = earthDisk(R, lon0, lat0);
  g.drawImage(disk, cx - disk.width / 2, cy - disk.height / 2);
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
  g.strokeStyle = 'rgba(243,239,230,.3)'; g.lineWidth = lw * .55;
  for (let lat = -60; lat <= 60; lat += 30) { g.beginPath(); let pen = false; for (let lon = -180; lon <= 180; lon += 4) { const p = ortho(lon, lat, lon0, lat0); if (p[2] < 0) { pen = false; continue; } const X = cx + p[0] * R, Y = cy + p[1] * R; pen ? g.lineTo(X, Y) : g.moveTo(X, Y); pen = true; } g.stroke(); }
  for (let lon = -180; lon < 180; lon += 30) { g.beginPath(); let pen = false; for (let lat = -88; lat <= 88; lat += 4) { const p = ortho(lon, lat, lon0, lat0); if (p[2] < 0) { pen = false; continue; } const X = cx + p[0] * R, Y = cy + p[1] * R; pen ? g.lineTo(X, Y) : g.moveTo(X, Y); pen = true; } g.stroke(); }
  g.strokeStyle = ROOM.pearl; g.lineWidth = lw; g.lineJoin = 'round';
  for (const c of Object.values(COAST)) { g.beginPath(); let pen = false; for (const [lon, lat] of c) { const p = ortho(lon, lat, lon0, lat0); if (p[2] < 0) { pen = false; continue; } const X = cx + p[0] * R, Y = cy + p[1] * R; pen ? g.lineTo(X, Y) : g.moveTo(X, Y); pen = true; } g.stroke(); }
  // the umbra over Anatolia: a black dot inside a flat penumbra ring
  const u = ortho(33.9, 38.4, lon0, lat0);
  if (u[2] > 0) {
    g.fillStyle = 'rgba(5,7,12,.32)'; g.beginPath(); g.ellipse(cx + u[0] * R, cy + u[1] * R, R * .17, R * .17 * Math.max(.3, u[2]), 0, 0, TAU); g.fill();
    g.fillStyle = '#05070c'; g.beginPath(); g.ellipse(cx + u[0] * R, cy + u[1] * R, R * .05, R * .05 * Math.max(.3, u[2]), 0, 0, TAU); g.fill();
  }
  g.restore();
  g.strokeStyle = ROOM.pearl; g.lineWidth = lw * 1.3; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
}

// the sim viewport: navy-black field, the Earth, one tiny caption line under it
export function drawEarthPanel(g, view, q, t, o = {}) {
  screenBase(g, view, q, '#05070c');
  const Q = toOut(view, q), w = Math.hypot(Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]), h = Math.hypot(Q[3][0] - Q[0][0], Q[3][1] - Q[0][1]);
  const R = Math.min(w * .4, h * .38), c = qpt(Q, .5, .44);
  drawEarth(g, c[0], c[1], R, o);
  const px = Math.max(8, Math.min(13, w * .042));
  setFont(g, 'mono', px); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const bl = qpt(Q, .05, .955);
  g.fillStyle = 'rgba(243,239,230,.7)'; g.fillText('sim · earth · -0584-05-28', bl[0], bl[1]);
  g.fillStyle = ROOM.orange; const br = qpt(Q, .95, .955); g.textAlign = 'right'; g.fillText('● umbra', br[0], br[1]); g.textAlign = 'left';
}

// ---------------------------------------------------------------- the ΔT map
const HALYS = [[37.75, 39.88], [37.0, 39.85], [36.3, 39.4], [35.7, 39.0], [35.2, 38.75], [34.85, 38.72], [34.4, 38.8], [33.9, 39.0], [33.6, 39.3], [33.5, 39.7], [33.5, 40.1], [33.7, 40.5], [34.0, 40.8], [34.3, 40.95], [34.6, 41.1], [35.0, 41.15], [35.4, 41.1], [35.8, 41.4], [36.0, 41.7]];
const BEND = [34.85, 38.72];
// totality band limits over Anatolia (JPL DE422 run, production/refs/eclipse): straight-line fits, lat = lat30 + k (lon - 30)
const BAND = { n30: 40.12, s30: 37.39, k: -.359, lonPerDT: 1 / 240 };   // 240 s of ΔT = 1 degree of longitude
const LAND = [[28.2, 41.25], [29.5, 41.2], [31.0, 41.1], [32.5, 41.8], [33.5, 42.0], [35.0, 42.05], [35.2, 41.7], [36.0, 41.7], [37.0, 41.1], [38.5, 40.95],
  [40.0, 40.95], [41.0, 41.0], [41.0, 35.4], [36.1, 35.4], [36.0, 35.9], [36.2, 36.6], [36.1, 36.9], [35.6, 36.6], [34.6, 36.8], [33.5, 36.2], [32.6, 36.1],
  [31.5, 36.7], [30.6, 36.85], [29.6, 36.2], [28.2, 36.8]];
const MARMARA = [[28.2, 40.55], [29.2, 40.4], [29.9, 40.7], [29.2, 41.0], [28.2, 41.0]];
export function drawDTMap(g, view, q, t, o = {}) {
  const t0 = o.shiftAt ?? 268.081, dur = o.shiftDur ?? .42;
  const tq = t0 + Math.floor(Math.max(0, t - t0) * 12) / 12;      // on twos: the band moves in 12 fps steps
  const k = t < t0 ? 0 : ease((tq - t0) / dur);
  const dT = 300 * k;
  screenBase(g, view, q, '#080b12');
  const Q = toOut(view, q), w = Math.hypot(Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]), h = Math.hypot(Q[3][0] - Q[0][0], Q[3][1] - Q[0][1]);
  g.save();
  poly(g, view, q); g.clip();
  g.translate(Q[0][0], Q[0][1]); g.rotate(Math.atan2(Q[1][1] - Q[0][1], Q[1][0] - Q[0][0]));
  const px = Math.max(8, Math.min(13, w * .042));
  const top = px * 2.1, mh = h - top - px * .6, mw = w * .94, mx = w * .03;
  const lon0 = 29.4, lon1 = 39.6, lat0 = 36.2, lat1 = 42.3;
  const X = lon => mx + (lon - lon0) / (lon1 - lon0) * mw, Y = lat => top + (lat1 - lat) / (lat1 - lat0) * mh;
  g.save(); g.beginPath(); g.rect(mx, top, mw, mh); g.clip();
  g.fillStyle = '#0c1018'; g.fillRect(mx, top, mw, mh);                       // sea
  const fillPoly = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach(([lo, la], i) => i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la))); g.closePath(); g.fill(); };
  fillPoly(LAND, '#252831'); fillPoly(MARMARA, '#0c1018');
  // totality band (shifted east by ΔT/240 deg): flat pearl wash with crisp limit lines
  const sh = dT * BAND.lonPerDT, lim = (lat30, lo) => lat30 + BAND.k * (lo - 30 - sh);
  g.fillStyle = 'rgba(243,239,230,.22)';
  g.beginPath(); g.moveTo(X(lon0 - 2), Y(lim(BAND.n30, lon0 - 2))); g.lineTo(X(lon1 + 2), Y(lim(BAND.n30, lon1 + 2)));
  g.lineTo(X(lon1 + 2), Y(lim(BAND.s30, lon1 + 2))); g.lineTo(X(lon0 - 2), Y(lim(BAND.s30, lon0 - 2))); g.closePath(); g.fill();
  g.strokeStyle = ROOM.pearl; g.lineWidth = Math.max(1, w * .006);
  for (const l30 of [BAND.n30, BAND.s30]) { g.beginPath(); g.moveTo(X(lon0 - 2), Y(lim(l30, lon0 - 2))); g.lineTo(X(lon1 + 2), Y(lim(l30, lon1 + 2))); g.stroke(); }
  g.strokeStyle = 'rgba(243,239,230,.5)'; g.lineWidth = Math.max(.8, w * .004);
  g.beginPath(); LAND.forEach(([lo, la], i) => i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la))); g.closePath(); g.stroke();
  g.strokeStyle = ROOM.orange; g.lineWidth = Math.max(1.4, w * .01); g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath(); HALYS.forEach(([lo, la], i) => i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la))); g.stroke();
  const inside = BEND[1] < lim(BAND.n30, BEND[0]) && BEND[1] > lim(BAND.s30, BEND[0]);
  const bx = X(BEND[0]), by = Y(BEND[1]), r = Math.max(2.5, w * .026);
  g.fillStyle = inside ? ROOM.pearl : ROOM.orange; g.strokeStyle = '#05070c'; g.lineWidth = Math.max(1, w * .006);
  g.beginPath(); g.moveTo(bx, by - r); g.lineTo(bx + r, by); g.lineTo(bx, by + r); g.lineTo(bx - r, by); g.closePath(); g.fill(); g.stroke();
  g.restore();
  // caption row (mono): ΔT readout, and whether the battle sees totality
  setFont(g, 'mono', px); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const yb = px * 1.45;
  g.fillStyle = 'rgba(243,239,230,.8)'; g.fillText('ΔT', mx, yb);
  g.fillStyle = k > 0 ? ROOM.orange : 'rgba(243,239,230,.8)'; g.fillText(`+${String(Math.round(dT)).padStart(3, ' ')} s`, mx + px * 1.8, yb);
  g.textAlign = 'right'; g.fillStyle = inside ? ROOM.pearl : 'rgba(243,239,230,.55)';
  g.fillText(inside ? 'halys: total' : 'halys: 98%', mx + mw, yb);
  g.restore();
}

// ---------------------------------------------------------------- the close-up background (P41 space)
export const CLOSE41 = {
  monitor: [[52, 178], [786, 176], [788, 352], [50, 354]],
  screen: [[60, 185], [778, 183], [780, 345], [58, 347]],
  lamp: { x: 888, y: 128 },
};
export function drawCloseBG(g, view, t) {
  const s = view.s;
  // wall: flat night navy-black with a vertical panel seam and a darker lower band (the desk's shadow)
  g.fillStyle = ROOM.wall; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  g.fillStyle = ROOM.wallLo; poly(g, view, [[-10, 330], [970, 320], [970, 560], [-10, 560]]); g.fill();
  // the lamp's warm pool on the wall (hard-edged wash, two steps)
  g.fillStyle = '#1c1b24'; g.beginPath(); g.ellipse(...P(view, 880, 168), 150 * s, 112 * s, -.2, 0, TAU); g.fill();
  g.fillStyle = '#271f25'; g.beginPath(); g.ellipse(...P(view, 884, 176), 96 * s, 66 * s, -.2, 0, TAU); g.fill();
  // window sliver at the far left: fog
  g.fillStyle = '#2a2e38'; poly(g, view, [[-10, -10], [38, -10], [38, 330], [-10, 330]]); g.fill();
  g.fillStyle = ROOM.fog[0]; poly(g, view, [[-10, -10], [30, -10], [30, 320], [-10, 320]]); g.fill();
  g.fillStyle = ROOM.fog[2]; poly(g, view, [[-10, 150], [30, 140], [30, 320], [-10, 320]]); g.fill();
  // the ultrawide behind her: bezel + stand
  g.fillStyle = ROOM.bezel; poly(g, view, CLOSE41.monitor); g.fill();
  poly(g, view, [[400, 352], [440, 352], [446, 420], [394, 420]]); g.fill();
  screenBase(g, view, CLOSE41.screen, ROOM.screenOff);
  // desk (right, warm-lit) and a pen cup
  g.fillStyle = ROOM.deskLo; poly(g, view, [[640, 405], [970, 395], [970, 560], [640, 560]]); g.fill();
  g.fillStyle = ROOM.deskWarm; poly(g, view, [[700, 392], [970, 380], [970, 402], [700, 410]]); g.fill();
  g.fillStyle = '#bdb7ae'; poly(g, view, [[842, 318], [896, 318], [892, 392], [846, 392]]); g.fill();
  g.fillStyle = '#8f8a84'; poly(g, view, [[842, 318], [896, 318], [896, 326], [842, 326]]); g.fill();
  g.strokeStyle = '#1c1a22'; g.lineWidth = 1.6 * s; g.lineCap = 'round';
  for (const [x0, y0, x1, y1, c] of [[852, 318, 846, 286, ROOM.orange], [866, 318, 868, 280, '#e9e2d6'], [880, 318, 890, 292, '#2a2d35']]) {
    g.strokeStyle = c; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(...P(view, x0, y0)); g.lineTo(...P(view, x1, y1)); g.stroke();
  }
  // the desk lamp: dark shade with an orange rim, the hot bulb, the arm
  const L = CLOSE41.lamp;
  g.strokeStyle = '#2a2124'; g.lineWidth = 5 * s; g.beginPath(); g.moveTo(...P(view, L.x + 30, L.y - 40)); g.lineTo(...P(view, L.x + 70, -20)); g.stroke();
  g.fillStyle = '#231c20'; poly(g, view, [[L.x - 30, L.y - 50], [L.x + 34, L.y - 62], [L.x + 58, L.y + 18], [L.x - 52, L.y + 40]]); g.fill();
  g.fillStyle = ROOM.orange; poly(g, view, [[L.x - 52, L.y + 40], [L.x + 58, L.y + 18], [L.x + 60, L.y + 26], [L.x - 50, L.y + 48]]); g.fill();
  g.fillStyle = ROOM.lampHot; g.beginPath(); g.ellipse(...P(view, L.x + 3, L.y + 38), 46 * s, 12 * s, -.2, 0, TAU); g.fill();
}
