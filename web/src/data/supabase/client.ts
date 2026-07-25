import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when the app has been pointed at a real Supabase project. */
export const hasSupabaseConfig = Boolean(url && anonKey);

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!hasSupabaseConfig) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, ' +
        'or leave them unset to run on the mock backend.',
    );
  }
  if (!cached) {
    cached = createClient(url!, anonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        // Unlike the native build, the browser does have a URL to parse an auth
        // callback out of, so this stays on.
        detectSessionInUrl: true,
      },
    });
  }
  return cached;
}
