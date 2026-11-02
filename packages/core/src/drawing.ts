// Drawing: owns an SVG <g> and plays strokes in real time, like a pen.
// One shared requestAnimationFrame loop drives every drawing on the page.

import type { Pt } from './path';
import { rng } from './random';
import { DEFAULT_PEN, Stroke, type Pen } from './stroke';

export const SVGNS = 'http://www.w3.org/2000/svg';

export interface InkSettings {
  /** Global speed multiplier. */
  speed: number;
  /** 'together': everything in view sketches in at once; 'stagger': one after another. */
  reveal: 'together' | 'stagger';
  /** ms budget for the first sketch-in on page load. */
  loadDuration: number;
  /** ms budget for things that scroll into view later. */
  revealDuration: number;
  /** Draw instantly. Defaults to the user's prefers-reduced-motion setting. */
  reducedMotion: boolean;
}

const hasWindow = typeof window !== 'undefined';
export const settings: InkSettings = {
  speed: 1,
  reveal: 'together',
  loadDuration: 1400,
  revealDuration: 900,
  reducedMotion: hasWindow && typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
};

/** Minimum-jerk profile: how real hand movements accelerate and decelerate. */
export const minJerk = (t: number) => t * t * t * (10 - 15 * t + 6 * t * t);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

type Job = (now: number) => boolean | void;
const jobs = new Set<Job>();
let rafId = 0;
function tick(now: number) {
  for (const job of jobs) if (job(now) === false) jobs.delete(job);
  rafId = jobs.size ? requestAnimationFrame(tick) : 0;
}
/** Run `fn` every frame until it returns false. Returns a cancel function. */
export function schedule(fn: Job): () => void {
  jobs.add(fn);
  if (!rafId) rafId = requestAnimationFrame(tick);
  return () => { jobs.delete(fn); };
}

export function createSvg(className = 'ink-svg'): SVGSVGElement {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

export interface PlayOptions {
  /** Pen travel speed in px/s (before the global multiplier). */
  speed?: number;
  /** Pen-up travel speed, as a multiple of `speed`. */
  travel?: number;
  /** Pause between strokes, ms. */
  pause?: number;
  /** Use the wet-ink colour for fresh strokes. */
  wet?: boolean;
  /** Time budget (ms). The timeline is compressed to fit it, never stretched. */
  duration?: number;
  onProgress?: (p: number) => void;
}

interface Item { stroke: Stroke; el: SVGPathElement; delay: number; done: boolean }

export class Drawing {
  readonly g: SVGGElement;
  items: Item[] = [];
  private cancel: (() => void) | null = null;
  private resolvePlay: (() => void) | null = null;

  constructor(parent: Element, { className = '' } = {}) {
    this.g = document.createElementNS(SVGNS, 'g');
    if (className) this.g.setAttribute('class', className);
    parent.append(this.g);
  }

  /** Add a stroke; `pts` are in this drawing's coordinate space. */
  add(pts: Pt[], pen: Pen = DEFAULT_PEN, { seed = 1, cls = '', delay = 0 } = {}): Item | null {
    if (!pts || !pts.length) return null;
    const stroke = new Stroke(pts, pen, seed);
    const el = document.createElementNS(SVGNS, 'path');
    el.setAttribute('class', ('ink-stroke ' + cls).trim());
    this.g.append(el);
    const item = { stroke, el, delay, done: false };
    this.items.push(item);
    return item;
  }

  addMany(strokes: Pt[][], pen: Pen = DEFAULT_PEN, opts: { seed?: number; cls?: string } = {}) {
    const seed = opts.seed ?? 1;
    return strokes.map((pts, i) => this.add(pts, pen, { ...opts, seed: seed + i * 31 }));
  }

  /** Draw everything instantly. */
  instant(): Promise<void> {
    this.stop();
    for (const it of this.items) { it.el.setAttribute('d', it.stroke.d()); it.el.classList.remove('wet'); it.done = true; }
    return Promise.resolve();
  }

  /** Draw pending strokes in sequence. Resolves when finished (or stopped). */
  play({ speed = 600, travel = 2.5, pause = 40, wet = true, duration = 0, onProgress }: PlayOptions = {}): Promise<void> {
    this.stop();
    const pending = this.items.filter((it) => !it.done);
    if (!pending.length) return Promise.resolve();
    if (settings.reducedMotion) return this.instant();

    let t = 0;
    let last: Stroke | null = null;
    const r = rng(pending.length * 97 + 3);
    const timeline = pending.map((it) => {
      const st = it.stroke, v = speed * settings.speed * (st.pen.speed || 1) * (0.85 + r() * 0.3);
      if (last) {
        const p = st.pts[0], q = last.pts[last.pts.length - 1];
        t += (Math.hypot(p[0] - q[0], p[1] - q[1]) / (v * travel)) * 1000 + pause / settings.speed;
      }
      t += it.delay;
      // Short strokes still take a moment: the hand has to start and stop.
      const dur = Math.max(70 / settings.speed, (st.len / v) * 1000 * 1.35);
      const entry = { it, start: t, dur };
      t += dur;
      last = st;
      return entry;
    });
    let total = t;
    if (duration > 0 && total > duration) {
      const k = duration / total;
      for (const e of timeline) { e.start *= k; e.dur *= k; }
      total = duration;
    }

    return new Promise((resolve) => {
      let t0: number | null = null, idx = 0;
      this.resolvePlay = resolve;
      this.cancel = schedule((now) => {
        if (t0 === null) t0 = now;
        const el = now - t0;
        while (idx < timeline.length) {
          const e = timeline[idx];
          if (el < e.start) break;
          const f = clamp01((el - e.start) / e.dur), it = e.it;
          if (wet && !it.done && !it.el.classList.contains('wet')) it.el.classList.add('wet');
          it.el.setAttribute('d', it.stroke.d(it.stroke.len * minJerk(f)));
          if (f < 1) break;
          it.done = true;
          const node = it.el;
          setTimeout(() => node.classList.remove('wet'), 450); // let the wet ink dry
          idx++;
        }
        onProgress?.(Math.min(1, el / total));
        if (idx >= timeline.length) {
          this.cancel = null;
          this.resolvePlay = null;
          resolve();
          return false;
        }
      });
    });
  }

  stop() {
    this.cancel?.();
    this.cancel = null;
    const r = this.resolvePlay;
    this.resolvePlay = null;
    r?.();
  }

  clear() { this.stop(); this.items = []; this.g.replaceChildren(); }

  /** Lift the ink off (fade out), then clear. */
  fade(ms = 260): Promise<void> {
    this.stop();
    const g = this.g;
    g.style.transition = `opacity ${ms}ms ease`;
    g.style.opacity = '0';
    return new Promise((res) => setTimeout(() => { this.clear(); g.style.opacity = ''; g.style.transition = ''; res(); }, ms));
  }

  remove() { this.stop(); this.g.remove(); }
}
