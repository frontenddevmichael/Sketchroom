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

const bob = {
  subject: "user_bob",
  tokenIdentifier: "https://test.clerk.dev|user_bob",
  name: "Bob",
  email: "bob@example.com",
};

async function setup() {
  const t = convexTest(schema, modules);
  const aliceT = t.withIdentity(alice);
  const bobT = t.withIdentity(bob);
  const { id: workspaceId } = await aliceT.mutation(api.rooms.createWorkspace, {
    name: "Acme",
  });
  const { id: roomId } = await aliceT.mutation(api.rooms.createRoom, {
    workspaceId,
    name: "Design",
  });
  return { t, aliceT, bobT, workspaceId, roomId };
}

async function addBobAsEditor(aliceT, bobT, roomId) {
  const { token } = await aliceT.mutation(api.invites.createInviteLink, {
    roomId,
    role: "editor",
  });
  await bobT.mutation(api.invites.acceptInvite, { token });
}

test("upsertPresence stores cursor, camera, and selection; getPresence excludes self", async () => {
  const { aliceT, bobT, roomId } = await setup();
  await addBobAsEditor(aliceT, bobT, roomId);

  await aliceT.mutation(api.presence.upsertPresence, {
    roomId,
    name: "Alice",
    color: "#fff",
    cursorX: 12,
    cursorY: 34,
    camera: { x: 0, y: 0, zoom: 1 },
    selectedShapeIds: ["shape:a"],
  });
  await bobT.mutation(api.presence.upsertPresence, {
    roomId,
    name: "Bob",
    color: "#000",
    cursorX: 1,
    cursorY: 2,
  });

  const asAlice = await aliceT.query(api.presence.getPresence, { roomId });
  expect(asAlice).toHaveLength(1);
  expect(asAlice[0].userId).toBe(bob.subject);
  expect(asAlice[0].cursorX).toBe(1);
  expect(asAlice[0].cursorY).toBe(2);

  const asBob = await bobT.query(api.presence.getPresence, { roomId });
  expect(asBob).toHaveLength(1);
  expect(asBob[0].userId).toBe(alice.subject);
  expect(asBob[0].selectedShapeIds).toEqual(["shape:a"]);
});

test("getPresence hides stale rows (ghosts) even before the pruner runs", async () => {
  const { aliceT, bobT, roomId } = await setup();
  await addBobAsEditor(aliceT, bobT, roomId);
  await bobT.mutation(api.presence.upsertPresence, {
    roomId,
    name: "Bob",
    color: "#000",
    cursorX: 1,
    cursorY: 2,
  });
  // Simulate a crashed tab: Bob's lastActive falls outside the 15s TTL.
  await aliceT.run(async (ctx) => {
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", bob.subject))
      .collect();
    for (const row of rows) {
      await ctx.db.patch(row._id, { lastActive: Date.now() - 60_000 });
    }
  });
  const asAlice = await aliceT.query(api.presence.getPresence, { roomId });
  expect(asAlice).toEqual([]);
});

test("prunePresence deletes stale rows of others but never its own", async () => {
  const { aliceT, bobT, roomId } = await setup();
  await addBobAsEditor(aliceT, bobT, roomId);
  await aliceT.mutation(api.presence.upsertPresence, { roomId, name: "Alice", color: "#fff" });
  await bobT.mutation(api.presence.upsertPresence, { roomId, name: "Bob", color: "#000" });

  // Age Bob's presence beyond the TTL, then have Alice prune.
  await aliceT.run(async (ctx) => {
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", bob.subject))
      .collect();
    for (const row of rows) {
      await ctx.db.patch(row._id, { lastActive: Date.now() - 60_000 });
    }
  });
  const pruned = await aliceT.mutation(api.presence.prunePresence, { roomId });
  expect(pruned).toBe(1);

  const remaining = await aliceT.run(async (ctx) => {
    return ctx.db.query("presence").withIndex("by_room", (q) => q.eq("roomId", roomId)).collect();
  });
  expect(remaining.map((r) => r.userId)).toEqual([alice.subject]);
});

test("upsertPresence and getPresence require membership", async () => {
  const { t, roomId } = await setup();
  const stranger = t.withIdentity({ ...alice, subject: "user_stranger" });
  await expect(
    stranger.mutation(api.presence.upsertPresence, { roomId, name: "X", color: "#fff" })
  ).rejects.toThrow("Not a member");
  await expect(stranger.query(api.presence.getPresence, { roomId })).resolves.toEqual([]);
});
