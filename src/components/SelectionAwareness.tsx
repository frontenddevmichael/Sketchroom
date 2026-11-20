import { useEffect, useState } from 'react';
import type { CanvasApi } from '../canvas/api';
import './SelectionAwareness.css';

interface PresenceSelection {
  userId: string;
  name: string;
  color: string;
  selectedShapeIds?: string[] | null;
}

interface CameraState {
  x: number;
  y: number;
  z: number;
}

interface FocusRect {
  id: string;
  userId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SelectionAwarenessProps {
  api: CanvasApi | null;
  presence: PresenceSelection[];
}

export function SelectionAwareness({ api, presence }: SelectionAwarenessProps) {
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, z: 1 });

  useEffect(() => {
    if (!api) return;
    const sync = () => {
      const cam = api.camera;
      setCamera((prev) =>
        prev.x === cam.x && prev.y === cam.y && prev.z === cam.z
          ? prev
          : { x: cam.x, y: cam.y, z: cam.z },
      );
    };
    sync();
    return api.subscribe(sync);
  }, [api]);

  if (!api) return null;

  const rects: FocusRect[] = [];
  for (const p of presence) {
    const box = api.boundsOfIds(p.selectedShapeIds || []);
    if (!box) continue;
    rects.push({
      id: p.userId,
      userId: p.userId,
      name: p.name,
      color: p.color,
      x: (box.x - camera.x) * camera.z - 4,
      y: (box.y - camera.y) * camera.z - 4,
      w: box.w * camera.z + 8,
      h: box.h * camera.z + 8,
    });
  }

  return (
    <div className="selection-layer" aria-hidden="true">
      {rects.map((r) => (
        <div
          key={r.id}
          className="selection-focus"
          style={{
            transform: `translate(${r.x}px, ${r.y}px)`,
            width: r.w,
            height: r.h,
            borderColor: r.color,
            boxShadow: `0 0 0 3px ${r.color}22`,
          }}
        >
          <span className={`selection-focus-tag ${r.y < 30 ? 'below' : ''}`} style={{ background: r.color }}>
            {r.name}
          </span>
        </div>
      ))}
    </div>
  );
}
