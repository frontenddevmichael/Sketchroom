import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Per-user limits. Token buckets allow bursts while capping sustained rate.
  aiRequest: { kind: "token bucket", rate: 6, period: MINUTE, capacity: 6 },
  // Per-room limit: prevents a single room from consuming all resources.
  aiRequestPerRoom: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 20 },
  // Global limit: protects against overall abuse.
  aiRequestGlobal: { kind: "token bucket", rate: 100, period: MINUTE, capacity: 100 },
  createInvite: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
  // Canvas edits: an active editor ships a delta every ~1.2s of work, so a
  // generous per-minute budget covers bursts from broad drags/selects without
  // letting a runaway client flood the change log.
  canvasApply: { kind: "token bucket", rate: 120, period: MINUTE, capacity: 30 },
  reportError: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 },
});
