import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { X, Copy, Check, Mail, Link2, Ban } from 'lucide-react';
import { ListRowSkeleton } from './skeletons';
import { ShareEmptyIllo, DrawnTitle } from './illustrations';
import { useModalFocus } from '../lib/useModalFocus';
import './ShareModal.css';

interface ShareModalProps {
  roomId: Id<'rooms'>;
  onClose: () => void;
}

export function ShareModal({ roomId, onClose }: ShareModalProps) {
  const modalRef = useModalFocus<HTMLDivElement>(onClose);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [copied, setCopied] = useState(false);
  const [linkRole, setLinkRole] = useState<'editor' | 'viewer'>('editor');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Two-step confirm: the first click arms removal, the second commits.
  const [confirmRemoveFor, setConfirmRemoveFor] = useState<string | null>(null);

  const members = useQuery(api.features.invites.listMembers, { roomId });
  const invites = useQuery(api.features.invites.getRoomInvites, { roomId });
  const inviteMember = useMutation(api.features.invites.inviteMember);
  const createInviteLink = useMutation(api.features.invites.createInviteLink);
  const revokeInvite = useMutation(api.features.invites.revokeInvite);
  const updateRole = useMutation(api.features.invites.updateMemberRole);
  const removeMember = useMutation(api.features.invites.removeMember);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCreateLink = async () => {
    setError(null);
    try {
      const { token } = await createInviteLink({ roomId, role: linkRole });
      setInviteLink(`${window.location.origin}/invite/${token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create invite link.');
    }
  };

  const handleInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await inviteMember({ roomId, email: trimmed, role });
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invite.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card share-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Share this room"
        ref={modalRef}
      >
        <header className="modal-header">
          <h2 className="modal-title">Share this room</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="share-link-row">
          <input
            className="input"
            value={inviteLink || ''}
            placeholder="Create a shareable invite link"
            readOnly
            onClick={() => inviteLink && handleCopy(inviteLink)}
            aria-label="Invite link"
          />
          <div className="share-link-actions">
            <select
              className="input share-role-select"
              value={linkRole}
              onChange={(e) => setLinkRole(e.target.value as 'editor' | 'viewer')}
              aria-label="Link role"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              className="btn btn-outline share-copy"
              onClick={inviteLink ? () => handleCopy(inviteLink as string) : handleCreateLink}
            >
              {inviteLink ? (
                copied ? <Check size={15} /> : <Copy size={15} />
              ) : (
                <Link2 size={15} />
              )}
              {inviteLink ? (copied ? 'Copied' : 'Copy') : 'Create link'}
            </button>
          </div>
        </div>

        <div className="share-invite-row">
          <div className="share-invite-input-wrap">
            <Mail size={15} className="share-mail-icon" />
            <input
              className="input"
              placeholder="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
            />
          </div>
          <select
            className="input share-role-select"
            value={role}
            onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
            aria-label="Role"
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button className="btn btn-primary" onClick={handleInvite}>Invite</button>
        </div>

        {invites && invites.length > 0 && (
          <div className="share-pending">
            <h3 className="share-pending-title">Pending invites</h3>
            {invites.map((invite) => (
              <div key={invite._id} className="share-pending-row">
                {invite.email ? (
                  <span className="share-pending-email">{invite.email}</span>
                ) : (
                  <span className="share-pending-email">Anyone with link</span>
                )}
                <span className="share-pending-role">{invite.role}</span>
                <span className="share-pending-status">{invite.status}</span>
                <button
                  className="share-remove"
                  onClick={() => {
                    revokeInvite({ inviteId: invite._id }).catch((err) => {
                      setError(err instanceof Error ? err.message : 'Could not revoke invite.');
                    });
                  }}
                >
                  <Ban size={13} />
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="share-error" role="alert">{error}</p>}

        <div className="share-members">
          {members === undefined && (
            <div className="share-members-skel" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <ListRowSkeleton key={i} index={i} thumb={false} />
              ))}
            </div>
          )}
          {members && members.length === 0 && (!invites || invites.length === 0) && (
            <div className="share-empty">
              <ShareEmptyIllo />
              <DrawnTitle className="share-empty-title" delay={650}>
                No collaborators yet
              </DrawnTitle>
              <p className="share-empty-text">
                Invite someone by email or share the link above — they'll join live on the canvas.
              </p>
            </div>
          )}
          {members?.map((m, i) => (
            <div key={m.userId} className="share-member" style={{ '--i': i } as CSSProperties}>
              <div className="share-member-avatar">
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt={m.name || m.email} />
                ) : (
                  <span>{(m.name || m.email).charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="share-member-info">
                <span className="share-member-name">{m.name || m.email}</span>
                <span className="share-member-email">{m.email}</span>
              </div>
              {m.role === 'owner' ? (
                <span className="share-member-owner">Owner</span>
              ) : (
                <div className="share-member-actions">
                  <select
                    className="input share-role-select share-role-small"
                    value={m.role}
                    onChange={(e) => {
                      updateRole({ roomId, userId: m.userId, role: e.target.value as 'editor' | 'viewer' }).catch((err) => {
                        setError(err instanceof Error ? err.message : 'Could not update role.');
                      });
                    }}
                    aria-label="Change role"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  {confirmRemoveFor === m.userId ? (
                    <span className="share-remove-confirm">
                      <button
                        className="share-remove share-remove-danger"
                        onClick={() => {
                          setConfirmRemoveFor(null);
                          removeMember({ roomId, userId: m.userId }).catch((err) => {
                            setError(err instanceof Error ? err.message : 'Could not remove member.');
                          });
                        }}
                      >
                        Remove?
                      </button>
                      <button
                        className="share-remove-cancel"
                        onClick={() => setConfirmRemoveFor(null)}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      className="share-remove"
                      onClick={() => setConfirmRemoveFor(m.userId)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}