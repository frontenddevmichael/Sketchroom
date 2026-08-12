import { useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from 'tldraw';
import './PresenceCursors.css';

interface PresencePerson {
  userId: string;
  name: string;
  color: string;
  cursorX?: number | null;
  cursorY?: number | null;
  lastActive?: number;
}

interface CameraState {
  x: number;
  y: number;
  z: number;
}

interface Point {
  x: number;
  y: number;
}

interface PresenceCursorsProps {
  editor: Editor | null;
  presence: PresencePerson[];
}

const INTERP = 0.3;
const SNAP_EPSILON = 0.6;

export function PresenceCursors({ editor, presence }: PresenceCursorsProps) {
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, z: 1 });
  const [now, setNow] = useState(() => Date.now());
  const [positions, setPositions] = useState<Record<string, Point>>({});
  // Latest screen-space targets + the live people list, kept for the rAF loop.
  const targetsRef = useRef<Record<string, Point>>({});
  const peopleRef = useRef<PresencePerson[]>([]);

  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const cam = editor.getCamera();
      setCamera({ x: cam.x, y: cam.y, z: cam.z });
    };
    sync();
    const unlisten = editor.store.listen(() => {
      // camera changes arrive through the store
      requestAnimationFrame(sync);
    });
    return () => {
      unlisten();
    };
  }, [editor]);

  // Tick every second so idle cursors fade out without re-rendering on camera.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const people = useMemo(
    () => presence.filter((p) => typeof p.cursorX === 'number' && typeof p.cursorY === 'number'),
    [presence]
  );

  // Mirror the latest targets and people into refs for the interpolation loop.
  useEffect(() => {
    peopleRef.current = people;
    for (const p of people) {
      targetsRef.current[p.userId] = {
        x: (p.cursorX! - camera.x) * camera.z,
        y: (p.cursorY! - camera.y) * camera.z,
      };
    }
  }, [people, camera.x, camera.y, camera.z]);

  // Ease each cursor toward its target on a rAF loop. When nothing moved this
  // frame the state updater returns the same reference and React bails out.
  useEffect(() => {
    if (people.length === 0) return;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      setPositions((prev) => {
        let changed = false;
        const next: Record<string, Point> = { ...prev };
        for (const p of peopleRef.current) {
          const t = targetsRef.current[p.userId];
          if (!t) continue;
          const cur = next[p.userId];
          if (!cur) {
            next[p.userId] = t;
            changed = true;
            continue;
          }
          const nx = cur.x + (t.x - cur.x) * INTERP;
          const ny = cur.y + (t.y - cur.y) * INTERP;
          if (Math.abs(nx - t.x) < SNAP_EPSILON && Math.abs(ny - t.y) < SNAP_EPSILON) {
            next[p.userId] = t;
          } else {
            next[p.userId] = { x: nx, y: ny };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [people, camera.x, camera.y, camera.z]);

  return (
    <div className="presence-layer" aria-hidden="true">
      {people.map((p) => {
        const pos = positions[p.userId];
        if (!pos) return null;
        if (pos.x < -40 || pos.x > window.innerWidth + 40 || pos.y < -40 || pos.y > window.innerHeight + 40) {
          return null;
        }
        const idle = p.lastActive ? (now - p.lastActive) / 1000 : 0;
        // Fade a cursor that has stopped moving; it disappears entirely after
        // the server's 15s presence TTL prunes the row.
        const opacity = idle > 5 ? Math.max(0, 1 - (idle - 5) / 4) : 1;
        // A bright live dot marks someone actively collaborating right now.
        const active = idle < 3;
        return (
          <div
            key={p.userId}
            className="presence-cursor"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              opacity,
              transition: 'opacity 400ms ease',
            }}
          >
            <svg width="18" height="22" viewBox="0 0 18 22" className="presence-svg">
              <path
                d="M0 0 L0 20 L4.5 16 L8 22 L11 20.5 L7.5 14.5 L14 14 Z"
                fill={p.color}
              />
            </svg>
            <span className="presence-name" style={{ background: p.color }}>
              {active && <span className="presence-live" />}
              {p.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
