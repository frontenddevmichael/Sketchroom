/**
 * One-way conversion from the rooms we already have to the free engine.
 *
 * Rooms in production store tldraw's canonical record map
 * `{ [recordId]: TLRecord }` (see `convex/features/canvas.ts`). Excalidraw
 * reads its own element array, so a legacy blob is translated on load, once,
 * and only the new format is ever written back.
 *
 * Elements are built here rather than through the editor package's
 * `convertToExcalidrawElements` on purpose: this module runs on the data path
 * (and in unit tests) where importing the whole editor — with its UI, canvas
 * and font machinery — would be both slow and brittle.
 *
 * Everything that cannot be represented (images, bookmarks, embeds, video) is
 * counted in `skipped` instead of being silently dropped, so the room can tell
 * the user what did not come across.
 */
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { INK, fillFor, inkFor, strokeStyleFor, strokeWidthFor } from './ink';

export interface LegacyRecord {
  id?: string;
  typeName?: string;
  type?: string;
  x?: number;
  y?: number;
  rotation?: number;
  index?: string;
  parentId?: string;
  isLocked?: boolean;
  meta?: Record<string, unknown>;
  props?: Record<string, unknown>;
}

export interface ConversionResult {
  elements: ExcalidrawElement[];
  /** Legacy shape types that have no Excalidraw equivalent, with counts. */
  skipped: Record<string, number>;
}

/** Shapes whose semantics have no free-engine counterpart. */
const UNSUPPORTED = new Set(['image', 'video', 'embed', 'bookmark', 'highlight', 'iframe']);

const GEO_TYPE: Record<string, 'rectangle' | 'ellipse' | 'diamond'> = {
  rectangle: 'rectangle',
  ellipse: 'ellipse',
  oval: 'ellipse',
  circle: 'ellipse',
  diamond: 'diamond',
  rhombus: 'diamond',
};

/** Excalidraw's "Liberation Sans" — the neutral face of the shipped set. */
const FONT_LIBERATION_SANS = 9;
const LINE_HEIGHT = 1.25;
const DEFAULT_FONT_SIZE = 16;

/** Flatten a tldraw rich-text (ProseMirror) doc to plain text. */
export function plainText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown[] };
  if (typeof node.text === 'string' && !node.content) return node.text;

  const blocks: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) blocks.push(current.join(''));
    current = [];
  };
  const walk = (nodes: unknown[]) => {
    for (const child of nodes) {
      if (!child || typeof child !== 'object') continue;
      const item = child as { type?: string; text?: string; content?: unknown[] };
      if (typeof item.text === 'string') current.push(item.text);
      if (Array.isArray(item.content)) {
        walk(item.content);
        if (item.type === 'paragraph' || item.type === 'heading') flush();
      }
    }
  };
  if (Array.isArray(node.content)) walk(node.content);
  flush();
  return blocks.join('\n').trim();
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function pointList(value: unknown): { x: number; y: number }[] {
  if (!Array.isArray(value)) return [];
  const out: { x: number; y: number }[] = [];
  for (const p of value) {
    if (!p || typeof p !== 'object') continue;
    const point = p as { x?: unknown; y?: unknown };
    if (typeof point.x === 'number' && typeof point.y === 'number') {
      out.push({ x: point.x, y: point.y });
    }
  }
  return out;
}

/** tldraw stores freehand strokes as segments of raw points. */
function drawPoints(props: Record<string, unknown>): { x: number; y: number }[] {
  const segments = props.segments;
  if (!Array.isArray(segments)) return [];
  const points: { x: number; y: number }[] = [];
  for (const segment of segments) {
    if (!segment || typeof segment !== 'object') continue;
    points.push(...pointList((segment as { points?: unknown }).points));
  }
  return points;
}

let sequence = 0;

function elementId(): string {
  sequence += 1;
  return `sk-${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function seed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

interface CommonOpts {
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  strokeColor: string;
  backgroundColor?: string;
  fillStyle?: 'solid' | 'hachure' | 'cross-hatch' | 'zigzag';
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  roughness?: number;
  opacity?: number;
  customData?: Record<string, unknown>;
}

/**
 * The shared element envelope. `index` is intentionally null — Excalidraw
 * normalises null indices into fractional ones when the scene is restored.
 */
function base(opts: CommonOpts): Record<string, unknown> {
  return {
    id: elementId(),
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    angle: opts.angle ?? 0,
    strokeColor: opts.strokeColor,
    backgroundColor: opts.backgroundColor ?? 'transparent',
    fillStyle: opts.fillStyle ?? 'solid',
    strokeWidth: opts.strokeWidth ?? 1.25,
    strokeStyle: opts.strokeStyle ?? 'solid',
    roughness: opts.roughness ?? 0,
    opacity: opts.opacity ?? 100,
    roundness: null,
    seed: seed(),
    version: 1,
    versionNonce: seed(),
    index: null,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    ...(opts.customData ? { customData: opts.customData } : {}),
  };
}

function estimateTextSize(text: string) {
  const lines = text.split('\n');
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  return {
    width: Math.max(10, Math.round(longest * DEFAULT_FONT_SIZE * 0.55)),
    height: Math.max(
      DEFAULT_FONT_SIZE * LINE_HEIGHT,
      Math.round(lines.length * DEFAULT_FONT_SIZE * LINE_HEIGHT),
    ),
  };
}

function textElement(opts: {
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize?: number;
  width?: number;
  height?: number;
  containerId?: string;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  angle?: number;
  customData?: Record<string, unknown>;
}) {
  const size = estimateTextSize(opts.text);
  return {
    ...base({
      x: opts.x,
      y: opts.y,
      width: opts.width ?? size.width,
      height: opts.height ?? size.height,
      angle: opts.angle,
      strokeColor: opts.color,
      strokeWidth: 1,
      customData: opts.customData,
    }),
    type: 'text',
    fontSize: opts.fontSize ?? DEFAULT_FONT_SIZE,
    fontFamily: FONT_LIBERATION_SANS,
    text: opts.text,
    originalText: opts.text,
    textAlign: opts.textAlign ?? 'left',
    verticalAlign: opts.verticalAlign ?? 'top',
    containerId: opts.containerId ?? null,
    autoResize: !opts.containerId,
    lineHeight: LINE_HEIGHT,
  } as unknown as ExcalidrawElement;
}

function shapeElements(
  type: 'rectangle' | 'diamond' | 'ellipse',
  opts: CommonOpts & { roundness?: number; label?: { text: string; color: string; align: 'left' | 'center' } },
): ExcalidrawElement[] {
  const element = {
    ...base(opts),
    type,
    roundness:
      type === 'rectangle' && opts.roundness ? { type: 3 as const, value: opts.roundness } : null,
  } as Record<string, unknown>;

  if (!opts.label || !opts.label.text) return [element as unknown as ExcalidrawElement];

  const padding = 8;
  const text = textElement({
    x: opts.x + padding,
    y: opts.y + opts.height / 2 - (estimateTextSize(opts.label.text).height || 0) / 2,
    text: opts.label.text,
    color: opts.label.color,
    width: Math.max(10, opts.width - padding * 2),
    containerId: element.id as string,
    textAlign: opts.label.align,
    verticalAlign: 'middle',
    angle: opts.angle,
  });
  element.boundElements = [{ type: 'text', id: text.id }];
  return [element as unknown as ExcalidrawElement, text];
}

function linearElement(
  type: 'line' | 'arrow',
  opts: CommonOpts & {
    points: [number, number][];
    startArrowhead?: 'arrow' | null;
    endArrowhead?: 'arrow' | null;
  },
): ExcalidrawElement {
  const xs = opts.points.map((p) => p[0]);
  const ys = opts.points.map((p) => p[1]);
  const element = {
    ...base({
      ...opts,
      width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
      height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
    }),
    type,
    points: opts.points,
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: opts.startArrowhead ?? null,
    endArrowhead: type === 'arrow' ? (opts.endArrowhead ?? 'arrow') : null,
    ...(type === 'arrow' ? { elbowed: false } : {}),
  };
  return element as unknown as ExcalidrawElement;
}

function frameElement(opts: CommonOpts & { name: string }): ExcalidrawElement {
  return {
    ...base(opts),
    type: 'frame',
    name: opts.name,
  } as unknown as ExcalidrawElement;
}

function buildShape(record: LegacyRecord): ExcalidrawElement[] | null {
  const type = record.type ?? '';
  if (UNSUPPORTED.has(type)) return null;

  const props = record.props ?? {};
  const x = num(record.x);
  const y = num(record.y);
  const angle = -(num(record.rotation)) * (180 / Math.PI);
  const strokeColor = inkFor(props.color as string | undefined);
  const strokeWidth = strokeWidthFor(props.size as string | undefined);
  const strokeStyle = strokeStyleFor(props.dash as string | undefined);
  const labelText = plainText(props.richText);
  const opacity = typeof props.opacity === 'number' ? props.opacity : 100;
  const customData = { legacyType: type, legacyId: record.id };

  switch (type) {
    case 'geo': {
      const geo = String(props.geo ?? 'rectangle');
      return shapeElements(GEO_TYPE[geo] ?? 'rectangle', {
        x,
        y,
        width: num(props.w, 160),
        height: num(props.h, 100),
        angle,
        strokeColor,
        backgroundColor: fillFor(props.fill as string | undefined),
        strokeWidth,
        strokeStyle,
        opacity,
        roundness: 8,
        label: labelText
          ? { text: labelText, color: strokeColor, align: 'center' }
          : undefined,
        customData,
      });
    }

    case 'text':
    case 'line': {
      const text = labelText || String(props.text ?? '');
      return [textElement({ x, y, text, color: strokeColor, angle, customData })];
    }

    case 'note': {
      const width = num(props.w, 200);
      const height = num(props.h, 200) + num(props.growY, 0);
      return shapeElements('rectangle', {
        x,
        y,
        width,
        height,
        angle,
        strokeColor: INK.rule,
        backgroundColor: INK.fill1,
        strokeWidth: 1,
        strokeStyle: 'solid',
        opacity,
        roundness: 4,
        label: labelText ? { text: labelText, color: INK.ink, align: 'left' } : undefined,
        customData,
      });
    }

    case 'draw': {
      const points = drawPoints(props);
      if (points.length < 2) return null;
      const [first, ...rest] = points;
      return [linearElement('line', {
        x: x + first.x,
        y: y + first.y,
        width: 0,
        height: 0,
        points: [[0, 0], ...rest.map((p) => [p.x - first.x, p.y - first.y] as [number, number])],
        angle,
        strokeColor,
        strokeWidth,
        strokeStyle,
        roughness: 1,
        opacity,
        customData,
      })];
    }

    case 'arrow':
    case 'connector': {
      const start = (props.start ?? { x: 0, y: 0 }) as { x?: unknown; y?: unknown };
      const end = (props.end ?? { x: 100, y: 0 }) as { x?: unknown; y?: unknown };
      const startX = num(start.x);
      const startY = num(start.y);
      const endX = num(end.x);
      const endY = num(end.y);
      const bend = num(props.bend);
      const points: [number, number][] = [[0, 0]];
      if (bend !== 0) {
        // A bent arrow's midpoint is the perpendicular offset tldraw draws.
        const dx = endX - startX;
        const dy = endY - startY;
        const len = Math.hypot(dx, dy) || 1;
        points.push([dx / 2 - (dy / len) * bend, dy / 2 + (dx / len) * bend]);
      }
      points.push([endX - startX, endY - startY]);
      return [linearElement('arrow', {
        x: x + startX,
        y: y + startY,
        width: 0,
        height: 0,
        points,
        angle,
        strokeColor,
        strokeWidth,
        strokeStyle,
        startArrowhead: props.arrowheadStart === 'arrow' ? 'arrow' : null,
        endArrowhead: props.arrowheadEnd === 'none' ? null : 'arrow',
        opacity,
        customData,
      })];
    }

    case 'frame':
      return [frameElement({
        x,
        y,
        width: num(props.w, 400),
        height: num(props.h, 300),
        strokeColor: INK.ink4,
        name: plainText(props.name) || String(props.name ?? 'Frame'),
        customData,
      })];

    default:
      return null;
  }
}

/**
 * Translate a tldraw record map (canonical `{ [id]: TLRecord }`, or a legacy
 * full snapshot `{ schema, records }`) into Excalidraw elements.
 *
 * Shapes are emitted in tldraw's fractional-index order, which is also the
 * paint order Excalidraw expects. Group membership (tldraw's parentId chains)
 * is deliberately not reconstructed: grouping is an editing affordance, not
 * content, and a wrong group is worse than no group.
 */
export function convertLegacyScene(blob: unknown): ConversionResult {
  const skipped: Record<string, number> = {};
  const records: LegacyRecord[] = [];

  if (Array.isArray(blob)) {
    records.push(...(blob as LegacyRecord[]));
  } else if (blob && typeof blob === 'object') {
    const wrapper = blob as { records?: unknown };
    const source =
      wrapper.records && typeof wrapper.records === 'object'
        ? Object.values(wrapper.records as Record<string, unknown>)
        : Object.values(blob as Record<string, unknown>);
    for (const value of source) {
      if (value && typeof value === 'object') records.push(value as LegacyRecord);
    }
  }

  const shapes = records
    .filter((record) => record.typeName === 'shape' || (record.type && record.props))
    .sort((a, b) => String(a.index ?? '').localeCompare(String(b.index ?? '')));

  const elements: ExcalidrawElement[] = [];
  for (const shape of shapes) {
    const built = buildShape(shape);
    if (!built) {
      const key = shape.type ?? 'unknown';
      skipped[key] = (skipped[key] ?? 0) + 1;
      continue;
    }
    elements.push(...built);
  }

  return { elements, skipped };
}

/** True when a stored blob is in the legacy tldraw record shape. */
export function isLegacyScene(blob: unknown): boolean {
  if (!blob || typeof blob !== 'object') return false;
  if ((blob as { format?: string }).format) return false;
  if (Array.isArray((blob as { elements?: unknown }).elements)) return false;
  const values = Object.values(blob as Record<string, unknown>);
  return values.some(
    (value) =>
      !!value &&
      typeof value === 'object' &&
      (value as { typeName?: string }).typeName === 'shape',
  );
}
