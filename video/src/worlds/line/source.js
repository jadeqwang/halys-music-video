// source.js: where the line engine's plate fields come from.
//
// A source spec names a production plate AND a stand-in:
//   { plate: 'P14', standin: 'bface', win: {cx, cy, zoom}, standinWin: {...}, mirror: false, tp: 0 }
// resolve(spec) picks video/plates/<plate>/ as soon as that plate is listed in video/plates/index.json (the plate unit's
// output; plates.js loads the index at boot), otherwise the stand-in still in src/worlds/line/standins/<id>/ (frame.jpg
// 1920x1080, depth.png 8-bit 960x540 near = 255, matte.png 960x540). Shots keep working unchanged when plates land;
// only their framing (win) may need a retune, which shots set per kind: win for the plate, standinWin for the stand-in.
//
// sourceFields(spec, tp, aw, aspect) -> F: the analysis (analysis.js) of the source window at aw x round(aw / aspect),
// plus F.id, F.kind ('plate' | 'standin'), F.frame (plate frame, 1-based), F.fps, F.win (source px), F.srcW/srcH.
// Everything is cached (LRU), so a still is analysed once per window per page.

import { PLATES, plateFrameIndex } from '../../plates.js';
import { loadImage, loadJSON, LRU } from '../../assets.js';
import { analyze, windowPixels, windowField, blur } from './analysis.js';

export const STANDIN_URL = new URL('./standins/', import.meta.url).href;
let STANDINS = null;
export async function standinIndex() { return STANDINS ||= (await loadJSON(STANDIN_URL + 'index.json', { optional: true })) || {}; }

// which source a spec uses right now
export function resolve(spec) {
  if (spec.plate && PLATES[spec.plate]) {
    const P = PLATES[spec.plate];
    return { kind: 'plate', id: spec.plate, w: P.w || 960, h: P.h || 540, fps: P.fps || 24, n: P.n, win: spec.win || { cx: .5, cy: .5, zoom: 1 }, P };
  }
  if (spec.standin) return { kind: 'standin', id: spec.standin, w: 1920, h: 1080, fps: 0, n: 1, win: spec.standinWin || spec.win || { cx: .5, cy: .5, zoom: 1 } };
  return { kind: 'none', id: 'none', w: 1920, h: 1080, fps: 0, n: 1, win: { cx: .5, cy: .5, zoom: 1 } };
}

// window {cx, cy, zoom} (source uv; zoom 1 = the largest rect of the output aspect inside the source) -> source px
export function windowRect(win, srcW, srcH, aspect, clampInside = true) {
  const w0 = Math.min(srcW, srcH * aspect), w = w0 / (win.zoom || 1), h = w / aspect;
  let x0 = (win.cx ?? .5) * srcW - w / 2, y0 = (win.cy ?? .5) * srcH - h / 2;
  if (clampInside) { x0 = Math.max(0, Math.min(srcW - w, x0)); y0 = Math.max(0, Math.min(srcH - h, y0)); }
  return [x0, y0, w, h];
}

const FIELDS = new LRU(10);
const pad4 = n => String(n).padStart(4, '0');

async function loadStandin(id) {
  const base = STANDIN_URL + id + '/';
  const [img, dep, mat] = await Promise.all([loadImage(base + 'frame.jpg'), loadImage(base + 'depth.png', { optional: true }), loadImage(base + 'matte.png', { optional: true })]);
  const idx = await standinIndex();
  return { img, dep, mat, faces: (idx[id] && idx[id].faces) || [] };
}

// the plate frame index (1-based) shown at plate time tp; depth / mattes exist on odd frames only
function stepped(f, n) { const last = 1 + Math.floor((n - 1) / 2) * 2; return Math.min(last, 1 + Math.round((f - 1) / 2) * 2); }

export async function sourceFields(spec, tp = 0, aw = 960, aspect = 16 / 9, opt = {}) {
  const r = resolve(spec), ah = Math.round(aw / aspect), mirror = !!spec.mirror;
  const frame = r.kind === 'plate' ? plateFrameIndex(r.id, tp, { loop: !!spec.loop }) : 0;
  const rect = windowRect(r.win, r.w, r.h, aspect, spec.clamp !== false);
  const key = `${r.kind}:${r.id}:${frame}:${rect.map(v => v.toFixed(2)).join(',')}:${aw}x${ah}:${mirror ? 1 : 0}:${JSON.stringify(opt)}`;
  const hit = FIELDS.get(key); if (hit) return hit;
  const p = (async () => {
    let img, dep = null, mat = null, faces = [], dsc = 1;
    if (r.kind === 'plate') {
      img = await loadImage(`plates/${r.id}/frames/f${pad4(frame)}.jpg`);
      const fs = stepped(frame, r.n);
      if (r.P.depth) dep = await loadImage(`plates/${r.id}/maps/d${pad4(fs)}.png`, { optional: true });
      if (r.P.mattes) mat = await loadImage(`plates/${r.id}/masks/m${pad4(fs)}.png`, { optional: true });
    } else if (r.kind === 'standin') {
      ({ img, dep, mat, faces } = await loadStandin(r.id));
    } else {
      img = new OffscreenCanvas(16, 9);
    }
    const id = windowPixels(img, rect, aw, ah, mirror);
    // depth / matte maps are smaller than the frame: scale the window into their pixel grid
    const sub = (m) => { if (!m) return null; const sx = m.width / r.w, sy = m.height / r.h; return windowField(m, [rect[0] * sx, rect[1] * sy, rect[2] * sx, rect[3] * sy], aw, ah, mirror); };
    let D = sub(dep), M = sub(mat);
    if (D) D = blur(D, aw, ah, 1.2 * dsc);          // 8-bit depth: remove the quantisation steps
    const fx = rect[2] / r.w, fy = rect[3] / r.h;
    const fc = faces.map(f => ({ ...f, box: [(f.box[0] * r.w - rect[0]) / rect[2], (f.box[1] * r.h - rect[1]) / rect[3], (f.box[2] * r.w - rect[0]) / rect[2], (f.box[3] * r.h - rect[1]) / rect[3]] }));
    const F = analyze(id, { depth: D, matte: M, faces: fc }, { gain: opt.gain ?? (r.kind === 'plate' ? (r.P.gain || 1) : 1), ...opt });
    Object.assign(F, { id: r.id, kind: r.kind, frame, fps: r.fps, n: r.n, win: rect, srcW: r.w, srcH: r.h, mirror, zoom: 1 / Math.max(fx, fy), key });
    return F;
  })();
  FIELDS.set(key, p);
  try { return await p; } catch (e) { FIELDS.m.delete(key); throw e; }
}

// optical flow of a real plate from frame f to f+1 at the maps' size: {w, h, fx, fy} in map px per plate frame
const FLOWS = new LRU(64);
export async function plateFlow(id, frame) {
  const key = id + ':' + frame, hit = FLOWS.get(key); if (hit) return hit;
  const p = (async () => {
    const meta = await loadJSON(`plates/${id}/fields.json`, { optional: true });
    const w = (meta && meta.w) || 480, h = (meta && meta.h) || 270;
    const img = await loadImage(`plates/${id}/maps/v${pad4(frame)}.png`, { optional: true });
    if (!img) return null;
    const d = windowPixels(img, [0, 0, img.width, img.height], w, h).data, N = w * h, fx = new Float32Array(N), fy = new Float32Array(N);
    for (let i = 0; i < N; i++) { fx[i] = (d[i * 4] - 128) / 4; fy[i] = (d[i * 4 + 1] - 128) / 4; }
    return { w, h, fx, fy };
  })();
  FLOWS.set(key, p);
  return p;
}
