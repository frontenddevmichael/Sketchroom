import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Only ever called from the AI action (server-side), never from the client.
// Kept internal so a client cannot forge an aiMessages row.
export const storeAiMessage = internalMutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
    prompt: v.string(),
    response: v.string(),
    ghostBlocks: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("aiMessages", args);
  },
});

// Updates a single aiMessages row. Marked internal so it's only callable from
// server-side code (the AI action), never from the client.
export const updateAiMessage = internalMutation({
  args: {
    messageId: v.id("aiMessages"),
    response: v.string(),
    ghostBlocks: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    return ctx.db.patch(args.messageId, {
      response: args.response,
      ghostBlocks: args.ghostBlocks,
      status: args.status,
    });
  },
});