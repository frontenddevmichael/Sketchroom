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
| Auth     | Clerk                                    |
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
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

> Convex and Clerk both have generous free tiers and accept local development keys. Swap in production keys before deploying.

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

1. Deploy the Convex functions: `npx convex deploy`.
2. Set the production `VITE_CONVEX_URL` and `VITE_CLERK_PUBLISHABLE_KEY` (and the matching server-side keys in Convex/Clerk) for the build environment.
3. Build with `npm run build` and serve `dist/` from any static host (the app is a single-page app; route all paths to `index.html`).
