// assets.js: loaders with small LRU caches. Everything is fetched from the local static server
// (render.mjs serves video/; same origin, so canvases read back with getImageData stay untainted).

export class LRU {
  constructor(max = 32) { this.max = max; this.m = new Map(); }
  get(k) { if (!this.m.has(k)) return undefined; const v = this.m.get(k); this.m.delete(k); this.m.set(k, v); return v; }
  // evicted values are left to the GC (never close() an ImageBitmap here: a scene may still hold it)
  set(k, v) { this.m.set(k, v); while (this.m.size > this.max) this.m.delete(this.m.keys().next().value); return v; }
  has(k) { return this.m.has(k); }
}

const _json = new Map();
export async function loadJSON(url, { optional = false } = {}) {
  if (_json.has(url)) return _json.get(url);
  const p = fetch(url).then(r => { if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); });
  _json.set(url, p);
  try { return await p; } catch (e) { _json.delete(url); if (optional) return null; throw e; }
}

// Images decode off the main thread as ImageBitmaps (fast to draw, fast to upload as WebGL textures).
const _img = new LRU(96), _pending = new Map();
export async function loadImage(url, { optional = false } = {}) {
  const hit = _img.get(url); if (hit) return hit;
  if (_pending.has(url)) return _pending.get(url);
  const p = (async () => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    const bmp = await createImageBitmap(await r.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    _img.set(url, bmp);
    return bmp;
  })();
  _pending.set(url, p);
  try { return await p; } catch (e) { if (optional) return null; throw e; } finally { _pending.delete(url); }
}

// Pixels of an image at (w, h) as RGBA bytes: for decoding analysis maps (fields, depth, mattes).
const _pc = new OffscreenCanvas(8, 8), _pg = _pc.getContext('2d', { willReadFrequently: true });
const _px = new LRU(48);
export function pixels(img, w = img.width, h = img.height, key = null) {
  const k = key && `${key}@${w}x${h}`;
  if (k) { const hit = _px.get(k); if (hit) return hit; }
  _pc.width = w; _pc.height = h; _pg.clearRect(0, 0, w, h); _pg.drawImage(img, 0, 0, w, h);
  const d = _pg.getImageData(0, 0, w, h).data;
  if (k) _px.set(k, d);
  return d;
}

export function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
