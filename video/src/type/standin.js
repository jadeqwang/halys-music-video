// standin.js: TEST SCAFFOLDING for type look-dev only. Loaded by index.js when the page URL has `typebg` (set by
// tools/type/typetest.mjs, never by render.mjs), and only over shots that still use the placeholder scene. It paints
// a dark painterly stand-in (production/lookdev stills, graded per world) plus the few scene elements the type is
// composed against (the eclipse disk for the ring text, the pupil, the shadow front, the monitors), and it fills
// f.type the way a real scene would, so the type is judged in context and the scene API is exercised.

import { loadImage } from '../assets.js';
import { clamp, smooth, lerp, hash2, TAU, rng } from '../core.js';
import { byAspect } from './style.js';
import { defaultScreens } from './terminal.js';

const IMG = {
  bronze: { armies: 'c_armies_bronze.jpg', duel: 'a_duel_bronze.jpg', face: 'b_face_bronze.jpg' },
  corona: { armies: 'c_armies_corona.jpg', duel: 'a_duel_corona.jpg', face: 'a_duel_corona.jpg' },
  marble: { armies: 'a_duel_marble.jpg', duel: 'a_duel_marble.jpg', face: 'b_face_marble.jpg' },
  room: { room: 'd_room_ink.jpg' },
};
const FACE_P = new Set(['P03', 'P04', 'P14', 'P16', 'P17', 'P19', 'P24', 'P28', 'P30']);
const ARMY_P = new Set(['P01', 'P02', 'P07', 'P08', 'P09', 'P10', 'P18', 'P20', 'P26', 'P29', 'P32', 'P38', 'proc.']);

function cover(g, img, L, focus = [.5, .5], filter = 'none') {
  const R = L.cover(img.width, img.height, focus);
  g.save(); g.filter = filter; g.drawImage(img, R.x, R.y, R.w, R.h); g.restore();
}
function vignette(g, L, k = .6) {
  const r = g.createRadialGradient(L.cx, L.cy * .9, .2 * L.vmin, L.cx, L.cy, .9 * L.vmax);
  r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, `rgba(6,3,1,${k})`);
  g.fillStyle = r; g.fillRect(0, 0, L.W, L.H);
}
function eclipse(g, x, y, r, { corona = 1, crescent = 0, seed = 1 } = {}) {
  // corona: pearl streamers; crescent: 0 = total, >0 = a lit crescent of that width (sun radii)
  g.save();
  if (corona > 0) {
    const R = rng(seed);
    g.globalCompositeOperation = 'lighter';
    const halo = g.createRadialGradient(x, y, r, x, y, 2.6 * r);
    halo.addColorStop(0, `rgba(243,239,230,${.55 * corona})`); halo.addColorStop(.25, `rgba(243,239,230,${.16 * corona})`); halo.addColorStop(1, 'rgba(243,239,230,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(x, y, 2.6 * r, 0, TAU); g.fill();
    g.lineCap = 'round';
    for (let i = 0; i < 900; i++) {                   // fine streamers, longer along a slightly tilted equator
      const a = R() * TAU, eq = Math.pow(Math.abs(Math.cos(a - .3)), 3), l = r * (1.05 + (.5 + 2.4 * eq) * Math.pow(R(), 1.6));
      const bend = (R() - .5) * .25;
      g.strokeStyle = `rgba(243,239,230,${(.03 + .07 * R()) * corona})`; g.lineWidth = Math.max(.8, (.6 + 1.6 * R()) * r / 300);
      g.beginPath(); g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      g.quadraticCurveTo(x + Math.cos(a + bend * .5) * (r + l) / 2, y + Math.sin(a + bend * .5) * (r + l) / 2, x + Math.cos(a + bend) * l, y + Math.sin(a + bend) * l); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  }
  if (crescent > 0) { g.fillStyle = '#fff3d6'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  g.fillStyle = '#030203'; g.beginPath(); g.arc(x + crescent * r * .9, y - crescent * r * .3, r * 1.01, 0, TAU); g.fill();
  g.restore();
}

export async function draw(f) {
  const { g, L, shot } = f, id = shot.id, t = f.t, T = f.type || (f.type = {});
  const plates = (shot.params && shot.params.plates) || [];
  const kind = plates.some(p => FACE_P.has(p)) ? 'face' : plates.some(p => ARMY_P.has(p)) ? 'armies' : 'duel';
  const world = f.world;
  g.save();
  g.fillStyle = '#000'; g.fillRect(0, 0, L.W, L.H);
  if (world === 'orbit') {
    const R = rng(77);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(243,239,230,${.2 + .6 * R()})`; const s = R() < .05 ? 2 : 1; g.fillRect(R() * L.W, R() * L.H, s * L.u, s * L.u); }
    if (id === 'S72') {                                 // Earthset: the first blue
      const ex = L.cx, ey = .4 * L.H, er = byAspect(L, { '16:9': .17 * L.H, portrait: .2 * L.W });
      const gr = g.createRadialGradient(ex - .3 * er, ey - .3 * er, 0, ex, ey, er);
      gr.addColorStop(0, '#9cc6f2'); gr.addColorStop(.6, '#2f7de1'); gr.addColorStop(1, '#0c2a5a');
      g.fillStyle = gr; g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fill();
      g.fillStyle = '#5d5a55'; g.beginPath(); g.ellipse(L.cx, 1.55 * L.H, 1.4 * L.W, .9 * L.H, 0, 0, TAU); g.fill();
    } else eclipse(g, L.cx, L.cy, .14 * L.vmin, { corona: .9, seed: 5 });
  } else if (world === 'room') {
    if (id !== 'S81') {
      cover(g, await loadImage('__standin/' + IMG.room.room), L, [.5, .5], 'brightness(.45) saturate(.8)');
      const S = defaultScreens(L);
      for (const q of [S.main, S.side]) { g.fillStyle = '#16181f'; g.fillRect(q[0][0] - 10 * L.u, q[0][1] - 10 * L.u, q[1][0] - q[0][0] + 20 * L.u, q[3][1] - q[0][1] + 20 * L.u); }
    }
  } else {
    const set = IMG[world === 'gold' ? 'bronze' : world] || IMG.bronze, file = set[kind] || set.duel;
    const grade = world === 'gold' ? 'brightness(1.08) saturate(1.15) sepia(.15)' : world === 'marble' ? 'brightness(.8)' : world === 'corona' ? 'brightness(.9)' : 'brightness(.72) saturate(.95)';
    cover(g, await loadImage('__standin/' + file), L, [.5, .5], grade);
    vignette(g, L, world === 'gold' ? .35 : .55);
  }
  // scene elements the type is composed against
  if (id === 'S01' || (id === 'S02' && t < 1.6)) {
    g.fillStyle = 'rgba(0,0,0,.72)'; g.fillRect(0, 0, L.W, L.H);
    const r = byAspect(L, { '16:9': .3 * L.H, portrait: .3 * L.W });
    eclipse(g, L.cx, .45 * L.H, r, { corona: 1, seed: 3 });
    if (id === 'S02') { const k = 1 - clamp((t - 1.45) / .15); g.fillStyle = `rgba(255,248,230,${.9 * k})`; g.fillRect(0, 0, L.W, L.H); T.flash = k; }
  }
  if (id === 'S28') {
    const sun = byAspect(L, { '16:9': { x: .63 * L.W, y: .45 * L.H, r: .1 * L.H }, portrait: { x: .5 * L.W, y: .36 * L.H, r: .11 * L.W } });
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, L.W, L.H);
    eclipse(g, sun.x, sun.y, sun.r, { corona: .25, crescent: .12, seed: 9 });
    T.sun = sun;
  }
  if (id === 'S29') {
    const P = byAspect(L, { '16:9': { x: .5 * L.W, y: .47 * L.H, r: .22 * L.H }, portrait: { x: .5 * L.W, y: .42 * L.H, r: .3 * L.W } });
    const ir = P.r * 1.9, gr = g.createRadialGradient(P.x, P.y, P.r * .9, P.x, P.y, ir);
    gr.addColorStop(0, '#3a2412'); gr.addColorStop(.5, '#6b4520'); gr.addColorStop(.85, '#3a2410'); gr.addColorStop(1, 'rgba(20,10,4,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(P.x, P.y, ir, 0, TAU); g.fill();
    g.fillStyle = '#050302'; g.beginPath(); g.arc(P.x, P.y, P.r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,240,210,.85)'; g.lineWidth = 3 * L.u; g.beginPath(); g.arc(P.x + .35 * P.r, P.y - .45 * P.r, .14 * P.r, -1.2, 1.9); g.stroke();
    T.pupil = P;
  }
  if (id === 'S30') {                                  // the umbra wall coming down the frame out of the sunset
    const k = smooth(clamp((t - 97.6) / 2.4)), y = lerp(.38, 1.15, k) * L.H;
    const gr = g.createLinearGradient(0, y - .12 * L.H, 0, y + .05 * L.H);
    gr.addColorStop(0, 'rgba(4,3,6,.88)'); gr.addColorStop(1, 'rgba(4,3,6,0)');
    g.fillStyle = gr; g.fillRect(0, 0, L.W, y + .05 * L.H);
  }
  if (id === 'S31' || id === 'S55' || id === 'S56') {
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, L.W, L.H);
    eclipse(g, byAspect(L, { '16:9': .7 * L.W, portrait: .5 * L.W }), .25 * L.H, .09 * L.vmin, { corona: 1, seed: 11 });
  }
  if (id === 'S34') { const k = smooth(clamp((t - 109.6) / .9)); g.fillStyle = `rgba(255,251,240,${k})`; g.fillRect(0, 0, L.W, L.H); }
  if (id === 'S57') { const k = Math.exp(-(t - 194.86) * 1.2); g.fillStyle = `rgba(255,250,235,${.75 * k})`; g.fillRect(0, 0, L.W, L.H); }
  if (id === 'S81') { g.fillStyle = '#000'; g.fillRect(0, 0, L.W, L.H); }
  if (world === 'corona' && /S4[1-4]/.test(id)) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, L.W, L.H); eclipse(g, L.cx, L.cy, .16 * L.vmin, { corona: .8, seed: 13 }); }
  g.restore();
}
