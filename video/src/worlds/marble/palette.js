// palette.js: the paint boxes of the MARBLE and GOLD worlds (STYLE_BIBLE.md).
//
// MARBLE is the brush engine in stone: cool silvery whites #ece6db / #d9d6cf, grey-violet mids #8a8c90, deep shadow
// #16161c, the desaturated navy-black totality sky #0d1018 and the 360-degree horizon glow in signal orange #f08a2a.
// The engine's sun pass, corona and accents look their colours up by BRONZE tube names (leadWhite, naples, ...), so the
// marble box also carries those names, re-mixed for stone at totality (cool pearl instead of lead white, a muted rose for
// the prominences, navy-black instead of bone black). A box is every colour a painter can mix from its tubes, so the
// extra names only widen the mixes; the reference the scene designs decides what is actually painted.
//
// GOLD is the engine's own 'gold' box (BRONZE + gold leaf #d4a840).

import { getPalette } from '../brush/index.js';

export const MARBLE_TUBES = {
  white: '#ece6db', bone: '#d9d6cf', grey: '#8a8c90', shadow: '#16161c', navy: '#0d1018', orange: '#f08a2a', silver: '#e3e5e9', slate: '#20283a',
  // the engine's names, for the sun pass / corona / accents in the stone world
  leadWhite: '#f1ede4', naples: '#e8dcc3', yellowOchre: '#d9a25a', burntSienna: '#9a6446', rawUmber: '#2b2722', burntUmber: '#3d3530',
  boneBlack: '#0c0e13', vermilion: '#e2652a', madder: '#7a3a40', verdigris: '#6c7179',
};
export const MARBLE_PAL = {
  tubes: MARBLE_TUBES, white: 'white', black: 'shadow', ground: [.055, .058, .068], varnish: [1, .985, .96], wL: 2.4, wC: 1.25,
  steps: [.1, .22, .35, .5, .65, .78, .9],
};
export const marbleBox = () => getPalette(MARBLE_PAL);
export const goldBox = () => getPalette('gold');

// sRGB 0..1 from a hex string
export const hex = h => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
export const C = Object.fromEntries(Object.entries(MARBLE_TUBES).map(([k, v]) => [k, hex(v)]));
