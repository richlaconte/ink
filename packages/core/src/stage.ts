// InkStage: decides *when* things draw.
//  - Elements register a draw function; nothing draws until it's in view.
//  - Everything that comes into view together sketches in at once, inside a
//    shared time budget (the first batch is the page "load").
//  - `after: 'load' | element | '#id'` orders drawing after the load or another element.
//  - Subscribers (e.g. text write-in) hear when an element starts drawing.

import { settings as globalSettings, type InkSettings } from './drawing';

export type After = 'load' | Element | string | null | undefined;

export interface DrawInfo { animate: boolean; duration: number }

export interface StageEntry {
  el: Element;
  draw: (info: DrawInfo) => Promise<unknown> | void;
  after?: After;
  /** Extra pause before drawing, ms. */
  delay?: number;
  /** Override the time budget, ms. */
  duration?: number;
}

export interface StageHandle {
  readonly done: Promise<void>;
  redraw(animate?: boolean): Promise<void>;
  unregister(): void;
}

interface Rec extends StageEntry {
  started: DrawInfo | null;
  drawn: boolean;
  done: Promise<void>;
  resolveDone: () => void;
  listeners: Set<(info: DrawInfo) => void>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class InkStage {
  readonly settings: InkSettings;
  private recs = new Map<Element, Rec>();
  private queue: Rec[] = [];
  private io: IntersectionObserver | null = null;
  private first = true;
  private resolveLoad!: () => void;
  private loadDone: Promise<void>;
  private orphanListeners = new Map<Element, Set<(info: DrawInfo) => void>>();

  constructor(s: InkSettings = globalSettings) {
    this.settings = s;
    this.loadDone = new Promise((r) => (this.resolveLoad = r));
    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          this.io!.unobserve(e.target);
          const rec = this.recs.get(e.target);
          if (rec && !rec.started) this.queue.push(rec);
        }
        this.flush();
      }, { threshold: 0.15 });
    }
    // A page with nothing to draw still "loads".
    if (typeof window !== 'undefined') setTimeout(() => { if (this.first && !this.recs.size) { this.first = false; this.resolveLoad(); } }, 400);
  }

  register(entry: StageEntry): StageHandle {
    const existing = this.recs.get(entry.el);
    if (existing) this.recs.delete(entry.el);
    let resolveDone!: () => void;
    const done = new Promise<void>((r) => (resolveDone = r));
    const rec: Rec = { ...entry, started: null, drawn: false, done, resolveDone, listeners: this.orphanListeners.get(entry.el) || new Set() };
    this.orphanListeners.delete(entry.el);
    this.recs.set(entry.el, rec);
    if (this.io) this.io.observe(entry.el);
    else this.run(rec, false, 0); // no IntersectionObserver (SSR/tests): draw immediately
    return {
      done,
      redraw: (animate = true) => this.run(rec, animate, animate ? this.budget(rec, this.settings.revealDuration) : 0),
      unregister: () => { this.io?.unobserve(entry.el); if (this.recs.get(entry.el) === rec) this.recs.delete(entry.el); },
    };
  }

  /** Resolves after the page's initial sketch-in. */
  afterLoad(): Promise<void> { return this.loadDone; }

  /** Resolves when an element (or `#id`) has finished drawing. */
  whenDrawn(target: Element | string): Promise<void> {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    const rec = el && this.recs.get(el);
    return rec ? rec.done : this.loadDone;
  }

  /** Call `cb` when `el` starts drawing (immediately if it already has). Returns an unsubscribe. */
  onDraw(el: Element, cb: (info: DrawInfo) => void): () => void {
    const rec = this.recs.get(el);
    const set = rec ? rec.listeners : this.orphanListeners.get(el) || new Set();
    if (!rec) this.orphanListeners.set(el, set);
    set.add(cb);
    if (rec?.started) cb(rec.started);
    return () => set.delete(cb);
  }

  isStarted(el: Element) { return !!this.recs.get(el)?.started; }

  /**
   * Start a new "page" (e.g. after a client-side route change): the next batch
   * of elements to come into view uses the load budget and resolves afterLoad().
   */
  beginPage() {
    this.first = true;
    this.loadDone = new Promise((r) => (this.resolveLoad = r));
    setTimeout(() => { if (this.first) { this.first = false; this.resolveLoad(); } }, 400);
  }

  /** Replay everything as a fresh page load (dependencies included). */
  redrawAll() {
    this.loadDone = new Promise((r) => (this.resolveLoad = r));
    const all = [...this.recs.values()];
    for (const r of all) { r.started = null; r.drawn = false; r.done = new Promise((res) => (r.resolveDone = res)); }
    this.batch(all, true);
  }

  private budget(rec: Rec, base: number) { return (rec.duration ?? base) / this.settings.speed; }

  private flush() {
    if (!this.queue.length) return;
    const batch = this.queue.splice(0).sort((a, b) => {
      const ra = a.el.getBoundingClientRect(), rb = b.el.getBoundingClientRect();
      return ra.top - rb.top || ra.left - rb.left;
    });
    this.batch(batch, this.first);
    this.first = false;
  }

  private dependency(rec: Rec): Promise<void> | null {
    if (!rec.after) return null;
    if (rec.after === 'load') return this.loadDone;
    return this.whenDrawn(rec.after);
  }

  private batch(batch: Rec[], isLoad: boolean) {
    const s = this.settings, now: Rec[] = [], later: Rec[] = [];
    for (const r of batch) (this.dependency(r) ? later : now).push(r);
    const delay = (r: Rec) => (r.delay || 0) / s.speed;
    let jobs: Promise<void>[];
    if (s.reveal === 'stagger') {
      // One after another, like a single hand moving across the page.
      jobs = now.map((r, n) => sleep((n * 140) / s.speed + delay(r)).then(() => this.run(r, true, 0)));
    } else {
      // Everything sketches in at once inside a shared budget: the drawing *is* the loading.
      const base = isLoad ? s.loadDuration : s.revealDuration;
      jobs = now.map((r) => sleep(delay(r)).then(() => this.run(r, true, this.budget(r, base))));
    }
    if (isLoad) Promise.all(jobs).then(() => this.resolveLoad());
    for (const r of later) {
      this.dependency(r)!.then(() => sleep(delay(r))).then(() => this.run(r, true, s.reveal === 'stagger' ? 0 : this.budget(r, s.revealDuration)));
    }
  }

  private async run(rec: Rec, animate: boolean, duration: number) {
    if (this.settings.reducedMotion) { animate = false; duration = 0; }
    const info = { animate, duration };
    rec.started = info;
    rec.listeners.forEach((cb) => cb(info));
    await rec.draw(info);
    rec.drawn = true;
    rec.resolveDone();
  }
}

let defaultStage: InkStage | null = null;
/** A page-wide stage for non-React use. */
export function getStage(): InkStage { return (defaultStage ||= new InkStage()); }
