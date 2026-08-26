import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { auth, requireMember, requireRole } from "../core/lib";
import { rateLimiter } from "../core/rateLimiter";

export const createComment = mutation({
  args: {
    roomId: v.id("rooms"),
    x: v.number(),
    y: v.number(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireMember(ctx, args.roomId);
    const { ok } = await rateLimiter.limit(ctx, "createComment", {
      key: identity.subject,
      throws: false,
    });
    if (!ok) throw new Error("Too many comments — slow down");
    const body = args.body.trim();
    if (!body) throw new Error("Comment cannot be empty");
    if (body.length > 2000) throw new Error("Comment is too long");
    const id = await ctx.db.insert("comments", {
      roomId: args.roomId,
      userId: identity.subject,
      x: args.x,
      y: args.y,
      body,
      resolved: false,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const replyToComment = mutation({
  args: {
    parentId: v.id("comments"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.parentId);
    if (!parent) throw new Error("Parent comment not found");
    const { identity } = await requireMember(ctx, parent.roomId);
    const body = args.body.trim();
    if (!body) throw new Error("Reply cannot be empty");
    if (body.length > 2000) throw new Error("Reply is too long");
    const id = await ctx.db.insert("comments", {
      roomId: parent.roomId,
      userId: identity.subject,
      x: parent.x,
      y: parent.y,
      body,
      resolved: false,
      parentId: args.parentId,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const resolveComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");
    await requireRole(ctx, comment.roomId, ["owner", "editor"]);
    const topId = comment.parentId ?? comment._id;
    const replies = await ctx.db
      .query("comments")
      .withIndex("by_parent", (q) => q.eq("roomId", comment.roomId).eq("parentId", topId))
      .collect();
    const toResolve = [comment, ...replies];
    for (const r of toResolve) {
      await ctx.db.patch(r._id, { resolved: true });
    }
    return true;
  },
});

export const reopenComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");
    await requireRole(ctx, comment.roomId, ["owner", "editor"]);
    const topId = comment.parentId ?? comment._id;
    const replies = await ctx.db
      .query("comments")
      .withIndex("by_parent", (q) => q.eq("roomId", comment.roomId).eq("parentId", topId))
      .collect();
    const toReopen = [comment, ...replies];
    for (const r of toReopen) {
      await ctx.db.patch(r._id, { resolved: false });
    }
    return true;
  },
});

export const listComments = query({
  args: { roomId: v.id("rooms"), resolved: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) return [];
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member) return [];
    const idx = args.resolved === false
      ? "by_room_unresolved"
      : "by_room";
    return ctx.db
      .query("comments")
      .withIndex(idx, (q) => {
        const base = q.eq("roomId", args.roomId);
        return args.resolved === false ? base.eq("resolved", false) : base;
      })
      .order("desc")
      .take(200);
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    if (comment.userId !== identity.subject) {
      const member = await ctx.db
        .query("roomMembers")
        .withIndex("by_room_user", (q) => q.eq("roomId", comment.roomId).eq("userId", identity.subject))
        .first();
      if (!member || member.role !== "owner") {
        throw new Error("Only the author or room owner can delete");
      }
    }
    if (!comment.parentId) {
      const replies = await ctx.db
        .query("comments")
        .withIndex("by_parent", (q) => q.eq("roomId", comment.roomId).eq("parentId", comment._id))
        .collect();
      for (const r of replies) {
        await ctx.db.delete(r._id);
      }
    }
    await ctx.db.delete(args.commentId);
    return true;
  },
});
