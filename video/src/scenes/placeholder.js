// placeholder.js: a test card per world that exercises the whole harness until the real materials land:
// world palette, the eclipse as the film's clock (the Moon's bite counts down through Act I), type roles laid
// out per aspect ratio, the beat grid, a WebGL2 pass (CORONA/ORBIT), and a plate read as ink (ROOM).
// Everything here is a stand-in: no look decisions are made in this file.

import { scene } from '../registry.js';
import { PAL, TAU, clamp, kf, lerp, rgba, smooth } from '../core.js';
import { setFont } from '../fonts.js';
import { pulse, beatPos, FPS } from '../time.js';
import { getGL } from '../gl.js';
import { plateMap, plateTime, PLATES } from '../plates.js';
import { makeCanvas, pixels, LRU } from '../assets.js';

// Moon offset in sun radii (2 = first/fourth contact, 0 = totality) across the whole song: the cold open shows
// the payoff (total), the rewind goes back to a full sun, Act I's bite counts down to totality on Drop 1, the
// diamond ring (C3) opens it, Drop 2 runs to fourth contact. Song times are placeholders until SHOTLIST.md.
const MOON = [[0, 0], [5, 0], [12, 2.6], [20, 2.0], [110.6, 0], [189, 0], [195, .06], [215.6, .9], [256, 2.4]];
export const moonOffset = t => kf(t, MOON, k => k);

const SUN_AT = { '16:9': [.66, .36], '21:9': [.68, .38], '4:3': [.62, .34], '1:1': [.5, .33], '4:5': [.5, .3], '9:16': [.5, .27] };

// wrap `lines` to maxW at px (shrinking px when a single word is wider than maxW); returns {lines, px}
function fit(g, lines, maxW, px, role, minPx = 8) {
  for (; px >= minPx; px *= .92) {
    setFont(g, role, px);
    const out = [];
    let ok = true;
    for (const line of lines) {
      let cur = '';
      for (const w of String(line).split(' ')) {
        const nxt = cur ? cur + ' ' + w : w;
        if (g.measureText(nxt).width <= maxW) cur = nxt;
        else { if (cur) out.push(cur); cur = w; if (g.measureText(w).width > maxW) ok = false; }
      }
      out.push(cur);
    }
    if (ok) return { lines: out, px };
  }
  return { lines, px: minPx };
}

function title(f, lines, role) {
  const { g, L } = f, P = PAL[f.world] || PAL.bronze;
  if (!lines || !lines.length) return;
  g.save();
  g.textBaseline = 'alphabetic';
  if (role === 'drop') {                             // giant chopped word: fills the frame width
    const word = lines[Math.floor(beatPos(f.t)) % lines.length];
    let px = L.H * (L.portrait ? .2 : .36);
    setFont(g, 'drop', px);
    const w = g.measureText(word).width, max = L.safe.w;
    if (w > max) { px *= max / w; setFont(g, 'drop', px); }
    g.textAlign = 'center';
    g.fillStyle = rgba(P.pearl || '#efe9dc', .92);
    g.fillText(word, L.cx, L.cy + px * .36);
  } else if (role === 'verse') {                     // small italic lower third (>= 4.5 % of frame height), wrapped
    const r = fit(g, lines, L.safe.w, Math.max(L.type(.05), 28 * L.u), 'verse', L.type(.045));
    g.textAlign = 'center'; g.fillStyle = rgba('#efe9dc', .9);
    r.lines.forEach((s, j) => g.fillText(s, L.cx, L.safe.y + L.safe.h - (r.lines.length - 1 - j) * r.px * 1.2));
  } else if (role === 'mono') {                      // terminal block, top left of the safe area
    const r = fit(g, lines, L.safe.w, Math.round(26 * L.u), 'mono');
    g.textAlign = 'left'; g.fillStyle = PAL.room.screen;
    r.lines.forEach((s, j) => g.fillText(s, L.safe.x, L.safe.y + r.px * (1.4 * j + 1)));
  } else {                                           // carved capitals: left half on 16:9, top block on portrait
    const maxW = L.portrait ? L.safe.w : L.safe.w * .62;
    const { lines: ls, px } = fit(g, lines, maxW, L.pick({ '16:9': L.H * .085, '4:5': L.W * .085, '9:16': L.W * .1 }), 'carved');
    lines = ls;
    g.textAlign = L.portrait ? 'center' : 'left';
    const x = L.portrait ? L.cx : L.safe.x, y0 = L.portrait ? L.H * .62 : L.H * .7 - (lines.length - 1) * px * 1.15;
    const grad = g.createLinearGradient(0, y0 - px, 0, y0 + lines.length * px * 1.15);
    grad.addColorStop(0, '#fff1c9'); grad.addColorStop(.5, '#f1b545'); grad.addColorStop(1, '#8a5a1c');
    g.fillStyle = grad;
    lines.forEach((s, j) => g.fillText(s, x, y0 + j * px * 1.15));
  }
  g.restore();
}

const CORONA = `
uniform vec2 res; uniform vec2 sun; uniform float r, t, glow, beat;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + 1.), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * n(p); p *= 2.03; a *= .5; } return s; }
void main() {
  vec2 p = (uv * res - sun) / r;                       // in sun radii
  float d = length(p), a = atan(p.y, p.x);
  float streak = fbm(vec2(a * 6.0, log(max(d, 1.0)) * 2.5 - t * .15));
  float fall = exp(-(d - 1.) * (1.6 - .5 * beat)) * step(1.0, d);
  float c = fall * (.35 + .9 * streak) * glow;
  vec3 pearl = vec3(.94, .91, .86), orange = vec3(1., .48, .1);
  vec3 col = pearl * c + orange * pow(max(0., 1.0 - uv.y * 3.5), 3.) * .35 * glow;   // 360-degree horizon glow
  o = vec4(col, 1.);                                    // light: composited additively ('lighter')
}`;

const _ink = new LRU(24);
async function plateInk(f) {                         // a plate's ink map as dark cel lines on transparent
  const p = f.shot.plate; if (!p || !PLATES[p.id]) return null;
  const tp = plateTime(f.shot, f.t), m = await plateMap(p.id, 'g', tp, { loop: !!p.loop });
  if (!m) return null;
  const key = `${p.id}@${m.width}x${m.height}@${Math.round(tp * 1000)}`;
  let c = _ink.get(key);
  if (!c) {
    const d = pixels(m), id = new ImageData(m.width, m.height);
    for (let i = 0; i < m.width * m.height; i++) { id.data[i * 4] = 17; id.data[i * 4 + 1] = 18; id.data[i * 4 + 2] = 26; id.data[i * 4 + 3] = d[i * 4]; }
    c = makeCanvas(m.width, m.height); c.getContext('2d').putImageData(id, 0, 0);
    _ink.set(key, c);
  }
  return c;
}

scene('placeholder', async f => {
  const { g, L, W, H, world, params } = f, P = PAL[world] || PAL.bronze;
  // ground
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, P.bg); bg.addColorStop(1, world === 'room' ? P.navy : (P.umber || P.navy || P.bg));
  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  // the eclipse: sun, moon, corona
  const [su, sv] = (f.framing && f.framing.sun) || L.pick(SUN_AT);
  const sx = su * W, sy = sv * H, r = L.vmin * (world === 'orbit' ? .09 : .13);
  const off = moonOffset(f.t), total = off < .04;
  const beat = pulse(f.t, 7);
  if (world === 'corona' || world === 'orbit') {
    const glc = getGL(W, H);
    glc.pass(glc.program(CORONA), { res: [W, H], sun: [sx, H - sy], r, t: f.t, glow: total ? 1 : clamp(1 - off * 2), beat });
    g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(glc.canvas, 0, 0); g.restore();
  } else if (off < .5) {                             // painted worlds: a soft 2D corona only near totality
    const k = smooth(clamp(1 - off * 2)), cg = g.createRadialGradient(sx, sy, r, sx, sy, r * 3.2);
    cg.addColorStop(0, rgba('#efe9dc', .55 * k)); cg.addColorStop(1, rgba('#efe9dc', 0));
    g.fillStyle = cg; g.fillRect(0, 0, W, H);
  }
  if (world !== 'room') {
    g.fillStyle = world === 'gold' ? '#fff1c9' : '#f6ecd6';
    g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
    g.fillStyle = '#050405';                          // the Moon (also the transition disk)
    g.beginPath(); g.arc(sx - off * r, sy + off * r * .18, r * 1.01, 0, TAU); g.fill();
    g.strokeStyle = rgba(P.pearl || P.lead || '#efe9dc', .25 + .6 * beat); g.lineWidth = Math.max(1, 2 * L.u);
    g.beginPath(); g.arc(sx, sy, r * (1.25 + .25 * beat), 0, TAU); g.stroke();   // beat ring (timing.json grid)
  }

  // a plate read as ink (the renderer never shows the footage itself)
  const ink = await plateInk(f);
  if (ink) {
    const fr = (f.framing && f.framing.focus) || [.5, .4], R = L.cover(ink.width, ink.height, fr);
    g.fillStyle = P.paper; g.globalAlpha = .9; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    g.imageSmoothingQuality = 'high'; g.drawImage(ink, R.x, R.y, R.w, R.h);
  }

  title(f, params.title, params.role || 'carved');

  // test-card labels (a real HUD is a design element of the drops; this one proves the cadence and layout)
  g.save();
  setFont(g, 'mono', Math.round(18 * L.u));
  g.fillStyle = rgba(world === 'room' && ink ? '#11121a' : '#efe9dc', .75); g.textBaseline = 'top';
  const tc = s => { const m = Math.floor(s / 60), x = s - m * 60; return `${String(m).padStart(2, '0')}:${x.toFixed(2).padStart(5, '0')}`; };
  g.textAlign = 'left'; g.fillText(`${f.shot.id} · ${world.toUpperCase()} · ${params.label || ''}`, L.action.x, L.action.y);
  g.textAlign = 'right'; g.fillText(`DRAW ${f.cad} FPS ON ${FPS} · #${f.d}`, L.action.x + L.action.w, L.action.y);
  g.textBaseline = 'bottom';
  g.textAlign = 'left'; g.fillText(`${W}×${H} ${L.key}`, L.action.x, L.action.y + L.action.h);
  g.textAlign = 'right'; g.fillText(`t ${tc(f.t)} · moon ${off.toFixed(2)}r`, L.action.x + L.action.w, L.action.y + L.action.h);
  // drawing ticker: one pip per drawing in the current second; lit pip = this drawing (held frames identical)
  const n = Math.min(f.cad, 60), pw = Math.min(14 * L.u, L.action.w / 2 / n), x0 = L.cx - n * pw / 2, y = L.action.y + L.action.h - 10 * L.u;
  for (let j = 0; j < n; j++) { g.fillStyle = j === f.d % n ? '#ff7a1a' : rgba('#efe9dc', .2); g.fillRect(x0 + j * pw, y - 6 * L.u, pw * .7, 6 * L.u); }
  g.restore();
});
