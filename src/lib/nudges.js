// Nudge sending + unread persistence. Receive flow lives in App.jsx + UnreadNudges.

import { db } from './db.js'
import { supabase } from './supabase.js'

export async function sendNudge(coupleId, { kind = 'thinking_of_you', body = null, deliverAt = null } = {}) {
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess.session?.user?.id
  if (!uid) throw new Error('not authenticated')

  const now = new Date().toISOString()
  const row = {
    couple_id: coupleId,
    sender_id: uid,
    kind,
    body,
    deliver_at: deliverAt ?? now,
    delivered: !deliverAt, // immediate by default; scheduled love-notes set this false
  }
  const { data, error } = await db.insert('nudges', row)
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

// Unread nudges from partner (kinds the home surfaces as persistent cards).
// Ritual kinds (okay/goodnight) are excluded — RitualCard owns those.
export async function fetchUnreadFromPartner(coupleId, partnerId) {
  if (!coupleId || !partnerId) return []
  const { data, error } = await db.select('nudges', {
    match: { couple_id: coupleId, sender_id: partnerId, delivered: true },
    order: { column: 'created_at', ascending: false },
    limit: 50,
  })
  if (error) throw error
  return (data ?? []).filter(
    (n) => !n.read_at && (n.kind === 'thinking_of_you' || n.kind === 'love_note'),
  )
}

export async function markNudgeRead(nudgeId) {
  const { error } = await db.update(
    'nudges',
    { read_at: new Date().toISOString() },
    { match: { id: nudgeId } },
  )
  if (error) throw error
}
