# Refactor notes

## Prompt 2 → 3 handoff (2026-11-20)

`dev/tools/screens-before.mjs` captures every screen at 1280 and 375 into
`docs/before/` before the product rebuild starts. Re-run it after Prompt 3 into
`docs/after/` for the comparison.

### What the before pass found

1. **Dashboard is already token-monochrome but still the old design**: heavy
   40px greeting, pill-shaped meters, 16px radii, a large solid avatar block.
   The token migration made it grey; it has not been rebuilt on `src/ui`.
2. **Room canvas carried colour that the token sweep could not reach**: the
   reaction bar rendered emoji glyphs (🚀🎉🔥💡❤️), which are colour images, not
   CSS. **Decision: removed.** The bar and its floating particles are gone; a
   grayscale filter would have been a stop-gap, and recolouring someone else's
   emoji is not ours to do. Presence was already monochrome (a six-step ink
   ramp keyed off the user id), so the bar was the last hue on the canvas.
3. **tldraw shows "Get a license for production"**: the canvas is running
   without a license key. This is a real production defect, not styling —
   tldraw requires a commercial license for a paid product. **Decision: change
   engine** rather than buy a licence; see `docs/ENGINE-EVALUATION.md`.
4. The tool rail renders at ~28px targets, under the 44px minimum the design
   system sets.
5. tldraw's own chrome (zoom pill, minimap controls) is still tldraw-default
   prose styling, not the hairline language.
