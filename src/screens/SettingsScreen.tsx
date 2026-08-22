import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../../convex/_generated/api';
import { useTheme } from '../lib/useTheme';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { UserMenu } from '../components/UserMenu';
import { AppTabBar } from '../components/AppTabBar';
import { usePageTitle } from '../lib/usePageTitle';
import { useModalFocus } from '../lib/useModalFocus';
import { FormSkeleton } from '../components/skeletons';
import { FREE_ROOM_LIMIT, FREE_AI_LIMIT } from '../lib/plans';
import { Moon, Sun, Trash2, ArrowLeft, Check, LogOut, Sparkles, X, TriangleAlert } from 'lucide-react';
import '../components/shared.css';
import '../components/skeletons.css';
import './SettingsScreen.css';

interface DeleteState {
  inProgress: boolean;
  error: string | null;
}

export function SettingsScreen() {
  usePageTitle('Settings — Sketchroom');
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuthActions();
  const [tab, setTab] = useState<'workspace' | 'account'>('workspace');
  const [workspaceName, setWorkspaceName] = useState('');
  const [deleteState, setDeleteState] = useState<DeleteState>({ inProgress: false, error: null });
  const [nameError, setNameError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [savedDisplayName, setSavedDisplayName] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const workspaces = useQuery(api.features.rooms.getWorkspaces);
  const usage = useQuery(api.features.rooms.getUsage);
  const updateWorkspaceName = useMutation(api.features.rooms.updateWorkspaceName);
  const deleteWorkspace = useMutation(api.features.rooms.deleteWorkspace);
  const updateProfile = useMutation(api.core.users.updateProfile);

  const confirmRef = useModalFocus<HTMLDivElement>(() => setConfirmDeleteOpen(false), confirmDeleteOpen);

  if (!workspaces) return <SettingsLoadingShell />;

  const workspace = workspaces[0];

  const roomCount = usage?.rooms ?? 0;
  const aiCount = usage?.aiSuggestions ?? 0;
  const roomPct = Math.min(100, (roomCount / FREE_ROOM_LIMIT) * 100);
  const aiPct = Math.min(100, (aiCount / FREE_AI_LIMIT) * 100);

  const handleSaveName = async () => {
    if (!workspace || !workspaceName.trim()) return;
    setNameError(null);
    try {
      await updateWorkspaceName({ workspaceId: workspace._id, name: workspaceName });
      setWorkspaceName('');
      setSavedName(true);
      window.setTimeout(() => setSavedName(false), 1600);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Could not save workspace name.');
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspace) return;
    setDeleteState({ inProgress: true, error: null });
    try {
      await deleteWorkspace({ workspaceId: workspace._id });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setDeleteState({ inProgress: false, error: err instanceof Error ? err.message : 'Could not delete workspace.' });
    }
  };

  const handleSaveDisplayName = async () => {
    if (!user) return;
    const trimmed = displayName.trim();
    if (!trimmed) {
      setDisplayNameError('Display name cannot be empty.');
      return;
    }
    setSavingDisplayName(true);
    setDisplayNameError(null);
    try {
      await updateProfile({ name: trimmed });
      setSavedDisplayName(true);
      window.setTimeout(() => setSavedDisplayName(false), 1600);
    } catch (err) {
      setDisplayNameError(err instanceof Error ? err.message : 'Could not update display name.');
    } finally {
      setSavingDisplayName(false);
    }
  };

  const handleSignOut = () => {
    signOut()
      .then(() => navigate('/'))
      // A failed sign-out must not be an unhandled rejection: keep the user
      // in the app with a clear message instead of a silent no-op.
      .catch(() => setSignOutError('Could not sign out — check your connection and try again.'));
  };

  return (
    <div className="settings-screen">
      <AppTabBar />
      <aside className="settings-sidebar">
        <button className="settings-back" onClick={() => navigate('/dashboard')} aria-label="Back to dashboard">
          <ArrowLeft size={18} />
        </button>
        <div className="settings-nav">
          <button
            className={`settings-nav-item ${tab === 'workspace' ? 'active' : ''}`}
            onClick={() => setTab('workspace')}
          >
            Workspace
          </button>
          <button
            className={`settings-nav-item ${tab === 'account' ? 'active' : ''}`}
            onClick={() => setTab('account')}
          >
            Account
          </button>
          <button className="settings-nav-item" onClick={() => navigate('/billing')}>
            Billing
          </button>
        </div>
      </aside>

      <main className="settings-main">
        {tab === 'workspace' ? (
          <>
            <h1 className="settings-title">Workspace settings</h1>
            <div className="settings-section">
              <label className="settings-label" htmlFor="workspace-name">Workspace name</label>
              <input
                id="workspace-name"
                className="input"
                placeholder={workspace?.name}
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); }}
              />
              {nameError && <p className="settings-error" role="alert">{nameError}</p>}
              <button
                className="settings-save"
                onClick={handleSaveName}
                disabled={!workspaceName.trim()}
              >
                {savedName ? <><Check size={14} />Saved</> : 'Save'}
              </button>
            </div>

            <div className="settings-section">
              <label className="settings-label" htmlFor="settings-usage">Plan & usage</label>
              <div className="settings-usage" id="settings-usage">
                <div className="settings-usage-row">
                  <span className="settings-usage-label">Rooms</span>
                  <div className="settings-usage-bar" aria-hidden="true">
                    <span className="settings-usage-fill" style={{ width: `${roomPct}%` }} />
                  </div>
                  <span className="settings-usage-count">{roomCount} / {FREE_ROOM_LIMIT}</span>
                </div>
                <div className="settings-usage-row">
                  <span className="settings-usage-label">AI suggestions</span>
                  <div className="settings-usage-bar" aria-hidden="true">
                    <span className="settings-usage-fill settings-usage-fill-ai" style={{ width: `${aiPct}%` }} />
                  </div>
                  <span className="settings-usage-count">{aiCount} / {FREE_AI_LIMIT} this month</span>
                </div>
              </div>
              <button className="settings-plan-link" onClick={() => navigate('/billing')}>
                <Sparkles size={14} />
                See plans & Team
              </button>
            </div>

            <div className="settings-section">
              <label className="settings-label">Members</label>
              <div className="settings-members">
                <div className="settings-member">
                  <div className="settings-member-avatar">
                    <UserMenu placement="down" align="left" />
                  </div>
                  <div className="settings-member-info">
                    <span className="settings-member-name">{workspace?.name}</span>
                    <span className="settings-member-role">Owner</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="danger-zone">
              <h3 className="danger-zone-title">Danger zone</h3>
              <p className="danger-zone-text">
                Deleting your workspace permanently removes all rooms, snapshots, and data.
              </p>
              {deleteState.error && <p className="settings-error" role="alert">{deleteState.error}</p>}
              <button className="btn btn-danger" onClick={() => setConfirmDeleteOpen(true)}>
                <Trash2 size={16} />
                Delete workspace
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="settings-title">Account settings</h1>
            <div className="settings-section settings-account-row">
              <div className="settings-avatar-large">
                <UserMenu placement="down" size="lg" align="left" />
              </div>
              <div className="settings-account-fields">
                <label className="settings-label" htmlFor="display-name">Display name</label>
                <div className="settings-inline-save">
                  <input
                    id="display-name"
                    className="input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDisplayName(); }}
                  />
                  <button
                    className="settings-save"
                    onClick={handleSaveDisplayName}
                    disabled={savingDisplayName}
                  >
                    {savedDisplayName ? <><Check size={14} />Saved</> : savingDisplayName ? 'Saving…' : 'Save'}
                  </button>
                </div>
                {displayNameError && <p className="settings-error" role="alert">{displayNameError}</p>}
                <label className="settings-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  className="input"
                  value={user?.email || ''}
                  readOnly
                />
              </div>
            </div>
            <div className="settings-section">
              <label className="settings-label">Appearance</label>
              <div className="settings-theme-seg" role="radiogroup" aria-label="Theme">
                <button
                  className={`settings-theme-opt${theme === 'light' ? ' active' : ''}`}
                  aria-checked={theme === 'light'}
                  role="radio"
                  onClick={() => setTheme('light')}
                >
                  <Sun size={15} />
                  Light
                </button>
                <button
                  className={`settings-theme-opt${theme === 'dark' ? ' active' : ''}`}
                  aria-checked={theme === 'dark'}
                  role="radio"
                  onClick={() => setTheme('dark')}
                >
                  <Moon size={15} />
                  Dark
                </button>
              </div>
            </div>
            <div className="settings-section">
              <label className="settings-label">Session</label>
              <button className="settings-signout" onClick={handleSignOut}>
                <LogOut size={16} />
                Sign out
              </button>
              {signOutError && (
                <p className="settings-error" role="alert">{signOutError}</p>
              )}
            </div>
          </>
        )}
      </main>

      {confirmDeleteOpen && (
        <div className="settings-confirm-backdrop" onClick={() => setConfirmDeleteOpen(false)} role="presentation">
          <div
            ref={confirmRef}
            className="settings-confirm-card glass-dense"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-label="Delete workspace"
          >
            <header className="settings-confirm-head">
              <h2 className="settings-confirm-title">
                <TriangleAlert size={18} />
                Delete workspace?
              </h2>
              <button className="settings-confirm-close" onClick={() => setConfirmDeleteOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <p className="settings-confirm-text">
              This will permanently delete your workspace and all rooms, snapshots, and data. This cannot be undone.
            </p>
            {deleteState.error && <p className="settings-error" role="alert">{deleteState.error}</p>}
            <div className="settings-confirm-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDeleteOpen(false)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={() => void handleDeleteWorkspace()}
                disabled={deleteState.inProgress}
              >
                <Trash2 size={16} />
                {deleteState.inProgress ? 'Deleting…' : 'Delete workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Settings first-load shell: the screen's own shape (sidebar nav + form
// sections) as skeletons, so the first paint reads as Settings — not a
// generic spinner or a blank page.
function SettingsLoadingShell() {
  return (
    <div className="settings-screen" aria-label="Loading settings">
      <aside className="settings-sidebar" aria-hidden="true">
        <div className="skel skel-settings-back" />
        <div className="settings-nav">
          <div className="skel skel-settings-nav-item" />
          <div className="skel skel-settings-nav-item" />
          <div className="skel skel-settings-nav-item" />
        </div>
      </aside>
      <main className="settings-main">
        <div className="skel skel-line skel-settings-title" />
        <FormSkeleton index={0} rows={3} />
        <FormSkeleton index={1} rows={2} />
      </main>
    </div>
  );
}
