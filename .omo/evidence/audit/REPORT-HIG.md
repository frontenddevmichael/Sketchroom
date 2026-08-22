# Design Review: Sketchroom — Apple HIG pass

**Reviewer method:** [apple-design skill](https://github.com/dickwu/apple-design-skill) (Apple Human Interface Guidelines, adapted as platform-agnostic rules). Framework: React + TypeScript web app (Vite). Platform: desktop-first web with responsive mobile. Category: collaborative productivity (whiteboard/planning).
**Evidence base:** 122 runtime captures (9 routes × 375/768/1280 × light/dark), layout probes (computed styles, bounding boxes, overflow, `document.fonts`), and source review. Guidelines consulted: accessibility, color, typography, layout, dark-mode, liquid-glass, generative-ai, feedback.

---

## Summary

**Overall severity: Good — strong foundations, several compliance gaps**

Sketchroom has a genuinely well-considered design system: semantic color tokens with light/dark variants, an elevation-based dark mode, a functioning glass material system, double-confirmation for destructive actions, reduced-motion support, and excellent measured contrast. It falls short mainly in **touch-target sizing** (accessibility), **font delivery** (typography), and **two Liquid Glass parameter deviations**. The biggest UX-affecting defect (mobile nav overflow) was fixed during the earlier audit; this pass is the Apple-HIG layer on top.

---

## Critical Issues

### C1. Interactive controls far below minimum touch/click target size
**What:** Measured button heights: dashboard **15px and 30px**, landing **18/24/32/36px**, settings **27px**, room **22px** controls. The landing theme toggle is 32×32, the hamburger 36×36.
**Why:** > **Design Guideline — Accessibility > Mobility**: *"Offer sufficiently sized controls… Strive to meet the recommended minimum control size for each platform."* Minimums: **44×44 mobile, 28×28 desktop**. The dashboard's 15px controls violate even the desktop minimum; most mobile controls fall well below 44.
**Fix:** (React/web) Raise hit areas to ≥44px on mobile / ≥28px desktop using transparent padding (visual size unchanged): landing nav links and theme toggle, dashboard header icon buttons, room toolbar small buttons, settings secondary buttons. Keep the visible glyph small but make the tappable box compliant. Add a probe that asserts `el.offsetWidth/Height >= 44` at 375px for a curated control list.

### C2. Custom font declared but not shipped — typography silently degrades
**What:** `--font-family` leads with Inter; `document.fonts.check("16px Inter")` returns true **only because the reviewer machine has Inter installed**. No `@font-face`, no fontsource/Google-Fonts import, no font files in `public/`, no `url()` font refs in CSS. Anyone without local Inter renders the whole app in system-ui at different metrics.
**Why:** > **Design Guideline — Typography > Using custom fonts**: *"Make sure custom fonts are legible… implement accessibility features for custom fonts."* A declared-but-unshipped font makes every size/leading/letter-spacing decision conditional on the viewer's OS.
**Fix:** `npm i @fontsource-variable/inter` + one import in the app entry (or self-host woff2 with `font-display: swap`). Then `document.fonts.check("16px Inter")` must be true everywhere, not just on this machine.

---

## Improvements

### H1. Theme toggle vs system preference — acceptable but verify default
**What:** The app ships its own light/dark toggle persisted in `localStorage`.
**Why:** > **Design Guideline — Dark Mode**: *"Avoid offering an app-specific appearance setting."*
**Assessment:** Compliant in spirit — `ThemeProvider` **defaults to `prefers-color-scheme`** via `matchMedia` when no stored value exists, which is the correct web equivalent. **Verify**: the toggle should *only* override after explicit user action; if any flow calls `setTheme` implicitly (e.g., a first-run default), it should still resolve from `matchMedia` first.

### H2. Liquid Glass: saturation exceeds spec; rest-state nav blur is light for its backdrop
**What:** `--glass-saturation: 1.7` on all `backdrop-filter` glass surfaces; modals use `--glass-blur: 18px`. The floating nav pill runs `blur(20px × 0.6) = 12px` at rest over the bright, colorful hero.
**Why:** > **Design Guideline — Liquid Glass > General rules**: blur **20–40px regular / 10–20px clear**, background opacity **0.6–0.8 / 0.3–0.5**, saturation boost **1.2–1.5×**. Clear-variant surfaces over bright content need *"a dark dimming layer (~35% opacity)"*.
**Fix:** (a) lower `--glass-saturation` to ~1.4; (b) bump `--glass-blur` to 20px for the regular overlay surfaces (share/export/history modals); (c) give the at-rest nav pill either ≥20px blur or a subtle dimming layer since it floats over the bright hero (per the Clear-variant rule).

### H3. Ghost-block palette is a hardcoded second color system
**What:** AI ghost blocks hardcode `#5b8cff`, `#a96bff`, `#2cc7be`, `#a0a0aa` in `GhostBlocks.css` — no light/dark variants, outside the token ramp.
**Why:** > **Design Guideline — Color**: *"Avoid hard-coding… supply light and dark variants."* > **Dark Mode**: *"Embrace colors that adapt to the current appearance."* Color is also being used as the "this is AI" signal — see H4.
**Fix:** Promote to semantic tokens (`--ghost-*`) with dark variants, and pair the hue signal with a non-color cue (ghost blocks already have their translucent/blocky shape — reinforce that rather than relying on hue alone).

### H4. AI transparency: strong on control, check the label moment
**What:** The copilot consistently frames output as drafts ("Ask me to draft an architecture… propose a wireframe", dismissed-state copy, ghost blocks landing as reviewable suggestions). The legal page documents model, routing (OpenRouter), and that only prompt + selected shapes are sent.
**Why:** > **Design Guideline — Generative AI**: *"Clearly identify when and where you use AI… Keep people in control."*
**Assessment:** Control and context-scoping are genuinely good. **Verify**: whether an AI-generated suggestion is explicitly labeled "AI" at the moment it lands on canvas (the coachmark/feed may already do this — if not, add a "Suggested by AI" tag on ghost blocks and in the feed header).

### H5. Small text at/below minimum sizes
**What:** The nav CTA button text is 13px; secondary labels measure 16px on dashboard/settings; 14px on room toolbars and nav links.
**Why:** > **Design Guideline — Typography**: desktop minimum **10pt**, default **13pt**; mobile minimum **11pt**, default **17pt**. 13px ≈ 9.75pt — under the desktop default.
**Fix:** Raise primary nav controls to ≥13.5px, and audit anything ≤12px for secondary text. Use `clamp()` on the nav CTA so it never falls below the minimum on narrow widths.

### H6. Type scale not tokenized; same role, different sizes across screens
**What:** Page-title headings measure 28px (dashboard/settings/billing) vs 26px (room); landing uses 64/44/28/18; no shared scale tokens.
**Why:** > **Design Guideline — Typography > Conveying hierarchy**: consistent size/weight/color system; avoid divergent sizes for the same hierarchy level.
**Fix:** Define a type ramp token set (`--fs-title`, `--fs-h2`, `--fs-body`, `--fs-sm`, `--fs-xs`) in `index.css` and adopt on the screens with divergent titles first (room 26px → ramp value).

---

## Positive Notes

- **Semantic color system with both appearances** — tokens carry light/dark variants (color.md: *"supply light and dark variants"*); the dark elevation system distinguishes base vs elevated surfaces (dark-mode.md layered-depth principle).
- **Measured contrast is excellent** — stat text `rgb(30,30,30)` on `rgb(251,251,251)` ≈ **16.7:1**; dark `rgb(245,245,245)` on `rgb(13,13,13)` ≈ **17.6:1**, far above the 4.5:1 minimum, verified in both themes on every page.
- **Liquid Glass layering is correct** — glass is used on the functional layer (floating nav pill, modals, AI feed panel) and *not* sprayed across content cards. The blur/opacity structure maps to Apple's clear/regular variants.
- **Dark mode flips every page** (body luminance 255→0 across all 9 routes × both themes).
- **Destructive actions double-confirmed** — workspace delete and room delete both ask twice (accessibility.md: *"always ask for confirmation twice"*).
- **Reduce-motion honored** — `prefers-reduced-motion` blocks in CSS + `MotionConfig reducedMotion="user"` (accessibility.md motion guidance).
- **Keyboard/focus support** — green `:focus-visible` outlines on all nav/theme/menu controls; tldraw ships full keyboard access.
- **AI keeps people in control** — suggestions land as drafts, explicit "dismiss", context limited to prompt + selection (generative-ai.md).
- **Feedback is contextual** — save-status pill in the room chrome, loading screens with honest labels, integrated status rather than interruptive alerts (feedback.md).

---

## Platform-Specific Notes

**Mobile (≤480px):**
- Raise all targets to ≥44px (C1); landing nav now fits after the fix but its 36px hamburger and 32px theme toggle need the 44px treatment.
- Verify layout at 320px (measured clean) and under font scaling — text-size changes will re-test the pill row.
- Mobile menu CTA is intentionally full-width — acceptable inside a dropdown per layout.md (full-width *buttons* are the concern, not menu items).

**Desktop:**
- 13px nav CTA is borderline below the 10pt minimum — bump to 13.5–14px (H5).
- No window-chrome concerns (web); keyboard shortcuts already present via tldraw (undo/redo).
- Consider honoring `prefers-color-scheme` changes live (currently read once at boot) so a system flip while the app is open updates the theme unless overridden.

**Both:**
- Re-run the accessibility pass after H1/H2/H3/H5 land; the token-based fixes should be verified with the same probes (computed font check, contrast sampling, target-size assertions).