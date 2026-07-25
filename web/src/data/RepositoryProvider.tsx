import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { AvatarConfig } from '../domain/avatar';
import { MockRepository } from './mock/mockRepository';
import type { Repository } from './repository';
import { hasSupabaseConfig } from './supabase/client';
import { SupabaseRepository } from './supabase/supabaseRepository';
import type { OnboardingInput, Profile } from './types';

type SessionContextValue = {
  repo: Repository;
  /** Which implementation is live — surfaced in Settings so it is never ambiguous. */
  backend: 'mock' | 'supabase';
  profile: Profile | null;
  loading: boolean;
  onboard: (input: OnboardingInput) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateAvatar: (avatar: AvatarConfig) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Picks the backend once, at startup. With no Supabase environment variables
 * set the app runs entirely on the in-memory mock, so the deployed site is
 * fully explorable before a project has been provisioned.
 */
function createRepository(): { repo: Repository; backend: 'mock' | 'supabase' } {
  if (hasSupabaseConfig) {
    try {
      return { repo: new SupabaseRepository(), backend: 'supabase' };
    } catch {
      return { repo: new MockRepository(), backend: 'mock' };
    }
  }
  return { repo: new MockRepository(), backend: 'mock' };
}

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const [{ repo, backend }] = useState(createRepository);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const userId = await repo.getCurrentUserId();
    setProfile(userId ? await repo.getProfile(userId) : null);
  }, [repo]);

  useEffect(() => {
    refreshProfile().finally(() => setLoading(false));
  }, [refreshProfile]);

  const value = useMemo<SessionContextValue>(
    () => ({
      repo,
      backend,
      profile,
      loading,
      onboard: async (input) => setProfile(await repo.completeOnboarding(input)),
      refreshProfile,
      updateAvatar: async (avatar) => setProfile(await repo.updateAvatar(avatar)),
      signOut: async () => {
        await repo.signOut();
        setProfile(null);
      },
    }),
    [repo, backend, profile, loading, refreshProfile],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside a RepositoryProvider');
  return ctx;
}

export function useRepository() {
  return useSession().repo;
}
