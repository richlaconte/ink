// Turn the page like paper.
//
// 2D page-curl model: the page's corner C is dragged to a point P. The fold is
// the perpendicular bisector of C–P; the part on C's side is lifted, and its
// reflection across the fold is the flap (the back of the sheet). A hinge at
// the spine keeps P within reach, like a bound page. The live content is
// clipped away, revealing blank paper beneath.

import type { Pt } from './path';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function clipHalf(poly: Pt[], M: Pt, n: Pt, positive: boolean): Pt[] {
  const s = (p: Pt) => ((p[0] - M[0]) * n[0] + (p[1] - M[1]) * n[1]) * (positive ? 1 : -1);
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], sa = s(a), sb = s(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) { const f = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); }
  }
  return out;
}

export interface TurnGeometry { page: Pt[]; lifted: Pt[]; flap: Pt[]; M: Pt; P: Pt; n: Pt }

/** Page geometry at progress e (0 flat, 1 turned) for a W×H page. `flip` turns left-to-right. */
export function turnGeometry(e: number, W: number, H: number, flip = false): TurnGeometry {
  const C: Pt = [W, H];
  let P: Pt = [W - 2 * W * e, H - 0.22 * H * Math.sin(Math.PI * e)];
  for (const [S, R] of [[[0, H], W], [[0, 0], Math.hypot(W, H)]] as [Pt, number][]) {
    const dx = P[0] - S[0], dy = P[1] - S[1], d = Math.hypot(dx, dy);
    if (d > R) P = [S[0] + (dx * R) / d, S[1] + (dy * R) / d];
  }
  const dx = C[0] - P[0], dy = C[1] - P[1], len = Math.hypot(dx, dy) || 1e-6;
  const n: Pt = [dx / len, dy / len], M: Pt = [(C[0] + P[0]) / 2, (C[1] + P[1]) / 2];
  const rect: Pt[] = [[0, 0], [W, 0], [W, H], [0, H]];
  const page = clipHalf(rect, M, n, false), lifted = clipHalf(rect, M, n, true);
  const reflect = ([x, y]: Pt): Pt => { const s = (x - M[0]) * n[0] + (y - M[1]) * n[1]; return [x - 2 * s * n[0], y - 2 * s * n[1]]; };
  const mir = (p: Pt): Pt => (flip ? [W - p[0], p[1]] : p);
  return { page: page.map(mir), lifted: lifted.map(mir), flap: lifted.map(reflect).map(mir), M: mir(M), P: mir(P), n: flip ? [-n[0], n[1]] : n };
}

const poly = (pts: Pt[], dy = 0) => (pts.length ? `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${(y + dy).toFixed(1)}px`).join(',')})` : 'polygon(0 0)');

function gradientAlong(A: Pt, B: Pt, W: number, H: number, stops: [string, number][]) {
  const gx = B[0] - A[0], gy = B[1] - A[1], gl = Math.hypot(gx, gy) || 1, ux = gx / gl, uy = gy / gl;
  const deg = (Math.atan2(ux, -uy) * 180) / Math.PI, L = Math.abs(W * ux) + Math.abs(H * uy);
  const start: Pt = [W / 2 - (ux * L) / 2, H / 2 - (uy * L) / 2];
  const at = (p: Pt) => (p[0] - start[0]) * ux + (p[1] - start[1]) * uy, a = at(A), b = at(B);
  return `linear-gradient(${deg.toFixed(2)}deg, ${stops.map(([c, f]) => `${c} ${(a + (b - a) * f).toFixed(1)}px`).join(', ')})`;
}

export interface TurnOptions {
  /** Element whose content turns away (default: document.body). */
  target?: HTMLElement;
  /** Turn left-to-right (e.g. going back). */
  flip?: boolean;
  /** ms. */
  duration?: number;
  /** Called once at `near` (0–1) of the way through — swap content/navigate here. */
  onNear?: () => void;
  near?: number;
  /** Leave the page turned (and the overlay up) when done; call the returned cleanup yourself. */
  keep?: boolean;
}

export interface Turn { finished: Promise<void>; cleanup(): void; preview(e: number): void }

/** Turn the page. Resolves when the turn finishes (and cleans up unless `keep`). */
export function turnPage({ target = document.body, flip = false, duration = 720, onNear, near = 0.85, keep = false }: TurnOptions = {}): Turn {
  const overlay = document.createElement('div');
  overlay.className = 'pen-ink-turn';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = '<div class="pit-shadow"></div><div class="pit-flap"></div><svg class="pit-edge"><polygon fill="none"/></svg>';
  document.documentElement.append(overlay);
  document.documentElement.classList.add('pen-ink-turning');
  const shadow = overlay.children[0] as HTMLElement, flap = overlay.children[1] as HTMLElement;
  const edge = overlay.querySelector('polygon')!;

  const render = (e: number) => {
    const r = target === document.body ? { left: 0, top: 0, width: innerWidth, height: innerHeight } : target.getBoundingClientRect();
    const W = r.width, H = r.height;
    if (e <= 0.001) { target.style.clipPath = ''; overlay.style.display = 'none'; return; }
    overlay.style.display = '';
    Object.assign(overlay.style, { left: r.left + 'px', top: r.top + 'px', width: W + 'px', height: H + 'px' });
    const g = turnGeometry(e, W, H, flip);
    target.style.clipPath = poly(g.page, target === document.body ? scrollY : 0);
    const away: Pt = [g.M[0] + g.n[0] * 70, g.M[1] + g.n[1] * 70];
    shadow.style.clipPath = poly(g.lifted);
    shadow.style.background = gradientAlong(g.M, away, W, H, [['rgba(20,15,10,.28)', 0], ['rgba(20,15,10,.08)', 0.4], ['rgba(20,15,10,0)', 1]]);
    flap.style.clipPath = poly(g.flap);
    flap.style.backgroundImage = gradientAlong(g.M, g.P, W, H, [
      ['color-mix(in srgb, var(--ink-paper-deep) 70%, var(--ink-color) 12%)', 0],
      ['var(--ink-paper-deep)', 0.12], ['var(--ink-paper)', 0.55], ['color-mix(in srgb, var(--ink-paper) 85%, var(--ink-paper-deep))', 1],
    ]) + ', var(--ink-paper-grain, none)';
    edge.setAttribute('points', g.flap.map((p) => p.join(',')).join(' '));
  };
  const cleanup = () => { target.style.clipPath = ''; overlay.remove(); document.documentElement.classList.remove('pen-ink-turning'); };

  const finished = new Promise<void>((resolve) => {
    const t0 = performance.now();
    let fired = false;
    const step = (now: number) => {
      const t = clamp01((now - t0) / duration);
      render(ease(t));
      if (!fired && onNear && t >= near) { fired = true; onNear(); }
      if (t < 1) requestAnimationFrame(step);
      else { if (!keep) cleanup(); resolve(); }
    };
    requestAnimationFrame(step);
  });
  return { finished, cleanup, preview: render };
}

/**
 * For multi-page sites: turn the page on same-origin link clicks, navigating as the flap finishes.
 * `order` (paths) decides direction: going to an earlier page turns the other way.
 */
export function installLinkTurns({ order = [] as string[], duration = 720, isReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches } = {}) {
  const page = (u: URL) => u.pathname.split('/').pop() || 'index.html';
  let busy = false;
  const onClick = (e: MouseEvent) => {
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
    if (busy || isReducedMotion()) return;
    e.preventDefault();
    busy = true;
    const flip = order.indexOf(page(url)) > -1 && order.indexOf(page(url)) < order.indexOf(page(new URL(location.href)));
    turnPage({ flip, duration, keep: true, onNear: () => { location.href = url.href; } });
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
