import { memo, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api as convexApi } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { X, RotateCcw } from 'lucide-react';
import type { CanvasApi } from '../canvas/api';
import { INK } from '../canvas/ink';
import { parseScene } from '../canvas/scene';
import { useSmartFloat } from '../hooks/useSmartFloat';
import { SmartFloatHandle } from './SmartFloatHandle';
import { ListRowSkeleton } from './skeletons';
import { HistoryEmptyIllo, DrawnTitle } from './illustrations';
import { formatRelativeTime } from '../lib/formatTime';
import './VersionHistory.css';

interface VersionHistoryProps {
  roomId: Id<'rooms'>;
  onClose: () => void;
  api?: CanvasApi | null;
}

export function VersionHistory({ roomId, onClose, api = null }: VersionHistoryProps) {
  const snapshots = useQuery(convexApi.features.snapshots.listSnapshots, { roomId });
  const restoreSnapshot = useMutation(convexApi.features.snapshots.restoreSnapshot);
  const [confirmId, setConfirmId] = useState<Id<'snapshots'> | null>(null);
  const [restoring, setRestoring] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const float = useSmartFloat({ ref: rootRef, api, panelKey: 'version-history' });

  const handleRestore = async (snapshotId: Id<'snapshots'>) => {
    if (confirmId !== snapshotId) {
      setConfirmId(snapshotId);
      return;
    }
    setRestoring(true);
    try {
      await restoreSnapshot({ roomId, snapshotId });
      setConfirmId(null);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <aside
      className="history-panel glass"
      ref={rootRef}
      style={float.position ? { left: float.position.left, top: float.position.top } : undefined}
      data-dragging={float.dragging}
      role="complementary"
      aria-label="Version history"
    >
      <header className="history-header">
        <h2 className="history-title">Version History</h2>
        <span className="history-actions">
          <SmartFloatHandle
            onPointerDown={float.onPointerDown}
            onReset={float.reset}
            manual={float.manual}
          />
          <button className="history-close" onClick={onClose} aria-label="Close version history">
            <X size={18} />
          </button>
        </span>
      </header>

      <div className="history-feed">
        {snapshots === undefined && (
          <div className="history-feed-skel" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <ListRowSkeleton key={i} index={i} />
            ))}
          </div>
        )}
        {snapshots && snapshots.length === 0 && (
          <div className="history-empty">
            <HistoryEmptyIllo />
            <DrawnTitle className="history-empty-title" delay={600}>
              No versions yet
            </DrawnTitle>
            <p className="history-empty-text">
              Versions are captured automatically while you sketch — every save becomes a moment you can restore.
            </p>
          </div>
        )}
        {snapshots?.map((snap, i) => (
          <div key={snap._id} className="history-row" style={{ '--i': i } as CSSProperties}>
            <div className="history-row-thumb">
              {snap.canvasData ? (
                <SnapshotPreview data={snap.canvasData} />
              ) : (
                <div className="history-thumb-placeholder" />
              )}
            </div>
            <div className="history-row-info">
              <span className="history-row-time">{formatRelativeTime(snap.createdAt, { showTime: true })}</span>
              <span className="history-row-desc">{snap.description || `Version ${snap.version}`}</span>
            </div>
            <button
              className="history-restore"
              onClick={() => handleRestore(snap._id)}
              disabled={restoring}
            >
              {confirmId === snap._id ? 'Confirm restore?' : <><RotateCcw size={12} />Restore</>}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

/* ---- Snapshot mini-map preview ---- */

const THUMB_W = 56;
const THUMB_H = 40;
const THUMB_PAD = 3;

interface PreviewShape {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  arrow: boolean;
  color: string;
}

/**
 * Previews read snapshots through the same scene reader the room uses, so a
 * version saved before the engine change is still pictured: legacy records are
 * converted to elements on the way in.
 */
function extractShapes(data: string): PreviewShape[] {
  return parseScene(data).elements.map((element) => {
    const w = Math.max(2, element.width);
    const h = Math.max(2, element.height);
    const linear = element.type === 'arrow' || element.type === 'line';
    return {
      key: element.id,
      x: element.x,
      y: element.y,
      w,
      h,
      arrow: linear,
      color: /^#/.test(element.strokeColor) ? element.strokeColor : INK.ink3,
    };
  });
}

const SnapshotPreview = memo(function SnapshotPreview({ data }: { data: string }) {
  const shapes = useMemo(() => extractShapes(data), [data]);
  if (shapes.length === 0) return <div className="history-thumb-placeholder" />;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of shapes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  if (!Number.isFinite(minX) || maxX - minX < 1) return <div className="history-thumb-placeholder" />;

  const bw = maxX - minX;
  const bh = maxY - minY;
  const scale = Math.min((THUMB_W - THUMB_PAD * 2) / bw, (THUMB_H - THUMB_PAD * 2) / bh);
  const ox = (THUMB_W - bw * scale) / 2 - minX * scale;
  const oy = (THUMB_H - bh * scale) / 2 - minY * scale;

  return (
    <svg className="history-thumb-svg" viewBox={`0 0 ${THUMB_W} ${THUMB_H}`} aria-hidden="true">
      {shapes.map((b) => {
        const x = b.x * scale + ox;
        const y = b.y * scale + oy;
        const w = Math.max(1.5, b.w * scale);
        const h = Math.max(1.5, b.h * scale);
        if (b.arrow) {
          return (
            <line
              key={b.key}
              x1={x}
              y1={y}
              x2={x + w}
              y2={y + h}
              stroke={b.color}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          );
        }
        return (
          <rect
            key={b.key}
            x={x}
            y={y}
            width={w}
            height={h}
            rx={1}
            fill={b.color}
            opacity={0.7}
          />
        );
      })}
    </svg>
  );
});