import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useState } from 'react';
import { settings } from '@pen-ink/core';
import { Handwriting, InkButton, InkCard, InkCheckbox, InkInput, InkProgress, InkProvider, InkRadio, InkTabs, InkTextarea, Write, usePageTurn } from '../src';

const paths = (el: Element) => el.querySelectorAll('.ink-stroke').length;

describe('semantics are preserved', () => {
  it('a button is a real button with its label, and gets ink', async () => {
    const onClick = vi.fn();
    render(<InkProvider><InkButton variant="solid" onClick={onClick}>Save changes</InkButton></InkProvider>);
    const btn = screen.getByRole('button', { name: 'Save changes' });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
    expect(btn.querySelector('svg.ink-layer')?.getAttribute('aria-hidden')).toBe('true');
    await waitFor(() => expect(paths(btn)).toBeGreaterThan(0));
  });

  it('plain-text labels are split into words for the write-in', () => {
    render(<InkButton>Hello there</InkButton>);
    const words = [...screen.getByRole('button').querySelectorAll('.ink-w')].map((w) => w.textContent);
    expect(words).toEqual(['Hello', 'there']);
  });

  it('handwriting keeps its real text for assistive tech', () => {
    render(<Handwriting as="h1">Field notes</Handwriting>);
    expect(screen.getByRole('heading', { name: 'Field notes' })).toBeTruthy();
  });
});

describe('form controls', () => {
  it('checkbox toggles natively and inks a tick', async () => {
    render(<InkCheckbox defaultChecked={false}>Fountain pen</InkCheckbox>);
    const box = screen.getByRole('checkbox', { name: 'Fountain pen' }) as HTMLInputElement;
    const host = box.closest('label')!;
    await waitFor(() => expect(host.querySelector('.ink-l-outline .ink-stroke')).toBeTruthy());
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    await waitFor(() => expect(host.querySelector('.ink-l-mark .ink-stroke')).toBeTruthy());
  });

  it('radios in a group stay mutually exclusive', () => {
    render(<><InkRadio name="p" defaultChecked>Rag</InkRadio><InkRadio name="p">Kraft</InkRadio></>);
    const [a, b] = screen.getAllByRole('radio') as HTMLInputElement[];
    fireEvent.click(b);
    expect(a.checked).toBe(false);
    expect(b.checked).toBe(true);
  });

  it('a controlled input keeps working and gets an ink overlay', async () => {
    function Form() { const [v, setV] = useState(''); return <InkInput label="Name" value={v} onChange={(e) => setV(e.target.value)} />; }
    render(<Form />);
    const input = screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Ada' } });
    expect(input.value).toBe('Ada');
    expect(input.closest('label')!.querySelector('.ink-written-text')).toBeTruthy();
  });

  it('password fields are never drawn in ink', () => {
    render(<InkInput label="Secret" type="password" defaultValue="hunter2" />);
    const input = screen.getByLabelText('Secret');
    expect(input.closest('label')!.querySelector('.ink-written-text')).toBeNull();
    expect(input.className).not.toContain('ink-written');
  });

  it('textareas get a multi-line overlay', () => {
    render(<InkTextarea label="Note" />);
    expect(screen.getByLabelText('Note').closest('label')!.querySelector('.ink-written-text[data-multi]')).toBeTruthy();
  });

  it('tabs support arrow-key navigation', () => {
    function T() { const [v, setV] = useState('a'); return <InkTabs aria-label="Sections" value={v} onValueChange={setV} items={[{ value: 'a', label: 'One' }, { value: 'b', label: 'Two' }]} />; }
    render(<T />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Two' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('write-in', () => {
  it('free-standing text reveals (instantly when there is no IntersectionObserver)', async () => {
    render(<Write as="p">nothing until drawn</Write>);
    await waitFor(() => expect([...document.querySelectorAll('p .ink-w')].every((w) => w.hasAttribute('data-on'))).toBe(true));
  });

  it('text inside a card appears with the card', async () => {
    render(<InkCard><Write>inside</Write></InkCard>);
    await waitFor(() => expect(document.querySelector('.ink-w')?.hasAttribute('data-on')).toBe(true));
  });
});

describe('page turn', () => {
  it('with reduced motion, swaps immediately', async () => {
    const swap = vi.fn();
    settings.reducedMotion = true;
    function C() { const turn = usePageTurn(); return <button onClick={() => turn(swap)}>go</button>; }
    render(<C />);
    await act(async () => { fireEvent.click(screen.getByText('go')); });
    expect(swap).toHaveBeenCalledOnce();
    settings.reducedMotion = false;
  });
});

describe('server rendering', () => {
  it('renders to a string without touching the DOM', () => {
    const html = renderToString(
      <InkProvider>
        <InkCard><Handwriting as="h2">Hello</Handwriting><InkButton>Go</InkButton><InkCheckbox>Tick</InkCheckbox><InkInput label="Name" /></InkCard>
      </InkProvider>,
    );
    expect(html).toContain('Hello');
    expect(html).toContain('<button');
    expect(html).toContain('type="checkbox"');
  });
});

describe('progress', () => {
  it('a value change adds or lifts only the strokes at the edge; the rest of the fill is untouched', async () => {
    // jsdom has no layout: give hosts a size so there is something to hatch.
    const ow = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300);
    const oh = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(26);
    settings.reducedMotion = true; // draw and lift instantly
    try {
      function Bar() {
        const [v, setV] = useState(0.4);
        return <><InkProgress value={v} label="Upload" /><button onClick={() => setV(0.7)}>more</button><button onClick={() => setV(0.2)}>less</button></>;
      }
      render(<InkProvider><Bar /></InkProvider>);
      const bar = screen.getByRole('progressbar');
      const fill = () => [...bar.querySelectorAll('.ink-l-fill .ink-stroke')];
      await waitFor(() => expect(fill().length).toBeGreaterThan(0));
      const at40 = fill();

      fireEvent.click(screen.getByRole('button', { name: 'more' }));
      await waitFor(() => expect(fill().length).toBeGreaterThan(at40.length));
      const at70 = fill();
      expect(at40.every((node, i) => at70[i] === node)).toBe(true); // same nodes: added to, not repainted

      fireEvent.click(screen.getByRole('button', { name: 'less' }));
      await waitFor(() => expect(fill().length).toBeLessThan(at40.length));
      const at20 = fill();
      expect(at20.every((node, i) => at40[i] === node)).toBe(true); // only the end was taken off
    } finally {
      settings.reducedMotion = false;
      ow.mockRestore();
      oh.mockRestore();
    }
  });

  it('ticks toward a moving goal one stroke at a time, turning round without redrawing', async () => {
    const ow = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300);
    const oh = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(26);
    const speed = settings.speed;
    settings.speed = 40; // real animation, just fast
    try {
      let set!: (v: number) => void;
      function Bar() { const [v, setV] = useState(0.2); set = setV; return <InkProgress value={v} label="Upload" />; }
      render(<InkProvider><Bar /></InkProvider>);
      const bar = screen.getByRole('progressbar');
      const fill = () => [...bar.querySelectorAll('.ink-l-fill .ink-stroke')].filter((n) => (n as SVGElement).style.opacity !== '0');
      await waitFor(() => expect(fill().length).toBeGreaterThan(0), { timeout: 3000 });
      await new Promise((r) => setTimeout(r, 300));
      const at20 = fill();

      act(() => set(0.9));
      // Part-way up, aim lower: it should stop adding and start taking off.
      // Wait until it's well past the halfway mark (~3× the 20% fill), then aim for 50%.
      await waitFor(() => expect(fill().length).toBeGreaterThan(at20.length * 3), { timeout: 3000 });
      const peak = fill().length;
      act(() => set(0.5));
      let last = -1, stable = 0;
      await waitFor(() => { const n = fill().length; stable = n === last ? stable + 1 : 0; last = n; expect(stable).toBeGreaterThan(5); }, { timeout: 5000, interval: 60 });
      const at50 = fill();
      expect(at50.length).toBeGreaterThan(at20.length);
      expect(at50.length).toBeLessThan(peak); // it turned round and took strokes off
      expect(at20.every((node, i) => at50[i] === node)).toBe(true); // the original fill was never redrawn

      act(() => set(0.5)); // no change in goal: nothing happens
      await new Promise((r) => setTimeout(r, 200));
      expect(fill()).toEqual(at50);
    } finally {
      settings.speed = speed;
      ow.mockRestore();
      oh.mockRestore();
    }
  });
});
