// plates.js: read access to the Seedance reference plates and their analysis (tools/pipeline.sh output).
// Plates are only ever READ: scenes turn them into paint, light and stone. The footage never appears.
//
// On disk (video/plates/, written by tools/extract_plates.py and friends):
//   index.json                     {id: {n, fps, w, h, take, mattes, depth, fields, gain, ...}}
//   <id>/frames/f0001.jpg ...      frames at the plate's fps (24), 960x540 by default
//   <id>/maps/g%04d.png            R ink (DoG lines), G tone, B edge strength            (every frame, 480x270)
//   <id>/maps/o%04d.png            R,G = 128+127(cos2θ, sin2θ) edge tangent, B coherence (every frame)
//   <id>/maps/v%04d.png            R,G = 128+4(dx,dy) optical flow f->f+1, B |flow|     (every frame)
//   <id>/maps/d%04d.png            depth, 255 = near                                    (odd frames: step 2)
//   <id>/masks/m%04d.png           subject matte, 255 = subject                         (odd frames: step 2)
//   <id>/meta.json                 per-frame lum/rgb/sun/faces (face landmarks as line work)
//   <id>/fields.json               map size, encodings, palette, exposure gain, depth range
//
// Plate time: a shot that reads a plate declares plate: {id, at = shot.t0, speed = 1, offset = 0, loop = false};
// plate time tp = (t - at) * speed + offset seconds. plateTime(shot, t) does that mapping; pass {loop: true} to
// the frame/map getters to wrap instead of holding the last frame.

import { loadJSON, loadImage, pixels } from './assets.js';
import { clamp } from './core.js';

export let PLATES = {};
export async function loadPlateIndex() {
  PLATES = (await loadJSON('plates/index.json', { optional: true })) || {};
  return PLATES;
}
export const plateInfo = id => { const P = PLATES[id]; if (!P) throw new Error(`no plate "${id}" in plates/index.json (run tools/pipeline.sh)`); return P; };
export const plateDur = id => { const P = PLATES[id]; return P ? P.n / P.fps : 0; };

export function plateTime(shot, t) {
  const p = shot.plate; if (!p) return 0;
  return (t - (p.at ?? shot.t0)) * (p.speed ?? 1) + (p.offset ?? 0);
}
// plate time -> 1-based frame index, clamped (or looped with loop=true)
export function plateFrameIndex(id, tp, { loop = false } = {}) {
  const P = plateInfo(id);
  let f = Math.round(tp * P.fps);
  if (loop) f = ((f % P.n) + P.n) % P.n;
  return clamp(f + 1, 1, P.n);
}
const pad4 = n => String(n).padStart(4, '0');
function stepped(f, step, n) { // nearest frame that exists for maps computed on every `step`-th frame (1, 1+step, ...)
  if (step <= 1) return f;
  const last = 1 + Math.floor((n - 1) / step) * step;
  return Math.min(last, 1 + Math.round((f - 1) / step) * step);
}

export function plateFrame(id, tp, opts) { return loadImage(`plates/${id}/frames/f${pad4(plateFrameIndex(id, tp, opts))}.jpg`); }

// kind: 'g' | 'o' | 'v' | 'd' (depth) | 'm' (matte). Returns an ImageBitmap, or null if that map was not computed.
export async function plateMap(id, kind, tp, opts) {
  const P = plateInfo(id);
  let f = plateFrameIndex(id, tp, opts);
  if (kind === 'd' || kind === 'm') {
    if (!(kind === 'd' ? P.depth : P.mattes)) return null;
    f = stepped(f, 2, P.n);
  } else if (!P.fields) return null;
  const url = kind === 'm' ? `plates/${id}/masks/m${pad4(f)}.png` : `plates/${id}/maps/${kind}${pad4(f)}.png`;
  return loadImage(url, { optional: true });
}

export const plateMeta = id => loadJSON(`plates/${id}/meta.json`, { optional: true });
export const plateFields = id => loadJSON(`plates/${id}/fields.json`, { optional: true });
export async function plateMetaAt(id, tp, opts) {
  const m = await plateMeta(id); if (!m) return null;
  return m[plateFrameIndex(id, tp, opts) - 1] || null;
}

// Numeric fields at plate time tp, at the maps' native size (480x270) unless (w, h) is given:
//   {w, h, ink, tone, edge, theta, coh, fx, fy, depth|null, matte|null}  (Float32Arrays, 0..1; theta in rad;
//   fx, fy flow in map px per plate frame)
export async function plateFieldsAt(id, tp, w, h, opts) {
  const F = await plateFields(id);
  w = w || (F && F.w) || 480; h = h || (F && F.h) || 270;
  const f = plateFrameIndex(id, tp, opts);
  const [g, o, v, d, m] = await Promise.all(['g', 'o', 'v', 'd', 'm'].map(k => plateMap(id, k, tp, opts)));
  const N = w * h, out = { id, frame: f, w, h, ink: new Float32Array(N), tone: new Float32Array(N), edge: new Float32Array(N),
    theta: new Float32Array(N), coh: new Float32Array(N), fx: new Float32Array(N), fy: new Float32Array(N), depth: null, matte: null };
  const key = k => `${id}:${k}:${f}`;
  if (g) { const p = pixels(g, w, h, key('g')); for (let i = 0; i < N; i++) { out.ink[i] = p[i * 4] / 255; out.tone[i] = p[i * 4 + 1] / 255; out.edge[i] = p[i * 4 + 2] / 255; } }
  if (o) { const p = pixels(o, w, h, key('o')); for (let i = 0; i < N; i++) { out.theta[i] = Math.atan2(p[i * 4 + 1] - 128, p[i * 4] - 128) / 2; out.coh[i] = p[i * 4 + 2] / 255; } }
  if (v) { const p = pixels(v, w, h, key('v')), s = w / ((F && F.w) || w); for (let i = 0; i < N; i++) { out.fx[i] = (p[i * 4] - 128) / 4 * s; out.fy[i] = (p[i * 4 + 1] - 128) / 4 * s; } }
  if (d) { const p = pixels(d, w, h, key('d')); out.depth = new Float32Array(N); for (let i = 0; i < N; i++) out.depth[i] = p[i * 4] / 255; }
  if (m) { const p = pixels(m, w, h, key('m')); out.matte = new Float32Array(N); for (let i = 0; i < N; i++) out.matte[i] = p[i * 4] / 255; }
  return out;
}
