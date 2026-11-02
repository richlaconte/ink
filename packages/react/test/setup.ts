import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(() => cleanup());
// jsdom lacks a few browser APIs the components touch.
if (!window.matchMedia) window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
if (!('ResizeObserver' in window)) (window as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
if (!window.requestAnimationFrame) window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
if (!(globalThis as any).CSS) (globalThis as any).CSS = { escape: (s: string) => s };
// No IntersectionObserver in jsdom: the stage then draws immediately (instantly), which is what we want here.
