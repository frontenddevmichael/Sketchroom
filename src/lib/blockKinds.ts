import type { LucideIcon } from 'lucide-react';
import {
  Server,
  Database,
  Plug,
  Globe,
  Layers,
  Zap,
  TextCursorInput,
  MousePointerClick,
  CreditCard,
  Table,
  Menu,
  Image,
  Boxes,
} from 'lucide-react';
import { INK, OBJECT_PALETTE, tintOf } from '../canvas/ink';

// ── Shared canvas constants ──────────────────────────────────────────────
export const BLOCK_W = 180;
export const BLOCK_H = 90;

export interface BlockKind {
  icon: LucideIcon;
  /**
   * The block's colour on the board. Blocks are the user's content, so a kind
   * has a hue; the app around them stays monochrome. Fills are a wash of the
   * same hue, so a board of blocks still reads as a blueprint in colour.
   */
  paint: string;
}

/** Single source of truth for block "kinds". The ghost canvas previews, the AI
 *  feed's ghost-block list, and the block library all resolve icons and colours
 *  from here, so the palette can never drift between surfaces. */
export const BLOCK_KIND: Record<string, BlockKind> = {
  service: { icon: Server, paint: OBJECT_PALETTE.blue },
  database: { icon: Database, paint: OBJECT_PALETTE.violet },
  api: { icon: Plug, paint: OBJECT_PALETTE.green },
  client: { icon: Globe, paint: OBJECT_PALETTE.orange },
  queue: { icon: Layers, paint: OBJECT_PALETTE.yellow },
  cache: { icon: Zap, paint: '#14B8A6' },
  input: { icon: TextCursorInput, paint: OBJECT_PALETTE.grey },
  button: { icon: MousePointerClick, paint: INK.ink },
  card: { icon: CreditCard, paint: OBJECT_PALETTE.blue },
  table: { icon: Table, paint: OBJECT_PALETTE.violet },
  navbar: { icon: Menu, paint: INK.ink },
  image: { icon: Image, paint: OBJECT_PALETTE.grey },
};

export function kindIcon(kind: string): LucideIcon {
  return BLOCK_KIND[kind]?.icon ?? Boxes;
}

/** The colour a block of this kind is drawn in when it lands on the canvas. */
export function kindStroke(kind: string): string {
  return BLOCK_KIND[kind]?.paint ?? OBJECT_PALETTE.grey;
}

/** Its fill: the same colour washed onto the paper. */
export function kindFill(kind: string): string {
  return tintOf(kindStroke(kind), 0.86);
}

/** The colour itself, for swatches and dots on other surfaces. */
export function kindHex(kind: string): string {
  return kindStroke(kind);
}
