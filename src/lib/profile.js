// Profile mutations + timezone detection.

import { db } from './db.js'
import { supabase } from './supabase.js'

export async function updateMyProfile(patch) {
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess.session?.user?.id
  if (!uid) throw new Error('not authenticated')
  const { data, error } = await db.update('profiles', patch, { match: { id: uid } })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

// Mark a throwback memory as "seen" by this user, so the Us tab badge clears
// across the user's other devices too.
export async function markThrowbackSeen(memoryId) {
  if (!memoryId) return
  return updateMyProfile({ last_seen_throwback_id: memoryId })
}

export function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
