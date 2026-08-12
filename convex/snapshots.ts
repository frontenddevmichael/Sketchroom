import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth, requireRole } from "./lib";

export const saveSnapshot = mutation({
  args: { roomId: v.id("rooms"), canvasData: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { identity, member } = await requireRole(ctx, args.roomId, ["owner", "editor"]);
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    const newVersion = room.canvasVersion + 1;
    await ctx.db.patch(args.roomId, {
      canvasData: args.canvasData,
      canvasVersion: newVersion,
      updatedAt: Date.now(),
      lastEditedBy: { id: identity.subject, name: member.name || identity.email || "Unknown" },
    });
    const snapshotId = await ctx.db.insert("snapshots", {
      roomId: args.roomId,
      version: newVersion,
      canvasData: args.canvasData,
      createdBy: identity.subject,
      createdAt: Date.now(),
      description: args.description,
    });
    return { snapshotId, version: newVersion };
  },
});

export const listSnapshots = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) return [];
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member) return [];
    return ctx.db
      .query("snapshots")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .collect();
  },
});

export const restoreSnapshot = mutation({
  args: { roomId: v.id("rooms"), snapshotId: v.id("snapshots") },
  handler: async (ctx, args) => {
    const { identity, member } = await requireRole(ctx, args.roomId, ["owner", "editor"]);
    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot || snapshot.roomId !== args.roomId) throw new Error("Snapshot not found");
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    const newVersion = room.canvasVersion + 1;
    // Preserve the current canvas before overwriting it, so a restore is
    // always reversible — the state you had is one click away afterwards.
    if (room.canvasData && room.canvasData.length > 2) {
      await ctx.db.insert("snapshots", {
        roomId: args.roomId,
        version: newVersion,
        canvasData: room.canvasData,
        createdBy: identity.subject,
        createdAt: Date.now(),
        description: `Before restoring v${snapshot.version}`,
      });
    }
    const restoreVersion = newVersion + (room.canvasData && room.canvasData.length > 2 ? 1 : 0);
    await ctx.db.patch(args.roomId, {
      canvasData: snapshot.canvasData,
      canvasVersion: restoreVersion,
      updatedAt: Date.now(),
      lastEditedBy: { id: identity.subject, name: member.name || identity.email || "Unknown" },
    });
    return { version: restoreVersion, canvasData: snapshot.canvasData };
  },
});