import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Handwriting, InkArrow, InkButton, InkCard, InkCheckbox, InkCircle, InkDivider, InkHighlight, InkIcon,
  InkInput, InkProgress, InkProvider, InkRadio, InkSlider, InkSwitch, InkTabs, InkUnderline, Write, type NibKind,
} from '@pen-ink/react';
import { handKeys, handNames, type HandKey } from '@pen-ink/fonts';
import '@pen-ink/react/styles.css';
import './site.css';

const REPO = 'https://github.com/richlaconte/ink';
const INSTALL = 'npm install @pen-ink/react';

const NIBS: { value: NibKind; label: string }[] = [
  { value: 'fine', label: 'Fineliner' },
  { value: 'dip', label: 'Dip pen' },
  { value: 'broad', label: 'Chisel' },
  { value: 'brush', label: 'Brush' },
  { value: 'ball', label: 'Ballpoint' },
];

const QUICKSTART = `import { InkProvider, InkCard, Handwriting, Write, InkInput, InkButton } from '@pen-ink/react';
import '@pen-ink/react/styles.css';

export function App() {
  return (
    <InkProvider>
      <InkCard as="article" style={{ padding: 24 }}>
        <Handwriting as="h1" hand="allure" nib="dip">Field notes</Handwriting>
        <Write as="p">Everything on this card is put down as it's drawn.</Write>
        <InkInput label="Your name" placeholder="Ada Lovelace" />
        <InkButton variant="solid">Save</InkButton>
      </InkCard>
    </InkProvider>
  );
}`;

function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.inkTheme ? root.dataset.inkTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.inkTheme = dark ? 'light' : 'dark';
  try { localStorage.setItem('ink-theme', root.dataset.inkTheme); } catch {}
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <InkButton
      variant="ghost"
      className="copy"
      aria-live="polite"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
      }}
    >
      {copied ? 'Copied' : label}
    </InkButton>
  );
}

function Header() {
  return (
    <header className="topbar">
      <a className="brand" href="#top">pen-ink</a>
      <nav aria-label="Main">
        <InkUnderline as="a" href="#try" hover>Try it</InkUnderline>
        <InkUnderline as="a" href="#components" hover>Components</InkUnderline>
        <InkUnderline as="a" href="#start" hover>Get started</InkUnderline>
        <InkUnderline as="a" href={REPO} hover>GitHub</InkUnderline>
        <button className="theme" aria-label="Toggle dark paper" onClick={toggleTheme}><InkIcon name="moon" size={20} /></button>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <Write as="p" className="eyebrow">Open-source React components</Write>
      <Handwriting as="h1" hand="allure" nib="dip" weight={0.07} id="title">pen-ink</Handwriting>
      <div className="margin-note" aria-hidden="true">
        <Handwriting hand="casual" className="ink-accent" size={20} after="#title" delay={150} id="note" wrap={false}>drawn live, stroke by stroke</Handwriting>
        <InkArrow after="#note" from="r" to="l" curve={-0.3} style={{ width: 150, height: 34, marginLeft: -96 }} />
      </div>
      <Write as="p" className="lede">
        Interfaces that are drawn for you in real time, in pen and ink. Underneath, a button is still a button and a checkbox is still a checkbox. The ink is a layer on top.
      </Write>
      <div className="install">
        <code>{INSTALL}</code>
        <CopyButton text={INSTALL} />
      </div>
      <div className="row cta">
        <InkButton variant="solid" onClick={() => document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' })}>Try it below</InkButton>
        <InkButton onClick={() => { location.href = REPO; }}>View on GitHub</InkButton>
      </div>
    </section>
  );
}

function Playground() {
  const [text, setText] = useState('The quick brown fox');
  const [hand, setHand] = useState<HandKey>('casual');
  const [nib, setNib] = useState<NibKind>('dip');
  const [slant, setSlant] = useState(10);
  const [replay, setReplay] = useState(0);
  const shown = text.trim() || 'Write something…';
  return (
    <section className="section" id="try" aria-labelledby="try-title">
      <Write as="p" className="eyebrow">Try it</Write>
      <Write as="h2" id="try-title">Write something</Write>
      <Write as="p" className="sub">Type in the field: it's a native input, but the letters are put down in ink. The card on the right writes the same words in whichever hand and nib you choose.</Write>
      <div className="grid two play">
        <InkCard as="form" className="card form" shadow="none" onSubmit={(e) => e.preventDefault()}>
          <div>
            <Write as="span" className="label">Your words</Write>
            <InkInput label="Your words" value={text} maxLength={48} onChange={(e) => setText(e.target.value)} />
          </div>
          <fieldset>
            <legend className="label">Hand</legend>
            <div className="opts">
              {handKeys.map((k) => (
                <InkRadio key={k} name="hand" checked={hand === k} onChange={() => setHand(k)}>{handNames[k].replace(' 1-stroke', '').replace(' medium', '')}</InkRadio>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Nib</legend>
            <div className="opts">
              {NIBS.map((n) => (
                <InkRadio key={n.value} name="nib" checked={nib === n.value} onChange={() => setNib(n.value)}>{n.label}</InkRadio>
              ))}
            </div>
          </fieldset>
          <div>
            <Write as="span" className="label">Slant</Write>
            <InkSlider aria-label="Slant" min={-20} max={40} value={slant} onChange={(e) => setSlant(Number(e.target.value))} />
          </div>
        </InkCard>
        <div className="stack">
          <InkCard className="card output" sketch="sketch">
            <Write as="span" className="label">{`${handNames[hand]} · ${NIBS.find((n) => n.value === nib)!.label}`}</Write>
            <Handwriting key={replay} as="p" className="written" hand={hand} nib={nib} slant={slant / 100} size={44} weight={nib === 'fine' || nib === 'ball' ? 0.05 : 0.08}>{shown}</Handwriting>
          </InkCard>
          <div className="row">
            <InkButton onClick={() => setReplay((r) => r + 1)}><InkIcon name="pencil" size={18} /> Write it again</InkButton>
          </div>
          <Write as="p" className="hint">Editing the text writes only the difference, and deleted letters lift off. The real text stays in the DOM, so screen readers and copy/paste get plain words.</Write>
        </div>
      </div>
    </section>
  );
}

function Principles() {
  return (
    <section className="section" aria-labelledby="how-title">
      <Write as="p" className="eyebrow">How it works</Write>
      <Write as="h2" id="how-title">A pen, not a filter</Write>
      <div className="grid three">
        <InkCard as="article" className="card">
          <InkIcon name="feather" size={34} />
          <Write as="h3">Centrelines, not outlines</Write>
          <Write as="p">Each mark is the path a pen travels, plus a nib model that turns direction and pressure into line weight. A dip pen swells on downstrokes. A chisel nib's width depends on direction.</Write>
        </InkCard>
        <InkCard as="article" className="card">
          <InkIcon name="pencil" size={34} />
          <Write as="h3">Human timing</Write>
          <Write as="p">Strokes follow a minimum-jerk velocity profile, and the pen lifts and travels between them. Fresh ink goes down blue-black, then dries darker.</Write>
        </InkCard>
        <InkCard as="article" className="card">
          <InkIcon name="bookmark" size={34} />
          <Write as="h3">Semantic underneath</Write>
          <Write as="p">The ink is an aria-hidden SVG layer. Focus, forms, autofill and screen readers all see ordinary HTML, and anyone who prefers reduced motion gets everything drawn at once.</Write>
        </InkCard>
        <InkCard as="article" className="card">
          <InkIcon name="sun" size={34} />
          <Write as="h3">Loading is sketching</Write>
          <Write as="p">Everything that appears together draws together, inside a shared time budget. Budgets only ever compress a drawing, never stretch it.</Write>
        </InkCard>
        <InkCard as="article" className="card" sketch="sketch">
          <InkIcon name="star" size={34} />
          <Write as="h3">Stable imperfection</Write>
          <Write as="p">Wobble comes from seeded randomness, so an element is wonky in the same way on every visit.</Write>
        </InkCard>
        <InkCard as="article" className="card" sketch="sketch">
          <InkIcon name="heart" size={34} />
          <Write as="h3">Eleven hands</Write>
          <Write as="p">Single-line plotter fonts, from Hershey's 1967 vector type to modern scripts. Each one lazy-loads only when it's used.</Write>
        </InkCard>
      </div>
    </section>
  );
}

const PANELS: Record<string, string> = {
  buttons: 'Hover a button to see the line boil. Tab to it and you get a hand-drawn focus loop.',
  forms: 'Checkboxes, radios, switches and sliders are native inputs. Only the drawing is new.',
  marks: 'Inline marks for prose: highlight, circle and underline, drawn when they scroll into view.',
};

function Components() {
  const [tab, setTab] = useState('buttons');
  const [progress, setProgress] = useState(0.4);
  return (
    <section className="section" id="components" aria-labelledby="comp-title">
      <Write as="p" className="eyebrow">Components</Write>
      <Write as="h2" id="comp-title">The usual kit, drawn by hand</Write>
      <InkTabs aria-label="Component groups" value={tab} onValueChange={setTab} items={[
        { value: 'buttons', label: 'Buttons', controls: 'comp-panel' },
        { value: 'forms', label: 'Form controls', controls: 'comp-panel' },
        { value: 'marks', label: 'Marks & icons', controls: 'comp-panel' },
      ]} />
      <div id="comp-panel" role="tabpanel" className="comp-panel" key={tab}>
        <Write as="p" className="sub">{PANELS[tab]}</Write>
        {tab === 'buttons' && (
          <div className="row">
            <InkButton variant="solid">Save changes</InkButton>
            <InkButton>Cancel</InkButton>
            <InkButton variant="accent">Delete forever</InkButton>
            <InkButton variant="ghost">Learn more</InkButton>
            <InkButton disabled>Disabled</InkButton>
          </div>
        )}
        {tab === 'forms' && (
          <div className="grid two">
            <div className="stack tight">
              <div className="opts">
                <InkCheckbox defaultChecked>Fountain pen</InkCheckbox>
                <InkCheckbox>Fineliner</InkCheckbox>
                <InkCheckbox accent defaultChecked>Brush pen</InkCheckbox>
              </div>
              <div className="row"><InkSwitch defaultChecked>Wet ink</InkSwitch><InkSwitch>Blotting</InkSwitch></div>
            </div>
            <div className="stack tight">
              <InkProgress value={progress} label="Upload progress" />
              <div className="row">
                <InkButton onClick={() => setProgress((p) => Math.min(1, p + 0.2))}>+ 20%</InkButton>
                <InkButton variant="ghost" onClick={() => setProgress(0)}>Reset</InkButton>
              </div>
            </div>
          </div>
        )}
        {tab === 'marks' && (
          <div className="stack tight">
            <p className="marks">
              <Write>You can</Write> <InkHighlight>highlight a phrase</InkHighlight><Write>,</Write> <InkCircle>circle</InkCircle>{' '}
              <Write>a word, or</Write> <InkUnderline double>underline it twice</InkUnderline><Write>.</Write>
            </p>
            <div className="row">
              {(['home', 'mail', 'user', 'bell', 'pencil', 'trash', 'heart', 'star', 'search', 'bookmark'] as const).map((n) => <InkIcon key={n} name={n} size={30} label={n} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function GetStarted() {
  return (
    <section className="section" id="start" aria-labelledby="start-title">
      <Write as="p" className="eyebrow">Get started</Write>
      <Write as="h2" id="start-title">Up and running in a minute</Write>
      <div className="grid two start">
        <div className="stack tight">
          <Write as="p" className="sub">Install the React package, import the stylesheet, and wrap your app in a provider. Everything else is a component that takes its native element's props.</Write>
          <div className="install">
            <code>{INSTALL}</code>
            <CopyButton text={INSTALL} />
          </div>
          <ul className="facts">
            <li><Write>Works with Next.js and server rendering: the build is marked </Write><code>'use client'</code><Write>.</Write></li>
            <li><Write>Theming is a handful of CSS custom properties. Dark paper follows the system setting.</Write></li>
            <li><Write>The framework-free engine is in </Write><code>@pen-ink/core</code><Write>, and it computes geometry in Node too.</Write></li>
          </ul>
          <div className="row">
            <InkButton variant="solid" onClick={() => { location.href = `${REPO}#readme`; }}>Read the docs</InkButton>
            <InkButton onClick={() => { location.href = REPO; }}>Star on GitHub</InkButton>
          </div>
        </div>
        <InkCard className="card code" shadow="none">
          <div className="code-head"><Write as="span" className="label">App.tsx</Write><CopyButton text={QUICKSTART} /></div>
          <pre><code>{QUICKSTART}</code></pre>
        </InkCard>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <InkDivider style={{ width: '100%' }} />
      <div className="row spread">
        <Handwriting hand="casual" size={26} wrap={false}>Made with ink</Handwriting>
        <p className="fine">
          Code under the MIT license. The handwriting fonts are from the{' '}
          <a href="https://gitlab.com/oskay/svg-fonts">EMS SVG fonts</a> (SIL OFL), the Hershey vector fonts and{' '}
          <a href="https://github.com/isdat-type/Relief-SingleLine">Relief SingleLine</a> (SIL OFL).{' '}
          <a href={REPO}>Source on GitHub</a>.
        </p>
      </div>
    </footer>
  );
}

function App() {
  return (
    <>
      <a className="skip" href="#try">Skip to the demo</a>
      <Header />
      <main className="page">
        <Hero />
        <Playground />
        <Principles />
        <Components />
        <GetStarted />
      </main>
      <Footer />
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
