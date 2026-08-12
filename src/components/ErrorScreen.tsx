import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export function ErrorScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const message =
    (location.state as { message?: string } | null)?.message ||
    'We couldn\u2019t find this room. It may have been moved or you may not have access.';

  return (
    <div className="error-screen">
      <div className="error-grid-bg" aria-hidden="true" />
      <div className="error-content">
        <div className="error-icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M9 9h6M9 12.5h6M9 16h4" />
          </svg>
        </div>
        <h1 className="error-title">This room isn&apos;t available</h1>
        <p className="error-message">{message}</p>
        <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}