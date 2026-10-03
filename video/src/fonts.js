// fonts.js: the type system's faces, loaded with the FontFace API from video/fonts/ (all SIL OFL 1.1).
// Boot awaits loadFonts(), so no frame is ever drawn with a fallback face.
//
// Roles = the type styles of production/SHOTLIST.md (and TREATMENT.md "Text on screen"; never Inter):
//   carved  CARVED  Cinzel (variable 400-900): hook + history captions, carved gold inscriptional capitals
//   plaque  PLAQUE  Cinzel 500, small, tracked (+0.18 em): museum-label captions (set letterSpacing: see setFont)
//   inscr   INSCR   Cormorant Garamond italic (variable 300-700): verse 2 lower thirds and plinth inscriptions
//   chop    CHOP    Archivo (variable wght 100-900, wdth 62-125) at 900 / 125 %: the ultra-heavy WIDE chopped drop words
//   mono    MONO    JetBrains Mono 400/700: HUD corners and the terminal in the room
//   serif / verse   Instrument Serif roman / italic (spare); drop = alias of chop
// Every role falls back to Cardo (regular/bold/italic) for glyphs its face lacks: none of the display faces has Greek
// (S52's ΘΑΛΗΣ), and without a bundled fallback the browser would pick a system font (off-style, machine-dependent).
//
// setFont(g, role, px) sets the canvas font shorthand plus fontStretch and letterSpacing (which the shorthand cannot
// express). Example: setFont(g, 'chop', 220); g.fillText('HALO', x, y);

const FACES = [
  { family: 'Cinzel', file: 'Cinzel-VF.ttf', desc: { weight: '400 900' } },
  { family: 'Archivo', file: 'Archivo-VF.ttf', desc: { weight: '100 900', stretch: '62% 125%' } },
  { family: 'Cormorant Garamond', file: 'CormorantGaramond-Italic-VF.ttf', desc: { style: 'italic', weight: '300 700' } },
  { family: 'Instrument Serif', file: 'InstrumentSerif-Regular.ttf', desc: { style: 'normal', weight: '400' } },
  { family: 'Instrument Serif', file: 'InstrumentSerif-Italic.ttf', desc: { style: 'italic', weight: '400' } },
  { family: 'Cardo', file: 'Cardo-Regular.ttf', desc: { style: 'normal', weight: '400' } },
  { family: 'Cardo', file: 'Cardo-Bold.ttf', desc: { style: 'normal', weight: '700' } },
  { family: 'Cardo', file: 'Cardo-Italic.ttf', desc: { style: 'italic', weight: '400' } },
  { family: 'JetBrains Mono', file: 'JetBrainsMono-Regular.ttf', desc: { weight: '400' } },
  { family: 'JetBrains Mono', file: 'JetBrainsMono-Bold.ttf', desc: { weight: '700' } },
];

export const ROLES = {
  carved: { family: 'Cinzel', weight: 700, style: 'normal' },
  plaque: { family: 'Cinzel', weight: 500, style: 'normal', tracking: .18 },
  inscr: { family: 'Cormorant Garamond', weight: 500, style: 'italic' },
  chop: { family: 'Archivo', weight: 900, style: 'normal', stretch: 'expanded' },   // 125 %
  drop: { family: 'Archivo', weight: 900, style: 'normal', stretch: 'expanded' },
  verse: { family: 'Instrument Serif', weight: 400, style: 'italic' },
  serif: { family: 'Instrument Serif', weight: 400, style: 'normal' },
  mono: { family: 'JetBrains Mono', weight: 400, style: 'normal' },
  monoBold: { family: 'JetBrains Mono', weight: 700, style: 'normal' },
};
export const FONT_STRETCH = Object.fromEntries(Object.entries(ROLES).map(([k, r]) => [k, r.stretch || 'normal']));

export function font(role, px, { weight, style } = {}) {
  const r = ROLES[role] || ROLES.mono;
  return `${style || r.style} ${weight || r.weight} ${Math.round(px)}px "${r.family}", "Cardo"`;
}
// set font, stretch and tracking on a 2D context in one call
export function setFont(g, role, px, opts) {
  const r = ROLES[role] || ROLES.mono;
  g.font = font(role, px, opts); g.fontStretch = FONT_STRETCH[role] || 'normal';
  g.letterSpacing = r.tracking ? `${(r.tracking * px).toFixed(2)}px` : '0px';
  return g;
}

let _loaded = null;
export function loadFonts(base = 'fonts/') {
  if (_loaded) return _loaded;
  _loaded = (async () => {
    const faces = await Promise.all(FACES.map(async f => {
      const face = new FontFace(f.family, `url(${base}${f.file})`, f.desc);
      await face.load();
      document.fonts.add(face);
      return face;
    }));
    await document.fonts.ready;
    // warm every role once so the first real frame does not pay for glyph rasterisation setup
    const c = new OffscreenCanvas(64, 64).getContext('2d');
    for (const role of Object.keys(ROLES)) { setFont(c, role, 32); c.fillText('HALYS ÆØ 585 ΘΑΛΗΣ', 0, 32); }
    return faces.length;
  })();
  return _loaded;
}
