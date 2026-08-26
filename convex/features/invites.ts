import { mutation, query, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { auth } from "../core/lib";
import { internal } from "../_generated/api";
import { rateLimiter } from "../core/rateLimiter";
import { FREE_PLAN, planLimitError } from "../core/usage";

export const inviteMember = mutation({
  args: { roomId: v.id("rooms"), email: v.string(), role: v.union(v.literal("editor"), v.literal("viewer")) },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "createInvite", {
      key: identity.subject,
      throws: false,
    });
    if (!ok) {
      throw new Error(`Too many invites — try again in ~${Math.ceil((retryAfter ?? 1000) / 1000)}s`);
    }
    const email = args.email.trim().toLowerCase();
    if (email.length > 254 || !email.includes("@")) throw new Error("Invalid email address");
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member || (member.role !== "owner" && member.role !== "editor")) {
      throw new Error("Insufficient permissions");
    }
    const existingMember = await ctx.db
      .query("roomMembers")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .filter((q) => q.eq(q.field("email"), email))
      .first();
    if (existingMember) throw new Error("Already a member");
    // Collaborator cap: owner + 3 collaborators. An invite counts toward the
    // seat it will occupy, so a pending invite for a new person also blocks.
    const members = await ctx.db
      .query("roomMembers")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    const pending = await ctx.db
      .query("invites")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .take(100);
    if (members.length + pending.length > FREE_PLAN.COLLABORATORS_PER_ROOM) {
      throw planLimitError("collaborators", FREE_PLAN.COLLABORATORS_PER_ROOM);
    }
    const existingInvite = await ctx.db
      .query("invites")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .filter((q) =>
        q.and(
          q.eq(q.field("email"), email),
          q.eq(q.field("status"), "pending")
        )
      )
      .first();
    if (existingInvite) throw new Error("An invite is already pending for this email");
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const inviteId = await ctx.db.insert("invites", {
      roomId: args.roomId,
      email,
      role: args.role,
      invitedBy: identity.subject,
      token,
      status: "pending",
      createdAt: Date.now(),
      expiresAt,
    });
    // Fire-and-forget email delivery: the invite row is committed first, so a
    // slow or failed mail API never blocks the invite mutation — the invite
    // stays visible in the Share modal regardless, and the delivery sweep
    // retries failed sends.
    const room = await ctx.db.get(args.roomId);
    await ctx.scheduler.runAfter(0, internal.core.email.sendInviteEmail, {
      inviteId,
      email,
      roomName: room?.name ?? "a room",
      token,
      role: args.role,
      inviterName: identity.name,
    });
    return { inviteId, token };
  },
});

export const revokeInvite = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Invite not found");
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", invite.roomId).eq("userId", identity.subject))
      .first();
    if (!member || (member.role !== "owner" && member.role !== "editor")) {
      throw new Error("Insufficient permissions");
    }
    if (invite.status !== "pending") throw new Error("Invite is no longer pending");
    await ctx.db.patch(args.inviteId, { status: "expired" });
    return true;
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!invite || invite.status !== "pending") {
      throw new Error("Invalid or expired invite");
    }
    if (invite.expiresAt < Date.now()) {
      await ctx.db.patch(invite._id, { status: "expired" });
      throw new Error("This invite has expired");
    }
    const userEmail = (identity.email || "").toLowerCase();
    if (invite.email !== "" && invite.email !== userEmail) {
      throw new Error("Invite email doesn't match your account");
    }
    const existing = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", invite.roomId).eq("userId", identity.subject))
      .first();
    if (existing) {
      await ctx.db.patch(invite._id, { status: "accepted" });
      return { roomId: invite.roomId };
    }
    await ctx.db.insert("roomMembers", {
      roomId: invite.roomId,
      userId: identity.subject,
      email: identity.email || invite.email,
      name: identity.name || identity.email || "Unknown",
      avatarUrl: identity.pictureUrl,
      role: invite.role,
      joinedAt: Date.now(),
    });
    await ctx.db.patch(invite._id, { status: "accepted" });
    return { roomId: invite.roomId };
  },
});

export const listMembers = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) return [];
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member || (member.role !== "owner" && member.role !== "editor")) return [];
    return ctx.db
      .query("roomMembers")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
  },
});

export const updateMemberRole = mutation({
  args: { roomId: v.id("rooms"), userId: v.string(), role: v.union(v.literal("editor"), v.literal("viewer")) },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member || member.role !== "owner") throw new Error("Only owner can change roles");
    if (args.userId === identity.subject) throw new Error("Cannot change own role");
    const target = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", args.userId))
      .first();
    if (!target) throw new Error("Member not found");
    await ctx.db.patch(target._id, { role: args.role });
    return true;
  },
});

export const removeMember = mutation({
  args: { roomId: v.id("rooms"), userId: v.string() },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member || member.role !== "owner") throw new Error("Only owner can remove members");
    if (args.userId === identity.subject) throw new Error("Cannot remove yourself");
    const target = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", args.userId))
      .first();
    if (!target) throw new Error("Member not found");
    await ctx.db.delete(target._id);
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", args.userId))
      .first();
    if (presence) await ctx.db.delete(presence._id);
    return true;
  },
});

export const getRoomInvites = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) return [];
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member || (member.role !== "owner" && member.role !== "editor")) return [];
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .take(100);
    // Never leak the acceptance token back to the list; only the creator ever
    // receives it (once) from inviteMember/createInviteLink.
    return invites.map((invite) => ({
      _id: invite._id,
      roomId: invite.roomId,
      email: invite.email,
      role: invite.role,
      invitedBy: invite.invitedBy,
      status: invite.status,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
    }));
  },
});

export const createInviteLink = mutation({
  args: { roomId: v.id("rooms"), role: v.union(v.literal("editor"), v.literal("viewer")) },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "createInvite", {
      key: identity.subject,
      throws: false,
    });
    if (!ok) {
      throw new Error(`Too many invites — try again in ~${Math.ceil((retryAfter ?? 1000) / 1000)}s`);
    }
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member || (member.role !== "owner" && member.role !== "editor")) {
      throw new Error("Insufficient permissions");
    }
    // An editable invite link occupies a collaborator seat that could be
    // accepted by someone with editor rights; viewers are non-editing seats,
    // so only editor links are capped. Mixed (owner+content) and future plan
    // states make this check run at the mutation, not the accept — the cap
    // is about how many collaborators a room can add, not who owns the token.
    const members = await ctx.db
      .query("roomMembers")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    const pending = await ctx.db
      .query("invites")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .take(100);
    if (members.length + pending.length > FREE_PLAN.COLLABORATORS_PER_ROOM) {
      throw planLimitError("collaborators", FREE_PLAN.COLLABORATORS_PER_ROOM);
    }
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    await ctx.db.insert("invites", {
      roomId: args.roomId,
      email: "",
      role: args.role,
      invitedBy: identity.subject,
      token,
      status: "pending",
      createdAt: Date.now(),
      expiresAt,
    });
    return { token };
  },
});

/**
 * Server-side-only context for the email action: read the invite + room for a
 * queued invite email. Internal so a client can never pass an arbitrary token
 * and read another room's invite.
 */
export const getInviteContext = internalQuery({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) return null;
    const room = await ctx.db.get(invite.roomId);
    if (!room) return null;
    return {
      inviteId: invite._id,
      email: invite.email,
      role: invite.role,
      token: invite.token,
      roomId: invite.roomId,
      roomName: room.name,
    };
  },
});
