/* eslint-disable */
// Harness-only stub for `@convex-dev/auth/react`. Aliased by dev/vite.config.ts
// so the real app renders as if a user is signed in (mirroring the previous
// Clerk stub). `signIn` resolves as immediately-successful so any flow that
// awaits it behaves like a no-op server.
//
// Set `window.__sketchroomAuth = { isAuthenticated: false }` in a test to
// simulate a logged-out state; the default is authenticated.
//
// Set `window.__sketchroomAuthError = 'message'` before submitting a form
// to make `signIn` reject with that message.
import type { JSX } from 'react';

declare global {
  interface Window {
    __sketchroomAuth?: { isAuthenticated: boolean };
    __sketchroomAuthError?: string;
  }
}

function getAuth() {
  return window.__sketchroomAuth ?? { isAuthenticated: true };
}

export function useAuth() {
  return { isLoading: false, ...getAuth() };
}

export function useConvexAuth() {
  return { isLoading: false, ...getAuth() };
}

export function useAuthActions() {
  return {
    signIn: async (_provider: string, _params: Record<string, string>) => {
      const err = window.__sketchroomAuthError;
      if (err) {
        delete window.__sketchroomAuthError;
        throw new Error(err);
      }
      window.__sketchroomAuth = { isAuthenticated: true };
      return { signingIn: false };
    },
    signOut: async () => {
      window.__sketchroomAuth = { isAuthenticated: false };
    },
  };
}

export function useAuthToken() {
  return 'harness-token';
}

export function ConvexAuthProvider({ children }: { children?: unknown }) {
  return children as JSX.Element;
}
