import type { BlockDef } from './types';
import type { Editor } from 'tldraw';
import { toRichText, createShapeId } from 'tldraw';
import { kindColor } from '../lib/blockKinds';
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

export function makeBlockProps(block: BlockDef) {
  return {
    geo: 'rectangle' as const,
    w: BLOCK_W,
    h: BLOCK_H,
    color: kindColor(block.code),
    fill: 'semi' as const,
    richText: toRichText(block.role ?? block.label),
  } satisfies {
    geo: 'rectangle';
    w: number;
    h: number;
    color: ReturnType<typeof kindColor>;
    fill: 'semi';
    richText: ReturnType<typeof toRichText>;
  };
}

/**
 * Insert a block at the center of the viewport with cascade positioning.
 * Accepts editor + cascade state as parameters so it stays decoupled from
 * any component's hooks.
 */
export function insertBlock(
  block: BlockDef,
  editor: Editor | null,
  cascadeIndex: number,
  setCascadeIndex: React.Dispatch<React.SetStateAction<number>>,
) {
  if (!editor) return;
  const viewport = editor.getViewportScreenBounds();
  const center = editor.screenToPage({ x: viewport.midX, y: viewport.midY });

  const col = cascadeIndex % CASCADE_COLS;
  const row = Math.floor(cascadeIndex / CASCADE_COLS);
  setCascadeIndex((i) => i + 1);

  const x = snapToGrid(center.x - BLOCK_W / 2 + col * (BLOCK_W + CASCADE_GAP_X));
  const y = snapToGrid(center.y - BLOCK_H / 2 + row * (BLOCK_H + CASCADE_GAP_Y));

  const id = createShapeId();
  editor.createShape({
    id,
    type: 'geo',
    x,
    y,
    props: makeBlockProps(block),
  });
  editor.select(id);
  editor.setCurrentTool('select');
  editor.zoomToSelection({ animation: { duration: 160 } });

  // The placement "snap": a spring ring flashes around the landed block
  // so the drop reads as a deliberate moment, not a silent teleport.
  const bounds = editor.getShapePageBounds(id);
  if (bounds) {
    const cam = editor.getCamera();
    emitPlacementPulse(
      {
        x: (bounds.x - cam.x) * cam.z,
        y: (bounds.y - cam.y) * cam.z,
        w: bounds.w * cam.z,
        h: bounds.h * cam.z,
      },
      'neutral',
    );
  }
}
