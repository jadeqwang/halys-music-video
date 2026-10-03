// img.js: small, fast image operations on typed arrays (W x H, row-major) for the INK engine. No DOM.

export const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;

// separable box blur, radius r (in place into out); edges clamp
export function boxBlur(src, W, H, r, out = new Float32Array(W * H)) {
  if (r <= 0) { out.set(src); return out; }
  const tmp = new Float32Array(W * H), n = 2 * r + 1, inv = 1 / n;
  for (let y = 0; y < H; y++) {
    const o = y * W; let s = 0;
    for (let k = -r; k <= r; k++) s += src[o + clampI(k, 0, W - 1)];
    for (let x = 0; x < W; x++) { tmp[o + x] = s * inv; s += src[o + clampI(x + r + 1, 0, W - 1)] - src[o + clampI(x - r, 0, W - 1)]; }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += tmp[clampI(k, 0, H - 1) * W + x];
    for (let y = 0; y < H; y++) { out[y * W + x] = s * inv; s += tmp[clampI(y + r + 1, 0, H - 1) * W + x] - tmp[clampI(y - r, 0, H - 1) * W + x]; }
  }
  return out;
}
const clampI = (v, a, b) => v < a ? a : v > b ? b : v;

// separable gaussian (kernel radius 3 sigma)
const _kern = new Map();
function kernel(s) {
  const k = s.toFixed(3); if (_kern.has(k)) return _kern.get(k);
  const r = Math.max(1, Math.ceil(3 * s)), w = new Float32Array(2 * r + 1); let t = 0;
  for (let i = -r; i <= r; i++) { w[i + r] = Math.exp(-i * i / (2 * s * s)); t += w[i + r]; }
  for (let i = 0; i < w.length; i++) w[i] /= t;
  _kern.set(k, w); return w;
}
export function gauss(src, W, H, s, out = new Float32Array(W * H)) {
  if (s <= .05) { out.set(src); return out; }
  const w = kernel(s), r = (w.length - 1) >> 1, tmp = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      let a = 0;
      if (x >= r && x < W - r) for (let k = -r; k <= r; k++) a += src[o + x + k] * w[k + r];
      else for (let k = -r; k <= r; k++) a += src[o + clampI(x + k, 0, W - 1)] * w[k + r];
      tmp[o + x] = a;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let a = 0;
      if (y >= r && y < H - r) for (let k = -r; k <= r; k++) a += tmp[(y + k) * W + x] * w[k + r];
      else for (let k = -r; k <= r; k++) a += tmp[clampI(y + k, 0, H - 1) * W + x] * w[k + r];
      out[y * W + x] = a;
    }
  }
  return out;
}

// normalised convolution: gaussian of v over the support m (0..1), so values never bleed across a material edge
export function gaussMasked(v, m, W, H, s) {
  const N = W * H, vm = new Float32Array(N);
  for (let i = 0; i < N; i++) vm[i] = v[i] * m[i];
  const a = gauss(vm, W, H, s), b = gauss(m, W, H, s), out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = b[i] > 1e-4 ? a[i] / b[i] : v[i];
  return out;
}

// cross bilateral on three channels (OKLab), radius r, spatial sigma ss, range sigma sr; optional mask (only where mask > .5)
export function bilateral3(L, A, B, W, H, r, ss, sr, mask = null) {
  const N = W * H, oL = new Float32Array(N), oA = new Float32Array(N), oB = new Float32Array(N);
  const ws = []; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) ws.push(Math.exp(-(i * i + j * j) / (2 * ss * ss)));
  const k2 = 1 / (2 * sr * sr);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = y * W + x;
    if (mask && mask[c] < .5) { oL[c] = L[c]; oA[c] = A[c]; oB[c] = B[c]; continue; }
    const l0 = L[c], a0 = A[c], b0 = B[c];
    let sl = 0, sa = 0, sb = 0, sw = 0, q = 0;
    for (let j = -r; j <= r; j++) {
      const yy = clampI(y + j, 0, H - 1) * W;
      for (let i = -r; i <= r; i++, q++) {
        const p = yy + clampI(x + i, 0, W - 1), dl = L[p] - l0, da = A[p] - a0, db = B[p] - b0;
        const w = ws[q] * Math.exp(-(dl * dl * 1.5 + da * da + db * db) * k2);
        sl += L[p] * w; sa += A[p] * w; sb += B[p] * w; sw += w;
      }
    }
    oL[c] = sl / sw; oA[c] = sa / sw; oB[c] = sb / sw;
  }
  return [oL, oA, oB];
}

// majority (mode) filter on a label map, radius r; only labels < n; pixels with keep[i] = 0 are left alone
export function modeFilter(lab, W, H, r, n, keep = null, passes = 1) {
  let src = lab, out = new Uint8Array(lab);
  const cnt = new Uint16Array(n);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (keep && !keep[i]) { out[i] = src[i]; continue; }
      cnt.fill(0);
      for (let j = -r; j <= r; j++) { const yy = clampI(y + j, 0, H - 1) * W; for (let k = -r; k <= r; k++) cnt[src[yy + clampI(x + k, 0, W - 1)]]++; }
      let b = src[i], bc = cnt[b];
      for (let k = 0; k < n; k++) if (cnt[k] > bc) { bc = cnt[k]; b = k; }
      out[i] = b;
    }
    if (p < passes - 1) { src = out; out = new Uint8Array(src); }
  }
  return out;
}

// connected components (4-connectivity) of equal labels; components smaller than minArea take the most common label
// on their border. Returns a new label map.
export function cleanSmall(lab, W, H, minArea, n) {
  const N = W * H, comp = new Int32Array(N).fill(-1), out = new Uint8Array(lab), stack = new Int32Array(N);
  const nb = new Uint32Array(n);
  let id = 0;
  for (let s = 0; s < N; s++) {
    if (comp[s] >= 0) continue;
    const l = lab[s]; let sp = 0, size = 0; stack[sp++] = s; comp[s] = id;
    const members = [];
    nb.fill(0);
    while (sp) {
      const i = stack[--sp]; members.push(i); size++;
      const x = i % W, y = (i / W) | 0;
      const ns = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const j of ns) { if (j < 0) continue; if (lab[j] === l) { if (comp[j] < 0) { comp[j] = id; stack[sp++] = j; } } else nb[lab[j]]++; }
    }
    if (size < minArea) {
      let b = l, bc = 0; for (let k = 0; k < n; k++) if (nb[k] > bc) { bc = nb[k]; b = k; }
      if (bc) for (const i of members) out[i] = b;
    }
    id++;
  }
  return out;
}

// Zhang-Suen thinning of a binary image (Uint8 0/1), in place; returns it
export function thin(b, W, H) {
  const del = [];
  let changed = true;
  const P = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : b[y * W + x];
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      del.length = 0;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x; if (!b[i]) continue;
        const p2 = P(x, y - 1), p3 = P(x + 1, y - 1), p4 = P(x + 1, y), p5 = P(x + 1, y + 1), p6 = P(x, y + 1), p7 = P(x - 1, y + 1), p8 = P(x - 1, y), p9 = P(x - 1, y - 1);
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) continue;
        const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
        if (A !== 1) continue;
        if (step === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
        del.push(i);
      }
      if (del.length) { changed = true; for (const i of del) b[i] = 0; }
    }
  }
  // remove staircase corners (4-connected steps) so diagonal runs trace as one chain, not as fake junctions
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x; if (!b[i]) continue;
    const N = b[i - W], S = b[i + W], E = b[i + 1], Wv = b[i - 1], NE = b[i - W + 1], NW = b[i - W - 1], SE = b[i + W + 1], SW = b[i + W - 1];
    if ((N && E && !S && !Wv && !SW) || (E && S && !N && !Wv && !NW) || (S && Wv && !N && !E && !NE) || (Wv && N && !E && !S && !SE)) b[i] = 0;
  }
  return b;
}

// trace a 1-px skeleton into polylines, split at junctions. Returns [{pts: [[x,y],...]}]
export function traceSkeleton(b, W, H, minLen = 3) {
  const N = W * H, deg = new Uint8Array(N), seen = new Uint8Array(N), chains = [];
  const OFF = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x; if (!b[i]) continue; let d = 0;
    for (const [dx, dy] of OFF) d += b[i + dy * W + dx];
    deg[i] = d;
  }
  const walk = (s, first) => {
    const pts = [[s % W, (s / W) | 0]]; let cur = first, prev = s;
    while (true) {
      pts.push([cur % W, (cur / W) | 0]); seen[cur] = 1;
      if (deg[cur] !== 2) break;
      let nxt = -1;
      for (const [dx, dy] of OFF) { const j = cur + dy * W + dx; if (b[j] && j !== prev && !seen[j]) { nxt = j; break; } }
      if (nxt < 0) break;
      prev = cur; cur = nxt;
    }
    return pts;
  };
  // from endpoints and junctions
  for (let i = 0; i < N; i++) {
    if (!b[i] || deg[i] === 2 || deg[i] === 0) continue;
    seen[i] = 1;
    for (const [dx, dy] of OFF) {
      const j = i + dy * W + dx;
      if (!b[j] || seen[j]) continue;
      const pts = walk(i, j);
      if (pts.length >= minLen) chains.push({ pts });
    }
  }
  // closed loops left over
  for (let i = 0; i < N; i++) {
    if (!b[i] || seen[i] || deg[i] !== 2) continue;
    seen[i] = 1;
    let first = -1; for (const [dx, dy] of OFF) { const j = i + dy * W + dx; if (b[j] && !seen[j]) { first = j; break; } }
    if (first < 0) continue;
    const pts = walk(i, first); pts.push(pts[0]);
    if (pts.length >= minLen) chains.push({ pts, closed: true });
  }
  return chains;
}

// marching squares iso-contours of a field at `level` (sub-pixel), joined into polylines
export function contours(F, W, H, level = .5) {
  const segs = new Map(), key = (x, y) => `${x.toFixed(3)},${y.toFixed(3)}`;
  const edges = [];
  const v = (x, y) => F[y * W + x];
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const a = v(x, y), b = v(x + 1, y), c = v(x + 1, y + 1), d = v(x, y + 1);
    const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    const T = [x + (level - a) / (b - a), y], R = [x + 1, y + (level - b) / (c - b)], B = [x + (level - d) / (c - d), y + 1], Lp = [x, y + (level - a) / (d - a)];
    const S = {
      1: [[Lp, B]], 2: [[B, R]], 3: [[Lp, R]], 4: [[T, R]], 5: [[Lp, T], [B, R]], 6: [[T, B]], 7: [[Lp, T]],
      8: [[T, Lp]], 9: [[T, B]], 10: [[T, R], [B, Lp]], 11: [[T, R]], 12: [[R, Lp]], 13: [[R, B]], 14: [[B, Lp]],
    }[idx];
    for (const s of S) edges.push(s);
  }
  // join segments end to end
  const adj = new Map();
  edges.forEach((e, k) => { for (const p of e) { const kk = key(p[0], p[1]); if (!adj.has(kk)) adj.set(kk, []); adj.get(kk).push(k); } });
  const used = new Uint8Array(edges.length), lines = [];
  for (let k = 0; k < edges.length; k++) {
    if (used[k]) continue;
    used[k] = 1;
    const pts = [edges[k][0], edges[k][1]];
    for (const dir of [1, -1]) {
      while (true) {
        const end = dir === 1 ? pts[pts.length - 1] : pts[0];
        const cand = (adj.get(key(end[0], end[1])) || []).find(j => !used[j]);
        if (cand === undefined) break;
        used[cand] = 1;
        const e = edges[cand], nxt = key(e[0][0], e[0][1]) === key(end[0], end[1]) ? e[1] : e[0];
        if (dir === 1) pts.push(nxt); else pts.unshift(nxt);
      }
    }
    const closed = pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-3;
    lines.push({ pts, closed });
  }
  return lines;
}

// gaussian smoothing of a polyline's points (keeps endpoints of open chains)
export function smoothPts(pts, s = 1.2, closed = false) {
  const n = pts.length; if (n < 3 || s <= 0) return pts;
  const r = Math.max(1, Math.ceil(2.5 * s)), w = []; let t = 0;
  for (let i = -r; i <= r; i++) { w.push(Math.exp(-i * i / (2 * s * s))); t += w[w.length - 1]; }
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) { out.push(pts[i]); continue; }
    let x = 0, y = 0, ws = 0;
    for (let k = -r; k <= r; k++) {
      let j = i + k;
      if (closed) j = ((j % (n - 1)) + (n - 1)) % (n - 1);
      else if (j < 0 || j >= n) continue;
      const ww = w[k + r]; x += pts[j][0] * ww; y += pts[j][1] * ww; ws += ww;
    }
    out.push([x / ws, y / ws]);
  }
  if (closed) out[n - 1] = out[0];
  return out;
}

// resample a polyline at spacing ds (keeps ends)
export function resample(pts, ds = 1) {
  if (pts.length < 2) return pts;
  const out = [pts[0]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i];
    let seg = Math.hypot(x1 - x0, y1 - y0);
    while (acc + seg >= ds) { const k = (ds - acc) / seg; x0 = x0 + (x1 - x0) * k; y0 = y0 + (y1 - y0) * k; out.push([x0, y0]); seg = Math.hypot(x1 - x0, y1 - y0); acc = 0; }
    acc += seg;
  }
  const last = pts[pts.length - 1], o = out[out.length - 1];
  if (Math.hypot(last[0] - o[0], last[1] - o[1]) > ds * .3) out.push(last);
  return out;
}

// gray guided filter (He et al.): refine p using guide I, radius r, eps
export function guided(I, p, W, H, r, eps) {
  const N = W * H, mI = boxBlur(I, W, H, r), mp = boxBlur(p, W, H, r);
  const II = new Float32Array(N), Ip = new Float32Array(N);
  for (let i = 0; i < N; i++) { II[i] = I[i] * I[i]; Ip[i] = I[i] * p[i]; }
  const mII = boxBlur(II, W, H, r), mIp = boxBlur(Ip, W, H, r);
  const a = new Float32Array(N), b = new Float32Array(N);
  for (let i = 0; i < N; i++) { const v = mII[i] - mI[i] * mI[i], c = mIp[i] - mI[i] * mp[i]; a[i] = c / (v + eps); b[i] = mp[i] - a[i] * mI[i]; }
  const ma = boxBlur(a, W, H, r), mb = boxBlur(b, W, H, r), out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = clamp(ma[i] * I[i] + mb[i]);
  return out;
}

// Otsu threshold of values v (0..1) restricted to mask; returns {t, sep} (sep = between-class separation in sigmas)
export function otsu(v, mask, bins = 128) {
  const h = new Float64Array(bins); let n = 0;
  for (let i = 0; i < v.length; i++) if (!mask || mask[i]) { h[clampI(Math.floor(v[i] * bins), 0, bins - 1)]++; n++; }
  if (n < 50) return { t: .5, sep: 0, n };
  let sum = 0; for (let i = 0; i < bins; i++) sum += i * h[i];
  let wB = 0, sB = 0, best = 0, bt = 0;
  for (let i = 0; i < bins; i++) {
    wB += h[i]; if (!wB) continue; const wF = n - wB; if (!wF) break;
    sB += i * h[i]; const mB = sB / wB, mF = (sum - sB) / wF, bv = wB * wF * (mB - mF) * (mB - mF);
    if (bv > best) { best = bv; bt = i; }
  }
  let mu = sum / n, va = 0; for (let i = 0; i < bins; i++) va += h[i] * (i - mu) * (i - mu); va /= n;
  return { t: (bt + .5) / bins, sep: Math.sqrt(best / (n * n)) / Math.max(1e-6, Math.sqrt(va)), n };
}

// Felzenszwalb-Huttenlocher graph segmentation on a 3-channel image (4-connected grid), scale k, min component size.
// Returns { lab (Int32 component id per pixel, compacted 0..n-1), n }.
export function felzenszwalb(c0, c1, c2, W, H, k = .5, minSize = 40, w1 = 1, w2 = 1) {
  const N = W * H, E = (W - 1) * H + W * (H - 1);
  const ea = new Int32Array(E), eb = new Int32Array(E), ew = new Float32Array(E);
  let m = 0;
  const d = (i, j) => { const a = c0[i] - c0[j], b = (c1[i] - c1[j]) * w1, c = (c2[i] - c2[j]) * w2; return Math.sqrt(a * a + b * b + c * c); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (x < W - 1) { ea[m] = i; eb[m] = i + 1; ew[m] = d(i, i + 1); m++; }
    if (y < H - 1) { ea[m] = i; eb[m] = i + W; ew[m] = d(i, i + W); m++; }
  }
  const order = new Uint32Array(m); for (let i = 0; i < m; i++) order[i] = i;
  order.sort((a, b) => ew[a] - ew[b]);
  const parent = new Int32Array(N), size = new Int32Array(N).fill(1), th = new Float32Array(N).fill(k);
  for (let i = 0; i < N; i++) parent[i] = i;
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let q = 0; q < m; q++) {
    const e = order[q]; let a = find(ea[e]), b = find(eb[e]);
    if (a === b) continue;
    const w = ew[e];
    if (w <= th[a] && w <= th[b]) {
      if (size[a] < size[b]) { const t = a; a = b; b = t; }
      parent[b] = a; size[a] += size[b]; th[a] = w + k / size[a];
    }
  }
  for (let q = 0; q < m; q++) {
    const e = order[q], a = find(ea[e]), b = find(eb[e]);
    if (a !== b && (size[a] < minSize || size[b] < minSize)) { if (size[a] < size[b]) { parent[a] = b; size[b] += size[a]; } else { parent[b] = a; size[a] += size[b]; } }
  }
  const lab = new Int32Array(N), map = new Map();
  for (let i = 0; i < N; i++) { const r = find(i); if (!map.has(r)) map.set(r, map.size); lab[i] = map.get(r); }
  return { lab, n: map.size };
}
