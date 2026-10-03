// main.js: boot, the deterministic frame function, and the API render.mjs drives (window.HALYS).
//
// URL parameters (studio.html?...):  w, h (output size, default 1920x1080) · fps (master rate, default 60) ·
//   render (headless: no UI) · debug (master-frame overlay; disables hold de-duplication) · t (studio start time)
//
// Contract: renderFrame(i) draws master frame i into the output canvas and depends only on (i, w, h, fps) and
// files on disk. The frame shows drawing d of shot s (time.js), so all master frames with the same key
// `${shot.id}#${d}` are identical: render.mjs renders each key once and hard-links the held frames.

import { FPS, TM, EPS, setTiming, drawIndex, drawTime } from './time.js';
import { makeLayout } from './layout.js';
import { loadJSON, makeCanvas } from './assets.js';
import { loadFonts, setFont } from './fonts.js';
import { loadPlateIndex, PLATES } from './plates.js';
import { SCENES, SHOTS, finalize, shotAtFrame, shotById, gaps } from './registry.js';
import { rng, strSeed } from './core.js';
import { getGL } from './gl.js';

const Q = new URLSearchParams(location.search);
export const W = +(Q.get('w') || 1920), H = +(Q.get('h') || 1080);
export const RENDER = Q.has('render'), DEBUG = Q.has('debug');
export const OUT = document.getElementById('out') || document.body.appendChild(document.createElement('canvas'));
OUT.width = W; OUT.height = H;
const g = OUT.getContext('2d', { alpha: false });
export const L = makeLayout(W, H);

const HALYS = window.HALYS = { ready: false, error: null, W, H, FPS };

// ---------------------------------------------------------------- frames
export const frameAt = t => Math.floor(t * FPS + EPS);         // the master frame on screen at song time t
export const nFrames = () => Math.ceil(TM.dur * FPS - EPS);

export function frameInfo(i) {
  const s = shotAtFrame(i);
  if (!s) return { i, shot: null, d: 0, t: i / FPS, key: DEBUG ? `gap@${i}` : 'gap' };
  const d = drawIndex(i, s.F0, s.cadence);
  return { i, shot: s, d, t: drawTime(s.F0, s.cadence, d), key: `${s.id}#${d}` + (DEBUG ? `@${i}` : '') };
}

const LAYERS = [];
function layer(n) { // pooled output-size canvases, cleared on request
  if (!LAYERS[n]) { const c = makeCanvas(W, H); LAYERS[n] = { c, g: c.getContext('2d') }; }
  const Ly = LAYERS[n]; resetCtx(Ly.g); Ly.g.clearRect(0, 0, W, H); return Ly;
}
function resetCtx(c) {
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
  c.shadowBlur = 0; c.shadowColor = 'rgba(0,0,0,0)'; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'low';
  c.fontStretch = 'normal'; c.textAlign = 'start'; c.textBaseline = 'alphabetic'; c.lineCap = 'butt'; c.lineJoin = 'miter'; c.setLineDash([]);
}

function buildContext(fi, target = g) {
  const s = fi.shot, seed = strSeed(fi.key);
  return {
    i: fi.i, t: fi.t, lt: fi.t - s.t0, k: (fi.t - s.t0) / s.dur, d: fi.d, cad: s.cadence, dur: s.dur, shot: s,
    params: s.params || {}, world: s.world, framing: L.pick(s.framing) || null, W, H, L, g: target, seed, rng: rng(seed), layer,
    // draw another scene (e.g. the next world, for a transition through the disk) into target g2
    drawScene: async (name, overrides = {}, g2 = target) => {
      const sc = SCENES.get(name); if (!sc) throw new Error(`no scene ${name}`);
      resetCtx(g2); await sc.draw({ ...buildContext(fi, g2), ...overrides, g: g2 }); resetCtx(g2);
    },
  };
}

export async function renderFrame(i) {
  const fi = frameInfo(i);
  resetCtx(g);
  Math.random = rng(strSeed(fi.key));       // safety net: even stray Math.random() calls are deterministic per drawing
  if (!fi.shot) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); return fi; }
  await SCENES.get(fi.shot.scene).draw(buildContext(fi));
  resetCtx(g);
  if (DEBUG) {
    setFont(g, 'monoBold', Math.round(20 * L.u)); g.textBaseline = 'top'; g.fillStyle = '#ff0';
    g.fillText(`f${i} ${(i / FPS).toFixed(3)}s → ${fi.key} @${fi.t.toFixed(3)}s`, 12, 12);
  }
  return fi;
}

const encode = (type = 'image/jpeg', q = .93) => OUT.toDataURL(type, q);

// ---------------------------------------------------------------- sheet items
// "all" | "12.5" (seconds) | "f750" (master frame) | "drop1" (shot midpoint) | "drop1@0.25" (fraction of the shot)
// | "drop1+1.5" (seconds into the shot) | "drop1*4" (4 evenly spaced) ; comma-separated
export function resolveItems(spec) {
  const out = [];
  for (const raw of String(spec).split(',').map(s => s.trim()).filter(Boolean)) {
    let m;
    if (raw === 'all') { for (const s of SHOTS) out.push(frameAt((s.t0 + s.t1) / 2)); continue; }
    if ((m = raw.match(/^f(\d+)$/))) { out.push(+m[1]); continue; }
    if (/^-?\d+(\.\d+)?$/.test(raw)) { out.push(frameAt(+raw)); continue; }
    m = raw.match(/^([A-Za-z_][\w-]*)(?:([@+*])(\d+(?:\.\d+)?))?$/);
    const s = m && shotById(m[1]);
    if (!s) throw new Error(`sheet item "${raw}": not a time, frame or shot id`);
    const [op, v] = [m[2], +m[3]];
    if (op === '*') { for (let k = 0; k < v; k++) out.push(Math.max(s.F0, Math.min(s.F1 - 1, frameAt(s.t0 + s.dur * (k + .5) / v)))); continue; }
    const t = op === '@' ? s.t0 + v * s.dur : op === '+' ? s.t0 + v : (s.t0 + s.t1) / 2;
    out.push(Math.max(s.F0, Math.min(s.F1 - 1, frameAt(t))));
  }
  return out;
}

// ---------------------------------------------------------------- API
Object.assign(HALYS, {
  frameInfo: i => { const f = frameInfo(i); return { i, key: f.key, shot: f.shot && f.shot.id, d: f.d, t: f.t }; },
  keys: (i0, i1) => { const k = []; for (let i = i0; i <= i1; i++) k.push(frameInfo(i).key); return k; },
  // render master frame i; returns the encoded image and timings (draw vs encode)
  frame: async (i, type, q) => {
    const t0 = performance.now(), fi = await renderFrame(i), t1 = performance.now(), url = encode(type, q);
    return { url, key: fi.key, drawMs: t1 - t0, encMs: performance.now() - t1 };
  },
  // the deterministic entry point: song time t (s) -> encoded frame (the master frame on screen at t)
  renderAt: async (t, type, q) => { await renderFrame(frameAt(t)); return encode(type, q); },
  draw: i => renderFrame(i),
  shots: () => SHOTS.map(s => ({ id: s.id, t0: s.t0, t1: s.t1, F0: s.F0, F1: s.F1, world: s.world, cadence: s.cadence, scene: s.scene, plate: s.plate ? s.plate.id : null })),
  resolve: spec => resolveItems(spec),
  sheet: async (spec, cols = 4, w = 480) => {
    const items = resolveItems(spec), h = Math.round(w * H / W), lab = 22, rows = Math.ceil(items.length / cols);
    const S = makeCanvas(cols * w, rows * (h + lab)), c = S.getContext('2d'), ms = [];
    c.fillStyle = '#1c1c1e'; c.fillRect(0, 0, S.width, S.height);
    for (let k = 0; k < items.length; k++) {
      const t0 = performance.now(), fi = await renderFrame(items[k]); ms.push(performance.now() - t0);
      const x = (k % cols) * w, y = Math.floor(k / cols) * (h + lab);
      c.drawImage(OUT, x, y, w, h);
      setFont(c, 'mono', 13); c.fillStyle = '#ddd'; c.textBaseline = 'top';
      c.fillText(`${(items[k] / FPS).toFixed(2)}s f${items[k]} ${fi.shot ? fi.shot.id : 'gap'} ${fi.shot ? fi.shot.cadence + 'fps #' + fi.d : ''} ${ms[k].toFixed(0)}ms`, x + 5, y + h + 4);
    }
    return { url: S.toDataURL('image/jpeg', .9), ms, items };
  },
  info: () => {
    let webgl = null; try { webgl = getGL(16, 16).info(); } catch (e) { webgl = { error: String(e) }; }
    const n = nFrames(), gp = gaps(n);
    return { W, H, FPS, dur: TM.dur, frames: n, timing: TM.loaded, bpm: +TM.bpm.toFixed(2), plates: Object.keys(PLATES), webgl,
      shots: SHOTS.length, gaps: gp.map(([a, b]) => [a / FPS, b / FPS]), warnings: HALYS.warnings, bootMs: HALYS.bootMs };
  },
});

(async function boot() {
  const t0 = performance.now();
  try {
    await loadFonts();
    setTiming(await loadJSON('data/timing.json', { optional: true }));
    if (Q.get('dur')) TM.dur = +Q.get('dur');   // render.mjs passes the real song length (ffprobe)
    await loadPlateIndex();
    await import('./edit.js');                  // after timing: an edit may place cuts with beatTime() / TM.sections
    HALYS.warnings = finalize();
    for (const sc of SCENES.values()) if (sc.init) await sc.init({ W, H, L });
    HALYS.bootMs = Math.round(performance.now() - t0);
    HALYS.ready = true;
    if (!RENDER) (await import('./studio.js')).start();
  } catch (e) {
    HALYS.error = String((e && e.stack) || e);
    console.error(e);
  }
})();
