import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

const app = defineApp();
app.use(rateLimiter);

// Register cron jobs for production maintenance
import "./crons";
export default app;