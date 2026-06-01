// Memories album. Media lives in the private `memories` storage bucket at
// path `<coupleId>/<uuid>.<ext>`; the db row stores the path, and we mint
// signed URLs on read.

import { db } from './db.js'
import { supabase } from './supabase.js'

const BUCKET = 'memories'
const URL_TTL_SECONDS = 60 * 60 * 4 // 4 hours

async function uid() {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('not authenticated')
  return id
}

// Newest-first list. happened_at takes precedence; falls back to created_at via the
// `memories_couple_happened_idx` index defined in migration 0001.
export async function fetchMemories(coupleId, { limit = 100 } = {}) {
  if (!coupleId) return []
  const { data, error } = await db.select('memories', {
    match: { couple_id: coupleId },
    order: { column: 'happened_at', ascending: false },
    limit,
  })
  if (error) throw error
  return data ?? []
}

// Generate signed URLs for every photo/voice memory in one batch.
export async function attachSignedUrls(memories) {
  const paths = memories.filter((m) => m.media_url).map((m) => m.media_url)
  if (!paths.length) return memories
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, URL_TTL_SECONDS)
  if (error) throw error
  const map = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
  return memories.map((m) => (m.media_url ? { ...m, signed_url: map.get(m.media_url) ?? null } : m))
}

export async function uploadMedia(coupleId, file) {
  const ext = (file.name?.split('.').pop() || 'bin').toLowerCase()
  const id = (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) + '-' + Date.now()
  const path = `${coupleId}/${id}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw error
  return path
}

export async function createMemory(coupleId, { kind, caption = null, happenedAt = null, mediaUrl = null }) {
  const me = await uid()
  const row = {
    couple_id: coupleId,
    created_by: me,
    kind,
    caption,
    media_url: mediaUrl,
    happened_at: happenedAt ? new Date(happenedAt).toISOString() : new Date().toISOString(),
  }
  const { data, error } = await db.insert('memories', row)
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

export async function deleteMemory(memory) {
  if (memory.media_url) {
    // Best-effort storage cleanup; row deletion is the source of truth.
    await supabase.storage.from(BUCKET).remove([memory.media_url]).catch(() => {})
  }
  const { error } = await db.remove('memories', { match: { id: memory.id } })
  if (error) throw error
}
