import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Supabase client singleton. All data access goes through the query hooks in
// src/lib/queries (which call getSupabase()) and the AuthProvider.
//
// The anon key is safe to ship to the browser — Row Level Security (see
// supabase/migrations/) enforces what the anon role can read/write. See SETUP.md
// for configuring VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!url || !anonKey) {
      throw new Error(
        'Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env ' +
          '(see .env.example). The kiosk runs on mock data until the query hooks are switched over.',
      )
    }
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}
