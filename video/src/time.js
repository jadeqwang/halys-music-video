// time.js: the master timeline, per-shot draw cadence, and the song's timing data.
//
// MASTER TIMELINE. The film is rendered at FPS master frames per second (60 by default; ?fps= overrides,
// render.mjs --fps). Master frame i shows song time i / FPS.
//
// DRAW CADENCE. Each shot declares how often it is redrawn: 12 (painted worlds, "on fives" at 60 fps),
// 30 (marble), 60 (corona / orbit: every frame), or any rate. Between draws the previous drawing is held:
// a shot starting at master frame F0 with cadence c shows drawing d = floor((i - F0) * c / FPS) at frame i,
// and that drawing is rendered at song time F0 / FPS + d / c. Draws restart at every cut, so each shot
// opens on a fresh drawing exactly at its first frame. With c dividing FPS every hold is FPS / c frames
// long (60/12 = 5, 60/30 = 2); other rates (24 on a 60 master) give uneven 3:2 holds and are allowed.
//
// Because a held frame is a pure function of (shot, drawing), render.mjs renders one frame per drawing and
// hard-links the held copies (see frameKey()).

import { clamp, frac } from './core.js';

const Q = new URLSearchParams(location.search);
export const FPS = +(Q.get('fps') || 60);
export const EPS = 1e-6;

// first master frame at or after song time t (cuts land on the first frame whose time is >= the cut)
export const frameAtOrAfter = t => Math.ceil(t * FPS - EPS);
export const frameTime = i => i / FPS;

// The drawing shown at master frame i inside a shot that starts at frame F0 with cadence c.
export function drawIndex(i, F0, c) { return Math.floor((i - F0) * c / FPS + EPS); }
export function drawTime(F0, c, d) { return F0 / FPS + d / c; }

// ---------------------------------------------------------------- timing data (video/data/timing.json)
// Owned by the audio tools (tools/audio/). Loaded leniently: any of these fields may be absent.
//   dur        song length in s                 beats      [t, ...] (measured; the tempo drifts 136.5 -> 142 BPM)
//   downbeats  [t, ...] or downbeat_idx [i...]  sections   [[name, t0, t1], ...] or [{name, t0|start, t1|end}, ...]
//   lines / words                              lyric timings, passed through untouched
//   curves     {fps, rms: [...], vocal: [...], ...} feature envelopes for audio-reactive drawing
export const TM = { dur: 273.6, bpm: 140, beat: 60 / 140, t0: 0.147, beats: [], downbeats: [], sections: [], lines: [], words: [], curves: null, loaded: false };

export function setTiming(d) {
  if (!d) return TM;
  if (d.dur) TM.dur = +d.dur;
  const beats = (d.beats || []).map(b => typeof b === 'number' ? b : (b.t ?? b.time)).filter(Number.isFinite);
  if (beats.length > 1) {
    TM.beats = beats; TM.t0 = beats[0];
    const ibi = beats.slice(1).map((b, i) => b - beats[i]).sort((a, b) => a - b);
    TM.beat = ibi[ibi.length >> 1]; TM.bpm = 60 / TM.beat;
  } else if (d.bpm) { TM.bpm = +d.bpm; TM.beat = 60 / TM.bpm; TM.t0 = +(d.t0 || 0); }
  if (d.downbeats) TM.downbeats = d.downbeats.map(Number);
  else if (d.downbeat_idx && TM.beats.length) TM.downbeats = d.downbeat_idx.map(i => TM.beats[i]).filter(Number.isFinite);
  TM.sections = (d.sections || []).map(s => Array.isArray(s) ? { name: s[0], t0: +s[1], t1: +s[2] } : { name: s.name || s.label, t0: +(s.t0 ?? s.start), t1: +(s.t1 ?? s.end) });
  TM.lines = d.lines || []; TM.words = d.words || [];
  TM.curves = d.curves || null;
  TM.loaded = true;
  return TM;
}

// continuous beat position (beat k sits at TM.beats[k]); falls back to a constant grid without data
export function beatPos(t) {
  const b = TM.beats;
  if (b.length < 2) return (t - TM.t0) / TM.beat;
  if (t <= b[0]) return (t - b[0]) / TM.beat;
  let lo = 0, hi = b.length - 1;
  if (t >= b[hi]) return hi + (t - b[hi]) / TM.beat;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (b[m] <= t) lo = m; else hi = m; }
  return lo + (t - b[lo]) / (b[lo + 1] - b[lo]);
}
export const beatN = t => Math.floor(beatPos(t) + EPS);
export function beatTime(n) {
  const b = TM.beats;
  if (b.length < 2) return TM.t0 + n * TM.beat;
  if (n < 0) return b[0] + n * TM.beat;
  if (n >= b.length) return b[b.length - 1] + (n - b.length + 1) * TM.beat;
  return b[n];
}
// 1 on each beat (or every Nth), decaying exponentially (k per second)
export function pulse(t, k = 8, every = 1) {
  const bp = beatPos(t) / every;
  if (bp < 0) return 0;
  return Math.exp(-k * frac(bp) * TM.beat * every);
}
export function sectionAt(t) { return TM.sections.find(s => t >= s.t0 && t < s.t1) || null; }
// sample a feature curve (linear interpolation); 0 when the curve is missing
export function curve(name, t) {
  const C = TM.curves; if (!C || !C[name]) return 0;
  const a = C[name], fps = C.fps || 24, x = clamp(t * fps, 0, a.length - 1), i = Math.floor(x), k = x - i;
  return i + 1 < a.length ? a[i] * (1 - k) + a[i + 1] * k : a[i];
}
