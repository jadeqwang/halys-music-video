// style.js: faces, palette, metrics and text layout for the type layer.
//
// Faces (all OFL, loaded by ../fonts.js at boot; never Inter):
//   carved   Cinzel 600, tracked +0.10 em        CARVED gilded inscriptional capitals
//   plaque   Cinzel 500, tracked +0.16 em        PLAQUE museum labels (Cinzel's lowercase are small capitals)
//   inscr    Cormorant Garamond italic 500       INSCR verse-2 lower thirds, plinth inscriptions
//   chop     Archivo 900 at wdth 125 (expanded)  CHOP drop words
//   mono     JetBrains Mono 400/700              MONO terminal, HUD, forecast card
//   greek    Cardo 700                           S52's ΘΑΛΗΣ (none of the display faces has Greek)
// Sizes are in "design px" at 1080 on the frame's short side (multiply by L.u), then fitted to the safe area.

import { clamp } from '../core.js';

export const FACE = {
  carved: { family: 'Cinzel', weight: 600, track: .10, cap: .70, asc: .74, desc: .04 },
  carvedBold: { family: 'Cinzel', weight: 700, track: .12, cap: .70, asc: .74, desc: .04 },
  plaque: { family: 'Cinzel', weight: 500, track: .16, cap: .70, asc: .74, desc: .04 },
  plaqueBold: { family: 'Cinzel', weight: 600, track: .14, cap: .70, asc: .74, desc: .04 },
  inscr: { family: 'Cormorant Garamond', weight: 500, style: 'italic', track: .005, cap: .625, asc: .70, desc: .26 },
  inscrBold: { family: 'Cormorant Garamond', weight: 600, style: 'italic', track: .01, cap: .625, asc: .70, desc: .26 },
  chop: { family: 'Archivo', weight: 900, stretch: 'expanded', track: -.005, cap: .686, asc: .70, desc: .02 },
  mono: { family: 'JetBrains Mono', weight: 400, track: 0, cap: .73, asc: .77, desc: .23 },
  monoBold: { family: 'JetBrains Mono', weight: 700, track: 0, cap: .73, asc: .77, desc: .23 },
  greek: { family: 'Cardo', weight: 700, track: .10, cap: .69, asc: .72, desc: .05 },
};

// The palette: gold leaf for the painted worlds, bone for labels, the corona palette (Jade's: pearl, signal orange,
// navy-black) for the drops and the HUD. No blue (TREATMENT: no blue until Earth).
export const C = {
  gold: ['#2b170a', '#7a4c19', '#bf8c37', '#efc56d', '#fff2cc'],   // umber, deep, mid, light, highlight
  goldCool: ['#1d1712', '#5e4a2c', '#a88f5f', '#e3d3a6', '#fbf6e6'],  // the same leaf under pearl corona light
  stone: ['#4a443c', '#7d766b', '#b9b1a3', '#e2dbcd', '#f7f3ea'],   // incised marble
  umber: '#22140a', sil: '#140b05', bone: '#e8dcc2', paleGold: '#dcc28c', warmWhite: '#f4ecdb',
  pearl: '#f3efe6', navyBlack: '#060a16', orange: '#f08a2a', dim: '#8d8a84',
};

// light presets (dir points TOWARD the light in screen space, y down, like the look-dev materials' lightDir)
export const LIGHT = {
  bronze: { dir: [-.75, -.66], elev: .42, color: '#ffe2b0', intensity: 1.0 },      // low golden sun, raking from upper left
  gold: { dir: [-.55, -.83], elev: .55, color: '#fff0c8', intensity: 1.12 },       // returning sunlight, higher and brighter
  above: { dir: [-.15, -.99], elev: .62, color: '#fff3d2', intensity: 1.15 },      // "sunlight from above"
  corona: { dir: [.0, -1], elev: .7, color: '#e6e8ef', intensity: .95, cool: 1 },  // pearl light of the corona overhead
  marble: { dir: [-.3, -.95], elev: .65, color: '#e9ebf0', intensity: .95, cool: .7 },
  beads: { dir: [.85, -.5], elev: .35, color: '#fff6e0', intensity: 1.05 },
  end: { dir: [-.8, -.6], elev: .45, color: '#ffe6bb', intensity: 1.0 },
  orbit: { dir: [-.9, -.4], elev: .5, color: '#fff1d6', intensity: 1.0 },
};

const MC = new OffscreenCanvas(8, 8).getContext('2d', { willReadFrequently: true });

export function fontStr(face, px) {
  return `${face.style || 'normal'} ${face.weight} ${px.toFixed(2)}px "${face.family}", "Cardo"`;
}
export function applyFont(c, face, px) {
  c.font = fontStr(face, px);
  c.fontStretch = face.stretch || 'normal';           // the shorthand resets stretch: set it after
  c.letterSpacing = `${((face.track || 0) * px).toFixed(2)}px`;
  c.fontKerning = 'normal';
  return c;
}
export function measure(face, px, s) { applyFont(MC, face, px); return MC.measureText(s).width; }
// visual width of a string: the measured advance includes one tracking after the last glyph
export const textWidth = (face, px, s) => s.length ? measure(face, px, s) - (face.track || 0) * px : 0;

// glyph x positions inside a string (kerning- and tracking-aware: prefix widths)
export function glyphX(face, px, s) {
  applyFont(MC, face, px);
  const xs = [0];
  for (let i = 1; i <= s.length; i++) xs.push(MC.measureText(s.slice(0, i)).width);
  return s.split('').map((ch, i) => ({ ch, x: xs[i], w: xs[i + 1] - xs[i] - (i === s.length - 1 ? (face.track || 0) * px : 0) }));
}

// Typographic quotes: the track keeps SHOTLIST's exact strings (straight quotes); the renderer sets them properly.
export function smartQuotes(s) {
  return s.replace(/(^|[\s(\[—–-])"/g, '$1“').replace(/"/g, '”')
    .replace(/(\w)'(\w)/g, '$1’$2').replace(/(^|\s)'/g, '$1‘').replace(/'/g, '’');
}

// Balanced line breaking: the fewest lines that fit maxW, then the most even (minimise the longest line, avoid orphans).
export function breakLines(words, face, px, maxW, maxLines = 6, sep = ' ') {
  const n = words.length, W = (a, b) => textWidth(face, px, words.slice(a, b).join(sep));
  if (n <= 1 || W(0, n) <= maxW) return [words.slice()];
  let best = null;
  const lim = Math.min(n, 13);
  for (let mask = 0; mask < (1 << (lim - 1)); mask++) {
    const cuts = [0];
    for (let i = 1; i < lim; i++) if (mask & (1 << (i - 1))) cuts.push(i);
    cuts.push(n);
    const k = cuts.length - 1; if (k > maxLines) continue;
    let worst = 0, ok = true, cost = 0;
    const ws = [];
    for (let j = 0; j < k; j++) { const w = W(cuts[j], cuts[j + 1]); ws.push(w); if (w > maxW) { ok = false; break; } worst = Math.max(worst, w); }
    if (!ok) continue;
    cost = k * 1e6 + worst + (ws[k - 1] < .3 * worst ? .4 * worst : 0) + (ws[0] < .3 * worst ? .2 * worst : 0);
    if (!best || cost < best.cost) best = { cost, cuts };
  }
  if (!best) return words.map(w => [w]);
  const out = [];
  for (let j = 0; j + 1 < best.cuts.length; j++) out.push(words.slice(best.cuts[j], best.cuts[j + 1]));
  return out;
}

// Labels with ' · ' separators (credits, plaques, the end card) break between the groups, never inside one
// (`VICTOR GLOVER · ARTEMIS II` / `DURING TOTALITY · 2026`, not `… ARTEMIS` / `II · …`); the separator at a break is
// dropped. Falls back to word breaks when a group alone is wider than maxW. Returns lines as word arrays.
export function breakGroups(text, face, px, maxW, maxLines = 3) {
  const groups = text.split(' · ');
  if (groups.length > 1 && groups.every(g => textWidth(face, px, g) <= maxW)) {
    const ls = breakLines(groups, face, px, maxW, maxLines, ' · ');
    if (ls.length <= maxLines) return ls.map(gs => gs.join(' · ').split(' '));
  }
  return breakLines(text.split(' '), face, px, maxW, maxLines);
}

// Lay out lines of text into positioned words. lines: [[word, ...], ...]; returns words with x (left), y (baseline),
// w, line index, and glyph positions; plus the block's bbox and line widths. align: left | center | right.
export function layoutLines(lines, face, px, { x = 0, y = 0, align = 'left', lead = 1.2, valign = 'top' } = {}) {
  const lh = px * lead, out = [], widths = [];
  const n = lines.length, capTop = face.cap * px;
  // y: valign top -> y is the cap top of line 0; bottom -> y is the baseline of the last line; middle -> block centre
  let y0 = valign === 'top' ? y + capTop : valign === 'bottom' ? y - (n - 1) * lh : y + capTop / 2 - (n - 1) * lh / 2;
  lines.forEach((ws, li) => {
    const s = ws.join(' '), lw = textWidth(face, px, s);
    widths.push(lw);
    const lx = align === 'left' ? x : align === 'right' ? x - lw : x - lw / 2;
    let idx = 0;
    for (const w of ws) {
      const wx = lx + measure(face, px, s.slice(0, idx));
      out.push({ text: w, x: wx, y: y0 + li * lh, w: textWidth(face, px, w), line: li, face, px });
      idx += w.length + 1;
    }
  });
  const minX = Math.min(...out.map(w => w.x)), maxX = Math.max(...out.map(w => w.x + w.w));
  return { words: out, widths, lh, bbox: { x0: minX, x1: maxX, y0: y0 - capTop, y1: y0 + (n - 1) * lh + face.desc * px }, px, face };
}

// fit: shrink px until every word fits maxW and the broken block fits maxH
export function fitBlock(words, face, px, maxW, { maxH = 1e9, maxLines = 6, minPx = 8, lead = 1.2 } = {}) {
  for (let k = 0; k < 40; k++, px *= .95) {
    if (words.some(w => textWidth(face, px, w) > maxW)) continue;
    const lines = breakLines(words, face, px, maxW, maxLines);
    if (lines.length > maxLines) continue;
    const h = face.cap * px + (lines.length - 1) * px * lead;
    if (h <= maxH || px <= minPx) return { lines, px };
  }
  return { lines: [words], px: minPx };
}

// per-aspect pick with portrait fallback (4:5 and 9:16 share the "portrait" re-flow unless given separately)
export function byAspect(L, map) {
  if (L.key in map) return map[L.key];
  if (L.portrait && 'portrait' in map) return map.portrait;
  return map['16:9'] ?? map.default;
}

export const ease = {
  out: k => 1 - Math.pow(1 - clamp(k), 3),
  inOut: k => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; },
  expo: k => (k = clamp(k)) >= 1 ? 1 : 1 - Math.pow(2, -10 * k),
};
