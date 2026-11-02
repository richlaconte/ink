// Hand-drawn primitives. Every function returns strokes (each an array of
// [x, y] points the pen travels through), already humanised.
// Feed them to Drawing.addMany().

import { resample, type Pt } from './path';
import { rng } from './random';
import { humanize, smooth } from './stroke';

export type Strokes = Pt[][];
export type Shape =
  | { type: 'rect'; x: number; y: number; w: number; h: number }
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number };
interface Common { seed?: number; wobble?: number }

const TAU = Math.PI * 2;
const jit = (r: () => number, a: number) => (r() * 2 - 1) * a;

function finish(pts: Pt[], r: () => number, wobble: number, step = 2.5): Pt[] {
  const p = resample(pts, step);
  return smooth(humanize(p, { wobble: wobble, wavelength: 90 + r() * 60, tremor: 0.12 * Math.min(1, wobble), seed: (r() * 1e9) | 0 }), 1);
}

// Straight-ish line: slight bow, jittered ends, optional overshoot.
export function line(x1: number, y1: number, x2: number, y2: number, { seed = 1, wobble = 1, bow = 1, overshoot = 0 }: Common & { bow?: number; overshoot?: number } = {}): Strokes {
  const r = rng(seed);
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const o1 = overshoot * r(), o2 = overshoot * r();
  const a: Pt = [x1 - ux * o1 + jit(r, 0.8 * wobble), y1 - uy * o1 + jit(r, 0.8 * wobble)];
  const b: Pt = [x2 + ux * o2 + jit(r, 0.8 * wobble), y2 + uy * o2 + jit(r, 0.8 * wobble)];
  const bowAmt = jit(r, Math.min(6, len * 0.012) * bow * wobble);
  const pts: Pt[] = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = Math.sin(Math.PI * t) * bowAmt;
    pts.push([a[0] + (b[0] - a[0]) * t - uy * s, a[1] + (b[1] - a[1]) * t + ux * s]);
  }
  return [finish(pts, r, wobble)];
}

// Rectangle. style 'loop' = one continuous stroke (how people actually draw
// boxes quickly); 'sketch' = four separate overshooting lines.
export function rect(x: number, y: number, w: number, h: number, { seed = 1, wobble = 1, style = 'loop', radius = 3, overshoot = 6 }: Common & { style?: 'loop' | 'sketch'; radius?: number; overshoot?: number } = {}): Strokes {
  const r = rng(seed);
  if (style === 'sketch') {
    return [
      ...line(x, y, x + w, y, { seed: seed + 1, wobble, overshoot }),
      ...line(x + w, y, x + w, y + h, { seed: seed + 2, wobble, overshoot }),
      ...line(x + w, y + h, x, y + h, { seed: seed + 3, wobble, overshoot }),
      ...line(x, y + h, x, y, { seed: seed + 4, wobble, overshoot }),
    ];
  }
  const j = () => jit(r, 1.2 * wobble);
  const rad = () => Math.max(0.5, radius * (0.6 + r() * 0.8));
  const corners: Pt[] = [[x + j(), y + j()], [x + w + j(), y + j()], [x + w + j(), y + h + j()], [x + j(), y + h + j()]];
  // Start a little way along the top edge, go round, and overshoot the start.
  const startT = 0.08 + r() * 0.15;
  const pts: Pt[] = [];
  const start: Pt = [corners[0][0] + (corners[1][0] - corners[0][0]) * startT, corners[0][1] + (corners[1][1] - corners[0][1]) * startT];
  pts.push(start);
  for (let c = 1; c <= 4; c++) {
    const p = corners[c % 4], prev = corners[(c + 3) % 4], next = corners[(c + 1) % 4];
    const rr = rad();
    const din = Math.hypot(p[0] - prev[0], p[1] - prev[1]) || 1, dout = Math.hypot(next[0] - p[0], next[1] - p[1]) || 1;
    const a: Pt = [p[0] - ((p[0] - prev[0]) / din) * rr, p[1] - ((p[1] - prev[1]) / din) * rr];
    const b: Pt = [p[0] + ((next[0] - p[0]) / dout) * rr, p[1] + ((next[1] - p[1]) / dout) * rr];
    pts.push(a);
    for (let k = 1; k < 6; k++) {
      const t = k / 6, u = 1 - t; // quadratic corner
      pts.push([u * u * a[0] + 2 * u * t * p[0] + t * t * b[0], u * u * a[1] + 2 * u * t * p[1] + t * t * b[1]]);
    }
    pts.push(b);
  }
  // Overshoot: drift slightly off the start line.
  const over = Math.min(overshoot * 3, w * 0.25) * (0.5 + r());
  pts.push([start[0] + over, start[1] + jit(r, 1.6 * wobble) + 1.2 * wobble]);
  return [finish(pts, r, wobble)];
}

// Pill / rounded rectangle as one loop.
export function pill(x: number, y: number, w: number, h: number, { seed = 1, wobble = 1, radius = h / 2 }: Common & { radius?: number } = {}): Strokes {
  const r = rng(seed);
  const rad = Math.min(radius, h / 2, w / 2);
  const pts: Pt[] = [];
  const seg = (cx: number, cy: number, a0: number, a1: number) => { for (let i = 0; i <= 10; i++) { const a = a0 + ((a1 - a0) * i) / 10; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); } };
  pts.push([x + rad + w * 0.1, y]);
  seg(x + w - rad, y + rad, -Math.PI / 2, 0);
  seg(x + w - rad, y + h - rad, 0, Math.PI / 2);
  seg(x + rad, y + h - rad, Math.PI / 2, Math.PI);
  seg(x + rad, y + rad, Math.PI, Math.PI * 1.5);
  pts.push([x + rad + w * 0.1 + 6 + r() * 8, y + 1 + jit(r, 1)]);
  return [finish(pts, r, wobble)];
}

// Ellipse drawn as a slightly-too-long loop that doesn't quite close.
export function ellipse(cx: number, cy: number, rx: number, ry: number, { seed = 1, wobble = 1, turns = 1.08, tilt = 0 }: Common & { turns?: number; tilt?: number } = {}): Strokes {
  const r = rng(seed);
  const a0 = -Math.PI * (0.6 + r() * 0.3);
  const drift = 0.04 + r() * 0.04; // spiral drift so the ends don't meet
  const n = Math.ceil(64 * turns);
  const pts: Pt[] = [];
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + TAU * turns * t;
    const k = 1 + drift * (t - 0.5) + 0.02 * Math.sin(a * 2 + seed);
    const ex = Math.cos(a) * rx * k, ey = Math.sin(a) * ry * k;
    pts.push([cx + ex * ct - ey * st, cy + ex * st + ey * ct]);
  }
  return [finish(pts, r, wobble * 0.8)];
}

// The loop you draw around a word to highlight it.
export function circleAround(x: number, y: number, w: number, h: number, { seed = 1, wobble = 1 }: Common = {}): Strokes {
  const r = rng(seed);
  return ellipse(x + w / 2, y + h / 2, w / 2 + 10 + r() * 4, h / 2 + 7 + r() * 3, { seed, wobble, turns: 1.18 + r() * 0.12, tilt: jit(r, 0.05) });
}

// Chord of a line through a shape: returns [t0, t1] along direction (ux,uy) from origin, or null.
function chord(shape: Shape, ox: number, oy: number, ux: number, uy: number): [number, number] | null {
  if (shape.type === 'ellipse') {
    const { cx, cy, rx, ry } = shape;
    const px = (ox - cx) / rx, py = (oy - cy) / ry, dx = ux / rx, dy = uy / ry;
    const A = dx * dx + dy * dy, B = 2 * (px * dx + py * dy), C = px * px + py * py - 1;
    const disc = B * B - 4 * A * C;
    if (disc <= 0) return null;
    const sq = Math.sqrt(disc);
    return [(-B - sq) / (2 * A), (-B + sq) / (2 * A)];
  }
  const { x, y, w, h } = shape;
  let t0 = -Infinity, t1 = Infinity;
  for (const [o, u, lo, hi] of [[ox, ux, x, x + w], [oy, uy, y, y + h]] as const) {
    if (Math.abs(u) < 1e-9) { if (o < lo || o > hi) return null; continue; }
    let a = (lo - o) / u, b = (hi - o) / u;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
  }
  return t1 > t0 ? [t0, t1] : null;
}

function chords(shape: Shape, angle: number, gap: number, inset = 0): [Pt, Pt][] {
  const ux = Math.cos(angle), uy = Math.sin(angle), nx = -uy, ny = ux;
  const b = shape.type === 'ellipse'
    ? { x: shape.cx - shape.rx, y: shape.cy - shape.ry, w: shape.rx * 2, h: shape.ry * 2 }
    : shape;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.hypot(b.w, b.h) / 2;
  const out: [Pt, Pt][] = [];
  for (let c = -R + gap / 2; c <= R; c += gap) {
    const ox = cx + nx * c, oy = cy + ny * c;
    const ch = chord(shape, ox, oy, ux, uy);
    if (!ch || ch[1] - ch[0] < inset * 2 + 1) continue;
    out.push([[ox + ux * (ch[0] + inset), oy + uy * (ch[0] + inset)], [ox + ux * (ch[1] - inset), oy + uy * (ch[1] - inset)]]);
  }
  return out;
}

// Parallel hatching: separate quick strokes, each slightly off.
export function hatch(shape: Shape, { seed = 1, wobble = 1, angle = -Math.PI / 4, gap = 6, inset = 1.5, alternate = false }: Common & { angle?: number; gap?: number; inset?: number; alternate?: boolean } = {}): Strokes {
  const r = rng(seed);
  return chords(shape, angle, gap, inset).map(([a, b], i) => {
    const flip = alternate && i % 2;
    const s = flip ? b : a, e = flip ? a : b;
    const sh = r() * 2;
    return finish([[s[0] + jit(r, 1), s[1] + jit(r, 1)], [e[0] - sh + jit(r, 1), e[1] + jit(r, 1)]], r, wobble * 0.4, 3);
  });
}

// Zig-zag fill as one continuous stroke (marker / scribble fill).
export function scribbleFill(shape: Shape, { seed = 1, wobble = 1, angle = -1.1, gap = 5, inset = 0, overshoot = 1.5 }: Common & { angle?: number; gap?: number; inset?: number; overshoot?: number } = {}): Strokes {
  const r = rng(seed);
  const cs = chords(shape, angle, gap, inset);
  const pts: Pt[] = [];
  cs.forEach(([a, b], i) => {
    const [s, e] = i % 2 ? [b, a] : [a, b];
    const ux = e[0] - s[0], uy = e[1] - s[1], m = Math.hypot(ux, uy) || 1;
    const o = overshoot * (0.4 + r());
    pts.push([s[0] - (ux / m) * o, s[1] - (uy / m) * o]);
    pts.push([e[0] + (ux / m) * o, e[1] + (uy / m) * o]);
  });
  if (pts.length < 2) return [];
  return [finish(pts, r, wobble * 0.5, 2)];
}

// Hatch an arbitrary polygon (even-odd), e.g. the outline of a lettering stroke.
export function hatchPolygon(poly: Pt[], { seed = 1, wobble = 1, angle = -Math.PI / 4, gap = 5, inset = 1 }: Common & { angle?: number; gap?: number; inset?: number } = {}): Strokes {
  const r = rng(seed);
  const ux = Math.cos(angle), uy = Math.sin(angle), nx = -uy, ny = ux;
  let lo = Infinity, hi = -Infinity;
  for (const [x, y] of poly) { const c = x * nx + y * ny; lo = Math.min(lo, c); hi = Math.max(hi, c); }
  const out: Strokes = [];
  for (let c = lo + gap / 2; c < hi; c += gap) {
    const ox = nx * c, oy = ny * c, ts: number[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ca = a[0] * nx + a[1] * ny - c, cb = b[0] * nx + b[1] * ny - c;
      if ((ca < 0) === (cb < 0)) continue;
      const f = ca / (ca - cb);
      const px = a[0] + (b[0] - a[0]) * f, py = a[1] + (b[1] - a[1]) * f;
      ts.push((px - ox) * ux + (py - oy) * uy);
    }
    ts.sort((p, q) => p - q);
    for (let k = 0; k + 1 < ts.length; k += 2) {
      const t0 = ts[k] + inset, t1 = ts[k + 1] - inset;
      if (t1 - t0 < 1.5) continue;
      out.push(finish([[ox + ux * t0, oy + uy * t0], [ox + ux * (t1 - r()), oy + uy * (t1 - r())]], r, wobble * 0.25, 2));
    }
  }
  return out;
}

// Cross-hatching = two families of hatch.
export function crosshatch(shape: Shape, opts: Parameters<typeof hatch>[1] = {}): Strokes {
  const a = opts.angle ?? -Math.PI / 4;
  return [...hatch(shape, opts), ...hatch(shape, { ...opts, seed: (opts.seed || 1) + 50, angle: a + Math.PI / 2 })];
}

export function check(x: number, y: number, s: number, { seed = 1, wobble = 1 }: Common = {}): Strokes {
  const r = rng(seed);
  const pts: Pt[] = [
    [x + s * 0.08, y + s * (0.5 + jit(r, 0.05))],
    [x + s * 0.25, y + s * 0.68],
    [x + s * (0.38 + jit(r, 0.03)), y + s * 0.86],
    [x + s * 0.55, y + s * 0.55],
    [x + s * 0.75, y + s * 0.25],
    [x + s * (1.02 + jit(r, 0.05)), y - s * (0.05 + r() * 0.08)],
  ];
  return [finish(smooth(resample(pts, 2), 3), r, wobble * 0.5, 2)];
}

export function cross(x: number, y: number, s: number, opts: Common = {}): Strokes {
  return [...line(x, y, x + s, y + s, { ...opts, overshoot: 2 }), ...line(x + s, y, x, y + s, { ...opts, seed: (opts.seed || 1) + 9, overshoot: 2 })];
}

export function underline(x: number, y: number, w: number, { seed = 1, wobble = 1, wave = 0, double = false }: Common & { wave?: number; double?: boolean } = {}): Strokes {
  const r = rng(seed);
  const pts: Pt[] = [];
  const n = Math.max(8, Math.ceil(w / 6));
  const rise = jit(r, 2.5);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x - 3 + (w + 6) * t, y + rise * t + Math.sin(t * Math.PI * (w / 18)) * wave + Math.sin(t * Math.PI) * 1.5]);
  }
  const out = [finish(pts, r, wobble)];
  if (double) {
    const back: Pt[] = [];
    for (let i = n; i >= 0; i--) { const t = i / n; back.push([x + (w * 0.92) * t + 4, y + 4 + rise * t * 0.8 + jit(r, 0.4)]); }
    out.push(finish(back, r, wobble));
  }
  return out;
}

export function strike(x: number, y: number, w: number, opts: Common = {}): Strokes {
  const r = rng(opts.seed || 1);
  return line(x - 4, y + jit(r, 1.5), x + w + 4, y + jit(r, 2.5), { ...opts, bow: 0.5 });
}

// Scratch-out: dense loopy zig-zag over something you've "crossed out".
export function scratchOut(x: number, y: number, w: number, h: number, { seed = 1, wobble = 1 }: Common = {}): Strokes {
  const r = rng(seed);
  const pts: Pt[] = [];
  const n = Math.max(5, Math.round(w / 5));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x + w * t + jit(r, 2), i % 2 ? y + jit(r, 3) : y + h + jit(r, 3)]);
  }
  return [finish(smooth(resample(pts, 2), 2), r, wobble * 0.6, 2)];
}

export function arrow(x1: number, y1: number, x2: number, y2: number, { seed = 1, wobble = 1, curve = 0.2, head = 12 }: Common & { curve?: number; head?: number } = {}): Strokes {
  const r = rng(seed);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const cx = mx - dy * curve, cy = my + dx * curve;
  const pts: Pt[] = [];
  for (let i = 0; i <= 30; i++) { const t = i / 30, u = 1 - t; pts.push([u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2]); }
  const tx = x2 - cx, ty = y2 - cy, m = Math.hypot(tx, ty) || 1;
  const ax = tx / m, ay = ty / m;
  const h1: Pt = [x2 - ax * head - ay * head * 0.55, y2 - ay * head + ax * head * 0.55];
  const h2: Pt = [x2 - ax * head + ay * head * 0.55, y2 - ay * head - ax * head * 0.55];
  return [finish(pts, r, wobble), finish([h1, [x2, y2], h2], r, wobble * 0.3, 2)];
}

// A divider with a small loop flourish in the middle.
export function flourish(x: number, y: number, w: number, { seed = 1, wobble = 1 }: Common = {}): Strokes {
  const r = rng(seed);
  const pts: Pt[] = [];
  const mid = x + w / 2, loop = 7 + r() * 3;
  for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push([x + (mid - loop - x) * t, y + Math.sin(t * Math.PI) * -1.5]); }
  for (let i = 0; i <= 28; i++) { const a = Math.PI / 2 + (i / 28) * TAU; pts.push([mid + Math.cos(a) * loop * 0.9 - loop * 0.1 + (i / 28) * loop * 0.2, y - loop + Math.sin(a) * loop]); }
  for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push([mid + loop * 0.1 + (x + w - mid) * t, y + Math.sin(t * Math.PI) * 1.5]); }
  return [finish(pts, r, wobble)];
}

export function spiral(cx: number, cy: number, r0: number, r1: number, turns: number, { seed = 1, wobble = 1 }: Common = {}): Strokes {
  const r = rng(seed);
  const pts: Pt[] = [];
  const n = Math.ceil(turns * 60);
  for (let i = 0; i <= n; i++) { const t = i / n, a = t * TAU * turns, rad = r0 + (r1 - r0) * t; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); }
  return [finish(pts, r, wobble)];
}

// Arbitrary SVG path (e.g. an icon) as strokes, scaled into a box.
export function fromPath(samples: Pt[][], { x = 0, y = 0, scale = 1, seed = 1, wobble = 1 }: Common & { x?: number; y?: number; scale?: number } = {}): Strokes {
  const r = rng(seed);
  return samples.map((sub) => finish(sub.map(([px, py]) => [x + px * scale, y + py * scale]), r, wobble * 0.5, 1.6));
}
