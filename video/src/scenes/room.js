// room.js: INK, S78, S80, S81 (266.12-270.04, 273.40-281.0): the room, the blind commit, the wink, the end card. Owner:
// ROOM. Between them S79 is TREATY's (scenes/treaty.js): back in-universe, the kings swear peace on the final chord.
//
// v3 (director): she stays in her ORIGINAL anime, so she is different from her surroundings (the rewind video: the anime
// footage composited directly, which keeps the wink cute). These shots show AI-generated anime footage of her (Seedance
// plates P57 and P59), matted and composited straight over the abstract painted room (worlds/ink/direct.js: a light grade,
// a clean ink outline from the matte edge, the room's light and a hard rim from the monitors and the lamp). Nothing on her
// is redrawn, except the 1420 MHz patch's lettering in S78 (Seedance garbles it; decals.js redraws it on the footage).
// Two camera setups, each one painted background:
//   wide  (S78, P39's frame; P57 registered into it): from behind her chair. P57 (from the keyframe K78d) gives her: hair
//         ending at the top of the light-blue circle, RARE EARTH under it, the patch on her LEFT sleeve; the print bends
//         with the jacket because it is the footage. The room is P39's painted background as before: the ultrawide shows
//         the terminal, the vertical monitor the line-drawn Earth (the S77 hand-off), the ΔT map and the tmux panes; the
//         window SF fog and Sutro Tower; the chair in front of her is the room's. She types on the ticks and leans in toward
//         the map on dt.shift; the commit is typed in a burst; cut on the chord.
//   close (S80 + S81, P59, from the keyframe K59b: the character sheet's own face): the cut back from the kings lands on a
//         soft, closed-lip half-smile, eyes bright and on us. She types blind on the keyboard behind her (her shoulder comes
//         down on the three key clicks), the terminal behind her commits, then her own wink: the eye shut exactly on the
//         ting, a small sparkle beside it. 0.6 s later, black; the type layer draws the end card.
// Timing lives in worlds/ink/sheets.js (x-sheets: on twos, real holds, events on exact master frames). The type layer
// (src/type/) draws the terminal into the screen quads passed in f.type.screen; we draw it ourselves (f.type.manual)
// between the background and her, so she occludes the monitors.
import { scene, shotOverride } from '../registry.js';
import { makeLayout } from '../layout.js';
import { TM } from '../time.js';
import { PLATES } from '../plates.js';
import { drawText } from '../type/index.js';
import * as INK from '../worlds/ink/index.js';
import { directSheets, standinSheets, setEvents, EV, REG, celZones, TAKES } from '../worlds/ink/sheets.js';
import { expose, frameAt } from '../worlds/ink/xsheet.js';
import { paintBG, drawBG } from '../worlds/ink/bg.js';
import { drawWindow, WIN39, SCR39, subQuad, toOut, qpt, drawEarthPanel, drawDTMap, drawCloseBG, drawSidebar, drawLamp39, CLOSE41, poly } from '../worlds/ink/props.js';
import { initDecals, drawPatchOn } from '../worlds/ink/decals.js';
import { initDirect, directReady, directDrawing, drawDirect, samplePixels } from '../worlds/ink/direct.js';
import { ROOM } from '../worlds/ink/palette.js';

let SH = null, MODE = 'direct';
const SET = {};

async function initRoom() {
  await INK.init();
  setEvents(TM);
  await initDirect();
  // the production plates (P57/P59 for her, shown directly; P39/P40 for the painted room) or, when absent, the stand-ins
  const takes = { P57: PLATES.P57 && PLATES.P57.take, P59: PLATES.P59 && PLATES.P59.take };
  const ok = PLATES.P39 && PLATES.P40 && directReady('P57') && directReady('P59');
  SH = ok ? directSheets(takes) : null;
  if (new URLSearchParams(location.search).has('inkstandin')) SH = null;     // dev: preview the stand-in path
  MODE = SH ? 'direct' : 'standin';
  if (!SH) SH = standinSheets();
  else await initDecals({ P57: takes.P57 });
  SET.wide = INK.setup({ id: 'wide', space: 'P39', reg: { P40: REG['P40:take2.mp4->P39'], P57: REG[`P57:${TAKES.P57}->P39`] }, celFor: celZones });
  SET.close = INK.setup({ id: 'close', space: 'P59', celFor: celZones, wScale: 1.3 });
}

// framing: cover the 16:9 plate; portrait re-frames around her back (the circle, RARE EARTH and the patch all in frame)
const FRAME = { wide: { zoom: 1.2, focus: [.479, .49], portrait: { zoom: 1.0, focus: [.4, .5] } },
  close: { zoom: 1.0, focus: [.5, .42], portrait: { zoom: 1.0, focus: [.5, .4] } } };
const coverFor = (L, k) => { const fr = L.portrait ? FRAME[k].portrait : FRAME[k]; return L.cover(960, 540, fr.focus, fr.zoom); };
function viewFor(f, k) {
  const c = coverFor(f.L, k);
  return { ox: c.x, oy: c.y, s: c.w / 960 };
}

// her light in each setup (setup px; directions point toward the light). Wide: the monitors are ahead of her (frame right),
// the lamp beside her left arm (frame left). Close: the monitor glows behind her head, the lamp behind her, frame right.
const LOOK = {
  wide: { outline: 2.0, wash: { p0: [170, 230], c0: '#fff4ea', p1: [560, 470], c1: '#dcdfea' },
    rims: [{ dir: [1, -.25], col: ROOM.pearl, w: 3, a: .6, src: [560, 170], reach: 520 },
      { dir: [-.45, -1], col: ROOM.orange, w: 2.5, a: .55, src: [235, 180], reach: 300 }] },
  close: { outline: 2.4, wash: { p0: [480, 200], c0: '#ffffff', p1: [480, 600], c1: '#dde0ec' },
    rims: [{ dir: [-1, -.25], col: ROOM.pearl, w: 3.5, a: .55, src: [300, 260], reach: 650 },
      { dir: [1, -.55], col: ROOM.orange, w: 3, a: .55, src: [888, 128], reach: 620 }] },
};

async function character(f, k, view) {
  const e = expose(SH[k], f.i);
  if (!e) return null;
  if (MODE === 'standin') {             // no plates: the stand-in still as a cel
    const res = await INK.cel(SET[k], e);
    INK.drawCel(f.g, res, view, f.L.u, { wScale: SET[k].wScale || 1 });
    return { e };
  }
  const D = await directDrawing(e.src, e.pf);
  const xf = SET[k].reg[e.src] || null;
  const after = e.src === 'P57' ? (lg, P) => drawPatchOn(lg, view, SET.wide, { src: D.id, pf: D.pf }, D, P, samplePixels) : null;
  drawDirect(f.g, view, D, xf, { u: f.L.u, ...LOOK[k], key: k, after });
  return { e, D };
}

// ---------------------------------------------------------------- the wide setup: S78
// the painted room: P39 is the room (her zone excluded under her matte); P40 (registered) fills what P39 never sees
const HER39 = [[245, 92], [412, 92], [428, 250], [532, 318], [545, 400], [478, 470], [478, 545], [96, 545], [100, 388], [172, 300], [238, 252]];
const NOLINES39 = [WIN39.panes[1], [[0, -5], [42, -5], [42, 290], [0, 290]], SCR39.main, SCR39.side, [[160, 100], [275, 100], [285, 340], [150, 340]]];
const BG_WIDE = { zone: HER39, K: 18, gain: 1.25, dark: .82, seg: [.45, 110], minArea: 90, noLines: NOLINES39,
  frames: [{ src: 'P39', pf: 1 }, { src: 'P39', pf: 40 }, { src: 'P39', pf: 97 }, { src: 'P40', pf: 104, tier: 1 }, { src: 'P40', pf: 121, tier: 1 }, { src: 'P40', pf: 53, tier: 1 }, { src: 'P40', pf: 1, tier: 2 },
    // v2: P57's poses uncover a little of the desk that P39/P40 never saw (her arm as she settles back): it fills only
    // those pixels, so the room elsewhere is unchanged
    { src: 'P57', pf: 67, tier: 3 }, { src: 'P57', pf: 45, tier: 3 }, { src: 'P57', pf: 13, tier: 3 }] };
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
  const bg = await paintBG(SET.wide, MODE === 'direct' ? BG_WIDE : BG_STANDIN);
  drawBG(g, bg, view);
  drawWindow(g, view, f.t);
  drawLamp39(g, view);
  g.fillStyle = '#0b0c10'; poly(g, view, SCR39.main); g.fill(); poly(g, view, SCR39.side); g.fill();
  drawSidebar(g, view, Q.sidebar);
  drawEarthPanel(g, view, Q.earth, f.t);
  drawDTMap(g, view, Q.map, f.t, { shiftAt: EV.dtShift });
  f.type = { manual: true, screen: { main: toOut(view, Q.term), side: toOut(view, Q.panes) } };
  await drawText(f.t, f, { fromScene: true });
  await character(f, 'wide', view);
}

// ---------------------------------------------------------------- the close-up: S80 + S81
// the sparkle on the ting: a small four-point glint off the corner of her winking eye (her left, frame right), popping on
// the ting's frame and gone in under 0.4 s (setup px of P59 take 2)
const SPARK = { at: [596, 186], r: 15, twin: [22, 17, .55] };
function drawSparkle(g, view, i, u) {
  const F0 = frameAt(EV.ting), k = i - F0;
  if (k < 0 || k > 22) return;
  const pop = k < 3 ? (k + 1) / 3 : Math.max(0, 1 - (k - 2) / 20), x = view.ox + SPARK.at[0] * view.s, y = view.oy + SPARK.at[1] * view.s;
  const star = (cx, cy, R) => {
    if (R <= .3) return;
    g.beginPath();
    for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4 - Math.PI / 2, rr = j % 2 ? R * .18 : R; j ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  };
  g.save(); g.fillStyle = '#fff7ea'; g.globalAlpha = Math.min(1, pop * 1.4);
  star(x, y, SPARK.r * u * pop * (k < 3 ? 1.15 : 1));
  const k2 = k - 2, p2 = k2 < 0 ? 0 : k2 < 3 ? (k2 + 1) / 3 : Math.max(0, 1 - (k2 - 2) / 16);
  star(x + SPARK.twin[0] * view.s, y + SPARK.twin[1] * view.s, SPARK.r * SPARK.twin[2] * u * p2);
  g.restore();
}
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
  await character(f, 'close', view);
  if (MODE === 'direct') drawSparkle(g, view, f.i, f.L.u);
}

// The S77 -> S78 hand-off: where the line-drawn Earth sits on S78's first frame (output px), and the bezel of the monitor
// it is on, so the pull-back can end exactly in it. Same maths as drawEarthPanel. Usage (scenes/drop2.js):
//   import { roomHandoff } from './room.js'; const h = roomHandoff(f.W, f.H);   // { earth: {x, y, r}, bezel: [[x,y] x4] }
export function roomHandoff(W, H) {
  const L = makeLayout(W, H), c = coverFor(L, 'wide');
  const view = { ox: c.x, oy: c.y, s: c.w / 960 }, Q = toOut(view, WIDE_SCREENS.earth);
  const w = Math.hypot(Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]), h = Math.hypot(Q[3][0] - Q[0][0], Q[3][1] - Q[0][1]);
  const p = qpt(Q, .5, .44);
  return { earth: { x: p[0], y: p[1], r: Math.min(w * .4, h * .38) }, bezel: toOut(view, SCR39.side), panel: Q };
}

scene('S78', wide, { init: initRoom });
scene('S80', close);
scene('S81', close);
// INK draws on twos with real holds through its own x-sheet (sheets.js): the harness renders every master frame (60) so
// each drawing, key click and the wink land on their exact frames; held drawings come from the per-drawing cache.
for (const id of ['S78', 'S80', 'S81']) shotOverride(id, { cadence: 60 });
shotOverride('S78', { plate: { id: 'P57', at: 266.12 } });
shotOverride('S80', { plate: { id: 'P59', at: 273.4 } });
shotOverride('S81', { plate: { id: 'P59', at: 273.4 } });
