# Refactor notes

## Prompt 2 → 3 handoff (2026-11-20)

`dev/tools/screens-before.mjs` captures every screen at 1280 and 375 into
`docs/before/` before the product rebuild starts. Re-run it after Prompt 3 into
`docs/after/` for the comparison.

### What the before pass found

1. **Dashboard is already token-monochrome but still the old design**: heavy
   40px greeting, pill-shaped meters, 16px radii, a large solid avatar block.
   The token migration made it grey; it has not been rebuilt on `src/ui`.
2. **Room canvas carries colour that the token sweep could not reach**: the
   reaction bar renders emoji glyphs (🚀🎉🔥💡❤️), which are colour images, not
   CSS. Either the reactions become monochrome glyphs (Prompt 3) or the bar is
   removed; a `grayscale(1)` filter is a stop-gap, not the answer.
3. **tldraw shows "Get a license for production"**: the canvas is running
   without a license key. This is a real production defect, not styling —
   tldraw requires a commercial license for a paid product.
4. The tool rail renders at ~28px targets, under the 44px minimum the design
   system sets.
5. tldraw's own chrome (zoom pill, minimap controls) is still tldraw-default
   prose styling, not the hairline language.
