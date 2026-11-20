// Client-side free-plan constants. Keep these in lock-step with the
// server-side source of truth in `convex/core/lib.ts` (FREE_* constants) — the
// mutations there are what actually enforce the caps; this module only mirrors
// them for meters and copy. `plans.test.ts` fails if the two ever diverge.
export const FREE_ROOM_LIMIT = 3;
export const FREE_COLLABORATORS_PER_ROOM = 3;
export const FREE_AI_LIMIT = 40;