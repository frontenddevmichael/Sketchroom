/**
 * The room's one handle on the canvas engine.
 *
 * Everything above `CanvasSurface` talks to this class rather than to
 * Excalidraw's imperative API, so the editor's quirks (scroll-vs-camera,
 * version bumping, index keys, its own history) stay in one file. Overlays that
 * only need to draw read `camera`, `elements`, `selection` and `subscribe`.
 *
 * History is owned here, not by the engine: Excalidraw 0.18 exposes only
 * `history.clear()` through its public API, so undo/redo is a snapshot stack
 * applied with `captureUpdate: NEVER` (which keeps the engine's own undo stack
 * out of the way). The stack also gives the room's depth gauge real numbers.
 */
import {
  CaptureUpdateAction,
  getCommonBounds,
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, NormalizedZoomValue } from '@excalidraw/excalidraw/types';
import type { BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { boundTextOf, patchElement } from './elements';

export type CanvasTool = 'select' | 'draw' | 'sticky' | 'text' | 'connector' | 'shapes' | 'eraser';

export const CANVAS_TOOLS: readonly CanvasTool[] = [
  'select',
  'draw',
  'sticky',
  'text',
  'connector',
  'shapes',
  'eraser',
];

export interface CanvasCamera {
  x: number;
  y: number;
  z: number;
}

export interface CanvasBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

const HISTORY_LIMIT = 40;
const HISTORY_DEBOUNCE = 600;

/** Rail tool → engine tool. A note is a paper-filled rectangle in this engine. */
const TOOL_TO_ENGINE: Record<CanvasTool, 'selection' | 'freedraw' | 'rectangle' | 'text' | 'arrow' | 'eraser'> = {
  select: 'selection',
  draw: 'freedraw',
  sticky: 'rectangle',
  text: 'text',
  connector: 'arrow',
  shapes: 'rectangle',
  eraser: 'eraser',
};

const ENGINE_TO_TOOL: Record<string, CanvasTool> = {
  selection: 'select',
  freedraw: 'draw',
  text: 'text',
  arrow: 'connector',
  line: 'connector',
  rectangle: 'shapes',
  ellipse: 'shapes',
  diamond: 'shapes',
  eraser: 'eraser',
};

type Listener = () => void;

function cloneElements(elements: readonly ExcalidrawElement[]): ExcalidrawElement[] {
  return elements.map((element) => ({ ...element }) as ExcalidrawElement);
}

export class CanvasApi {
  private api: ExcalidrawImperativeAPI;
  private host: HTMLElement;
  private listeners = new Set<Listener>();
  private frame = 0;

  private past: ExcalidrawElement[][] = [];
  private future: ExcalidrawElement[][] = [];
  private present: ExcalidrawElement[] = [];
  private applying = false;
  private historyTimer: number | null = null;
  /** The rail tool last armed, so sticky-vs-shapes survives a round trip. */
  private requested: CanvasTool | null = null;

  constructor(api: ExcalidrawImperativeAPI, host: HTMLElement) {
    this.api = api;
    this.host = host;
    this.present = cloneElements(api.getSceneElements());
  }

  /** The element that hosts overlays (the `.sk-canvas` box). */
  get container(): HTMLElement {
    return this.host;
  }

  get elements(): readonly ExcalidrawElement[] {
    return this.api.getSceneElements();
  }

  get appState(): ReturnType<ExcalidrawImperativeAPI['getAppState']> {
    return this.api.getAppState();
  }

  get files(): BinaryFiles {
    return this.api.getFiles();
  }

  get camera(): CanvasCamera {
    const state = this.appState;
    return { x: state.scrollX, y: state.scrollY, z: state.zoom.value };
  }

  get selection(): readonly ExcalidrawElement[] {
    const selected = this.appState.selectedElementIds;
    return this.elements.filter((element) => selected[element.id]);
  }

  get selectionIds(): string[] {
    const selected = this.appState.selectedElementIds;
    return Object.keys(selected).filter((id) => selected[id]);
  }

  get activeTool(): CanvasTool {
    const type = this.appState.activeTool.type;
    // Two rail tools share one engine tool (a note is a rectangle, and the
    // shapes tool is a rectangle too), so the tool the user chose wins while it
    // still describes what the engine is armed with.
    if (this.requested && TOOL_TO_ENGINE[this.requested] === type) return this.requested;
    return ENGINE_TO_TOOL[type] ?? 'select';
  }

  element(id: string): ExcalidrawElement | undefined {
    return this.elements.find((element) => element.id === id);
  }

  // ── Geometry ────────────────────────────────────────────────────────────

  boundsOf(element: ExcalidrawElement): CanvasBounds {
    return { x: element.x, y: element.y, w: element.width, h: element.height };
  }

  boundsOfIds(ids: readonly string[]): CanvasBounds | null {
    const set = new Set(ids);
    const picked = this.elements.filter((element) => set.has(element.id));
    return this.unionOf(picked);
  }

  selectionBounds(): CanvasBounds | null {
    return this.unionOf(this.selection);
  }

  contentBounds(): CanvasBounds | null {
    return this.unionOf(this.elements);
  }

  private unionOf(list: readonly ExcalidrawElement[]): CanvasBounds | null {
    if (list.length === 0) return null;
    const box = getCommonBounds(list);
    if (!Number.isFinite(box[0])) return null;
    return { x: box[0], y: box[1], w: box[2] - box[0], h: box[3] - box[1] };
  }

  /** Visible scene rectangle: what a camera would show on this screen. */
  viewportBounds(): CanvasBounds {
    const { x: width, y: height } = this.viewportSize();
    const camera = this.camera;
    return {
      x: camera.x - width / camera.z,
      y: camera.y - height / camera.z,
      w: width / camera.z,
      h: height / camera.z,
    };
  }

  private viewportSize(): CanvasBounds {
    return { x: 0, y: 0, w: this.host.clientWidth, h: this.host.clientHeight };
  }

  screenToScene(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.host.getBoundingClientRect();
    const state = this.appState;
    return viewportCoordsToSceneCoords(
      { clientX, clientY },
      {
        ...state,
        offsetLeft: rect.left,
        offsetTop: rect.top,
      },
    );
  }

  sceneToScreen(x: number, y: number): { x: number; y: number } {
    const rect = this.host.getBoundingClientRect();
    const state = this.appState;
    const point = sceneCoordsToViewportCoords(
      { sceneX: x, sceneY: y },
      { ...state, offsetLeft: rect.left, offsetTop: rect.top },
    );
    return { x: point.x - rect.left, y: point.y - rect.top };
  }

  // ── Tools and selection ─────────────────────────────────────────────────

  setTool(tool: CanvasTool): void {
    const type = TOOL_TO_ENGINE[tool];
    this.requested = tool;
    this.api.setActiveTool({ type });
    if (tool === 'sticky') {
      // A note is a paper-filled box; arm those defaults so the next drag
      // produces a note rather than a blank outline.
      this.api.updateScene({
        appState: {
          currentItemBackgroundColor: '#F2F2F2',
          currentItemStrokeColor: '#D8D8D8',
          currentItemStrokeWidth: 1,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }
  }

  select(ids: readonly string[]): void {
    const next: Record<string, true> = {};
    for (const id of ids) next[id] = true;
    this.api.updateScene({
      appState: { selectedElementIds: next, selectedGroupIds: {} },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }

  clearSelection(): void {
    this.select([]);
  }

  // ── Scene mutation ──────────────────────────────────────────────────────

  addElements(elements: ExcalidrawElement[], options: { select?: boolean } = {}): void {
    if (elements.length === 0) return;
    const next = [...this.elements, ...elements];
    this.api.updateScene({
      elements: next as ExcalidrawElement[],
      appState: options.select
        ? {
            selectedElementIds: Object.fromEntries(elements.map((el) => [el.id, true as const])),
            selectedGroupIds: {},
          }
        : undefined,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }

  updateElements(ids: readonly string[], patch: (element: ExcalidrawElement) => Record<string, unknown> | null): void {
    const set = new Set(ids);
    let changed = false;
    const next = this.elements.map((element) => {
      if (!set.has(element.id)) return element;
      const result = patch(element);
      if (!result) return element;
      changed = true;
      return patchElement(element, result);
    });
    if (!changed) return;
    this.api.updateScene({
      elements: next as ExcalidrawElement[],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }

  /** Delete elements together with any text bound inside them. */
  removeElements(ids: readonly string[]): void {
    const set = new Set(ids);
    for (const element of this.elements) {
      if (!set.has(element.id)) continue;
      for (const text of boundTextOf(this.elements, element)) set.add(text.id);
    }
    const next = this.elements.map((element) =>
      set.has(element.id) ? patchElement(element, { isDeleted: true }) : element,
    );
    this.api.updateScene({
      elements: next as ExcalidrawElement[],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }

  /** Move elements (with any bound labels) by a scene-space delta. */
  moveElements(ids: readonly string[], dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    const set = new Set(ids);
    const elements = this.elements;
    for (const element of elements) {
      if (!set.has(element.id)) continue;
      for (const text of boundTextOf(elements, element)) set.add(text.id);
    }
    const next = elements.map((element) =>
      set.has(element.id) ? patchElement(element, { x: element.x + dx, y: element.y + dy }) : element,
    );
    this.api.updateScene({
      elements: next as ExcalidrawElement[],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }

  /** Replace the whole scene (remote sync, undo/redo, snapshot restore). */
  replaceElements(elements: ExcalidrawElement[], capture = false): void {
    this.applying = !capture;
    this.api.updateScene({
      elements: elements as ExcalidrawElement[],
      captureUpdate: capture ? CaptureUpdateAction.IMMEDIATELY : CaptureUpdateAction.NEVER,
    });
    this.applying = false;
    this.notify();
  }

  // ── Arrange ─────────────────────────────────────────────────────────────

  align(ids: readonly string[], op: 'left' | 'center-horizontal' | 'right' | 'top' | 'center-vertical' | 'bottom'): void {
    if (ids.length < 2) return;
    const box = this.boundsOfIds(ids);
    if (!box) return;
    const set = new Set(ids);
    const moves = new Map<string, { dx: number; dy: number }>();
    for (const element of this.elements) {
      if (!set.has(element.id)) continue;
      let dx = 0;
      let dy = 0;
      if (op === 'left') dx = box.x - element.x;
      else if (op === 'right') dx = box.x + box.w - (element.x + element.width);
      else if (op === 'center-horizontal') dx = box.x + box.w / 2 - (element.x + element.width / 2);
      else if (op === 'top') dy = box.y - element.y;
      else if (op === 'bottom') dy = box.y + box.h - (element.y + element.height);
      else dy = box.y + box.h / 2 - (element.y + element.height / 2);
      moves.set(element.id, { dx, dy });
    }
    this.applyMoves(moves);
  }

  distribute(ids: readonly string[], axis: 'horizontal' | 'vertical'): void {
    if (ids.length < 3) return;
    const set = new Set(ids);
    const picked = this.elements.filter((element) => set.has(element.id));
    const sorted = [...picked].sort((a, b) =>
      axis === 'horizontal' ? a.x + a.width / 2 - (b.x + b.width / 2) : a.y + a.height / 2 - (b.y + b.height / 2),
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last) return;
    const start = axis === 'horizontal' ? first.x + first.width : first.y + first.height;
    const end = axis === 'horizontal' ? last.x : last.y;
    const inner = sorted.slice(1, -1);
    const total = inner.reduce(
      (sum, element) => sum + (axis === 'horizontal' ? element.width : element.height),
      0,
    );
    const gap = inner.length > 0 ? (end - start - total) / (inner.length + 1) : 0;
    const moves = new Map<string, { dx: number; dy: number }>();
    let cursor = start + gap;
    for (const element of inner) {
      if (axis === 'horizontal') {
        moves.set(element.id, { dx: cursor - element.x, dy: 0 });
        cursor += element.width + gap;
      } else {
        moves.set(element.id, { dx: 0, dy: cursor - element.y });
        cursor += element.height + gap;
      }
    }
    this.applyMoves(moves);
  }

  private applyMoves(moves: Map<string, { dx: number; dy: number }>): void {
    if (moves.size === 0) return;
    const elements = this.elements;
    // Bound labels travel with their container.
    for (const element of elements) {
      const move = moves.get(element.id);
      if (!move) continue;
      for (const text of boundTextOf(elements, element)) {
        if (!moves.has(text.id)) moves.set(text.id, move);
      }
    }
    const next = elements.map((element) => {
      const move = moves.get(element.id);
      if (!move) return element;
      return patchElement(element, { x: element.x + move.dx, y: element.y + move.dy });
    });
    this.api.updateScene({
      elements: next as ExcalidrawElement[],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }

  /**
   * Z-order. The engine sorts by each element's fractional `index`, so the
   * order is expressed by rewriting the sequence rather than by array position.
   */
  order(ids: readonly string[], op: 'front' | 'forward' | 'backward' | 'back'): void {
    const set = new Set(ids);
    if (set.size === 0) return;
    const elements = [...this.elements];
    const picked = elements.filter((element) => set.has(element.id));
    const rest = elements.filter((element) => !set.has(element.id));
    let ordered: ExcalidrawElement[];
    if (op === 'front') ordered = [...rest, ...picked];
    else if (op === 'back') ordered = [...picked, ...rest];
    else if (op === 'forward') {
      // Each selected element steps over the next unselected one.
      ordered = [...elements];
      for (let i = ordered.length - 2; i >= 0; i--) {
        if (set.has(ordered[i].id) && !set.has(ordered[i + 1].id)) {
          [ordered[i], ordered[i + 1]] = [ordered[i + 1], ordered[i]];
        }
      }
    } else {
      ordered = [...elements];
      for (let i = 1; i < ordered.length; i++) {
        if (set.has(ordered[i].id) && !set.has(ordered[i - 1].id)) {
          [ordered[i], ordered[i - 1]] = [ordered[i - 1], ordered[i]];
        }
      }
    }
    const next = ordered.map((element, index) => patchElement(element, { index: `c${index.toString(36)}` }));
    this.api.updateScene({
      elements: next as ExcalidrawElement[],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }

  // ── View ────────────────────────────────────────────────────────────────

  zoomBy(factor: number): void {
    const state = this.appState;
    const rect = this.host.getBoundingClientRect();
    const anchor = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    const current = state.zoom.value;
    const next = Math.min(8, Math.max(0.1, current * factor));
    if (next === current) return;
    const before = viewportCoordsToSceneCoords(anchor, { ...state, offsetLeft: 0, offsetTop: 0 });
    const after = viewportCoordsToSceneCoords(anchor, {
      ...state,
      offsetLeft: 0,
      offsetTop: 0,
      zoom: { value: next as NormalizedZoomValue },
    });
    this.api.updateScene({
      appState: {
        zoom: { value: next as NormalizedZoomValue },
        scrollX: state.scrollX + (after.x - before.x),
        scrollY: state.scrollY + (after.y - before.y),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }

  zoomToFit(): void {
    this.api.scrollToContent(this.elements, { fitToContent: true, animate: true, duration: 200 });
  }

  zoomToBounds(bounds: CanvasBounds, options: { inset?: number; targetZoom?: number; animate?: boolean } = {}): void {
    const state = this.appState;
    const rect = this.host.getBoundingClientRect();
    const inset = options.inset ?? 64;
    const usableW = Math.max(40, rect.width - inset * 2);
    const usableH = Math.max(40, rect.height - inset * 2);
    const fit = Math.min(usableW / Math.max(1, bounds.w), usableH / Math.max(1, bounds.h));
    const zoom = Math.min(4, Math.max(0.1, Math.min(fit, options.targetZoom ?? fit)));
    const centerX = bounds.x + bounds.w / 2;
    const centerY = bounds.y + bounds.h / 2;
    const next = {
      zoom: { value: zoom as NormalizedZoomValue },
      scrollX: rect.width / 2 / zoom - centerX,
      scrollY: rect.height / 2 / zoom - centerY,
    };
    if (options.animate === false) {
      this.api.updateScene({ appState: next, captureUpdate: CaptureUpdateAction.NEVER });
    } else {
      this.api.updateScene({ appState: next, captureUpdate: CaptureUpdateAction.NEVER });
    }
    void state;
  }

  resetView(): void {
    this.api.updateScene({
      appState: { zoom: { value: 1 as NormalizedZoomValue }, scrollX: 0, scrollY: 0 },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }

  // ── History ─────────────────────────────────────────────────────────────

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get undoDepth(): number {
    return this.past.length;
  }

  get redoDepth(): number {
    return this.future.length;
  }

  undo(): void {
    const previous = this.past.pop();
    if (!previous) return;
    this.future.push(this.present);
    this.present = previous;
    this.replaceElements(cloneElements(previous));
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.present);
    this.present = next;
    this.replaceElements(cloneElements(next));
  }

  /**
   * Fold the current scene into history. Debounced so a drag or a burst of
   * typing is one step, not sixty.
   */
  private scheduleHistory(elements: readonly ExcalidrawElement[]): void {
    if (this.applying) return;
    const snapshot = cloneElements(elements);
    if (this.historyTimer !== null) window.clearTimeout(this.historyTimer);
    this.historyTimer = window.setTimeout(() => {
      this.historyTimer = null;
      if (sameElements(this.present, snapshot)) return;
      this.past.push(this.present);
      if (this.past.length > HISTORY_LIMIT) this.past.shift();
      this.present = snapshot;
      this.future = [];
      this.notify();
    }, HISTORY_DEBOUNCE);
  }

  private stylePrefs: Record<string, unknown> = {};

  /** Called by the surface on every engine change. */
  handleChange(elements: readonly ExcalidrawElement[]): void {
    this.scheduleHistory(elements);
    this.notify();
  }

  // ── New-shape defaults ──────────────────────────────────────────────────

  /**
   * Set the engine's "next shape" defaults. This is how the options rail
   * arms a tool: the picker edits the state the next stroke is drawn with.
   */
  setCurrentStyle(patch: Record<string, unknown>): void {
    // The engine's current-item fields are the arming mechanism for the next
    // stroke, but they are not a reliable read-back: an app-state-only update
    // can leave the engine reporting the previous value. Keep the room's own
    // record of what it last armed so the options rail shows the truth.
    this.stylePrefs = { ...this.stylePrefs, ...patch };
    this.api.updateScene({
      appState: patch as never,
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    this.notify();
  }

  /** What the rail last armed for the next stroke (see `setCurrentStyle`). */
  get nextStyle(): Record<string, unknown> {
    return this.stylePrefs;
  }

  /** The shape tool's next primitive (the engine only knows three). */
  setShapeKind(kind: 'rectangle' | 'ellipse' | 'diamond'): void {
    this.api.setActiveTool({ type: kind });
  }

  // ── Subscriptions ───────────────────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Coalesce change storms (drag, pan, selection) into one render per frame. */
  private notify(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      for (const listener of this.listeners) listener();
    });
  }

  destroy(): void {
    if (this.historyTimer !== null) window.clearTimeout(this.historyTimer);
    if (this.frame) cancelAnimationFrame(this.frame);
    this.listeners.clear();
  }
}

function sameElements(a: readonly ExcalidrawElement[], b: readonly ExcalidrawElement[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (left.id !== right.id || left.version !== right.version) return false;
  }
  return true;
}
