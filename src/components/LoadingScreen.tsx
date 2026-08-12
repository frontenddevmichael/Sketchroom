import type { CSSProperties } from 'react';

// The product's signature loading mark, shared by every first-paint moment
// (session check, route suspense, room boot): a thin dashed ring turning
// slowly around the hand-drawn star as it draws itself in — the same sketch
// identity as the product, composed on a breathing dot-grid backdrop.
export function LoaderMark({ size = 56 }: { size?: number }) {
  return (
    <span className="loader-mark-wrap" aria-hidden="true">
      <svg className="loader-mark" viewBox="0 0 48 48" width={size} height={size} fill="none">
        <circle className="loader-ring" cx="24" cy="24" r="20" />
        <path
          className="loader-star"
          pathLength={1}
          d="M24 6l3.8 11.2L39 20l-9 4.2L24 36l-6-11.8L9 20l11.2-2.8z"
        />
      </svg>
    </span>
  );
}

// The wordmark with per-letter spring reveal, plus a hand-drawn underline
// that draws itself in beneath — the small flourish that keeps a loader from
// reading as a default spinner.
export function LoaderWordmark() {
  return (
    <div className="loader-word-block">
      <div className="loader-wordmark" aria-hidden="true">
        {'Sketchroom'.split('').map((ch, i) => (
          <span key={i} className="loader-letter" style={{ '--i': i } as CSSProperties}>
            {ch}
          </span>
        ))}
      </div>
      <svg
        className="loader-underline"
        viewBox="0 0 132 8"
        width="132"
        height="8"
        fill="none"
        aria-hidden="true"
      >
        <path pathLength={1} d="M3 5 C 30 2, 60 7, 129 3" />
      </svg>
    </div>
  );
}

export function LoadingScreen({
  label = 'Loading',
  sub,
}: {
  label?: string;
  sub?: string;
}) {
  return (
    <div className="loading-screen" role="status" aria-label={label}>
      <LoaderMark />
      <LoaderWordmark />
      {sub ? (
        <p className="loader-label">
          {label}
          <span className="loader-sub">{sub}</span>
        </p>
      ) : (
        <p className="loader-label">{label}</p>
      )}
    </div>
  );
}
