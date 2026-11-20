import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ArrowLeft, Sparkles, Check, AlertTriangle } from 'lucide-react';
import { usePageTitle } from '../lib/usePageTitle';
import './InviteScreen.css';

/**
 * User-facing copy for known invite failures. Server errors are diagnosed by
 * their message, but the raw text never reaches the UI — internal strings like
 * "Cannot destructure property 'roomId' of 'undefined'" are useless to a user
 * and leak implementation detail.
 */
const INVITE_ERROR_COPY: ReadonlyArray<readonly [RegExp, string]> = [
  [/expired/i, 'This invite has expired. Ask the room owner for a fresh link.'],
  [/doesn't match|does not match/i, 'This invite was sent to a different email address. Sign in with the invited account.'],
  [/invalid/i, 'This invite link is invalid or has already been used.'],
  [/not authenticated/i, 'Sign in to accept this invite.'],
];

const GENERIC_INVITE_ERROR =
  'We could not add you to this room. The link may be out of date \u2014 ask the room owner for a new one.';

function inviteErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : '';
  const known = INVITE_ERROR_COPY.find(([pattern]) => pattern.test(raw));
  return known ? known[1] : GENERIC_INVITE_ERROR;
}

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
      .then((result) => {
        if (cancelled) return;
        // A success payload without a room id cannot be acted on: treat it as
        // a failure rather than navigating to /room/undefined.
        if (!result?.roomId) {
          setError(GENERIC_INVITE_ERROR);
          return;
        }
        setAccepted(true);
        window.setTimeout(() => navigate(`/room/${result.roomId}`, { replace: true }), 900);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('acceptInvite failed', err);
        setError(inviteErrorMessage(err));
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