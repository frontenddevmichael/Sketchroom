import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import './DemoCanvas.css';

/**
 * The hero "live" Sketchroom room. A scripted-but-responsive planning session:
 * a teammate cursor adds a sticky, then the copilot cursor types in the prompt
 * bar and sketches a draft flow as ghost-block suggestions. If the visitor
 * clicks the canvas, their own sticky lands there and the copilot reacts.
 *
 * All coordinates are in stage units (0-100 x, 0-62.5 y) mapped to percentage
 * positions, so the demo scales fluidly to any container without JS measuring.
 */
interface Block {
  id: string;
  kind: 'sticky' | 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  rot?: number;
}

interface Cursor {
  id: 'teammate' | 'you' | 'copilot';
  label: string;
  x: number;
  y: number;
  tone: 'gray' | 'dark' | 'green';
}

interface Connector {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed?: boolean;
}

const START_BLOCKS: Block[] = [
  { id: 'b1', kind: 'rect', x: 12, y: 30, w: 26, h: 18, text: 'Flow', rot: 0 },
  { id: 'b2', kind: 'rect', x: 60, y: 30, w: 26, h: 18, text: 'Review', rot: 0 },
  { id: 's1', kind: 'sticky', x: 30, y: 56, w: 18, h: 13, text: 'Ship it', rot: -2 },
];

const SAMPLE_THOUGHTS = ['What about offline mode?', 'Auth edge case here', 'Add analytics'];

// A small palette so the visitor chooses WHAT they drop — a sticky thought or
// a real flow block — and the copilot reacts to either.
const SAMPLE_BLOCKS = ['API', 'Service', 'Database', 'Queue', 'Client', 'Cache'];

let uid = 0;
const nextId = () => `d${++uid}`;

export function DemoCanvas() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();
  const [blocks, setBlocks] = useState<Block[]>(START_BLOCKS);
  const [connectors, setConnectors] = useState<Connector[]>(() =>
    reduce
      ? [{ id: 'r0', x1: 24, y1: 24, x2: 58, y2: 34, dashed: true }]
      : [],
  );
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [copilotCursor, setCopilotCursor] = useState<Cursor | null>(() =>
    reduce ? { id: 'copilot', label: 'Copilot', x: 6, y: 6, tone: 'green' } : null,
  );
  const [teammateCursor, setTeammateCursor] = useState<Cursor | null>(null);
  const [promptText, setPromptText] = useState('');
  const [promptBusy, setPromptBusy] = useState(false);
  const [ghost, setGhost] = useState<Block | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [hint, setHint] = useState(true);
  const [live, setLive] = useState('');
  const [dropKind, setDropKind] = useState<'sticky' | 'block'>('sticky');
  const running = useRef(true);

  const setCopilotPos = useCallback((x: number, y: number) => {
    setCopilotCursor({ id: 'copilot', label: 'Copilot', x, y, tone: 'green' });
  }, []);

  // Typewriter for the copilot prompt.
  const typePrompt = useCallback(async (text: string, speed = 22) => {
    setPromptText('');
    setPromptBusy(true);
    for (let i = 0; i <= text.length; i++) {
      if (!running.current) break;
      setPromptText(text.slice(0, i));
      await new Promise((r) => setTimeout(r, speed));
    }
  }, []);

  // Scripted opening: teammate sticky, then copilot drafts a flow.
  useEffect(() => {
    running.current = true;
    if (reduce) {
      // Reduced motion: state is pre-seeded; nothing to choreograph.
      return () => {
        running.current = false;
      };
    }
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const run = async () => {
      await wait(500);
      setTeammateCursor({ id: 'teammate', label: 'Priya', x: 8, y: 8, tone: 'gray' });
      await wait(700);
      setTeammateCursor({ id: 'teammate', label: 'Priya', x: 55, y: 34, tone: 'gray' });
      setBlocks((b) => [...b, { id: nextId(), kind: 'sticky', x: 46, y: 40, w: 17, h: 12, text: 'Found it!', rot: 1 }]);
      setConnectors((c) => [...c, { id: nextId(), x1: 24, y1: 24, x2: 58, y2: 34, dashed: true }]);
      await wait(1000);
      setTeammateCursor(null);

      // Copilot arrives and drafts a flow.
      setCopilotPos(80, 55);
      await wait(900);
      setBubble('Want me to sketch a first pass?');
      await wait(1200);
      setBubble(null);
      await typePrompt('Sketch a deploy flow for review ✦');
      await wait(500);
      setPromptBusy(false);

      setGhost({ id: 'ghost1', kind: 'rect', x: 12, y: 8, w: 26, h: 18, text: 'Deploy' });
      await wait(700);
      setGhost(null);
      setBlocks((b) => [
        ...b,
        { id: nextId(), kind: 'rect', x: 12, y: 8, w: 26, h: 18, text: 'Deploy' },
        { id: nextId(), kind: 'rect', x: 60, y: 8, w: 26, h: 18, text: 'Verify' },
        { id: nextId(), kind: 'sticky', x: 36, y: 14, w: 15, h: 11, text: 'auto', rot: 1 },
      ]);
      setConnectors((c) => [
        ...c,
        { id: nextId(), x1: 40, y1: 17, x2: 58, y2: 17 },
      ]);
      await wait(900);
      setCopilotPos(6, 6);
      if (running.current) setHint(true);
    };

    void run();
    return () => {
      running.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Visitor interaction: drop a sticky (a thought) or a flow block at stage
  // coords; the copilot reacts to whichever kind was chosen.
  const dropThought = useCallback(
    async (x: number, y: number) => {
      if (running.current !== true) return;
      setPromptBusy(true);
      setHint(false);
      const isBlock = dropKind === 'block';
      if (isBlock) {
        const label = SAMPLE_BLOCKS[Math.floor(Math.random() * SAMPLE_BLOCKS.length)];
        setBlocks((b) => [
          ...b,
          { id: nextId(), kind: 'rect', x, y, w: 16, h: 11, text: label, rot: 0 },
        ]);
        setCursor(null);
        setCopilotPos(Math.min(96, x + 6), Math.min(55, y + 5));
        await new Promise((r) => setTimeout(r, 650));
        if (!running.current) return;
        await typePrompt(`On it — wiring a ${label} into the flow`, 16);
        await new Promise((r) => setTimeout(r, 300));
        if (!running.current) return;
        setPromptBusy(false);
        setBubble(`Got it. ${label} goes between the two services.`);
        setLive(`Copilot: placing ${label} into the flow near you`);
        setGhost({ id: nextId(), kind: 'rect', x: Math.max(4, Math.min(60, x + 18)), y: Math.max(4, Math.min(44, y + 8)), w: 22, h: 15, text: `${label} v2` });
        await new Promise((r) => setTimeout(r, 700));
        if (!running.current) return;
        setGhost(null);
        setBlocks((b) => [
          ...b,
          { id: nextId(), kind: 'rect', x: Math.max(4, Math.min(60, x + 18)), y: Math.max(4, Math.min(44, y + 8)), w: 22, h: 15, text: `${label} v2` },
        ]);
        setConnectors((c) => [...c, { id: nextId(), x1: x + 8, y1: y + 6, x2: Math.max(4, Math.min(60, x + 18)) + 11, y2: Math.max(4, Math.min(44, y + 8)) + 7, dashed: true }]);
      } else {
        const thought = SAMPLE_THOUGHTS[Math.floor(Math.random() * SAMPLE_THOUGHTS.length)];
        setBlocks((b) => [
          ...b,
          { id: nextId(), kind: 'sticky', x, y, w: 17, h: 12, text: thought, rot: -1 },
        ]);
        setCursor(null);
        setCopilotPos(Math.min(96, x + 6), Math.min(55, y + 5));
        await new Promise((r) => setTimeout(r, 650));
        if (!running.current) return;
        await typePrompt(`On it — sketching \u201c${thought}\u201d into the plan`, 16);
        await new Promise((r) => setTimeout(r, 300));
        if (!running.current) return;
        setPromptBusy(false);
        setBubble('Got it. Adding a first draft near your note.');
        setLive(`Copilot: adding a draft near your note about ${thought}`);
        setGhost({ id: nextId(), kind: 'rect', x: Math.max(4, Math.min(60, x + 20)), y: Math.max(4, Math.min(44, y + 8)), w: 24, h: 16, text: 'Draft' });
        await new Promise((r) => setTimeout(r, 700));
        if (!running.current) return;
        setGhost(null);
        setBlocks((b) => [
          ...b,
          { id: nextId(), kind: 'rect', x: Math.max(4, Math.min(60, x + 20)), y: Math.max(4, Math.min(44, y + 8)), w: 24, h: 16, text: 'Draft' },
        ]);
      }
      await new Promise((r) => setTimeout(r, 500));
      setBubble(null);
      setCopilotPos(6, 6);
      if (running.current) setHint(true);
    },
    [typePrompt, setCopilotPos, dropKind]
  );

  const handleStageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 62.5;
      void dropThought(x, y);
    },
    [dropThought]
  );

  // Keyboard access: Enter / Space on the focused stage drops a thought too.
  const handleStageKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const x = 36 + Math.floor(Math.random() * 18);
      const y = 30 + Math.floor(Math.random() * 14);
      void dropThought(x, y);
    },
    [dropThought]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 62.5;
      setCursor({ id: 'you', label: 'You', x, y, tone: 'dark' });
    },
    []
  );

  return (
    <div className="demo-window" aria-label="Interactive preview of the Sketchroom planning canvas: the AI copilot drafts a flow while a teammate adds sticky notes.">
      <div className="demo-topbar">
        <span className="demo-back" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </span>
        <span className="demo-room-name">Q3 launch — planning</span>
        <span className="demo-topbar-spacer" />
        <span className="demo-avatars">
          <span className="demo-avatar" style={{ background: '#E8E8E8' }}>P</span>
          <span className="demo-avatar demo-avatar-green" style={{ background: 'var(--green-500)' }}>✦</span>
        </span>
        <span className="demo-share">Share</span>
      </div>

      <div className="demo-body">
        <aside className="demo-toolrail" aria-hidden="true">
          {['arrow', 'pen', 'square', 'text', 'sticky'].map((tool) => (
            <span key={tool} className={`demo-tool ${tool === 'square' ? 'demo-tool-active' : ''}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {tool === 'arrow' && <><path d="M5 12h14M12 5l7 7-7 7" /></>}
                {tool === 'pen' && <path d="M12 19l7-7-4-4-7 7v4h4z" />}
                {tool === 'square' && <rect x="4" y="4" width="16" height="16" rx="3" />}
                {tool === 'text' && <path d="M5 6h14M12 6v12" />}
                {tool === 'sticky' && <path d="M6 4h12v12l-6 4-6-4z" />}
              </svg>
            </span>
          ))}
        </aside>

        <div className="demo-stage-wrap"
          ref={stageRef}
          onPointerMove={onPointerMove}
          onClick={handleStageClick}
          role="button"
          aria-label="Drop a thought on the canvas and see the copilot react. Press Enter or Space to drop a note."
          tabIndex={0}
          onKeyDown={handleStageKeyDown}
        >
          <svg className="demo-connectors" viewBox="0 0 100 62.5" preserveAspectRatio="none" aria-hidden="true">
            {connectors.map((c) => (
              <line
                key={c.id}
                x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                stroke="var(--neutral-400)"
                strokeWidth="0.35"
                strokeDasharray={c.dashed ? '1.2 1' : undefined}
              />
            ))}
          </svg>

          <AnimatePresence>
            {ghost && (
              <motion.div
                key={`ghost-${ghost.id}`}
                className="demo-block demo-block-ghost"
                style={{ left: `${ghost.x}%`, top: `${ghost.y}%`, width: `${ghost.w}%`, height: `${ghost.h}%` }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.35 }}
              >
                <span className="demo-block-ghost-label">{ghost.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {blocks.map((b) => (
              <motion.div
                key={b.id}
                className={`demo-block ${b.kind === 'sticky' ? 'demo-block-sticky' : 'demo-block-rect'}`}
                style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`, transform: `rotate(${b.rot ?? 0}deg)` }}
                initial={b.id.startsWith('d') ? { opacity: 0, scale: 0.7 } : false}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
              >
                {b.kind === 'sticky' && <span className="demo-block-sticky-fold" aria-hidden="true" />}
                <span>{b.text}</span>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Copilot cursor */}
          {copilotCursor && (
            <motion.div
              className="demo-cursor"
              style={{ left: `${copilotCursor.x}%`, top: `${copilotCursor.y}%`, zIndex: 40 }}
              animate={{ left: `${copilotCursor.x}%`, top: `${copilotCursor.y}%` }}
              transition={{ type: 'spring', stiffness: 220, damping: 26 }}
            >
              <svg className="demo-cursor-arrow" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 2l15 8-6.5 1.5L9.5 20z" /></svg>
              <span className="demo-cursor-label demo-cursor-green">✦ Copilot</span>
            </motion.div>
          )}

          {/* Teammate cursor */}
          {teammateCursor && (
            <motion.div
              className="demo-cursor"
              style={{ left: `${teammateCursor.x}%`, top: `${teammateCursor.y}%`, zIndex: 40 }}
              animate={{ left: `${teammateCursor.x}%`, top: `${teammateCursor.y}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 28 }}
            >
              <svg className="demo-cursor-arrow" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 2l15 8-6.5 1.5L9.5 20z" /></svg>
              <span className="demo-cursor-label demo-cursor-gray">Priya</span>
            </motion.div>
          )}

          {/* Your cursor */}
          {cursor && <CursorPlane cursor={cursor} />}

          {/* Copilot bubble */}
          <AnimatePresence>
            {bubble && (
              <motion.div
                className="demo-bubble demo-bubble-green"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.3 }}
              >
                {bubble}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Prompt bar */}
          <div className={`demo-prompt ${promptBusy ? 'demo-prompt-busy' : ''}`} aria-hidden="true">
            <span className="demo-prompt-spark">✦</span>
            <span className="demo-prompt-text">
              {promptBusy ? promptText : 'Ask the copilot to draft…'}
            </span>
          </div>

          {/* Block palette: choose what the click drops — a thought or a flow
              block — and the copilot reacts to either. */}
          <div className="demo-palette" role="group" aria-label="Choose what to drop">
            <button
              className={`demo-palette-chip ${dropKind === 'sticky' ? 'active' : ''}`}
              onClick={() => setDropKind('sticky')}
              aria-pressed={dropKind === 'sticky'}
            >
              Sticky
            </button>
            <button
              className={`demo-palette-chip ${dropKind === 'block' ? 'active' : ''}`}
              onClick={() => setDropKind('block')}
              aria-pressed={dropKind === 'block'}
            >
              Block
            </button>
          </div>

          {hint && (
            <span className="demo-hint">
              {dropKind === 'sticky'
                ? 'Click anywhere to drop your thought'
                : 'Click anywhere to drop a block'}
            </span>
          )}

          <div className="demo-live" aria-live="polite">
            {live}
          </div>
        </div>
      </div>
    </div>
  );
}

function CursorPlane({ cursor }: { cursor: Cursor }) {
  return (
    <motion.div
      className="demo-cursor"
      style={{ left: `${cursor.x}%`, top: `${cursor.y}%`, zIndex: 45 }}
      initial={false}
      animate={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
      transition={{ type: 'spring', stiffness: 200, damping: 28 }}
    >
      <svg className="demo-cursor-arrow" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 2l15 8-6.5 1.5L9.5 20z" /></svg>
      <span className={`demo-cursor-label ${cursor.tone === 'dark' ? 'demo-cursor-dark' : ''}`}>{cursor.label}</span>
    </motion.div>
  );
}