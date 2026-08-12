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


