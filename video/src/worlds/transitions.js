// transitions.js: how one picture becomes the next, following the material logic (STYLE_BIBLE.md "Transitions").
// Shared by every world; owned by the brush-engine agent.
//
//   await diskWipe(f, k, drawA, drawB, o)   the default world change: the Moon's black disk grows from the sun (o.x, o.y,
//                                          o.r px) until it fills the frame, then opens on the next world. k 0..1;
//                                          drawA(g) / drawB(g) paint the outgoing / incoming picture into a 2D context
//                                          (use f.drawScene(name, overrides, g) for another shot's scene).
//   rewindSwirl(k, cx, cy, W, o)            the cold open's rewind (S04): a swirl spec for paint({swirl}): strokes wind
//                                          backwards around the sun, strongest mid-shot, unwinding to rest.
//   whiteFlash(g, W, H, a, o)               the last bead's white (S34); a = 0..1
//   blackPupil(g, cx, cy, r, o)             the black pupil opening in the white (S34 -> S35 hand-off at 110.58): a
//                                          crisp black disk with a hair of painted edge
//   pupilAt(W, H)                          where the pupil sits (S35 starts from it): {x, y, r} px

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const smooth = k => k * k * (3 - 2 * k);
const easeIn = k => k * k * k;

// the moon's disk grows (ease-in: slow, then swallowing), holds black for a breath, then opens (ease-out) on B
export async function diskWipe(f, k, drawA, drawB, o = {}) {
  const { g, W, H } = f, x = o.x ?? W / 2, y = o.y ?? H / 2, r0 = o.r ?? Math.min(W, H) * .05;
  const R = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) * 1.02;   // covers the whole frame from (x, y)
  const close = o.close ?? .45, hold = o.hold ?? .1;
  if (k < close) {
    await drawA(g);
    const r = r0 + (R - r0) * easeIn(k / close);
    g.save(); g.fillStyle = o.color || '#050405'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
    return;
  }
  if (k < close + hold) { g.save(); g.fillStyle = o.color || '#050405'; g.fillRect(0, 0, W, H); g.restore(); return; }
  // open: the next world inside a growing aperture centred on the frame (or o.x2, o.y2)
  const kk = (k - close - hold) / (1 - close - hold), x2 = o.x2 ?? W / 2, y2 = o.y2 ?? H / 2;
  const R2 = Math.hypot(Math.max(x2, W - x2), Math.max(y2, H - y2)) * 1.02, r = R2 * (1 - Math.pow(1 - kk, 3));
  const L = f.layer(7);
  await drawB(L.g);
  g.save(); g.fillStyle = o.color || '#050405'; g.fillRect(0, 0, W, H);
  g.beginPath(); g.arc(x2, y2, Math.max(.5, r), 0, TAU); g.clip(); g.drawImage(L.c, 0, 0); g.restore();
}

export function rewindSwirl(k, cx, cy, W, o = {}) {
  const env = Math.pow(Math.sin(Math.PI * clamp(k)), 1.4);                  // 0 -> peak -> 0
  return { cx, cy, amount: -(o.amount ?? 3.2) * env, radius: (o.radius ?? .42) * W, pull: (o.pull ?? .12) * env, smear: (o.smear ?? .5) * env };
}

export function whiteFlash(g, W, H, a, o = {}) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = clamp(a); g.fillStyle = o.color || '#fffaf0'; g.fillRect(0, 0, W, H); g.restore();
}

export function blackPupil(g, cx, cy, r, o = {}) {
  if (r <= 0) return;
  g.save();
  // a faint warm halo ring where the white meets the pupil (paint, not a vector cut-out)
  const rg = g.createRadialGradient(cx, cy, r * .98, cx, cy, r * 1.12);
  rg.addColorStop(0, 'rgba(60,40,24,.55)'); rg.addColorStop(1, 'rgba(60,40,24,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, r * 1.12, 0, TAU); g.fill();
  g.fillStyle = o.color || '#050405'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  g.restore();
}

export const pupilAt = (W, H) => ({ x: W / 2, y: H * .42, r: H * .13 });
