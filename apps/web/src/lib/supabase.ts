import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

let browserClient: SupabaseClient | null = null;

export const isSupabaseBrowserConfigured = url.length > 0 && anonKey.length > 0;

/**
 * Browser client using the anon key only.
 * The service-role key must never be placed in a VITE_ variable.
 * A null return means credentials were not provided. It is not a failed connection.
 */
export function getBrowserSupabase(): SupabaseClient | null {
  if (!isSupabaseBrowserConfigured) return null;

  if (!browserClient) {
    browserClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return browserClient;
}
