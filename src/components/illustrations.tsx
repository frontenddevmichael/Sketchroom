import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import './illustrations.css';

// The empty-state illustration family: one linework language (single-weight,
// rounded, grayscale with green reserved for the AI sparkle), each drawing
// itself in with the product's spring when it appears. Every illustration is
// specific to its moment — a room, a search, a page, a conversation — not a
// generic "empty box" template.

const d = (delay: number): CSSProperties => ({ '--d': `${delay}ms` } as CSSProperties);

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg className="illo" viewBox="0 0 120 90" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

// pathLength={1} + dasharray 1 makes draw speed proportional to path length
// (every element draws itself over its own window, the same technique as the
// loader star) — never the fixed-dasharray hack that makes short strokes race.
const S = ({ path, style }: { path: string; style?: CSSProperties }) => (
  <path className="illo-stroke" pathLength={1} style={style} d={path} />
);

// ── No rooms yet: a lone whiteboard on legs with a first sketch mark ────
export function RoomsEmptyIllo() {
  return (
    <Svg>
      <S path="M32 20 H88 V68 H32 Z" style={d(0)} />
      <S path="M42 68 L36 82" style={d(140)} />
      <S path="M78 68 L84 82" style={d(200)} />
      <S path="M46 42 q7 -6 14 0 t14 0" style={d(260)} />
      <S path="M96 22 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" style={d(340)} />
    </Svg>
  );
}

// ── No search results: magnifier over a dashed trail ───────────────────
export function SearchEmptyIllo() {
  return (
    <Svg>
      <S path="M44 40 m -14 0 a 14 14 0 1 0 28 0 a 14 14 0 1 0 -28 0" style={d(0)} />
      <S path="M56 52 L74 70" style={d(140)} />
      <S path="M34 68 q6 8 14 8" style={d(240)} />
      <S path="M88 38 q9 -2 11 6" style={d(300)} />
      <S path="M96 20 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 z" style={d(380)} />
    </Svg>
  );
}

// ── No versions yet: a page with a clock ───────────────────────────────
export function HistoryEmptyIllo() {
  return (
    <Svg>
      <S path="M42 18 H78 V74 H42 Z" style={d(0)} />
      <S path="M78 30 H64 V18" style={d(120)} />
      <S path="M60 46 m -11 0 a 11 11 0 1 0 22 0 a 11 11 0 1 0 -22 0" style={d(220)} />
      <S path="M60 39 V48 L66 52" style={d(340)} />
    </Svg>
  );
}

// ── No AI suggestions yet: a thought bubble holding a green sparkle ────
export function AiEmptyIllo() {
  return (
    <Svg>
      <S
        path="M56 26 a 18 18 0 0 1 18 18 a 18 18 0 0 1 -18 18 h -8 l -3 9 9 -9 h -6 a 18 18 0 0 1 -10 -18 a 18 18 0 0 1 18 -18 z"
        style={d(0)}
      />
      <S path="M70 60 l 4 9 12 -8" style={d(180)} />
      <path
        className="illo-stroke illo-accent"
        pathLength={1}
        style={d(320)}
        d="M56 44 l 2.5 6.5 6.5 2.5 -6.5 2.5 -2.5 6.5 -2.5 -6.5 -6.5 -2.5 6.5 -2.5 z"
      />
    </Svg>
  );
}

// ── No collaborators yet: envelope with a person above ─────────────────
export function ShareEmptyIllo() {
  return (
    <Svg>
      <S path="M34 36 H86 V64 H34 Z" style={d(0)} />
      <S path="M34 36 L60 54 L86 36" style={d(160)} />
      <S path="M60 18 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0" style={d(280)} />
      <S path="M48 30 q12 7 24 0" style={d(360)} />
    </Svg>
  );
}

// ── Limit reached: a gauge whose needle points at a locked cap ────────
export function LimitEmptyIllo() {
  return (
    <Svg>
      <S path="M32 66 a 26 26 0 0 1 56 0" style={d(0)} />
      <S path="M60 66 L76 54" style={d(160)} />
      <S path="M54 26 H68 V38 H54 Z" style={d(260)} />
      <S path="M56 26 v -5 a 5 5 0 0 1 10 0 v 5" style={d(340)} />
    </Svg>
  );
}

// ── Something went wrong: a thread that loops, then breaks ─────────────
export function ErrorIllo() {
  return (
    <Svg>
      <S path="M32 34 q 12 -10 24 0 q 12 10 24 0" style={d(0)} />
      <S path="M63 45 m -8 0 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0" style={d(200)} />
      <S path="M58 53 q -3 12 -9 14" style={d(320)} />
      <S path="M92 28 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 z" style={d(440)} />
    </Svg>
  );
}

// ── Blank canvas: a pencil sketching a note, a sparkle waiting ─────────
// The product's centerpiece empty state — a small hand-drawn scene of the
// act itself (pencil meeting note) instead of a floating stock icon.
export function CanvasEmptyIllo() {
  return (
    <Svg>
      <S path="M40 24 H76 V52 H40 Z" style={d(0)} />
      <S path="M52 40 q5 -5 10 0 t10 0" style={d(130)} />
      <S path="M52 47 q5 -4 10 0" style={d(210)} />
      <S path="M74 46 L88 60" style={d(320)} />
      <S path="M74 46 l-4 -4" style={d(390)} />
      <S path="M88 60 l5 -6 l1 7 z" style={d(440)} />
      <path
        className="illo-stroke illo-accent"
        pathLength={1}
        style={d(560)}
        d="M98 16 l2 5.5 5.5 2 -5.5 2 -2 5.5 -2 -5.5 -5.5 -2 5.5 -2 z"
      />
    </Svg>
  );
}

// ── Hand-drawn headline ──────────────────────────────────────────────────
// The title beneath every empty-state illo wears the family's linework: a
// single sketch stroke that draws itself in under the text once the scene
// above has finished. Sized to the rendered title, so long and short
// headlines both get a properly proportioned underline.
export function DrawnTitle({
  children,
  className = '',
  as: Tag = 'p',
  delay = 650,
}: {
  children: ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.offsetWidth);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  return (
    <div ref={ref} className="illo-headline">
      <Tag className={`illo-headline-title ${className}`.trim()}>{children}</Tag>
      {width > 0 && (
        <svg
          className="illo-headline-underline"
          viewBox={`0 0 ${width} 8`}
          width={width}
          height={8}
          fill="none"
          aria-hidden="true"
        >
          <path
            pathLength={1}
            style={{ '--d': `${delay}ms` } as CSSProperties}
            d={`M2 5.5 C ${Math.round(width * 0.22)} 2.5, ${Math.round(width * 0.55)} 6.5, ${width - 2} 4`}
          />
        </svg>
      )}
    </div>
  );
}
