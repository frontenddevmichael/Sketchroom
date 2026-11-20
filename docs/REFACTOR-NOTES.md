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

## PROMPT-3 — product UI rebuild (in progress)

### Step 2 — splitting `RoomScreen`

The screen is 1,919 lines and its CSS 1,939, so the split goes module by
module in `src/room/`, each one behaviour-preserving first and rebuilt second.

Moved this pass (no behaviour change, CSS moved with its module and deleted
from `RoomScreen.css`):

| Was (in `RoomScreen.tsx`) | Now | Lines |
| --- | --- | --- |
| `CanvasOnboardingSketch` | `src/room/OnboardingSketch.tsx` | 26 |
| `RoomCanvasBoot` | `src/room/RoomBoot.tsx` + `RoomBoot.css` | 44 |
| `RoomCoachmarks`, `CoachmarkPill` | `src/room/RoomCoachmarks.tsx` + `.css` | 150 |

`RoomScreen.tsx` is down to 1,693 lines and its CSS to 1,816.

Kept as-is for now, with reasons: `RoomScreen` itself (it is the data owner —
Convex queries, mutations, the save pipeline and the canvas handle), and the
presence-colour and tool-title helpers (pure, four and twelve lines, used only
here). Everything else still inside the component — topbar, tool rail, zoom and
history controls, the shortcuts modal, the empty hero and the walkthrough — is
queued to move next, then each module gets rebuilt per the mandate.

### Colour decision (overrides SKILL.md's "no hue anywhere")

You asked that the product stay monochrome while the *objects* keep colour.
Implemented and documented in `docs/ENGINE-EVALUATION.md`: the interface,
paper and text are ink; shapes, blocks and strokes carry `OBJECT_PALETTE`, and
fills are a wash of the object's own colour. Text is the one exception that
stays on the ink ramp.
