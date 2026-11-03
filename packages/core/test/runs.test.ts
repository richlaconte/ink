import { describe, expect, it } from 'vitest';
import { measure, textRuns, type InkHand } from '../src';

const hand: InkHand = { key: 't', name: 't', upm: 100, ascent: 80, descent: 20, xh: 50, cap: 70, g: { a: [50, ''], b: [60, ''], ' ': [25, ''], '?': [40, ''] } };

describe('textRuns', () => {
  it('splits into word+trailing-space runs that rejoin to the text', () => {
    const t = '  ab  b\nba a ';
    const runs = textRuns(t, hand, 10);
    expect(runs.map((r) => r.text)).toEqual(['  ', 'ab  ', 'b', '\n', 'ba ', 'a ']);
    expect(runs.map((r) => r.text).join('')).toBe(t);
  });
  it('gives each run its ink width', () => {
    const runs = textRuns('ab b', hand, 10);
    expect(runs[0].width).toBeCloseTo(measure('ab ', hand, 10));
    expect(runs[0].width).toBeCloseTo(13.5);
  });
});
