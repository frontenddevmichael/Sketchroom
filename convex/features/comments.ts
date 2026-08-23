import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireMember, requireRole } from "../core/lib";

export const createComment = mutation({
  args: {
    roomId: v.id("rooms"),
    x: v.number(),
    y: v.number(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireMember(ctx, args.roomId);
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const [userId] = identity.subject.split("|");
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", userId))
      .first();
    if (!member) return [];
    const idx = args.resolved === false
      ? "by_room_unresolved"
      : "by_room";
    const comments = await ctx.db
      .query("comments")
      .withIndex(idx, (q) => {
        const base = q.eq("roomId", args.roomId);
        return args.resolved === false ? base.eq("resolved", false) : base;
      })
      .order("desc")
      .collect();
    return comments;
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const [userId] = identity.subject.split("|");
    if (comment.userId !== userId) {
      const member = await ctx.db
        .query("roomMembers")
        .withIndex("by_room_user", (q) => q.eq("roomId", comment.roomId).eq("userId", userId))
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
