// Convex cron job actions — internal mutations have db access
import { internalMutation } from "./_generated/server";

export const cleanupExpiredInvites = internalMutation({
  args: {},
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

export const cleanupStalePresence = internalMutation({
  args: {},
  handler: async (ctx) => {
    const staleThreshold = Date.now() - 5 * 60 * 1000;
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

export const cleanupErrorLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
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
