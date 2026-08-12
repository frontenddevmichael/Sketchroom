// Harness-only replacement for `convex/_generated/api`. Aliased by
// dev/vite.config.ts so the real app components and the harness share one
// stable `api` object.
//
// The real generated `api` is `anyApi` — a Proxy that returns a brand-new
// function-reference object on every property access — which makes it useless
// as a Map key. Here each function is a plain string, so `useQuery(fn)` /
// `useMutation(fn)` / the harness's `__setQueryResult(fn, …)` all agree on
// identity regardless of how many times the path is evaluated.
export const api = {
  rooms: {
    getWorkspaces: 'rooms:getWorkspaces',
    getUsage: 'rooms:getUsage',
    getRooms: 'rooms:getRooms',
    getRoom: 'rooms:getRoom',
    createWorkspace: 'rooms:createWorkspace',
    updateWorkspaceName: 'rooms:updateWorkspaceName',
    deleteWorkspace: 'rooms:deleteWorkspace',
    createRoom: 'rooms:createRoom',
    updateRoomName: 'rooms:updateRoomName',
    updateRoomThumbnail: 'rooms:updateRoomThumbnail',
    deleteRoom: 'rooms:deleteRoom',
  },
  canvas: {
    loadCanvas: 'canvas:loadCanvas',
    applyCanvasChanges: 'canvas:applyCanvasChanges',
  },
  presence: {
    getPresence: 'presence:getPresence',
    upsertPresence: 'presence:upsertPresence',
    removePresence: 'presence:removePresence',
    prunePresence: 'presence:prunePresence',
  },
  ai: {
    getAiMessages: 'ai:getAiMessages',
    requestAiSuggestion: 'ai:requestAiSuggestion',
    dismissAiSuggestion: 'ai:dismissAiSuggestion',
  },
  snapshots: {
    listSnapshots: 'snapshots:listSnapshots',
    saveSnapshot: 'snapshots:saveSnapshot',
    restoreSnapshot: 'snapshots:restoreSnapshot',
  },
  invites: {
    listMembers: 'invites:listMembers',
    getRoomInvites: 'invites:getRoomInvites',
    inviteMember: 'invites:inviteMember',
    createInviteLink: 'invites:createInviteLink',
    revokeInvite: 'invites:revokeInvite',
    updateMemberRole: 'invites:updateMemberRole',
    removeMember: 'invites:removeMember',
    acceptInvite: 'invites:acceptInvite',
  },
  errors: {
    reportError: 'errors:reportError',
  },
} as const;

export const internal = api;
export const components = {};
