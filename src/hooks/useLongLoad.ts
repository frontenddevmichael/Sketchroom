import { useEffect, useState } from 'react';

// Long-load honesty: after a reasonable threshold (default 5s) of continuous
// loading, surface reassuring cycling copy instead of silent shimmer. The
// phrases rotate so the wait never reads as frozen; the caller can keep the
// skeleton underneath but renders the copy as the dominant message. All state
// changes happen inside timer callbacks so the hook never triggers an extra
// render synchronously from an effect.
export function useLongLoad(
  active: boolean,
  phrases: string[],
  thresholdMs = 5000
): { phase: 'loading' | 'stall'; phrase: string } {
  const [stalled, setStalled] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    // Re-arm on every activation change: clear any prior marker, then start
    // the stall clock from zero.
    const reset = window.setTimeout(() => {
      setStalled(false);
      setPhraseIndex(0);
    }, 0);
    if (!active) return () => window.clearTimeout(reset);
    const t = window.setTimeout(() => setStalled(true), thresholdMs);
    return () => {
      window.clearTimeout(reset);
      window.clearTimeout(t);
    };
  }, [active, thresholdMs]);

  useEffect(() => {
    if (!stalled) return;
    if (phrases.length < 2) return;
    const t = window.setInterval(() => setPhraseIndex((i) => (i + 1) % phrases.length), 2600);
    return () => window.clearInterval(t);
  }, [stalled, phrases.length]);

  return {
    phase: stalled ? 'stall' : 'loading',
    phrase: stalled ? phrases[phraseIndex % phrases.length] : phrases[0],
  };
}
