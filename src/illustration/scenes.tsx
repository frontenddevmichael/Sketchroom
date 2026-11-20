import type { ReactNode } from 'react';
import { Tag } from '../ui';
import {
  arcs,
  box,
  cursor,
  face,
  line,
  pipe,
  ruler,
  slab,
  type BoxFaces,
} from './iso';
import './illustration.css';

/* ── shared pieces ─────────────────────────────────────────────────────── */

function Faces({ f }: { f: BoxFaces }) {
  return (
    <>
      <path className="iso-face iso-face--top" d={f.top} />
      <path className="iso-face iso-face--left" d={f.left} />
      <path className="iso-face iso-face--right" d={f.right} />
    </>
  );
}

function GhostBox({
  x,
  y,
  z,
  w,
  d,
  h,
}: {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
}) {
  const f = box(x, y, z, w, d, h);
  return (
    <g className="iso-proposal">
      <path d={f.top} />
      <path d={f.left} />
      <path d={f.right} />
    </g>
  );
}

interface SceneProps {
  viewBox: string;
  label: string;
  caption?: ReactNode;
  ghosting?: boolean;
  className?: string;
  children: ReactNode;
}

function Scene({ viewBox, label, caption, ghosting, className, children }: SceneProps) {
  return (
    <div className={['iso-scene', className].filter(Boolean).join(' ')}>
      <svg
        className={ghosting ? 'iso iso--ghosting' : 'iso'}
        viewBox={viewBox}
        role="img"
        aria-label={label}
      >
        {children}
      </svg>
      {caption && <span className="iso-scene__tag">{caption}</span>}
    </div>
  );
}

/* ── HeroDraftingTable — the landing hero ─────────────────────────────────
   A drafting board with a half-built layout. One block is still a proposal,
   held by the placement arm; two cursors are live on the board. In
   `committed` state the proposal drops into place and becomes solid ink. */

export function HeroDraftingTable({
  state = 'draft',
  caption,
}: {
  state?: 'draft' | 'committed';
  caption?: ReactNode;
}) {
  const board = slab(-3, -2, 6, 4, 0.16);
  const rule = ruler(-3, 1.84, 0.16, 6);

  const blocks: Array<[number, number, number]> = [
    [-2.4, -1.6, 0.55],
    [-1.2, -1.6, 0.78],
    [0, -1.6, 0.42],
    [-2.4, -0.4, 0.62],
    [-1.2, -0.4, 0.34],
  ];

  const proposals = pipe(
    [
      [-1.2, -1.16, 0.78],
      [-0.2, -1.16, 1.05],
      [0.48, -0.9, 0.9],
    ],
    24
  );

  const mast = box(2.05, -1.85, 0, 0.28, 0.28, 2.5);
  const arm = box(0.55, -1.85, 2.3, 1.5, 0.28, 0.2);
  const hook = line(
    [
      [0.55, -1.71, 2.3],
      [0.55, -1.71, 1.62],
    ],
    24
  );

  const ghost: [number, number, number, number, number, number] = [0, -0.4, 0.95, 0.98, 0.98, 0.5];

  return (
    <Scene
      viewBox="-185 -235 380 340"
      label="An isometric drafting board with a half-built layout, one block held as a dashed proposal, and two live cursors"
      caption={caption}
      ghosting={state === 'draft'}
    >
      <g>
        <Faces f={board} />
        <Faces f={rule.body} />
        {rule.ticks.map((t, i) => (
          <circle key={i} className="iso-dot" cx={t.x} cy={t.y} r={i % 2 ? 0.8 : 1.4} />
        ))}
      </g>

      <g>
        {blocks.map(([x, y, h], i) => (
          <Faces key={i} f={box(x, y, 0.16, 0.98, 0.98, h)} />
        ))}
        {state === 'committed' && <Faces f={box(...ghost)} />}
        {state === 'draft' && <GhostBox x={ghost[0]} y={ghost[1]} z={ghost[2]} w={ghost[3]} d={ghost[4]} h={ghost[5]} />}
      </g>

      <g>
        <path className="iso-signal" d={proposals.path} />
        <circle className="iso-dot" cx={proposals.end.x} cy={proposals.end.y} r={2.4} />
        <path className="iso-signal" d={hook} />
        <Faces f={mast} />
        <Faces f={arm} />
      </g>

      <g>
        <path className="iso-accent" d={cursor(-1.75, 0.55)} />
        <path className="iso-signal" d={arcs(-1.75, 0.55, 0)[0]} />
        <path className="iso-signal" d={arcs(-1.75, 0.55, 0)[1]} />
        <path className="iso-accent" d={cursor(1.35, 0.75)} />
        <path className="iso-signal" d={arcs(1.35, 0.75, 0)[0]} />
      </g>
    </Scene>
  );
}

/* ── SketchIn — the drawing-in loader ─────────────────────────────────────
   A single cube drawn edge-first. Used while a room or a snapshot loads. */

export function SketchIn({ caption }: { caption?: ReactNode }) {
  const cube = box(-0.5, -0.5, 0, 1, 1, 0.8);
  const base = slab(-0.9, -0.9, 1.8, 1.8, 0.1);
  return (
    <Scene viewBox="-70 -70 140 130" label="Drawing a block" caption={caption} ghosting>
      <Faces f={base} />
      <g className="iso-proposal">
        <path d={cube.top} />
        <path d={cube.left} />
        <path d={cube.right} />
      </g>
      <path className="iso-accent" d={cursor(-0.75, -0.2)} />
    </Scene>
  );
}

/* ── Empty states ────────────────────────────────────────────────────────
   One object, one dashed hint of what could exist. No illustration of a
   sad face, no mascot. */

export function EmptyRooms({ caption }: { caption?: ReactNode }) {
  const sheet = slab(-1.5, -1.1, 3, 2.2, 0.12);
  return (
    <Scene viewBox="-110 -90 220 170" label="An empty draft board" caption={caption}>
      <Faces f={sheet} />
      <GhostBox x={-0.6} y={-0.5} z={0.12} w={1.2} d={1.1} h={0.7} />
      <path className="iso-accent" d={cursor(0.35, 0.3)} />
    </Scene>
  );
}

export function EmptyHistory({ caption }: { caption?: ReactNode }) {
  const layers = [
    slab(-1.4, -1, 2.8, 2, 0.1),
    slab(-1.4, -1, 2.8, 2, 0.1),
    slab(-1.4, -1, 2.8, 2, 0.1),
  ];
  return (
    <Scene viewBox="-120 -140 240 190" label="An empty history stack" caption={caption}>
      {layers.map((f, i) => (
        <g key={i} transform={`translate(0 ${-i * 16})`}>
          <Faces f={f} />
        </g>
      ))}
      <g className="iso-proposal">
        <path d={face([[-1.4, -1, 0.46], [1.4, -1, 0.46], [1.4, 1, 0.46], [-1.4, 1, 0.46]])} />
      </g>
    </Scene>
  );
}

export function EmptyAi({ caption }: { caption?: ReactNode }) {
  const page = slab(-1.3, -0.9, 1.2, 1.8, 0.08);
  const page2 = slab(0.1, -0.9, 1.2, 1.8, 0.08);
  return (
    <Scene viewBox="-120 -110 240 180" label="An open sketchbook with a dashed proposal" caption={caption}>
      <Faces f={page} />
      <Faces f={page2} />
      <g className="iso-proposal">
        <path d={box(0.35, -0.55, 0.08, 0.7, 1.1, 0.02).top} />
        <path d={line([[0.4, -0.4, 0.1], [1.05, -0.4, 0.1]])} />
        <path d={line([[0.4, -0.15, 0.1], [1.05, -0.15, 0.1]])} />
      </g>
      <path className="iso-signal" d={arcs(1.5, 0.4, 0.1)[0]} />
      <path className="iso-signal" d={arcs(1.5, 0.4, 0.1)[1]} />
    </Scene>
  );
}

/* ── SceneTag — the dotted mono annotation that floats on a scene ──────── */

export function SceneTag({ children }: { children: ReactNode }) {
  return <Tag>{children}</Tag>;
}
