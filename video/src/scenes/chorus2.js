// chorus2.js: GOLD, S58-S62 (199.98-215.29 s): the final chorus. Owner: the GOLD agent (v2: REVISION_V2 decision 5).
// BRONZE in returning golden-hour sunlight (STYLE_BIBLE GOLD): the brush engine's own relighting with the 'gold' box,
// pushed warm and high-key, the light pool the whole frame, glory clouds painted around the low golden sun (never
// lens-flare rays). The sun is the fat crescent of the egress (gold.js goldOff), bitten at its upper left.
//
// S58 the light sweeps back, the umbra races away, both armies roar (P29, roar 200.315) · S59 golden faces under the
// glory (P30) · S60 face to face, the breath (P31, 207.4-208.7) · v2, "bronze was precious: nobody throws it away":
// S61 the lines caught mid-fight, shocked, let go: swords and spears fall onto the bank and into the shallows, landing
// on "blade" (P51) · S61b one hand opens and its sword slides into the red shallows over the held "blade" (P52) · S62 on
// "Home" (211.44) a dropped sword stands upright in the mud while its owner walks home (P53); the camera eases in until
// the blade is the vertical where S63's starship stands on its pad (the match cut at 215.29: video/data/sword_handoff.json).

import { scene, shot, shotOverride } from '../registry.js';
import { paint, resolvePlate, hasPlate, plateTimeOf } from '../worlds/brush/index.js';
import { GOLD_PAINT, goldLook, glorySky, goldSun, goldOff, paintGold, plateSky } from '../worlds/marble/gold.js';
import { plateMetaAt } from '../plates.js';

const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => k * k * (3 - 2 * k);
const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a)));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const LOG = new URLSearchParams(location.search).has('mlog');

const T0 = { P29: 194.86, P30: 203.39, P31: 207.4, P51: 208.7, P52: 210.18, P53: 211.44 };
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

// ================================================================ S61: caught mid-fight, they let go (v2)
// REVISION_V2 decision 5: bronze was precious, nobody throws it away. P51 (take 1): the two lines fighting at the water's
// edge, a Lydian and a Mede locked in the centre. "Throw" (208.70) catches them mid-swing; on "down" they stop dead,
// shocked (the plate's motion falls away at ~1.4 s); on "your" the hands open (plate ~2.3) and the swords and spears
// fall, into the shallows and onto the bank, landing on "blade" (209.945 = plate ~2.65). The Kizilirmak runs red.
const S61_KEYS = [[208.70, .55], [209.10, 1.38], [209.55, 2.28], [209.945, 2.66], [210.18, 2.95]];
shotOverride('S61', { t1: 210.18 });
scene('S61', async f => {
  const k = seg(f.t, 208.70, 210.18), cam = { cx: .5, cy: .5, zoom: 1.02 + .02 * k };
  const src = await plate(f, 'P51', cam, { keys: S61_KEYS, standin: 'c_armies' });
  redRiver(src, .45, .85, .6);
  // (the sun is just beyond the right edge, behind the far bank: its glow, not its disk, is in the frame)
  // (no painted catchlights: MediaPipe reads the Mede's wicker shield, boss for a nose, as a face and the eye strokes
  // drew eyelids on it; the faces here are small)
  await gold2(f, src, { cam, sky: false, groundFlow: { y0: .62, k: .8 }, detail: .8, tag: 'S61', typeDir: [.6, -.8], paint: { eyeStrokes: 0 } });
});

// ================================================================ S61b: one hand lets go over the held "blade" (v2)
// P52 (take 2): the Lydian's hand holds his sword point-down in the red shallows, backlit. Through the held "blade" (the
// low end is out from 210.177) the fingers open (plate ~2.9) and the sword slides down into the water; its guard meets
// the surface in a splash just before "Home" (plate 3.92 = 211.30). The type's BLADE sinks with it.
// (landscape: the sword right of centre, clear of the lyric block on the left; portrait: on the centre line)
const S61B_KEYS = [[210.18, 2.5], [210.42, 2.88], [211.30, 3.92], [211.44, 4.04]];
shot({ id: 'S61b', t0: 210.18, t1: 211.44, world: 'gold', cadence: 12, scene: 'S61b', parent: 'S61', params: { label: 'S61b one hand lets go (held "blade")' } });
scene('S61b', async f => {
  const k = seg(f.t, 210.18, 211.44), land = f.W / f.H > 1.2, z = land ? 1.32 + .02 * k : 1.1 + .03 * k;
  const so = .503;                                                    // the sword's axis in plate uv
  const cam = land ? { cx: so - .16 / z, cy: .47 + .04 * k, zoom: z } : { cx: so, cy: .48 + .04 * k, zoom: z };
  const src = await plate(f, 'P52', cam, { keys: S61B_KEYS, standin: 'c_armies' });
  redRiver(src, .3);
  await gold2(f, src, { cam, sky: false, groundFlow: { y0: .35, k: .85 }, detail: .9, tag: 'S61b', typeDir: [.6, -.8] });
});
// the Halys runs red with clay: water (low, flat, below the far bank) is pulled from ochre-brown toward a deep red ochre;
// `deep` also takes the glare off sunlit water (pale, warm-white) so it still reads as the red river
function redRiver(src, y0, amt = .55, deep = 0) {
  const { aw, ah } = src;
  for (let y = Math.floor(y0 * ah); y < ah; y++) for (let x = 0; x < aw; x++) {
    const i = y * aw + x, r = src.R[i], g = src.G[i], b = src.B[i];
    const warm = r - b, flat = src.matte ? 1 - src.matte[i] : 1;
    if (warm < .05 || flat < .3) continue;
    const k = clamp((warm - .05) * 3) * flat * amt, d = deep * flat * clamp((r - .55) * 2.5);
    src.R[i] = clamp(r * (1 + .08 * k) * (1 - .12 * d)); src.G[i] = g * (1 - .28 * k) * (1 - .3 * d); src.B[i] = b * (1 - .22 * k) * (1 - .38 * d);
  }
}

// ================================================================ S62: the sword stays; its owner walks home (v2)
// P53 (take 2): his sword stands upright, point down in the shallows at the water's edge. On "Home" (211.44) its owner
// turns and walks away up the bank toward the low sun, never looking back; other men leave empty-handed along the
// horizon. The camera eases in until the upright blade is the vertical where S63's starship stands on its pad: frame
// centre, pommel .105 H, waterline .917 H (video/data/sword_handoff.json; S63 starts the ship exactly there and settles it
// onto its pad by the next kick). In portrait the owner walks out of frame and the sword stands alone for the cut.
export const S62 = {
  keys: [[211.44, .1], [215.29, 3.95]], end: 215.29,
  sword: { u: .533, top: .110, bottom: .865 },          // measured on P53 take 2 (plate uv): pommel top, blade at the water
  final: { x: .5, y: .511, len: .812 },                 // its frame position at the cut (x, y frame fractions, len of H)
};
export const swordAngle = () => -Math.PI / 2;           // (the blade stands vertical, hilt up, for the whole shot)
function s62cam(f, t) {
  const portrait = f.W / f.H < 1.2, { sword: sw, final: fi } = S62;
  const zE = fi.len / (sw.bottom - sw.top), { wU, hU } = camRect(f, { zoom: zE });   // (hU = 1 / zoom in every aspect)
  const end = { cx: sw.u - (fi.x - .5) * wU, cy: (sw.top + sw.bottom) / 2 - (fi.y - .5) * hU, zoom: zE };
  const start = portrait ? { cx: .55, cy: .5, zoom: 1 } : { cx: .5, cy: .5, zoom: 1 };
  const s = sstep(211.6, 214.85, t);
  return { cx: lerp(start.cx, end.cx, s), cy: lerp(start.cy, end.cy, s), zoom: lerp(start.zoom, end.zoom, s) };
}
scene('S62', async f => {
  const cam = s62cam(f, f.t);
  const src = await plate(f, 'P53', cam, { keys: S62.keys, standin: 'a_duel' });
  redRiver(src, .62);
  // (the sun is beyond the right edge, low over the bank he walks toward: no disk, its light on the clouds). The plate's own
  // sky is kept and made a stroke region above the far bank's crest (plate v .445); the strokes are kept a little shorter
  // than GOLD's (maxLen), because the long ones dragged cream sky-coloured scraps into the thin dark band of the far bank
  // under the walking figures
  const hz = camScreen(f, cam)(.5, .445)[1] / f.H;
  await gold2(f, src, { cam, sky: false, groundFlow: { y0: .72, k: .7 }, detail: .85, tag: 'S62', typeDir: [.75, -.66],
    post: st => { st.sky = plateSky(src, { horizon: hz }); st.key += '|hz' + hz.toFixed(3); }, paint: { maxLen: [3, 4, 4, 4, 3] } });
});
