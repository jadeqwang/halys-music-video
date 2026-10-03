// tgl.js: the type layer's own WebGL2 context. One canvas, resized to each text block before it is drawn, because a
// drawImage() from a WebGL canvas reads back the whole canvas (measured: 27 ms for 1920x1080 even for a sub-rectangle,
// 3-10 ms for block-sized canvases). Shaders get `in vec2 uv; out vec4 o;` and helpers: tc() = uv with y down (canvas
// orientation, matching textures uploaded from 2D canvases), value noise vn(), fbm(), hash h21().

const VERT = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1., -1.), vec2(3., -1.), vec2(-1., 3.));
out vec2 uv;
void main() { uv = P[gl_VertexID] * .5 + .5; gl_Position = vec4(P[gl_VertexID], 0., 1.); }`;

export const GLSL_LIB = `
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + 1.), f.x), f.y); }
float fbm2(vec2 p) { return (vn(p) * .667 + vn(p * 2.03 + 17.1) * .333); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 17.1; a *= .5; } return s / .9375; }
`;

let G = null;
export function tgl() {
  if (G) return G;
  const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true });
  if (!gl) throw new Error('type layer: WebGL2 unavailable');
  const vao = gl.createVertexArray(), progs = new Map(), slots = [];
  const compile = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('type shader: ' + gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'));
    return s;
  };
  G = {
    gl, canvas,
    program(body) {
      if (progs.has(body)) return progs.get(body);
      const src = `#version 300 es\nprecision highp float;\nin vec2 uv;\nout vec4 o;\nvec2 tc() { return vec2(uv.x, 1. - uv.y); }\n${GLSL_LIB}\n${body}`;
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, src)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const uni = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); uni[u.name.replace(/\[0\]$/, '')] = { loc: gl.getUniformLocation(p, u.name), type: u.type }; }
      const P = { p, uni }; progs.set(body, P); return P;
    },
    size(w, h) { if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } gl.viewport(0, 0, w, h); },
    // upload a 2D canvas into texture slot k (re-used every call)
    texture(k, src) {
      gl.activeTexture(gl.TEXTURE0 + k);              // select the unit first: creating a texture binds it to the active unit
      if (!slots[k]) {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        slots[k] = t;
      }
      gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, slots[k]);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
      return k;
    },
    // draw P over the whole (resized) canvas; uniforms {name: number | [..] | {tex: slot}}
    draw(P, uniforms) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.useProgram(P.p); gl.bindVertexArray(vao);
      for (const [k, v] of Object.entries(uniforms)) {
        const U = P.uni[k]; if (!U) continue;
        if (v && typeof v === 'object' && 'tex' in v) gl.uniform1i(U.loc, v.tex);
        else if (typeof v === 'number') (U.type === gl.INT || U.type === gl.BOOL || U.type === gl.SAMPLER_2D ? gl.uniform1i : gl.uniform1f).call(gl, U.loc, v);
        else if (v.length === 2) gl.uniform2fv(U.loc, v); else if (v.length === 3) gl.uniform3fv(U.loc, v); else if (v.length === 4) gl.uniform4fv(U.loc, v);
      }
      gl.disable(gl.BLEND); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return canvas;
    },
  };
  return G;
}

export function rgb01(hex) { const n = parseInt(hex.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
