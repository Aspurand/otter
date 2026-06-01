// Watch-together: one row in watch_sessions tracks the current video + playback state
// for the couple. Both sides can drive playback; realtime sync keeps them in step.

import { db } from './db.js'
import { supabase } from './supabase.js'

async function uid() {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('not authenticated')
  return id
}

// Most recently updated session for the couple, or null.
export async function fetchCurrentSession(coupleId) {
  if (!coupleId) return null
  const { data, error } = await db.select('watch_sessions', {
    match: { couple_id: coupleId },
    order: { column: 'updated_at', ascending: false },
    limit: 1,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] ?? null : data
}

export async function startSession(coupleId, contentUrl) {
  const me = await uid()
  const { data, error } = await db.insert('watch_sessions', {
    couple_id: coupleId,
    host_id: me,
    content_url: contentUrl,
    is_playing: false,
    playback_position: 0,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

export async function updateSession(id, patch) {
  const norm = { ...patch, updated_at: new Date().toISOString() }
  const { data, error } = await db.update('watch_sessions', norm, { match: { id } })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

export async function endSession(id) {
  const { error } = await db.remove('watch_sessions', { match: { id } })
  if (error) throw error
}
