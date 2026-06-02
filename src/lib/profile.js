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

// Set the current activity. Pass status=null to leave the 4-state alone, or a
// value to also flip status (e.g. 'travelling' → away, 'bedtime' → asleep).
export async function setActivity(activityKey, status = null) {
  const patch = {
    activity: activityKey || null,
    activity_at: activityKey ? new Date().toISOString() : null,
  }
  if (status) patch.status = status
  if (status || activityKey) patch.last_active = new Date().toISOString()
  return updateMyProfile(patch)
}

// Clearing an activity also resets the 4-state status to 'free'. Otherwise
// users who picked 'bedtime' (auto → asleep) then tapped clear get stranded as
// 'asleep' forever, and the mascot keeps showing sleepy. The whole point of
// "clearing" is "I'm available again."
export async function clearActivity() {
  return updateMyProfile({
    activity: null,
    activity_at: null,
    status: 'free',
    last_active: new Date().toISOString(),
  })
}

// Set/clear the nickname YOU use for your partner. Stored on YOUR profile,
// so each side independently chooses what to call the other.
export async function setPartnerNickname(nickname) {
  const v = (nickname ?? '').trim()
  return updateMyProfile({ partner_nickname: v || null })
}

export function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
