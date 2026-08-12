/* eslint-disable */
// Harness-only stub for `@convex-dev/auth/react`. Aliased by dev/vite.config.ts
// so the real app renders as if a user is signed in (mirroring the previous
// Clerk stub). `signIn` resolves as immediately-successful so any flow that
// awaits it behaves like a no-op server.
import type { JSX } from 'react';

export function useAuth() {
  return { isLoading: false, isAuthenticated: true };
}

export function useConvexAuth() {
  return { isLoading: false, isAuthenticated: true };
}

export function useAuthActions() {
  return {
    signIn: async () => ({ signingIn: true }),
    signOut: async () => {},
  };
}

export function useAuthToken() {
  return 'harness-token';
}

export function ConvexAuthProvider({ children }: { children?: unknown }) {
  return children as JSX.Element;
}
