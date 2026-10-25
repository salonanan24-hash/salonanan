import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let adminClient: SupabaseClient | null = null;

/**
 * True only when both URL and service-role key are present.
 * This does not open a connection and does not prove the project is reachable.
 */
export function isSupabaseConfigured(): boolean {
  return config.supabaseUrl.length > 0 && config.supabaseServiceRoleKey.length > 0;
}

/** Server-only client. Never import this module from the web app. */
export function getSupabaseAdmin(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }

  if (!adminClient) {
    adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClient;
}
