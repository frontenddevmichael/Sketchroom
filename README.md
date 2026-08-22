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

## Getting started (new environment)

**Prerequisites:** Node.js `^20.19.0 || >=22.12.0` (Vite 8 requirement) and npm.

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Authenticate the Convex CLI**
   ```bash
   npx convex login
   ```

3. **Create the environment file**
   ```bash
   cp .env.local.example .env.local
   ```
   Fill in the `VITE_*` values. See [Environment variables](#environment-variables) below.

4. **Start the backend** (terminal 1)
   ```bash
   npx convex dev
   ```
   On first run this creates a dev deployment (e.g. `rare-hare-321`) and prints its URLs. The deployment URL it reports **must match** `VITE_CONVEX_URL` in `.env.local` — the CLI pushes functions to the deployment the app talks to. Copy the reported URLs into `.env.local` if they differ.

5. **Start the frontend** (terminal 2)
   ```bash
   npm run dev
   ```
   Open http://localhost:5173 and sign up with an email. Restart Vite if you change `.env.local`.

## Running locally

The app needs two processes:

| Terminal | Command          | What it does |
| -------- | ---------------- | ------------ |
| 1        | `npx convex dev` | Typechecks `convex/`, pushes functions to the dev deployment, regenerates `convex/_generated/`, hot-reloads on change |
| 2        | `npm run dev`    | Vite dev server on http://localhost:5173 |

**First run checklist** — if something isn't working:
- `VITE_CONVEX_URL` in `.env.local` exactly matches the deployment URL printed by `npx convex dev`.
- `CONVEX_SITE_URL` / `VITE_CONVEX_SITE_URL` are the site origin the browser is on (`http://localhost:5173` in dev).
- Server-side env vars are set with `npx convex env set` (not `.env.local`) — see below.

## Convex auth

Auth is [Convex Auth](https://labs.convex.dev/auth) (`@convex-dev/auth`), configured in **`convex/auth.ts`**:

- **Email + password** is always available (Scrypt-hashed by default, with email normalization and a friendly `ConvexError` for invalid addresses/short passwords).
- **Email verification & password reset** activate automatically when `AUTH_RESEND_KEY` is set (OTP codes + reset emails via Resend, from `convex/core/email.ts`).
- **Google OAuth** activates automatically when `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` are set.
- **30-day rolling sessions** — `convexAuth({ session: { totalDurationMs, inactiveDurationMs } })`.
- The client learns which features are live from the `users.authConfig` query and shows/hides the matching sign-in controls.

Auth wiring spans three files that **must stay at the `convex/` root**:

| File                  | Why it must be at the root |
| --------------------- | -------------------------- |
| `convex/auth.ts`      | `@convex-dev/auth` calls functions by hardcoded names (`auth:signIn`, `auth:signOut`, `auth:store`) |
| `convex/auth.config.ts` | Lets the framework verify the JWTs Convex Auth issues; the issuer domain comes from `process.env.CONVEX_SITE_URL` |
| `convex/http.ts`      | `auth.addHttpRoutes(http)` registers the OIDC discovery/JWKS + OAuth callback routes |

The issuer domain in `auth.config.ts` reads `CONVEX_SITE_URL`, so that value **must match the actual site origin** (`http://localhost:5173` in dev, your deployed domain in production) or OAuth/JWT verification breaks.

## Convex code layout

```
convex/
├── auth.config.ts   # framework JWT verification (issuer = CONVEX_SITE_URL)
├── auth.ts          # Convex Auth setup (hardcoded "auth:*" paths — keep at root)
├── convex.config.ts # app entry + component mounts
├── http.ts          # HTTP router (auth routes)
├── schema.ts        # database schema
├── tsconfig.json    # CLI typecheck config (kept in sync with convex dev)
├── _generated/      # codegen output — do not edit
├── core/            # cross-cutting helpers: email, errors, lib, rateLimiter, usage, users
├── features/        # domain modules: ai, aiDiagram, aiStore, canvas, invites, presence, rooms, snapshots
└── tests/           # unit tests mirroring the feature modules
```

Convex uses **file-based routing**: `convex/features/rooms.ts` exposes `api.features.rooms.*`, `convex/core/users.ts` exposes `api.core.users.*`. Before editing Convex code, read `convex/_generated/ai/guidelines.md` — it contains project-specific rules that override generic Convex knowledge.

## Environment variables

Two places, by design:

**`.env.local`** — client-side `VITE_*` vars only (they ship in the JS bundle):
| Var                     | Required | Notes |
| ----------------------- | -------- | ----- |
| `CONVEX_DEPLOYMENT`     | yes      | Deployment slug, e.g. `dev` or `dev:rare-hare-321` |
| `VITE_CONVEX_URL`       | yes      | Backend URL shown by `npx convex dev` (e.g. `https://rare-hare-321.convex.cloud`) |
| `VITE_CONVEX_SITE_URL`  | yes      | Site origin (`http://localhost:5173` in dev) |
| `CONVEX_SITE_URL`       | yes      | Same origin, read server-side as the JWT issuer domain |
| `VITE_TLDRAW_LICENSE_KEY` | no    | 100-day trial key from https://tldraw.dev/setup/licensing |

**Server-side secrets** — set with `npx convex env set NAME`, **never** in `.env.local`:
| Var                     | Purpose |
| ----------------------- | ------- |
| `AUTH_RESEND_KEY`       | Enables email verification + password reset |
| `AUTH_EMAIL_FROM`       | "From" address for auth + invite emails |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Enable "Continue with Google" |
| `OPENROUTER_API_KEY`    | Enables the AI copilot |
| `OPENROUTER_MODEL`      | Model id (defaults to `google/gemma-4-26b-a4b-it:free`) |
| `SITE_URL`              | Site origin sent to OpenRouter for attribution |

`.env.local` is gitignored (`*.local`). A new dev can run without `OPENROUTER_*`/`AUTH_RESEND_KEY`/`AUTH_GOOGLE_*` — those features just won't appear.

## Deployment

Production runs on the same Convex project:

```bash
npx convex deploy        # push all convex functions + schema to production
npx convex dashboard     # open the dashboard for the deployment
```

1. **Set production secrets** — `npx convex env set` writes to whichever deployment is active, so switch to production first, then set every server-side var from the table above (`AUTH_RESEND_KEY`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `OPENROUTER_API_KEY`, …).
2. **Update the site origin** — `CONVEX_SITE_URL` / `VITE_CONVEX_SITE_URL` must point at the deployed domain (this is the JWT issuer domain in `auth.config.ts`; mismatch = auth failures in production).
3. **Update `VITE_CONVEX_URL`** to the production deployment URL before building the frontend.
4. **Deploy the frontend** — `npm run build` (`tsc -b && vite build`), then host `dist/` as usual.

## Scripts & tests

| Command              | What it does |
| -------------------- | ------------ |
| `npm run dev`        | Vite dev server |
| `npm run build`      | `tsc -b && vite build` (typecheck + production bundle) |
| `npm test`           | Unit tests — Vitest + `convex-test`, run against an in-memory Convex (no deployment or auth needed) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:smoke` | Playwright smoke tests against the dev harness (auto-boots a harness Vite server on :5199; the harness stubs `convex/react`, `@convex-dev/auth/react`, and `convex/_generated/api` so it runs without a live backend) |
| `npm run lint`       | ESLint |
| `npm run preview`    | Preview the production build |