// Real-time handwriting with single-line (plotter) fonts. Each glyph is a
// centreline, not an outline, so it can be written stroke by stroke with the
// nib model deciding the line weight.

import { createSvg, Drawing, SVGNS } from './drawing';
import { resample, samplePath, type Pt } from './path';
import { noise1, rng } from './random';
import { DEFAULT_PEN, humanize, smooth, type Pen } from './stroke';

/** A single-line font. Structurally identical to `InkHand` in @pen-ink/fonts. */
export interface InkHand {
  key: string;
  name: string;
  upm: number;
  ascent: number;
  descent: number;
  xh: number;
  cap: number;
  g: Record<string, [number, string]>;
  metrics?: string;
}

export type HandSource = InkHand | Promise<InkHand> | (() => Promise<InkHand>);

export interface TextOptions {
  size: number;
  /** Wrap width in px (Infinity = no wrapping). */
  width: number;
  /** Line height as a multiple of size. */
  lineHeight: number;
  tracking: number;
  seed: number;
  /** Messiness multiplier. */
  jitter: number;
  /** Shear (forward slant), e.g. 0.2. */
  slant: number;
  /** Pen width as a fraction of size. */
  weight: number;
  /** Writing speed multiplier. */
  speed: number;
  /** Padding around the text, px. */
  pad: number;
  /** Size the <svg> to fit the text. */
  autosize: boolean;
  /** Pin the first baseline to this y (px), e.g. to match a native input. */
  baseline?: number;
}

export interface GlyphPlacement { ch: string; i: number; x: number; y: number }
export interface TextLayout { glyphs: GlyphPlacement[]; width: number; height: number; lineHeight: number; sc: number }

const advance = (hand: InkHand, ch: string) => (hand.g[ch] || hand.g['?'] || [hand.upm * 0.5])[0];

/** Lay out text into glyph positions (word wrap on spaces, \n for breaks). */
export function layout(text: string, hand: InkHand, { size = 40, width = Infinity, lineHeight = 1.35, tracking = 0 }: Partial<TextOptions> = {}): TextLayout {
  const sc = size / hand.upm, lh = size * lineHeight;
  const glyphs: GlyphPlacement[] = [];
  let x = 0, y = 0, maxX = 0, idx = 0;
  text.split('\n').forEach((line, li) => {
    if (li > 0) { x = 0; y += lh; idx++; }
    for (const word of line.split(/( +)/)) {
      const ww = [...word].reduce((a, c) => a + advance(hand, c) * sc + tracking, 0);
      if (x > 0 && x + ww > width && word.trim()) { x = 0; y += lh; }
      for (const ch of word) { glyphs.push({ ch, i: idx++, x, y }); x += advance(hand, ch) * sc + tracking; }
      maxX = Math.max(maxX, x);
    }
  });
  return { glyphs, width: maxX, height: y + lh, lineHeight: lh, sc };
}

/** Width of a string in px at a size (no wrapping). */
export function measure(text: string, hand: InkHand, size: number): number {
  return [...text].reduce((a, c) => a + (advance(hand, c) * size) / hand.upm, 0);
}

/**
 * The text split into runs (a word plus the spaces after it, or a lone "\n") with the width
 * each takes in the ink. Joined, the runs are the original text. Used to lay real, selectable
 * text over the ink so a drag selection lines up with what's written.
 */
export function textRuns(text: string, hand: InkHand, size: number): { text: string; width: number }[] {
  const runs: { text: string; width: number }[] = [];
  for (const part of text.split(/(\n)/)) {
    if (part === '\n') { runs.push({ text: part, width: 0 }); continue; }
    for (const m of part.matchAll(/ +|[^ ]+ */g)) runs.push({ text: m[0], width: measure(m[0], hand, size) });
  }
  return runs;
}

const glyphCache = new Map<string, Pt[][]>();
function glyphSamples(hand: InkHand, ch: string): Pt[][] {
  const key = hand.key + '|' + ch;
  let g = glyphCache.get(key);
  if (!g) { const e = hand.g[ch]; g = e && e[1] ? samplePath(e[1], 6) : []; glyphCache.set(key, g); }
  return g;
}

/** A glyph's strokes in glyph-local px coordinates, humanised for its index. */
export function glyphStrokes(hand: InkHand, g: GlyphPlacement, o: Pick<TextOptions, 'size' | 'jitter' | 'slant' | 'seed'>): Pt[][] {
  const { size, jitter, slant, seed } = o, sc = size / hand.upm;
  const r = rng(seed * 7919 + g.i * 104729 + g.ch.charCodeAt(0));
  const k = 1 + (r() * 2 - 1) * 0.045 * jitter, rot = (r() * 2 - 1) * 0.04 * jitter;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  return glyphSamples(hand, g.ch).map((sub, si) => {
    let pts: Pt[] = sub.map(([px, py]) => {
      const x = px * sc * k + py * sc * slant, y = -py * sc * k;
      return [x * cr - y * sr, x * sr + y * cr];
    });
    pts = resample(pts, Math.max(1.2, size / 30));
    pts = humanize(pts, { wobble: size * 0.012 * jitter, wavelength: size * 0.9, tremor: size * 0.002, seed: seed + g.i * 13 + si });
    return smooth(pts, 1);
  });
}

function resolveHand(src: HandSource): Promise<InkHand> {
  return Promise.resolve(typeof src === 'function' ? src() : src);
}

const DEFAULTS: TextOptions = { size: 40, width: Infinity, lineHeight: 1.35, tracking: 0, seed: 1, jitter: 1, slant: 0, weight: 0.06, speed: 1, pad: 8, autosize: true };

interface Glyph { i: number; ch: string; drawing: Drawing; x: number; y: number }

/** Writes text into an SVG, stroke by stroke. Changing the text keeps the unchanged prefix. */
export class InkText {
  readonly svg: SVGSVGElement;
  readonly root: SVGGElement;
  o: TextOptions;
  pen: Pen;
  hand: InkHand | null = null;
  ready: Promise<InkHand>;
  text = '';
  glyphs: Glyph[] = [];
  box = { w: 0, h: 0 };
  private queue: Promise<unknown> = Promise.resolve();
  private drift: ((x: number) => number) | null = null;

  constructor(parent: Element, hand: HandSource, opts: Partial<TextOptions> & { pen?: Partial<Pen> } = {}) {
    this.o = { ...DEFAULTS, ...opts };
    this.pen = { ...DEFAULT_PEN, size: this.o.size * this.o.weight, ...(opts.pen || {}) };
    if (parent instanceof SVGElement) {
      // Writing into an existing SVG (or a group inside one): don't manage its size.
      this.svg = (parent instanceof SVGSVGElement ? parent : parent.ownerSVGElement) as SVGSVGElement;
      this.root = document.createElementNS(SVGNS, 'g');
      parent.append(this.root);
    } else {
      this.svg = createSvg('ink-text-svg');
      this.svg.setAttribute('width', '0');
      this.svg.setAttribute('height', '0');
      parent.append(this.svg);
      this.root = document.createElementNS(SVGNS, 'g');
      this.svg.append(this.root);
    }
    this.ready = resolveHand(hand).then((h) => (this.hand = h));
  }

  set(opts: Partial<TextOptions> & { pen?: Partial<Pen> }) {
    Object.assign(this.o, opts);
    this.pen = { ...this.pen, size: this.o.size * this.o.weight, ...(opts.pen || {}) };
    this.drift = null;
  }

  setHand(hand: HandSource) { this.ready = resolveHand(hand).then((h) => (this.hand = h)); }

  private place(gl: Glyph, g: GlyphPlacement, lay: TextLayout) {
    const nz = this.drift || (this.drift = noise1(this.o.seed + 3));
    const { size, jitter, pad } = this.o;
    const baseline = this.o.baseline ?? this.hand!.ascent * lay.sc * 0.92 + pad;
    const dy = nz(g.i * 0.31) * size * 0.03 * jitter + nz(g.y * 0.01 + g.i * 0.02) * size * 0.02 * jitter;
    gl.x = g.x + pad;
    gl.y = g.y + baseline + dy;
    gl.drawing.g.setAttribute('transform', `translate(${gl.x.toFixed(2)} ${gl.y.toFixed(2)})`);
  }

  private resize(lay: TextLayout) {
    if (!this.o.autosize) return;
    const { pad, size, width } = this.o;
    const w = Math.ceil((Number.isFinite(width) ? Math.max(width, lay.width) : lay.width) + pad * 2 + size * 0.3);
    const h = Math.ceil(lay.height + pad * 2 + size * 0.15);
    this.svg.setAttribute('width', String(w));
    this.svg.setAttribute('height', String(h));
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.box = { w, h };
  }

  /** Size the SVG for some text without drawing it, so layout doesn't jump. */
  async reserve(text: string) {
    const hand = await this.ready;
    this.resize(layout(text, hand, this.o));
  }

  /**
   * Change the text. The unchanged prefix stays; removed glyphs lift off; new ones are written.
   * `duration` is an optional time budget (ms) for the new glyphs — only ever compressed.
   */
  async setText(text: string, { animate = true, duration = 0 } = {}): Promise<void> {
    const hand = await this.ready;
    const old = this.text;
    let p = 0;
    while (p < old.length && p < text.length && old[p] === text[p]) p++;
    const keep: Glyph[] = [];
    for (const gl of this.glyphs) {
      if (gl.i < p) keep.push(gl);
      else if (animate) gl.drawing.fade(180).then(() => gl.drawing.remove());
      else gl.drawing.remove();
    }
    this.glyphs = keep;
    this.text = text;

    const lay = layout(text, hand, this.o);
    this.resize(lay);
    const fresh: Glyph[] = [];
    for (const g of lay.glyphs) {
      if (g.i < p) { const gl = this.glyphs.find((x) => x.i === g.i); if (gl) this.place(gl, g, lay); continue; }
      if (g.ch === ' ' || g.ch === '\n') continue;
      const drawing = new Drawing(this.root, { className: 'ink-glyph' });
      const gl: Glyph = { i: g.i, ch: g.ch, drawing, x: 0, y: 0 };
      this.place(gl, g, lay);
      drawing.addMany(glyphStrokes(hand, g, this.o), this.pen, { seed: this.o.seed + g.i * 17 });
      this.glyphs.push(gl);
      fresh.push(gl);
    }
    if (!animate) { fresh.forEach((gl) => gl.drawing.instant()); return; }
    const speed = this.o.size * 16 * this.o.speed;
    if (duration > 0) {
      // Budgeted: each glyph gets a slot on a fixed timeline (no per-glyph promise
      // hand-off). Slots are the glyph's natural time, compressed only if over budget.
      const natural = (gl: Glyph) => gl.drawing.items.reduce((a, it) => a + Math.max(70, (it.stroke.len / speed) * 1350) + 25, 40);
      const total = fresh.reduce((a, gl) => a + natural(gl), 0);
      const k = Math.min(1, duration / total);
      let t = 0;
      const jobs = fresh.map((gl) => {
        const slice = natural(gl) * k, at = t;
        t += slice;
        return new Promise<void>((res) => setTimeout(() => (gl.drawing.g.isConnected ? gl.drawing.play({ speed, pause: 25, travel: 3, duration: slice }) : Promise.resolve()).then(res), at));
      });
      this.queue = this.queue.then(() => Promise.all(jobs));
      await this.queue;
      return;
    }
    for (const gl of fresh) this.queue = this.queue.then(() => (gl.drawing.g.isConnected ? gl.drawing.play({ speed, pause: 25, travel: 3 }) : null));
    await this.queue;
  }

  /** Redraw everything from scratch. */
  write(text = this.text, opts?: { animate?: boolean; duration?: number }) { this.clear(); return this.setText(text, opts); }

  clear() {
    this.glyphs.forEach((gl) => gl.drawing.remove());
    this.glyphs = [];
    this.text = '';
    this.queue = Promise.resolve();
  }

  destroy() { this.clear(); this.root.remove(); if (this.svg.parentNode && this.svg.classList.contains('ink-text-svg')) this.svg.remove(); }
}

/** Glyph centrelines in absolute px coordinates (for effects like outline lettering). */
export async function textStrokes(text: string, hand: HandSource, opts: Partial<TextOptions> = {}) {
  const h = await resolveHand(hand);
  const o = { ...DEFAULTS, ...opts };
  const lay = layout(text, h, o);
  const nz = noise1(o.seed + 3);
  const baseline = o.baseline ?? h.ascent * lay.sc * 0.92 + o.pad;
  const strokes: Pt[][] = [];
  for (const g of lay.glyphs) {
    if (g.ch === ' ') continue;
    const dy = nz(g.i * 0.31) * o.size * 0.03 * o.jitter + nz(g.y * 0.01 + g.i * 0.02) * o.size * 0.02 * o.jitter;
    const gx = g.x + o.pad, gy = g.y + baseline + dy;
    strokes.push(...glyphStrokes(h, g, o).map((pts) => pts.map(([x, y]): Pt => [x + gx, y + gy])));
  }
  return { strokes, width: lay.width + o.pad * 2, height: lay.height + o.pad * 2 };
}
