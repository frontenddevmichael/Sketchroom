import type { CSSProperties } from 'react';

/**
 * First-visit onboarding: a quiet scene that draws itself in step by step —
 * pencil, then sticky note, then the connector between them — teaching the
 * product's core loop through its own linework. Dismissed by the first real
 * stroke; never replayed for a room once shown.
 */
export function OnboardingSketch() {
  const d = (ms: number): CSSProperties => ({ ['--d' as string]: `${ms}ms` }) as CSSProperties;
  return (
    <svg viewBox="0 0 300 130" fill="none" aria-hidden="true">
      {/* Pencil — body, then tip, then ferrule. */}
      <path className="illo-stroke" pathLength={1} d="M36 86 L42 64 L92 48 L86 70 Z" style={d(0)} />
      <path className="illo-stroke" pathLength={1} d="M92 48 L108 38 L100 64" style={d(150)} />
      <path className="illo-stroke" pathLength={1} d="M48 78 L51 64" style={d(280)} />
      {/* Sticky note — outline, fold, then the scribbles. */}
      <path className="illo-stroke" pathLength={1} d="M198 42 L274 44 L280 98 L204 100 Z" style={d(900)} />
      <path className="illo-stroke" pathLength={1} d="M274 44 L276 60 L260 58" style={d(1030)} />
      <path className="illo-stroke" pathLength={1} d="M212 64 q6 -5 12 0 t12 0" style={d(1160)} />
      <path className="illo-stroke" pathLength={1} d="M212 78 q6 -5 12 0 t12 0" style={d(1240)} />
      <path className="illo-stroke" pathLength={1} d="M212 90 q6 -4 12 0" style={d(1310)} />
      {/* Connector — the curve, its arrowhead, then the accent sparkle. */}
      <path className="illo-stroke" pathLength={1} d="M104 46 C142 40 164 64 198 70" style={d(1800)} />
      <path className="illo-stroke" pathLength={1} d="M190 67 L198 70 L191 77" style={d(1960)} />
      <path
        className="illo-stroke illo-accent"
        pathLength={1}
        d="M258 22 l2 5.5 5.5 2 -5.5 2 -2 5.5 -2 -5.5 -5.5 -2 5.5 -2 z"
        style={d(2150)}
      />
    </svg>
  );
}
