# Sketchroom

Sketchroom is a real-time collaborative planning canvas with an AI copilot — built for teams that think in pictures. Create a room, invite the team, sketch the plan while you talk, and leave with something you can act on.

## What it does

- **Live collaborative canvas** — tldraw-powered sketching with presence: cursors, selections, and who's working nearby, all in real time.
- **AI copilot** — ask it to draft, refine, or answer; suggestions land as ghost blocks you can accept or throw away.
- **Block library** — drop structured planning blocks (architecture, flows, personas) onto the board.
- **Version history** — automatic snapshots you can restore from, with a confirmation before any restore.
- **Presence & awareness** — save/connection status, live avatars, selection focus rings, and a quiet solo mode.
- **Export** — save the room's thinking as an image or document.
- **Invites & roles** — share a room, control who edits, and manage collaborators from the Share modal.
- **Free tier with clear limits** — rooms, collaborators, and AI suggestions metered with an honest upgrade path.
- **Polish throughout** — hand-drawn illustration family for empty/loading states, sketch-in onboarding walkthrough, dark/light theming with a true-black elevation system, and a fully responsive app + marketing site.

## Tech stack

| Layer    | Choice                                   |
| -------- | ---------------------------------------- |
| Frontend | React 19, TypeScript, Vite               |
| Canvas   | tldraw                                   |
| Backend  | Convex (queries, mutations, presence)    |
| Auth     | Convex Auth (email/password + Google)    |
| Motion   | Framer Motion, GSAP (marketing)          |
| Styling  | Hand-written CSS with a shared token system |
| Tests    | Vitest, Playwright (smoke + harness)     |

## Getting started

```bash
npm install
```

Copy `.env.local.example` to `.env.local` (or create it) and fill in:

```env
VITE_CONVEX_URL=https://<your-project>.convex.cloud
VITE_CONVEX_SITE_URL=https://<your-project>.convex.site
```

> Convex has a generous free tier and accepts local development keys. Swap in production keys before deploying.

Auth secrets live on the Convex deployment, not in `.env.local`. Set them with:

```bash
npx convex env set SITE_URL https://your-app.example.com
npx convex env set AUTH_RESEND_KEY re_...        # enables email verification + password reset
npx convex env set AUTH_GOOGLE_ID <client-id>    # enables "Continue with Google"
npx convex env set AUTH_GOOGLE_SECRET <secret>
```

The auth screen hides the corresponding controls until each secret is present, so the UI never offers a dead end.

Run the app:

```bash
npm run dev
```

Deploy the backend:

```bash
npx convex dev
```

## Testing

```bash
npm run test        # unit tests (Vitest)
npm run test:smoke  # Playwright smoke tests against the dev harness
npm run lint        # ESLint
npm run build       # type-check + production build
```

The smoke tests drive the real app components through a stub-backed dev harness (`/harness.html`), exercising the critical paths: dashboard render, room creation, canvas save/restore, version history, and room chrome.

## Project structure

```
src/
  components/     Shared UI, panels, illustrations, modals
  screens/        Dashboard, Room, Settings, Billing, Auth
  landing/        Marketing site (hero, walkthrough, pricing, FAQ)
  lib/            Hooks, tldraw glue, presence, theme, modal focus
convex/           Backend: rooms, canvas, presence, AI, billing
dev/              Dev harness + Playwright smoke tests
```

## Deployment

**Backend** — the production Convex deployment is already set up (`outgoing-hamster-346`, <https://outgoing-hamster-346.convex.cloud>) with the auth tables, JWT signing keys, and auth HTTP routes deployed. To update it after a code change:

```bash
npx convex deploy --prod
```

For CI, create a deploy key once (`npx convex deployment token create ci --deployment prod`), set it as `CONVEX_DEPLOY_KEY`, and run `npx convex deploy`.

**Auth secrets on production** (set with `npx convex env set` while logged in, or via the dashboard):

| Variable | Purpose | Status |
| --- | --- | --- |
| `SITE_URL` | Public app URL (OAuth + redirect validation) | **Set me** — must match your real domain |
| `AUTH_RESEND_KEY` | Enables email verification + password reset | **Set me** — Resend key |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Enables "Continue with Google" | **Set me** — Google OAuth app |

Until `AUTH_RESEND_KEY` is set, sign-up skips email verification and the forgot-password link is hidden; until the Google secrets are set, the Google button is hidden — the auth screen never offers a dead end.

**Frontend** — set the production `VITE_CONVEX_URL=https://outgoing-hamster-346.convex.cloud` and `VITE_CONVEX_SITE_URL=https://outgoing-hamster-346.convex.site` for the build environment, then `npm run build` and serve `dist/` from any static host (the app is a single-page app; route all paths to `index.html`).
