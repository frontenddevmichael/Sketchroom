/**
 * Isometric line kit — true 30° projection, one stroke weight, grey fills.
 *
 * Everything is expressed in world units (1 unit = ISO_U px) so scenes compose
 * like objects on a desk rather than hand-tuned paths:
 *   sx = (x - y) * cos30 * U
 *   sy = ((x + y) * sin30 - z) * U
 *
 * Fills come from CSS (see illustration.css), never from inline colour, so a
 * scene themes itself in light and dark without a second code path.
 */

export const ISO_U = 24;
const COS30 = Math.cos(Math.PI / 6);

export type Vec3 = [number, number, number];
export interface Pt {
  x: number;
  y: number;
}

export function project(x: number, y: number, z = 0, u = ISO_U): Pt {
  return { x: (x - y) * COS30 * u, y: ((x + y) * 0.5 - z) * u };
}

const n = (v: number) => Math.round(v * 100) / 100;
const xy = (p: Pt) => `${n(p.x)} ${n(p.y)}`;

/** Closed polygon from world-space points. */
export function face(points: Vec3[], u = ISO_U): string {
  return `M${points.map(([x, y, z]) => xy(project(x, y, z, u))).join('L')}Z`;
}

/** Open polyline from world-space points. */
export function line(points: Vec3[], u = ISO_U): string {
  return `M${points.map(([x, y, z]) => xy(project(x, y, z, u))).join('L')}`;
}

export interface BoxFaces {
  top: string;
  left: string;
  right: string;
}

/**
 * An axis-aligned box. `left` is the face at y + d, `right` the face at x + w —
 * the two sides the camera can actually see.
 */
export function box(
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  u = ISO_U
): BoxFaces {
  return {
    top: face(
      [
        [x, y, z + h],
        [x + w, y, z + h],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      u
    ),
    left: face(
      [
        [x, y + d, z + h],
        [x + w, y + d, z + h],
        [x + w, y + d, z],
        [x, y + d, z],
      ],
      u
    ),
    right: face(
      [
        [x + w, y, z + h],
        [x + w, y + d, z + h],
        [x + w, y + d, z],
        [x + w, y, z],
      ],
      u
    ),
  };
}

/** A thin raised pad — the ground plane for most scenes. */
export function slab(x: number, y: number, w: number, d: number, thick = 0.18, u = ISO_U) {
  return box(x, y, 0, w, d, thick, u);
}

/** A browser window plane: a thin slab plus a title bar and three dots. */
export function screen(x: number, y: number, z: number, w: number, h: number, u = ISO_U) {
  const body = box(x, y, z, w, 0.12, h / ISO_U, u);
  const dots: Pt[] = [0.22, 0.34, 0.46].map((dx) =>
    project(x + dx, y + 0.12, z + h / ISO_U - 0.22, u)
  );
  const bar = line(
    [
      [x, y + 0.12, z + h / ISO_U - 0.5],
      [x + w, y + 0.12, z + h / ISO_U - 0.5],
    ],
    u
  );
  return { body, dots, bar };
}

/** Concentric signal arcs — "someone/something is live here". */
export function arcs(cx: number, cy: number, cz: number, count = 3, u = ISO_U): string[] {
  const c = project(cx, cy, cz, u);
  const out: string[] = [];
  for (let i = 1; i <= count; i++) {
    const r = i * 7;
    out.push(
      `M${n(c.x + r * 0.72)} ${n(c.y + r * 0.5)}A${r} ${r} 0 0 1 ${n(c.x + r)} ${n(c.y - r * 0.28)}`
    );
  }
  return out;
}

/** A dashed route with a filled terminal dot, used for proposed connections. */
export function pipe(points: Vec3[], u = ISO_U) {
  const path = line(points, u);
  const start = project(...points[0], u);
  const end = project(...points[points.length - 1], u);
  return { path, start, end };
}

/** The black pointer arrow (1–3 per scene are allowed). */
export function cursor(x: number, y: number, u = ISO_U): string {
  const p = project(x, y, 0, u);
  const s = 0.55;
  return `M${n(p.x)} ${n(p.y)}l${n(9 * s)} ${n(26 * s)}l${n(6 * s)} ${n(-9 * s)}l${n(11 * s)} ${n(4 * s)}Z`;
}

/** A horizontal measuring rule, ref 1's drafting detail. */
export function ruler(x: number, y: number, z: number, len: number, u = ISO_U) {
  const body = box(x, y, z, len, 0.16, 0.06, u);
  const ticks: Pt[] = [];
  for (let i = 0; i <= len * 2; i++) {
    ticks.push(project(x + i * 0.5, y + 0.16, z + 0.06, u));
  }
  return { body, ticks };
}
