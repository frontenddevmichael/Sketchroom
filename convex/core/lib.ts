import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// ── Free-plan limits ─────────────────────────────────────────────────────
// Single source of truth for the promised free tier. The marketing site, the
// dashboard banner, and the billing meters all reference these numbers, and
// the mutations below enforce them server-side (rooms, collaborators, AI
// quota). Export/version-history are intentionally NOT gated: there is no
// payment path yet, so locking them would be a dead end for every user.
export const FREE_ROOM_LIMIT = 3;
export const FREE_COLLABORATORS_PER_ROOM = 3; // owner + 3 = 4 room members
export const FREE_AI_SUGGESTIONS_PER_MONTH = 40;
export const SNAPSHOT_RETENTION = 60;

// Payload ceilings. Convex caps any single value near 1MB, but these tighter
// limits exist so a stray oversized write (a runaway canvas, a huge base64
// thumbnail, an AI blob) fails with a clear message instead of a storage
// error — and so one room cannot quietly dominate the database.
export const MAX_CANVAS_BYTES = 850 * 1024; // room canvasData, UTF-8
export const MAX_THUMBNAIL_CHARS = 900 * 1024; // base64 PNG thumbnail
export const MAX_AI_PROMPT_CHARS = 4000;
export const MAX_AI_RESPONSE_CHARS = 16000;
export const MAX_AI_GHOST_BLOCKS_CHARS = 200_000;

/** First instant of the current calendar month, in epoch ms. */
export function monthStartMs(now = Date.now()): number {
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const auth = {
  async getIdentity(ctx: QueryCtx | MutationCtx | ActionCtx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    // Convex Auth packs the user id and session id into the `sub` claim
    // ("<userId>|<sessionId>"). Normalize it so the rest of the backend can
    // keep treating `subject` as the app-wide user id — exactly as it did
    // when Clerk was the provider. `getAuthUserId` does the same split.
    const [userId] = identity.subject.split("|");
    return { ...identity, subject: userId };
  },
};

type DbCtx = QueryCtx | MutationCtx;

// Server-side authorization helpers. All three throw the same messages the
// codebase already relies on, so call sites read like prose and never trust a
// userId passed by the client.
export async function requireUser(ctx: DbCtx | ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const [userId] = identity.subject.split("|");
  return { ...identity, subject: userId };
}

export async function requireMember(ctx: DbCtx, roomId: Id<"rooms">) {
  const identity = await requireUser(ctx);
  const member = await ctx.db
    .query("roomMembers")
    .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", identity.subject))
    .first();
  if (!member) throw new Error("Not a member");
  return { identity, member };
}

export async function requireRole(ctx: DbCtx, roomId: Id<"rooms">, roles: Array<"owner" | "editor" | "viewer">) {
  const { identity, member } = await requireMember(ctx, roomId);
  if (!roles.includes(member.role)) throw new Error("Insufficient permissions");
  return { identity, member };
}
