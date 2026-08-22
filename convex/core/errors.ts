import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { auth } from "./lib";
import { rateLimiter } from "./rateLimiter";

export const reportError = mutation({
  args: {
    source: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    componentStack: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    // Cap both authed (per-user) and anonymous (shared global bucket) reports
    // so an unauthenticated caller cannot flood the error log.
    const { ok } = await rateLimiter.limit(ctx, "reportError", {
      key: identity?.subject ?? "anonymous",
      throws: true,
    });
    if (!ok) return false;
    if (args.message.length > 2000) {
      args.message = args.message.slice(0, 2000);
    }
    if (!args.message) return false;
    await ctx.db.insert("errorLogs", {
      userId: identity?.subject,
      source: args.source,
      message: args.message,
      stack: args.stack,
      componentStack: args.componentStack,
      url: args.url,
      createdAt: Date.now(),
    });
    return true;
  },
});