import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import {
  Plus,
  Settings,
  Moon,
  Sun,
  Trash2,
  Search,
  MoreVertical,
  Pencil,
  X,
  Home,
  Calendar,
  FolderOpen,
  FileText,
  Sparkles,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { useTheme } from '../lib/useTheme';
import { TEMPLATES, buildTemplateSeed } from '../lib/templates';
import { RoomCardSkeleton } from '../components/skeletons';
import { RoomsEmptyIllo, SearchEmptyIllo, DrawnTitle } from '../components/illustrations';
import { useStaleData } from '../hooks/useStaleData';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useLongLoad } from '../hooks/useLongLoad';
import { Spinner } from '../components/Spinner';
import { ErrorIllo } from '../components/illustrations';
import { useModalFocus } from '../lib/useModalFocus';
import { usePageTitle } from '../lib/usePageTitle';
import { FREE_ROOM_LIMIT, FREE_AI_LIMIT } from '../lib/plans';
import '../components/shared.css';
import '../components/skeletons.css';
import './Dashboard.css';

type Sort = 'recent' | 'name';

type Modal =
  | { kind: 'create' }
  | { kind: 'rename'; roomId: Id<'rooms'>; name: string }
  | null;

/* ── Helpers ─────────────────────────────────────────────────────────── */

function greetingForHour(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatRelativeTime(ts: number) {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

/* Preview color cycle for room cards */
const PREVIEW_COLORS = [
  'oklch(0.22 0.04 160)', 'oklch(0.24 0.06 220)',
  'oklch(0.20 0.05 30)',  'oklch(0.25 0.04 280)',
  'oklch(0.22 0.03 50)',  'oklch(0.23 0.05 190)',
];

/* ── Main component ─────────────────────────────────────────────────── */

export function Dashboard() {
  usePageTitle('Rooms — Sketchroom');
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { theme, toggleTheme } = useTheme();
  const [modal, setModal] = useState<Modal>(null);
  const modalRef = useModalFocus<HTMLDivElement>(() => setModal(null), !!modal);
  const [roomName, setRoomName] = useState('');
  const [workspaceId, setWorkspaceId] = useState<Id<'workspaces'> | null>(null);
  const [query] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [kebabFor, setKebabFor] = useState<Id<'rooms'> | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<Id<'rooms'> | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [dismissedLimitNote, setDismissedLimitNote] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [workspaceCreateFailed, setWorkspaceCreateFailed] = useState(false);
  const [workspaceRetryNonce, setWorkspaceRetryNonce] = useState(0);

  const workspaces = useQuery(api.features.rooms.getWorkspaces);
  const usage = useQuery(api.features.rooms.getUsage);

  useEffect(() => {
    if (workspaces !== undefined) return;
    const t = window.setTimeout(() => setLoadFailed(true), 15000);
    return () => window.clearTimeout(t);
  }, [workspaces]);

  const activeWorkspaceId = workspaceId ?? workspaces?.[0]?._id ?? null;
  const roomsQuery = useQuery(
    api.features.rooms.getRooms,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : 'skip'
  );
  const { data: rooms } = useStaleData(roomsQuery);
  const createWorkspace = useMutation(api.features.rooms.createWorkspace);
  const createRoom = useMutation(api.features.rooms.createRoom);
  const deleteRoom = useMutation(api.features.rooms.deleteRoom);
  const updateRoomName = useMutation(api.features.rooms.updateRoomName);
  const creatingWorkspace = useRef(false);

  useEffect(() => {
    if (workspaces && workspaces.length === 0 && user && !creatingWorkspace.current) {
      creatingWorkspace.current = true;
      setWorkspaceCreateFailed(false);
      const name = (user?.name || 'My') + "'s Workspace";
      createWorkspace({ name })
        .then((w) => {
          setWorkspaceId(w.id as Id<'workspaces'>);
        })
        .catch(() => {
          creatingWorkspace.current = false;
          setWorkspaceCreateFailed(true);
        });
    }
  }, [workspaces, user, createWorkspace, workspaceRetryNonce]);

  const filteredRooms = useMemo(() => {
    const list = rooms ?? [];
    const q = query.trim().toLowerCase();
    const filtered = q ? list.filter((r) => r.name.toLowerCase().includes(q)) : list;
    return [...filtered].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : b.updatedAt - a.updatedAt
    );
  }, [rooms, query, sort]);

  useEffect(() => {
    if (!kebabFor) return;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('.room')) return;
      setKebabFor(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [kebabFor]);

  if (!workspaces) return <DashboardLoadingShell failed={loadFailed} />;

  if (workspaces.length === 0 && workspaceCreateFailed) {
    return (
      <div className="dashboard">
        <main className="main">
          <div className="empty" role="alert">
            <div className="glyph" aria-hidden="true"><ErrorIllo /></div>
            <DrawnTitle as="h2" delay={700}>Couldn't create your workspace</DrawnTitle>
            <p>We couldn't set up a workspace for you. Check your connection and try again.</p>
            <div className="cta-row">
              <button className="btn primary" onClick={() => {
                setWorkspaceCreateFailed(false);
                creatingWorkspace.current = false;
                setWorkspaceRetryNonce((n) => n + 1);
              }}>Try again</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'there';
  const userInitials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const atRoomLimit = !!usage && usage.rooms >= FREE_ROOM_LIMIT;
  const showLimitNote = atRoomLimit && !dismissedLimitNote;

  const handleCreateRoom = async () => {
    if (!activeWorkspaceId) return;
    const name = roomName.trim() || 'Untitled room';
    setCreateError(null);
    try {
      const room = await createRoom({ workspaceId: activeWorkspaceId, name });
      setRoomName('');
      setModal(null);
      navigate(`/room/${room.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create the room.');
    }
  };

  const handleTemplate = async (templateId: string, templateName: string) => {
    if (!activeWorkspaceId) return;
    setCreatingTemplate(templateId);
    setCreateError(null);
    try {
      const room = await createRoom({
        workspaceId: activeWorkspaceId,
        name: templateName,
        seed: buildTemplateSeed(templateId),
      });
      navigate(`/room/${room.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create the room.');
    } finally {
      setCreatingTemplate(null);
    }
  };

  const handleRename = async () => {
    if (!modal || modal.kind !== 'rename') return;
    const name = roomName.trim();
    if (name) {
      try { await updateRoomName({ roomId: modal.roomId, name }); } catch { return; }
    }
    setModal(null);
    setRoomName('');
  };

  const openRename = (roomId: Id<'rooms'>, name: string) => {
    setRoomName(name);
    setModal({ kind: 'rename', roomId, name });
    setKebabFor(null);
  };

  const openCreate = () => {
    setRoomName('');
    setCreateError(null);
    setModal({ kind: 'create' });
  };

  return (
    <div className="dashboard">
      {/* ── Icon rail ── */}
      <nav className="rail">
        <div className="logo">S</div>
        <button className="icon active" title="Home" onClick={() => navigate('/dashboard')}>
          <Home size={20} />
        </button>
        <button className="icon" title="Search" onClick={() => {
          const el = document.querySelector<HTMLInputElement>('.greet + .section-head + .rooms');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}><Search size={20} /></button>
        <button className="icon" title="Calendar"><Calendar size={20} /></button>
        <button className="icon" title="Files"><FileText size={20} /></button>
        <button className="icon" title="Folders"><FolderOpen size={20} /></button>
        <div className="spacer" />
        <button className="icon" title="Settings" onClick={() => navigate('/settings')}>
          <Settings size={20} />
        </button>
        <div
          className="avatar-mini"
          title={user?.name || 'Account'}
          onClick={() => navigate('/settings')}
          role="button"
          tabIndex={0}
        >
          {userInitials}
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="main">
        {/* Topbar */}
        <div className="topbar">
          
          <div className="search">
            <Search size={14} />
            Search rooms, people, files…
            <span className="kbd">⌘K</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn" onClick={toggleTheme}>
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>
            <button className="btn primary" onClick={openCreate}>
              <Plus size={15} />New room<span className="kbd">N</span>
            </button>
          </div>
        </div>

        {/* Greeting */}
        <div className="greet">
          <div>
            <h1 className=''>{greetingForHour()}, {firstName}.</h1>
            <div className="sub">
              {todayLabel()} · Your team drew <b>{(usage?.rooms ?? 0) * 12} shapes</b> this week and
              left <b>{(usage?.aiSuggestions ?? 0) * 2} comments</b> on things you own.
            </div>
          </div>
        </div>

        {showLimitNote && (
          <div className="card" role="note" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', background: 'oklch(0.22 0.06 148 / 0.12)', borderColor: 'oklch(0.78 0.19 148 / 0.2)' }}>
            <span style={{ fontSize: '13px' }}>
              You've used all {FREE_ROOM_LIMIT} rooms on the free plan — rooms stay open.
            </span>
            <button className="btn" style={{ flexShrink: 0 }} onClick={() => navigate('/billing')}>See plans</button>
            <button style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: '4px', marginLeft: '8px' }} onClick={() => setDismissedLimitNote(true)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* KPI strip */}
        {usage && (
          <div className="kpis">
            <div className="kpi">
              <div className="label"><FolderOpen size={12} />Rooms</div>
              <div className="value">{usage.rooms}<span className="of">/{FREE_ROOM_LIMIT}</span></div>
              <div className="seg-bar">
                {Array.from({ length: FREE_ROOM_LIMIT }, (_, i) => (
                  <span key={i} className={`seg ${i < usage.rooms ? 'on' : ''}`} />
                ))}
              </div>
              <div className="meta">{FREE_ROOM_LIMIT - usage.rooms} slots left on Free plan</div>
            </div>
            <div className="kpi">
              <div className="label"><Sparkles size={12} />AI Suggests</div>
              <div className="value">{usage.aiSuggestions}<span className="unit">this month</span></div>
              <div className="sparkline">
                {Array.from({ length: 7 }, (_, i) => (
                  <span key={i} className={`bar ${i === 6 ? 'today' : ''}`}
                    style={{ height: `${30 + (i * 11) % 60}%` }} />
                ))}
              </div>
              <div className="meta">
                <span className="delta">
                  {FREE_AI_LIMIT - usage.aiSuggestions > 0 ? '↑' : '↓'}{' '}
                  {Math.round(((FREE_AI_LIMIT - usage.aiSuggestions) / FREE_AI_LIMIT) * 100)}%
                </span> remaining
              </div>
            </div>
            <div className="kpi">
              <div className="label"><FolderOpen size={12} />Storage</div>
              <div className="value">2.4<span className="unit">GB</span></div>
              <div className="fill-bar"><span style={{ width: '48%' }} /></div>
              <div className="meta">2.6 GB of 5 GB remaining</div>
            </div>
            <div className="kpi">
              <div className="label"><Zap size={12} />Plan</div>
              <div className="plan-pill"><span className="dot" />Free · Personal</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Next renewal · n/a
              </div>
              <button className="upgrade-link" onClick={() => navigate('/billing')}>
                Upgrade to <u>Studio · $12/mo</u> →
              </button>
            </div>
          </div>
        )}

        {/* Section head + rooms grid */}
        <div className="section-head">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
            <h2>Recent rooms</h2>
            <span className="count">{filteredRooms.length} total</span>
          </div>
          <div className="tabs">
            <span className={`tab ${sort === 'recent' ? 'active' : ''}`} onClick={() => setSort('recent')}>Recent</span>
            <span className={`tab ${sort === 'name' ? 'active' : ''}`} onClick={() => setSort('name')}>By name</span>
          </div>
        </div>

        {rooms === undefined ? (
          <div className="rooms" aria-label="Loading rooms">
            {Array.from({ length: 4 }, (_, i) => (<RoomCardSkeleton key={i} index={i} />))}
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="empty">
            <div className="glyph" aria-hidden="true">
              {query ? <SearchEmptyIllo /> : <RoomsEmptyIllo />}
            </div>
            <DrawnTitle as="h2" delay={query ? 700 : 600}>
              {query ? 'No rooms match your search' : 'Nothing sketched yet'}
            </DrawnTitle>
            <p>
              {query
                ? "Your search didn't match any room names. Try a shorter term, or clear the search."
                : 'Create your first room, or start from a template — the canvas is yours.'}
            </p>
            {!query && (
              <div className="cta-row">
                <button className="btn primary" onClick={openCreate}><Plus size={15} />New room</button>
              </div>
            )}
          </div>
        ) : (
          <div className="rooms">
            <div className="room add" onClick={openCreate}>
              <div className="add-inner"><div className="plus"><Plus size={20} /></div>New room</div>
            </div>
            {filteredRooms.map((room, i) => (
              <RoomCard
                key={room._id}
                room={room}
                index={i}
                navigate={navigate}
                kebabFor={kebabFor}
                setKebabFor={setKebabFor}
                deletingId={deletingId}
                confirmDelete={(id) => setDeletingId(id)}
                cancelDelete={() => setDeletingId(null)}
                openRename={openRename}
                deleteRoom={deleteRoom}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Right sidebar ── */}
      <aside className="sidebar">
        <div className="user-block">
          <div className="av">{userInitials}</div>
          <div>
            <p className="name">{user?.name || 'User'}</p>
            <p className="role">Free · Personal</p>
          </div>
        </div>

        <div className="card">
          <div className="label">Next deadline <span className="pill">today</span></div>
          <h3>Product review</h3>
          <p className="when">In <b>3 hours</b> · with design team</p>
        </div>

        <div className="card">
          <div className="label">Storage</div>
          <div className="usage-summary">
            <svg className="donut" viewBox="0 0 36 36">
              <circle className="track" cx="18" cy="18" r="14" fill="none" strokeWidth="4" />
              <circle className="fill" cx="18" cy="18" r="14" fill="none" strokeWidth="4"
                strokeDasharray="88 100" strokeDashoffset="25" strokeLinecap="round" />
            </svg>
            <div className="meta">
              <div className="big">2.4 GB</div>
              2.6 GB of 5 GB remaining
            </div>
          </div>
        </div>

        <div className="quick">
          <div className="quick-title">Quick actions</div>
          <div className="quick-item">
            <div className="qi-icon hi"><Plus size={15} /></div>
            <div className="qi-txt">
              <p className="t">Invite teammates</p>
              <p className="s">Collaborate in real-time</p>
            </div>
            <ArrowRight size={14} className="arrow" />
          </div>
          <div className="quick-item" onClick={() => navigate('/billing')}>
            <div className="qi-icon"><Zap size={15} /></div>
            <div className="qi-txt">
              <p className="t">Upgrade to Studio</p>
              <p className="s">Unlimited rooms & AI</p>
            </div>
            <ArrowRight size={14} className="arrow" />
          </div>
          <div className="quick-item">
            <div className="qi-icon"><FileText size={15} /></div>
            <div className="qi-txt">
              <p className="t">Import from Figma</p>
              <p className="s">Paste a Figma link</p>
            </div>
            <ArrowRight size={14} className="arrow" />
          </div>
        </div>
      </aside>

      {/* ── Modal ── */}
      {modal && (
        <div className="modal-scrim" onClick={() => setModal(null)} role="presentation">
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={modal.kind === 'rename' ? 'Rename room' : 'New room'}
            ref={modalRef}
          >
            <div className="m-label">{modal.kind === 'rename' ? 'Rename' : 'New room'}</div>
            <h2>{modal.kind === 'rename' ? 'Rename this room' : 'What are you building?'}</h2>
            <p className="desc">
              {modal.kind === 'rename'
                ? 'Give this room a clearer name.'
                : 'Name your room to get started. You can always change it later.'}
            </p>

            <div className="field">
              <label htmlFor="room-name-input">Room name</label>
              <input
                id="room-name-input"
                autoFocus
                placeholder="e.g. Payment flow architecture"
                value={roomName}
                onChange={(e) => { setRoomName(e.target.value); setCreateError(null); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (modal.kind === 'rename') void handleRename();
                    else void handleCreateRoom();
                  }
                  if (e.key === 'Escape') setModal(null);
                }}
              />
              <div className="helper">
                <span>{roomName.length}/60</span>
                <span>Can be changed later</span>
              </div>
            </div>

            {createError && (
              <p style={{ color: 'var(--danger)', fontSize: '13px' }} role="alert">{createError}</p>
            )}

            {modal.kind === 'create' && (
              <div className="template-row">
                {TEMPLATES.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    className="tpl"
                    disabled={creatingTemplate !== null}
                    onClick={() => handleTemplate(t.id, t.name)}
                  >
                    <div className="tpl-thumb">
                      {creatingTemplate === t.id ? <Spinner size={22} /> : <TemplatePreview category={t.category} />}
                    </div>
                    <div className="tpl-name">{t.name}</div>
                  </button>
                ))}
              </div>
            )}

            <div className="actions">
              <span className="esc"><span className="kbd">esc</span> to close</span>
              <div className="right">
                <button className="btn ghost" onClick={() => setModal(null)}>Cancel</button>
                <button
                  className="btn primary"
                  disabled={!roomName.trim()}
                  onClick={() => {
                    if (modal.kind === 'rename') void handleRename();
                    else void handleCreateRoom();
                  }}
                >
                  {modal.kind === 'rename' ? 'Save' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Room card sub-component ────────────────────────────────────────── */

type RoomDoc = {
  _id: Id<'rooms'>;
  name: string;
  updatedAt: number;
  thumbnailData?: string;
  userRole: string;
  lastEditedBy?: { name?: string; imageUrl?: string };
  members?: { avatars: { name: string; avatarUrl?: string }[]; plusCount: number };
};

function RoomCard({
  room,
  index,
  navigate,
  kebabFor,
  setKebabFor,
  deletingId,
  confirmDelete,
  cancelDelete,
  openRename,
  deleteRoom,
}: {
  room: RoomDoc;
  index: number;
  navigate: ReturnType<typeof useNavigate>;
  kebabFor: Id<'rooms'> | null;
  setKebabFor: (id: Id<'rooms'> | null) => void;
  deletingId: Id<'rooms'> | null;
  confirmDelete: (id: Id<'rooms'>) => void;
  cancelDelete: () => void;
  openRename: (id: Id<'rooms'>, name: string) => void;
  deleteRoom: ReturnType<typeof useMutation<typeof api.features.rooms.deleteRoom>>;
}) {
  const colorIndex = index % PREVIEW_COLORS.length;
  return (
    <div
      className="room"
      onClick={() => navigate(`/room/${room._id}`)}
      style={{ '--i': index } as React.CSSProperties}
    >
      {/* Preview */}
      <div className="preview" style={{ background: PREVIEW_COLORS[colorIndex] }}>
        {room.thumbnailData ? (
          <img src={room.thumbnailData} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg viewBox="0 0 240 135" fill="none" aria-hidden="true" style={{ width: '100%', height: '100%' }}>
            <rect x="20" y="18" width="56" height="36" rx="6" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            <rect x="90" y="18" width="56" height="36" rx="6" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
            <rect x="160" y="18" width="56" height="36" rx="6" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            <path d="M76 36h14M146 36h14" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <rect x="30" y="70" width="80" height="8" rx="3" fill="rgba(255,255,255,0.08)" />
            <rect x="30" y="86" width="50" height="6" rx="3" fill="rgba(255,255,255,0.05)" />
          </svg>
        )}
        <span className="live-dot"><span className="d" /> Live</span>
      </div>

      {/* Kebab menu */}
      {room.userRole === 'owner' && (
        <div
          className="kebab"
          onClick={(e) => { e.stopPropagation(); setKebabFor(kebabFor === room._id ? null : room._id); }}
        >
          <MoreVertical size={14} />
          {kebabFor === room._id && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: '4px',
              background: 'var(--bg-elev)', border: '1px solid var(--line)',
              borderRadius: '10px', padding: '4px', minWidth: '140px',
              boxShadow: '0 8px 24px -8px oklch(0 0 0 / 0.5)', zIndex: 50,
            }}>
              <button
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', color: 'var(--ink)', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); openRename(room._id, room.name); }}
              >
                <Pencil size={14} /> Rename
              </button>
              {deletingId === room._id ? (
                <>
                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRoom({ roomId: room._id }).catch(() => cancelDelete());
                    }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', color: 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); cancelDelete(); }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); confirmDelete(room._id); }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div className="body">
        <div className="row1">
          <h3 className="name">{room.name}</h3>
          <span className="time">{formatRelativeTime(room.updatedAt)}</span>
        </div>
        <div className="row2">
          {room.members && room.members.avatars.length > 0 ? (
            <div className="avatars" aria-label={`${room.members.avatars.length + room.members.plusCount} members`}>
              {room.members.avatars.slice(0, 3).map((m, i) => (
                <span key={i} className="a" title={m.name} style={{
                  background: PREVIEW_COLORS[i % PREVIEW_COLORS.length],
                }}>
                  {m.avatarUrl ? <img src={m.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : m.name.charAt(0).toUpperCase()}
                </span>
              ))}
              {room.members.plusCount > 0 && (
                <span className="more">+{room.members.plusCount}</span>
              )}
            </div>
          ) : <span />}
          <span className="metric">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 6h8M6 2v8" strokeLinecap="round" />
            </svg>
            {room.lastEditedBy?.name ? room.lastEditedBy.name.split(' ')[0] : 'You'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Loading shell ──────────────────────────────────────────────────── */

function DashboardLoadingShell({ failed = false }: { failed?: boolean }) {
  const { phrase } = useLongLoad(
    true,
    ['Loading your workspace…', 'Still syncing…', 'Almost there…'],
    4000
  );
  if (failed) {
    return (
      <div className="dashboard">
        <main className="main">
          <div className="empty" role="alert">
            <div className="glyph" aria-hidden="true"><ErrorIllo /></div>
            <DrawnTitle as="h2" delay={700}>Couldn't load your workspace</DrawnTitle>
            <p>This usually means a connection hiccup. Give it another try.</p>
            <div className="cta-row">
              <button className="btn primary" onClick={() => window.location.reload()}>Try again</button>
            </div>
          </div>
        </main>
      </div>
    );
  }
  return (
    <div className="dashboard" aria-label="Loading your workspace">
      <nav className="rail" aria-hidden="true">
        <div className="logo">S</div>
        <div className="sk" style={{ width: 40, height: 40, borderRadius: 10 }} />
        <div className="sk" style={{ width: 40, height: 40, borderRadius: 10 }} />
        <div className="sk" style={{ width: 40, height: 40, borderRadius: 10 }} />
        <div className="spacer" />
        <div className="sk" style={{ width: 36, height: 36, borderRadius: 10 }} />
      </nav>
      <main className="main">
        <p key={phrase} style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--ink-3)', textAlign: 'center', padding: '40px 0 0' }}>
          {phrase}
        </p>
        <div className="sk" style={{ height: 48, borderRadius: 12, width: '60%', marginTop: '24px' }} />
        <div className="sk" style={{ height: 20, borderRadius: 8, width: '40%' }} />
        <div className="kpis" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="sk" style={{ height: 148, borderRadius: 14 }} />
          ))}
        </div>
        <div className="sk" style={{ height: 18, borderRadius: 8, width: '25%' }} />
        <div className="rooms">
          {Array.from({ length: 4 }, (_, i) => (
            <RoomCardSkeleton key={i} index={i} />
          ))}
        </div>
      </main>
    </div>
  );
}

/* ── Template preview thumbnails ────────────────────────────────────── */

function TemplatePreview({ category }: { category: string }) {
  if (category === 'architecture') {
    return (
      <svg viewBox="0 0 120 72" fill="none" aria-hidden="true">
        <rect x="8" y="8" width="34" height="22" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.9" />
        <rect x="46" y="8" width="34" height="22" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
        <rect x="84" y="8" width="28" height="22" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.9" />
        <rect x="8" y="42" width="34" height="22" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
        <path d="M42 19h4M80 19h4" stroke="var(--accent)" strokeWidth="1.5" />
        <path d="M25 42v4M25 30l-8 12M25 30l8 12" stroke="var(--accent)" strokeWidth="1.5" opacity="0.8" />
      </svg>
    );
  }
  if (category === 'wireframe') {
    return (
      <svg viewBox="0 0 120 72" fill="none" aria-hidden="true">
        <rect x="8" y="8" width="104" height="14" rx="4" stroke="currentColor" strokeWidth="1.5" />
        <rect x="8" y="30" width="104" height="16" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <rect x="8" y="54" width="48" height="10" rx="4" stroke="var(--accent)" strokeWidth="1.5" />
        <path d="M14 22h92M14 46h92" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 72" fill="none" aria-hidden="true">
      <rect x="8" y="6" width="104" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="24" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <rect x="46" y="24" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <rect x="78" y="24" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="50" width="26" height="16" rx="3" stroke="var(--accent)" strokeWidth="1.5" />
      <rect x="46" y="50" width="26" height="16" rx="3" stroke="var(--accent)" strokeWidth="1.5" opacity="0.6" />
      <rect x="78" y="50" width="26" height="16" rx="3" stroke="var(--accent)" strokeWidth="1.5" opacity="0.35" />
    </svg>
  );
}
