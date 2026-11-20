# Production audit — Prompt 0

**Baseline:** `main` at `49b6564`, verified locally on `eaf79bf`.
`pnpm exec tsc -b` clean · `pnpm exec eslint .` 0 errors / 0 warnings ·
`pnpm exec vitest run` 70/70 · `pnpm run build` green (tldraw chunk 1.87 MB raw /
561 kB gzip, one >500 kB warning).

---

## Fixed in this pass

| # | Issue | Evidence | Fix |
| --- | --- | --- | --- |
| 1 | **tldraw loaded assets from `cdn.tldraw.com`, blocked by the production CSP** | `vercel.json` CSP is `default-src 'self'`; no `assetUrls` anywhere in `src`; the installed tldraw bundle carries `var lg='https://cdn.tldraw.com'` | Installed `@tldraw/assets@5.3.2` (exact match to tldraw), pass `assetUrls={TLDRAW_ASSET_URLS}` from `getAssetUrlsByImport()`, resolved once at module scope. Build now emits **68** self-hosted asset files (svg/font/translation). The remaining CDN string is the library's unused default. |
| 2 | **Two ESLint hook warnings** (`RoomScreen.tsx:489`, `:819`) | root cause: `useAnnouncer` returned a fresh closure per render | Made it a stable `useCallback` (its only state is refs), then listed `announce`, `showOnboarding`, `completeOnboarding` in the real dependency arrays. No suppressions. |
| 3 | **Collaborator cap had three definitions** | `FREE_COLLABORATORS_PER_ROOM` exported in `convex/core/lib.ts` but never imported; `convex/core/usage.ts` hardcoded `3` | `usage.ts` now imports the constant; `FREE_PLAN.COLLABORATORS_PER_ROOM` reads it. |
| 4 | **Client/server limit drift was untested** | `src/lib/plans.ts` hand-copied 3/3/40 and its comment pointed at a non-existent `convex/lib.ts` | Comment corrected; `src/lib/plans.test.ts` asserts the client mirrors the server constants, so drift fails CI. |
| 5 | **Duplicate lockfiles** | CI runs `pnpm install --frozen-lockfile` (pnpm 10) while `package-lock.json` also existed | Deleted `package-lock.json`. |

## Verified-good (do not "fix")

- **Authorization** is server-enforced on every path read: queries return
  `[]`/`null` for non-members, mutations use `requireRole`, the AI action checks
  role + quota + prompt size before the provider call, and canvas/snapshot/
  comment/thumbnail/invite writes are rate-limited.
- **Canvas integrity**: canonical record map restricted to document scope,
  defensive `typeName` filtering, 850 kB ceiling with a human-readable error,
  monotonic `canvasVersion`, idempotent snapshot rows, restore that always
  preserves the pre-restore state.
- **AI output is sanitised** before it reaches the canvas (allowlisted kinds,
  block/edge caps, dedupe, range checks, HTML escaping) and falls back to
  heuristics rather than drawing garbage.
- **Crons and retention** exist and are covered by tests (invites, presence,
  error logs, snapshot pruning).
- **Routing** guards, `?next=` allowlist and per-screen recovery actions are
  correct.

## Residual risks (carried forward)

1. **No real multi-user test.** Playwright runs against `dev/harness.tsx` with
   stubbed Convex, so convergence, presence and viewer-blocking are asserted
   against stubs, not two real clients. Prompt 0's two-context e2e against a dev
   deployment is still outstanding.
2. **AI quota attribution is per-room, not per-user** (`convex/core/usage.ts:27`):
   every completed message in every room you belong to counts against you, so a
   teammate's usage is charged to all members while the meter says "your
   suggestions". Needs a product decision (per-author vs per-room pool) before
   changing.
3. **Presence identity is client-supplied** (`convex/features/presence.ts:12`):
   `name` and `color` are arbitrary strings. Low impact today (display only), but
   it means peers can render as any name.
4. **CSP still needs `script-src 'unsafe-inline'`** because of the pre-paint theme
   script in `index.html:39`. That script is redundant while `ThemeProvider`
   pins dark, so removing it (or hashing it) is the path to tightening the CSP.
5. **`RoomScreen.tsx` is 1,971 lines** with ~30 effects; the save/presence/AI
   orchestration has no behavioural test. Split map is in
   `docs/ARCHITECTURE.md §10`.
6. **Bundle**: one chunk >500 kB (warning only; tldraw is already split and
   route-lazy).

## Repo hygiene

Done: `package-lock.json` removed; `project(2)/` and `.omo/run-continuation/`
deleted (unreferenced). Kept: `harness.html` (Playwright `webServer.url`),
`dev/audit-*.mjs` probes (unreferenced but useful; candidates for `dev/tools/`).

## Not done (deferred)

- Provider-agnostic billing (`subscriptions` table, `getEntitlements`, plan
  fields) — **blocked on the Paystack-vs-Stripe and Team-price decision**.
  No entitlements code was written, so nothing is half-landed.
- Two-user Playwright e2e, CI budget/a11y gates, README rewrite, CSP hardening.

## Monochrome sweep (Prompt 1, step 4)

Colour was defined in four places; three are now closed:

| Source | Before | After |
| --- | --- | --- |
| App CSS | 42 files using green/neutral/playful tokens + 30 stranded literals | `design/tokens.css` only; zero `oklch()`, zero hue hex |
| tldraw picker | 13 hue swatches | the same 13 names mapped onto an ink ramp (`ToolOptions.tsx`, `VersionHistory.tsx` previews) |
| Presence | six brand hues | six ink steps, distinguished by name label |
| Transactional email | green accent + WhatsApp-green CTA + 16px/999px radii | ink/paper/greys, 4px radius (email clients ignore CSS vars, so the hexes are literal and documented in-file) |
| Confetti | seven saturated colours | ink ramp |

**Still open — the tldraw canvas renderer.** The picker now offers greys, but
tldraw resolves a shape's *stored* colour name through its own theme, so a
document containing `colour: "red"` still paints red. tldraw 5.3 exposes
`ThemeManager`, `registerColorsFromThemes`, `resolveThemes` and `DEFAULT_THEME`;
this needs the v5 theme-registration API verified against its docs before
wiring, not a guess. Nothing here mutates that API yet, so canvas colour is the
one place the monochrome rule is not yet enforced.
