import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { InkStage, ensureFilters, settings as globalSettings, updateFilters, type FilterParams, type InkHand, type InkSettings } from '@pen-ink/core';
import { hands as bundledHands } from '@pen-ink/fonts';
import { markInkReady } from './InkHeadScript';

export type HandLoader = () => Promise<InkHand>;

export interface InkProviderProps extends Partial<InkSettings> {
  children?: ReactNode;
  /** Hands available by key. Defaults to every hand in @pen-ink/fonts. */
  hands?: Record<string, HandLoader>;
  /** Default hand for handwriting and ink-written inputs. */
  hand?: string;
  /** Tune the ink filter (edge roughness, bleed, grain). */
  filter?: Partial<FilterParams>;
}

export interface InkContextValue {
  stage: InkStage;
  settings: InkSettings;
  loadHand(key?: string): Promise<InkHand>;
  defaultHand: string;
}

const InkContext = createContext<InkContextValue | null>(null);

/** The ink host an element sits inside: its content appears as the host's ink draws. */
export const HostContext = createContext<{ current: Element | null } | null>(null);

const handCache = new Map<string, Promise<InkHand>>();

function makeValue(settings: InkSettings, hands: Record<string, HandLoader>, defaultHand: string): InkContextValue {
  return {
    stage: new InkStage(settings),
    settings,
    defaultHand,
    loadHand(key = defaultHand) {
      const loader = hands[key] ?? hands[defaultHand];
      if (!loader) return Promise.reject(new Error(`pen-ink: unknown hand "${key}"`));
      if (!handCache.has(key)) handCache.set(key, loader());
      return handCache.get(key)!;
    },
  };
}

/** Provides the stage (when things draw), settings, and hands. Put it near the root. */
export function InkProvider({ children, hands = bundledHands as Record<string, HandLoader>, hand = 'casual', filter, ...settingProps }: InkProviderProps) {
  const settingsRef = useRef<InkSettings | null>(null);
  if (!settingsRef.current) settingsRef.current = Object.assign(globalSettings, settingProps);
  // Live-update settings without rebuilding the stage.
  Object.assign(settingsRef.current, settingProps);
  const value = useMemo(() => makeValue(settingsRef.current!, hands, hand), [hands, hand]);
  useEffect(() => { ensureFilters(); markInkReady(); }, []);
  useEffect(() => { if (filter) updateFilters(filter); }, [filter?.rough, filter?.warp, filter?.bleed, filter?.grain]); // eslint-disable-line react-hooks/exhaustive-deps
  return <InkContext.Provider value={value}>{children}</InkContext.Provider>;
}

let fallback: InkContextValue | null = null;
/** The nearest InkProvider (or a page-wide default, so components work without one). */
export function useInk(): InkContextValue {
  const ctx = useContext(InkContext);
  if (ctx) return ctx;
  return (fallback ||= makeValue(globalSettings, bundledHands as Record<string, HandLoader>, 'casual'));
}

/** Resolves after the page's initial sketch-in. */
export function useAfterLoad(): () => Promise<void> {
  const { stage } = useInk();
  return () => stage.afterLoad();
}
