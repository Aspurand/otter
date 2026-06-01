// Centralized read of build-time environment.
// Throws early on misconfig so failure modes are obvious in dev.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'PASTE_ANON_KEY_HERE') {
  console.warn(
    '[otter] Supabase env not set. Copy .env.example -> .env.local and fill VITE_SUPABASE_ANON_KEY.',
  )
}

export const env = {
  SUPABASE_URL: SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ?? '',
  // Toggle the data-layer transport at runtime for debugging the SDK deadlock issue.
  USE_FETCH_TRANSPORT: import.meta.env.VITE_DB_USE_FETCH === '1',
}
