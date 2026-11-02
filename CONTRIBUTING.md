# Contributing

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Setup

```sh
pnpm install
pnpm dev     # demo app at the printed URL; library sources hot-reload
pnpm test
```

## Layout

- `packages/core`: the engine. Keep it framework-free, and keep geometry DOM-free (it's tested in plain Node).
- `packages/react`: components. Animation runs on refs and the core's shared animation loop; never animate through React state.
- `packages/fonts`: generated. Edit `data/` or `scripts/`, then run `pnpm --filter @pen-ink/fonts generate`. Rebuilding the metrics webfonts needs Python with `fonttools` and `brotli` (`scripts/build-metrics-fonts.py`).
- `apps/demo`: the demo site.

## Guidelines

- Components must stay the native element they look like (a button is a `<button>`), with ink as an `aria-hidden` layer.
- Respect `prefers-reduced-motion` (the stage handles this if you draw through `useInkLayer`).
- New visual behaviour should honour the time budget: accept `duration` and compress, never stretch.
- Add tests: geometry in `packages/core/test`, behaviour in `packages/react/test`.

Please be kind in issues and reviews.
