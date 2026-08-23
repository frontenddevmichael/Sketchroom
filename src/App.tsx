import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useConvexAuth } from '@convex-dev/auth/react';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorScreen } from './components/ErrorScreen';
import { AuthScreen } from './screens/AuthScreen';
import { LegalScreen } from './screens/LegalScreen';
import { ScreenErrorBoundary } from './components/ScreenErrorBoundary';

const Landing = lazy(() => import('./landing/Landing').then((m) => ({ default: m.Landing })));
const Dashboard = lazy(() => import('./screens/Dashboard').then((m) => ({ default: m.Dashboard })));
const RoomScreen = lazy(() => import('./screens/RoomScreen').then((m) => ({ default: m.RoomScreen })));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })));
const BillingScreen = lazy(() => import('./screens/BillingScreen').then((m) => ({ default: m.BillingScreen })));
const InviteScreen = lazy(() => import('./screens/InviteScreen').then((m) => ({ default: m.InviteScreen })));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();
  if (isLoading) return <LoadingScreen label="Checking your session" />;
  if (!isAuthenticated) {
    // Preserve intent: send a signed-out user to sign-in with the page they
    // wanted, so an invite link (or any protected route) resumes where they
    // were headed instead of stranding them on the homepage.
    const next = location.pathname + location.search;
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();
  if (isLoading) return <LoadingScreen label="Checking your session" />;
  if (isAuthenticated) {
    // After a successful sign-in, return the user to the page they were
    // headed for (from ProtectedRoute) instead of always dumping them on the
    // dashboard. `next` is sanitized to stay within the app.
    const next = new URLSearchParams(location.search).get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      return <Navigate to={next} replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function Screen({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingScreen label="Preparing your workspace" />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={
        <ScreenErrorBoundary screenName="Landing">
          <Landing />
        </ScreenErrorBoundary>
      } />
      <Route path="/auth" element={
        <PublicRoute>
          <ScreenErrorBoundary screenName="Auth" recoveryActions={[
            { label: 'Back to Home', onClick: () => window.location.href = '/', variant: 'ghost' },
          ]}>
            <AuthScreen />
          </ScreenErrorBoundary>
        </PublicRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Screen>
            <ScreenErrorBoundary screenName="Dashboard" recoveryActions={[
              { label: 'Try Again', onClick: () => window.location.reload(), variant: 'primary' },
              { label: 'Sign Out', onClick: () => window.location.href = '/auth?logout=1', variant: 'ghost' },
            ]}>
              <Dashboard />
            </ScreenErrorBoundary>
          </Screen>
        </ProtectedRoute>
      } />
      <Route path="/room/:roomId" element={
        <ProtectedRoute>
          <Screen>
            <ScreenErrorBoundary screenName="Room" recoveryActions={[
              { label: 'Back to Dashboard', onClick: () => window.location.href = '/dashboard', variant: 'primary' },
              { label: 'Reload Room', onClick: () => window.location.reload(), variant: 'outline' },
            ]}>
              <RoomScreen />
            </ScreenErrorBoundary>
          </Screen>
        </ProtectedRoute>
      } />
      <Route path="/invite/:token" element={
        <ProtectedRoute>
          <Screen>
            <ScreenErrorBoundary screenName="Invite" recoveryActions={[
              { label: 'Back to Dashboard', onClick: () => window.location.href = '/dashboard', variant: 'primary' },
            ]}>
              <InviteScreen />
            </ScreenErrorBoundary>
          </Screen>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Screen>
            <ScreenErrorBoundary screenName="Settings" recoveryActions={[
              { label: 'Back to Dashboard', onClick: () => window.location.href = '/dashboard', variant: 'primary' },
              { label: 'Reload', onClick: () => window.location.reload(), variant: 'outline' },
            ]}>
              <SettingsScreen />
            </ScreenErrorBoundary>
          </Screen>
        </ProtectedRoute>
      } />
      <Route path="/billing" element={
        <ProtectedRoute>
          <Screen>
            <ScreenErrorBoundary screenName="Billing" recoveryActions={[
              { label: 'Back to Dashboard', onClick: () => window.location.href = '/dashboard', variant: 'primary' },
              { label: 'Reload', onClick: () => window.location.reload(), variant: 'outline' },
            ]}>
              <BillingScreen />
            </ScreenErrorBoundary>
          </Screen>
        </ProtectedRoute>
      } />
      <Route path="/error" element={<ErrorScreen />} />
      <Route path="/terms" element={<LegalScreen page="terms" />} />
      <Route path="/privacy" element={<LegalScreen page="privacy" />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}