// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { Drawing, DRY_DELAY, DRY_FADE, settings } from '../src/drawing';
import { SVGNS } from '../src/drawing';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setup() {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'ink-svg');
  document.body.append(svg);
  const d = new Drawing(svg);
  d.add([[0, 0], [40, 0], [40, 40]]);
  return { svg, d };
}

describe('filter settling', () => {
  afterEach(() => { settings.settleFilter = true; settings.reducedMotion = false; document.body.replaceChildren(); });

  it('holds the filter back while ink moves and dries, then settles', async () => {
    settings.reducedMotion = false;
    const { svg, d } = setup();
    const played = d.play({ duration: 60 });
    expect(svg.classList.contains('ink-moving')).toBe(true);
    await played;
    expect(svg.classList.contains('ink-moving')).toBe(true); // still drying
    await sleep(DRY_DELAY + DRY_FADE + 120);
    expect(svg.classList.contains('ink-moving')).toBe(false);
  });

  it('stays held while any drawing in the same svg is still playing', async () => {
    settings.reducedMotion = false;
    const { svg, d } = setup();
    const d2 = new Drawing(svg);
    d2.add([[0, 0], [10, 10]]);
    await d.play({ duration: 30, wet: false });
    const second = d2.play({ duration: 400, wet: false });
    await sleep(100);
    expect(svg.classList.contains('ink-moving')).toBe(true);
    await second;
    await sleep(120);
    expect(svg.classList.contains('ink-moving')).toBe(false);
  });

  it('can be turned off', async () => {
    settings.reducedMotion = false;
    settings.settleFilter = false;
    const { svg, d } = setup();
    const played = d.play({ duration: 30 });
    expect(svg.classList.contains('ink-moving')).toBe(false);
    await played;
  });
});
