import { useCallback, useEffect, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { Editor, TLShapeId } from 'tldraw';
import { toRichText, createShapeId } from 'tldraw';
import { kindColor, BLOCK_W, BLOCK_H } from './blockKinds';

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

const DESC_GAP = 12;
const DESC_LINE_HEIGHT = 20;
const MIN_BLOCK_W = 120;
const MAX_BLOCK_W = 280;
const ARROW_GAP = 20;

function estimateBlockWidth(label: string): number {
  const charWidth = 8;
  const padding = 32;
  const estimated = label.length * charWidth + padding;
  return Math.max(MIN_BLOCK_W, Math.min(MAX_BLOCK_W, estimated));
}

function estimateDescWidth(description: string, blockWidth: number): number {
  if (!description) return 0;
  const charsPerLine = Math.floor((blockWidth - 16) / 8);
  const lines = Math.ceil(description.length / charsPerLine);
  if (lines <= 1) return description.length * 8 + 16;
  return blockWidth;
}

function estimateDescHeight(description: string, blockWidth: number): number {
  if (!description) return 0;
  const charsPerLine = Math.floor((blockWidth - 16) / 8);
  const lines = Math.ceil(description.length / charsPerLine);
  return lines * DESC_LINE_HEIGHT;
}

function unitHeight(blockWidth: number, description?: string): number {
  const descH = estimateDescHeight(description ?? '', blockWidth);
  return BLOCK_H + (descH > 0 ? DESC_GAP + descH : 0);
}

function unitWidth(blockWidth: number, description?: string): number {
  const descW = estimateDescWidth(description ?? '', blockWidth);
  return Math.max(blockWidth, descW);
}

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
    x += proposed.w + ARROW_GAP;
    if (attempt % 3 === 2) {
      x = proposed.x;
      y += proposed.h + ARROW_GAP;
    }
  }
  return { x, y };
}

function layoutDiagram(blocks: AiGhostBlock[], center: { x: number; y: number }, existingBounds?: Rect) {
  const widths = blocks.map((b) => estimateBlockWidth(b.label));
  const heights = blocks.map((b, i) => unitHeight(widths[i], b.description));
  const unitWidths = blocks.map((b, i) => unitWidth(widths[i], b.description));
  const count = blocks.length;
  const cols = Math.min(count, 3);

  const rowHs: number[] = [];
  for (let r = 0; r < Math.ceil(count / cols); r++) {
    let rowMax = 0;
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx < count) rowMax = Math.max(rowMax, heights[idx]);
    }
    rowHs.push(rowMax);
  }

  let totalW = 0;
  for (let c = 0; c < cols; c++) {
    let colMax = 0;
    for (let r = 0; r < Math.ceil(count / cols); r++) {
      const idx = r * cols + c;
      if (idx < count) colMax = Math.max(colMax, unitWidths[idx]);
    }
    totalW += colMax;
  }
  totalW += (cols - 1) * ARROW_GAP;

  const totalH = rowHs.reduce((a, b) => a + b, 0) + (rowHs.length - 1) * ARROW_GAP;

  let startX = center.x - totalW / 2;
  let startY = center.y - totalH / 2;

  if (existingBounds) {
    startX = existingBounds.x + existingBounds.w + ARROW_GAP * 2;
    startY = existingBounds.y;
  }

  const positions: { x: number; y: number }[] = [];
  let yCursor = startY;
  for (let r = 0; r < Math.ceil(count / cols); r++) {
    let xCursor = startX;
    const rowHeight = rowHs[r];
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= count) break;
      positions[idx] = { x: xCursor, y: yCursor };
      xCursor += unitWidths[idx] + ARROW_GAP;
    }
    yCursor += rowHeight + ARROW_GAP;
  }

  return { positions, widths, unitHeights: heights, unitWidths };
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
  const blockW = estimateBlockWidth(block.label);
  const uh = unitHeight(blockW, block.description);

  const row = Math.floor(index / 3);
  const col = index % 3;
  const rawX = center.x + (col - 1) * (blockW + ARROW_GAP) - blockW / 2;
  const rawY = center.y + 40 + row * uh;

  const uw = unitWidth(blockW, block.description);
  const occupied = collectExistingRects(editor);
  const cell: Rect = { x: rawX, y: rawY, w: uw, h: uh };
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
        w: blockW,
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
      y: pos.y + BLOCK_H + DESC_GAP,
      props: {
        color: 'grey',
        size: 's',
        w: blockW,
        richText: toRichText(block.description ?? `${block.kind} component`),
      },
    },
  ]);
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
  const { positions, widths, unitHeights, unitWidths } = layoutDiagram(
    diagram.blocks,
    center,
    existingBounds
      ? { x: existingBounds.x, y: existingBounds.y, w: existingBounds.width, h: existingBounds.height }
      : undefined,
  );

  const occupied = collectExistingRects(editor);
  const resolved = positions.map((pos, i) => {
    const cell: Rect = { x: pos.x, y: pos.y, w: unitWidths[i], h: unitHeights[i] };
    const resolvedPos = resolvePosition(cell, occupied);
    occupied.push({ x: resolvedPos.x, y: resolvedPos.y, w: unitWidths[i], h: unitHeights[i] });
    return resolvedPos;
  });
  const shapes: Parameters<typeof editor.createShapes>[0] = [];
  const shapeIds: TLShapeId[] = [];
  const bindings: {
    type: 'arrow';
    fromId: TLShapeId;
    toId: TLShapeId;
    props: { terminal: 'start' | 'end'; normalizedAnchor: { x: number; y: number }; isExact: boolean };
  }[] = [];

  diagram.blocks.forEach((block, i) => {
    const pos = resolved[i];
    const bw = widths[i];
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
        w: bw,
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
        y: pos.y + BLOCK_H + DESC_GAP,
        props: {
          color: 'grey',
          size: 's',
          w: bw,
          richText: toRichText(block.description),
        },
      });
    }
  });

  diagram.edges.forEach((edge) => {
    const a = resolved[edge.from];
    const b = resolved[edge.to];
    if (!a || !b) return;
    const aW = widths[edge.from];
    const arrowId = createShapeId();
    const arrowX = a.x + aW;
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
      const labelX = (a.x + aW + b.x) / 2 - 70;
      const labelY = (a.y + b.y) / 2 + BLOCK_H / 2 - 10;
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
    const allShapes = editor.getCurrentPageShapes();
    if (allShapes.length === 0) return undefined;
    const selectedIds = new Set(editor.getSelectedShapeIds());
    const viewport = editor.getViewportPageBounds();
    const viewCx = viewport.x + viewport.width / 2;
    const viewCy = viewport.y + viewport.height / 2;

    // Score shapes: selected > in viewport > near viewport > distant
    const scored = allShapes.map((s) => {
      const bounds = editor.getShapePageBounds(s.id);
      const isSelected = selectedIds.has(s.id);
      if (!bounds) return { shape: s, score: isSelected ? -2 : 9999, isSelected };
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      const inView = cx >= viewport.x && cx <= viewport.x + viewport.width &&
                     cy >= viewport.y && cy <= viewport.y + viewport.height;
      const dist = Math.hypot(cx - viewCx, cy - viewCy);
      // Selected shapes get priority (-2), in-viewport shapes get their distance,
      // out-of-viewport shapes get distance + large penalty
      const score = isSelected ? -2 : inView ? dist : dist + 10000;
      return { shape: s, score, isSelected };
    });

    // Sort by score (selected first, then by proximity to viewport center)
    scored.sort((a, b) => a.score - b.score);
    const top60 = scored.slice(0, 60);

    return top60.map(({ shape: s }) => {
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
