import { useEffect, useState } from 'react';
import type { Editor } from 'tldraw';
import './ViewportAwareness.css';

// Presence rows already exclude the local user, so every outline here is a
// teammate's. Each remote camera tells us exactly what they're looking at.

interface PresenceViewport {
  userId: string;
  name: string;
  color: string;
  camera?: { x: number; y: number; zoom: number } | null;
  lastActive?: number;
}

interface CameraState {
  x: number;
  y: number;
  z: number;
}

interface ViewportRect {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  side: 'inside' | 'left' | 'right' | 'top' | 'bottom';
}

interface ViewportAwarenessProps {
  editor: Editor | null;
  presence: PresenceViewport[];
}

export function ViewportAwareness({ editor, presence }: ViewportAwarenessProps) {
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, z: 1 });
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const cam = editor.getCamera();
      setCamera({ x: cam.x, y: cam.y, z: cam.z });
      const host = editor.getContainer();
      setSize({ w: host.clientWidth, h: host.clientHeight });
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

  if (!editor || size.w === 0) return null;

  const rects: ViewportRect[] = [];
  for (const p of presence) {
    const cam = p.camera;
    if (!cam || typeof cam.x !== 'number' || typeof cam.y !== 'number' || !cam.zoom || cam.zoom <= 0) continue;
    // Their viewport in page space: camera origin, sized by screen/z.
    const pw = size.w / cam.zoom;
    const ph = size.h / cam.zoom;
    let x = (cam.x - camera.x) * camera.z;
    let y = (cam.y - camera.y) * camera.z;
    let w = pw * camera.z;
    let h = ph * camera.z;

    let side: ViewportRect['side'] = 'inside';
    if (x + w <= 0) side = 'left';
    else if (x >= size.w) side = 'right';
    else if (y + h <= 0) side = 'top';
    else if (y >= size.h) side = 'bottom';
    else {
      // Partially visible: clamp the outline to the stage so it never
      // stretches beyond what's on screen.
      x = Math.max(0, Math.min(x, size.w));
      y = Math.max(0, Math.min(y, size.h));
      w = Math.max(0, Math.min(w, size.w - x));
      h = Math.max(0, Math.min(h, size.h - y));
    }

    rects.push({ id: p.userId, name: p.name, color: p.color, x, y, w, h, side });
  }

  return (
    <div className="viewport-layer" aria-hidden="true">
      {rects.map((r) => {
        if (r.side === 'inside') {
          return (
            <div
              key={r.id}
              className="viewport-frame"
              style={{
                transform: `translate(${r.x}px, ${r.y}px)`,
                width: r.w,
                height: r.h,
                borderColor: `${r.color}66`,
                boxShadow: `inset 0 0 0 1px ${r.color}22`,
              }}
            >
              <span className="viewport-tag" style={{ background: r.color }}>
                {r.name}
              </span>
            </div>
          );
        }
        // Off-screen: a quiet edge tab pointing at where they are, so you
        // never lose track of a teammate who panned away.
        let left: number;
        let top: number;
        const midX = Math.min(Math.max(r.x, 0), Math.max(0, size.w - 1));
        const midY = Math.min(Math.max(r.y, 0), Math.max(0, size.h - 1));
        if (r.side === 'left' || r.side === 'right') {
          left = r.side === 'left' ? 0 : size.w - 1;
          top = Math.min(Math.max(midY - 11, 8), Math.max(8, size.h - 30));
        } else {
          top = r.side === 'top' ? 0 : size.h - 1;
          left = Math.min(Math.max(midX - 20, 8), Math.max(8, size.w - 120));
        }
        return (
          <span
            key={r.id}
            className={`viewport-tab viewport-tab-${r.side}`}
            style={{ left, top, color: r.color }}
          >
            <span className="viewport-tab-name" style={{ background: r.color }}>
              {r.name}
            </span>
          </span>
        );
      })}
    </div>
  );
}
