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
import { INK } from '../canvas/ink';

// ── Shared canvas constants ──────────────────────────────────────────────
export const BLOCK_W = 180;
export const BLOCK_H = 90;

export interface BlockKind {
  icon: LucideIcon;
  /**
   * The block's weight on the board, as a step of the ink ramp. Kinds are
   * separated by line weight (design/SKILL.md), never by hue: a database reads
   * darker than a cache because it is heavier, not because it is blue.
   */
  ink: string;
}

/** Single source of truth for block "kinds". The ghost canvas previews, the AI
 *  feed's ghost-block list, and the block library all resolve icons and insert
 *  inks from here, so the palette can never drift between surfaces. */
export const BLOCK_KIND: Record<string, BlockKind> = {
  service: { icon: Server, ink: INK.ink },
  database: { icon: Database, ink: INK.ink2 },
  api: { icon: Plug, ink: INK.ink2 },
  client: { icon: Globe, ink: INK.ink3 },
  queue: { icon: Layers, ink: INK.ink3 },
  cache: { icon: Zap, ink: INK.ink3 },
  input: { icon: TextCursorInput, ink: INK.ink4 },
  button: { icon: MousePointerClick, ink: INK.ink },
  card: { icon: CreditCard, ink: INK.ink4 },
  table: { icon: Table, ink: INK.ink3 },
  navbar: { icon: Menu, ink: INK.ink3 },
  image: { icon: Image, ink: INK.rule },
};

export function kindIcon(kind: string): LucideIcon {
  return BLOCK_KIND[kind]?.icon ?? Boxes;
}

/** The ink a block of this kind is drawn in when it lands on the canvas. */
export function kindInk(kind: string): string {
  return BLOCK_KIND[kind]?.ink ?? INK.ink3;
}

/** The same step, for swatches and dots on other surfaces. */
export function kindHex(kind: string): string {
  return kindInk(kind);
}
