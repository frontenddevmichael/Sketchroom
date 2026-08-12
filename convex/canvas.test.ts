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

function rectRecord(id: string, x: number) {
  return { id, typeName: "shape", type: "geo", props: { geo: "rectangle", x } };
}

function cameraRecord(id = "camera:page") {
  return { id, typeName: "camera", x: 100, y: 100, z: 2 };
}

test("applyCanvasChanges upserts put records, applies remove, and bumps the version", async () => {
  const { aliceT, roomId } = await setup();
  const shape = rectRecord("shape:a", 10);
  const r1 = await aliceT.mutation(api.canvas.applyCanvasChanges, {
    roomId,
    changes: JSON.stringify({ put: { "shape:a": shape } }),
  });
  expect(r1.version).toBe(1);

  const r2 = await aliceT.mutation(api.canvas.applyCanvasChanges, {
    roomId,
    changes: JSON.stringify({ remove: ["shape:a"] }),
  });
  expect(r2.version).toBe(2);

  const { canvasData, canvasVersion } = await aliceT.query(api.canvas.loadCanvas, { roomId });
  expect(canvasVersion).toBe(2);
  expect(JSON.parse(canvasData)).toEqual({});
});

test("applyCanvasChanges rejects non-members", async () => {
  const { t, roomId } = await setup();
  const stranger = t.withIdentity({ ...alice, subject: "user_stranger" });
  await expect(
    stranger.mutation(api.canvas.applyCanvasChanges, {
      roomId,
      changes: JSON.stringify({ put: { "shape:a": rectRecord("shape:a", 1) } }),
    })
  ).rejects.toThrow("Insufficient permissions");
});

test("applyCanvasChanges rejects viewers", async () => {
  const { aliceT, bobT, roomId } = await setup();
  const { token } = await aliceT.mutation(api.invites.createInviteLink, { roomId, role: "viewer" });
  await bobT.mutation(api.invites.acceptInvite, { token });
  await expect(
    bobT.mutation(api.canvas.applyCanvasChanges, {
      roomId,
      changes: JSON.stringify({ put: { "shape:a": rectRecord("shape:a", 1) } }),
    })
  ).rejects.toThrow("Insufficient permissions");
});

test("applyCanvasChanges migrates a legacy snapshot to canonical, dropping session records", async () => {
  const { aliceT, roomId } = await setup();
  // Legacy room persisted as a full tldraw snapshot { schema, records } that
  // included session-scope records (e.g. the author's camera).
  const legacy = {
    schema: { schemaVersion: 2 },
    records: {
      "shape:a": rectRecord("shape:a", 5),
      "camera:page": cameraRecord(),
      "instance:me": { id: "instance:me", typeName: "instance", currentPageId: "page:1" },
    },
  };
  await aliceT.run(async (ctx) => {
    await ctx.db.patch(roomId, { canvasData: JSON.stringify(legacy) });
  });

  // A new document edit forces the merge; the camera/instance records must not
  // leak into the canonical state.
  await aliceT.mutation(api.canvas.applyCanvasChanges, {
    roomId,
    changes: JSON.stringify({ put: { "shape:b": rectRecord("shape:b", 20) } }),
  });

  const { canvasData } = await aliceT.query(api.canvas.loadCanvas, { roomId });
  const canonical = JSON.parse(canvasData);
  expect(canonical["shape:a"]).toEqual(rectRecord("shape:a", 5));
  expect(canonical["shape:b"]).toEqual(rectRecord("shape:b", 20));
  expect(canonical["camera:page"]).toBeUndefined();
  expect(canonical["instance:me"]).toBeUndefined();
});

test("applyCanvasChanges rejects malformed payloads", async () => {
  const { aliceT, roomId } = await setup();
  await expect(
    aliceT.mutation(api.canvas.applyCanvasChanges, { roomId, changes: "not json" })
  ).rejects.toThrow("Invalid changes payload");
  await expect(
    aliceT.mutation(api.canvas.applyCanvasChanges, { roomId, changes: '{"bogus": true}' })
  ).rejects.toThrow("Invalid changes payload");
});

test("loadCanvas returns empty state for non-members", async () => {
  const { aliceT, t, roomId } = await setup();
  await aliceT.mutation(api.canvas.applyCanvasChanges, {
    roomId,
    changes: JSON.stringify({ put: { "shape:a": rectRecord("shape:a", 1) } }),
  });
  const stranger = t.withIdentity({ ...alice, subject: "user_stranger" });
  const result = await stranger.query(api.canvas.loadCanvas, { roomId });
  expect(result.canvasData).toBe("");
  expect(result.canvasVersion).toBe(0);
});

test("applyCanvasChanges records the server-derived last editor", async () => {
  const { aliceT, bobT, roomId } = await setup();
  await aliceT.mutation(api.canvas.applyCanvasChanges, {
    roomId,
    changes: JSON.stringify({ put: { "shape:a": rectRecord("shape:a", 1) } }),
  });
  let room = await aliceT.query(api.rooms.getRoom, { roomId });
  expect(room?.lastEditedBy).toEqual({ id: "user_alice", name: "Alice" });

  const { token } = await aliceT.mutation(api.invites.createInviteLink, { roomId, role: "editor" });
  await bobT.mutation(api.invites.acceptInvite, { token });
  await bobT.mutation(api.canvas.applyCanvasChanges, {
    roomId,
    changes: JSON.stringify({ put: { "shape:b": rectRecord("shape:b", 2) } }),
  });
  room = await aliceT.query(api.rooms.getRoom, { roomId });
  expect(room?.lastEditedBy).toEqual({ id: "user_bob", name: "Bob" });
});

test("applyCanvasChanges drops records without a typeName so the store never crashes on load", async () => {
  const { aliceT, roomId } = await setup();
  await aliceT.mutation(api.canvas.applyCanvasChanges, {
    roomId,
    changes: JSON.stringify({
      put: {
        "shape:ok": rectRecord("shape:ok", 5),
        "shape:bad": { id: "shape:bad", props: { geo: "rectangle" } },
        "junk": "not a record",
        "wrapper": { records: {}, schema: {} },
      },
    }),
  });
  const { canvasData } = await aliceT.query(api.canvas.loadCanvas, { roomId });
  const canonical = JSON.parse(canvasData);
  expect(canonical["shape:ok"]).toEqual(rectRecord("shape:ok", 5));
  expect(canonical["shape:bad"]).toBeUndefined();
  expect(canonical["junk"]).toBeUndefined();
  expect(canonical["wrapper"]).toBeUndefined();
});
