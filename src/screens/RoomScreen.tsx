import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useTheme } from '../lib/useTheme';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {
  CanvasSurface,
  emptyScene,
  parseScene,
  sceneThumbnail,
  serializeScene,
} from '../canvas';
import type { CanvasApi, CanvasTool, SceneDocument } from '../canvas';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { Blocks, History, Download, Sparkles, MousePointer2, PenTool, StickyNote, Type, Spline, Shapes, Eraser, ZoomIn, ZoomOut, Maximize, Undo2, Redo2, HelpCircle, X, ArrowLeft, Pencil, User, MoreHorizontal, MessageSquare, Volume2, VolumeX } from 'lucide-react';
import { playPop, toggleSound, isSoundEnabled } from '../utils/sound';
import { useLongLoad } from '../hooks/useLongLoad';
import { useModalFocus } from '../lib/useModalFocus';
import { usePageTitle } from '../lib/usePageTitle';
import { LoaderMark } from '../components/LoadingScreen';
import { CanvasEmptyIllo, DrawnTitle } from '../components/illustrations';
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
import { CommentPins } from '../components/CommentPins';
import { useAnnouncer } from '../components/LiveRegion';
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
import '../components/CommentPins.css';
import { OnboardingSketch } from '../room/OnboardingSketch';
import { RoomBoot } from '../room/RoomBoot';
import { RoomCoachmarks } from '../room/RoomCoachmarks';

// Presence is monochrome, so collaborators are separated by ink weight and by
// their name label rather than by hue. Six steps of the ramp, dark to light.
const PRESENCE_COLORS = ['#0A0A0A', '#2E2E2E', '#4A4A4A', '#6B6B6B', '#8F8F8F', '#B4B4B4'];

function presenceColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}

// A room's canvas is one self-describing document (`{ format, elements }`).
// `parseScene` accepts that, a bare Excalidraw file blob, or a legacy tldraw
// record map (converted once on read), and returns an empty scene rather than a
// crashed room for anything malformed.

type Panel = 'history' | 'blocks' | null;

const TOOL_BY_ID: Record<string, { tool: CanvasTool; hint: string; key?: string }> = {
  select: { tool: 'select', hint: 'Select', key: 'V' },
  draw: { tool: 'draw', hint: 'Draw', key: 'D' },
  sticky: { tool: 'sticky', hint: 'Sticky note', key: 'N' },
  text: { tool: 'text', hint: 'Text', key: 'T' },
  connector: { tool: 'connector', hint: 'Connector', key: 'A' },
  eraser: { tool: 'eraser', hint: 'Eraser', key: 'E' },
  shapes: { tool: 'shapes', hint: 'Shapes', key: 'R' },
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
  const [wtDismissed, setWtDismissed] = useState(false);
  const [wtClosing, setWtClosing] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [commentMode, setCommentMode] = useState(false);
  // Shared between the quick strip and the options rail so a pick in either
  // respects the same "Selection vs New shapes" mode.
  const [styleMode, setStyleMode] = useState<ToolStyleMode>('next');
  const aiInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimer = useRef<number | null>(null);
  const loadedVersion = useRef(-1);
  const dirtySinceSnapshot = useRef(false);
  const snapInFlight = useRef(false);
  const pendingDiff = useRef<{ put: Map<string, ExcalidrawElement>; remove: Set<string> }>({
    put: new Map(),
    remove: new Set(),
  });
  const savedAt = useRef(0);
  const apiRef = useRef<CanvasApi | null>(null);
  const [canvasApi, setCanvasApi] = useState<CanvasApi | null>(null);
  // Element JSON as last reconciled with the server: the diff baseline.
  const knownElements = useRef<Map<string, string>>(new Map());
  const latestElements = useRef<readonly ExcalidrawElement[]>([]);
  const diffTimer = useRef<number | null>(null);
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const lastPresenceShip = useRef(0);
  const lastSelection = useRef('');
  const lastPrune = useRef(0);

  // Screen reader announcer for dynamic updates
  const announce = useAnnouncer();

  const roomIdArg = roomId ? (roomId as Id<'rooms'>) : undefined;
  const room = useQuery(api.features.rooms.getRoom, roomIdArg ? { roomId: roomIdArg } : 'skip');

  // Redirect to error page when room is unavailable (not during render).
  useEffect(() => {
    if (room === null) {
      navigate('/error', { replace: true, state: { message: 'This room is not available.' } });
    } else if (room === undefined && roomIdArg === undefined && roomId) {
      navigate('/error', { replace: true, state: { message: 'This room link is invalid.' } });
    }
  }, [room, roomIdArg, roomId, navigate]);

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
    // Sticky: the auto-start effect below must not re-arm a guide the user
    // has already closed, or "Skip" would only postpone it by a few seconds.
    setWtDismissed(true);
    window.setTimeout(() => {
      setWalkthrough(null);
      setWtClosing(false);
    }, 380);
  }, []);

  usePageTitle(room?.name ? `${room.name} — Sketchroom` : 'Room — Sketchroom');
  const canvas = useQuery(api.features.canvas.loadCanvas, roomIdArg ? { roomId: roomIdArg } : 'skip');
  const presence = useQuery(api.features.presence.getPresence, roomIdArg ? { roomId: roomIdArg } : 'skip');
  const aiMessages = useQuery(api.features.ai.getAiMessages, roomIdArg ? { roomId: roomIdArg } : 'skip');

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
      apiRef.current?.setTool(cfg.tool);
      setActiveTool(id);
    },
    [isReadOnly],
  );

  const ai = useAiCopilot({ roomId: roomIdArg, api: canvasApi, readOnly: isReadOnly });
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

  // Announce new AI suggestions
  const lastAiMessageIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!aiMessages || aiMessages.length === 0) return;
    const latest = aiMessages[0];
    if (latest.status === 'completed' && latest._id !== lastAiMessageIdRef.current) {
      lastAiMessageIdRef.current = latest._id;
      if (latest.ghostBlocks) {
        announce('AI suggestion ready');
      }
    }
  }, [aiMessages, announce]);

  // Manage body class for mobile panel scroll lock
  useEffect(() => {
    const hasOpenPanel = activePanel !== null || aiPanelOpen;
    document.body.classList.toggle('has-open-panel', hasOpenPanel);
    return () => document.body.classList.remove('has-open-panel');
  }, [activePanel, aiPanelOpen]);

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
  const applyCanvasChanges = useMutation(api.features.canvas.applyCanvasChanges);
  const upsertPresence = useMutation(api.features.presence.upsertPresence);
  const removePresence = useMutation(api.features.presence.removePresence);
  const prunePresence = useMutation(api.features.presence.prunePresence);
  const updateRoomName = useMutation(api.features.rooms.updateRoomName);
  const saveSnapshot = useMutation(api.features.snapshots.saveSnapshot);
  const updateRoomThumbnail = useMutation(api.features.rooms.updateRoomThumbnail);
  const completeOnboarding = useMutation(api.features.rooms.completeOnboarding);
  const syncMemberProfile = useMutation(api.features.rooms.syncMemberProfile);

  useEffect(() => {
    syncMemberProfile().catch(() => {});
  }, [syncMemberProfile]);

  const captureThumbnail = useCallback(async () => {
    if (!roomIdArg || isReadOnly) return;
    const api = apiRef.current;
    if (!api) return;
    try {
      const thumbnail = await sceneThumbnail(api);
      if (!thumbnail) return;
      await updateRoomThumbnail({ roomId: roomIdArg, thumbnailData: thumbnail });
    } catch {
      // Thumbnail capture is best-effort; ignore failures
    }
  }, [roomIdArg, isReadOnly, updateRoomThumbnail]);

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

  // The document a room opens with. CanvasSurface reads it once on mount, so
  // later versions are applied through `replaceElements` instead of a remount —
  // a remount would drop the viewer's camera and selection mid-session.
  const initialScene = useMemo<SceneDocument>(
    () => (canvas ? parseScene(canvas.canvasData) : emptyScene()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvas?.canvasData],
  );

  // Reconcile remote changes whenever the room's canvas version bumps. Edits
  // that have not been sent yet win over the incoming document, so a reconcile
  // can never eat someone's in-flight stroke, and our own pushes come back with
  // matching element JSON — so there is no echo write-back.
  useEffect(() => {
    if (!canvas || !canvasApi) return;
    if (canvas.canvasVersion <= loadedVersion.current) return;
    loadedVersion.current = canvas.canvasVersion;
    if (!canvas.canvasData) return;
    const remote = parseScene(canvas.canvasData);
    const pending = pendingDiff.current;
    const merged = new Map<string, ExcalidrawElement>(
      remote.elements.map((element) => [element.id, element]),
    );
    for (const [id, element] of pending.put) merged.set(id, element);
    for (const id of pending.remove) merged.delete(id);
    for (const element of remote.elements) {
      if (pending.put.has(element.id) || pending.remove.has(element.id)) continue;
      knownElements.current.set(element.id, JSON.stringify(element));
    }
    canvasApi.replaceElements([...merged.values()]);
  }, [canvas, canvasApi]);

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
    // The viewer check alone is not enough: `room` is null once the user is
    // no longer a member, so `room?.userRole` is `undefined` (not "viewer")
    // and the guard would pass, sending writes that the server rejects with
    // "Not a member" forever. A missing room means no write permission.
    if (!room || room.userRole === 'viewer') return;
    const diff = pendingDiff.current;
    if (diff.put.size === 0 && diff.remove.size === 0) return;
    const sent = {
      put: Array.from(diff.put.values()),
      remove: Array.from(diff.remove),
    };
    const changes = JSON.stringify(sent);
    setSaveStatus('saving');
    try {
      await applyCanvasChanges({ roomId: roomIdArg, changes });
      for (const element of sent.put) {
        if (diff.put.get(element.id)?.version === element.version) diff.put.delete(element.id);
      }
      for (const id of sent.remove) {
        if (diff.remove.has(id)) diff.remove.delete(id);
      }
      setIsConnected(true);
      savedAt.current = Date.now();
      setSaveStatus('saved');
      announce('Canvas saved');
      if (diff.put.size > 0 || diff.remove.size > 0) {
        if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => void flushRef.current(), 300);
      }
    } catch {
      setIsConnected(false);
      setSaveStatus('offline');
    }
  }, [roomIdArg, room, applyCanvasChanges, announce]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const thumbnailTimer = useRef<number | null>(null);

  // Turn the latest scene into a per-element diff, debounced so a drag produces
  // one comparison instead of sixty. Only what actually changed is queued, so
  // a reconcile that came from the server never bounces back to it.
  const queueDiff = useCallback(() => {
    if (diffTimer.current !== null) window.clearTimeout(diffTimer.current);
    diffTimer.current = window.setTimeout(() => {
      diffTimer.current = null;
      if (!room || room.userRole === 'viewer') return;
      const elements = latestElements.current;
      const pending = pendingDiff.current;
      const seen = new Set<string>();
      let dirty = false;
      for (const element of elements) {
        seen.add(element.id);
        const serialized = JSON.stringify(element);
        if (knownElements.current.get(element.id) === serialized) continue;
        knownElements.current.set(element.id, serialized);
        dirty = true;
        if (element.isDeleted) {
          pending.remove.add(element.id);
          pending.put.delete(element.id);
        } else {
          pending.put.set(element.id, element);
          pending.remove.delete(element.id);
        }
      }
      for (const id of [...knownElements.current.keys()]) {
        if (seen.has(id)) continue;
        knownElements.current.delete(id);
        pending.put.delete(id);
        pending.remove.add(id);
        dirty = true;
      }
      if (!dirty) return;
      dirtySinceSnapshot.current = true;
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => void flushRef.current(), 800);
      // Debounced thumbnail capture — 3s after last edit
      if (thumbnailTimer.current !== null) window.clearTimeout(thumbnailTimer.current);
      thumbnailTimer.current = window.setTimeout(() => void captureThumbnail(), 3000);
    }, 200);
  }, [room, captureThumbnail]);

  const handleCanvasChange = useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      latestElements.current = elements;
      queueDiff();
    },
    [queueDiff],
  );

  useEffect(() => {
    return () => {
      if (diffTimer.current !== null) window.clearTimeout(diffTimer.current);
      if (thumbnailTimer.current !== null) window.clearTimeout(thumbnailTimer.current);
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, []);

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

  // Auto-capture thumbnail on room open for legacy rooms created before the
  // JPEG thumbnail fix. Only fires once per room load after the editor hydrates.
  useEffect(() => {
    if (!roomIdArg || isReadOnly || !room || !canvas?.canvasData || room.thumbnailData) return;
    if (!canvasApi) return;
    const timer = window.setTimeout(() => void captureThumbnail(), 2000);
    return () => window.clearTimeout(timer);
  }, [roomIdArg, room, canvas, isReadOnly, canvasApi, captureThumbnail]);

  // First-visit onboarding sketch: on an empty room, a pencil → note →
  // connector scene draws itself in once — a quiet "this is the loop" beat.
  // It waits for the flourish window to pass so the two moments sequence,
  // and is dismissed by the first real stroke (see the pointerdown listener
  // and the shape-count watcher below). Replaying it for the same room is
  // suppressed forever via onboardingCompleted in the room document.
  useEffect(() => {
    if (!roomIdArg || showOnboarding || isReadOnly || !room || !canvas || canvas.canvasData) return;
    if (room.onboardingCompleted) return;
    const t = window.setTimeout(() => setShowOnboarding(true), 2450);
    return () => window.clearTimeout(t);
  }, [roomIdArg, room, canvas, isReadOnly, showOnboarding, completeOnboarding]);

  // Once the sketch has drawn itself in and its label has landed, the scene
  // hands off to the guided walkthrough: the canvas dims and the real tools
  // glow one at a time. Any stroke before then still retires the whole thing
  // (the start timer is cleaned up when showOnboarding flips false).
  useEffect(() => {
    if (!showOnboarding || walkthrough || wtDismissed) return;
    const t = window.setTimeout(() => {
      setWalkthrough({ pencil: false, note: false, connector: false });
      armWalkthroughTool(0);
    }, 2700);
    return () => window.clearTimeout(t);
  }, [showOnboarding, walkthrough, wtDismissed, armWalkthroughTool]);

  // Auto version snapshot: every 45s while there are unsaved-snapshot edits,
  // capture a version the user can restore from history.
  useEffect(() => {
    if (!roomIdArg) return;
    const tick = async () => {
      if (!room || room.userRole === 'viewer') return;
      if (snapInFlight.current || !dirtySinceSnapshot.current) return;
      const api = apiRef.current;
      if (!api) return;
      const data = serializeScene(api.elements);
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
  }, [roomIdArg, saveSnapshot, room, captureThumbnail, flush]);

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
      const api = apiRef.current;
      const camera = api?.camera;
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
        selectedShapeIds: api?.selectionIds,
      }).catch(() => setIsConnected(false));
    };
    const handleMove = (e: PointerEvent) => {
      const api = apiRef.current;
      if (api) {
        const page = api.screenToScene(e.clientX, e.clientY);
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
    const heartbeat = window.setInterval(() => ship(false), 8000);
    const sweep = window.setInterval(() => {
      if (Date.now() - lastPrune.current > 12000) {
        lastPrune.current = Date.now();
        void prunePresence({ roomId: roomIdArg }).catch(() => undefined);
      }
    }, 8000);
    ship(false);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.clearInterval(heartbeat);
      window.clearInterval(sweep);
    };
  }, [roomIdArg, room, user, upsertPresence, prunePresence, removePresence]);

  // Track element count, camera, tool, selection and history depth for the
  // rail and the guides. Selection changes don't fire pointer moves, so a
  // selection change also ships presence so others see the live focus ring.
  useEffect(() => {
    if (!canvasApi) return;
    const update = () => {
      const elements = canvasApi.elements;
      // First real stroke (or a dropped block) retires the onboarding sketch.
      if (elements.length > 0 && showOnboarding) {
        setShowOnboarding(false);
        if (roomIdArg) completeOnboarding({ roomId: roomIdArg }).catch(() => {});
      }
      // Guided walkthrough: a real pencil stroke, sticky note, and connector
      // each check their step off; an unguided action (text, an ellipse) means
      // the user is already working independently, so the guide steps aside.
      if (walkthrough) {
        const types = new Set(elements.map((element) => element.type));
        const guided = {
          pencil: walkthrough.pencil || types.has('freedraw'),
          note: walkthrough.note || types.has('rectangle'),
          connector: walkthrough.connector || types.has('arrow'),
        };
        const allDone = guided.pencil && guided.note && guided.connector;
        const unguided = [...types].some(
          (type) => type !== 'freedraw' && type !== 'rectangle' && type !== 'arrow',
        );
        if (unguided && !allDone) {
          dismissWalkthrough();
        } else if (allDone) {
          // Only announce completion once: a fresh object every change would
          // keep resetting the done-beat timer below.
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
      setShapeCount(elements.length);
      setSelectionCount(canvasApi.selectionIds.length);
      setZoom(canvasApi.camera.z);
      setCanUndo(canvasApi.canUndo);
      setCanRedo(canvasApi.canRedo);
      // The history stack is ours, so the gauge reports real step counts.
      setUndoDepth(Math.min(canvasApi.undoDepth, 10));
      setRedoDepth(Math.min(canvasApi.redoDepth, 10));
      setActiveTool(canvasApi.activeTool);
      const selection = canvasApi.selectionIds.join(',');
      if (selection !== lastSelection.current && roomIdArg && room) {
        lastSelection.current = selection;
        const displayName = user?.name || user?.email || 'Unknown';
        // Send the full presence payload so the selection change never clears
        // the cursor/camera fields this user already shipped.
        const camera = canvasApi.camera;
        const cursor = cursorRef.current;
        void upsertPresence({
          roomId: roomIdArg,
          name: displayName,
          avatarUrl: user?.imageUrl ?? undefined,
          color: presenceColorFor(user?.id || displayName),
          camera: { x: camera.x, y: camera.y, zoom: camera.z },
          cursorX: cursor?.x,
          cursorY: cursor?.y,
          selectedShapeIds: canvasApi.selectionIds,
        }).catch(() => undefined);
      }
    };
    update();
    return canvasApi.subscribe(update);
  }, [
    canvasApi,
    roomIdArg,
    room,
    user,
    upsertPresence,
    isReadOnly,
    walkthrough,
    dismissWalkthrough,
    armWalkthroughTool,
    showOnboarding,
    completeOnboarding,
  ]);

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
      apiRef.current?.setTool(cfg.tool);
      setActiveTool(id);
      setCanvasTouched(true);
      playPop(380);
    },
    [isReadOnly],
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
          // Guard on room presence too: once the user is no longer a member,
          // `room` is null and `isReadOnly` is false, so this would otherwise
          // keep saving into a room the server rejects.
          if (!room || isReadOnly) return;
          const api = apiRef.current;
          if (api && roomIdArg) {
            try {
              await flush();
              const data = serializeScene(api.elements);
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
        apiRef.current?.zoomToFit();
        return;
      }
      if (e.key.toLowerCase() === 'f' && !e.shiftKey && !isMod) {
        // F — focus mode. Only enters with a selection (a hole to punch).
        e.preventDefault();
        const has = (apiRef.current?.selectionIds.length ?? 0) > 0;
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
      // Arrow key navigation for tool rail (when focused)
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !isMod) {
        const rail = toolRailRef.current;
        if (rail && (document.activeElement === rail || rail.contains(document.activeElement))) {
          e.preventDefault();
          const tools = Array.from(rail.querySelectorAll('.room-rail-tool:not(:disabled)')) as HTMLButtonElement[];
          const activeIndex = tools.findIndex((t) => t.classList.contains('active'));
          const nextIndex = e.key === 'ArrowDown'
            ? (activeIndex + 1) % tools.length
            : (activeIndex - 1 + tools.length) % tools.length;
          tools[nextIndex]?.focus();
          tools[nextIndex]?.click();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveSnapshot, roomIdArg, setTool, room, isReadOnly, captureThumbnail, flush, closeAiFeed, openAi, dismissWalkthrough]);

  // Undo/redo is the room's own history (the engine exposes no undo stack), so
  // the shortcut is claimed in the capture phase and stopped before the engine's
  // handler sees it — otherwise one ⌘Z would undo twice.
  useEffect(() => {
    if (isReadOnly) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      e.preventDefault();
      e.stopPropagation();
      if (key === 'y' || e.shiftKey) apiRef.current?.redo();
      else apiRef.current?.undo();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isReadOnly]);

  // Announce presence changes
  const presenceList = presence || [];
  const previousPresenceRef = useRef<string[]>([]);
  useEffect(() => {
    const currentIds = presenceList.map((p: { userId: string }) => p.userId);
    const previousIds = previousPresenceRef.current;
    const joined = currentIds.filter((id: string) => !previousIds.includes(id));
    const left = previousIds.filter((id: string) => !currentIds.includes(id));
    joined.forEach((id: string) => {
      const user = presenceList.find((p: { userId: string }) => p.userId === id);
      if (user) announce(`${user.name} joined the room`);
    });
    left.forEach(() => {
      announce('A collaborator left the room');
    });
    previousPresenceRef.current = currentIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presence, announce]);

  // Announce connection status changes
  useEffect(() => {
    if (!isConnected) {
      announce('Connection lost. Changes will sync when reconnected', 'assertive');
    } else if (saveStatus === 'offline') {
      announce('Reconnected. Syncing changes');
    }
  }, [isConnected, saveStatus, announce]);

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
    if (!roomIdArg) return null;
    return <RoomBoot />;
  }

  if (room === null) return null;

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
          <button
            className="room-icon-btn room-topbar-hideable"
            title={isSoundEnabled() ? 'Mute sound' : 'Enable sound'}
            aria-label={isSoundEnabled() ? 'Mute sound' : 'Enable sound'}
            onClick={() => {
              const updated = toggleSound();
              if (updated) playPop(520);
            }}
          >
            {isSoundEnabled() ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
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
            {/* The canvas mounts only once the room's document has arrived, so
                the first frame is the board — never an empty surface that fills
                in a moment later. `initialScene` is read once; later versions
                reconcile through the api. */}
            {canvas !== undefined && (
              <CanvasSurface
                scene={initialScene}
                theme={theme === 'dark' ? 'dark' : 'light'}
                readOnly={isReadOnly}
                onApiReady={(api) => {
                  apiRef.current = api;
                  setCanvasApi(api);
                  latestElements.current = api.elements;
                  for (const element of api.elements) {
                    knownElements.current.set(element.id, JSON.stringify(element));
                  }
                }}
                onChange={handleCanvasChange}
                onPointerUpdate={(point) => {
                  cursorRef.current = point;
                }}
                onPointerDown={() => {
                  setCanvasTouched(true);
                  // The first press on the canvas is the signal: the
                  // onboarding sketch steps aside for real work.
                  if (showOnboarding) {
                    setShowOnboarding(false);
                    if (roomIdArg) completeOnboarding({ roomId: roomIdArg }).catch(() => {});
                  }
                }}
                className="room-canvas-surface"
              />
            )}

            <ViewportAwareness api={canvasApi} presence={presence || []} />
            <PresenceCursors api={canvasApi} presence={presence || []} />
            <SelectionAwareness api={canvasApi} presence={presence || []} />
            <PlacementPulses api={canvasApi} />
            <FocusDim api={canvasApi} active={effectiveFocus} />
            <FocusHint active={effectiveFocus} />
            <CommentPins
              api={canvasApi}
              roomId={roomIdArg as Id<'rooms'> | undefined}
              commentMode={commentMode}
              onExitCommentMode={() => setCommentMode(false)}
            />

            {!isReadOnly && activePanel === 'blocks' && (
              <BlockLibrary api={canvasApi} onClose={() => setActivePanel(null)} anchorRef={blockBtnRef} />
            )}

            {activePanel === 'history' && (
              <VersionHistory roomId={roomIdArg as Id<'rooms'>} api={canvasApi} onClose={() => setActivePanel(null)} />
            )}
          </div>

        {showOnboarding && shapeCount === 0 && !canvasTouched && !isReadOnly && (
          <div className="room-onboarding" aria-hidden="true">
            <OnboardingSketch />
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
            api={canvasApi}
            readOnly={isReadOnly}
            inputRef={aiInputRef}
            barRef={aiBarRef}
            unviewed={hasUnviewed}
          />
          
        </div>

        {isReadOnly && (
          <div role="status" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
            View only — editing is disabled
          </div>
        )}

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
                aria-pressed={activeTool === id}
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
          <button
            className={`room-rail-tool ${commentMode ? 'active' : ''}`}
            onClick={() => {
              setCommentMode(!commentMode);
              if (commentMode) setTool('select');
            }}
            data-hint="Comment"
            aria-label="Comment pin"
            aria-pressed={commentMode}
            disabled={isReadOnly}
          >
            <MessageSquare size={18} />
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
                onClick={() => apiRef.current?.undo()}
                disabled={!canUndo}
                title="Undo (⌘Z)"
                aria-label="Undo"
              >
                <Undo2 size={18} />
              </button>
              <button
                className="room-icon-btn room-controls-btn"
                onClick={() => apiRef.current?.redo()}
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
            onClick={() => apiRef.current?.zoomBy(1 / 1.2)}
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
            onClick={() => apiRef.current?.zoomBy(1.2)}
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
                  apiRef.current?.zoomToFit();
                  setZoomMenuOpen(false);
                }}
              >
                <Maximize size={14} />
                Fit view
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  apiRef.current?.resetView();
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
            api={canvasApi}
            tool={activeTool}
            mode={styleMode}
            onModeChange={setStyleMode}
          />
        )}

        {/* Mobile bottom tool bar (replaces left rail below 720px) */}
        <nav
          className="room-tool-bar"
          role="toolbar"
          aria-label="Canvas tools"
          onPointerDownCapture={() => setCanvasTouched(true)}
        >
          <div className="room-tool-bar-inner">
            <div className="room-tool-bar-group">
              {RAIL_TOOL_IDS.slice(0, 3).map((id) => {
                const cfg = TOOL_BY_ID[id];
                const Icon = TOOL_ICONS[id];
                return (
                  <button
                    key={id}
                    className={`room-tool-bar-btn ${activeTool === id ? 'active' : ''}`}
                    onClick={() => setTool(id)}
                    aria-label={toolTitle(cfg)}
                    aria-pressed={activeTool === id}
                    disabled={isReadOnly}
                  >
                    <Icon size={18} />
                  </button>
                );
              })}
            </div>
            <div className="room-tool-bar-divider" aria-hidden="true" />
            <div className="room-tool-bar-group">
              {RAIL_TOOL_IDS.slice(3).map((id) => {
                const cfg = TOOL_BY_ID[id];
                const Icon = TOOL_ICONS[id];
                return (
                  <button
                    key={id}
                    className={`room-tool-bar-btn ${activeTool === id ? 'active' : ''}`}
                    onClick={() => setTool(id)}
                    aria-label={toolTitle(cfg)}
                    aria-pressed={activeTool === id}
                    disabled={isReadOnly}
                  >
                    <Icon size={18} />
                  </button>
                );
              })}
            </div>
            <div className="room-tool-bar-divider" aria-hidden="true" />
            <div className="room-tool-bar-group">
              <button
                ref={blockBtnRef}
                className={`room-tool-bar-btn ${activePanel === 'blocks' ? 'active' : ''}`}
                onClick={() => togglePanel('blocks')}
                aria-label="Block library"
                disabled={isReadOnly}
              >
                <Blocks size={18} />
              </button>
            </div>
          </div>
        </nav>
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
          <ExportDialog api={canvasApi} onClose={() => setShowExport(false)} />
        </Suspense>
      )}
    </div>
  );
}
