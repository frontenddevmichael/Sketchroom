import { useCallback, useEffect, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { Editor, TLShapeId } from 'tldraw';
import { toRichText, createShapeId } from 'tldraw';
import { kindColor } from './blockKinds';

export interface AiGhostBlock {
  label: string;
  kind: string;
  description?: string;
}

export interface AiGhostEdge {
  from: number;
  to: number;
  label?: string;
}

export interface AiGhostDiagram {
  blocks: AiGhostBlock[];
  edges: AiGhostEdge[];
}

const SHAPE_LABEL: Record<string, string> = {
  geo: 'rectangle',
  text: 'text',
  note: 'note',
  arrow: 'arrow',
  line: 'line',
  image: 'image',
  frame: 'frame',
  highlight: 'highlight',
  embed: 'embed',
};

const BLOCK_W = 180;
const BLOCK_H = 90;
const DIAGRAM_GAP = 40;
const DIAGRAM_COLS = 4;

export const AI_REFINE_SUGGESTIONS = [
  'Add a step to this flow',
  'Explain these blocks',
  'Reorganize this diagram',
];

function layoutDiagram(count: number, center: { x: number; y: number }) {
  const cols = Math.min(count, DIAGRAM_COLS);
  const rows = Math.ceil(count / cols);
  const totalW = cols * BLOCK_W + (cols - 1) * DIAGRAM_GAP;
  const totalH = rows * BLOCK_H + (rows - 1) * DIAGRAM_GAP;
  const startX = center.x - totalW / 2;
  const startY = center.y - totalH / 2;
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({ x: startX + col * (BLOCK_W + DIAGRAM_GAP), y: startY + row * (BLOCK_H + DIAGRAM_GAP) });
  }
  return positions;
}

function parseDiagram(raw?: string | null): AiGhostDiagram | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { blocks?: AiGhostBlock[]; edges?: AiGhostEdge[] };
    if (!Array.isArray(parsed.blocks)) return null;
    return { blocks: parsed.blocks, edges: Array.isArray(parsed.edges) ? parsed.edges : [] };
  } catch {
    return null;
  }
}

function insertGhost(editor: Editor, blocks: AiGhostBlock[], index: number, onInserted: (label: string) => void) {
  const viewport = editor.getViewportScreenBounds();
  const center = editor.screenToPage({ x: viewport.midX, y: viewport.midY });
  const block = blocks[index];
  const w = 180;
  const h = 90;
  const gap = 24;
  const row = Math.floor(index / 3);
  const col = index % 3;
  const x = center.x + (col - 1) * (w + gap) - w / 2;
  const y = center.y + 40 + row * (h + gap) - h / 2;
  const color = kindColor(block.kind);
  const ids = [createShapeId(), createShapeId()];

  editor.createShapes([
    {
      id: ids[0],
      type: 'geo',
      x,
      y,
      props: {
        geo: 'rectangle',
        w,
        h,
        color,
        fill: 'semi',
        richText: toRichText(block.label),
      },
    },
    {
      id: ids[1],
      type: 'text',
      x,
      y: y + h + 6,
      props: {
        color: 'grey',
        richText: toRichText(block.description ?? `${block.kind} component`),
      },
    },
  ]);
  // Select + frame the placed block, matching the block library — the shape
  // you just brought in is the thing you want to look at.
  editor.setSelectedShapes(ids);
  editor.zoomToSelection({ animation: { duration: 200 } });
  onInserted(block.label);
}

function insertDiagram(editor: Editor, diagram: AiGhostDiagram, onInserted: () => void) {
  if (diagram.blocks.length === 0) return;
  const viewport = editor.getViewportScreenBounds();
  const center = editor.screenToPage({ x: viewport.midX, y: viewport.midY });
  const positions = layoutDiagram(diagram.blocks.length, center);
  const shapes: Parameters<typeof editor.createShapes>[0] = [];
  const shapeIds: TLShapeId[] = [];
  const bindings: {
    type: 'arrow';
    fromId: TLShapeId;
    toId: TLShapeId;
    props: { terminal: 'start' | 'end'; normalizedAnchor: { x: number; y: number }; isExact: boolean };
  }[] = [];

  diagram.blocks.forEach((block, i) => {
    const pos = positions[i];
    const id = createShapeId();
    shapeIds.push(id);
    shapes.push({
      id,
      type: 'geo',
      x: pos.x,
      y: pos.y,
      props: {
        geo: 'rectangle',
        w: BLOCK_W,
        h: BLOCK_H,
        color: kindColor(block.kind),
        fill: 'semi',
        richText: toRichText(block.label),
      },
    });
    if (block.description) {
      shapes.push({
        id: createShapeId(),
        type: 'text',
        x: pos.x,
        y: pos.y + BLOCK_H + 6,
        props: { color: 'grey', richText: toRichText(block.description) },
      });
    }
  });

  diagram.edges.forEach((edge) => {
    const a = positions[edge.from];
    const b = positions[edge.to];
    if (!a || !b) return;
    const arrowId = createShapeId();
    shapes.push({
      id: arrowId,
      type: 'arrow',
      x: a.x + BLOCK_W / 2,
      y: a.y + BLOCK_H / 2,
      props: { color: 'grey', arrowheadEnd: 'arrow' },
    });
    bindings.push(
      {
        type: 'arrow',
        fromId: arrowId,
        toId: shapeIds[edge.from],
        props: { terminal: 'start', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false },
      },
      {
        type: 'arrow',
        fromId: arrowId,
        toId: shapeIds[edge.to],
        props: { terminal: 'end', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false },
      }
    );
    if (edge.label) {
      shapes.push({
        id: createShapeId(),
        type: 'text',
        x: (a.x + b.x) / 2 + BLOCK_W / 2 - 20,
        y: (a.y + b.y) / 2 + BLOCK_H / 2 - 12,
        props: { color: 'grey', richText: toRichText(edge.label) },
      });
    }
  });

  editor.createShapes(shapes);
  if (bindings.length > 0) editor.createBindings(bindings);
  editor.setSelectedShapes(shapeIds);
  editor.zoomToSelection({ animation: { duration: 200 } });
  onInserted();
}

export interface AiCopilot {
  prompt: string;
  setPrompt: (v: string) => void;
  isAsking: boolean;
  error: string | null;
  inserted: string | null;
  setInserted: (v: string | null) => void;
  selectedCount: number;
  clearSelection: () => void;
  handleAsk: () => Promise<void>;
  feedOpen: boolean;
  openFeed: () => void;
  closeFeed: () => void;
}

export function useAiCopilot(opts: {
  roomId: Id<'rooms'> | undefined;
  editor: Editor | null;
  readOnly?: boolean;
}): AiCopilot {
  const { roomId, editor, readOnly } = opts;
  const [prompt, setPrompt] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inserted, setInserted] = useState<string | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [feedOpen, setFeedOpen] = useState(false);

  const requestAi = useAction(api.ai.requestAiSuggestion);

  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const n = editor.getSelectedShapeIds().length;
      setSelectedCount((prev) => (prev === n ? prev : n));
    };
    sync();
    const unlisten = editor.store.listen(() => requestAnimationFrame(sync));
    return () => unlisten();
  }, [editor]);

  const buildContext = useCallback(() => {
    if (!editor) return undefined;
    const shapes = editor.getSelectedShapes().slice(0, 30);
    if (shapes.length === 0) return undefined;
    return shapes.map((s) => {
      const text = editor.getShapeUtil(s).getText(s)?.trim();
      return { label: text || SHAPE_LABEL[s.type] || s.type, kind: s.type };
    });
  }, [editor]);

  const handleAsk = useCallback(async () => {
    const text = prompt.trim();
    if (!text || isAsking || !roomId || readOnly) return;
    setPrompt('');
    setIsAsking(true);
    setError(null);
    setInserted(null);
    setFeedOpen(true);
    try {
      await requestAi({ roomId, prompt: text, context: buildContext() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the AI right now.');
    } finally {
      setIsAsking(false);
    }
  }, [prompt, isAsking, roomId, readOnly, requestAi, buildContext]);

  return {
    prompt,
    setPrompt,
    isAsking,
    error,
    inserted,
    setInserted,
    selectedCount,
    clearSelection: useCallback(() => editor?.setSelectedShapes([]), [editor]),
    handleAsk,
    feedOpen,
    openFeed: useCallback(() => setFeedOpen(true), []),
    closeFeed: useCallback(() => setFeedOpen(false), []),
  };
}

export function parseAiDiagram(raw?: string | null): AiGhostDiagram | null {
  return parseDiagram(raw);
}

export function insertGhostBlock(editor: Editor, blocks: AiGhostBlock[], index: number, onInserted: (label: string) => void) {
  insertGhost(editor, blocks, index, onInserted);
}

export function insertFullDiagram(editor: Editor, diagram: AiGhostDiagram, onInserted: () => void) {
  insertDiagram(editor, diagram, onInserted);
}

export function ghostKindColor(kind: string) {
  return kindColor(kind);
}
