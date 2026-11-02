# @pen-ink/fonts

Single-line ("plotter") handwriting fonts for [pen-ink](../../README.md). Each glyph is stored as the path a pen travels, rather than as an outline, which is what lets pen-ink *write* text stroke by stroke.

```ts
import { hands } from '@pen-ink/fonts';
const casual = await hands.casual(); // each hand is its own lazily-loaded chunk
```

There are 11 hands: allure, casual, delight, elfin, felix, pepita, readability, hershey-script, hershey-sans, hershey-serif, relief. See [licenses/](licenses/README.md).
