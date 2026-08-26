import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureError } from '../lib/sentry';
import './shared.css';

interface ScreenErrorBoundaryProps {
  children: ReactNode;
  screenName: string;
  fallback?: ReactNode;
  onReport?: (error: unknown, info: ErrorInfo) => void;
  recoveryActions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'outline' | 'ghost';
  }>;
}

interface ScreenErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ScreenErrorBoundary extends Component<ScreenErrorBoundaryProps, ScreenErrorBoundaryState> {
  state: ScreenErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ScreenErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onReport?.(error, info);
    // Send to Sentry with screen context
    captureError(
      error instanceof Error ? error : new Error(String(error)),
      { screenName: this.props.screenName, componentStack: info.componentStack }
    );
  }

  render() {
    if (this.state.hasError) {
      const { screenName, fallback, recoveryActions } = this.props;

      if (fallback) {
        return fallback;
      }

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
            <h1 className="error-title">{screenName} failed to load</h1>
            <p className="error-message">{this.state.message}</p>
            <div className="error-actions" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
              {recoveryActions?.map((action, i) => (
                <button
                  key={i}
                  className={`btn btn-${action.variant || 'outline'}`}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
              <button className="btn btn-outline" onClick={() => window.location.reload()}>
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  screenName: string,
  options?: Partial<ScreenErrorBoundaryProps>
) {
  return function WrappedComponent(props: P) {
    return (
      <ScreenErrorBoundary screenName={screenName} {...options}>
        <Component {...props} />
      </ScreenErrorBoundary>
    );
  };
}