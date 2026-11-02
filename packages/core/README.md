# @pen-ink/core

The framework-free engine behind pen-ink: nib-modelled strokes, hand-drawn shapes, single-line handwriting, all-at-once draw timing, and page turns. Geometry is DOM-free (it runs in Node); drawing uses SVG.

```ts
import { Drawing, DEFAULT_PEN, shapes, ensureFilters } from '@pen-ink/core';
import '@pen-ink/core/styles.css';

ensureFilters();
const svg = document.querySelector('svg')!;
const d = new Drawing(svg);
d.addMany(shapes.rect(10, 10, 200, 100), { ...DEFAULT_PEN, nib: 'dip', size: 3 });
await d.play({ speed: 800 });
```

The full documentation is in the [project README](../../README.md).
