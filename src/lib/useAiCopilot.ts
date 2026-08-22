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
const DESC_GAP = 12;
const BLOCK_GAP_X = 60;
const BLOCK_GAP_Y = 50;
const CELL_H = BLOCK_H + DESC_GAP + 24 + BLOCK_GAP_Y;

export const AI_REFINE_SUGGESTIONS = [
  'Add a step to this flow',
  'Explain these blocks',
  'Reorganize this diagram',
];

interface Rect { x: number; y: number; w: number; h: number }

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function collectExistingRects(editor: Editor): Rect[] {
  const shapes = editor.getCurrentPageShapes();
  const rects: Rect[] = [];
  for (const s of shapes) {
    const b = editor.getShapePageBounds(s.id);
    if (b) rects.push({ x: b.x, y: b.y, w: b.width, h: b.height });
  }
  return rects;
}

function resolvePosition(
  proposed: Rect,
  occupied: Rect[],
): { x: number; y: number } {
  let { x, y } = proposed;
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate: Rect = { x, y, w: proposed.w, h: proposed.h };
    if (!occupied.some((r) => rectsOverlap(candidate, r))) return { x, y };
    x += BLOCK_W + BLOCK_GAP_X;
    if (attempt % 3 === 2) {
      x = proposed.x;
      y += CELL_H;
    }
  }
  return { x, y };
}

function layoutDiagram(count: number, center: { x: number; y: number }, existingBounds?: Rect) {
  const cols = Math.min(count, 3);
  const rows = Math.ceil(count / cols);
  const totalW = cols * BLOCK_W + (cols - 1) * BLOCK_GAP_X;
  const totalH = rows * CELL_H - BLOCK_GAP_Y;

  let startX = center.x - totalW / 2;
  let startY = center.y - totalH / 2;

  if (existingBounds) {
    startX = existingBounds.x + existingBounds.w + BLOCK_GAP_X * 2;
    startY = existingBounds.y;
  }

  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      x: startX + col * (BLOCK_W + BLOCK_GAP_X),
      y: startY + row * CELL_H,
    });
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
  const row = Math.floor(index / 3);
  const col = index % 3;
  const rawX = center.x + (col - 1) * (BLOCK_W + BLOCK_GAP_X) - BLOCK_W / 2;
  const rawY = center.y + 40 + row * CELL_H;

  const occupied = collectExistingRects(editor);
  const cell: Rect = { x: rawX, y: rawY, w: BLOCK_W, h: CELL_H };
  const pos = resolvePosition(cell, occupied);
  const color = kindColor(block.kind);
  const ids = [createShapeId(), createShapeId()];

  editor.createShapes([
    {
      id: ids[0],
      type: 'geo',
      x: pos.x,
      y: pos.y,
      props: {
        geo: 'rectangle',
        w: BLOCK_W,
        h: BLOCK_H,
        color,
        fill: 'semi',
        richText: toRichText(block.label),
      },
    },
    {
      id: ids[1],
      type: 'text',
      x: pos.x,
      y: pos.y + BLOCK_H + 12,
      props: {
        color: 'grey',
        size: 's',
        w: BLOCK_W,
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

function geoShapeForKind(kind: string) {
  switch (kind) {
    case 'ellipse':
    case 'cloud':
      return 'ellipse' as const;
    case 'diamond':
      return 'diamond' as const;
    default:
      return 'rectangle' as const;
  }
}

function insertDiagram(editor: Editor, diagram: AiGhostDiagram, onInserted: () => void) {
  if (diagram.blocks.length === 0) return;
  const viewport = editor.getViewportScreenBounds();
  const center = editor.screenToPage({ x: viewport.midX, y: viewport.midY });
  const existingBounds = editor.getCurrentPageBounds();
  const rawPositions = layoutDiagram(diagram.blocks.length, center, existingBounds ? { x: existingBounds.x, y: existingBounds.y, w: existingBounds.width, h: existingBounds.height } : undefined);

  const occupied = collectExistingRects(editor);
  const positions = rawPositions.map((pos) => {
    const cell: Rect = { x: pos.x, y: pos.y, w: BLOCK_W, h: CELL_H };
    return resolvePosition(cell, occupied);
  });

  positions.forEach((p) => occupied.push({ x: p.x, y: p.y, w: BLOCK_W, h: CELL_H }));
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
    const color = kindColor(block.kind);
    const geo = geoShapeForKind(block.kind);
    shapes.push({
      id,
      type: 'geo',
      x: pos.x,
      y: pos.y,
      props: {
        geo,
        w: BLOCK_W,
        h: BLOCK_H,
        color,
        fill: 'semi',
        richText: toRichText(block.label),
      },
    });
    if (block.description) {
      const descId = createShapeId();
      shapeIds.push(descId);
      shapes.push({
        id: descId,
        type: 'text',
        x: pos.x,
        y: pos.y + BLOCK_H + 12,
        props: {
          color: 'grey',
          size: 's',
          w: BLOCK_W,
          richText: toRichText(block.description),
        },
      });
    }
  });

  diagram.edges.forEach((edge) => {
    const a = positions[edge.from];
    const b = positions[edge.to];
    if (!a || !b) return;
    const arrowId = createShapeId();
    const arrowX = a.x + BLOCK_W;
    const arrowY = a.y + BLOCK_H / 2;
    shapes.push({
      id: arrowId,
      type: 'arrow',
      x: arrowX,
      y: arrowY,
      props: { color: 'grey', arrowheadEnd: 'arrow' },
    });
    bindings.push(
      {
        type: 'arrow',
        fromId: arrowId,
        toId: shapeIds[edge.from],
        props: { terminal: 'start', normalizedAnchor: { x: 1, y: 0.5 }, isExact: true },
      },
      {
        type: 'arrow',
        fromId: arrowId,
        toId: shapeIds[edge.to],
        props: { terminal: 'end', normalizedAnchor: { x: 0, y: 0.5 }, isExact: true },
      }
    );
    if (edge.label) {
      const labelX = (a.x + b.x) / 2 + BLOCK_W / 2;
      const labelY = (a.y + b.y) / 2 + BLOCK_H / 2 - 16;
      const labelCell: Rect = { x: labelX, y: labelY, w: 140, h: 20 };
      const labelPos = resolvePosition(labelCell, occupied);
      occupied.push({ x: labelPos.x, y: labelPos.y, w: 140, h: 20 });
      shapes.push({
        id: createShapeId(),
        type: 'text',
        x: labelPos.x,
        y: labelPos.y,
        props: { color: 'grey', size: 's', richText: toRichText(edge.label) },
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

  const requestAi = useAction(api.features.ai.requestAiSuggestion);

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
    const allShapes = editor.getCurrentPageShapes().slice(0, 60);
    if (allShapes.length === 0) return undefined;
    const selectedIds = new Set(editor.getSelectedShapeIds());
    return allShapes.map((s) => {
      const text = editor.getShapeUtil(s).getText(s)?.trim();
      const bounds = editor.getShapePageBounds(s.id);
      return {
        label: text || SHAPE_LABEL[s.type] || s.type,
        kind: s.type,
        x: bounds?.x ?? 0,
        y: bounds?.y ?? 0,
        selected: selectedIds.has(s.id),
      };
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
