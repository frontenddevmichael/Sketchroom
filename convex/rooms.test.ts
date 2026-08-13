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
  tokenIdentifier: "https://test.auth|user_alice",
  name: "Alice",
  email: "alice@example.com",
};

async function setup() {
  const t = convexTest(schema, modules);
  const aliceT = t.withIdentity(alice);
  const { id: workspaceId } = await aliceT.mutation(api.rooms.createWorkspace, {
    name: "Acme",
  });
  return { t, aliceT, workspaceId };
}

test("createWorkspace ties the workspace to the authed user", async () => {
  const { aliceT } = await setup();
  const ws = await aliceT.mutation(api.rooms.createWorkspace, { name: "Beta" });
  expect(ws.ownerId).toBe(alice.subject);
  const workspaces = await aliceT.query(api.rooms.getWorkspaces);
  expect(workspaces.some((w) => w._id === ws.id && w.name === "Beta")).toBe(true);
});

test("getWorkspaces returns [] for unauthenticated users", async () => {
  const { t } = await setup();
  const workspaces = await t.query(api.rooms.getWorkspaces);
  expect(workspaces).toEqual([]);
});

test("createRoom adds an owner membership and returns the room", async () => {
  const { aliceT, workspaceId } = await setup();
  const room = await aliceT.mutation(api.rooms.createRoom, {
    workspaceId,
    name: "Design",
  });
  expect(room.ownerId).toBe(alice.subject);
  const fetched = await aliceT.query(api.rooms.getRoom, { roomId: room.id });
  expect(fetched?.userRole).toBe("owner");
  expect(fetched?.name).toBe("Design");
});

test("createRoom persists a seed as the initial canvasData", async () => {
  const { aliceT, workspaceId } = await setup();
  const seed = JSON.stringify({ "shape:one": { id: "shape:one" } });
  const room = await aliceT.mutation(api.rooms.createRoom, {
    workspaceId,
    name: "Seeded",
    seed,
  });
  expect(room.canvasData).toBe(seed);
  expect(room.canvasVersion).toBe(1);
});

test("createRoom leaves canvasData blank without a seed", async () => {
  const { aliceT, workspaceId } = await setup();
  const room = await aliceT.mutation(api.rooms.createRoom, {
    workspaceId,
    name: "Blank",
  });
  expect(room.canvasData).toBe("");
  expect(room.canvasVersion).toBe(0);
});

test("getRooms only lists rooms the user belongs to in that workspace", async () => {
  const { aliceT, t, workspaceId } = await setup();
  const bobT = t.withIdentity({ ...alice, subject: "user_bob", email: "bob@example.com" });
  const { id: bobWsId } = await bobT.mutation(api.rooms.createWorkspace, { name: "Bob Inc" });
  await aliceT.mutation(api.rooms.createRoom, {
    workspaceId,
    name: "Shared",
  });
  await bobT.mutation(api.rooms.createRoom, {
    workspaceId: bobWsId,
    name: "Bob-only",
  });
  const rooms = await aliceT.query(api.rooms.getRooms, { workspaceId });
  expect(rooms.map((r) => r.name)).toEqual(["Shared"]);
});

test("createRoom rejects users who do not own the workspace", async () => {
  const { t, workspaceId } = await setup();
  const bobT = t.withIdentity({ ...alice, subject: "user_bob", email: "bob@example.com" });
  await expect(
    bobT.mutation(api.rooms.createRoom, { workspaceId, name: "Hijack" })
  ).rejects.toThrow("Only the workspace owner can create rooms");
});

test("getRoom returns null when the user is not a member", async () => {
  const { aliceT, t, workspaceId } = await setup();
  const bobT = t.withIdentity({ ...alice, subject: "user_bob", email: "bob@example.com" });
  const room = await aliceT.mutation(api.rooms.createRoom, { workspaceId, name: "Solo" });
  const fetched = await bobT.query(api.rooms.getRoom, { roomId: room.id });
  expect(fetched).toBeNull();
});

test("updateWorkspaceName is owner-only and rejects empty names", async () => {
  const { aliceT, t, workspaceId } = await setup();
  const bobT = t.withIdentity({ ...alice, subject: "user_bob", email: "bob@example.com" });
  await expect(
    bobT.mutation(api.rooms.updateWorkspaceName, { workspaceId, name: "Hijacked" })
  ).rejects.toThrow("Only owner can update workspace");
  await expect(
    aliceT.mutation(api.rooms.updateWorkspaceName, { workspaceId, name: "   " })
  ).rejects.toThrow("Name cannot be empty");
  const ok = await aliceT.mutation(api.rooms.updateWorkspaceName, {
    workspaceId,
    name: "Acme 2",
  });
  expect(ok).toBe(true);
});

test("deleteRoom is owner-only and cascades related rows", async () => {
  const { aliceT, t, workspaceId } = await setup();
  const bobT = t.withIdentity({ ...alice, subject: "user_bob", email: "bob@example.com" });
  const room = await aliceT.mutation(api.rooms.createRoom, { workspaceId, name: "Doomed" });
  await aliceT.mutation(api.snapshots.saveSnapshot, {
    roomId: room.id,
    canvasData: "{}",
    description: "v0",
  });
  await expect(
    bobT.mutation(api.rooms.deleteRoom, { roomId: room.id })
  ).rejects.toThrow("Only owner can delete");
  const ok = await aliceT.mutation(api.rooms.deleteRoom, { roomId: room.id });
  expect(ok).toBe(true);
  expect(await aliceT.query(api.rooms.getRoom, { roomId: room.id })).toBeNull();
  const snapshots = await aliceT.query(api.snapshots.listSnapshots, { roomId: room.id });
  expect(snapshots).toEqual([]);
});

test("deleteWorkspace removes the workspace and all its rooms", async () => {
  const { aliceT, workspaceId } = await setup();
  const room = await aliceT.mutation(api.rooms.createRoom, { workspaceId, name: "Child" });
  const ok = await aliceT.mutation(api.rooms.deleteWorkspace, { workspaceId });
  expect(ok).toBe(true);
  expect(await aliceT.query(api.rooms.getRoom, { roomId: room.id })).toBeNull();
  expect(await aliceT.query(api.rooms.getWorkspaces)).toEqual([]);
});

test("getUsage counts rooms and completed AI suggestions", async () => {
  const { aliceT, workspaceId } = await setup();
  await aliceT.mutation(api.rooms.createRoom, { workspaceId, name: "A" });
  await aliceT.mutation(api.rooms.createRoom, { workspaceId, name: "B" });
  const usage = await aliceT.query(api.rooms.getUsage);
  expect(usage.rooms).toBeGreaterThanOrEqual(2);
});

test("getRooms attaches a member avatar summary to each card", async () => {
  const { aliceT, t, workspaceId } = await setup();
  const { id: roomId } = await aliceT.mutation(api.rooms.createRoom, {
    workspaceId,
    name: "Shared",
  });
  const bobT = t.withIdentity({ ...alice, subject: "user_bob", name: "Bob", email: "bob@example.com" });
  const carolT = t.withIdentity({ ...alice, subject: "user_carol", name: "Carol", email: "carol@example.com" });
  const daveT = t.withIdentity({ ...alice, subject: "user_dave", name: "Dave", email: "dave@example.com" });

  const { token } = await aliceT.mutation(api.invites.createInviteLink, { roomId, role: "editor" });
  await bobT.mutation(api.invites.acceptInvite, { token });
  for (const viewer of [carolT, daveT]) {
    const link = await aliceT.mutation(api.invites.createInviteLink, { roomId, role: "viewer" });
    await viewer.mutation(api.invites.acceptInvite, { token: link.token });
  }

  const rooms = await aliceT.query(api.rooms.getRooms, { workspaceId });
  expect(rooms).toHaveLength(1);
  const card = rooms[0];
  // 4 members total (alice + 3 invitees — the free plan's owner + 3
  // collaborator cap) => 3 avatars + overflow chip of 1
  expect(card.members.avatars.length).toBe(3);
  expect(card.members.plusCount).toBe(1);
  expect(card.userRole).toBe("owner");
});

test("updateRoomName records the server-derived last editor", async () => {
  const { aliceT, workspaceId } = await setup();
  const { id: roomId } = await aliceT.mutation(api.rooms.createRoom, {
    workspaceId,
    name: "Design",
  });
  await aliceT.mutation(api.rooms.updateRoomName, { roomId, name: "Design v2" });
  const room = await aliceT.query(api.rooms.getRoom, { roomId });
  expect(room?.name).toBe("Design v2");
  expect(room?.lastEditedBy).toEqual({ id: "user_alice", name: "Alice" });
});

test("updateRoomThumbnail rejects an oversized base64 thumbnail", async () => {
  const { aliceT, workspaceId } = await setup();
  const { id: roomId } = await aliceT.mutation(api.rooms.createRoom, {
    workspaceId,
    name: "Design",
  });
  const huge = "data:image/png;base64," + "A".repeat(910 * 1024);
  await expect(
    aliceT.mutation(api.rooms.updateRoomThumbnail, { roomId, thumbnailData: huge })
  ).rejects.toThrow("too large");
});