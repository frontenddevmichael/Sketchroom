# PROMPT 2 — Marketing site rebuild (not generic, matches refs)

Read `/design/SKILL.md` and the refs. Rebuild `src/landing/` from scratch using `src/ui` and `src/illustration`. Do not reuse or edit old landing components: delete `src/landing/` section files and all their CSS before writing new ones (keep only logic worth keeping, e.g. the demo's canvas state, rewritten into new components). Research first (web): study how Linear, Vercel, Stripe, tldraw, Excalidraw, FigJam and the site in `refs/02` structure their pages; write 10 bullets in `/docs/LANDING-RESEARCH.md` on what to beat, not copy.

## Concept
"Line weight is state." The page teaches the product's grammar: dashed = proposed, solid = committed. Headline: **"Draw the plan before you build the product."** Sub: "A live canvas where your team sketches architecture and the AI proposes in dashed lines, until you commit it in ink." Primary CTA `Start sketching →`, secondary `Watch a room` (text). Eyebrow tag (dotted, mono): `live, 3 cursors` only if driven by the real demo state.

## Structure
1. Nav: logo wordmark left, 4 text links, black CTA right; hairline under it; dashed gutter guides (ref 2).
2. Hero (ref 2 layout): left copy, right `HeroDraftingTable` with the commit moment on load; bottom row of three IconTiles (`Live by default`, `AI that shows its work`, `Every change reversible`).
3. Feature rows in hairline cells (ref 1): title + 2-line description top-left, large scene below filling the cell. Rows: Live Canvas, Glass-Box Copilot (proposals appear dashed; click Accept = commit moment), Time Stack (version history).
4. **Real product moment**: restyled `DemoCanvas` in a hairline frame; user can drag a block, ask the copilot (scripted, no API call), accept a dashed proposal, scrub history. This replaces explanatory copy.
5. Comparison table vs Miro / FigJam / Excalidraw / tldraw: only claims you can verify from their public pricing/docs today; cite dates in a footnote; remove any claim you can't verify.
6. Pricing from `core/lib.ts` constants (never hardcode), FAQ (Radix accordion), final CTA inside a dashed frame, black footer strip (ref 3).
7. Remove invented social proof and numbers. If no real testimonials/usage exist, delete the section.

## Motion & perf
Lenis + ScrollTrigger per skill. LCP element is the hero text, not the SVG; hero scene inlined, others lazy. Lighthouse mobile ≥ 95 perf/100 a11y/100 SEO, CLS 0. Add OG image generated from the hero scene, JSON-LD, sitemap, canonical.

## Verify
Screenshots 375/768/1280/1920 light+dark beside refs; axe 0 serious; reduced-motion; keyboard path through nav → CTA → FAQ. Think beyond the brief: after the page works, find 3 details a competitor would not bother building (e.g. cursor leaves a dashed trail on the hero scene, footer draws itself) and implement them with restraint. Commit; do not push.
