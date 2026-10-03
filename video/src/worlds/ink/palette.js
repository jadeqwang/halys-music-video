// palette.js: INK colour. Jade's model-sheet palette (Pasted image.png, STYLE_BIBLE "INK"), each material as a base and
// exactly one shadow tone; the room's night palette for the painted backgrounds; OKLab helpers.
//
// Colour rules (director): flat fills, one shadow tone, no Ghibli gradients, no yellow cast (whites stay neutral), and the
// ONLY saturated blue in the room is the light-blue circle on her jacket back (plus Earth on her monitor). The room's
// night colours are desaturated navy-black, never a saturated or light blue; monitor light is pearl, the lamp is orange.

export const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgb2hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const s2l = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
export const l2s = v => 255 * (v <= .0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - .055);

// sRGB 0..255 linear-light LUT (plates decode as bytes)
export const S2L = new Float32Array(256); for (let i = 0; i < 256; i++) S2L[i] = s2l(i);

export function lin2oklab(r, g, b) {
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}
export function oklab2lin(L, a, b) {
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
}
export const hex2oklab = h => { const [r, g, b] = hex2rgb(h); return lin2oklab(s2l(r), s2l(g), s2l(b)); };
export const oklab2hex = (L, a, b) => { const [r, g, bb] = oklab2lin(L, a, b); return rgb2hex(l2s(r), l2s(g), l2s(bb)); };

// ---------------------------------------------------------------- Jade (the cel)
// Materials in classification order. `base` / `shadow` are the only two tones a material ever shows on screen.
export const LINE = '#17141c';            // character line art (near-black, a touch warm-violet like printed anime line)
export const LINE_SKIN = '#9a5a4c';       // colour-trace line for the nose / inner face (a darker skin, not black)
export const MAT = {
  none:   { id: 0 },
  black:  { id: 1, base: '#101114', shadow: '#2a2d35', sheen: true },   // hair #101114 (sheet), crop top, cups, chair; its second
                                                         // tone is the hair's sheen (lighter), not a shadow
  jacket: { id: 2, base: '#f2f0ea', shadow: '#c7c6ce' },   // white bomber; the shadow is a neutral-cool grey, never blue
  orange: { id: 3, base: '#f08a2a', shadow: '#c8641d' },   // stripes, headphones, straps
  navy:   { id: 4, base: '#1e2433', shadow: '#141925' },   // cargo pants
  skin:   { id: 5, base: '#f8d6c2', shadow: '#e4a893' },   // warm skin (a touch warmer than the plate, as on the sheet)
  iris:   { id: 6, base: '#7d4b2b', shadow: '#3f2418' },   // brown eyes (sheet)
  white:  { id: 7, base: '#f7f5f1', shadow: '#d9d3d3' },   // eye whites, patch disc
  blue:   { id: 8, base: '#86b5e6', shadow: '#6e9acb' },   // the RARE EARTH circle (back only)
  brow:   { id: 9, base: '#3b2826', shadow: '#3b2826' },   // brows in the close-up: a soft dark brown, not the hair's black
};
export const BROW_LINE = '#3b2826';
export const MATS = Object.entries(MAT).filter(([k]) => k !== 'none').map(([name, m]) => ({ name, ...m }));
// label index = material id * 2 - 1 (+1 for shadow); 0 = not character
export const label = (id, shadow) => id ? id * 2 - 1 + (shadow ? 1 : 0) : 0;
export const NLAB = MATS.length * 2 + 1;
export const LABEL_HEX = (() => { const a = ['#000000']; for (const m of MATS) { a.push(m.base, m.shadow); } return a; })();
export const labelMat = l => l ? MATS[(l - 1) >> 1] : null;
export const isShadow = l => l > 0 && ((l - 1) & 1) === 1;

// ---------------------------------------------------------------- the room at night (painted backgrounds)
export const ROOM = {
  ink: '#07080c',          // deepest navy-black (unlit corners)
  wall: '#141824',         // night wall (desaturated navy)
  wallLo: '#0e111a',       // wall shadow wash
  wallWarm: '#3a2a26',     // wall inside the lamp's pool
  desk: '#3b3236',         // desk top in monitor light
  deskWarm: '#8a5a3c',     // desk inside the lamp pool
  deskLo: '#211d22',       // desk front / under-shadow
  bezel: '#0b0c10',
  screenOff: '#0a0d14',
  pearl: '#f3efe6',        // monitor light, corona pearl
  orange: '#f08a2a',       // the lamp (her colour, the eclipse colour)
  lampHot: '#ffd9a6',      // the bulb (warm white; the only warm white)
  fog: ['#55575e', '#6b6d73', '#808287', '#94959a'],     // SF fog at night, flat grey bands (no blue cast)
  hill: '#383a41',
  tower: '#22242b',
  beacon: '#e3402a',
  earth: '#86b5e6',        // Earth on her monitor = the same light blue as the circle on her back
  earthDeep: '#5b8fcc',
};

// Background grading for colours sampled from a plate: kill saturated / light blue (hue 200-290 deg) down to the
// navy-black family, keep warm lamp light, neutralise yellowish whites. In/out OKLab.
export function gradeRoom([L, a, b]) {
  const C = Math.hypot(a, b), h = Math.atan2(b, a) * 180 / Math.PI;
  let k = 1;
  if (h < -55 && h > -165) {                                   // blue family: navy is allowed when dark, never bright
    const cmax = L < .32 ? .034 : L < .45 ? .024 : .014;
    k = Math.min(1, cmax / Math.max(C, 1e-6));
  }
  if (h > 75 && h < 115 && L > .55) k = Math.min(k, .45);      // yellowish lights -> neutral (no yellow cast)
  const L2 = L > .7 && h < -55 && h > -165 ? .7 + (L - .7) * .5 : L;
  return [L2, a * k, b * k];
}
