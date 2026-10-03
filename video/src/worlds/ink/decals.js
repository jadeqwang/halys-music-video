// decals.js: costume graphics drawn, never traced (the plate's letters would come out as garbled squiggles): the
// light-blue circle on her back as a perfect disk with RARE EARTH set beneath it (the graphic match with the Earth on her
// monitor), the hair's ends above it, and the round 1420 MHz patch on her left sleeve (back view, then the front view
// from the landing on, placed per drawing). Each decal has a clear zone the cel analysis paints flat first (cel.js
// `clear`), so nothing of the plate's marks shows under it.
// Positions are in setup px for drawings whose body is a held cel (S78 typing: ref f40; S79 deadpan: f104).

import { P } from './props.js';
import { setFont } from '../../fonts.js';
import { MAT, LINE } from './palette.js';

const TAU = Math.PI * 2;
// P39 frame (wide setup space). The back: the light-blue circle is a perfect disk (it rhymes with the Earth on the monitor,
// same blue, same circle), RARE EARTH set beneath it, as on her model sheet. On the sheet her hair ends at the top of the
// circle; the plate's hair hangs over it, so the hair is cut there (cel `clear` zone: hair and the plate's blue become
// jacket) and finished with drawn tips that stop just above the disk.
const DISK = { x: 290.5, y: 358, r: 30 };      // the radius of the Earth disk on the side monitor (S78 framing): the same circle
// the hair's new ends: locks of different lengths (longest in the middle), each a pointed shape with curved sides.
// [notch-left, tip, ...] from her left (frame left) to right; the first and last points sit on the hair's outer edges
const LOCKS = { start: [248, 306], tips: [[255, 316], [278, 325], [295, 325], [317, 322], [336, 316], [349, 310]],
  notches: [[265, 310], [286, 313], [305, 312], [326, 311], [343, 307]], end: [351, 302], top: [[346, 290], [251, 290]] };
const BACK = { text: { x: 290.5, y: 406, size: 13.6, rot: .07, w: 76 }, patch: { x: 435, y: 358.5, r: 18.2, rot: -.42 }, disk: DISK, locks: LOCKS,
  cut: [[238, 304], [364, 304], [364, 394], [238, 394]] };
// the locks' outline as one path (output px): curved sides into each tip
function locksPath(view, L) {
  const p = new Path2D(), Q = ([x, y]) => P(view, x, y);
  let a = L.start; p.moveTo(...Q(a));
  L.tips.forEach((t, k) => {
    const b = k < L.notches.length ? L.notches[k] : L.end;
    // left side: straight down first, then into the point; right side: out of the point, curving up to the notch
    p.quadraticCurveTo(...Q([a[0] + (t[0] - a[0]) * .15, a[1] + (t[1] - a[1]) * .75]), ...Q(t));
    p.quadraticCurveTo(...Q([b[0] - (b[0] - t[0]) * .2, b[1] + (t[1] - b[1]) * .7]), ...Q(b));
    a = b;
  });
  return p;
}
// P40 registered into P39 space (front view, her left sleeve): measured on the landing and settle drawings, then f100+
const FRONT = { patch: { x: 482, y: 361, r: 16.5, rot: -.12 } };
const FRONT40 = { 79: { x: 465.2, y: 359.1, r: 13.7, rot: -.2 }, 84: { x: 477.8, y: 357, r: 15.8, rot: -.15 }, 90: { x: 484.1, y: 360.2, r: 16.8, rot: -.12 },
  96: { x: 484.1, y: 362.8, r: 16.8, rot: -.12 } };

function decalsFor(e) {
  if (!e) return null;
  if (e.src === 'P39' && e.ref === 40) return BACK;
  if (e.src === 'P39') return BACK;
  if (e.src === 'P40' && !e.smear && FRONT40[e.pf]) return { patch: FRONT40[e.pf] };
  if (e.src === 'P40' && e.pf >= 100) return FRONT;
  return null;
}

// zones for the cel: plate-normalised ellipses, painted flat with a material, interior lines removed
export function clearZones(e) {
  const D = decalsFor(e); if (!D) return [];
  const z = [];
  if (D.cut) z.push({ poly: D.cut.map(([x, y]) => [x / 960, y / 540]), mat: 'jacket', from: ['black', 'blue'], flat: true });
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
  if (D.locks) {   // the hair's new ends over the cut: black locks, outlined along the tips (the top edge is inside the hair)
    const L = D.locks, edge = locksPath(view, L), fill = new Path2D(edge);
    for (const q of [L.end, ...L.top]) fill.lineTo(...P(view, ...q));
    fill.closePath();
    g.fillStyle = MAT.black.base; g.fill(fill);
    g.strokeStyle = LINE; g.lineWidth = 2.2 * u; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(edge);
    // strand lines in the sheen tone running down into the longer locks
    g.strokeStyle = '#30343e'; g.lineWidth = 1.1 * u;
    for (const [a, b] of [[[281, 286], [278, 320]], [[297, 285], [295, 320]], [[315, 287], [317, 317]], [[262, 288], [256, 311]]]) {
      g.beginPath(); g.moveTo(...P(view, ...a)); g.quadraticCurveTo(...P(view, (a[0] + b[0]) / 2 + 1.2, (a[1] + b[1]) / 2), ...P(view, ...b)); g.stroke();
    }
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
