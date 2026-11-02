import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useState } from 'react';
import { settings } from '@pen-ink/core';
import { Handwriting, InkButton, InkCard, InkCheckbox, InkInput, InkProvider, InkRadio, InkTabs, InkTextarea, Write, usePageTurn } from '../src';

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
