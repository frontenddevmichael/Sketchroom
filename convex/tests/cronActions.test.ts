/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema.js";
import { internal } from "../_generated/api";

vi.mock("../core/rateLimiter", () => ({
  rateLimiter: {
    limit: vi.fn(async () => ({ ok: true, retryAfter: undefined })),
  },
}));

const modules = import.meta.glob("../**/*.ts");

describe("cron jobs", () => {
  test("cleanupExpiredInvites marks expired invites", async () => {
    const t = convexTest(schema, modules);
    const userId = "user1";
    const workspaceId = await t.run(async (ctx) => {
      return ctx.db.insert("workspaces", { name: "W", ownerId: userId, createdAt: Date.now(), updatedAt: Date.now() });
    });
    const roomId = await t.run(async (ctx) => {
      return ctx.db.insert("rooms", { workspaceId, name: "R", ownerId: userId, canvasVersion: 0, createdAt: Date.now(), updatedAt: Date.now() });
    });

    const inviteId = await t.run(async (ctx) => {
      return ctx.db.insert("invites", {
        roomId,
        email: "test@test.com",
        role: "editor",
        invitedBy: userId,
        token: "tok1",
        status: "pending",
        createdAt: Date.now() - 100000,
        expiresAt: Date.now() - 50000,
      });
    });

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.cronActions.cleanupExpiredInvites);
    });

    const invite = await t.run(async (ctx) => ctx.db.get(inviteId));
    expect(invite!.status).toBe("expired");
  });

  test("cleanupStalePresence removes old presence", async () => {
    const t = convexTest(schema, modules);
    const userId = "user1";
    const workspaceId = await t.run(async (ctx) => {
      return ctx.db.insert("workspaces", { name: "W", ownerId: userId, createdAt: Date.now(), updatedAt: Date.now() });
    });
    const roomId = await t.run(async (ctx) => {
      return ctx.db.insert("rooms", { workspaceId, name: "R", ownerId: userId, canvasVersion: 0, createdAt: Date.now(), updatedAt: Date.now() });
    });

    const presId = await t.run(async (ctx) => {
      return ctx.db.insert("presence", {
        roomId,
        userId,
        name: "Test",
        color: "#000",
        lastActive: Date.now() - 600000,
      });
    });

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.cronActions.cleanupStalePresence);
    });

    const pres = await t.run(async (ctx) => ctx.db.get(presId));
    expect(pres).toBeNull();
  });

  test("cleanupErrorLogs removes old logs", async () => {
    const t = convexTest(schema, modules);

    const logId = await t.run(async (ctx) => {
      return ctx.db.insert("errorLogs", {
        source: "react",
        message: "old error",
        createdAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
      });
    });

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.cronActions.cleanupErrorLogs);
    });

    const log = await t.run(async (ctx) => ctx.db.get(logId));
    expect(log).toBeNull();
  });
});
