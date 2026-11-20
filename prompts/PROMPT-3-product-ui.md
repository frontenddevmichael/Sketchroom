# PROMPT 3 — Product UI rebuild (every screen)

## REBUILD MANDATE (overrides any "restyle" wording below)
This is a component-level rebuild, not a reskin. Forbidden: changing colors/classes on existing JSX, adding override CSS on top of old CSS, wrapping old components, keeping old markup because "it works".
For EVERY component and screen, do this loop:
1. Read the old component for its behaviour contract only (props, data, edge cases, a11y, tests). Write that contract in 5 lines.
2. Decide: rebuild or keep. Default is REBUILD. Keep only if it already uses `src/ui` primitives, has zero legacy CSS, and matches the refs; justify each keep in `/docs/REFACTOR-NOTES.md`.
3. Rebuild from `src/ui` primitives with new markup, new CSS module, new states. Delete the old file in the same commit. A component is not done until its old CSS is deleted.
4. If the old structure itself fights the design (e.g. side panels, toolbars, modals, the 825-line `ToolOptions`, `Dashboard` cards, `AuthScreen` split layout), redesign the interaction, not just the look.
5. Tests: behaviour contract must still pass; update tests only when the contract intentionally changes, and list those changes.
Done-check: `git grep` for every old class name and legacy token returns nothing; no CSS file survives that you did not write in this pass; diff shows deletions of old components, not edits.

Read `/design/SKILL.md` and refs. Apply the blueprint language to the entire app: Auth, Dashboard, Room (canvas chrome, toolbar, AI feed, comments, presence, share modal, version history, export, block library, tool options), Settings, Billing, Invite, Legal, 404/Error, loading and empty states.

## Method
1. Before coding, screenshot every current screen/state (use `dev/appSeed.ts` + harness) into `/docs/before/`. After, `/docs/after/`.
2. **Split `RoomScreen.tsx`** (1,958 lines) and its 1,947-line CSS into `src/room/` modules per the map from Prompt 0 (canvas host, toolbar, panels, presence layer, AI layer, onboarding). Behaviour-preserving split first (tests green), then rebuild each extracted module per the mandate above.
3. Restyle with `src/ui` only. tldraw: self-hosted assets, custom `components` and CSS variables so toolbar, style panel, menus and selection handles use tokens (hairline, tile `#EDEDED`, ink selection). Canvas ground = `--paper` + dot grid.
4. Line-state grammar in product: AI ghost blocks dashed + arcs, Accept = commit moment; saved/connection status as a tiny mono tag; presence cursors black arrow + name tag + arcs, muted collaborator hues only on cursors/avatars; selection awareness rings dashed.
5. Empty states: use the 9 isometric scenes, one primary action each: no rooms, no search results, no history, no AI suggestions, no collaborators, solo in room, free-limit reached (shows real limits from entitlements), offline/disconnected, error. Loading: skeletons that mirror real layouts as hairline wireframes; `SketchIn` for full-screen loads; long-load messaging via existing `useLongLoad`.
6. Responsive per breakpoint (375/768/1280/1920), not just fluid: panels become full-height sheets on mobile, bottom bar with clear active state, tap targets ≥ 44px. Dark mode = negative blueprint, verified screen by screen.
7. HCI pass (Nielsen's 10 heuristics) on the multiplayer+AI canvas: status visibility (who is here, saved?), undo for AI inserts, confirm-with-preview for restore, error recovery copy, consistent terms (propose/commit/restore everywhere), keyboard shortcuts discoverable, a11y live regions kept.
8. Delete all dead CSS; target < 600 lines per CSS file, zero hardcoded colors.

## Verify
Visual snapshots for every screen/state/theme/breakpoint committed as Playwright baselines; axe 0 serious; two-user e2e from Prompt 0 still green; no console errors. Self-audit: you built the old code and now this; list your own shortcuts and untested assumptions in `/docs/REFACTOR-NOTES.md` and fix them. If any item needs a rebuild larger than a small fix, stop and report before doing it. Commit; do not push.
