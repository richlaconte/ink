# Changelog

## 0.1.0 (unreleased)

The first release.

- `@pen-ink/core`: DOM-free SVG path flattening; nib-modelled strokes (fineliner, dip, chisel, brush, ballpoint); hand-drawn shapes; single-line handwriting with live diffing; `InkStage` (all-at-once time budgets, `after` ordering); write-in timing; page turns.
- `@pen-ink/react`: `InkProvider`, `useInkLayer`, `Write`, `Handwriting`, `InkButton`, `InkCard`, `InkInput`, `InkTextarea`, `InkCheckbox`, `InkRadio`, `InkSwitch`, `InkSlider`, `InkProgress`, `InkTabs`, `InkHighlight`, `InkCircle`, `InkUnderline`, `InkDivider`, `InkIcon`, `InkArrow`, `usePageTurn`, `InkHeadScript`.
- `@pen-ink/fonts`: 11 single-line hands with metrics webfonts.
- Incremental drawing: `Drawing.lift(items)` takes particular strokes off, and `useInkLayer`'s `ink.layer(name)` exposes a named layer so components can `add()` + `play()` only new strokes. `InkProgress` uses this: the value sets a goal stroke count, and the bar ticks toward it one stroke at a time, drawing the next or lifting the last. A new value mid-way just moves the goal; nothing already drawn is repainted.
- Performance (notably Safari and all iOS browsers): the ink filter is held back while ink is drawing, fading or drying, and applied once it settles (`settleFilter`, default on); SVGs settle one per frame. Wet ink dries over 0.9s instead of 1.6s. On `<body>`, `.ink-paper`'s texture is a fixed, composited layer, so repainting ink no longer repaints the paper. In WebKit with an iPhone viewport, the promo site's opening sketch-in went from ~20 fps to ~59 fps, and scrolling while sections draw from ~300 ms frames to ~17 ms.
- Fix: in WebKit (Safari and all iOS browsers), thin strokes could vanish under the ink filter, e.g. the bottom bar of an E ("OPEN" read "OPFN"). Each ink SVG now carries an invisible full-size `rect.ink-bounds` so WebKit gets the filtered bounds right.
- Fix: `<Handwriting>` text can be selected by dragging over it again. The real text used to be kept in a 1px screen-reader-only box; it now sits under the ink, transparent and letter-spaced run by run to the ink's widths (`textRuns` in core), so selection highlights what's written, copy gives the text with its natural wrapping, and find-in-page, screen readers and search engines all read one copy of the words.
