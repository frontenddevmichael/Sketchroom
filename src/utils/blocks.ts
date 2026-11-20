import type { BlockDef } from './types';
import type { CanvasApi, CanvasBounds } from '../canvas/api';
import { INK } from '../canvas/ink';
import { createShapeElements } from '../canvas/elements';
import { kindInk } from '../lib/blockKinds';
import { emitPlacementPulse } from '../components/placementPulse';

// ── Shared constants ──────────────────────────────────────────────────────
import { BLOCK_W, BLOCK_H } from '../lib/blockKinds';
export { BLOCK_W, BLOCK_H };
export const GRID = 20;
export const CASCADE_COLS = 3;
export const CASCADE_GAP_X = 24;
export const CASCADE_GAP_Y = 16;

// ── Block catalog ─────────────────────────────────────────────────────────
export type Tab = 'architecture' | 'wireframe';

export const BLOCKS: Record<Tab, BlockDef[]> = {
  architecture: [
    { label: 'API', code: 'api', kind: 'service', role: 'API' },
    { label: 'Database', code: 'database', kind: 'database', role: 'Database' },
    { label: 'Service', code: 'service', kind: 'service', role: 'Service' },
    { label: 'Queue', code: 'queue', kind: 'queue', role: 'Queue' },
    { label: 'Client', code: 'client', kind: 'client', role: 'Client' },
    { label: 'Cache', code: 'cache', kind: 'cache', role: 'Cache' },
  ],
  wireframe: [
    { label: 'Button', code: 'button', kind: 'geo', role: 'Button' },
    { label: 'Input', code: 'input', kind: 'geo', role: 'Input' },
    { label: 'Card', code: 'card', kind: 'geo', role: 'Card' },
    { label: 'Navbar', code: 'navbar', kind: 'geo', role: 'Navbar' },
    { label: 'Table', code: 'table', kind: 'geo', role: 'Table' },
    { label: 'Image', code: 'image', kind: 'geo', role: 'Image' },
  ],
};

// ── Pure helpers ──────────────────────────────────────────────────────────
export function snapToGrid(v: number): number {
  return Math.round(v / GRID) * GRID;
}

/** Where a block lands: the viewport centre, cascaded so drops never stack. */
export function blockPlacement(
  api: CanvasApi,
  cascadeIndex: number,
): { x: number; y: number } {
  const view = api.viewportBounds();
  const center = { x: view.x + view.w / 2, y: view.y + view.h / 2 };
  const col = cascadeIndex % CASCADE_COLS;
  const row = Math.floor(cascadeIndex / CASCADE_COLS);
  return {
    x: snapToGrid(center.x - BLOCK_W / 2 + col * (BLOCK_W + CASCADE_GAP_X)),
    y: snapToGrid(center.y - BLOCK_H / 2 + row * (BLOCK_H + CASCADE_GAP_Y)),
  };
}

/** The pulse layer works in screen space; this is the one conversion. */
export function pulseForBounds(api: CanvasApi, bounds: CanvasBounds, tone: 'neutral' | 'ai'): void {
  const camera = api.camera;
  emitPlacementPulse(
    {
      x: (bounds.x - camera.x) * camera.z,
      y: (bounds.y - camera.y) * camera.z,
      w: bounds.w * camera.z,
      h: bounds.h * camera.z,
    },
    tone,
  );
}

/**
 * Insert a block at the centre of the viewport with cascade positioning.
 * Accepts the api + cascade state as parameters so it stays decoupled from
 * any component's hooks.
 */
export function insertBlock(
  block: BlockDef,
  api: CanvasApi | null,
  cascadeIndex: number,
  setCascadeIndex: React.Dispatch<React.SetStateAction<number>>,
): void {
  if (!api) return;
  const { x, y } = blockPlacement(api, cascadeIndex);
  setCascadeIndex((i) => i + 1);

  const elements = createShapeElements({
    kind: 'rectangle',
    x,
    y,
    width: BLOCK_W,
    height: BLOCK_H,
    label: block.role ?? block.label,
    style: { stroke: kindInk(block.code), fill: INK.fill1, strokeWidth: 1.25 },
    labelStyle: { stroke: INK.ink },
  });

  api.addElements(elements, { select: true });
  api.setTool('select');
  api.zoomToBounds({ x, y, w: BLOCK_W, h: BLOCK_H }, { inset: 220, targetZoom: 1 });

  // The placement "snap": a spring ring flashes around the landed block
  // so the drop reads as a deliberate moment, not a silent teleport.
  pulseForBounds(api, { x, y, w: BLOCK_W, h: BLOCK_H }, 'neutral');
}
