import { useCallback } from 'react';
import { turnPage, type TurnOptions } from '@pen-ink/core';
import { useInk } from './context';

export interface PageTurnOptions extends Omit<TurnOptions, 'onNear' | 'keep'> {}

/**
 * Turn the page, then swap content (e.g. a client-side route change) as the
 * flap finishes. The new view's ink sketches in with the load budget.
 *
 *   const turn = usePageTurn();
 *   <a href="/notes" onClick={(e) => { e.preventDefault(); turn(() => navigate('/notes')); }}>
 */
export function usePageTurn() {
  const { stage, settings } = useInk();
  return useCallback((swap: () => void, opts: PageTurnOptions = {}) => {
    if (settings.reducedMotion || typeof document === 'undefined') { swap(); stage.beginPage(); return Promise.resolve(); }
    return turnPage({
      ...opts,
      onNear: () => { stage.beginPage(); swap(); },
    }).finished;
  }, [stage, settings]);
}
