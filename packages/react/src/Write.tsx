import { Children, createElement, isValidElement, useContext, useEffect, useLayoutEffect, useRef, useState, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { writeSchedule, type DrawInfo } from '@pen-ink/core';
import { HostContext, useInk } from './context';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
const WIPE_MS = 350;

export interface WriteProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children?: ReactNode;
  /** Draw after the page load or a specific element (when not inside an ink component). */
  after?: 'load' | string;
}

/** Split strings into word spans; wrap other children so they wipe in. */
function words(children: ReactNode, on: boolean): ReactNode {
  return Children.map(children, (child, ci) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return String(child).split(/(\s+)/).map((tok, i) =>
        !tok ? null : /^\s+$/.test(tok) ? tok : <span key={`${ci}-${i}`} className="ink-w" data-on={on ? '' : undefined}>{tok}</span>);
    }
    if (isValidElement(child)) return <span className="ink-wipe" data-on={on ? '' : undefined}>{child}</span>;
    return child;
  });
}

/**
 * Text that writes itself in — left to right, line by line, timed by word width.
 * Inside an ink component it appears as that component's ink draws; on its own
 * it writes in on load or when scrolled into view.
 */
export function Write({ as = 'span', children, after, ...rest }: WriteProps) {
  const { stage, settings } = useInk();
  const host = useContext(HostContext);
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  const shownRef = useRef(false);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || shownRef.current) return;
    const reveal = (info: DrawInfo) => {
      if (shownRef.current) return Promise.resolve();
      const ws = [...el.querySelectorAll<HTMLElement>('.ink-w')];
      const wipes = [...el.querySelectorAll<HTMLElement>('.ink-wipe')];
      const finish = () => { shownRef.current = true; setShown(true); };
      if (!info.animate || settings.reducedMotion) { ws.forEach((w) => w.setAttribute('data-on', '')); wipes.forEach((w) => w.setAttribute('data-on', '')); finish(); return Promise.resolve(); }
      const budget = info.duration || settings.revealDuration / settings.speed;
      const rects = ws.map((w) => w.getBoundingClientRect());
      const plan = writeSchedule(rects.map((r) => ({ width: r.width, top: r.top })), budget, settings.speed);
      ws.forEach((w, i) => { w.style.transition = `clip-path ${plan[i].duration.toFixed(0)}ms linear ${plan[i].delay.toFixed(0)}ms`; });
      wipes.forEach((w) => { w.style.setProperty('--ink-wipe', `${Math.min(WIPE_MS, budget)}ms`); });
      requestAnimationFrame(() => { ws.forEach((w) => w.setAttribute('data-on', '')); wipes.forEach((w) => w.setAttribute('data-on', '')); });
      const end = plan.length ? plan[plan.length - 1].delay + plan[plan.length - 1].duration : 0;
      return new Promise<void>((r) => setTimeout(() => { finish(); r(); }, Math.max(end, WIPE_MS) + 30));
    };
    // Inside a host: start with its ink. Otherwise: be our own stage entry.
    if (host?.current) return stage.onDraw(host.current, (info) => { reveal(info); });
    const handle = stage.register({ el, draw: reveal, after });
    return () => handle.unregister();
  }, [stage, host, after]); // eslint-disable-line react-hooks/exhaustive-deps

  return createElement(as, { ...rest, ref }, words(children, shown));
}
