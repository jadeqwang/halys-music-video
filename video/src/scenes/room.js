// room.js: INK, S78-S81 (266.12-281.0): the room, the spin, the blind commit, the wink, the end card. Owner: INK.
//
// Two camera setups, each one painted background held under the cels (worlds/ink/):
//   wide  (S78 + S79, P39's frame; P40 registered into it): from behind her chair. The ultrawide shows the line-drawn
//         Earth (the S77 hand-off) beside the terminal; the vertical monitor the ΔT map above the tmux panes; the
//         window SF fog and Sutro Tower. She types on the ticks, spins on the last 0.33 s and lands on the final chord.
//         The cut S78 -> S79 at 270.04 is invisible: same camera, same drawing.
//   close (S80 + S81, P41): the deadpan close-up. She types blind (her shoulder dips on the three key clicks), the
//         terminal behind her commits, a sly smile, then the wink, drawn by us: the eyelid crosses the iris with the
//         Moon's curved limb and shuts exactly on the ting. 0.6 s later, black; the type layer draws the end card.
// Timing lives in worlds/ink/sheets.js (x-sheets: on twos, real holds, events on exact master frames). The type layer
// (src/type/) draws the terminal into the screen quads passed in f.type.screen; we draw it ourselves (f.type.manual)
// between the background and her, so she occludes the monitors.
import { scene, shotOverride } from '../registry.js';
import { makeLayout } from '../layout.js';
import { TM } from '../time.js';
import { PLATES } from '../plates.js';
import { drawText } from '../type/index.js';
import * as INK from '../worlds/ink/index.js';
import { roomSheets, standinSheets, setEvents, EV, REG, celZones, lidAt } from '../worlds/ink/sheets.js';
import { expose } from '../worlds/ink/xsheet.js';
import { paintBG, drawBG } from '../worlds/ink/bg.js';
import { drawWindow, WIN39, SCR39, subQuad, toOut, qpt, drawEarthPanel, drawDTMap, drawCloseBG, drawSidebar, drawLamp39, CLOSE41, poly } from '../worlds/ink/props.js';
import { drawDecals, clearZones } from '../worlds/ink/decals.js';
import { drawWink } from '../worlds/ink/eye.js';
import { drawSmallFace } from '../worlds/ink/face.js';

let SH = null, MODE = 'plates';
const SET = {};
const DBG = new URLSearchParams(location.search).get('inkdbg');

async function initRoom() {
  await INK.init();
  setEvents(TM);
  // the production plates (video/plates/P39-P41, the takes the x-sheets were timed on) or, when absent, the stand-ins
  const P = ['P39', 'P40', 'P41'].map(id => PLATES[id]);
  SH = P.every(Boolean) ? roomSheets({ P39: P[0].take, P40: P[1].take, P41: P[2].take }) : null;
  if (new URLSearchParams(location.search).has('inkstandin')) SH = null;     // dev: preview the stand-in path
  MODE = SH ? 'plates' : 'standin';
  if (!SH) SH = standinSheets();
  const zones = e => ({ ...celZones(e), clear: clearZones(e) });
  SET.wide = INK.setup({ id: 'wide', space: 'P39', reg: { P40: REG['P40:take2.mp4->P39'] }, calib: { P39: { src: 'P39', pf: 40 }, P40: { src: 'P40', pf: 104 } }, celFor: zones, smallFace: true });
  SET.close = INK.setup({ id: 'close', space: 'P41', calib: { P41: { src: 'P41', pf: 22 } }, celFor: zones, wScale: 1.3 });
}

// framing: cover the 16:9 plate; other aspects re-frame around the focus
const FRAME = { wide: { zoom: 1.2, focus: [.479, .49] }, close: { zoom: 1.0, focus: [.5, .42] } };
function viewFor(f, k) {
  const fr = FRAME[k], c = f.L.cover(960, 540, f.L.portrait ? (k === 'wide' ? [.45, .5] : [.5, .4]) : fr.focus, fr.zoom);
  return { ox: c.x, oy: c.y, s: c.w / 960 };
}

async function character(f, S, sheet, view) {
  const e = expose(sheet, f.i);
  const res = await INK.cel(S, e);
  if (DBG) { INK.debugDraw(f.g, res, view, DBG, f.L.u); return { e, res }; }
  INK.drawCel(f.g, res, view, f.L.u, { wScale: S.wScale || 1, after: cg => { drawDecals(cg, view, e, f.L.u); if (S.smallFace) drawSmallFace(cg, view, res, f.L.u); } });
  return { e, res };
}

// ---------------------------------------------------------------- the wide setup: S78 + S79
// the painted room: P39 is the room (her zone excluded under her matte); P40 (registered) fills what P39 never sees
const HER39 = [[245, 92], [412, 92], [428, 250], [532, 318], [545, 400], [478, 470], [478, 545], [96, 545], [100, 388], [172, 300], [238, 252]];
const NOLINES39 = [WIN39.panes[1], [[0, -5], [42, -5], [42, 290], [0, 290]], SCR39.main, SCR39.side, [[160, 100], [275, 100], [285, 340], [150, 340]]];
const BG_WIDE = { zone: HER39, K: 18, gain: 1.25, dark: .82, seg: [.45, 110], minArea: 90, noLines: NOLINES39,
  frames: [{ src: 'P39', pf: 1 }, { src: 'P39', pf: 40 }, { src: 'P39', pf: 97 }, { src: 'P40', pf: 104, tier: 1 }, { src: 'P40', pf: 121, tier: 1 }, { src: 'P40', pf: 53, tier: 1 }, { src: 'P40', pf: 1, tier: 2 }] };
// screens: the ultrawide's left quarter is behind her head (a sidebar), the terminal fills the rest; the vertical
// monitor stacks the sim's Earth (the S77 hand-off), the ΔT map and the tmux panes
export const WIDE_SCREENS = {
  sidebar: subQuad(SCR39.main, 0, 0, .265, 1), term: subQuad(SCR39.main, .27, 0, 1, 1),
  earth: subQuad(SCR39.side, 0, 0, 1, .27), map: subQuad(SCR39.side, 0, .28, 1, .49), panes: subQuad(SCR39.side, 0, .5, 1, 1),
};
// stand-in mode: the room_a board is the room (her region in its 960x540 frame)
const BG_STANDIN = { zone: [[200, 200], [420, 200], [600, 330], [600, 420], [560, 540], [140, 540], [190, 330]], K: 19, gain: 1.1, dark: .82, seg: [.32, 70], frames: [{ src: 'sa', pf: 1 }] };
async function wide(f) {
  const g = f.g, view = viewFor(f, 'wide'), Q = WIDE_SCREENS;
  const bg = await paintBG(SET.wide, MODE === 'plates' ? BG_WIDE : BG_STANDIN);
  drawBG(g, bg, view);
  drawWindow(g, view, f.t);
  drawLamp39(g, view);
  g.fillStyle = '#0b0c10'; poly(g, view, SCR39.main); g.fill(); poly(g, view, SCR39.side); g.fill();
  drawSidebar(g, view, Q.sidebar);
  drawEarthPanel(g, view, Q.earth, f.t);
  drawDTMap(g, view, Q.map, f.t, { shiftAt: EV.dtShift });
  f.type = { manual: true, screen: { main: toOut(view, Q.term), side: toOut(view, Q.panes) } };
  await drawText(f.t, f, { fromScene: true });
  await character(f, SET.wide, SH.wide, view);
}

// ---------------------------------------------------------------- the close-up: S80 + S81
async function close(f) {
  const g = f.g;
  if (f.t >= EV.black - 1e-6) {          // the cut to black; the end card is the type layer's (main.js draws it)
    g.fillStyle = '#000'; g.fillRect(0, 0, f.W, f.H);
    return;
  }
  const view = viewFor(f, 'close');
  drawCloseBG(g, view, f.t);
  f.type = { manual: true, screen: { main: toOut(view, CLOSE41.screen) } };
  await drawText(f.t, f, { fromScene: true });
  const { res } = await character(f, SET.close, SH.close, view);
  drawWink(g, view, res, lidAt(f.t), f.t, f.L.u, EV);
}

// The S77 -> S78 hand-off: where the line-drawn Earth sits on S78's first frame (output px), and the bezel of the monitor
// it is on, so the pull-back can end exactly in it. Same maths as drawEarthPanel. Usage (scenes/drop2.js):
//   import { roomHandoff } from './room.js'; const h = roomHandoff(f.W, f.H);   // { earth: {x, y, r}, bezel: [[x,y] x4] }
export function roomHandoff(W, H) {
  const L = makeLayout(W, H), fr = FRAME.wide, c = L.cover(960, 540, L.portrait ? [.45, .5] : fr.focus, fr.zoom);
  const view = { ox: c.x, oy: c.y, s: c.w / 960 }, Q = toOut(view, WIDE_SCREENS.earth);
  const w = Math.hypot(Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]), h = Math.hypot(Q[3][0] - Q[0][0], Q[3][1] - Q[0][1]);
  const p = qpt(Q, .5, .44);
  return { earth: { x: p[0], y: p[1], r: Math.min(w * .4, h * .38) }, bezel: toOut(view, SCR39.side), panel: Q };
}

scene('S78', wide, { init: initRoom });
scene('S79', wide);
scene('S80', close);
scene('S81', close);
// INK draws on twos with real holds through its own x-sheet (sheets.js): the harness renders every master frame (60) so
// each drawing, key click and the eyelid land on their exact frames; held drawings come from the per-drawing cache.
for (const id of ['S78', 'S79', 'S80', 'S81']) shotOverride(id, { cadence: 60 });
shotOverride('S78', { plate: { id: 'P39', at: 266.12 } });
shotOverride('S79', { plate: { id: 'P40', at: 267.94 } });     // plate f79 (3.29 s) lands on the chord 270.04
shotOverride('S80', { plate: { id: 'P41', at: 272.0 } });
shotOverride('S81', { plate: { id: 'P41', at: 272.0 } });
