// A stroke is a polyline (the path the pen tip travels) plus a width profile
// (how much ink the nib lays down at each point). Left/right edges are
// precomputed, so revealing a stroke progressively is just slicing two arrays.

import { arcLengths, type Pt } from './path';
import { noise1 } from './random';

export type NibKind = 'fine' | 'dip' | 'brush' | 'broad' | 'ball';

export interface Pen {
  nib: NibKind;
  /** Nominal line width, px. */
  size: number;
  /** Chisel (broad) nib angle, radians. */
  angle: number;
  /** Ramp-in / lift-off lengths, in multiples of size. */
  taperIn: number;
  taperOut: number;
  /** 0..1 width jitter along the stroke. */
  pressureNoise: number;
  /** Multiplier for shape/text humanising. */
  wobble: number;
  /** Multiplier on drawing speed. */
  speed: number;
}

export const DEFAULT_PEN: Pen = { nib: 'fine', size: 2.2, angle: -0.75, taperIn: 2.5, taperOut: 5, pressureNoise: 0.12, wobble: 1, speed: 1 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

interface NibContext { s: number; t: number; dx: number; dy: number; base: number; tin: number; tout: number }

/** Width functions: how each pen turns direction and position into ink. */
export const NIBS: Record<NibKind, (c: NibContext) => number> = {
  // Fineliner: near-constant, a small blob where the pen lands.
  fine: (c) => c.base * (0.78 + 0.22 * easeOut(c.tin)) * (0.6 + 0.4 * easeOut(c.tout)) * (1 + 0.25 * Math.max(0, 1 - c.s / (c.base * 1.2))),
  // Pointed dip pen: hairline upstrokes, swelling downstrokes.
  dip: (c) => c.base * (0.32 + 1.5 * Math.pow(Math.max(0, c.dy), 1.6) * Math.min(easeOut(c.tin), easeOut(c.tout))),
  // Brush pen: pressure peaks mid-stroke, tapers hard at both ends.
  brush: (c) => c.base * (0.12 + 1.2 * Math.pow(Math.sin(Math.PI * clamp01(c.t)), 0.55) * (0.75 + 0.35 * Math.max(0, c.dy))) * Math.min(1, 0.4 + c.tin) * Math.min(1, 0.3 + c.tout),
  // Chisel nib: handled with a fixed nib vector in Stroke; width is implicit.
  broad: () => 1,
  // Ballpoint: thin and uniform.
  ball: (c) => c.base * (0.85 + 0.15 * easeOut(c.tin)),
};

function tangentAt(pts: Pt[], i: number): Pt {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
  const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
  return [dx / m, dy / m];
}

/** Hand tremor + slow drift, perpendicular to the direction of travel. */
export function humanize(pts: Pt[], { wobble = 1, wavelength = 80, tremor = 0.12, seed = 1 } = {}): Pt[] {
  if (pts.length < 2 || (wobble === 0 && tremor === 0)) return pts;
  const slow = noise1(seed), fast = noise1(seed + 911), s = arcLengths(pts);
  return pts.map((p, i) => {
    const [tx, ty] = tangentAt(pts, i);
    const off = wobble * slow(s[i] / wavelength) + tremor * fast(s[i] / 3);
    return [p[0] - ty * off, p[1] + tx * off];
  });
}

/** [1 2 1] smoothing, keeping endpoints. */
export function smooth(pts: Pt[], passes = 1): Pt[] {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    const q: Pt[] = [p[0]];
    for (let i = 1; i < p.length - 1; i++) q.push([(p[i - 1][0] + 2 * p[i][0] + p[i + 1][0]) / 4, (p[i - 1][1] + 2 * p[i][1] + p[i + 1][1]) / 4]);
    if (p.length > 1) q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}

const f1 = (p: Pt) => p[0].toFixed(1) + ' ' + p[1].toFixed(1);

export class Stroke {
  readonly pts: Pt[];
  readonly s: Float32Array;
  readonly len: number;
  readonly pen: Pen;
  readonly L: Pt[];
  readonly R: Pt[];
  readonly w: Float32Array;

  constructor(pts: Pt[], pen: Pen = DEFAULT_PEN, seed = 1) {
    if (pts.length === 1) pts = [pts[0], [pts[0][0] + 0.01, pts[0][1] + 0.01]];
    this.pts = pts;
    this.s = arcLengths(pts);
    this.len = this.s[pts.length - 1];
    this.pen = pen;
    const n = pts.length, base = pen.size, nz = noise1(seed + 7);
    const nib = NIBS[pen.nib] || NIBS.fine;
    const broad = pen.nib === 'broad';
    const nx0 = Math.cos(pen.angle), ny0 = Math.sin(pen.angle);
    this.L = new Array(n);
    this.R = new Array(n);
    this.w = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const [tx, ty] = tangentAt(pts, i), s = this.s[i], [x, y] = pts[i];
      const c: NibContext = {
        s, t: this.len ? s / this.len : 0, dx: tx, dy: ty, base,
        tin: clamp01(s / (base * pen.taperIn)), tout: clamp01((this.len - s) / (base * pen.taperOut)),
      };
      const jitter = 1 + pen.pressureNoise * nz(s / (base * 5 + 4));
      if (broad) {
        // A chisel nib is a fixed segment dragged along the path.
        const hw = (base / 2) * jitter * (0.85 + 0.15 * Math.min(c.tin, c.tout));
        this.L[i] = [x + nx0 * hw, y + ny0 * hw];
        this.R[i] = [x - nx0 * hw, y - ny0 * hw];
        this.w[i] = base;
      } else {
        const w = Math.max(0.35, nib(c) * jitter), hw = w / 2;
        this.w[i] = w;
        this.L[i] = [x - ty * hw, y + tx * hw];
        this.R[i] = [x + ty * hw, y - tx * hw];
      }
    }
  }

  /** SVG path data for the stroke drawn up to arc length `upto` (a filled outline with a round tip). */
  d(upto = this.len): string {
    const { s, L, R, pts, w } = this, n = pts.length;
    if (upto <= 0) return '';
    let k = n - 1;
    let tip: { L: Pt; R: Pt; w: number } | null = null;
    if (upto < this.len) {
      let lo = 0, hi = n - 1;
      while (lo < hi - 1) { const m = (lo + hi) >> 1; if (s[m] <= upto) lo = m; else hi = m; }
      k = lo;
      const f = (upto - s[lo]) / (s[hi] - s[lo] || 1);
      const lerp = (a: Pt, b: Pt): Pt => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      tip = { L: lerp(L[lo], L[hi]), R: lerp(R[lo], R[hi]), w: w[lo] + (w[hi] - w[lo]) * f };
    }
    const broad = this.pen.nib === 'broad';
    let out = 'M' + f1(L[0]);
    for (let i = 1; i <= k; i++) out += 'L' + f1(L[i]);
    const endL = tip ? tip.L : L[k], endR = tip ? tip.R : R[k], endW = (tip ? tip.w : w[k]) / 2;
    if (tip) out += 'L' + f1(endL);
    out += broad ? 'L' + f1(endR) : `A${endW.toFixed(2)} ${endW.toFixed(2)} 0 0 0 ${f1(endR)}`;
    for (let i = k; i >= 0; i--) out += 'L' + f1(R[i]);
    const w0 = w[0] / 2;
    out += broad ? 'Z' : `A${w0.toFixed(2)} ${w0.toFixed(2)} 0 0 0 ${f1(L[0])}Z`;
    return out;
  }
}
