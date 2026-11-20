# PROMPT 4 — Final gate, then push

Push to https://github.com/frontenddevmichael/Sketchroom only after every item below is verified with evidence, never as an early checkpoint.

1. `tsc -b`, eslint (0 warnings), vitest, build, Playwright smoke + two-user e2e + visual baselines, axe, Lighthouse CI: all green; bundle budget met.
2. Production build served locally: zero console errors/CSP violations on every route; tldraw loads with no third-party CDN.
3. No placeholders, lorem, emoji, invented stats, dead links, `console.log`, TODO. Every legal/pricing/limit number reads from one source.
4. Billing: entitlements enforced server-side; webhook idempotent and signature-verified; downgrade/cancel paths tested; test-mode purchase end to end (only if provider confirmed).
5. Cross-browser: Chromium, WebKit, Firefox on the main flows; real mobile viewport tests.
6. Load: 20 concurrent clients in one room for 5 minutes, no divergence, no runaway Convex function calls, rate limits behave.
7. Copy read-through of every screen for voice rules in SKILL.md.
8. Cross-screen consistency sweep vs `/design/refs` and `/design/SKILL.md` Definition of Done.
9. If anything here reveals a rebuild bigger than a small fix: stop, report, wait for my confirmation.
10. Final: update README and `/docs`, tag `v1.0.0`, push, confirm Vercel deploy and Convex prod deploy succeeded, smoke the live URL.
Then ask yourself what a genuinely excellent product would still be missing; list it in `/docs/NEXT.md`.
