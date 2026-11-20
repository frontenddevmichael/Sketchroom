/**
 * The canvas is monochrome (design/SKILL.md: "line weight is state", no hue
 * anywhere). tldraw stored colour *names* in existing rooms and Excalidraw
 * takes hex, so both sides meet here: every legacy name resolves to a step of
 * the ink ramp, and fills resolve to paper greys.
 *
 * Excalidraw's own palette is untouched in the editor UI: the room hides that
 * UI and drives colours through this module, so a stored hue can never leak
 * back in from the picker.
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
 * tldraw's schema fixes its colour *names* (removing them breaks stored
 * documents), so they are mapped rather than deleted. Darker names keep the
 * heavier ink so a shape that was "red" still reads as a shape that was meant
 * to stand out.
 */
const INK_BY_NAME: Record<string, string> = {
  black: INK.ink,
  grey: INK.ink4,
  white: INK.white,
  blue: INK.ink2,
  'light-blue': INK.ink3,
  violet: INK.ink2,
  'light-violet': INK.ink3,
  green: INK.ink2,
  'light-green': INK.ink3,
  yellow: INK.ink3,
  orange: INK.ink3,
  red: INK.ink,
  'light-red': INK.ink3,
};

export function inkFor(name?: string | null): string {
  if (!name) return INK.ink;
  if (name.startsWith('#')) return name;
  return INK_BY_NAME[name] ?? INK.ink;
}

/** tldraw fill names → Excalidraw background colours. */
export function fillFor(name?: string | null): string {
  switch (name) {
    case 'semi':
      return INK.fill1;
    case 'solid':
      return INK.fill2;
    case 'pattern':
      return INK.fill2;
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
