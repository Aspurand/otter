import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

// Single shared client. Auth + Realtime always go through the SDK.
// CRUD calls go through lib/db.js so we can swap to raw fetch if the SDK deadlocks.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: { params: { eventsPerSecond: 10 } },
})
