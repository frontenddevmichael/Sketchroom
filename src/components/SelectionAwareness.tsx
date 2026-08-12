import { useEffect, useState } from 'react';
import type { Editor, TLShapeId } from 'tldraw';
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
  editor: Editor | null;
  presence: PresenceSelection[];
}

export function SelectionAwareness({ editor, presence }: SelectionAwarenessProps) {
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, z: 1 });

  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const cam = editor.getCamera();
      setCamera({ x: cam.x, y: cam.y, z: cam.z });
    };
    sync();
    const unlisten = editor.store.listen(() => {
      requestAnimationFrame(sync);
    });
    return () => {
      unlisten();
    };
  }, [editor]);

  if (!editor) return null;

  const rects: FocusRect[] = [];
  for (const p of presence) {
    const ids = (p.selectedShapeIds || []).filter((id) =>
      editor.getShapePageBounds(id as TLShapeId)
    );
    if (ids.length === 0) continue;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of ids) {
      const b = editor.getShapePageBounds(id as TLShapeId)!;
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    }
    rects.push({
      id: p.userId,
      userId: p.userId,
      name: p.name,
      color: p.color,
      x: (minX - camera.x) * camera.z - 4,
      y: (minY - camera.y) * camera.z - 4,
      w: (maxX - minX) * camera.z + 8,
      h: (maxY - minY) * camera.z + 8,
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
