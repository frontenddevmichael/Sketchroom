import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ArrowLeft, Sparkles, Check, AlertTriangle } from 'lucide-react';
import { usePageTitle } from '../lib/usePageTitle';
import './InviteScreen.css';

export function InviteScreen() {
  usePageTitle('Joining a room — Sketchroom');
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const acceptInvite = useMutation(api.features.invites.acceptInvite);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    acceptInvite({ token })
      .then(({ roomId }) => {
        if (cancelled) return;
        setAccepted(true);
        window.setTimeout(() => navigate(`/room/${roomId}`, { replace: true }), 900);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'This invite could not be accepted.');
      });
    return () => {
      cancelled = true;
    };
  }, [token, acceptInvite, navigate]);

  const missingToken = token ? null : 'This invite link is missing a token.';
  const finalError = error || missingToken;

  useEffect(() => {
    if (!missingToken) return;
    const timer = window.setTimeout(
      () => navigate('/dashboard', { replace: true }),
      2400
    );
    return () => window.clearTimeout(timer);
  }, [missingToken, navigate]);

  return (
    <div className="error-screen">
      <div className="error-grid-bg" aria-hidden="true" />
      <div className="error-content">
        <div className={`error-icon ${accepted ? 'error-icon-success' : ''}`} aria-hidden="true">
          {accepted ? (
            <Check size={48} />
          ) : finalError ? (
            <AlertTriangle size={48} />
          ) : (
            <Sparkles size={48} />
          )}
        </div>
        <h1 className="error-title">
          {accepted
            ? 'You\u2019re in!'
            : finalError
              ? 'Could not accept invite'
              : 'Joining the room\u2026'}
        </h1>
        <p className="error-message">
          {accepted
            ? 'Taking you to the room now.'
            : finalError || 'Hang tight while we add you to the room.'}
        </p>
        {finalError ? (
          <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
        ) : (
          <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={16} />
            Go to Dashboard
          </button>
        )}
      </div>
    </div>
  );
}