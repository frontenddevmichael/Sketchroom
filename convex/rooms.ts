import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./lib";
import { internal } from "./_generated/api";

export const getWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) return [];
    return ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .collect();
  },
});

export const getUsage = query({
  args: {},
  handler: async (ctx) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) return { rooms: 0, aiMessages: 0, aiSuggestions: 0 };
    const membership = await ctx.db
      .query("roomMembers")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    const roomIds = membership.map((m) => m.roomId);
    let aiSuggestions = 0;
    for (const roomId of roomIds) {
      const rows = await ctx.db
        .query("aiMessages")
        .withIndex("by_room", (q) => q.eq("roomId", roomId))
        .filter((q) => q.eq(q.field("status"), "completed"))
        .take(1000);
      aiSuggestions += rows.length;
    }
    return {
      rooms: roomIds.length,
      aiMessages: aiSuggestions,
      aiSuggestions,
    };
  },
});

export const createWorkspace = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const now = Date.now();
    const id = await ctx.db.insert("workspaces", {
      name: args.name,
      ownerId: identity.subject,
      createdAt: now,
      updatedAt: now,
    });
    return { id, ...args, ownerId: identity.subject, createdAt: now, updatedAt: now };
  },
});

export const updateWorkspaceName = mutation({
  args: { workspaceId: v.id("workspaces"), name: v.string() },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const name = args.name.trim();
    if (!name) throw new Error("Name cannot be empty");
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    if (workspace.ownerId !== identity.subject) throw new Error("Only owner can update workspace");
    await ctx.db.patch(args.workspaceId, { name, updatedAt: Date.now() });
    return true;
  },
});

export const deleteWorkspace = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    if (workspace.ownerId !== identity.subject) throw new Error("Only owner can delete workspace");
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    for (const room of rooms) {
      await ctx.runMutation(internal.rooms.deleteRoomData, { roomId: room._id });
    }
    await ctx.db.delete(args.workspaceId);
    return true;
  },
});

export const getRooms = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) return [];
    const membership = await ctx.db
      .query("roomMembers")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    const rooms = await Promise.all(
      membership.map(async (m) => {
        const room = await ctx.db.get(m.roomId);
        if (!room || room.workspaceId !== args.workspaceId) return null;
        // Light member summary for the card avatar stack: 3 avatars + overflow.
        const members = await ctx.db
          .query("roomMembers")
          .withIndex("by_room", (q) => q.eq("roomId", room._id))
          .collect();
        const avatars = members.slice(0, 3).map((mem) => ({
          name: mem.name || mem.email || "Unknown",
          avatarUrl: mem.avatarUrl,
        }));
        return {
          ...room,
          userRole: m.role,
          members: { avatars, plusCount: Math.max(0, members.length - avatars.length) },
        };
      })
    );
    return rooms.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

export const createRoom = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    // Optional canonical record map (see src/lib/templates.ts) used to seed a
    // room with a starter canvas instead of starting blank.
    seed: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    if (workspace.ownerId !== identity.subject) {
      throw new Error("Only the workspace owner can create rooms");
    }
    const now = Date.now();
    const hasSeed = typeof args.seed === "string" && args.seed.length > 0;
    const roomId = await ctx.db.insert("rooms", {
      workspaceId: args.workspaceId,
      name: args.name,
      ownerId: identity.subject,
      canvasData: hasSeed ? args.seed : "",
      canvasVersion: hasSeed ? 1 : 0,
      compactedVersion: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("roomMembers", {
      roomId,
      userId: identity.subject,
      email: identity.email || "",
      name: identity.name || identity.email || "Unknown",
      role: "owner",
      joinedAt: now,
    });
    return {
      id: roomId,
      ...args,
      ownerId: identity.subject,
      canvasData: hasSeed ? args.seed : "",
      canvasVersion: hasSeed ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    };
  },
});

export const updateRoomThumbnail = mutation({
  args: { roomId: v.id("rooms"), thumbnailData: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member || (member.role !== "owner" && member.role !== "editor")) {
      throw new Error("Insufficient permissions");
    }
    await ctx.db.patch(args.roomId, {
      thumbnailData: args.thumbnailData ?? "",
      updatedAt: Date.now(),
      lastEditedBy: { id: identity.subject, name: member.name || identity.email || "Unknown" },
    });
    return true;
  },
});

export const getRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) return null;
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member) return null;
    const room = await ctx.db.get(args.roomId);
    if (!room) return null;
    return { ...room, userRole: member.role };
  },
});

export const updateRoomName = mutation({
  args: { roomId: v.id("rooms"), name: v.string() },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member || (member.role !== "owner" && member.role !== "editor")) {
      throw new Error("Insufficient permissions");
    }
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    const name = args.name.trim();
    if (!name) throw new Error("Name cannot be empty");
    await ctx.db.patch(args.roomId, {
      name,
      updatedAt: Date.now(),
      lastEditedBy: { id: identity.subject, name: member.name || identity.email || "Unknown" },
    });
    return { ...room, name, updatedAt: Date.now() };
  },
});

export const deleteRoom = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member || member.role !== "owner") {
      throw new Error("Only owner can delete");
    }
    await ctx.runMutation(internal.rooms.deleteRoomData, { roomId: args.roomId });
    return true;
  },
});

// Internal: remove a room and all of its related rows (members, snapshots,
// AI messages, presence, invites) in bounded batches. Only ever called from
// owner-authorized public mutations; this does not re-check ownership.
export const deleteRoomData = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const BATCH = 100;
    const room = await ctx.db.get(args.roomId);
    if (room) await ctx.db.delete(args.roomId);

    // roomMembers
    while (true) {
      const rows = await ctx.db
        .query("roomMembers")
        .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
        .take(BATCH);
      if (rows.length === 0) break;
      for (const r of rows) await ctx.db.delete(r._id);
    }
    // snapshots
    while (true) {
      const rows = await ctx.db
        .query("snapshots")
        .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
        .take(BATCH);
      if (rows.length === 0) break;
      for (const r of rows) await ctx.db.delete(r._id);
    }
    // aiMessages
    while (true) {
      const rows = await ctx.db
        .query("aiMessages")
        .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
        .take(BATCH);
      if (rows.length === 0) break;
      for (const r of rows) await ctx.db.delete(r._id);
    }
    // presence
    while (true) {
      const rows = await ctx.db
        .query("presence")
        .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
        .take(BATCH);
      if (rows.length === 0) break;
      for (const r of rows) await ctx.db.delete(r._id);
    }
    // invites
    while (true) {
      const rows = await ctx.db
        .query("invites")
        .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
        .take(BATCH);
      if (rows.length === 0) break;
      for (const r of rows) await ctx.db.delete(r._id);
    }
    return true;
  },
});
