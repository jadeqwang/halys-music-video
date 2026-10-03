// effects.js: one renderer per text-track fx. Each is (g, f, e, t) -> draws event e at song time t (f = the frame
// context: f.L layout, f.cad draw cadence, f.seed per-drawing seed, f.world, f.type scene parameters).
//
// Timing rule: a word gilds in on the drawing that contains its sung onset (at 12 fps up to one drawing early, which is
// what subtitle practice asks for: 2-4 frames ahead of the syllable); chops slam on the exact master frame.

import { FACE, C, LIGHT, applyFont, textWidth, glyphX, breakLines, layoutLines, fitBlock, byAspect, smartQuotes, ease, measure } from './style.js';
import { gild } from './gild.js';
import { chopWord, chopFit, chopEcho, halDisk } from './chop.js';
import { drawCartouche } from './cartouche.js';
import { drawTerminal } from './terminal.js';
import { clamp, lerp, smooth, strSeed, hash, hash2, kf, mixHex, rgba, TAU } from '../core.js';
import { beatPos, pulse, TM } from '../time.js';

// ---------------------------------------------------------------- shared
const WORLD_LIGHT = { bronze: 'bronze', gold: 'gold', marble: 'marble', corona: 'corona', orbit: 'orbit', room: 'end' };
function ctxOf(f, e, t) {
  const cad = f.cad || 60, T = f.type || {};
  return { t, tq: t + Math.min(1 / cad, .06) - 1e-4, cad, boil: cad <= 15 ? 1 : 0, seed: f.seed || 0, leaf: strSeed(e.id) % 997, L: f.L, T,
    light: T.light || LIGHT[e.light] || LIGHT[WORLD_LIGHT[f.world] || 'bronze'] };
}
const mixPal = (a, b, k) => a.map((c, i) => mixHex(c, b[i], clamp(k)));
// gild-in progress of a word sung at tw: the glint frontier crosses the word; something substantial shows on its first drawing
const sweepP = (tq, tw, n) => tq < tw ? -1 : clamp(.28 + (tq - tw) / clamp(.18 + .016 * n, .2, .42));
const fadeIn = (t, t0, d = .25) => smooth(clamp((t - t0) / d));
const u = L => L.u;
const placeOf = (f, e) => f.type && f.type.place && f.type.place[e.id];

// anchors: where a block sits per aspect (16:9 as the shot list says; portrait re-flows above/below the subject)
export function anchorPos(L, anchor) {
  const S = L.safe, P = L.portrait;
  switch (anchor) {
    case 'top': return { x: L.cx, y: S.y + .012 * L.H, align: 'center', valign: 'top', maxW: S.w * .84 };
    case 'bottom': return { x: L.cx, y: S.y + S.h - .012 * L.H, align: 'center', valign: 'bottom', maxW: S.w * (P ? 1 : .86) };
    case 'left': return P ? { x: L.cx, y: S.y + S.h - .03 * L.H, align: 'center', valign: 'bottom', maxW: S.w }
      : { x: S.x + .004 * L.W, y: .6 * L.H, align: 'left', valign: 'middle', maxW: .47 * L.W };
    case 'lowerLeft': return { x: S.x, y: S.y + S.h - .004 * L.H, align: 'left', valign: 'bottom', maxW: P ? S.w : .5 * L.W };
    case 'lower': return { x: L.cx, y: P ? .845 * L.H : .885 * L.H, align: 'center', valign: 'bottom', maxW: S.w * .94 };
    default: return { x: L.cx, y: L.cy, align: 'center', valign: 'middle', maxW: S.w * .8 };
  }
}
const SIZE = { hook: 74, lyric: 96, bottom: 84, small: 46, plaque: 29, plaqueHook: 34, inscr: 0, title: 150 };

// cached layout of a CARVED block: items stacked (an item may wrap), words positioned
const _lay = new Map();
function carvedLayout(e, f, { face = FACE.carved, size, anchor = e.anchor || 'left', lead = 1.18, items = e.items.filter(i => !i.ghost), maxW } = {}) {
  const L = f.L, pl = placeOf(f, e);
  const key = `${e.id}|${L.W}x${L.H}|${anchor}|${size}|${items.map(i => i.key).join(',')}|${pl ? JSON.stringify(pl) : ''}`;
  if (_lay.has(key)) return _lay.get(key);
  const A = { ...anchorPos(L, anchor) };
  if (pl) Object.assign(A, { x: pl.x != null ? pl.x * L.W : A.x, y: pl.y != null ? pl.y * L.H : A.y, align: pl.align || A.align, valign: pl.valign || A.valign, maxW: pl.maxW ? pl.maxW * L.W : A.maxW });
  const mw = maxW ?? A.maxW;
  let px = (pl && pl.size ? pl.size : size ?? SIZE[e.size] ?? (anchor === 'bottom' ? SIZE.bottom : SIZE.lyric)) * u(L);
  const allWords = items.map(it => it.text.split(' '));
  let lines = [];
  for (let k = 0; k < 30; k++, px *= .95) {
    if (allWords.some(ws => ws.some(w => textWidth(face, px, w) > mw))) continue;
    lines = []; allWords.forEach((ws, ii) => breakLines(ws, face, px, mw).forEach(l => lines.push({ ii, ws: l })));
    if (lines.length <= 4 || k > 25) break;
  }
  const lay = layoutLines(lines.map(l => l.ws), face, px, { x: A.x, y: A.y, align: A.align, valign: A.valign, lead });
  // map words back to items / word indices
  const counters = items.map(() => 0);
  lay.words.forEach(w => { const ii = lines[w.line].ii; w.item = ii; w.wi = counters[ii]++; });
  lay.lines = lines; lay.anchor = A;
  _lay.set(key, lay);
  return lay;
}

// onset of a positioned word: sung onset (reveal words), a sweep across the line (reveal line), or the item time
function onsetOf(e, it, w, lay) {
  if (it.reveal === 'words' && it.words && it.words[w.wi] && it.words[w.wi].t != null) return it.words[w.wi].t;
  if (it.reveal === 'words' && it.words) {               // punctuation token: right after the previous sung word
    for (let j = w.wi - 1; j >= 0; j--) if (it.words[j].t != null) return (it.words[j].e ?? it.words[j].t) - .05;
  }
  if (it.reveal === 'line') {
    const lw = lay.widths[w.line], x0 = Math.min(...lay.words.filter(v => v.line === w.line).map(v => v.x));
    return it.t + clamp((w.x - x0) / Math.max(lw, 1)) * .42;
  }
  return it.t;
}

// standard CARVED runs for a layout at time t (words that have started), with per-word modifiers
function carvedRuns(e, lay, c, mod) {
  const runs = [];
  for (const w of lay.words) {
    const it = e.items[w.item], on = onsetOf(e, it, w, lay);
    const p = it.reveal === 'none' ? (c.tq >= it.t ? 1 : -1) : sweepP(c.tq, on, w.text.length);
    if (p < 0) continue;
    const r = { text: w.text, x: w.x, y: w.y, face: w.face, px: w.px, sweep: { p, band: .85 * w.px }, w, it, on };
    if (mod) mod(r);
    if (r.skip) continue;
    runs.push(r);
  }
  return runs;
}
const gildOpts = (c, e, extra = {}) => ({ light: c.light, boil: c.boil, seed: c.seed, leaf: c.leaf, ...extra });

// ---------------------------------------------------------------- CARVED: generic block (lyrics, hook lines)
function carved(g, f, e, t) {
  const c = ctxOf(f, e, t), T = c.T;
  const lay = carvedLayout(e, f, { size: e.size ? SIZE[e.size] : undefined });
  let exposure = 1 + (T.flash || 0) * 1.4, opacity = 1, sil = T.backlit || 0;
  if (e.fadeout) opacity *= 1 - smooth(clamp((t - (e.t1 - e.fadeout)) / e.fadeout));
  if (e.backlit) sil = Math.max(sil, smooth(clamp((t - e.backlit[0]) / (e.backlit[1] - e.backlit[0]))));
  const runs = carvedRuns(e, lay, c, r => {
    if (e.rewind && t >= e.rewind[0]) r.sweep = { p: 1 - clamp((t - e.rewind[0]) / (e.rewind[1] - e.rewind[0]) * 1.15), band: r.sweep.band, angle: .32 };
    if (e.isolate && t >= e.isolate[1] - 1e-4 && r.text !== e.isolate[0]) r.reveal = 1 - smooth(clamp((t - e.isolate[1]) / .12));
    if (e.isolate && r.text === e.isolate[0] && r.on < e.isolate[1] - .5) r.skip = true;          // only the last LOVE
    if (e.sink && r.text === e.sink[0]) r.y += .07 * r.px * smooth(clamp((t - e.sink[1]) / (e.sink[2] - e.sink[1])));
    if (e.ellipsis && r.text === '…') r.sweep = { p: clamp((c.tq - e.ellipsis[0]) / (e.ellipsis[1] - e.ellipsis[0])), band: .25 * r.px, angle: 0, peak: .7 };
    if (r.reveal != null && r.reveal <= .01) r.skip = true;
    if (sil) r.sil = sil;
  });
  if (e.ellipsis) for (const r of runs) if (r.text === '…' && c.tq < e.ellipsis[0]) r.skip = true;
  gild(g, runs.filter(r => !r.skip), gildOpts(c, e, { exposure, opacity, rimColor: sil ? '#ffe9c0' : undefined }));
}

// ---------------------------------------------------------------- PLAQUE (Canvas 2D: small tracked caps, museum label)
function plaqueColor(f) { return f.world === 'corona' || f.world === 'orbit' ? C.pearl : C.bone; }
export function drawLabel(g, f, text, { x, y, align = 'left', face = FACE.plaque, px, color, t0 = -1e9, t, rule = false, alpha = 1, stagger = .012, shadow = true, m = null }) {
  const L = f.L, s = smartQuotes(text), gl = glyphX(face, px, s), wv = textWidth(face, px, s);
  const x0 = align === 'left' ? x : align === 'right' ? x - wv : x - wv / 2;
  g.save();
  g.translate(x0, y);
  if (m) g.transform(m[0], m[1], m[2], m[3], 0, 0);
  applyFont(g, face, px);
  g.letterSpacing = '0px';
  g.fillStyle = color || plaqueColor(f);
  if (shadow) { g.shadowColor = 'rgba(8,5,2,.62)'; g.shadowBlur = 5 * u(L); g.shadowOffsetY = 1.2 * u(L); }
  const n = gl.length, dur = .3;
  gl.forEach((q, i) => {
    const a = fadeIn(t, t0 + i * Math.min(stagger, dur / n), .16) * alpha;
    if (a <= .01 || q.ch === ' ') return;
    g.globalAlpha = a; g.fillText(q.ch, q.x, 0);
  });
  if (rule) {
    const k = ease.out(clamp((t - t0) / .45));
    g.shadowColor = 'transparent'; g.globalAlpha = .75 * alpha; g.fillStyle = color || plaqueColor(f);
    g.fillRect(0, -face.cap * px - .75 * px, wv * k, Math.max(1, 1.1 * u(L)));
  }
  g.restore();
  return { x0, w: wv };
}
function plaque(g, f, e, t) {
  const L = f.L, it = e.items[0], px = (e.size === 'hook' ? SIZE.plaqueHook : SIZE.plaque) * u(L);
  const A = anchorPos(L, e.anchor || 'lowerLeft'), pl = placeOf(f, e);
  const face = FACE.plaque, s = smartQuotes(it.text);
  const mw = A.maxW, lines = breakLines(s.split(' '), face, px, mw);
  const lh = px * 1.55, n = lines.length;
  const yTop = A.valign === 'top' ? A.y + face.cap * px : A.valign === 'bottom' ? A.y - (n - 1) * lh : A.y - (n - 1) * lh / 2;
  lines.forEach((ws, i) => drawLabel(g, f, ws.join(' '), { x: pl && pl.x != null ? pl.x * L.W : A.x, y: pl && pl.y != null ? pl.y * L.H + i * lh : yTop + i * lh,
    align: A.align, px, t0: it.t + i * .12, t, rule: e.anchor === 'lowerLeft' && i === 0 }));
}

// ---------------------------------------------------------------- INSCR (Cormorant italic lower thirds, word by word)
function inscrPx(L) { return Math.round((L.portrait ? .056 : .072) * L.H); }
function inscrLines(g, f, text, words, { x, y, valign = 'bottom', t, tq, maxW, color = C.warmWhite, px, alpha = 1, t0 }) {
  const L = f.L, face = FACE.inscr, s = smartQuotes(text).split(' ');
  const lines = breakLines(s, face, px, maxW, 3);
  const lay = layoutLines(lines, face, px, { x, y, align: 'center', valign, lead: 1.16 });
  g.save();
  applyFont(g, face, px);
  g.fillStyle = color;
  g.shadowColor = 'rgba(6,4,2,.7)'; g.shadowBlur = 9 * u(L); g.shadowOffsetY = 1.5 * u(L);
  let k = 0;
  for (const w of lay.words) {
    const wt = words && words[k] && words[k].t != null ? words[k].t : t0 ?? t;
    k++;
    const a = fadeIn(tq, wt - .03, .2) * alpha;
    if (a <= .01) continue;
    g.globalAlpha = a;
    g.fillText(w.text, w.x, w.y + (1 - a) * .05 * px);
  }
  g.restore();
  return lay;
}
function inscr(g, f, e, t) {
  const L = f.L, c = ctxOf(f, e, t), A = anchorPos(L, e.anchor || 'lower');
  const it = e.items[0], px = inscrPx(L);
  const credit = e.items.find(i => i.role === 'plaque');
  const ppx = SIZE.plaque * u(L);
  const yb = credit ? A.y - 1.9 * ppx : A.y;
  const out = 1 - smooth(clamp((t - (e.t1 - .2)) / .2));
  const lay = inscrLines(g, f, it.text, it.words, { x: A.x, y: yb, t, tq: c.tq, maxW: A.maxW, px, alpha: out, t0: it.t });
  if (credit) drawLabel(g, f, credit.text, { x: A.x, y: A.y, align: 'center', px: ppx, t0: credit.t, t, alpha: out });
  return lay;
}

// ---------------------------------------------------------------- INSCR incised into a plinth (S49)
function incised(g, f, e, t) {
  const L = f.L, c = ctxOf(f, e, t), T = c.T, it = e.items[0];
  const P = T.plinth || {};
  const W = byAspect(L, { '16:9': [.56, .2], portrait: [.86, .16] });
  const pw = (P.w ?? W[0]) * L.W, ph = (P.h ?? W[1]) * L.H, px0 = (P.x ?? .5) * L.W - pw / 2, py0 = (P.y ?? (L.portrait ? .8 : .8)) * L.H - ph / 2;
  if (P.draw !== false) drawPlinth(g, L, px0, py0, pw, ph, c.seed);
  const face = FACE.inscrBold, s = it.text.split(' ');
  let px = ph * .36;
  let lines = breakLines(s, face, px, pw * .86, 2);
  while (lines.length > 1 && px > ph * .2 && lines.length * px * 1.1 > ph * .8) { px *= .94; lines = breakLines(s, face, px, pw * .86, 2); }
  const lay = layoutLines(lines, face, px, { x: px0 + pw / 2, y: py0 + ph / 2 + .12 * px, align: 'center', valign: 'middle', lead: 1.08 });
  const runs = [];
  let k = 0;
  for (const w of lay.words) {
    const wt = it.words[k++].t;
    const p = sweepP(c.tq, wt, w.text.length);
    if (p < 0) continue;
    runs.push({ text: w.text, x: w.x, y: w.y, face, px, sweep: { p, band: .6 * px, peak: .35 } });
  }
  gild(g, runs, { light: LIGHT.marble, incised: true, palette: C.stone, boil: 0, seed: c.seed, leaf: c.leaf, sigB: Math.max(1.2, .05 * px) });
}
function drawPlinth(g, L, x, y, w, h, seed) {
  g.save();
  const gr = g.createLinearGradient(x, y, x, y + h);
  gr.addColorStop(0, '#d9d3c8'); gr.addColorStop(.55, '#bdb6aa'); gr.addColorStop(1, '#8f897e');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  // veins: a few soft grey streaks
  g.globalAlpha = .18; g.strokeStyle = '#6f695f';
  for (let k = 0; k < 7; k++) {
    const a = hash2(k, 11), b = hash2(k, 23);
    g.lineWidth = (1 + 2 * hash2(k, 5)) * u(L);
    g.beginPath(); g.moveTo(x + a * w, y); g.bezierCurveTo(x + (a + .2) * w, y + .3 * h, x + (b - .1) * w, y + .7 * h, x + b * w, y + h); g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, w, Math.max(1, 2 * u(L)));
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y + h - 2 * u(L), w, Math.max(1, 2 * u(L)));
  g.restore();
}

// ---------------------------------------------------------------- the counter (S18-S34)
export function counterAt(t, e, mag) {
  if (!e) return null;
  const ts = e.items[0].t, total = e.total, hold = e.hold || .8;
  const keys = e.magnitude, m0 = kf(ts + hold, keys, x => x);
  let rem;
  if (t >= e.zero) rem = 0;
  else if (t < ts + hold) rem = total;
  else { const m = mag ?? kf(t, keys, x => x); rem = total * (1 - clamp((m - m0) / (1 - m0))); }
  rem = Math.max(0, Math.round(rem));
  const mm = Math.floor(rem / 60), ss = rem % 60;
  return `TOTALITY IN ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
function counter(g, f, e, t) {
  const L = f.L, c = ctxOf(f, e, t), s = counterAt(t, e, c.T.magnitude);
  const face = FACE.plaqueBold, px = 27 * u(L), S = L.safe;
  const head = 'TOTALITY IN ', digits = s.slice(head.length);
  applyFont(g, face, px);
  const cell = textWidth(face, px, '0') + face.track * px, colon = textWidth(face, px, ':') + face.track * px;
  const dw = 4 * cell + colon, hw = measure(face, px, head), wTot = hw + dw;
  const x1 = S.x + S.w, x0 = x1 - wTot, y = S.y + face.cap * px + .2 * px;
  const a = fadeIn(t, e.items[0].t, .3);
  const draw = (dx, dy, col, al) => {
    g.globalAlpha = a * al; g.fillStyle = col;
    g.fillText(head, x0 + dx, y + dy);
    let x = x0 + hw;
    for (const ch of digits) { const cw = ch === ':' ? colon : cell; g.fillText(ch, x + (cw - textWidth(face, px, ch) - face.track * px) / 2 + dx, y + dy); x += cw; }
  };
  g.save();
  applyFont(g, face, px);
  // engraved: a dark lip above-left, a lit lip below-right, then the gilt fill
  draw(-.8 * u(L), -.8 * u(L), '#120a04', .8);
  draw(.8 * u(L), .9 * u(L), '#fff0c8', .35);
  draw(0, 0, '#cfae6a', 1);
  g.globalAlpha = .55 * a; g.fillStyle = '#cfae6a';
  g.fillRect(x0, y - face.cap * px - .55 * px, wTot - face.track * px, Math.max(1, 1 * u(L)));
  g.restore();
}

// ---------------------------------------------------------------- MONO HUD (S37)
function hud(g, f, e, t) {
  const L = f.L, S = L.safe, el = Math.max(0, Math.floor(t - e.c2 + .05));
  const hh = Math.floor(el / 3600), mm = Math.floor(el / 60) % 60, ss = el % 60, p2 = n => String(n).padStart(2, '0');
  const s = `C2 · TOTALITY · ${p2(hh)}:${p2(mm)}:${p2(ss)}`;
  const px = 23 * u(L), face = FACE.mono, k = pulse(t, 9);
  g.save();
  applyFont(g, face, px);
  const x = S.x + 18 * u(L), y = S.y + face.cap * px;
  g.fillStyle = C.orange; g.globalAlpha = .75 + .25 * k;
  g.fillRect(S.x, y - face.cap * px * .78, 9 * u(L), 9 * u(L));
  g.globalAlpha = .86 + .14 * k; g.fillStyle = C.pearl;
  g.fillText(s, x, y);
  g.restore();
}

// ---------------------------------------------------------------- CHOP (drops)
const chopFits = new Map();
function fitFor(L, word) { const k = `${L.W}x${L.H}|${word}`; if (!chopFits.has(k)) chopFits.set(k, chopFit(L, word)); return chopFits.get(k); }
function chopPhase(t) { const b = beatPos(t), fb = b - Math.floor(b); return .5 * t + .55 * Math.floor(b) + .55 * ease.out(Math.min(1, fb * 4)); }
function chop(g, f, e, t) {
  const L = f.L, T = f.type || {}, fps = 60;
  let cur = -1;
  e.items.forEach((it, k) => { if (t >= it.t - 1e-6) cur = k; });
  if (cur < 0 && !e.stutter) return;
  const it = e.items[Math.max(cur, 0)], word = it.text, fit = fitFor(L, word);
  const center = T.field && T.field.center || (T.sun ? [T.sun.x, T.sun.y] : [L.cx, L.cy]);
  let onset = cur >= 0 ? it.t : -1e9, k = -1;
  if (e.stutter) e.onsets.forEach((s, i) => { if (t >= s - 1e-6) { onset = s; k = i; } });
  const fr = Math.round((t - onset) * fps);
  let scale = 1, dx = 0, dy = 0;
  if (e.stutter && k >= 0) {
    scale = fr <= 0 ? 1.075 : fr === 1 ? 1.025 : 1;
    const pat = [0, 1, -1, .5, -.5, 1.5, -1.5, 0];
    dx = pat[k % pat.length] * .011 * L.W; dy = pat[(k + 3) % pat.length] * .006 * L.H;
  } else if (fr >= 0 && fr < 3) scale = [1.24, 1.08, 1.02][fr];
  const invert = !!(T.invert ?? (e.invert && e.invert.some(s => t >= s - 1e-6 && t < s + 2 / fps - 1e-6)));
  const kick = clamp(T.kick ?? pulse(t, 10));
  const cx = L.cx + dx, cy = (T.chopY ?? L.cy) + dy;
  // stutter echoes: the two previous positions as fading outlines
  if (e.stutter && k >= 1) for (let j = 1; j <= 2 && k - j >= 0; j++) {
    const pat = [0, 1, -1, .5, -.5, 1.5, -1.5, 0], kk = k - j, age = (t - e.onsets[kk]) * fps;
    chopEcho(g, L, fit, L.cx + pat[kk % pat.length] * .011 * L.W, cy - dy + pat[(kk + 3) % pat.length] * .006 * L.H, 1 + .035 * j, (.5 / j) * clamp(1 - age / 14), invert ? C.navyBlack : C.orange);
  }
  if (!e.stutter && fr >= 0 && fr < 6) chopEcho(g, L, fit, cx, cy, 1 + .05 + .03 * fr, .55 * (1 - fr / 6));
  const res = chopWord(g, f, { word, fit, cx, cy, scale, invert, center, kick, t, phase: chopPhase(t), opacity: 1 });
  // HAL: on the first HALO the O is eclipsed for four frames
  if (it.hal && fr >= 0 && fr < 4 && !(T.disk && T.disk.hal === false)) halDisk(g, L, res, word, fr / 3);
}

// ---------------------------------------------------------------- the Glover caption (S35)
function quote(g, f, e, t) {
  const L = f.L, it = e.items[0], A = anchorPos(L, 'lower');
  const [q, who] = it.text.split(' — ');
  const px = 30 * u(L), px2 = 23 * u(L), out = 1 - smooth(clamp((t - (e.t1 - .18)) / .18));
  const y2 = L.portrait ? .9 * L.H : .915 * L.H;
  const lines2 = breakLines(('— ' + who).split(' '), FACE.plaque, px2, L.safe.w);
  drawLabel(g, f, q, { x: L.cx, y: y2 - (lines2.length) * px2 * 1.6 - .2 * px, align: 'center', px, face: FACE.plaqueBold, t0: it.t, t, alpha: out, color: C.pearl, stagger: .006 });
  lines2.forEach((ws, i) => drawLabel(g, f, ws.join(' '), { x: L.cx, y: y2 - (lines2.length - 1 - i) * px2 * 1.6, align: 'center', px: px2, t0: it.t + .1, t, alpha: out * .9, color: C.pearl, stagger: .004 }));
}

// ---------------------------------------------------------------- S06: map labels on the banks
function map(g, f, e, t) {
  const L = f.L, c = ctxOf(f, e, t), k = clamp((t - e.t0) / (e.t1 - e.t0));
  const P = L.portrait;
  const spots = P ? { west: [.27, .63], east: [.73, .63] } : { west: [.2, .67], east: [.8, .67] };
  const cpx = (P ? 84 : 92) * u(L) * (1 + .06 * k), spx = (P ? 22 : 25) * u(L) * (1 + .06 * k);
  const sy = .6 - .05 * k;
  for (const side of ['west', 'east']) {
    const lab = e.items.find(i => i.key === side), sub = e.items.find(i => i.key === side + '_sub');
    const [ux, uy] = spots[side], x = ux * L.W, y = uy * L.H, sgn = side === 'west' ? -1 : 1;
    const rot = sgn * -.07, kx = sgn * .33, cs = Math.cos(rot), sn = Math.sin(rot);
    const m = [cs, sn, -sn * sy + kx * sy * cs, cs * sy];        // rotate, lay flat (squash), lean toward the vanishing point
    if (lab && t >= lab.t) {
      const w = textWidth(FACE.carved, cpx, lab.text), x0 = x - w / 2 * cs, y0 = y - w / 2 * sn;
      const ks = clamp((t - lab.t) / .42), kf2 = smooth(clamp((t - lab.t - .2) / .38));
      if (kf2 < 1) {                                           // engraver's stroke: the outline draws itself in
        g.save(); g.translate(x0, y0); g.transform(m[0], m[1], m[2], m[3], 0, 0);
        applyFont(g, FACE.carved, cpx);
        const D = 5 * cpx; g.setLineDash([D, D]); g.lineDashOffset = D * (1 - ease.out(ks));
        g.strokeStyle = '#f2d48e'; g.globalAlpha = 1 - kf2 * .9; g.lineWidth = Math.max(1, 1.4 * u(L));
        g.strokeText(lab.text, 0, 0); g.restore();
      }
      if (kf2 > 0) gild(g, [{ text: lab.text, x: x0, y: y0, face: FACE.carved, px: cpx, m, reveal: kf2 }], gildOpts(c, e, { shadow: .8 }));
    }
    if (sub && t >= sub.t) {
      const w = textWidth(FACE.plaque, spx, sub.text);
      const off = 1.05 * cpx * sy;
      drawLabel(g, f, sub.text, { x: x - w / 2 * cs - sn * off, y: y + off * cs, align: 'left', px: spx, t0: sub.t, t, m: [cs, sn, -sn * sy + kx * sy * cs, cs * sy], color: '#efdcb0' });
    }
  }
  const foot = e.items.find(i => i.key === 'foot');
  if (foot && t >= foot.t) drawLabel(g, f, foot.text, { x: L.cx, y: L.safe.y + L.safe.h - .01 * L.H, align: 'center', px: SIZE.plaque * u(L), t0: foot.t, t, rule: false });
}

// ---------------------------------------------------------------- diptych divider + captions (S09, S22, S43)
function diptych(g, f, e, t) {
  const L = f.L, P = L.portrait, corona = e.palette === 'corona' || f.world === 'corona';
  const sk = e.split ? ease.inOut(clamp((t - e.split[0]) / (e.split[1] - e.split[0]))) : 0;
  const gap = sk * (P ? .05 * L.H : .055 * L.W), wd = Math.max(3, 9 * u(L));
  const intro = ease.out(clamp((t - e.t0) / .35));
  g.save();
  for (const s of (sk > .002 ? [-1, 1] : [0])) {
    const c0 = (P ? L.cy : L.cx) + s * gap / 2;
    if (corona) {
      g.fillStyle = C.pearl; g.globalAlpha = .9 * intro;
      if (P) g.fillRect(0, c0 - u(L), L.W * intro, 2 * u(L)); else g.fillRect(c0 - u(L), 0, 2 * u(L), L.H * intro);
      g.fillStyle = C.orange; g.globalAlpha = .7 * intro;
      if (P) { g.fillRect(0, c0 - 4 * u(L), L.W * intro, u(L)); g.fillRect(0, c0 + 3 * u(L), L.W * intro, u(L)); }
      else { g.fillRect(c0 - 4 * u(L), 0, u(L), L.H * intro); g.fillRect(c0 + 3 * u(L), 0, u(L), L.H * intro); }
      continue;
    }
    // a gilded moulding: dark edges, a rounded gold body lit from the upper left, one bright fillet
    const gr = P ? g.createLinearGradient(0, c0 - wd / 2, 0, c0 + wd / 2) : g.createLinearGradient(c0 - wd / 2, 0, c0 + wd / 2, 0);
    [[0, '#1a0e05'], [.14, '#6e4618'], [.32, '#f6d488'], [.45, '#fff3cf'], [.62, '#c08d3a'], [.86, '#5a3812'], [1, '#140a03']].forEach(([p, col]) => gr.addColorStop(p, col));
    g.fillStyle = gr; g.globalAlpha = intro;
    if (P) g.fillRect(0, c0 - wd / 2, L.W, wd); else g.fillRect(c0 - wd / 2, 0, wd, L.H);
    const sh = P ? g.createLinearGradient(0, 0, L.W, 0) : g.createLinearGradient(0, 0, 0, L.H);
    sh.addColorStop(0, 'rgba(255,240,200,.25)'); sh.addColorStop(.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = sh;
    if (P) g.fillRect(0, c0 - wd / 2, L.W, wd); else g.fillRect(c0 - wd / 2, 0, wd, L.H);
  }
  g.restore();
  const px = SIZE.plaque * u(L);
  for (const it of e.items) {
    const left = it.key === 'left';
    if (P) drawLabel(g, f, it.text, { x: L.cx, y: left ? L.cy - gap / 2 - .03 * L.H : L.safe.y + L.safe.h - .01 * L.H, align: 'center', px, t0: it.t, t });
    else drawLabel(g, f, it.text, { x: left ? L.W * .25 - gap / 4 : L.W * .75 + gap / 4, y: L.safe.y + L.safe.h - .01 * L.H, align: 'center', px, t0: it.t, t });
  }
}

// ---------------------------------------------------------------- S25: mirrored LYDIANS / MEDES, the line across the bottom
function mirrored(g, f, e, t) {
  const L = f.L, c = ctxOf(f, e, t), S = L.safe, P = L.portrait;
  const left = e.items.find(i => i.key === 'left'), right = e.items.find(i => i.key === 'right'), foot = e.items.find(i => i.key === 'foot');
  let px = (P ? 80 : 98) * u(L);
  const half = (P ? S.w / 2 - .02 * L.W : .4 * L.W);
  px = Math.min(px, half / textWidth(FACE.carved, 1, left.text), half / textWidth(FACE.carved, 1, right.text));
  const y = P ? S.y + .16 * L.H : .34 * L.H;
  const runs = [];
  const add = (it, x, align) => {
    const w = textWidth(FACE.carved, px, it.text), xx = align === 'left' ? x : x - w;
    const p = sweepP(c.tq, it.words[0].t, it.text.length);
    if (p >= 0) runs.push({ text: it.text, x: xx, y, face: FACE.carved, px, sweep: { p, band: .85 * px } });
  };
  add(left, S.x, 'left'); add(right, S.x + S.w, 'right');
  const lay = carvedLayout(e, f, { items: [foot], anchor: 'bottom', size: P ? 70 : 64, maxW: P ? S.w : S.w * .98 });
  runs.push(...carvedRuns({ ...e, items: [foot] }, lay, c));
  gild(g, runs, gildOpts(c, e));
}

// ---------------------------------------------------------------- S26: SUN BURNING ON THE / BRONZE / EXCHANGE-
function bronze(g, f, e, t) {
  const L = f.L, c = ctxOf(f, e, t), S = L.safe, P = L.portrait;
  const [ia, ib, ic] = ['above', 'big', 'below'].map(k => e.items.find(i => i.key === k));
  const bigW = P ? S.w * .96 : .52 * L.W;
  const pxB = bigW / textWidth(FACE.carved, 1, ib.text), pxA = (P ? 46 : 50) * u(L), pxC = (P ? 58 : 66) * u(L);
  const x = P ? L.cx - bigW / 2 : S.x, capB = FACE.carved.cap * pxB;
  const yB = P ? .72 * L.H : .6 * L.H;
  const rows = [[ia, pxA, yB - capB - .5 * pxA], [ib, pxB, yB], [ic, pxC, yB + .3 * pxB + FACE.carved.cap * pxC]];
  const runs = [];
  for (const [it, px, y] of rows) {
    let xx = x;
    it.text.split(' ').forEach((w, wi) => {
      const p = sweepP(c.tq, it.words[wi].t, w.length);
      if (p >= 0) {
        const r = { text: w, x: xx, y, face: FACE.carved, px, sweep: { p, band: (it === ib ? 1.4 : .85) * px } };
        if (it === ib) {
          r.boost = .06 + .06 * Math.exp(-(t - e.glint) * 2);      // the sun burning on the bronze
          const k2 = (t - e.glint - .55) / .95;                        // the moving glint: a slower second pass while held
          if (k2 > 0 && k2 < 1) { r.sweep = null; r.shine = { k: k2, band: 1.5 * px, peak: .75 }; }
        }
        runs.push(r);
      }
      xx += measure(FACE.carved, px, w + ' ');
    });
  }
  gild(g, runs, gildOpts(c, e));
}

// ---------------------------------------------------------------- S27: the letters eclipsed to crescents
function crescents(g, f, e, t) {
  const c = ctxOf(f, e, t), L = f.L;
  const lay = carvedLayout(e, f, {});
  const ek = clamp((t - e.items[1].t) / (e.eclipse[1] - e.items[1].t));
  const pal = mixPal(C.gold, C.goldCool, .65 * smooth(ek));        // colour drains, goes metallic
  const k0 = c.T.disk && c.T.disk.k != null ? c.T.disk.k : null;
  const runs = carvedRuns(e, lay, c);
  const bb = lay.bbox, x0 = bb.x0, x1 = bb.x1;
  gild(g, runs, gildOpts(c, e, {
    palette: pal,
    fx2: ctx => {
      for (const r of runs) {
        const gl = glyphX(r.face, r.px, r.text);
        for (const q of gl) {
          if (q.ch === ' ' || q.ch === '-') continue;
          const gx = r.x + q.x + q.w / 2, gy = r.y - r.face.cap * r.px / 2;
          const xn = (gx - x0) / Math.max(1, x1 - x0);
          const st = e.eclipse[0] + (1 - xn) * .26 + (r.w.line ? .05 : 0);   // the disk passes right to left
          const k = k0 != null ? k0 : smooth(clamp((c.tq - st) / .2));
          if (k <= 0) continue;
          const R = .62 * Math.max(q.w, r.face.cap * r.px), dirx = .88, diry = -.47;
          const off = lerp(2.3, .4, k) * R * (e.coverage ? 1 : 1);
          ctx.fillStyle = '#f00';
          ctx.beginPath(); ctx.arc(gx + dirx * off, gy + diry * off, R, 0, TAU); ctx.fill();
        }
      }
    },
  }));
}

// ---------------------------------------------------------------- S28: text on a circle around the sun
function ringGeom(f) {
  const L = f.L, T = f.type || {};
  const sun = T.sun || byAspect(L, { '16:9': { x: .63 * L.W, y: .45 * L.H, r: .1 * L.H }, portrait: { x: .5 * L.W, y: .36 * L.H, r: .11 * L.W } });
  const R = T.ringR || sun.r * 2.75;
  return { cx: sun.x, cy: sun.y, R };
}
function ring(g, f, e, t) {
  const c = ctxOf(f, e, t), L = f.L, { cx, cy, R } = ringGeom(f);
  const face = FACE.carved, px = clamp(R * .19, 30 * u(L), 90 * u(L)), cap = face.cap * px;
  const runs = [];
  for (const it of e.items) {
    const top = it.key === 'top', gl = glyphX(face, px, it.text), tot = gl[gl.length - 1].x + gl[gl.length - 1].w;
    const rad = top ? R : R + cap;
    // word index per glyph
    let wi = 0;
    gl.forEach((q, j) => {
      if (q.ch === ' ') { wi++; return; }
      const wt = it.words[wi].t, s = q.x + q.w / 2 - tot / 2;
      const th = top ? -Math.PI / 2 + s / rad : Math.PI / 2 - s / rad, rot = top ? th + Math.PI / 2 : th - Math.PI / 2;
      const on = wt + (j - it.text.lastIndexOf(' ', j) - 1) * .025;
      const p = clamp((c.tq - on) / .14);
      if (c.tq < on) return;
      const gx = cx + rad * Math.cos(th), gy = cy + rad * Math.sin(th), cs = Math.cos(rot), sn = Math.sin(rot);
      runs.push({ text: q.ch, x: gx - cs * q.w / 2, y: gy - sn * q.w / 2, face, px, m: [cs, sn, -sn, cs], reveal: clamp(.35 + p), glint: (1 - p) * .9 });
    });
  }
  gild(g, runs, gildOpts(c, e));
}

// ---------------------------------------------------------------- S29: inside the pupil
function pupil(g, f, e, t) {
  const c = ctxOf(f, e, t), L = f.L, T = c.T, it = e.items[0];
  const P = T.pupil || byAspect(L, { '16:9': { x: .5 * L.W, y: .47 * L.H, r: .22 * L.H }, portrait: { x: .5 * L.W, y: .42 * L.H, r: .3 * L.W } });
  const key = `pupil|${L.W}x${L.H}|${P.x}|${P.y}|${P.r}`;
  let best = _lay.get(key);
  if (!best) {
    const words = it.text.split(' '), face = FACE.carvedBold, n = words.length;
    best = null;
    for (const nl of [2, 3, 4]) {
      // all partitions of the words into nl lines
      const parts = [];
      const rec = (i, acc) => { if (acc.length === nl - 1) { parts.push([...acc]); return; } for (let j = i + 1; j < n; j++) rec(j, [...acc, j]); };
      rec(0, []);
      for (const cuts of parts) {
        const b = [0, ...cuts, n], lines = [];
        for (let j = 0; j < nl; j++) lines.push(words.slice(b[j], b[j + 1]));
        let px = 200, lead = 1.12;
        for (let it2 = 0; it2 < 60; it2++, px *= .96) {
          const h = (nl - 1) * px * lead, cap = face.cap * px;
          let ok = true;
          lines.forEach((ws, j) => {
            const yc = -h / 2 + j * px * lead - cap / 2, yy = Math.max(Math.abs(yc - cap / 2), Math.abs(yc + cap / 2));
            const chord = 2 * Math.sqrt(Math.max(0, (P.r * .9) ** 2 - yy * yy));
            if (textWidth(face, px, ws.join(' ')) > chord) ok = false;
          });
          if (ok) break;
        }
        if (!best || px > best.px) best = { lines, px, lead, face };
      }
    }
    _lay.set(key, best);
  }
  const { lines, px, lead, face } = best, nl = lines.length, h = (nl - 1) * px * lead, cap = face.cap * px;
  const lay = layoutLines(lines, face, px, { x: P.x, y: P.y - h / 2 - cap / 2, align: 'center', valign: 'top', lead });
  const runs = [];
  lay.words.forEach((w, k) => {
    const p = sweepP(c.tq, it.words[k].t, w.text.length);
    if (p >= 0) runs.push({ text: w.text, x: w.x, y: w.y, face, px, sweep: { p, band: .8 * px } });
  });
  // lit by the reflected crescent: pale and cool, from the upper right
  gild(g, runs, gildOpts(c, e, { light: T.light || { dir: [.7, -.7], elev: .5, color: '#f4efe2', intensity: 1.05, cool: .4 }, palette: mixPal(C.gold, C.goldCool, .35), shadow: .4 }));
}

// ---------------------------------------------------------------- S30 / S58: a shadow front across the letters
function shadow(g, f, e, t) {
  const c = ctxOf(f, e, t), L = f.L, T = c.T;
  const rise = e.direction === 'rise';
  const lay = carvedLayout(e, f, { anchor: e.anchor || 'left' });
  const bb = lay.bbox, soft = .35 * lay.px;
  let p = T.front && T.front.p != null ? T.front.p : clamp((t - e.front[0]) / (e.front[1] - e.front[0]));
  p = ease.inOut(p);
  const yf = T.front && T.front.y != null ? T.front.y : lerp(bb.y0 - soft - .05 * lay.px, bb.y1 + soft, p);
  const tilt = .12;                                            // the umbra edge runs slightly downhill to the right
  if (!rise) {
    const runs = carvedRuns(e, lay, c);
    gild(g, runs, gildOpts(c, e, {
      rimColor: '#f0b25a',
      fx2: ctx => {                                           // shadow above the front (it comes from the horizon, down)
        const gr = ctx.createLinearGradient(0, yf - soft, 0, yf + soft);
        gr.addColorStop(0, '#f00'); gr.addColorStop(1, '#000');
        ctx.save(); ctx.translate(bb.x0, 0); ctx.transform(1, tilt, 0, 1, 0, 0); ctx.translate(-bb.x0, 0);
        ctx.fillStyle = gr; ctx.fillRect(bb.x0 - 100, bb.y0 - 4 * lay.px, bb.x1 - bb.x0 + 200, yf - bb.y0 + 4 * lay.px + soft);
        ctx.restore();
      },
    }));
    return;
  }
  // rise: every glyph is its own run; it sits low and dark until the light reaches it, then rises into gold
  const runs = [];
  for (const w of lay.words) {
    const it = e.items[w.item], on = onsetOf(e, it, w, lay);
    if (c.tq < on) continue;
    const a = fadeIn(c.tq, on, .12);
    for (const q of glyphX(w.face, w.px, w.text)) {
      const gx = w.x + q.x, gy = w.y - w.face.cap * w.px / 2 + tilt * (gx - bb.x0);
      const lit = smooth(clamp((yf - gy) / (2 * soft) + .5));
      runs.push({ text: q.ch, x: gx, y: w.y + (1 - lit) * .13 * w.px, face: w.face, px: w.px, sil: 1 - lit, reveal: a, glint: lit * (1 - lit) * 2.2 });
    }
  }
  gild(g, runs, gildOpts(c, e, { rimColor: '#ffd68a' }));
}

// ---------------------------------------------------------------- S52: THALES, the Greek echo, the plaque
function thales(g, f, e, t) {
  const c = ctxOf(f, e, t), L = f.L, S = L.safe, P = L.portrait;
  const [nm, gk, pq] = ['name', 'greek', 'plaque'].map(k => e.items.find(i => i.key === k));
  const px = (P ? 120 : 132) * u(L), gpx = px * .5, ppx = SIZE.plaque * u(L);
  const x = P ? L.cx - textWidth(FACE.carved, px, nm.text) / 2 : S.x, y = P ? .7 * L.H : .5 * L.H;
  const runs = [];
  const p = sweepP(c.tq, nm.words[0].t, 6);
  if (p >= 0) runs.push({ text: nm.text, x, y, face: FACE.carved, px, sweep: { p, band: px } });
  if (t >= gk.t) runs.push({ text: gk.text, x: x + .02 * px, y: y + .72 * px, face: FACE.greek, px: gpx, sweep: { p: clamp((c.tq - gk.t) / .5), band: .8 * gpx, peak: .6 } });
  gild(g, runs, gildOpts(c, e, { light: c.T.light || LIGHT.marble }));
  if (t >= pq.t) drawLabel(g, f, pq.text, { x: P ? L.cx : x + .02 * px, y: y + .72 * px + 1.25 * ppx + .4 * gpx, align: P ? 'center' : 'left', px: ppx, t0: pq.t, t, rule: false });
}

// ---------------------------------------------------------------- S53: the forecast card (generic, no market's look)
function forecast(g, f, e, t) {
  const L = f.L, P = L.portrait, k = clamp((t - e.t0) / .1);
  const cw = (P ? .82 : .3) * L.W, x = P ? L.cx - cw / 2 : L.safe.x + L.safe.w - cw, y = P ? L.safe.y + .1 * L.H : L.safe.y + .02 * L.H;
  const face = FACE.mono, qpx = (P ? 27 : 24) * u(L), pad = 20 * u(L);
  const lines = breakLines(e.question.split(' '), face, qpx, cw - 2 * pad, 3);
  const ch = pad * 2 + lines.length * qpx * 1.35 + 110 * u(L);
  const jk = clamp((t - e.jump) / .42), steps = [3, 3, 6, 14, 31, 58, 79, 92, 97, 99];
  const yes = jk <= 0 ? e.yes[0] : steps[Math.min(steps.length - 1, Math.floor(jk * (steps.length - 1) + 1e-6))];
  g.save();
  g.globalAlpha = k;
  g.translate(0, (1 - ease.out(k)) * 12 * u(L));
  g.fillStyle = 'rgba(8,10,16,.93)'; g.fillRect(x, y, cw, ch);
  g.strokeStyle = 'rgba(243,239,230,.85)'; g.lineWidth = Math.max(1, u(L)); g.strokeRect(x + .5, y + .5, cw - 1, ch - 1);
  applyFont(g, face, qpx); g.fillStyle = C.pearl;
  lines.forEach((ws, i) => g.fillText(ws.join(' '), x + pad, y + pad + qpx * .8 + i * qpx * 1.35));
  const yb = y + pad + lines.length * qpx * 1.35 + 18 * u(L);
  // prices
  const bpx = 44 * u(L);
  applyFont(g, FACE.monoBold, bpx * .5); g.fillStyle = C.orange; g.fillText('YES', x + pad, yb + bpx * .55);
  applyFont(g, FACE.monoBold, bpx); g.fillStyle = C.pearl; g.fillText(`${yes}¢`, x + pad + 62 * u(L), yb + bpx * .78);
  applyFont(g, face, bpx * .42); g.fillStyle = 'rgba(243,239,230,.6)'; g.fillText(`NO ${100 - yes}¢`, x + pad, yb + bpx * 1.75);
  // the price line: flat at 3, then straight up
  const gx0 = x + cw * .52, gx1 = x + cw - pad, gy0 = yb + bpx * 1.7, gy1 = yb;
  g.strokeStyle = 'rgba(243,239,230,.25)'; g.lineWidth = Math.max(1, u(L));
  g.beginPath(); g.moveTo(gx0, gy0); g.lineTo(gx1, gy0); g.stroke();
  g.strokeStyle = C.orange; g.lineWidth = Math.max(1.5, 2.2 * u(L)); g.beginPath();
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const s = i / N, tt = e.t0 + s * (t - e.t0 + .001), jj = clamp((tt - e.jump) / .42), v = tt < e.jump ? 3 + 1.2 * hash(i) : 3 + 96 * ease.out(jj);
    const xx = lerp(gx0, gx1, s), yy = lerp(gy0, gy1, (v - 0) / 100);
    i ? g.lineTo(xx, yy) : g.moveTo(xx, yy);
  }
  g.stroke();
  g.restore();
}

// ---------------------------------------------------------------- S57: SPARK bursts and fades
function spark(g, f, e, t) {
  const c = ctxOf(f, e, t), L = f.L, it = e.items[0];
  const dt = t - it.t; if (dt < 0) return;
  const px = (L.portrait ? 200 : 230) * u(L), w = textWidth(FACE.carved, px, it.text);
  const x = L.cx - w / 2, y = (L.portrait ? .56 : .6) * L.H;
  const burst = ease.out(clamp(dt / .3)), fade = 1 - ease.inOut(clamp((t - (e.t1 - 2.6)) / 2.45));
  const sc = lerp(.9, 1, burst);
  const cxw = L.cx, cyw = y - FACE.carved.cap * px / 2;
  // ripples: thin gilt outlines racing outward from the word
  g.save();
  applyFont(g, FACE.carved, px);
  for (let k = 0; k < 3; k++) {
    const kk = clamp((dt - k * .09) / .85); if (kk <= 0 || kk >= 1) continue;
    const s = 1 + .9 * ease.out(kk);
    g.save(); g.translate(cxw, cyw); g.scale(s, s); g.translate(-cxw, -cyw);
    g.globalAlpha = (1 - kk) * .7 * fade; g.strokeStyle = '#ffe7a8'; g.lineWidth = Math.max(1, 1.6 * u(L) / s);
    g.strokeText(it.text, x, y); g.restore();
  }
  g.restore();
  const m = [sc, 0, 0, sc], ox = cxw + (x - cxw) * sc, oy = cyw + (y - cyw) * sc;
  gild(g, [{ text: it.text, x: ox, y: oy, face: FACE.carved, px: px * 1, m, reveal: 1, glint: clamp(1 - dt / .5) }],
    gildOpts(c, e, { exposure: 1 + 1.6 * Math.exp(-dt * 5), opacity: fade, light: { dir: [.2, -1], elev: .55, color: '#fff8e8', intensity: 1.1 } }));
  // gold dust lifting off the letters as it fades
  const fl = clamp((t - (e.t1 - 3.2)) / 3.0);
  if (fl > 0) {
    g.save();
    for (let i = 0; i < 160; i++) {
      const h1 = hash2(i, 7), h2 = hash2(i, 13), h3 = hash2(i, 29), start = h3 * .6;
      const kk = clamp((fl - start) / (1 - start)); if (kk <= 0) continue;
      const px0 = x + h1 * w * sc, py0 = y - h2 * FACE.carved.cap * px;
      const dx = (h1 - .5) * 160 * u(L) * kk, dy = -(40 + 120 * h2) * u(L) * kk + 30 * u(L) * kk * kk;
      g.globalAlpha = (1 - kk) * .85; g.fillStyle = h3 > .5 ? '#ffe6a0' : '#d8a548';
      const r = (1.2 + 2.2 * h2) * u(L);
      g.fillRect(px0 + dx, py0 + dy, r, r * .6);
    }
    g.restore();
  }
}

// ---------------------------------------------------------------- S64-S71: era captions (PLAQUE: year · place · fact)
function era(g, f, e, t) {
  const L = f.L, S = L.safe, P = L.portrait, it = e.items[0];
  const [year, place, ...rest] = it.text.split(' · '), fact = rest.join(' · ');
  const ypx = (P ? 50 : 54) * u(L), ppx = (P ? 25 : 26) * u(L), fpx = (P ? 25 : 26) * u(L);
  const mw = P ? S.w : .44 * L.W, x = S.x + 16 * u(L);
  const factLines = breakLines(fact.split(' '), FACE.plaque, fpx, mw, 3);
  const lh = fpx * 1.5, yBot = S.y + S.h - .004 * L.H;
  const yFact0 = yBot - (factLines.length - 1) * lh, yPlace = yFact0 - lh * 1.05, yYear = yPlace - ppx * 1.55;
  const t0 = it.t;
  // the spine: a hairline from the first era downwards; earlier years stacked above, dim
  const hist = e.history || [], hpx = 19 * u(L), hlh = hpx * 1.65;
  const top = yYear - FACE.plaqueBold.cap * ypx - .5 * hpx - hist.length * hlh;
  g.save();
  g.fillStyle = C.pearl; g.globalAlpha = .45 * fadeIn(t, t0, .2);
  g.fillRect(S.x, top, Math.max(1, u(L)), yBot - top);
  g.globalAlpha = .9; g.fillStyle = C.orange;
  g.fillRect(S.x - 3 * u(L), yYear - FACE.plaqueBold.cap * ypx * .62, 7 * u(L), 7 * u(L));
  g.restore();
  hist.forEach((h, i) => drawLabel(g, f, h, { x, y: top + hpx + i * hlh, px: hpx, color: C.pearl, alpha: .42, t0: t0 - 1, t, shadow: false }));
  drawLabel(g, f, year, { x, y: yYear, px: ypx, face: FACE.plaqueBold, color: C.pearl, t0, t, stagger: .02 });
  drawLabel(g, f, place, { x, y: yPlace, px: ppx, color: C.orange, t0: t0 + .16, t, stagger: .008 });
  factLines.forEach((ws, i) => drawLabel(g, f, ws.join(' '), { x, y: yFact0 + i * lh, px: fpx, color: C.pearl, t0: t0 + .3 + i * .08, t, stagger: .006 }));
}

// ---------------------------------------------------------------- S72: HOME (small, late)
function home(g, f, e, t) {
  const c = ctxOf(f, e, t), L = f.L, it = e.items[0];
  if (t < it.t) return;
  const px = (L.portrait ? 64 : 60) * u(L), w = textWidth(FACE.carved, px, it.text);
  gild(g, [{ text: it.text, x: L.cx - w / 2, y: (L.portrait ? .8 : .82) * L.H, face: FACE.carved, px, sweep: { p: clamp((c.tq - it.t) / .8), band: 1.2 * px, peak: .8 } }],
    gildOpts(c, e, { light: c.T.light || LIGHT.orbit, shadow: 0 }));
}

// ---------------------------------------------------------------- S81: the end card
function endcard(g, f, e, t) {
  const c = ctxOf(f, e, t), L = f.L, P = L.portrait;
  const [ti, by, nx] = ['title', 'byline', 'next'].map(k => e.items.find(i => i.key === k));
  const px = (P ? 190 : 200) * u(L), bpx = (P ? 46 : 44) * u(L);
  const w = textWidth(FACE.carved, px, ti.text), y = (P ? .46 : .5) * L.H;
  const runs = [];
  if (t >= ti.t) runs.push({ text: ti.text, x: L.cx - w / 2, y, face: FACE.carved, px, sweep: { p: clamp((c.tq - ti.t) / .7), band: 1.1 * px } });
  const bf = { ...FACE.carved, track: .3 }, bw = textWidth(bf, bpx, by.text);
  if (t >= by.t) runs.push({ text: by.text, x: L.cx - bw / 2, y: y + .55 * px, face: bf, px: bpx, sweep: { p: clamp((c.tq - by.t) / .5), band: bpx } });
  gild(g, runs, gildOpts(c, e, { light: LIGHT.end, shadow: .5, boil: 0 }));
  if (t >= nx.t) {
    const npx = (P ? 25 : 27) * u(L), lines = breakLines(nx.text.split(' '), FACE.plaque, npx, L.safe.w);
    lines.forEach((ws, i) => drawLabel(g, f, ws.join(' '), { x: L.cx, y: L.safe.y + L.safe.h - .01 * L.H - (lines.length - 1 - i) * npx * 1.6, align: 'center', px: npx, t0: nx.t, t }));
  }
}

function cartouche(g, f, e, t) { return drawCartouche(g, f, e, t, ctxOf(f, e, t)); }
function terminal(g, f, e, t) { return drawTerminal(g, f, e, t); }

export const FX = { carved, plaque, inscr, incised, counter, hud, chop, quote, map, diptych, mirrored, bronze, crescents, ring, pupil, shadow,
  thales, forecast, spark, era, home, endcard, cartouche, terminal };
export { gildOpts, sweepP, ctxOf, carvedRuns, carvedLayout };
