import { useState } from 'react';

// Stale-while-revalidate: keeps the last known value while a query refreshes
// (Convex returns `undefined` for a re-running query, e.g. when its args
// change), so content never blanks back to a skeleton for a refresh. The
// caller renders a skeleton only when there is no stale data at all
// (hasStale === false).
//
// Implemented with React's "adjusting state during render" pattern: when the
// query returns a genuinely new value we adopt it in the same render (guarded
// by reference identity so it converges); when it blanks to undefined we keep
// the last-known value without an effect round-trip or a ref read.
export function useStaleData<T>(value: T | undefined): { data: T | undefined; hasStale: boolean } {
  const [stale, setStale] = useState<T | undefined>(undefined);
  if (value !== undefined && stale !== value) {
    setStale(value);
  }
  const data = value !== undefined ? value : stale;
  return { data, hasStale: stale !== undefined };
}
