// Game session helpers. Atomic state-key writes go through the
// `game_set_state_key` RPC (migration 0007); whole-state writes use db.update.

import { db } from './db.js'

export async function fetchActiveSession(coupleId, gameType) {
  if (!coupleId) return null
  const { data, error } = await db.select('game_sessions', {
    match: { couple_id: coupleId, game_type: gameType },
    order: { column: 'updated_at', ascending: false },
    limit: 1,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] ?? null : data
}

export async function createSession(coupleId, gameType, state = {}) {
  const { data, error } = await db.insert('game_sessions', {
    couple_id: coupleId,
    game_type: gameType,
    state,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

// Atomic get-or-create — avoids the race where both partners hit createSession
// for the same daily_question day. Uses the security-definer RPC from migration 0011.
export async function getOrCreateSession(gameType, initialState) {
  const { data, error } = await db.rpc('game_get_or_create_session', {
    p_game_type: gameType,
    p_initial_state: initialState,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

// Atomic single-key write — safe under concurrent updates.
// keyPath is an array, e.g. ['answers', '<uid>']; value is anything JSON-serializable.
export async function setStateKey(sessionId, keyPath, value) {
  const { data, error } = await db.rpc('game_set_state_key', {
    p_session: sessionId,
    p_key: keyPath,
    p_value: value,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

// Whole-state write (use only when you intend to overwrite — e.g. advancing the WYR card).
export async function setSessionState(sessionId, state) {
  const { data, error } = await db.update('game_sessions', { state }, { match: { id: sessionId } })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

// ---------- daily question prompts ----------

export const DAILY_QUESTIONS = [
  'a small thing that made you smile this week',
  'one thing you\'d do together if money and time didn\'t matter',
  'a song that reminds you of us',
  'a memory from this year you keep going back to',
  'something you appreciate about them lately',
  'a meal you\'d want to share if we were together right now',
  'a small worry you\'ve had this week',
  'one good habit you want to keep going',
  'a place you want to take them someday',
  'what made today feel like today',
  'something you used to think was true and changed your mind about',
  'something you wish they knew without you having to say it',
  'the most "you" thing you did this week',
  'a moment when you missed them on purpose, not by accident',
]

export function todayISO() {
  // YYYY-MM-DD in local time, used as a per-day session key.
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function questionForDay(iso) {
  // Stable hash from the date string so both sides get the same prompt.
  let h = 0
  for (let i = 0; i < iso.length; i++) h = (h * 31 + iso.charCodeAt(i)) | 0
  return DAILY_QUESTIONS[Math.abs(h) % DAILY_QUESTIONS.length]
}

// ---------- WYR deck ----------

export const WYR_DECK = [
  { a: 'a cozy night in', b: 'a night out somewhere new' },
  { a: 'cook the same meal together over a video call', b: 'order each other dinner' },
  { a: 'beach trip', b: 'mountain trip' },
  { a: 'a long letter', b: 'a long voice note' },
  { a: 'an early start together', b: 'a late night together' },
  { a: 'a movie marathon', b: 'a series binge' },
  { a: 'a slow morning', b: 'an adventurous day' },
  { a: 'know each other\'s thoughts for a day', b: 'live each other\'s day' },
  { a: 'plan a surprise for them', b: 'be surprised by them' },
  { a: 'sing badly together', b: 'dance badly together' },
  { a: 'live somewhere new every year', b: 'one place forever' },
  { a: 'dogs', b: 'cats' },
  { a: 'spicy', b: 'sweet' },
  { a: 'never run out of books', b: 'never run out of songs' },
  { a: 'plan everything ahead', b: 'figure it out as you go' },
]
