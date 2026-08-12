// Current-user helpers backed by the Convex Auth `users` table.
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

/**
 * The current user's public profile, or null when signed out. Callers render
 * the same shape whether the user came through email/password or Google.
 */
export const me = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId as Id<"users">);
    if (!user) return null;
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      imageUrl: user.image,
      // Convex Auth stores verification as a timestamp, not a boolean.
      emailVerified: Boolean(user.emailVerificationTime),
    };
  },
});

/** Update the user's display name (Settings → Account). */
export const updateProfile = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const trimmed = args.name.trim();
    if (!trimmed) throw new Error("Display name cannot be empty.");
    if (trimmed.length > 60) throw new Error("Display name is too long.");
    await ctx.db.patch(userId as Id<"users">, { name: trimmed });
  },
});

/**
 * Which auth features are actually enabled on this deployment. The auth
 * screen hides "Forgot password?" and the Google button when the
 * corresponding secrets aren't configured, so the UI never offers a dead end.
 */
export const authConfig = query({
  handler: async () => ({
    emailEnabled: Boolean(process.env.AUTH_RESEND_KEY),
    googleEnabled: Boolean(
      process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ),
  }),
});
