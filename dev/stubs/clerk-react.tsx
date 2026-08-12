/* eslint-disable */
// Harness-only stub for `@clerk/react`.
import type { JSX } from 'react';

export const __user = {
  id: 'u_harness',
  firstName: 'Ada',
  lastName: null,
  fullName: 'Ada Lovelace',
};

export function useUser() {
  return { user: __user, isLoaded: true };
}

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: __user.id,
    getToken: async () => 'harness-token',
  };
}

export function ClerkProvider({ children }: { children?: unknown }) {
  return children as JSX.Element;
}

// The real app imports SignInButton (AuthScreen) and UserButton (Dashboard /
// Settings). Without these the whole module graph fails to link when the dev
// alias is active, so stub them as inert renders.
export function SignInButton({ children }: { children?: unknown }) {
  return children as JSX.Element;
}

export function UserButton() {
  return (
    <span
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--neutral-150)',
        color: 'var(--color-text-primary)',
        fontSize: 13,
        fontWeight: 700,
      }}
      aria-label="Account"
    >
      {__user.firstName?.[0] ?? 'U'}
    </span>
  );
}
