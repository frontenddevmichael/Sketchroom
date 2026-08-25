import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
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
  Sparkles,
  Zap,
  LogOut,
  CreditCard,
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
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [kebabFor, setKebabFor] = useState<Id<'rooms'> | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<Id<'rooms'> | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [dismissedLimitNote, setDismissedLimitNote] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [workspaceCreateFailed, setWorkspaceCreateFailed] = useState(false);
  const [workspaceRetryNonce, setWorkspaceRetryNonce] = useState(0);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [wsHover, setWsHover] = useState(false);
  const { signOut } = useAuthActions();

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
  const syncMemberProfile = useMutation(api.features.rooms.syncMemberProfile);
  const creatingWorkspace = useRef(false);
  const syncedProfile = useRef(false);

  useEffect(() => {
    if (syncedProfile.current || !user) return;
    syncedProfile.current = true;
    syncMemberProfile().catch(() => {});
  }, [user, syncMemberProfile]);

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

  /* Total members across all rooms (real data) */
  const totalMembers = useMemo(() => {
    if (!rooms) return 0;
    return rooms.reduce((sum, r) => sum + (r.members?.avatars.length ?? 0) + (r.members?.plusCount ?? 0), 0);
  }, [rooms]);

  /* Keyboard shortcut: N to create room */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      openCreate();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Close kebab on outside click */
  useEffect(() => {
    if (!kebabFor) return;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('.kebab-menu')) return;
      setKebabFor(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [kebabFor]);

  /* Close popovers on outside click */
  useEffect(() => {
    if (!avatarOpen && !wsHover) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.sidebar-logo') || target.closest('.ws-popover')) return;
      if (target.closest('.sidebar-avatar') || target.closest('.user-popover')) return;
      setAvatarOpen(false);
      setWsHover(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [avatarOpen, wsHover]);

  const handleSignOut = useCallback(() => {
    setAvatarOpen(false);
    signOut().catch(() => {});
  }, [signOut]);

  const openCreate = useCallback(() => {
    setRoomName('');
    setCreateError(null);
    setModal({ kind: 'create' });
  }, []);

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

  return (
    <div className="dashboard">
      {/* ── Sidebar ── */}
      <nav className="sidebar" aria-label="Navigation">
        {/* Logo — hover opens workspace popover */}
        <div
          className="sidebar-logo"
          onMouseEnter={() => setWsHover(true)}
          onClick={() => setWsHover(!wsHover)}
          role="button"
          tabIndex={0}
          aria-label="Workspace info"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setWsHover(!wsHover); }}
        >
          S
        </div>

        <button className="sidebar-item" title="Home" onClick={() => navigate('/dashboard')}>
          <Home size={20} />
          <span className="sidebar-item-label">Home</span>
        </button>

        <button className="sidebar-item" title="New room" onClick={openCreate}>
          <Plus size={20} />
          <span className="sidebar-item-label">New room</span>
        </button>

        <div className="sidebar-spacer" />

        {/* AI usage */}
        {usage && (
          <div className="sidebar-item" title={`${usage.aiSuggestions}/${FREE_AI_LIMIT} AI suggestions used`}>
            <Sparkles size={18} />
            <span className="sidebar-item-badge">AI {usage.aiSuggestions}/{FREE_AI_LIMIT}</span>
          </div>
        )}

        <button className="sidebar-item" title="Billing" onClick={() => navigate('/billing')}>
          <CreditCard size={20} />
          <span className="sidebar-item-label">Billing</span>
        </button>

        <button className="sidebar-item" title="Settings" onClick={() => navigate('/settings')}>
          <Settings size={20} />
          <span className="sidebar-item-label">Settings</span>
        </button>

        {/* Avatar — click opens user popover */}
        <button
          className="sidebar-avatar"
          title={user?.name || 'Account'}
          onClick={() => setAvatarOpen(!avatarOpen)}
          aria-expanded={avatarOpen}
          aria-haspopup="true"
        >
          {userInitials}
        </button>
      </nav>

      {/* Workspace popover — fixed position */}
      {wsHover && (
        <div className="ws-popover" role="tooltip">
          <div className="ws-popover-header">
            <div className="ws-popover-icon">S</div>
            <div className="ws-popover-info">
              <p className="ws-popover-name">{workspaces?.[0]?.name || 'My Workspace'}</p>
              <p className="ws-popover-email">{user?.email || ''}</p>
            </div>
          </div>
          <div className="ws-popover-sep" />
          <div className="ws-popover-row">
            <span className="ws-popover-row-label">Rooms</span>
            <span className="ws-popover-row-value">{rooms?.length || 0}</span>
          </div>
          <div className="ws-popover-row">
            <span className="ws-popover-row-label">Plan</span>
            <span className="ws-popover-row-value">Free</span>
          </div>
          <div className="ws-popover-row">
            <span className="ws-popover-row-label">AI used</span>
            <span className="ws-popover-row-value">{usage?.aiSuggestions || 0}/{FREE_AI_LIMIT}</span>
          </div>
        </div>
      )}

      {/* User popover — fixed position */}
      {avatarOpen && (
        <div className="user-popover" role="menu">
          <div className="user-popover-header">
            <div className="user-popover-avatar">{userInitials}</div>
            <div className="user-popover-info">
              <p className="user-popover-name">{user?.name || 'User'}</p>
              <p className="user-popover-email">{user?.email || ''}</p>
            </div>
          </div>
          <div className="user-popover-sep" />
          <button className="user-popover-btn" role="menuitem" onClick={() => { setAvatarOpen(false); toggleTheme(); }}>
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </button>
          <button className="user-popover-btn" role="menuitem" onClick={() => { setAvatarOpen(false); navigate('/settings'); }}>
            <Settings size={14} />
            <span>Settings</span>
          </button>
          <button className="user-popover-btn" role="menuitem" onClick={() => { setAvatarOpen(false); navigate('/billing'); }}>
            <CreditCard size={14} />
            <span>Billing</span>
          </button>
          <div className="user-popover-sep" />
          <button className="user-popover-btn user-popover-danger" role="menuitem" onClick={handleSignOut}>
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="main">
        {/* Topbar */}
        <div className="topbar">
          <div className="search">
            <Search size={14} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search rooms…"
              aria-label="Search rooms"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="topbar-actions">
            <button className="btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>
            <button className="btn primary" onClick={openCreate}>
              <Plus size={15} />New room<span className="kbd">N</span>
            </button>
          </div>
        </div>

        {/* Greeting — clean, no fake stats */}
        <div className="greet">
          <div>
            <h1>{greetingForHour()}, {firstName}.</h1>
            <div className="sub">{todayLabel()}</div>
          </div>
        </div>

        {showLimitNote && (
          <div className="limit-note" role="note">
            <span className="limit-note-text">
              You've used all {FREE_ROOM_LIMIT} rooms on the free plan — rooms stay open.
            </span>
            <button className="btn" onClick={() => navigate('/billing')}>See plans</button>
            <button className="limit-note-dismiss" onClick={() => setDismissedLimitNote(true)} aria-label="Dismiss limit notice">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Compact KPI bar */}
        {usage && (
          <div className="kpi-bar">
            <div className="kpi-pill">
              <span className="kpi-pill-label">Rooms</span>
              <span className="kpi-pill-value">{usage.rooms}<span className="kpi-pill-of">/{FREE_ROOM_LIMIT}</span></span>
              <div className="kpi-pill-bar">
                {Array.from({ length: FREE_ROOM_LIMIT }, (_, i) => (
                  <span key={i} className={`kpi-pill-seg ${i < usage.rooms ? 'on' : ''}`} />
                ))}
              </div>
            </div>
            <div className="kpi-pill">
              <span className="kpi-pill-label"><Sparkles size={11} />AI</span>
              <span className="kpi-pill-value">{usage.aiSuggestions}<span className="kpi-pill-of">/{FREE_AI_LIMIT}</span></span>
              <span className="kpi-pill-meta">{FREE_AI_LIMIT - usage.aiSuggestions} left this month</span>
            </div>
            {totalMembers > 0 && (
              <div className="kpi-pill">
                <span className="kpi-pill-label">Team</span>
                <span className="kpi-pill-value">{totalMembers}</span>
                <span className="kpi-pill-meta">{totalMembers === 1 ? 'member' : 'members'}</span>
              </div>
            )}
            <div className="kpi-pill kpi-pill-plan">
              <span className="kpi-pill-label"><Zap size={11} />Free</span>
              <button className="kpi-pill-upgrade" onClick={() => navigate('/billing')}>Upgrade →</button>
            </div>
          </div>
        )}

        {/* Section head + rooms grid */}
        <div className="section-head">
          <div className="section-head-left">
            <h2>Rooms</h2>
            <span className="count">{filteredRooms.length} total</span>
          </div>
          <div className="tabs" role="tablist">
            <button
              className={`tab ${sort === 'recent' ? 'active' : ''}`}
              onClick={() => setSort('recent')}
              role="tab"
              aria-selected={sort === 'recent'}
            >Recent</button>
            <button
              className={`tab ${sort === 'name' ? 'active' : ''}`}
              onClick={() => setSort('name')}
              role="tab"
              aria-selected={sort === 'name'}
            >By name</button>
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
            <div className="room add" onClick={openCreate} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openCreate(); }}>
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

            <button className="modal-close" onClick={() => setModal(null)} aria-label="Close">
              <X size={18} />
            </button>

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
              <p className="create-error" role="alert">{createError}</p>
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

const ROOM_PREVIEW_COLORS = [
  'oklch(0.22 0.04 160)', 'oklch(0.24 0.06 220)',
  'oklch(0.20 0.05 30)',  'oklch(0.25 0.04 280)',
  'oklch(0.22 0.03 50)',  'oklch(0.23 0.05 190)',
];

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
  const colorIndex = index % ROOM_PREVIEW_COLORS.length;
  const hasMembers = !!room.members && (room.members.avatars.length + room.members.plusCount) > 1;
  const isKebabOpen = kebabFor === room._id;

  return (
    <div
      className="room"
      onClick={() => navigate(`/room/${room._id}`)}
      style={{ '--i': index } as React.CSSProperties}
    >
      {/* Preview */}
      <div className="preview" style={{ background: ROOM_PREVIEW_COLORS[colorIndex] }}>
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
        {hasMembers && (
          <span className="live-dot"><span className="d" /> Live</span>
        )}
      </div>

      {/* Kebab menu — only for owners */}
      {room.userRole === 'owner' && (
        <div className="kebab-menu">
          <button
            className="kebab-trigger"
            aria-expanded={isKebabOpen}
            aria-haspopup="menu"
            aria-label={`Options for ${room.name}`}
            onClick={(e) => { e.stopPropagation(); setKebabFor(isKebabOpen ? null : room._id); }}
          >
            <MoreVertical size={14} />
          </button>
          {isKebabOpen && (
            <div className="kebab-dropdown" role="menu">
              <button className="kebab-item" role="menuitem"
                onClick={(e) => { e.stopPropagation(); openRename(room._id, room.name); }}>
                <Pencil size={14} /> Rename
              </button>
              {deletingId === room._id ? (
                <>
                  <button className="kebab-item kebab-danger" role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRoom({ roomId: room._id }).catch(() => cancelDelete());
                    }}>
                    <Trash2 size={14} /> Delete
                  </button>
                  <button className="kebab-item" role="menuitem"
                    onClick={(e) => { e.stopPropagation(); cancelDelete(); }}>
                    Cancel
                  </button>
                </>
              ) : (
                <button className="kebab-item kebab-danger" role="menuitem"
                  onClick={(e) => { e.stopPropagation(); confirmDelete(room._id); }}>
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
                  background: ROOM_PREVIEW_COLORS[i % ROOM_PREVIEW_COLORS.length],
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
      <nav className="sidebar" aria-hidden="true">
        <div className="sidebar-logo">S</div>
        <div className="sk" style={{ width: 36, height: 36, borderRadius: 10 }} />
        <div className="sk" style={{ width: 36, height: 36, borderRadius: 10 }} />
        <div className="sidebar-spacer" />
        <div className="sk" style={{ width: 36, height: 36, borderRadius: 10 }} />
        <div className="sidebar-divider" />
        <div className="sk" style={{ width: 36, height: 36, borderRadius: 10 }} />
        <div className="sk" style={{ width: 36, height: 36, borderRadius: 50 }} />
      </nav>
      <main className="main">
        <div className="topbar">
          <div className="search" style={{ opacity: 0.4 }}>
            <Search size={14} aria-hidden="true" />
            <span className="search-input" style={{ color: 'var(--ink-3)', fontSize: 13 }}>Search rooms…</span>
          </div>
          <div className="sk" style={{ width: 32, height: 32, borderRadius: 50 }} />
        </div>

        <div className="greeting-row">
          <div>
            <h1 className="greeting">{phrase}</h1>
            <p className="date-label">{todayLabel()}</p>
          </div>
        </div>

        <div className="kpi-bar" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="sk" style={{ height: 34, borderRadius: 18, flex: 1, opacity: 0.5 + i * 0.1 }} />
          ))}
        </div>

        <div className="section-head">
          <div className="section-head-left">
            <div className="sk" style={{ width: 80, height: 18, borderRadius: 6 }} />
            <div className="sk" style={{ width: 40, height: 12, borderRadius: 6 }} />
          </div>
          <div className="tabs" aria-hidden="true">
            <div className="sk" style={{ width: 60, height: 28, borderRadius: 8 }} />
            <div className="sk" style={{ width: 60, height: 28, borderRadius: 8 }} />
          </div>
        </div>

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
