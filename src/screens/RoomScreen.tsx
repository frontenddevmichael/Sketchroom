import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useTheme } from '../lib/useTheme';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { createTLStore, setUserPreferences } from 'tldraw';
import { Tldraw } from 'tldraw';
import type { Editor, TLRecord, TLStore } from 'tldraw';
import 'tldraw/tldraw.css';
import { Blocks, History, Download, Sparkles, MousePointer2, PenTool, StickyNote, Type, Spline, Shapes, Eraser, ZoomIn, ZoomOut, Maximize, Undo2, Redo2, HelpCircle, X, ArrowLeft, Pencil, User, MoreHorizontal } from 'lucide-react';
import { useLongLoad } from '../hooks/useLongLoad';
import { useModalFocus } from '../lib/useModalFocus';
import { usePageTitle } from '../lib/usePageTitle';
import { LoaderMark, LoaderWordmark } from '../components/LoadingScreen';
import { CanvasEmptyIllo, ErrorIllo, DrawnTitle } from '../components/illustrations';
import { AiFeed } from '../components/AiFeed';
import { useAiCopilot } from '../lib/useAiCopilot';
import { ShareModal } from '../components/ShareModal';
import { VersionHistory } from '../components/VersionHistory';
// jspdf is ~600 kB — only download it when someone actually exports.
const ExportDialog = lazy(() =>
  import('../components/ExportDialog').then((m) => ({ default: m.ExportDialog })),
);
import { BlockLibrary } from '../components/BlockLibrary';
import { ToolOptionsRail } from '../components/ToolOptions';
import type { ToolStyleMode } from '../components/ToolOptions';
import { PresenceCursors } from '../components/PresenceCursors';
import { SelectionAwareness } from '../components/SelectionAwareness';
import { ViewportAwareness } from '../components/ViewportAwareness';
import { PlacementPulses } from '../components/PlacementPulses';
import { FocusDim, FocusHint } from '../components/FocusDim';
import '../components/shared.css';
import './RoomScreen.css';
import '../components/AiFeed.css';
import '../components/VersionHistory.css';
import '../components/BlockLibrary.css';
import '../components/ToolOptions.css';
import '../components/PresenceCursors.css';
import '../components/ViewportAwareness.css';
import '../components/PlacementPulses.css';
import '../components/FocusDim.css';

const PRESENCE_COLORS = ['#25D366', '#4A90D9', '#D9664A', '#9B59B6', '#E67E22', '#16A085'];

function presenceColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}

// The server persists canvas state as a canonical map { [recordId]: TLRecord }
// of document-scope records only (session/presence records like camera and
// pointer are never stored). Older rooms may still hold a full tldraw snapshot
// { schema, records }; extract the document scope in that case. Either way we
// only ever emit records whose typeName exists in tldraw's document scope, so
// a malformed stored value (missing typeName, or a stray records/schema
// wrapper) can never crash store.put.
function parseCanonicalRecords(
  data: string | undefined | null,
  store: TLStore
): Record<string, TLRecord> {
  if (!data) return {};
  try {
    const parsed = JSON.parse(data) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const legacy = parsed as { records?: unknown; schema?: unknown };
    const docTypes = store.scopedTypes.document;
    const recordList =
      legacy.records && typeof legacy.records === 'object' && legacy.schema
        ? Object.entries(legacy.records as Record<string, unknown>)
        : Object.entries(parsed as Record<string, unknown>);
    const out: Record<string, TLRecord> = {};
    for (const [id, record] of recordList) {
      const rec = record as TLRecord;
      if (rec && typeof rec === 'object' && docTypes.has(rec.typeName)) out[id] = rec;
    }
    return out;
  } catch {
    return {};
  }
}

type Panel = 'history' | 'blocks' | null;

const TOOL_BY_ID: Record<string, { tool: string; hint: string; key?: string }> = {
  select: { tool: 'select', hint: 'Select', key: 'V' },
  draw: { tool: 'draw', hint: 'Draw', key: 'D' },
  sticky: { tool: 'note', hint: 'Sticky note', key: 'N' },
  text: { tool: 'text', hint: 'Text', key: 'T' },
  connector: { tool: 'arrow', hint: 'Connector', key: 'A' },
  eraser: { tool: 'eraser', hint: 'Eraser', key: 'E' },
  shapes: { tool: 'geo', hint: 'Shapes', key: 'R' },
};

// The left tool rail is the design brief's tool surface: essential tools plus
// the block library trigger. Eraser stays keyboard-accessible via tldraw's own
// E shortcut but never crowds the rail.
const RAIL_TOOL_IDS = ['select', 'draw', 'sticky', 'text', 'connector', 'shapes'];

// Tools with a styling/options bar.
const TOOL_OPTIONS_TOOLS = new Set(['select', 'draw', 'sticky', 'text', 'connector', 'shapes']);

const TOOL_ICONS: Record<string, typeof MousePointer2> = {
  select: MousePointer2,
  draw: PenTool,
  sticky: StickyNote,
  text: Type,
  connector: Spline,
  eraser: Eraser,
  shapes: Shapes,
};

function toolTitle(cfg: { hint: string; key?: string }) {
  return cfg.key ? `${cfg.hint} (${cfg.key})` : cfg.hint;
}

// Guided walkthrough steps: the three real actions that teach the core loop,
// in the order the onboarding scene draws them. Each entry is the rail tool
// id the guide highlights and arms while that step is current.
// Widened to string[] so a number index (wtStep) is valid; the order is what
// matters, not tuple arity.
const WT_STEP_IDS: readonly string[] = ['draw', 'sticky', 'connector'];
const WT_COPY = [
  'Pick up the pencil and sketch something on the board',
  'Drop a sticky note beside it',
  'Connect the two with an arrow',
  "That's the whole loop — you've got it",
] as const;

/**
 * First-visit onboarding: a quiet scene that draws itself in step by step —
 * pencil, then sticky note, then the connector between them — teaching the
 * product's core loop through its own linework. Dismissed by the first real
 * stroke; never replayed for a room once shown.
 */
function CanvasOnboardingSketch() {
  const d = (ms: number): CSSProperties => ({ ['--d' as string]: `${ms}ms` }) as CSSProperties;
  return (
    <svg viewBox="0 0 300 130" fill="none" aria-hidden="true">
      {/* Pencil — body, then tip, then ferrule. */}
      <path className="illo-stroke" pathLength={1} d="M36 86 L42 64 L92 48 L86 70 Z" style={d(0)} />
      <path className="illo-stroke" pathLength={1} d="M92 48 L108 38 L100 64" style={d(150)} />
      <path className="illo-stroke" pathLength={1} d="M48 78 L51 64" style={d(280)} />
      {/* Sticky note — outline, fold, then the scribbles. */}
      <path className="illo-stroke" pathLength={1} d="M198 42 L274 44 L280 98 L204 100 Z" style={d(900)} />
      <path className="illo-stroke" pathLength={1} d="M274 44 L276 60 L260 58" style={d(1030)} />
      <path className="illo-stroke" pathLength={1} d="M212 64 q6 -5 12 0 t12 0" style={d(1160)} />
      <path className="illo-stroke" pathLength={1} d="M212 78 q6 -5 12 0 t12 0" style={d(1240)} />
      <path className="illo-stroke" pathLength={1} d="M212 90 q6 -4 12 0" style={d(1310)} />
      {/* Connector — the curve, its arrowhead, then a single green sparkle. */}
      <path className="illo-stroke" pathLength={1} d="M104 46 C142 40 164 64 198 70" style={d(1800)} />
      <path className="illo-stroke" pathLength={1} d="M190 67 L198 70 L191 77" style={d(1960)} />
      <path className="illo-stroke illo-accent" pathLength={1} d="M258 22 l2 5.5 5.5 2 -5.5 2 -2 5.5 -2 -5.5 -5.5 -2 5.5 -2 z" style={d(2150)} />
    </svg>
  );
}

export function RoomScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [isConnected, setIsConnected] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'offline'>('idle');
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [showShare, setShowShare] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [activeTool, setActiveTool] = useState('select');
  const [zoom, setZoom] = useState(1);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const shortcutsRef = useModalFocus<HTMLDivElement>(() => setShowShortcuts(false), showShortcuts);
  const [shapeCount, setShapeCount] = useState(0);
  const [selectionCount, setSelectionCount] = useState(0);
  const [canvasTouched, setCanvasTouched] = useState(false);
  const [showRoomFlourish, setShowRoomFlourish] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Guided walkthrough: which of the three real actions (a pencil stroke, a
  // sticky note, a connector) the user has completed. Null = not active.
  const [walkthrough, setWalkthrough] = useState<{ pencil: boolean; note: boolean; connector: boolean } | null>(null);
  const [wtClosing, setWtClosing] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  // Shared between the quick strip and the options rail so a pick in either
  // respects the same "Selection vs New shapes" mode.
  const [styleMode, setStyleMode] = useState<ToolStyleMode>('next');
  const aiInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimer = useRef<number | null>(null);
  const loadedVersion = useRef(-1);
  const dirtySinceSnapshot = useRef(false);
  const snapInFlight = useRef(false);
  const pendingDiff = useRef<{ put: Record<string, TLRecord>; remove: Set<string> }>({
    put: {},
    remove: new Set(),
  });
  const baselineSeeded = useRef(false);
  const savedAt = useRef(0);
  const editorRef = useRef<Editor | null>(null);
  const [editorState, setEditorState] = useState<Editor | null>(null);
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const lastPresenceShip = useRef(0);
  const lastSelection = useRef('');
  const lastPrune = useRef(0);

  const roomIdArg = roomId ? (roomId as Id<'rooms'>) : undefined;
  const room = useQuery(api.rooms.getRoom, roomIdArg ? { roomId: roomIdArg } : 'skip');

  // The walkthrough is active until every guided step is done (or dismissed);
  // wtStep is the first uncompleted step in order, 3 = everything done.
  const wtActive = walkthrough !== null && !wtClosing;
  const wtStep = !walkthrough
    ? 0
    : !walkthrough.pencil
      ? 0
      : !walkthrough.note
        ? 1
        : !walkthrough.connector
          ? 2
          : 3;

  // Ends the guide with a short fade; idempotent and safe to call repeatedly.
  const dismissWalkthrough = useCallback(() => {
    setWtClosing(true);
    window.setTimeout(() => {
      setWalkthrough(null);
      setWtClosing(false);
    }, 380);
  }, []);

  usePageTitle(room?.name ? `${room.name} — Sketchroom` : 'Room — Sketchroom');
  const canvas = useQuery(api.canvas.loadCanvas, roomIdArg ? { roomId: roomIdArg } : 'skip');
  const presence = useQuery(api.presence.getPresence, roomIdArg ? { roomId: roomIdArg } : 'skip');
  const aiMessages = useQuery(api.ai.getAiMessages, roomIdArg ? { roomId: roomIdArg } : 'skip');

  const isReadOnly = room?.userRole === 'viewer';

  // Arms the highlighted tool for a walkthrough step so the user can act
  // immediately — the rail indicator slides to it and the ring glows. Called
  // at the walkthrough transitions (the start timer, the step watcher), never
  // from a render effect.
  const armWalkthroughTool = useCallback(
    (step: number) => {
      if (step >= 3 || isReadOnly) return;
      const id = WT_STEP_IDS[step];
      const cfg = TOOL_BY_ID[id];
      if (!cfg) return;
      const editor = editorRef.current;
      if (editor) editor.setCurrentTool(cfg.tool);
      setActiveTool(id);
    },
    [isReadOnly]
  );

  const ai = useAiCopilot({ roomId: roomIdArg, editor: editorState, readOnly: isReadOnly });
  const closeAiFeed = ai.closeFeed;
  const openFeed = ai.openFeed;

  // The right-edge AI strip opens into a full panel; the strip only exists in
  // its collapsed state while nothing is asking or pending.
  const aiPanelOpen =
    ai.feedOpen ||
    ai.isAsking ||
    (aiMessages && aiMessages.length > 0 && aiMessages[aiMessages.length - 1]?.status === 'pending');

  // Pulse the AI strip while a completed suggestion hasn't been viewed yet. A
  // localStorage watermark trails the newest message id the user has opened the
  // feed for, so closing a feed you already read doesn't re-pulse it.
  const lastAiId = aiMessages && aiMessages.length > 0 ? aiMessages[aiMessages.length - 1]._id : null;
  const [seenAiId, setSeenAiId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('sketchroom.aiSeen.v1');
    } catch {
      return null;
    }
  });
  const hasUnviewed = !!lastAiId && lastAiId !== seenAiId && !aiPanelOpen;

  // One floating panel at a time: a pending AI message (or an ask from a
  // teammate) pops the feed open, so any history/blocks panel closes first.
  // This is a deliberate state synchronization (not a derived value): closing
  // the panel here means it stays closed when the feed collapses again, and
  // the two floating surfaces can never coexist.
  useEffect(() => {
    if (aiPanelOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActivePanel(null);
    }
  }, [aiPanelOpen]);

  useEffect(() => {
    if (!aiPanelOpen || !lastAiId || lastAiId === seenAiId) return;
    try {
      localStorage.setItem('sketchroom.aiSeen.v1', lastAiId);
    } catch {
      // ignore
    }
    const t = window.setTimeout(() => setSeenAiId(lastAiId), 0);
    return () => window.clearTimeout(t);
  }, [aiPanelOpen, lastAiId, seenAiId]);
  const applyCanvasChanges = useMutation(api.canvas.applyCanvasChanges);
  const upsertPresence = useMutation(api.presence.upsertPresence);
  const removePresence = useMutation(api.presence.removePresence);
  const prunePresence = useMutation(api.presence.prunePresence);
  const updateRoomName = useMutation(api.rooms.updateRoomName);
  const saveSnapshot = useMutation(api.snapshots.saveSnapshot);
  const updateRoomThumbnail = useMutation(api.rooms.updateRoomThumbnail);

  const captureThumbnail = useCallback(async () => {
    if (!roomIdArg || isReadOnly) return;
    const editor = editorRef.current;
    if (!editor) return;
    const shapes = editor.getCurrentPageShapes();
    if (shapes.length === 0) return;
    try {
      const { url } = await editor.toImageDataUrl(shapes, {
        format: 'png',
        scale: 0.4,
        background: true,
      });
      await updateRoomThumbnail({ roomId: roomIdArg, thumbnailData: url });
    } catch {
      // Thumbnailing is best-effort; never interrupt the editor for it.
    }
  }, [roomIdArg, isReadOnly, updateRoomThumbnail]);

  const [store] = useState(() => createTLStore({ defaultName: 'Untitled room' }));
  // Blur-up: once the canvas data arrives, let the live canvas hydrate
  // underneath, then cross-fade the loading overlay away after a beat.
  const [showCanvasOverlay, setShowCanvasOverlay] = useState(true);
  // Long-load honesty for the canvas overlay: if the room doc arrived but the
  // canvas data is slow, the label breathes instead of freezing.
  const canvasLoadCopy = useLongLoad(
    canvas === undefined,
    ['Preparing your canvas…', 'Still syncing your room…', 'Almost there…'],
    4000
  );

  useEffect(() => () => store.dispose(), [store]);

  // Keep the tldraw editor's color scheme in lockstep with the app theme so
  // the canvas and its UI render on the same elevation system as everything else.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) editor.setColorMode(theme === 'dark' ? 'dark' : 'light');
  }, [theme, editorState]);

  // Hydrate the store from canonical data and reconcile remote document
  // changes whenever the canvas version bumps. Our own pushes come back with
  // matching record JSON, so the reconcile is a no-op (no echo).
  //
  // Only user-deletable records (shapes, assets, bindings) are ever removed.
  // Structural records — document, page, user — are created by tldraw itself
  // with stable ids (e.g. page:page) on every client, so removing them would
  // churn against tldraw's own integrity checks.
  useEffect(() => {
    if (!canvas) return;
    if (canvas.canvasVersion <= loadedVersion.current) return;
    loadedVersion.current = canvas.canvasVersion;
    if (!canvas.canvasData || canvas.canvasData === '') return;
    const canonical = parseCanonicalRecords(canvas.canvasData, store);
    const local = store.serialize('document');
    const pending = pendingDiff.current;
    const put: Record<string, TLRecord> = {};
    const remove: string[] = [];
    for (const [id, record] of Object.entries(canonical)) {
      if (pending.put[id]) continue;
      if (pending.remove.has(id)) continue;
      const existing = local[id as keyof typeof local];
      if (!existing || JSON.stringify(existing) !== JSON.stringify(record)) put[id] = record;
    }
    const REMOVABLE_TYPES = new Set(['shape', 'asset', 'binding']);
    for (const id of Object.keys(local)) {
      const rec = local[id as keyof typeof local];
      if (!rec || !REMOVABLE_TYPES.has(rec.typeName)) continue;
      if (!canonical[id] && !pending.put[id]) remove.push(id);
    }
    if (Object.keys(put).length === 0 && remove.length === 0) return;
    store.mergeRemoteChanges(() => {
      store.put(Object.values(put));
      store.remove(remove as Parameters<typeof store.remove>[0]);
    });
  }, [store, canvas]);

  // The overlay's fade begins as soon as the canvas query resolves (the
  // hydrate effect above has already run in the same commit), and the overlay
  // unmounts after the cross-fade completes.
  useEffect(() => {
    if (canvas === undefined) return;
    const t = window.setTimeout(() => setShowCanvasOverlay(false), 520);
    return () => window.clearTimeout(t);
  }, [canvas]);

  // Push accumulated local document edits as a diff to Convex. Only the records
  // actually sent are cleared afterwards, so edits landing mid-flight survive.
  // flushRef lets the callback re-invoke itself for left-over records without
  // the self-referencing const lint trap.
  const flushRef = useRef<() => Promise<void>>(async () => undefined);
  const flush = useCallback(async () => {
    if (!roomIdArg) return;
    if (room?.userRole === 'viewer') return;
    const diff = pendingDiff.current;
    if (Object.keys(diff.put).length === 0 && diff.remove.size === 0) return;
    const sent = {
      put: { ...diff.put },
      remove: Array.from(diff.remove),
    };
    const changes = JSON.stringify(sent);
    setSaveStatus('saving');
    try {
      await applyCanvasChanges({ roomId: roomIdArg, changes });
      for (const id of Object.keys(sent.put)) {
        if (diff.put[id] && JSON.stringify(diff.put[id]) === JSON.stringify(sent.put[id])) {
          delete diff.put[id];
        }
      }
      for (const id of sent.remove) {
        if (diff.remove.has(id)) diff.remove.delete(id);
      }
      setIsConnected(true);
      savedAt.current = Date.now();
      setSaveStatus('saved');
      if (Object.keys(diff.put).length > 0 || diff.remove.size > 0) {
        if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => void flushRef.current(), 300);
      }
    } catch {
      setIsConnected(false);
      setSaveStatus('offline');
    }
  }, [roomIdArg, room?.userRole, applyCanvasChanges]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // Accumulate local document edits (source 'user', scope 'document') and
  // debounce-push them. Remote reconciles never match these filters, so there
  // is no write-back loop.
  useEffect(() => {
    if (!roomIdArg) return;
    const unlisten = store.listen(
      (entry) => {
        if (room?.userRole === 'viewer') return;
        // First local edit: seed the room's structural baseline (document +
        // page records) into the push so the canonical state carries the page
        // structure for anyone who joins later.
        if (!baselineSeeded.current) {
          baselineSeeded.current = true;
          const baseline = store.serialize('document');
          for (const [id, rec] of Object.entries(baseline)) {
            if (rec.typeName === 'document' || rec.typeName === 'page') {
              pendingDiff.current.put[id] = rec;
            }
          }
        }
        const { added, updated, removed } = entry.changes;
        const addedMap = added as Record<string, TLRecord>;
        const updatedMap = updated as Record<string, [TLRecord, TLRecord]>;
        for (const id of Object.keys(addedMap)) {
          pendingDiff.current.put[id] = addedMap[id];
        }
        for (const id of Object.keys(updatedMap)) {
          pendingDiff.current.put[id] = updatedMap[id][1];
        }
        for (const id of Object.keys(removed)) {
          pendingDiff.current.remove.add(id);
          delete pendingDiff.current.put[id];
        }
        dirtySinceSnapshot.current = true;
        if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => void flushRef.current(), 800);
      },
      { source: 'user', scope: 'document' }
    );
    return () => {
      unlisten();
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [store, roomIdArg, room?.userRole, flush]);

  // Retry pending changes when the network comes back.
  useEffect(() => {
    const onOnline = () => {
      setIsConnected(true);
      void flush();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flush]);

  // Fade the "Saved" pill back to idle after a moment.
  useEffect(() => {
    if (saveStatus !== 'saved') return;
    const t = window.setTimeout(() => setSaveStatus('idle'), 2000);
    return () => window.clearTimeout(t);
  }, [saveStatus]);

  // First-room flourish: when a brand-new room (no canvas data yet) opens,
  // a hand-drawn green ring draws itself in once — a quiet "this is yours"
  // beat, never again for this room.
  useEffect(() => {
    if (!roomIdArg || showRoomFlourish || !room || !canvas || canvas.canvasData) return;
    try {
      if (localStorage.getItem(`sketchroom.flourish.v1.${roomIdArg}`)) return;
      localStorage.setItem(`sketchroom.flourish.v1.${roomIdArg}`, '1');
    } catch {
      // ignore
    }
    const t = window.setTimeout(() => setShowRoomFlourish(true), 600);
    const t2 = window.setTimeout(() => setShowRoomFlourish(false), 2300);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [roomIdArg, room, canvas, showRoomFlourish]);

  // First-visit onboarding sketch: on an empty room, a pencil → note →
  // connector scene draws itself in once — a quiet "this is the loop" beat.
  // It waits for the flourish window to pass so the two moments sequence,
  // and is dismissed by the first real stroke (see the pointerdown listener
  // and the shape-count watcher below). Replaying it for the same room is
  // suppressed forever via localStorage.
  useEffect(() => {
    if (!roomIdArg || showOnboarding || isReadOnly || !room || !canvas || canvas.canvasData) return;
    try {
      if (localStorage.getItem(`sketchroom.onboarding.v1.${roomIdArg}`)) return;
      localStorage.setItem(`sketchroom.onboarding.v1.${roomIdArg}`, '1');
    } catch {
      // ignore
    }
    const t = window.setTimeout(() => setShowOnboarding(true), 2450);
    return () => window.clearTimeout(t);
  }, [roomIdArg, room, canvas, isReadOnly, showOnboarding]);

  // Once the sketch has drawn itself in and its label has landed, the scene
  // hands off to the guided walkthrough: the canvas dims and the real tools
  // glow one at a time. Any stroke before then still retires the whole thing
  // (the start timer is cleaned up when showOnboarding flips false).
  useEffect(() => {
    if (!showOnboarding || walkthrough) return;
    const t = window.setTimeout(() => {
      setWalkthrough({ pencil: false, note: false, connector: false });
      armWalkthroughTool(0);
    }, 2700);
    return () => window.clearTimeout(t);
  }, [showOnboarding, walkthrough, armWalkthroughTool]);

  // Auto version snapshot: every 45s while there are unsaved-snapshot edits,
  // capture a version the user can restore from history.
  useEffect(() => {
    if (!roomIdArg) return;
    const tick = async () => {
      if (room?.userRole === 'viewer') return;
      if (snapInFlight.current || !dirtySinceSnapshot.current) return;
      const editor = editorRef.current;
      if (!editor) return;
      const data = JSON.stringify(store.serialize('document'));
      snapInFlight.current = true;
      try {
        await saveSnapshot({
          roomId: roomIdArg,
          canvasData: data,
          description: 'Autosaved',
        });
        dirtySinceSnapshot.current = false;
        setIsConnected(true);
        void captureThumbnail();
      } catch {
        setIsConnected(false);
      } finally {
        snapInFlight.current = false;
      }
    };
    const interval = window.setInterval(tick, 45000);
    const onBeforeUnload = () => {
      void flush();
      void tick();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [roomIdArg, saveSnapshot, store, room?.userRole, captureThumbnail, flush]);

  // Presence: ship cursor + camera + selection on pointer move and on an
  // interval, and periodically sweep stale cursors left by closed tabs.
  useEffect(() => {
    if (!roomIdArg || !room) return;
    const name =
      user?.name || user?.email || 'Unknown';
    const ship = (throttled: boolean) => {
      const now = Date.now();
      if (throttled && now - lastPresenceShip.current < 150) return;
      lastPresenceShip.current = now;
      const editor = editorRef.current;
      const camera = editor?.getCamera();
      const cursor = cursorRef.current;
      upsertPresence({
        roomId: roomIdArg,
        name,
        avatarUrl: user?.imageUrl ?? undefined,
        color: presenceColorFor(user?.id || name),
        camera:
          camera && canvasRef.current
            ? { x: camera.x, y: camera.y, zoom: camera.z }
            : undefined,
        cursorX: cursor?.x,
        cursorY: cursor?.y,
        selectedShapeIds: editor?.getSelectedShapeIds().map(String),
      }).catch(() => setIsConnected(false));
    };
    const handleMove = (e: PointerEvent) => {
      const editor = editorRef.current;
      if (editor) {
        const page = editor.screenToPage({ x: e.clientX, y: e.clientY });
        cursorRef.current = { x: page.x, y: page.y };
        ship(true);
      }
    };
    window.addEventListener('pointermove', handleMove);
    const onVisibility = () => {
      if (document.hidden) {
        void removePresence({ roomId: roomIdArg }).catch(() => undefined);
      } else {
        ship(false);
        void prunePresence({ roomId: roomIdArg }).catch(() => undefined);
      }
    };
    const onPageHide = () => {
      void removePresence({ roomId: roomIdArg }).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    const heartbeat = window.setInterval(() => ship(false), 4000);
    const sweep = window.setInterval(() => {
      if (Date.now() - lastPrune.current > 8000) {
        lastPrune.current = Date.now();
        void prunePresence({ roomId: roomIdArg }).catch(() => undefined);
      }
    }, 4000);
    ship(false);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.clearInterval(heartbeat);
      window.clearInterval(sweep);
    };
  }, [roomIdArg, room, user, upsertPresence, prunePresence, removePresence]);

  // Track shape count, camera zoom, and the active tool for the rail.
  // Selection changes don't fire pointer moves, so push a presence update
  // when the selected set changes so others see the live focus ring.
  useEffect(() => {
    if (!editorState) return;
    const update = () => {
      const shapes = editorState.getCurrentPageShapes();
      // First real stroke (or a dropped block) retires the onboarding sketch.
      if (shapes.length > 0) setShowOnboarding(false);
      // Guided walkthrough: a real pencil stroke, sticky note, and connector
      // each check their step off; an unguided action (a block, text, a geo
      // shape) means the user is already working independently, so the guide
      // quietly steps aside instead of nagging.
      if (walkthrough) {
        const types = new Set(shapes.map((s) => s.type));
        const guided = {
          pencil: walkthrough.pencil || types.has('draw'),
          note: walkthrough.note || types.has('note'),
          connector: walkthrough.connector || types.has('arrow'),
        };
        const allDone = guided.pencil && guided.note && guided.connector;
        const unguided = [...types].some((t) => t !== 'draw' && t !== 'note' && t !== 'arrow');
        if (unguided && !allDone) {
          dismissWalkthrough();
        } else if (allDone) {
          // Only announce completion once: a fresh object every store tick
          // would keep resetting the done-beat timer below.
          if (!walkthrough.pencil || !walkthrough.note || !walkthrough.connector) {
            setWalkthrough({ pencil: true, note: true, connector: true });
          }
        } else if (
          guided.pencil !== walkthrough.pencil ||
          guided.note !== walkthrough.note ||
          guided.connector !== walkthrough.connector
        ) {
          setWalkthrough(guided);
          armWalkthroughTool(!guided.pencil ? 0 : !guided.note ? 1 : 2);
        }
      }
      setShapeCount(shapes.length);
      setSelectionCount(editorState.getSelectedShapeIds().length);
      setZoom(editorState.getCamera().z);
      const undoable = editorState.getCanUndo();
      const redoable = editorState.getCanRedo();
      setCanUndo(undoable);
      setCanRedo(redoable);
      // Undo/redo depth for the notch's history gauge. tldraw's history
      // manager is protected in the types but a live public field — probe it
      // through a typed view so the gauge is proportional, not a boolean.
      const history = (
        editorState as unknown as {
          history?: { getNumUndos(): number; getNumRedos(): number };
        }
      ).history;
      setUndoDepth(Math.min(history?.getNumUndos?.() ?? (undoable ? 1 : 0), 10));
      setRedoDepth(Math.min(history?.getNumRedos?.() ?? (redoable ? 1 : 0), 10));
      const toolId = editorState.getCurrentToolId();
      const mapped: Record<string, string> = {
        select: 'select',
        draw: 'draw',
        note: 'sticky',
        text: 'text',
        arrow: 'connector',
        eraser: 'eraser',
        geo: 'shapes',
      };
      setActiveTool((current) => mapped[toolId] ?? current);
      const selection = editorState.getSelectedShapeIds().join(',');
      if (selection !== lastSelection.current && roomIdArg && room) {
        lastSelection.current = selection;
        const displayName =
          user?.name ||
          user?.email ||
          'Unknown';
        // Send the full presence payload so the selection change never clears
        // the cursor/camera fields this user already shipped.
        const camera = editorState.getCamera();
        const cursor = cursorRef.current;
        void upsertPresence({
          roomId: roomIdArg,
          name: displayName,
          avatarUrl: user?.imageUrl ?? undefined,
          color: presenceColorFor(user?.id || displayName),
          camera: { x: camera.x, y: camera.y, zoom: camera.z },
          cursorX: cursor?.x,
          cursorY: cursor?.y,
          selectedShapeIds: editorState.getSelectedShapeIds().map(String),
        }).catch(() => undefined);
      }
    };
    update();
    const unlisten = editorState.store.listen(update);
    return () => unlisten();
  }, [editorState, roomIdArg, room, user, upsertPresence, isReadOnly, walkthrough, dismissWalkthrough, armWalkthroughTool]);

  // Remove presence on unmount
  useEffect(() => {
    if (!roomIdArg) return;
    return () => {
      removePresence({ roomId: roomIdArg }).catch(() => undefined);
    };
  }, [roomIdArg, removePresence]);

  const togglePanel = (panel: Exclude<Panel, null>) => {
    if (activePanel !== panel) closeAiFeed();
    setActivePanel((current) => (current === panel ? null : panel));
    setCanvasTouched(true);
  };

  // Open the AI panel while honoring one-panel-at-a-time: any floating panel
  // (history / blocks) closes first. `ai.openFeed` is a stable callback, so
  // this handler is safe to list in effect deps.
  const openAi = useCallback(() => {
    setActivePanel(null);
    setCanvasTouched(true);
    openFeed();
  }, [openFeed]);

  const setTool = useCallback(
    (id: string) => {
      if (isReadOnly) return;
      const cfg = TOOL_BY_ID[id];
      if (!cfg) return;
      const editor = editorRef.current;
      if (editor) editor.setCurrentTool(cfg.tool);
      setActiveTool(id);
      setCanvasTouched(true);
    },
    [isReadOnly]
  );

  // The completed beat reads for a moment, then the guide fades away.
  useEffect(() => {
    if (!walkthrough || !walkthrough.pencil || !walkthrough.note || !walkthrough.connector) return;
    const t = window.setTimeout(() => dismissWalkthrough(), 1400);
    return () => window.clearTimeout(t);
  }, [walkthrough, dismissWalkthrough]);

  // Tool options live on one fixed surface — the right-side rail. The
  // bottom-center area belongs to the AI chat alone. The rail yields while
  // the AI chat is open or a side panel is up (one right-side surface at a
  // time).
  const toolHasOptions =
    !isReadOnly &&
    TOOL_OPTIONS_TOOLS.has(activeTool) &&
    (activeTool !== 'select' || selectionCount > 0);
  const showOptionsRail = toolHasOptions && activePanel === null && !aiPanelOpen;

  const zoomRef = useRef<HTMLDivElement | null>(null);
  const toolRailRef = useRef<HTMLDivElement | null>(null);
  const aiBarRef = useRef<HTMLDivElement | null>(null);
  const blockBtnRef = useRef<HTMLButtonElement | null>(null);
  const shareBtnRef = useRef<HTMLButtonElement | null>(null);
  const moreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [moreMenuOpen]);

  useEffect(() => {
    if (!zoomMenuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (zoomRef.current && !zoomRef.current.contains(e.target as Node)) {
        setZoomMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [zoomMenuOpen]);

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable === true ||
        (target?.getAttribute('role') === 'textbox') ||
        (target?.getAttribute('contenteditable') === 'true');
      const isMod = e.metaKey || e.ctrlKey;
      // Global canvas shortcuts are inert while the user is typing so Escape
      // doesn't hijack editor inputs, but Cmd/Ctrl+S still saves and
      // Cmd/Ctrl+E still opens export (standard app behavior).
      if (isTyping) {
        if (isMod && (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'e')) {
          // fall through to mod-key handling below
        } else {
          return;
        }
      }
      if (isMod) {
        if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          if (isReadOnly) return;
          const editor = editorRef.current;
          if (editor && roomIdArg) {
            try {
              await flush();
              const data = JSON.stringify(store.serialize('document'));
              await saveSnapshot({ roomId: roomIdArg, canvasData: data, description: 'Manual save' });
              dirtySinceSnapshot.current = false;
              setIsConnected(true);
              void captureThumbnail();
            } catch {
              setIsConnected(false);
            }
          }
        }
        if (e.key.toLowerCase() === 'e') {
          e.preventDefault();
          setShowExport(true);
        }
        if (e.key.toLowerCase() === 'k') {
          e.preventDefault();
          if (!isReadOnly) {
            openAi();
            requestAnimationFrame(() => aiInputRef.current?.focus());
          }
        }
        return;
      }
      if (e.key.toLowerCase() === 'f' && e.shiftKey) {
        // ⇧F — fit view. The shortcuts modal claims this; make it true.
        e.preventDefault();
        editorRef.current?.zoomToFit({ animation: { duration: 200 } });
        return;
      }
      if (e.key.toLowerCase() === 'f' && !e.shiftKey && !isMod) {
        // F — focus mode. Only enters with a selection (a hole to punch).
        e.preventDefault();
        const has = (editorRef.current?.getSelectedShapeIds().length ?? 0) > 0;
        if (has) setFocusMode((f) => !f);
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }
      if (e.key === 'Escape') {
        setZoomMenuOpen(false);
        setMoreMenuOpen(false);
        setActivePanel(null);
        setShowShortcuts(false);
        setShowShare(false);
        setShowExport(false);
        setFocusMode(false);
        dismissWalkthrough();
        closeAiFeed();
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveSnapshot, roomIdArg, store, setTool, isReadOnly, captureThumbnail, flush, closeAiFeed, openAi, dismissWalkthrough]);

  // Focus mode is only meaningful while something is selected: the dim hides
  // the moment the selection empties (derived, not an effect), and quietly
  // resumes if you select again — intent stays armed, nothing lingers.
  const effectiveFocus = focusMode && selectionCount > 0;

  const saveRoomName = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !roomIdArg) return;
    try {
      await updateRoomName({ roomId: roomIdArg, name: trimmed });
    } catch {
      setIsConnected(false);
    }
  };

  // room is undefined while loading (or when the query is skipped); null
  // means the room was loaded and genuinely does not exist / no access.
  if (room === undefined) {
    if (!roomIdArg) {
      navigate('/error', { replace: true, state: { message: 'This room link is invalid.' } });
      return null;
    }
    return <RoomCanvasBoot />;
  }

  if (room === null) {
    navigate('/error', { replace: true, state: { message: 'This room is not available.' } });
    return null;
  }

  const userRole = room.userRole;

  // One computed save/sync status instead of competing pill variants.
  const statusPill =
    !isConnected && saveStatus !== 'offline'
      ? { tone: 'warn', label: 'Reconnecting…' }
      : saveStatus === 'offline'
        ? { tone: 'danger', label: 'Offline — changes will sync' }
        : saveStatus === 'saving'
          ? { tone: 'neutral', label: 'Saving…' }
          : saveStatus === 'saved'
            ? { tone: 'ok', label: 'Saved' }
            : null;

  const presenceList = presence || [];
  const railActiveIndex =
    activePanel === 'blocks'
      ? RAIL_TOOL_IDS.length
      : activeTool === 'eraser'
        ? -1
        : RAIL_TOOL_IDS.indexOf(activeTool);
  // Exact indicator offsets in rail-space (rail padding 6 + 42px per tool
  // slot; the divider is its own 42px slot before the block-library trigger).
  const RAIL_INDICATOR_OFFSETS = [0, 42, 84, 126, 168, 210, 294];

  return (
    <div className={`room-screen${effectiveFocus ? ' focusing' : ''}${wtActive && wtStep < 3 ? ' walkthrough' : ''}`}>
      <div className="room-topbar glass">
        {/* Left zone: back + room name. The name sits on its own canvas-sized
            footprint (clamped width) so the center zone — not a void — fills
            the topbar between it and the actions. */}
        <div className="room-topbar-left">
          <button className="room-back-btn" onClick={() => navigate('/dashboard')} aria-label="Back to dashboard">
            <ArrowLeft size={18} />
          </button>
          <div className="room-name-wrap">
            <input
              className="room-name-input"
              defaultValue={room.name}
              aria-label="Room name"
              readOnly={userRole === 'viewer'}
              onBlur={(e) => saveRoomName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
              }}
            />
            {!isReadOnly && (
              <span className="room-name-pencil" aria-hidden="true">
                <Pencil size={13} />
              </span>
            )}
          </div>
        </div>

        {/* Center zone — the room pulse: save/connection status + live
            presence live in the free flex space. They appear and change
            without ever shifting the right-side actions, because this zone
            absorbs layout instead of pushing it. */}
        <div className="room-topbar-center">
          {statusPill && (
            /* key=saveStatus remounts the pill on every state change so the
               entrance spring and the Saved checkmark re-draw each time — the
               confirmation is a tiny flourish, not just a text swap. */
            <span key={saveStatus} className={`room-status-pill room-status-${statusPill.tone}`}>
              {statusPill.tone === 'ok' ? (
                <svg className="room-status-check" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path pathLength={1} d="M2.5 6.2 4.9 8.6 9.5 3.6" />
                </svg>
              ) : (
                <span className="room-status-dot" />
              )}
              {statusPill.label}
            </span>
          )}
          {presenceList.length > 0 ? (
            <div className="room-presence-avatars">
              {presenceList.slice(0, 5).map((p) => (
                <span key={p.userId} className="room-presence-avatar" title={p.name}>
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt={p.name} />
                  ) : (
                    <span>{p.name.charAt(0).toUpperCase()}</span>
                  )}
                </span>
              ))}
              {presenceList.length > 5 && (
                <span
                  className="room-presence-avatar room-presence-more"
                  title={`${presenceList.length - 5} more`}
                >
                  +{presenceList.length - 5}
                </span>
              )}
            </div>
          ) : (
            /* Working solo: a quiet, non-alarming absence of presence UI —
               not an empty-state moment, just a muted note that no one else
               is here right now. */
            <span className="room-presence-solo" role="note">
              <User size={12} />
              Just you
            </span>
          )}
        </div>

        <div className="room-topbar-right">
          <button className="room-icon-btn room-topbar-hideable" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick={() => setShowShortcuts(true)}>
            <HelpCircle size={18} />
          </button>
          <button className={`room-icon-btn ${activePanel === 'history' ? 'active' : ''}`} title="Version history" aria-label="Version history" onClick={() => togglePanel('history')}>
            <History size={18} />
          </button>
          <button className="room-icon-btn room-topbar-hideable" title="Export" aria-label="Export" onClick={() => setShowExport(true)}>
            <Download size={18} />
          </button>
          {!isReadOnly && (
            <button ref={shareBtnRef} className="room-share-btn" onClick={() => setShowShare(true)}>
              Share
            </button>
          )}
          <div className="room-topbar-more" ref={moreRef}>
            <button
              className="room-icon-btn room-topbar-more-btn"
              title="More actions"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={moreMenuOpen}
              onClick={() => setMoreMenuOpen((o) => !o)}
            >
              <MoreHorizontal size={18} />
            </button>
            {moreMenuOpen && (
              <div className="room-more-menu glass" role="menu" aria-label="More actions">
                <button
                  role="menuitem"
                  onClick={() => {
                    setShowShortcuts(true);
                    setMoreMenuOpen(false);
                  }}
                >
                  <HelpCircle size={14} />
                  Keyboard shortcuts
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setShowExport(true);
                    setMoreMenuOpen(false);
                  }}
                >
                  <Download size={14} />
                  Export
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="room-stage">
          <div className="room-canvas" ref={canvasRef}>
            {shapeCount === 0 && !canvasTouched && (
              <div className="room-empty-hero">
                {/* The canvas's empty state is a hand-drawn scene from the
                    same family as every other empty state — a pencil meeting
                    a note, drawing itself in — not a floating stock icon. */}
                <div className="room-empty-illo" aria-hidden="true">
                  <CanvasEmptyIllo />
                </div>
                <DrawnTitle as="h2" className="room-empty-title" delay={800}>
                  A blank canvas, yours to fill
                </DrawnTitle>
                <p className="room-empty-subtitle">
                  Sketch on the canvas, drop blocks from the library, or ask the AI copilot
                  to draft a first pass for you.
                </p>
                {!isReadOnly && (
                  <div className="room-empty-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        openAi();
                        requestAnimationFrame(() => aiInputRef.current?.focus());
                      }}
                    >
                      <Sparkles size={16} />
                      Ask the AI
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => togglePanel('blocks')}
                    >
                      <Blocks size={16} />
                      Browse blocks
                    </button>
                  </div>
                )}
              </div>
            )}

            {canvasTouched && shapeCount === 0 && activeTool !== 'select' && !isReadOnly && (
              <div className="room-first-stroke" aria-hidden="true">
                <span className="room-first-stroke-ring" />
                <span className="room-first-stroke-label">Click anywhere to start</span>
              </div>
            )}

            {/* First-room flourish: a one-time green draw-on "your room is
                live" beat for brand-new rooms. Restrained — a ring and a
                sparkle, drawn in, then gone. */}
            {showRoomFlourish && (
              <div className="room-flourish" aria-hidden="true">
                <svg viewBox="0 0 120 120" fill="none">
                  <circle className="room-flourish-ring" cx="60" cy="60" r="36" />
                  <path
                    className="room-flourish-star"
                    pathLength={1}
                    d="M60 36 l4.6 13.4 13.4 4.6 -13.4 4.6 -4.6 13.4 -4.6 -13.4 -13.4 -4.6 13.4 -4.6 z"
                  />
                </svg>
                <p className="room-flourish-label">Your room is live</p>
              </div>
            )}

            {/* Blur-up canvas loading: the room's last-known thumbnail (if
                any) stands in, blurred, while the real canvas hydrates
                underneath — then the whole surface cross-fades away. Never a
                blank rectangle: you always see something meaningful within
                milliseconds. */}
            {showCanvasOverlay && (
              <div
                className={`room-canvas-loading${canvas === undefined ? '' : ' leaving'}`}
                role="status"
                aria-label="Loading canvas"
              >
                {room.thumbnailData ? (
                  <img className="room-canvas-loading-thumb" src={room.thumbnailData} alt="" />
                ) : (
                  <div className="room-canvas-loading-grid" aria-hidden="true" />
                )}
                <div className="room-canvas-loading-center">
                  <LoaderMark size={46} />
                  <p className="room-canvas-loading-label">{canvasLoadCopy.phrase}</p>
                </div>
              </div>
            )}

            {/* Coachmarks only run in the pristine select state: switching to a
                drawing tool would otherwise stack the sub-tool pill over the
                AI-bar callout. */}
            {!isReadOnly && !aiPanelOpen && activeTool === 'select' && (
              <RoomCoachmarks railRef={toolRailRef} aiRef={aiBarRef} shareRef={shareBtnRef} />
            )}
            <Tldraw
              store={store}
              components={{
                Toolbar: null,
                ZoomMenu: null,
                PageMenu: null,
                QuickActions: null,
                // The room ships its own chrome: the tool rail, zoom cluster,
                // ToolOptions styling pill, and shortcuts modal replace all of
                // tldraw's default UI. These leftover surfaces (style panel,
                // main menu, minimap toggle) rendered on top of the app's
                // floating panels — tldraw's internal UI sits at z-index 300,
                // above every --room-z-* token — so they stole clicks meant
                // for Block Library / Version History at narrow widths.
                StylePanel: null,
                MainMenu: null,
                NavigationPanel: null,
                HelpMenu: null,
              }}
              onMount={(editor) => {
                editorRef.current = editor;
                setEditorState(editor);
                editor.updateInstanceState({ isReadonly: isReadOnly, isGridMode: true });
                setUserPreferences({
                  id: user?.id || 'user',
                  name: user?.name || 'Unknown',
                  color: presenceColorFor(user?.id || 'user'),
                });
                editor.getContainer().addEventListener(
                  'pointerdown',
                  () => {
                    setCanvasTouched(true);
                    // The first press on the canvas is the signal: the
                    // onboarding sketch steps aside for real work.
                    setShowOnboarding(false);
                  },
                  { once: false }
                );
              }}
              className="room-tldraw"
            />

            <ViewportAwareness editor={editorState} presence={presence || []} />
            <PresenceCursors editor={editorState} presence={presence || []} />
            <SelectionAwareness editor={editorState} presence={presence || []} />
            <PlacementPulses editor={editorState} />
            <FocusDim editor={editorState} active={effectiveFocus} />
            <FocusHint active={effectiveFocus} />

            {!isReadOnly && activePanel === 'blocks' && (
              <BlockLibrary editor={editorState} onClose={() => setActivePanel(null)} anchorRef={blockBtnRef} />
            )}

            {activePanel === 'history' && (
              <VersionHistory roomId={roomIdArg as Id<'rooms'>} editor={editorState} onClose={() => setActivePanel(null)} />
            )}
          </div>

        {showOnboarding && shapeCount === 0 && !canvasTouched && !isReadOnly && (
          <div className="room-onboarding" aria-hidden="true">
            <CanvasOnboardingSketch />
            <span className="room-onboarding-label">Sketch · note · connect</span>
          </div>
        )}

        {wtActive && (
          <div className={`room-walkthrough${wtClosing ? ' closing' : ''}`} role="region" aria-label="Guided walkthrough">
            <div className="room-wt-dim" aria-hidden="true" />
            <div className="room-wt-card glass">
              <span className="room-wt-step">{wtStep >= 3 ? 'Done' : `Step ${wtStep + 1} of 3`}</span>
              <p className="room-wt-copy">{WT_COPY[wtStep]}</p>
              <button type="button" className="room-wt-skip" onClick={dismissWalkthrough}>
                Skip guide
              </button>
            </div>
          </div>
        )}

        <div className="room-bottom-stack">
          <AiFeed
            copilot={ai}
            roomId={roomIdArg as Id<'rooms'>}
            editor={editorState}
            readOnly={isReadOnly}
            inputRef={aiInputRef}
            barRef={aiBarRef}
            unviewed={hasUnviewed}
          />
        </div>

        <nav
          className="room-tool-rail glass"
          ref={toolRailRef}
          role="toolbar"
          aria-label="Canvas tools"
          onPointerDownCapture={() => setCanvasTouched(true)}
        >
          {/* Spring-loaded active-tool indicator: slides behind the active
              icon instead of a static fill. The block library occupies the
              slot after the divider. */}
          <span
            className="room-rail-indicator"
            aria-hidden="true"
            style={railActiveIndex >= 0 ? { transform: `translateY(${RAIL_INDICATOR_OFFSETS[railActiveIndex]}px)` } : undefined}
          />
          {RAIL_TOOL_IDS.map((id) => {
            const cfg = TOOL_BY_ID[id];
            const Icon = TOOL_ICONS[id];
            return (
              <button
                key={id}
                className={`room-rail-tool ${activeTool === id ? 'active' : ''}${wtActive && wtStep < 3 && WT_STEP_IDS[wtStep] === id ? ' wt-target' : ''}`}
                onClick={() => setTool(id)}
                data-hint={toolTitle(cfg)}
                aria-label={toolTitle(cfg)}
                disabled={isReadOnly}
              >
                <Icon size={18} />
              </button>
            );
          })}

          <div className="room-rail-divider" aria-hidden="true" />

          <button
            ref={blockBtnRef}
            className={`room-rail-tool ${activePanel === 'blocks' ? 'active' : ''}`}
            onClick={() => togglePanel('blocks')}
            data-hint="Block library"
            aria-label="Block library"
            disabled={isReadOnly}
          >
            <Blocks size={18} />
          </button>
        </nav>

        {/* Top-right controls: undo/redo and zoom joined in one glass pill —
            every navigation action in a single, predictable place. The depth
            gauge rides the pill's bottom edge (undo fills left, redo right). */}
        <div
          className="room-controls glass"
          ref={zoomRef}
          role="group"
          aria-label="History and zoom controls"
          onPointerDownCapture={() => setCanvasTouched(true)}
        >
          {!isReadOnly && (
            <>
              <button
                className="room-icon-btn room-controls-btn"
                onClick={() => editorRef.current?.undo()}
                disabled={!canUndo}
                title="Undo (⌘Z)"
                aria-label="Undo"
              >
                <Undo2 size={18} />
              </button>
              <button
                className="room-icon-btn room-controls-btn"
                onClick={() => editorRef.current?.redo()}
                disabled={!canRedo}
                title="Redo (⇧⌘Z)"
                aria-label="Redo"
              >
                <Redo2 size={18} />
              </button>
              <span className="room-controls-divider" aria-hidden="true" />
            </>
          )}
          <button
            className="room-icon-btn room-controls-btn"
            onClick={() => editorRef.current?.zoomOut()}
            title="Zoom out (⌘−)"
            aria-label="Zoom out"
          >
            <ZoomOut size={15} />
          </button>
          <button
            className="room-controls-pct"
            title={`Zoom ${Math.round(zoom * 100)}%`}
            aria-haspopup="menu"
            aria-expanded={zoomMenuOpen}
            onClick={() => setZoomMenuOpen((o) => !o)}
          >
            <span>{Math.round(zoom * 100)}%</span>
          </button>
          <button
            className="room-icon-btn room-controls-btn"
            onClick={() => editorRef.current?.zoomIn()}
            title="Zoom in (⌘+)"
            aria-label="Zoom in"
          >
            <ZoomIn size={15} />
          </button>
          <span
            className="room-controls-depth"
            role="presentation"
            title={`${undoDepth} undo step${undoDepth === 1 ? '' : 's'} · ${redoDepth} redo step${redoDepth === 1 ? '' : 's'}`}
          >
            <span className="room-controls-depth-undo" style={{ width: `${(undoDepth / 10) * 100}%` }} />
            <span className="room-controls-depth-redo" style={{ width: `${(redoDepth / 10) * 100}%` }} />
          </span>
          {zoomMenuOpen && (
            <div className="room-zoom-menu glass" role="menu" aria-label="Zoom options">
              <button
                role="menuitem"
                onClick={() => {
                  editorRef.current?.zoomToFit({ animation: { duration: 200 } });
                  setZoomMenuOpen(false);
                }}
              >
                <Maximize size={14} />
                Fit view
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  editorRef.current?.setCamera({ x: 0, y: 0, z: 1 }, { animation: { duration: 200 } });
                  setZoomMenuOpen(false);
                }}
              >
                <span className="room-zoom-menu-pct">100%</span>
                Reset zoom
              </button>
            </div>
          )}
        </div>

        {showOptionsRail && (
          <ToolOptionsRail
            key={activeTool}
            editor={editorState}
            tool={activeTool}
            mode={styleMode}
            onModeChange={setStyleMode}
          />
        )}
      </div>

      {showShortcuts && (
        <div
          className="room-shortcuts-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          ref={shortcutsRef}
        >
          <div className="room-shortcuts-card glass-dense">
            <header className="room-shortcuts-header">
              <h2 className="room-shortcuts-title">Keyboard shortcuts</h2>
              <button
                className="room-shortcuts-close"
                onClick={() => setShowShortcuts(false)}
                aria-label="Close shortcuts"
              >
                <X size={18} />
              </button>
            </header>
            <div className="room-shortcuts-body">
              <div className="room-shortcuts-group">
                <h3 className="room-shortcuts-group-title">Tools</h3>
                {['V Select', 'D Draw', 'N Sticky note', 'T Text', 'A Arrow', 'R Shapes', 'E Eraser'].map((row) => {
                  const [k, ...label] = row.split(' ');
                  return (
                    <div key={row} className="room-shortcuts-row">
                      <span className="room-shortcuts-label">{label.join(' ')}</span>
                      <kbd className="room-shortcuts-key">{k}</kbd>
                    </div>
                  );
                })}
              </div>
              <div className="room-shortcuts-group">
                <h3 className="room-shortcuts-group-title">Canvas</h3>
                <div className="room-shortcuts-row">
                  <span className="room-shortcuts-label">Undo / Redo</span>
                  <span className="room-shortcuts-keys"><kbd>⌘Z</kbd><kbd>⇧⌘Z</kbd></span>
                </div>
                <div className="room-shortcuts-row">
                  <span className="room-shortcuts-label">Zoom in / out</span>
                  <span className="room-shortcuts-keys"><kbd>⌘+</kbd><kbd>⌘−</kbd></span>
                </div>
                <div className="room-shortcuts-row">
                  <span className="room-shortcuts-label">Fit view</span>
                  <span className="room-shortcuts-keys"><kbd>⇧F</kbd></span>
                </div>
              </div>
              <div className="room-shortcuts-group">
                <h3 className="room-shortcuts-group-title">AI</h3>
                <div className="room-shortcuts-row">
                  <span className="room-shortcuts-label">Focus AI input</span>
                  <span className="room-shortcuts-keys"><kbd>⌘K</kbd></span>
                </div>
                <div className="room-shortcuts-row">
                  <span className="room-shortcuts-label">Send prompt</span>
                  <span className="room-shortcuts-keys"><kbd>Enter</kbd></span>
                </div>
              </div>
              <div className="room-shortcuts-group">
                <h3 className="room-shortcuts-group-title">Room</h3>
                <div className="room-shortcuts-row">
                  <span className="room-shortcuts-label">Save snapshot</span>
                  <span className="room-shortcuts-keys"><kbd>⌘S</kbd></span>
                </div>
                <div className="room-shortcuts-row">
                  <span className="room-shortcuts-label">Export</span>
                  <span className="room-shortcuts-keys"><kbd>⌘E</kbd></span>
                </div>
                <div className="room-shortcuts-row">
                  <span className="room-shortcuts-label">Close panel / menus</span>
                  <span className="room-shortcuts-keys"><kbd>Esc</kbd></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showShare && (
        <ShareModal roomId={roomIdArg as Id<'rooms'>} onClose={() => setShowShare(false)} />
      )}
      {showExport && (
        <Suspense fallback={null}>
          <ExportDialog editor={editorState} onClose={() => setShowExport(false)} />
        </Suspense>
      )}
    </div>
  );
}

// First-load boot for the room: the brand sketch-in loader (star draw-on +
// wordmark) with honest long-load copy, and — never a dead end — a calm
// retry path if the room itself can't be reached within a reasonable window.
function RoomCanvasBoot() {
  const { phrase } = useLongLoad(
    true,
    ['Opening your room…', 'Warming up the canvas…', 'Still syncing…'],
    4000
  );
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setGaveUp(true), 15000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="loading-screen room-boot" role="status" aria-label="Opening room">
      <LoaderMark size={62} />
      <LoaderWordmark />
      {gaveUp ? (
        <div className="room-boot-error" role="alert">
          <div aria-hidden="true">
            <ErrorIllo />
          </div>
          <DrawnTitle className="room-boot-error-title" delay={700}>
            Can't reach this room
          </DrawnTitle>
          <p className="room-boot-error-sub">Check your connection and give it another try.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      ) : (
        <p className="loader-label">{phrase}</p>
      )}
    </div>
  );
}

const COACHMARK_KEY = 'sketchroom.coachmarks.v1';

interface CoachmarkTarget {
  ref: RefObject<HTMLElement | null>;
  placement: 'right' | 'left' | 'below' | 'above';
  text: string;
}

// First-run coachmarks: three sequential single-line callouts (tool rail, AI
// bar, Share), shown once only, dismissible individually via the X / "Next"
// (advances), or wholesale via "Got it". Pills are neutral glass — never green,
// since they're informational rather than AI-driven.
function RoomCoachmarks({
  railRef,
  aiRef,
  shareRef,
}: {
  railRef: RefObject<HTMLElement | null>;
  aiRef: RefObject<HTMLElement | null>;
  shareRef: RefObject<HTMLElement | null>;
}) {
  const [step, setStep] = useState(() => {
    try {
      return localStorage.getItem(COACHMARK_KEY) === 'dismissed' ? -1 : 0;
    } catch {
      return 0;
    }
  });

  if (step < 0) return null;

  const finish = () => {
    setStep(-1);
    try {
      localStorage.setItem(COACHMARK_KEY, 'dismissed');
    } catch {
      // ignore
    }
  };
  const next = () => setStep((s) => (s >= 2 ? -1 : s + 1));

  const steps: CoachmarkTarget[] = [
    {
      ref: railRef,
      placement: 'right',
      text: 'Tools live on the left — select, draw, sticky notes, shapes, and the block library.',
    },
    {
      ref: aiRef,
      placement: 'above',
      text: 'The AI copilot lives here — ask it to draft, refine, or answer.',
    },
    {
      ref: shareRef,
      placement: 'below',
      text: 'Invite your team with Share.',
    },
  ];
  const current = steps[step];

  return (
    <CoachmarkPill
      targetRef={current.ref}
      placement={current.placement}
      text={current.text}
      last={step === steps.length - 1}
      onNext={next}
      onFinish={finish}
    />
  );
}

function CoachmarkPill({
  targetRef,
  placement,
  text,
  last,
  onNext,
  onFinish,
}: {
  targetRef: RefObject<HTMLElement | null>;
  placement: 'right' | 'left' | 'below' | 'above';
  text: string;
  last: boolean;
  onNext: () => void;
  onFinish: () => void;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const target = targetRef.current;
      const pill = pillRef.current;
      if (!target || !pill) return;
      const tr = target.getBoundingClientRect();
      const pw = pill.offsetWidth;
      const ph = pill.offsetHeight;
      if (!pw || !ph || tr.width === 0) return;
      let left: number;
      let top: number;
      if (placement === 'right') {
        left = tr.right + 12;
        top = tr.top + tr.height / 2 - ph / 2;
      } else if (placement === 'left') {
        left = tr.left - pw - 12;
        top = tr.top + tr.height / 2 - ph / 2;
      } else if (placement === 'above') {
        left = tr.left + tr.width / 2 - pw / 2;
        top = tr.top - ph - 12;
      } else {
        left = tr.left + tr.width / 2 - pw / 2;
        top = tr.bottom + 12;
      }
      left = Math.max(12, Math.min(left, window.innerWidth - pw - 12));
      top = Math.max(12, Math.min(top, window.innerHeight - ph - 12));
      setPos({ left, top });
    };
    place();
    const frame = requestAnimationFrame(place);
    const t1 = window.setTimeout(place, 200);
    const t2 = window.setTimeout(place, 800);
    const onResize = () => place();
    window.addEventListener('resize', onResize);
    const target = targetRef.current;
    let observer: ResizeObserver | null = null;
    if (target) {
      observer = new ResizeObserver(place);
      observer.observe(target);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [targetRef, placement]);

  return (
    <div
      ref={pillRef}
      className="room-coachmark glass"
      role="note"
      aria-label="Getting started"
      style={pos ? { left: pos.left, top: pos.top } : undefined}
    >
      <p className="room-coachmark-text">{text}</p>
      <div className="room-coachmark-actions">
        <button className="room-coachmark-done" onClick={onFinish}>
          Got it
        </button>
        {!last && (
          <button className="room-coachmark-next" onClick={onNext}>
            Next
          </button>
        )}
      </div>
      <button className="room-coachmark-x" onClick={onNext} aria-label={last ? 'Dismiss' : 'Next'}>
        <X size={14} />
      </button>
    </div>
  );
}