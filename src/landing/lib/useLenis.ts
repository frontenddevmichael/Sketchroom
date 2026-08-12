import { useEffect } from 'react';
import Lenis from 'lenis';

let sharedLenis: Lenis | null = null;
let lenisRefCount = 0;
let lenisMO: MutationObserver | null = null;
let resizePending = false;

/**
 * Mount a single app-wide Lenis smooth scroller. Multiple components may call
 * this hook; only one Lenis instance is ever created, torn down when the last
 * subscriber unmounts. `anchors: true` makes native `#anchor` links scroll
 * smoothly instead of jump-cutting.
 */
export function useLenis() {
  useEffect(() => {
    lenisRefCount += 1;
    if (!sharedLenis) {
      sharedLenis = new Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        anchors: true,
        touchMultiplier: 1.4,
      });
      const raf = (time: number) => {
        sharedLenis?.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);

      // Lenis re-measures its scroll limit only on window resize, but lazy
      // sections change the page height without one — the pinned walkthrough
      // swaps a 600vh placeholder for its own 600vh pin spacer, passing
      // through a much shorter document on the way. A stale limit silently
      // caps wheel scrolling mid-page (the scrollbar still moves — native
      // scrolling works — but the wheel gets clamped at the old limit).
      // ResizeObserver can't see this (the root/body boxes don't resize with
      // content), so watch DOM mutations and re-measure dimensions only —
      // never `resize()`, which would reset live scroll momentum. Coalesced
      // to one pass per frame.
      const syncDimensions = () => {
        if (resizePending) return;
        resizePending = true;
        requestAnimationFrame(() => {
          resizePending = false;
          sharedLenis?.dimensions.resize();
        });
      };
      lenisMO = new MutationObserver(syncDimensions);
      lenisMO.observe(document.documentElement, { childList: true, subtree: true });
    }
    return () => {
      lenisRefCount -= 1;
      if (lenisRefCount <= 0 && sharedLenis) {
        sharedLenis.destroy();
        sharedLenis = null;
        lenisMO?.disconnect();
        lenisMO = null;
        resizePending = false;
        lenisRefCount = 0;
      }
    };
  }, []);
}

export function getLenis() {
  return sharedLenis;
}