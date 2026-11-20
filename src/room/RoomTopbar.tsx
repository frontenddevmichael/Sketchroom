import { useState } from 'react';
import type { RefObject } from 'react';
import {
  ArrowLeft,
  Download,
  HelpCircle,
  History,
  MoreHorizontal,
  Pencil,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { isSoundEnabled, playPop, toggleSound } from '../utils/sound';
import './RoomTopbar.css';

export interface RoomTopbarPresence {
  userId: string;
  name: string;
  avatarUrl?: string | null;
}

export interface RoomTopbarStatus {
  /** The raw save state; remounting on it re-draws the Saved check. */
  key?: string;
  tone: 'ok' | 'warn' | 'danger' | 'neutral';
  label: string;
}

export interface RoomTopbarProps {
  roomName: string;
  canRename: boolean;
  status: RoomTopbarStatus | null;
  presence: readonly RoomTopbarPresence[];
  historyOpen: boolean;
  moreMenuOpen: boolean;
  onBack: () => void;
  onRename: (name: string) => void;
  onToggleHistory: () => void;
  onOpenShortcuts: () => void;
  onOpenExport: () => void;
  onOpenShare: () => void;
  onToggleMore: () => void;
  shareBtnRef: RefObject<HTMLButtonElement | null>;
  moreRef: RefObject<HTMLDivElement | null>;
}

/**
 * The room's top bar: a three-zone grid — back + name on the left, the room
 * pulse (save state and who is here) in the free center, actions on the right.
 * The center absorbs layout instead of pushing it, so status changes never
 * shift the actions.
 */
export function RoomTopbar({
  roomName,
  canRename,
  status,
  presence,
  historyOpen,
  moreMenuOpen,
  onBack,
  onRename,
  onToggleHistory,
  onOpenShortcuts,
  onOpenExport,
  onOpenShare,
  onToggleMore,
  shareBtnRef,
  moreRef,
}: RoomTopbarProps) {
  // Sound is a local preference, so the button owns it and re-renders itself.
  const [soundOn, setSoundOn] = useState(isSoundEnabled);

  return (
    <div className="room-topbar glass">
      <div className="room-topbar-left">
        <button className="room-back-btn" onClick={onBack} aria-label="Back to dashboard">
          <ArrowLeft size={18} />
        </button>
        <div className="room-name-wrap">
          <input
            className="room-name-input"
            defaultValue={roomName}
            aria-label="Room name"
            readOnly={!canRename}
            onBlur={(e) => onRename(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
            }}
          />
          {canRename && (
            <span className="room-name-pencil" aria-hidden="true">
              <Pencil size={13} />
            </span>
          )}
        </div>
      </div>

      <div className="room-topbar-center">
        {status && (
          <span
            key={status.key ?? status.label}
            className={`room-status-pill room-status-${status.tone}`}
          >
            {status.tone === 'ok' ? (
              <svg
                className="room-status-check"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path pathLength={1} d="M2.5 6.2 4.9 8.6 9.5 3.6" />
              </svg>
            ) : (
              <span className="room-status-dot" />
            )}
            {status.label}
          </span>
        )}
        {presence.length > 0 ? (
          <div className="room-presence-avatars">
            {presence.slice(0, 5).map((person) => (
              <span key={person.userId} className="room-presence-avatar" title={person.name}>
                {person.avatarUrl ? (
                  <img src={person.avatarUrl} alt={person.name} />
                ) : (
                  <span>{person.name.charAt(0).toUpperCase()}</span>
                )}
              </span>
            ))}
            {presence.length > 5 && (
              <span
                className="room-presence-avatar room-presence-more"
                title={`${presence.length - 5} more`}
              >
                +{presence.length - 5}
              </span>
            )}
          </div>
        ) : (
          /* Working solo: a quiet absence of presence UI, not an empty state. */
          <span className="room-presence-solo" role="note">
            <User size={12} />
            Just you
          </span>
        )}
      </div>

      <div className="room-topbar-right">
        <button
          className="room-icon-btn room-topbar-hideable"
          title={soundOn ? 'Mute sound' : 'Enable sound'}
          aria-label={soundOn ? 'Mute sound' : 'Enable sound'}
          onClick={() => {
            const updated = toggleSound();
            setSoundOn(updated);
            if (updated) playPop(520);
          }}
        >
          {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <button
          className="room-icon-btn room-topbar-hideable"
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
          onClick={onOpenShortcuts}
        >
          <HelpCircle size={18} />
        </button>
        <button
          className={`room-icon-btn ${historyOpen ? 'active' : ''}`}
          title="Version history"
          aria-label="Version history"
          onClick={onToggleHistory}
        >
          <History size={18} />
        </button>
        <button
          className="room-icon-btn room-topbar-hideable"
          title="Export"
          aria-label="Export"
          onClick={onOpenExport}
        >
          <Download size={18} />
        </button>
        {canRename && (
          <button ref={shareBtnRef} className="room-share-btn" onClick={onOpenShare}>
            Share
          </button>
        )}
        <div className="room-topbar-more" ref={moreRef}>
          <button
            className="room-icon-btn room-topbar-more-btn"
            title="More actions"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={moreMenuOpen}
            onClick={onToggleMore}
          >
            <MoreHorizontal size={18} />
          </button>
          {moreMenuOpen && (
            <div className="room-more-menu glass" role="menu" aria-label="More actions">
              <button role="menuitem" onClick={onOpenShortcuts}>
                <HelpCircle size={14} />
                Keyboard shortcuts
              </button>
              <button role="menuitem" onClick={onOpenExport}>
                <Download size={14} />
                Export
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
