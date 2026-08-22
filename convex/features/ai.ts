import { query, action, mutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { internal } from "../_generated/api";
import { auth, MAX_AI_PROMPT_CHARS, MAX_AI_RESPONSE_CHARS, MAX_AI_GHOST_BLOCKS_CHARS } from "../core/lib";
import { rateLimiter } from "../core/rateLimiter";
import { buildDiagram, buildPrompt } from "./aiDiagram";
import { countAiSuggestions, FREE_PLAN, planLimitError } from "../core/usage";
import { Model } from "../utils/model";

const contextValidator = v.optional(
  v.array(
    v.object({
      label: v.string(),
      kind: v.optional(v.string()),
      description: v.optional(v.string()),
      x: v.optional(v.number()),
      y: v.optional(v.number()),
      selected: v.optional(v.boolean()),
    })
  )
);

/**
 * Monthly free-plan AI usage for one user. Internal because actions can't read
 * the database directly — the public action calls this via runQuery.
 */
export const countAiUsage = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return countAiSuggestions(ctx, args.userId);
  },
});

export const requestAiSuggestion = action({
  args: {
    roomId: v.id("rooms"),
    prompt: v.string(),
    context: contextValidator,
  },
  handler: async (
    ctx,
    args
  ): Promise<{ messageId?: string; response?: string; ghostBlocks?: string; error?: string }> => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const room = await ctx.runQuery(api.features.rooms.getRoom, { roomId: args.roomId });
    if (!room) throw new Error("Room not found");
    if (room.userRole === "viewer") throw new Error("You're viewing this room — ask an editor to make changes.");
    if (args.prompt.trim().length === 0) throw new Error("Ask the copilot something first.");
    if (args.prompt.length > MAX_AI_PROMPT_CHARS) {
      throw new Error("That prompt is too long — try a shorter one.");
    }

    // Monthly free-plan AI quota, checked BEFORE any paid provider call or
    // pending-message write, so a capped user gets a clear limit error and no
    // phantom "pending" row. Quota resets at the start of each calendar month.
    const usedThisMonth = await ctx.runQuery(internal.features.ai.countAiUsage, {
      userId: identity.subject,
    });
    if (usedThisMonth >= FREE_PLAN.AI_SUGGESTIONS_PER_MONTH) {
      throw planLimitError("ai", FREE_PLAN.AI_SUGGESTIONS_PER_MONTH);
    }

    const { ok, retryAfter } = await rateLimiter.limit(ctx, "aiRequest", {
      key: identity.subject,
      throws: true,
    });
    if (!ok) {
      throw new Error(`Rate limit hit — try again in ~${Math.ceil((retryAfter ?? 1000) / 1000)}s`);
    }

    const now = Date.now();
    const messageId = await ctx.runMutation(internal.features.aiStore.storeAiMessage, {
      roomId: args.roomId,
      userId: identity.subject,
      prompt: args.prompt,
      response: "",
      status: "pending",
      createdAt: now,
    });

    try {
      const prompt = buildPrompt(args.prompt, args.context);
      const result = await new Model().completion(prompt);
      if (result.error) {
        // An errored call is a failed message, not a completed one — the chat
        // shows the retry affordance instead of presenting error text as an answer.
        await ctx.runMutation(internal.features.aiStore.updateAiMessage, {
          messageId,
          response: result.error,
          status: "failed",
        });
        return { error: result.error };
      }
      const diagram = buildDiagram(result, prompt);
      const response = result.summary || "Here is a first draft to refine.";
      const ghostBlocks = JSON.stringify({
        summary: result.summary,
        blocks: diagram.blocks,
        edges: diagram.edges,
      });
      if (response.length > MAX_AI_RESPONSE_CHARS || ghostBlocks.length > MAX_AI_GHOST_BLOCKS_CHARS) {
        throw new Error("The AI response was too large to save — try a smaller ask.");
      }
      await ctx.runMutation(internal.features.aiStore.updateAiMessage, {
        messageId,
        response,
        ghostBlocks,
        status: "completed",
      });
      return { messageId, response, ghostBlocks };
    } catch (error) {
      console.error("[ai] suggestion action failed:", error);
      const message = "Something went wrong while I was drafting that — try again.";
      await ctx.runMutation(internal.features.aiStore.updateAiMessage, {
        messageId,
        response: message,
        status: "failed",
      });
      return { error: message };
    }
  },
});

export const getAiMessages = query({
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
      .query("aiMessages")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .take(50);
  },
});

export const dismissAiSuggestion = mutation({
  args: { messageId: v.id("aiMessages") },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const msg = await ctx.db.get(args.messageId);
    if (!msg || msg.userId !== identity.subject) throw new Error("Not found");
    await ctx.db.delete(args.messageId);
    return true;
  },
});
