import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ThemeProvider } from './ThemeProvider';
import { ErrorBoundary } from '../components/ErrorBoundary';
import App from '../App';

function ReportingErrorBoundary() {
  const reportError = useMutation(api.errors.reportError);
  return (
    <ErrorBoundary
      onReport={(error, info) => {
        void reportError({
          source: 'react',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          componentStack: info.componentStack ?? undefined,
          url: window.location.href,
        }).catch(() => undefined);
      }}
    >
      <App />
    </ErrorBoundary>
  );
}

/**
 * App-level providers that don't depend on auth. The Convex client and auth
 * provider wrap this tree in `main.tsx`.
 */
export function AppProviders() {
  return (
    <ThemeProvider>
      <ReportingErrorBoundary />
    </ThemeProvider>
  );
}
