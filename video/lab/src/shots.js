// shots.js: per-plate design decisions for each material (light pools, focus, sky, eclipse, camera).
// Coordinates are uv (0..1, y down). Ellipses: {x, y, rx (fraction of width), ry (fraction of height), rot, feather, k}.

export const SHOTS = {
  a_duel: {
    bronze: {
      // one raking shaft from the low sun at the upper left picks out the duel; the far bank sinks into umber
      pool: [
        { x: .47, y: .5, rx: .25, ry: .46, rot: -.35, feather: .6, k: .66 },
        { x: .40, y: .30, rx: .10, ry: .2, feather: .6, k: .9 },
      ],
      poolMatte: 1, poolBound: { x: .52, y: .5, rx: .42, ry: .62, feather: .4 },
      focus: [
        { x: .395, y: .27, rx: .045, ry: .11, k: 1 },           // Lydian helmet + face
        { x: .615, y: .30, rx: .04, ry: .1, k: 1 },             // Mede face
        { x: .47, y: .50, rx: .055, ry: .12, k: .8 },            // lion on the shield
        { x: .30, y: .22, rx: .03, ry: .06, k: .7 },            // sword hand
        { x: .53, y: .48, rx: .07, ry: .04, k: .7 },            // blade + fist
      ],
      sky: { maxDepth: .006, soft: .01, below: .16, horizon: .11, zenith: .34, horizonL: .56, vortex: .2 },
      sun: { x: .13, y: .07, r: .035, alt: 9 }, eclipse: .18,
    },
    corona: {
      sky: { maxDepth: .006, soft: .01, below: .16 },
      sun: { x: .21, y: .085, r: .024, tilt: .2 },
      pool: [{ x: .5, y: .5, rx: .24, ry: .46, rot: -.35, feather: .7, k: .55 }],
    },
    marble: {
      sky: { maxDepth: .006, soft: .01, below: .16 },
      planets: [{ x: .64, y: .045, i: 1.6, r: 2.2 }, { x: .83, y: .075, i: .9, r: 1.7 }, { x: .07, y: .03, i: .6, r: 1.4 }],
      horizonBand: .028, horizonI: 1.1, water: 1, waterY: .44,
    },
  },
  b_face: {
    bronze: {
      pool: [{ x: .56, y: .45, rx: .2, ry: .5, rot: -.25, feather: .7 }],
      poolMatte: .55, poolBound: { x: .6, y: .45, rx: .3, ry: .6, feather: .5 },
      focus: [], faceMin: .7, faceK: 1,
      sky: null, eclipse: 0,
      crushFloor: .1, brushes: [24, 13, 7.5, 4.2, 2.4],
    },
    marble: {
      sky: { maxDepth: .032, soft: .012, below: .42 },
      planets: [{ x: .18, y: .1, i: 1.6, r: 2.4 }, { x: .38, y: .2, i: .8, r: 1.7 }],
      faceMin: .7,
    },
  },
  c_armies: {
    bronze: {
      // Altdorfer: the sky is the event. The valley sits in low late light; a brighter shaft lies along the river and
      // both front lines get the same light (equal dignity: neither army is the dark one).
      pool: [
        { x: .5, y: .7, rx: .66, ry: .42, rot: .08, feather: .8, k: .62 },
        { x: .56, y: .68, rx: .1, ry: .42, rot: -.3, feather: .7, k: .95 },
        { x: .3, y: .62, rx: .24, ry: .2, rot: .35, feather: .7, k: .9 },
        { x: .78, y: .7, rx: .2, ry: .24, rot: -.2, feather: .7, k: .9 },
      ],
      poolMatte: 0, poolBound: null, envDim: .9,
      focus: [{ x: .3, y: .62, rx: .25, ry: .2, k: .5 }, { x: .8, y: .7, rx: .2, ry: .25, k: .5 }],
      sky: { maxDepth: .012, soft: .02, below: .34, horizon: .27, zenith: .24, horizonL: .68, vortex: .13, glowR: .22, twist: 1.4 },
      sun: { x: .1, y: .19, r: .042, alt: 9 }, eclipse: .35,
      crushFloor: .17, crush: .3, satOut: .6, glintReach: 30, accents: .45,
    },
    corona: {
      sky: { maxDepth: .012, soft: .02, below: .34 },
      sun: { x: .14, y: .17, r: .036, tilt: .35 },
      rim: 0, matteGain: 0, poolMatte: 0, gamma: 1.3,
      pool: [
        { x: .3, y: .62, rx: .26, ry: .22, rot: .35, feather: .7, k: 1 },
        { x: .78, y: .7, rx: .22, ry: .26, rot: -.2, feather: .7, k: 1 },
        { x: .56, y: .68, rx: .09, ry: .42, rot: -.3, feather: .7, k: .8 },
      ], armies: 1, contour: 0, innerEdges: 0,
    },
  },
  seedance: {
    corona: { lightDir: [.7, -.7], bgCut: .3, shadowCut: .08 },
  },
  d_room: {
    ink: {
      regions: {
        skin: [{ x: .395, y: .776, rx: .045, ry: .045, k: 1 }, { x: .604, y: .43, rx: .02, ry: .03, k: .8 }, { x: .612, y: .27, rx: .035, ry: .1, k: 1 }, { x: .592, y: .215, rx: .03, ry: .055, k: 1 }],
        jacket: [{ x: .63, y: .62, rx: .13, ry: .2, rot: -.3, k: .8 }, { x: .5, y: .78, rx: .08, ry: .06, k: .6 }],
        navy: [{ x: .62, y: .95, rx: .2, ry: .1, k: .8 }],
      },
    },
  },
};
