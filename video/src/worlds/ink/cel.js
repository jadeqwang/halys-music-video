// cel.js: the INK character analysis. Plate frame (setup space) -> flat cel regions mapped to Jade's fixed palette with
// exactly one shadow tone per material, plus tapered line art. No DOM; runs once per drawing (cached by the caller).
//
//   1. colour: plate gain, OKLab, one edge-preserving smooth (the generator's soft gradients go, edges stay)
//   2. the plate's own drawn lines (dark ridges) are set aside: they become our vector lines, never fill
//   3. palette-nearest material per pixel (hue / chroma / lightness rules in OKLab, with per-setup spatial permissions:
//      blue only where the back circle can be, navy only in the trouser zone, iris only inside the eyes)
//   4. region smoothing: line pixels take their neighbours' material, a majority filter, small islands merged
//   5. one shadow tone: lightness smoothed inside each material, split at a per-setup threshold (calibrated once on the
//      setup's reference drawing, so it cannot flicker), the split cleaned the same way -> smooth cel shadow shapes
//   6. line art: silhouette from the (edge-refined) matte, constant weight; interior lines from the plate's ridges,
//      thinned, traced, smoothed, thinner and tapered; doubled lines near the silhouette removed
// Output (analysis px): { W, H, lab (Uint8 label map, palette.js labels), alpha, chains: [{pts, w, kind, col}], eyes }

import { MAT, MATS, NLAB, label, S2L, lin2oklab } from './palette.js';
import { gauss, gaussMasked, bilateral3, modeFilter, cleanSmall, thin, traceSkeleton, contours, smoothPts, resample, guided, otsu, clamp } from './img.js';

export const CEL_DEFAULTS = {
  bil: [2, 1.6, .055],        // bilateral radius, spatial sigma, range sigma (OKLab)
  ridgeHi: .055, ridgeLo: .03, ridgeMaxL: .55,   // plate line detection (DoG of lightness)
  mode: [2, 2],               // majority filter radius, passes
  minArea: 22,                // islands smaller than this (analysis px) merge into a neighbour
  shadeSigma: 2.6,            // lightness smoothing inside a material before the shadow split
  matteRefine: [3, .0025],    // guided filter radius, eps
  allowBlue: null,            // {cx, cy, rx, ry} plate-normalised ellipse where the back circle may be (null = nowhere)
  orangeMinC: .085,
  blueMinC: .05,              // the back circle (the jacket's cool shadow reaches C .05 under monitor light)
  brightL: .45,               // bright / dark split of the coarse classes
  skinA: -.002, skinB: -.016, // skin warmth inside a skin zone (OKLab a, b lower bounds)
  skin: [],                   // extra skin zones (plate-normalised ellipses)
  navy: null,                 // the trouser zone (ellipse) or null
  faces: true,                // false: ignore landmarks (a back view: the landmarker hallucinates faces)
  lineMin: 6,                 // shortest interior chain (analysis px)
  lineW: [1.3, 2.8],          // interior line width range (output px at 1080p)
  silW: 3.2,                  // silhouette width (output px at 1080p)
  eyeBoost: 2.0,
  sheenMax: 900,              // a bright patch up to this many px walled in by black is hair sheen              // lash lines are heavier
  shadeT: null,               // per-material shadow thresholds (calibrated per setup)
  frameEdge: 2,               // silhouette segments within this many px of the frame edge are not drawn
};

const ID = Object.fromEntries(MATS.map(m => [m.name, m.id]));
const NMAT = MATS.length + 1;     // material ids 0..8

// ---------------------------------------------------------------- 1-3: colour and classification
function oklabOf(rgba, N, gain) {
  const L = new Float32Array(N), A = new Float32Array(N), B = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = Math.min(1, S2L[rgba[i * 4]] * gain), g = Math.min(1, S2L[rgba[i * 4 + 1]] * gain), b = Math.min(1, S2L[rgba[i * 4 + 2]] * gain);
    const o = lin2oklab(r, g, b); L[i] = o[0]; A[i] = o[1]; B[i] = o[2];
  }
  return [L, A, B];
}

function inEllipse(e, u, v) {
  if (!e) return false;
  let du = u - e.cx, dv = v - e.cy;
  if (e.rot) { const c = Math.cos(-e.rot), s = Math.sin(-e.rot), x = du * 960, y = dv * 540; du = (x * c - y * s) / 960; dv = (x * s + y * c) / 540; }
  const dx = du / e.rx, dy = dv / e.ry; return dx * dx + dy * dy <= 1;
}

// eye regions from the face landmarks (setup-normalised): ellipse around each eye's upper/lower lid polylines
export function eyeRegions(faces, W, H) {
  const out = [];
  const fc = faces && faces[0]; if (!fc || !fc.lines || fc.src !== 'mp') return out;
  for (const side of ['L', 'R']) {
    const up = fc.lines[`eye${side}_up`], lo = fc.lines[`eye${side}_lo`], ir = fc.lines[`iris${side}`];
    if (!up || !lo) continue;
    let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
    for (const arr of [up, lo]) for (let i = 0; i + 1 < arr.length; i += 2) { x0 = Math.min(x0, arr[i]); x1 = Math.max(x1, arr[i]); y0 = Math.min(y0, arr[i + 1]); y1 = Math.max(y1, arr[i + 1]); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = x1 - x0;
    // anime eyes are much taller than the landmark lids: open the box vertically
    out.push({ side, cx, cy: cy - .05 * w, rx: w * .62, ry: Math.max(y1 - y0, w * .32) * 1.35, iris: ir || null, up, lo, w });
  }
  return out;
}

// skin zones: the face oval from the landmarks (dilated; plus the neck below the chin and the ears) and any extra
// plate-normalised ellipses the sheet gives this exposure (hands; the face in a profile drawing the landmarker missed)
function skinZones(faces, cfg) {
  const z = [...(cfg.skin || [])];
  const fc = cfg.faces === false ? null : faces && faces[0];
  if (fc && fc.lines && fc.lines.oval && fc.src === 'mp') {
    const o = fc.lines.oval; let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
    for (let i = 0; i + 1 < o.length; i += 2) { x0 = Math.min(x0, o[i]); x1 = Math.max(x1, o[i]); y0 = Math.min(y0, o[i + 1]); y1 = Math.max(y1, o[i + 1]); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
    z.push({ cx, cy: cy - ry * .12, rx: rx * 1.32, ry: ry * 1.4 });             // face + ears + forehead up to the parting
    z.push({ cx, cy: y1 + ry * .25, rx: rx * .62, ry: ry * .45 });               // neck
  }
  return z;
}

// Classification. Orange and the back circle are decided per pixel (their chroma is unmistakable); skin only inside skin
// zones and only where the pixel is warm (a lamp-lit sleeve and a hand have the same colour, so position decides);
// eyes inside the eye zones; everything else is the white jacket (bright) or black (dark), navy only in the trouser
// zone. Then regions: a small bright patch walled in by black is the hair's sheen, not a piece of jacket.
function classify(L, A, B, line, alpha, W, H, cfg, eyes, faces) {
  const N = W * H, mat = new Uint8Array(N), UNK = 255;
  const zones = skinZones(faces, cfg);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (alpha[i] < .5) { mat[i] = 0; continue; }
    const l = L[i], a = A[i], b = B[i], C = Math.hypot(a, b), h = Math.atan2(b, a) * 57.2958, u = x / W, v = y / H;
    const eye = eyes.length ? eyes.find(e => inEllipse(e, u, v)) : null;
    if (h > 22 && h < 90 && l > .3 && (C >= cfg.orangeMinC || (C >= .062 && l < .72))) { mat[i] = eye ? ID.iris : ID.orange; continue; }
    if (cfg.allowBlue && inEllipse(cfg.allowBlue, u, v) && C > cfg.blueMinC && h < -70 && h > -160 && l > .42) { mat[i] = ID.blue; continue; }
    if (line[i]) { mat[i] = UNK; continue; }
    if (eye) {
      if (l >= .55 && a > cfg.skinA + .004 && b > cfg.skinB + .004) mat[i] = ID.skin;     // the lids and the skin around the eye
      else if (l >= .55 && C < .07) mat[i] = ID.white;
      else if (C > .02 && h > 10 && h < 100 && l > .08) mat[i] = ID.iris;
      else mat[i] = ID.black;
      continue;
    }
    const inSkin = zones.length && zones.some(z => inEllipse(z, u, v));
    if (l >= cfg.brightL) mat[i] = inSkin && a > cfg.skinA && b > cfg.skinB ? ID.skin : ID.jacket;
    else if (cfg.navy && inEllipse(cfg.navy, u, v) && b < -.022 && C > .022) mat[i] = ID.navy;
    else mat[i] = inSkin && l > .3 && a > cfg.skinA + .01 && b > cfg.skinB ? ID.skin : ID.black;
  }
  return mat;
}

// a bright region (jacket) that is small and almost entirely walled in by black is a sheen on the hair
function sheenRegions(mat, W, H, maxArea) {
  const N = W * H, seen = new Uint8Array(N), stack = new Int32Array(N);
  for (let s0 = 0; s0 < N; s0++) {
    if (seen[s0] || mat[s0] !== ID.jacket) continue;
    let sp = 0; stack[sp++] = s0; seen[s0] = 1;
    const px = []; let border = 0, blk = 0;
    while (sp) {
      const i = stack[--sp]; px.push(i);
      const x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j < 0) continue;
        const m = mat[j];
        if (m === ID.jacket) { if (!seen[j]) { seen[j] = 1; stack[sp++] = j; } }
        else if (m !== 255) { border++; if (m === ID.black) blk++; }
      }
      if (px.length > maxArea) break;
    }
    if (px.length <= maxArea && border > 0 && blk / border > .66) for (const i of px) mat[i] = 250;   // marked: sheen
  }
}

// line pixels take the most common material among their non-line neighbours (lines are <= 4 px wide)
function propagate(mat, W, H, iters = 5) {
  const UNK = 255, cnt = new Uint16Array(NMAT);
  for (let it = 0; it < iters; it++) {
    let left = 0; const src = new Uint8Array(mat);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (src[i] !== UNK) continue;
      cnt.fill(0); let any = 0;
      for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
        const yy = y + j, xx = x + k; if (yy < 0 || xx < 0 || yy >= H || xx >= W) continue;
        const m = src[yy * W + xx]; if (m === UNK || m === 0) continue; cnt[m]++; any++;
      }
      if (!any) { left++; continue; }
      let b = 1, bc = 0; for (let m = 1; m < NMAT; m++) if (cnt[m] > bc) { bc = cnt[m]; b = m; }
      mat[i] = b;
    }
    if (!left) break;
  }
  for (let i = 0; i < mat.length; i++) if (mat[i] === UNK) mat[i] = ID.black;
  return mat;
}

// ---------------------------------------------------------------- the analysis
export function analyzeCel(inp, cfg0 = {}) {
  const cfg = { ...CEL_DEFAULTS, ...cfg0 };
  const { W, H, rgba } = inp, N = W * H, gain = inp.gain || 1, t0 = performance.now();
  let [L, A, B] = oklabOf(rgba, N, gain);
  // matte: refined against the lightness so the silhouette hugs the drawn edge (hair tips, sleeves)
  let alpha;
  if (inp.matte) alpha = guided(L, inp.matte, W, H, cfg.matteRefine[0], cfg.matteRefine[1]);
  else alpha = new Float32Array(N).fill(1);
  const inside = new Uint8Array(N); for (let i = 0; i < N; i++) inside[i] = alpha[i] > .5 ? 1 : 0;
  // smooth colour inside her only
  [L, A, B] = bilateral3(L, A, B, W, H, cfg.bil[0], cfg.bil[1], cfg.bil[2], alpha);
  // the plate's own drawn lines: dark ridges (difference of gaussians on lightness)
  const g1 = gauss(L, W, H, .8), g2 = gauss(L, W, H, 2.2), R = new Float32Array(N);
  for (let i = 0; i < N; i++) R[i] = L[i] < cfg.ridgeMaxL ? Math.max(0, g2[i] - g1[i]) : 0;
  const lineHi = new Uint8Array(N);
  for (let i = 0; i < N; i++) lineHi[i] = inside[i] && R[i] > cfg.ridgeHi ? 1 : 0;
  const eyes = cfg.faces === false ? [] : eyeRegions(inp.faces, W, H);
  // 3. materials
  let mat = classify(L, A, B, lineHi, alpha, W, H, cfg, eyes, inp.faces);
  mat = propagate(mat, W, H);
  // 4. region smoothing
  mat = modeFilter(mat, W, H, cfg.mode[0], NMAT, inside, cfg.mode[1]);
  mat = cleanSmall(mat, W, H, cfg.minArea, NMAT);
  for (let i = 0; i < N; i++) if (!inside[i]) mat[i] = 0; else if (!mat[i]) mat[i] = ID.black;
  sheenRegions(mat, W, H, cfg.sheenMax);
  // decal zones: painted flat (the lettering is drawn as type on top: decals.js)
  for (const z of cfg.clear || []) {
    const id = ID[z.mat] || ID.jacket;
    const x0 = Math.max(0, Math.floor((z.cx - z.rx * 1.5) * W)), x1 = Math.min(W - 1, Math.ceil((z.cx + z.rx * 1.5) * W));
    const y0 = Math.max(0, Math.floor((z.cy - z.ry * 1.5) * H)), y1 = Math.min(H - 1, Math.ceil((z.cy + z.ry * 1.5) * H));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; if (inside[i] && inEllipse(z, x / W, y / H)) mat[i] = id; }
  }
  const sheen = new Uint8Array(N); for (let i = 0; i < N; i++) if (mat[i] === 250) { mat[i] = ID.black; sheen[i] = 1; }
  // 5. one shadow tone per material
  const Ls = new Float32Array(N);
  const thr = cfg.shadeT || {};
  for (const m of MATS) {
    const msk = new Float32Array(N); let any = 0;
    for (let i = 0; i < N; i++) if (mat[i] === m.id) { msk[i] = 1; any++; }
    if (!any) continue;
    const s = gaussMasked(L, msk, W, H, cfg.shadeSigma);
    for (let i = 0; i < N; i++) if (msk[i]) Ls[i] = s[i];
  }
  const lab = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const m = mat[i]; if (!m) continue;
    const t = thr[m];
    lab[i] = m === ID.black ? label(m, sheen[i] || (t != null && Ls[i] > t)) : label(m, t != null && Ls[i] < t);
  }
  for (const z of cfg.clear || []) {
    const id = ID[z.mat] || ID.jacket;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (mat[i] === id && inEllipse(z, x / W, y / H)) lab[i] = label(id, false); }
  }
  // the small face (face.js draws its features): flat skin inside the face oval, the eye zones cleared to skin
  if (cfg.flatFace && eyes.length && cfg.faces !== false) {
    const fz = skinZones(inp.faces, { faces: true });
    const face = fz.length ? fz[fz.length - 2] : null;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, u = x / W, v = y / H;
      if (!inside[i]) continue;
      if (eyes.some(e => inEllipse({ ...e, rx: e.rx * 1.25, ry: e.ry * 1.3 }, u, v))) { mat[i] = ID.skin; lab[i] = label(ID.skin, false); }
      else if (face && mat[i] === ID.skin && inEllipse({ ...face, rx: face.rx * .8, ry: face.ry * .78 }, u, v)) lab[i] = label(ID.skin, false);
    }
  }
  let labS = modeFilter(lab, W, H, 2, NLAB, inside, 1);
  labS = cleanSmall(labS, W, H, cfg.minArea * 2, NLAB);
  for (let i = 0; i < N; i++) if (!inside[i]) labS[i] = 0;
  const t1 = performance.now();
  // 6. line art
  const chains = lineArt(inp, cfg, { L, R, alpha, inside, mat, labS, eyes, W, H });
  return { W, H, lab: labS, mat, alpha, chains, eyes, Ls, R, stats: { ms: Math.round(performance.now() - t0), msFill: Math.round(t1 - t0), chains: chains.length } };
}

// per-setup calibration: shadow thresholds per material from the reference drawing (Otsu inside each material, used
// only when the two tones really separate; otherwise the material stays flat)
export function calibrate(res, opts = {}) {
  const t = {}, N = res.W * res.H, flat = opts.flat || ['blue', 'white'];
  for (const m of MATS) {
    const msk = new Uint8Array(N); let n = 0;
    for (let i = 0; i < N; i++) if (res.mat[i] === m.id) { msk[i] = 1; n++; }
    if (n < 400 || flat.includes(m.name)) continue;
    if (m.sheen) {                     // black: the brightest ~10 % of the hair is its sheen (when there is any spread)
      const v = []; for (let i = 0; i < N; i += 3) if (msk[i]) v.push(res.Ls[i]);
      v.sort((a, b) => a - b);
      const p50 = v[v.length >> 1], p90 = v[Math.floor(v.length * (opts.sheenP ?? .9))];
      if (p90 - p50 > .035) t[m.id] = p90;
      continue;
    }
    const o = otsu(res.Ls, msk);
    if (o.sep > (opts.minSep ?? .55)) t[m.id] = o.t + (opts.bias?.[m.name] || 0);
  }
  return t;
}

// ---------------------------------------------------------------- line art
function lineArt(inp, cfg, F) {
  const { W, H, R, alpha, inside, labS, eyes } = F, N = W * H;
  const chains = [];
  // silhouette: iso-contour of the refined matte; segments along the frame edge dropped
  const al = gauss(alpha, W, H, .7);
  const sil = contours(al, W, H, .5);
  const silPts = [];
  const e = cfg.frameEdge;
  for (const c of sil) {
    let run = [];
    const flush = () => { if (run.length > 6) { const p = smoothPts(resample(run, 1.2), 1.6, false); chains.push({ pts: p, kind: 'sil', w: cfg.silW }); for (const q of p) silPts.push(q); } run = []; };
    for (const p of c.pts) {
      const edge = p[0] < e || p[1] < e || p[0] > W - 1 - e || p[1] > H - 1 - e;
      if (edge) flush(); else run.push(p);
    }
    flush();
  }
  // distance to the silhouette (coarse grid) to drop doubled interior lines
  const near = new Uint8Array(N);
  for (const [x, y] of silPts) {
    const xi = Math.round(x), yi = Math.round(y);
    for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) { const xx = xi + k, yy = yi + j; if (xx >= 0 && yy >= 0 && xx < W && yy < H) near[yy * W + xx] = 1; }
  }
  // interior: hysteresis on the ridge map, thinned
  const strong = new Uint8Array(N), weak = new Uint8Array(N);
  for (let i = 0; i < N; i++) { if (!inside[i] || near[i]) continue; if (R[i] > cfg.ridgeHi) strong[i] = 1; else if (R[i] > cfg.ridgeLo) weak[i] = 1; }
  const keep = new Uint8Array(N), stack = [];
  for (let i = 0; i < N; i++) if (strong[i]) { keep[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop(), x = i % W, y = (i / W) | 0;
    for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const xx = x + k, yy = y + j; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const q = yy * W + xx; if (weak[q] && !keep[q]) { keep[q] = 1; stack.push(q); }
    }
  }
  thin(keep, W, H);
  const raw = traceSkeleton(keep, W, H, 3);
  for (const ch of raw) {
    let pts = ch.pts;
    let len = 0; for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    const mid = pts[pts.length >> 1], mi = Math.round(mid[1]) * W + Math.round(mid[0]);
    const eye = eyes.find(ey => inEllipse({ ...ey, rx: ey.rx * 1.15, ry: ey.ry * 1.25 }, mid[0] / W, mid[1] / H));
    if (len < cfg.lineMin && !eye) continue;
    if ((cfg.clear || []).some(z => inEllipse({ ...z, rx: z.rx * 1.15, ry: z.ry * 1.25 }, mid[0] / W, mid[1] / H))) continue;
    if (cfg.flatFace && eye) continue;
    // strength = mean ridge response
    let s = 0; for (const [x, y] of pts) s += R[Math.round(y) * W + Math.round(x)] || 0; s /= pts.length;
    pts = smoothPts(resample(pts, 1), 1.1, !!ch.closed);
    const kk = clamp((s - cfg.ridgeLo) / (cfg.ridgeHi * 2.2 - cfg.ridgeLo));
    let w = cfg.lineW[0] + (cfg.lineW[1] - cfg.lineW[0]) * kk;
    if (eye) w *= cfg.eyeBoost * (mid[1] / H < eye.cy ? 1 : .6);
    // colour trace: a line with skin on both sides (nose, cheek) is a darker skin, not black
    const lb = labS[mi], skinBoth = sideIs(labS, W, H, pts, ID.skin);
    chains.push({ pts, kind: eye ? 'eye' : 'int', w, s, col: skinBoth && !eye ? 'skin' : 'ink', len });
  }
  return chains;
}
function sideIs(lab, W, H, pts, m) {
  let a = 0, n = 0;
  for (let k = 1; k < pts.length - 1; k += 2) {
    const [x0, y0] = pts[k - 1], [x1, y1] = pts[k + 1], dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * 2.5, ny = dx / l * 2.5;
    const [x, y] = pts[k];
    const p = Math.round(y + ny) * W + Math.round(x + nx), q = Math.round(y - ny) * W + Math.round(x - nx);
    const lp = lab[p], lq = lab[q];
    const mp = lp ? ((lp - 1) >> 1) + 1 : 0, mq = lq ? ((lq - 1) >> 1) + 1 : 0;
    if (mp === m && mq === m) a++; n++;
  }
  return n > 0 && a / n > .6;
}
