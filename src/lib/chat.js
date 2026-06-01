// Chat data layer. Realtime subscriptions are set up in pages/Chat.jsx itself
// (they need the component lifecycle); this file only handles persistence.

import { db } from './db.js'
import { supabase } from './supabase.js'

// Fetch a page of messages, newest first. Caller reverses for display.
// Pass `before` (ISO string) to paginate further back in time.
export async function fetchMessages(coupleId, { before = null, limit = 50 } = {}) {
  if (!coupleId) return []
  const opts = {
    match: { couple_id: coupleId },
    order: { column: 'created_at', ascending: false },
    limit,
  }
  if (before) opts.lt = { created_at: before }
  const { data, error } = await db.select('messages', opts)
  if (error) throw error
  return data ?? []
}

export async function sendMessage(coupleId, { kind = 'text', body, mediaUrl = null }) {
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess.session?.user?.id
  if (!uid) throw new Error('not authenticated')
  const { data, error } = await db.insert('messages', {
    couple_id: coupleId,
    sender_id: uid,
    kind,
    body,
    media_url: mediaUrl,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

// Mark a set of messages as read at `now`. RLS allows updates within the couple;
// callers should only pass ids of partner-sent messages.
export async function markRead(messageIds) {
  if (!messageIds?.length) return
  const now = new Date().toISOString()
  const { error } = await db.update('messages', { read_at: now }, { match: { id: messageIds } })
  if (error) throw error
}
