import { query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { auth, MAX_THUMBNAIL_CHARS } from "../core/lib";
import { internal } from "../_generated/api";
import { countRoomMemberships, countAiSuggestions, FREE_PLAN, planLimitError } from "../core/usage";
import { rateLimiter } from "../core/rateLimiter";

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
    // AI is a monthly meter ("this month" on both the dashboard and billing
    // meters) — the rooms count is a hard cap and is intentionally all-time.
    const rooms = await countRoomMemberships(ctx, identity.subject);
    const aiSuggestions = await countAiSuggestions(ctx, identity.subject);
    return { rooms, aiMessages: aiSuggestions, aiSuggestions };
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
      await ctx.runMutation(internal.features.rooms.deleteRoomData, { roomId: room._id });
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
    // Fetch rooms in this workspace and the user's memberships in parallel, then
    // join in memory.  This avoids the previous N+1 pattern (scanning ALL of
    // the user's memberships across every workspace and doing a db.get per room).
    const [workspaceRooms, userMemberships] = await Promise.all([
      ctx.db
        .query("rooms")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect(),
      ctx.db
        .query("roomMembers")
        .withIndex("by_user", (q) => q.eq("userId", identity.subject))
        .collect(),
    ]);
    // Build a lookup of the user's membership per room.
    const membershipByRoom = new Map(userMemberships.map((m) => [m.roomId, m]));
    // Collect room IDs we need member counts for.
    const memberRoomIds = workspaceRooms.map((r) => r._id);
    const allMembers = await Promise.all(
      memberRoomIds.map((roomId) =>
        ctx.db
          .query("roomMembers")
          .withIndex("by_room", (q) => q.eq("roomId", roomId))
          .collect()
      )
    );
    const membersByRoom = new Map(memberRoomIds.map((id, i) => [id, allMembers[i]]));
    function displayName(name: string | undefined, email: string | undefined): string {
      if (name && name !== "Unknown") return name;
      if (email) {
        const local = email.split("@")[0];
        return local.charAt(0).toUpperCase() + local.slice(1).replace(/[._-]/g, " ");
      }
      return "Unknown";
    }
    return workspaceRooms
      .filter((room) => membershipByRoom.has(room._id))
      .map((room) => {
        const m = membershipByRoom.get(room._id)!;
        const members = membersByRoom.get(room._id) ?? [];
        const memberById = new Map(members.map((mem) => [mem.userId, mem]));
        const avatars = members.slice(0, 3).map((mem) => ({
          name: displayName(mem.name, mem.email),
          avatarUrl: mem.avatarUrl,
        }));
        const editor = room.lastEditedBy?.id ? memberById.get(room.lastEditedBy.id) : undefined;
        const resolvedLastEditedBy = editor
          ? { id: editor.userId, name: displayName(editor.name, editor.email) }
          : room.lastEditedBy;
        return {
          ...room,
          lastEditedBy: resolvedLastEditedBy,
          userRole: m.role,
          members: { avatars, plusCount: Math.max(0, members.length - avatars.length) },
        };
      });
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
    // Free-plan room cap: count MEMBERSHIPS across every workspace, because a
    // user is the "owning" member in exactly one room each (their own). Rooms
    // shared with them count toward the same cap — one plan, not per-workspace.
    const roomCount = await countRoomMemberships(ctx, identity.subject);
    if (roomCount >= FREE_PLAN.ROOM_LIMIT) {
      throw planLimitError("rooms", FREE_PLAN.ROOM_LIMIT);
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
    // Rate-limit thumbnail updates to prevent storage abuse
    const { ok } = await rateLimiter.limit(ctx, "thumbnailUpdate", {
      key: identity.subject,
      throws: false,
    });
    if (!ok) return false;
    const thumbnail = args.thumbnailData ?? "";
    if (thumbnail.length > MAX_THUMBNAIL_CHARS) {
      throw new Error("That thumbnail is too large to store.");
    }
    await ctx.db.patch(args.roomId, {
      thumbnailData: thumbnail,
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

export const completeOnboarding = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member) throw new Error("Not a member of this room");
    await ctx.db.patch(args.roomId, { onboardingCompleted: true });
    return true;
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
    await ctx.runMutation(internal.features.rooms.deleteRoomData, { roomId: args.roomId });
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

    const tables = ["roomMembers", "snapshots", "aiMessages", "presence", "invites", "comments"] as const;
    for (const table of tables) {
      while (true) {
        const rows = await ctx.db
          .query(table)
          .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
          .take(BATCH);
        if (rows.length === 0) break;
        for (const r of rows) await ctx.db.delete(r._id);
      }
    }
    return true;
  },
});

/**
 * Sync the current user's profile (name, email, avatar) into every roomMembers
 * record they own.  Called on login so dashboard cards show real names.
 */
export const syncMemberProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) return 0;
    // identity.subject is the userId (after "|" split in auth.getIdentity).
    // The users table stores Convex Auth user IDs as _id.
    const user = await ctx.db.get(identity.subject as any);
    if (!user) return 0;
    const fields = user as Record<string, unknown>;
    const newName = String(fields.name || fields.email || "");
    const newEmail = String(fields.email || "");
    const newAvatar = String(fields.image || "");
    if (!newName && !newEmail) return 0;
    const memberships = await ctx.db
      .query("roomMembers")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .take(100);
    let updated = 0;
    for (const m of memberships) {
      const patch: Record<string, string> = {};
      if (newName && m.name !== newName) patch.name = newName;
      if (newEmail && m.email !== newEmail) patch.email = newEmail;
      if (newAvatar && m.avatarUrl !== newAvatar) patch.avatarUrl = newAvatar;
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(m._id, patch);
        updated++;
      }
    }
    return updated;
  },
});
