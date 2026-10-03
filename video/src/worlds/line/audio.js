// audio.js: the music as numbers the line engine reacts to (all pure functions of song time).
//
// Events snap to the master frame grid the way cuts do: an event at song time te belongs to the first master frame
// at or after te, so a kick's pulse peaks exactly on that frame (0-16.7 ms after the audio onset at 60 fps).
//   kickEnv(t, tau)        1 on a kick frame, decaying exponentially (tau s); 0 where the kick is out
//   kickIndex(t)           index of the last kick at or before t (-1 before the first)
//   onFrames(t, times, n)  true on the n frames starting at each event's frame (2-frame stab inversions)
//   flowPhase(t, base, gain)  integral of (base + gain * low band) dt: pulse travel that speeds up with the bass
//   lowBand(t)             the 24 fps low-band envelope (0..1)
//   stabTimes(), kickTimes(), stutterTimes(), chopTimes(word)

import { TM, FPS, curve } from '../../time.js';

export const frameOf = t => Math.ceil(t * FPS - 1e-6);
export const snap = t => frameOf(t) / FPS;
const tOf = x => typeof x === 'number' ? x : (x && (x.t ?? x.t0));

let _k = null, _s = null, _cum = null;
export function kickTimes() { return _k ||= (TM.events.kicks || []).map(tOf).filter(Number.isFinite).map(snap).sort((a, b) => a - b); }
export function stabTimes(minS = 0) { const all = (TM.events.stabs || []).filter(s => (s.s ?? 1) >= minS).map(tOf).filter(Number.isFinite); return all.sort((a, b) => a - b); }
export const stutterTimes = () => TM.chops.filter(c => c.word === 'stutter').map(c => c.t).sort((a, b) => a - b);
export const chopTimes = word => TM.chops.filter(c => !word || c.word === word).map(c => c.t);

function lastBefore(arr, t) { let lo = 0, hi = arr.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m] <= t + 1e-6) { r = m; lo = m + 1; } else hi = m - 1; } return r; }
export function kickIndex(t) { return lastBefore(kickTimes(), t); }
export function kickEnv(t, tau = .12, maxGap = .7) {
  const k = kickTimes(), i = lastBefore(k, t); if (i < 0) return 0;
  const dt = t - k[i]; if (dt > maxGap) return 0;
  return Math.exp(-dt / tau);
}
// time since the last event in a list (snapped), Infinity before the first
export function since(t, times) { const s = times.map(snap).sort((a, b) => a - b), i = lastBefore(s, t); return i < 0 ? Infinity : t - s[i]; }
export function onFrames(t, times, n = 2) {
  const i = Math.round(t * FPS);
  for (const te of times) { const j = frameOf(te); if (i >= j && i < j + n) return true; }
  return false;
}
export const lowBand = t => curve('low', t);
export function flowPhase(t, base = .35, gain = .9) {
  const C = TM.curves; if (!C || !C.low) return t * (base + gain * .8);
  const fps = C.fps || 24, a = C.low;
  if (!_cum) { _cum = new Float64Array(a.length + 1); for (let i = 0; i < a.length; i++) _cum[i + 1] = _cum[i] + a[i] / fps; }
  const x = Math.max(0, Math.min(a.length - 1e-6, (t - (C.t0 || 0)) * fps)), i = Math.floor(x), fr = x - i;
  return base * t + gain * (_cum[i] + a[i] * fr / fps);
}
