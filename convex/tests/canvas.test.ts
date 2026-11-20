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

function rect(id: string, x: number) {
  return {
    id,
    type: "rectangle",
    x,
    y: 0,
    width: 120,
    height: 80,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    strokeColor: "#0A0A0A",
    backgroundColor: "transparent",
  };
}

function readScene(canvasData: string): { format: string; elements: { id: string }[] } {
  return JSON.parse(canvasData) as { format: string; elements: { id: string }[] };
}

test("applyCanvasChanges upserts elements, applies remove, and bumps the version", async () => {
  const { aliceT, roomId } = await setup();
  const r1 = await aliceT.mutation(api.features.canvas.applyCanvasChanges, {
    roomId,
    changes: JSON.stringify({ put: [rect("a", 10)] }),
  });
  expect(r1.version).toBe(1);

  const r2 = await aliceT.mutation(api.features.canvas.applyCanvasChanges, {
    roomId,
    changes: JSON.stringify({ put: [rect("b", 40)], remove: ["a"] }),
  });
  expect(r2.version).toBe(2);

  const { canvasData, canvasVersion } = await aliceT.query(api.features.canvas.loadCanvas, {
    roomId,
  });
  expect(canvasVersion).toBe(2);
  const scene = readScene(canvasData);
  expect(scene.format).toBe("excalidraw/1");
  expect(scene.elements.map((element) => element.id)).toEqual(["b"]);
  expect(scene.elements[0]).toEqual(rect("b", 40));
});

test("applyCanvasChanges preserves paint order when an element is replaced", async () => {
  const { aliceT, roomId } = await setup();
  await aliceT.mutation(api.features.canvas.applyCanvasChanges, {
    roomId,
    changes: JSON.stringify({ put: [rect("a", 0), rect("b", 100), rect("c", 200)] }),
  });
  await aliceT.mutation(api.features.canvas.applyCanvasChanges, {
    roomId,
    changes: JSON.stringify({ put: [rect("b", 150)] }),
  });
  const { canvasData } = await aliceT.query(api.features.canvas.loadCanvas, { roomId });
  expect(readScene(canvasData).elements.map((element) => element.id)).toEqual(["a", "b", "c"]);
});

test("applyCanvasChanges rejects non-members", async () => {
  const { t, roomId } = await setup();
  const stranger = t.withIdentity({ ...alice, subject: "user_stranger" });
  await expect(
    stranger.mutation(api.features.canvas.applyCanvasChanges, {
      roomId,
      changes: JSON.stringify({ put: [rect("a", 1)] }),
    })
  ).rejects.toThrow("Insufficient permissions");
});

test("applyCanvasChanges rejects viewers", async () => {
  const { aliceT, bobT, roomId } = await setup();
  const { token } = await aliceT.mutation(api.features.invites.createInviteLink, {
    roomId,
    role: "viewer",
  });
  await bobT.mutation(api.features.invites.acceptInvite, { token });
  await expect(
    bobT.mutation(api.features.canvas.applyCanvasChanges, {
      roomId,
      changes: JSON.stringify({ put: [rect("a", 1)] }),
    })
  ).rejects.toThrow("Insufficient permissions");
});

test("a legacy tldraw blob is replaced by the first scene write", async () => {
  const { aliceT, roomId } = await setup();
  // Legacy room persisted as a tldraw record map. The client converts it on
  // read and sends the converted elements; the server must not resurrect the
  // old vocabulary, and never merges tldraw's session records.
  const legacy = {
    "shape:a": { id: "shape:a", typeName: "shape", type: "geo", props: { geo: "rectangle" } },
    "camera:page": { id: "camera:page", typeName: "camera", x: 100, y: 100, z: 2 },
  };
  await aliceT.run(async (ctx) => {
    await ctx.db.patch(roomId, { canvasData: JSON.stringify(legacy), canvasVersion: 4 });
  });

  await aliceT.mutation(api.features.canvas.applyCanvasChanges, {
    roomId,
    changes: JSON.stringify({ put: [rect("sk-converted", 0)] }),
  });

  const { canvasData } = await aliceT.query(api.features.canvas.loadCanvas, { roomId });
  const scene = readScene(canvasData);
  expect(scene.format).toBe("excalidraw/1");
  expect(scene.elements.map((element) => element.id)).toEqual(["sk-converted"]);
  expect(JSON.stringify(scene)).not.toContain("typeName");
  expect(JSON.stringify(scene)).not.toContain("camera:page");
});

test("applyCanvasChanges rejects malformed payloads", async () => {
  const { aliceT, roomId } = await setup();
  await expect(
    aliceT.mutation(api.features.canvas.applyCanvasChanges, { roomId, changes: "not json" })
  ).rejects.toThrow("Invalid changes payload");
  await expect(
    aliceT.mutation(api.features.canvas.applyCanvasChanges, {
      roomId,
      changes: '{"bogus": true}',
    })
  ).rejects.toThrow("Invalid changes payload");
  // The old record-map payload shape is no longer accepted.
  await expect(
    aliceT.mutation(api.features.canvas.applyCanvasChanges, {
      roomId,
      changes: JSON.stringify({ put: { a: rect("a", 1) } }),
    })
  ).rejects.toThrow("Invalid changes payload");
  await expect(
    aliceT.mutation(api.features.canvas.applyCanvasChanges, {
      roomId,
      changes: JSON.stringify({ put: [], remove: [] }),
    })
  ).rejects.toThrow("Empty changes payload");
});

test("loadCanvas returns empty state for non-members", async () => {
  const { aliceT, t, roomId } = await setup();
  await aliceT.mutation(api.features.canvas.applyCanvasChanges, {
    roomId,
    changes: JSON.stringify({ put: [rect("a", 1)] }),
  });
  const stranger = t.withIdentity({ ...alice, subject: "user_stranger" });
  const result = await stranger.query(api.features.canvas.loadCanvas, { roomId });
  expect(result.canvasData).toBe("");
  expect(result.canvasVersion).toBe(0);
});

test("applyCanvasChanges records the server-derived last editor", async () => {
  const { aliceT, bobT, roomId } = await setup();
  await aliceT.mutation(api.features.canvas.applyCanvasChanges, {
    roomId,
    changes: JSON.stringify({ put: [rect("a", 1)] }),
  });
  let room = await aliceT.query(api.features.rooms.getRoom, { roomId });
  expect(room?.lastEditedBy).toEqual({ id: "user_alice", name: "Alice" });

  const { token } = await aliceT.mutation(api.features.invites.createInviteLink, {
    roomId,
    role: "editor",
  });
  await bobT.mutation(api.features.invites.acceptInvite, { token });
  await bobT.mutation(api.features.canvas.applyCanvasChanges, {
    roomId,
    changes: JSON.stringify({ put: [rect("b", 2)] }),
  });
  room = await aliceT.query(api.features.rooms.getRoom, { roomId });
  expect(room?.lastEditedBy).toEqual({ id: "user_bob", name: "Bob" });
});

test("applyCanvasChanges drops elements that could crash the renderer", async () => {
  const { aliceT, roomId } = await setup();
  await aliceT.mutation(api.features.canvas.applyCanvasChanges, {
    roomId,
    changes: JSON.stringify({
      put: [
        rect("ok", 5),
        { id: "no-type" },
        { type: "rectangle" },
        "not an element",
        { id: "", type: "rectangle" },
      ],
    }),
  });
  const { canvasData } = await aliceT.query(api.features.canvas.loadCanvas, { roomId });
  expect(readScene(canvasData).elements.map((element) => element.id)).toEqual(["ok"]);
});

test("applyCanvasChanges rejects writes that would exceed the canvas size ceiling", async () => {
  const { aliceT, roomId } = await setup();
  const huge = { ...rect("huge", 0), text: "x".repeat(2_000_000) };
  await expect(
    aliceT.mutation(api.features.canvas.applyCanvasChanges, {
      roomId,
      changes: JSON.stringify({ put: [huge] }),
    })
  ).rejects.toThrow(/size limit/);
});
