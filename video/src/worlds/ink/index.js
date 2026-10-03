// INK: the production anime-cel engine for the room (S78-S81). STYLE_BIBLE "INK": clean tapered line art, flat fills in
// Jade's fixed palette with exactly one shadow tone, painted flat-shape backgrounds, on twos with real holds.
//
//   import * as INK from '../worlds/ink/index.js';
//   await INK.init();                                   // once (scene init): sources, matte index, stand-ins
//   const setup = INK.setup({ id, plate, w, h, ... })   // a camera setup in one plate's space (sheets.js REG for others)
//   const cel = await INK.cel(setup, exposure)          // cached analysis of the drawing an exposure shows
//   INK.drawCel(g, cel, view, u)                        // fills (GPU) + lines (Canvas2D) into g
//   const bg = await INK.background(setup, W, H, view)  // the painted background (cached per setup and size)
// Files: source.js (plates/dev/stand-ins, mattes, hybrids) · cel.js (analysis) · render.js (fills, lines) · bg.js
// (painted background) · props.js (screens, Earth, ΔT map, Sutro) · eye.js (eyes, the eclipse wink) · xsheet.js /
// sheets.js (timing) · palette.js (colour) · prep/mattes.py (offline mattes for the wide room plates).

import { LRU, makeCanvas } from '../../assets.js';
import { initSources, plateRef, standinRef, drawingInput } from './source.js';
import { analyzeCel, calibrate } from './cel.js';
import { drawFills, drawChains } from './render.js';
import { LABEL_HEX, NLAB, LINE, LINE_SKIN } from './palette.js';
import { drawingKey } from './xsheet.js';

export { expose, exposeIndex, frameAt } from './xsheet.js';
export * as palette from './palette.js';

let _init = null;
const DEBUG = new URLSearchParams(location.search).has('inkdbg');
export function init() { return (_init ||= initSources()); }

// A setup: one camera. `space` = the plate whose 960x540 frame is the setup's coordinate space. `reg` maps other plates
// into it ({ 'P40': {s, tx, ty} }). `standins` maps a sheet's stand-in ids to stand-in stills.
export function setup(o) {
  const S = { w: 960, h: 540, reg: {}, cel: {}, ...o };
  S.resolve = src => plateRef(src) || standinRef(src);
  S.xf = (src, ref) => (ref && ref.kind !== 'still' && S.reg[src]) || null;
  S.cache = new LRU(o.cacheSize || 5);
  S.thresholds = null;
  return S;
}
export const hasPlates = (...ids) => ids.every(id => !!plateRef(id));

// The analysis of one drawing (cached per setup). Shadow thresholds are calibrated once per source plate on its reference
// exposure (setup.calib[src], else setup.calib, else the first drawing seen), so every drawing from a plate splits light
// and shadow at the same lightness whatever order the frames render in.
export async function cel(S, e) {
  if (!e) return null;
  const key = drawingKey(e);
  const hit = S.cache.get(key); if (hit) return hit;
  S.thresholds ||= {};
  if (!S.thresholds[e.src]) {
    const ce = (S.calib && S.calib[e.src]) || (S.calib && S.calib.src ? S.calib : null) || e;
    const ci = await drawingInput(S, ce);
    const r0 = ci ? analyzeCel(ci, { ...S.cel, ...(S.celFor ? S.celFor(ce) : {}) }) : null;
    S.thresholds[e.src] = r0 ? calibrate(r0, S.calibOpts || {}) : {};
  }
  const inp = await drawingInput(S, e);
  if (!inp) return null;
  const res = analyzeCel(inp, { ...S.cel, ...(S.celFor ? S.celFor(e) : {}), shadeT: S.thresholds[e.src] });
  res.e = e; res.key = `${S.id}|${key}`;
  // keep only what drawing needs (memory: workers hold several drawings per setup)
  res.inp = { faces: inp.faces, W: inp.W, H: inp.H, ...(DEBUG ? { rgba: inp.rgba, matte: inp.matte } : {}) };
  if (!DEBUG) { delete res.Ls; delete res.R; delete res.alpha; }
  S.cache.set(key, res);
  return res;
}

export const LABEL_ALPHA = Array.from({ length: NLAB }, (_, k) => k ? 1 : 0);

// draw a cel: fills then lines (then opts.after(g) for decals), into a layer canvas cached per drawing and view, so a
// held drawing costs one drawImage per frame. pal overrides the label colours; view maps analysis px to output px.
const _layers = new LRU(4);
export function drawCel(g, res, view, u, opts = {}) {
  if (!res) return;
  const W = g.canvas.width, H = g.canvas.height;
  const key = `${res.key}|${W}x${H}|${view.ox.toFixed(2)},${view.oy.toFixed(2)},${view.s.toFixed(4)}|${opts.wScale || 1}`;
  let c = _layers.get(key);
  if (!c) {
    c = makeCanvas(W, H);
    const cg = c.getContext('2d');
    const pal = opts.pal || LABEL_HEX;
    res.packed = drawFills(cg, res.lab, res.W, res.H, pal, LABEL_ALPHA, view, { packed: res.packed });
    if (opts.lines !== false) drawChains(cg, res.chains, view, u, { ink: opts.ink || LINE, skin: opts.skin || LINE_SKIN }, { wScale: opts.wScale || 1 });
    if (opts.after) opts.after(cg);
    _layers.set(key, c);
  }
  g.drawImage(c, 0, 0);
}

// ---------------------------------------------------------------- dev views (studio.html?inkdbg=plate|mat|lab|ridge|lines|matte)
export function debugDraw(g, res, view, mode, u) {
  if (!res) return;
  const { W, H } = res, c = makeCanvas(W, H), cg = c.getContext('2d'), img = cg.createImageData(W, H), d = img.data, inp = res.inp;
  const false8 = ['#000000', '#3050ff', '#e0e0e0', '#ff8000', '#203070', '#ffc0a0', '#8b4513', '#ffffff', '#00e0ff'];
  for (let i = 0; i < W * H; i++) {
    let r = 0, gg = 0, b = 0;
    if (mode === 'plate' || mode === 'lines') { r = inp.rgba[i * 4]; gg = inp.rgba[i * 4 + 1]; b = inp.rgba[i * 4 + 2]; if (mode === 'lines') { r = gg = b = 255 - (255 - (r + gg + b) / 3) * .25; } }
    else if (mode === 'mat') { const h = false8[res.mat[i]] || '#ff00ff'; const n = parseInt(h.slice(1), 16); r = n >> 16; gg = (n >> 8) & 255; b = n & 255; }
    else if (mode === 'matte') { r = gg = b = (inp.matte ? inp.matte[i] : 1) * 255; const a = res.alpha[i] * 255; gg = a; }
    else if (mode === 'ridge') { r = gg = b = Math.min(255, (res.R ? res.R[i] : 0) * 2000); }
    else if (mode === 'ls') { r = gg = b = res.Ls[i] * 255; }
    d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
  }
  cg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.drawImage(c, view.ox, view.oy, W * view.s, H * view.s);
  if (mode === 'lines' || mode === 'mat') drawChains(g, res.chains, view, u, { ink: mode === 'mat' ? '#ff0040' : '#000', skin: '#c04020' });
  g.strokeStyle = '#0f0'; g.lineWidth = 2;
  for (const e of res.eyes || []) { g.beginPath(); g.ellipse(view.ox + e.cx * W * view.s, view.oy + e.cy * H * view.s, e.rx * W * view.s, e.ry * H * view.s, 0, 0, 7); g.stroke();
    if (e.iris) { g.strokeStyle = '#ff0'; g.beginPath(); g.arc(view.ox + e.iris[0] * W * view.s, view.oy + e.iris[1] * H * view.s, e.iris[2] * W * view.s, 0, 7); g.stroke(); g.strokeStyle = '#0f0'; } }
  g.fillStyle = '#ff0'; g.font = '20px monospace'; g.fillText(`${mode} ${res.e && res.e.src}:${res.e && res.e.pf} ${JSON.stringify(res.stats)}`, 20, 30);
}
