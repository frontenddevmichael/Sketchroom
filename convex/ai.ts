import { query, action, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";
import { auth } from "./lib";
import { rateLimiter } from "./rateLimiter";
import { buildDiagram, buildPrompt, type AiResult } from "./aiDiagram";
import { countAiSuggestions, FREE_PLAN, planLimitError } from "./usage";

// The copilot runs through OpenRouter so the model is swappable per
// deployment (OPENROUTER_MODEL) without a code change. The key and model are
// secrets set with `npx convex env set` — never in the repo.
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "google/gemma-4-26b-a4b-it:free";

const SYSTEM_PROMPT = [
  "You are Sketchroom, a collaborative architecture-planning copilot.",
  "Users sketch system diagrams and wireframes on a shared whiteboard.",
  "Voice: be a sharp teammate, not a corporate assistant. Confident, warm, plain-spoken.",
  "Say what the sketch is for and why it works. Occasionally be genuinely clever, but never",
  "twee, never gimmicky, never salesy. No exclamation marks, no emojis, no hype words.",
  "Return STRICT JSON (no markdown, no fences) with this exact shape:",
  '{ "summary": "one short sentence: what this is and the one thing that makes it sound",',
  '  "blocks": [ { "label": "Short Label", "kind": "service", "description": "one line of plain-spoken purpose" } ],',
  '  "edges": [ { "from": 0, "to": 1, "label": "optional short edge label" } ] }',
  "kind must be one of: service, database, api, client, queue, cache, input, button, card, table, navbar, image.",
  "edges reference blocks by zero-based index and only exist where there is a real dependency or flow between them.",
  "Omit edges entirely when relationships do not apply (e.g. a single wireframe page).",
  "Return 3 to 8 blocks. Labels under 18 characters.",
  "Descriptions are one line that says the block's real job, e.g. \"holds the source of truth\" or \"the only door into the system\".",
].join("\n");

const contextValidator = v.optional(
  v.array(
    v.object({
      label: v.string(),
      kind: v.optional(v.string()),
      description: v.optional(v.string()),
    })
  )
);

/** Map an OpenAI HTTP failure to a plain-spoken, non-technical message. */
function openAiFailureMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "The AI service rejected this workspace's key — ask the owner to check the API credentials.";
  }
  if (status === 429) {
    return "The AI service is busy right now — give it a moment and try again.";
  }
  if (status >= 500) {
    return "The AI service had a hiccup — try again in a moment.";
  }
  return "Something went wrong reaching the AI service — try again in a moment.";
}

async function callOpenAi(prompt: string): Promise<AiResult> {
  if (!OPENROUTER_KEY) {
    return {
      error: "AI is not configured on this workspace yet — the owner needs to add the API key.",
    };
  }
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      // Public attribution so OpenRouter ranks the app (optional, helpful).
      "HTTP-Referer": process.env.SITE_URL ?? "https://sketchroom.app",
      "X-Title": "Sketchroom",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      temperature: 0.4,
      // Free models don't reliably support response_format, so strict JSON
      // comes from the prompt contract instead.
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    // Never surface the raw provider error body to the user — it can contain
    // opaque internal detail. Log it server-side instead, show clean copy.
    const body = await res.text();
    console.error(`[ai] openrouter ${res.status} (${OPENROUTER_MODEL}): ${body.slice(0, 300)}`);
    return { error: openAiFailureMessage(res.status) };
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return { error: "AI returned an empty response." };
  try {
    return JSON.parse(content) as AiResult;
  } catch {
    return { error: "AI returned malformed JSON." };
  }
}

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
    const room = await ctx.runQuery(api.rooms.getRoom, { roomId: args.roomId });
    if (!room) throw new Error("Room not found");
    if (room.userRole === "viewer") throw new Error("You're viewing this room — ask an editor to make changes.");

    // Monthly free-plan AI quota, checked BEFORE any paid provider call or
    // pending-message write, so a capped user gets a clear limit error and no
    // phantom "pending" row. Quota resets at the start of each calendar month.
    const usedThisMonth = await ctx.runQuery(internal.ai.countAiUsage, {
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
    const messageId = await ctx.runMutation(internal.aiStore.storeAiMessage, {
      roomId: args.roomId,
      userId: identity.subject,
      prompt: args.prompt,
      response: "",
      status: "pending",
      createdAt: now,
    });

    try {
      const prompt = buildPrompt(args.prompt, args.context);
      const result = await callOpenAi(prompt);
      if (result.error) {
        // An errored call is a failed message, not a completed one — the chat
        // shows the retry affordance instead of presenting error text as an answer.
        await ctx.runMutation(internal.aiStore.updateAiMessage, {
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
      await ctx.runMutation(internal.aiStore.updateAiMessage, {
        messageId,
        response,
        ghostBlocks,
        status: "completed",
      });
      return { messageId, response, ghostBlocks };
    } catch (error) {
      console.error("[ai] suggestion action failed:", error);
      const message = "Something went wrong while I was drafting that — try again.";
      await ctx.runMutation(internal.aiStore.updateAiMessage, {
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
