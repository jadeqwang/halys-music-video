// render.js: draw an INK analysis (cel.js / bg.js) at output resolution.
//   fills: label map -> per-label smoothed indicator fields (analysis res) -> GPU argmax at output res, antialiased with
//          fwidth, so region borders are smooth curves at any zoom (no stair-steps, no blur)
//   lines: tapered ribbons (Canvas2D paths) in screen-constant widths
// view = { ox, oy, s }: output px = (ox + x * s, oy + y * s) for analysis px (x, y); u = output px per 1080p px.

import { getGL } from '../../gl.js';
import { makeCanvas } from '../../assets.js';
import { boxBlur } from './img.js';
import { hex2rgb } from './palette.js';

const MAXL = 20;    // labels per pass (5 RGBA textures)
const FILL_FS = `
uniform sampler2D t0, t1, t2, t3, t4;
uniform vec3 pal[${MAXL}];
uniform float alp[${MAXL}];
uniform vec2 aSize, oSize;
uniform vec3 view;
uniform int nl;
float pick(int k, vec4 a, vec4 b, vec4 c, vec4 d, vec4 e) {
  vec4 v = k < 4 ? a : k < 8 ? b : k < 12 ? c : k < 16 ? d : e;
  int j = k - (k / 4) * 4;
  return j == 0 ? v.x : j == 1 ? v.y : j == 2 ? v.z : v.w;
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, oSize.y - gl_FragCoord.y);
  vec2 q = (p - view.xy) / view.z;
  vec2 tc = q / aSize;
  if (tc.x < 0. || tc.y < 0. || tc.x > 1. || tc.y > 1.) { o = vec4(0.); return; }
  vec4 a = texture(t0, tc), b = texture(t1, tc), c = texture(t2, tc), d = texture(t3, tc), e = texture(t4, tc);
  int k1 = 0, k2 = 0; float v1 = -1., v2 = -1.;
  for (int k = 0; k < ${MAXL}; k++) {
    if (k >= nl) break;
    float v = pick(k, a, b, c, d, e);
    if (v > v1) { v2 = v1; k2 = k1; v1 = v; k1 = k; } else if (v > v2) { v2 = v; k2 = k; }
  }
  // signed distance to the k1/k2 border in output px ~ g / |grad g|: a one-pixel antialiased edge, never a blur
  float g = v1 - v2, w = clamp(.5 + g / max(fwidth(g), 1e-5), 0., 1.);
  float a1 = alp[k1], a2 = alp[k2];
  vec3 c1 = pal[k1] * a1, c2 = pal[k2] * a2;
  float al = mix(a2, a1, w);
  o = vec4(mix(c2, c1, w), al);
}`;

// pack per-label indicator fields (box-blurred one-hot) into 5 RGBA byte arrays (raw bytes: never through a 2D canvas,
// whose premultiplied alpha would zero the other three channels wherever the fourth label is absent)
function packFields(lab, W, H, nl, r = 1) {
  const N = W * H, bufs = [];
  const one = new Float32Array(N), blur = new Float32Array(N);
  for (let t = 0; t < 5; t++) bufs.push(new Uint8Array(N * 4));
  for (let k = 0; k < Math.min(nl, MAXL); k++) {
    const img = bufs[k >> 2], ch = k & 3;
    let any = false;
    for (let i = 0; i < N; i++) { const v = lab[i] === k ? 1 : 0; one[i] = v; any ||= v; }
    if (!any) continue;
    boxBlur(one, W, H, r, blur);
    for (let i = 0; i < N; i++) img[i * 4 + ch] = Math.round(blur[i] * 255);
  }
  return bufs.map(data => ({ data, w: W, h: H }));
}

// our own pass (gl.js's pass() sets only scalar/vec uniforms; the palette is a uniform array) on the shared context
const _vao = new WeakMap();
function pass(glc, P, U) {
  const gl = glc.gl;
  if (!_vao.has(gl)) _vao.set(gl, gl.createVertexArray());
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, glc.w, glc.h); gl.useProgram(P.p); gl.bindVertexArray(_vao.get(gl));
  gl.disable(gl.BLEND);
  let unit = 0;
  for (const [k, v] of Object.entries(U)) {
    const u = P.uni[k]; if (!u) continue;
    if (v instanceof WebGLTexture) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v); gl.uniform1i(u.loc, unit++); }
    else if (typeof v === 'number') (u.type === gl.INT || u.type === gl.BOOL ? gl.uniform1i : gl.uniform1f).call(gl, u.loc, v);
    else if (u.type === gl.FLOAT_VEC3) gl.uniform3fv(u.loc, v);
    else if (u.type === gl.FLOAT_VEC2) gl.uniform2fv(u.loc, v);
    else if (u.type === gl.FLOAT_VEC4) gl.uniform4fv(u.loc, v);
    else if (u.type === gl.FLOAT) gl.uniform1fv(u.loc, v);
  }
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
function upload(gl, c) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  if (c.data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, c.w, c.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, c.data);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

// fills of a label map into ctx g (output size W x H). pal: hex per label; alpha per label (0 = transparent).
// Returns the packed fields (pass them back as opts.packed to redraw the same drawing cheaply).
export function drawFills(g, lab, aw, ah, pal, alpha, view, opts = {}) {
  const W = g.canvas.width, H = g.canvas.height, nl = pal.length;
  if (nl > MAXL) throw new Error(`ink fills: ${nl} labels > ${MAXL}`);
  const cs = opts.packed || packFields(lab, aw, ah, nl, opts.r ?? 1);
  const glc = getGL(W, H), P = glc.program(FILL_FS), gl = glc.gl;
  const palF = new Float32Array(MAXL * 3), alF = new Float32Array(MAXL);
  pal.forEach((h, k) => { const [r, gg, b] = hex2rgb(h); palF[k * 3] = r / 255; palF[k * 3 + 1] = gg / 255; palF[k * 3 + 2] = b / 255; alF[k] = alpha[k] ?? 1; });
  const tex = cs.map(c => upload(gl, c));
  pass(glc, P, { t0: tex[0], t1: tex[1], t2: tex[2], t3: tex[3], t4: tex[4], pal: palF, alp: alF, aSize: [aw, ah], oSize: [W, H], view: [view.ox, view.oy, view.s], nl });
  g.drawImage(glc.canvas, 0, 0);
  for (const t of tex) gl.deleteTexture(t);
  return cs;
}

// ---------------------------------------------------------------- lines
// one ribbon polygon per chain into a Path2D. widths in output px (already scaled); taper at open ends.
export function ribbonPath(path, pts, view, wFn, closed = false) {
  const n = pts.length; if (n < 2) return;
  const P = pts.map(([x, y]) => [view.ox + x * view.s, view.oy + y * view.s]);
  // arc length
  const S = new Float32Array(n); for (let i = 1; i < n; i++) S[i] = S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  const len = S[n - 1]; if (len < .5) return;
  const Lft = [], Rgt = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
    const hw = wFn(S[i], len, i) / 2;
    Lft.push([P[i][0] - ty * hw, P[i][1] + tx * hw]); Rgt.push([P[i][0] + ty * hw, P[i][1] - tx * hw]);
  }
  path.moveTo(Lft[0][0], Lft[0][1]);
  for (let i = 1; i < n; i++) path.lineTo(Lft[i][0], Lft[i][1]);
  for (let i = n - 1; i >= 0; i--) path.lineTo(Rgt[i][0], Rgt[i][1]);
  path.closePath();
}

// taper profile: pointed ends over `tl` px, a slight swell in the middle (a brush, not a vector stroke)
export const taper = (w, tl, minK = .12) => (s, len) => {
  const t = Math.min(tl, len * .45), e = Math.min(s, len - s);
  const k = t > 0 ? Math.min(1, e / t) : 1;
  return w * (minK + (1 - minK) * Math.pow(k, .65)) * (1 + .08 * Math.sin(Math.PI * Math.min(1, s / Math.max(1e-3, len))));
};

export function drawChains(g, chains, view, u, colors, opts = {}) {
  const byCol = new Map();
  for (const c of chains) {
    const col = colors[c.col || 'ink'] || colors.ink;
    if (!byCol.has(col)) byCol.set(col, new Path2D());
    const w = c.w * u * (opts.wScale || 1);
    const tl = c.kind === 'sil' ? 7 * u : Math.max(3, 9 * u);
    ribbonPath(byCol.get(col), c.pts, view, c.kind === 'sil' ? taper(w, tl, .35) : taper(w, tl, .1), c.closed);
  }
  // hair strands first (they are tone inside the black, not outline): every ink line draws over them
  const order = [...byCol.keys()].sort((a, b) => (b === colors.strand) - (a === colors.strand));
  for (const col of order) { g.fillStyle = col; g.fill(byCol.get(col), 'nonzero'); }
}
