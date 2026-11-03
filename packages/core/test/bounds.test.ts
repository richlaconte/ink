// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Drawing, SVGNS } from '../src/drawing';

describe('filter bounds', () => {
  it('gives each ink svg one invisible full-size rect, first', () => {
    const svg = document.createElementNS(SVGNS, 'svg');
    document.body.append(svg);
    new Drawing(svg);
    new Drawing(svg);
    const rects = svg.querySelectorAll('.ink-bounds');
    expect(rects.length).toBe(1);
    expect(svg.firstElementChild).toBe(rects[0]);
    expect(rects[0].getAttribute('fill')).toBe('none');
    expect(rects[0].getAttribute('width')).toBe('100%');
  });
});
