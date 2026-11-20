import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { X } from 'lucide-react';
import './RoomCoachmarks.css';

const COACHMARK_KEY = 'sketchroom.coachmarks.v1';

interface CoachmarkTarget {
  ref: RefObject<HTMLElement | null>;
  placement: 'right' | 'left' | 'below' | 'above';
  text: string;
}

/**
 * First-run coachmarks: three sequential single-line callouts (tool rail, AI
 * bar, Share), shown once only, dismissible individually via the X / "Next"
 * (advances), or wholesale via "Got it". Pills are neutral glass — they are
 * informational rather than AI-driven.
 */
export function RoomCoachmarks({
  railRef,
  aiRef,
  shareRef,
}: {
  railRef: RefObject<HTMLElement | null>;
  aiRef: RefObject<HTMLElement | null>;
  shareRef: RefObject<HTMLElement | null>;
}) {
  const [step, setStep] = useState(() => {
    try {
      return localStorage.getItem(COACHMARK_KEY) === 'dismissed' ? -1 : 0;
    } catch {
      return 0;
    }
  });

  if (step < 0) return null;

  const finish = () => {
    setStep(-1);
    try {
      localStorage.setItem(COACHMARK_KEY, 'dismissed');
    } catch {
      // ignore
    }
  };
  const next = () => setStep((s) => (s >= 2 ? -1 : s + 1));

  const steps: CoachmarkTarget[] = [
    {
      ref: railRef,
      placement: 'right',
      text: 'Tools live on the left — select, draw, sticky notes, shapes, and the block library.',
    },
    {
      ref: aiRef,
      placement: 'above',
      text: 'The AI copilot lives here — ask it to draft, refine, or answer.',
    },
    {
      ref: shareRef,
      placement: 'below',
      text: 'Invite your team with Share.',
    },
  ];
  const current = steps[step];

  return (
    <CoachmarkPill
      targetRef={current.ref}
      placement={current.placement}
      text={current.text}
      last={step === steps.length - 1}
      onNext={next}
      onFinish={finish}
    />
  );
}

function CoachmarkPill({
  targetRef,
  placement,
  text,
  last,
  onNext,
  onFinish,
}: {
  targetRef: RefObject<HTMLElement | null>;
  placement: 'right' | 'left' | 'below' | 'above';
  text: string;
  last: boolean;
  onNext: () => void;
  onFinish: () => void;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const target = targetRef.current;
      const pill = pillRef.current;
      if (!target || !pill) return;
      const tr = target.getBoundingClientRect();
      const pw = pill.offsetWidth;
      const ph = pill.offsetHeight;
      if (!pw || !ph || tr.width === 0) return;
      let left: number;
      let top: number;
      if (placement === 'right') {
        left = tr.right + 12;
        top = tr.top + tr.height / 2 - ph / 2;
      } else if (placement === 'left') {
        left = tr.left - pw - 12;
        top = tr.top + tr.height / 2 - ph / 2;
      } else if (placement === 'above') {
        left = tr.left + tr.width / 2 - pw / 2;
        top = tr.top - ph - 12;
      } else {
        left = tr.left + tr.width / 2 - pw / 2;
        top = tr.bottom + 12;
      }
      left = Math.max(12, Math.min(left, window.innerWidth - pw - 12));
      top = Math.max(12, Math.min(top, window.innerHeight - ph - 12));
      setPos({ left, top });
    };
    place();
    const frame = requestAnimationFrame(place);
    const t1 = window.setTimeout(place, 200);
    const t2 = window.setTimeout(place, 800);
    const onResize = () => place();
    window.addEventListener('resize', onResize);
    const target = targetRef.current;
    let observer: ResizeObserver | null = null;
    if (target) {
      observer = new ResizeObserver(place);
      observer.observe(target);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [targetRef, placement]);

  return (
    <div
      ref={pillRef}
      className="room-coachmark glass"
      role="note"
      aria-label="Getting started"
      aria-live="polite"
      style={pos ? { left: pos.left, top: pos.top } : undefined}
    >
      <p className="room-coachmark-text">{text}</p>
      <div className="room-coachmark-actions">
        <button className="room-coachmark-done" onClick={onFinish}>
          Got it
        </button>
        {!last && (
          <button className="room-coachmark-next" onClick={onNext}>
            Next
          </button>
        )}
      </div>
      <button className="room-coachmark-x" onClick={onNext} aria-label={last ? 'Dismiss' : 'Next'}>
        <X size={14} />
      </button>
    </div>
  );
}
