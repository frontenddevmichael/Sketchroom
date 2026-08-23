import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureError } from '../lib/sentry';
import '../components/shared.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  onReport?: (error: unknown, info: ErrorInfo) => void;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onReport?.(error, info);
    // Send to Sentry
    captureError(
      error instanceof Error ? error : new Error(String(error)),
      { componentStack: info.componentStack }
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <div className="error-grid-bg" aria-hidden="true" />
          <div className="error-content">
            <div className="error-icon" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            </div>
            <h1 className="error-title">Something went wrong</h1>
            <p className="error-message">{this.state.message}</p>
            <button className="btn btn-outline" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}