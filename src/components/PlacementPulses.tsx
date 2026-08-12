import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from 'tldraw';
import { onPlacementPulse, type PlacementPulseEvent } from './placementPulse';
import './PlacementPulses.css';

interface ActivePulse extends PlacementPulseEvent {
  leaving: boolean;
}

// The "snap" feeling of a block landing, conveyed purely through motion: a
// ring that springs out and dissolves. Neutral for library drops, green for
// AI placements (green is the AI's color in this system). No sound, no
// confetti — just one disciplined moment per placement.
export function PlacementPulses({ editor }: { editor: Editor | null }) {
  const [pulses, setPulses] = useState<ActivePulse[]>([]);

  useEffect(() => {
    return onPlacementPulse((e) => {
      const pulse: ActivePulse = { ...e, leaving: false };
      setPulses((prev) => [...prev, pulse]);
      window.setTimeout(() => {
        setPulses((prev) => prev.map((p) => (p.id === e.id ? { ...p, leaving: true } : p)));
      }, 340);
      window.setTimeout(() => {
        setPulses((prev) => prev.filter((p) => p.id !== e.id));
      }, 900);
    });
  }, []);

  const host = editor?.getContainer().parentElement ?? null;
  if (!host || pulses.length === 0) return null;

  return createPortal(
    <div className="placement-pulse-layer" aria-hidden="true">
      {pulses.map((p) => (
        <span
          key={p.id}
          className={`placement-pulse placement-pulse-${p.tone}${p.leaving ? ' leaving' : ''}`}
          style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
        />
      ))}
    </div>,
    host
  );
}
