# pen-ink

**[Live site & playground →](https://richlaconte.github.io/ink/)**

React components that are **drawn for you in real time, in pen and ink**. Buttons, cards, form controls and headings sketch themselves in; inputs write your text in ink as you type; pages turn like paper.

Underneath it's all ordinary, semantic HTML: a `<button>` is still a button, a checkbox is a native checkbox, and the ink is an `aria-hidden` SVG layer on top.

```tsx
import { InkProvider, InkButton, InkCard, Handwriting, InkInput, Write } from '@pen-ink/react';
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
}
```

## Packages

| Package | What it is |
|---|---|
| [`@pen-ink/react`](packages/react) | React components and hooks |
| [`@pen-ink/core`](packages/core) | The framework-free engine: nib-modelled strokes, hand-drawn shapes, single-line handwriting, timing, page turns. Works without React and runs in Node (no DOM needed for geometry). |
| [`@pen-ink/fonts`](packages/fonts) | 11 single-line ("plotter") handwriting fonts, each lazy-loaded, with matching metrics webfonts |

```sh
npm install @pen-ink/react
```

## How it works

- **Centrelines, not outlines.** Every mark is the path a pen travels, plus a *nib model* that turns direction and position into line weight. A fineliner is uniform, a dip pen swells on downstrokes, and a chisel nib's width depends on direction.
- **Human timing.** Strokes follow a minimum-jerk velocity profile, and the pen lifts and travels between strokes. Fresh ink is "wet" (blue-black) and dries darker.
- **Loading is sketching.** Everything that comes into view together draws *at once* inside a shared time budget (1.4 s on load by default, 0.9 s for content scrolled into view later). Budgets only ever compress a drawing, never stretch it.
- **Nothing appears until it's drawn.** Text wrapped in `<Write>` (and plain-text labels of components) writes itself in left to right, timed by word width.
- **Stable imperfection.** Wobble comes from seeded randomness, so an element is wonky the same way on every visit.

## Components

All components accept their native element's props, plus these ordering props:

| Prop | |
|---|---|
| `after` | `'load'`, an element ref, or `'#id'`: draw after the page's initial sketch-in or after that element finishes |
| `delay` | extra ms before drawing |
| `duration` | override the time budget (ms) |

| Component | Notes |
|---|---|
| `<InkButton variant="outline \| solid \| accent \| ghost">` | Line boil on hover (`boil={false}` to disable); hand-drawn focus loop for keyboard focus. Solid and accent use a marker fill, so label contrast stays solid. |
| `<InkCard as sketch="loop \| sketch" shadow="hatch \| none">` | Outline plus hatched shadow. Content inside `<Write>` appears with the card. |
| `<Handwriting as hand nib size weight speed jitter slant wrap>` | Text written stroke by stroke. Changing the text writes the difference, and removed letters lift off. The real text stays in the DOM for screen readers and copy/paste. |
| `<Write as after>` | Writes ordinary (web font) text in, word by word. Inside an ink component it appears with that component's ink. |
| `<InkInput>`, `<InkTextarea>` | The typed text is drawn in ink. The native field does all the editing (caret, selection, IME, undo, autofill): it's set in an invisible *metrics font* whose advance widths match the ink exactly, so the caret and selection line up. Props: `label`, `boxed`, `write={false}`, `hand`. Password, number and date inputs stay native. Works controlled or uncontrolled. |
| `<InkCheckbox accent>`, `<InkRadio>`, `<InkSwitch>` | Native inputs (visually hidden, still focusable). |
| `<InkSlider>` | Native range input with a hand-drawn track and knob. |
| `<InkProgress value={0..1}>` | Hatched fill that ticks toward the value one stroke at a time (adding or lifting strokes); a new value mid-way just changes direction. `role="progressbar"` with values. |
| `<InkTabs items value onValueChange>` | Tablist with arrow-key navigation; the underline is redrawn under the selected tab. You render the panels. |
| `<InkHighlight>`, `<InkCircle>`, `<InkUnderline hover double as>` | Inline marks. Use `hover` for links (`as="a"`). |
| `<InkDivider>`, `<InkIcon name size label>`, `<InkArrow from to curve>` | Icons: home, mail, user, bell, pencil, trash, heart, star, feather, search, plus, x, bookmark, sun, moon, arrow. Arrows are for margin notes: `<InkArrow after="#note" from="r" to="l" />`. |

### `<InkProvider>`

```tsx
<InkProvider
  loadDuration={1400}      // ms, initial sketch-in budget
  revealDuration={900}     // ms, for content scrolled into view later
  reveal="together"        // or "stagger" (one element after another)
  speed={1}                // global speed multiplier
  hand="casual"            // default hand
  filter={{ rough: 1.1, bleed: 0.45, grain: 0.35 }}
>
```

Components also work without a provider, using defaults.

### Custom drawings: `useInkLayer`

```tsx
import { useRef } from 'react';
import { useInkLayer, shapes } from '@pen-ink/react';

function Stamp() {
  const ref = useRef<HTMLDivElement>(null);
  const { svgRef } = useInkLayer(ref, {
    draw: (ink, { animate, duration }) =>
      ink.paint('outline', shapes.ellipse(ink.w / 2, ink.h / 2, ink.w / 2, ink.h / 2), { animate, duration }),
  });
  return (
    <div ref={ref} className="ink-host" style={{ width: 120, height: 120 }}>
      <svg ref={svgRef} className="ink-layer" aria-hidden="true" />
    </div>
  );
}
```

`ink.paint(layer, strokes, opts)` and `ink.erase(layer)` manage named layers. For incremental changes, `ink.layer(name)` returns the layer's `Drawing`: `add()` strokes and `play()` animates only the new ones, and `lift(items)` takes particular strokes off, so the rest of the drawing stays as it was (this is how `InkProgress` grows and shrinks). `shapes` includes `line`, `rect`, `pill`, `ellipse`, `circleAround`, `hatch`, `crosshatch`, `scribbleFill`, `hatchPolygon`, `check`, `cross`, `underline`, `strike`, `scratchOut`, `arrow`, `flourish`, `spiral` and `fromPath`.

## Page turns

```tsx
const turn = usePageTurn();
// React Router, Next.js router, anything: swap the view as the flap finishes.
<a href="/notes" onClick={(e) => { e.preventDefault(); turn(() => navigate('/notes')); }}>Notes</a>
// Going back? Turn the other way:
turn(() => navigate(-1), { flip: true });
```

The current view is clipped away along a 2D page-curl fold, revealing blank paper, and the next view sketches in with the load budget. For multi-page (non-SPA) sites, `installLinkTurns()` from `@pen-ink/core` turns the page on same-origin link clicks.

## Server rendering & Next.js

The components are client components (the build includes `'use client'`) and render to HTML on the server. To avoid server-rendered text flashing before it's drawn, add `<InkHeadScript />` to `<head>`. It shows blank paper until `<InkProvider>` mounts, and falls back to showing the page after 3 s if JavaScript never runs.

```tsx
// app/layout.tsx
import { InkHeadScript } from '@pen-ink/react';
<html><head><InkHeadScript /></head><body className="ink-paper">…</body></html>
```

## Theming

Styles are opt-in. Add `className="ink-paper"` for the paper background, and override the tokens as you like:

```css
:root { --ink-paper: #f3eee2; --ink-color: #1d1b22; --ink-wet: #1f2e66; --ink-accent: #b5402c; --ink-highlighter: #f4d35e; }
```

Dark mode follows the system; set `data-ink-theme="light" | "dark"` on `<html>` to override. Per-subtree pens: `--ink-nib: dip; --ink-pen-size: 3; --ink-wobble: 1.5`. Add `.ink-no-filter` to drop the SVG ink texture (cheaper on very busy pages).

## Accessibility

- Ink is decorative (`aria-hidden`). Every component is the native element it looks like.
- Handwritten text keeps its real text in the DOM.
- `prefers-reduced-motion` draws everything instantly and skips page turns.
- Keyboard focus is shown with a hand-drawn loop; tabs support arrow keys.

## Performance notes

The SVG ink filter is re-rasterised while strokes animate. It's fine for dozens of elements on screen; for very busy pages use `.ink-no-filter` on parts of the page. Body copy should stay a real web font (use `<Write>`); keep `<Handwriting>` for headings, labels and short notes.

## Browser support

Current Chrome, Edge, Firefox and Safari. ESM only.

## Development

```sh
pnpm install
pnpm dev        # demo app (apps/demo), using the library sources with hot reload
pnpm site       # promo site (apps/site), deployed to GitHub Pages on push to main
pnpm test       # unit + component tests
pnpm build      # build all packages
```

The demo app has a component gallery and a small "field notes" app with page turns between routes.

## Credits

Handwriting comes from the [EMS SVG fonts](https://gitlab.com/oskay/svg-fonts) (SIL OFL) by Sheldon B. Michaels and Windell H. Oskay, the Hershey vector fonts (A. V. Hershey, 1967), and [Relief SingleLine](https://github.com/isdat-type/Relief-SingleLine) (SIL OFL). The stroke-outline approach is in the spirit of [perfect-freehand](https://github.com/steveruizok/perfect-freehand), and the sketchy primitives are in the spirit of [Rough.js](https://roughjs.com/). The minimum-jerk timing follows Flash & Hogan (1985).

## License

Code: [MIT](LICENSE). Fonts: see [packages/fonts/licenses](packages/fonts/licenses/README.md).
