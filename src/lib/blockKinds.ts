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
import type { TLDefaultColorStyle } from 'tldraw';

// ── Shared canvas constants ──────────────────────────────────────────────
export const BLOCK_W = 180;
export const BLOCK_H = 90;

export interface BlockKind {
  icon: LucideIcon;
  /** tldraw color name — used when the block is inserted onto the canvas. */
  color: TLDefaultColorStyle;
}

/** Single source of truth for block "kinds". The ghost canvas previews, the AI
 *  feed's ghost-block list, and the block library all resolve icons and insert
 *  colors from here, so the palette can never drift between surfaces. */
export const BLOCK_KIND: Record<string, BlockKind> = {
  service: { icon: Server, color: 'green' },
  database: { icon: Database, color: 'blue' },
  api: { icon: Plug, color: 'light-blue' },
  client: { icon: Globe, color: 'orange' },
  queue: { icon: Layers, color: 'yellow' },
  cache: { icon: Zap, color: 'light-violet' },
  input: { icon: TextCursorInput, color: 'light-green' },
  button: { icon: MousePointerClick, color: 'green' },
  card: { icon: CreditCard, color: 'light-blue' },
  table: { icon: Table, color: 'light-violet' },
  navbar: { icon: Menu, color: 'blue' },
  image: { icon: Image, color: 'grey' },
};

export function kindIcon(kind: string): LucideIcon {
  return BLOCK_KIND[kind]?.icon ?? Boxes;
}

export function kindColor(kind: string): TLDefaultColorStyle {
  return BLOCK_KIND[kind]?.color ?? 'green';
}

/** Display hex for a kind, used for library-card color dots and any surface
 *  that previews an insert color without access to the tldraw palette. */
export function kindHex(kind: string): string {
  return KIND_HEX[BLOCK_KIND[kind]?.color ?? 'green'] ?? '#34c26b';
}

const KIND_HEX: Record<string, string> = {
  black: '#1d1d1d',
  grey: '#9b9b9b',
  'light-violet': '#e3d9ff',
  violet: '#7b61ff',
  blue: '#3b82f6',
  'light-blue': '#c3e2ff',
  yellow: '#f3d53d',
  orange: '#ff943d',
  green: '#34c26b',
  'light-green': '#c9f2a0',
  'light-red': '#ffaaaa',
  red: '#ef4b4b',
  white: '#ffffff',
};
