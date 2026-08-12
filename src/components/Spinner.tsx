import './Spinner.css';

// The brand loading mark for small, inline moments (buttons, saves, sends).
// A thin single arc — deliberately NOT a full ring — that advances in
// spring-stepped hops (catch-and-release) instead of a linear sweep, so it
// never reads as a heavyweight loading moment.
export function Spinner({
  size = 16,
  className = '',
  label,
}: {
  size?: number;
  className?: string;
  /** When set, the spinner is announced with this label (aria). */
  label?: string;
}) {
  return (
    <svg
      className={`spinner ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle className="spinner-arc" cx="10" cy="10" r="8" />
    </svg>
  );
}
