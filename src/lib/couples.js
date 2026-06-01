// Pairing RPCs. The DB functions are security-definer and enforce all invariants
// (auth required, one couple per user, 2-person cap).

import { db } from './db.js'
import { supabase } from './supabase.js'

// Returns { couple_id, invite_code } or throws.
export async function createCouple() {
  const { data, error } = await db.rpc('create_couple')
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return { coupleId: row.couple_id, inviteCode: row.invite_code }
}

// Returns the joined couple_id or throws (invalid code, already paired, couple full).
export async function joinCouple(code) {
  const { data, error } = await db.rpc('join_couple', { p_code: code })
  if (error) throw error
  return data
}

// My profile row (display_name, couple_id, etc.). null when missing.
export async function fetchMyProfile() {
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess.session?.user?.id
  if (!uid) return null
  const { data, error } = await db.select('profiles', { match: { id: uid }, limit: 1 })
  if (error) throw error
  return Array.isArray(data) ? data[0] ?? null : data
}

// Both profiles in my couple (self + partner). Empty when not yet paired.
export async function fetchCoupleProfiles(coupleId) {
  if (!coupleId) return []
  const { data, error } = await db.select('profiles', { match: { couple_id: coupleId } })
  if (error) throw error
  return data ?? []
}

// Couple row (mostly for the invite_code so we can resurface it on the home screen).
export async function fetchCouple(coupleId) {
  if (!coupleId) return null
  const { data, error } = await db.select('couples', { match: { id: coupleId }, limit: 1 })
  if (error) throw error
  return Array.isArray(data) ? data[0] ?? null : data
}
