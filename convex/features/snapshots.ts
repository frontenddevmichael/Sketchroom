import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { auth, requireRole, SNAPSHOT_RETENTION, MAX_CANVAS_BYTES } from "../core/lib";
import { rateLimiter } from "../core/rateLimiter";

function assertWithinCanvasLimit(canvasData: string): void {
  if (canvasData.length > MAX_CANVAS_BYTES) {
    throw new Error(
      "This canvas is at its size limit — remove a few blocks before saving a version."
    );
  }
}

export const saveSnapshot = mutation({
  args: { roomId: v.id("rooms"), canvasData: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { identity, member } = await requireRole(ctx, args.roomId, ["owner", "editor"]);
    const { ok } = await rateLimiter.limit(ctx, "snapshotSave", {
      key: identity.subject,
      throws: false,
    });
    if (!ok) return null;
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    assertWithinCanvasLimit(args.canvasData);
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
    // Retention: snapshots accumulate on every 45s autosave and ⌘S. Keep the
    // newest SNAPSHOT_RETENTION per room and drop the overflow (oldest first)
    // so history stays boundless-feeling but never unbounded in storage.
    await pruneSnapshots(ctx, args.roomId);
    return { snapshotId, version: newVersion };
  },
});

// Delete the oldest snapshots for a room once more than SNAPSHOT_RETENTION
// exist, keeping the newest ones. Runs after every save (and every restore,
// which inserts a "before restore" backup row). Bounded batches: each pass
// deletes at most 100 rows, looping until the room is back at the cap, so a
// backlog of thousands still converges in a few cheap turns.
async function pruneSnapshots(
  ctx: import("../_generated/server").MutationCtx,
  roomId: import("../_generated/dataModel").Id<"rooms">
): Promise<void> {
  for (;;) {
    const keep = await ctx.db
      .query("snapshots")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("desc")
      .take(SNAPSHOT_RETENTION);
    const keepIds = new Set(keep.map((row) => row._id));
    const candidates = await ctx.db
      .query("snapshots")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("asc")
      .take(100);
    let deleted = 0;
    for (const row of candidates) {
      if (keepIds.has(row._id)) continue;
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    // The keep set overlaps the candidate list only when the room is already
    // at or under the cap — at that point we're done.
    if (deleted === 0) return;
  }
}

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
      .take(SNAPSHOT_RETENTION + 10);
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
      assertWithinCanvasLimit(room.canvasData);
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
    assertWithinCanvasLimit(snapshot.canvasData);
    await ctx.db.patch(args.roomId, {
      canvasData: snapshot.canvasData,
      canvasVersion: restoreVersion,
      updatedAt: Date.now(),
      lastEditedBy: { id: identity.subject, name: member.name || identity.email || "Unknown" },
    });
    // Restores add a "Before restoring" backup row — prune the same way saves
    // do so history stays capped.
    await pruneSnapshots(ctx, args.roomId);
    return { version: restoreVersion, canvasData: snapshot.canvasData };
  },
});
