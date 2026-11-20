/**
 * Element constructors for everything the product *creates*: blocks, sticky
 * notes, text, connectors, template seeds and AI placements.
 *
 * Like `convert.ts` this module builds elements directly instead of calling the
 * editor's `convertToExcalidrawElements`: it runs in tests and in the data path,
 * where importing the editor UI would be slow and brittle. Only types are
 * imported from the package.
 *
 * The envelope matches what `convert.ts` emits and what the renderer requires;
 * every field the engine reads is present, so a hand-built element behaves like
 * one the editor itself produced.
 */
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { INK } from './ink';

/** Excalidraw's shipped font ids (stable across 0.18). */
export const FONT_FAMILY_ID = {
  hand: 1,
  sans: 2,
  mono: 3,
  liberation: 9,
} as const;

export type ShapeKind = 'rectangle' | 'ellipse' | 'diamond';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type Arrowhead = 'arrow' | 'bar' | 'dot' | 'triangle';

export const LINE_HEIGHT = 1.25;
export const DEFAULT_FONT_SIZE = 16;

let sequence = 0;

function uid(prefix = 'sk'): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function nonce(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/**
 * A valid, unique fractional index. The editor normalises indices on load, so
 * this only has to keep insertion order stable inside one session.
 */
function nextIndex(): string {
  sequence += 1;
  const stamp = (Date.now() % 1_000_000).toString(36).padStart(4, '0');
  return `b${stamp}${sequence.toString(36).padStart(4, '0')}`;
}

export interface CreateStyle {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  strokeStyle?: StrokeStyle;
  opacity?: number;
  roughness?: number;
}

function envelope(opts: {
  x: number;
  y: number;
  width: number;
  height: number;
  style?: CreateStyle;
}): Record<string, unknown> {
  const style = opts.style ?? {};
  return {
    id: uid(),
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    angle: 0,
    strokeColor: style.stroke ?? INK.ink,
    backgroundColor: style.fill ?? 'transparent',
    fillStyle: 'solid',
    strokeWidth: style.strokeWidth ?? 1.25,
    strokeStyle: style.strokeStyle ?? 'solid',
    roughness: style.roughness ?? 0,
    opacity: style.opacity ?? 100,
    roundness: null,
    seed: nonce(),
    version: 1,
    versionNonce: nonce(),
    index: nextIndex(),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

export function estimateTextSize(text: string, fontSize = DEFAULT_FONT_SIZE) {
  const lines = text.split('\n');
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  return {
    width: Math.max(10, Math.round(longest * fontSize * 0.55)),
    height: Math.max(fontSize * LINE_HEIGHT, Math.round(lines.length * fontSize * LINE_HEIGHT)),
  };
}

export interface CreateTextOptions {
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  fontFamily?: number;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  width?: number;
  height?: number;
  containerId?: string | null;
  style?: CreateStyle;
}

export function createTextElement(opts: CreateTextOptions): ExcalidrawElement {
  const fontSize = opts.fontSize ?? DEFAULT_FONT_SIZE;
  const size = estimateTextSize(opts.text, fontSize);
  return {
    ...envelope({
      x: opts.x,
      y: opts.y,
      width: opts.width ?? size.width,
      height: opts.height ?? size.height,
      style: { ...opts.style, strokeWidth: 1, roughness: 0 },
    }),
    type: 'text',
    fontSize,
    fontFamily: opts.fontFamily ?? FONT_FAMILY_ID.liberation,
    text: opts.text,
    originalText: opts.text,
    textAlign: opts.align ?? 'left',
    verticalAlign: opts.verticalAlign ?? 'top',
    containerId: opts.containerId ?? null,
    autoResize: !opts.containerId,
    lineHeight: LINE_HEIGHT,
  } as unknown as ExcalidrawElement;
}

export interface CreateShapeOptions {
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  /** Fixed once at creation: elements do not reflow when their label changes. */
  style?: CreateStyle;
  rounded?: boolean;
  labelStyle?: CreateStyle;
}

/** A shape plus, when labelled, its bound text — returned as a pair. */
export function createShapeElements(opts: CreateShapeOptions): ExcalidrawElement[] {
  const shape = {
    ...envelope({
      x: opts.x,
      y: opts.y,
      width: opts.width,
      height: opts.height,
      style: opts.style,
    }),
    type: opts.kind,
    roundness:
      opts.kind === 'rectangle' && opts.rounded !== false ? { type: 3 as const, value: 8 } : null,
  } as Record<string, unknown>;

  const label = opts.label?.trim();
  if (!label) return [shape as unknown as ExcalidrawElement];

  const padding = 8;
  const size = estimateTextSize(label);
  const text = createTextElement({
    x: opts.x + padding,
    y: opts.y + opts.height / 2 - size.height / 2,
    text: label,
    width: Math.max(10, opts.width - padding * 2),
    align: 'center',
    verticalAlign: 'middle',
    containerId: shape.id as string,
    style: { stroke: opts.labelStyle?.stroke ?? INK.ink, ...opts.labelStyle },
  });
  shape.boundElements = [{ type: 'text', id: text.id }];
  return [shape as unknown as ExcalidrawElement, text];
}

export interface CreateNoteOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
  text: string;
  /** Paper weight: how strongly the note separates from the board. */
  tone?: 'paper' | 'mid' | 'rule';
}

/**
 * A sticky note in this engine is a paper-filled rectangle with a bound label:
 * Excalidraw has no note primitive, and the design already treats a note as
 * "a box you can write in".
 */
export function createNoteElements(opts: CreateNoteOptions): ExcalidrawElement[] {
  const width = opts.width ?? 200;
  const height = opts.height ?? 140;
  const fill =
    opts.tone === 'mid' ? INK.fill2 : opts.tone === 'rule' ? INK.fill3 : INK.fill1;
  return createShapeElements({
    kind: 'rectangle',
    x: opts.x,
    y: opts.y,
    width,
    height,
    label: opts.text,
    rounded: false,
    style: { stroke: INK.rule, fill, strokeWidth: 1 },
    labelStyle: { stroke: INK.ink },
  });
}

export interface CreateArrowOptions {
  from: { x: number; y: number };
  to: { x: number; y: number };
  startArrowhead?: Arrowhead | null;
  endArrowhead?: Arrowhead | null;
  style?: CreateStyle;
  elbowed?: boolean;
}

export function createArrowElement(opts: CreateArrowOptions): ExcalidrawElement {
  const dx = opts.to.x - opts.from.x;
  const dy = opts.to.y - opts.from.y;
  return {
    ...envelope({
      x: opts.from.x,
      y: opts.from.y,
      width: Math.max(1, Math.abs(dx)),
      height: Math.max(1, Math.abs(dy)),
      style: { stroke: INK.ink, strokeWidth: 1.25, ...opts.style },
    }),
    type: 'arrow',
    points: [
      [0, 0],
      [dx, dy],
    ],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: opts.startArrowhead ?? null,
    endArrowhead: opts.endArrowhead ?? 'arrow',
    elbowed: opts.elbowed ?? false,
  } as unknown as ExcalidrawElement;
}

/** Bump an element's version so the engine re-renders and peers re-sync it. */
export function patchElement(
  element: ExcalidrawElement,
  patch: Record<string, unknown>,
): ExcalidrawElement {
  return {
    ...element,
    ...patch,
    version: element.version + 1,
    versionNonce: nonce(),
    updated: Date.now(),
  } as ExcalidrawElement;
}

/** Bound text of a shape, if it has any. */
export function boundTextOf(
  elements: readonly ExcalidrawElement[],
  element: ExcalidrawElement,
): ExcalidrawElement[] {
  const bindings = element.boundElements ?? [];
  const ids = new Set(bindings.filter((b) => b.type === 'text').map((b) => b.id));
  if (ids.size === 0) return [];
  return elements.filter((candidate) => ids.has(candidate.id));
}

export function isTextElement(element: ExcalidrawElement): boolean {
  return element.type === 'text';
}

export function isLinearElement(element: ExcalidrawElement): boolean {
  return element.type === 'arrow' || element.type === 'line';
}

export function textOf(element: ExcalidrawElement): string {
  if (element.type === 'text') return element.text;
  return '';
}
