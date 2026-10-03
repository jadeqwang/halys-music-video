// chorus2.js: GOLD, S58-S62 (199.98-215.29 s): the final chorus. Owner: the marble/gold agent.
// BRONZE in returning golden-hour sunlight (STYLE_BIBLE GOLD): the brush engine's own relighting with the 'gold' box,
// pushed warm and high-key, the light pool the whole frame, glory clouds painted around the low golden sun (never
// lens-flare rays). The sun is the fat crescent of the egress (gold.js goldOff), bitten at its upper left.
//
// S58 the light sweeps back, the umbra races away, both armies roar (P29, roar 200.315) · S59 golden faces under the
// glory (P30) · S60 face to face, the breath (P31, 207.4-208.7) · S61 weapons into the red river, then one sword sinking
// through the held "blade" (P32; the plate's own cut lands on 210.18) · S62 on "Home" (211.44) a soldier swings, on the
// beat return (211.88) tosses his sword; it spins up into the gold and slows at the apex by 215.29, ending as a clean
// silhouette near the frame centre for the line engine's match cut to the starship (video/data/sword_handoff.json).

import { scene, shot, shotOverride } from '../registry.js';
import { paint, resolvePlate, hasPlate, plateTimeOf } from '../worlds/brush/index.js';
import { blurFast, hash3 } from '../worlds/brush/util.js';
import { GOLD_PAINT, goldLook, glorySky, goldSun, goldOff, paintGold } from '../worlds/marble/gold.js';
import { loadJSON } from '../assets.js';
import { plateMetaAt } from '../plates.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => k * k * (3 - 2 * k);
const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a)));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const kfl = (t, keys) => { if (t <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return va + (vb - va) * (t - a) / (b - a); } return keys[keys.length - 1][1]; };
const LOG = new URLSearchParams(location.search).has('mlog');

const T0 = { P29: 194.86, P30: 203.39, P31: 207.4, P32: 208.7, P33: 211.88 };
async function plate(f, id, cam, o = {}) {
  return resolvePlate(f, id, { id: o.standin || 'a_duel', cam }, cam, o.keys ? { keys: o.keys, ...(o.extra || {}) } : { at: o.at ?? T0[id], ...(o.extra || {}) });
}
// the visible source rect of a camera (camXform's convention: the source covers the frame) and source uv -> screen px
const camRect = (f, c, so = 16 / 9) => { const oo = f.W / f.H; let hU = 1 / c.zoom, wU = oo / so / c.zoom; if (wU > 1 / c.zoom) { wU = 1 / c.zoom; hU = so / oo / c.zoom; } return { wU, hU }; };
const camScreen = (f, c, so) => { const { wU, hU } = camRect(f, c, so); return (u, v) => [((u - c.cx) / wU + .5) * f.W, ((v - c.cy) / hU + .5) * f.H]; };

// paint in gold and hand the type its light
async function gold(f, src, o = {}) {
  const look = await paint(f, src, { ...GOLD_PAINT, ...o });
  if (LOG) console.log('gold', f.shot.id, JSON.stringify(look.perLayer), look.strokes, JSON.stringify(look.ms));
  const T = f.type || (f.type = {});
  T.light = T.light || { dir: o.typeDir || [-.55, -.83], elev: .55, color: '#fff0c8', intensity: 1.12 };
  if (look.sun && !T.sun) T.sun = { x: look.sun.px[0], y: look.sun.px[1], r: look.sun.px[2] };
  return look;
}
// the identity GOLD painter (gold.js paintGold: the SPARK's own grade, a glory sky, bloom) and the type's light
async function gold2(f, src, o = {}) {
  const look = await paintGold(f, src, o);
  if (LOG) console.log('gold2', f.shot.id, JSON.stringify(look.perLayer), look.strokes, JSON.stringify(look.ms));
  const T = f.type || (f.type = {});
  T.light = T.light || { dir: o.typeDir || [-.55, -.83], elev: .55, color: '#fff0c8', intensity: 1.12 };
  if (look.sun && !T.sun) T.sun = { x: look.sun.px[0], y: look.sun.px[1], r: look.sun.px[2] };
  return look;
}
// the plate's own sun (meta: brightest blob) through a camera, frame uv; null if none
async function plateSun(f, id, cam, keys) {
  if (!hasPlate(id)) return null;
  const tp = plateTimeOf(f.shot, f.t, keys ? { keys } : { at: T0[id] }), meta = await plateMetaAt(id, tp);
  if (!meta || !meta.sun || meta.sun[2] < .2) return null;
  const [x, y] = camScreen(f, cam)(meta.sun[0], meta.sun[1]); return [x / f.W, y / f.H];
}

// ================================================================ S58: the light sweeps back; both armies roar
// The remnant of the umbra lies over the near crowd and races off past the camera (the light returns from the WNW,
// far to near); the type's SHADOW TURNED TO DAY rises out of the same front (f.type.front.y).
const S58_KEYS = [[199.98, 5.49], [200.315, 5.85], [203.39, 8.95]];
scene('S58', async f => {
  const t = f.t, k = seg(t, 199.98, 203.39);
  const cam = { cx: .5, cy: .47, zoom: 1.04 + .03 * k };
  const src = await plate(f, 'P29', cam, { keys: S58_KEYS, standin: 'c_armies' });
  const fy = lerp(.58, 1.3, Math.pow(seg(t, 199.98, 201.6), .7));         // the front's screen row (0 top .. 1 bottom)
  // (the sun is off the frame, up to the right behind the crowd's heads, where S57 left it)
  await gold2(f, src, { sky: false, detail: .7, tag: 'S58',
    post: st => {                                                          // the umbra's remnant over the near crowd, a hot band riding its edge
      const { aw, ah } = st;
      for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
        const i = y * aw + x, wob = .025 * Math.sin(x / aw * 9 + t * 2) + .02 * Math.sin(x / aw * 23 - t * 3), e = y / ah + wob - fy;
        const q = sstep(-.06, .14, e), band = Math.exp(-Math.pow((e + .03) / .06, 2)) * (1 - sstep(201.2, 201.8, t));
        let r = st.R[i] * (1 - .62 * q), g = st.G[i] * (1 - .6 * q), b = st.B[i] * (1 - .48 * q);
        r = lerp(r, 1, band * .3); g = lerp(g, .88, band * .26); b = lerp(b, .6, band * .18);
        st.R[i] = r; st.G[i] = g; st.B[i] = b;
      }
      st.key += '|front' + fy.toFixed(3);
    } });
  f.type.front = { y: fy * f.H };
  f.type.light = { dir: [.7, -.7], elev: .5, color: '#fff0c8', intensity: 1.12 };
});

// ================================================================ S59: golden faces under the glory
// P30 1:1: the Lydian and the Mede laughing up into the light; the dark crowd behind them becomes Baroque glory: cream
// and gold cloud banks wound around the low sun's opening, lit rims (painted, never rays)
scene('S59', async f => {
  const k = seg(f.t, 203.39, 207.40), cam = { cx: .5, cy: .5, zoom: 1.03 + .02 * k };
  const src = await plate(f, 'P30', cam, { standin: 'b_face' });
  // the sun above the frame: its light pours down on the faces; the glory opens over them
  await gold2(f, src, { sky: { maxDepth: .21, soft: .06, below: .72 }, glory: { sun: [.5, -.12], open: .3, horizon: .8, halo: .8, seed: 9 },
    ref: { target: .56, local: 1.1, gamma: 1.08, sat: 1.22, warm: .05 }, bloom: { k: .3, thr: .7 }, detail: .8, tag: 'S59', typeDir: [-.15, -.99] });
  f.type.light = { dir: [-.15, -.99], elev: .62, color: '#fff3d2', intensity: 1.15 };
});

// ================================================================ S60: face to face, the breath (207.4-208.7)
scene('S60', async f => {
  const k = seg(f.t, 207.40, 208.70), cam = { cx: .5, cy: .5, zoom: 1.03 + .01 * k };
  const src = await plate(f, 'P31', cam, { standin: 'a_duel' });
  const sun = (await plateSun(f, 'P31', cam)) || [.95, .26];
  await gold2(f, src, { cam, sky: false, sun: { x: Math.min(.96, sun[0]), y: sun[1], r: .026 },
    groundFlow: { y0: .35, k: .7 }, detail: .8, tag: 'S60', ref: { warm: .04, sat: 1.12 }, bloom: { k: .42, thr: .6 }, paint: { drawIdx: 2500 + Math.round(f.t * 4) } });
});

// ================================================================ S61: weapons into the red river; one sword sinking
// The rain of bronze (P32 0-2.17, its 'blade' at 209.945) cut on 210.18 to the single sword going down, hilt last,
// through the held "blade" (an insert restarts the drawings exactly on the cut). The Kizilirmak runs red.
// (the insert runs the plate at about its own speed, slow: the tip about to touch the water on the cut, the pommel
// going under at the end)
const S61_KEYS = [[208.70, .42], [209.945, 1.6], [210.177, 2.155], [210.183, 2.48], [211.44, 3.86]];
shotOverride('S61', { t1: 210.18 });
shot({ id: 'S61b', t0: 210.18, t1: 211.44, world: 'gold', cadence: 12, scene: 'S61', parent: 'S61', params: { label: 'S61 the sinking sword (held "blade")' } });
scene('S61', async f => {
  const t = f.t, wide = t < 210.18, k = wide ? seg(t, 208.70, 210.18) : seg(t, 210.18, 211.44);
  // (the insert, landscape: the sword right of centre, its guard clear of the lyric block on the left; portrait centres
  // the lyric below, so the sword stays on the centre line)
  const land = f.W / f.H > 1.2, zi = land ? 1.4 + .02 * k : 1.1 + .04 * k;
  const cam = wide ? { cx: .5, cy: .5, zoom: 1.02 + .02 * k } : { cx: land ? .5 - .19 / zi : .5, cy: land ? .4 : .42, zoom: zi };
  const ff = { ...f, shot: { ...f.shot, t0: wide ? 208.70 : 210.18 } };
  const src = await plate(ff, 'P32', cam, { keys: S61_KEYS, standin: 'c_armies' });
  redRiver(src, wide ? .3 : 0);
  if (wide) {
    const sun = (await plateSun(ff, 'P32', cam, S61_KEYS)) || [.66, .28];
    await gold2(ff, src, { cam, sky: false, sun: { x: sun[0], y: sun[1], r: .02 },
      groundFlow: { y0: .36, k: .85 }, detail: .7, tag: 'S61w' });
  } else {
    await gold2(ff, src, { cam, sky: false, groundFlow: { y0: 0, k: .9 }, detail: .9, tag: 'S61i' });
  }
  f.type = ff.type || f.type;
});
// the Halys runs red with clay: water (low, flat, below the far bank) is pulled from ochre-brown toward a deep red ochre
function redRiver(src, y0) {
  const { aw, ah } = src, N = aw * ah;
  for (let y = Math.floor(y0 * ah); y < ah; y++) for (let x = 0; x < aw; x++) {
    const i = y * aw + x, r = src.R[i], g = src.G[i], b = src.B[i];
    const warm = r - b, flat = src.matte ? 1 - src.matte[i] : 1;
    if (warm < .05 || flat < .3) continue;
    const k = clamp((warm - .05) * 3) * flat * .55;
    src.R[i] = clamp(r * (1 + .08 * k)); src.G[i] = g * (1 - .28 * k); src.B[i] = b * (1 - .22 * k);
  }
}

// ================================================================ S62: the toss; the sword spins up and slows at the apex
// P33: the swing on "Home" (211.44), the release on the beat return (211.88), the apex on the Drop 2 kick (215.287). Once
// it leaves his hand the plate's sword is painted out and our own takes over at the plate's position (tracked from the
// plate's mattes: data/p33_sword.json): a bronze xiphos spinning in the picture plane, slowing to a stop point-up at the
// apex; the camera eases onto it, so the last drawing holds a clean silhouette at the frame centre.
export const S62 = { keys: [[211.44, .55], [211.88, 1.3], [215.287, 3.4]], release: 212.07, end: 215.29, theta0: -101.5 * Math.PI / 180, turns: 2, final: { x: .5, y: .47, len: .23 } };
let TRACK = null;
async function track() { if (!TRACK) TRACK = (await loadJSON('src/worlds/marble/data/p33_sword.json', { optional: true })) || []; return TRACK; }
const plateT62 = t => kfl(t, S62.keys);
// the plate sword's (smoothed) centre in plate uv at plate time tp
function swordAt(T, tp) {
  if (!T.length) return [.47, .17];
  const w = .35; let su = 0, sv = 0, sw = 0;
  for (const o of T) { const d = (o.tp - tp) / w, k = Math.exp(-d * d); su += o.u * k; sv += o.v * k; sw += k; }
  return sw > 1e-6 ? [su / sw, sv / sw] : [T[0].u, T[0].v];
}
// spin: from the release angle, decelerating to rest point-up at the apex after `turns` turns (clockwise)
export function swordAngle(t) {   // (rad, hilt -> tip, screen: 0 = right, -pi/2 = up)
  const tr = S62.release, T = S62.end;
  if (t <= tr) return S62.theta0;
  const s = clamp((t - tr) / (T - tr)), total = S62.turns * TAU + (-Math.PI / 2 - S62.theta0);
  return S62.theta0 + total * (1 - Math.pow(1 - s, 3));     // w = w0 (1 - s)^2: integral 1 - (1 - s)^3
}
// the camera: follows the tossed sword, easing it to the frame centre at the apex
function s62cam(f, t, su, sv) {
  const w = sstep(212.4, 214.9, t), z = lerp(1.0, 1.55, sstep(212.2, 215.2, t)), { wU, hU } = camRect(f, { zoom: z });
  // the frame centre that puts the sword at final.x/y
  const cx = lerp(.5, su - (S62.final.x - .5) * wU, w), cy = lerp(.5, sv - (S62.final.y - .5) * hU, w);
  return { cx, cy, zoom: z };
}
scene('S62', async f => {
  const t = f.t, T = await track(), tp = plateT62(t), [su, sv] = swordAt(T, tp);
  const cam = s62cam(f, t, su, sv);
  const src = await plate(f, 'P33', cam, { keys: S62.keys, standin: 'a_duel' });
  const own = t >= S62.release;
  if (own) paintOutSword(src);
  mirrorAbove(src, cam, camRect(f, cam).hU);
  const toS = camScreen(f, cam), [px, py] = toS(su, sv);
  // the sun low behind him at the river; the plate's camera tilts up after the release, so the horizon (and the sun on
  // it) sinks through its frame and out of the bottom (measured on the plate's frames)
  const hv = kfl(tp, [[0, .731], [.5, .735], [.75, .76], [1.0, .81], [1.12, .85], [1.25, .91], [1.38, .976], [1.5, 1.03], [1.9, 1.22], [2.3, 1.42], [3.4, 1.9]]);
  const [qx, qy] = toS(.85, hv - .016), hzS = toS(.5, hv)[1] / f.H;
  const sw = own ? swordGeom(f, t, px, py, cam.zoom) : null;
  await gold2(f, src, { cam, sky: { horizon: hzS - .004 }, glory: { sun: [.85, .715], horizon: .731, shift: [0, hv - .731], open: .24, seed: 12, warm: .65, halo: 1.3,
      dark: .3 + .4 * sstep(212.2, 213.6, t), open2: own ? { u: su, v: sv - (hv - .731), r: .34, k: sstep(212.6, 214.8, t) } : null },
    ...(qy < f.H * 1.05 ? { sun: { x: qx / f.W, y: qy / f.H, r: .026 * cam.zoom } } : {}), detail: .7, tag: 'S62',
    post: own ? st => skyGlow(st, toS, f, t, su, sv) : null,
    overStrokes: sw ? () => swordStrokes(sw, f.H / 1080) : null });
  if (sw) f.handoffSword = sw;
});
// the gold the sword rises into: the clouds around it brighten toward the apex (a soft warm opening behind it)
function skyGlow(src, toS, f, t, su, sv) {
  const { aw, ah } = src, k = sstep(213.0, 215.0, t); if (k <= 0) return;
  const [qx, qy] = toS(su, sv), cx = qx / f.W * aw, cy = qy / f.H * ah, R = .55 * ah;
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const i = y * aw + x; if (src.matte && src.matte[i] > .3) continue;
    const d = Math.hypot((x - cx) / R, (y - cy) / (R * .8)), g = k * Math.exp(-d * d * 1.6) * .35;
    src.R[i] = src.R[i] + (1.0 - src.R[i]) * g; src.G[i] = src.G[i] + (.86 - src.G[i]) * g; src.B[i] = src.B[i] + (.6 - src.B[i]) * g;
  }
  src.key += '|glow' + k.toFixed(3);
}
// when the camera rises past the plate's top edge, the sky there is the plate's own sky mirrored about that edge
function mirrorAbove(src, cam, hU) {
  const { aw, ah } = src, ye = ((0 - cam.cy) / hU + .5) * ah;
  if (ye <= 0) return;
  const y0 = Math.ceil(ye);
  for (let y = 0; y < Math.min(ah, y0); y++) {
    const ym = Math.min(ah - 1, Math.round(2 * ye - y));
    for (let x = 0; x < aw; x++) { const i = y * aw + x, j = ym * aw + x; src.R[i] = src.R[j]; src.G[i] = src.G[j]; src.B[i] = src.B[j]; if (src.depth) src.depth[i] = src.depth[j]; if (src.matte) src.matte[i] = 0; }
  }
  src.key += '|mirror';
}
// the plate's own sword, once airborne, is removed from the source: every matte component that does not touch the
// bottom edge (the thrower stands on it) is filled from its surroundings
function paintOutSword(src) {
  const { aw, ah } = src, N = aw * ah, M = src.matte; if (!M) return;
  const lab = new Int32Array(N).fill(-1), keep = new Uint8Array(N);
  let id = 0;
  for (let s = 0; s < N; s++) {
    if (lab[s] >= 0 || M[s] < .25) continue;
    const st = [s], pix = []; lab[s] = id; let bottom = false;
    while (st.length) { const i = st.pop(); pix.push(i); const x = i % aw, y = (i / aw) | 0; if (y >= ah - 3) bottom = true;
      for (const j of [i - 1, i + 1, i - aw, i + aw]) { if (j < 0 || j >= N || lab[j] >= 0 || M[j] < .25) continue; if ((j === i - 1 && x === 0) || (j === i + 1 && x === aw - 1)) continue; lab[j] = id; st.push(j); } }
    if (!bottom && pix.length < N * .08) for (const i of pix) keep[i] = 1;      // (portrait frames hold fewer pixels: a generous bound)
    id++;
  }
  // dilate the sword mask a little, then fill it by normalised convolution of the rest
  const mk = new Float32Array(N); for (let i = 0; i < N; i++) mk[i] = keep[i];
  const md = blurFast(mk, aw, ah, 2.5);
  const W = new Float32Array(N); for (let i = 0; i < N; i++) W[i] = md[i] > .02 ? 0 : 1;
  for (const ch of [src.R, src.G, src.B]) {
    const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = ch[i] * W[i];
    const num = blurFast(a, aw, ah, 6), den = blurFast(W, aw, ah, 6);
    for (let i = 0; i < N; i++) if (W[i] === 0) ch[i] = den[i] > 1e-3 ? num[i] / den[i] : ch[i];
  }
  if (src.matte) for (let i = 0; i < N; i++) if (W[i] === 0) src.matte[i] = 0;
  src.key += '|noSword';
}
// the sword's screen geometry at t: centre (px), angle (rad, hilt -> tip, screen), length (px)
function swordGeom(f, t, px, py, zoom) {
  const s = sstep(S62.release, S62.end, t), len = lerp(.2, .17, s) * zoom * f.H;
  return { x: px, y: py, ang: swordAngle(t), len, t };
}
// a bronze xiphos as painted strokes: leaf blade (dark bronze, a gold edge catching the low sun, a ridge), guard,
// wrapped grip, pommel. Backlit by the gold sky: mostly dark, its sunward edge burning.
function swordStrokes(sw, u) {
  const out = [], { x, y, ang, len } = sw, dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const P = (a, b) => [x + dx * a * len + nx * b * len, y + dy * a * len + ny * b * len];   // a along (hilt -.5 .. tip +.5), b across
  const bronze = [.33, .22, .12], dark = [.16, .1, .06], edge = [.95, .78, .42], hot = [1, .93, .7], grip = [.12, .08, .05];
  const add = (pts, r, c0, c1, thick, a, key, taper = .3) => out.push({ pts, r: Math.max(.8, r), c0, c1, a, thick, seed: hash3(out.length, 7, 62), key: 40 + key, layer: 13, taper, maxSeg: 10 });
  // blade: from the guard (-.2) to the tip (.5), leaf-shaped (wider at 2/3)
  add([P(-.2, 0), P(.12, 0), P(.36, 0), P(.5, 0)], len * .05, dark, bronze, .5, .99, .1, .92);
  add([P(-.18, -.018), P(.15, -.024), P(.38, -.015), P(.49, 0)], len * .015, edge, hot, .9, .95, .2, .9);          // the sunward edge
  add([P(-.18, .004), P(.4, .002)], len * .006, [.5, .36, .2], [.6, .45, .25], .6, .8, .3, .8);                    // the ridge
  // guard, grip, pommel
  add([P(-.21, -.075), P(-.21, .075)], len * .022, bronze, dark, .6, .99, .4, .1);
  add([P(-.215, -.07), P(-.215, .0)], len * .008, edge, edge, .9, .9, .45, .2);
  add([P(-.23, 0), P(-.4, 0)], len * .026, grip, dark, .45, .99, .5, .1);
  add([P(-.42, -.012), P(-.42, .012)], len * .036, bronze, dark, .7, .99, .6, 0);
  add([P(-.425, -.02), P(-.43, -.005)], len * .012, edge, hot, 1, .9, .65, 0);
  return out;
}
