// cartouche.js: the Altdorfer tablet (after the hanging inscription in The Battle of Alexander at Issus, 1529): a painted
// slab hanging from a cord in the sky, with a tasselled pendant cord below, carrying incised gilded lettering.
// Painted, not vector: a warm parchment-stone body with slab thickness, laid-in brush strokes, worn edges, a fillet border
// and an iron ring; its brushwork boils a little on each 12 fps drawing like the paint around it. It sways on its cord
// (the tassel lags), and in S24 it is lowered into the sky.
//
//   S05: HALYS, then JADE WANG small (title).   S24: THE RIVER HALYS, / ON THE SIXTH YEAR OF THE WAR, word by word.

import { FACE, C, LIGHT, textWidth, breakLines, layoutLines, byAspect } from './style.js';
import { gild } from './gild.js';
import { LRU, makeCanvas } from '../assets.js';
import { clamp, lerp, smooth, hash2, hash3, rng, TAU } from '../core.js';

const _base = new LRU(8);
let _work = null;

function tabletPath(c, x, y, w, h) {
  // a slab with a shaped lower edge that falls to a central point (the pendant hangs from it)
  const b = h * .8, cusp = h;
  c.beginPath();
  c.moveTo(x + .015 * w, y); c.lineTo(x + w - .015 * w, y);
  c.quadraticCurveTo(x + w, y, x + w, y + .03 * h);
  c.lineTo(x + w, y + b);
  c.bezierCurveTo(x + .86 * w, y + b, x + .62 * w, y + .84 * h, x + .5 * w, y + cusp);
  c.bezierCurveTo(x + .38 * w, y + .84 * h, x + .14 * w, y + b, x, y + b);
  c.lineTo(x, y + .03 * h);
  c.quadraticCurveTo(x, y, x + .015 * w, y);
  c.closePath();
}

// the unlettered painted tablet, cached per size (the brushwork that boils is added per drawing)
function paintBase(tw, th, u) {
  const key = `${tw}x${th}`;
  const hit = _base.get(key); if (hit) return hit;
  const m = Math.ceil(.08 * tw), W = Math.ceil(tw + 2 * m), H = Math.ceil(th + 2 * m);
  const cv = makeCanvas(W, H), c = cv.getContext('2d'), r = rng(9173);
  const d = Math.max(4, .018 * tw);                               // slab thickness, seen bottom-right (light from upper left)
  c.save(); c.translate(d, d); tabletPath(c, m, m, tw, th); c.fillStyle = '#3b2715'; c.fill(); c.restore();
  c.save(); c.translate(d * .5, d * .5); tabletPath(c, m, m, tw, th); c.fillStyle = '#5e4326'; c.fill(); c.restore();
  tabletPath(c, m, m, tw, th);
  c.save(); c.clip();
  const gr = c.createLinearGradient(m, m, m + tw, m + th);
  gr.addColorStop(0, '#eadbb4'); gr.addColorStop(.45, '#d6c194'); gr.addColorStop(1, '#a88c5c');
  c.fillStyle = gr; c.fillRect(0, 0, W, H);
  // laid-in brushwork: short loaded strokes, mostly along the slab, in near tones
  const tones = ['#f1e4c0', '#dcc89c', '#c9b07e', '#b99b68', '#e6d3a6', '#a8895a'];
  for (let i = 0; i < 1400; i++) {
    const x = m + r() * tw, y = m + r() * th, len = (.02 + .07 * r()) * tw, ang = (r() - .5) * .5 + (r() < .15 ? Math.PI / 2 : 0);
    c.strokeStyle = tones[(r() * tones.length) | 0]; c.globalAlpha = .05 + .1 * r(); c.lineWidth = (1.5 + 5 * r()) * u; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(ang) * len * .5 + (r() - .5) * 6 * u, y + Math.sin(ang) * len * .5 + (r() - .5) * 6 * u, x + Math.cos(ang) * len, y + Math.sin(ang) * len); c.stroke();
  }
  // age: a few soft stains and a darker worn margin
  for (let i = 0; i < 9; i++) {
    const x = m + r() * tw, y = m + r() * th, rr = (.04 + .12 * r()) * tw, rg = c.createRadialGradient(x, y, 0, x, y, rr);
    rg.addColorStop(0, 'rgba(120,88,48,.13)'); rg.addColorStop(1, 'rgba(120,88,48,0)');
    c.globalAlpha = 1; c.fillStyle = rg; c.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
  }
  c.restore();
  c.save(); tabletPath(c, m, m, tw, th); c.clip();
  c.globalAlpha = .55; c.strokeStyle = '#5a3f22'; c.lineWidth = .035 * tw; c.filter = `blur(${(.012 * tw).toFixed(1)}px)`;
  tabletPath(c, m, m, tw, th); c.stroke(); c.filter = 'none';
  // the fillet: a raised border, lit along the top and left, shadowed bottom-right
  const ins = .045 * tw;
  c.globalAlpha = .85; c.lineWidth = Math.max(1.5, .006 * tw);
  c.strokeStyle = '#fff4d6'; c.save(); c.translate(-.6 * u, -.6 * u); tabletInset(c, m, m, tw, th, ins); c.stroke(); c.restore();
  c.strokeStyle = '#6d4f2c'; c.save(); c.translate(1.1 * u, 1.1 * u); tabletInset(c, m, m, tw, th, ins); c.stroke(); c.restore();
  c.restore();
  // the iron ring at the top
  c.save(); c.globalAlpha = 1;
  const rx = m + tw / 2, ry = m - .012 * tw, rr2 = .022 * tw;
  c.strokeStyle = '#1b130c'; c.lineWidth = .009 * tw; c.beginPath(); c.arc(rx, ry, rr2, 0, TAU); c.stroke();
  c.strokeStyle = 'rgba(255,226,170,.55)'; c.lineWidth = .003 * tw; c.beginPath(); c.arc(rx, ry, rr2, Math.PI * 1.05, Math.PI * 1.6); c.stroke();
  c.restore();
  const out = { cv, m, W, H, d };
  _base.set(key, out);
  return out;
}
function tabletInset(c, x, y, w, h, k) {
  const b = h * .8;
  c.beginPath();
  c.moveTo(x + k, y + k); c.lineTo(x + w - k, y + k); c.lineTo(x + w - k, y + b - k * .4);
  c.bezierCurveTo(x + .85 * w, y + b - k * .4, x + .62 * w, y + .84 * h - k, x + .5 * w, y + h - k * 1.6);
  c.bezierCurveTo(x + .38 * w, y + .84 * h - k, x + .15 * w, y + b - k * .4, x + k, y + b - k * .4);
  c.closePath();
}

function cord(g, x0, y0, x1, y1, w, u, seed) {
  // a twisted cord: dark core and a run of light twists
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = '#2a120a'; g.lineWidth = w * 1.25; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  g.strokeStyle = '#7a2e1a'; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  const n = Math.max(2, Math.floor(Math.hypot(x1 - x0, y1 - y0) / (w * 1.6))), dx = (x1 - x0) / n, dy = (y1 - y0) / n;
  g.strokeStyle = 'rgba(232,150,96,.55)'; g.lineWidth = Math.max(1, w * .35);
  for (let i = 0; i < n; i++) {
    const x = x0 + dx * (i + .2), y = y0 + dy * (i + .2);
    g.beginPath(); g.moveTo(x - w * .4, y - w * .2); g.lineTo(x + w * .4, y + w * .5); g.stroke();
  }
  g.restore();
}

function tassel(g, x, y, ang, len, w, u, seed) {
  g.save();
  g.translate(x, y); g.rotate(ang);
  cord(g, 0, 0, 0, len * .45, w * .8, u, seed);
  // the knot and the fringe
  const ky = len * .45;
  const kg = g.createRadialGradient(-w * .4, ky - w * .4, 0, 0, ky, w * 1.6);
  kg.addColorStop(0, '#f6d58a'); kg.addColorStop(.6, '#b07a2c'); kg.addColorStop(1, '#4a2c0e');
  g.fillStyle = kg; g.beginPath(); g.ellipse(0, ky + w * .6, w * 1.3, w * 1.5, 0, 0, TAU); g.fill();
  const r = rng(seed);
  for (let i = 0; i < 26; i++) {
    const s = (i / 25 - .5), x1 = s * w * 3.2 + (r() - .5) * w * .4, l = len * (.42 + .1 * r());
    g.strokeStyle = r() < .5 ? '#d9a34a' : '#8a5a1e'; g.globalAlpha = .9; g.lineWidth = Math.max(1, w * (.22 + .1 * r()));
    g.beginPath(); g.moveTo(s * w * 1.6, ky + w * 1.6); g.quadraticCurveTo(x1 * .8, ky + w * 1.6 + l * .5, x1, ky + w * 1.6 + l); g.stroke();
  }
  g.restore();
}

export function drawCartouche(g, f, e, t, c) {
  const L = f.L, u = L.u, P = L.portrait, title = e.items[0].key === 'title';
  const items = e.items.filter(i => !i.ghost);
  // the lettering decides the tablet's size
  const tw = (title ? byAspect(L, { '16:9': .36, portrait: .8 }) : byAspect(L, { '16:9': .5, portrait: .9 })) * L.W;
  let lines, lay, px, face = FACE.carvedBold;
  const inner = tw * .8;
  if (title) {
    px = inner * .86 / textWidth(face, 1, items[0].text);
  } else {
    px = (P ? 58 : 64) * u;
    for (let k = 0; k < 20; k++, px *= .95) { const ok = items.every(it => it.text.split(' ').every(w => textWidth(face, px, w) <= inner)); if (ok) break; }
  }
  if (title) lines = [{ it: items[0], ws: [items[0].text], px }, { it: items[1], ws: [items[1].text], px: px * .25 }];
  else { lines = []; for (const it of items) for (const ws of breakLines(it.text.split(' '), face, px, inner)) lines.push({ it, ws, px }); }
  // vertical metrics inside the tablet
  const gapT = .16 * px, padTop = title ? .3 * px : .9 * px;
  let y = padTop, rows = [];
  lines.forEach((ln, i) => {
    const cap = face.cap * ln.px;
    y += cap;
    rows.push({ ...ln, y });
    y += (title ? (i === 0 ? .55 * ln.px : 0) : .42 * ln.px);
  });
  const th = Math.max(y + (title ? 1.6 : 1.3) * px * (title ? .45 : 1), tw * .3) / .8;   // content sits in the slab above the cusp
  // where it hangs, how it moves
  const cxT = (P ? .5 : .5) * L.W, topY = (title ? byAspect(L, { '16:9': .1, portrait: .1 }) : byAspect(L, { '16:9': .07, portrait: .07 })) * L.H;
  let drop = 0;
  if (e.enter === 'descend') {
    const k = clamp((t - e.t0) / 1.1), s = 1 - Math.pow(1 - k, 3) * Math.cos(k * 1.4);   // lowered, settling with a little bounce
    drop = (1 - clamp(s, 0, 1.04)) * -(topY + th + .2 * L.H);
  }
  const settle = e.enter === 'descend' ? 1 + 2.5 * Math.exp(-Math.max(0, t - e.t0 - .8) * 1.6) : 1;
  const ang = settle * (.011 * Math.sin(TAU * t / 4.7 + .6) + .005 * Math.sin(TAU * t / 2.3 + 1.9));
  const pivot = [cxT, -.2 * L.H];
  const base = paintBase(Math.round(tw), Math.round(th), u);
  _work = _work && _work.width === base.W && _work.height === base.H ? _work : makeCanvas(base.W, base.H);
  const w = _work.getContext('2d');
  w.setTransform(1, 0, 0, 1, 0, 0); w.globalAlpha = 1; w.globalCompositeOperation = 'source-over';
  w.clearRect(0, 0, base.W, base.H); w.drawImage(base.cv, 0, 0);
  // the boil: a handful of strokes re-laid on every drawing (only at painterly cadence)
  if (c.boil) {
    const r = rng(c.seed ^ 0x51ed);
    w.save(); tabletPath(w, base.m, base.m, tw, th); w.clip();
    for (let i = 0; i < 90; i++) {
      const x = base.m + r() * tw, yy = base.m + r() * th, len = (.02 + .05 * r()) * tw;
      w.strokeStyle = r() < .5 ? '#efe0b8' : '#b89a66'; w.globalAlpha = .05 + .07 * r(); w.lineWidth = (1.5 + 4 * r()) * u; w.lineCap = 'round';
      w.beginPath(); w.moveTo(x, yy); w.lineTo(x + len, yy + (r() - .5) * 4 * u); w.stroke();
    }
    w.restore();
  }
  // the lettering: incised and gilded, word by word on the sung onsets (or the title on its cue)
  const runs = [], counters = new Map();
  for (const row of rows) {
    const s = row.ws.join(' '), lw = textWidth(face, row.px, s), x = base.m + tw / 2 - lw / 2;
    let idx = 0;
    for (const word of row.ws) {
      const k = counters.get(row.it) || 0; counters.set(row.it, k + 1);
      const wx = x + (idx ? textWidth(face, row.px, s.slice(0, idx)) + face.track * row.px : 0);
      let on = row.it.t;
      if (row.it.reveal === 'words' && row.it.words && row.it.words[k] && row.it.words[k].t != null) on = row.it.words[k].t;
      if (row.it.reveal === 'line') on = row.it.t + (wx - x) / Math.max(lw, 1) * .45;
      const p = c.tq < on ? -1 : clamp(.28 + (c.tq - on) / .38);
      if (p >= 0) runs.push({ text: word, x: wx, y: base.m + row.y, face, px: row.px, sweep: { p, band: .9 * row.px } });
      idx += word.length + 1;
    }
  }
  gild(w, runs, { light: c.T.light || LIGHT.bronze, incised: true, boil: c.boil * .6, seed: c.seed, leaf: c.leaf, palette: C.gold, sigB: Math.max(1.2, .05 * px) });
  // place it: rotate the slab, the cord and the tassel about the pivot above the frame
  const ox = cxT - base.m - tw / 2, oy = topY + drop - base.m;
  g.save();
  g.translate(pivot[0], pivot[1]); g.rotate(ang); g.translate(-pivot[0], -pivot[1]);
  cord(g, cxT, -20 * u, cxT, oy + base.m - .02 * tw, Math.max(2, .008 * tw), u, 3);
  g.drawImage(_work, ox, oy);
  const cuspX = cxT, cuspY = oy + base.m + th;
  const lag = (.016 * Math.sin(TAU * (t - .35) / 4.7 + .6) + .008 * Math.sin(TAU * (t - .2) / 2.3 + 1.9)) * settle * 1.6 - ang;
  tassel(g, cuspX, cuspY - .01 * th, lag, th * .55, Math.max(2, .008 * tw), u, 41);
  g.restore();
}
