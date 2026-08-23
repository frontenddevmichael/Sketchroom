/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema.js";
import { api } from "../_generated/api";

vi.mock("../core/rateLimiter", () => ({
  rateLimiter: {
    limit: vi.fn(async () => ({ ok: true, retryAfter: undefined })),
  },
}));

const modules = import.meta.glob("../**/*.ts");

const user1 = {
  subject: "user1",
  tokenIdentifier: "https://test.auth|user1",
  name: "User One",
  email: "user1@test.com",
};

describe("comments", () => {
  async function setup() {
    const t = convexTest(schema, modules);
    const t1 = t.withIdentity(user1);
    const workspaceId = await t1.mutation(api.features.rooms.createWorkspace, { name: "W" });
    const room = await t1.mutation(api.features.rooms.createRoom, {
      workspaceId: workspaceId.id,
      name: "R",
    });
    return { t, t1, roomId: room.id };
  }

  test("createComment creates a top-level comment", async () => {
    const { t1, roomId } = await setup();

    const id = await t1.mutation(api.features.comments.createComment, {
      roomId,
      x: 100,
      y: 200,
      body: "Test comment",
    });
    expect(id).toBeTruthy();

    const comment = await t1.query(api.features.comments.listComments, { roomId });
    expect(comment.length).toBe(1);
    expect(comment[0].body).toBe("Test comment");
    expect(comment[0].x).toBe(100);
    expect(comment[0].resolved).toBe(false);
    expect(comment[0].parentId).toBeUndefined();
  });

  test("createComment rejects empty body", async () => {
    const { t1, roomId } = await setup();

    await expect(
      t1.mutation(api.features.comments.createComment, {
        roomId,
        x: 0,
        y: 0,
        body: "   ",
      })
    ).rejects.toThrow("Comment cannot be empty");
  });

  test("replyToComment creates a reply with parentId", async () => {
    const { t1, roomId } = await setup();

    const parentId = await t1.mutation(api.features.comments.createComment, {
      roomId,
      x: 50,
      y: 50,
      body: "Parent",
    });

    const replyId = await t1.mutation(api.features.comments.replyToComment, {
      parentId,
      body: "Reply body",
    });

    const comments = await t1.query(api.features.comments.listComments, { roomId });
    const reply = comments.find((c) => c._id === replyId);
    expect(reply).toBeTruthy();
    expect(reply!.parentId).toBe(parentId);
    expect(reply!.body).toBe("Reply body");
  });

  test("deleteComment cascades to replies", async () => {
    const { t1, roomId } = await setup();

    const parentId = await t1.mutation(api.features.comments.createComment, {
      roomId,
      x: 0,
      y: 0,
      body: "Parent",
    });
    await t1.mutation(api.features.comments.replyToComment, {
      parentId,
      body: "Reply",
    });

    await t1.mutation(api.features.comments.deleteComment, { commentId: parentId });

    const comments = await t1.query(api.features.comments.listComments, { roomId });
    expect(comments.find((c) => c._id === parentId)).toBeUndefined();
  });
});
