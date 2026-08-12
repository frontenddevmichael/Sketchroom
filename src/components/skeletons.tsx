import type { CSSProperties } from 'react';
import './skeletons.css';

// Content-aware skeletons: each composite mirrors the exact shape of the real
// content it will be replaced by (thumbnail, title line, meta, avatars), so
// the swap never surprises the eye. All motion uses the product's spring
// language and the elevation-aware shimmer band — never a flat sweep.

interface SkelProps {
  className?: string;
  style?: CSSProperties;
}

function Block({ className = '', style }: SkelProps) {
  return <span className={`skel ${className}`} style={style} aria-hidden="true" />;
}

const stagger = (index: number): CSSProperties => ({ '--i': index } as CSSProperties);

// ── Dashboard room card ────────────────────────────────────────────────
export function RoomCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div className="skel-card skel-room-card" style={stagger(index)} aria-hidden="true">
      <div className="skel-room-thumb" />
      <div className="skel-room-body">
        <Block className="skel-line skel-line-title" />
        <Block className="skel-line skel-line-meta" />
        <div className="skel-room-avatars">
          <Block className="skel-avatar" />
          <Block className="skel-avatar" />
        </div>
      </div>
    </div>
  );
}

// ── Version-history / member / invite list row ─────────────────────────
export function ListRowSkeleton({
  index = 0,
  thumb = true,
}: {
  index?: number;
  thumb?: boolean;
}) {
  return (
    <div className="skel-row" style={stagger(index)} aria-hidden="true">
      {thumb && <Block className="skel-row-thumb" />}
      <div className="skel-row-lines">
        <Block className="skel-line skel-line-row-main" />
        <Block className="skel-line skel-line-row-sub" />
      </div>
      <Block className="skel-row-action" />
    </div>
  );
}

// ── Block library icon-tile grid ───────────────────────────────────────
export function TileGridSkeleton({
  count = 12,
  columns = 3,
}: {
  count?: number;
  columns?: number;
}) {
  return (
    <div
      className="skel-tile-grid"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skel-tile" style={stagger(i)}>
          <Block className="skel-tile-icon" />
          <Block className="skel-line skel-line-tile-label" />
        </div>
      ))}
    </div>
  );
}

// ── Settings form fields ───────────────────────────────────────────────
export function FormSkeleton({ index = 0, rows = 3 }: { index?: number; rows?: number }) {
  return (
    <div className="skel-form" style={stagger(index)} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel-form-row">
          <Block className="skel-line skel-line-label" />
          <Block className="skel-field" />
        </div>
      ))}
    </div>
  );
}

// ── Billing plan card ──────────────────────────────────────────────────
export function PlanCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div className="skel-card skel-plan-card" style={stagger(index)} aria-hidden="true">
      <Block className="skel-line skel-line-plan-name" />
      <Block className="skel-line skel-line-plan-price" />
      <Block className="skel-line skel-line-plan-tag" />
      {Array.from({ length: 4 }, (_, i) => (
        <Block key={i} className="skel-line skel-line-plan-item" />
      ))}
      <Block className="skel-plan-cta" />
    </div>
  );
}
