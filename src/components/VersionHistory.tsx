import { memo, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { X, RotateCcw } from 'lucide-react';
import type { Editor } from 'tldraw';
import { useSmartFloat } from '../hooks/useSmartFloat';
import { SmartFloatHandle } from './SmartFloatHandle';
import { ListRowSkeleton } from './skeletons';
import { HistoryEmptyIllo, DrawnTitle } from './illustrations';
import { formatRelativeTime } from '../lib/formatTime';
import './VersionHistory.css';

interface VersionHistoryProps {
  roomId: Id<'rooms'>;
  onClose: () => void;
  editor?: Editor | null;
}

export function VersionHistory({ roomId, onClose, editor = null }: VersionHistoryProps) {
  const snapshots = useQuery(api.features.snapshots.listSnapshots, { roomId });
  const restoreSnapshot = useMutation(api.features.snapshots.restoreSnapshot);
  const [confirmId, setConfirmId] = useState<Id<'snapshots'> | null>(null);
  const [restoring, setRestoring] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const float = useSmartFloat({ ref: rootRef, editor, panelKey: 'version-history' });

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

interface ShapeRecord {
  id: string;
  typeName?: string;
  type?: string;
  x?: number;
  y?: number;
  props?: {
    w?: number;
    h?: number;
    color?: string;
  };
}

const THUMB_W = 56;
const THUMB_H = 40;
const THUMB_PAD = 3;

const PREVIEW_COLORS: Record<string, string> = {
  black: '#1d1d1d',
  grey: '#9b9b9b',
  blue: '#3b82f6',
  'light-blue': '#c3e2ff',
  violet: '#7b61ff',
  'light-violet': '#e3d9ff',
  red: '#ef4b4b',
  'light-red': '#ffaaaa',
  orange: '#ff943d',
  yellow: '#f3d53d',
  green: '#34c26b',
  'light-green': '#c9f2a0',
  white: '#e8e8e8',
};

function extractShapes(data: string): ShapeRecord[] {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (!parsed || typeof parsed !== 'object') return [];
    const legacy = parsed as { records?: unknown };
    const source =
      legacy.records && typeof legacy.records === 'object'
        ? Object.values(legacy.records as Record<string, unknown>)
        : Object.values(parsed as Record<string, unknown>);
    return source.filter((r): r is ShapeRecord => {
      const rec = r as Partial<ShapeRecord>;
      return rec?.typeName === 'shape' && typeof rec.id === 'string';
    });
  } catch {
    return [];
  }
}

interface PreviewShape {
  x: number;
  y: number;
  w: number;
  h: number;
  arrow: boolean;
  color: string;
}

function previewShape(s: ShapeRecord): PreviewShape {
  const x = s.x ?? 0;
  const y = s.y ?? 0;
  const color = PREVIEW_COLORS[s.props?.color ?? 'black'] ?? '#1d1d1d';
  if (s.type === 'arrow') return { x, y, w: 44, h: 16, arrow: true, color };
  const w = s.props?.w;
  const h = s.props?.h;
  return {
    x,
    y,
    w: typeof w === 'number' && w > 0 ? w : 48,
    h: typeof h === 'number' && h > 0 ? (s.type === 'text' ? 10 : h) : 16,
    arrow: false,
    color,
  };
}

const SnapshotPreview = memo(function SnapshotPreview({ data }: { data: string }) {
  const shapes = useMemo(() => extractShapes(data), [data]);
  if (shapes.length === 0) return <div className="history-thumb-placeholder" />;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of shapes) {
    const b = previewShape(s);
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
      {shapes.map((s) => {
        const b = previewShape(s);
        const x = b.x * scale + ox;
        const y = b.y * scale + oy;
        const w = Math.max(1.5, b.w * scale);
        const h = Math.max(1.5, b.h * scale);
        if (b.arrow) {
          return (
            <line
              key={s.id}
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
        return <rect key={s.id} x={x} y={y} width={w} height={h} rx={1} fill={b.color} opacity={0.85} />;
      })}
    </svg>
  );
});