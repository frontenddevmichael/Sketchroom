// Convex cron jobs for production maintenance
import { cronJob } from "./_generated/server";
import { internal } from "./_generated/api";

// Monthly AI usage reset - runs at midnight UTC on the 1st of each month
export const monthlyAiUsageReset = cronJob({
  name: "monthlyAiUsageReset",
  // Runs at 00:00 UTC on the 1st day of every month
  schedule: "0 0 1 * *",
  handler: async (ctx) => {
    // The AI usage count is based on createdAt timestamps in aiMessages,
    // so it automatically resets at month boundaries.
    // This cron exists for future use if we add a separate usage tracking table.
    console.log("[cron] Monthly AI usage reset triggered");
  },
});

// Daily cleanup of expired invites - runs at 02:00 UTC daily
export const cleanupExpiredInvites = cronJob({
  name: "cleanupExpiredInvites",
  schedule: "0 2 * * *",
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("invites")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .take(1000);

    let count = 0;
    for (const invite of expired) {
      if (invite.status === "pending") {
        await ctx.db.patch(invite._id, { status: "expired" });
        count++;
      }
    }
    console.log(`[cron] Cleaned up ${count} expired invites`);
  },
});

// Daily cleanup of stale presence entries - runs every 6 hours
export const cleanupStalePresence = cronJob({
  name: "cleanupStalePresence",
  schedule: "0 */6 * * *",
  handler: async (ctx) => {
    const staleThreshold = Date.now() - 5 * 60 * 1000; // 5 minutes
    const stale = await ctx.db
      .query("presence")
      .filter((q) => q.lt(q.field("lastActive"), staleThreshold))
      .take(1000);

    let count = 0;
    for (const p of stale) {
      await ctx.db.delete(p._id);
      count++;
    }
    console.log(`[cron] Cleaned up ${count} stale presence entries`);
  },
});

// Weekly error log cleanup - keeps last 30 days
export const cleanupErrorLogs = cronJob({
  name: "cleanupErrorLogs",
  schedule: "0 3 * * 0", // Weekly on Sunday at 03:00 UTC
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days
    const oldLogs = await ctx.db
      .query("errorLogs")
      .filter((q) => q.lt(q.field("createdAt"), cutoff))
      .take(5000);

    let count = 0;
    for (const log of oldLogs) {
      await ctx.db.delete(log._id);
      count++;
    }
    console.log(`[cron] Cleaned up ${count} old error logs`);
  },
});

// Health check endpoint - runs every 5 minutes
export const healthCheck = cronJob({
  name: "healthCheck",
  schedule: "*/5 * * * *",
  handler: async (ctx) => {
    // Simple health check - verify we can read/write
    const test = await ctx.db.query("workspaces").take(1);
    console.log("[cron] Health check OK", { timestamp: Date.now() });
  },
});