import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Handwriting, InkArrow, InkButton, InkCard, InkCheckbox, InkCircle, InkDivider, InkHighlight, InkIcon,
  InkInput, InkProgress, InkProvider, InkRadio, InkSlider, InkSwitch, InkTabs, InkUnderline,
  type HandwritingProps, type NibKind,
} from '@pen-ink/react';
import { handKeys, handNames, type HandKey } from '@pen-ink/fonts';
import '@pen-ink/react/styles.css';
import './site.css';

const REPO = 'https://github.com/richlaconte/ink';
const INSTALL = 'npm install @pen-ink/react';

/* ---------- Drawn type ----------
 * Every visible string on this page is put down stroke by stroke. Size comes from the
 * element's CSS font-size (Handwriting uses font-size × 1.15), so the stylesheet still
 * sets the type scale. The real text stays in the DOM for screen readers and copy/paste. */
type TextProps = Omit<HandwritingProps, 'children' | 'hand'> & { children: string };

/** Body copy and UI labels: the most legible single-line hand. */
const Body = (p: TextProps) => <Handwriting hand="readability" {...p} />;
/** Section headings and card titles. */
const Head = (p: TextProps) => <Handwriting hand="casual" nib="dip" weight={0.075} {...p} />;
/** Small caps labels, the install line and code: a plotter hand in place of monospace. */
const Mono = ({ children, caps, ...p }: TextProps & { caps?: boolean }) => (
  <Handwriting hand="hershey-sans" weight={0.07} {...p}>{caps ? children.toUpperCase() : children}</Handwriting>
);
/** A short label inside a button, link, tab or form control. */
const Label = (p: TextProps) => <Body wrap={false} {...p} />;

const NIBS: { value: NibKind; label: string }[] = [
  { value: 'fine', label: 'Fineliner' },
  { value: 'dip', label: 'Dip pen' },
  { value: 'broad', label: 'Chisel' },
  { value: 'brush', label: 'Brush' },
  { value: 'ball', label: 'Ballpoint' },
];
const shortHand = (k: HandKey) => handNames[k].replace(/ (1-stroke|medium|SingleLine|Hand)$/, '');

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

/** True below the phone breakpoint; follows the window as it resizes. */
const NARROW = '(max-width: 560px)';
function useNarrow() {
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(NARROW).matches);
  useEffect(() => {
    const mq = matchMedia(NARROW), on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}
const prefersReducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.inkTheme ? root.dataset.inkTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.inkTheme = dark ? 'light' : 'dark';
  try { localStorage.setItem('ink-theme', root.dataset.inkTheme); } catch {}
}

function CopyButton({ text }: { text: string }) {
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
      {/* Changing the text writes the difference: "Copy" grows a "ied". */}
      <Label>{copied ? 'Copied' : 'Copy'}</Label>
    </InkButton>
  );
}

function Install() {
  return (
    <div className="install">
      <Mono as="code" wrap={false}>{INSTALL}</Mono>
      <CopyButton text={INSTALL} />
    </div>
  );
}

const Eyebrow = ({ children }: { children: string }) => <Mono as="p" caps className="eyebrow ink-accent" wrap={false}>{children}</Mono>;
const SmallLabel = ({ children, as = 'span' }: { children: string; as?: 'span' | 'legend' }) => <Mono as={as} caps className="label" wrap={false}>{children}</Mono>;

function Header({ narrow }: { narrow: boolean }) {
  return (
    <header className="topbar">
      <a className="brand" href="#top" aria-label="pen-ink home"><Mono caps wrap={false}>pen-ink</Mono></a>
      <nav aria-label="Main">
        {/* On a phone the page is one scroll; the section links just crowd the bar. */}
        {!narrow && <InkUnderline as="a" href="#try" hover><Label>Try it</Label></InkUnderline>}
        {!narrow && <InkUnderline as="a" href="#components" hover><Label>Components</Label></InkUnderline>}
        {!narrow && <InkUnderline as="a" href="#start" hover><Label>Get started</Label></InkUnderline>}
        <InkUnderline as="a" href={REPO} hover><Label>GitHub</Label></InkUnderline>
        <button className="theme" aria-label="Toggle dark paper" onClick={toggleTheme}><InkIcon name="moon" size={20} /></button>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <Eyebrow>Open-source React components</Eyebrow>
      <Handwriting as="h1" hand="allure" nib="dip" weight={0.07} id="title">pen-ink</Handwriting>
      <div className="margin-note" aria-hidden="true">
        <Handwriting hand="casual" className="ink-accent" size={20} after="#title" delay={150} id="note" wrap={false}>drawn live, stroke by stroke</Handwriting>
        <InkArrow after="#note" from="r" to="l" curve={-0.3} style={{ width: 150, height: 34, marginLeft: -96 }} />
      </div>
      <Body as="p" className="lede">
        Interfaces that are drawn for you in real time, in pen and ink. Underneath, a button is still a button and a checkbox is still a checkbox. The ink is a layer on top. Even this sentence is being written as you read it.
      </Body>
      <Install />
      <div className="row cta">
        <InkButton variant="solid" onClick={() => document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' })}><Label>Try it below</Label></InkButton>
        <InkButton onClick={() => { location.href = REPO; }}><Label>View on GitHub</Label></InkButton>
      </div>
    </section>
  );
}

/** Phone hero: a big title with its margin note, and a live card that shows the pen at work. */
function HeroNarrow() {
  // The second and third items tick themselves once the page has sketched in.
  const [ticks, setTicks] = useState([true, false, false]);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const t1 = setTimeout(() => setTicks((t) => [t[0], true, t[2]]), 2600);
    const t2 = setTimeout(() => setTicks((t) => [t[0], t[1], true]), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const toggle = (i: number) => () => setTicks((t) => t.map((v, j) => (j === i ? !v : v)));
  const ITEMS = ['A button is still a button', 'Screen readers get real text', 'Keyboard focus just works'];
  return (
    <section className="hero hero-narrow" id="top">
      <Eyebrow>Open-source React components</Eyebrow>
      <Handwriting as="h1" hand="allure" nib="dip" weight={0.07} id="title">pen-ink</Handwriting>
      <div className="note-narrow" aria-hidden="true">
        <InkArrow after="#title" from="br" to="tl" curve={-0.35} className="note-arrow" />
        <Handwriting hand="casual" className="ink-accent" size={20} after="#title" delay={150} wrap={false}>drawn live, stroke by stroke</Handwriting>
      </div>
      <Body as="p" className="lede">Interfaces drawn for you in real time, in pen and ink. Underneath, it's all ordinary HTML.</Body>
      <InkCard as="figure" className="card demo-card" sketch="sketch">
        <SmallLabel>Field notes</SmallLabel>
        <Head as="p" className="demo-title">What the ink doesn't change</Head>
        <div className="demo-list">
          {ITEMS.map((text, i) => (
            <InkCheckbox key={text} checked={ticks[i]} onChange={toggle(i)}><Label>{text}</Label></InkCheckbox>
          ))}
        </div>
      </InkCard>
      <div className="cta-narrow">
        <InkButton variant="solid" onClick={() => document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' })}><Label>Try it</Label></InkButton>
        <InkButton onClick={() => { location.href = REPO; }}><Label>GitHub</Label></InkButton>
      </div>
      <Install />
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
      <Eyebrow>Try it</Eyebrow>
      <Head as="h2" id="try-title" wrap={false}>Write something</Head>
      <Body as="p" className="sub">Type in the field. It's a native input, but the letters are put down in ink. The card on the right writes the same words in whichever hand and nib you choose.</Body>
      <div className="grid two play">
        <InkCard as="form" className="card form" shadow="none" onSubmit={(e) => e.preventDefault()}>
          <div>
            <SmallLabel>Your words</SmallLabel>
            <InkInput label="Your words" value={text} maxLength={48} onChange={(e) => setText(e.target.value)} />
          </div>
          <fieldset>
            <SmallLabel as="legend">Hand</SmallLabel>
            <div className="opts">
              {handKeys.map((k) => (
                <InkRadio key={k} name="hand" checked={hand === k} onChange={() => setHand(k)}><Label>{shortHand(k)}</Label></InkRadio>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <SmallLabel as="legend">Nib</SmallLabel>
            <div className="opts">
              {NIBS.map((n) => (
                <InkRadio key={n.value} name="nib" checked={nib === n.value} onChange={() => setNib(n.value)}><Label>{n.label}</Label></InkRadio>
              ))}
            </div>
          </fieldset>
          <div>
            <SmallLabel>Slant</SmallLabel>
            <InkSlider aria-label="Slant" min={-20} max={40} value={slant} onChange={(e) => setSlant(Number(e.target.value))} />
          </div>
        </InkCard>
        <div className="stack">
          <InkCard className="card output" sketch="sketch">
            <SmallLabel>{`${shortHand(hand)} · ${NIBS.find((n) => n.value === nib)!.label}`}</SmallLabel>
            <Handwriting key={replay} as="p" className="written" hand={hand} nib={nib} slant={slant / 100} size={44} weight={nib === 'fine' || nib === 'ball' ? 0.05 : 0.08}>{shown}</Handwriting>
          </InkCard>
          <div className="row">
            <InkButton onClick={() => setReplay((r) => r + 1)}><InkIcon name="pencil" size={18} /> <Label>Write it again</Label></InkButton>
          </div>
          <Body as="p" className="hint">Editing the text writes only the difference, and deleted letters lift off. The real text stays in the DOM, so screen readers and copy/paste get plain words.</Body>
        </div>
      </div>
    </section>
  );
}

const PRINCIPLES: { icon: 'feather' | 'pencil' | 'bookmark' | 'sun' | 'star' | 'heart'; title: string; body: string; sketch?: boolean }[] = [
  { icon: 'feather', title: 'Centrelines, not outlines', body: "Each mark is the path a pen travels, plus a nib model that turns direction and pressure into line weight. A dip pen swells on downstrokes. A chisel nib's width depends on direction." },
  { icon: 'pencil', title: 'Human timing', body: 'Strokes follow a minimum-jerk velocity profile, and the pen lifts and travels between them. Fresh ink goes down blue-black, then dries darker.' },
  { icon: 'bookmark', title: 'Semantic underneath', body: 'The ink is an aria-hidden SVG layer. Focus, forms, autofill and screen readers all see ordinary HTML, and anyone who prefers reduced motion gets everything drawn at once.' },
  { icon: 'sun', title: 'Loading is sketching', body: 'Everything that appears together draws together, inside a shared time budget. Budgets only ever compress a drawing, never stretch it.' },
  { icon: 'star', title: 'Stable imperfection', body: 'Wobble comes from seeded randomness, so an element is wonky in the same way on every visit.', sketch: true },
  { icon: 'heart', title: 'Eleven hands', body: "Single-line plotter fonts, from Hershey's 1967 vector type to modern scripts. Each one lazy-loads only when it's used.", sketch: true },
];

function Principles() {
  return (
    <section className="section" aria-labelledby="how-title">
      <Eyebrow>How it works</Eyebrow>
      <Head as="h2" id="how-title" wrap={false}>A pen, not a filter</Head>
      <div className="grid three">
        {PRINCIPLES.map((p) => (
          <InkCard key={p.title} as="article" className="card" sketch={p.sketch ? 'sketch' : 'loop'}>
            <InkIcon name={p.icon} size={34} />
            <Head as="h3" nib="fine" weight={0.065}>{p.title}</Head>
            <Body as="p" className="soft">{p.body}</Body>
          </InkCard>
        ))}
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
      <Eyebrow>Components</Eyebrow>
      <Head as="h2" id="comp-title">The usual kit, drawn by hand</Head>
      <InkTabs aria-label="Component groups" value={tab} onValueChange={setTab} items={[
        { value: 'buttons', label: <Label>Buttons</Label>, controls: 'comp-panel' },
        { value: 'forms', label: <Label>Form controls</Label>, controls: 'comp-panel' },
        { value: 'marks', label: <Label>Marks & icons</Label>, controls: 'comp-panel' },
      ]} />
      <div id="comp-panel" role="tabpanel" className="comp-panel" key={tab}>
        <Body as="p" className="sub">{PANELS[tab]}</Body>
        {tab === 'buttons' && (
          <div className="row">
            <InkButton variant="solid"><Label>Save changes</Label></InkButton>
            <InkButton><Label>Cancel</Label></InkButton>
            <InkButton variant="accent"><Label>Delete forever</Label></InkButton>
            <InkButton variant="ghost"><Label>Learn more</Label></InkButton>
            <InkButton disabled><Label>Disabled</Label></InkButton>
          </div>
        )}
        {tab === 'forms' && (
          <div className="grid two">
            <div className="stack tight">
              <div className="opts">
                <InkCheckbox defaultChecked><Label>Fountain pen</Label></InkCheckbox>
                <InkCheckbox><Label>Fineliner</Label></InkCheckbox>
                <InkCheckbox accent defaultChecked><Label>Brush pen</Label></InkCheckbox>
              </div>
              <div className="row"><InkSwitch defaultChecked><Label>Wet ink</Label></InkSwitch><InkSwitch><Label>Blotting</Label></InkSwitch></div>
            </div>
            <div className="stack tight">
              <InkProgress value={progress} label="Upload progress" />
              <div className="row">
                <InkButton onClick={() => setProgress((p) => Math.min(1, p + 0.2))}><Label>+ 20%</Label></InkButton>
                <InkButton variant="ghost" onClick={() => setProgress(0)}><Label>Reset</Label></InkButton>
              </div>
            </div>
          </div>
        )}
        {tab === 'marks' && (
          <div className="stack tight">
            <p className="marks">
              <Label>You can</Label>
              <InkHighlight><Label>highlight a phrase,</Label></InkHighlight>
              <InkCircle><Label>circle</Label></InkCircle>
              <Label>a word, or</Label>
              <InkUnderline double><Label>underline it twice.</Label></InkUnderline>
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

const FACTS = [
  "Works with Next.js and server rendering: the build is marked 'use client'.",
  'Theming is a handful of CSS custom properties. Dark paper follows the system setting.',
  'The framework-free engine is in @pen-ink/core, and it computes geometry in Node too.',
];

function GetStarted() {
  return (
    <section className="section" id="start" aria-labelledby="start-title">
      <Eyebrow>Get started</Eyebrow>
      <Head as="h2" id="start-title">Up and running in a minute</Head>
      <div className="grid two start">
        <div className="stack tight">
          <Body as="p" className="sub">Install the React package, import the stylesheet, and wrap your app in a provider. Everything else is a component that takes its native element's props.</Body>
          <Install />
          <ul className="facts">
            {FACTS.map((f) => <li key={f}><Body className="soft">{f}</Body></li>)}
          </ul>
          <div className="row">
            <InkButton variant="solid" onClick={() => { location.href = `${REPO}#readme`; }}><Label>Read the docs</Label></InkButton>
            <InkButton onClick={() => { location.href = REPO; }}><Label>Star on GitHub</Label></InkButton>
          </div>
        </div>
        <InkCard className="card code" shadow="none">
          <div className="code-head"><SmallLabel>App.tsx</SmallLabel><CopyButton text={QUICKSTART} /></div>
          {/* Drawn with its line breaks and indentation; scrolls sideways on narrow screens. */}
          <div className="code-body"><Mono as="pre" wrap={false}>{QUICKSTART}</Mono></div>
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
        <Head wrap={false} size={26}>Made with ink</Head>
        <div className="fine">
          <Body as="p" className="soft">Code under the MIT license. The handwriting fonts are the EMS SVG fonts and Relief SingleLine (both SIL OFL), and the Hershey vector fonts.</Body>
          <p className="links">
            <InkUnderline as="a" href={REPO} hover><Label>Source on GitHub</Label></InkUnderline>
            <InkUnderline as="a" href="https://gitlab.com/oskay/svg-fonts" hover><Label>EMS SVG fonts</Label></InkUnderline>
            <InkUnderline as="a" href="https://github.com/isdat-type/Relief-SingleLine" hover><Label>Relief SingleLine</Label></InkUnderline>
          </p>
        </div>
      </div>
    </footer>
  );
}

function App() {
  const narrow = useNarrow();
  return (
    <>
      <a className="skip" href="#try">Skip to the demo</a>
      <Header narrow={narrow} />
      <main className="page">
        {narrow ? <HeroNarrow /> : <Hero />}
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
