// gpu.js: WebGL2 rasteriser for the line engine (one context per output size; SwiftShader in headless Chromium).
//
// Lines become triangle strips (two GPU vertices per polyline point). The vertex shader does the camera work, so a
// static line set is uploaded once and every frame only changes uniforms:
//   line coords --(layer affine xf)--> plate px --(framing S, off)--> screen px at rest --(3D lift from depth d,
//   yaw/pitch orbit around the pivot, zoom, pan)--> screen px --(kick: radial push from the sun)--> + width expansion.
// Fragment: analytic coverage across the line (crisp at any width, energy-preserving below 1 px), travelling pulses
// along the arc length, end fades, colour (pearl -> orange -> H-alpha red).
// Two accumulation targets (RGBA16F, additive): GLOW lines (feed a restrained two-level glow) and SHARP lines (spear
// ticks, tips: never glowed). The post pass composes, cuts the crisp black disk, tone-maps, adds the navy-black ground,
// vignette, the optional inversion (dark lines on pearl) and a 1/255 dither.

import { hexRgb } from '../../core.js';

const s2l = c => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
export const lin = hex => hexRgb(hex).map(v => s2l(v / 255));

const STRIDE = 20;   // floats per GPU vertex

const LINE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec4 a0;   // x, y, d, side
layout(location=1) in vec4 a1;   // prev x, y, next x, y
layout(location=2) in vec4 a2;   // prev d, next d, s, len
layout(location=3) in vec4 a3;   // b, w, o, flags
layout(location=4) in vec4 a4;   // phase, spd, u, rnd
uniform vec2 uRes;
uniform vec3 uXf0, uXf1;         // layer affine: line coords -> plate px
uniform float uS; uniform vec2 uOff;   // plate px -> screen px (rest framing)
uniform vec4 uCam;               // focal px, zNear, zFar, skyZ
uniform float uZp;               // pivot z
uniform vec4 uRot;               // cos yaw, sin yaw, cos pitch, sin pitch
uniform float uOver; uniform vec2 uPan; uniform vec2 uC;
uniform vec4 uPush;              // cx, cy, px, falloff px
uniform float uWidth, uKickW, uMinW;
uniform vec4 uReveal;            // cx, cy, radius px (lines inside are hidden), ramp px
uniform vec2 uReveal2;           // ignition boost just outside the radius, its falloff px
out vec4 vA; out vec4 vB; out vec4 vC;
vec3 proj(vec2 xy, float d) {
  vec2 p = vec2(dot(uXf0, vec3(xy, 1.0)), dot(uXf1, vec3(xy, 1.0)));
  vec2 sp = p * uS + uOff;
  float zn = uCam.y, zf = uCam.z;
  float z = d < -0.5 ? zf * uCam.w : 1.0 / (clamp(d, 0.0, 1.0) * (1.0 / zn - 1.0 / zf) + 1.0 / zf);
  vec3 P = vec3((sp - uC) / uCam.x * z, z - uZp);
  float x1 = P.x * uRot.x + P.z * uRot.y, z1 = -P.x * uRot.y + P.z * uRot.x;
  float y2 = P.y * uRot.z - z1 * uRot.w, z2 = P.y * uRot.w + z1 * uRot.z + uZp;
  vec2 q = uC + uCam.x * uOver * vec2(x1, y2) / max(z2, 1e-3) + uPan;
  if (uPush.z != 0.0) { vec2 dv = q - uPush.xy; float dd = max(length(dv), 1e-3); q += dv / dd * uPush.z * (0.4 + 0.6 * exp(-dd / uPush.w)); }
  return vec3(q, z2);
}
void main() {
  float flags = a3.w;
  vec3 P = proj(a0.xy, a0.z), Pp = proj(a1.xy, a2.x), Pn = proj(a1.zw, a2.y);
  vec2 t = Pn.xy - Pp.xy; float tl = length(t); t = tl > 1e-5 ? t / tl : vec2(1.0, 0.0);
  float tip = mod(floor(flags / 4.0), 2.0);
  float w = max(a3.y * uWidth * (1.0 + uKickW), uMinW);
  float hw = 0.5 * w, ext = hw + 1.0;
  vec2 pos = P.xy + vec2(-t.y, t.x) * a0.w * ext;
  if (tip > 0.5) pos = P.xy + vec2(a0.w * ext, (a4.z - 0.5) * 2.0 * ext);   // a point: a tiny square splat
  float rv = 1.0;
  if (uReveal.z > 0.0) { float dr = length(P.xy - uReveal.xy); rv = smoothstep(uReveal.z, uReveal.z + uReveal.w, dr) * (1.0 + uReveal2.x * exp(-max(dr - uReveal.z, 0.0) / max(uReveal2.y, 1.0))); }
  vA = vec4(a0.w, a2.z, a3.x * rv, a3.z);
  vB = vec4(a4.x, hw, a4.y, flags);
  vC = vec4(a2.w, a4.z, a4.w, tip);
  gl_Position = vec4(pos.x / uRes.x * 2.0 - 1.0, 1.0 - pos.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const LINE_FS = `#version 300 es
precision highp float;
in vec4 vA; in vec4 vB; in vec4 vC;
uniform float uT, uLambda, uPulse, uKick, uBright, uFlat, uEndFade, uWhite;
uniform vec3 uPearl, uOrange, uRed;
out vec4 o;
void main() {
  float v = vA.x, s = vA.y, b = vA.z, org = vA.w, phase = vB.x, hw = vB.y, spd = vB.z, flags = vB.w;
  float len = vC.x, tip = vC.w;
  float dpx = abs(v) * (hw + 1.0);
  float cov = clamp(hw + 0.5 - dpx, 0.0, 1.0) * min(1.0, 2.0 * hw);
  if (tip > 0.5) cov = clamp(hw + 0.5 - dpx, 0.0, 1.0) * clamp(hw + 0.5 - abs(vC.y - 0.5) * 2.0 * (hw + 1.0), 0.0, 1.0) * min(1.0, 2.0 * hw);
  if (cov <= 0.002 || b <= 0.0005) discard;
  float lam = uLambda * (1.0 - 0.3 * uKick);
  float w = 0.5 + 0.5 * cos(6.2831853 * (s / lam - uT * spd) + phase);
  float pulse = (1.0 - uPulse) + uPulse * 1.7 * pow(w, mix(1.6, 5.0, uKick));
  float nofade = mod(floor(flags / 64.0), 2.0);
  float ends = nofade > 0.5 || tip > 0.5 ? 1.0 : smoothstep(0.0, uEndFade, s) * smoothstep(0.0, uEndFade, len - s);
  if (len < 2.0) ends = 1.0;
  float B = mix(b, 0.85 * smoothstep(0.0, 0.25, b), uFlat);
  float I = B * pulse * ends * uBright * (1.0 + 0.6 * uKick);
  vec3 col = org <= 1.0 ? mix(uPearl, uOrange, org) : mix(uOrange, uRed, min(1.0, org - 1.0));
  col = mix(col, vec3(1.0), uWhite);
  o = vec4(col * I * cov, 1.0);
}`;

const FS_VS = `#version 300 es
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

// downsample by `uK` (2 or 4) in one pass: bilinear taps placed on texel corners average 2x2 blocks each
const DOWN_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uRes; uniform float uK; out vec4 o;
void main() { vec2 src = uRes * uK, c = gl_FragCoord.xy * uK; vec2 d = vec2(uK * 0.25);
  if (uK < 3.0) { o = texture(uSrc, c / src); return; }
  o = 0.25 * (texture(uSrc, (c + vec2(-d.x, -d.y)) / src) + texture(uSrc, (c + vec2(d.x, -d.y)) / src) + texture(uSrc, (c + vec2(-d.x, d.y)) / src) + texture(uSrc, (c + vec2(d.x, d.y)) / src)); }`;
const COMBINE_FS = `#version 300 es
precision highp float;
uniform sampler2D uA, uB; uniform vec2 uRes; uniform float uWa, uWb; out vec4 o;
void main() { vec2 uv = gl_FragCoord.xy / uRes; o = uWa * texture(uA, uv) + uWb * texture(uB, uv); }`;

const BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uRes; uniform vec2 uDir; out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  const float w0 = 0.1205, w1 = 0.2101, w2 = 0.1460, w3 = 0.0727, w4 = 0.0254;
  const float o1 = 1.4697, o2 = 3.4291, o3 = 5.3884, o4 = 7.3488;
  vec2 dd = uDir / uRes;
  vec4 c = texture(uSrc, uv) * w0;
  c += (texture(uSrc, uv + dd * o1) + texture(uSrc, uv - dd * o1)) * w1;
  c += (texture(uSrc, uv + dd * o2) + texture(uSrc, uv - dd * o2)) * w2;
  c += (texture(uSrc, uv + dd * o3) + texture(uSrc, uv - dd * o3)) * w3;
  c += (texture(uSrc, uv + dd * o4) + texture(uSrc, uv - dd * o4)) * w4;
  o = c / (w0 + 2.0 * (w1 + w2 + w3 + w4));
}`;

const POST_FS = `#version 300 es
precision highp float;
uniform sampler2D uLines, uGlow;
uniform vec2 uRes;
uniform vec3 uBg, uPearl, uInk;
uniform float uExposure, uVig, uInvert, uFade, uSoft;
uniform vec4 uDisk;   // x, y (screen px, y down), r, on
uniform vec4 uRing;   // r, width, intensity, on   (a bright ring of light at radius r around the disk centre)
uniform vec4 uFlash;  // pearl flash amount (whole frame)
out vec4 o;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 l2s(vec3 c) { c = max(c, 0.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 gl = texture(uGlow, uv).rgb;
  vec3 c = texelFetch(uLines, ivec2(gl_FragCoord.xy), 0).rgb + gl;
  if (uSoft > 0.0) c = mix(c, gl * 2.2, uSoft);
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  if (uRing.w > 0.5) { float dr = length(p - uDisk.xy) - uRing.x; c += uPearl * uRing.z * (exp(-dr * dr / (uRing.y * uRing.y)) + 0.35 * exp(-max(dr, 0.0) / (uRing.y * 6.0)) * step(0.0, dr)); }
  if (uDisk.w > 0.5) { float dk = length(p - uDisk.xy) - uDisk.z; c *= smoothstep(-0.6, 0.6, dk); }
  c *= uFade;
  c = 1.0 - exp(-c * uExposure);
  vec2 q = (uv - 0.5) * vec2(1.0, 0.8);
  float vig = 1.0 - uVig * pow(clamp(length(q) * 1.4, 0.0, 1.0), 2.0);
  vec3 bg = uBg * vig;
  vec3 col = bg + c * (1.0 - bg);
  if (uInvert > 0.5) col = mix(uPearl, uInk, clamp(dot(c, vec3(0.3333)) * 1.35, 0.0, 1.0)) * mix(0.93, 1.0, vig);
  col = mix(col, uPearl, uFlash.x);
  o = vec4(l2s(col) + (hash12(gl_FragCoord.xy) - 0.5) / 255.0, 1.0);
}`;

export class LineGL {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.canvas = new OffscreenCanvas(W, H);
    const gl = this.gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, depth: false, stencil: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float unavailable');
    gl.getExtension('OES_texture_float_linear'); gl.getExtension('EXT_float_blend');
    this.progs = new Map(); this.vao0 = gl.createVertexArray();
    this.TL = this.target(W, H);
    this.TQ = [this.target(W >> 2, H >> 2), this.target(W >> 2, H >> 2), this.target(W >> 2, H >> 2)];
    this.TE = [this.target(W >> 3, H >> 3), this.target(W >> 3, H >> 3)];
    this.P = { line: this.program(LINE_VS, LINE_FS), down: this.program(FS_VS, DOWN_FS), blur: this.program(FS_VS, BLUR_FS), post: this.program(FS_VS, POST_FS), comb: this.program(FS_VS, COMBINE_FS) };
  }
  program(vs, fs) {
    const gl = this.gl, key = vs + fs; if (this.progs.has(key)) return this.progs.get(key);
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const uni = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); uni[u.name] = { loc: gl.getUniformLocation(p, u.name), type: u.type }; }
    const P = { p, uni }; this.progs.set(key, P); return P;
  }
  target(w, h) {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, w, h };
  }
  uniforms(P, u) {
    const gl = this.gl; let unit = 0;
    for (const [k, v] of Object.entries(u)) {
      const U = P.uni[k]; if (!U || v == null) continue;
      switch (U.type) {
        case gl.FLOAT: gl.uniform1f(U.loc, v); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(U.loc, v); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(U.loc, v); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(U.loc, v); break;
        case gl.SAMPLER_2D: gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v.tex || v); gl.uniform1i(U.loc, unit++); break;
        default: gl.uniform1f(U.loc, v);
      }
    }
  }
  bind(T) { const gl = this.gl; if (T) { gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb); gl.viewport(0, 0, T.w, T.h); } else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.W, this.H); } }
  clear(T) { const gl = this.gl; this.bind(T); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }

  // ---- meshes: lines -> interleaved strips, split into glow and sharp parts
  mesh(lines, { dynamic = false } = {}) {
    const parts = { glow: [], sharp: [] };
    for (const L of lines) if (L && L.n >= 2) (L.flags & 1 ? parts.sharp : parts.glow).push(L);
    const out = { glow: this.upload(parts.glow, dynamic), sharp: this.upload(parts.sharp, dynamic), nLines: lines.length };
    out.dispose = () => { for (const m of [out.glow, out.sharp]) if (m) m.dispose(); };
    return out;
  }
  upload(lines, dynamic) {
    if (!lines.length) return null;
    let nv = 0, ni = 0; for (const L of lines) { nv += L.n * 2; ni += (L.n - 1) * 6; }
    const V = new Float32Array(nv * STRIDE), I = new Uint32Array(ni);
    let vi = 0, ii = 0;
    for (const L of lines) {
      const n = L.n, xy = L.xy, base = vi, flags = L.flags || 0, len = L.len || 0, ph = L.phase || 0, spd = L.spd ?? 1, rnd = L.rnd ?? ((L.id || 0) * 0.6180339887 % 1);
      for (let k = 0; k < n; k++) {
        const kp = k > 0 ? k - 1 : 0, kn = k < n - 1 ? k + 1 : n - 1, u = n > 1 ? k / (n - 1) : 0;
        const x = xy[k * 2], y = xy[k * 2 + 1], d = L.d ? L.d[k] : .5, s = L.s ? L.s[k] : 0, b = L.b ? L.b[k] : 1, w = L.w ? L.w[k] : 1, oo = L.o ? L.o[k] : 0;
        for (const side of [-1, 1]) {
          const o = vi * STRIDE;
          V[o] = x; V[o + 1] = y; V[o + 2] = d; V[o + 3] = side;
          V[o + 4] = xy[kp * 2]; V[o + 5] = xy[kp * 2 + 1]; V[o + 6] = xy[kn * 2]; V[o + 7] = xy[kn * 2 + 1];
          V[o + 8] = L.d ? L.d[kp] : d; V[o + 9] = L.d ? L.d[kn] : d; V[o + 10] = s; V[o + 11] = len;
          V[o + 12] = b; V[o + 13] = w; V[o + 14] = oo; V[o + 15] = flags;
          V[o + 16] = ph; V[o + 17] = spd; V[o + 18] = (flags & 4) ? (side < 0 ? 0 : 1) * 0 + (k === 0 ? 0 : 1) : u; V[o + 19] = rnd;
          vi++;
        }
      }
      for (let k = 0; k < n - 1; k++) { const q = base + k * 2; I[ii++] = q; I[ii++] = q + 1; I[ii++] = q + 2; I[ii++] = q + 1; I[ii++] = q + 3; I[ii++] = q + 2; }
    }
    const gl = this.gl, vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, V, dynamic ? gl.STREAM_DRAW : gl.STATIC_DRAW);
    for (let a = 0; a < 5; a++) { gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 4, gl.FLOAT, false, STRIDE * 4, a * 16); }
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I, dynamic ? gl.STREAM_DRAW : gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: ni, nv, bytes: V.byteLength + I.byteLength, dispose: () => { gl.deleteBuffer(vb); gl.deleteBuffer(ib); gl.deleteVertexArray(vao); } };
  }

  // ---- one frame. layers: [{ meshes: [mesh...], u: {...uniform overrides} }]; post: {...}
  sync() { const px = new Uint8Array(4); this.gl.readPixels(0, 0, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, px); }
  render(layers, post = {}) {
    const gl = this.gl, W = this.W, H = this.H, prof = this.prof = {}; let tq = performance.now();
    const lap = k => { if (!this.profile) return; this.sync(); const n = performance.now(); prof[k] = Math.round(n - tq); tq = n; };
    this.clear(this.TL);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const P = this.P.line;
    const C = post.colors || {};
    const shared = { uRes: [W, H], uPearl: C.pearl, uOrange: C.orange, uRed: C.red };
    const raster = part => {
      for (const Ly of layers) {
        let any = false; for (const m of Ly.meshes) if (m && m[part]) any = true;
        if (!any) continue;
        this.bind(this.TL); gl.useProgram(P.p); this.uniforms(P, { ...shared, ...defaultsU(W, H), ...Ly.u });
        for (const m of Ly.meshes) { const mm = m && m[part]; if (!mm) continue; gl.bindVertexArray(mm.vao); gl.drawElements(gl.TRIANGLES, mm.count, gl.UNSIGNED_INT, 0); }
      }
      gl.bindVertexArray(null);
    };
    raster('glow');
    gl.disable(gl.BLEND);
    lap('raster');
    // restrained glow: quarter (tight) and eighth (wide) resolution, combined at quarter resolution
    const pass = (prog, u, T) => { this.bind(T); gl.useProgram(prog.p); this.uniforms(prog, { uRes: [T ? T.w : W, T ? T.h : H], ...u }); gl.bindVertexArray(this.vao0); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    const g = post.glow ?? [.24, .09];
    if (g[0] > 0 || g[1] > 0 || post.soft) {
      pass(this.P.down, { uSrc: this.TL, uK: 4 }, this.TQ[0]);
      pass(this.P.blur, { uSrc: this.TQ[0], uDir: [1, 0] }, this.TQ[1]);
      pass(this.P.blur, { uSrc: this.TQ[1], uDir: [0, 1] }, this.TQ[0]);
      pass(this.P.down, { uSrc: this.TQ[0], uK: 2 }, this.TE[0]);
      pass(this.P.blur, { uSrc: this.TE[0], uDir: [1, 0] }, this.TE[1]);
      pass(this.P.blur, { uSrc: this.TE[1], uDir: [0, 1] }, this.TE[0]);
      pass(this.P.comb, { uA: this.TQ[0], uB: this.TE[0], uWa: g[0] * 1.6, uWb: g[1] * 1.6 }, this.TQ[2]);
    } else this.clear(this.TQ[2]);
    lap('glow');
    // sharp lines (spear ticks, tips) join the picture after the glow: they are never haloed
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    raster('sharp');
    gl.disable(gl.BLEND);
    lap('sharp');
    const disk = post.disk, ring = post.ring;
    pass(this.P.post, {
      uLines: this.TL, uGlow: this.TQ[2], uBg: C.bg, uPearl: C.pearl, uInk: C.ink || [0.004, 0.005, 0.009],
      uExposure: post.exposure ?? 1.6, uVig: post.vignette ?? .35, uInvert: post.invert ? 1 : 0, uFade: post.fade ?? 1, uSoft: post.soft || 0,
      uDisk: disk ? [disk.x, disk.y, disk.r, 1] : [0, 0, 0, 0], uRing: ring ? [ring.r, ring.w, ring.i, 1] : [0, 0, 0, 0], uFlash: [post.flash || 0, 0, 0, 0],
    }, null);
    lap('post');
    return this.canvas;
  }
}

export function defaultsU(W, H) {
  return {
    uXf0: [1, 0, 0], uXf1: [0, 1, 0], uS: 1, uOff: [0, 0], uCam: [1.2 * W, 1, 2.6, 1.25], uZp: 1.6, uRot: [1, 0, 1, 0], uOver: 1, uPan: [0, 0], uC: [W / 2, H / 2],
    uPush: [W / 2, H / 2, 0, 500 * H / 1080], uWidth: H / 1080, uKickW: 0, uMinW: 0, uReveal: [0, 0, 0, 1], uReveal2: [0, 100],
    uT: 0, uLambda: 70, uPulse: .5, uKick: 0, uBright: 1, uFlat: 0, uEndFade: 10, uWhite: 0,
  };
}

const CTX = new Map();
export function lineGL(W, H) { const k = W + 'x' + H; if (!CTX.has(k)) CTX.set(k, new LineGL(W, H)); return CTX.get(k); }
