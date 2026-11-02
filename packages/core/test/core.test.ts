import { describe, expect, it } from 'vitest';
import { flattenPath, samplePath, resample, arcLengths } from '../src/path';
import { rng, hash } from '../src/random';
import { Stroke, DEFAULT_PEN } from '../src/stroke';
import * as S from '../src/shapes';
import { layout, measure, glyphStrokes, type InkHand } from '../src/text';
import { writeSchedule } from '../src/reveal';
import { turnGeometry } from '../src/pageTurn';
import { ICONS } from '../src/icons';
import { readFileSync } from 'node:fs';

const len = (pts: [number, number][]) => arcLengths(pts).at(-1)!;
const area = (p: [number, number][]) => Math.abs(p.reduce((a, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return a + x * y2 - x2 * y; }, 0) / 2);
const casual: InkHand = { key: 'casual', ...JSON.parse(readFileSync(new URL('../../fonts/data/json/casual.json', import.meta.url), 'utf8')) };

describe('path flattening', () => {
  it('handles absolute and relative lines, H/V and closepath', () => {
    const [sq] = flattenPath('M0 0 h10 v10 H0 z');
    expect(len(sq)).toBeCloseTo(40, 5);
    expect(sq.at(-1)).toEqual([0, 0]);
  });
  it('splits subpaths on moveto', () => {
    expect(flattenPath('M0 0 L10 0 M0 5 l10 0')).toHaveLength(2);
  });
  it('flattens a full circle drawn as two arcs to the right circumference', () => {
    const [c] = flattenPath('M0 10 A10 10 0 1 1 20 10 A10 10 0 1 1 0 10', 0.2);
    expect(len(c)).toBeCloseTo(2 * Math.PI * 10, 0);
  });
  it('flattens cubic and smooth-cubic curves (font-style relative commands)', () => {
    const [p] = flattenPath('M437 308h-61c-202 0 -286 -53 -286 -167c0 -73 44 -141 139 -141s153 57 208 130', 4);
    expect(p.length).toBeGreaterThan(50);
    expect(p.at(-1)![0]).toBeCloseTo(437 - 61 - 286 + 139 + 208, 3);
  });
  it('turns a lone moveto (a dot) into a tiny stroke', () => {
    expect(flattenPath('M5 5')).toHaveLength(1);
  });
  it('every bundled icon flattens', () => {
    for (const [name, d] of Object.entries(ICONS)) expect(samplePath(d, 0.5).length, name).toBeGreaterThan(0);
  });
  it('resamples at a uniform spacing', () => {
    const r = resample([[0, 0], [100, 0]], 10);
    expect(r).toHaveLength(11);
    expect(r[3][0]).toBeCloseTo(30);
  });
});

describe('randomness', () => {
  it('is deterministic per seed', () => {
    const a = rng(42), b = rng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(hash('ink')).toBe(hash('ink'));
    expect(hash('ink')).not.toBe(hash('ink!'));
  });
});

describe('stroke + nibs', () => {
  const down: [number, number][] = Array.from({ length: 50 }, (_, i) => [0, i * 2]);
  const up: [number, number][] = [...down].reverse();
  const mid = (s: Stroke) => s.w[Math.floor(s.w.length / 2)];
  it('a dip pen swells on downstrokes and hairlines on upstrokes', () => {
    const pen = { ...DEFAULT_PEN, nib: 'dip' as const, size: 4 };
    expect(mid(new Stroke(down, pen))).toBeGreaterThan(mid(new Stroke(up, pen)) * 3);
  });
  it('a chisel nib is thin along its own angle and thick across it', () => {
    const pen = { ...DEFAULT_PEN, nib: 'broad' as const, size: 8, angle: 0 };
    // Ink width = how far the nib's edges sit apart, measured perpendicular to travel.
    const along = new Stroke(resample([[0, 0], [100, 0]], 2), pen);   // travelling along the nib
    const across = new Stroke(resample([[0, 0], [0, 100]], 2), pen);  // travelling across it
    const mid = (s: Stroke) => Math.floor(s.pts.length / 2);
    const spreadY = (s: Stroke) => Math.abs(s.L[mid(s)][1] - s.R[mid(s)][1]);
    const spreadX = (s: Stroke) => Math.abs(s.L[mid(s)][0] - s.R[mid(s)][0]);
    expect(spreadY(along)).toBeLessThan(1e-9);  // nib edge-on: a hairline
    expect(spreadX(across)).toBeGreaterThan(6); // nib face-on: close to its full 8px
  });
  it('partial outlines grow with arc length and end in a round tip', () => {
    const s = new Stroke(down, DEFAULT_PEN);
    expect(s.d(0)).toBe('');
    expect(s.d(s.len / 2).length).toBeLessThan(s.d().length);
    expect(s.d()).toMatch(/A[\d.]+ [\d.]+ 0 0 0/);
  });
});

describe('shapes', () => {
  it('produces humanised, seed-stable strokes', () => {
    const a = S.rect(0, 0, 100, 50, { seed: 3 }), b = S.rect(0, 0, 100, 50, { seed: 3 }), c = S.rect(0, 0, 100, 50, { seed: 4 });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(S.rect(0, 0, 100, 50, { style: 'sketch' })).toHaveLength(4);
  });
  it('hatching stays inside its shape', () => {
    const lines = S.hatch({ type: 'rect', x: 0, y: 0, w: 100, h: 40 }, { gap: 5, wobble: 0 });
    expect(lines.length).toBeGreaterThan(10);
    for (const l of lines) for (const [x, y] of l) { expect(x).toBeGreaterThan(-3); expect(x).toBeLessThan(103); expect(y).toBeGreaterThan(-3); expect(y).toBeLessThan(43); }
  });
  it('hatchPolygon respects concave shapes (even-odd)', () => {
    const L: [number, number][] = [[0, 0], [10, 0], [10, 30], [30, 30], [30, 40], [0, 40]];
    expect(S.hatchPolygon(L, { gap: 3, wobble: 0 }).length).toBeGreaterThan(5);
  });
});

describe('handwriting layout', () => {
  it('advances match the font, so a metrics webfont lines up exactly', () => {
    const w = measure('Ada Lovelace', casual, 24);
    const expected = [...'Ada Lovelace'].reduce((a, c) => a + casual.g[c][0], 0) * 24 / casual.upm;
    expect(w).toBeCloseTo(expected, 6);
  });
  it('wraps on spaces within the width', () => {
    const lay = layout('the quick brown fox jumps over the lazy dog', casual, { size: 20, width: 150 });
    const lines = new Set(lay.glyphs.map((g) => g.y));
    expect(lines.size).toBeGreaterThan(1);
    for (const g of lay.glyphs) if (g.ch !== ' ') expect(g.x).toBeLessThan(150);
  });
  it('glyph strokes are deterministic per seed and index', () => {
    const g = { ch: 'a', i: 0, x: 0, y: 0 };
    const o = { size: 30, jitter: 1, slant: 0, seed: 1 };
    expect(glyphStrokes(casual, g, o)).toEqual(glyphStrokes(casual, g, o));
    expect(glyphStrokes(casual, { ...g, i: 1 }, o)).not.toEqual(glyphStrokes(casual, g, o));
  });
});

describe('write-in schedule', () => {
  const words = [{ width: 100, top: 0 }, { width: 100, top: 0 }, { width: 100, top: 30 }];
  it('runs words in order with a pause at line breaks', () => {
    const s = writeSchedule(words, 0);
    expect(s[1].delay).toBeCloseTo(s[0].duration);
    expect(s[2].delay).toBeGreaterThan(s[1].delay + s[1].duration);
  });
  it('compresses to fit a budget but never stretches', () => {
    const tight = writeSchedule(words, 100), loose = writeSchedule(words, 100000), natural = writeSchedule(words, 0);
    const end = (s: typeof tight) => s.at(-1)!.delay + s.at(-1)!.duration;
    expect(end(tight)).toBeCloseTo(100, 0);
    expect(end(loose)).toBeCloseTo(end(natural), 6);
  });
});

describe('page turn geometry', () => {
  it('conserves the page: flat part + lifted part = whole page', () => {
    for (const e of [0.1, 0.3, 0.6, 0.9]) {
      const g = turnGeometry(e, 1200, 800);
      expect(area(g.page) + area(g.lifted)).toBeCloseTo(1200 * 800, -2);
      expect(area(g.flap)).toBeCloseTo(area(g.lifted), -2); // a reflection preserves area
    }
  });
  it('is fully turned at the end and mirrors for turning back', () => {
    expect(area(turnGeometry(1, 1200, 800).page)).toBeLessThan(1);
    const a = turnGeometry(0.4, 1000, 700), b = turnGeometry(0.4, 1000, 700, true);
    expect(area(a.page)).toBeCloseTo(area(b.page), 3);
    expect(b.P[0]).toBeCloseTo(1000 - a.P[0], 6);
  });
});
