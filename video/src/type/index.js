// type/index.js: the film's kinetic type system. Every on-screen word, caption, card and HUD element is drawn here,
// over the scene, from the text track (track.gen.js, built from production/SHOTLIST.md + timing.json by
// tools/type/build_track.py). See production/type/NOTES.md.
//
//   await drawText(t, f)     draw every text event active at song time t into f.g (main.js calls it once per frame,
//                            right after the scene, with the scene's own frame context f)
//   eventsAt(t)              the active events (for a scene that wants to compose around the type)
//   invertAt(t)              true on the S36 two-frame inversion frames (scenes invert their picture on the same frames)
//   counterAt(t, mag?)       the S18-S34 countdown string at t
//
// A scene steers the type through f.type (all optional; anything missing falls back to the track's defaults):
//   f.type.light   = { dir: [x, y] toward the light (screen, y down), elev 0..1, color '#hex', intensity, cool 0..1 }
//   f.type.sun     = { x, y, r }      eclipse disk in px (S28 ring text, CHOP field centre)
//   f.type.pupil   = { x, y, r }      S29
//   f.type.front   = { p 0..1 } | { y px }   S30 / S58 shadow front across the type block
//   f.type.disk    = { k 0..1 }       S27 eclipse of the letters (progress), S35 HAL override
//   f.type.magnitude, f.type.flash, f.type.backlit, f.type.invert, f.type.kick
//   f.type.screen  = { main: [[x,y] x4], side: [[x,y] x4] }   terminal quads (S78-S80)
//   f.type.plinth  = { quad: [[x,y] x4], draw: false }        S49 (draw: false when the scene paints the plinth)
//   f.type.place   = { [eventId]: { x, y, align, maxW, size } } layout overrides (fractions of the frame)
//   f.type.hide    = [eventId, ...]   f.type.manual = true (the scene calls drawText itself, e.g. under a foreground)

import TRACK from './track.gen.js';
import { scene, SHOTS } from '../registry.js';
import { FX, counterAt as _counterAt } from './effects.js';

const Q = new URLSearchParams(location.search);
const STANDIN = Q.has('typebg');
let standin = null;

export const EVENTS = TRACK.events;
export const eventsAt = t => EVENTS.filter(e => t >= e.t0 - 1e-6 && t < e.t1 - 1e-6);
export const counterAt = _counterAt;
export function invertAt(t, fps = 60) {
  for (const e of EVENTS) if (e.invert) for (const s of e.invert) if (t >= s - 1e-6 && t < s + 2 / fps - 1e-6) return true;
  return false;
}

export async function drawText(t, f, { fromScene = false } = {}) {
  if (!f || !f.shot) return;
  const T = f.type || (f.type = {});
  if (T.manual && !fromScene) return;
  if (STANDIN && f.shot.scene === 'placeholder') {
    standin ||= await import('./standin.js');
    await standin.draw(f);
  }
  const g = f.g;
  for (const e of eventsAt(t)) {
    if (T.hide && T.hide.includes(e.id)) continue;
    const fn = FX[e.fx];
    if (!fn) continue;
    g.save();
    try { await fn(g, f, e, t); } finally { g.restore(); }
  }
}

// The type layer as a scene: f.drawScene('type-layer', {}, g2) draws only the type (e.g. onto a layer a scene composites
// itself). Its init runs once after edit.js has registered every shot: the placeholder test card prints its own stand-in
// cue text, which this layer replaces, so the placeholder's copy of the cues is moved aside (params.typeCues).
scene('type-layer', f => drawText(f.t, f, { fromScene: true }), {
  init: () => {
    for (const s of SHOTS) {
      if (STANDIN) s.scene = 'placeholder';         // type look-dev (typebg): every shot over the stand-in, not the WIP scenes
      if (s.scene === 'placeholder' && s.params && s.params.cues) { s.params.typeCues = s.params.cues; delete s.params.cues; }
    }
  },
});
