import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { InkProvider, InkUnderline, usePageTurn } from '@pen-ink/react';
import '@pen-ink/react/styles.css';
import './demo.css';
import { Gallery } from './pages/Gallery';
import { Notes } from './pages/Notes';

const ROUTES = [
  { path: '/', label: 'Components', Page: Gallery },
  { path: '/notes', label: 'Field notes', Page: Notes },
];
const routeOf = (p: string) => ROUTES.findIndex((r) => r.path === p) === -1 ? 0 : ROUTES.findIndex((r) => r.path === p);

function App() {
  const [index, setIndex] = useState(() => routeOf(location.pathname));
  const turn = usePageTurn();
  useEffect(() => {
    const onPop = () => setIndex(routeOf(location.pathname));
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  const go = (to: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (to === index) return;
    // Turn the page; swap the route as the flap finishes (going back turns the other way).
    turn(() => { history.pushState(null, '', ROUTES[to].path); setIndex(to); scrollTo(0, 0); }, { flip: to < index });
  };
  const { Page } = ROUTES[index];
  return (
    <>
      <header className="topbar">
        <span className="brand">pen-ink</span>
        <nav aria-label="Main">
          {ROUTES.map((r, i) => (
            <InkUnderline key={r.path} as="a" href={r.path} hover={i !== index} aria-current={i === index ? 'page' : undefined} onClick={go(i)}>{r.label}</InkUnderline>
          ))}
          <button className="theme" aria-label="Toggle dark paper" onClick={() => {
            const root = document.documentElement;
            const dark = root.dataset.inkTheme ? root.dataset.inkTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
            root.dataset.inkTheme = dark ? 'light' : 'dark';
            try { localStorage.setItem('ink-theme', root.dataset.inkTheme); } catch {}
          }}>◐</button>
        </nav>
      </header>
      {/* key: a fresh page mounts (and sketches in) on every route change */}
      <main className="page" key={index}><Page /></main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InkProvider loadDuration={1400}>
      <App />
    </InkProvider>
  </StrictMode>,
);
