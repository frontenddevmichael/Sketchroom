# Sketchroom Refactor Pack

Drop this whole folder into the repo root (`design/` goes to `/design`, prompts stay in `/prompts`). Add one line to `AGENTS.md`:
`Before any UI work read /design/SKILL.md. It overrides every older style in the repo, including README "Kuda dark green".`

## Run order (one prompt per agent session, commit between)
1. `prompts/PROMPT-0-deep-read-and-prod-fixes.md` — understand codebase, fix the production gaps below. No visual changes.
2. `prompts/PROMPT-1-design-system-and-illustrations.md` — tokens, fonts, icon set, isometric kit. Foundation only.
3. `prompts/PROMPT-2-marketing-site.md` — landing rebuild to match refs.
4. `prompts/PROMPT-3-product-ui.md` — Dashboard, Room, Auth, Settings, Billing, empty/loading states.
5. `prompts/PROMPT-4-final-gate.md` — verification, then push.

## What I verified in the repo (clone at HEAD, Nov 20 2026)
- `tsc -b` clean, 70/70 vitest pass, eslint 0 errors / 2 warnings (stale deps in RoomScreen.tsx lines ~489, ~819).
- Backend authz is solid on the paths I read: queries return empty/null for non-members, mutations use `requireRole`, AI action checks role + monthly quota + prompt size before the provider call, rate limiter on canvas/snapshots/comments/thumbnails.
- I did NOT read RoomScreen.tsx (1,958 lines) or Dashboard.tsx line by line, nor invites/email internals. Prompt 0 forces that read.

## Production gaps found (Prompt 0 fixes these)
1. **tldraw assets likely load from tldraw's CDN, which your CSP blocks** (`vercel.json` allows only self/gstatic for fonts, no cdn.tldraw.com). No `assetUrls` override exists in `src`. Verify in the production network tab, then self-host.
2. **No payment path exists.** `core/lib.ts` says so in a comment, `BillingScreen` has no provider, and `schema.ts` has no plan field on users/workspaces. "Paid team tier" is unenforceable today.
3. **Landing is the opposite of your new direction**: emoji stickers, "playful 10k" palette, Framer rings, dark green theme, ~1,500 hardcoded px values (own audit, `.omo/evidence/audit/REPORT.md`).
4. **index.css carries dead token systems** (`--green-*`, `--neutral-*`, `--playful-*`, legacy aliases). Must be deleted, not layered over.
5. **Monoliths**: `RoomScreen.tsx` 1,958 lines + `RoomScreen.css` 1,947; `Dashboard.css` 1,474. Split during the product refactor.
6. **Repo hygiene**: 24 `.omo/run-continuation/*.json`, `project(2)/` HTML dump, `harness.html`, `dev/audit-*.mjs`, both `package-lock.json` and `pnpm-lock.yaml` (CI uses pnpm only). README is stale (wrong file paths, wrong fonts/theme).
7. **CSP has `script-src 'unsafe-inline'`**; a >500 kB chunk warning at build; Playwright smoke tests run against stubs, so there is **no real multi-user sync test**.

## Decisions I made for you (veto any)
- Brand is strictly monochrome ink on paper, confirmed by you. Green is retired everywhere. Cursors, tldraw shape colors, comment pins and AI ghosts also go grey; only `--danger` (errors) keeps a hue.
- Fonts: Geist + Geist Mono (neo-grotesk like ref 2, mono for the dotted annotation tags), self-hosted.
- Payment: Paystack (you are in Lagos, NGN cards/transfer). Prompt 0 stops and asks before wiring it.
- Illustrations: code-generated isometric kit (consistent, themeable, animatable) + optional Recraft V4 Vector for hero assets, cleaned by script.
