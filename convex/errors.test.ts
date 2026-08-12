/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

vi.mock("./rateLimiter", () => ({
  rateLimiter: {
    limit: vi.fn(async () => ({ ok: true, retryAfter: undefined })),
  },
}));

const modules = import.meta.glob("./**/*.ts");

const alice = {
  subject: "user_alice",
  tokenIdentifier: "https://test.clerk.dev|user_alice",
  name: "Alice",
  email: "alice@example.com",
};

test("reportError logs an error row for the authed user", async () => {
  const t = convexTest(schema, modules);
  const aliceT = t.withIdentity(alice);
  const ok = await aliceT.mutation(api.errors.reportError, {
    source: "react",
    message: "boom",
    stack: "at Component (file.ts:1)",
    componentStack: "\n    at App",
    url: "https://app.example.com/room/1",
  });
  expect(ok).toBe(true);
  const rows = await aliceT.run(async (ctx) => {
    return ctx.db.query("errorLogs").collect();
  });
  expect(rows).toHaveLength(1);
  expect(rows[0].userId).toBe(alice.subject);
  expect(rows[0].message).toBe("boom");
});

test("reportError works unauthenticated and rejects empty messages", async () => {
  const t = convexTest(schema, modules);
  const ok = await t.mutation(api.errors.reportError, {
    source: "react",
    message: "anon error",
  });
  expect(ok).toBe(true);
  const rejected = await t.mutation(api.errors.reportError, { source: "react", message: "" });
  expect(rejected).toBe(false);
  const rows = await t.run(async (ctx) => {
    return ctx.db.query("errorLogs").collect();
  });
  expect(rows).toHaveLength(1);
});