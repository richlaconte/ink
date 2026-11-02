/**
 * Put in <head> (e.g. Next.js app/layout.tsx) to show only blank paper until the
 * page has hydrated and ink can take over — so server-rendered text doesn't
 * flash before it's drawn. Falls back to showing the page after `timeout` ms.
 * <InkProvider> reveals the page structure when it mounts (content still appears as it's drawn).
 */
export function InkHeadScript({ timeout = 3000, theme = true }: { timeout?: number; theme?: boolean }) {
  const js = `(function(d){${theme ? "try{var t=localStorage.getItem('ink-theme');if(t)d.dataset.inkTheme=t}catch(e){}" : ''}d.classList.add('ink-pending');setTimeout(function(){d.classList.remove('ink-pending')},${timeout})})(document.documentElement)`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

/** Reveal the page structure (content still appears as it's drawn). */
export function markInkReady() {
  if (typeof document !== 'undefined') document.documentElement.classList.remove('ink-pending');
}
