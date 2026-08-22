/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

vi.mock("../core/rateLimiter", () => ({
  rateLimiter: {
    limit: vi.fn(async () => ({ ok: true, retryAfter: undefined })),
  },
}));

const modules = import.meta.glob("../**/*.ts");

const alice = {
  subject: "user_alice",
  tokenIdentifier: "https://test.auth|user_alice",
  name: "Alice",
  email: "alice@example.com",
};

const bob = {
  subject: "user_bob",
  tokenIdentifier: "https://test.auth|user_bob",
  name: "Bob",
  email: "bob@example.com",
};

async function setup() {
  const t = convexTest(schema, modules);
  const aliceT = t.withIdentity(alice);
  const bobT = t.withIdentity(bob);
  const { id: workspaceId } = await aliceT.mutation(api.features.rooms.createWorkspace, {
    name: "Acme",
  });
  const { id: roomId } = await aliceT.mutation(api.features.rooms.createRoom, {
    workspaceId,
    name: "Design",
  });
  return { t, aliceT, bobT, workspaceId, roomId };
}

test("revokeInvite expires a pending invite so it can no longer be accepted", async () => {
  const { aliceT, bobT, t, roomId } = await setup();
  const { token } = await aliceT.mutation(api.features.invites.createInviteLink, { roomId, role: "editor" });
  const invite = await aliceT.run(async (ctx) => {
    const rows = await ctx.db.query("invites").withIndex("by_token", (q) => q.eq("token", token)).collect();
    return rows[0];
  });
  const strangerT = t.withIdentity({ ...alice, subject: "user_stranger" });
  await expect(
    strangerT.mutation(api.features.invites.revokeInvite, { inviteId: invite._id })
  ).rejects.toThrow("Insufficient permissions");
  const ok = await aliceT.mutation(api.features.invites.revokeInvite, { inviteId: invite._id });
  expect(ok).toBe(true);
  await expect(bobT.mutation(api.features.invites.acceptInvite, { token })).rejects.toThrow(
    "Invalid or expired"
  );
});

test("inviteMember stores a lowercased pending invite", async () => {
  const { aliceT, roomId } = await setup();
  const { inviteId, token } = await aliceT.mutation(api.features.invites.inviteMember, {
    roomId,
    email: " BoB@Example.com ",
    role: "editor",
  });
  expect(token.length).toBeGreaterThan(10);
  const invites = await aliceT.query(api.features.invites.getRoomInvites, { roomId });
  const invite = invites.find((i) => i._id === inviteId);
  expect(invite?.email).toBe("bob@example.com");
  expect(invite?.status).toBe("pending");
});

test("getRoomInvites never exposes the acceptance token", async () => {
  const { aliceT, roomId } = await setup();
  await aliceT.mutation(api.features.invites.inviteMember, {
    roomId,
    email: "bob@example.com",
    role: "editor",
  });
  const invites = await aliceT.query(api.features.invites.getRoomInvites, { roomId });
  expect(invites).toHaveLength(1);
  expect(invites[0]).not.toHaveProperty("token");
  expect(invites[0].email).toBe("bob@example.com");
});

test("inviteMember is author-only, dedupes pending invites, rejects members", async () => {
  const { aliceT, bobT, t, roomId } = await setup();
  const strangerT = t.withIdentity({ ...alice, subject: "user_stranger" });
  await expect(
    strangerT.mutation(api.features.invites.inviteMember, { roomId, email: "x@y.com", role: "viewer" })
  ).rejects.toThrow("Insufficient permissions");

  await aliceT.mutation(api.features.invites.inviteMember, { roomId, email: "x@y.com", role: "viewer" });
  await expect(
    aliceT.mutation(api.features.invites.inviteMember, { roomId, email: "X@Y.com", role: "viewer" })
  ).rejects.toThrow("already pending");

  // Bob is not a member yet, so he cannot invite either.
  await expect(
    bobT.mutation(api.features.invites.inviteMember, { roomId, email: "z@w.com", role: "viewer" })
  ).rejects.toThrow("Insufficient permissions");
});

test("acceptInvite adds a member with the invited role and marks it accepted", async () => {
  const { aliceT, bobT, roomId } = await setup();
  const { token } = await aliceT.mutation(api.features.invites.createInviteLink, {
    roomId,
    role: "editor",
  });
  const { roomId: joinedId } = await bobT.mutation(api.features.invites.acceptInvite, { token });
  expect(joinedId).toBe(roomId);
  const members = await aliceT.query(api.features.invites.listMembers, { roomId });
  const bobMember = members.find((m) => m.userId === bob.subject);
  expect(bobMember?.role).toBe("editor");
  const invites = await aliceT.query(api.features.invites.getRoomInvites, { roomId });
  expect(invites[0]?.status).toBe("accepted");
});

test("acceptInvite rejects when email does not match", async () => {
  const { aliceT, t, roomId } = await setup();
  const { token } = await aliceT.mutation(api.features.invites.inviteMember, {
    roomId,
    email: "bob@example.com",
    role: "viewer",
  });
  const carolT = t.withIdentity({ ...alice, subject: "user_carol", email: "carol@example.com" });
  await expect(carolT.mutation(api.features.invites.acceptInvite, { token })).rejects.toThrow(
    "doesn't match"
  );
});

test("acceptInvite marks expired invites as expired", async () => {
  const { aliceT, t, roomId } = await setup();
  const { token } = await aliceT.mutation(api.features.invites.createInviteLink, { roomId, role: "viewer" });
  await aliceT.run(async (ctx) => {
    const invites = await ctx.db.query("invites").withIndex("by_token", (q) => q.eq("token", token)).collect();
    await ctx.db.patch(invites[0]._id, { expiresAt: Date.now() - 1000 });
  });
  await expect(
    t.withIdentity(bob).mutation(api.features.invites.acceptInvite, { token })
  ).rejects.toThrow("expired");
});

test("listMembers is owner/editor only", async () => {
  const { aliceT, bobT, roomId } = await setup();
  const invite = await aliceT.mutation(api.features.invites.inviteMember, {
    roomId,
    email: "bob@example.com",
    role: "viewer",
  });
  await bobT.mutation(api.features.invites.acceptInvite, { token: invite.token });
  // Bob is a viewer, so listMembers must not expose the roster to him.
  const asBob = await bobT.query(api.features.invites.listMembers, { roomId });
  expect(asBob).toEqual([]);
  const asAlice = await aliceT.query(api.features.invites.listMembers, { roomId });
  expect(asAlice.length).toBeGreaterThanOrEqual(2);
});

test("expired invite links cannot be accepted by anyone", async () => {
  const { aliceT, bobT, roomId } = await setup();
  const { token } = await aliceT.mutation(api.features.invites.createInviteLink, { roomId, role: "viewer" });
  await aliceT.run(async (ctx) => {
    const invites = await ctx.db.query("invites").withIndex("by_token", (q) => q.eq("token", token)).collect();
    await ctx.db.patch(invites[0]._id, { status: "expired" });
  });
  await expect(bobT.mutation(api.features.invites.acceptInvite, { token })).rejects.toThrow(
    "Invalid or expired"
  );
});