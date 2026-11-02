# Changelog

## 0.1.0 (unreleased)

The first release.

- `@pen-ink/core`: DOM-free SVG path flattening; nib-modelled strokes (fineliner, dip, chisel, brush, ballpoint); hand-drawn shapes; single-line handwriting with live diffing; `InkStage` (all-at-once time budgets, `after` ordering); write-in timing; page turns.
- `@pen-ink/react`: `InkProvider`, `useInkLayer`, `Write`, `Handwriting`, `InkButton`, `InkCard`, `InkInput`, `InkTextarea`, `InkCheckbox`, `InkRadio`, `InkSwitch`, `InkSlider`, `InkProgress`, `InkTabs`, `InkHighlight`, `InkCircle`, `InkUnderline`, `InkDivider`, `InkIcon`, `InkArrow`, `usePageTurn`, `InkHeadScript`.
- `@pen-ink/fonts`: 11 single-line hands with metrics webfonts.
- Incremental drawing: `Drawing.lift(items)` takes particular strokes off, and `useInkLayer`'s `ink.layer(name)` exposes a named layer so components can `add()` + `play()` only new strokes. `InkProgress` uses this: a value change adds or lifts only the hatch strokes at the edge instead of repainting the fill.
