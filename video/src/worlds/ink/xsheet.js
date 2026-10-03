// xsheet.js: INK timing. The room is animated like cel anime: on twos (12 drawings a second, a drawing every 5 master
// frames at 60 fps) with real holds, and every drawing that must hit the music is placed on an exact master frame.
//
// A sheet is a list of exposures sorted by master frame: { F, src, pf, ref?, region?, tag? }. From frame F until the next
// exposure, the character cel is drawn from plate `src` frame `pf` (1-based). With `ref` + `region`, only the region
// (plate-normalised ellipse {cx, cy, rx, ry, feather}) comes from `pf` and everything else from frame `ref`: the
// limited-animation trick (the held head and body stay on their cel, only the typing arm is redrawn), done in plate
// space before the cel analysis so the line art cannot boil across the seam.
//
// Pure module (no DOM): the scenes (scenes/room.js) and the timing check (production/review/room/check_timing.mjs) both
// import it, so the check verifies the very frames the renderer uses.

export const FPS = 60;
export const TWOS = 5;                                     // master frames per drawing on twos (60 / 12)
export const EPS = 1e-6;
export const frameAt = t => Math.ceil(t * FPS - EPS);      // first master frame at or after song time t (cuts, events)
export const frameTime = i => i / FPS;

// the exposure on screen at master frame i (null before the first one)
export function expose(sheet, i) {
  let lo = 0, hi = sheet.length - 1, best = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (sheet[m].F <= i) { best = sheet[m]; lo = m + 1; } else hi = m - 1; }
  return best;
}
// index of the exposure (for keys / caches)
export function exposeIndex(sheet, i) {
  let lo = 0, hi = sheet.length - 1, best = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (sheet[m].F <= i) { best = m; lo = m + 1; } else hi = m - 1; }
  return best;
}

// ---------------------------------------------------------------- builders (all in master frames)
// hold: one exposure
export const hold = (F, src, pf, o = {}) => [{ F, src, pf, ...o }];
// seq: the listed plate frames, one per `step` master frames from F0
export const seq = (F0, src, pfs, step = TWOS, o = {}) => pfs.map((pf, k) => ({ F: F0 + k * step, src, pf, ...o }));
// seqEnd: the listed plate frames on twos, timed so the LAST one lands exactly on frame Fend
export const seqEnd = (Fend, src, pfs, step = TWOS, o = {}) => seq(Fend - (pfs.length - 1) * step, src, pfs, step, o);
// run: drawings every `step` frames over [F0, F1), plate frame interpolated linearly pf0 -> pf1 (rounded)
export function run(F0, F1, src, pf0, pf1, step = TWOS, o = {}) {
  const out = [];
  for (let F = F0; F < F1; F += step) out.push({ F, src, pf: Math.round(pf0 + (pf1 - pf0) * (F - F0) / Math.max(1, F1 - F0)), ...o });
  return out;
}
// merge + sort + drop exposures shadowed by a later one on the same frame
export function sheet(...parts) {
  const all = parts.flat().filter(Boolean).sort((a, b) => a.F - b.F);
  const out = [];
  for (const e of all) { if (out.length && out[out.length - 1].F === e.F) out[out.length - 1] = e; else out.push(e); }
  // collapse consecutive identical drawings into one exposure (a held drawing is one drawing)
  return out.filter((e, k) => k === 0 || !same(e, out[k - 1]));
}
const same = (a, b) => a.src === b.src && a.pf === b.pf && a.ref === b.ref && (a.dy || 0) === (b.dy || 0) && JSON.stringify(a.region || null) === JSON.stringify(b.region || null) && a.tag === b.tag;

// a stable key for the drawing an exposure shows (cache key for the cel)
export const drawingKey = e => e ? `${e.src}:${e.pf}${e.ref ? `<${e.ref}` : ''}${e.dy ? `^${e.dy}` : ''}${e.region ? JSON.stringify(e.region) : ''}` : 'none';

// the unique plate frames a sheet needs (for matte prep and warm-up)
export function framesUsed(sh) {
  const s = new Map();
  for (const e of sh) { for (const pf of [e.pf, e.ref]) if (pf) { if (!s.has(e.src)) s.set(e.src, new Set()); s.get(e.src).add(pf); } }
  return Object.fromEntries([...s].map(([k, v]) => [k, [...v].sort((a, b) => a - b)]));
}
