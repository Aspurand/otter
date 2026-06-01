// Daily "I'm okay" / goodnight ritual. Uses the nudges table with new kinds.

import { db } from './db.js'
import { supabase } from './supabase.js'

export async function sendRitual(coupleId, kind = 'okay') {
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess.session?.user?.id
  if (!uid) throw new Error('not authenticated')
  const { data, error } = await db.insert('nudges', {
    couple_id: coupleId,
    sender_id: uid,
    kind,                  // 'okay' | 'goodnight'
    body: null,
    delivered: true,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

// Most-recent ritual nudge from the partner since local-day start.
export async function fetchPartnerRitualToday(coupleId, partnerId) {
  if (!coupleId || !partnerId) return null
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const since = todayStart.toISOString()
  const { data, error } = await db.select('nudges', {
    match: { couple_id: coupleId, sender_id: partnerId },
    gt: { created_at: since },
    order: { column: 'created_at', ascending: false },
    limit: 10,
  })
  if (error) throw error
  const row = (data ?? []).find((n) => n.kind === 'okay' || n.kind === 'goodnight')
  return row ?? null
}

// Most-recent ritual nudge from me since local-day start.
export async function fetchMyRitualToday(coupleId, myId) {
  if (!coupleId || !myId) return null
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const since = todayStart.toISOString()
  const { data, error } = await db.select('nudges', {
    match: { couple_id: coupleId, sender_id: myId },
    gt: { created_at: since },
    order: { column: 'created_at', ascending: false },
    limit: 10,
  })
  if (error) throw error
  const row = (data ?? []).find((n) => n.kind === 'okay' || n.kind === 'goodnight')
  return row ?? null
}
