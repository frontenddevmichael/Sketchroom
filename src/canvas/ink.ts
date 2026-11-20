/**
 * Colour on the board has two halves, and they do not mix:
 *
 *  - **The app is monochrome.** Paper, chrome, text, cursors, comments and
 *    presence are ink on paper; nothing in the interface carries a hue.
 *  - **The objects are not.** A shape, block or stroke drawn on the canvas
 *    keeps whatever colour it was given — that is the user's content, not the
 *    product's styling. `OBJECT_PALETTE` is that vocabulary, and fills are a
 *    wash of the object's own colour over paper, never a grey substitute.
 *
 * tldraw stored colour *names* in existing rooms and Excalidraw takes hex, so
 * both sides meet here: legacy names resolve to the same hue in the palette,
 * which is what keeps an old board looking like itself after the conversion.
 */

export const INK = {
  ink: '#0A0A0A',
  ink2: '#2E2E2E',
  ink3: '#4A4A4A',
  ink4: '#6B6B6B',
  rule: '#D8D8D8',
  fill1: '#F2F2F2',
  fill2: '#E2E2E2',
  fill3: '#CFCFCF',
  paper: '#FAFAFA',
  white: '#FFFFFF',
} as const;

/**
 * The colour vocabulary for objects on the board. Deliberately small and
 * flat: these are diagram colours, not a paint box.
 */
export const OBJECT_PALETTE = {
  ink: INK.ink,
  blue: '#3B82F6',
  sky: '#C3E2FF',
  violet: '#7B61FF',
  lilac: '#E3D9FF',
  green: '#34C26B',
  mint: '#C9F2A0',
  yellow: '#F3D53D',
  orange: '#F59E0B',
  red: '#EF4B4B',
  grey: '#9B9B9B',
} as const;

/** The picker order: ink first (the default), then hues light-to-heavy. */
export const OBJECT_COLORS: readonly { name: string; value: string }[] = [
  { name: 'Ink', value: OBJECT_PALETTE.ink },
  { name: 'Blue', value: OBJECT_PALETTE.blue },
  { name: 'Sky', value: OBJECT_PALETTE.sky },
  { name: 'Violet', value: OBJECT_PALETTE.violet },
  { name: 'Lilac', value: OBJECT_PALETTE.lilac },
  { name: 'Green', value: OBJECT_PALETTE.green },
  { name: 'Mint', value: OBJECT_PALETTE.mint },
  { name: 'Yellow', value: OBJECT_PALETTE.yellow },
  { name: 'Orange', value: OBJECT_PALETTE.orange },
  { name: 'Red', value: OBJECT_PALETTE.red },
];

/**
 * tldraw's schema fixes its colour *names* (removing them breaks stored
 * documents), so they are mapped rather than deleted — onto the object
 * palette, so a room drawn in colour stays in colour.
 */
const PAINT_BY_NAME: Record<string, string> = {
  black: INK.ink,
  grey: OBJECT_PALETTE.grey,
  white: INK.white,
  blue: OBJECT_PALETTE.blue,
  'light-blue': OBJECT_PALETTE.sky,
  violet: OBJECT_PALETTE.violet,
  'light-violet': OBJECT_PALETTE.lilac,
  green: OBJECT_PALETTE.green,
  'light-green': OBJECT_PALETTE.mint,
  yellow: OBJECT_PALETTE.yellow,
  orange: OBJECT_PALETTE.orange,
  red: OBJECT_PALETTE.red,
  'light-red': '#FFAAAA',
};

/** Text and other ink-only content: always a step of the ink ramp. */
export function inkFor(name?: string | null): string {
  if (!name) return INK.ink;
  if (name.startsWith('#')) return name;
  return PAINT_BY_NAME[name] === INK.white ? INK.ink : INK.ink;
}

/** An object's own colour, by palette name or hex. */
export function objectPaint(name?: string | null): string {
  if (!name) return INK.ink;
  if (name.startsWith('#')) return name;
  return PAINT_BY_NAME[name] ?? INK.ink;
}

/** Blend a colour toward the paper — the canvas's only way of making a fill. */
export function tintOf(hex: string, amount = 0.86): string {
  const parsed = parseHex(hex);
  if (!parsed) return hex;
  const paper = parseHex(INK.paper)!;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount);
  return toHex(mix(parsed.r, paper.r), mix(parsed.g, paper.g), mix(parsed.b, paper.b));
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const raw = match[1];
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/**
 * tldraw fill names → a wash of the object's own colour. A fill never invents
 * a hue: it is the stroke's colour, lightened onto the paper.
 */
export function fillFor(name: string | null | undefined, stroke: string = INK.ink): string {
  switch (name) {
    case 'semi':
      return tintOf(stroke, 0.86);
    case 'solid':
      return tintOf(stroke, 0.68);
    case 'pattern':
      return tintOf(stroke, 0.78);
    case 'none':
    default:
      return 'transparent';
  }
}

/** The three fill weights the options rail offers for a coloured object. */
export function fillForWeight(
  weight: 'none' | 'wash' | 'tint' | 'solid',
  stroke: string,
): string {
  switch (weight) {
    case 'wash':
      return tintOf(stroke, 0.9);
    case 'tint':
      return tintOf(stroke, 0.78);
    case 'solid':
      return tintOf(stroke, 0.6);
    case 'none':
    default:
      return 'transparent';
  }
}

/** tldraw size names → hairline stroke widths. */
export function strokeWidthFor(size?: string | null): number {
  switch (size) {
    case 's':
      return 1;
    case 'l':
      return 2;
    case 'xl':
      return 3;
    case 'm':
    default:
      return 1.25;
  }
}

export type CanvasStrokeStyle = 'solid' | 'dashed' | 'dotted';

/** tldraw dash names → Excalidraw stroke styles. `draw` is tldraw's default. */
export function strokeStyleFor(dash?: string | null): CanvasStrokeStyle {
  switch (dash) {
    case 'dashed':
      return 'dashed';
    case 'dotted':
      return 'dotted';
    case 'solid':
    case 'draw':
    default:
      return 'solid';
  }
}
