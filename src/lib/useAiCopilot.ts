import { useCallback, useEffect, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { CanvasApi, CanvasBounds } from '../canvas/api';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import {
  boundTextOf,
  createArrowElement,
  createShapeElements,
  createTextElement,
} from '../canvas/elements';
import { INK } from '../canvas/ink';
import { BLOCK_H, kindFill, kindStroke } from './blockKinds';

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
  rectangle: 'rectangle',
  text: 'text',
  arrow: 'arrow',
  line: 'line',
  ellipse: 'ellipse',
  diamond: 'diamond',
  freedraw: 'drawing',
  image: 'image',
  frame: 'frame',
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

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function collectExistingRects(api: CanvasApi): Rect[] {
  return api.elements.map((element) => api.boundsOf(element));
}

function resolvePosition(proposed: Rect, occupied: Rect[]): { x: number; y: number } {
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

function layoutDiagram(
  blocks: AiGhostBlock[],
  center: { x: number; y: number },
  existingBounds?: CanvasBounds,
) {
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
    // The copilot places *beside* the work, never on top of it.
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

function insertGhost(
  api: CanvasApi,
  blocks: AiGhostBlock[],
  index: number,
  onInserted: (label: string) => void,
) {
  const block = blocks[index];
  if (!block) return;
  const view = api.viewportBounds();
  const center = { x: view.x + view.w / 2, y: view.y + view.h / 2 };
  const blockW = estimateBlockWidth(block.label);
  const uh = unitHeight(blockW, block.description);

  const row = Math.floor(index / 3);
  const col = index % 3;
  const rawX = center.x + (col - 1) * (blockW + ARROW_GAP) - blockW / 2;
  const rawY = center.y + 40 + row * uh;

  const uw = unitWidth(blockW, block.description);
  const occupied = collectExistingRects(api);
  const pos = resolvePosition({ x: rawX, y: rawY, w: uw, h: uh }, occupied);

  const elements: ExcalidrawElement[] = createShapeElements({
    kind: 'rectangle',
    x: pos.x,
    y: pos.y,
    width: blockW,
    height: BLOCK_H,
    label: block.label,
    style: { stroke: kindStroke(block.kind), fill: kindFill(block.kind), strokeWidth: 1.25 },
    labelStyle: { stroke: INK.ink },
  });

  if (block.description) {
    elements.push(
      createTextElement({
        x: pos.x,
        y: pos.y + BLOCK_H + DESC_GAP,
        text: block.description,
        fontSize: 12,
        width: blockW,
        style: { stroke: INK.ink4 },
      }),
    );
  }

  api.addElements(elements, { select: true });
  api.setTool('select');
  api.zoomToBounds({ x: pos.x, y: pos.y, w: uw, h: uh }, { inset: 200, targetZoom: 0.9 });
  onInserted(block.label);
}

function geoShapeForKind(kind: string): 'rectangle' | 'ellipse' | 'diamond' {
  switch (kind) {
    case 'ellipse':
    case 'cloud':
      return 'ellipse';
    case 'diamond':
      return 'diamond';
    default:
      return 'rectangle';
  }
}

function insertDiagram(api: CanvasApi, diagram: AiGhostDiagram, onInserted: () => void) {
  if (diagram.blocks.length === 0) return;
  const view = api.viewportBounds();
  const center = { x: view.x + view.w / 2, y: view.y + view.h / 2 };
  const existing = api.contentBounds();
  const { positions, widths, unitHeights, unitWidths } = layoutDiagram(
    diagram.blocks,
    center,
    existing ?? undefined,
  );

  const occupied = collectExistingRects(api);
  const resolved = positions.map((pos, i) => {
    const cell: Rect = { x: pos.x, y: pos.y, w: unitWidths[i], h: unitHeights[i] };
    const resolvedPos = resolvePosition(cell, occupied);
    occupied.push({ x: resolvedPos.x, y: resolvedPos.y, w: unitWidths[i], h: unitHeights[i] });
    return resolvedPos;
  });

  const elements: ExcalidrawElement[] = [];
  const blockIds: string[] = [];

  diagram.blocks.forEach((block, i) => {
    const pos = resolved[i];
    const bw = widths[i];
    const built = createShapeElements({
      kind: geoShapeForKind(block.kind),
      x: pos.x,
      y: pos.y,
      width: bw,
      height: BLOCK_H,
      label: block.label,
      style: { stroke: kindStroke(block.kind), fill: kindFill(block.kind), strokeWidth: 1.25 },
      labelStyle: { stroke: INK.ink },
    });
    elements.push(...built);
    blockIds.push(built[0].id);

    if (block.description) {
      elements.push(
        createTextElement({
          x: pos.x,
          y: pos.y + BLOCK_H + DESC_GAP,
          text: block.description,
          fontSize: 12,
          width: bw,
          style: { stroke: INK.ink4 },
        }),
      );
    }
  });

  // Edges are drawn edge-to-edge: the arrow starts where the source block ends
  // and stops where the target begins, so a label has somewhere to sit.
  for (const edge of diagram.edges) {
    const a = resolved[edge.from];
    const b = resolved[edge.to];
    if (!a || !b) continue;
    const aW = widths[edge.from];
    const bW = widths[edge.to];
    const rightward = b.x >= a.x;
    const from = {
      x: rightward ? a.x + aW : a.x,
      y: a.y + BLOCK_H / 2,
    };
    const to = {
      x: rightward ? b.x : b.x + bW,
      y: b.y + BLOCK_H / 2,
    };
    elements.push(
      createArrowElement({
        from,
        to,
        style: { stroke: INK.ink3, strokeWidth: 1 },
        endArrowhead: 'arrow',
      }),
    );
    if (edge.label) {
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const labelCell: Rect = { x: midX - 70, y: midY - 24, w: 140, h: 20 };
      const labelPos = resolvePosition(labelCell, occupied);
      occupied.push({ x: labelPos.x, y: labelPos.y, w: 140, h: 20 });
      elements.push(
        createTextElement({
          x: labelPos.x,
          y: labelPos.y,
          text: edge.label,
          fontSize: 12,
          style: { stroke: INK.ink4 },
        }),
      );
    }
  }

  api.addElements(elements);
  api.select(blockIds);
  const bounds = api.boundsOfIds(blockIds);
  if (bounds) api.zoomToBounds(bounds, { inset: 160, targetZoom: 0.9 });
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

/** Text of a shape's label, so the copilot reads the board the way people do. */
function elementLabel(api: CanvasApi, element: ExcalidrawElement): string {
  if (element.type === 'text') return element.text;
  const [text] = boundTextOf(api.elements, element);
  if (text && text.type === 'text' && text.text) return text.text;
  return SHAPE_LABEL[element.type] ?? element.type;
}

export function useAiCopilot(opts: {
  roomId: Id<'rooms'> | undefined;
  api: CanvasApi | null;
  readOnly?: boolean;
}): AiCopilot {
  const { roomId, api: canvas, readOnly } = opts;
  const [prompt, setPrompt] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inserted, setInserted] = useState<string | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [feedOpen, setFeedOpen] = useState(false);

  const requestAi = useAction(api.features.ai.requestAiSuggestion);

  useEffect(() => {
    if (!canvas) return;
    const sync = () => {
      const n = canvas.selectionIds.length;
      setSelectedCount((prev) => (prev === n ? prev : n));
    };
    sync();
    return canvas.subscribe(sync);
  }, [canvas]);

  const buildContext = useCallback(() => {
    if (!canvas) return undefined;
    const all = canvas.elements;
    if (all.length === 0) return undefined;
    const selectedIds = new Set(canvas.selectionIds);
    const view = canvas.viewportBounds();
    const viewCx = view.x + view.w / 2;
    const viewCy = view.y + view.h / 2;

    // Score elements: selected > in viewport > near viewport > distant.
    const scored = all.map((element) => {
      const bounds = canvas.boundsOf(element);
      const isSelected = selectedIds.has(element.id);
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      const inView =
        cx >= view.x && cx <= view.x + view.w && cy >= view.y && cy <= view.y + view.h;
      const dist = Math.hypot(cx - viewCx, cy - viewCy);
      const score = isSelected ? -2 : inView ? dist : dist + 10000;
      return { element, bounds, isSelected, score };
    });

    scored.sort((a, b) => a.score - b.score);

    return scored.slice(0, 60).map(({ element, bounds, isSelected }) => ({
      label: elementLabel(canvas, element),
      kind: element.type,
      x: bounds.x,
      y: bounds.y,
      selected: isSelected,
    }));
  }, [canvas]);

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
    clearSelection: useCallback(() => canvas?.clearSelection(), [canvas]),
    handleAsk,
    feedOpen,
    openFeed: useCallback(() => setFeedOpen(true), []),
    closeFeed: useCallback(() => setFeedOpen(false), []),
  };
}

export function parseAiDiagram(raw?: string | null): AiGhostDiagram | null {
  return parseDiagram(raw);
}

export function insertGhostBlock(
  canvas: CanvasApi,
  blocks: AiGhostBlock[],
  index: number,
  onInserted: (label: string) => void,
) {
  insertGhost(canvas, blocks, index, onInserted);
}

export function insertFullDiagram(canvas: CanvasApi, diagram: AiGhostDiagram, onInserted: () => void) {
  insertDiagram(canvas, diagram, onInserted);
}

/** One neutral tone: a ghost is a proposal, not a second palette. */
export function ghostKindColor(): string {
  return 'ink';
}
