// Data seed for the full-app harness view (`/harness.html?view=app`).
//
// Registers per-query results and per-mutation handlers on the Convex stub so
// the REAL Dashboard / RoomScreen / modals render realistic data without a
// backend. Mutation handlers keep the fake store coherent — creating a room
// updates getRooms + getRoom, renaming patches the current room, saving a
// snapshot appends to the history list — so smoke tests can assert on the
// real UI flow end to end.
import { api } from '../convex/_generated/api';
import {
  __clearCalls,
  __setMutationHandler,
  __setQueryResult,
} from './stubs/convex-react';

interface RoomRow {
  _id: string;
  name: string;
  workspaceId: string;
  ownerId: string;
  canvasData: string;
  canvasVersion: number;
  compactedVersion: number;
  thumbnailData: string | null;
  createdAt: number;
  updatedAt: number;
  lastEditedBy: { id: string; name: string } | null;
  userRole: 'owner' | 'editor' | 'viewer';
  members: { avatars: { name: string; avatarUrl: string | null }[]; plusCount: number };
}

interface SnapshotRow {
  _id: string;
  roomId: string;
  version: number;
  canvasData: string | null;
  createdBy: string;
  createdAt: number;
  description?: string;
}

const NOW = Date.now();

const SEED_WORKSPACE = {
  _id: 'ws_demo',
  name: "Ada's Workspace",
  ownerId: 'u_harness',
  createdAt: NOW - 30 * 24 * 3600_000,
  updatedAt: NOW - 3600_000,
};

function roomRow(id: string, name: string, updatedAtAgo: number): RoomRow {
  return {
    _id: id,
    name,
    workspaceId: 'ws_demo',
    ownerId: 'u_harness',
    canvasData: '',
    canvasVersion: 0,
    compactedVersion: 0,
    thumbnailData: null,
    createdAt: NOW - 10 * 24 * 3600_000,
    updatedAt: NOW - updatedAtAgo,
    lastEditedBy: { id: 'u_harness', name: 'Ada Lovelace' },
    userRole: 'owner',
    members: { avatars: [{ name: 'Ada Lovelace', avatarUrl: null }], plusCount: 0 },
  };
}

const SEED_ROOMS: RoomRow[] = [
  roomRow('room_a', 'Launch planning', 3600_000),
  roomRow('room_b', 'Auth flow review', 26 * 3600_000),
];

const SEED_USAGE = { rooms: 2, aiMessages: 4, aiSuggestions: 4 };

// Mutable fake store — mutated by the handlers below, mirrored back into the
// stub so queries re-run with fresh data.
let rooms: RoomRow[] = [...SEED_ROOMS];
let currentRoom: RoomRow = SEED_ROOMS[0];
let snapshots: SnapshotRow[] = [];

function makeSnapshots(): SnapshotRow[] {
  return [
    {
      _id: 'snap_2',
      roomId: 'room_a',
      version: 2,
      canvasData: null,
      createdBy: 'u_harness',
      createdAt: NOW - 2 * 60_000,
      description: 'Autosaved',
    },
    {
      _id: 'snap_1',
      roomId: 'room_a',
      version: 1,
      canvasData: null,
      createdBy: 'u_harness',
      createdAt: NOW - 12 * 60_000,
      description: 'Initial sketch',
    },
  ];
}

function registerMutations() {
  __setMutationHandler(api.features.rooms.createRoom, (args) => {
    const { name, seed } = (args ?? {}) as { name?: string; seed?: string };
    const row = roomRow(`room_created_${rooms.length + 1}`, name?.trim() || 'Untitled room', 0);
    row.canvasData = seed ?? '';
    rooms = [row, ...rooms];
    currentRoom = row;
    __setQueryResult(api.features.rooms.getRooms, rooms);
    __setQueryResult(api.features.rooms.getRoom, currentRoom);
    return { id: row._id, ...row };
  });

  __setMutationHandler(api.features.rooms.createWorkspace, () => ({ id: 'ws_demo' }));

  __setMutationHandler(api.features.rooms.updateRoomName, (args) => {
    const { name } = (args ?? {}) as { name?: string };
    currentRoom = { ...currentRoom, name: name ?? currentRoom.name, updatedAt: Date.now() };
    rooms = rooms.map((r) => (r._id === currentRoom._id ? currentRoom : r));
    __setQueryResult(api.features.rooms.getRoom, currentRoom);
    __setQueryResult(api.features.rooms.getRooms, rooms);
    return { ...currentRoom };
  });

  __setMutationHandler(api.features.rooms.deleteRoom, (args) => {
    const { roomId } = (args ?? {}) as { roomId?: string };
    rooms = rooms.filter((r) => r._id !== roomId);
    __setQueryResult(api.features.rooms.getRooms, rooms);
    return true;
  });

  __setMutationHandler(api.features.rooms.deleteWorkspace, () => true);
  __setMutationHandler(api.features.rooms.updateRoomThumbnail, () => true);

  __setMutationHandler(api.features.canvas.applyCanvasChanges, () => ({
    version: (currentRoom.canvasVersion ?? 0) + 1,
  }));

  __setMutationHandler(api.features.presence.upsertPresence, () => true);
  __setMutationHandler(api.features.presence.removePresence, () => true);
  __setMutationHandler(api.features.presence.prunePresence, () => 0);

  __setMutationHandler(api.features.snapshots.saveSnapshot, (args) => {
    const { description } = (args ?? {}) as { description?: string };
    const snap: SnapshotRow = {
      _id: `snap_${Date.now()}`,
      roomId: currentRoom._id,
      version: snapshots.length + 1,
      canvasData: null,
      createdBy: 'u_harness',
      createdAt: Date.now(),
      description,
    };
    snapshots = [snap, ...snapshots];
    __setQueryResult(api.features.snapshots.listSnapshots, snapshots);
    return { snapshotId: snap._id, version: snap.version };
  });

  __setMutationHandler(api.features.snapshots.restoreSnapshot, () => ({ version: 99, canvasData: '{}' }));

  __setMutationHandler(api.features.ai.dismissAiSuggestion, () => true);
  __setMutationHandler(api.features.invites.inviteMember, () => ({ inviteId: 'inv_1', token: 'tok_demo' }));
  __setMutationHandler(api.features.invites.createInviteLink, () => ({ token: 'tok_demo' }));
  __setMutationHandler(api.features.invites.revokeInvite, () => true);
  __setMutationHandler(api.features.invites.updateMemberRole, () => true);
  __setMutationHandler(api.features.invites.removeMember, () => true);
  __setMutationHandler(api.core.errors.reportError, () => true);
}

export function seedAppStubs(opts: { snapshots?: boolean } = {}) {
  rooms = [...SEED_ROOMS];
  currentRoom = SEED_ROOMS[0];
  snapshots = opts.snapshots ? makeSnapshots() : [];
  __clearCalls();

  __setQueryResult(api.features.rooms.getWorkspaces, [SEED_WORKSPACE]);
  __setQueryResult(api.features.rooms.getUsage, SEED_USAGE);
  __setQueryResult(api.features.rooms.getRooms, rooms);
  __setQueryResult(api.features.rooms.getRoom, currentRoom);
  __setQueryResult(api.features.canvas.loadCanvas, { canvasData: '', canvasVersion: 0, compactedVersion: 0 });
  __setQueryResult(api.features.presence.getPresence, []);
  __setQueryResult(api.features.ai.getAiMessages, []);
  __setQueryResult(api.features.snapshots.listSnapshots, snapshots);
  __setQueryResult(api.features.invites.listMembers, []);
  __setQueryResult(api.features.invites.getRoomInvites, []);
  __setQueryResult(api.core.users.me, {
    id: 'u_harness',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    imageUrl: null,
    emailVerified: true,
  });
  __setQueryResult(api.core.users.authConfig, { emailEnabled: false, googleEnabled: false });
  __setMutationHandler(api.core.users.updateProfile, () => true);

  registerMutations();
}
