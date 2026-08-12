import { useAuth } from '@clerk/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useMutation } from 'convex/react';
import { convex } from './convex-client';
import { ThemeProvider } from './ThemeProvider';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { api } from '../../convex/_generated/api';
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

export function ConvexClerkWrapper() {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <ThemeProvider>
        <ReportingErrorBoundary />
      </ThemeProvider>
    </ConvexProviderWithClerk>
  );
}