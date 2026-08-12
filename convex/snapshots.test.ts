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

test("saveSnapshot bumps version, stores a snapshot, and requires membership", async () => {
  const { aliceT, roomId } = await setup();
  const r1 = await aliceT.mutation(api.snapshots.saveSnapshot, {
    roomId,
    canvasData: "{v1}",
    description: "first",
  });
  expect(r1.version).toBe(1);
  const r2 = await aliceT.mutation(api.snapshots.saveSnapshot, {
    roomId,
    canvasData: "{v2}",
  });
  expect(r2.version).toBe(2);
  const snapshots = await aliceT.query(api.snapshots.listSnapshots, { roomId });
  expect(snapshots).toHaveLength(2);
  expect(snapshots[0].canvasData).toBe("{v2}");
});

test("saveSnapshot rejects non-members", async () => {
  const { t, roomId } = await setup();
  const stranger = t.withIdentity({ ...alice, subject: "user_stranger" });
  await expect(
    stranger.mutation(api.snapshots.saveSnapshot, { roomId, canvasData: "{}" })
  ).rejects.toThrow("Not a member");
});

test("saveSnapshot is blocked for viewers", async () => {
  const { aliceT, bobT, roomId } = await setup();
  const { token } = await aliceT.mutation(api.invites.createInviteLink, { roomId, role: "viewer" });
  await bobT.mutation(api.invites.acceptInvite, { token });
  await expect(
    bobT.mutation(api.snapshots.saveSnapshot, { roomId, canvasData: "{}" })
  ).rejects.toThrow("Insufficient permissions");
});

test("restoreSnapshot edits/owners can restore and bumps the version", async () => {
  const { aliceT, roomId } = await setup();
  await aliceT.mutation(api.snapshots.saveSnapshot, { roomId, canvasData: "{v1}", description: "a" });
  await aliceT.mutation(api.snapshots.saveSnapshot, { roomId, canvasData: "{v2}", description: "b" });
  const snapshots = await aliceT.query(api.snapshots.listSnapshots, { roomId });
  const restorable = snapshots[1]; // "{v1}"
  const result = await aliceT.mutation(api.snapshots.restoreSnapshot, {
    roomId,
    snapshotId: restorable._id,
  });
  expect(result.canvasData).toBe("{v1}");
  // Restoring preserves the current state as a backup snapshot first, so the
  // pre-restore canvas ({v2}) is always recoverable — version advances by two.
  expect(result.version).toBe(4);
  const after = await aliceT.query(api.snapshots.listSnapshots, { roomId });
  expect(after).toHaveLength(3);
  expect(after[0].canvasData).toBe("{v2}");
  expect(after[0].description).toBe("Before restoring v1");
});

test("restoreSnapshot is blocked for viewers", async () => {
  const { aliceT, bobT, roomId } = await setup();
  await aliceT.mutation(api.snapshots.saveSnapshot, { roomId, canvasData: "{v1}" });
  await aliceT.mutation(api.invites.inviteMember, {
    roomId,
    email: "bob@example.com",
    role: "viewer",
  });
  const { token } = await aliceT.mutation(api.invites.createInviteLink, { roomId, role: "viewer" });
  await bobT.mutation(api.invites.acceptInvite, { token });
  const snapshots = await bobT.query(api.snapshots.listSnapshots, { roomId });
  await expect(
    bobT.mutation(api.snapshots.restoreSnapshot, {
      roomId,
      snapshotId: snapshots[0]._id,
    })
  ).rejects.toThrow("Insufficient permissions");
});

test("listSnapshots is empty for non-members", async () => {
  const { aliceT, t, roomId } = await setup();
  await aliceT.mutation(api.snapshots.saveSnapshot, { roomId, canvasData: "{v1}" });
  const stranger = t.withIdentity({ ...alice, subject: "user_stranger" });
  const snapshots = await stranger.query(api.snapshots.listSnapshots, { roomId });
  expect(snapshots).toEqual([]);
});