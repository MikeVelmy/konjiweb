import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeName = 'dark' | 'light';

const STORAGE_KEY = 'konji.theme';

type ThemeContextValue = {
  /** null means "follow the OS", which is the default until the user picks. */
  preference: ThemeName | null;
  resolved: ThemeName;
  setPreference: (next: ThemeName | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): ThemeName {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemeName | null>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  });
  const [system, setSystem] = useState<ThemeName>(systemTheme);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystem(query.matches ? 'light' : 'dark');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    // The CSS keeps a system-preference fallback for when no explicit choice has
    // been made, so the attribute is removed rather than pinned in that case.
    if (preference) document.documentElement.setAttribute('data-theme', preference);
    else document.documentElement.removeAttribute('data-theme');
  }, [preference]);

  const setPreference = useCallback((next: ThemeName | null) => {
    setPreferenceState(next);
    if (next) window.localStorage.setItem(STORAGE_KEY, next);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved: preference ?? system, setPreference }),
    [preference, system, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside a ThemeProvider');
  return ctx;
}
