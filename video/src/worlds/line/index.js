// index.js: the line engine's public API (see README.md). Drop 1 (scenes/drop1.js), ORBIT (Drop 2) and the
// transitions draw through these functions; nothing here knows about shots.
//
//   await drawLines(f, opts)        one call per frame: plate layer (+ corona + sky field) + extra layers -> f.g
//   await plateLines(f, src, opts)  the cached line set of a plate window (CPU lines + GPU mesh + meta)
//   coronaRing(f, key, sun, opts)   a corona as its own layer (screen space), e.g. the centre-locked ring
//   dynLayer(lines, u)              a per-frame layer from lines built this frame (particles, membranes, ...)
//   project(cam, x, y, d)           the vertex shader's camera in JS (plate px -> screen px), for disks, HUD anchors
//   audio helpers: see audio.js (kickEnv, onFrames, flowPhase, ...)
//
// Every result is a pure function of (frame context, opts): caches hold only things computed from their keys.

import { lineGL, lin } from './gpu.js';
import { sourceFields, resolve } from './source.js';
import { TRACE_DEFAULTS, prepFields, traceLines, decorate, contourLines, armyTicks, liftDepth, FL } from './trace.js';
import { coronaLines, skyField } from './corona.js';
import { samp } from './analysis.js';
import { LRU } from '../../assets.js';
import { clamp } from '../../core.js';

export { FL } from './trace.js';
export { coronaLines, skyField } from './corona.js';
export { sourceFields, resolve } from './source.js';
export * as audio from './audio.js';

export const PALETTE = { pearl: '#f3efe6', orange: '#f08a2a', red: '#d6452c', bg: '#05070c', ink: '#030407' };
const colorsOf = p => ({ pearl: lin(p.pearl), orange: lin(p.orange), red: lin(p.red), bg: lin(p.bg), ink: lin(p.ink) });

// ---------------------------------------------------------------- caches
const LINES = new LRU(24);            // CPU line sets (by key)
const MESHES = new Map();             // GPU meshes (by key), LRU-trimmed by hand so buffers are freed
const MESH_MAX = 16;
function meshCached(gl, key, build) {
  if (MESHES.has(key)) { const m = MESHES.get(key); MESHES.delete(key); MESHES.set(key, m); return m; }
  const m = gl.mesh(build());
  MESHES.set(key, m);
  while (MESHES.size > MESH_MAX) { const k = MESHES.keys().next().value; MESHES.get(k).dispose(); MESHES.delete(k); }
  return m;
}
const stable = o => JSON.stringify(o, (k, v) => typeof v === 'function' ? String(v) : (typeof v === 'number' ? +v.toFixed(5) : v));

// ---------------------------------------------------------------- camera (JS twin of the vertex shader)
// cam: { yaw, pitch (deg), zoom (overscan), pan: [x, y] px, focal (x W), zNear, zFar, skyZ, pivot (depth 0..1) }
export function camUniforms(W, H, meta, cam = {}) {
  const zn = cam.zNear ?? 1, zf = cam.zFar ?? 2.6, skyZ = cam.skyZ ?? 1.25, focal = (cam.focal ?? 1.2) * W;
  const Dp = cam.pivot ?? meta.pivot ?? .5, zp = 1 / (Dp * (1 / zn - 1 / zf) + 1 / zf);
  const yaw = (cam.yaw || 0) * Math.PI / 180, pitch = (cam.pitch || 0) * Math.PI / 180;
  const c = cam.center || [W / 2, H / 2];
  return {
    uS: meta.S ?? 1, uOff: meta.off || [0, 0], uCam: [focal, zn, zf, skyZ], uZp: zp, uRot: [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)],
    uOver: cam.zoom ?? 1, uPan: cam.pan || [0, 0], uC: c, uXf0: meta.xf ? meta.xf[0] : [1, 0, 0], uXf1: meta.xf ? meta.xf[1] : [0, 1, 0],
  };
}
export function project(u, x, y, d) {
  const px = u.uXf0[0] * x + u.uXf0[1] * y + u.uXf0[2], py = u.uXf1[0] * x + u.uXf1[1] * y + u.uXf1[2];
  const sx = px * u.uS + u.uOff[0], sy = py * u.uS + u.uOff[1];
  const [F, zn, zf, skyZ] = u.uCam, z = d < -.5 ? zf * skyZ : 1 / (clamp(d) * (1 / zn - 1 / zf) + 1 / zf);
  const X = (sx - u.uC[0]) / F * z, Y = (sy - u.uC[1]) / F * z, Z = z - u.uZp;
  const x1 = X * u.uRot[0] + Z * u.uRot[1], z1 = -X * u.uRot[1] + Z * u.uRot[0];
  const y2 = Y * u.uRot[2] - z1 * u.uRot[3], z2 = Y * u.uRot[3] + z1 * u.uRot[2] + u.uZp;
  return [u.uC[0] + F * u.uOver * x1 / Math.max(z2, 1e-3) + u.uPan[0], u.uC[1] + F * u.uOver * y2 / Math.max(z2, 1e-3) + u.uPan[1], z2];
}

// ---------------------------------------------------------------- plate line sets
// opts.trace: TRACE_DEFAULTS overrides (sky, sun, pool, armies, river, ...); opts.corona: false | coronaLines opts;
// opts.skyField: false | skyField opts; opts.aw: analysis width (default 960)
export async function plateLines(f, src, opts = {}) {
  const W = f.W, H = f.H, aspect = W / H, aw = opts.aw ?? 960;
  const F = await sourceFields(src, opts.tp ?? 0, aw, aspect, opts.analysis || {});
  const key = 'P|' + F.key + '|' + W + 'x' + H + '|' + stable({ t: opts.trace, c: opts.corona, s: opts.skyField, x: opts.extra });
  let L = LINES.get(key);
  if (!L) { const t0 = performance.now(); L = buildPlate(F, opts, W, H); L.ms = Math.round(performance.now() - t0); L.key = key; LINES.set(key, L); }
  return L;
}
function buildPlate(F, opts, W, H) {
  const S = W / F.aw;
  const c = { ...TRACE_DEFAULTS, ...(opts.trace || {}), S };
  const f = prepFields(F, c);
  f.Db = liftDepth(F, c);
  const stream = c.stream === false ? [] : decorate(F, f, traceLines(F, f, c), c);
  const cont = contourLines(F, f, c);
  const ticks = armyTicks(F, f, c);
  const vis = c.sky ? (x, y) => x >= 0 && y >= 0 && x < F.aw - 1 && y < F.ah - 1 && samp(F, f.sky, x, y) > .5 : null;
  let cor = [], sky = [];
  if (f.sun && opts.corona !== false) cor = coronaLines(f.sun, { ...(opts.corona || {}), scale: S, visible: vis });
  if (f.sun && opts.skyField) sky = skyField(f.sun, { ...opts.skyField, scale: S, visible: vis });
  // pivot depth for the orbit: median depth of the subject (or of the central region)
  let pivot = .5;
  if (F.D) {
    const vals = [];
    if (F.M) for (let i = 0; i < F.N; i += 7) if (F.M[i] > .5) vals.push(f.Db ? f.Db[i] : F.D[i]);
    if (!vals.length) for (let y = F.ah * .3 | 0; y < F.ah * .7; y += 4) for (let x = F.aw * .3 | 0; x < F.aw * .7; x += 4) vals.push(F.D[y * F.aw + x]);
    vals.sort((a, b) => a - b); if (vals.length) pivot = vals[vals.length >> 1];
  }
  const lines = [...stream, ...cont, ...ticks, ...cor, ...sky];
  let nv = 0; for (const l of lines) nv += l.n;
  return { lines, F, f, meta: { S, off: [0, 0], aw: F.aw, ah: F.ah, sun: f.sun, pivot, kind: F.kind, id: F.id, frame: F.frame }, counts: { stream: stream.length, contour: cont.length, ticks: ticks.length / 2, corona: cor.length, sky: sky.length, verts: nv } };
}

// the corona alone as a static mesh in sun units (centre 0, radius 1), placed per frame with ringU(cx, cy, R):
// centre-locked rings, inserts, collapses. opts.refR: the radius (px at this output size) used for arc lengths.
export function coronaRing(f, key, opts = {}) {
  const gl = lineGL(f.W, f.H), refR = opts.refR ?? 100, k = 'R|' + key + '|' + f.W + 'x' + f.H + '|' + stable(opts);
  return meshCached(gl, k, () => {
    const lines = opts.corona === false ? [] : coronaLines({ x: 0, y: 0, r: 1, tilt: opts.tilt ?? .5 }, { ...(opts.corona || {}), scale: refR });
    const sky = opts.skyField ? skyField({ x: 0, y: 0, r: 1 }, { ...opts.skyField, scale: refR, extent: opts.skyField.extent ?? (Math.hypot(f.W, f.H) / refR) }) : [];
    return [...lines, ...sky];
  });
}
// uniforms that place a unit-space mesh at (cx, cy) with radius R (screen px)
export const ringU = (cx, cy, R) => ({ uXf0: [R, 0, cx], uXf1: [0, R, cy], uS: 1, uOff: [0, 0] });

// ---------------------------------------------------------------- one frame
// opts: {
//   src, tp, trace, corona, skyField, aw      plate layer (omit src for none)
//   cam: {yaw, pitch, zoom, pan, focal, pivot}
//   kick: 0..1, kickWidth (x), kickPush (px at 1080), invert, phase (pulse travel), pulse, lambda
//   look: {exposure, glow: [w1, w2], vignette, fade, bright, flat, white, width, endFade, soft}
//   reveal: {x, y, r, ramp} (screen px: lines inside r hidden), disk: {x, y, r} | 'sun' | false, ring: {r, w, i}
//   layers: [{ mesh | lines, u }] drawn after the plate layer (u: uniform overrides, e.g. from camUniforms)
//   palette, flash }
// returns { sun: [x, y, r] on screen | null, plate: meta, ms }
export async function drawLines(f, opts = {}) {
  const t0 = performance.now(), W = f.W, H = f.H, gl = lineGL(W, H), s1080 = H / 1080;
  const look = opts.look || {}, kick = opts.kick || 0;
  const base = {
    uT: opts.phase ?? 0, uLambda: (opts.lambda ?? 70) * s1080, uPulse: opts.pulse ?? .5, uKick: kick * (opts.kickGain ?? 1),
    uBright: look.bright ?? 1, uFlat: look.flat ?? 0, uWhite: look.white ?? 0, uEndFade: (look.endFade ?? 10) * s1080,
    uWidth: (look.width ?? 1) * s1080, uKickW: (opts.kickWidth ?? 1.1) * kick, uMinW: look.minW ?? 0,
  };
  const layers = [];
  let sunS = null, meta = null, plateU = null;
  if (opts.src) {
    const P = await plateLines(f, opts.src, opts);
    meta = P.meta;
    const mesh = meshCached(gl, P.key, () => P.lines);
    plateU = { ...camUniforms(W, H, meta, opts.cam || {}) };
    if (meta.sun) { const p = project(plateU, meta.sun.x, meta.sun.y, -1); sunS = [p[0], p[1], meta.sun.r * meta.S * plateU.uOver]; }
    const pc = opts.pushCenter || (sunS ? [sunS[0], sunS[1]] : [W / 2, H / 2]);
    plateU.uPush = [pc[0], pc[1], (opts.kickPush ?? 26) * s1080 * kick + (opts.push || 0) * s1080, (opts.pushFall ?? 500) * s1080];
    if (opts.reveal) plateU.uReveal = [opts.reveal.x, opts.reveal.y, opts.reveal.r, opts.reveal.ramp ?? 60 * s1080];
    layers.push({ meshes: [mesh, ...(opts.plateExtra || [])], u: { ...base, ...plateU, ...(opts.plateU || {}) } });
  }
  for (const Ly of opts.layers || []) {
    if (!Ly) continue;
    const meshes = [...(Ly.meshes || []), ...(Ly.mesh ? [Ly.mesh] : [])];
    if (Ly.lines) { const m = gl.mesh(Ly.lines, { dynamic: true }); meshes.push(m); (layers._tmp ||= []).push(m); }
    const u = { ...base, uPush: [W / 2, H / 2, 0, 500 * s1080], ...(Ly.cam ? camUniforms(W, H, Ly.meta || { S: 1 }, Ly.cam) : {}), ...(Ly.u || {}) };
    layers.push({ meshes, u });
  }
  let disk = null;
  if (opts.disk === 'sun' || (opts.disk == null && sunS && opts.corona !== false)) disk = sunS ? { x: sunS[0], y: sunS[1], r: sunS[2] } : null;
  else if (opts.disk) disk = opts.disk;
  const canvas = gl.render(layers, {
    colors: colorsOf({ ...PALETTE, ...(opts.palette || {}) }), glow: look.glow, exposure: look.exposure, vignette: look.vignette, fade: look.fade,
    invert: !!opts.invert, disk, ring: opts.ring || null, flash: opts.flash || 0, soft: look.soft || 0,
  });
  if (layers._tmp) for (const m of layers._tmp) m.dispose();
  const g = f.g;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.drawImage(canvas, 0, 0, W, H); g.restore();
  return { sun: sunS, plate: meta, u: plateU, ms: Math.round(performance.now() - t0) };
}

// a layer drawn from lines built this frame (uploaded and freed within the frame)
export const dynLayer = (lines, u = {}, cam = null, meta = null) => ({ lines, u, cam, meta });
