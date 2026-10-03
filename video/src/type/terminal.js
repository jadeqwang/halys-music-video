// terminal.js: the room's terminal (S78-S80), ROOM.md's session with FACTCHECK.md's corrected lines. A character-cell
// renderer: one line per tick of the ticking build, the commit typed in bursts on the three key clicks, scrollback,
// a block cursor. Every glyph is real: the six characters JetBrains Mono lacks (the moon-phase spinner ◐◓◑◒, ✓ and
// ⚭) are drawn in their cells here, so nothing falls back to a machine-dependent system font.
//
// The screen content is drawn into the quads the room scene passes (f.type.screen = {main: [[x,y] TL, TR, BR, BL],
// side: [...]}) with a projective mesh warp; without them, into default rectangles (an insert of the two monitors).

import { FACE, C, applyFont, byAspect } from './style.js';
import { makeCanvas } from '../assets.js';
import { clamp, TAU } from '../core.js';

const SUBST = new Set(['◐', '◓', '◑', '◒', '✓', '⚭']);
let _main = null, _side = null;

function drawCellGlyph(c, ch, x, y, cw, px, col) {
  // (x, y) = cell's left edge at the baseline
  const cy = y - .36 * px, r = .3 * px, cx = x + cw / 2;
  c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = Math.max(1, .075 * px); c.lineJoin = 'round'; c.lineCap = 'round';
  if ('◐◓◑◒'.includes(ch)) {
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
    const a0 = { '◐': Math.PI / 2, '◓': Math.PI, '◑': -Math.PI / 2, '◒': 0 }[ch];   // the filled half: left, top, right, bottom
    c.beginPath(); c.arc(cx, cy, r, a0, a0 + Math.PI); c.closePath(); c.fill();
  } else if (ch === '✓') {
    c.lineWidth = Math.max(1, .1 * px);
    c.beginPath(); c.moveTo(cx - .26 * px, cy + .02 * px); c.lineTo(cx - .07 * px, cy + .22 * px); c.lineTo(cx + .28 * px, cy - .28 * px); c.stroke();
  } else if (ch === '⚭') {
    const rr = .2 * px;
    c.beginPath(); c.arc(cx - .13 * px, cy, rr, 0, TAU); c.stroke();
    c.beginPath(); c.arc(cx + .13 * px, cy, rr, 0, TAU); c.stroke();
  }
  c.restore();
}

// colour spans for a line: prompt, comments, warnings
function spans(s, prompt) {
  if (s.startsWith(prompt)) {
    const user = 'jade@rare-earth', rest = s.slice(user.length);
    const pathEnd = rest.indexOf('$') + 1;
    return [[user, C.orange], [rest.slice(0, pathEnd), C.dim], [rest.slice(pathEnd), C.pearl]];
  }
  if (s.startsWith('warn:')) return [['warn:', C.orange], [s.slice(5), C.pearl]];
  if (s.startsWith('[main ')) return [[s, C.pearl]];
  const h = s.indexOf('#');
  if (h > 0 && !s.includes('(#')) return [[s.slice(0, h), C.pearl], [s.slice(h), C.dim]];
  return [[s, C.pearl]];
}

function wrap(s, cols, words = false) {
  if (!s.length) return [{ s: '', o: 0 }];
  const out = [];
  if (!words) { for (let i = 0; i < s.length; i += cols) out.push({ s: s.slice(i, i + cols), o: i }); return out; }
  let i = 0;                                       // word wrap (the side panes format their own lines), hanging indent
  while (i < s.length) {
    const ind = out.length ? 10 : 0, room = cols - ind;
    let j = Math.min(s.length, i + room);
    if (j < s.length) { const sp = s.lastIndexOf(' ', j); if (sp > i) j = sp; }
    out.push({ s: ' '.repeat(ind) + s.slice(i, j), o: i - ind });
    i = j; while (s[i] === ' ') i++;
  }
  return out;
}

export function terminalState(T, t) {
  const lines = T.main.filter(l => l.t <= t + 1e-6).map(l => l.text);
  // the spinner cycles while it is the newest line
  const sp = T.main.findIndex(l => l.text.includes('syzygizing'));
  if (sp >= 0 && lines.length === sp + 1) lines[sp] = T.spinner[Math.floor(t * 10) % 4] + lines[sp].slice(1);
  let typed = '';
  for (const [a, b, s] of T.typing) if (t >= a) typed += s.slice(0, Math.ceil(s.length * clamp((t - a) / (b - a))));
  if (lines.length && lines[lines.length - 1] === T.prompt) lines[lines.length - 1] = T.prompt + typed;
  if (t >= T.enter) for (const o of T.output) if (t >= o.t) lines.push(o.text);
  return lines;
}

function renderPane(canvas, rows, cols, lines, t, { cursor = true, prompt, px, words = false }) {
  const c = canvas.getContext('2d', { willReadFrequently: true }), face = FACE.mono;
  const cw = .6 * px, lh = 1.42 * px, pad = .9 * px;
  const W = Math.ceil(cols * cw + 2 * pad), H = Math.ceil(rows * lh + 2 * pad);
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  c.setTransform(1, 0, 0, 1, 0, 0);
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b0f1a'); bg.addColorStop(1, '#070a12');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  const phys = [];
  for (const s of lines) for (const w of wrap(s, cols, words)) phys.push({ s: w.s, o: w.o, full: s });
  const vis = phys.slice(Math.max(0, phys.length - rows));
  applyFont(c, face, px);
  vis.forEach((ln, i) => {
    const y = pad + (i + 1) * lh - .42 * px;
    let x = pad, col0 = 0;
    // colour by the logical line it came from
    const sp = spans(ln.full, prompt);
    const start = ln.o;
    let k = 0, acc = 0;
    for (let j = 0; j < ln.s.length; j++) {
      const gi = Math.max(0, start + j);
      while (k < sp.length - 1 && gi >= acc + sp[k][0].length) { acc += sp[k][0].length; k++; }
      const ch = ln.s[j], colr = sp[k][1];
      if (SUBST.has(ch)) drawCellGlyph(c, ch, x, y, cw, px, colr);
      else if (ch !== ' ') { c.fillStyle = colr; c.fillText(ch, x, y); }
      x += cw; col0++;
    }
    if (cursor && i === vis.length - 1 && Math.floor(t / .53) % 2 === 0) { c.fillStyle = 'rgba(243,239,230,.85)'; c.fillRect(x + .05 * cw, y - .78 * px, cw * .9, px * .98); }
  });
  // faint scanless screen sheen: a soft gradient, no scanlines (this is a modern flat panel)
  const sh = c.createLinearGradient(0, 0, W, H);
  sh.addColorStop(0, 'rgba(255,255,255,.035)'); sh.addColorStop(.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,.015)');
  c.fillStyle = sh; c.fillRect(0, 0, W, H);
  return canvas;
}

// draw image src into quad q = [TL, TR, BR, BL] with a projective warp (mesh of affine triangles)
function warp(g, src, q, n = 10) {
  const [p0, p1, p2, p3] = q, sw = src.width, sh = src.height;
  const at = (u, v) => {   // bilinear is enough for the slight keystone of a monitor seen at an angle
    const x = (1 - v) * ((1 - u) * p0[0] + u * p1[0]) + v * ((1 - u) * p3[0] + u * p2[0]);
    const y = (1 - v) * ((1 - u) * p0[1] + u * p1[1]) + v * ((1 - u) * p3[1] + u * p2[1]);
    return [x, y];
  };
  const tri = (s0, s1, s2, d0, d1, d2) => {
    g.save();
    g.beginPath(); g.moveTo(d0[0], d0[1]); g.lineTo(d1[0], d1[1]); g.lineTo(d2[0], d2[1]); g.closePath();
    // expand the clip a hair so seams do not show
    g.lineWidth = .9; g.strokeStyle = 'rgba(0,0,0,0)'; g.clip();
    const den = (s0[0] * (s2[1] - s1[1]) - s1[0] * s2[1] + s2[0] * s1[1] + (s1[0] - s2[0]) * s0[1]);
    if (Math.abs(den) < 1e-9) { g.restore(); return; }
    const a = -(s0[1] * (d2[0] - d1[0]) - s1[1] * d2[0] + s2[1] * d1[0] + (s1[1] - s2[1]) * d0[0]) / den;
    const b = (s1[1] * d2[1] + s0[1] * (d1[1] - d2[1]) - s2[1] * d1[1] + (s2[1] - s1[1]) * d0[1]) / den;
    const c = (s0[0] * (d2[0] - d1[0]) - s1[0] * d2[0] + s2[0] * d1[0] + (s1[0] - s2[0]) * d0[0]) / den;
    const d = -(s1[0] * d2[1] + s0[0] * (d1[1] - d2[1]) - s2[0] * d1[1] + (s2[0] - s1[0]) * d0[1]) / den;
    const e = (s0[0] * (s2[1] * d1[0] - s1[1] * d2[0]) + s0[1] * (s1[0] * d2[0] - s2[0] * d1[0]) + (s2[0] * s1[1] - s1[0] * s2[1]) * d0[0]) / den;
    const f = (s0[0] * (s2[1] * d1[1] - s1[1] * d2[1]) + s0[1] * (s1[0] * d2[1] - s2[0] * d1[1]) + (s2[0] * s1[1] - s1[0] * s2[1]) * d0[1]) / den;
    g.transform(a, b, c, d, e, f);
    g.drawImage(src, 0, 0);
    g.restore();
  };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = (i + 1) / n, v0 = j / n, v1 = (j + 1) / n;
    const S = [[u0 * sw, v0 * sh], [u1 * sw, v0 * sh], [u1 * sw, v1 * sh], [u0 * sw, v1 * sh]];
    const D = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
    tri(S[0], S[1], S[2], D[0], D[1], D[2]); tri(S[0], S[2], S[3], D[0], D[2], D[3]);
  }
}
const isAxisRect = q => Math.abs(q[0][1] - q[1][1]) < .5 && Math.abs(q[3][1] - q[2][1]) < .5 && Math.abs(q[0][0] - q[3][0]) < .5 && Math.abs(q[1][0] - q[2][0]) < .5;

export function defaultScreens(L) {
  const r = (x0, y0, x1, y1) => [[x0 * L.W, y0 * L.H], [x1 * L.W, y0 * L.H], [x1 * L.W, y1 * L.H], [x0 * L.W, y1 * L.H]];
  return byAspect(L, {
    '16:9': { main: r(.05, .08, .66, .62), side: r(.7, .08, .95, .5) },
    portrait: { main: r(.04, .07, .96, .45), side: r(.12, .5, .88, .66) },
  });
}

export function drawTerminal(g, f, e, t) {
  const T = e.terminal, L = f.L, S = (f.type && f.type.screen) || defaultScreens(L);
  const lines = terminalState(T, t);
  if (S.main) {
    const qw = Math.hypot(S.main[1][0] - S.main[0][0], S.main[1][1] - S.main[0][1]);
    const qh = Math.hypot(S.main[3][0] - S.main[0][0], S.main[3][1] - S.main[0][1]);
    const cols = T.cols, px = Math.max(9, qw / (cols * .6 + 1.8)), rows = Math.max(6, Math.floor((qh - 1.8 * px) / (1.42 * px)));
    _main ||= makeCanvas(16, 16);
    renderPane(_main, rows, cols, lines, t, { prompt: T.prompt, px });
    g.save(); g.imageSmoothingQuality = 'high';
    if (isAxisRect(S.main)) g.drawImage(_main, S.main[0][0], S.main[0][1], S.main[1][0] - S.main[0][0], S.main[3][1] - S.main[0][1]);
    else warp(g, _main, S.main);
    g.restore();
  }
  if (S.side) {
    const qw = Math.hypot(S.side[1][0] - S.side[0][0], S.side[1][1] - S.side[0][1]);
    const cols = 36, px = Math.max(8, qw / (cols * .6 + 1.8));
    // side panes: the persistent tmux panes, wrapped to the vertical monitor
    _side ||= makeCanvas(16, 16);
    const qh = Math.hypot(S.side[3][0] - S.side[0][0], S.side[3][1] - S.side[0][1]), rows = Math.max(8, Math.floor((qh - 1.8 * px) / (1.42 * px)));
    const sideLines = [];
    T.side.forEach((s, i) => { if (i) sideLines.push('─'.repeat(cols)); sideLines.push(s); });
    renderPane(_side, rows, cols, sideLines, t, { cursor: false, prompt: T.prompt, px, words: true });
    g.save(); g.imageSmoothingQuality = 'high';
    if (isAxisRect(S.side)) g.drawImage(_side, S.side[0][0], S.side[0][1], S.side[1][0] - S.side[0][0], S.side[3][1] - S.side[0][1]);
    else warp(g, _side, S.side);
    g.restore();
  }
}
