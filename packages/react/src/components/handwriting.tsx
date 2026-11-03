import { useEffect, useLayoutEffect, useRef, useState, type ElementType, type HTMLAttributes, type RefObject } from 'react';
import { InkText, textRuns, type After, type NibKind } from '@pen-ink/core';
import { useInk } from '../context';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

export interface HandwritingProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** The text to write. Changing it writes the difference (removed letters lift off). */
  children: string;
  as?: ElementType;
  /** Hand key (default: the provider's). */
  hand?: string;
  /** px. Default: the element's computed font-size × 1.15. */
  size?: number;
  nib?: NibKind;
  /** Pen width as a fraction of size. Default 0.06. */
  weight?: number;
  /** Writing speed multiplier. */
  speed?: number;
  /** Messiness. Default 1. */
  jitter?: number;
  slant?: number;
  /** Wrap to the element's width. Default true. */
  wrap?: boolean;
  seed?: number;
  after?: After | RefObject<Element | null>;
  delay?: number;
  duration?: number;
}

/** How the real text is laid over the ink: font, line pitch, and runs letter-spaced to the ink's widths. */
interface TextFit { font: string; size: number; lineHeight: number; pad: number; width: number | null; runs: { text: string; spacing: number }[] }

let canvas: CanvasRenderingContext2D | null | undefined;
function naturalWidth(text: string, font: string): number | null {
  if (canvas === undefined) {
    try { canvas = document.createElement('canvas').getContext('2d'); } catch { canvas = null; }
  }
  if (!canvas) return null;
  canvas.font = font;
  if ('fontKerning' in canvas) canvas.fontKerning = 'none';
  return canvas.measureText(text).width;
}

function fitText(text: string, w: InkText, family: string): TextFit | null {
  const hand = w.hand;
  if (!hand) return null;
  const { size, lineHeight, pad, width } = w.o;
  const font = `${size}px ${family}`;
  const runs: TextFit['runs'] = [];
  for (const r of textRuns(text, hand, size)) {
    const n = [...r.text].length;
    const nat = r.text === '\n' ? null : naturalWidth(r.text, font);
    runs.push({ text: r.text, spacing: nat == null || !n ? 0 : (r.width - nat) / n });
  }
  return { font: family, size, lineHeight: size * lineHeight, pad, width: Number.isFinite(width) ? width : null, runs };
}

/**
 * Text handwritten stroke by stroke from a single-line font. The ink is an aria-hidden SVG;
 * the real text sits underneath it, transparent and spaced to match the ink, so screen readers,
 * search engines, find-in-page and drag-to-select/copy all work on the actual words.
 */
export function Handwriting({ children: text, as: Tag = 'span', hand, size, nib = 'fine', weight = 0.06, speed = 1, jitter = 1, slant = 0, wrap = true, seed = 1, after, delay, duration, className, ...rest }: HandwritingProps) {
  const { stage, loadHand, defaultHand } = useInk();
  const ref = useRef<HTMLElement>(null), holderRef = useRef<HTMLSpanElement>(null), textElRef = useRef<HTMLSpanElement>(null);
  const writerRef = useRef<InkText | null>(null);
  const drawn = useRef(false);
  const textRef = useRef(text);
  textRef.current = text;
  const [fit, setFit] = useState<TextFit | null>(null);
  const [gen, setGen] = useState(0); // bumps when a new writer is made

  useIsoLayoutEffect(() => {
    const el = ref.current!, holder = holderRef.current!;
    const px = size ?? (parseFloat(getComputedStyle(el).fontSize) || 16) * 1.15;
    const width = wrap ? (el.clientWidth || el.parentElement?.clientWidth || 600) - 4 : Infinity;
    const w = new InkText(holder, loadHand(hand ?? defaultHand), { size: px, width, weight, speed, jitter, slant, seed, pad: 2, pen: { nib } });
    writerRef.current = w;
    setGen((g) => g + 1);
    w.reserve(text); // reserve space so layout doesn't jump
    const a = after && typeof after === 'object' && 'current' in after ? after.current : (after as After);
    const handle = stage.register({
      el, after: a, delay, duration,
      draw: async ({ animate, duration }) => { await w.write(textRef.current, { animate, duration }); drawn.current = true; },
    });
    return () => { handle.unregister(); w.destroy(); writerRef.current = null; drawn.current = false; };
  }, [stage, hand, size, nib, weight, speed, jitter, slant, wrap, seed]); // eslint-disable-line react-hooks/exhaustive-deps

  // After it's drawn, text changes are written as a diff.
  useEffect(() => { if (drawn.current) writerRef.current?.setText(text); }, [text]);

  // Space the real text to the ink once the hand has loaded (and whenever the text changes).
  useEffect(() => {
    const w = writerRef.current, el = ref.current;
    if (!w || !el) return;
    let live = true;
    w.ready.then(() => { if (live && writerRef.current === w) setFit(fitText(text, w, getComputedStyle(el).fontFamily || 'sans-serif')); });
    return () => { live = false; };
  }, [text, gen]);

  // Follow the ink if CSS scales its SVG down (.ink-text-svg has max-width: 100%).
  useIsoLayoutEffect(() => {
    const holder = holderRef.current, t = textElRef.current;
    if (!holder || !t || !fit) return;
    const place = () => {
      const svg = holder.querySelector('svg'), w = writerRef.current;
      const k = svg && w?.box.w ? svg.getBoundingClientRect().width / w.box.w || 1 : 1;
      t.style.transform = Math.abs(k - 1) < 0.002 ? '' : `scale(${k.toFixed(4)})`;
    };
    place();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(place);
    ro.observe(holder);
    return () => ro.disconnect();
  }, [fit]);

  return (
    <Tag ref={ref} className={cx('ink-handwriting', className)} {...rest}>
      <span
        ref={textElRef}
        className="ink-handwriting-text"
        data-fit={fit ? '' : undefined}
        style={fit ? {
          fontFamily: fit.font, fontSize: fit.size, lineHeight: `${fit.lineHeight}px`, padding: `${fit.pad}px ${fit.pad}px 0`, marginBottom: -fit.pad,
          width: fit.width == null ? undefined : fit.width + fit.pad * 2 + 0.5,
          whiteSpace: fit.width == null ? 'pre' : 'pre-wrap',
        } : undefined}
      >
        {fit ? fit.runs.map((r, i) => r.text === '\n' || !r.spacing ? r.text : <span key={i} style={{ letterSpacing: `${r.spacing.toFixed(3)}px` }}>{r.text}</span>) : text}
      </span>
      <span ref={holderRef} className="ink-handwriting-ink" aria-hidden="true" style={{ display: 'block', lineHeight: 0 }} />
    </Tag>
  );
}
