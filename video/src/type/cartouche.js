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

// the tablet's outline: a slab whose lower edge falls to a central point, with a hand-laid irregular edge (static noise)
function outline(w, h, n = 160) {
  const b = h * .8, pts = [];
  const seg = (x0, y0, x1, y1, k) => { for (let i = 0; i < k; i++) { const s = i / k; pts.push([lerp(x0, x1, s), lerp(y0, y1, s)]); } };
  const bez = (p0, p1, p2, p3, k) => { for (let i = 0; i < k; i++) { const s = i / k, a = 1 - s; pts.push([a * a * a * p0[0] + 3 * a * a * s * p1[0] + 3 * a * s * s * p2[0] + s * s * s * p3[0], a * a * a * p0[1] + 3 * a * a * s * p1[1] + 3 * a * s * s * p2[1] + s * s * s * p3[1]]); } };
  seg(0, 0, w, 0, 40); seg(w, 0, w, b, 18);
  bez([w, b], [.86 * w, b], [.62 * w, .84 * h], [.5 * w, h], 22);
  bez([.5 * w, h], [.38 * w, .84 * h], [.14 * w, b], [0, b], 22); seg(0, b, 0, 0, 18);
  return pts.map(([x, y], i) => {
    const nx = (hash2(i, 3) - .5) * .004 * w + (hash2(i >> 2, 9) - .5) * .006 * w, ny = (hash2(i, 5) - .5) * .004 * w + (hash2(i >> 2, 11) - .5) * .006 * w;
    return [x + nx, y + ny];
  });
}
function tabletPath(c, x, y, w, h, pts = outline(w, h)) {
  c.beginPath(); pts.forEach(([px, py], i) => i ? c.lineTo(x + px, y + py) : c.moveTo(x + px, y + py)); c.closePath();
}

// the unlettered painted tablet, cached per size (the brushwork that boils is added per drawing)
function paintBase(tw, th, u) {
  const key = `${tw}x${th}`;
  const hit = _base.get(key); if (hit) return hit;
  const m = Math.ceil(.08 * tw), W = Math.ceil(tw + 2 * m), H = Math.ceil(th + 2 * m);
  const cv = makeCanvas(W, H), c = cv.getContext('2d', { willReadFrequently: true }), r = rng(9173), pts = outline(tw, th);
  const d = Math.max(4, .02 * tw);                                // slab thickness, seen bottom-right (light from upper left)
  c.save(); c.translate(d, d); tabletPath(c, m, m, tw, th, pts); c.fillStyle = '#2e1d0f'; c.fill(); c.restore();
  c.save(); c.translate(d * .55, d * .55); tabletPath(c, m, m, tw, th, pts); c.fillStyle = '#56391d'; c.fill(); c.restore();
  tabletPath(c, m, m, tw, th, pts);
  c.save(); c.clip();
  const gr = c.createLinearGradient(m, m, m + tw * .8, m + th * 1.1);
  gr.addColorStop(0, '#d9c49a'); gr.addColorStop(.5, '#b99d6b'); gr.addColorStop(1, '#7e6440');
  c.fillStyle = gr; c.fillRect(0, 0, W, H);
  // broad loaded dabs laid along the slab, then scumbled light, in near tones
  const tones = ['#e6d3a6', '#cdb17e', '#b2945f', '#9a7b4c', '#dcc390', '#8a6b40', '#c6a36a'];
  for (let i = 0; i < 700; i++) {
    const x = m + r() * tw, y = m + r() * th, len = (.03 + .1 * r()) * tw, ang = (r() - .5) * .35;
    c.strokeStyle = tones[(r() * tones.length) | 0]; c.globalAlpha = .045 + .07 * r(); c.lineWidth = (7 + 16 * r()) * u; c.lineCap = 'round';
    const bend = (r() - .5) * 10 * u;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(ang) * len * .5, y + Math.sin(ang) * len * .5 + bend, x + Math.cos(ang) * len, y + Math.sin(ang) * len); c.stroke();
  }
  for (let i = 0; i < 900; i++) {
    const x = m + r() * tw, y = m + r() * th, len = (.01 + .04 * r()) * tw, ang = (r() - .5) * .8;
    c.strokeStyle = r() < .55 ? '#efe2bf' : '#7a5e38'; c.globalAlpha = .03 + .05 * r(); c.lineWidth = (1.2 + 3 * r()) * u;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); c.stroke();
  }
  // the light pooling on the upper left of the face, the lower right falling into umber
  const lg = c.createRadialGradient(m + .25 * tw, m + .1 * th, 0, m + .3 * tw, m + .2 * th, 1.1 * tw);
  lg.addColorStop(0, 'rgba(255,236,190,.22)'); lg.addColorStop(.5, 'rgba(255,236,190,0)'); lg.addColorStop(1, 'rgba(40,22,8,.35)');
  c.globalAlpha = 1; c.fillStyle = lg; c.fillRect(0, 0, W, H);
  // craquelure: fine dark wandering cracks
  c.strokeStyle = '#3d2a16'; c.lineWidth = Math.max(.6, .8 * u);
  for (let i = 0; i < 26; i++) {
    let x = m + r() * tw, y = m + r() * th, a = r() * TAU;
    c.globalAlpha = .07 + .08 * r(); c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 9; k++) { a += (r() - .5) * 1.2; x += Math.cos(a) * .02 * tw; y += Math.sin(a) * .02 * tw; c.lineTo(x, y); }
    c.stroke();
  }
  // age stains
  for (let i = 0; i < 8; i++) {
    const x = m + r() * tw, y = m + r() * th, rr = (.05 + .12 * r()) * tw, rg = c.createRadialGradient(x, y, 0, x, y, rr);
    rg.addColorStop(0, 'rgba(92,62,30,.14)'); rg.addColorStop(1, 'rgba(92,62,30,0)');
    c.globalAlpha = 1; c.fillStyle = rg; c.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
  }
  c.restore();
  // worn edge: a soft dark rim inside the outline, and a broken highlight where the top and left edges catch the light
  c.save(); tabletPath(c, m, m, tw, th, pts); c.clip();
  c.globalAlpha = .6; c.strokeStyle = '#4a321a'; c.lineWidth = .045 * tw; c.filter = `blur(${(.014 * tw).toFixed(1)}px)`;
  tabletPath(c, m, m, tw, th, pts); c.stroke(); c.filter = 'none';
  c.restore();
  c.save(); c.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const s = r(), top = r() < .7, x = top ? m + s * tw : m + .004 * tw, y = top ? m + .004 * tw : m + s * th * .8;
    c.strokeStyle = '#fbefcc'; c.globalAlpha = .12 + .2 * r(); c.lineWidth = (1 + 2.2 * r()) * u;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + (top ? (.02 + .05 * r()) * tw : 0), y + (top ? 0 : (.02 + .05 * r()) * tw)); c.stroke();
  }
  c.restore();
  // the fillet: a cut line with a lit lip, slightly irregular
  const ins = .05 * tw;
  c.save(); c.lineWidth = Math.max(1.4, .005 * tw); c.lineJoin = 'round';
  c.globalAlpha = .55; c.strokeStyle = '#4f361c'; c.save(); c.translate(-.4 * u, -.4 * u); tabletInset(c, m, m, tw, th, ins); c.stroke(); c.restore();
  c.globalAlpha = .45; c.strokeStyle = '#f6e6be'; c.save(); c.translate(1.2 * u, 1.2 * u); tabletInset(c, m, m, tw, th, ins); c.stroke(); c.restore();
  c.restore();
  // the iron ring at the top
  c.save(); c.globalAlpha = 1;
  const rx = m + tw / 2, ry = m - .012 * tw, rr2 = .02 * tw;
  c.strokeStyle = '#1b130c'; c.lineWidth = .009 * tw; c.beginPath(); c.arc(rx, ry, rr2, 0, TAU); c.stroke();
  c.strokeStyle = 'rgba(255,226,170,.5)'; c.lineWidth = .003 * tw; c.beginPath(); c.arc(rx, ry, rr2, Math.PI * 1.05, Math.PI * 1.6); c.stroke();
  c.restore();
  const out = { cv, m, W, H, d, pts };
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
  const tw = Math.round((title ? byAspect(L, { '16:9': .34, portrait: .8 }) : byAspect(L, { '16:9': .5, portrait: .9 })) * L.W);
  let lines, lay, px, face = FACE.carvedBold;
  const inner = tw * .8;
  if (title) {
    px = inner * .86 / textWidth(face, 1, items[0].text);
  } else {
    px = (P ? 58 : 64) * u;
    for (let k = 0; k < 20; k++, px *= .95) { const ok = items.every(it => it.text.split(' ').every(w => textWidth(face, px, w) <= inner)); if (ok) break; }
  }
  if (title) lines = [{ it: items[0], ws: [items[0].text], px }, { it: items[1], ws: [items[1].text], px: px * .3 }];
  else { lines = []; for (const it of items) for (const ws of breakLines(it.text.split(' '), face, px, inner)) lines.push({ it, ws, px }); }
  // vertical metrics inside the tablet: the lettering sits in the slab above the point where the edge falls to the cusp
  let y = (title ? .42 : .6) * px;
  const rows = [];
  lines.forEach((ln, i) => {
    y += face.cap * ln.px;
    rows.push({ ...ln, y });
    if (i < lines.length - 1) y += title ? .5 * px : .46 * px;
  });
  const th = Math.round((y + (title ? .5 : .62) * px) / .8);
  // where it hangs, how it moves
  const cxT = (P ? .5 : .5) * L.W, topY = (title ? byAspect(L, { '16:9': .1, portrait: .1 }) : byAspect(L, { '16:9': .07, portrait: .105 })) * L.H;   // portrait S24: clear of the counter
  let drop = 0;
  if (e.enter === 'descend') {
    const k = clamp((t - e.t0) / 1.1), s = 1 - Math.pow(1 - k, 3) * Math.cos(k * 1.4);   // lowered, settling with a little bounce
    drop = (1 - clamp(s, 0, 1.04)) * -(topY + th + .2 * L.H);
  }
  const settle = e.enter === 'descend' ? 1 + 2.5 * Math.exp(-Math.max(0, t - e.t0 - .8) * 1.6) : 1;
  const ang = settle * (.011 * Math.sin(TAU * t / 4.7 + .6) + .005 * Math.sin(TAU * t / 2.3 + 1.9));
  const pivot = [cxT, -.2 * L.H];
  const base = paintBase(tw, th, u);
  _work = _work && _work.width === base.W && _work.height === base.H ? _work : makeCanvas(base.W, base.H);
  const w = _work.getContext('2d', { willReadFrequently: true });
  w.setTransform(1, 0, 0, 1, 0, 0); w.globalAlpha = 1; w.globalCompositeOperation = 'source-over';
  w.clearRect(0, 0, base.W, base.H); w.drawImage(base.cv, 0, 0);
  // the boil: a handful of strokes re-laid on every drawing (only at painterly cadence)
  if (c.boil) {
    const r = rng(c.seed ^ 0x51ed);
    w.save(); tabletPath(w, base.m, base.m, tw, th, base.pts); w.clip();
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
