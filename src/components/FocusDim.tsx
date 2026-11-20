import { useEffect, useState } from 'react';
import type { CanvasApi } from '../canvas/api';
import './FocusDim.css';

interface FocusDimProps {
  api: CanvasApi | null;
  active: boolean;
}

interface Hole {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 36;

// Focus mode: dims everything except the selection, punched out with a
// clip-path hole that tracks the shapes live. The ring is a hairline of the
// heaviest ink — the focused state is a weight change, not a colour.
export function FocusDim({ api, active }: FocusDimProps) {
  const [hole, setHole] = useState<Hole | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!api) return;
    const sync = () => {
      const host = api.container;
      setSize((prev) =>
        prev.w === host.clientWidth && prev.h === host.clientHeight
          ? prev
          : { w: host.clientWidth, h: host.clientHeight },
      );
      const cam = api.camera;
      const bounds = api.selectionBounds();
      if (!bounds) {
        setHole(null);
        return;
      }
      setHole({
        x: (bounds.x - cam.x) * cam.z - PAD,
        y: (bounds.y - cam.y) * cam.z - PAD,
        w: bounds.w * cam.z + PAD * 2,
        h: bounds.h * cam.z + PAD * 2,
      });
    };
    sync();
    const unlisten = api.subscribe(sync);
    const onResize = () => sync();
    window.addEventListener('resize', onResize);
    return () => {
      unlisten();
      window.removeEventListener('resize', onResize);
    };
  }, [api]);

  if (!active || !hole) return null;

  const W = size.w;
  const H = size.h;
  const hx = Math.max(0, Math.min(hole.x, W));
  const hy = Math.max(0, Math.min(hole.y, H));
  const hw = Math.max(0, Math.min(hole.w, W - hx));
  const hh = Math.max(0, Math.min(hole.h, H - hy));

  // Outer outline clockwise, hole counter-clockwise, bridged through the
  // repeated origin — the classic CSS punched-window polygon.
  const clip = `polygon(0px 0px, ${W}px 0px, ${W}px ${H}px, 0px ${H}px, 0px 0px, ${hx}px ${hy}px, ${hx}px ${hy + hh}px, ${hx + hw}px ${hy + hh}px, ${hx + hw}px ${hy}px, ${hx}px ${hy}px)`;

  return (
    <div className="focus-dim" style={{ clipPath: clip }} aria-hidden="true">
      <span
        className="focus-dim-ring"
        style={{ left: hx, top: hy, width: hw, height: hh }}
      />
    </div>
  );
}

// The exit hint lives in the same layer so it never collides with the dim.
export function FocusHint({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="focus-dim-hint" role="note">
      Focus mode — press <kbd>F</kbd> to exit
    </span>
  );
}
