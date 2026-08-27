import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useConvexAuth } from '@convex-dev/auth/react';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorScreen } from './components/ErrorScreen';
import { ScreenErrorBoundary } from './components/ScreenErrorBoundary';

const AuthScreen = lazy(() => import('./screens/AuthScreen').then((m) => ({ default: m.AuthScreen })));

const Landing = lazy(() => import('./landing/Landing').then((m) => ({ default: m.Landing })));
const Dashboard = lazy(() => import('./screens/Dashboard').then((m) => ({ default: m.Dashboard })));
const RoomScreen = lazy(() => import('./screens/RoomScreen').then((m) => ({ default: m.RoomScreen })));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })));
const BillingScreen = lazy(() => import('./screens/BillingScreen').then((m) => ({ default: m.BillingScreen })));
const InviteScreen = lazy(() => import('./screens/InviteScreen').then((m) => ({ default: m.InviteScreen })));
const NotFoundScreen = lazy(() => import('./screens/NotFoundScreen').then((m) => ({ default: m.NotFoundScreen })));
const LegalScreen = lazy(() => import('./screens/LegalScreen').then((m) => ({ default: m.LegalScreen })));

const ALLOWED_NEXT_PREFIXES = ['/room/', '/dashboard', '/settings', '/billing'];

function isSafeNext(next: string): boolean {
  if (!next.startsWith('/') || next.startsWith('//')) return false;
  return ALLOWED_NEXT_PREFIXES.some((prefix) => next.startsWith(prefix));
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();
  if (isLoading) return <LoadingScreen label="Checking your session" />;
  if (!isAuthenticated) {
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
    const next = new URLSearchParams(location.search).get('next');
    if (next && isSafeNext(next)) {
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
    <>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <Routes>
        <Route path="/" element={
          <ScreenErrorBoundary screenName="Landing" recoveryActions={[
            { label: 'Try Again', onClick: () => window.location.reload(), variant: 'primary' },
            { label: 'Back to Home', onClick: () => { window.location.href = '/'; }, variant: 'ghost' },
          ]}>
            <Landing />
          </ScreenErrorBoundary>
        } />
        <Route path="/auth" element={
          <PublicRoute>
            <ScreenErrorBoundary screenName="Auth" recoveryActions={[
              { label: 'Back to Home', onClick: () => { window.location.href = '/'; }, variant: 'ghost' },
            ]}>
              <main id="main-content">
                <AuthScreen />
              </main>
            </ScreenErrorBoundary>
          </PublicRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Screen>
              <ScreenErrorBoundary screenName="Dashboard" recoveryActions={[
                { label: 'Try Again', onClick: () => window.location.reload(), variant: 'primary' },
                { label: 'Sign Out', onClick: () => { window.location.href = '/auth?logout=1'; }, variant: 'ghost' },
              ]}>
                <main id="main-content">
                  <Dashboard />
                </main>
              </ScreenErrorBoundary>
            </Screen>
          </ProtectedRoute>
        } />
        <Route path="/room/:roomId" element={
          <ProtectedRoute>
            <Screen>
              <ScreenErrorBoundary screenName="Room" recoveryActions={[
                { label: 'Back to Dashboard', onClick: () => { window.location.href = '/dashboard'; }, variant: 'primary' },
                { label: 'Reload Room', onClick: () => window.location.reload(), variant: 'outline' },
              ]}>
                <main id="main-content">
                  <RoomScreen />
                </main>
              </ScreenErrorBoundary>
            </Screen>
          </ProtectedRoute>
        } />
        <Route path="/invite/:token" element={
          <ProtectedRoute>
            <Screen>
              <ScreenErrorBoundary screenName="Invite" recoveryActions={[
                { label: 'Back to Dashboard', onClick: () => { window.location.href = '/dashboard'; }, variant: 'primary' },
              ]}>
                <main id="main-content">
                  <InviteScreen />
                </main>
              </ScreenErrorBoundary>
            </Screen>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <Screen>
              <ScreenErrorBoundary screenName="Settings" recoveryActions={[
                { label: 'Back to Dashboard', onClick: () => { window.location.href = '/dashboard'; }, variant: 'primary' },
                { label: 'Reload', onClick: () => window.location.reload(), variant: 'outline' },
              ]}>
                <main id="main-content">
                  <SettingsScreen />
                </main>
              </ScreenErrorBoundary>
            </Screen>
          </ProtectedRoute>
        } />
        <Route path="/billing" element={
          <ProtectedRoute>
            <Screen>
              <ScreenErrorBoundary screenName="Billing" recoveryActions={[
                { label: 'Back to Dashboard', onClick: () => { window.location.href = '/dashboard'; }, variant: 'primary' },
                { label: 'Reload', onClick: () => window.location.reload(), variant: 'outline' },
              ]}>
                <main id="main-content">
                  <BillingScreen />
                </main>
              </ScreenErrorBoundary>
            </Screen>
          </ProtectedRoute>
        } />
        <Route path="/error" element={<ErrorScreen />} />
        <Route path="/terms" element={<LegalScreen page="terms" />} />
        <Route path="/privacy" element={<LegalScreen page="privacy" />} />
        <Route path="*" element={
          <Screen>
            <NotFoundScreen />
          </Screen>
        } />
      </Routes>
    </>
  );
}
