import { useEffect, useState, useRef, useLayoutEffect, useMemo, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X, Search } from 'lucide-react';
import { toRichText, createShapeId, type Editor } from 'tldraw';
import { kindColor, kindHex, kindIcon } from '../lib/blockKinds';
import { SearchEmptyIllo } from './illustrations';
import { emitPlacementPulse } from './placementPulse';
import './BlockLibrary.css';

interface BlockLibraryProps {
  onClose: () => void;
  editor: Editor | null;
  /** The left rail's block-library trigger; the popover anchors beside it. */
  anchorRef: RefObject<HTMLButtonElement | null>;
}

type Tab = 'architecture' | 'wireframe';

interface BlockDef {
  label: string;
  code: string;
  kind: string;
  role?: string;
}

// Icons resolve from the shared kind map so the library, the AI feed, and the
// canvas ghost previews all speak the same visual language.
const BLOCKS: Record<Tab, BlockDef[]> = {
  architecture: [
    { label: 'API', code: 'api', kind: 'service', role: 'API' },
    { label: 'Database', code: 'database', kind: 'database', role: 'Database' },
    { label: 'Service', code: 'service', kind: 'service', role: 'Service' },
    { label: 'Queue', code: 'queue', kind: 'queue', role: 'Queue' },
    { label: 'Client', code: 'client', kind: 'client', role: 'Client' },
    { label: 'Cache', code: 'cache', kind: 'cache', role: 'Cache' },
  ],
  wireframe: [
    { label: 'Button', code: 'button', kind: 'geo', role: 'Button' },
    { label: 'Input', code: 'input', kind: 'geo', role: 'Input' },
    { label: 'Card', code: 'card', kind: 'geo', role: 'Card' },
    { label: 'Navbar', code: 'navbar', kind: 'geo', role: 'Navbar' },
    { label: 'Table', code: 'table', kind: 'geo', role: 'Table' },
    { label: 'Image', code: 'image', kind: 'geo', role: 'Image' },
  ],
};

const BLOCK_W = 180;
const BLOCK_H = 90;
const GRID = 20;
const CASCADE_COLS = 3;
const CASCADE_GAP_X = 24;
const CASCADE_GAP_Y = 16;

function snapToGrid(v: number): number {
  return Math.round(v / GRID) * GRID;
}

function makeBlockProps(block: BlockDef) {
  return {
    geo: 'rectangle' as const,
    w: BLOCK_W,
    h: BLOCK_H,
    // Each kind inserts in its own tldraw color so stacked blocks read as
    // distinct components, matching the AI feed's insert palette.
    color: kindColor(block.code),
    fill: 'semi' as const,
    richText: toRichText(block.role ?? block.label),
  } satisfies {
    geo: 'rectangle';
    w: number;
    h: number;
    color: ReturnType<typeof kindColor>;
    fill: 'semi';
    richText: ReturnType<typeof toRichText>;
  };
}

export function BlockLibrary({ onClose, editor, anchorRef }: BlockLibraryProps) {
  const [tab, setTab] = useState<Tab>('architecture');
  const [query, setQuery] = useState('');
  const [hovered, setHovered] = useState<BlockDef | null>(null);
  const [cascadeIndex, setCascadeIndex] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const posRef = useRef<{ left: number; top: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Below the sheet breakpoint the panel is a fixed bottom sheet whose CSS
  // owns its placement — the anchor-measure (and the visibility gate that
  // waits for it) must stand aside entirely, or the panel would mount
  // invisible. This is tracked as state so the render and the measure agree.
  const [isSheet, setIsSheet] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = () => setIsSheet(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Live filter across the active tab — the search empty state is a
  // user-caused moment (no results), distinct from the panel being empty.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BLOCKS[tab];
    return BLOCKS[tab].filter((b) => b.label.toLowerCase().includes(q));
  }, [tab, query]);

  // Anchor the popover to the rail's block-library trigger: it opens to the
  // right of the trigger with its bottom edge near the trigger's bottom,
  // flipped left/up and clamped whenever it would leave the stage.
  useLayoutEffect(() => {
    const measure = () => {
      const anchor = anchorRef.current;
      const el = rootRef.current;
      if (!anchor || !el) return;
      // Below the sheet breakpoint the panel becomes a fixed bottom sheet;
      // anchoring to the rail trigger would fight the sheet's CSS layout.
      if (isSheet) return;
      const parent = el.offsetParent as HTMLElement | null;
      if (!parent) return;
      const ar = anchor.getBoundingClientRect();
      const pr = parent.getBoundingClientRect();
      const pw = el.offsetWidth;
      const ph = el.offsetHeight;
      const gutter = 16;
      let left = ar.right - pr.left + 8;
      const maxLeft = pr.width - pw - gutter;
      if (left > maxLeft) left = Math.max(gutter, ar.left - pr.left - pw - 8);
      let top = ar.bottom - pr.top - ph + Math.round(ar.height / 2);
      top = Math.max(gutter, Math.min(top, pr.height - ph - gutter));
      if (posRef.current && posRef.current.left === left && posRef.current.top === top) return;
      posRef.current = { left, top };
      setPos({ left, top });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [anchorRef, isSheet]);

  const insertBlock = (block: BlockDef) => {
    const ed = editor;
    if (!ed) return;
    const viewport = ed.getViewportScreenBounds();
    const center = ed.screenToPage({ x: viewport.midX, y: viewport.midY });

    const col = cascadeIndex % CASCADE_COLS;
    const row = Math.floor(cascadeIndex / CASCADE_COLS);
    setCascadeIndex((i) => i + 1);

    const x = snapToGrid(center.x - BLOCK_W / 2 + col * (BLOCK_W + CASCADE_GAP_X));
    const y = snapToGrid(center.y - BLOCK_H / 2 + row * (BLOCK_H + CASCADE_GAP_Y));

    const id = createShapeId();
    ed.createShape({
      id,
      type: 'geo',
      x,
      y,
      props: makeBlockProps(block),
    });
    ed.select(id);
    ed.setCurrentTool('select');
    ed.zoomToSelection({ animation: { duration: 160 } });

    // The placement "snap": a spring ring flashes around the landed block
    // so the drop reads as a deliberate moment, not a silent teleport.
    const bounds = ed.getShapePageBounds(id);
    if (bounds) {
      const cam = ed.getCamera();
      emitPlacementPulse(
        {
          x: (bounds.x - cam.x) * cam.z,
          y: (bounds.y - cam.y) * cam.z,
          w: bounds.w * cam.z,
          h: bounds.h * cam.z,
        },
        'neutral'
      );
    }
  };

  return (
    <div
      className="block-library glass"
      ref={rootRef}
      style={isSheet ? undefined : pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
      role="dialog"
      aria-label="Block library"
    >
      <header className="block-library-header">
        <h2 className="block-library-title">Blocks</h2>
        <span className="block-library-actions">
          <button className="block-library-close" onClick={onClose} aria-label="Close block library">
            <X size={18} />
          </button>
        </span>
      </header>

      <div className="block-library-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'architecture'}
          className={`block-library-tab ${tab === 'architecture' ? 'active' : ''}`}
          onClick={() => { setTab('architecture'); setQuery(''); }}
        >
          Architecture
        </button>
        <button
          role="tab"
          aria-selected={tab === 'wireframe'}
          className={`block-library-tab ${tab === 'wireframe' ? 'active' : ''}`}
          onClick={() => { setTab('wireframe'); setQuery(''); }}
        >
          Wireframe
        </button>
      </div>

      <label className="block-library-search">
        <Search size={14} aria-hidden="true" />
        <input
          className="block-library-search-input"
          placeholder="Search blocks"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search blocks"
        />
        {query && (
          <button
            className="block-library-search-clear"
            aria-label="Clear search"
            title="Clear search"
            onClick={() => setQuery('')}
          >
            <X size={13} />
          </button>
        )}
      </label>

      {filtered.length === 0 ? (
        <div className="block-library-empty">
          <SearchEmptyIllo />
          <p className="block-library-empty-title">No blocks match “{query.trim()}”</p>
          <p className="block-library-empty-text">
            Try a shorter term, or clear the search to browse the {tab} tab.
          </p>
        </div>
      ) : (
        <div className="block-library-grid">
          {filtered.map((block) => {
            const Icon = kindIcon(block.code);
            return (
              <button
                key={block.code}
                className="block-library-item"
                title={block.label}
                onClick={() => insertBlock(block)}
                onMouseEnter={() => setHovered(block)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className="block-library-item-icon">
                  <Icon size={18} />
                </span>
                <span className="block-library-item-label">
                  <span className="block-library-item-dot" style={{ background: kindHex(block.code) }} aria-hidden="true" />
                  {block.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {hovered && editor && (
        <BlockGhost editor={editor} block={hovered} index={cascadeIndex} />
      )}
    </div>
  );
}

interface CameraState {
  x: number;
  y: number;
  z: number;
}

function BlockGhost({ editor, block, index }: { editor: Editor; block: BlockDef; index: number }) {
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, z: 1 });

  useEffect(() => {
    const sync = () => {
      const cam = editor.getCamera();
      setCamera((prev) =>
        prev.x === cam.x && prev.y === cam.y && prev.z === cam.z ? prev : { x: cam.x, y: cam.y, z: cam.z }
      );
    };
    sync();
    const unlisten = editor.store.listen(() => requestAnimationFrame(sync));
    return () => unlisten();
  }, [editor]);

  const host = editor.getContainer().parentElement;
  if (!host) return null;

  const viewport = editor.getViewportScreenBounds();
  const center = editor.screenToPage({ x: viewport.midX, y: viewport.midY });
  const col = index % CASCADE_COLS;
  const row = Math.floor(index / CASCADE_COLS);
  const x = snapToGrid(center.x - BLOCK_W / 2 + col * (BLOCK_W + CASCADE_GAP_X));
  const y = snapToGrid(center.y - BLOCK_H / 2 + row * (BLOCK_H + CASCADE_GAP_Y));

  return createPortal(
    <div
      className="block-ghost-layer"
      aria-hidden="true"
      style={{
        transform: `translate(${-camera.x * camera.z}px, ${-camera.y * camera.z}px) scale(${camera.z})`,
        transformOrigin: '0 0',
      }}
    >
      <div className="block-ghost" style={{ left: x, top: y, width: BLOCK_W, height: BLOCK_H }}>
        <span className="block-ghost-label">{block.label}</span>
      </div>
    </div>,
    host
  );
}