/**
 * The one place the web build diverges from the native app's persistence.
 *
 * React Native uses AsyncStorage, which is promise-based; the browser has
 * localStorage, which is synchronous. This wrapper keeps the async shape so the
 * repository code ported from the native app needs no changes, and it degrades
 * to an in-memory map when storage is unavailable — private browsing on iOS
 * Safari throws on write rather than simply refusing it.
 */

const memory = new Map<string, string>();

function available(): boolean {
  try {
    const probe = '__konji_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const useLocalStorage = typeof window !== 'undefined' && available();

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (!useLocalStorage) return memory.get(key) ?? null;
    return window.localStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (!useLocalStorage) {
      memory.set(key, value);
      return;
    }
    window.localStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (!useLocalStorage) {
      memory.delete(key);
      return;
    }
    window.localStorage.removeItem(key);
  },
  async clear(): Promise<void> {
    if (!useLocalStorage) {
      memory.clear();
      return;
    }
    window.localStorage.clear();
  },
};
