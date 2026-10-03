// main.js: the lab entry. Loads a plate (stand-in still or a video frame) with its offline depth/matte/faces, runs the ONE
// shared analysis, and hands it to a material. Exposes window.renderStill / window.renderFrame for render.mjs.
//
// A frame is a pure function of (plate, camera, material, params, t): nothing carries over between calls except caches
// whose contents never depend on call order (decoded plates, analyses keyed by plate+camera+resolution, GPU programs).

import { W, H, loadImage, loadJSON, imageData, makeCanvas } from './core.js';
import { analyze, decodeDepth, decodeGrey } from './analysis.js';
import { GL } from './gl.js';
import { SHOTS } from './shots.js';
import * as bronze from './bronze.js';
import * as corona from './corona.js';
import * as marble from './marble.js';
import * as ink from './ink.js';

const ROOT = new URL('../../../', import.meta.url).href;         // repo root (src/ -> lab/ -> video/ -> root)
const MATERIALS = { bronze, corona, marble, ink };
let glw = null;
const plates = new Map(), analyses = new Map();

export async function loadPlate(id, o = {}) {
  const key = id + '|' + (o.src || '');
  if (plates.has(key)) return plates.get(key);
  const src = o.src || `media/lookdev/inputs/${id}.jpg`, an = o.analysis ?? `media/lookdev/analysis/${id}`;
  const img = await loadImage(ROOT + src);
  let depth = null, matte = null;
  try { depth = decodeDepth(await loadImage(`${ROOT}${an}/depth.png`)); } catch (e) { }
  try { matte = decodeGrey(await loadImage(`${ROOT}${an}/matte.png`)); } catch (e) { }
  const faces = await loadJSON(`${ROOT}${an}/faces.json`, []);
  const P = { id, img, depth, matte, faces, w: img.width, h: img.height };
  plates.set(key, P);
  return P;
}

// crop a {w,h,data} field to the camera window and resample to aw x ah (bilinear)
function cropField(f, win, aw, ah) {
  if (!f) return null;
  const out = new Float32Array(aw * ah), sx = f.w / 1, sy = f.h / 1;
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const u = win[0] + (x + .5) / aw * win[2], v = win[1] + (y + .5) / ah * win[3];
    let fx = u * sx - .5, fy = v * sy - .5;
    fx = Math.max(0, Math.min(f.w - 1.001, fx)); fy = Math.max(0, Math.min(f.h - 1.001, fy));
    const xi = fx | 0, yi = fy | 0, ax = fx - xi, ay = fy - yi, i = yi * f.w + xi;
    out[y * aw + x] = (f.data[i] * (1 - ax) + f.data[i + 1] * ax) * (1 - ay) + (f.data[i + f.w] * (1 - ax) + f.data[i + f.w + 1] * ax) * ay;
  }
  return { w: aw, h: ah, data: out };
}

// camera = crop window in uv {cx, cy, zoom} (zoom 1 = full frame). Faces are mapped into the window.
export function getAnalysis(P, cam = null, aw = 960, opt = {}) {
  const ah = Math.round(aw * H / W);
  const zoom = cam?.zoom ?? 1, cx = cam?.cx ?? .5, cy = cam?.cy ?? .5;
  const win = [cx - .5 / zoom, cy - .5 / zoom, 1 / zoom, 1 / zoom];
  const key = [P.id, P.img.src, aw, win.map(v => v.toFixed(5)).join(','), JSON.stringify(opt)].join('|');
  if (analyses.has(key)) return analyses.get(key);
  const t0 = performance.now();
  const id = imageData(P.img, aw, ah, [win[0] * P.w, win[1] * P.h, win[2] * P.w, win[3] * P.h]);
  const faces = (P.faces || []).map(f => ({
    ...f, box: [(f.box[0] - win[0]) / win[2], (f.box[1] - win[1]) / win[3], (f.box[2] - win[0]) / win[2], (f.box[3] - win[1]) / win[3]],
    eyes: f.eyes.map(e => [(e[0] - win[0]) / win[2], (e[1] - win[1]) / win[3]])
  }));
  const F = analyze(id, { depth: cropField(P.depth, win, aw, ah), matte: cropField(P.matte, win, aw, ah), faces }, opt);
  F.ms = performance.now() - t0;
  F.win = win; F.plate = P.id;
  if (analyses.size > 6) analyses.delete(analyses.keys().next().value);
  analyses.set(key, F);
  return F;
}

export function config(material, plate, params = {}) {
  const M = MATERIALS[material];
  const shot = (SHOTS[plate] && SHOTS[plate][material]) || {};
  return { ...M.DEFAULTS, ...shot, ...params };
}

async function renderAny(spec) {
  glw ??= new GL(W, H);
  const M = MATERIALS[spec.material];
  if (!M) throw new Error('unknown material ' + spec.material);
  const P = await loadPlate(spec.plate, { src: spec.src, analysis: spec.analysisDir });
  const cfg = config(spec.material, spec.shot || spec.plate, spec.params);
  const t = spec.t ?? 0;
  const F = getAnalysis(P, spec.cam, cfg.aw ?? 960, cfg.analysis || {});
  const t0 = performance.now();
  // under a synthetic camera, stroke layouts are anchored to the plate (layout space = full-frame analysis px)
  const anchor = spec.anchor ? { ox: F.win[0] * F.aw, oy: F.win[1] * F.ah, s: F.win[2] } : null;
  const stats = await M.render(glw, F, cfg, { t, plate: P, cam: spec.cam, anchor, frame: spec.frame ?? 0, temporal: spec.temporal || null }) || {};
  glw.finish();
  const tr = performance.now() - t0;
  const url = glw.canvas.toDataURL(spec.format || 'image/jpeg', spec.quality ?? .9);
  return { url, ms: { analysis: Math.round(F.ms), render: Math.round(tr), ...(stats.ms || {}) }, stats: { ...stats, ms: undefined } };
}

// ---------------------------------------------------------------- test clips
const ease = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const kickEnv = (t, ks, tau = .22) => ks.reduce((m, k) => t >= k ? Math.max(m, Math.exp(-(t - k) / tau)) : m, 0);
export const CLIPS = {
  // BRONZE drawn on twos: 12 drawings a second, each a full repaint of a slowly pushing-in plate; seeds anchored to the
  // plate so strokes boil (re-jitter by `boil`) instead of swimming or strobing
  bronze_boil: { plate: 'a_duel', material: 'bronze', fps: 24, frames: 48, hold: 2,
    spec: t => ({ cam: { cx: .5, cy: .48, zoom: 1 + .045 * ease(t / 2) }, anchor: true }) },
  // CORONA on ones: phase flow along the lines, a kick on each beat (120 bpm here), a ±11° orbit around the duel; the kick
  // also thickens lines and pushes everything outward from the sun; the third kick is a brass stab (2 inverted frames)
  corona_flow: { plate: 'a_duel', material: 'corona', fps: 24, frames: 48, hold: 1,
    spec: t => ({ params: { yaw: -11 + 22 * ease(t / 2), pitch: 2.5 * Math.sin(t * Math.PI / 2), kick: kickEnv(t, [.25, .75, 1.25, 1.75]), invert: t >= 1.25 - 1e-6 && t < 1.25 + 2 / 24 - 1e-6 ? 1 : 0, overscan: 1.07 } }) },
  // CORONA on a real video plate (Seedance test clip, 48 frames): temporal coherence via flow-advected seeds
  corona_seedance: { material: 'corona', fps: 24, frames: 48, hold: 1, video: 'seedance', temporal: true,
    spec: t => ({ params: { kick: kickEnv(t, [.5, 1, 1.5]) * .7 } }) },
  corona_seedance_naive: { material: 'corona', fps: 24, frames: 48, hold: 1, video: 'seedance', temporal: false,
    spec: t => ({ params: { kick: kickEnv(t, [.5, 1, 1.5]) * .7 } }) },
};
// per-frame plate of a video clip (frames, analysis and flow written by analysis/seedance_prep.py)
function videoFrame(c, name, i) {
  const n = String(i + 1).padStart(3, '0'), id = c.video;
  return { plate: `${id}_f${n}`, shot: id, src: `media/lookdev/inputs/${id}/f${n}.jpg`, analysisDir: `media/lookdev/analysis/${id}/f${n}`,
    temporal: c.temporal ? { key: name, frame: i, flowUrl: i > 0 ? `${ROOT}media/lookdev/analysis/${id}/flow_${n}.bin` : null, flowSize: [480, 270] } : null };
}
window.clipInfo = name => { const c = CLIPS[name]; return { fps: c.fps, frames: c.frames, hold: c.hold }; };
window.clipDrawKey = (name, i) => Math.floor(i / CLIPS[name].hold);
window.renderClipFrame = (name, i, q = .9, over = {}) => {
  const c = CLIPS[name], tDraw = Math.floor(i / c.hold) * c.hold / c.fps;
  const base = c.video ? videoFrame(c, name, Math.floor(i / c.hold) * c.hold) : { plate: c.plate };
  const sp = c.spec(tDraw);
  return renderAny({ ...base, material: c.material, t: tDraw, quality: q, ...sp, params: { ...(sp.params || {}), ...over } });
};

window.renderStill = spec => renderAny(spec);
window.renderFrame = spec => renderAny(spec);
window.labConfig = (m, p, params) => config(m, p, params);
window.ready = true;
