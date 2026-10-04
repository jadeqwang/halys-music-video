// direct.js: her ORIGINAL anime footage, composited straight into the room (v3, the rewind decision: "anime footage composited
// DIRECTLY (light grade, ink outline, scene rim light); the cel re-segmentation was rejected as weird"). She is the one element
// in her own medium, so she stands apart from the abstract room; the plate is shown, never redrawn or re-segmented.
//
// prep/direct.py mattes and lightly grades every frame the x-sheets use (RGBA at the take's native 1280x720, listed in
// direct/index.json). Here each drawing is placed in the setup (x_setup = s * x_960 + tx, sheets.js REG) and given:
//   outline  a clean ink line on the matte edge: her silhouette in ink dilated (12 taps on a circle) minus eroded, on top
//   wash     the room's light across her: a multiply gradient masked to her (close to white: a light touch)
//   rims     a hard anime rim on the edges that face each light (her silhouette minus itself shifted away from the light),
//            screened on: pearl from the monitors, orange from the lamp
//   after    the scene's own marks on the footage (S78: the patch's lettering, decals.js), clipped to her
// The layer is cached per drawing and view, so a held drawing costs one drawImage per frame.

import { loadJSON, loadImage, makeCanvas, LRU } from '../../assets.js';
import { PLATES } from '../../plates.js';
import { takeStem } from './source.js';
import { LINE } from './palette.js';

const TAU = Math.PI * 2;
let IDX = null;
export async function initDirect() { IDX = (await loadJSON('src/worlds/ink/direct/index.json', { optional: true })) || {}; return IDX; }
const keyOf = id => PLATES[id] && `${id}_${takeStem(PLATES[id].take)}`;
// the footage exists for the plate's current take (else the scene keeps its stand-in path)
export function directReady(id) { const k = keyOf(id); return !!(k && IDX && IDX[k] && IDX[k].frames && IDX[k].frames.length); }
// the prepared frames of a plate (x-sheets snap to them)
export const directFrames = id => (directReady(id) ? IDX[keyOf(id)].frames : []);

// one drawing: the nearest prepared frame
export async function directDrawing(id, pf) {
  const k = keyOf(id), M = IDX[k];
  let best = M.frames[0]; for (const f of M.frames) if (Math.abs(f - pf) < Math.abs(best - pf)) best = f;
  const url = `src/worlds/ink/direct/${k}/d${String(best).padStart(4, '0')}.webp`;
  return { id, pf: best, url, im: await loadImage(url), w: M.w, h: M.h };
}

// her silhouette in one colour (source size), cached per frame and colour
const _tint = new LRU(12);
function tinted(D, col) {
  const k = `${D.url}|${col}`; let c = _tint.get(k); if (c) return c;
  c = makeCanvas(D.w, D.h); const g = c.getContext('2d');
  g.drawImage(D.im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, D.w, D.h);
  _tint.set(k, c); return c;
}
const _work = {};
function work(name, W, H) { let c = _work[name]; if (!c || c.width !== W || c.height !== H) c = _work[name] = makeCanvas(W, H); const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, W, H); return c; }

// where the drawing lands in output px: source px -> setup px (xf, in the 960x540 frame) -> output px (view)
export function placement(D, view, xf) {
  const r = xf || { s: 1, tx: 0, ty: 0 }, a = view.s * r.s * 960 / D.w;
  return { x: view.ox + view.s * r.tx, y: view.oy + view.s * r.ty, w: D.w * a, h: D.h * a, a,
    toOut: ([x, y]) => [view.ox + view.s * x, view.oy + view.s * y] };              // setup px -> output px
}

const _layers = new LRU(4);
// o: { u, outline (px at 1080p), ink, wash: { p0, p1 (setup px), c0, c1 }, rims: [{ dir: [x, y] (toward the light),
//      col, w (px at 1080p), a, src: [x, y] and reach (setup px: where the light is and how far it carries) }],
//      after(lg, P, D), key }
export function drawDirect(g, view, D, xf, o = {}) {
  if (!D) return;
  const W = g.canvas.width, H = g.canvas.height, u = o.u || 1;
  const key = `${D.url}|${W}x${H}|${view.ox.toFixed(2)},${view.oy.toFixed(2)},${view.s.toFixed(4)}|${o.key || ''}`;
  let L = _layers.get(key);
  if (!L) {
    L = makeCanvas(W, H);
    const lg = L.getContext('2d'), P = placement(D, view, xf);
    lg.imageSmoothingEnabled = true; lg.imageSmoothingQuality = 'high';
    lg.drawImage(D.im, P.x, P.y, P.w, P.h);
    if (o.after) o.after(lg, P, D);
    // the room's light across her (multiply, masked to her)
    if (o.wash) {
      const Wc = work('wash', W, H), wg = Wc.getContext('2d'), [x0, y0] = P.toOut(o.wash.p0), [x1, y1] = P.toOut(o.wash.p1);
      const gr = wg.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, o.wash.c0); gr.addColorStop(1, o.wash.c1);
      wg.drawImage(D.im, P.x, P.y, P.w, P.h); wg.globalCompositeOperation = 'source-in'; wg.fillStyle = gr; wg.fillRect(0, 0, W, H);
      lg.globalCompositeOperation = 'multiply'; lg.drawImage(Wc, 0, 0); lg.globalCompositeOperation = 'source-over';
    }
    // hard rims on the edges facing each light
    for (const R of o.rims || []) {
      const Rc = work('rim', W, H), rg = Rc.getContext('2d'), d = Math.hypot(R.dir[0], R.dir[1]) || 1, w = (R.w ?? 3) * u;
      const dx = R.dir[0] / d * w, dy = R.dir[1] / d * w;
      rg.drawImage(tinted(D, R.col), P.x, P.y, P.w, P.h);
      rg.globalCompositeOperation = 'destination-out'; rg.drawImage(D.im, P.x - dx, P.y - dy, P.w, P.h);
      if (R.src) {                     // the light's reach: full at the light, gone at `reach` (setup px)
        const [cx, cy] = P.toOut(R.src), sc = P.toOut([1, 0])[0] - P.toOut([0, 0])[0];
        const gr = rg.createRadialGradient(cx, cy, 0, cx, cy, R.reach * sc);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.55, 'rgba(0,0,0,.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        rg.globalCompositeOperation = 'destination-in'; rg.fillStyle = gr; rg.fillRect(0, 0, W, H);
      }
      lg.globalCompositeOperation = 'screen'; lg.globalAlpha = R.a ?? .5; lg.drawImage(Rc, 0, 0);
      lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over';
    }
    // the ink outline ON the matte edge, over everything: her silhouette dilated (outside) minus eroded (inside), so the line
    // covers the footage's last soft pixel (no fringe of the plate's room) and continues just outside it
    const ink = tinted(D, o.ink || LINE), w = (o.outline ?? 2.4) * u, ro = w * .6, ri = w * .4;
    const Oc = work('ring', W, H), og = Oc.getContext('2d'), Ec = work('ero', W, H), eg = Ec.getContext('2d');
    for (let j = 0; j < 12; j++) og.drawImage(ink, P.x + Math.cos(j * TAU / 12) * ro, P.y + Math.sin(j * TAU / 12) * ro, P.w, P.h);
    eg.drawImage(D.im, P.x, P.y, P.w, P.h); eg.globalCompositeOperation = 'destination-in';
    for (let j = 0; j < 8; j++) eg.drawImage(D.im, P.x + Math.cos(j * TAU / 8) * ri, P.y + Math.sin(j * TAU / 8) * ri, P.w, P.h);
    og.globalCompositeOperation = 'destination-out'; og.drawImage(Ec, 0, 0);
    // where she runs off the plate's frame the erosion would draw the frame's edge: no line there
    const m = ri + 1.5; og.clearRect(P.x - 4, P.y - 4, P.w + 8, m + 4); og.clearRect(P.x - 4, P.y + P.h - m, P.w + 8, m + 4);
    og.clearRect(P.x - 4, P.y - 4, m + 4, P.h + 8); og.clearRect(P.x + P.w - m, P.y - 4, m + 4, P.h + 8);
    lg.drawImage(Oc, 0, 0);
    _layers.set(key, L);
  }
  g.drawImage(L, 0, 0);
}

// a few footage pixels (source px box) as RGBA bytes: colour samples for marks drawn on the footage
const _sc = makeCanvas(8, 8), _sg = _sc.getContext('2d', { willReadFrequently: true });
export function samplePixels(D, x0, y0, w, h) {
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
  _sc.width = w; _sc.height = h; _sg.clearRect(0, 0, w, h); _sg.drawImage(D.im, -x0, -y0);
  return _sg.getImageData(0, 0, w, h).data;
}
