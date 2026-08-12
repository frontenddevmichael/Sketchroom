import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthActions } from '@convex-dev/auth/react';
import { Settings, LogOut } from 'lucide-react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import './shared.css';

/**
 * The account avatar menu. Shows the user's image or initials, and on click
 * reveals their email, a link to Account settings, and Sign out. Closes on
 * outside pointer-down or Escape.
 */
export function UserMenu() {
  const { user } = useCurrentUser();
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="user-menu" ref={ref}>
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
        <div className="user-menu-popover" role="menu" aria-label="Account">
          <div className="user-menu-head">
            <span className="user-menu-head-name">{user?.name ?? 'Account'}</span>
            {user?.email && <span className="user-menu-head-email">{user.email}</span>}
          </div>
          <div className="user-menu-sep" role="separator" />
          <button
            className="user-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate('/settings');
            }}
          >
            <Settings size={15} />
            Account settings
          </button>
          <button
            className="user-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut().then(() => navigate('/'));
            }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
