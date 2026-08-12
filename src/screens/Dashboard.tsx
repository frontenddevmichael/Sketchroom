import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useUser, UserButton } from '@clerk/react';
import {
  Plus,
  Settings,
  LayoutDashboard,
  Moon,
  Sun,
  Trash2,
  Search,
  MoreVertical,
  Pencil,
  CreditCard,
  FilePlus2,
  X,
} from 'lucide-react';
import { useTheme } from '../lib/useTheme';
import { TEMPLATES, buildTemplateSeed } from '../lib/templates';
import { RoomCardSkeleton } from '../components/skeletons';
import { RoomsEmptyIllo, SearchEmptyIllo, DrawnTitle } from '../components/illustrations';
import { AppTabBar } from '../components/AppTabBar';
import { useStaleData } from '../hooks/useStaleData';
import { useLongLoad } from '../hooks/useLongLoad';
import { Spinner } from '../components/Spinner';
import { ErrorIllo } from '../components/illustrations';
import { useModalFocus } from '../lib/useModalFocus';
import { usePageTitle } from '../lib/usePageTitle';
import '../components/shared.css';
import '../components/skeletons.css';
import './Dashboard.css';

type Sort = 'recent' | 'name';

type Modal =
  | { kind: 'create' }
  | { kind: 'rename'; roomId: Id<'rooms'>; name: string }
  | null;

export function Dashboard() {
  usePageTitle('Rooms — Sketchroom');
  const navigate = useNavigate();
  const { user } = useUser();
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
  const [dismissedLimitNote, setDismissedLimitNote] = useState(false);
  // Never a dead end: if the workspace query can't resolve within a
  // reasonable window, surface a calm error with a retry instead of an
  // infinite skeleton.
  const [loadFailed, setLoadFailed] = useState(false);

  const workspaces = useQuery(api.rooms.getWorkspaces);
  const usage = useQuery(api.rooms.getUsage);

  // Never a dead end: if the workspace query can't resolve within a
  // reasonable window, surface a calm error with a retry instead of an
  // infinite skeleton.
  useEffect(() => {
    if (workspaces !== undefined) return;
    const t = window.setTimeout(() => setLoadFailed(true), 15000);
    return () => window.clearTimeout(t);
  }, [workspaces]);
  const activeWorkspaceId = workspaceId ?? workspaces?.[0]?._id ?? null;
  const roomsQuery = useQuery(
    api.rooms.getRooms,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : 'skip'
  );
  // Stale-while-revalidate: switching workspaces (or any refresh that blanks
  // the query) keeps the previous grid on screen instead of re-skeletoning.
  const { data: rooms } = useStaleData(roomsQuery);
  const createWorkspace = useMutation(api.rooms.createWorkspace);
  const createRoom = useMutation(api.rooms.createRoom);
  const deleteRoom = useMutation(api.rooms.deleteRoom);
  const updateRoomName = useMutation(api.rooms.updateRoomName);
  const creatingWorkspace = useRef(false);

  useEffect(() => {
    if (workspaces && workspaces.length === 0 && user && !creatingWorkspace.current) {
      creatingWorkspace.current = true;
      const name = (user.fullName || user.firstName || 'My') + "'s Workspace";
      createWorkspace({ name })
        .then((w) => {
          setWorkspaceId(w.id as Id<'workspaces'>);
        })
        .catch(() => {
          creatingWorkspace.current = false;
        });
    }
  }, [workspaces, user, createWorkspace]);

  const filteredRooms = useMemo(() => {
    const list = rooms ?? [];
    const q = query.trim().toLowerCase();
    const filtered = q ? list.filter((r) => r.name.toLowerCase().includes(q)) : list;
    return [...filtered].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : b.updatedAt - a.updatedAt
    );
  }, [rooms, query, sort]);

  // Close an open kebab menu when clicking anywhere else on the page (clicks
  // inside the kebab, including its menu, are handled by their own handlers).
  useEffect(() => {
    if (!kebabFor) return;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('.room-card-kebab')) return;
      setKebabFor(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [kebabFor]);

  if (!workspaces) return <DashboardLoadingShell failed={loadFailed} />;

  const workspaceName = workspaces[0]?.name ?? 'Workspace';
  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || 'there';

  // Free-plan cap awareness: once the room limit is reached, surface a quiet,
  // dismissible nudge toward Billing instead of letting the cap fail silently.
  const FREE_ROOM_LIMIT = 3;
  const atRoomLimit = !!usage && usage.rooms >= FREE_ROOM_LIMIT;
  const showLimitNote = atRoomLimit && !dismissedLimitNote;

  const handleCreateRoom = async () => {
    if (!activeWorkspaceId) return;
    const name = roomName.trim() || 'Untitled room';
    const room = await createRoom({ workspaceId: activeWorkspaceId, name });
    setRoomName('');
    setModal(null);
    navigate(`/room/${room.id}`);
  };

  const handleTemplate = async (templateId: string, templateName: string) => {
    if (!activeWorkspaceId) return;
    setCreatingTemplate(templateId);
    try {
      const room = await createRoom({
        workspaceId: activeWorkspaceId,
        name: templateName,
        seed: buildTemplateSeed(templateId),
      });
      navigate(`/room/${room.id}`);
    } finally {
      setCreatingTemplate(null);
    }
  };

  const handleRename = async () => {
    if (!modal || modal.kind !== 'rename') return;
    const name = roomName.trim();
    if (name) {
      try {
        await updateRoomName({ roomId: modal.roomId, name });
      } catch {
        // keep the modal open so the user can retry
        return;
      }
    }
    setModal(null);
    setRoomName('');
  };

  const openRename = (roomId: Id<'rooms'>, name: string) => {
    setRoomName(name);
    setModal({ kind: 'rename', roomId, name });
    setKebabFor(null);
  };

  const confirmDelete = (roomId: Id<'rooms'>) => {
    setDeletingId(roomId);
  };

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-workspace" title={workspaceName}>
            <span className="sidebar-workspace-avatar" aria-hidden="true">
              {workspaceName.charAt(0).toUpperCase()}
            </span>
          </div>
          <nav className="sidebar-nav" aria-label="Dashboard">
            <button
              className="sidebar-nav-item active"
              title="Rooms"
              aria-label="Rooms"
              onClick={() => navigate('/dashboard')}
            >
              <LayoutDashboard size={20} />
            </button>
            <button
              className="sidebar-nav-item"
              title="Billing"
              aria-label="Billing"
              onClick={() => navigate('/billing')}
            >
              <CreditCard size={20} />
            </button>
            <button
              className="sidebar-nav-item"
              title="Settings"
              aria-label="Settings"
              onClick={() => navigate('/settings')}
            >
              <Settings size={20} />
            </button>
          </nav>
        </div>
        <div className="sidebar-bottom">
          <button className="sidebar-nav-item" title="Toggle theme" onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <div className="sidebar-avatar">
            <UserButton />
          </div>
        </div>
      </aside>

      {/* Phones: the icon rail becomes the shared fixed bottom tab bar. */}
      <AppTabBar />

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h1 className="dashboard-title">{greetingForHour()}, {firstName}</h1>
            <p className="dashboard-subtitle">
              {todayLabel()} · {workspaceName}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => { setRoomName(''); setModal({ kind: 'create' }); }}>
            <Plus size={16} />
            New room
          </button>
        </header>

        {showLimitNote && (
          <div className="limit-note" role="note">
            <span className="limit-note-text">
              You've used all {FREE_ROOM_LIMIT} rooms on the free plan — rooms stay open, but new ones need the Team plan.
            </span>
            <button className="limit-note-link" onClick={() => navigate('/billing')}>
              See plans
            </button>
            <button
              className="limit-note-dismiss"
              aria-label="Dismiss"
              title="Dismiss"
              onClick={() => setDismissedLimitNote(true)}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {usage && (
          <section className="dashboard-stats" aria-label="Workspace summary">
            <div className="stat-tile">
              <span className="stat-value">{usage.rooms}</span>
              <span className="stat-label">Rooms</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{usage.aiSuggestions}</span>
              <span className="stat-label">AI suggestions</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{TEMPLATES.length}</span>
              <span className="stat-label">Starter templates</span>
            </div>
          </section>
        )}

        <section className="templates-section">
          <div className="section-heading">
            <h2 className="section-title">Start from a template</h2>
            <p className="section-hint">Pre-sketched canvases you can make your own.</p>
          </div>
          <div className="templates-grid">
            <button className="template-card template-card-blank" onClick={() => { setRoomName(''); setModal({ kind: 'create' }); }}>
              <span className="template-preview">
                <FilePlus2 size={26} />
              </span>
              <span className="template-name">Blank canvas</span>
              <span className="template-tagline">Start with an empty room.</span>
            </button>
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                className="template-card"
                disabled={creatingTemplate !== null}
                onClick={() => handleTemplate(t.id, t.name)}
              >
                <span className="template-preview" data-accent={t.accent} aria-hidden="true">
                  {creatingTemplate === t.id ? <Spinner size={22} /> : <TemplatePreview category={t.category} />}
                </span>
                <span className="template-name">{t.name}</span>
                <span className="template-tagline">{t.tagline}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rooms-section">
          <div className="section-heading section-heading-row">
            <div>
              <h2 className="section-title">Your rooms</h2>
              <p className="section-hint">{filteredRooms.length} room{filteredRooms.length === 1 ? '' : 's'}</p>
            </div>
            <div className="rooms-controls">
              <label className="search-box">
                <Search size={15} aria-hidden="true" />
                <input
                  className="search-input"
                  placeholder="Search rooms"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    className="search-clear"
                    aria-label="Clear search"
                    title="Clear search"
                    onClick={() => setQuery('')}
                  >
                    <X size={13} />
                  </button>
                )}
              </label>
              <select
                className="sort-select"
                aria-label="Sort rooms"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
              >
                <option value="recent">Recently edited</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          {rooms === undefined ? (
            <div className="room-grid" aria-label="Loading rooms">
              {Array.from({ length: 4 }, (_, i) => (
                <RoomCardSkeleton key={i} index={i} />
              ))}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="empty-dashboard">
              <div className="empty-illustration" aria-hidden="true">
                {query ? <SearchEmptyIllo /> : <RoomsEmptyIllo />}
              </div>
              <DrawnTitle as="h2" className="empty-title" delay={query ? 700 : 600}>
                {query ? 'No rooms match your search' : 'Nothing sketched yet'}
              </DrawnTitle>
              <p className="empty-subtitle">
                {query
                  ? 'Your search didn\'t match any room names. Try a shorter term, or clear the search to see every room.'
                  : 'Create your first room, or start from a template above — the canvas is yours.'}
              </p>
              {!query && (
                <button className="btn btn-primary" onClick={() => { setRoomName(''); setModal({ kind: 'create' }); }}>
                  <Plus size={16} />
                  New room
                </button>
              )}
            </div>
          ) : (
            <div className="room-grid">
              {filteredRooms.map((room, i) => (
                <div
                  key={room._id}
                  className="room-card"
                  style={{ '--i': i } as CSSProperties}
                  onClick={() => navigate(`/room/${room._id}`)}
                >
                  <button className="room-thumbnail" aria-label={`Open ${room.name}`}>
                    {room.thumbnailData ? (
                      <img src={room.thumbnailData} alt="" />
                    ) : (
                      <div className="room-thumbnail-placeholder">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3l1.9 5.6L19.5 10l-4.5 2.1L12 18l-3-5.9L4.5 10l5.6-1.4z" />
                        </svg>
                      </div>
                    )}
                    <span className="room-card-open glass-dense" aria-hidden="true">
                      Open <span aria-hidden="true">→</span>
                    </span>
                  </button>
                  <div className="room-card-body">
                    <div className="room-card-top">
                      <h3 className="room-card-name">{room.name}</h3>
                      <span className={`room-card-role room-card-role-${room.userRole}`}>
                        {roleLabel(room.userRole)}
                      </span>
                    </div>
                    <p className="room-card-meta">
                      {room.lastEditedBy?.name
                        ? `Edited by ${room.lastEditedBy.name} · ${formatRelativeTime(room.updatedAt)}`
                        : `Edited ${formatRelativeTime(room.updatedAt)}`}
                    </p>
                    <div className="room-card-foot">
                      {room.members && room.members.avatars.length > 1 && (
                        <div className="room-card-avatars" aria-label={`${room.members.avatars.length + room.members.plusCount} members`}>
                          {room.members.avatars.map((m, i) => (
                            <span key={i} className="room-card-avatar" title={m.name}>
                              {m.avatarUrl ? (
                                <img src={m.avatarUrl} alt="" />
                              ) : (
                                <span>{m.name.charAt(0).toUpperCase()}</span>
                              )}
                            </span>
                          ))}
                          {room.members.plusCount > 0 && (
                            <span className="room-card-avatar room-card-avatar-plus">
                              +{room.members.plusCount}
                            </span>
                          )}
                        </div>
                      )}
                      {room.userRole === 'owner' && (
                        <div className="room-card-kebab">
                          <button
                            className="room-card-kebab-btn"
                            title="Room actions"
                            aria-label={`Actions for ${room.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setKebabFor(kebabFor === room._id ? null : room._id);
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {kebabFor === room._id && (
                            <div className="room-card-menu" role="menu">
                              <button
                                role="menuitem"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRename(room._id, room.name);
                                }}
                              >
                                <Pencil size={14} />
                                Rename
                              </button>
                              {deletingId === room._id ? (
                                <>
                                  <button
                                    role="menuitem"
                                    className="room-card-menu-danger"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteRoom({ roomId: room._id }).catch(() => setDeletingId(null));
                                      setDeletingId(null);
                                    }}
                                  >
                                    <Trash2 size={14} />
                                    Delete
                                  </button>
                                  <button
                                    role="menuitem"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletingId(null);
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  role="menuitem"
                                  className="room-card-menu-danger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    confirmDelete(room._id);
                                  }}
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {modal && (
        <div className="new-room-modal" onClick={() => setModal(null)} role="presentation">
          <div
            className="new-room-card glass-dense"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={modal.kind === 'rename' ? 'Rename room' : 'New room'}
            ref={modalRef}
          >
            <header className="new-room-head">
              <h2 className="new-room-title">
                {modal.kind === 'rename' ? 'Rename room' : 'New room'}
              </h2>
              <button className="new-room-close" onClick={() => setModal(null)} aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <p className="new-room-subtitle">
              {modal.kind === 'rename'
                ? 'Give this room a clearer name.'
                : 'Name your room to get started.'}
            </p>
            <input
              autoFocus
              className="input"
              placeholder="e.g. Payment flow architecture"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (modal.kind === 'rename') void handleRename();
                  else void handleCreateRoom();
                }
                if (e.key === 'Escape') setModal(null);
              }}
            />
            <div className="new-room-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button
                className="btn btn-primary"
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
      )}
    </div>
  );
}

// First-load shell: the dashboard's own shape (sidebar, header, stats,
// template cards, room grid) as skeletons so the first paint reads as the
// product, not a generic spinner. Replaced by the real dashboard with a
// staggered reveal once workspaces resolve. Long waits cycle reassuring
// copy instead of shimmering silently; a hard timeout ends in a retry.
function DashboardLoadingShell({ failed = false }: { failed?: boolean }) {
  const { phrase } = useLongLoad(
    true,
    ['Loading your workspace…', 'Still syncing…', 'Almost there…'],
    4000
  );
  if (failed) {
    return (
      <div className="dashboard">
        <main className="dashboard-main">
          <div className="empty-dashboard" role="alert">
            <div className="empty-illustration" aria-hidden="true">
              <ErrorIllo />
            </div>
            <DrawnTitle as="h2" className="empty-title" delay={700}>
              Couldn't load your workspace
            </DrawnTitle>
            <p className="empty-subtitle">
              This usually means a connection hiccup. Give it another try.
            </p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        </main>
      </div>
    );
  }
  return (
    <div className="dashboard" aria-label="Loading your workspace">
      <aside className="sidebar skel-sidebar" aria-hidden="true">
        <div className="skel skel-sidebar-avatar" />
        <div className="skel skel-sidebar-nav" />
        <div className="skel skel-sidebar-bottom" />
      </aside>
      <main className="dashboard-main">
        <p key={phrase} className="skel-stall">
          {phrase}
        </p>
        <header className="dashboard-header">
          <div className="dashboard-heading-skel">
            <div className="skel skel-line skel-h-title" />
            <div className="skel skel-line skel-h-sub" />
          </div>
          <div className="skel skel-h-cta" />
        </header>
        <section className="dashboard-stats" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel skel-stat" />
          ))}
        </section>
        <section className="templates-section" aria-hidden="true">
          <div className="section-heading">
            <div className="skel skel-line skel-sec-title" />
          </div>
          <div className="templates-grid">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skel skel-template" />
            ))}
          </div>
        </section>
        <section className="rooms-section" aria-hidden="true">
          <div className="section-heading">
            <div className="skel skel-line skel-sec-title" />
          </div>
          <div className="room-grid">
            {Array.from({ length: 4 }, (_, i) => (
              <RoomCardSkeleton key={i} index={i} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function TemplatePreview({ category }: { category: string }) {
  if (category === 'architecture') {
    return (
      <svg viewBox="0 0 120 72" fill="none" aria-hidden="true">
        <rect x="8" y="8" width="34" height="22" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.9" />
        <rect x="46" y="8" width="34" height="22" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
        <rect x="84" y="8" width="28" height="22" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.9" />
        <rect x="8" y="42" width="34" height="22" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
        <path d="M42 19h4M80 19h4" stroke="var(--green-500)" strokeWidth="1.5" />
        <path d="M25 42v4M25 30l-8 12M25 30l8 12" stroke="var(--green-500)" strokeWidth="1.5" opacity="0.8" />
      </svg>
    );
  }
  if (category === 'wireframe') {
    return (
      <svg viewBox="0 0 120 72" fill="none" aria-hidden="true">
        <rect x="8" y="8" width="104" height="14" rx="4" stroke="currentColor" strokeWidth="1.5" />
        <rect x="8" y="30" width="104" height="16" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <rect x="8" y="54" width="48" height="10" rx="4" stroke="var(--green-500)" strokeWidth="1.5" />
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
      <rect x="14" y="50" width="26" height="16" rx="3" stroke="var(--green-500)" strokeWidth="1.5" />
      <rect x="46" y="50" width="26" height="16" rx="3" stroke="var(--green-500)" strokeWidth="1.5" opacity="0.6" />
      <rect x="78" y="50" width="26" height="16" rx="3" stroke="var(--green-500)" strokeWidth="1.5" opacity="0.35" />
    </svg>
  );
}

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

function roleLabel(role: string) {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'editor':
      return 'Editor';
    case 'viewer':
      return 'Viewer';
    default:
      return role;
  }
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
