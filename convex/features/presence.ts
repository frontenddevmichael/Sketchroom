import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { auth } from "../core/lib";

// Presence rows are considered stale (ghosted) when lastActive is older than
// this. Clients heartbeat every few seconds, so a crashed tab lingers at most
// this long before prunePresence sweeps it up.
const PRESENCE_TTL_MS = 15_000;

export const upsertPresence = mutation({
  args: {
    roomId: v.id("rooms"),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    color: v.string(),
    cursorX: v.optional(v.number()),
    cursorY: v.optional(v.number()),
    camera: v.optional(v.object({ x: v.number(), y: v.number(), zoom: v.number() })),
    selectedShapeIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member) throw new Error("Not a member");
    const now = Date.now();
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, lastActive: now });
    } else {
      await ctx.db.insert("presence", { ...args, roomId: args.roomId, userId: identity.subject, lastActive: now });
    }
    return true;
  },
});

export const prunePresence = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member) throw new Error("Not a member");
    // Cooperative pruning of OTHER members' stale rows is limited to
    // owner/editor; viewers may only ever remove their own stale row.
    const canPruneOthers = member.role === "owner" || member.role === "editor";
    const cutoff = Date.now() - PRESENCE_TTL_MS;
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .take(200);
    let pruned = 0;
    for (const row of rows) {
      if (row.userId !== identity.subject && !canPruneOthers) continue;
      if (row.lastActive < cutoff) {
        await ctx.db.delete(row._id);
        pruned += 1;
      }
    }
    return pruned;
  },
});

export const removePresence = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) return true;
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return true;
  },
});

export const getPresence = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) return [];
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member) return [];
    const cutoff = Date.now() - PRESENCE_TTL_MS;
    const all = await ctx.db
      .query("presence")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    // Hide stale rows from the UI even before the pruner runs; treat them as gone.
    return all.filter((p) => p.userId !== identity.subject && p.lastActive >= cutoff);
  },
});