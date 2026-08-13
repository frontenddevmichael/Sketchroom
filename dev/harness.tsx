// Dev harness: mounts the real chrome components with their real CSS and
// stubbed Convex/Clerk so layouts can be visually verified with Playwright.
//
// Default view (`/harness.html`) renders the room chrome with scenario
// controls. `?view=app` renders the REAL App (dashboard, rooms, modals) via
// MemoryRouter against seeded stub data — this is what the Playwright smoke
// tests drive (`npm run test:smoke`).
import { useEffect, useMemo, useRef, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import '../src/index.css';
import '../src/screens/RoomScreen.css';
import { AiFeed } from '../src/components/AiFeed';
import { ToolOptionsRail } from '../src/components/ToolOptions';
import type { ToolStyleMode } from '../src/components/ToolOptions';
import { BlockLibrary } from '../src/components/BlockLibrary';
import { VersionHistory } from '../src/components/VersionHistory';
import { CanvasEmptyIllo, ErrorIllo, DrawnTitle } from '../src/components/illustrations';
import { LoaderMark, LoaderWordmark } from '../src/components/LoadingScreen';
import App from '../src/App';
import { ThemeProvider } from '../src/lib/ThemeProvider';
import { seedAppStubs } from './appSeed';
import { api } from '../convex/_generated/api';
import { __getMutationCalls, __setQueryResult } from './stubs/convex-react';
import {
  ArrowLeft,
  Blocks,
  Download,
  History,
  Maximize,
  MousePointer2,
  PenTool,
  Redo2,
  Shapes,
  Sparkles,
  Spline,
  StickyNote,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

const TOOL_IDS = ['select', 'draw', 'sticky', 'text', 'connector', 'shapes'] as const;
const TOOL_ICONS: Record<string, typeof MousePointer2> = {
  select: MousePointer2,
  draw: PenTool,
  sticky: StickyNote,
  text: Type,
  connector: Spline,
  shapes: Shapes,
};

function makeFakeEditor() {
  const store = { listen: () => () => {} };
  return {
    store,
    getSelectedShapes: () => [],
    getSelectedShapeIds: () => [],
    getSharedStyles: () => new Map(),
    getStyleForNextShape: (s: { defaultValue: unknown }) => s.defaultValue,
    setStyleForNextShapes: () => {},
    setStyleForSelectedShapes: () => {},
    getViewportScreenBounds: () => ({
      x: 0, y: 0, w: 1280, h: 720, minX: 0, minY: 0, maxX: 1280, maxY: 720, midX: 640, midY: 360,
    }),
    screenToPage: (p: unknown) => p,
    pageToScreen: (p: unknown) => p,
    getCamera: () => ({ x: 0, y: 0, z: 1 }),
    getCurrentPageShapes: () => [],
    getShapePageBounds: () => null,
    createShape: () => {},
    select: () => {},
    setCurrentTool: () => {},
    zoomToSelection: () => {},
    zoomToFit: () => {},
    setCamera: () => {},
    updateShapes: () => {},
    alignShapes: () => {},
    distributeShapes: () => {},
    undo: () => {},
    redo: () => {},
    zoomIn: () => {},
    zoomOut: () => {},
    setSelectedShapes: () => {},
    getShapeUtil: () => ({ getText: () => null }),
  } as never;
}

const MESSAGES: Record<string, Array<Record<string, unknown>> | undefined> = {
  none: undefined,
  empty: [],
  pending: [
    {
      _id: 'm1',
      prompt: 'Draft a login flow',
      status: 'pending',
      response: '',
      ghostBlocks: null,
      createdAt: Date.now() - 5000,
    },
  ],
  done: [
    {
      _id: 'm1',
      prompt: 'Draft a login flow',
      status: 'completed',
      response: 'Here is a two-step login flow with a session store.',
      ghostBlocks: JSON.stringify({
        blocks: [
          { kind: 'client', label: 'Login Screen' },
          { kind: 'service', label: 'Auth Service' },
          { kind: 'database', label: 'Users DB' },
        ],
        edges: [
          { from: 0, to: 1 },
          { from: 1, to: 2 },
        ],
      }),
      createdAt: Date.now() - 5000,
    },
  ],
  failed: [
    {
      _id: 'm1',
      prompt: 'Draft a login flow',
      status: 'failed',
      response: 'Could not reach the AI right now.',
      ghostBlocks: null,
      createdAt: Date.now() - 5000,
    },
  ],
  'done-long': Array.from({ length: 8 }, (_, i) => ({
    _id: `m${i}`,
    prompt: `Long conversation message ${i} — draft the auth flow for our new product`,
    status: 'completed',
    response:
      'Here is a detailed pass with API, database, and client blocks. It covers the full request lifecycle from login through session refresh.',
    ghostBlocks: JSON.stringify({
      blocks: [
        { kind: 'client', label: 'Login Screen' },
        { kind: 'service', label: 'Auth Service' },
        { kind: 'database', label: 'Users DB' },
      ],
      edges: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
      ],
    }),
    createdAt: Date.now() - (8 - i) * 20_000,
  })),
};

const SNAPSHOTS = Array.from({ length: 14 }, (_, i) => ({
  _id: `snap${i}`,
  createdAt: Date.now() - i * 60_000,
  version: 14 - i,
  description: i === 0 ? 'Initial sketch' : undefined,
  canvasData: null,
}));

function CoachmarkPill({
  targetRef,
  placement,
  text,
  last,
  onNext,
  onFinish,
}: {
  targetRef: React.RefObject<HTMLElement | null>;
  placement: 'right' | 'left' | 'below' | 'above';
  text: string;
  last: boolean;
  onNext: () => void;
  onFinish: () => void;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const measure = () => {
      const target = targetRef.current;
      const pill = pillRef.current;
      if (!target || !pill) return;
      const tr = target.getBoundingClientRect();
      const pw = pill.offsetWidth;
      const ph = pill.offsetHeight;
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
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
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
    </div>
  );
}

const COACH_STEPS: Array<{ placement: 'right' | 'above' | 'below'; text: string; ref: string }> = [
  { placement: 'right', text: 'Tools live on the left.', ref: 'rail' },
  { placement: 'above', text: 'The AI copilot lives here — ask it to draft, refine, or answer.', ref: 'ai' },
  { placement: 'below', text: 'Invite your team with Share.', ref: 'share' },
];

// Full-app view: renders the real App against seeded stub data. Routes run in
// a MemoryRouter seeded from the `route` query param, so smoke tests can start
// anywhere (dashboard, room) without the server needing to handle paths.
declare global {
  interface Window {
    __sketchroomHarness?: {
      /** Mutation calls recorded by the stub, keyed by a friendly name. */
      getMutationCalls: (name: string) => unknown[][];
      /** Swap the version-history list (used to seed restore scenarios). */
      setSnapshots: (snapshots: unknown) => void;
    };
  }
}

const MUTATION_BY_NAME: Record<string, unknown> = {
  createRoom: api.rooms.createRoom,
  createWorkspace: api.rooms.createWorkspace,
  updateRoomName: api.rooms.updateRoomName,
  deleteRoom: api.rooms.deleteRoom,
  deleteWorkspace: api.rooms.deleteWorkspace,
  applyCanvasChanges: api.canvas.applyCanvasChanges,
  saveSnapshot: api.snapshots.saveSnapshot,
  restoreSnapshot: api.snapshots.restoreSnapshot,
  upsertPresence: api.presence.upsertPresence,
  inviteMember: api.invites.inviteMember,
  createInviteLink: api.invites.createInviteLink,
};

function AppView() {
  // Seed the stub during the first render (state initializer, not an effect)
  // so the real App's useQuery hooks resolve data on mount — the stub is
  // synchronous and cannot "replay" a query that already returned undefined.
  const [search] = useState(() => {
    const s = new URLSearchParams(window.location.search);
    seedAppStubs({ snapshots: s.get('snapshots') === '1' });
    return s;
  });

  useEffect(() => {
    window.__sketchroomHarness = {
      getMutationCalls: (name) => __getMutationCalls(MUTATION_BY_NAME[name]),
      setSnapshots: (snapshots) => __setQueryResult(api.snapshots.listSnapshots, snapshots),
    };
    return () => {
      delete window.__sketchroomHarness;
    };
  }, []);

  const route = search.get('route') ?? '/dashboard';
  return (
    <MemoryRouter initialEntries={[route]}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </MemoryRouter>
  );
}

export function Harness() {
  const [view] = useState(() => new URLSearchParams(window.location.search).get('view'));
  if (view === 'app') return <AppView />;
  return <ChromeHarness />;
}

function ChromeHarness() {
  const [tool, setTool] = useState<string>('shapes');
  const [messagesKey, setMessagesKey] = useState('none');
  const [selectedCount, setSelectedCount] = useState(0);
  const [unviewed, setUnviewed] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [panel, setPanel] = useState<'none' | 'blocks' | 'history'>('none');
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [styleMode, setStyleMode] = useState<ToolStyleMode>('next');
  const [coachStep, setCoachStep] = useState<number | null>(null);
  // Reviewable mock states: the canvas empty scene (the real hand-drawn
  // hero + drawn headline) and the room boot error — every empty/error
  // state is one click away.
  const [showEmptyHero, setShowEmptyHero] = useState(true);
  const [scene, setScene] = useState<'room' | 'boot-error'>('room');

  const editor = useMemo(() => makeFakeEditor(), []);
  const barRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const shareBtnRef = useRef<HTMLButtonElement | null>(null);
  const blockBtnRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [prompt, setPrompt] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [inserted, setInserted] = useState<string | null>(null);
  const [feedOpen, setFeedOpen] = useState(false);

  const setMessages = (key: string) => {
    __setQueryResult(MESSAGES[key]);
    setMessagesKey(key);
  };
  useEffect(() => {
    __setQueryResult(MESSAGES.none);
    return () => __setQueryResult(undefined);
  }, []);
  useEffect(() => {
    if (panel === 'history') __setQueryResult(SNAPSHOTS);
  }, [panel]);

  const messages = MESSAGES[messagesKey];
  const aiPanelOpen =
    feedOpen || isAsking || (messages && messages.length > 0 && messages[messages.length - 1]?.status === 'pending');

  const copilot = {
    prompt,
    setPrompt,
    isAsking,
    error: null,
    inserted,
    setInserted,
    selectedCount,
    clearSelection: () => setSelectedCount(0),
    handleAsk: async () => {
      setPrompt('');
      setIsAsking(true);
      await new Promise((r) => setTimeout(r, 500));
      setIsAsking(false);
    },
    feedOpen,
    openFeed: () => {
      setFeedOpen(true);
      setMessages('empty');
    },
    closeFeed: () => {
      setFeedOpen(false);
      setMessages('none');
    },
  };

  const showOptionsRail =
    !readOnly &&
    ['select', 'draw', 'sticky', 'text', 'connector', 'shapes'].includes(tool) &&
    (tool !== 'select' || selectedCount > 0) &&
    panel === 'none' &&
    !aiPanelOpen;

  const targetRefs: Record<string, React.RefObject<HTMLElement | null>> = {
    rail: railRef,
    ai: barRef,
    share: shareBtnRef,
  };

  return (
    <>
      {scene === 'boot-error' ? (
        /* The real room-boot failure state: loader mark + wordmark, then the
           hand-drawn error scene with its drawn headline — one click away. */
        <div className="loading-screen room-boot" role="status" aria-label="Opening room">
          <LoaderMark size={62} />
          <LoaderWordmark />
          <div className="room-boot-error" role="alert">
            <div aria-hidden="true">
              <ErrorIllo />
            </div>
            <DrawnTitle className="room-boot-error-title" delay={700}>
              Can't reach this room
            </DrawnTitle>
            <p className="room-boot-error-sub">Check your connection and give it another try.</p>
            <button className="btn btn-primary" onClick={() => setScene('room')}>
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div className="room-screen" data-testid="stage">
      <div className="room-topbar glass">
        <button className="room-back-btn" aria-label="Back to dashboard">
          <ArrowLeft size={18} />
        </button>
        <div className="room-name-wrap">
          <input className="room-name-input" defaultValue="Launch planning" aria-label="Room name" />
        </div>
        <div className="room-topbar-right">
          <span className="room-status-pill room-status-ok">
            <span className="room-status-dot" />
            Saved
          </span>
          <div className="room-presence-avatars">
            <span className="room-presence-avatar" title="Ada">
              A
            </span>
          </div>
          <button
            className={`room-icon-btn ${panel === 'history' ? 'active' : ''}`}
            title="Version history"
            onClick={() => setPanel((p) => (p === 'history' ? 'none' : 'history'))}
          >
            <History size={18} />
          </button>
          <button className="room-icon-btn" title="Export">
            <Download size={18} />
          </button>
          {!readOnly && (
            <button ref={shareBtnRef} className="room-share-btn">
              Share
            </button>
          )}
        </div>
      </div>

      <div className="room-stage">
        <div className="room-canvas">
          {showEmptyHero && panel === 'none' && !readOnly && (
            <div className="room-empty-hero">
              {/* The real canvas empty state — the hand-drawn pencil-meets-note
                  scene and its drawn headline, exactly as the room renders it. */}
              <div className="room-empty-illo" aria-hidden="true">
                <CanvasEmptyIllo />
              </div>
              <DrawnTitle as="h2" className="room-empty-title" delay={800}>
                A blank canvas, yours to fill
              </DrawnTitle>
              <p className="room-empty-subtitle">
                Sketch on the canvas, drop blocks from the library, or ask the AI copilot to draft a first pass for
                you.
              </p>
              {!readOnly && (
                <div className="room-empty-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setMessages('pending');
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                  >
                    <Sparkles size={16} />
                    Ask the AI
                  </button>
                  <button className="btn btn-outline" onClick={() => setPanel('blocks')}>
                    <Blocks size={16} />
                    Browse blocks
                  </button>
                </div>
              )}
            </div>
          )}

          {!readOnly && !aiPanelOpen && tool === 'select' && coachStep !== null && coachStep >= 0 && (
            <CoachmarkPill
              targetRef={targetRefs[COACH_STEPS[coachStep].ref]}
              placement={COACH_STEPS[coachStep].placement}
              text={COACH_STEPS[coachStep].text}
              last={coachStep === COACH_STEPS.length - 1}
              onNext={() => setCoachStep((s) => (s! >= COACH_STEPS.length - 1 ? null : s! + 1))}
              onFinish={() => setCoachStep(null)}
            />
          )}

          {!readOnly && panel === 'blocks' && (
            <BlockLibrary editor={editor} onClose={() => setPanel('none')} anchorRef={blockBtnRef} />
          )}

          {panel === 'history' && (
            <VersionHistory roomId={'r1' as never} editor={editor} onClose={() => setPanel('none')} />
          )}
        </div>

        <div className="room-bottom-stack">
          <AiFeed
            copilot={copilot}
            roomId={'r1' as never}
            editor={editor}
            readOnly={readOnly}
            inputRef={inputRef}
            barRef={barRef}
            unviewed={unviewed}
          />
        </div>

        <nav className="room-tool-rail glass" ref={railRef} role="toolbar" aria-label="Canvas tools">
          {TOOL_IDS.map((id) => {
            const Icon = TOOL_ICONS[id];
            return (
              <button
                key={id}
                className={`room-rail-tool ${tool === id ? 'active' : ''}`}
                onClick={() => setTool(id)}
                title={id}
                aria-label={id}
                disabled={readOnly}
              >
                <Icon size={18} />
              </button>
            );
          })}
          <div className="room-rail-divider" aria-hidden="true" />
          <button
            ref={blockBtnRef}
            className={`room-rail-tool ${panel === 'blocks' ? 'active' : ''}`}
            onClick={() => setPanel((p) => (p === 'blocks' ? 'none' : 'blocks'))}
            title="Block library"
            aria-label="Block library"
            disabled={readOnly}
          >
            <Blocks size={18} />
          </button>
        </nav>

        <div className="room-controls glass" role="group" aria-label="History and zoom controls">
          {!readOnly && (
            <>
              <button className="room-icon-btn room-controls-btn" title="Undo">
                <Undo2 size={18} />
              </button>
              <button className="room-icon-btn room-controls-btn" title="Redo">
                <Redo2 size={18} />
              </button>
              <span className="room-controls-divider" aria-hidden="true" />
            </>
          )}
          <button className="room-icon-btn room-controls-btn" title="Zoom out">
            <ZoomOut size={15} />
          </button>
          <button className="room-controls-pct" onClick={() => setZoomMenuOpen((o) => !o)}>
            <span>100%</span>
          </button>
          <button className="room-icon-btn room-controls-btn" title="Zoom in">
            <ZoomIn size={15} />
          </button>
          {zoomMenuOpen && (
            <div className="room-zoom-menu glass" role="menu" aria-label="Zoom options">
              <button role="menuitem">
                <Maximize size={14} />
                Fit view
              </button>
              <button role="menuitem">
                <span className="room-zoom-menu-pct">100%</span>
                Reset zoom
              </button>
            </div>
          )}
        </div>

        {showOptionsRail && (
          <ToolOptionsRail
            key={tool}
            editor={editor}
            tool={tool}
            mode={styleMode}
            onModeChange={setStyleMode}
          />
        )}
        </div>
        </div>
      )}

      <div className="harness-debug" data-testid="toolbar">
        <div className="h-row">
          {TOOL_IDS.map((id) => (
            <button key={id} data-testid={`tool-${id}`} className={tool === id ? 'on' : ''} onClick={() => setTool(id)}>
              {id}
            </button>
          ))}
        </div>
        <div className="h-row">
          <button data-testid="pill-expand" onClick={() => setTool((t) => t)}>
            pill: mounted
          </button>
          <button data-testid="sel-0" onClick={() => setSelectedCount(0)}>
            sel 0
          </button>
          <button data-testid="sel-3" onClick={() => setSelectedCount(3)}>
            sel 3
          </button>
          <button data-testid="unviewed" onClick={() => setUnviewed((v) => !v)}>
            unviewed: {unviewed ? 'on' : 'off'}
          </button>
          <button data-testid="readonly" onClick={() => setReadOnly((v) => !v)}>
            readonly: {readOnly ? 'on' : 'off'}
          </button>
          <button data-testid="zoom-menu" onClick={() => setZoomMenuOpen((o) => !o)}>
            zoom menu: {zoomMenuOpen ? 'open' : 'closed'}
          </button>
          <button data-testid="mode-selection" onClick={() => setStyleMode('selection')}>
            mode: selection
          </button>
          <button data-testid="mode-next" onClick={() => setStyleMode('next')}>
            mode: next
          </button>
        </div>
        <div className="h-row">
          <button data-testid="feed-open" onClick={() => copilot.openFeed()}>
            feed open
          </button>
          <button data-testid="feed-close" onClick={() => copilot.closeFeed()}>
            feed close
          </button>
          <button data-testid="msg-none" onClick={() => { setFeedOpen(false); setMessages('none'); }}>
            msg none
          </button>
          <button data-testid="msg-empty" onClick={() => { setFeedOpen(true); setMessages('empty'); }}>
            msg empty
          </button>
          <button data-testid="msg-pending" onClick={() => { setFeedOpen(true); setMessages('pending'); }}>
            msg pending
          </button>
          <button data-testid="msg-done" onClick={() => { setFeedOpen(true); setMessages('done'); }}>
            msg done
          </button>
          <button data-testid="msg-failed" onClick={() => { setFeedOpen(true); setMessages('failed'); }}>
            msg failed
          </button>
          <button data-testid="msg-long" onClick={() => { setFeedOpen(true); setMessages('done-long'); }}>
            msg long
          </button>
          <button data-testid="panel-blocks" onClick={() => setPanel((p) => (p === 'blocks' ? 'none' : 'blocks'))}>
            blocks: {panel === 'blocks' ? 'open' : 'closed'}
          </button>
          <button data-testid="panel-history" onClick={() => setPanel((p) => (p === 'history' ? 'none' : 'history'))}>
            history: {panel === 'history' ? 'open' : 'closed'}
          </button>
        </div>
        <div className="h-row">
          <button data-testid="coach-off" onClick={() => setCoachStep(null)}>
            coach off
          </button>
          <button data-testid="coach-0" onClick={() => setCoachStep(0)}>
            coach rail
          </button>
          <button data-testid="coach-1" onClick={() => setCoachStep(1)}>
            coach ai
          </button>
          <button data-testid="coach-2" onClick={() => setCoachStep(2)}>
            coach share
          </button>
        </div>
        <div className="h-row">
          <button
            data-testid="empty-hero"
            className={showEmptyHero ? 'on' : ''}
            onClick={() => setShowEmptyHero((v) => !v)}
          >
            empty hero: {showEmptyHero ? 'on' : 'off'}
          </button>
          <button data-testid="scene-room" className={scene === 'room' ? 'on' : ''} onClick={() => setScene('room')}>
            scene: room
          </button>
          <button
            data-testid="scene-boot-error"
            className={scene === 'boot-error' ? 'on' : ''}
            onClick={() => setScene('boot-error')}
          >
            scene: boot error
          </button>
        </div>
      </div>

      <style>{`
        .harness-debug {
          position: fixed;
          bottom: 0;
          right: 0;
          z-index: 99999;
          background: rgba(0,0,0,0.82);
          color: #eee;
          font: 11px/1.4 ui-monospace, monospace;
          padding: 6px;
          border-radius: 8px 0 0 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-width: 480px;
        }
        .harness-debug .h-row { display: flex; flex-wrap: wrap; gap: 3px; }
        .harness-debug button {
          font: inherit;
          color: #eee;
          background: #333;
          border: 1px solid #555;
          border-radius: 4px;
          padding: 2px 6px;
          cursor: pointer;
        }
        .harness-debug button.on { background: #0a7d3f; }
      `}</style>
    </>
  );
}

import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')!).render(<Harness />);
