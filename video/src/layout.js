// layout.js: everything size-dependent. Scenes never hard-code 1920x1080; they read a Layout built from the
// output canvas (?w=&h=, render.mjs --size=WxH), so 16:9 (1920x1080), 4:5 (1080x1350) and 9:16 (1080x1920)
// are re-composed, not cropped.
//
//   L.W, L.H, L.aspect, L.portrait, L.cx, L.cy
//   L.u          type unit = H / 1080 for landscape, W / 1080 for portrait (1 "design px" at 1080 short side)
//   L.vmin       min(W, H)            L.vmax  max(W, H)
//   L.safe       title-safe rect {x, y, w, h} (90 % / 93 % of the frame); L.action: action-safe (95 %)
//   L.px(u, v)   normalised frame coords -> canvas px
//   L.cover(sw, sh, focus=[.5,.5], zoom=1) -> {x, y, w, h}: place a source (plate, painting) so it covers the
//                frame, keeping `focus` (source-normalised) as close to the frame centre as the crop allows
//   L.contain(sw, sh) -> {x, y, w, h}
//   L.type(frac) font size in px as a fraction of frame height (subtitles >= 0.045 per the treatment)
//   L.pick({ '16:9': a, '4:5': b, '9:16': c }) the value whose key is the nearest aspect (log-ratio distance)

export function aspectKey(w, h) {
  const r = w / h;
  const keys = [['21:9', 21 / 9], ['16:9', 16 / 9], ['4:3', 4 / 3], ['1:1', 1], ['4:5', 4 / 5], ['9:16', 9 / 16]];
  return keys.reduce((b, k) => Math.abs(Math.log(k[1] / r)) < Math.abs(Math.log(b[1] / r)) ? k : b)[0];
}

export function makeLayout(W, H) {
  const aspect = W / H, portrait = H > W;
  const u = (portrait ? W : H) / 1080;
  const sx = portrait ? .07 : .05, sy = portrait ? .05 : .07;
  const L = {
    W, H, aspect, portrait, key: aspectKey(W, H), cx: W / 2, cy: H / 2, u, vmin: Math.min(W, H), vmax: Math.max(W, H),
    safe: { x: W * sx, y: H * sy, w: W * (1 - 2 * sx), h: H * (1 - 2 * sy) },
    action: { x: W * .025, y: H * .025, w: W * .95, h: H * .95 },
    px: (x, y) => [x * W, y * H],
    type: f => Math.round(f * H),
    cover(sw, sh, focus = [.5, .5], zoom = 1) {
      const s = Math.max(W / sw, H / sh) * zoom, w = sw * s, h = sh * s;
      const x = Math.min(0, Math.max(W - w, W / 2 - focus[0] * w));
      const y = Math.min(0, Math.max(H - h, H / 2 - focus[1] * h));
      return { x, y, w, h, s };
    },
    contain(sw, sh) {
      const s = Math.min(W / sw, H / sh), w = sw * s, h = sh * s;
      return { x: (W - w) / 2, y: (H - h) / 2, w, h, s };
    },
    pick(map) {
      if (!map || typeof map !== 'object') return map;
      if (L.key in map) return map[L.key];
      let best = null, bd = Infinity;
      for (const k of Object.keys(map)) {
        const [a, b] = k.split(':').map(Number); if (!a || !b) continue;
        const d = Math.abs(Math.log(a / b / aspect)); if (d < bd) { bd = d; best = map[k]; }
      }
      return best ?? map.default;
    },
  };
  return L;
}
