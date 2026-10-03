// drop2.js: ORBIT, S63-S74 (Drop 2: swords into starships, the eclipse cascade, Earthset, the dive) and S77 (the
// pull-back). Owner: ORBIT agent. Built on the line engine (src/worlds/line/) plus src/worlds/orbit/.
//
// Beat sync: cuts are the shot list's downbeats; kicks (timing.json events.kicks, snapped to the master frame grid by
// audio.js) drive line thickness, the radial push, the gear ticks and the starship's exhaust; the wordless topline
// (curves.vocal, smoothed) lets slow motion breathe. The ring is locked at (W/2, H/2) through S64-S71.
// Type: every scene sets f.type (sun/field/kick/light) for the era captions, HOME and the THROW DOWN chops.

import { scene, shotOverride, shotById, SCENES } from '../registry.js';
import { drawLines, staticMesh, dynLayer, coronaRing, ringU, audio, proc, FL, resolve, sourceFields } from '../worlds/line/index.js';
import { clamp, lerp, sstep, smooth, easeIn, easeInOut, easeOut, hash3, TAU } from '../core.js';
import { FPS } from '../time.js';
import { lockedRing, ringR, RING_CFG, RING_BARE, clipLines, splitLine, mkLine, dot, placeU, affineU, vocalBreath, breathPhase, xform } from '../worlds/orbit/index.js';
import * as ERA from '../worlds/orbit/eras.js';

const snap = audio.snap;
const steer = (f, o) => { f.type = Object.assign(f.type || {}, o); };
// kicks counted from t0 with an eased step on each (clockwork ticks): k kicks done + the ease of the newest
export function kickTicks(t, t0, ease = .14) {
  const K = audio.kickTimes(); let n = 0, last = null;
  for (const k of K) { if (k < t0 - 1e-6) continue; if (k > t + 1e-6) break; n++; last = k; }
  if (!last) return 0;
  return n - 1 + easeOut(clamp((t - last) / ease));
}
const LOOK = { glow: [.22, .08] };
const RING_DIM = { corona: { gain: .6 }, tilt: .42 };

// ================================================================ S64-S71: the cascade, ring locked centre
// one frame of an era: the locked ring + era layers (+ an optional plate), kick pulse, pulses that breathe with the topline
async function eraFrame(f, o) {
  const t = f.t, kick = audio.kickEnv(t, .13), ring = lockedRing(f, kick, { cfg: o.ringCfg || RING_CFG, key: o.ringKey, bright: o.ringBright ?? (.92 + .16 * vocalBreath(t)) });
  const layers = [...(o.under || []), ring.layer, ...(o.layers || [])];
  const r = await drawLines(f, {
    ...(o.plate || {}), layers, kick, kickPush: o.kickPush ?? 14, pushCenter: [ring.cx, ring.cy], phase: audio.flowPhase(t) * .85,
    look: { ...LOOK, ...(o.look || {}) }, disk: o.disk === undefined ? ring.disk : o.disk, palette: o.palette,
  });
  steer(f, { ...ring.type, kick });
  return { r, ring, kick };
}

// ---------------------------------------------------------------- S64: Antikythera, the saros dial spiral is the ring
const S64_T0 = 222.077;
scene('S64', async f => {
  const W = f.W, H = f.H, s = H / 1080, cx = W / 2, cy = H / 2, R = ringR(H), t = f.t;
  const turn = kickTicks(t, S64_T0) + .08 * breathPhase(t, S64_T0);
  const train = ERA.gearTrain(W, H);
  const layers = [];
  const spiral = ERA.sarosSpiral(cx, cy, R);
  layers.push({ mesh: staticMesh(f, 'aky-spiral', () => spiral.lines), u: { uBright: .95 } });
  train.G.forEach((g, i) => {
    const mesh = staticMesh(f, `aky-gear-${i}-${g.teeth}`, () => ERA.gearLines(g.r, g.teeth, { spokes: g.spokes || 0, depth: g.depth, b: 1, w: 1.25 * s + .2, o: .82 }));
    layers.push({ mesh, u: { ...placeU(0, 0, train.angle(g, turn), 1, g.x, g.y), uBright: .9 } });
  });
  // the pointer: one month cell per kick, its pin riding the groove
  const cell = 38 + kickTicks(t, S64_T0, .1), th = cell / spiral.cells * spiral.turns * TAU, rr = spiral.rAt(th), a = spiral.a0 + th;
  const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
  const ptr = [proc.line([[cx + Math.cos(a) * R * 1.12, cy + Math.sin(a) * R * 1.12], [cx + Math.cos(a) * (spiral.r1 + spiral.pitch * .8), cy + Math.sin(a) * (spiral.r1 + spiral.pitch * .8)]], { b: .75, w: 1.6, o: .3 }),
    proc.circle(px, py, spiral.pitch * .24, { b: 1.4, w: 1.4, o: .5 }, 20), dot(px, py, 2.4, 3.2, .4)];
  layers.push(dynLayer(ptr));
  await eraFrame(f, { layers, ringCfg: RING_BARE, ringBright: .9 });
});

// ---------------------------------------------------------------- S65: Halley's 1715 map, the shadow oval is the ring
const S65_T0 = 225.476, S65_T1 = 228.876;
scene('S65', async f => {
  const W = f.W, H = f.H, s = H / 1080, cx = W / 2, cy = H / 2, R = ringR(H), t = f.t;
  const k = breathPhase(t, S65_T0, .5, .7) / Math.max(1e-3, breathPhase(S65_T1, S65_T0, .5, .7)), scale = 1.45 * s;   // px per km; travel breathes with the topline
  const u = lerp(ERA.PATH_LONDON - 150, ERA.PATH_LONDON + 95, k);                           // the oval moves NE along the path, over London
  const [mx, my, dx, dy] = ERA.pathAt(u), ang = Math.atan2(-dy, dx);
  const map = ERA.halleyLines(W, H, scale, [mx, my]), path = ERA.halleyPath(W, H, scale, [mx, my], u);
  const oval = ERA.shadowOval(cx, cy, R, ang);
  // the oval's earlier positions along the track, fading (Halley marked the shadow minute by minute)
  const ghosts = [];
  for (let j = 1; j <= 3; j++) {
    const [gx, gy] = ERA.pathAt(u - j * 62);
    const sx = cx + (gx - mx) * scale, sy = cy - (gy - my) * scale;
    ghosts.push(proc.ellipse(sx, sy, R * 1.55, R * 1.18, ang, { b: .6 / j, w: .9, o: .5, flags: FL.SHARP }, 120));
  }
  const keep = (x, y) => Math.hypot(x - cx, y - cy) > R * 1.03;
  await eraFrame(f, { layers: [dynLayer(clipLines([...map, ...path, ...ghosts], keep), { uBright: 1 }), dynLayer(oval)], ringCfg: RING_DIM, ringKey: 'orbitRingDim', ringBright: .9, kickPush: 10 });
});

// ---------------------------------------------------------------- S66: Eddington's 1919 plate, displaced stars around the black Sun
const S66_T0 = 228.876, S66_T1 = 232.266;
scene('S66', async f => {
  const W = f.W, H = f.H, s = H / 1080, cx = W / 2, cy = H / 2, R = ringR(H), t = f.t;
  const k = clamp((t - S66_T0) / (S66_T1 - S66_T0));
  const plate = ERA.eddingtonPlate(W, H);
  const stars = ERA.hyades(cx, cy, R, s);
  const bend = easeInOut(clamp(kickTicks(t, S66_T0, .12) / 6));                               // light bends, one kick at a time
  const kick = audio.kickEnv(t, .1);
  const drift = placeU(cx, cy, (-2.2 + 1.4 * k) * Math.PI / 180, 1 + .035 * k, 0, 0);         // the plate on the light table
  const layers = [
    { mesh: staticMesh(f, 'edd-plate', () => plate.lines), u: { ...drift, uBright: .9 } },
    dynLayer(ERA.eddingtonStars(stars, cx, cy, R, s, bend, kick, plate.rect), drift),
    dynLayer(clipLines(ERA.lightRays(cx, cy, R, W, s, .35 + .65 * bend), (x, y) => x > plate.rect[0] + 12 * s && x < plate.rect[2] - 12 * s && y > plate.rect[1] + 12 * s && y < plate.rect[3] - 12 * s), { ...drift, uBright: .8 }),
  ];
  await eraFrame(f, { layers });
});

// ---------------------------------------------------------------- S67: Concorde 001, the eclipse through a round porthole
const S67_T0 = 232.266;
const S67_TRACE = { contourW: [1.1, 2.2], contourB: 1.35, innerB: .9, innerHi: .16, lightDir: [-.3, -1], dsepMin: 3.2, dsepMax: 10, bgSepMin: 16, bgSepMax: 30, bgGain: .32,
  sky: { horizonY: .445, below: .45, useDepth: false }, horizon: 1, horizonBand: .02, minLen: 24 };
scene('S67', async f => {
  const W = f.W, H = f.H, s = H / 1080, cx = W / 2, cy = H / 2, R = ringR(H), t = f.t, Rp = 1.85 * R;
  const src = { plate: 'P35', standin: 'master', win: { cx: .5, cy: .24, zoom: 1.0 }, clamp: false };      // the plane low, the sky its own
  await eraFrame(f, {
    plate: { src, tp: t - S67_T0, chainFrom: 0, trace: S67_TRACE, corona: false, reveal: { x: cx, y: cy, r: Rp - 4 * s, ramp: 6 * s } },
    layers: [{ mesh: staticMesh(f, 'porthole', () => ERA.portholeLines(cx, cy, Rp, s)), u: { uBright: 1 } }],
  });
});

// ---------------------------------------------------------------- S68: a crowd in eclipse glasses looks up (rhymes with 102.21)
const S68_T0 = 235.656;
const S68_TRACE = { contourW: [1.2, 2.4], contourB: 1.85, innerB: 1.15, innerHi: .12, innerLo: .05, lightDir: [0, -1], dsepMin: 2.6, dsepMax: 8, bgSepMin: 14, bgSepMax: 28, bgGain: .3,
  subjBright: [.5, 1.2], rim: 1, sky: { maxDepth: .03, soft: .02, below: .6 }, horizon: 1, horizonBand: .02, minLen: 18 };
scene('S68', async f => {
  const t = f.t;
  const src = { plate: 'P36', standin: 'duelup', win: { cx: .5, cy: .41, zoom: 1.0 }, clamp: false };
  await eraFrame(f, { plate: { src, tp: t - S68_T0 + .10, chainFrom: .10, trace: S68_TRACE, analysis: { gain: 2.1 }, corona: false } });
});

// ---------------------------------------------------------------- S69: Artemis II, the corona around the Moon from Orion's window
const S69_T0 = 239.046, S69_T1 = 242.446;
scene('S69', async f => {
  const W = f.W, H = f.H, s = H / 1080, cx = W / 2, cy = H / 2, R = ringR(H), t = f.t;
  const k = clamp((t - S69_T0) / (S69_T1 - S69_T0));
  const win = ERA.orionWindow(W, H, s);
  // the capsule drifts (attitude hold is never perfect); the ring stays locked
  const dxw = lerp(-26, 30, easeInOut(k)) * s, dyw = 14 * s * Math.sin(k * Math.PI * .9), rot = lerp(-1.6, 1.2, easeInOut(k)) * Math.PI / 180;
  const U = placeU(cx, cy, rot, 1, dxw, dyw);
  const stars = [];
  for (let i = 0; i < 90; i++) { const x = hash3(i, 69, 1) * W, y = hash3(i, 69, 2) * H; if (Math.hypot(x - cx, y - cy) < R * 1.5) continue; stars.push([x, y, .3 + 1.2 * Math.pow(hash3(i, 69, 3), 3)]); }
  // stars only through the glass: the window polygon, moved with the capsule
  const c = Math.cos(rot), sn = Math.sin(rot), glass = win.glass.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * sn + dxw, cy + (x - cx) * sn + (y - cy) * c + dyw]);
  const starLines = stars.filter(([x, y]) => ERA.pointInPoly(x, y, glass)).map(([x, y, b]) => dot(x, y, b, 1.6 + b, 0, FL.TIP | FL.SHARP));
  await eraFrame(f, { layers: [{ mesh: staticMesh(f, 'orion-window', () => win.lines), u: { ...U, uBright: 1 } }, dynLayer(starLines)] });
  // earthshine: the night side of the Moon faintly lit by the Earth (NASA's description of the Orion view)
  const g = f.g, Rk = R * (1 + .022 * audio.kickEnv(t, .13));
  g.save(); g.beginPath(); g.arc(cx, cy, Rk * .985, 0, TAU); g.clip();
  const grd = g.createRadialGradient(cx - .55 * Rk, cy + .25 * Rk, Rk * .1, cx - .3 * Rk, cy + .1 * Rk, Rk * 1.25);
  grd.addColorStop(0, 'rgba(150,160,180,.10)'); grd.addColorStop(1, 'rgba(150,160,180,0)');
  g.fillStyle = grd; g.fillRect(cx - Rk, cy - Rk, 2 * Rk, 2 * Rk);
  g.strokeStyle = 'rgba(205,210,220,.13)'; g.lineWidth = 1.1 * s;
  for (const [ox, oy, rx, ry, a] of [[-.45, -.2, .28, .18, .3], [-.25, .35, .22, .14, -.4], [-.62, .18, .12, .1, 0], [-.05, -.48, .16, .1, .6], [.15, .05, .1, .08, .2]]) {
    g.beginPath(); g.ellipse(cx + ox * Rk, cy + oy * Rk, rx * Rk, ry * Rk, a, 0, TAU); g.stroke();
  }
  g.restore();
});

// ---------------------------------------------------------------- S70: Karnak, a black Sun almost overhead
const S70_T0 = 242.446;
// P37 looks straight up: the sky is a cross in the middle of the frame, which the engine's sky mask (sky from the top
// down) cannot find, and streamlines through the stone read as noise. The columns are drawn from the plate's DEPTH:
// iso-depth contours (blended between the depth maps, 12 a second, so they glide at 60) wrap each column like rings
// and pile up into bright silhouettes at its edges; the far sky cross stays empty. The engine adds only the carved
// reliefs (image edges, no streamlines).
const S70_TRACE = { stream: false, contour: 0, innerB: .75, innerHi: .13, innerLo: .06, innerW: [.7, 1.2], innerEverywhere: 1, lightDir: [-.5, -.8], subject: 'none', poolMatte: 0, minLen: 16, horizon: 0 };
// P37 turns about the zenith (the camera looks straight up and rotates ~42 deg in 4 s about source px (424, 217)): the
// window centres that point, so the sky cross and the columns wheel around the locked black sun.
const S70_WIN = { cx: 424 / 960, cy: 217 / 540, zoom: 1.25 }, P37_C = [424, 217];
// the plate's measured motion, frame 1 px -> frame k px (ORB + RANSAC similarity, chained): [deg*100, tx*10, ty*10, (s-1)*1e4]
const P37_SIM = [[0,0,0,0],[-51,-21,36,1],[-105,-48,75,11],[-150,-72,102,29],[-196,-97,134,44],[-249,-120,171,56],[-296,-140,203,65],[-344,-160,236,77],[-397,-185,274,92],[-451,-204,316,99],[-504,-226,355,111],[-555,-244,394,118],[-610,-262,440,121],[-665,-282,482,131],[-717,-304,521,142],[-770,-321,564,147],[-822,-338,605,151],[-872,-352,643,156],[-925,-368,687,156],[-978,-386,727,167],[-1027,-401,766,171],[-1082,-416,811,175],[-1137,-434,854,187],[-1188,-451,895,196],[-1241,-469,939,206],[-1290,-479,978,209],[-1386,-502,1058,219],[-1430,-508,1094,216],[-1474,-516,1131,216],[-1521,-524,1169,213],[-1565,-529,1205,210],[-1607,-537,1239,209],[-1647,-542,1271,207],[-1691,-542,1310,198],[-1739,-551,1348,200],[-1779,-554,1383,196],[-1822,-559,1419,192],[-1864,-563,1454,193],[-1904,-565,1491,186],[-1947,-571,1525,191],[-1988,-580,1559,198],[-2034,-585,1597,198],[-2081,-589,1637,196],[-2126,-596,1676,201],[-2172,-603,1715,205],[-2221,-612,1756,213],[-2274,-624,1799,223],[-2321,-629,1841,225],[-2368,-632,1880,230],[-2417,-637,1921,234],[-2464,-636,1961,232],[-2504,-638,1996,237],[-2546,-638,2032,234],[-2591,-645,2071,248],[-2637,-641,2111,243],[-2678,-642,2146,244],[-2716,-641,2176,247],[-2761,-639,2214,247],[-2805,-640,2251,252],[-2847,-639,2289,254],[-2889,-642,2325,264],[-2937,-642,2366,270],[-2984,-641,2406,274],[-3027,-639,2442,278],[-3071,-636,2481,280],[-3119,-634,2522,285],[-3165,-632,2562,288],[-3206,-630,2598,293],[-3238,-632,2624,305],[-3273,-632,2654,313],[-3308,-628,2685,311],[-3340,-625,2712,314],[-3374,-621,2742,316],[-3410,-627,2772,336],[-3448,-623,2803,342],[-3484,-622,2834,352],[-3520,-616,2863,351],[-3553,-615,2891,359],[-3594,-611,2926,366],[-3633,-608,2957,373],[-3673,-607,2993,387],[-3708,-605,3022,400],[-3744,-602,3053,406],[-3783,-599,3087,413],[-3822,-593,3120,415],[-3862,-590,3155,425],[-3900,-585,3185,434],[-3936,-583,3216,444],[-3968,-580,3243,456],[-4005,-567,3274,440],[-4039,-564,3301,449],[-4076,-557,3332,458],[-4106,-553,3358,471],[-4142,-545,3389,471],[-4163,-531,3409,462],[-4198,-520,3436,451],[-4224,-513,3457,461]];
function p37Sim(q) {
  const k = clamp(Math.floor(q), 0, P37_SIM.length - 2), u = clamp(q - k, 0, 1), A = P37_SIM[k], B = P37_SIM[k + 1];
  const a = lerp(A[0], B[0], u) / 100 * Math.PI / 180, sc = 1 + lerp(A[3], B[3], u) / 1e4, tx = lerp(A[1], B[1], u) / 10, ty = lerp(A[2], B[2], u) / 10;
  const c = Math.cos(a) * sc, sn = Math.sin(a) * sc;
  return (x, y) => [c * x - sn * y + tx, sn * x + c * y + ty];
}
const DEPTHS = new Map();
async function depthFrame(id, f1, w, h) {
  const key = `${id}|${f1}|${w}`; if (DEPTHS.has(key)) return DEPTHS.get(key);
  const { loadImage, pixels } = await import('../assets.js');
  const img = await loadImage(`plates/${id}/maps/d${String(f1).padStart(4, '0')}.png`), px = pixels(img, w, h);
  let D = new Float32Array(w * h); for (let i = 0; i < w * h; i++) D[i] = px[i * 4] / 255;
  for (let pass = 0; pass < 2; pass++) {                       // a light separable box blur: smooth contours from 8-bit depth
    const T = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0, n = 0; for (let k = -1; k <= 1; k++) { const xx = x + k; if (xx >= 0 && xx < w) { a += D[y * w + xx]; n++; } } T[y * w + x] = a / n; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0, n = 0; for (let k = -1; k <= 1; k++) { const yy = y + k; if (yy >= 0 && yy < h) { a += T[yy * w + x]; n++; } } D[y * w + x] = a / n; }
  }
  DEPTHS.set(key, D); while (DEPTHS.size > 8) DEPTHS.delete(DEPTHS.keys().next().value);
  return D;
}
// The depth field (blended between the two nearest depth maps so lines glide at 60 fps) gives three line kinds:
//   silhouettes  zero-crossings of D - blur(D) (Marr-Hildreth) where the depth gradient is steep: one crisp line per
//                occluding edge (column against sky, column against column), brighter the bigger the depth jump
//   rings        iso-depth contours on the smooth stone only: they wrap each column like the bands of its shaft
//   sky          left empty (depth ~ 0): the black sun hangs in the cross of sky between the architraves
function boxBlur(D, w, h, r, passes) {
  let A = D, T = new Float32Array(w * h), B = new Float32Array(w * h);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) { let acc = 0, n = 0; for (let x = -r; x < w + r; x++) { if (x + r < w) { acc += A[y * w + x + r]; n++; } if (x - r - 1 >= 0) { acc -= A[y * w + x - r - 1]; n--; } if (x >= 0 && x < w) T[y * w + x] = acc / n; } }
    for (let x = 0; x < w; x++) { let acc = 0, n = 0; for (let y = -r; y < h + r; y++) { if (y + r < h) { acc += T[(y + r) * w + x]; n++; } if (y - r - 1 >= 0) { acc -= T[(y - r - 1) * w + x]; n--; } if (y >= 0 && y < h) B[y * w + x] = acc / n; } }
    A = B; B = new Float32Array(w * h);
  }
  return A;
}
const TONES = new Map();
async function toneField(id, q, w, h) {
  const k0 = Math.floor(q), u = q - k0, get = async n => {
    const key = `${id}|${n}|${w}`; if (TONES.has(key)) return TONES.get(key);
    const { loadImage, pixels } = await import('../assets.js'), nn = clamp(n, 1, 97);
    const px = pixels(await loadImage(`plates/${id}/maps/g${String(nn).padStart(4, '0')}.png`), w, h), T = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) T[i] = px[i * 4 + 1] / 255;
    const sorted = Float32Array.from(T).sort(), hi = Math.max(.2, sorted[Math.floor(w * h * .97)]);     // the timelapse dims: normalise
    for (let i = 0; i < w * h; i++) T[i] = Math.min(1, T[i] / hi);
    TONES.set(key, T); while (TONES.size > 6) TONES.delete(TONES.keys().next().value);
    return T;
  };
  const A = await get(k0 + 1), B = await get(k0 + 2), T = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) T[i] = A[i] * (1 - u) + B[i] * u;
  return T;
}
async function depthLines(f, id, tp, win, o = {}) {
  const { contours } = await import('../worlds/orbit/moon.js');
  const W = f.W, H = f.H, s = H / 1080, gw = 384, gh = 216, n = (resolve({ plate: id }).n) || 97, q = clamp(tp * 24, 0, n - 1), last = 1 + Math.floor((n - 1) / 2) * 2;
  const f1 = Math.min(1 + Math.floor(q / 2) * 2, last), f2 = Math.min(f1 + 2, last), u = clamp((q - (f1 - 1)) / 2);
  const A = await depthFrame(id, f1, gw, gh), B = f2 !== f1 ? await depthFrame(id, f2, gw, gh) : A, D = new Float32Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) D[i] = A[i] * (1 - u) + B[i] * u;
  const Db = boxBlur(D, gw, gh, 2, 3), L = new Float32Array(gw * gh), G = new Float32Array(gw * gh);
  for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
    const i = y * gw + x; L[i] = D[i] - Db[i];
    G[i] = Math.hypot(Db[i + 1] - Db[i - 1], Db[i + gw] - Db[i - gw]) * .5;
  }
  const at = (F, x, y) => { const i = clamp(Math.round(y), 0, gh - 1) * gw + clamp(Math.round(x), 0, gw - 1); return F[i]; };
  const ww = 960 / win.zoom, hh = ww / (W / H), x0 = win.cx * 960 - ww / 2, y0 = win.cy * 540 - hh / 2;
  const toS = (x, y, p) => { p[0] = ((x + .5) / gw * 960 - x0) / ww * W; p[1] = ((y + .5) / gh * 540 - y0) / hh * H; };
  const id2 = (x, y) => [x, y], out = [];
  const g0 = o.g0 ?? .012, g1 = o.g1 ?? .05;
  // silhouettes
  for (const c of contours(L, gw, gh, [0], id2)) {
    const Ln = mkLine(c.pts, { b: c.pts.map(([x, y]) => .35 + 1.1 * clamp((at(G, x, y) - g0) / (g1 - g0))), w: 1.25 * s + .25, o: .12 });
    if (Ln) for (const piece of splitLine(Ln, (x, y) => at(G, x, y) > g0 && at(Db, x, y) > .02, 4)) out.push(piece);
  }
  // rings on the smooth stone, dimmer with distance
  for (const c of contours(Db, gw, gh, o.levels || [], id2)) {
    const Ln = mkLine(c.pts, { b: .12 + .34 * c.lv, w: .8 * s + .2, o: .18 + .2 * c.lv, phase: c.lv * 7, flags: FL.SHARP });
    if (Ln) for (const piece of splitLine(Ln, (x, y) => at(G, x, y) < g0 * 1.6, 4)) out.push(piece);
  }
  // flutes: rays from the zenith fixed to the stone (they turn with the plate), drawn only on the column shafts (the
  // depth gradient runs along the ray), broken at silhouettes, bright where the stone is lit (the plate's tone map)
  if (o.flutes) {
    const T = await toneField(id, q, gw, gh), M = p37Sim(q), N = o.flutes, sx = gw / 960, sy = gh / 540, C = M(P37_C[0], P37_C[1]);
    for (let j = 0; j < N; j++) {
      let lvl = 0; while (lvl < 5 && !((j >> lvl) & 1)) lvl++;
      const r0 = Math.max(22, 330 / 2 ** lvl), phi = j / N * TAU + hash3(j, 3, 70) * .3 / N * TAU, cs = Math.cos(phi), sn = Math.sin(phi);
      const pts = [], bb = [];
      for (let r = r0; r < 720; r += 2.5) {
        const [px, py] = M(P37_C[0] + cs * r, P37_C[1] + sn * r), gx = px * sx - .5, gy = py * sy - .5;
        if (gx < 1 || gy < 1 || gx > gw - 2 || gy > gh - 2) { pts.push([gx, gy]); bb.push(0); continue; }
        const i = Math.round(gy) * gw + Math.round(gx), d = Db[i], g = G[i];
        const ux = px - C[0], uy = py - C[1], ul = Math.hypot(ux, uy) || 1;
        const ddx = Db[i + 1] - Db[i - 1], ddy = Db[i + gw] - Db[i - gw], dl = Math.hypot(ddx, ddy) || 1e-6;
        const along = Math.abs(ddx * ux + ddy * uy) / (dl * ul);
        const w = sstep(.06, .14, d) * sstep(.55, .9, along) * sstep(.0008, .003, g) * (1 - sstep(g0 * .8, g0 * 1.3, g));
        pts.push([gx, gy]); bb.push(w * (.03 + 1.25 * T[i] ** 1.7) * (.5 + .5 * d));
      }
      const Ln = mkLine(pts, { b: bb, w: .8 * s + .2, o: .22, phase: hash3(j, 5, 70) * 9, spd: .4, flags: FL.SHARP });
      if (Ln) for (const piece of splitLine(Ln, (x, y, k) => bb[k] > .05, 3)) out.push(piece);
    }
  }
  xform(out, (x, y, p) => toS(x, y, p));
  for (const Ln of out) { let acc = 0; for (let k = 1; k < Ln.n; k++) { acc += Math.hypot(Ln.xy[k * 2] - Ln.xy[k * 2 - 2], Ln.xy[k * 2 + 1] - Ln.xy[k * 2 - 1]); Ln.s[k] = acc; } Ln.s[0] = 0; Ln.len = acc; }
  return out;
}
const S70_LEVELS = Array.from({ length: 15 }, (_, k) => .12 + k * .057);
scene('S70', async f => {
  const t = f.t, tp = t - S70_T0, src = { plate: 'P37', standin: 'master', win: S70_WIN, clamp: false };
  const stone = await depthLines(f, 'P37', tp, S70_WIN, { levels: S70_LEVELS, flutes: 1024 });
  await eraFrame(f, { plate: { src, tp, chainFrom: 0, trace: S70_TRACE, corona: false }, under: [dynLayer(stone, { uBright: 1 })], ringCfg: RING_BARE });
});

// ---------------------------------------------------------------- S71: Phobos, a lumpy potato crossing the Sun over Mars
const S71_T0 = 245.826, S71_T1 = 249.215;
scene('S71', async f => {
  const W = f.W, H = f.H, s = H / 1080, cx = W / 2, cy = H / 2, R = ringR(H), t = f.t;
  const k = clamp((t - S71_T0) / (S71_T1 - S71_T0)), kick = audio.kickEnv(t, .13);
  // Phobos crosses left to right, a little high, never covering the whole disk (an annular-type transit)
  const u = lerp(-1.75, 1.75, k), px = cx + u * R, py = cy - .22 * R + .1 * u * R;
  const potato = ERA.phobosOutline(px, py, R, .35 + .1 * u);
  const inPotato = (x, y) => ERA.pointInPoly(x, y, potato);
  const sun = clipLines(ERA.sunDiskLines(cx, cy, R * (1 + .02 * kick), s), (x, y) => !inPotato(x, y));
  const mars = ERA.marsHorizon(W, H, s);
  await drawLines(f, {
    layers: [{ mesh: staticMesh(f, 'mars', () => mars.lines), u: { uBright: 1 } }, dynLayer(sun, { uBright: 1 })],
    kick, kickPush: 12, pushCenter: [cx, cy], phase: audio.flowPhase(t) * .85, look: { glow: [.26, .1] }, disk: false,
  });
  // the silhouette: crisp, darker than the sky (drawn over the glow)
  const g = f.g;
  g.save(); g.fillStyle = '#04050a'; g.beginPath(); potato.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); g.restore();
  steer(f, { sun: { x: cx, y: cy, r: R }, field: { center: [cx, cy] }, kick });
});

// ================================================================ S72: EARTHSET, the first blue
// The Earth rises over the grey lunar limb (orthographic Moon: its silhouette is a circle, so it occludes the Earth's
// lines with the engine's reveal mask and the blue fill with a circle test). The Earth's line set is projected once
// (a static mesh) and slides up; clouds drift by their travelling pulses. Lit from the west (the 585 BC sun: the dusk
// band lies over Anatolia, on the right). The blue appears on this shot's first frame and nowhere before it.
export const S72_T0 = 249.215, S72_T1 = 255.985;
export const EARTH_SUN = [-60, 21.5];                 // the sub-solar point of the room's sim (16:00 UT, 28 May): dusk over the Halys
const S72_VIEW = { lon0: -16, lat0: 21, roll: -8 };
export function s72Earth(f, t) {
  const H = f.H, W = f.W, yTop = .6 * H, Rs = .36 * H;
  const k = easeInOut(clamp((t - S72_T0) / (S72_T1 - S72_T0 + .4)));
  const cy = lerp(yTop + .42 * Rs, yTop - .5 * Rs, k);
  return { Rs, cx: W / 2, cy, yTop, k };
}
async function moonLimb(f) {
  const { lunarLimb } = await import('../worlds/orbit/moon.js');
  return lunarLimb(f.W, f.H, { RM: 1.6, yTop: .6, sun: [-.9, -.28], seed: 5 });
}
scene('S72', async f => {
  const W = f.W, H = f.H, s = H / 1080, t = f.t, E = await import('../worlds/orbit/earth.js');
  await E.earthReady(0);
  const pos = s72Earth(f, t), kick = audio.kickEnv(t, .14) * .55, breath = vocalBreath(t);
  const M = await moonLimb(f), occ = { x: M.cx, y: M.cy, r: M.RM };
  const ref = { ...S72_VIEW, D: 40, Rs: pos.Rs, cx: W / 2, cy: .5 * H, sun: EARTH_SUN };
  const earthMesh = staticMesh(f, 'earth-s72', () => E.earthLines(E.earthView(ref), { W, H: H * 2, minStep: 2.4, gain: 1 }));
  const V = E.earthView({ ...ref, cy: pos.cy });
  const stars = [];
  for (let i = 0; i < 140; i++) {
    const x = hash3(i, 72, 1) * W, y = hash3(i, 72, 2) * H * .66;
    if (Math.hypot(x - occ.x, y - occ.y) < occ.r + 3 * s || Math.hypot(x - pos.cx, y - pos.cy) < pos.Rs * 1.06) continue;
    stars.push(dot(x, y, .25 + 1.1 * Math.pow(hash3(i, 72, 3), 4), 1.4 + hash3(i, 72, 4), 0, FL.TIP | FL.SHARP));
  }
  const layers = [
    dynLayer(stars, { uBright: .8 }),
    { mesh: earthMesh, u: { ...affineU(1, 0, 0, 1, 0, pos.cy - .5 * H), uReveal: [occ.x, occ.y, occ.r + 1.5 * s, 2.5 * s], uReveal2: [0, 100], uBright: 1 + .1 * breath, uT: breathPhase(t, S72_T0, .3, .4) } },
    { mesh: staticMesh(f, 'moon-s72', () => M.lines), u: { uBright: 1 } },
  ];
  await drawLines(f, { layers, kick, kickWidth: .8, kickPush: 6, pushCenter: [W / 2, pos.cy], phase: audio.flowPhase(t) * .6, look: { glow: [.24, .1] }, disk: false, palette: BLUE });
  await E.earthFill(f, V, { occ });
  steer(f, { kick, light: { dir: [-.85, -.45], elev: .42, color: '#f6efe0', intensity: 1.05, cool: .25 } });
});
const BLUE = { red: '#2a78e4' };

// ================================================================ S73: the Earth rushes at the camera (THROW DOWN x2)
// From Earthset's last framing the globe turns to bring the Halys to the centre and lunges at us on each chop
// (256.405, 257.245); the Moon falls away below. The CHOP fill radiates from the dive's target.
export const S73_T0 = 255.985, S73_T1 = 257.675, CHOP1 = 256.405, CHOP2 = 257.245;
function rushK(t) {                     // the scale factor (x Earthset's radius), with two lunges
  const a = snap(CHOP1), b = snap(CHOP2);
  let k = 1 + .14 * clamp((t - S73_T0) / (a - S73_T0));
  if (t >= a) k = lerp(1.14, 2.0, 1 - Math.exp(-(t - a) / .07)) + .5 * clamp((t - a) / (b - a));
  if (t >= b) k = lerp(2.5, 4.4, 1 - Math.exp(-(t - b) / .08)) + 1.6 * clamp((t - b) / (S73_T1 - b));
  return k;
}
export function s73View(f, t) {
  const W = f.W, H = f.H, p0 = s72Earth(f, S72_T1), k = rushK(t);
  const turn = easeInOut(clamp((t - S73_T0 - .05) / (S73_T1 - S73_T0 - .05)));
  const lon0 = lerp(S72_VIEW.lon0, 34.85, turn), lat0 = lerp(S72_VIEW.lat0, 38.72, turn), roll = lerp(S72_VIEW.roll, 0, turn);
  return { lon0, lat0, roll, D: 40, Rs: p0.Rs * k, cx: W / 2, cy: lerp(p0.cy, H / 2, turn), sun: EARTH_SUN, k, turn };
}
scene('S73', async f => {
  const W = f.W, H = f.H, s = H / 1080, t = f.t, E = await import('../worlds/orbit/earth.js');
  await E.earthReady(1);
  const v = s73View(f, t), V = E.earthView(v), kick = audio.kickEnv(t, .12);
  const M = await moonLimb(f), drop = easeInOut(clamp((t - S73_T0) / (snap(CHOP1) + .25 - S73_T0)));
  const my = drop * .75 * H, fadeM = 1 - drop;
  const occ = fadeM > .02 ? { x: M.cx, y: M.cy + my, r: M.RM } : null;
  const layers = [dynLayer(E.earthLines(V, { W, H, minStep: 2.6, occ }), { uBright: 1.05 })];
  if (fadeM > .02) layers.push({ mesh: staticMesh(f, 'moon-s72', () => M.lines), u: { ...affineU(1, 0, 0, 1, 0, my), uBright: fadeM } });
  const target = E.project(V, E.ll2v(34.85, 38.72));
  await drawLines(f, { layers, kick, kickWidth: 1.1, kickPush: 18, pushCenter: [target[0], target[1]], phase: audio.flowPhase(t), look: { glow: [.24, .1] }, disk: false, palette: BLUE });
  await E.earthFill(f, V, { occ });
  steer(f, { kick, field: { center: [target[0], target[1]], r: 0 }, sun: undefined });
});

// ================================================================ S74: the dive, lines condense into paint (GOLD)
// 257.675 (the hit, the kick stops): down through the cloud deck (white contour layers scaled past the camera), the
// map of Anatolia under it (1:10m coasts, the seas still Earth-blue, the Halys in orange), zooming 1100x into the bend
// near Avanos; then the camera pitches from nadir to level as it drops into the valley, P38's front row appears in
// lines, and the lines widen and condense into the brush engine's GOLD paint of P38's first frame (12 drawings/s, the
// painted world's cadence). Its last frame is paint(P38 frame 1, LANDING_LOOK): S75 (259.36) continues from there.
export const S74_T0 = 257.675, S74_T1 = 259.355;
const S77_T0_ = 262.724;
// The landing and the boom are seamless by construction: the paint is the GOLD agent's own scene (gold_outro.js S75 /
// S76), drawn through f.drawScene on its own 12 fps drawing grid: S74 ends on the drawings before S75's first (P38 at
// plate 1.55, cam zoom 1.03, held by their keys), S77 opens on the drawings after S76's last (plate 5.0, zoom 1.045).
// Fallback while their scene is missing: paint(P38, LANDING_LOOK).
export const LANDING_LOOK = {
  palette: 'gold', lightDir: [-.55, -.8], pool: [{ x: .5, y: .5, rx: .95, ry: .9, feather: .6, k: 1 }], poolFromLight: { k: .7, bg: .45 }, poolMatte: .5,
  envDim: .8, crushFloor: .05, rim: .75, glint: .9, plateKeep: .6, keepDim: .88, faceMin: .3, impasto: .5, eclipse: 0, seed: 38,
};
export const S74_HANDOFF = { t: S74_T1, scene: 'S75', plate: 'P38', tp: 1.55, zoom: 1.03 };
export const S77_START = { t: S77_T0_, scene: 'S76', plate: 'P38', tp: 5.0, zoom: 1.045 };
const GOLDC = new Map();
// the drawing of scene sid on its own cadence grid nearest at or before t (may lie outside the shot: their keys hold)
async function goldFrame(f, sid, t) {
  const sh = shotById(sid);
  if (!sh || !SCENES.has(sid) || sh.scene !== sid) return null;
  const t0 = sh.F0 / FPS, d = Math.floor((t - t0) * sh.cadence + 1e-6), tq = t0 + d / sh.cadence, key = `${sid}|${f.W}x${f.H}|${d}`;
  if (GOLDC.has(key)) { const c = GOLDC.get(key); GOLDC.delete(key); GOLDC.set(key, c); return c; }
  const c = new OffscreenCanvas(f.W, f.H), g2 = c.getContext('2d');
  await f.drawScene(sid, { t: tq, shot: sh, cad: sh.cadence, d, lt: tq - sh.t0, k: (tq - sh.t0) / sh.dur, dur: sh.dur, params: sh.params || {}, world: sh.world, type: {} }, g2);
  GOLDC.set(key, c);
  while (GOLDC.size > 6) GOLDC.delete(GOLDC.keys().next().value);
  return c;
}
// paint(P38 at plate time tp) at the drawing of song time t (12 fps), cached per drawing (the fallback)
const PAINTS = new Map();
async function paintP38(f, t, tp, zoom = 1) {
  const di = Math.round(t * 12), key = `${f.W}x${f.H}|${di}|${tp}|${zoom}`;
  if (PAINTS.has(key)) { const c = PAINTS.get(key); PAINTS.delete(key); PAINTS.set(key, c); return c; }
  const B = await import('../worlds/brush/index.js');
  const tq = di / 12, ff = { ...f, t: tq, cad: 12, k: 0, lt: 0 }, cam = { cx: .5, cy: .5, zoom };
  const src = await B.resolvePlate(ff, 'P38', { id: 'c_armies', cam }, cam, { keys: [[0, tp], [1e4, tp]] });
  const c = new OffscreenCanvas(f.W, f.H), g2 = c.getContext('2d');
  await B.paint(ff, src, { ...LANDING_LOOK, target: g2, drawIdx: di });
  PAINTS.set(key, c);
  while (PAINTS.size > 6) PAINTS.delete(PAINTS.keys().next().value);
  return c;
}
const goldOrPaint = async (f, sid, t, tp, zoom) => (await goldFrame(f, sid, t)) || paintP38(f, t, tp, zoom);
const P38_SRC = { plate: 'P38', standin: 'armies', win: { cx: .5, cy: .5, zoom: 1.03 } };
const P38_SRC_END = { plate: 'P38', standin: 'armies', win: { cx: .5, cy: .5, zoom: 1.045 } };
const P38_TRACE = { shadowCut: .02, darkCut: .012, gamma: .95, gain: 1.25, subjBright: [.38, 1.0], contourW: [1.1, 2.0], contourB: 1.2, innerB: 1.05, innerHi: .16, lightDir: [-.5, -.8], dsepMin: 3, dsepMax: 9, bgSepMin: 14, bgSepMax: 26, bgGain: .35,
  sky: { horizonY: .43, below: .45, useDepth: false }, horizon: 1, horizonBand: .02, armies: 0,
  minLen: 20 };
let LOD = null;
async function diveLods(f) {
  const D = await import('../worlds/orbit/dive.js');
  if (!LOD) { const t0 = performance.now(); LOD = { A: D.lodA(), B: D.lodB(), C: D.lodC(), decks: [D.cloudDeck(1.3), D.cloudDeck(4.1, { cover: .05 }), D.cloudDeck(7.7, { cover: .12 })], R: D.river() }; console.log(`[orbit] dive lods ${Math.round(performance.now() - t0)} ms`); }
  return { D, L: LOD };
}
// the map's rotation: the river horizontal at the landing point, north-ish up
function mapRot(R) { let r = -R.ang; while (r > Math.PI / 2) r -= Math.PI; while (r < -Math.PI / 2) r += Math.PI; return r; }
const mapU = (S, rot, cx, cy) => affineU(S * Math.cos(rot), -S * Math.sin(rot), -S * Math.sin(rot), -S * Math.cos(rot), cx, cy);
const lodW = S => ({ A: (1 - sstep(10, 24, S)), B: sstep(4, 10, S) * (1 - sstep(150, 320, S)), C: sstep(55, 130, S) });
// The dive's scale (px per km at the frame centre): from S73's last globe (the hit) to the bend's banks at tau .95.
// Globe (perspective, north up) until S ~ 2.3 px/km, then the flat map (1:10m, rotating to put the river level),
// switched under a cloud deck bursting past the camera; at the end the camera drops into the low deck (mist streaks)
// and comes out in the Halys valley: P38 in lines, which condense into the GOLD paint of S75's first drawing.
const DIVE = { S1: 380, te: .95, sw: [.19, .28] };
const globeS = V => V.Rs * Math.sqrt(V.D * V.D - 1) / (V.D - 1) / 6371;          // px/km at the centre of a perspective globe
const globeRs = (S, D = 40) => S * 6371 * (D - 1) / Math.sqrt(D * D - 1);
let _S73END = null;
function diveScale(f, tau) {
  if (!_S73END) _S73END = globeS(s73View(f, S73_T1));
  const u = clamp(tau / DIVE.te);
  return Math.exp(lerp(Math.log(_S73END), Math.log(DIVE.S1), Math.pow(u, 1.1)));
}
// deck layers passing the camera: d = tau - tPass; scale grows (dir 1) or shrinks (dir -1) through the frame
function deckLayer(f, L, i, d, dir, gain, rot0) {
  const W = f.W, H = f.H, env = sstep(-.2, -.04, d * dir) * (1 - sstep(.04, .17, d * dir)); if (env <= .01) return null;
  const sc = .9 * W * Math.exp(4.6 * d * dir), r0 = rot0 + .35 * d, c = Math.cos(r0) * sc, sn = Math.sin(r0) * sc;
  return { mesh: staticMesh(f, 'deck-' + i, () => L.decks[i]), u: { ...affineU(c, sn, -sn, c, W / 2, H / 2), uBright: gain * env, uPulse: .3 } };
}
scene('S74', async f => {
  const W = f.W, H = f.H, s = H / 1080, t = f.t, tau = t - S74_T0, cx = W / 2, cy = H / 2;
  const { D, L } = await diveLods(f), E = await import('../worlds/orbit/earth.js');
  const S = diveScale(f, tau), layers = [];
  const rotK = sstep(.3, .9, tau), rot = mapRot(L.R) * rotK;
  const globeK = 1 - sstep(DIVE.sw[0], DIVE.sw[1], tau), mapK = sstep(DIVE.sw[0] - .02, DIVE.sw[1], tau) * (1 - sstep(.9, 1.0, tau));
  const plateK = sstep(.9, 1.06, tau), paintK = sstep(1.37, 1.6, tau);
  let V = null;
  if (globeK > .01) {                                   // S73's globe, continuing (centre eases onto the landing point)
    await E.earthReady(1);
    const land = D.kmLL(...L.R.shift), k = sstep(0, .18, tau);
    V = E.earthView({ lon0: lerp(34.85, land[0], k), lat0: lerp(38.72, land[1], k), roll: 0, D: 40, Rs: globeRs(S), cx, cy, sun: EARTH_SUN });
    layers.push(dynLayer(E.earthLines(V, { W, H, minStep: 2.6 }), { uBright: 1.05 * globeK }));
  }
  if (mapK > .01) { const w = lodW(S); for (const [k, key] of [['A', 'dive-A'], ['B', 'dive-B'], ['C', 'dive-C']]) if (w[k] > .01) layers.push({ mesh: staticMesh(f, key, () => L[k]), u: { ...mapU(S, rot, cx, cy), uBright: w[k] * mapK, uPulse: 0 } }); }
  // the cloud deck at the hit (two layers bursting past), and the low deck at the bottom of the dive
  for (const [i, tp, g] of [[0, .17, 1.15], [2, .93, 1.3]]) { const Ly = deckLayer(f, L, i, tau - tp, 1, g, .4 * i); if (Ly) layers.push(Ly); }
  const mist = sstep(.78, .92, tau) * (1 - sstep(1.0, 1.16, tau));
  if (mist > .01) layers.push(dynLayer(D.mistStreaks(W, H, t, mist, 1), { uBright: 1 }));
  await drawLines(f, {
    ...(plateK > .01 ? { src: P38_SRC, freeze: 1.55, trace: P38_TRACE, corona: false, plateU: { uBright: 1.3 * plateK } } : {}),
    layers, kick: 0, phase: audio.flowPhase(t) * .8, disk: false, palette: BLUE,
    look: { glow: [.24 * (1 - paintK), .1 * (1 - paintK)], width: 1 + 2.2 * paintK, soft: .45 * paintK, flat: .5 * paintK },
  });
  const seaA = (1 - sstep(7, 22, S)) * mapK;
  if (seaA > .01) await E.mapFill(f, { cx, cy, S, rot, ll0: D.BEND, k: [111.32 * Math.cos(38.72 * Math.PI / 180), 110.9], shift: L.R.shift }, { alpha: seaA });
  if (V) await E.earthFill(f, V, { alpha: globeK });
  if (paintK > .002) {
    const pc = await goldOrPaint(f, 'S75', t, 1.55, 1.03), g = f.g;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = paintK; g.drawImage(pc, 0, 0, W, H); g.restore();
  }
  steer(f, { kick: 0 });
});

// ================================================================ S77: the pull-back (paint -> light -> ink)
// On the boom (262.72): S76's last painted frame (P38's last frame) evaporates into its lines as the camera booms up;
// the valley drops away (ground camera, level -> nadir), the map of Anatolia recedes, up through the cloud deck, the
// globe (blue again) with the Moon's shadow over Anatolia, the Moon swings past, the Earth settles at the size it has
// on her monitor, and the image shrinks into the monitor's sim panel as the bezel enters; the last frames dissolve into
// S78's first frame (her room), so the cut at 266.12 is invisible. The end framing is room.js's roomHandoff().
export const S77_T0 = 262.724, S77_T1 = 266.124;
shotOverride('S77', { cadence: 60 });
const S77P = { globe: [1.3, 2.72], moon: [1.85, 2.72], bezel: [2.62, 3.3], room: [3.14, 3.37] };
const UMBRA = { ll: [33.9, 38.4], r: 3.2, pen: 9.8, k: 1.15 };   // where the room's sim draws it
let _moonRef = null;
// The pull-back mirrors the dive: paint -> P38 in lines (the boom tilts up) -> up through the low deck (mist streaks
// inward) -> the map of Anatolia receding (nadir), the seas turning blue -> up through the high deck, which hides the
// switch to the globe at ~2.3 px/km -> the globe settles at the monitor's size with the Moon's shadow over Anatolia.
const S77_SW = 2.3;
function s77Scale(tau) { const u = clamp((tau - .5) / (1.3 - .5)); return Math.exp(lerp(Math.log(DIVE.S1), Math.log(S77_SW), Math.pow(u, .9))); }
scene('S77', async f => {
  const W = f.W, H = f.H, s = H / 1080, t = f.t, tau = t - S77_T0, cx = W / 2, cy = H / 2;
  const { D, L } = await diveLods(f), E = await import('../worlds/orbit/earth.js');
  // ---- weights of the phases
  const paintK = 1 - sstep(.05, .3, tau);
  const plateK = sstep(0, .08, tau) * (1 - sstep(.46, .58, tau));
  const S = s77Scale(tau), rot = mapRot(L.R) * (1 - sstep(.6, 1.2, tau));
  const mapK = sstep(.46, .56, tau) * (1 - sstep(S77P.globe[0] - .04, S77P.globe[0] + .05, tau));
  const gk = clamp((tau - S77P.globe[0]) / (S77P.globe[1] - S77P.globe[0])), globeK = sstep(S77P.globe[0] - .04, S77P.globe[0] + .05, tau);
  const bz = clamp((tau - S77P.bezel[0]) / (S77P.bezel[1] - S77P.bezel[0])), be = easeInOut(bz);
  const roomK = sstep(S77P.room[0], S77P.room[1], tau);
  const R = await import('./room.js'), HO = R.roomHandoff(W, H);
  const Rf = 410 * s, Ec = [W / 2, .44 * H];
  // ---- the world of light for this frame (into f.g, or a layer when it must shrink into the monitor)
  const target = bz > 0 ? f.layer(2) : null, fw = target ? { ...f, g: target.g } : f;
  const layers = [], plates = {};
  let V = null, occ = null;
  if (plateK > .01) Object.assign(plates, { src: P38_SRC_END, freeze: 5.0, trace: P38_TRACE, corona: false, plateU: { uBright: 1.3 * plateK }, cam: { pitch: -16 * easeIn(clamp(tau / .5)), zoom: 1 - .1 * clamp(tau / .5), pan: [0, 60 * s * clamp(tau / .5)] } });
  if (mapK > .01) { const w = lodW(S); for (const [k, key] of [['A', 'dive-A'], ['B', 'dive-B'], ['C', 'dive-C']]) if (w[k] > .01) layers.push({ mesh: staticMesh(f, key, () => L[k]), u: { ...mapU(S, rot, cx, cy), uBright: w[k] * mapK, uPulse: 0 } }); }
  // up through the low deck (mist streaks inward, a deck shrinking below) and the high deck over the switch
  const mist = sstep(.36, .46, tau) * (1 - sstep(.56, .7, tau));
  if (mist > .01) layers.push(dynLayer(D.mistStreaks(W, H, t, mist, -1), { uBright: 1 }));
  for (const [i, tp, g] of [[2, .55, 1.05], [1, 1.2, 1.0], [0, 1.33, 1.1]]) { const Ly = deckLayer(f, L, i, tau - tp, -1, g, .4 * i); if (Ly) layers.push(Ly); }
  let moon = null;
  if (globeK > .01) {
    await E.earthReady(1);
    const ge2 = easeInOut(gk), gz = 1 - Math.pow(1 - gk, 2.3), Rs = Math.exp(lerp(Math.log(globeRs(S77_SW)), Math.log(Rf), gz)), land = D.kmLL(...L.R.shift);
    V = E.earthView({ lon0: lerp(land[0], 22, ge2), lat0: lerp(land[1], 24, ge2), roll: 0, D: 40, Rs, cx: lerp(cx, Ec[0], ge2), cy: lerp(cy, Ec[1], ge2), sun: EARTH_SUN, umbra: { ...UMBRA, k: UMBRA.k * sstep(.04, .4, gk) } });
    // the Moon swings past (closer than the Earth: it occludes it), ending small on the Sun's side
    const mk = clamp((tau - S77P.moon[0]) / (S77P.moon[1] - S77P.moon[0]));
    if (mk > 0) {
      const me = easeOut(mk);
      moon = { x: lerp(-.2 * W, .17 * W, me), y: lerp(1.3 * H, .7 * H, me), r: Math.exp(lerp(Math.log(1.05 * H), Math.log(.24 * Rf), me)) };
      occ = moon;
    }
    layers.push(dynLayer(E.earthLines(V, { W, H, minStep: 2.6, occ }), { uBright: globeK }));
    // the shadow's rim: a thin signal-orange ring on the globe (the room's sim marks the umbra the same way)
    const uk = sstep(.12, .45, gk) * globeK;
    if (uk > .01) {
      const c = E.ll2v(...UMBRA.ll), ref = Math.abs(c[2]) < .9 ? [0, 0, 1] : [1, 0, 0];
      const t1 = (([a, b, cc]) => { const m = Math.hypot(a, b, cc); return [a / m, b / m, cc / m]; })([ref[1] * c[2] - ref[2] * c[1], ref[2] * c[0] - ref[0] * c[2], ref[0] * c[1] - ref[1] * c[0]]);
      const t2 = [c[1] * t1[2] - c[2] * t1[1], c[2] * t1[0] - c[0] * t1[2], c[0] * t1[1] - c[1] * t1[0]], ar = UMBRA.r * 1.12 * Math.PI / 180, pts = [];
      for (let k = 0; k <= 96; k++) {
        const a = k / 96 * TAU, p = [0, 1, 2].map(j => c[j] * Math.cos(ar) + (t1[j] * Math.cos(a) + t2[j] * Math.sin(a)) * Math.sin(ar)), q = E.project(V, p);
        if (q[2] > 1 / V.D + .01 && !(occ && Math.hypot(q[0] - occ.x, q[1] - occ.y) < occ.r)) pts.push([q[0], q[1]]); else if (pts.length) break;
      }
      if (pts.length > 2) layers.push(dynLayer([mkLine(pts, { b: .95 * uk, w: 1.3 * s + .2, o: 1, flags: FL.NOFADE, spd: .4 })]));
    }
    const stars = []; for (let i = 0; i < 160; i++) { const x = hash3(i, 77, 1) * W, y = hash3(i, 77, 2) * H; if (Math.hypot(x - V.cx, y - V.cy) < V.Rs * 1.05 || (moon && Math.hypot(x - moon.x, y - moon.y) < moon.r * 1.05)) continue; stars.push(dot(x, y, (.25 + 1.0 * Math.pow(hash3(i, 77, 3), 4)) * globeK, 1.4 + hash3(i, 77, 4), 0, FL.TIP | FL.SHARP)); }
    layers.push(dynLayer(stars));
    if (moon) {
      const { moonDisk } = await import('../worlds/orbit/moon.js');
      if (!_moonRef) _moonRef = moonDisk(0, 0, 400 * s, { sun: [-.85, -.35], sunZ: .15 });
      const k = moon.r / (400 * s);
      layers.push({ mesh: staticMesh(f, 'moon-disk', () => _moonRef), u: { ...affineU(k, 0, 0, k, moon.x, moon.y), uBright: .95, uPulse: 0 } });
      // the shadow cone from the Moon to the dot on the Earth (faint)
      const u = E.project(V, E.ll2v(...UMBRA.ll));
      if (u[2] > 1 / V.D) {
        const dx = u[0] - moon.x, dy = u[1] - moon.y, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
        const cone = [[[moon.x + nx * moon.r * .98, moon.y + ny * moon.r * .98], [u[0], u[1]]], [[moon.x - nx * moon.r * .98, moon.y - ny * moon.r * .98], [u[0], u[1]]]];
        layers.push(dynLayer(cone.map(pts => mkLine(pts, { b: .22 * mk, w: .8, o: .3, spd: 1.2 }))));
      }
    }
  }
  await drawLines(fw, { ...plates, layers, kick: 0, phase: audio.flowPhase(t) * .8, disk: false, palette: BLUE,
    look: { glow: [.24, .1], width: 1 + 1.6 * paintK, soft: .35 * paintK } });
  const seaA = (1 - sstep(7, 22, S)) * mapK;
  if (seaA > .01) await E.mapFill(fw, { cx, cy, S, rot, ll0: D.BEND, k: [111.32 * Math.cos(38.72 * Math.PI / 180), 110.9], shift: L.R.shift }, { alpha: seaA });
  if (V) await E.earthFill(fw, V, { occ, alpha: globeK });
  if (paintK > .002) { const pc = await goldOrPaint(f, 'S76', t, 5.0, 1.045), g = fw.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = paintK; g.drawImage(pc, 0, 0, W, H); g.restore(); }
  // ---- into the monitor: the image shrinks into the sim panel, the bezel enters around it
  if (target) {
    const kEnd = HO.earth.r / Rf, sc = Math.exp(lerp(0, Math.log(kEnd), be));
    const c = [lerp(Ec[0], HO.earth.x, be), lerp(Ec[1], HO.earth.y, be)];
    const Tu = [sc, 0, 0, sc, c[0] - sc * Ec[0], c[1] - sc * Ec[1]];                  // frame -> screen now
    const m = sc / kEnd, Mu = [m, 0, 0, m, c[0] - m * HO.earth.x, c[1] - m * HO.earth.y];   // final screen -> screen now
    const g = f.g;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#06070b'; g.fillRect(0, 0, W, H);
    // the side monitor (bezel), its screen, the sim panel clipped: everything placed by Mu
    g.setTransform(...Mu);
    const q = HO.bezel, poly = (pts, grow = 0) => { const mx = (pts[0][0] + pts[2][0]) / 2, my = (pts[0][1] + pts[2][1]) / 2; g.beginPath(); pts.forEach(([x, y], i) => { const X = x + Math.sign(x - mx) * grow, Y = y + Math.sign(y - my) * grow; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); };
    g.fillStyle = '#15171d'; poly(q, 9 * s); g.fill();
    g.strokeStyle = 'rgba(243,239,230,.18)'; g.lineWidth = 1.2 * s / m; poly(q, 9 * s); g.stroke();
    g.fillStyle = '#0b0c10'; poly(q); g.fill();
    g.save(); poly(HO.panel); g.clip();
    g.setTransform(...Tu); g.drawImage(target.c, 0, 0, W, H);
    g.restore();
    g.restore();
    // the last frames dissolve into her room (S78's first frame, drawn by room.js): the cut is invisible
    if (roomK > .002) {
      const RL = f.layer(3), i78 = Math.ceil(266.12 * FPS - 1e-6);
      await f.drawScene('S78', { t: i78 / FPS, i: i78, d: 0, lt: 0, k: 0 }, RL.g);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = roomK; g.drawImage(RL.c, 0, 0, W, H); g.restore();
    }
  }
  steer(f, { kick: 0 });
});

// ================================================================ S63: swords into starships
// The kick (215.287): S62's sword, spinning at its apex (video/data/sword_handoff.json: {x, y} frame fractions of the
// blade's centre, angle = the blade's direction hilt -> point in degrees clockwise from straight up, len = blade length
// as a fraction of the frame height, spin deg/s; until it exists: frame centre, 30 deg) match-cuts to the starship in
// lines at the same place and angle; it rights itself onto its pad by the next kick and rises on a column of light.
// P34 1:1 from the kick (lift-off at plate ~3.4 s lands on the downbeat 218.677). Fierce: every kick pumps the exhaust
// (length, brightness, Mach diamonds, a pulse running down the column) and the line thickness.
export const S63_T0 = 215.287, S63_T1 = 222.077;
// SHOTLIST's two-decimal times put S67 (232.27) and S72 (249.22) one master frame after their downbeats: cut on the beat
shotOverride('S67', { t0: 232.266 });
shotOverride('S72', { t0: 249.215 });
// rocket axis per 2 plate frames (source uv x 1000): [axis x, nose y, engine exit y] (production/review/drop2: measured)
const P34_AXIS = [497,146,876,497,146,876,497,146,876,497,146,876,497,146,876,497,146,876,497,146,874,497,146,874,498,144,874,498,144,874,498,144,872,497,144,872,497,144,870,497,143,868,497,141,868,497,141,867,496,139,865,496,137,863,496,137,861,496,135,859,496,133,857,496,133,856,496,133,854,497,132,852,497,132,848,497,130,846,497,128,843,497,126,839,497,122,835,497,122,830,497,120,826,498,118,822,498,118,820,498,117,815,498,115,811,498,113,806,498,111,800,498,107,794,498,106,787,499,100,778,499,98,770,499,96,767,499,93,757,499,91,752,499,91,748,499,91,739,499,91,737,499,91,732,499,91,726,499,93,722,499,96,718,500,100,715,500,104,711,500,107,706,501,111,702,501,115,694,501,118,691,501,122,685,501,128,680,502,132,676,502,137,670,502,141,663,502,146,656,502,148,648,503,152,641,503,156,630,504,156,620,504,156,609,504,156,598,505,156,585,506,157,576,507,159,565,507,165,557,509,170,550,509,176,543,510,180,533,511,182,524,512,187,515,512,189,507,514,189,494,515,189,485,515,189,474,516,189,463,516,187,452,516,187,446];
function p34Axis(tp) {
  const n = P34_AXIS.length / 3, x = clamp(tp * 12, 0, n - 1), i = Math.min(n - 2, Math.floor(x)), k = x - i, g = j => lerp(P34_AXIS[i * 3 + j], P34_AXIS[(i + 1) * 3 + j], k) / 1000;
  return { x: g(0), nose: g(1), eng: g(2) };
}
// the sword at the cut: video/data/sword_handoff.json if the GOLD agent writes one; else their S62 export (chorus2.js:
// S62.final {x, y}, swordAngle(t) screen radians hilt -> tip, length .17 x zoom 1.55 of H at the apex); else centre, 30 deg
let SWORD = null;
async function swordHandoff() {
  if (SWORD) return SWORD;
  let sw = { x: .5, y: .5, angle: 30, len: .32, spin: 0 };
  try {
    const m = await import('./chorus2.js');
    if (m.S62 && m.S62.final) {
      const a = m.swordAngle ? m.swordAngle(m.S62.end) : -Math.PI / 2, a2 = m.swordAngle ? m.swordAngle(m.S62.end - .05) : a;
      sw = { x: m.S62.final.x, y: m.S62.final.y, angle: (a + Math.PI / 2) * 180 / Math.PI, len: .17 * 1.55, spin: (a - a2) / .05 * 180 / Math.PI };
    }
  } catch (e) { /* no export */ }
  const { loadJSON } = await import('../assets.js');
  const j = await loadJSON('data/sword_handoff.json', { optional: true });
  if (j) {                       // the GOLD agent's schema: center {x, y}, angle_deg (screen: 0 = right, -90 = up), length_h
    if (j.center) { sw.x = j.center.x ?? sw.x; sw.y = j.center.y ?? sw.y; }
    if (j.angle_deg != null) sw.angle = j.angle_deg + 90;
    if (j.length_h != null) sw.len = j.length_h;
    sw.spin = j.spin_deg_s ?? 0;                                  // the sword comes to rest exactly on the cut
    for (const k of ['x', 'y', 'angle', 'len', 'spin']) if (typeof j[k] === 'number') sw[k] = j[k];
  }
  sw.angle = ((sw.angle + 180) % 360 + 360) % 360 - 180;           // 2 turns of spin are not 720 deg to unwind
  return (SWORD = sw);
}
const P34_TRACE = { contourW: [1.3, 2.6], contourB: 1.75, innerB: 1.05, innerHi: .13, innerLo: .055, lightDir: [-.6, -.8], dsepMin: 2.6, dsepMax: 8.5, bgSepMin: 14, bgSepMax: 28, bgGain: .32,
  subjBright: [.35, 1.1], rim: 1, sky: { maxDepth: .04, soft: .03, below: .95 }, horizon: 1, horizonBand: .02, minLen: 18 };
// the column of light under the engines (analysis px; s grows away from the engine so pulses run down the column)
function exhaustLines(ex, ey, bottom, s, kick, t, ignite) {
  const out = [], N = 30, L = Math.max(20, (bottom - ey) * (.55 + .45 * ignite) * (1 + .18 * kick)), w0 = 5.5 * s, spread = .16;
  for (let j = 0; j < N; j++) {
    const u = (j / (N - 1) - .5) * 2, core = 1 - u * u, pts = [];
    for (let k = 0; k <= 26; k++) {
      const d = L * Math.pow(k / 26, 1.15), wob = 1.2 * s * Math.sin(d / (9 * s) + j * 1.7 + t * 9) * (d / L);
      pts.push([ex + u * (w0 + d * spread) + wob, ey + d, (.35 + 1.15 * core) * (1 + .9 * kick) * (1 - sstep(.45, 1, d / L)) * (.5 + .5 * ignite)]);
    }
    out.push(mkLine(pts, { w: .8 + .7 * core + .6 * kick, o: pts.map((p, k) => lerp(.05, .75, k / 26)), spd: 2.6 + .8 * core, phase: j * .9 }));
  }
  for (let m = 0; m < 5; m++) {                         // Mach diamonds, pulsing on the kick
    const yc = ey + (7 + m * 13 * (1 + .1 * kick)) * s, r = (5.5 - m * .8) * s * (1 + .25 * kick), b = (1.6 - .25 * m) * (1 + 1.2 * kick) * ignite;
    out.push(mkLine([[ex, yc - r * 1.5], [ex + r * .7, yc], [ex, yc + r * 1.5], [ex - r * .7, yc], [ex, yc - r * 1.5]], { b, w: 1.1, o: .2, flags: FL.NOFADE }));
  }
  return out.filter(Boolean);
}
scene('S63', async f => {
  const W = f.W, H = f.H, s = H / 1080, t = f.t, tp = Math.max(0, t - S63_T0), sw = await swordHandoff();
  const kick = audio.kickEnv(t, .12), aw = Math.round(960 * Math.max(W, H) / 1920), ah = Math.round(aw / (W / H)), S = W / aw;
  const ax = p34Axis(tp), piv = [ax.x * aw, (ax.nose + ax.eng) / 2 * ah];
  // the match cut: at the sword's place and angle, upright by the second kick
  const k2 = snap(audio.kickTimes().find(k => k > S63_T0 + .1) || S63_T0 + .43), u = clamp((t - S63_T0) / (k2 - S63_T0)), e = easeInOut(u);
  const th0 = (sw.angle + (sw.spin || 0) * (t - S63_T0) * (1 - u)) * Math.PI / 180, th = th0 * (1 - e);
  // size match: the ship starts as long as the blade, then the camera pushes in to the pad framing
  const z0 = clamp(sw.len / Math.max(.2, ax.eng - ax.nose), .25, 1.2), zoom = Math.exp(lerp(Math.log(z0), 0, e));
  const off = [(sw.x * W - piv[0] * S) / S * (1 - e), (sw.y * H - piv[1] * S) / S * (1 - e)];
  const X = placeU(piv[0], piv[1], th, zoom, off[0], off[1]);
  const plateU = { uXf0: X.uXf0, uXf1: X.uXf1 };
  // the column of light: ignition builds over the first bar, every kick pumps it
  const ignite = .35 + .65 * sstep(0, 1.6, tp), bottom = Math.max(ax.eng * ah + 40 * s, tp < 3.3 ? .9 * ah : ah + 60);
  const exh = exhaustLines(piv[0], ax.eng * ah, bottom, aw / 960, kick, t, ignite);
  // on the pad, every kick throws a ring of light out across the ground from the base (perspective ellipses)
  if (tp < 4.2) for (const k of audio.kickTimes()) {
    const a = t - k; if (a < 0 || a > .7 || k < S63_T0 - 1e-3) continue;
    const r = (24 + 880 * easeOut(a / .7)) * aw / 960, b = 1.3 * Math.pow(1 - a / .7, 2) * ignite * (1 - sstep(3.4, 4.2, tp));
    if (b > .01) exh.push(proc.ellipse(piv[0], .887 * ah, r, r * .085, 0, { b, w: 1.4, o: .55, flags: FL.NOFADE }, 120));
  }
  const engS = [(X.uXf0[0] * piv[0] + X.uXf0[1] * ax.eng * ah + X.uXf0[2]) * S, (X.uXf1[0] * piv[0] + X.uXf1[1] * ax.eng * ah + X.uXf1[2]) * S];
  const flash = 0;                                      // (a linear-light flash greys the cut: the shape match carries it)
  // after lift-off the dusk deepens toward space: stars come out, drifting down as the camera tilts up after the ship
  const starK = sstep(3.3, 5.2, tp), stars = [];
  if (starK > .01) for (let i = 0; i < 120; i++) {
    const x = hash3(i, 63, 1) * W, y = ((hash3(i, 63, 2) * 1.4 + Math.max(0, tp - 3.3) * .045) % 1.4 - .2) * H;
    if (Math.abs(x - engS[0]) < 70 * s || y > .9 * H) continue;
    stars.push(dot(x, y, starK * (.25 + 1.0 * Math.pow(hash3(i, 63, 3), 4)), 1.4 + hash3(i, 63, 4), 0, FL.TIP | FL.SHARP));
  }
  await drawLines(f, {
    src: { plate: 'P34', standin: 'master' }, tp, chainFrom: 0, trace: P34_TRACE, corona: false, plateU,
    layers: [{ lines: exh, u: { uXf0: X.uXf0, uXf1: X.uXf1, uS: S, uOff: [0, 0], uT: audio.flowPhase(t) * 2.2, uPulse: .75, uKick: kick, uPush: [engS[0], engS[1], 10 * kick * s, 260 * s] } }, dynLayer(stars)],
    kick, kickWidth: 1.35, kickPush: 20, pushCenter: engS, phase: audio.flowPhase(t) * 1.15, flash, disk: false, look: { glow: [.25, .1] },
  });
  steer(f, { kick, field: { center: engS } });
});
