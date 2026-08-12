import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useConvexAuth } from 'convex/react';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorScreen } from './components/ErrorScreen';
import { AuthScreen } from './screens/AuthScreen';

const Landing = lazy(() => import('./landing/Landing').then((m) => ({ default: m.Landing })));
const Dashboard = lazy(() => import('./screens/Dashboard').then((m) => ({ default: m.Dashboard })));
const RoomScreen = lazy(() => import('./screens/RoomScreen').then((m) => ({ default: m.RoomScreen })));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })));
const BillingScreen = lazy(() => import('./screens/BillingScreen').then((m) => ({ default: m.BillingScreen })));
const InviteScreen = lazy(() => import('./screens/InviteScreen').then((m) => ({ default: m.InviteScreen })));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) return <LoadingScreen label="Checking your session" />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) return <LoadingScreen label="Checking your session" />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function Screen({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingScreen label="Preparing your workspace" />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={
        <PublicRoute>
          <AuthScreen />
        </PublicRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Screen><Dashboard /></Screen>
        </ProtectedRoute>
      } />
      <Route path="/room/:roomId" element={
        <ProtectedRoute>
          <Screen><RoomScreen /></Screen>
        </ProtectedRoute>
      } />
      <Route path="/invite/:token" element={
        <ProtectedRoute>
          <Screen><InviteScreen /></Screen>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Screen><SettingsScreen /></Screen>
        </ProtectedRoute>
      } />
      <Route path="/billing" element={
        <ProtectedRoute>
          <Screen><BillingScreen /></Screen>
        </ProtectedRoute>
      } />
      <Route path="/error" element={<ErrorScreen />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}