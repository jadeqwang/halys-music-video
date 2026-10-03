// glory.js: the GOLD sky (pure maths, no canvas): see glory() below.
import { clamp, lerp, sstep, fbm } from '../brush/util.js';

// Baroque glory (Tiepolo, Rubens; f6_gold): billowing cream cloud banks with rose-mauve undersides, gold rims where
// they face the low sun, opening around it; clear sky a pale verdigris-grey high, cream lower, gold at the horizon; a
// big painted halo. Returns (u, v, out) -> sRGB in frame uv.
// o: sun [u, v], aspect, horizon (v), t, open (radius of the opening), cover (higher = fewer clouds), seed, scale, halo,
// shift [du, dv] (the world's displacement in the lookup space: a tilting camera), warm, dark, open2
export function glory(o = {}) {
  const sx = o.sun ? o.sun[0] : .5, sy = o.sun ? o.sun[1] : .25, asp = o.aspect ?? 16 / 9, hy = o.horizon ?? .62, t = o.t ?? 0, seed = o.seed ?? 5;
  const open = o.open ?? .2, cover = o.cover ?? .56, drift = (o.drift ?? .006) * t, scale = o.scale ?? 1, halo = o.halo ?? 1;
  // o.open2 {u, v, r, k}: a second opening (the glory the sword rises into); o.dark (0..1): the Baroque value structure,
  // darker warm undersides and a falloff away from the light, so the opening glows by contrast
  const o2 = o.open2 && o.open2.k > 0 ? o.open2 : null, dk = o.dark ?? 0;
  // raw billow field (0..1): domain-warped fbm, big forms first; more cloud away from the sun (the opening)
  const raw = (u, v) => {
    const x = (u * asp + drift) * scale, y = v * scale * 1.15, w = fbm(x * 1.1 + 3.1, y * 2.1 + 1.7, seed + 3, 2) - .5;
    const c = fbm(x * 1.6 + w * 1.5, y * 2.9 + w * 1.1, seed, 5) * .9 + fbm(x * 4.6 + 9, y * 7.5 + 2, seed + 7, 3) * .18;
    const d = Math.hypot((u - sx) * asp, v - sy);
    let q = c + .12 * sstep(.2, 1.2, d) - .22 * (1 - sstep(open * .4, open * 1.4, d));
    if (o2) { const d2 = Math.hypot((u - o2.u) * asp, v - o2.v); q -= .25 * o2.k * (1 - sstep(o2.r * .35, o2.r * 1.3, d2)); }
    return q;
  };
  // (warm 0..1 pulls the cool high sky and the rose undersides toward gold: the sky the sword rises into)
  const wm = o.warm ?? 0, W3 = (a, b) => a.map((x, i) => x + (b[i] - x) * wm);
  const gapHi = W3([.6, .69, .72], [.93, .8, .6]), gapMid = W3([.95, .88, .74], [1, .87, .64]), gapLo = [1, .86, .6], hot = [1, .97, .88];
  const shade = W3([.64, .49, .52], [.8, .56, .4]), shadeLo = W3([.76, .54, .46], [.84, .56, .36]), lit = W3([1, .94, .84], [1, .93, .76]), rim = [1, .87, .56];
  const shu = o.shift ? o.shift[0] : 0, shv = o.shift ? o.shift[1] : 0;     // the world moved by the camera (uv)
  return (u0, v0, out) => {
    const u = u0 - shu, v = v0 - shv;
    const dx = (u - sx) * asp, dy = v - sy, d = Math.hypot(dx, dy) + 1e-4;
    const h = clamp((v - (hy - .8)) / .8), g = (Math.exp(-d / .055) * .8 + Math.exp(-d / .2) * .38) * halo;
    // clear sky
    let r = lerp(gapHi[0], gapMid[0], sstep(0, .7, h)), gg = lerp(gapHi[1], gapMid[1], sstep(0, .7, h)), b = lerp(gapHi[2], gapMid[2], sstep(0, .7, h));
    const lo = sstep(.55, 1, h); r = lerp(r, gapLo[0], lo); gg = lerp(gg, gapLo[1], lo); b = lerp(b, gapLo[2], lo);
    // clouds: coverage from the raw field; light from the density difference toward the sun (and from above)
    const c0 = raw(u, v), c = sstep(cover - .05, cover + .07, c0);
    if (c > .001) {
      const st = .045, lx = -dx / d * .8, ly = -dy / d * .8 - .45, ll = Math.hypot(lx, ly);
      const toward = raw(u + lx / ll * st / asp, v + ly / ll * st);
      const s = clamp(.62 - 4.2 * (toward - c0));                         // 1 = lit face, 0 = the shadowed underside
      const edge = 1 - sstep(cover + .02, cover + .16, c0);                // thin parts of a cloud near its edge
      const sh = [lerp(shade[0], shadeLo[0], h), lerp(shade[1], shadeLo[1], h), lerp(shade[2], shadeLo[2], h)];
      if (dk > 0) { sh[0] = lerp(sh[0], .5, dk * .6); sh[1] = lerp(sh[1], .34, dk * .6); sh[2] = lerp(sh[2], .27, dk * .6); }
      let cr = lerp(sh[0], lit[0], s), cg = lerp(sh[1], lit[1], s), cb = lerp(sh[2], lit[2], s);
      const rk = clamp(edge * s * 1.3) * (.5 + .5 * Math.exp(-d / .5));     // gold rims on the sunward edges
      cr = lerp(cr, rim[0], rk); cg = lerp(cg, rim[1], rk); cb = lerp(cb, rim[2], rk);
      r = lerp(r, cr, c); gg = lerp(gg, cg, c); b = lerp(b, cb, c);
    }
    // the painter's horizontal sky strokes (a faint streak texture, so the brushes run level across the clear sky)
    const sk = (fbm(u * asp * 1.2 + 40, v * 20, seed + 11, 3) - .5) * .06 * (1 - .6 * c);
    r += sk; gg += sk * .95; b += sk * .85;
    // haze toward the horizon, then the halo
    const hz = sstep(hy - .3, hy + .02, v) * .45;
    r = lerp(r, gapLo[0], hz); gg = lerp(gg, gapLo[1], hz); b = lerp(b, gapLo[2], hz);
    let gsum = g, ld = d;
    if (o2) { const d2 = Math.hypot((u - o2.u) * asp, v - o2.v); gsum += o2.k * (Math.exp(-d2 / (o2.r * .3)) * .55 + Math.exp(-d2 / o2.r) * .4); ld = Math.min(ld, d2 / Math.max(.2, o2.k)); }
    if (dk > 0) { const fall = sstep(.22, 1.1, ld) * dk; r *= 1 - .24 * fall; gg *= 1 - .32 * fall; b *= 1 - .44 * fall; }
    const gk = clamp(gsum); r = lerp(r, hot[0], gk); gg = lerp(gg, hot[1], gk); b = lerp(b, hot[2], gk);
    out[0] = r; out[1] = gg; out[2] = b; return out;
  };
}
