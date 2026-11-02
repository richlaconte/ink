import { useEffect, useLayoutEffect, useRef, type ElementType, type HTMLAttributes, type RefObject } from 'react';
import { InkText, type After, type NibKind } from '@pen-ink/core';
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

/**
 * Text handwritten stroke by stroke from a single-line font. The real text stays
 * in the DOM for screen readers, search and copy/paste; the ink is aria-hidden.
 */
export function Handwriting({ children: text, as: Tag = 'span', hand, size, nib = 'fine', weight = 0.06, speed = 1, jitter = 1, slant = 0, wrap = true, seed = 1, after, delay, duration, className, ...rest }: HandwritingProps) {
  const { stage, loadHand, defaultHand } = useInk();
  const ref = useRef<HTMLElement>(null), holderRef = useRef<HTMLSpanElement>(null);
  const writerRef = useRef<InkText | null>(null);
  const drawn = useRef(false);
  const textRef = useRef(text);
  textRef.current = text;

  useIsoLayoutEffect(() => {
    const el = ref.current!, holder = holderRef.current!;
    const px = size ?? parseFloat(getComputedStyle(el).fontSize) * 1.15;
    const width = wrap ? (el.clientWidth || el.parentElement?.clientWidth || 600) - 4 : Infinity;
    const w = new InkText(holder, loadHand(hand ?? defaultHand), { size: px, width, weight, speed, jitter, slant, seed, pad: 2, pen: { nib } });
    writerRef.current = w;
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

  return (
    <Tag ref={ref} className={cx('ink-handwriting', className)} {...rest}>
      <span className="ink-sr">{text}</span>
      <span ref={holderRef} aria-hidden="true" style={{ display: 'block', lineHeight: 0 }} />
    </Tag>
  );
}
