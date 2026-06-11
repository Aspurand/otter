// Calendar event helpers.

import { db } from './db.js'
import { supabase } from './supabase.js'

export const EVENT_TYPES = [
  { key: 'date',        label: 'date' },
  { key: 'call',        label: 'call' },
  { key: 'visit',       label: 'visit' },
  { key: 'anniversary', label: 'anniversary' },
]

// Implicit event duration when ends_at isn't set — used to know when an
// open-ended event should be considered "over" (drop it from the upcoming
// list / advance the reunion countdown to the next one).
const EVENT_GRACE_MS = 24 * 60 * 60 * 1000

// When an event is effectively over: its ends_at if set, else starts_at + grace.
export function eventEndMs(e) {
  if (e.ends_at) return new Date(e.ends_at).getTime()
  return new Date(e.starts_at).getTime() + EVENT_GRACE_MS
}

// The next reunion the countdown should show — either upcoming OR currently
// happening (started but not yet ended). Server filter is lenient (events
// that started in the last 7 days); the client picks the first whose
// effective end (ends_at, or starts_at + 24h grace) is still in the future.
export async function fetchNextReunion(coupleId) {
  if (!coupleId) return null
  const cutoff = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString()
  const { data, error } = await db.select('events', {
    match: { couple_id: coupleId, is_reunion: true },
    gt: { starts_at: cutoff },
    order: { column: 'starts_at', ascending: true },
    limit: 10,
  })
  if (error) throw error
  const now = Date.now()
  const rows = data ?? []
  for (const ev of rows) {
    if (eventEndMs(ev) > now) return ev
  }
  return null
}

// Future events (and currently happening), oldest -> newest. An event drops
// off once it's over: past its ends_at, or — when no end is set — 24h after
// it starts. The server filter is lenient (last 30 days) so long multi-day
// events that are still running aren't cut off; the client filters by
// effective end.
export async function fetchUpcoming(coupleId, { limit = 100 } = {}) {
  if (!coupleId) return []
  const cutoff = new Date(Date.now() - 30 * 24 * 3_600_000).toISOString()
  const { data, error } = await db.select('events', {
    match: { couple_id: coupleId },
    gt: { starts_at: cutoff },
    order: { column: 'starts_at', ascending: true },
    limit,
  })
  if (error) throw error
  const now = Date.now()
  return (data ?? []).filter((e) => eventEndMs(e) > now)
}

// Every event inside [fromIso, toIso) — feeds the month-grid dots, so it
// includes past days of the displayed month (unlike fetchUpcoming).
export async function fetchRange(coupleId, fromIso, toIso) {
  if (!coupleId) return []
  const { data, error } = await db.select('events', {
    match: { couple_id: coupleId },
    gte: { starts_at: fromIso },
    lt: { starts_at: toIso },
    order: { column: 'starts_at', ascending: true },
    limit: 200,
  })
  if (error) throw error
  return data ?? []
}

export async function fetchPast(coupleId, { limit = 50 } = {}) {
  if (!coupleId) return []
  const cutoff = new Date(Date.now() - 24 * 3_600_000).toISOString()
  const { data, error } = await db.select('events', {
    match: { couple_id: coupleId },
    lt: { starts_at: cutoff },
    order: { column: 'starts_at', ascending: false },
    limit,
  })
  if (error) throw error
  return data ?? []
}

async function uid() {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('not authenticated')
  return id
}

export async function createEvent(coupleId, { title, description = null, type = 'date', isReunion = false, startsAt, endsAt = null }) {
  const me = await uid()
  const { data, error } = await db.insert('events', {
    couple_id: coupleId,
    created_by: me,
    title,
    description,
    type,
    is_reunion: !!isReunion,
    starts_at: new Date(startsAt).toISOString(),
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

export async function updateEvent(id, patch) {
  const norm = { ...patch }
  if (norm.startsAt) { norm.starts_at = new Date(norm.startsAt).toISOString(); delete norm.startsAt }
  if (norm.endsAt !== undefined) { norm.ends_at = norm.endsAt ? new Date(norm.endsAt).toISOString() : null; delete norm.endsAt }
  if (norm.isReunion !== undefined) { norm.is_reunion = !!norm.isReunion; delete norm.isReunion }
  const { data, error } = await db.update('events', norm, { match: { id } })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

export async function deleteEvent(id) {
  const { error } = await db.remove('events', { match: { id } })
  if (error) throw error
}

// Back-compat helper kept for the small inline form on Home.
export async function addReunion(coupleId, { title, startsAt }) {
  return createEvent(coupleId, { title, type: 'visit', isReunion: true, startsAt })
}
