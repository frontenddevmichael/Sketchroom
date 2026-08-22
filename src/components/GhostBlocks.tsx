import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { Editor } from 'tldraw';
import { kindIcon } from '../lib/blockKinds';
import './GhostBlocks.css';

interface GhostBlock {
  label: string;
  kind: string;
  description?: string;
}

interface GhostEdge {
  from: number;
  to: number;
  label?: string;
}

interface GhostDiagram {
  blocks: GhostBlock[];
  edges: GhostEdge[];
}

interface CameraState {
  x: number;
  y: number;
  z: number;
}

interface GhostBlocksProps {
  editor: Editor | null;
  roomId: Id<'rooms'> | undefined;
  /** Ghost previews only live on the canvas while the AI feed is the active
   *  surface, so cards can never appear without an AI conversation behind them. */
  visible?: boolean;
  focus?: { messageId: string; index: number } | null;
  onFocus?: (f: { messageId: string; index: number } | null) => void;
}

// Ghost preview accent tone per kind (dark-surface palette, distinct from the
// chip palette in the AI feed because the surfaces differ).
const KIND_TONE: Record<string, string> = {
  service: 'blue',
  database: 'purple',
  api: 'green',
  client: 'orange',
  queue: 'teal',
  cache: 'yellow',
  input: 'gray',
  button: 'gray',
  card: 'gray',
  table: 'gray',
  navbar: 'gray',
  image: 'gray',
};

const GHOST_W = 150;
const GHOST_H = 88;
const GHOST_GAP = 16;
const COLS = 3;

function getGhostBounds(editor: Editor, index: number) {
  const view = editor.getViewportScreenBounds();
  const center = editor.screenToPage({ x: view.midX, y: view.midY });
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const offset = (COLS - 1) / 2;
  const x = center.x + (col - offset) * (GHOST_W + GHOST_GAP) - GHOST_W / 2;
  const y = center.y + row * (GHOST_H + GHOST_GAP) + 40;
  return { x, y, w: GHOST_W, h: GHOST_H };
}

function parseDiagram(messageId: string | null, messages: { _id: string; status: string; ghostBlocks?: string | null }[]): GhostDiagram | null {
  const latest = [...messages]
    .filter((m) => m.status === 'completed' && m.ghostBlocks)
    .sort((a, b) => (a._id < b._id ? 1 : -1))[0];
  if (!latest) return null;
  const target = messageId ? messages.find((m) => m._id === messageId) : latest;
  if (!target?.ghostBlocks) return null;
  try {
    const parsed = JSON.parse(target.ghostBlocks) as { blocks?: GhostBlock[]; edges?: GhostEdge[] };
    if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) return null;
    return { blocks: parsed.blocks, edges: Array.isArray(parsed.edges) ? parsed.edges : [] };
  } catch {
    return null;
  }
}

export function GhostBlocks({ editor, roomId, focus, onFocus, visible = true }: GhostBlocksProps) {
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, z: 1 });
  const messages = useQuery(
    api.features.ai.getAiMessages,
    roomId ? { roomId } : 'skip'
  ) as unknown as
    | { _id: string; status: string; ghostBlocks?: string | null }[]
    | undefined;

  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const cam = editor.getCamera();
      setCamera((prev) =>
        prev.x === cam.x && prev.y === cam.y && prev.z === cam.z ? prev : { x: cam.x, y: cam.y, z: cam.z }
      );
    };
    sync();
    const unlisten = editor.store.listen(() => requestAnimationFrame(sync));
    return () => unlisten();
  }, [editor]);

  useEffect(() => {
    if (!focus) return;
    const editorInstance = editor;
    if (!editorInstance) return;
    const parsed = parseDiagram(focus.messageId, messages || []);
    if (!parsed) return;
    const idx = Math.min(focus.index, parsed.blocks.length - 1);
    editorInstance.zoomToBounds(getGhostBounds(editorInstance, idx), {
      animation: { duration: 200 },
      inset: 180,
      targetZoom: 0.9,
    });
    const timer = window.setTimeout(() => onFocus?.(null), 1400);
    return () => window.clearTimeout(timer);
  }, [focus, messages, editor, onFocus]);

  if (!visible || !editor || !messages || messages.length === 0) return null;

  const diagram = parseDiagram(null, messages);
  if (!diagram) return null;
  const blocks = diagram.blocks;
  const edges = diagram.edges.filter((e) => e.from >= 0 && e.from < blocks.length && e.to >= 0 && e.to < blocks.length);

  const boundsList = blocks.map((_, i) => getGhostBounds(editor, i));
  const focusedIndex = focus ? focus.index : -1;

  let svgBox: { minX: number; minY: number; w: number; h: number } | null = null;
  if (edges.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const b of boundsList) {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    }
    const pad = 24;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    svgBox = { minX, minY, w: maxX - minX, h: maxY - minY };
  }

  return (
    <div
      className="ghost-layer"
      aria-hidden="true"
      style={{
        transform: `translate(${-camera.x * camera.z}px, ${-camera.y * camera.z}px) scale(${camera.z})`,
        transformOrigin: '0 0',
      }}
    >
      {svgBox && (
        <svg
          className="ghost-edges"
          style={{ left: svgBox.minX, top: svgBox.minY, width: svgBox.w, height: svgBox.h }}
          viewBox={`${svgBox.minX} ${svgBox.minY} ${svgBox.w} ${svgBox.h}`}
        >
          <defs>
            <marker id="ghost-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 z" className="ghost-edge-arrow" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const a = boundsList[e.from];
            const b = boundsList[e.to];
            const x1 = a.x + a.w / 2;
            const y1 = a.y + a.h / 2;
            const x2 = b.x + b.w / 2;
            const y2 = b.y + b.h / 2;
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} className="ghost-edge-line" markerEnd="url(#ghost-arrow)" />
                {e.label && (
                  <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} className="ghost-edge-label">
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {blocks.map((block, i) => {
        const bounds = boundsList[i];
        const Icon = kindIcon(block.kind);
        const tone = KIND_TONE[block.kind] ?? 'blue';
        const isFocused = focusedIndex === i;
        return (
          <div
            key={`${i}`}
            className={`ghost-block ghost-tone-${tone} ${isFocused ? 'ghost-focused' : ''}`}
            style={{ left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h }}
          >
            <span className="ghost-icon">
              <Icon size={15} />
            </span>
            <span className="ghost-label">{block.label}</span>
          </div>
        );
      })}
    </div>
  );
}
