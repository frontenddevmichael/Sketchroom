import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Editor } from 'tldraw';

export interface SmartFloatPosition {
  left: number;
  top: number;
}

interface UseSmartFloatOptions {
  /** The floating panel element. */
  ref: RefObject<HTMLElement | null>;
  /** tldraw editor — collision detection only runs when present. */
  editor: Editor | null;
  /** Unique key per panel; persists a manual position under this key. */
  panelKey: string;
  /** Gap kept between the panel and canvas content when nudging. */
  margin?: number;
  /** When true the panel never nudges and can't be dragged. */
  disabled?: boolean;
  /** When false the panel still drags but never auto-nudges clear of canvas
   *  content, so it never appears to move on its own. */
  nudgeEnabled?: boolean;
}

export interface SmartFloat {
  /** Panel position for inline styles; null until the resting spot is measured
   *  (the panel's CSS layout rules until then). */
  position: SmartFloatPosition | null;
  dragging: boolean;
  /** True once the user has manually moved (or a saved position was restored). */
  manual: boolean;
  /** Pointer handler for the drag handle. */
  onPointerDown: (e: React.PointerEvent) => void;
  /** Return the panel to its resting position. */
  reset: () => void;
}

const STORAGE_PREFIX = 'sketchroom.float.v1.';

function loadSaved(key: string): SmartFloatPosition | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SmartFloatPosition;
    if (Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) return parsed;
    return null;
  } catch {
    return null;
  }
}

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function intersects(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Gives a floating overlay panel "smart" behavior over the tldraw canvas:
 * - Detects canvas shapes whose rendered bounds sit behind the panel and nudges
 *   the panel clear of them (minimal axis move, clamped to the container).
 * - Lets the user drag the panel anywhere; the position is persisted per panel.
 *   While a manual position is active, nudging pauses so the user stays in charge.
 *
 * The panel's CSS keeps its resting layout; on mount this hook captures the
 * visual resting position (getBoundingClientRect, so transforms are respected),
 * then owns left/top via inline styles for dragging and nudging.
 */
// Below this width the floating panels become fixed bottom sheets — the
// smart-float machinery (captured positions, nudging, drag persistence) would
// fight the sheet's CSS layout with inline left/top, so it goes fully passive.
const SHEET_BREAKPOINT = '(max-width: 640px)';

export function useSmartFloat({
  ref,
  editor,
  panelKey,
  margin = 12,
  disabled = false,
  nudgeEnabled = true,
}: UseSmartFloatOptions): SmartFloat {
  const [saved] = useState<SmartFloatPosition | null>(() => loadSaved(panelKey));
  const restingRef = useRef<SmartFloatPosition>({ left: 0, top: 0 });
  const [position, setPosition] = useState<SmartFloatPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const [manual, setManual] = useState(saved !== null);
  const dragStart = useRef<{ pointerX: number; pointerY: number; left: number; top: number } | null>(null);
  const mounted = useRef(false);
  const [isSheet, setIsSheet] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(SHEET_BREAKPOINT).matches
  );

  // Track the breakpoint live so a resize across it hands positioning back
  // to (or back from) the sheet CSS without a reload.
  useEffect(() => {
    const mq = window.matchMedia(SHEET_BREAKPOINT);
    const onChange = () => setIsSheet(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel || isSheet) return;
    const container = (panel.offsetParent as HTMLElement | null) ?? panel.parentElement;
    // Kill any entry animation first so the synchronous rect read below
    // reflects the resting layout, not the running keyframe.
    panel.style.animation = 'none';
    // Measure while the panel still uses its CSS layout (position is null on
    // the first render, so no inline left/top has overridden it yet).
    const containerRect = container?.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    restingRef.current = containerRect
      ? { left: panelRect.left - containerRect.left, top: panelRect.top - containerRect.top }
      : { left: 0, top: 0 };
    // Inline left/top now own the position: drop the CSS offsets, centering
    // margin, and any translate that would fight the measured resting spot.
    // Measured BEFORE clearing so the resting value reflects the true layout.
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.margin = '0';
    panel.style.transform = 'none';
    panel.setAttribute('data-float', 'active');
    panel.style.opacity = '0';
    mounted.current = true;
    requestAnimationFrame(() => {
      panel.style.opacity = '1';
      setPosition(saved ?? restingRef.current);
    });
  }, [ref, panelKey, saved, isSheet]);

  const reset = useCallback(() => {
    setManual(false);
    setPosition(restingRef.current);
    try {
      localStorage.removeItem(STORAGE_PREFIX + panelKey);
    } catch {
      // ignore
    }
  }, [panelKey]);

  // Nudge clear of canvas content. Re-runs on any store change (shape edits and
  // camera moves both land there) plus a slow safety interval.
  useEffect(() => {
    if (disabled || isSheet || !nudgeEnabled || !editor || !mounted.current) return;
    let raf = 0;
    const detect = () => {
      raf = 0;
      const panel = ref.current;
      if (!panel || dragging || manual) return;
      const container = panel.offsetParent as HTMLElement | null;
      if (!container) return;
      const cam = editor.getCamera();
      const shapes = editor.getCurrentPageShapes();
      if (shapes.length === 0) return;
      for (let pass = 0; pass < 4; pass++) {
        const left = panel.offsetLeft;
        const top = panel.offsetTop;
        const w = panel.offsetWidth;
        const h = panel.offsetHeight;
        const panelRect: Rect = { left, top, right: left + w, bottom: top + h };
        let union: Rect | null = null;
        for (const shape of shapes) {
          const b = editor.getShapePageBounds(shape.id);
          if (!b) continue;
          const rect: Rect = {
            left: (b.x - cam.x) * cam.z,
            top: (b.y - cam.y) * cam.z,
            right: (b.x - cam.x + b.w) * cam.z,
            bottom: (b.y - cam.y + b.h) * cam.z,
          };
          if (!intersects(panelRect, rect)) continue;
          union = union
            ? {
                left: Math.min(union.left, rect.left),
                top: Math.min(union.top, rect.top),
                right: Math.max(union.right, rect.right),
                bottom: Math.max(union.bottom, rect.bottom),
              }
            : rect;
        }
        if (!union) return;
        const moveLeft = union.right - panelRect.left + margin;
        const moveRight = panelRect.right - union.left + margin;
        const moveUp = union.bottom - panelRect.top + margin;
        const moveDown = panelRect.bottom - union.top + margin;
        const best = Math.min(moveLeft, moveRight, moveUp, moveDown);
        let dx = 0;
        let dy = 0;
        if (best === moveLeft) dx = -moveLeft;
        else if (best === moveRight) dx = moveRight;
        else if (best === moveUp) dy = -moveUp;
        else dy = moveDown;
        if (dx === 0 && dy === 0) break;
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        setPosition((p) => {
          const base = p ?? restingRef.current;
          return {
            left: Math.min(Math.max(0, base.left + dx), Math.max(0, cw - w)),
            top: Math.min(Math.max(0, base.top + dy), Math.max(0, ch - h)),
          };
        });
      }
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(detect);
    };
    const unlisten = editor.store.listen(schedule);
    const onResize = () => schedule();
    window.addEventListener('resize', onResize);
    const interval = window.setInterval(schedule, 2500);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      unlisten();
      window.removeEventListener('resize', onResize);
      window.clearInterval(interval);
    };
  }, [ref, editor, margin, disabled, nudgeEnabled, dragging, manual, isSheet]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const start = dragStart.current;
      const panel = ref.current;
      if (!start || !panel) return;
      const container = panel.offsetParent as HTMLElement | null;
      const cw = container?.clientWidth ?? panel.offsetWidth;
      const ch = container?.clientHeight ?? panel.offsetHeight;
      const maxLeft = Math.max(0, cw - panel.offsetWidth);
      const maxTop = Math.max(0, ch - panel.offsetHeight);
      setPosition({
        left: Math.min(maxLeft, Math.max(0, start.left + (e.clientX - start.pointerX))),
        top: Math.min(maxTop, Math.max(0, start.top + (e.clientY - start.pointerY))),
      });
    };
    const onUp = () => {
      setDragging(false);
      dragStart.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, ref]);

  // Persist the manual position once a drag settles.
  useEffect(() => {
    if (dragging || !manual || !position) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + panelKey, JSON.stringify(position));
    } catch {
      // ignore
    }
  }, [dragging, manual, position, panelKey]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || isSheet) return;
    const panel = ref.current;
    if (!panel) return;
    e.preventDefault();
    dragStart.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      left: panel.offsetLeft,
      top: panel.offsetTop,
    };
    setDragging(true);
    setManual(true);
    try {
      const t = e.currentTarget as HTMLElement;
      t.setPointerCapture?.(e.pointerId);
    } catch {
      // pointer capture is optional
    }
  };

  return { position, dragging, manual, onPointerDown, reset };
}
