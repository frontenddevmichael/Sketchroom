import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { auth, MAX_CANVAS_BYTES } from "../core/lib";
import { rateLimiter } from "../core/rateLimiter";

// A room's canvas is one self-describing document:
//
//   { format: "excalidraw/1", elements: ExcalidrawElement[], skipped: {} }
//
// Elements stay an ordered array because paint order is content. Merges are
// still per element (by id), so two people editing different parts of the same
// board never overwrite each other's work — which is why the wire payload is a
// diff `{ put: Element[], remove: string[] }` rather than the whole document.
const SCENE_FORMAT = "excalidraw/1";

interface StoredElement {
  id: string;
  type: string;
  [key: string]: unknown;
}

interface SceneDocument {
  format: string;
  elements: StoredElement[];
  skipped: Record<string, number>;
}

function emptyScene(): SceneDocument {
  return { format: SCENE_FORMAT, elements: [], skipped: {} };
}

function isElement(value: unknown): value is StoredElement {
  if (!value || typeof value !== "object") return false;
  const element = value as { id?: unknown; type?: unknown };
  return (
    typeof element.id === "string" &&
    element.id !== "" &&
    typeof element.type === "string" &&
    element.type !== ""
  );
}

/**
 * Read whatever is stored for a room. A legacy tldraw record map is *not*
 * converted here: the client converts it on read and sends the whole converted
 * scene on its first edit, so the server never needs the legacy vocabulary. A
 * malformed blob reads as an empty scene instead of throwing on load.
 */
function parseScene(canvasData: string | null | undefined): SceneDocument {
  if (!canvasData) return emptyScene();
  try {
    const parsed: unknown = JSON.parse(canvasData);
    if (Array.isArray(parsed)) {
      return { format: SCENE_FORMAT, elements: parsed.filter(isElement), skipped: {} };
    }
    if (parsed && typeof parsed === "object") {
      const candidate = parsed as { format?: unknown; elements?: unknown };
      if (candidate.format === SCENE_FORMAT && Array.isArray(candidate.elements)) {
        return {
          format: SCENE_FORMAT,
          elements: candidate.elements.filter(isElement),
          skipped: {},
        };
      }
      if (Array.isArray(candidate.elements)) {
        // A bare Excalidraw file blob: adopt it into our framing.
        return { format: SCENE_FORMAT, elements: candidate.elements.filter(isElement), skipped: {} };
      }
    }
  } catch (e) {
    console.warn("[canvas] malformed canvasData, resetting to empty:", e);
  }
  return emptyScene();
}

/**
 * Apply one batch of element diffs. `put` upserts by id, `remove` deletes by id.
 * Each batch bumps canvasVersion so peers watching loadCanvas reconcile exactly
 * the elements that changed. Same-element writes from different clients follow
 * last-write-wins-per-element, which is the sync model the room's save path is
 * built around.
 */
export const applyCanvasChanges = mutation({
  args: {
    roomId: v.id("rooms"),
    changes: v.string(), // JSON { put: Element[], remove: string[] }
  },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "canvasApply", {
      key: identity.subject,
      throws: false,
    });
    if (!ok) {
      throw new Error(`Saving too fast — try again in ~${Math.ceil((retryAfter ?? 1000) / 1000)}s`);
    }
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member || (member.role !== "owner" && member.role !== "editor")) {
      throw new Error("Insufficient permissions");
    }
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    let diff: { put?: unknown; remove?: unknown };
    try {
      diff = JSON.parse(args.changes);
    } catch {
      throw new Error("Invalid changes payload");
    }
    if (!diff || typeof diff !== "object") throw new Error("Invalid changes payload");
    if (diff.put === undefined && diff.remove === undefined) {
      throw new Error("Invalid changes payload");
    }
    if (diff.put !== undefined && !Array.isArray(diff.put)) {
      throw new Error("Invalid changes payload");
    }
    if (diff.remove !== undefined && !Array.isArray(diff.remove)) {
      throw new Error("Invalid changes payload");
    }
    const puts = (diff.put ?? []) as unknown[];
    const removes = (diff.remove ?? []) as unknown[];
    if (puts.length === 0 && removes.length === 0) {
      throw new Error("Empty changes payload");
    }
    if (!removes.every((id) => typeof id === "string" && id !== "")) {
      throw new Error("Invalid changes payload");
    }

    const scene = parseScene(room.canvasData);
    const byId = new Map<string, StoredElement>();
    for (const element of scene.elements) byId.set(element.id, element);
    for (const element of puts) {
      // An element without an id or a type would crash the renderer on the next
      // load, so it is dropped rather than stored.
      if (!isElement(element)) continue;
      byId.set(element.id, element);
    }
    for (const id of removes as string[]) byId.delete(id);

    // Keep the stored order: unchanged elements keep their slot, new ones are
    // appended in the order they arrived.
    const ordered: StoredElement[] = [];
    const emitted = new Set<string>();
    for (const element of scene.elements) {
      if (!byId.has(element.id) || emitted.has(element.id)) continue;
      ordered.push(byId.get(element.id)!);
      emitted.add(element.id);
    }
    for (const element of puts) {
      if (!isElement(element) || emitted.has(element.id)) continue;
      if (!byId.has(element.id)) continue;
      ordered.push(byId.get(element.id)!);
      emitted.add(element.id);
    }

    const newCanvasData = JSON.stringify({
      format: SCENE_FORMAT,
      elements: ordered,
      skipped: {},
    } satisfies SceneDocument);
    if (newCanvasData.length > MAX_CANVAS_BYTES) {
      throw new Error(
        "This room's canvas is at its size limit — remove a few blocks and try again."
      );
    }

    const newVersion = room.canvasVersion + 1;
    await ctx.db.patch(args.roomId, {
      canvasData: newCanvasData,
      canvasVersion: newVersion,
      updatedAt: Date.now(),
      lastEditedBy: { id: identity.subject, name: member.name || identity.email || "Unknown" },
    });
    return { version: newVersion };
  },
});

export const loadCanvas = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) return { canvasData: "", canvasVersion: 0, compactedVersion: 0 };
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member) return { canvasData: "", canvasVersion: 0, compactedVersion: 0 };
    const room = await ctx.db.get(args.roomId);
    if (!room) return { canvasData: "", canvasVersion: 0, compactedVersion: 0 };
    return {
      canvasData: room.canvasData || "",
      canvasVersion: room.canvasVersion,
      compactedVersion: room.compactedVersion ?? 0,
    };
  },
});

export const getCanvasVersion = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) return 0;
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId).eq("userId", identity.subject))
      .first();
    if (!member) return 0;
    const room = await ctx.db.get(args.roomId);
    return room?.canvasVersion || 0;
  },
});
