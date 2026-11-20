# Sketchroom — Refactor & Production-Readiness Pack

**Status:** source of truth for frontend refactor work in this repository.
**Owner:** frontend.
**Last verified:** 2026-11-20 against `main` (`src/`, `convex/`, `dev/`, ~32.4k lines).
**Supersedes:** `.omo/evidence/audit/REPORT.md` and `REPORT-HIG.md` where they conflict — several of their findings have since been fixed (see §5.1).

Use this document as the arbiter for any refactor decision. If a change is not
described here and not required to make one of these items work, it is out of
scope for the refactor.

---

## 1. Product — what Sketchroom is

Sketchroom is a **real-time collaborative planning canvas with an AI copilot**.
It is not a general whiteboard and not an AI chat product: the canvas is the
workspace, and the copilot's job is to put *structured thinking* on it.

**The user and the moment.** A small product team (2–8 people) is in a call,
planning something they can't hold in their heads — an architecture, an auth
flow, a launch sequence. Someone shares a screen; instead of a blank Figma file
or a Miro board with no starting point, they open a room. They sketch while they
talk, the copilot drafts the boring first version, and they leave with a board
that becomes the ticket, not a screenshot nobody reopens.

**Core jobs to be done**

| Job | Surface |
| --- | --- |
| "Get a room and a board in under 10 seconds" | Landing → Auth → Dashboard → Room |
| "Think together, live" | Room canvas: presence cursors, selections, viewport awareness |
| "Don't start from blank" | Block library, room templates |
| "Draft this for me" | AI copilot: prompt → structured blocks/edges on canvas |
| "Bring someone in" | Share modal, roles, invite links |
| "Don't lose the thinking" | Autosave + version history with confirmed restore |
| "Get it out of the app" | Export to PNG/SVG/PDF |
| "Know what I've used" | Free-tier meters in the account menu and settings |

**Product surfaces (routes)**

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Marketing: nav, hero, feature showcase, performance, comparison, social proof, CTA, footer | public |
| `/auth` | Sign in / sign up, email + password, optional Google and email verification | public (redirects when authed) |
| `/dashboard` | Rooms grid, search, KPIs, create/new-from-template, sidebar, account menu | protected |
| `/room/:roomId` | The product: tldraw canvas, chrome, AI feed, block library, share, history, export, comments | protected |
| `/invite/:token` | Accept a room invite, then land in the room | protected |
| `/settings` | Workspace name, plan & usage, members, danger zone, account tab | protected |
| `/billing` | Free plan vs Team, usage meters | protected |
| `/terms`, `/privacy`, `/error`, `*` | Legal, error, not-found | public |

**Product invariants** (breaking one of these is a product bug, not a design tweak)

1. A room is always reachable from the dashboard and always has a name.
2. Nothing a user draws is lost silently — the save status pill tells the truth.
3. AI output is a **draft**: it lands as reviewable ghost blocks, never directly
   committed to the canvas without an insert action.
4. Destructive actions are confirmed twice (workspace delete, room delete).
5. Protected routes never flash content; the loading screen owns the transition.
6. The free tier is honest: limits shown before they bite, no dead ends.

---

## 2. Architecture map

```
index.html ── main.tsx ── ConvexAuthProvider ── BrowserRouter ── AppProviders
                                                                  ├ ThemeProvider
                                                                  └ ErrorBoundary (reports to Convex)
src/App.tsx  routing, ProtectedRoute/PublicRoute, per-screen error boundaries
src/screens/  Dashboard, RoomScreen, AuthScreen, SettingsScreen, BillingScreen,
              InviteScreen, LegalScreen, NotFoundScreen
src/components/  Room chrome + modals: ToolOptions, BlockLibrary, AiFeed, GhostBlocks,
                 CommentPins, PresenceCursors, ShareModal, VersionHistory, ExportDialog,
                 UserMenu, AppTabBar, skeletons, ErrorBoundary/ScreenErrorBoundary
src/landing/  Marketing page: Nav, Hero, FeatureShowcase, PerformanceSection,
              ComparisonTable, SocialProof, FinalCta, Footer, demo canvas
src/lib/     useAiCopilot (context + insert + collision layout), ThemeProvider,
             useTheme, useModalFocus, usePageTitle, plans, templates, sentry
src/utils/   blocks catalog, insertBlock
convex/      schema, auth, http, core/ (email, errors, lib, rateLimiter, usage, users),
             features/ (ai, aiDiagram, aiStore, canvas, comments, invites, presence,
             rooms, snapshots), utils/ (model, types), tests/
dev/         harness (stubbed Convex for Playwright), smoke specs, audit probes
```

**Backend shape.** Convex, file-based routing (`api.features.rooms.*`). Tables:
`workspaces`, `rooms` (canonical `canvasData` JSON + monotonic `canvasVersion` +
optional `compactedVersion`), `roomMembers` (owner/editor/viewer), `snapshots`
(client-idempotent), `aiMessages`, `presence`, `invites`, `comments` (threaded,
resolvable), `errorLogs`, plus Convex Auth tables. Membership and role checks
live in `convex/core/lib.ts` and are enforced server-side; the client never
asserts a role.

**AI pipeline.** Prompt + canvas context (up to 60 shapes with x/y/selected) →
`think()` routes to `worker()` (freeform) or `completion()` (structured blocks +
edges) → `compactResult()` dedupes/validates → client `insertDiagram()` lays out
with collision resolution (`resolvePosition`, `collectExistingRects`, `CELL_H`)
→ ghost blocks → user inserts.

**Build and test.** `npm run build` = `tsc -b && vite build`. `npm test` =
Vitest + `convex-test` (in-memory, no deployment). `npm run test:smoke` =
Playwright against `dev/harness.tsx`, which stubs Convex so the real screens run
without a backend. `npm run lint` = ESLint.

---

## 3. Design-system contract

Everything below already exists in `src/index.css`. New UI must consume these
rather than inventing values.

| Concern | Contract |
| --- | --- |
| Color | `--bg`, `--bg-elev`, `--bg-sunken`, `--ink`…`--ink-4`, `--line`, `--line-2`, single `--accent` (emerald/lime), `--live/--warn/--danger`, room preview tints `--p1…--p6` |
| Type | `--font-display` (Urbanist), `--font-body` (Nunito), `--font-handwriting` (Caveat), `--font-mono`. Scale: `--fs-display`, `--fs-title`, `--fs-h3`, `--fs-body`, `--fs-sm`, `--fs-xs` |
| Space | 4px base: `--space-1/2/3/4/5/6/8/10/14/20` |
| Radius | `--radius-xs/sm/md/lg/full` (4/8/14/20/999) |
| Motion | `--ease-spring`, `--duration-fast/base/pulse`; `prefers-reduced-motion` globally neutralizes animation |
| Glass | `--glass-bg(-dense)(-fallback)`, `--glass-blur: 20px`, `--glass-saturation: 1.4`, `.glass` / `.glass-dense` with `@supports` fallback |
| z-order | `--z-*` global scale (see §4, WS-4); room keeps its own documented `--room-z-*` band |
| AI tones | `--ghost-*` semantic tokens (WS-3), never raw hex in component CSS |
| Focus | global `:focus-visible` 2px accent outline; never removed without a replacement |

**Theme position.** Sketchroom is **intentionally dark-only** in this refactor
cycle: `:root` carries the dark palette, there is no `[data-theme='light']` rule
set, and `index.html` pins `data-theme="dark"` before first paint. Light mode is
therefore *not* a "broken toggle" — it is an unimplemented feature (§6, deferred).
The `ThemeProvider` API (`toggleTheme`, `setTheme`) currently has no consumer
and no implementation, which is dead contract surface and must not be presented
as working.

---

## 4. Refactor workstreams

Each item states the defect, the fix, and **acceptance criteria** that can be
checked. Status is updated in place as work lands.

### WS-1 — Token completeness · P0 · **DONE**

`--space-5` is consumed in 7 declarations across `AuthScreen.css`,
`BillingScreen.css`, and `shared.css`, but was never defined. Every one of those
declarations silently computes to an invalid value, so the padding/gap falls back
to the property's initial value — inconsistent gutters that look like sloppy
design rather than a bug.

- **Fix:** define `--space-5: 20px` in the 4px scale.
- **Acceptance:** no `var(--space-*)` reference without a definition; the 7
  affected declarations resolve to 20px.

### WS-2 — Server-facing error handling · P0 · **DONE**

`InviteScreen` rendered `err.message` verbatim, exposing internal text (observed:
`Cannot destructure property 'roomId' of 'undefined'`). Two failures in one: a
raw implementation message reached a user, and a successful mutation with an
unusable payload was treated as success.

- **Fix:** a small mapper for known invite failures (invalid/expired/revoked
  token, already a member, auth required), an explicit guard for a missing
  `roomId` payload, and an unknown-error fallback that never surfaces the raw
  message. Same principle applies app-wide: user-facing strings are ours, logs
  keep the detail.
- **Acceptance:** no code path in `InviteScreen` can render `err.message`; a
  malformed success payload shows the friendly failure state and still offers
  "Back to Dashboard".

### WS-3 — Second color system in AI chrome · P1 · **DONE**

`GhostBlocks.css` hardcoded seven hues (`#5b8cff`, `#a96bff`, `#2cc7be`,
`#ff9548`, `#ffcd42`, `#a0a0aa`, `#25d366`) plus matching focus shadows, so
"the AI color" could not be changed in one place and the tones sat outside the
token ramp.

- **Fix:** promote to `--ghost-*` tokens (hue + dim/border/shadow), consumed by
  the component. The translucent, dashed, floating shape remains the *primary*
  "this is AI" signal; hue is secondary (never color alone).
- **Acceptance:** `GhostBlocks.css` contains no raw hex; every tone reads from
  a token.

### WS-4 — z-index governance · P1 · **DONE**

No shared scale: 78 raw `z-index` declarations, with landing nav at `900`, app
tab bar at `60`, account popover at `40`, room chrome at 5–60 via its own band.
`900` is arbitrary and makes "is the nav above the modal" unanswerable.

- **Fix:** a global `--z-*` scale in `index.css` (`base`, `raised`, `sticky`,
  `nav`, `overlay`, `modal`, `toast`, `skip-link`), adopted by the marketing nav
  and the phone tab bar. The room keeps `--room-z-*` because it is a self-
  contained stacking context documented in `RoomScreen.css`.
- **Acceptance:** marketing nav and app tab bar reference tokens, not integers;
  the room's documented band still sits below its modals.

### WS-5 — Touch/click target compliance · P1 · **DONE**

Controls measured below the 44px mobile minimum: the marketing hamburger
(40px), room icon/back buttons (36px). Small controls are legitimate in a dense
canvas chrome, so the fix must not grow the visual glyph or reflow the rail.

- **Fix:** hamburger becomes 44×44 where it is actually shown (≤768px); room
  icon and back buttons gain an invisible ≥44px hit area on touch via an
  absolutely-positioned overlay, visual size unchanged.
- **Acceptance:** hamburger ≥44×44 at ≤768px; room icon buttons expose ≥44px
  hit area at ≤720px while still rendering at 36px.

### WS-6 — Marketing hero bleed · P2 · **DONE**

`hero-ring-2` was `min(104vw, 1180px)`, i.e. wider than the viewport by design,
producing an ~11px overhang at 768px that was only hidden by clipping.

- **Fix:** cap the ring inside the viewport (`min(96vw, 1180px)`) so the bleed is
  intentional geometry rather than clipped overflow.
- **Acceptance:** no horizontal document overflow at 375/768/1280.

### WS-7 — Type-ramp adoption · P2 · **DONE**

`--fs-h3` (clamp 20→26px) exists but the room empty-state title hardcoded 26px,
the exact value the ramp resolves to at desktop, so the two drift apart on
smaller screens.

- **Fix:** use `var(--fs-h3)`. No visual change at desktop width.
- **Acceptance:** no hardcoded 26px heading outside the token file.

### WS-8 — Dead code removal · P2 · **DONE**

`src/App.css` is a comment-only file with no importer.

- **Fix:** delete it.
- **Acceptance:** file absent; nothing imports it.

### WS-9 — Honest theme contract · P2 · **OPEN (deferred to §6)**

`ThemeProvider` stores `useState<Theme>('dark')` with `toggleTheme`/`setTheme`
as no-op closures, and `index.html` hardcodes `data-theme="dark"`.

- **Decision:** do not fake a light theme. Either implement light tokens
  properly (design work, §6) or remove the unused toggle API. Do **not** wire a
  toggle that appears to work and cannot change anything.

---

## 5. Current-state assessment

### 5.1 Findings from the 2026-08 audit that are now obsolete

Do not re-open these; they were fixed and the code has moved on.

| Audit finding | Current reality |
| --- | --- |
| Landing nav broken at ≤375px | Fixed, with Playwright regression coverage at 320/375/430/480 |
| "Inter" declared but not shipped | Fonts are now Urbanist/Nunito/Caveat, loaded via Google Fonts in `index.html` |
| No typographic scale tokens | `--fs-display/title/h3/body/sm/xs` exist in `index.css` |
| Glass saturation/blur out of spec | `--glass-saturation: 1.4`, `--glass-blur: 20px` — inside spec |
| Type divergence: room title 26px | Now the empty-state title; migrated to `--fs-h3` (WS-7) |

### 5.2 Verified strengths (protect these)

- Routing does the hard part correctly: protected/public guards, `?next=`
  intent preservation with open-redirect sanitization, per-screen error
  boundaries with recovery actions, lazy route chunks, single `main` landmark
  and a skip link.
- Save pipeline is honest: debounced flush, status pill, version history,
  confirmed restore, idempotent snapshots via `clientChangeId`.
- Server enforces membership and roles; client never sends its own role.
- AI stays a draft: ghost blocks, insert actions, dismiss, explicit context
  scoping (prompt + selection), documented model routing.
- Accessibility baseline: focus-visible everywhere, reduced-motion honored,
  double-confirm on destructive actions, labeled icon buttons, modal focus traps.
- Test surface is real: Vitest over Convex features, Playwright over the actual
  screens on a stubbed backend.

### 5.3 Outstanding risk register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Dark-only with a no-op theme API | Confusing contract, dead code | WS-9 decision, §6 |
| ~78 raw `z-index` values remain outside WS-4's two adopters | Local stacking bugs | Migrate per-screen when touched; never add a new raw value |
| ~1.5k hardcoded px in screen CSS | Drift from the ramp | Adopt tokens opportunistically (WS-7 pattern), not a big-bang sweep |
| Marketing and app have separate visual languages | Brand discontinuity | Deliberate: marketing is expressive, product is quiet. Do not "unify" |
| `npx convex dev` required for a live room | Onboarding friction | Documented in README; cloud sandbox cannot run it (no browser) |

---

## 6. Deferred — explicitly out of scope

Recorded so it is not silently re-attempted:

1. **Light theme.** Requires a real light token set (bg/ink/line/elevation/
   glass/status) plus a pass over every `[data-theme='dark']` override. Design
   work, not a refactor. Until then the app is dark-only and says so.
2. **Theme toggle UI.** Must not ship before (1).
3. **Full token sweep of every hardcoded px.** Mechanical but high-churn; do it
   screen-by-screen as those screens are edited.
4. **Backend/AI changes.** This pack is frontend. Convex function contracts,
   rate limits, and model routing are unchanged.
5. **New features.** No comments redesign, no new export formats, no new AI
   modes.

---

## 7. Definition of done

A refactor change is done when all of these hold:

1. **Scoped** — traceable to a WS item here, or required to make one work.
2. **Contract-respecting** — consumes existing tokens; introduces a token rather
   than a literal; adds no second system for something that already has one.
3. **Honest** — no UI that claims capability it lacks (theme toggle, save state,
   roles, limits).
4. **Robust at the edges** — loading, empty, error, and malformed-payload states
   are handled; user-facing copy is ours, never a raw exception.
5. **Accessible** — keyboard reachable, visible focus, ≥44px touch targets on
   mobile, no color-only signal.
6. **Verified** — `tsc -b` clean, `npm run build` passes, `npm test` passes, and
   `npm run test:smoke` passes when the touched surface has a spec. A visual
   change is not "verified" without saying it was not viewed.
7. **Recorded** — this pack's status column updated in the same change.

---

## 8. Status ledger

| WS | Item | Priority | Status |
| --- | --- | --- | --- |
| 1 | `--space-5` defined | P0 | DONE |
| 2 | Invite error handling | P0 | DONE |
| 3 | `--ghost-*` tokens | P1 | DONE |
| 4 | `--z-*` scale adopted | P1 | DONE |
| 5 | 44px touch targets | P1 | DONE |
| 6 | Hero ring capped | P2 | DONE |
| 7 | `--fs-h3` adoption | P2 | DONE |
| 8 | Dead `App.css` removed | P2 | DONE |
| 9 | Theme contract decision | P2 | OPEN — deferred to §6 |

**Verification run (2026-11-20):** `npm ci` clean · `npm run build` exit 0 (tsc + vite) · `npm test` 70/70 passing in 10 files · `npm run test:smoke` **could not run in this environment**: Chromium downloads but cannot launch because the sandbox lacks `libnspr4`, and system packages cannot be installed (no root / `no-new-privileges`). The smoke suite — including the landing-nav viewport assertions that cover WS-5 — must be run on a machine with Playwright's browser dependencies before this pack's visual claims are treated as regression-tested. The served UI was confirmed reachable over HTTP; it was **not** visually inspected.
