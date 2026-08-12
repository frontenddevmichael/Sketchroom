import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const auth = {
  async getIdentity(ctx: QueryCtx | MutationCtx | ActionCtx) {
    const identity = await ctx.auth.getUserIdentity();
    return identity;
  },
};

type DbCtx = QueryCtx | MutationCtx;

// Server-side authorization helpers. All three throw the same messages the
// codebase already relies on, so call sites read like prose and never trust a
// userId passed by the client.
export async function requireUser(ctx: DbCtx | ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
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
