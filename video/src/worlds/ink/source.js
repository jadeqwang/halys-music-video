// source.js: where the INK engine gets its pictures. A plate id resolves, in order, to
//   1. the production plate video/plates/<id>/ (as soon as video/plates/index.json lists it: tools/pipeline.sh),
//   2. a dev extraction of the same chosen take in video/out/ink_dev/<id>/ (gitignored; made by the INK owner with the
//      exact extract_plates.py filters, so frame numbers match the production plate), or
//   3. nothing: the scene falls back to its stand-in stills (worlds/ink/standins/).
// Mattes: the INK prep mattes (worlds/ink/mattes/<id>_<take>/, see prep/mattes.py: the pipeline's isnet-anime matte picks
// the desk lamp or the saros dial on the wide room plates) when they exist for this take and frame, else the plate's own
// masks/ (odd frames), else none.
//
// A drawing's input is built in SETUP space (one plate's 960x540 frame): another plate of the same camera is resampled
// into it through a registration (sheets.js REG), and a hybrid exposure (ref + region) blends the moving region of one
// frame into a held reference frame before any analysis.

import { PLATES } from '../../plates.js';
import { loadJSON, loadImage, pixels, LRU } from '../../assets.js';

const pad4 = n => String(n).padStart(4, '0');
let DEV = null, MATTES = null, STANDINS = null;
export async function initSources() {
  DEV = (await loadJSON('out/ink_dev/index.json', { optional: true })) || {};
  MATTES = (await loadJSON('src/worlds/ink/mattes/index.json', { optional: true })) || {};
  STANDINS = (await loadJSON('src/worlds/ink/standins/index.json', { optional: true })) || {};
}
export const takeStem = take => String(take || '').replace(/^.*\//, '').replace(/\.[^.]+$/, '');

export function plateRef(id) {
  const P = PLATES[id];
  if (P && P.n) return { kind: 'plate', id, base: `plates/${id}/`, take: P.take, n: P.n, fps: P.fps || 24, w: P.w || 960, h: P.h || 540, gain: P.gain || 1, masks: P.mattes > 0 };
  const D = DEV && DEV[id];
  if (D && D.n) return { kind: 'dev', id, base: `out/ink_dev/${id}/`, take: D.take, n: D.n, fps: D.fps || 24, w: D.w || 960, h: D.h || 540, gain: D.gain || 1, masks: D.mattes > 0 };
  return null;
}
export function standinRef(id) {
  const S = STANDINS && STANDINS[id];
  return S ? { kind: 'still', id, base: `src/worlds/ink/standins/${id}/`, take: 'still', n: 1, fps: 24, w: S.w || 960, h: S.h || 540, gain: S.gain || 1, meta: S } : null;
}

// ---------------------------------------------------------------- raw loads
const _rgba = new LRU(40), _matte = new LRU(40);
async function frameRGBA(ref, pf) {
  const url = ref.kind === 'still' ? `${ref.base}frame.jpg` : `${ref.base}frames/f${pad4(Math.max(1, Math.min(ref.n, pf)))}.jpg`;
  const hit = _rgba.get(url); if (hit) return hit;
  const img = await loadImage(url);
  const px = new Uint8ClampedArray(pixels(img, ref.w, ref.h));       // copy: pixels() reuses its scratch canvas
  _rgba.set(url, px);
  return px;
}
async function frameMatte(ref, pf) {
  const k = `${ref.kind}:${ref.id}:${ref.take}:${pf}`;
  if (_matte.has(k)) return _matte.get(k);
  let url = null;
  const list = MATTES[`${ref.id}_${takeStem(ref.take)}`];
  if (ref.kind === 'still') url = `${ref.base}matte.png`;
  else if (list && list.length) {
    let best = list[0]; for (const f of list) if (Math.abs(f - pf) < Math.abs(best - pf)) best = f;   // nearest prepared frame
    url = `src/worlds/ink/mattes/${ref.id}_${takeStem(ref.take)}/m${pad4(best)}.png`;
  } else if (ref.masks) url = `${ref.base}masks/m${pad4(1 + 2 * Math.round((Math.max(1, pf) - 1) / 2))}.png`;
  let out = null;
  if (url) {
    const img = await loadImage(url, { optional: true });
    if (img) { const p = pixels(img, ref.w, ref.h); out = new Float32Array(ref.w * ref.h); for (let i = 0; i < out.length; i++) out[i] = p[i * 4] / 255; }
  }
  _matte.set(k, out);
  return out;
}
const _meta = new Map();
export async function frameMeta(ref, pf) {
  if (ref.kind === 'still') return ref.meta || null;
  if (!_meta.has(ref.base)) _meta.set(ref.base, loadJSON(`${ref.base}meta.json`, { optional: true }));
  const m = await _meta.get(ref.base);
  return m ? m[Math.max(0, Math.min(m.length - 1, pf - 1))] : null;
}

// ---------------------------------------------------------------- setup-space resampling
// xf: setup px -> source px  { s, tx, ty } meaning  x_src = (x_setup - tx) / s  (i.e. x_setup = s * x_src + tx)
function resampleRGBA(src, sw, sh, xf, W, H) {
  if (!xf) return src;
  const out = new Uint8ClampedArray(W * H * 4), is = 1 / xf.s;
  for (let y = 0; y < H; y++) {
    const sy = (y - xf.ty) * is, y0 = Math.floor(sy), fy = sy - y0, ya = Math.max(0, Math.min(sh - 1, y0)), yb = Math.max(0, Math.min(sh - 1, y0 + 1));
    for (let x = 0; x < W; x++) {
      const sx = (x - xf.tx) * is, x0 = Math.floor(sx), fx = sx - x0, xa = Math.max(0, Math.min(sw - 1, x0)), xb = Math.max(0, Math.min(sw - 1, x0 + 1));
      const i00 = (ya * sw + xa) * 4, i10 = (ya * sw + xb) * 4, i01 = (yb * sw + xa) * 4, i11 = (yb * sw + xb) * 4, o = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = (src[i00 + c] * (1 - fx) + src[i10 + c] * fx) * (1 - fy) + (src[i01 + c] * (1 - fx) + src[i11 + c] * fx) * fy;
      out[o + 3] = 255;
    }
  }
  return out;
}
function resample1(src, sw, sh, xf, W, H) {
  if (!xf || !src) return src;
  const out = new Float32Array(W * H), is = 1 / xf.s;
  for (let y = 0; y < H; y++) {
    const sy = (y - xf.ty) * is, y0 = Math.floor(sy), fy = sy - y0, ya = Math.max(0, Math.min(sh - 1, y0)), yb = Math.max(0, Math.min(sh - 1, y0 + 1));
    for (let x = 0; x < W; x++) {
      const sx = (x - xf.tx) * is, x0 = Math.floor(sx), fx = sx - x0, xa = Math.max(0, Math.min(sw - 1, x0)), xb = Math.max(0, Math.min(sw - 1, x0 + 1));
      out[y * W + x] = (src[ya * sw + xa] * (1 - fx) + src[ya * sw + xb] * fx) * (1 - fy) + (src[yb * sw + xa] * (1 - fx) + src[yb * sw + xb] * fx) * fy;
    }
  }
  return out;
}
const mapFace = (fc, xf, sw, sh, W, H) => {
  if (!xf || !fc) return fc;
  const P = (u, v) => [(u * sw * xf.s + xf.tx) / W, (v * sh * xf.s + xf.ty) / H];
  const o = JSON.parse(JSON.stringify(fc));
  const mp = arr => { for (let i = 0; i + 1 < arr.length; i += 2) { const [u, v] = P(arr[i], arr[i + 1]); arr[i] = u; arr[i + 1] = v; } };
  if (o.box) { const [a, b] = P(o.box[0], o.box[1]), [c, d] = P(o.box[2], o.box[3]); o.box = [a, b, c, d]; }
  for (const k of ['eyeL', 'eyeR', 'mouth']) if (o[k]) o[k] = P(o[k][0], o[k][1]);
  if (o.lines) for (const [k, v] of Object.entries(o.lines)) { if (k.startsWith('iris')) { const [u, w] = P(v[0], v[1]); o.lines[k] = [u, w, v[2] * xf.s * sw / W]; } else mp(v); }
  return o;
};

// region weight: plate-normalised ellipse with a feathered edge
function regionWeight(r, W, H) {
  const w = new Float32Array(W * H), f = Math.max(.01, r.feather ?? .3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x / W - r.cx) / r.rx, dy = (y / H - r.cy) / r.ry, d = Math.sqrt(dx * dx + dy * dy);
    const k = Math.min(1, Math.max(0, (1 - d) / f));
    w[y * W + x] = k * k * (3 - 2 * k);
  }
  return w;
}
const _rw = new LRU(8);

// The input of one drawing in setup space: { W, H, rgba, matte, faces, key }
const _inputs = new LRU(12);
export async function drawingInput(setup, e) {
  const key = `${setup.id}|${e.src}:${e.pf}<${e.ref || ''}|${JSON.stringify(e.region || null)}|${e.dy || 0}`;
  const hit = _inputs.get(key); if (hit) return hit;
  const ref = setup.resolve(e.src);
  if (!ref) return null;
  const W = setup.w, H = setup.h, xf = setup.xf(e.src, ref);
  const get = async pf => {
    const rgba = resampleRGBA(await frameRGBA(ref, pf), ref.w, ref.h, xf, W, H);
    const matte = resample1(await frameMatte(ref, pf), ref.w, ref.h, xf, W, H);
    const meta = await frameMeta(ref, pf);
    const faces = ((meta && meta.faces) || []).map(fc => mapFace(fc, xf, ref.w, ref.h, W, H));
    return { rgba, matte, faces };
  };
  const A = await get(e.pf);
  let out = { W, H, rgba: A.rgba, matte: A.matte, faces: A.faces, gain: ref.gain, key, src: e.src, pf: e.pf };
  if (e.ref && e.region) {
    const B = await get(e.ref);
    const rk = `${W}x${H}|${JSON.stringify(e.region)}`;
    let w = _rw.get(rk); if (!w) { w = regionWeight(e.region, W, H); _rw.set(rk, w); }
    const dy = Math.round(e.dy || 0);
    const rgba = new Uint8ClampedArray(B.rgba), matte = B.matte && A.matte ? new Float32Array(B.matte) : (B.matte || A.matte);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, k = w[i]; if (k <= 0) continue;
      const sy = Math.max(0, Math.min(H - 1, y - dy)), j = sy * W + x;
      for (let c = 0; c < 3; c++) rgba[i * 4 + c] = B.rgba[i * 4 + c] * (1 - k) + A.rgba[j * 4 + c] * k;
      if (matte && B.matte && A.matte) matte[i] = B.matte[i] * (1 - k) + A.matte[j] * k;
    }
    out = { ...out, rgba, matte, faces: B.faces };     // the face is the held reference's
  }
  _inputs.set(key, out);
  return out;
}

// raw access for background building (frames + mattes in setup space)
export async function setupFrame(setup, src, pf) {
  const ref = setup.resolve(src); if (!ref) return null;
  const xf = setup.xf(src, ref), W = setup.w, H = setup.h;
  return { rgba: resampleRGBA(await frameRGBA(ref, pf), ref.w, ref.h, xf, W, H), matte: resample1(await frameMatte(ref, pf), ref.w, ref.h, xf, W, H), gain: ref.gain };
}
