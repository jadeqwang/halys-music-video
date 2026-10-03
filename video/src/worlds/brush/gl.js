// gl.js: a small WebGL2 toolkit for the brush engine (programs, float targets, fullscreen passes, stroke meshes).
// Headless Chromium runs it on SwiftShader (CPU), so passes are few and fill is budgeted. Convention: texel row 0 =
// TOP of the image; vUv.y = 0 is the image top; only the final pass to the canvas flips (uFlip = 1).

export class GL {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.canvas = document.createElement('canvas'); this.canvas.width = w; this.canvas.height = h;
    const gl = this.gl = this.canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.ext = { cbf: gl.getExtension('EXT_color_buffer_float'), fblend: gl.getExtension('EXT_float_blend'), flin: gl.getExtension('OES_texture_float_linear') };
    this.progs = new Map();
    this.vao = gl.createVertexArray();
  }
  shader(type, src) {
    const gl = this.gl, s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
    return s;
  }
  program(vs, fs) {
    const key = vs + '\u0000' + fs;
    if (this.progs.has(key)) return this.progs.get(key);
    const gl = this.gl, p = gl.createProgram();
    gl.attachShader(p, this.shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, this.shader(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const uni = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); uni[u.name.replace(/\[0\]$/, '')] = { loc: gl.getUniformLocation(p, u.name), type: u.type, size: u.size }; }
    const P = { p, uni, attr: {} };
    this.progs.set(key, P);
    return P;
  }
  setUniforms(P, u) {
    const gl = this.gl; let unit = 0;
    for (const [k, v] of Object.entries(u)) {
      const U = P.uni[k]; if (!U || v == null) continue;
      switch (U.type) {
        case gl.FLOAT: U.size > 1 ? gl.uniform1fv(U.loc, v) : gl.uniform1f(U.loc, v); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(U.loc, v); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(U.loc, v); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(U.loc, v); break;
        case gl.INT: case gl.BOOL: gl.uniform1i(U.loc, v); break;
        case gl.SAMPLER_2D: gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v.tex || v); gl.uniform1i(U.loc, unit); unit++; break;
        default: throw new Error('uniform type ' + U.type + ' for ' + k);
      }
    }
  }
  // fmt 'rgba8' | 'rgba16f' | 'rgba32f' | 'r32f' | 'r16f'
  texture(w, h, o = {}) {
    const gl = this.gl, t = gl.createTexture(), fmt = o.fmt || 'rgba8';
    const F = {
      rgba8: [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE], rgba16f: [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT], rgba32f: [gl.RGBA32F, gl.RGBA, gl.FLOAT],
      r32f: [gl.R32F, gl.RED, gl.FLOAT], r16f: [gl.R16F, gl.RED, gl.HALF_FLOAT], r8: [gl.R8, gl.RED, gl.UNSIGNED_BYTE],
    }[fmt];
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const data = o.data ?? null;
    let type = F[2];
    if (data && fmt.endsWith('16f') && data instanceof Float32Array) type = gl.FLOAT;
    gl.texImage2D(gl.TEXTURE_2D, 0, F[0], w, h, 0, F[1], type, data);
    const lin = (o.filter ?? 'linear') === 'linear' ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, lin); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, lin);
    const wr = o.wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
    return { tex: t, w, h, fmt };
  }
  // update a texture's pixels in place (same size/format)
  upload(T, data) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, T.tex);
    const F = { rgba8: [gl.RGBA, gl.UNSIGNED_BYTE], r8: [gl.RED, gl.UNSIGNED_BYTE], rgba32f: [gl.RGBA, gl.FLOAT], r32f: [gl.RED, gl.FLOAT], rgba16f: [gl.RGBA, gl.FLOAT], r16f: [gl.RED, gl.FLOAT] }[T.fmt];
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, T.w, T.h, F[0], F[1], data);
  }
  target(w, h, fmts) {
    const gl = this.gl, fb = gl.createFramebuffer(), tex = [];
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    (Array.isArray(fmts) ? fmts : [fmts]).forEach((f, i) => {
      const t = this.texture(w, h, { fmt: f }); tex.push(t);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t.tex, 0);
    });
    gl.drawBuffers(tex.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete ' + st);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, w, h };
  }
  bind(T) {
    const gl = this.gl;
    if (T) { gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb); gl.viewport(0, 0, T.w, T.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.w, this.h); }
  }
  clear(T, rgba = [0, 0, 0, 0]) {
    const gl = this.gl; this.bind(T); gl.clearColor(rgba[0], rgba[1], rgba[2], rgba[3]); gl.clear(gl.COLOR_BUFFER_BIT);
  }
  blend(mode) {
    const gl = this.gl;
    if (!mode) { gl.disable(gl.BLEND); return; }
    gl.enable(gl.BLEND);
    if (mode === 'premult') gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    else if (mode === 'add') gl.blendFunc(gl.ONE, gl.ONE);
    else if (mode === 'alpha') gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  pass(fs, uniforms, T = null, blend = null) {
    const P = this.program(FS_VS, fs), gl = this.gl;
    this.bind(T); gl.useProgram(P.p); this.blend(blend);
    this.setUniforms(P, { uRes: [T ? T.w : this.w, T ? T.h : this.h], ...uniforms });
    gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
  }
  // a persistent dynamic mesh per program: attribute buffers are re-filled each draw (no per-frame allocation churn)
  meshDraw(P, attrs, idx, nIdx, uniforms, T, blend) {
    const gl = this.gl;
    if (!P.mesh) {
      P.mesh = { vao: gl.createVertexArray(), bufs: {}, ib: gl.createBuffer() };
      gl.bindVertexArray(P.mesh.vao);
      for (const [name, a] of Object.entries(attrs)) {
        const loc = gl.getAttribLocation(P.p, name); if (loc < 0) continue;
        const b = gl.createBuffer(); P.mesh.bufs[name] = b; gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, a.size, gl.FLOAT, false, 0, 0);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, P.mesh.ib);
      gl.bindVertexArray(null);
    }
    gl.bindVertexArray(P.mesh.vao);
    for (const [name, a] of Object.entries(attrs)) { const b = P.mesh.bufs[name]; if (!b) continue; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a.data, gl.STREAM_DRAW); }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, P.mesh.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx.subarray(0, nIdx), gl.STREAM_DRAW);
    this.bind(T); gl.useProgram(P.p); this.blend(blend);
    this.setUniforms(P, { uRes: [T ? T.w : this.w, T ? T.h : this.h], ...uniforms });
    gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }
  finish() { const px = new Uint8Array(4); this.gl.readPixels(0, 0, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, px); }
  deleteTexture(t) { this.gl.deleteTexture(t.tex || t); }
}

const FS_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const GLSL_COMMON = `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s / .96875; }
float voronoiEdge(vec2 x) {
  vec2 n = floor(x), f = fract(x), mg, mr; float md = 8.;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(i, j), o = hash22(n + g), r = g + o - f; float d = dot(r, r); if (d < md) { md = d; mr = r; mg = g; } }
  md = 8.;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) { vec2 g = mg + vec2(i, j), o = hash22(n + g), r = g + o - f; if (dot(mr - r, mr - r) > .00001) md = min(md, dot(.5 * (mr + r), normalize(r - mr))); }
  return md;
}
vec3 s2l(vec3 c) { return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c)); }
vec3 l2s(vec3 c) { c = max(c, 0.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
float luma(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }
`;

// a tileable RGBA noise texture (independent smooth channels at different scales), deterministic
export function noiseTexture(glw, n = 256, seed = 1) {
  const data = new Uint8Array(n * n * 4);
  let s = seed >>> 0;
  const r = () => { s = (s + 0x6d2b79f5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const raw = new Float32Array(n * n * 4); for (let i = 0; i < raw.length; i++) raw[i] = r();
  const rad = [1, 2, 0, 3];
  for (let c = 0; c < 4; c++) {
    const R = rad[c];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let acc = 0, k = 0;
      for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) { acc += raw[((((y + j) % n + n) % n) * n + (((x + i) % n + n) % n)) * 4 + c]; k++; }
      data[(y * n + x) * 4 + c] = Math.round(acc / k * 255);
    }
  }
  for (let c = 0; c < 4; c++) {
    let lo = 255, hi = 0; for (let i = c; i < data.length; i += 4) { lo = Math.min(lo, data[i]); hi = Math.max(hi, data[i]); }
    for (let i = c; i < data.length; i += 4) data[i] = Math.round((data[i] - lo) / Math.max(1, hi - lo) * 255);
  }
  const gl = glw.gl, t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return { tex: t, w: n, h: n };
}
