import {
  createArrowElement,
  createNoteElements,
  createShapeElements,
  createTextElement,
} from '../canvas/elements';
import { INK } from '../canvas/ink';
import { serializeScene } from '../canvas/scene';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

/**
 * Curated starter canvases. Each template is a small hand-built scene
 * (`{ format, elements }`, the same document the room save path persists) so a
 * room can be created pre-populated. Seeding happens client-side:
 * buildTemplateSeed returns the serialized scene, and `createRoom({ seed })`
 * stores it as the room's initial canvasData.
 *
 * The seeds are validated in `src/lib/templates.test.ts` by parsing them back
 * through the same reader the room uses, so a malformed template fails the test
 * suite before it can ever reach a real room.
 *
 * Everything is drawn on the ink ramp: a template is a blueprint, not a
 * colour-coded illustration.
 */

export interface TemplateDef {
  id: string;
  name: string;
  tagline: string;
  category: 'architecture' | 'wireframe' | 'planning';
  /** Weight the template card reads at: the same scale the board draws in. */
  accent: 'ink' | 'mid';
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'system-architecture',
    name: 'System architecture',
    tagline: 'Services, stores, and the arrows between them.',
    category: 'architecture',
    accent: 'ink',
  },
  {
    id: 'signup-flow',
    name: 'Sign-up flow',
    tagline: 'A wireframe walkthrough from landing to dashboard.',
    category: 'wireframe',
    accent: 'mid',
  },
  {
    id: 'user-story-map',
    name: 'User story map',
    tagline: 'Activities and stories across a release spine.',
    category: 'planning',
    accent: 'mid',
  },
  {
    id: 'sprint-board',
    name: 'Sprint board',
    tagline: 'To do, doing, done — ready for your team.',
    category: 'planning',
    accent: 'ink',
  },
];

export type TemplateId = (typeof TEMPLATES)[number]['id'];

const GRID = 20;

function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

const STRONG = { stroke: INK.ink, fill: INK.fill1, strokeWidth: 1.5 };
const PLAIN = { stroke: INK.ink3, fill: 'transparent', strokeWidth: 1.25 };
const HAIRLINE = { stroke: INK.rule, fill: INK.fill1, strokeWidth: 1 };

function box(
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  strong = false,
): ExcalidrawElement[] {
  return createShapeElements({
    kind: 'rectangle',
    x: snap(x),
    y: snap(y),
    width: w,
    height: h,
    label,
    style: strong ? STRONG : PLAIN,
    labelStyle: { stroke: INK.ink },
  });
}

function pill(x: number, y: number, w: number, h: number, label: string): ExcalidrawElement[] {
  return createShapeElements({
    kind: 'ellipse',
    x: snap(x),
    y: snap(y),
    width: w,
    height: h,
    label,
    style: PLAIN,
    labelStyle: { stroke: INK.ink },
  });
}

function caption(x: number, y: number, text: string, size = 12): ExcalidrawElement {
  return createTextElement({
    x: snap(x),
    y: snap(y),
    text,
    fontSize: size,
    style: { stroke: INK.ink4 },
  });
}

function connector(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strong = false,
): ExcalidrawElement {
  return createArrowElement({
    from: { x: snap(x1), y: snap(y1) },
    to: { x: snap(x2), y: snap(y2) },
    style: {
      stroke: strong ? INK.ink : INK.ink3,
      strokeStyle: strong ? 'solid' : 'dashed',
    },
  });
}

function note(x: number, y: number, w: number, text: string): ExcalidrawElement[] {
  return createNoteElements({ x: snap(x), y: snap(y), width: w, height: 120, text });
}

/** System architecture: client → api → service, with db + cache downstream. */
function buildSystemArchitecture(): ExcalidrawElement[] {
  const out: ExcalidrawElement[] = [];
  out.push(...box(0, 0, 200, 90, 'Client', true));
  out.push(...box(320, 0, 200, 90, 'API Gateway'));
  out.push(...box(640, 0, 200, 90, 'Service'));
  out.push(...box(640, 260, 200, 110, 'Database'));
  out.push(...pill(320, 260, 200, 90, 'Cache'));

  out.push(connector(200, 40, 320, 40, true));
  out.push(connector(520, 40, 640, 40, true));
  out.push(connector(740, 90, 740, 260));
  out.push(connector(740, 170, 520, 290));
  out.push(connector(520, 300, 420, 300));

  out.push(caption(230, 10, 'HTTPS'));
  out.push(caption(550, 10, 'RPC'));
  out.push(caption(760, 160, 'writes'));
  out.push(caption(600, 220, 'reads'));
  return out;
}

/** Sign-up flow: a wireframe walkthrough with arrows between frames. */
function buildSignupFlow(): ExcalidrawElement[] {
  const out: ExcalidrawElement[] = [];
  const W = 220;
  const H = 150;
  const GAP = 80;
  const frames = ['Landing', 'Sign up', 'Confirm email', 'Dashboard'];

  frames.forEach((label, i) => {
    out.push(...box(i * (W + GAP), 0, W, H, label, i === frames.length - 1));
  });
  for (let i = 0; i < frames.length - 1; i++) {
    out.push(connector(i * (W + GAP) + W, 75, (i + 1) * (W + GAP), 75, true));
  }

  const fieldY = H + 70;
  const fields: { label: string; x: number; y: number }[] = [
    { label: 'Email', x: W + GAP + 20, y: fieldY },
    { label: 'Password', x: W + GAP + 20, y: fieldY + 62 },
    { label: 'Code', x: (W + GAP) * 2 + 20, y: fieldY },
  ];
  for (const field of fields) {
    out.push(caption(field.x, field.y, field.label));
    out.push(...box(field.x, field.y + 22, 180, 40, ''));
  }
  out.push(...box(W + GAP + 20, fieldY + 130, 180, 44, 'Continue', true));
  out.push(
    caption(
      (W + GAP) * 3 + 20,
      fieldY,
      'Welcome — open a template\nor start sketching.',
      14,
    ),
  );
  return out;
}

/** User story map: spine activities + story cards below each. */
function buildUserStoryMap(): ExcalidrawElement[] {
  const out: ExcalidrawElement[] = [];
  const activities = ['Discover', 'Sign up', 'First sketch', 'Collaborate'];
  const stories = [
    ['See the product pitch', 'Understand the value'],
    ['Create account', 'Verify email'],
    ['Open a template', 'Draw a first shape'],
    ['Invite a teammate', 'Chat with the copilot'],
  ];

  activities.forEach((label, i) => {
    out.push(...box(i * 380, 0, 300, 70, label, true));
  });
  stories.forEach((column, i) => {
    column.forEach((text, j) => {
      out.push(...note(i * 380 + j * 150, 160 + (i % 2) * 130, 140, text));
    });
  });
  return out;
}

/** Sprint board: three columns of sticky notes under column headers. */
function buildSprintBoard(): ExcalidrawElement[] {
  const out: ExcalidrawElement[] = [];
  const columns = ['To do', 'Doing', 'Done'];
  const cards = [
    ['Wire the copy button', 'Persist camera position', 'Empty-state illustration'],
    ['Smart float nudging', 'Template seeding'],
    ['Auth redesign', 'Glass surfaces'],
  ];

  columns.forEach((label, i) => {
    out.push(caption(i * 360, 0, label, 16));
    cards[i].forEach((text, j) => {
      out.push(...note(i * 360, 70 + j * 130, 220, text));
    });
  });
  out.push(
    createShapeElements({
      kind: 'rectangle',
      x: snap(720),
      y: snap(-20),
      width: 16,
      height: 520,
      style: HAIRLINE,
      rounded: false,
    })[0],
  );
  return out;
}

const BUILDERS: Record<TemplateId, () => ExcalidrawElement[]> = {
  'system-architecture': buildSystemArchitecture,
  'signup-flow': buildSignupFlow,
  'user-story-map': buildUserStoryMap,
  'sprint-board': buildSprintBoard,
};

export function buildTemplateSeed(templateId: string): string {
  const builder = BUILDERS[templateId as TemplateId];
  if (!builder) return '';
  return serializeScene(builder());
}
