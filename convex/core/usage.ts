// Shared free-plan usage counting. The rooms, invites, and ai mutations all
// enforce the free-plan caps server-side; getUsage (rooms.ts) feeds the
// dashboard meters. Keeping the counting here means the enforcement and the
// meters can never drift apart.
//
// This module exports plain helpers only — no Convex functions — so it needs
// no generated-api entries and is safe to import from any mutation/query.
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { FREE_ROOM_LIMIT, FREE_AI_SUGGESTIONS_PER_MONTH, monthStartMs } from "./lib";

type DbCtx = QueryCtx | MutationCtx;

/** How many rooms the user is a member of (owner or collaborator). */
export async function countRoomMemberships(ctx: DbCtx, userId: string): Promise<number> {
  const membership = await ctx.db
    .query("roomMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return membership.length;
}

/**
 * How many completed AI suggestions were generated across the user's rooms
 * since `sinceMs` (defaults to the start of the current calendar month — the
 * free plan's monthly meter).
 */
export async function countAiSuggestions(
  ctx: DbCtx,
  userId: string,
  sinceMs = monthStartMs()
): Promise<number> {
  const membership = await ctx.db
    .query("roomMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  let total = 0;
  for (const m of membership) {
    const rows = await ctx.db
      .query("aiMessages")
      .withIndex("by_room", (q) => q.eq("roomId", m.roomId))
      .filter((q) =>
        q.and(q.gte(q.field("createdAt"), sinceMs), q.eq(q.field("status"), "completed"))
      )
      .take(1000);
    total += rows.length;
  }
  return total;
}

export type { FreePlanCheck } from "../utils/types";

export const FREE_PLAN = {
  ROOM_LIMIT: FREE_ROOM_LIMIT,
  COLLABORATORS_PER_ROOM: 3, // owner + 3
  AI_SUGGESTIONS_PER_MONTH: FREE_AI_SUGGESTIONS_PER_MONTH,
} as const;

/**
 * Throws a clear, billing-aware message when a free-plan cap is reached.
 * Rooms and collaborators are hard caps (the null case is never a dead end —
 * the dashboard already nudges toward Billing); the AI limit is enforced by
 * the action BEFORE it hits the paid provider.
 */
export function planLimitError(kind: "rooms" | "collaborators" | "ai", limit: number): Error {
  switch (kind) {
    case "rooms":
      return new Error(
        `You've used all ${limit} rooms on the free plan. Rooms stay open — the Team plan (see Billing) will lift this cap when it ships.`
      );
    case "collaborators":
      return new Error(
        `This room already has the free plan's ${limit} collaborators. Remove a member, or the Team plan will lift this cap when it ships.`
      );
    case "ai":
      return new Error(
        `You've used all ${limit} AI suggestions this month on the free plan. They reset next month — or the Team plan will make them unlimited when it ships.`
      );
  }
}
