// decals.js: costume lettering drawn as type, never traced (the plate's letters would come out as garbled squiggles):
// RARE EARTH under the light-blue circle on her back, and the round 1420 MHz patch on her left sleeve. Each decal has a
// clear zone the cel analysis paints flat first (cel.js `clear`), so nothing of the plate's marks shows under it.
// Positions are in setup px for drawings whose body is a held cel (S78 typing: ref f40; S79 deadpan: f104).

import { P } from './props.js';
import { setFont } from '../../fonts.js';
import { MAT, LINE } from './palette.js';

const TAU = Math.PI * 2;
// P39 frame (wide setup space). The back: the light-blue circle is a perfect disk (it rhymes with the Earth on the monitor,
// same blue, same circle), RARE EARTH set beneath it, as on her model sheet. On the sheet her hair ends at the top of the
// circle; the plate's hair hangs over it, so the hair is cut there (cel `clear` zone: hair and the plate's blue become
// jacket) and finished with drawn tips that stop just above the disk.
const DISK = { x: 290.5, y: 350, r: 34 };
const TIPS = [[253, 287], [348, 287], [353, 296], [351, 306], [346, 300], [340, 310], [333, 303], [325, 312], [316, 305], [305, 314], [296, 306],
  [286, 313], [277, 305], [268, 311], [261, 303], [254, 308], [249, 300], [250, 293]];
const BACK = { text: { x: 290.5, y: 404, size: 13.6, rot: .07, w: 76 }, patch: { x: 435, y: 358.5, r: 18.2, rot: -.42 }, disk: DISK, tips: TIPS,
  cut: [[238, 295], [364, 295], [364, 392], [238, 392]] };
// P40 f104 registered into P39 space (front view, her left sleeve)
const FRONT = { patch: { x: 482, y: 361, r: 16.5, rot: -.12 } };

function decalsFor(e) {
  if (!e) return null;
  if (e.src === 'P39' && e.ref === 40) return BACK;
  if (e.src === 'P39') return BACK;
  if (e.src === 'P40' && e.pf >= 100) return FRONT;
  return null;
}

// zones for the cel: plate-normalised ellipses, painted flat with a material, interior lines removed
export function clearZones(e) {
  const D = decalsFor(e); if (!D) return [];
  const z = [];
  if (D.cut) z.push({ poly: D.cut.map(([x, y]) => [x / 960, y / 540]), mat: 'jacket', from: ['black', 'blue'] });
  if (D.text) z.push({ cx: D.text.x / 960, cy: (D.text.y - 6) / 540, rx: (D.text.w * .62) / 960, ry: 13 / 540, mat: 'jacket', rot: D.text.rot });
  if (D.patch) z.push({ cx: D.patch.x / 960, cy: D.patch.y / 540, rx: (D.patch.r + 2.5) / 960, ry: (D.patch.r + 2.5) / 540, mat: 'white' });
  return z;
}

export function drawDecals(g, view, e, u) {
  const D = decalsFor(e); if (!D) return;
  const s = view.s;
  if (D.disk) {   // the circle: flat light blue, no outline (a print on the fabric)
    const [x, y] = P(view, D.disk.x, D.disk.y);
    g.fillStyle = MAT.blue.base; g.beginPath(); g.arc(x, y, D.disk.r * s, 0, TAU); g.fill();
  }
  if (D.tips) {   // the hair's new ends: black lock tips over the cut, outlined along the tips (the top edge is inside the hair)
    const T = D.tips.map(([x, y]) => P(view, x, y));
    g.fillStyle = MAT.black.base; g.beginPath(); T.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
    g.strokeStyle = LINE; g.lineWidth = 2.2 * u; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); for (let k = 1; k < T.length; k++) k === 1 ? g.moveTo(...T[k]) : g.lineTo(...T[k]); g.stroke();
    // two strand lines in the sheen tone running into the longest tips
    g.strokeStyle = '#30343e'; g.lineWidth = 1.1 * u;
    for (const [a, b] of [[[300, 280], [305, 312]], [[282, 281], [286, 311]], [[330, 282], [325, 310]]]) { g.beginPath(); g.moveTo(...P(view, ...a)); g.quadraticCurveTo(...P(view, (a[0] + b[0]) / 2 + 1.5, (a[1] + b[1]) / 2), ...P(view, ...b)); g.stroke(); }
  }
  if (D.text) {
    const T = D.text, [x, y] = P(view, T.x, T.y);
    g.save(); g.translate(x, y); g.rotate(T.rot);
    setFont(g, 'chop', T.size * s, { weight: 600 }); g.fontStretch = 'normal'; g.letterSpacing = `${(.06 * T.size * s).toFixed(2)}px`;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#20222c';
    // fit the plate's width
    const w = g.measureText('RARE EARTH').width, k = (T.w * s) / Math.max(1, w);
    g.scale(k, 1); g.fillText('RARE EARTH', 0, 0);
    g.restore();
  }
  if (D.patch) {
    const Pt = D.patch, [x, y] = P(view, Pt.x, Pt.y), r = Pt.r * s;
    g.save(); g.translate(x, y); g.rotate(Pt.rot);
    g.fillStyle = MAT.white.base; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.strokeStyle = LINE; g.lineWidth = Math.max(1.5, r * .16); g.beginPath(); g.arc(0, 0, r * .9, 0, TAU); g.stroke();
    g.fillStyle = LINE; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    setFont(g, 'chop', r * .62, { weight: 800 }); g.fontStretch = 'normal'; g.letterSpacing = '0px';
    g.fillText('1420', 0, r * .02);
    setFont(g, 'chop', r * .5, { weight: 800 }); g.fontStretch = 'normal';
    g.fillText('MHz', 0, r * .52);
    g.restore();
  }
}
