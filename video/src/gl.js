// gl.js: a minimal shared WebGL2 context for scenes (full-screen passes, textures from plates).
// Headless Chromium runs WebGL2 on SwiftShader (ANGLE -> Vulkan -> SwiftShader, CPU) out of the box: no launch
// flags needed, float render targets available (EXT_color_buffer_float, OES_texture_float_linear). Budget
// fill rate: one 6-octave fbm pass at 1920x1080 costs ~45 ms. Composite into the 2D frame with
// g.drawImage(glc.canvas, 0, 0) (a GPU->CPU readback, ~10-30 ms at 1080p). The canvas is premultiplied:
// shaders output (rgb * a, a). For light (corona, field lines) output (rgb, 1) and composite additively with
// g.globalCompositeOperation = 'lighter'.
//
//   const glc = getGL(W, H);                 // one context per output size, reused across frames
//   const P = glc.program(FRAG);             // fragment shader body; gets `in vec2 uv; out vec4 o;` and
//                                            // `vec2 img(vec2 uv)`: sample textures as texture(tex, img(uv))
//   Textures keep image row order (row 0 = top; WebGL ignores UNPACK_FLIP_Y for ImageBitmaps anyway), uv has
//   y up, so img() flips: texture(tex, img(uv)) shows the image upright in the output.
//   glc.pass(P, { t, res: [W, H], tex: glc.texture(img) });   glc.canvas -> drawImage

const VERT = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1., -1.), vec2(3., -1.), vec2(-1., 3.));
out vec2 uv;
void main() { uv = P[gl_VertexID] * .5 + .5; gl_Position = vec4(P[gl_VertexID], 0., 1.); }`;

const _ctx = new Map();
export function getGL(w, h) {
  const k = `${w}x${h}`;
  if (_ctx.has(k)) return _ctx.get(k);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: true, alpha: true });
  if (!gl) throw new Error('WebGL2 unavailable');
  gl.getExtension('EXT_color_buffer_float'); gl.getExtension('OES_texture_float_linear');
  const progs = new Map(), texs = new WeakMap(), vao = gl.createVertexArray();
  const compile = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'));
    return s;
  };
  const G = {
    gl, canvas, w, h,
    program(frag) {
      if (progs.has(frag)) return progs.get(frag);
      const src = frag.startsWith('#version') ? frag : `#version 300 es\nprecision highp float;\nin vec2 uv;\nout vec4 o;\nvec2 img(vec2 p) { return vec2(p.x, 1. - p.y); }\n${frag}`;
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, src)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const uni = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); uni[u.name.replace(/\[0\]$/, '')] = { loc: gl.getUniformLocation(p, u.name), type: u.type }; }
      const P = { p, uni }; progs.set(frag, P); return P;
    },
    // texture from an ImageBitmap / canvas (cached per source object)
    texture(src, { filter = 'linear', wrap = 'clamp' } = {}) {
      let t = texs.get(src);
      if (t) return t;
      t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
      const f = filter === 'linear' ? gl.LINEAR : gl.NEAREST, wr = wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
      texs.set(src, t); return t;
    },
    // one full-screen pass into the canvas (target = null) with uniforms {name: number | array | WebGLTexture}
    pass(P, uniforms = {}, { clear = true } = {}) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); gl.useProgram(P.p); gl.bindVertexArray(vao);
      let unit = 0;
      for (const [k, v] of Object.entries(uniforms)) {
        const U = P.uni[k]; if (!U) continue;
        if (v instanceof WebGLTexture) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v); gl.uniform1i(U.loc, unit++); }
        else if (typeof v === 'number') (U.type === gl.INT || U.type === gl.BOOL ? gl.uniform1i : gl.uniform1f).call(gl, U.loc, v);
        else if (v.length === 2) gl.uniform2fv(U.loc, v); else if (v.length === 3) gl.uniform3fv(U.loc, v); else if (v.length === 4) gl.uniform4fv(U.loc, v);
      }
      if (clear) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return canvas;
    },
    info() {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return { renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION),
        maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE), floatTargets: !!gl.getExtension('EXT_color_buffer_float') };
    },
  };
  _ctx.set(k, G);
  return G;
}
