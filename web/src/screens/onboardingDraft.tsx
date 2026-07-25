import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { defaultAvatar, type AvatarConfig } from '../domain/avatar';
import { DEFAULT_COUNTRY } from '../domain/countries';
import type { Gender } from '../data/types';

const STORAGE_KEY = 'konji.onboarding.draft';

type Draft = {
  ageAttested: boolean;
  country: string;
  gender: Gender | null;
  genderPreference: Gender | null;
  avatar: AvatarConfig;
};

const EMPTY: Draft = {
  ageAttested: false,
  country: DEFAULT_COUNTRY,
  gender: null,
  genderPreference: null,
  avatar: defaultAvatar,
};

type DraftContextValue = {
  draft: Draft;
  patch: (next: Partial<Draft>) => void;
  reset: () => void;
};

const DraftContext = createContext<DraftContextValue | null>(null);

/**
 * Onboarding answers are mirrored into sessionStorage. On the web a mid-flow
 * refresh or an accidental back-navigation is common in a way it is not in a
 * native app, and losing three answered questions to it would be miserable.
 */
export function OnboardingDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      return raw ? { ...EMPTY, ...(JSON.parse(raw) as Draft) } : EMPTY;
    } catch {
      return EMPTY;
    }
  });

  const value = useMemo<DraftContextValue>(
    () => ({
      draft,
      patch: (next) =>
        setDraft((prev) => {
          const merged = { ...prev, ...next };
          try {
            window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {
            // Private browsing can refuse writes; the flow still works in memory.
          }
          return merged;
        }),
      reset: () => {
        setDraft(EMPTY);
        try {
          window.sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          // Nothing to clean up if the write never landed.
        }
      },
    }),
    [draft],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useDraft must be used inside an OnboardingDraftProvider');
  return ctx;
}
