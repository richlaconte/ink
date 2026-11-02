import { forwardRef, useEffect, useImperativeHandle, useRef, type ButtonHTMLAttributes, type ElementType, type HTMLAttributes, type ReactNode, type RefObject } from 'react';
import { ICONS, samplePath, shapes as S, type After, type IconName } from '@pen-ink/core';
import { HostContext } from '../context';
import { useInkLayer, type InkLayer } from '../useInkLayer';
import { Write } from '../Write';

type Ordering = { after?: After | RefObject<Element | null>; delay?: number; duration?: number };
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');
/** Plain-text children are written in; anything else renders as-is. */
const writeText = (children: ReactNode) => (typeof children === 'string' || typeof children === 'number' ? <Write>{children}</Write> : children);

function focusLoop(ink: InkLayer) {
  return ink.paint('focus', S.circleAround(0, 0, ink.w, ink.h, { seed: ink.seed + 99 }), { cls: 'ink-accent', speed: 900, pen: { size: Math.max(1.6, ink.pen.size * 0.9) } });
}

/* ---------- Button ---------- */

export interface InkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Ordering {
  /** outline (default) · solid (marker fill) · accent (marker fill in accent ink) · ghost (underline only) */
  variant?: 'outline' | 'solid' | 'accent' | 'ghost';
  /** Line boil on hover. Default true. */
  boil?: boolean;
}

export const InkButton = forwardRef<HTMLButtonElement, InkButtonProps>(function InkButton(
  { variant = 'outline', boil = true, className, children, after, delay, duration, onFocus, onBlur, ...rest }, fwd) {
  const ref = useRef<HTMLButtonElement>(null);
  useImperativeHandle(fwd, () => ref.current!);
  const { svgRef, ink } = useInkLayer(ref, {
    after, delay, duration, boil, seedKey: 'button' + variant,
    async draw(ink, { animate, duration }) {
      const { w, h } = ink;
      const part = (f: number) => (duration ? duration * f : 0);
      if (variant === 'solid' || variant === 'accent') {
        // One continuous zig-zag with a wide nib: a flat "marker" fill with solid label contrast.
        const gap = 4.2;
        const fill = S.scribbleFill({ type: 'rect', x: 3, y: 3, w: w - 6, h: h - 6 }, { seed: ink.seed + 1, gap, angle: -1.15, overshoot: 1.5, wobble: ink.pen.wobble });
        const p = ink.paint('fill', fill, { animate, duration: part(0.45), speed: 2200, cls: 'ink-marker', pen: { nib: 'fine', size: gap * 1.9, taperIn: 0.5, taperOut: 0.6, pressureNoise: 0.05 } });
        if (animate) await p;
      }
      const outline = variant === 'ghost'
        ? S.underline(6, h - 6, w - 12, { seed: ink.seed, wobble: ink.pen.wobble })
        : S.rect(1, 1, w - 2, h - 2, { seed: ink.seed, wobble: ink.pen.wobble, radius: 5, overshoot: 3 });
      return ink.paint('outline', outline, { animate, duration: variant === 'solid' || variant === 'accent' ? part(0.55) : duration });
    },
  });
  return (
    <HostContext.Provider value={ref}>
      <button
        ref={ref}
        className={cx('ink-button ink-host', className)}
        data-variant={variant}
        onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) { const i = ink(); if (i) focusLoop(i); } onFocus?.(e); }}
        onBlur={(e) => { ink()?.erase('focus', 160); onBlur?.(e); }}
        {...rest}
      >
        <svg ref={svgRef} className="ink-layer" aria-hidden="true" />
        {writeText(children)}
      </button>
    </HostContext.Provider>
  );
});

/* ---------- Card ---------- */

export interface InkCardProps extends HTMLAttributes<HTMLElement>, Ordering {
  as?: ElementType;
  /** 'loop': one continuous stroke · 'sketch': four overshooting lines */
  sketch?: 'loop' | 'sketch';
  /** Hatched drop shadow. Default 'hatch'. */
  shadow?: 'hatch' | 'none';
}

export const InkCard = forwardRef<HTMLElement, InkCardProps>(function InkCard(
  { as: Tag = 'div', sketch = 'loop', shadow = 'hatch', className, children, after, delay, duration, ...rest }, fwd) {
  const ref = useRef<HTMLElement>(null);
  useImperativeHandle(fwd, () => ref.current!);
  const { svgRef } = useInkLayer(ref, {
    after, delay, duration, seedKey: 'card',
    async draw(ink, { animate, duration }) {
      const { w, h } = ink;
      const p = ink.paint('outline', S.rect(0, 0, w, h, { seed: ink.seed, wobble: ink.pen.wobble, style: sketch, radius: 4 }), { animate, duration: duration * (shadow === 'none' ? 1 : 0.65) });
      if (shadow === 'none') return p;
      if (animate) await p;
      const off = 7, angle = -Math.PI / 4;
      const strokes = [
        ...S.hatch({ type: 'rect', x: w + 2, y: off + 2, w: off, h: h - 2 }, { seed: ink.seed + 3, angle, gap: 4.5, wobble: ink.pen.wobble }),
        ...S.hatch({ type: 'rect', x: off + 2, y: h + 2, w: w - 2, h: off }, { seed: ink.seed + 4, angle, gap: 4.5, wobble: ink.pen.wobble }),
      ];
      return ink.paint('shadow', strokes, { animate, duration: duration * 0.35, speed: 1400, pen: { size: ink.pen.size * 0.6 } });
    },
  });
  return (
    <HostContext.Provider value={ref}>
      <Tag ref={ref} className={cx('ink-card ink-host', className)} {...rest}>
        <svg ref={svgRef} className="ink-layer" aria-hidden="true" />
        {children}
      </Tag>
    </HostContext.Provider>
  );
});

/* ---------- Inline marks ---------- */

function useMark(kind: 'highlight' | 'circle' | 'underline', ref: RefObject<HTMLSpanElement | null>, o: Ordering & { hover?: boolean; double?: boolean }) {
  return useInkLayer(ref, {
    after: o.after, delay: o.delay, duration: o.duration, seedKey: kind,
    draw(ink, { animate, duration }) {
      const { w, h, seed } = ink;
      if (kind === 'highlight') {
        const gap = 4;
        // A chisel highlighter swiped back and forth along the line.
        return ink.paint('mark', S.scribbleFill({ type: 'rect', x: -4, y: h * 0.2, w: w + 8, h: h * 0.68 }, { seed, gap, angle: -0.08, wobble: 0.5, overshoot: 2 }),
          { animate, duration, speed: 1400, cls: 'ink-highlighter', pen: { nib: 'broad', angle: -1.45, size: gap * 2.4, pressureNoise: 0.06 } });
      }
      if (kind === 'circle') return ink.paint('mark', S.circleAround(0, 0, w, h, { seed, wobble: ink.pen.wobble }), { animate, duration, cls: 'ink-accent' });
      if (o.hover) return Promise.resolve();
      return ink.paint('mark', S.underline(0, h - 1, w, { seed, wobble: ink.pen.wobble, double: o.double }), { animate, duration });
    },
  });
}

type MarkProps = HTMLAttributes<HTMLSpanElement> & Ordering & { children?: ReactNode };

export function InkHighlight({ className, children, after, delay, duration, ...rest }: MarkProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const { svgRef } = useMark('highlight', ref, { after, delay, duration });
  return <HostContext.Provider value={ref}><span ref={ref} className={cx('ink-mark ink-host', className)} {...rest}><svg ref={svgRef} className="ink-layer" aria-hidden="true" />{writeText(children)}</span></HostContext.Provider>;
}

export function InkCircle({ className, children, after, delay, duration, ...rest }: MarkProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const { svgRef } = useMark('circle', ref, { after, delay, duration });
  return <HostContext.Provider value={ref}><span ref={ref} className={cx('ink-mark ink-host', className)} {...rest}><svg ref={svgRef} className="ink-layer" aria-hidden="true" />{writeText(children)}</span></HostContext.Provider>;
}

export interface InkUnderlineProps extends MarkProps {
  /** Only draw while hovered/focused (for links). */
  hover?: boolean;
  double?: boolean;
  as?: ElementType;
  href?: string;
}

export function InkUnderline({ className, children, after, delay, duration, hover, double, as: Tag = 'span', ...rest }: InkUnderlineProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const { svgRef, ink, isDrawn } = useMark('underline', ref, { after, delay, duration, hover, double });
  // Switching between permanent and hover-only (e.g. the current nav item changes) redraws.
  useEffect(() => {
    const i = ink();
    if (!i || !isDrawn()) return;
    if (hover) i.erase('mark', 200);
    else i.paint('mark', S.underline(0, i.h - 1, i.w, { seed: i.seed, wobble: i.pen.wobble, double }), { speed: 900 });
  }, [hover]); // eslint-disable-line react-hooks/exhaustive-deps
  const on = () => { const i = ink(); if (i && hover) i.paint('hover', S.underline(0, i.h - 1, i.w, { seed: i.seed + ((Math.random() * 9) | 0) }), { speed: 900 }); };
  const off = () => { if (hover) ink()?.erase('hover', 200); };
  return (
    <HostContext.Provider value={ref}>
      <Tag ref={ref} className={cx('ink-mark ink-host', className)} onMouseEnter={on} onMouseLeave={off} onFocus={on} onBlur={off} {...rest}>
        <svg ref={svgRef} className="ink-layer" aria-hidden="true" />{writeText(children)}
      </Tag>
    </HostContext.Provider>
  );
}

/* ---------- Divider, icon, arrow ---------- */

export function InkDivider({ className, style, after, delay, duration, ...rest }: HTMLAttributes<HTMLDivElement> & Ordering) {
  const ref = useRef<HTMLDivElement>(null);
  const { svgRef } = useInkLayer(ref, { after, delay, duration, seedKey: 'divider', draw: (ink, { animate, duration }) => ink.paint('line', S.flourish(0, ink.h / 2, ink.w, { seed: ink.seed, wobble: ink.pen.wobble }), { animate, duration, speed: 900 }) });
  return <div ref={ref} role="separator" className={cx('ink-divider ink-host', className)} style={{ height: 30, ...style }} {...rest}><svg ref={svgRef} className="ink-layer" aria-hidden="true" /></div>;
}

export interface InkIconProps extends HTMLAttributes<HTMLSpanElement>, Ordering {
  name: IconName;
  /** px. Default 24. */
  size?: number;
  /** Accessible label; omit for decorative icons. */
  label?: string;
}

export function InkIcon({ name, size = 24, label, className, style, after, delay, duration, ...rest }: InkIconProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const { svgRef } = useInkLayer(ref, {
    after, delay, duration, seedKey: 'icon' + name,
    draw: (ink, { animate, duration }) => ink.paint('icon', S.fromPath(samplePath(ICONS[name], 0.5), { scale: Math.min(ink.w, ink.h) / 24, seed: ink.seed, wobble: ink.pen.wobble }), { animate, duration, speed: 500 }),
  });
  return (
    <span ref={ref} className={cx('ink-icon ink-host', className)} style={{ width: size, height: size, ...style }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} {...rest}>
      <svg ref={svgRef} className="ink-layer" aria-hidden="true" />
    </span>
  );
}

type Corner = 't' | 'b' | 'l' | 'r' | 'tl' | 'tr' | 'bl' | 'br' | 'c';
export interface InkArrowProps extends HTMLAttributes<HTMLSpanElement>, Ordering {
  /** Start and end within the box, e.g. from="r" to="l" or from="tr" to="bl". */
  from?: Corner;
  to?: Corner;
  /** Bend, -1..1. */
  curve?: number;
  accent?: boolean;
}

export function InkArrow({ from = 'r', to = 'l', curve = 0.25, accent = true, className, style, after, delay, duration, ...rest }: InkArrowProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const { svgRef } = useInkLayer(ref, {
    after, delay, duration, seedKey: 'arrow',
    draw(ink, { animate, duration }) {
      const pt = (c: Corner): [number, number] => [c.includes('l') ? 0 : c.includes('r') ? ink.w : ink.w / 2, c.includes('t') ? 0 : c.includes('b') ? ink.h : ink.h / 2];
      const [x1, y1] = pt(from), [x2, y2] = pt(to);
      return ink.paint('arrow', S.arrow(x1, y1, x2, y2, { seed: ink.seed, wobble: ink.pen.wobble, curve }), { animate, duration, speed: 700, cls: accent ? 'ink-accent' : '' });
    },
  });
  return <span ref={ref} aria-hidden="true" className={cx('ink-arrow ink-host', className)} style={{ display: 'block', ...style }} {...rest}><svg ref={svgRef} className="ink-layer" aria-hidden="true" /></span>;
}
