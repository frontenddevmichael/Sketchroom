import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthActions } from '@convex-dev/auth/react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import {
  LayoutDashboard,
  CreditCard,
  Settings,
  LogOut,
  Moon,
  Sun,
  Sparkles,
} from 'lucide-react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useTheme } from '../lib/useTheme';
import { FREE_ROOM_LIMIT } from '../lib/plans';
import './shared.css';

type Placement = 'up' | 'down';
type Size = 'sm' | 'lg';
type Align = 'left' | 'right';

interface UserMenuProps {
  /** Where the popover should open relative to the avatar. Pass "up" when the
   *  avatar sits at the bottom of a full-height rail (Dashboard sidebar) so
   *  the menu never renders off-screen. */
  placement?: Placement;
  /** lg for large account-avatar contexts (Settings → Account). */
  size?: Size;
  /** Which way the 264px popover extends from the avatar. Avatars on the
   *  left half of the screen ("left" — sidebar, settings rows) grow the menu
   *  rightward over the main content; avatars near the right edge ("right" —
   *  dashboard header) grow it leftward. */
  align?: Align;
}

/**
 * The account avatar menu — the product's account modal. Opens on hover
 * (with a short grace period so moving the cursor into the popover doesn't
 * flash it closed) and toggles on click/tap, so it works for mouse, touch,
 * and keyboard alike. Shows the profile header, a live Free-plan meter with
 * an upgrade path, quick links to every dashboard destination, the theme
 * switch, and a prominent Sign out. Closes on outside pointer-down or Escape.
 */
export function UserMenu({ placement = 'down', size = 'sm', align = 'right' }: UserMenuProps) {
  const { user } = useCurrentUser();
  const { signOut: signOutAction } = useAuthActions();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | null>(null);
  const usage = useQuery(api.rooms.getUsage);

  const clearHoverTimer = () => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const scheduleOpen = () => {
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => setOpen(true), 110);
  };

  const scheduleClose = () => {
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => setOpen(false), 220);
  };

  useEffect(() => clearHoverTimer, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const handleSignOut = () => {
    setOpen(false);
    void signOutAction().then(() => navigate('/'));
  };

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() || '?';
  const roomCount = usage?.rooms ?? 0;
  const roomPct = Math.min(100, (roomCount / FREE_ROOM_LIMIT) * 100);
  const atRoomLimit = !!usage && usage.rooms >= FREE_ROOM_LIMIT;

  return (
    <div
      className={`user-menu user-menu-${placement} user-menu-${align} user-menu-${size}`}
      ref={ref}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      onFocus={scheduleOpen}
    >
      <button
        className="user-menu-avatar"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        title={user?.name ?? 'Account'}
        onClick={() => setOpen((v) => !v)}
      >
        {user?.imageUrl ? (
          <img className="user-menu-img" src={user.imageUrl} alt="" />
        ) : (
          <span className="user-menu-initial">{initial}</span>
        )}
      </button>
      {open && (
        <div className="user-menu-popover glass-panel" role="menu" aria-label="Account">
          <span className="user-menu-caret" aria-hidden="true" />
          <div className="user-menu-head">
            <span className="user-menu-head-avatar" aria-hidden="true">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="" />
              ) : (
                <span>{initial}</span>
              )}
            </span>
            <span className="user-menu-head-id">
              <span className="user-menu-head-name">{user?.name ?? 'Account'}</span>
              {user?.email && <span className="user-menu-head-email">{user.email}</span>}
            </span>
          </div>

          <div className="user-menu-plan">
            <div className="user-menu-plan-row">
              <span className="user-menu-plan-name">Free plan</span>
              <span className="user-menu-plan-count">
                {roomCount} / {FREE_ROOM_LIMIT} rooms
              </span>
            </div>
            <div className="user-menu-plan-bar" aria-hidden="true">
              <span className="user-menu-plan-fill" style={{ width: `${roomPct}%` }} />
            </div>
            <button
              className="user-menu-plan-upgrade"
              role="menuitem"
              onClick={() => go('/billing')}
            >
              <Sparkles size={13} />
              {atRoomLimit ? 'Team plan coming' : 'See plans'}
            </button>
          </div>

          <div className="user-menu-sep" role="separator" />

          <button className="user-menu-item" role="menuitem" onClick={() => go('/dashboard')}>
            <LayoutDashboard size={15} />
            Rooms
          </button>
          <button className="user-menu-item" role="menuitem" onClick={() => go('/billing')}>
            <CreditCard size={15} />
            Billing
          </button>
          <button className="user-menu-item" role="menuitem" onClick={() => go('/settings')}>
            <Settings size={15} />
            Settings
          </button>

          <div className="user-menu-sep" role="separator" />

          <button className="user-menu-item" role="menuitem" onClick={() => toggleTheme()}>
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
          <button
            className="user-menu-item user-menu-item-danger"
            role="menuitem"
            onClick={handleSignOut}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
