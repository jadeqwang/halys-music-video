#!/usr/bin/env node
// check_timing.mjs: are the room's visual events on the frame where their sound starts?
//
//   node production/review/room/check_timing.mjs [--frames=video/out/frames_room] [--song=media/stems/halys_sd_master.wav]
//
// 1. measures each sound event's onset in the final mix (the sound-design master): the final chord, the three key clicks,
//    the wink's ting (peak spectral flux in the event's band, 2 ms hops, within +-90 ms of SOUND_DESIGN.md's cue time);
// 2. reads the INK x-sheets (video/src/worlds/ink/sheets.js, the same data the renderer uses) for the frame each visual
//    event lands on: the three key-press drawings, the eyelid fully shut, the cut to black. (v2: the chair spin is gone;
//    the final chord is now the edit's cut from S78 to TREATY's S79, reported for information, not judged here);
// 3. if rendered frames exist, checks the pixels: the picture changes ON the event frame (ROI difference to the previous
//    frame vs. the frame before), and for the wink the first frame with no white of the eye left in the eye ROI.
// Master clock: 60 fps; frame i shows song time i/60; "on time" = the first frame at or after the onset (0 frames late).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { roomSheets, EV, lidAt, TAKES } from '../../../video/src/worlds/ink/sheets.js';
import { frameAt, FPS } from '../../../video/src/worlds/ink/xsheet.js';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const s = a.replace(/^--/, ''), i = s.indexOf('='); return i < 0 ? [s, true] : [s.slice(0, i), s.slice(i + 1)]; }));
const SONG = resolve(ROOT, args.song || 'media/stems/halys_sd_master.wav');
const FRAMES = resolve(ROOT, args.frames || 'video/out/frames_room');

function pcm(t0, dur) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(t0), '-t', String(dur), '-i', SONG, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], { maxBuffer: 1 << 26 });
  const b = r.stdout; return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
}
function fft(re, im) {          // in place, radix 2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let j = 0; j < len / 2; j++) {
      const ur = re[i + j], ui = im[i + j], vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
      re[i + j] = ur + vr; im[i + j] = ui + vi; re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
      const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
}
// onset = peak spectral flux (log-magnitude rise, 1024-pt Hann frames, 2 ms hops) in a band, within +-90 ms of the cue
function onset(t, { f0 = 0, f1 = 24000, win = .09 } = {}) {
  const n = 1024, hop = 96, pre = .25, x = pcm(t - pre - n / 48000, pre + win + .1 + 2 * n / 48000);
  const frames = Math.floor((x.length - n) / hop), w = new Float32Array(n).map((_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (n - 1)));
  const b0 = Math.floor(f0 / 48000 * n), b1 = Math.min(n / 2, Math.ceil(f1 / 48000 * n));
  let prev = null, best = -1, bt = t;
  for (let k = 0; k < frames; k++) {
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = x[k * hop + i] * w[i];
    fft(re, im);
    const L = new Float64Array(b1 - b0); for (let b = b0; b < b1; b++) L[b - b0] = Math.log1p(Math.hypot(re[b], im[b]) * 100);
    if (prev) {
      let fl = 0; for (let b = 0; b < L.length; b++) fl += Math.max(0, L[b] - prev[b]);
      const tc = t - pre - n / 48000 + (k * hop + n / 2) / 48000;
      if (tc > t - win && tc < t + win && fl > best) { best = fl; bt = tc; }
    }
    prev = L;
  }
  return { t: bt, rise: best };
}

const SH = roomSheets(TAKES);
const visual = {
  chord: frameAt(EV.shots.S78[1]),                       // the cut S78 -> S79 (SHOTLIST 270.04, TREATY's shot follows)
  keys: SH.close.filter(e => e.tag === 'key').map(e => e.F),
  ting: (() => { for (let i = frameAt(EV.ting) - 40; i < frameAt(EV.ting) + 40; i++) if (lidAt(i / FPS) >= 1) return i; return null; })(),
  black: frameAt(EV.black),
};
const CUE = { chord: 270.04, keys: [273.45, 274.05, 274.95], ting: 276.95 };     // SOUND_DESIGN.md cue times
const audio = { chord: onset(CUE.chord), keys: CUE.keys.map(t => onset(t, { f0: 1500, f1: 16000 })), ting: onset(CUE.ting, { f0: 2600, f1: 4400 }) };

// ---------------------------------------------------------------- pixels (optional)
const fpath = i => `${FRAMES}/f${String(i).padStart(5, '0')}.jpg`;
function roi(i, [x, y, w, h]) {
  if (!existsSync(fpath(i))) return null;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', fpath(i), '-vf', `crop=${w}:${h}:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
  return r.stdout;
}
const mad = (a, b) => { if (!a || !b) return null; let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
function changeAt(F, box) {
  const a = roi(F - 2, box), b = roi(F - 1, box), c = roi(F, box);
  if (!a || !b || !c) return null;
  return { before: mad(a, b), at: mad(b, c) };
}
const whites = buf => { if (!buf) return null; let n = 0; for (let i = 0; i < buf.length; i += 3) { const r = buf[i], g = buf[i + 1], b = buf[i + 2]; if (r > 225 && g > 225 && b > 220 && Math.max(r, g, b) - Math.min(r, g, b) < 18) n++; } return n; };
const ROI = { cut: [0, 0, 1920, 1080], sleeve: [0, 640, 760, 440], eye: [1000, 420, 220, 120] };   // eye: her left (frame right), P58

const row = (name, Fv, a) => {
  const Fa = frameAt(a.t);
  return { name, onset: +a.t.toFixed(4), onsetFrame: Fa, visualFrame: Fv, visualTime: +(Fv / FPS).toFixed(4), framesLate: Fv - Fa, flux: +a.rise.toFixed(0) };
};
const rows = [row('final chord / cut to S79 (info)', visual.chord, audio.chord), ...visual.keys.map((F, k) => row(`key click ${k + 1} / key-press drawing`, F, audio.keys[k])), row('ting / eyelid shut', visual.ting, audio.ting)];
console.log(`audio: ${SONG.replace(ROOT + '/', '')}   frames: ${existsSync(FRAMES) ? FRAMES.replace(ROOT + '/', '') : '(none rendered)'}   ${FPS} fps\n`);
console.log('event                               onset (s)   onset f   visual f   late (frames)   pixel check');
for (const r of rows) {
  let px = '';
  if (existsSync(FRAMES)) {
    const box = r.name.startsWith('final') ? ROI.cut : r.name.startsWith('key') ? ROI.sleeve : ROI.eye;
    if (r.name.startsWith('ting')) {
      const w0 = whites(roi(r.visualFrame - 1, box)), w1 = whites(roi(r.visualFrame, box));
      px = w0 == null ? 'frames missing' : `eye whites ${w0} -> ${w1} px`;
    } else {
      const c = changeAt(r.visualFrame, box);
      px = c ? `change before ${c.before.toFixed(2)} / on frame ${c.at.toFixed(2)}` : 'frames missing';
    }
  }
  console.log(`${r.name.padEnd(36)} ${r.onset.toFixed(3).padStart(9)}   ${String(r.onsetFrame).padStart(7)}   ${String(r.visualFrame).padStart(8)}   ${String(r.framesLate).padStart(13)}   ${px}`);
}
console.log(`\ncut to black: f${visual.black} (${(visual.black / FPS).toFixed(3)} s), ${((visual.black - visual.ting) / FPS).toFixed(2)} s after the eyelid shuts; audio ends ${EV.audioEnd} s, film ${EV.end} s`);
const bad = rows.filter(r => !r.name.includes('(info)') && Math.abs(r.framesLate) > 1);
console.log(bad.length ? `\nFAIL: ${bad.map(r => r.name).join(', ')} off by more than one frame` : '\nOK: every event within one frame of its sound');
process.exit(bad.length ? 1 : 0);
