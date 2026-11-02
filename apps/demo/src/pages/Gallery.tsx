import { useState } from 'react';
import {
  Handwriting, InkArrow, InkButton, InkCard, InkCheckbox, InkCircle, InkDivider, InkHighlight, InkIcon,
  InkInput, InkProgress, InkRadio, InkSlider, InkSwitch, InkTabs, InkTextarea, InkUnderline, Write, type IconName,
} from '@pen-ink/react';

const ICON_NAMES: IconName[] = ['home', 'mail', 'user', 'bell', 'pencil', 'trash', 'heart', 'star', 'feather', 'search'];
const PANELS: Record<string, string> = {
  overview: 'The underline is redrawn under whichever tab you pick — a fresh stroke every time.',
  inks: 'Iron gall writes blue-black and darkens as it oxidises: the wet → dry shift on every stroke.',
  nibs: 'Fineliner, pointed dip pen, chisel, brush and ballpoint — each a different width function.',
};

export function Gallery() {
  const [tab, setTab] = useState('overview');
  const [progress, setProgress] = useState(0.35);
  const [nib, setNib] = useState(40);
  const [name, setName] = useState('');

  return (
    <>
      <section className="hero">
        <Write as="p" className="eyebrow">An open-source React kit</Write>
        <Handwriting as="h1" hand="allure" nib="dip" weight={0.07} id="title">pen-ink</Handwriting>
        <div className="margin-note" aria-hidden="true">
          <Handwriting hand="casual" className="ink-accent" size={20} after="#title" delay={150} id="note" wrap={false}>drawn live, stroke by stroke</Handwriting>
          <InkArrow after="#note" from="r" to="l" curve={-0.3} style={{ width: 150, height: 34, marginLeft: -96 }} />
        </div>
        <Write as="p" className="lede">Components that are drawn for you in real time, in pen and ink. Real buttons, inputs and checkboxes underneath — the ink is a layer on top.</Write>
        <InkDivider style={{ width: 280 }} />
      </section>

      <section className="section">
        <Write as="p" className="label">Buttons</Write>
        <div className="row">
          <InkButton variant="solid">Save changes</InkButton>
          <InkButton>Cancel</InkButton>
          <InkButton variant="accent">Delete forever</InkButton>
          <InkButton variant="ghost">Learn more</InkButton>
          <InkButton disabled>Disabled</InkButton>
          <InkButton aria-label="Search" style={{ padding: '10px 12px' }}><InkIcon name="search" size={22} /></InkButton>
        </div>
      </section>

      <section className="section">
        <Write as="p" className="label">Cards</Write>
        <div className="grid three">
          <InkCard as="article" className="card"><InkIcon name="feather" size={36} /><Write as="h3">Drawn, not decorated</Write><Write as="p">Every border is a pen path with its own pressure and wobble — stable between visits.</Write></InkCard>
          <InkCard as="article" className="card"><InkIcon name="bookmark" size={36} /><Write as="h3">Semantic underneath</Write><Write as="p">The ink is an aria-hidden SVG layer. Focus, forms and screen readers see ordinary HTML.</Write></InkCard>
          <InkCard as="article" className="card" sketch="sketch"><InkIcon name="sun" size={36} /><Write as="h3">Sketch style</Write><Write as="p">Four overshooting lines instead of one loop: the architect's-notebook look.</Write></InkCard>
        </div>
      </section>

      <section className="section grid two">
        <InkCard as="form" className="card form" shadow="none" onSubmit={(e) => e.preventDefault()}>
          <div><Write as="span" className="label">Your name</Write><InkInput label="Your name" placeholder="Ada Lovelace" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Write as="span" className="label">A short note</Write><InkTextarea label="A short note" boxed rows={3} placeholder="Write something…" /></div>
          <div>
            <Write as="span" className="label">Pens you own</Write>
            <div className="opts">
              <InkCheckbox defaultChecked>Fountain pen</InkCheckbox>
              <InkCheckbox>Fineliner</InkCheckbox>
              <InkCheckbox accent>Brush pen</InkCheckbox>
              <InkCheckbox defaultChecked>Dip pen</InkCheckbox>
            </div>
          </div>
          <div>
            <Write as="span" className="label">Paper</Write>
            <div className="opts">
              <InkRadio name="paper" defaultChecked>Cotton rag</InkRadio>
              <InkRadio name="paper">Dot grid</InkRadio>
              <InkRadio name="paper">Kraft</InkRadio>
            </div>
          </div>
          <div className="row spread"><InkSwitch defaultChecked>Wet ink effect</InkSwitch><InkSwitch>Blotting</InkSwitch></div>
          <div><Write as="span" className="label">Nib width</Write><InkSlider aria-label="Nib width" value={nib} onChange={(e) => setNib(Number(e.target.value))} /></div>
          <div className="row"><InkButton variant="solid" type="submit">Send it</InkButton><InkButton variant="ghost" type="reset">Reset</InkButton></div>
        </InkCard>

        <div className="stack">
          <div>
            <Write as="p" className="label">Tabs</Write>
            <InkTabs aria-label="Topics" value={tab} onValueChange={setTab} items={[{ value: 'overview', label: 'Overview', controls: 'panel' }, { value: 'inks', label: 'Inks', controls: 'panel' }, { value: 'nibs', label: 'Nibs', controls: 'panel' }]} />
            <Write as="p" id="panel" role="tabpanel" className="panel" key={tab}>{PANELS[tab]}</Write>
          </div>
          <div>
            <Write as="p" className="label">Progress</Write>
            <InkProgress value={progress} label="Upload progress" />
            <div className="row" style={{ marginTop: 14 }}>
              <InkButton onClick={() => setProgress((p) => Math.min(1, p + 0.2))}>+ 20%</InkButton>
              <InkButton variant="ghost" onClick={() => setProgress(0)}>Reset</InkButton>
            </div>
          </div>
          <div>
            <Write as="p" className="label">Inline marks</Write>
            <p className="marks">
              <Write>Ink lets you</Write> <InkHighlight>highlight a phrase</InkHighlight><Write>,</Write> <InkCircle>circle</InkCircle> <Write>a word, or</Write>{' '}
              <InkUnderline as="a" href="#" hover onClick={(e) => e.preventDefault()}>underline on hover</InkUnderline> <Write>— and</Write> <InkUnderline double>for emphasis</InkUnderline><Write>.</Write>
            </p>
          </div>
          <div>
            <Write as="p" className="label">Icons</Write>
            <div className="row">{ICON_NAMES.map((n) => <InkIcon key={n} name={n} size={30} label={n} />)}</div>
          </div>
        </div>
      </section>
    </>
  );
}
