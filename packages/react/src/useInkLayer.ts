import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { DEFAULT_PEN, Drawing, hash, SVGNS, type After, type DrawInfo, type Pen, type Pt } from '@pen-ink/core';
import { useInk } from './context';

const PAD = 18; // the layer overhangs its host so strokes can overshoot
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface PaintOptions {
  pen?: Partial<Pen>;
  animate?: boolean;
  /** px/s */
  speed?: number;
  /** Time budget, ms (compress only). */
  duration?: number;
  /** Extra class on the layer group, e.g. 'ink-accent'. */
  cls?: string;
  seed?: number;
}

/** What a component's draw function gets. */
export interface InkLayer {
  /** Host size in px. */
  w: number;
  h: number;
  seed: number;
  pen: Pen;
  /** Replace a named layer's strokes and draw them. */
  paint(name: string, strokes: Pt[][], opts?: PaintOptions): Promise<void>;
  /** Lift a layer's ink off. */
  erase(name: string, ms?: number): Promise<void>;
  /** Position of a descendant relative to the host. */
  boxOf(el: Element | null): { x: number; y: number; w: number; h: number };
}

export interface UseInkLayerOptions {
  /** Draw (or redraw) the host's ink. `info.duration` is the time budget for this draw. */
  draw: (ink: InkLayer, info: DrawInfo & { boil?: boolean }) => Promise<unknown> | void;
  /** Draw after the page load ('load'), another element, or an element id ('#id'). */
  after?: After | RefObject<Element | null>;
  delay?: number;
  duration?: number;
  /** Re-roll the outline at ~8fps while hovered ("line boil"). */
  boil?: boolean;
  /** Stable seed (default: derived from `seedKey`). */
  seed?: number;
  seedKey?: string;
  pen?: Partial<Pen>;
}

let counter = 0;

/**
 * Give an element an ink layer. Render `<svg ref={svgRef} className="ink-layer" />`
 * inside the host (which needs `className="ink-host"`).
 */
export function useInkLayer<T extends HTMLElement = HTMLElement>(hostRef: RefObject<T | null>, opts: UseInkLayerOptions) {
  const { stage } = useInk();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const layers = useRef(new Map<string, Drawing>());
  const seedRef = useRef<number>(opts.seed ?? hash((opts.seedKey ?? '') + ':' + ++counter));
  const drawnRef = useRef(false);
  const handleRef = useRef<ReturnType<typeof stage.register> | null>(null);

  const layer = useCallback((name: string, cls = '') => {
    let d = layers.current.get(name);
    const svg = svgRef.current!;
    if (!d) {
      let root = svg.querySelector(':scope > g.ink-root') as SVGGElement | null;
      if (!root) { root = document.createElementNS(SVGNS, 'g'); root.setAttribute('class', 'ink-root'); root.setAttribute('transform', `translate(${PAD} ${PAD})`); svg.append(root); }
      d = new Drawing(root, { className: ('ink-l-' + name + ' ' + cls).trim() });
      layers.current.set(name, d);
    } else if (cls) d.g.setAttribute('class', ('ink-l-' + name + ' ' + cls).trim());
    return d;
  }, []);

  const makeInk = useCallback((): InkLayer => {
    const host = hostRef.current!;
    const pen: Pen = { ...DEFAULT_PEN, ...readCssPen(host), ...optsRef.current.pen };
    return {
      w: host.offsetWidth, h: host.offsetHeight, seed: seedRef.current, pen,
      paint(name, strokes, { pen: p, animate = true, speed = 1000, duration = 0, cls = '', seed } = {}) {
        const d = layer(name, cls);
        d.clear();
        d.addMany(strokes, { ...pen, ...p }, { seed: seed ?? seedRef.current });
        return animate ? d.play({ speed, duration }) : d.instant();
      },
      erase(name, ms = 200) { const d = layers.current.get(name); return d ? d.fade(ms) : Promise.resolve(); },
      boxOf(el) {
        if (!el) return { x: 0, y: 0, w: 0, h: 0 };
        const a = host.getBoundingClientRect(), b = el.getBoundingClientRect();
        return { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height };
      },
    };
  }, [hostRef, layer]);

  const run = useCallback((info: DrawInfo & { boil?: boolean }) => {
    if (!hostRef.current || !svgRef.current) return Promise.resolve();
    return Promise.resolve(optsRef.current.draw(makeInk(), info)).then(() => {
      if (!info.boil) { drawnRef.current = true; hostRef.current?.setAttribute('data-inked', ''); }
    });
  }, [hostRef, makeInk]);

  // Register with the stage: nothing draws until it's in view (and its `after` is met).
  useIsoLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const a = optsRef.current.after;
    const after: After = a && typeof a === 'object' && 'current' in a ? a.current : (a as After);
    const handle = stage.register({ el: host, draw: (info) => run(info), after, delay: opts.delay, duration: opts.duration });
    handleRef.current = handle;
    return () => { handle.unregister(); layers.current.forEach((d) => d.remove()); layers.current.clear(); drawnRef.current = false; };
  }, [stage, run]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw instantly when the host changes size.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    let w = host.offsetWidth, h = host.offsetHeight, t = 0;
    const ro = new ResizeObserver(() => {
      if (!drawnRef.current || (host.offsetWidth === w && host.offsetHeight === h)) return;
      w = host.offsetWidth; h = host.offsetHeight;
      clearTimeout(t);
      t = window.setTimeout(() => run({ animate: false, duration: 0 }), 60);
    });
    ro.observe(host);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [run, hostRef]);

  // Line boil: re-roll the drawing from a few seeds while hovered.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !opts.boil) return;
    let timer = 0, n = 0;
    const base = seedRef.current;
    const step = () => { n = (n + 1) % 3; seedRef.current = base + 1000 * (n + 1); run({ animate: false, duration: 0, boil: true }); seedRef.current = base; };
    const enter = () => { if (!drawnRef.current || stage.settings.reducedMotion) return; step(); timer = window.setInterval(step, 120); };
    const leave = () => { clearInterval(timer); if (drawnRef.current) run({ animate: false, duration: 0 }); };
    host.addEventListener('mouseenter', enter);
    host.addEventListener('mouseleave', leave);
    return () => { clearInterval(timer); host.removeEventListener('mouseenter', enter); host.removeEventListener('mouseleave', leave); };
  }, [opts.boil, run, hostRef, stage]);

  return {
    svgRef,
    /** Ink API outside of draw (e.g. reacting to state). Null until mounted. */
    ink: () => (hostRef.current && svgRef.current ? makeInk() : null),
    isDrawn: () => drawnRef.current,
    redraw: (animate = true) => handleRef.current?.redraw(animate),
  };
}

/** Pen settings from CSS custom properties: --ink-nib, --ink-pen-size, --ink-wobble. */
function readCssPen(el: Element): Partial<Pen> {
  const cs = getComputedStyle(el), out: Partial<Pen> = {};
  const nib = cs.getPropertyValue('--ink-nib').trim(), size = cs.getPropertyValue('--ink-pen-size').trim(), wob = cs.getPropertyValue('--ink-wobble').trim();
  if (nib) out.nib = nib as Pen['nib'];
  if (size) out.size = parseFloat(size);
  if (wob) out.wobble = parseFloat(wob);
  return out;
}
