// sources.js: what the brush engine reads. A Source is the analysis-resolution view of one drawing:
//   { aw, ah, R, G, B (Float32 sRGB 0..1), depth (1 = near) | null, matte (1 = subject) | null, faces: [{box, eyes, score}],
//     mat: {mx, my} | null (material coordinates, layout px: where this pixel's content sat at the shot's reference
//     frame; strokes seed in this space so they stick to the content), key (cache key), info {...} }
//
// Constructors:
//   stillSource(f, id | {img, depth, matte, faces}, cam)  a still (the look-dev stand-ins) under a synthetic camera
//   plateSource(f, plateId, cam)                          a real plate from video/plates/<id>/ (frames, depth, matte,
//                                                          faces, optical flow composed into material coordinates)
//   canvasSource(f, key, draw, opts)                      a procedural canvas the scene draws (opts: depth, matte, sky)
//   resolvePlate(f, plateId, standin)                      the real plate when video/plates/index.json lists it, else
//                                                          the designated stand-in (so every shot always renders)
// cam: {cx, cy, zoom, rot, mirror} in source uv (zoom 1 = the whole source covers the frame), or a function
//      (k, t) -> cam of the shot's progress k (0..1) and song time t.

import { loadImage, loadJSON, pixels } from '../../assets.js';
import { PLATES, plateTime, plateFrameIndex, plateMeta } from '../../plates.js';
import { clamp, lerp, LRU, resample, sampleField, makeCanvas, kf, linear } from './util.js';

export const STANDINS = {
  a_duel: { img: '/media/lookdev/inputs/a_duel.jpg', depth: '/media/lookdev/analysis/a_duel/depth.png', matte: '/media/lookdev/analysis/a_duel/matte.png', faces: '/media/lookdev/analysis/a_duel/faces.json' },
  b_face: { img: '/media/lookdev/inputs/b_face.jpg', depth: '/media/lookdev/analysis/b_face/depth.png', matte: '/media/lookdev/analysis/b_face/matte.png', faces: '/media/lookdev/analysis/b_face/faces.json' },
  c_armies: { img: '/media/lookdev/inputs/c_armies.jpg', depth: '/media/lookdev/analysis/c_armies/depth.png', matte: '/media/lookdev/analysis/c_armies/matte.png', faces: '/media/lookdev/analysis/c_armies/faces.json' },
};
export const analysisSize = (W, H) => [Math.round(W / 2), Math.round(H / 2)];

// ---------------------------------------------------------------- camera
export function camAt(cam, f) {
  if (typeof cam === 'function') return { cx: .5, cy: .5, zoom: 1, rot: 0, mirror: false, ...cam(f.k, f.t, f) };
  return { cx: .5, cy: .5, zoom: 1, rot: 0, mirror: false, ...(cam || {}) };
}
// keyed camera helper: camKeys([[k0, {cx, cy, zoom}], [k1, {...}]], ease) -> cam(k)
export function camKeys(keys, ease = linear) {
  return k => {
    const out = {};
    for (const p of ['cx', 'cy', 'zoom', 'rot']) { if (keys[0][1][p] == null) continue; out[p] = kf(k, keys.map(([t, c]) => [t, c[p]]), ease); }
    if (keys[0][1].mirror) out.mirror = true;
    return out;
  };
}
// screen analysis px <-> source px for a camera over a source of sw x sh px drawn into aw x ah
export function camXform(c, sw, sh, aw, ah) {
  const so = sw / sh, oo = aw / ah;
  let hU = 1 / c.zoom, wU = oo / so / c.zoom;
  if (wU > 1 / c.zoom) { wU = 1 / c.zoom; hU = so / oo / c.zoom; }
  const sxPx = wU * sw / aw, syPx = hU * sh / ah;     // source px per screen px (equal when aspect matches)
  const cs = Math.cos(c.rot || 0), sn = Math.sin(c.rot || 0), mir = c.mirror ? -1 : 1;
  const cxp = c.cx * sw, cyp = c.cy * sh;
  // fwd: screen (x, y) -> source px
  const a = sxPx * cs * mir, b = sxPx * sn * mir, cc = -syPx * sn, d = syPx * cs;   // [u v] = [a cc; b d] [dx dy] + c
  const fwd = (x, y, o) => { const dx = x + .5 - aw / 2, dy = y + .5 - ah / 2; o[0] = cxp + a * dx + cc * dy; o[1] = cyp + b * dx + d * dy; return o; };
  // inverse (source px -> screen px) as a canvas transform
  const det = a * d - cc * b, ia = d / det, ib = -b / det, ic = -cc / det, id = a / det;
  const inv = (u, v, o) => { const du = u - cxp, dv = v - cyp; o[0] = ia * du + ic * dv + aw / 2 - .5; o[1] = ib * du + id * dv + ah / 2 - .5; return o; };
  // canvas setTransform(A, B, C, D, E, F) maps source px to screen px: x' = A u + C v + E, y' = B u + D v + F
  const T = [ia, ib, ic, id, aw / 2 - ia * cxp - ic * cyp, ah / 2 - ib * cxp - id * cyp];
  return { fwd, inv, T, scale: Math.sqrt(Math.abs(det)) };
}

// ---------------------------------------------------------------- decoding helpers
const _fields = new LRU(12);
async function fieldFromImage(url, kind, w, h) {      // kind: 'depth16' (R hi, G lo) | 'grey'
  const key = `${url}|${kind}|${w}x${h}`;
  const hit = _fields.get(key); if (hit) return hit;
  const img = await loadImage(url, { optional: true });
  if (!img) return null;
  const sw = img.width, sh = img.height, d = pixels(img, sw, sh, null), N = sw * sh, f = new Float32Array(N);
  if (kind === 'depth16') for (let i = 0; i < N; i++) f[i] = (d[i * 4] * 256 + d[i * 4 + 1]) / 65535;
  else for (let i = 0; i < N; i++) f[i] = d[i * 4] / 255;
  const out = { w, h, data: resample(f, sw, sh, w, h) };
  _fields.set(key, out);
  return out;
}
const _cv = { c: null, g: null };
function cropRGB(img, T, aw, ah) {
  if (!_cv.c || _cv.c.width !== aw || _cv.c.height !== ah) { _cv.c = new OffscreenCanvas(aw, ah); _cv.g = _cv.c.getContext('2d', { willReadFrequently: true }); }
  const g = _cv.g;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, aw, ah);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.setTransform(T[0], T[1], T[2], T[3], T[4], T[5]);
  g.drawImage(img, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const d = g.getImageData(0, 0, aw, ah).data, N = aw * ah, R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  for (let i = 0; i < N; i++) { R[i] = d[i * 4] / 255; G[i] = d[i * 4 + 1] / 255; B[i] = d[i * 4 + 2] / 255; }
  return { R, G, B };
}
// sample a {w, h, data} field (defined over a sw x sh source) through a camera into aw x ah
function cropField(fl, X, sw, sh, aw, ah) {
  if (!fl) return null;
  const out = new Float32Array(aw * ah), p = [0, 0], kx = fl.w / sw, ky = fl.h / sh;
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) { X.fwd(x, y, p); out[y * aw + x] = sampleField(fl.data, fl.w, fl.h, p[0] * kx - .5, p[1] * ky - .5); }
  return out;
}
function mapFaces(faces, X, sw, sh, aw, ah) {
  const p = [0, 0], q = [0, 0];
  return (faces || []).map(f => {
    const e = (f.eyes || []).map(([u, v]) => { X.inv(u * sw, v * sh, p); return [(p[0] + .5) / aw, (p[1] + .5) / ah]; });
    X.inv(f.box[0] * sw, f.box[1] * sh, p); X.inv(f.box[2] * sw, f.box[3] * sh, q);
    const box = [Math.min(p[0], q[0]) / aw, Math.min(p[1], q[1]) / ah, Math.max(p[0], q[0]) / aw, Math.max(p[1], q[1]) / ah];
    return { ...f, eyes: e, box };
  }).filter(f => f.box[2] > 0 && f.box[0] < 1 && f.box[3] > 0 && f.box[1] < 1);
}
// material coordinates for an affine camera: source uv scaled to layout px at the shot's reference zoom
function affineMat(X, sw, sh, aw, ah, W, H, zRef) {
  const N = aw * ah, mx = new Float32Array(N), my = new Float32Array(N), p = [0, 0], kx = W * zRef / sw, ky = H * zRef / sh;
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) { X.fwd(x, y, p); mx[y * aw + x] = p[0] * kx; my[y * aw + x] = p[1] * ky; }
  return { mx, my };
}

// ---------------------------------------------------------------- stills (stand-ins)
const _still = new LRU(6);
async function loadStill(spec) {
  const key = JSON.stringify(spec);
  let s = _still.get(key);
  if (!s) {
    s = (async () => {
      const img = await loadImage(spec.img);
      const [depth, matte, faces] = await Promise.all([
        spec.depth ? fieldFromImage(spec.depth, 'depth16', 960, 540) : null,
        spec.matte ? fieldFromImage(spec.matte, 'grey', 960, 540) : null,
        spec.faces ? loadJSON(spec.faces, { optional: true }) : null]);
      return { img, depth, matte, faces: faces || [], w: img.width, h: img.height };
    })();
    _still.set(key, s);
  }
  return s;
}
export async function stillSource(f, id, cam, opts = {}) {
  const spec = typeof id === 'string' ? STANDINS[id] : id;
  if (!spec) throw new Error(`no stand-in ${id}`);
  const S = await loadStill(spec), [aw, ah] = analysisSize(f.W, f.H);
  const c = camAt(cam, f), X = camXform(c, S.w, S.h, aw, ah);
  const rgb = cropRGB(S.img, X.T, aw, ah);
  const depth = cropField(S.depth, X, S.w, S.h, aw, ah), matte = opts.noMatte ? null : cropField(S.matte, X, S.w, S.h, aw, ah);
  const faces = mapFaces(S.faces, X, S.w, S.h, aw, ah);
  const c0 = camAt(cam, { ...f, k: 0, t: f.shot ? f.shot.t0 : f.t });
  const mat = affineMat(X, S.w, S.h, aw, ah, f.W, f.H, c0.zoom);
  const key = `still|${spec.img}|${aw}x${ah}|${[c.cx, c.cy, c.zoom, c.rot, c.mirror].map(v => +v).map(v => v.toFixed(5)).join(',')}`;
  return { aw, ah, ...rgb, depth, matte, faces, mat, key, info: { kind: 'still', id: typeof id === 'string' ? id : spec.img, cam: c } };
}

// ---------------------------------------------------------------- real plates
// song time -> plate time: shot.plate {id, at, speed, offset, keys: [[songT, plateT], ...]} (keys win)
export function plateTimeOf(shot, t) {
  const p = shot.plate || {};
  if (p.keys && p.keys.length) return kf(t, p.keys, linear);
  return plateTime(shot, t);
}
const _maps = new LRU(64);
async function mapField(id, kind, f, w, h) {         // one channel (or two for flow) of a plate map as Float32 at w x h
  const key = `${id}|${kind}|${f}|${w}x${h}`;
  const hit = _maps.get(key); if (hit) return hit;
  const P = PLATES[id]; const pad = String(f).padStart(4, '0');
  let url;
  if (kind === 'd' || kind === 'm') { if (!(kind === 'd' ? P.depth : P.mattes)) return null; const last = 1 + Math.floor((P.n - 1) / 2) * 2; const ff = Math.min(last, 1 + Math.round((f - 1) / 2) * 2); url = kind === 'm' ? `plates/${id}/masks/m${String(ff).padStart(4, '0')}.png` : `plates/${id}/maps/d${String(ff).padStart(4, '0')}.png`; }
  else url = `plates/${id}/maps/${kind}${pad}.png`;
  const img = await loadImage(url, { optional: true });
  if (!img) { _maps.set(key, null); return null; }
  const d = pixels(img, img.width, img.height, null), N = img.width * img.height;
  let out;
  if (kind === 'v') { const fx = new Float32Array(N), fy = new Float32Array(N); for (let i = 0; i < N; i++) { fx[i] = (d[i * 4] - 128) / 4; fy[i] = (d[i * 4 + 1] - 128) / 4; } out = { w: img.width, h: img.height, fx, fy }; }
  else { const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = d[i * 4] / 255; out = { w: img.width, h: img.height, data: a }; }
  _maps.set(key, out);
  return out;
}
// material map M_k (plate px at map resolution -> plate px of frame k0), composed from the plate's forward flow
const _matCache = new LRU(8);
async function composeMat(id, k0, k) {
  const P = PLATES[id];
  const probe = await mapField(id, 'v', Math.min(P.n, Math.max(1, k0)), 0, 0);
  if (!probe) return null;
  const w = probe.w, h = probe.h, N = w * h, s = (P.w || 960) / w;
  const ident = () => { const mx = new Float32Array(N), my = new Float32Array(N); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { mx[y * w + x] = (x + .5) * s; my[y * w + x] = (y + .5) * s; } return { mx, my }; };
  if (k === k0) return { w, h, ...ident() };
  // nearest cached state on the way from k0 to k
  let start = k0, M = null;
  for (const [key, v] of _matCache.m) { const [pid, a, b] = key.split('|'); if (pid === id && +a === k0) { const bb = +b; if ((k > k0 && bb > k0 && bb <= k && bb > start) || (k < k0 && bb < k0 && bb >= k && bb < start)) { start = bb; M = v; } } }
  if (!M) M = ident();
  const dir = k > k0 ? 1 : -1;
  for (let j = start; j !== k; j += dir) {
    // forward step j -> j+1: M_{j+1}(p) = M_j(p - v_j(p)); backward step j -> j-1: M_{j-1}(p) = M_j(p + v_{j-1}(p))
    const vf = await mapField(id, 'v', dir > 0 ? j : j - 1, 0, 0);
    const nx = new Float32Array(N), ny = new Float32Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, vx = vf ? vf.fx[i] : 0, vy = vf ? vf.fy[i] : 0;
      const sx = x - dir * vx, sy = y - dir * vy;
      nx[i] = sampleField(M.mx, w, h, sx, sy); ny[i] = sampleField(M.my, w, h, sx, sy);
      // content arriving from outside the frame: extrapolate along the flow
      if (sx < 0 || sy < 0 || sx > w - 1 || sy > h - 1) { nx[i] -= dir * vx * s * 0; ny[i] -= dir * vy * s * 0; }
    }
    M = { mx: nx, my: ny };
  }
  _matCache.set(`${id}|${k0}|${k}`, M);
  return { w, h, ...M };
}

export async function plateSource(f, id, cam, opts = {}) {
  const P = PLATES[id]; if (!P) throw new Error(`plate ${id} not in plates/index.json`);
  const [aw, ah] = analysisSize(f.W, f.H), shot = f.shot;
  const tp = plateTimeOf(shot, f.t), loop = !!(shot.plate && shot.plate.loop);
  const k = plateFrameIndex(id, tp, { loop });
  const img = await loadImage(`plates/${id}/frames/f${String(k).padStart(4, '0')}.jpg`);
  const sw = img.width, sh = img.height;
  const c = camAt(cam, f), X = camXform(c, sw, sh, aw, ah);
  const rgb = cropRGB(img, X.T, aw, ah);
  const gain = opts.gain ?? 1;
  if (gain !== 1) for (const ch of [rgb.R, rgb.G, rgb.B]) for (let i = 0; i < ch.length; i++) ch[i] = Math.min(1, ch[i] * gain);
  const [dm, mm] = await Promise.all([mapField(id, 'd', k, 0, 0), opts.noMatte ? null : mapField(id, 'm', k, 0, 0)]);
  const depth = dm ? cropField(dm, X, sw, sh, aw, ah) : null, matte = mm ? cropField(mm, X, sw, sh, aw, ah) : null;
  // faces from the plate meta (MediaPipe): {box, eyeL, eyeR}
  let faces = [];
  const meta = await plateMeta(id);
  const mf = meta && meta[k - 1] && meta[k - 1].faces;
  if (mf) faces = mapFaces(mf.filter(q => q.eyeL && q.eyeR && q.box).map(q => ({ box: q.box, eyes: [q.eyeL, q.eyeR], score: q.score ?? 1 })), X, sw, sh, aw, ah);
  // material coordinates: flow composed from the shot's first drawing's plate frame, then scaled to layout px
  const k0 = plateFrameIndex(id, plateTimeOf(shot, shot.t0), { loop });
  let mat = null;
  if (opts.advect !== false) {
    const M = await composeMat(id, k0, k);
    if (M) {
      const c0 = camAt(cam, { ...f, k: 0, t: shot.t0 }), N = aw * ah, mx = new Float32Array(N), my = new Float32Array(N), p = [0, 0];
      const kx = f.W * c0.zoom / sw, ky = f.H * c0.zoom / sh, gx = M.w / sw, gy = M.h / sh;
      for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
        X.fwd(x, y, p);
        const u = p[0] * gx - .5, v = p[1] * gy - .5, i = y * aw + x;
        mx[i] = sampleField(M.mx, M.w, M.h, u, v) * kx; my[i] = sampleField(M.my, M.w, M.h, u, v) * ky;
      }
      mat = { mx, my };
    }
  }
  if (!mat) mat = affineMat(X, sw, sh, aw, ah, f.W, f.H, camAt(cam, { ...f, k: 0, t: shot.t0 }).zoom);
  const key = `plate|${id}|${k}|${aw}x${ah}|${[c.cx, c.cy, c.zoom, c.rot, c.mirror].map(v => (+v).toFixed(5)).join(',')}`;
  return { aw, ah, ...rgb, depth, matte, faces, mat, key, info: { kind: 'plate', id, frame: k, tp, cam: c } };
}

// ---------------------------------------------------------------- procedural canvases
// draw(g, aw, ah) paints the reference (any colours: it is relit and palette-mapped like a plate); opts.depth/matte/sky
// are Float32Arrays at aw x ah or functions (aw, ah) -> Float32Array; opts.mat as {mx, my} or null (identity)
const _pc = new LRU(4);
export async function canvasSource(f, key, draw, opts = {}) {
  const [aw, ah] = analysisSize(f.W, f.H);
  const ck = `${key}|${aw}x${ah}`;
  let base = opts.cache ? _pc.get(ck) : null;
  if (!base) {
    const c = new OffscreenCanvas(aw, ah), g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#000'; g.fillRect(0, 0, aw, ah);
    await draw(g, aw, ah);
    const d = g.getImageData(0, 0, aw, ah).data, N = aw * ah, R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
    for (let i = 0; i < N; i++) { R[i] = d[i * 4] / 255; G[i] = d[i * 4 + 1] / 255; B[i] = d[i * 4 + 2] / 255; }
    base = { R, G, B };
    if (opts.cache) _pc.set(ck, base);
  }
  const fld = v => typeof v === 'function' ? v(aw, ah) : v || null;
  return { aw, ah, R: base.R, G: base.G, B: base.B, depth: fld(opts.depth), matte: fld(opts.matte), sky: fld(opts.sky), faces: opts.faces || [], mat: opts.mat || null,
    key: `canvas|${ck}`, info: { kind: 'canvas', key } };
}

// ---------------------------------------------------------------- the resolver
// standin: {id: 'a_duel' | 'b_face' | 'c_armies' | spec, cam} used until video/plates/<plateId>/ exists.
// plateCam: the framing over the real plate (defaults to the full frame).
export async function resolvePlate(f, plateId, standin, plateCam = null, opts = {}) {
  if (plateId && PLATES[plateId] && !opts.forceStandin) return plateSource(f, plateId, plateCam || standin.plateCam || null, opts);
  return stillSource(f, standin.id, standin.cam, opts);
}
export const hasPlate = id => !!(id && PLATES[id]);
