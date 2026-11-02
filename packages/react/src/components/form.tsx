import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type RefObject, type TextareaHTMLAttributes } from 'react';
import { InkText, settings, shapes as S, type After, type DrawingItem, type Pt } from '@pen-ink/core';
import { HostContext, useInk } from '../context';
import { useInkLayer, type InkLayer } from '../useInkLayer';
import { Write } from '../Write';

type Ordering = { after?: After | RefObject<Element | null>; delay?: number; duration?: number };
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');
const writeText = (children: ReactNode) => (typeof children === 'string' || typeof children === 'number' ? <Write>{children}</Write> : children);

/* ---------- Checkbox & radio ---------- */

export interface InkCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>, Ordering {
  children?: ReactNode;
  /** Tick in accent ink. */
  accent?: boolean;
}

function useCheckable(type: 'checkbox' | 'radio', props: InkCheckboxProps, fwd: React.ForwardedRef<HTMLInputElement>) {
  const { className, children, accent, after, delay, duration, onChange, ...rest } = props;
  const hostRef = useRef<HTMLLabelElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLSpanElement>(null);
  useImperativeHandle(fwd, () => inputRef.current!);

  const mark = useCallback((ink: InkLayer, animate: boolean, duration = 0) => {
    const input = inputRef.current!, b = ink.boxOf(boxRef.current);
    if (!input.checked) return ink.erase('mark', 180);
    if (type === 'radio') {
      const pad = b.w * 0.27;
      return ink.paint('mark', S.scribbleFill({ type: 'ellipse', cx: b.x + b.w / 2, cy: b.y + b.h / 2, rx: b.w / 2 - pad, ry: b.h / 2 - pad }, { seed: ink.seed + ((Math.random() * 99) | 0), gap: 2.2, angle: -0.9 }), { animate, duration, speed: 900, pen: { size: 2.4 } });
    }
    return ink.paint('mark', S.check(b.x + b.w * 0.05, b.y + b.h * 0.05, b.w * 0.95, { seed: ink.seed + ((Math.random() * 99) | 0) }), { animate, duration, speed: 500, cls: accent ? 'ink-accent' : '', pen: { nib: 'dip', size: ink.pen.size * 1.5 } });
  }, [type, accent]);

  const { svgRef, ink, isDrawn } = useInkLayer(hostRef, {
    after, delay, duration, seedKey: type,
    async draw(ink, { animate, duration }) {
      const b = ink.boxOf(boxRef.current);
      const shape = type === 'radio'
        ? S.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, { seed: ink.seed, wobble: ink.pen.wobble * 0.6, turns: 1.05 })
        : S.rect(b.x, b.y, b.w, b.h, { seed: ink.seed, wobble: ink.pen.wobble * 0.6, radius: 2, overshoot: 2 });
      const p = ink.paint('outline', shape, { animate, duration: duration * 0.6 });
      if (animate) await p;
      return mark(ink, animate, duration * 0.4);
    },
  });

  const sync = useCallback(() => { const i = ink(); if (i && isDrawn()) mark(i, true); }, [ink, isDrawn, mark]);
  // Controlled: follow the prop. Radios: also follow siblings in the group.
  useEffect(() => { sync(); }, [rest.checked]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (type !== 'radio') return;
    const onAny = (e: Event) => { const t = e.target as HTMLInputElement; if (t !== inputRef.current && t.type === 'radio' && t.name && t.name === inputRef.current?.name) sync(); };
    document.addEventListener('change', onAny);
    return () => document.removeEventListener('change', onAny);
  }, [type, sync]);

  return (
    <HostContext.Provider value={hostRef}>
      <label ref={hostRef} className={cx('ink-check ink-host', className)}>
        <svg ref={svgRef} className="ink-layer" aria-hidden="true" />
        <input
          ref={inputRef} type={type} {...rest}
          onChange={(e) => { onChange?.(e); if (rest.checked === undefined) sync(); }}
          onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) { const i = ink(); if (i) { const b = i.boxOf(boxRef.current); i.paint('focus', S.circleAround(b.x, b.y, b.w, b.h, { seed: i.seed + 5 }), { cls: 'ink-accent', speed: 900 }); } } rest.onFocus?.(e); }}
          onBlur={(e) => { ink()?.erase('focus', 160); rest.onBlur?.(e); }}
        />
        <span ref={boxRef} className="ink-box" />
        {writeText(children)}
      </label>
    </HostContext.Provider>
  );
}

export const InkCheckbox = forwardRef<HTMLInputElement, InkCheckboxProps>(function InkCheckbox(props, fwd) { return useCheckable('checkbox', props, fwd); });
export const InkRadio = forwardRef<HTMLInputElement, InkCheckboxProps>(function InkRadio(props, fwd) { return useCheckable('radio', props, fwd); });

/* ---------- Switch ---------- */

export const InkSwitch = forwardRef<HTMLInputElement, InkCheckboxProps>(function InkSwitch({ className, children, after, delay, duration, onChange, ...rest }, fwd) {
  const hostRef = useRef<HTMLLabelElement>(null), inputRef = useRef<HTMLInputElement>(null), trackRef = useRef<HTMLSpanElement>(null);
  useImperativeHandle(fwd, () => inputRef.current!);
  const knob = useCallback((ink: InkLayer, animate: boolean, duration = 0) => {
    const on = inputRef.current!.checked, b = ink.boxOf(trackRef.current);
    const r = b.h / 2 - 4, cx0 = on ? b.x + b.w - r - 4 : b.x + r + 4, cy = b.y + b.h / 2;
    const strokes = [...S.ellipse(cx0, cy, r, r, { seed: ink.seed + (on ? 7 : 3), turns: 1.1 })];
    if (on) strokes.push(...S.scribbleFill({ type: 'ellipse', cx: cx0, cy, rx: r - 2, ry: r - 2 }, { seed: ink.seed, gap: 2.4 }));
    return ink.paint('knob', strokes, { animate, duration, speed: 900 });
  }, []);
  const { svgRef, ink, isDrawn } = useInkLayer(hostRef, {
    after, delay, duration, seedKey: 'switch',
    async draw(ink, { animate, duration }) {
      const b = ink.boxOf(trackRef.current);
      const p = ink.paint('outline', S.pill(b.x, b.y, b.w, b.h, { seed: ink.seed, wobble: ink.pen.wobble * 0.6 }), { animate, duration: duration * 0.6 });
      if (animate) await p;
      return knob(ink, animate, duration * 0.4);
    },
  });
  const sync = () => { const i = ink(); if (i && isDrawn()) knob(i, true); };
  useEffect(sync, [rest.checked]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <HostContext.Provider value={hostRef}>
      <label ref={hostRef} className={cx('ink-switch ink-host', className)}>
        <svg ref={svgRef} className="ink-layer" aria-hidden="true" />
        <input ref={inputRef} type="checkbox" role="switch" {...rest} onChange={(e) => { onChange?.(e); if (rest.checked === undefined) sync(); }} />
        <span ref={trackRef} className="ink-track" />
        {writeText(children)}
      </label>
    </HostContext.Provider>
  );
});

/* ---------- Slider ---------- */

export interface InkSliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>, Ordering {}

export const InkSlider = forwardRef<HTMLInputElement, InkSliderProps>(function InkSlider({ className, after, delay, duration, onInput, min = 0, max = 100, ...rest }, fwd) {
  const hostRef = useRef<HTMLDivElement>(null), inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(fwd, () => inputRef.current!);
  const fill = useCallback((ink: InkLayer, animate: boolean, duration = 0) => {
    const input = inputRef.current!;
    const f = (Number(input.value) - Number(min)) / (Number(max) - Number(min) || 1);
    const y = ink.h / 2, x = f * (ink.w - 20) + 10;
    ink.paint('fill', S.scribbleFill({ type: 'rect', x: 2, y: y - 4, w: Math.max(2, x - 10), h: 8 }, { seed: ink.seed + 2, gap: 2.6, angle: -1.2 }), { animate, duration, speed: 2000, pen: { size: 1.4 } });
    return ink.paint('knob', S.ellipse(x, y, 9, 9, { seed: ink.seed + Math.round(f * 20), turns: 1.15 }), { animate, duration, speed: 700 });
  }, [min, max]);
  const { svgRef, ink, isDrawn } = useInkLayer(hostRef, {
    after, delay, duration, seedKey: 'slider',
    async draw(ink, { animate, duration }) {
      const p = ink.paint('outline', S.line(0, ink.h / 2, ink.w, ink.h / 2, { seed: ink.seed, wobble: ink.pen.wobble * 0.6 }), { animate, duration: duration * 0.5 });
      if (animate) await p;
      return fill(ink, animate, duration * 0.5);
    },
  });
  const sync = () => { const i = ink(); if (i && isDrawn()) fill(i, false); };
  useEffect(sync, [rest.value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={hostRef} className={cx('ink-slider ink-host', className)}>
      <svg ref={svgRef} className="ink-layer" aria-hidden="true" />
      <input ref={inputRef} type="range" min={min} max={max} {...rest} onInput={(e) => { onInput?.(e); sync(); }} />
    </div>
  );
});

/* ---------- Progress ---------- */

export interface InkProgressProps extends React.HTMLAttributes<HTMLDivElement>, Ordering {
  /** 0..1 */
  value: number;
  label?: string;
}

export function InkProgress({ value, label, className, after, delay, duration, style, ...rest }: InkProgressProps) {
  const ref = useRef<HTMLDivElement>(null);
  const v = Math.max(0, Math.min(1, value));
  // The fill is a stack of hatch strokes, left to right. The value sets a *goal* (how many strokes
  // should be showing); a single ticker moves toward it one stroke at a time, drawing the next one
  // or lifting the last one off. Changing the value mid-way just moves the goal: the ticker turns
  // round or carries on, and nothing already on the page is redrawn.
  const hatchRef = useRef<{ key: string; strokes: Pt[][] } | null>(null);
  const shownRef = useRef<DrawingItem[]>([]);
  const goalRef = useRef(0);
  const genRef = useRef(0); // bumped by a full redraw, which stops any running ticker
  const tickingRef = useRef(false);
  const vRef = useRef(v);
  vRef.current = v;

  const hatchFor = (ink: InkLayer) => {
    const key = `${ink.w}x${ink.h}:${ink.seed}`;
    if (hatchRef.current?.key !== key) {
      const mid = (pts: Pt[]) => pts.reduce((a, p) => a + p[0], 0) / pts.length;
      const strokes = S.hatch({ type: 'rect', x: 3, y: 3, w: Math.max(0, ink.w - 6), h: Math.max(0, ink.h - 6) }, { seed: ink.seed, gap: 4, angle: -1.1, inset: 0.5 })
        .sort((a, b) => mid(a) - mid(b));
      hatchRef.current = { key, strokes };
    }
    return hatchRef.current.strokes;
  };
  /** How many strokes (from the left) a value shows. */
  const goalFor = (ink: InkLayer, value: number) => {
    const strokes = hatchFor(ink);
    if (value >= 1) return strokes.length;
    const edge = 3 + (ink.w - 6) * value;
    let n = 0;
    while (n < strokes.length && strokes[n].reduce((a, p) => a + p[0], 0) / strokes[n].length <= edge) n++;
    return n;
  };
  const addStroke = (ink: InkLayer, i: number) =>
    ink.layer('fill').add(hatchFor(ink)[i], { ...ink.pen, size: ink.pen.size * 0.8 }, { seed: ink.seed + i * 31 });

  /** Step toward the goal until it's met. Only one ticker runs at a time. */
  const tick = async (ink: InkLayer) => {
    if (tickingRef.current) return;
    tickingRef.current = true;
    const gen = genRef.current, d = ink.layer('fill'), shown = shownRef.current;
    try {
      while (gen === genRef.current) {
        const n = shown.length, goal = goalRef.current;
        if (n === goal) break;
        if (n < goal) {
          const item = addStroke(ink, n);
          if (!item) break;
          shown.push(item);
          await d.play({ speed: 1600, pause: 0 }); // plays just the new stroke
        } else {
          const item = shown.pop()!;
          d.lift([item], 160); // fade it out, but move on to the next one sooner
          await new Promise((r) => setTimeout(r, settings.reducedMotion ? 0 : 35));
        }
      }
    } finally {
      tickingRef.current = false;
    }
  };

  const { svgRef, ink, isDrawn } = useInkLayer(ref, {
    after, delay, duration, seedKey: 'progress',
    async draw(ink, { animate, duration }) {
      // A full (re)draw starts the fill from scratch and stops any ticker.
      genRef.current++;
      const d = ink.layer('fill');
      d.clear();
      shownRef.current = [];
      const p = ink.paint('outline', S.rect(0, 0, ink.w, ink.h, { seed: ink.seed, wobble: ink.pen.wobble * 0.7, radius: 3, overshoot: 3 }), { animate, duration: duration * 0.55 });
      if (animate) await p;
      // The first sketch-in draws up to the goal together, inside the load budget.
      const goal = goalRef.current = goalFor(ink, vRef.current);
      for (let i = 0; i < goal; i++) { const item = addStroke(ink, i); if (item) shownRef.current.push(item); }
      await (animate ? d.play({ speed: 1600, duration: duration * 0.45 }) : d.instant());
      // The value may have moved while that was drawing: carry on toward it.
      goalRef.current = goalFor(ink, vRef.current);
      void tick(ink);
    },
  });
  useEffect(() => {
    const i = ink();
    if (!i || !isDrawn()) return;
    goalRef.current = goalFor(i, v);
    void tick(i);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} className={cx('ink-progress ink-host', className)} style={{ height: 26, ...style }} {...rest}>
      <svg ref={svgRef} className="ink-layer" aria-hidden="true" />
    </div>
  );
}

/* ---------- Tabs ---------- */

export interface InkTabsProps extends Ordering {
  items: { value: string; label: ReactNode; controls?: string }[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  'aria-label'?: string;
}

/** A tablist with a hand-drawn underline that's redrawn under the selected tab. Render panels yourself. */
export function InkTabs({ items, value, onValueChange, className, after, delay, duration, ...aria }: InkTabsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mark = useCallback((ink: InkLayer, animate: boolean, duration = 0) => {
    const tab = ref.current?.querySelector('[role=tab][aria-selected=true]');
    if (!tab) return;
    const b = ink.boxOf(tab);
    return ink.paint('mark', S.underline(b.x + 6, b.y + b.h - 4, b.w - 12, { seed: ink.seed + ((Math.random() * 99) | 0), double: true }), { animate, duration, cls: 'ink-accent', speed: 1200 });
  }, []);
  const { svgRef, ink, isDrawn } = useInkLayer(ref, {
    after, delay, duration, seedKey: 'tabs',
    async draw(ink, { animate, duration }) {
      const p = ink.paint('outline', S.line(-6, ink.h, ink.w + 6, ink.h, { seed: ink.seed, wobble: ink.pen.wobble * 0.5 }), { animate, duration: duration * 0.6 });
      if (animate) await p;
      return mark(ink, animate, duration * 0.4);
    },
  });
  useEffect(() => { const i = ink(); if (i && isDrawn()) mark(i, true); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const onKey = (e: KeyboardEvent) => {
    const i = items.findIndex((t) => t.value === value);
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -2;
    if (n === -2) return;
    e.preventDefault();
    const next = items[(n + items.length) % items.length];
    onValueChange(next.value);
    (ref.current?.querySelector(`[data-value="${CSS.escape(next.value)}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <HostContext.Provider value={ref}>
      <div ref={ref} role="tablist" className={cx('ink-tabs ink-host', className)} onKeyDown={onKey} {...aria}>
        <svg ref={svgRef} className="ink-layer" aria-hidden="true" />
        {items.map((t) => (
          <button key={t.value} role="tab" type="button" data-value={t.value} aria-selected={t.value === value} aria-controls={t.controls} tabIndex={t.value === value ? 0 : -1} onClick={() => onValueChange(t.value)}>
            {writeText(t.label)}
          </button>
        ))}
      </div>
    </HostContext.Provider>
  );
}

/* ---------- Text fields (ink-written) ---------- */

const faces = new Map<string, Promise<FontFace | void>>();
function metricsFamily(key: string, dataUri?: string) {
  const family = `pen-ink-metrics-${key}`;
  if (dataUri && !faces.has(key) && typeof FontFace !== 'undefined') {
    const face = new FontFace(family, `url(${dataUri})`, { display: 'block' });
    document.fonts.add(face);
    faces.set(key, face.load().catch(() => undefined));
  }
  return `'${family}'`;
}

interface FieldOwnProps extends Ordering {
  /** Visible-to-screen-readers label (or use aria-labelledby). */
  label?: string;
  /** Underline (default) or a box. */
  boxed?: boolean;
  /** Draw the typed text in ink. Default true. */
  write?: boolean;
  /** Hand for the ink text (default: the provider's). */
  hand?: string;
}

function useField<E extends HTMLInputElement | HTMLTextAreaElement>(multi: boolean, props: FieldOwnProps & { value?: unknown; defaultValue?: unknown; className?: string; onFocus?: React.FocusEventHandler<E>; onBlur?: React.FocusEventHandler<E>; onInput?: React.FormEventHandler<E> }, fwd: React.ForwardedRef<E>) {
  const { label, boxed, write = true, hand, after, delay, duration, className, ...rest } = props;
  const { loadHand, defaultHand } = useInk();
  const hostRef = useRef<HTMLLabelElement>(null), fieldRef = useRef<E>(null), overlayRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<InkText | null>(null);
  const [family, setFamily] = useState<{ metrics: string; original: string } | undefined>();
  useImperativeHandle(fwd, () => fieldRef.current!);
  const handKey = hand ?? defaultHand;

  // Place the overlay on the field's content box and pin the ink baseline to the native one.
  const layoutWriter = useCallback(() => {
    const field = fieldRef.current, box = overlayRef.current, w = writerRef.current;
    if (!field || !box || !w || !w.hand) return;
    const cs = getComputedStyle(field);
    const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight), pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
    const size = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight) || size * 1.2;
    const cw = field.clientWidth - pl - pr, ch = field.clientHeight - pt - pb;
    Object.assign(box.style, { left: field.offsetLeft + field.clientLeft + pl + 'px', top: field.offsetTop + field.clientTop + pt + 'px', width: cw + 'px', height: ch + 'px' });
    const f = w.hand, em = (size * (f.ascent - f.descent)) / f.upm, asc = (size * f.ascent) / f.upm;
    w.set({ size, baseline: multi ? (lh - em) / 2 + asc : (ch - em) / 2 + asc, lineHeight: lh / size, width: multi ? cw : Infinity, pen: { size: size * 0.065 } });
  }, [multi]);

  const syncScroll = () => { const f = fieldRef.current, w = writerRef.current; if (f && w) w.root.setAttribute('transform', `translate(${-f.scrollLeft} ${-f.scrollTop})`); };
  const syncText = useCallback((animate = true) => {
    const f = fieldRef.current, w = writerRef.current;
    if (!f || !w) return;
    const v = f.value, old = w.text;
    let pre = 0;
    while (pre < old.length && pre < v.length && old[pre] === v[pre]) pre++;
    const fresh = v.length - pre;
    // Keep up with typing; a paste or mid-string edit rewrites the tail quickly.
    w.setText(v, { animate, duration: fresh <= 1 ? 150 : Math.min(700, 120 + fresh * 45) });
    requestAnimationFrame(syncScroll);
  }, []);

  useEffect(() => {
    if (!write || !overlayRef.current) return;
    const w = new InkText(overlayRef.current, loadHand(handKey), { size: 20, pad: 0, jitter: 0.55 });
    writerRef.current = w;
    w.ready.then((h) => {
      // Remember the field's own font for the placeholder before switching to the invisible metrics font.
      const original = fieldRef.current ? getComputedStyle(fieldRef.current).fontFamily : 'inherit';
      setFamily({ metrics: metricsFamily(h.key, h.metrics), original });
      layoutWriter();
    });
    return () => { w.destroy(); writerRef.current = null; };
  }, [write, handKey, loadHand, layoutWriter]);

  // Controlled: follow the value prop. (Uncontrolled typing is handled in onInput.)
  useEffect(() => { if (writerRef.current?.hand && fieldRef.current && writerRef.current.text !== fieldRef.current.value) syncText(); }, [rest.value, syncText]);

  const { svgRef, ink } = useInkLayer(hostRef, {
    after, delay, duration, seedKey: 'field',
    async draw(ink, { animate, duration }) {
      const outline = boxed
        ? ink.paint('outline', S.rect(0, 0, ink.w, ink.h, { seed: ink.seed, wobble: ink.pen.wobble, radius: 3, overshoot: 2 }), { animate, duration })
        : ink.paint('outline', S.line(0, ink.h - 1, ink.w, ink.h - 1, { seed: ink.seed, wobble: ink.pen.wobble, overshoot: 4 }), { animate, duration });
      const w = writerRef.current;
      if (!w) return outline;
      await w.ready;
      layoutWriter();
      return Promise.all([outline, w.write(fieldRef.current?.value ?? '', { animate, duration })]);
    },
  });

  const fieldProps = {
    ref: fieldRef,
    'aria-label': label,
    className: write ? 'ink-written' : undefined,
    style: write && family ? ({ fontFamily: family.metrics, '--ink-placeholder-font': family.original } as React.CSSProperties) : undefined,
    onInput: (e: React.FormEvent<E>) => { rest.onInput?.(e); syncText(); },
    onScroll: syncScroll,
    onKeyUp: () => requestAnimationFrame(syncScroll),
    onSelect: () => requestAnimationFrame(syncScroll),
    onFocus: (e: React.FocusEvent<E>) => {
      rest.onFocus?.(e);
      const i = ink(); if (i) i.paint('focus', S.underline(4, i.h - 3, i.w - 8, { seed: i.seed + ((Math.random() * 50) | 0) }), { cls: 'ink-accent', speed: 1100 });
    },
    onBlur: (e: React.FocusEvent<E>) => { rest.onBlur?.(e); ink()?.erase('focus', 200); requestAnimationFrame(syncScroll); },
  };
  const shell = (field: ReactNode) => (
    <label ref={hostRef} className={cx('ink-field ink-host', className)} data-style={boxed ? 'box' : undefined}>
      <svg ref={svgRef} className="ink-layer" aria-hidden="true" />
      {field}
      {write && <div ref={overlayRef} className="ink-written-text" data-multi={multi ? '' : undefined} aria-hidden="true" />}
    </label>
  );
  return { rest, fieldProps, shell };
}

export interface InkInputProps extends InputHTMLAttributes<HTMLInputElement>, FieldOwnProps {}
export interface InkTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldOwnProps {}

/** A text input whose text is written in ink as you type. The native input still does all the editing. */
export const InkInput = forwardRef<HTMLInputElement, InkInputProps>(function InkInput(props, fwd) {
  // Only plain-text types are inked; passwords, numbers, dates etc. stay native.
  const write = props.write !== false && /^(text|search|email|url|tel)?$/.test(props.type ?? '');
  const { rest, fieldProps, shell } = useField<HTMLInputElement>(false, { ...props, write }, fwd);
  const { onInput: _i, onFocus: _f, onBlur: _b, ...native } = rest as InputHTMLAttributes<HTMLInputElement>;
  return shell(<input {...native} {...fieldProps} />);
});

/** A textarea whose text is written in ink as you type. */
export const InkTextarea = forwardRef<HTMLTextAreaElement, InkTextareaProps>(function InkTextarea(props, fwd) {
  const { rest, fieldProps, shell } = useField<HTMLTextAreaElement>(true, props, fwd);
  const { onInput: _i, onFocus: _f, onBlur: _b, ...native } = rest as TextareaHTMLAttributes<HTMLTextAreaElement>;
  return shell(<textarea {...native} {...fieldProps} />);
});
