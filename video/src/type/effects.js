// effects.js: one renderer per text-track fx. Each is (g, f, e, t) -> draws event e at song time t (f = the frame
// context: f.L layout, f.cad draw cadence, f.seed per-drawing seed, f.world, f.type scene parameters).
//
// Timing rule (SHOTLIST note): text never appears before its sung start. A word gilds in on the first drawing at or after
// its onset (at 12 fps up to one drawing late); chops slam on the exact master frame; sung words may linger up to ~1.5 s
// past a cut.

import { FACE, C, LIGHT, applyFont, textWidth, glyphX, breakLines, breakGroups, layoutLines, byAspect, smartQuotes, ease, measure } from './style.js';
import { gild } from './gild.js';
import { chopWord, chopFit, chopEcho, halDisk } from './chop.js';
import { drawCartouche } from './cartouche.js';
import { drawTerminal } from './terminal.js';
import { clamp, lerp, smooth, strSeed, hash, hash2, kf, mixHex, TAU } from '../core.js';
import { beatPos, pulse } from '../time.js';
import TRACK from './track.gen.js';

// ---------------------------------------------------------------- shared
const WORLD_LIGHT = { bronze: 'bronze', gold: 'gold', marble: 'marble', corona: 'corona', orbit: 'orbit', room: 'end' };
function ctxOf(f, e, t) {
  const cad = f.cad || 60, T = f.type || {};
  return { t, tq: t, cad, boil: cad <= 15 ? 1 : 0, seed: f.seed || 0, leaf: strSeed(e.id) % 997, L: f.L, T, world: f.world,
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
      : { x: S.x + .004 * L.W, y: .6 * L.H, align: 'left', valign: 'middle', maxW: .5 * L.W };
    case 'leftLow': return P ? { x: L.cx, y: S.y + S.h - .03 * L.H, align: 'center', valign: 'bottom', maxW: S.w }
      : { x: S.x + .004 * L.W, y: .67 * L.H, align: 'left', valign: 'middle', maxW: .5 * L.W };
    case 'lowerLeft': return { x: S.x, y: S.y + S.h - .004 * L.H, align: 'left', valign: 'bottom', maxW: P ? S.w : .5 * L.W };
    case 'lower': return { x: L.cx, y: P ? .845 * L.H : .885 * L.H, align: 'center', valign: 'bottom', maxW: S.w * .94 };
    default: return { x: L.cx, y: L.cy, align: 'center', valign: 'middle', maxW: S.w * .8 };
  }
}
// design px at 1080 (x L.u). Cinzel's cap height is 0.7 em: lyric 108 = 7 % of the frame height (S27's 96 is the
// reference block); beat 131 = 8.5 %; the title is fitted (see titleLayout)
const SIZE = { lyric: 108, bottom: 108, reference: 96, beat: 131, small: 46, plaque: 31, plaqueHook: 35, inscr: 0 };

// cached layout of a CARVED block: items stacked (an item may wrap), words positioned
const _lay = new Map();
function eyeOf(f) {
  const L = f.L, T = f.type || {};
  return T.sun ? { x: T.sun.x, y: T.sun.y, r: T.sun.r } : { x: L.cx, y: (L.portrait ? .42 : .45) * L.H, r: (L.portrait ? .3 * L.W : .3 * L.H) };
}
// the hook title: one or two balanced lines. The longest line's advance width (tracking included) is 86 % of the safe
// width, so its visible letters span ~70 % (portrait: 92 % / ~80 %); never taller than a 13 % cap. It composes under
// the eye (f.type.sun, the painted totality): just below the lower limb when it fits, otherwise bottom-aligned in the
// safe area, across the lower corona and limb (the 60 % eye in 16:9), so it never sits on the pupil's centre.
function titleLayout(e, f) {
  const L = f.L, S = L.safe, face = FACE.carved, it = e.items[0], words = it.text.split(' '), eye = eyeOf(f);
  const key = `${e.id}|title|${L.W}x${L.H}|${eye.x}|${eye.y}|${eye.r}`;
  if (_lay.has(key)) return _lay.get(key);
  const fill = (L.portrait ? .92 : .86) * S.w, capMax = (L.portrait ? .1 * L.W : .13 * L.H) / face.cap;
  let best = null;
  for (const n of [1, 2]) {
    const lines = n === 1 ? [words] : breakLines(words, face, 100, textWidth(face, 100, words.join(' ')) * .6, 2);
    if (lines.length !== n) continue;
    const w1 = Math.max(...lines.map(ws => textWidth(face, 1, ws.join(' '))));
    const px = Math.min(capMax, fill / w1);
    if (!best || px > best.px) best = { lines, px, w: w1 * Math.min(capMax, fill / w1) };
  }
  const lead = 1.08, hB = face.cap * best.px + (best.lines.length - 1) * best.px * lead;
  const yTop = Math.min(eye.y + eye.r + .035 * L.H, S.y + S.h - .012 * L.H - hB);
  const x = clamp(eye.x, S.x + best.w / 2, S.x + S.w - best.w / 2);
  const lay = layoutLines(best.lines, face, best.px, { x, y: yTop, align: 'center', valign: 'top', lead });
  lay.words.forEach(w => { w.item = 0; w.itemObj = it; w.wi = 0; });
  let k = 0; lay.words.forEach(w => { w.wi = k++; });
  lay.lines = best.lines.map(ws => ({ ii: 0, ws }));
  _lay.set(key, lay);
  return lay;
}
function carvedLayout(e, f, { face = FACE.carved, size, anchor = e.anchor || 'left', lead = 1.18, items = e.items.filter(i => !i.ghost), maxW } = {}) {
  const L = f.L, pl = placeOf(f, e);
  if (anchor === 'eye') return titleLayout(e, f);
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
    if (lines.length <= (anchor === 'bottom' ? 2 * items.length : 4) || k > 25) break;
  }
  const lay = layoutLines(lines.map(l => l.ws), face, px, { x: A.x, y: A.y, align: A.align, valign: A.valign, lead });
  // map words back to items / word indices
  const counters = items.map(() => 0);
  lay.words.forEach(w => { const ii = lines[w.line].ii; w.item = ii; w.itemObj = items[ii]; w.wi = counters[ii]++; });
  lay.lines = lines; lay.anchor = A;
  _lay.set(key, lay);
  return lay;
}

// onset of a positioned word: sung onset (reveal words), a sweep across the line (reveal line), or the item time
function onsetOf(e, it, w, lay) {
  if (e.ellipsis && w.text === '…') return e.ellipsis[0];
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
    const it = w.itemObj || e.items[w.item], on = onsetOf(e, it, w, lay);
    const p = it.reveal === 'none' ? (c.tq >= it.t ? 1 : -1) : sweepP(c.tq, on, w.text.length);
    if (p < 0) continue;
    const r = { text: w.text, x: w.x, y: w.y, face: w.face, px: w.px, sweep: { p, band: .85 * w.px }, w, it, on };
    if (mod) mod(r);
    if (r.skip) continue;
    runs.push(r);
  }
  return runs;
}
const gildOpts = (c, e, extra = {}) => ({ light: c.light, boil: c.boil, seed: c.seed, leaf: c.leaf, ...(c.world === 'gold' ? { shadow: 1.45, ao: .5, sigS: c.L.u * 7 } : {}), ...extra });

// ---------------------------------------------------------------- CARVED: generic block (lyrics, hook lines)
function carved(g, f, e, t) {
  const c = ctxOf(f, e, t), T = c.T;
  const lay = carvedLayout(e, f, { size: e.size ? SIZE[e.size] : undefined });   // (anchor 'eye': the hook title)
  let exposure = 1 + (T.flash || 0) * 1.4, opacity = 1, sil = T.backlit || 0;
  if (e.fadeout) opacity *= 1 - smooth(clamp((t - (e.t1 - e.fadeout)) / e.fadeout));
  if (e.backlit) sil = Math.max(sil, smooth(clamp((t - e.backlit[0]) / (e.backlit[1] - e.backlit[0]))));
  const runs = carvedRuns(e, lay, c, r => {
    if (e.rewind && t >= e.rewind[0]) {                  // the rewind: one frontier retracts right to left along the line
      const ws = lay.words.filter(v => v.line === r.w.line), x0 = Math.min(...ws.map(v => v.x)), lw = lay.widths[r.w.line];
      const F = lw * (1 - clamp((t - e.rewind[0]) / (e.rewind[1] - e.rewind[0]) * 1.1));
      r.sweep = { p: clamp((F - (r.x - x0)) / Math.max(1, r.w.w)), band: .35 * r.px, angle: .32, peak: .8 };
    }
    if (e.isolate && c.tq >= e.isolate[1] && r.text !== e.isolate[0]) r.reveal = 1 - smooth(clamp((c.tq - e.isolate[1]) / .09));
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
let _lab = null;
export function drawLabel(g, f, text, { x, y, align = 'left', face = FACE.plaque, px, color, t0 = -1e9, t, rule = false, alpha = 1, stagger = .012, shadow = true, m = null }) {
  const L = f.L, s = smartQuotes(text), gl = glyphX(face, px, s), wv = textWidth(face, px, s);
  const x0 = align === 'left' ? x : align === 'right' ? x - wv : x - wv / 2;
  // the label is set once into an offscreen canvas (glyphs fading in left to right), then composited with ONE soft
  // shadow: a shadowBlur per glyph costs ~1 ms each
  const pad = Math.ceil(12 * u(L) + .2 * px), cw = Math.ceil(wv + 2 * pad), ch = Math.ceil(px * 1.9 + 2 * pad);
  _lab ||= document.createElement('canvas');
  _lab.width = cw; _lab.height = ch;            // exact size, freshly cleared: filtered drawImage must never see stale pixels
  const c = _lab.getContext('2d', { willReadFrequently: true });
  applyFont(c, face, px); c.letterSpacing = '0px'; c.fillStyle = color || plaqueColor(f);
  const by = pad + face.asc * px + .25 * px, n = gl.length, dur = .3;
  let any = false;
  gl.forEach((q, i) => {
    const a = fadeIn(t, t0 + i * Math.min(stagger, dur / n), .16) * alpha;
    if (a <= .01 || q.ch === ' ') return;
    c.globalAlpha = a; c.fillText(q.ch, pad + q.x, by); any = true;
  });
  if (rule) {
    const k = ease.out(clamp((t - t0) / .45));
    c.globalAlpha = .75 * alpha; c.fillRect(pad, by - face.cap * px - .75 * px, wv * k, Math.max(1, 1.1 * u(L)));
    any = any || k > 0;
  }
  if (!any) return { x0, w: wv };
  g.save();
  g.translate(x0, y);
  if (m) g.transform(m[0], m[1], m[2], m[3], 0, 0);
  if (shadow) { g.shadowColor = 'rgba(8,5,2,.62)'; g.shadowBlur = 5 * u(L); g.shadowOffsetY = 1.2 * u(L); }
  g.drawImage(_lab, -pad, -by);
  g.restore();
  return { x0, w: wv };
}
function plaque(g, f, e, t) {
  const L = f.L, it = e.items[0], px = (e.size === 'hook' ? SIZE.plaqueHook : SIZE.plaque) * u(L);
  const A = anchorPos(L, e.anchor || 'lowerLeft'), pl = placeOf(f, e);
  const face = FACE.plaque, s = smartQuotes(it.text);
  const mw = A.maxW, lines = breakGroups(s, face, px, mw, 4);
  const lh = px * 1.55, n = lines.length;
  const yTop = A.valign === 'top' ? A.y + face.cap * px : A.valign === 'bottom' ? A.y - (n - 1) * lh : A.y - (n - 1) * lh / 2;
  lines.forEach((ws, i) => drawLabel(g, f, ws.join(' '), { x: pl && pl.x != null ? pl.x * L.W : A.x, y: pl && pl.y != null ? pl.y * L.H + i * lh : yTop + i * lh,
    align: A.align, px, t0: it.t + i * .12, t, rule: e.anchor === 'lowerLeft' && i === 0 }));
}

// ---------------------------------------------------------------- INSCR (Cormorant italic lower thirds, word by word)
function inscrPx(L) { return Math.round(L.portrait ? .078 * L.W : .072 * L.H); }   // 16:9: cap = 4.5 % of H; portrait: by width (4:5 = 6.2 % of H)
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
    const a = fadeIn(tq, wt, .2) * alpha;
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
// The scene passes the plinth's front face as f.type.plinth = {x, y, w, h} (fractions of the frame; x = centre) and
// draw: false when it paints the stone itself. Without one, a marble block is drawn: a statue's base running out of frame.
function incised(g, f, e, t) {
  const L = f.L, c = ctxOf(f, e, t), T = c.T, it = e.items[0];
  const P = T.plinth || {};
  const W = byAspect(L, { '16:9': [.58, .26], portrait: [.9, .2] });
  const pw = (P.w ?? W[0]) * L.W, ph = (P.h ?? W[1]) * L.H, px0 = (P.x ?? .5) * L.W - pw / 2, py0 = (P.y ?? (L.portrait ? .78 : .74)) * L.H;
  if (P.draw !== false) drawPlinth(g, L, px0, py0, pw, L.H - py0 + 4, c.seed);
  const face = FACE.inscrBold, words = it.text.split(' ');
  const zone = { x: px0 + .06 * pw, w: pw * .88, y: py0 + .08 * ph, h: ph * .84 };
  let px = zone.h * .5, lines = breakLines(words, face, px, zone.w, 2);
  for (let k = 0; k < 40 && (lines.length * px * 1.05 > zone.h || words.some(w => textWidth(face, px, w) > zone.w)); k++) { px *= .95; lines = breakLines(words, face, px, zone.w, 2); }
  const lay = layoutLines(lines, face, px, { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 + .1 * px, align: 'center', valign: 'middle', lead: 1.02 });
  const runs = [];
  lay.words.forEach((w, k) => {
    const p = sweepP(c.tq, it.words[k].t, w.text.length);
    if (p >= 0) runs.push({ text: w.text, x: w.x, y: w.y, face, px, sweep: { p, band: .6 * px, peak: .3 } });
  });
  gild(g, runs, { light: LIGHT.marble, incised: true, palette: C.stone, boil: 0, seed: c.seed, leaf: c.leaf, chisel: Math.max(1.6, .06 * px) });
}
function drawPlinth(g, L, x, y, w, h, seed) {
  const u = L.u, top = .045 * L.H, inset = .03 * w;
  g.save();
  // the top face, receding, lit by the corona overhead
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w - inset, y - top); g.lineTo(x + inset, y - top); g.closePath();
  const tg = g.createLinearGradient(0, y - top, 0, y);
  tg.addColorStop(0, '#cfc9be'); tg.addColorStop(1, '#ebe6dc');
  g.fillStyle = tg; g.fill();
  // the front face: polished marble falling into shadow, with veins
  const fg = g.createLinearGradient(0, y, 0, y + h);
  fg.addColorStop(0, '#c9c2b6'); fg.addColorStop(.35, '#ada69a'); fg.addColorStop(1, '#5f5a52');
  g.fillStyle = fg; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y - top, w, h + top); g.clip();
  for (let k = 0; k < 9; k++) {
    const a = hash2(k, 11), b = hash2(k, 23), c = hash2(k, 37);
    g.globalAlpha = .1 + .12 * c; g.strokeStyle = c > .5 ? '#5d574f' : '#857e73'; g.lineWidth = (.8 + 2.2 * hash2(k, 5)) * u;
    g.beginPath(); g.moveTo(x + a * w, y - top); g.bezierCurveTo(x + (a + .25) * w, y + .3 * h, x + (b - .2) * w, y + .5 * h, x + b * w, y + h); g.stroke();
  }
  g.restore();
  // edges: the arris catching the light, the sides turning away
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(255,255,250,.55)'; g.fillRect(x, y - .5 * u, w, Math.max(1, 1.6 * u));
  const sg = g.createLinearGradient(x, 0, x + w, 0);
  sg.addColorStop(0, 'rgba(0,0,0,.35)'); sg.addColorStop(.08, 'rgba(0,0,0,0)'); sg.addColorStop(.92, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = sg; g.fillRect(x, y, w, h);
  // the orange rim of the 360-degree horizon, faint on the left edge
  g.fillStyle = 'rgba(255,138,58,.25)'; g.fillRect(x, y, Math.max(1, 2 * u), h);
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
  const face = FACE.plaqueBold, px = 31 * u(L), S = L.safe;
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
  const px = 26 * u(L), face = FACE.mono, k = pulse(t, 9);
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
function chopPulse(t, L) { const b = beatPos(t), fb = b - Math.floor(b); return { pulseR: fb * 1.1 * L.vmax, pulse: .7 * Math.exp(-fb * 3) }; }
function chop(g, f, e, t) {
  const L = f.L, T = f.type || {}, fps = 60;
  if (e.stutter) return stutter(g, f, e, t);
  let cur = -1;
  e.items.forEach((it, k) => { if (t >= it.t - 1e-6) cur = k; });
  if (cur < 0) return;
  const it = e.items[cur], word = it.text, fit = fitFor(L, word);
  const { center, disk } = chopField(T, e, L);
  const fr = Math.round((t - it.t) * fps);
  const scale = fr >= 0 && fr < 3 ? [1.16, 1.05, 1.01][fr] : 1;
  const invert = invertNow(T, e, t, fps);
  const kick = clamp(T.kick ?? pulse(t, 10));
  const pl = T.place && T.place[e.id];
  const cx = pl && pl.x != null ? pl.x * L.W : L.cx, cy = pl && pl.y != null ? pl.y * L.H : (T.chopY ?? L.cy);
  if (fr >= 0 && fr < 6) chopEcho(g, L, fit, cx, cy, 1 + .05 + .03 * fr, .55 * (1 - fr / 6));
  const res = chopWord(g, f, { word, fit, cx, cy, scale, invert, center, disk, kick, t, spacing: 6.4, ...chopPulse(t, L), opacity: 1 });
  // HAL: on the first HALO the O is eclipsed for four frames
  if (it.hal && fr >= 0 && fr < 4 && !(T.disk && T.disk.hal === false)) halDisk(g, L, res, word, fr / 3, scale);
}
function chopField(T, e, L) {
  const center = T.field && T.field.center || (T.sun ? [T.sun.x, T.sun.y] : [L.cx, L.cy]);
  const disk = T.field && T.field.r != null ? T.field.r : T.sun ? T.sun.r : e.ring ? .16 * L.vmin : 0;   // S41-S44: the ring locked centre
  return { center, disk };
}
const invertNow = (T, e, t, fps) => !!(T.invert ?? (e.invert && e.invert.some(s => t >= s - 1e-6 && t < s + 2 / fps - 1e-6)));

// S36, the stutter. The montage exists to show the faces, so SKY shows on alternate picture cuts only (the shot's first
// cut is clean), hollow (orange outline, faint pearl lines), half size, in the upper or lower third away from the
// subject. The Glover caption (to 114.2) is a hard obstacle: SKY is never drawn over it. The scene's face boxes
// (f.type.avoid = [{x, y, w, h}, ...], fractions) are soft: SKY takes the third that is clear of them (alternating
// bottom / top when both are), and when the caption blocks the bottom and a face fills the top, it goes in the top
// third anyway, smaller (down to 0.3 of the full chop) and/or to one side, to clear the face as best it can; if even
// that would cover the face (over 25 % of the word on it), the cut is skipped. f.type.place[id] = {x, y[, size]}
// places it outright (size = scale of the full chop, default 0.5), unless that would cover the caption.
const STUTTER_SIZE = .5, STUTTER_MIN = .3;
function stutterSpot(f, e, L, fit, vis, t, jit) {
  const T = f.type || {}, pl = T.place && T.place[e.id], S = L.safe, face = FACE.chop;
  const hard = [], soft = T.avoid || [];
  for (const q of TRACK.events) {
    if (q.fx !== 'quote' || t < q.t0 - 1e-6 || t >= q.t1 - 1e-6 || (T.hide || []).includes(q.id)) continue;
    const G = quoteGeom(L, q.items.find(i => i.key === 'who')), y0 = G.y1 - FACE.plaqueBold.cap * G.px - .015 * L.H;
    hard.push({ x: S.x / L.W, y: y0 / L.H, w: S.w / L.W, h: (G.yb + .015 * L.H - y0) / L.H });
  }
  const dims = size => {
    const px = fit.px * size, n = fit.lines.length;
    return { hB: face.cap * px + (n - 1) * px * fit.lead, wB: Math.max(...fit.lines.map(ws => textWidth(face, px, ws.join(' ')))) };
  };
  const cover = (cx, cy, d, boxes) => boxes.reduce((a, b) => {
    const ix = Math.min(cx + d.wB / 2, (b.x + b.w) * L.W) - Math.max(cx - d.wB / 2, b.x * L.W);
    const iy = Math.min(cy + d.hB / 2, (b.y + b.h) * L.H) - Math.max(cy - d.hB / 2, b.y * L.H);
    return a + Math.max(0, ix) * Math.max(0, iy);
  }, 0);
  const size0 = pl && pl.size != null ? pl.size : STUTTER_SIZE;
  if (pl && pl.x != null && pl.y != null && !cover(pl.x * L.W, pl.y * L.H, dims(size0), hard)) return { cx: pl.x * L.W, cy: pl.y * L.H, size: size0 };
  const cx0 = (pl && pl.x != null ? pl.x * L.W : L.cx) + jit * size0;
  const at = (size, where, side) => {
    const d = dims(size);
    const cy = where === 'top' ? Math.max(S.y + .55 * d.hB, L.H / 6) : Math.min(S.y + S.h - .55 * d.hB, 5 * L.H / 6);
    const cx = side === 'l' ? S.x + d.wB / 2 + .01 * L.W : side === 'r' ? S.x + S.w - d.wB / 2 - .01 * L.W : cx0;
    return { cx, cy, size, hard: cover(cx, cy, d, hard), on: cover(cx, cy, d, soft) / (d.wB * d.hB) };
  };
  // the full-size candidates, centred: the clear third (alternating when both are clear)
  const pref = vis % 2 ? ['top', 'bottom'] : ['bottom', 'top'];
  const full = pref.map(w => at(size0, w, 'c')).filter(c => !c.hard);
  const clear = full.filter(c => c.on <= .02);
  if (clear.length) return clear[0];
  if (full.length === 2) return full[0].on <= full[1].on ? full[0] : full[1];   // no caption: the third less on a face
  // blocked (the caption below, a face above): the top third anyway, smaller and/or to one side, as clear as it gets
  let best = null;
  for (let size = size0; size >= STUTTER_MIN - 1e-6; size -= .05) {
    for (const side of ['c', 'l', 'r']) for (const w of ['top', 'bottom']) {
      const c = at(size, w, side);
      if (c.hard) continue;
      if (c.on <= .02) return c;
      if (!best || c.on < best.on) best = c;
    }
  }
  return best && best.on <= .25 ? best : null;                                   // else skip this cut
}
function stutter(g, f, e, t) {
  const L = f.L, T = f.type || {}, fps = 60;
  const cuts = [e.t0, ...e.onsets];
  let ci = -1;
  cuts.forEach((s, i) => { if (t >= s - 1e-6) ci = i; });
  if (ci < 1 || ci % 2 === 0) return;
  const vis = (ci - 1) / 2, fr = Math.round((t - cuts[ci]) * fps);
  const it = e.items[0], word = it.text, full = fitFor(L, word);
  const pat = [0, 1, -1, .5, -.5, 1.5, -1.5, 0];
  const spot = stutterSpot(f, e, L, full, vis, t, pat[vis % pat.length] * .02 * L.W);
  if (!spot) return;
  const fit = { ...full, px: full.px * spot.size }, cx = spot.cx, cy = spot.cy;
  const scale = fr <= 0 ? 1.075 : fr === 1 ? 1.025 : 1;
  const invert = invertNow(T, e, t, fps), kick = clamp(T.kick ?? pulse(t, 10));
  const { center, disk } = chopField(T, e, L);
  if (fr >= 0 && fr < 6) chopEcho(g, L, fit, cx, cy, 1.05 + .03 * fr, .5 * (1 - fr / 6), invert ? C.navyBlack : C.orange);
  chopWord(g, f, { word, fit, cx, cy, scale, invert, center, disk, kick, t, spacing: 6.4, ...chopPulse(t, L), hollow: true });
}

// ---------------------------------------------------------------- the Glover caption (S35): quote over attribution
function quoteGeom(L, who) {
  const px = 40 * u(L), px2 = 27 * u(L), yb = L.portrait ? .905 * L.H : .915 * L.H;
  const lines2 = breakGroups(who.text, FACE.plaque, px2, L.safe.w, 3);
  const lh2 = px2 * 1.6, y1 = yb - (lines2.length - 1) * lh2 - 1.25 * px - .35 * px2;
  return { px, px2, yb, y1, lines2, lh2 };
}
function quote(g, f, e, t) {
  const L = f.L, q = e.items.find(i => i.key === 'q'), who = e.items.find(i => i.key === 'who');
  const out = 1 - smooth(clamp((t - (e.t1 - .18)) / .18));
  const { px, px2, yb, y1, lines2, lh2 } = quoteGeom(L, who);
  drawLabel(g, f, q.text, { x: L.cx, y: y1, align: 'center', px, face: FACE.plaqueBold, t0: q.t, t, alpha: out, color: C.pearl, stagger: .008 });
  lines2.forEach((ws, i) => drawLabel(g, f, ws.join(' '), { x: L.cx, y: yb - (lines2.length - 1 - i) * lh2, align: 'center', px: px2, t0: who.t + .12, t, alpha: out * .92, color: C.pearl, stagger: .004 }));
}

// ---------------------------------------------------------------- S06: map labels on the banks
function map(g, f, e, t) {
  const L = f.L, c = ctxOf(f, e, t), k = clamp((t - e.t0) / (e.t1 - e.t0)), S = L.safe;
  const P = L.portrait;
  // 16:9: centred on each bank. Portrait: the banks are half a frame wide, so the labels hug their own side and are
  // staggered in depth (the far bank higher), which keeps the sub-labels from meeting over the river.
  const spots = P ? { west: [S.x, .57], east: [S.x + S.w, .69] } : { west: [.2 * L.W, .67], east: [.8 * L.W, .67] };
  const cpx = (P ? 80 : 92) * u(L) * (1 + .06 * k), spx = (P ? 23 : 25) * u(L) * (1 + .06 * k);
  const sy = .6 - .05 * k;
  for (const side of ['west', 'east']) {
    const lab = e.items.find(i => i.key === side), sub = e.items.find(i => i.key === side + '_sub');
    const [x, uy] = spots[side], y = uy * L.H, sgn = side === 'west' ? -1 : 1;
    const rot = sgn * .07, kx = sgn * .33, cs = Math.cos(rot), sn = Math.sin(rot);
    const m = [cs, sn, -sn * sy + kx * sy * cs, cs * sy];        // rotate, lay flat (squash), lean toward the vanishing point
    const align = P ? (side === 'west' ? 0 : 1) : .5;              // 0 left, .5 centre, 1 right
    if (lab && t >= lab.t) {
      const w = textWidth(FACE.carved, cpx, lab.text), x0 = x - w * align * cs, y0 = y - w * align * sn;
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
      const w = textWidth(FACE.plaque, spx, sub.text), off = 1.05 * cpx * sy;
      drawLabel(g, f, sub.text, { x: x - w * align * cs - sn * off, y: y - w * align * sn + off * cs, align: 'left', px: spx, t0: sub.t, t, m, color: '#f1e0b6', face: FACE.plaqueBold });
    }
  }
  const foot = e.items.find(i => i.key === 'foot');
  if (foot && t >= foot.t) drawLabel(g, f, foot.text, { x: L.cx, y: S.y + S.h - .01 * L.H, align: 'center', px: SIZE.plaque * u(L), t0: foot.t, t, rule: false });
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
  let px = (P ? 96 : 110) * u(L);
  const half = (P ? S.w / 2 - .02 * L.W : .4 * L.W);
  px = Math.min(px, half / textWidth(FACE.carved, 1, left.text), half / textWidth(FACE.carved, 1, right.text));
  const y = P ? S.y + .15 * L.H : .3 * L.H;
  const runs = [];
  const add = (it, x, align) => {
    const w = textWidth(FACE.carved, px, it.text), xx = align === 'left' ? x : x - w;
    const p = sweepP(c.tq, it.words[0].t, it.text.length);
    if (p >= 0) runs.push({ text: it.text, x: xx, y, face: FACE.carved, px, sweep: { p, band: .85 * px } });
  };
  add(left, S.x, 'left'); add(right, S.x + S.w, 'right');
  const lay = carvedLayout(e, f, { items: [foot], anchor: 'bottom', size: SIZE.bottom, maxW: P ? S.w : S.w * .9 });
  runs.push(...carvedRuns({ ...e, items: [foot] }, lay, c));
  gild(g, runs, gildOpts(c, e));
}

// ---------------------------------------------------------------- S26: SUN BURNING ON THE / BRONZE (an optional 'below' line)
function bronze(g, f, e, t) {
  const L = f.L, c = ctxOf(f, e, t), S = L.safe, P = L.portrait;
  const [ia, ib, ic] = ['above', 'big', 'below'].map(k => e.items.find(i => i.key === k));
  const bigW = P ? S.w * .96 : .52 * L.W;
  const pxB = bigW / textWidth(FACE.carved, 1, ib.text), pxA = (P ? 54 : 58) * u(L), pxC = SIZE.lyric * u(L);
  const x = P ? L.cx - bigW / 2 : S.x, capB = FACE.carved.cap * pxB;
  const yB = P ? .72 * L.H : .6 * L.H;
  const rows = [[ia, pxA, yB - capB - .5 * pxA], [ib, pxB, yB], [ic, pxC, yB + .3 * pxB + FACE.carved.cap * pxC]].filter(r => r[0]);
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
          if (e.t1 - e.glint >= 1.5 && k2 > 0 && k2 < 1) { r.sweep = null; r.shine = { k: k2, band: 1.5 * px, peak: .75 }; }   // only when the hold allows it
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
  const lay = carvedLayout(e, f, { size: SIZE[e.size] || SIZE.reference });
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
  const R = T.ringR || sun.r * 3.0;
  return { cx: sun.x, cy: sun.y, R };
}
function ring(g, f, e, t) {
  const c = ctxOf(f, e, t), L = f.L, { cx, cy, R } = ringGeom(f);
  const face = FACE.carved, px = clamp(R * .21, 30 * u(L), 96 * u(L)), cap = face.cap * px;
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
      rimColor: '#ffc56a', rim: 1.6,
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
    const it = w.itemObj || e.items[w.item], on = onsetOf(e, it, w, lay);
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
// The block is set high: it lingers ~1.3 s into S53 as the subject of "foretold the sun would go dark" below it.
function thales(g, f, e, t) {
  const c = ctxOf(f, e, t), L = f.L, S = L.safe, P = L.portrait;
  const [nm, gk, pq] = ['name', 'greek', 'plaque'].map(k => e.items.find(i => i.key === k));
  const px = (P ? 120 : 132) * u(L), gpx = px * .5, ppx = SIZE.plaque * u(L);
  const x = P ? L.cx - textWidth(FACE.carved, px, nm.text) / 2 : S.x, y = P ? .22 * L.H : .245 * L.H;
  const out = e.fadeout ? 1 - smooth(clamp((t - (e.t1 - e.fadeout)) / e.fadeout)) : 1;
  const runs = [];
  const p = sweepP(c.tq, nm.words[0].t, 6);
  if (p >= 0) runs.push({ text: nm.text, x, y, face: FACE.carved, px, sweep: { p, band: px } });
  const gx = P ? L.cx - textWidth(FACE.greek, gpx, gk.text) / 2 : x + .02 * px;   // portrait: all three lines centred
  if (t >= gk.t) runs.push({ text: gk.text, x: gx, y: y + .72 * px, face: FACE.greek, px: gpx, sweep: { p: clamp((c.tq - gk.t) / .5), band: .8 * gpx, peak: .6 } });
  gild(g, runs, gildOpts(c, e, { light: c.T.light || LIGHT.marble, opacity: out }));
  if (t >= pq.t) drawLabel(g, f, pq.text, { x: P ? L.cx : x + .02 * px, y: y + .72 * px + 1.25 * ppx + .4 * gpx, align: P ? 'center' : 'left', px: ppx, t0: pq.t, t, rule: false, alpha: out });
}

// (S53: v2 removed the forecast card. The shot's payoff, Thales's 1/720 construction with its Greek letters and its
// 1⁄720 label, is part of the picture: video/src/scenes/marble.js draws it under the lyric and behind Thales.)

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
    const kk = clamp((dt - k * .07) / .5); if (kk <= 0 || kk >= 1) continue;
    const s = 1 + .7 * ease.out(kk);
    g.save(); g.translate(cxw, cyw); g.scale(s, s); g.translate(-cxw, -cyw);
    g.globalAlpha = Math.pow(1 - kk, 2) * .6 * fade; g.strokeStyle = '#ffe7a8'; g.lineWidth = Math.max(.8, 1.1 * u(L) / s);
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

// ---------------------------------------------------------------- S64-S71: era captions (PLAQUE, two lines)
// YEAR · PLACE larger (bold; the year pearl, the place orange) over FACT (cap >= 4.5 % of the frame height; portrait by
// width). Mobile first: the head wraps year / place when it cannot hold one line (portrait), the fact wraps by words.
// A short trail of the three previous years sits above, dim, on a hairline.
const ERA_HEAD = { ...FACE.plaqueBold, track: .06 }, ERA_FACT = { ...FACE.plaque, weight: 500, track: .05 };
function era(g, f, e, t) {
  const L = f.L, S = L.safe, P = L.portrait;
  const head = e.items.find(i => i.key === 'head'), fact = e.items.find(i => i.key === 'fact');
  // mobile first: the fact line's cap height is >= 4.5 % of the frame's short side (frame height in 16:9, width in 4:5 and
  // 9:16, where u = W / 1080), the YEAR · PLACE line larger; either shrinks only if a single row would not fit the safe width
  const x = S.x + 18 * u(L), mw = S.w - 18 * u(L);
  const [year, ...rest] = head.text.split(' · '), place = rest.join(' · ');
  let hpx = (P ? 82 : 84) * u(L);
  const oneLine = textWidth(ERA_HEAD, hpx, head.text) <= mw;
  hpx = Math.min(hpx, ...(oneLine ? [head.text] : [year, place]).filter(Boolean).map(r => hpx * mw / textWidth(ERA_HEAD, hpx, r)));
  let fpx = 72 * u(L), factLines = breakLines(fact.text.split(' '), ERA_FACT, fpx, mw, 3);
  while (fpx > 40 * u(L) && (factLines.length > 3 || factLines.some(ws => textWidth(ERA_FACT, fpx, ws.join(' ')) > mw))) {
    fpx *= .96; factLines = breakLines(fact.text.split(' '), ERA_FACT, fpx, mw, 3);
  }
  const flh = fpx * 1.22, hlh = hpx * 1.16, yBot = S.y + S.h - .004 * L.H;
  const yFact0 = yBot - (factLines.length - 1) * flh, yHead1 = yFact0 - fpx * 1.42 - (oneLine ? 0 : hlh);
  const t0 = head.t;
  const hist = e.history || [], tpx = 24 * u(L), tlh = tpx * 1.6;
  const top = yHead1 - ERA_HEAD.cap * hpx - .55 * tpx - hist.length * tlh;
  g.save();
  g.fillStyle = C.pearl; g.globalAlpha = .45 * fadeIn(t, t0, .2);
  g.fillRect(S.x, top, Math.max(1, u(L)), yBot - top);
  g.globalAlpha = .9; g.fillStyle = C.orange;
  g.fillRect(S.x - 4 * u(L), yHead1 - ERA_HEAD.cap * hpx * .62, 9 * u(L), 9 * u(L));
  g.restore();
  hist.forEach((h, i) => drawLabel(g, f, h, { x, y: top + tpx + i * tlh, px: tpx, color: C.pearl, alpha: .45, t0: t0 - 1, t, shadow: false }));
  if (oneLine) {
    const x2 = x + measure(ERA_HEAD, hpx, year + ' · ');
    drawLabel(g, f, year, { x, y: yHead1, px: hpx, face: ERA_HEAD, color: C.pearl, t0, t, stagger: .02 });
    drawLabel(g, f, '·', { x: x + measure(ERA_HEAD, hpx, year + ' '), y: yHead1, px: hpx, face: ERA_HEAD, color: C.pearl, alpha: .55, t0: t0 + .1, t });
    if (place) drawLabel(g, f, place, { x: x2, y: yHead1, px: hpx, face: ERA_HEAD, color: C.orange, t0: t0 + .12, t, stagger: .01 });
  } else {
    drawLabel(g, f, year, { x, y: yHead1, px: hpx, face: ERA_HEAD, color: C.pearl, t0, t, stagger: .02 });
    if (place) drawLabel(g, f, place, { x, y: yHead1 + hlh, px: hpx, face: ERA_HEAD, color: C.orange, t0: t0 + .12, t, stagger: .01 });
  }
  factLines.forEach((ws, i) => drawLabel(g, f, ws.join(' '), { x, y: yFact0 + i * flh, px: fpx, face: ERA_FACT, color: C.pearl, t0: t0 + .25 + i * .08, t, stagger: .006 }));
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
    const npx = 32 * u(L), lines = breakGroups(nx.text, FACE.plaque, npx, L.safe.w, 3);   // the one practical line: legible on a phone
    lines.forEach((ws, i) => drawLabel(g, f, ws.join(' '), { x: L.cx, y: L.safe.y + L.safe.h - .01 * L.H - (lines.length - 1 - i) * npx * 1.6, align: 'center', px: npx, t0: nx.t, t }));
  }
}

function cartouche(g, f, e, t) { return drawCartouche(g, f, e, t, ctxOf(f, e, t)); }
function terminal(g, f, e, t) { return drawTerminal(g, f, e, t); }

export const FX = { carved, plaque, inscr, incised, counter, hud, chop, quote, map, diptych, mirrored, bronze, crescents, ring, pupil, shadow,
  thales, spark, era, home, endcard, cartouche, terminal };
export { gildOpts, sweepP, ctxOf, carvedRuns, carvedLayout };
