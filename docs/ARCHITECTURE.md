# Sketchroom — Architecture

**Scope:** React 19 + Vite 8 + tldraw 5 on the client; Convex (queries, mutations,
actions, crons) + Convex Auth on the server; AI via an OpenAI-compatible endpoint.
Verified against `main` at `eaf79bf` (Nov 2026). Read `/design/SKILL.md` before UI work.

---

## 1. Entry points and process model

```
index.html
  └─ inline <script> pins data-theme="dark" before first paint
  └─ /src/main.tsx
       ConvexAuthProvider(client) → BrowserRouter → AppProviders
         ThemeProvider (theme fixed to 'dark'; toggle is a no-op)
         ErrorBoundary (reports React errors to Convex errorLogs + Sentry)
           App (routes, lazy chunks, per-screen error boundaries)
```

Every route is a lazily-loaded chunk. The room chunk pulls tldraw (~1.87 MB raw /
561 kB gzip) and is only fetched on `/room/:roomId`; the landing route never
imports it. `vite.config.ts` splits `tldraw`, `convex`, `motion`, `gsap` and
`export` (jspdf/h2c) into separate vendor chunks.

## 2. Data model (`convex/schema.ts`)

| Table | Key fields | Indexes |
| --- | --- | --- |
| `workspaces` | `name`, `ownerId`, timestamps | `by_owner` |
| `rooms` | `workspaceId`, `name`, `ownerId`, `canvasData` (JSON canonical map), `canvasVersion` (monotonic), `compactedVersion`, `thumbnailData`, `lastEditedBy`, `onboardingCompleted` | `by_workspace`, `by_owner` |
| `roomMembers` | `roomId`, `userId`, `email`, `name`, `avatarUrl`, `role` owner/editor/viewer | `by_room`, `by_user`, `by_room_user`, `by_room_email` |
| `snapshots` | `roomId`, `version`, `canvasData`, `createdBy`, `description`, `clientChangeId` | `by_room_version`, `by_room`, `by_client_change` |
| `aiMessages` | `roomId`, `userId`, `prompt`, `response`, `ghostBlocks`, `status` | `by_room`, `by_room_status_created` |
| `presence` | `roomId`, `userId`, `name`, `color`, `cursorX/Y`, `camera`, `selectedShapeIds`, `lastActive` | `by_room`, `by_room_user` |
| `invites` | `roomId`, `email`, `role`, `token`, `status`, `expiresAt` | `by_room`, `by_token` |
| `comments` | `roomId`, `userId`, `x`, `y`, `body`, `resolved`, `parentId` | `by_room`, `by_room_unresolved`, `by_parent` |
| `errorLogs` | `userId?`, `source`, `message`, `stack?`, `createdAt` | `by_created` |

Convex Auth tables (`users`, `authAccounts`, `authSessions`,
`authVerificationTokens`) are spread in from `authTables`.

## 3. Auth

- `convex/auth.ts` — Convex Auth with `Password` (Scrypt) always on; `ResendOTP`
  verification/reset when `AUTH_RESEND_KEY` is set; Google when
  `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` are set. 30-day rolling sessions.
  `redirect` callback allowlists `/verify-otp` and `/dashboard`.
- `convex/auth.config.ts` verifies JWTs against `process.env.CONVEX_SITE_URL` —
  that value must equal the deployed origin or every request 401s.
- `convex/http.ts` registers `auth.addHttpRoutes` (OIDC discovery, JWKS, OAuth
  callbacks). This is the only HTTP router; there is no payment webhook yet.
- `convex/core/lib.ts#auth.getIdentity` splits the `sub` claim
  (`"<userId>|<sessionId>"`) so the rest of the backend can treat `subject` as
  the app-wide user id.
- Client-side: `ProtectedRoute` / `PublicRoute` in `src/App.tsx` gate rendering
  and preserve intent via `?next=`, validated by `isSafeNext` against an
  allowlist of prefixes (blocks `//host` open redirects).

**Authorization primitives** (`convex/core/lib.ts`): `requireUser`,
`requireMember`, `requireRole(ctx, roomId, roles[])`. Absence of a membership is
a hard error on mutations and an empty/null result on queries.

## 4. Canvas sync

- State is one JSON canonical map `{ [recordId]: TLRecord }` in `rooms.canvasData`,
  restricted to document-scope records. `parseCanonicalRecords` drops
  session-scope types (`camera`, `instance`, `instance_page_state`, `pointer`,
  `instance_presence`) and anything without a usable `typeName`, and tolerates the
  legacy `{ schema, records }` shape.
- **Write path** — the client listens to the tldraw store, filters to
  `source: user, scope: document`, accumulates a diff `{ put, remove }` in
  `pendingDiff`, seeds document+page records on first edit, and debounces a
  flush (~1.2 s). `applyCanvasChanges` validates the payload shape, enforces
  editor/owner role, rate-limits (`canvasApply` 120/min, burst 30), merges into
  the canonical map, rejects over `MAX_CANVAS_BYTES` (850 kB), bumps
  `canvasVersion`, and records `lastEditedBy`. Same-record writes are
  last-write-wins per record — tldraw's own semantics.
- **Read path** — `loadCanvas` returns `{ canvasData, canvasVersion, compactedVersion }`;
  peers reconcile only the records that changed, so remote edits never echo back
  as local writes (the store listener filters on `source: user`).
- **Snapshots** — `saveSnapshot` writes the full canvas plus a version row, then
  prunes to the newest `SNAPSHOT_RETENTION` (60) per room in batches of 100.
  `restoreSnapshot` first inserts a "Before restoring vN" backup, then writes the
  restored data at a new version — a restore is always reversible.
- **Version arithmetic flaw to watch:** `restoreSnapshot` inserts the backup at
  `newVersion` and then sets the room to `newVersion + 1`, so the backup row and
  the room never share a version. Correct today, but any future "jump to
  version" UI must use snapshot ids, not version numbers.

## 5. Presence

- Client ships presence every 8 s and on pointer/selection/camera change
  (`upsertPresence`), sweeps stale peers every 12 s (`prunePresence`), removes on
  `pagehide`/unmount. Server TTL is 15 s; `getPresence` filters stale rows even
  before the pruner runs and never returns the caller's own row.
- Viewers may only prune their own row; owners/editors may prune anyone.
- A 6-hour cron (`cleanupStalePresence`) is the backstop.

## 6. AI pipeline

1. `useAiCopilot.buildContext()` scores up to 60 shapes: selected first, then by
   distance to viewport centre; each carries `{label, kind, x, y, selected}`.
2. `requestAiSuggestion` (action) checks: auth → room membership and role (viewers
   rejected) → prompt non-empty and ≤ 4000 chars → monthly quota → three token
   buckets (`aiRequest` 6/min user, `aiRequestPerRoom` 20/min, `aiRequestGlobal`
   100/min) → inserts a `pending` `aiMessages` row → calls the model.
3. `Model.completion()` returns `{ blocks, edges, summary }`; `buildDiagram()`
   sanitises blocks (allowlisted kinds, ≤ 8 blocks, ≤ 40 chars, HTML-escaped),
   edges (index range, no self-loops, deduped, ≤ 40), and falls back to heuristic
   blocks when the model returns nothing usable.
4. The action stores `completed` (or `failed` with user-safe copy) and returns
   `ghostBlocks` as JSON.
5. The client renders ghost blocks as dashed, non-committal suggestions; insert
   goes through `insertDiagram`/`insertGhost`, which lay out with collision
   resolution (`collectExistingRects` → `resolvePosition`, ≤ 30 shifts), then
   write through the normal canvas diff path.

## 7. Plan limits and metering — where the numbers live

| Number | Server enforcement | Client mirror |
| --- | --- | --- |
| rooms = 3 | `convex/core/lib.ts:9` → `createRoom` | `src/lib/plans.ts:3` |
| collaborators = 3 | `convex/core/lib.ts:11` (unused) and hardcoded `convex/core/usage.ts:55` | `src/lib/plans.ts:6` |
| AI / month = 40 | `convex/core/lib.ts:10` → action | `src/lib/plans.ts:7` |
| snapshot retention = 60 | `convex/core/lib.ts:12` | — |

Both invite paths (`inviteMember`, `createInviteLink`) count members + pending
invites against the collaborator cap.

## 8. Routing

`/` landing (public) · `/auth` (public, redirects when authed) · `/dashboard`,
`/room/:roomId`, `/invite/:token`, `/settings`, `/billing` (protected) ·
`/terms`, `/privacy`, `/error`, `*`. Unknown paths render `NotFoundScreen`.
`?next=` only accepts `/room/`, `/dashboard`, `/settings`, `/billing`.

## 9. Error handling and observability

- `ScreenErrorBoundary` per route with named recovery actions; root
  `ErrorBoundary` reports to `core.errors.reportError` (rate-limited 30/min per
  user or a shared anonymous bucket, message capped at 2000 chars) and Sentry.
- Convex `errorLogs` retention: weekly cron deletes rows older than 30 days.
- User-facing copy is owned by the app: mutations throw messages written for
  humans; `InviteScreen` maps known failures and never prints `err.message`
  verbatim.
- Crons: expired invites (24 h), stale presence (6 h), error logs (168 h).

## 10. `RoomScreen.tsx` module map (1,971 lines — split target for Prompt 3)

| Extract to | Responsibility today |
| --- | --- |
| `room/canvas-host` | `createTLStore`, `<Tldraw assetUrls>`, `onMount`, editor ref, read-only/grid state, tool→UI mapping, `RoomCanvasBoot` |
| `room/sync` | `pendingDiff`, baseline seeding, `flush`, debounce, retry-on-more-edits, save-status pill, initial reconcile |
| `room/presence` | pointer/selection/camera shipping, 8 s heartbeat, 12 s sweep, visibility/pagehide, unmount cleanup |
| `room/onboarding` | `CanvasOnboardingSketch`, walkthrough steps, `completeOnboarding`, coachmarks (`RoomCoachmarks`, `CoachmarkPill`) |
| `room/panels/*` | version history, block library, share, export, comments, tool options |
| `room/ai/*` | AI bar, feed wiring, ghost overlay, insert/accept |
| `room/chrome/*` | topbar, name field, presence avatars, rail, zoom cluster, status, tabs |
| `room/a11y` | announcer wiring, shortcut help, live regions |

Helpers already separable at the top of the file: `presenceColorFor`,
`parseCanonicalRecords`, `toolTitle`, `CanvasOnboardingSketch`.

## 11. Verified defects and smells

| # | Where | Finding |
| --- | --- | --- |
| A1 | `convex/core/lib.ts:11`, `convex/core/usage.ts:55` | `FREE_COLLABORATORS_PER_ROOM` is exported but never imported; `usage.ts` hardcodes `3` separately. The cap has no single source. |
| A2 | `src/lib/plans.ts:2` | Comment points at `convex/lib.ts`; the file is `convex/core/lib.ts`. Client limits are hand-copied with no test asserting they match the server. |
| A3 | `convex/core/usage.ts:27-45` | AI quota counts **every** completed `aiMessages` row in every room the user belongs to, regardless of author. A busy teammate's usage is charged to every member, while the UI calls it "your AI suggestions". Also `take(1000)` per room silently caps counting. |
| A4 | `convex/features/presence.ts:12-15` | `name` and `color` are arbitrary client strings — unvalidated, unbounded, and not derived from the user record. A client can render itself as any name/colour to peers. |
| A5 | `index.html:39` | The inline theme script is why the CSP needs `script-src 'unsafe-inline'`. `ThemeProvider` already pins dark, so the pre-paint script is redundant; removing it (or hashing it) lets the CSP tighten. |
| A6 | `src/lib/ThemeProvider.tsx:5-14` | `theme` is fixed to `'dark'`; `toggleTheme`/`setTheme` are no-ops exposed through context. Dead contract surface. |
| A7 | `vercel.json` CSP | Allows `fonts.googleapis.com`/`fonts.gstatic.com`, which Prompt 1 removes with self-hosted Geist; and relies on `'unsafe-inline'` for scripts. |
| A8 | `src/screens/RoomScreen.tsx` | One component with ~30 effects and ~1,900 lines of CSS beside it. No behavioural tests cover the save/presence/AI orchestration end to end. |
| A9 | repo root | `project(2)/` (HTML dump + screenshots) and `.omo/run-continuation/*.json` are unreferenced; `harness.html` **is** referenced (Playwright `webServer.url`), so it stays. |
