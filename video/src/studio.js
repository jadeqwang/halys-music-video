// studio.js: the interactive scrubber (loaded by main.js only without ?render). Plays the song and draws the
// master frame under the playhead as fast as the scenes allow (frames are dropped when drawing is slower than
// real time; the film itself is rendered offline by render.mjs, so nothing here affects the output).

import { renderFrame, frameAt, frameInfo, W, H } from './main.js';
import { FPS, TM } from './time.js';
import { SHOTS } from './registry.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);

async function pickSong(audio) {
  for (const src of ['audio/song.mp3', '../Halys.mp3']) {   // render.mjs --serve aliases audio/song.mp3
    try { const r = await fetch(src, { method: 'HEAD' }); if (r.ok) { audio.src = src; return src; } } catch (e) { }
  }
  return null;
}

export async function start() {
  const audio = $('song'), scrub = $('scrub'), play = $('play'), tc = $('tc'), stat = $('stat'), size = $('size');
  const song = await pickSong(audio);
  scrub.max = TM.dur; scrub.step = 1 / FPS;
  size.value = `${W}x${H}`;
  size.onchange = () => { const [w, h] = size.value.split('x'); Q.set('w', w); Q.set('h', h); Q.set('t', (+scrub.value).toFixed(3)); location.search = Q.toString(); };
  $('mute').onchange = e => { audio.muted = e.target.checked; };

  // shot buttons
  const sb = $('shots');
  for (const s of SHOTS) {
    const b = document.createElement('button');
    b.textContent = `${s.id} ${s.cadence}`; b.title = `${s.t0.toFixed(2)}–${s.t1.toFixed(2)} s · ${s.world} · ${s.cadence} fps draw`;
    b.onclick = () => seek(s.t0); b.dataset.id = s.id; sb.appendChild(b);
  }

  let want = frameAt(+(Q.get('t') || 0)), shown = -1, busy = false, ms = 0;
  const fmt = t => { const m = Math.floor(t / 60); return `${String(m).padStart(2, '0')}:${(t - m * 60).toFixed(2).padStart(5, '0')}`; };
  async function draw() {
    if (busy || want === shown) return;
    busy = true;
    const i = want, t0 = performance.now(), fi = await renderFrame(i);
    ms = performance.now() - t0; shown = i; busy = false;
    const t = i / FPS;
    tc.textContent = fmt(t);
    if (!scrub.matches(':active')) scrub.value = t;
    stat.textContent = `f${i} · ${fi.shot ? `${fi.shot.id} · ${fi.shot.world} · draw ${fi.shot.cadence} fps #${fi.d} (t ${fi.t.toFixed(3)}) · key ${fi.key}` : 'gap'} · ${ms.toFixed(0)} ms` +
      ` · ${W}×${H} @ ${FPS} fps master${song ? '' : ' · no audio found'}`;
    for (const b of sb.children) b.classList.toggle('on', fi.shot && b.dataset.id === fi.shot.id);
    if (want !== shown) draw();
  }
  function seek(t) { t = Math.max(0, Math.min(TM.dur - 1e-3, t)); want = frameAt(t); if (song) audio.currentTime = t; draw(); }
  function tick() {
    if (!audio.paused) { want = frameAt(audio.currentTime); draw(); }
    requestAnimationFrame(tick);
  }
  scrub.oninput = () => seek(+scrub.value);
  const toggle = () => { if (!song) return; if (audio.paused) { audio.currentTime = want / FPS; audio.play(); play.textContent = '❚❚'; } else { audio.pause(); play.textContent = '▶'; } };
  play.onclick = toggle;
  addEventListener('keydown', e => {
    if (e.target.tagName === 'SELECT') return;
    const cur = want / FPS, sh = frameInfo(want).shot;
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); seek(e.shiftKey ? cur + 1 : (want + 1) / FPS + 1e-6); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); seek(e.shiftKey ? cur - 1 : (want - 1) / FPS + 1e-6); }
    else if (e.key === ']') { const n = SHOTS.filter(s => s.t0 > cur + 1e-6).sort((a, b) => a.t0 - b.t0)[0]; if (n) seek(n.t0); }
    else if (e.key === '[') { const p = SHOTS.filter(s => s.t0 < (sh ? sh.t0 : cur) - 1e-6).sort((a, b) => b.t0 - a.t0)[0]; if (p) seek(p.t0); }
  });
  audio.onended = () => { play.textContent = '▶'; };
  scrub.value = want / FPS; draw(); tick();
}
