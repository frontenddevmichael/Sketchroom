import { useEffect, useState } from 'react';
import type { Editor } from 'tldraw';
import './FocusDim.css';

interface FocusDimProps {
  editor: Editor | null;
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
// clip-path hole that tracks the shapes live. The ring around the hole is
// green — a deliberate, single moment of color for a focused state.
export function FocusDim({ editor, active }: FocusDimProps) {
  const [hole, setHole] = useState<Hole | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const host = editor.getContainer();
      setSize({ w: host.clientWidth, h: host.clientHeight });
      const cam = editor.getCamera();
      const ids = editor.getSelectedShapeIds();
      if (ids.length === 0) {
        setHole(null);
        return;
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const id of ids) {
        const b = editor.getShapePageBounds(id);
        if (!b) continue;
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w);
        maxY = Math.max(maxY, b.y + b.h);
      }
      if (!Number.isFinite(minX)) {
        setHole(null);
        return;
      }
      setHole({
        x: (minX - cam.x) * cam.z - PAD,
        y: (minY - cam.y) * cam.z - PAD,
        w: (maxX - minX) * cam.z + PAD * 2,
        h: (maxY - minY) * cam.z + PAD * 2,
      });
    };
    sync();
    const unlisten = editor.store.listen(() => requestAnimationFrame(sync));
    const onResize = () => sync();
    window.addEventListener('resize', onResize);
    return () => {
      unlisten();
      window.removeEventListener('resize', onResize);
    };
  }, [editor]);

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
