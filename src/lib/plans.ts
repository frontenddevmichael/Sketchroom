// Client-side free-plan constants. Keep these in lock-step with the
// server-side source of truth in `convex/lib.ts` (FREE_ROOM_LIMIT /
// FREE_AI_SUGGESTIONS_PER_MONTH) — the mutations there are what actually
// enforce the caps; this module only mirrors them for meters and copy.
export const FREE_ROOM_LIMIT = 3;
export const FREE_COLLABORATORS_PER_ROOM = 3;
export const FREE_AI_LIMIT = 40;