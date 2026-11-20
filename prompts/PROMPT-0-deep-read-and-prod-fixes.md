# PROMPT 0 — Deep read + production fixes (no visual changes)

You are working in the Sketchroom repo (React 19, Vite 8, tldraw 5, Convex + Convex Auth, Gemini via OpenAI-compatible endpoint). Read `/AGENTS.md` and `convex/_generated/ai/guidelines.md` first; Convex rules there override your training data.

## Step 1 — Understand it before touching it
Read every file under `convex/` and every file under `src/` except CSS. Then write `/docs/ARCHITECTURE.md` (max 250 lines): data model, auth flow, canvas sync (applyCanvasChanges/compaction/snapshots), presence, AI pipeline (think → worker/completion → compact → insert), plan limits, routing, error handling, and a list of every place client and server duplicate limits. Include any bug or smell you find with file:line. Do not skim `RoomScreen.tsx` (1,958 lines): map its responsibilities into a list of extractable modules, you will split it in Prompt 3.

## Step 2 — Baseline
`npm ci && npx tsc -b && npx eslint . && npx vitest run && npx vite build`. Known: 70 tests pass, 2 eslint warnings (RoomScreen ~489, ~819: fix them properly, no `eslint-disable`). Record bundle sizes; identify what makes the >500 kB chunk and confirm the landing route does not load tldraw.

## Step 3 — Fix these known gaps
1. **tldraw assets vs CSP.** Check whether fonts/icons/translations load from tldraw's CDN. Self-host via tldraw's asset mechanism (confirm API in installed 5.x docs), then tighten CSP in `vercel.json`: remove `'unsafe-inline'` from `script-src` using a nonce or hash strategy that works on Vercel static hosting, or document precisely why it can't. Verify with a production build served locally: zero CSP violations in console in landing, auth, dashboard, room.
2. **Plans & billing enforcement.** There is no plan field and no payment provider. Design: `plan` (`free|team`), `planStatus`, `paystackCustomerCode`, `currentPeriodEnd` on a `subscriptions` table keyed by workspace; single `getEntitlements(ctx, userId)` used by rooms/invites/ai instead of constants; Paystack checkout initiation action + webhook in `convex/http.ts` with HMAC signature verification and idempotent event handling; BillingScreen wired to real state. **STOP and ask me to confirm Paystack vs Stripe and the Team price before writing this.** Until confirmed, implement everything provider-agnostic (entitlements, tables, tests).
3. **Authorization audit.** For every public query/mutation/action in `convex/`, produce a table: function, auth required, role required, rate limit, args validated, returns sensitive data? Add `convex-test` cases for non-member, viewer, expired invite, and cross-room access on each. Fix anything that fails.
4. **Data integrity.** Test canvas sync under: two clients editing simultaneously, dropped connection mid-save (clientChangeId idempotency), compaction at version thresholds, restore snapshot while others edit, canvas at 850 KB ceiling. Add tests for each.
5. **Repo hygiene.** Remove `.omo/run-continuation`, `project(2)/`, `harness.html` and `dev/audit-*` unless referenced (check first, move useful probes to `/dev/tools`). Pick ONE package manager (match CI: pnpm) and delete the other lockfile; add `packageManager` to package.json. Rewrite README to match reality (it still says Kuda dark green, wrong file paths, wrong fonts). Delete the dead `src/App.css`.
6. **Observability.** Sentry: no `console.log` in prod paths; source maps uploaded in CI; Convex `errorLogs` has retention (cron exists, verify).
7. **CI.** Add: typecheck, lint (0 warnings), unit, build, Playwright smoke, bundle-size budget, `npm audit --omit=dev` at high severity.
8. **Real e2e.** Add Playwright test with two browser contexts against a Convex dev deployment (env-gated): sign up two users, share room, both edit, assert convergence, presence cursors visible, viewer cannot edit, AI quota error at limit.

## Rules
Think beyond this list: after finishing, ask "what would a senior reviewer still flag?" and act, repeat until diminishing returns. Small obvious fixes: just do them. Anything that changes schema in a non-additive way, deletes user data, or picks a vendor: stop and ask first. Commit per step with clear messages. Do NOT push until the final gate (Prompt 4).

## Deliverable
`/docs/ARCHITECTURE.md`, `/docs/PROD-AUDIT.md` (findings, fixes, residual risks), green CI locally. Report in 15 lines max.
