import { useConvexAuth } from '@convex-dev/auth/react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
  emailVerified: boolean;
}

/**
 * The signed-in user's profile, sourced from the Convex Auth `users` table
 * (the same `users.me` query feeds the harness stubs). `user` is `null`
 * while signed out and `undefined` while the profile query is loading.
 */
export function useCurrentUser(): {
  user: CurrentUser | null | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
} {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.core.users.me);
  return {
    user: (me as CurrentUser | null | undefined) ?? null,
    isAuthenticated,
    isLoading,
  };
}
