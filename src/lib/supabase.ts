import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Supabase client singleton. Present and ready, but the kiosk currently runs on
// mock data (see src/lib/mock), so the query hooks in src/lib/queries do not use
// this yet. When switching a hook from mock to Supabase, import `supabase` here.
//
// The anon key is safe to ship to the browser — Row Level Security (see
// supabase/migrations/0001_init.sql) enforces what the anon role can read/write.

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
    client = createClient(url, anonKey)
  }
  return client
}
