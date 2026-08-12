import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, UserButton } from '@clerk/react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useTheme } from '../lib/useTheme';
import { AppTabBar } from '../components/AppTabBar';
import { usePageTitle } from '../lib/usePageTitle';
import { FormSkeleton } from '../components/skeletons';
import { Moon, Sun, Trash2, ArrowLeft, Check } from 'lucide-react';
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
  const { user } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<'workspace' | 'account'>('workspace');
  const [workspaceName, setWorkspaceName] = useState('');
  const [deleteState, setDeleteState] = useState<DeleteState>({ inProgress: false, error: null });
  const [nameError, setNameError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState(false);
  const [displayName, setDisplayName] = useState(user?.fullName || user?.firstName || '');
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [savedDisplayName, setSavedDisplayName] = useState(false);

  const workspaces = useQuery(api.rooms.getWorkspaces);
  const updateWorkspaceName = useMutation(api.rooms.updateWorkspaceName);
  const deleteWorkspace = useMutation(api.rooms.deleteWorkspace);

  if (!workspaces) return <SettingsLoadingShell />;

  const workspace = workspaces[0];

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
    if (!window.confirm('This will permanently delete your workspace and all rooms. This cannot be undone.')) return;
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
      await user.update({ firstName: trimmed.split(' ')[0], lastName: trimmed.split(' ').slice(1).join(' ') || undefined });
      setSavedDisplayName(true);
      window.setTimeout(() => setSavedDisplayName(false), 1600);
    } catch (err) {
      setDisplayNameError(err instanceof Error ? err.message : 'Could not update display name.');
    } finally {
      setSavingDisplayName(false);
    }
  };

  return (
    <div className="settings-screen">
      <AppTabBar />
      <aside className="settings-sidebar">
        <button className="settings-back" onClick={() => navigate('/dashboard')}>
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
              <label className="settings-label">Members</label>
              <div className="settings-members">
                <div className="settings-member">
                  <div className="settings-member-avatar">
                    <UserButton />
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
              <button className="btn btn-danger" onClick={handleDeleteWorkspace} disabled={deleteState.inProgress}>
                <Trash2 size={16} />
                {deleteState.inProgress ? 'Deleting…' : 'Delete workspace'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="settings-title">Account settings</h1>
            <div className="settings-section settings-account-row">
              <div className="settings-avatar-large">
                <UserButton />
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
                  value={user?.emailAddresses?.[0]?.emailAddress || ''}
                  readOnly
                />
              </div>
            </div>
            <div className="settings-section">
              <label className="settings-label">Appearance</label>
              <button className="theme-toggle" onClick={toggleTheme}>
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
              </button>
            </div>
          </>
        )}
      </main>
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