// Convex cron schedule definitions
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("cleanupExpiredInvites", { hours: 24 }, internal.cronActions.cleanupExpiredInvites, {});
crons.interval("cleanupStalePresence", { hours: 6 }, internal.cronActions.cleanupStalePresence, {});
crons.interval("cleanupErrorLogs", { hours: 168 }, internal.cronActions.cleanupErrorLogs, {});

export default crons;
