# Sketchroom Frontend Audit

**Date:** 2026-08-18
**Method:** 85+ Playwright captures (`.omo/evidence/audit/*.png`, `state/*.png`) across 9 routes × 375/768/1280 × light/dark; runtime layout probes (computed styles, bounding boxes, overflow scan, `document.fonts`); code-level token/typography/color/z-index analysis.

---

## Severity map

| # | Severity | Finding |
|---|----------|---------|
| 1 | **CRITICAL** | Landing nav broken at ≤375px — hamburger menu is off-screen, unopenable |
| 2 | **HIGH** | "Inter" font is declared but never shipped — falls back to system-ui everywhere |
| 3 | MEDIUM | No typographic scale tokens — ~1542 hardcoded px, per-page divergent type |
| 4 | MEDIUM | Second accent system: AI ghost-block hues hardcoded outside the token ramp |
| 5 | MEDIUM | z-index not governed (landing 900, app 60, tldraw 10000) |
| 6 | MEDIUM | Tap targets below 44px on landing, dashboard, settings, room |
| 7 | LOW | Hero ring bleeds ~11px past viewport at 768 |
| 8 | LOW | Raw error string leaks to UI on the invite error state |
| 9 | LOW | `src/App.css` is a dead 2-line file still imported |

---

## 1. CRITICAL — Landing nav breaks at 375px ✅ FIXED

**Evidence (measured, both themes):** `.landing-nav-pill` is `flex-wrap: nowrap; overflow: visible; gap: 12px`. At 375px viewport:
- `.landing-nav-links` + divider collapse (`display: none`) — correct
- `.landing-nav-cta` (theme toggle + CTA button) spans **156→378** (CTA button alone is **182px** wide)
- `.landing-nav-menu-btn` (hamburger) sits at **390→426** — entirely outside the 375px viewport

Nothing clips it (`overflow: visible` up the chain; page-level clipping hides the document scrollbar). Result: **the mobile menu button is invisible and unclickable**; the CTA button pokes 3px past the right edge. A phone user cannot open the navigation menu.

**Root cause:** at the mobile breakpoint the nav keeps logo + CTA group + hamburger in a single non-wrapping flex row that needs ~426px. The 182px CTA is too wide for mobile.

**Fix (applied 2026-08-18):** `Nav.css` gains `@media (max-width: 480px) { .landing-nav-pill .landing-nav-cta-btn { display: none } }` — the CTA button already lives in the hamburger menu and the hero, so it's dropped from the pill row below 480px. Specificity (0,2,0) beats the later `Landing.css .btn { display: inline-flex }` rule. Verified:
- Probe: hamburger now at 318→354 (inside viewport), CTA button w:0, max right edge 354 ≤ 375
- Fresh capture: `.omo/evidence/audit/fixed/landing-375x812-light.png`
- Regression tests added (`dev/smoke/smoke.spec.ts` "landing nav"): hamburger in-viewport + CTA hidden at 320/375/430/480, CTA visible at ≥481px; full suite 8/8 green, `tsc -b` clean.

---

## 2. HIGH — "Inter" is declared, never shipped

`--font-family: Inter, system-ui, ...` is set on `:root`. Verified via probe: `document.fonts.check("16px Inter")` → **true**, but only because this machine has Inter installed locally. Confirmed **no** `@font-face`, no `@fontsource/*` import, no Google Fonts `<link>`, no `url()` font reference in any CSS, no font files in `public/`.

**Consequence:** on any machine without Inter installed, the app renders in system-ui. All letter-spacing/line-height/size decisions were tuned against Inter's metrics; the fallback face is wider and taller, so headlines reflow and spacing looks off. The design intent silently degrades per-machine.

**Fix:** bundle Inter. Smallest blast-radius options:
- `npm i @fontsource-variable/inter` + `import '@fontsource-variable/inter'` in `main.tsx` (or `index.css` `@import`), **or**
- self-host the two weights actually used (400/600/700 — variable is better) in `public/fonts/` with a single `@font-face` block, `font-display: swap`.

Also define `--font-family` fallback **stack** deliberately (Inter, "Segoe UI", system-ui, sans-serif) so non-Inter environments at least get a coherent system face.

---

## 3. MEDIUM — Typography is not tokenized

Measured heading sizes per page (desktop): landing **64/44/28/18**, dashboard **28/18/16**, settings **28/16**, billing **28/18**, room **26**. Same role ("page title") renders at 28px on dashboard/settings/billing but 26px in room. Landing hero is a distinct 64px tier only on desktop.

~1542 hardcoded `px` values across `src/screens/*.css`, `src/components/*.css`, `src/landing/**/*.css`. Spacing tokens (`--space-*`) are real and partially adopted, but type has no scale.

**Fix:** define a type ramp in `index.css`, e.g. `--fs-display: clamp(...)`, `--fs-title`, `--fs-h2`, `--fs-body`, `--fs-sm`, `--fs-xs`, plus `--fw-*`. Adopt in the three biggest offenders first (Dashboard, Settings, Landing nav). Keep one `clamp()` per tier for fluid behavior.

---

## 4. MEDIUM — Second accent system (AI ghost hues)

`GhostBlocks.css` hardcodes the AI "ghost block" palette: `#5b8cff`, `#a96bff`, `#2cc7be`, `#a0a0aa`. These are outside the green/neutral ramps and create a second, undocumented accent system. Changing "the AI color" requires hunting these literals.

**Fix:** promote to tokens (`--ghost-blue/--ghost-purple/--ghost-teal/--ghost-dim`) with dark-mode variants, alongside the existing ramp.

---

## 5. MEDIUM — z-index governance

Measured maxima: landing nav-shell **900**; app tabbar **60**; settings/billing **60**; room **10000** (tldraw internals — fine, they own their layer). 900 is arbitrary and inconsistent with the app's 60. There's no shared z-scale token (the room screen documents its own scale in CSS; landing/app don't reference it).

**Fix:** one tokenized scale (e.g. `--z-nav: 100`, `--z-modal: 200`, `--z-overlay: 300`, …) referenced by landing nav + app tabbar; never raw integers outside that scale.

---

## 6. MEDIUM — Tap targets below 44px

Measured button heights: landing **18/24/32/36**px (plus hero CTAs 67–86px, fine), dashboard **15/30**px controls, settings **27–56**px, room **22–44**px. Several are real interactive controls under the 44px comfort/WCAG 2.5.5 target (not just inline text links).

**Fix:** audit the smallest controls per page (landing nav links/theme toggle, dashboard header icons, settings secondary buttons, room toolbar small buttons) and raise hit area to ≥40px minimum with padding, keeping visual size unchanged via transparent padding.

---

## 7. LOW — Hero ring bleed at 768

`hero-ring-2` measures **left:-11 → right:779** at a 768px viewport (both themes). Invisible only because of page-level clipping. The ring is centered on a box wider than the breakpoint.

## 8. LOW — Raw error leaks on invite failure

Invite error state renders `Cannot destructure property 'roomId' of 'undefined' as it is undefined.` verbatim under "Could not accept invite". `friendlyError()` maps common cases, but this one passed through raw. In the harness this is a stub artifact (stub returns `undefined`), but the real screen should defensively treat undefined like null and never surface internal error text.

## 9. LOW — Dead `src/App.css`

Two-line comment-only file, still imported. Delete + remove the import.

---

## Verified-strong areas

- **Token system is genuine** — green ramp, neutral ramp, 4px spacing base, radii, easing, shadows, glass, scrollbar, room geometry, status colors, dark elevation system, `prefers-reduced-motion`, `:focus-visible`. This is a real design system core, not chaos.
- **No horizontal overflow anywhere except finding #1** (tldraw's `-9999px` skip-link is intentional a11y).
- **Dark mode flips every page** — body background luminance measured 255→0 across all 9 routes × both themes. The dark elevation system holds.
- **Dashboard grid is pixel-clean** — room cards uniform (two-up 296×288 at 1280, stacked 343×288 at 375), stat tiles top-aligned (all `y:139` at 1280), card heights identical within rows.
- **Contrast is solid** — stat text `rgb(30,30,30)` on `rgb(251,251,251)` (light) / `rgb(245,245,245)` on `rgb(13,13,13)` (dark).
- **Routing/a11y thoughtfulness** — ProtectedRoute/PublicRoute preserve intent via `?next=` with open-redirect sanitization (`startsWith('/') && !startsWith('//')`); legal and error pages are complete and clean; auth screen carries themed canvas decor and renders on the real backend.

---

## Per-page snapshot

| Page | Verdict | Key evidence |
|------|---------|--------------|
| Landing | **Needs work** | #1 (critical nav), #2 (font), #3, #5, #6; strong desktop hero scale |
| Auth | Good | Dark mode flips, decor renders, no overflow; Google gated by env |
| Dashboard | Good | Aligned grid/stat tiles, contrast solid; small controls (#6) |
| Room | Good | No real overflow; coachmark flow intact; tldraw owns its layers |
| Settings | Good | No overflow, dark flips; type 28/16 (#3), buttons 27–56px (#6) |
| Billing | Good | No overflow, dark flips; type 28/18 (#3) |
| Invite | OK | Friendly error state works; raw string leaks (#8) |
| Legal | Good | Complete doc structure, no overflow |
| Error | Good | Clean single-action page |

## Recommended order of attack

1. ~~Landing 375px nav~~ **done** (Nav.css + regression tests)
2. **Ship Inter** (@fontsource-variable/inter, one import)
3. **Type ramp tokens** (adopt on Dashboard/Settings/Landing nav)
4. **z-scale + ghost-hue tokens** (mechanical, low risk)
5. **Tap targets** (padding-only hit-area expansion)
6. Cleanup: dead App.css, invite raw-error guard, hero-ring bleed