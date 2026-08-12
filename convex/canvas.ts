import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./lib";
import { rateLimiter } from "./rateLimiter";

// Canvas state is persisted as a canonical map { [recordId]: TLRecord } of
// document-scope records only. Session and presence records (camera, pointer,
// instance state) are never stored — they are ephemeral per-viewer state, so
// storing them would leak one viewer's camera position to everyone else.
const SESSION_SCOPE_TYPE_NAMES = new Set([
  "camera",
  "instance",
  "instance_page_state",
  "pointer",
  "instance_presence",
]);

function parseCanonicalRecords(canvasData: string | undefined | null): Record<string, unknown> {
  if (!canvasData) return {};
  try {
    const parsed = JSON.parse(canvasData);
    if (parsed && typeof parsed === "object") {
      const recordList: [string, unknown][] = parsed.records && typeof parsed.records === "object"
        // Legacy full snapshot shape { schema, records }
        ? Object.entries(parsed.records as Record<string, { typeName?: string }>)
        // Canonical shape: { [id]: TLRecord }
        : Object.entries(parsed as Record<string, unknown>);
      const canonical: Record<string, unknown> = {};
      for (const [id, rec] of recordList) {
        const candidate = rec as { typeName?: string };
        if (!candidate || typeof candidate !== "object" || typeof candidate.typeName !== "string") continue;
        if (candidate.typeName === "") continue;
        if (SESSION_SCOPE_TYPE_NAMES.has(candidate.typeName)) continue;
        canonical[id] = rec;
      }
      return canonical;
    }
  } catch {
    // ignore malformed payloads
  }
  return {};
}

// A record is only persisted when it carries a usable typeName. Anything else
// would crash tldraw's store on the next load, so it is dropped defensively.
function isStorableRecord(rec: unknown): rec is Record<string, unknown> {
  if (!rec || typeof rec !== "object") return false;
  const typeName = (rec as { typeName?: unknown }).typeName;
  return typeof typeName === "string" && typeName !== "";
}

// Apply one batch of record diffs. `put` upserts document records by id,
// `remove` deletes by id. Each batch bumps canvasVersion so peers watching
// loadCanvas reconcile exactly the records that changed. Same-record writes
// from different clients follow last-write-wins-per-record, which matches
// tldraw's own sync semantics.
export const applyCanvasChanges = mutation({
  args: {
    roomId: v.id("rooms"),
    changes: v.string(), // JSON { put: { [id]: TLRecord }, remove: string[] }
  },
  handler: async (ctx, args) => {
    const identity = await auth.getIdentity(ctx);
    if (!identity) throw new Error("Not authenticated");
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "canvasApply", {
      key: identity.subject,
      throws: true,
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

    let diff: { put?: Record<string, unknown>; remove?: string[] };
    try {
      diff = JSON.parse(args.changes);
    } catch {
      throw new Error("Invalid changes payload");
    }
    if (!diff || typeof diff !== "object") throw new Error("Invalid changes payload");
    if (
      (diff.put === undefined || diff.put === null) &&
      (diff.remove === undefined || diff.remove === null)
    ) {
      throw new Error("Invalid changes payload");
    }
    if (diff.put && (typeof diff.put !== "object" || Array.isArray(diff.put))) {
      throw new Error("Invalid changes payload");
    }
    if (diff.remove !== undefined && !Array.isArray(diff.remove)) {
      throw new Error("Invalid changes payload");
    }
    if (Object.keys(diff.put ?? {}).length === 0 && (diff.remove ?? []).length === 0) {
      throw new Error("Empty changes payload");
    }

    const canonical = parseCanonicalRecords(room.canvasData);
    for (const [id, rec] of Object.entries(diff.put ?? {})) {
      if (isStorableRecord(rec)) canonical[id] = rec;
    }
    for (const id of diff.remove ?? []) {
      delete canonical[id];
    }

    const newVersion = room.canvasVersion + 1;
    await ctx.db.patch(args.roomId, {
      canvasData: JSON.stringify(canonical),
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
