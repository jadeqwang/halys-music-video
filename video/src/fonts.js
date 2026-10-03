// fonts.js: the type system's faces, loaded with the FontFace API from video/fonts/ (all SIL OFL 1.1).
// Boot awaits loadFonts(), so no frame is ever drawn with a fallback face.
//
// Roles (TREATMENT.md "Text on screen"; never Inter):
//   carved  Cinzel (variable 400-900): hook + history captions, carved gold inscriptional capitals
//   drop    Archivo (variable wght 100-900, wdth 62-125): ultra-heavy WIDE grotesk for the chopped drop words
//   verse   Instrument Serif italic: verse 2 lower thirds and plinth inscriptions
//   serif   Instrument Serif roman
//   mono    JetBrains Mono 400/700: HUD corners and the terminal in the room
//
// font(role, px, opts) returns a canvas `font` string; set ctx.fontStretch = FONT_STRETCH[role] as well
// (canvas cannot express width in the shorthand). Example:
//   g.font = font('drop', 220); g.fontStretch = 'expanded'; g.fillText('HALO', x, y);

const FACES = [
  { family: 'Cinzel', file: 'Cinzel-VF.ttf', desc: { weight: '400 900' } },
  { family: 'Archivo', file: 'Archivo-VF.ttf', desc: { weight: '100 900', stretch: '62% 125%' } },
  { family: 'Instrument Serif', file: 'InstrumentSerif-Regular.ttf', desc: { style: 'normal', weight: '400' } },
  { family: 'Instrument Serif', file: 'InstrumentSerif-Italic.ttf', desc: { style: 'italic', weight: '400' } },
  { family: 'JetBrains Mono', file: 'JetBrainsMono-Regular.ttf', desc: { weight: '400' } },
  { family: 'JetBrains Mono', file: 'JetBrainsMono-Bold.ttf', desc: { weight: '700' } },
];

export const ROLES = {
  carved: { family: 'Cinzel', weight: 700, style: 'normal' },
  drop: { family: 'Archivo', weight: 900, style: 'normal', stretch: 'expanded' },   // 125 %
  verse: { family: 'Instrument Serif', weight: 400, style: 'italic' },
  serif: { family: 'Instrument Serif', weight: 400, style: 'normal' },
  mono: { family: 'JetBrains Mono', weight: 400, style: 'normal' },
  monoBold: { family: 'JetBrains Mono', weight: 700, style: 'normal' },
};
export const FONT_STRETCH = Object.fromEntries(Object.entries(ROLES).map(([k, r]) => [k, r.stretch || 'normal']));

export function font(role, px, { weight, style } = {}) {
  const r = ROLES[role] || ROLES.mono;
  return `${style || r.style} ${weight || r.weight} ${Math.round(px)}px "${r.family}"`;
}
// set font + stretch on a 2D context in one call
export function setFont(g, role, px, opts) { g.font = font(role, px, opts); g.fontStretch = FONT_STRETCH[role] || 'normal'; return g; }

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
    for (const role of Object.keys(ROLES)) { setFont(c, role, 32); c.fillText('HALYS ÆØ 585', 0, 32); }
    return faces.length;
  })();
  return _loaded;
}
