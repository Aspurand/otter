// Quick-tap activity catalog. `key` is what gets persisted to profiles.activity
// so labels + emoji can change without a migration.
//
// `status` (optional) is what the 4-state presence dot auto-flips to when you
// pick this activity — so 'travelling' nudges you to 'away', 'bedtime' to
// 'asleep', most things to 'busy'. 'missing' is the only free-leaning one.

export const ACTIVITIES = [
  { key: 'movie',    label: 'watching a movie', emoji: '🎬', status: 'busy'   },
  { key: 'reeling',  label: 'reeling',          emoji: '📱', status: 'busy'   },
  { key: 'working',  label: 'working',          emoji: '💼', status: 'busy'   },
  { key: 'meeting',  label: 'in a meeting',     emoji: '📞', status: 'busy'   },
  { key: 'family',   label: 'family time',      emoji: '👨‍👩‍👧', status: 'busy' },
  { key: 'me',       label: 'me time',          emoji: '🧘', status: 'busy'   },
  { key: 'reading',  label: 'reading',          emoji: '📖', status: 'busy'   },
  { key: 'building', label: 'building',         emoji: '🔨', status: 'busy'   },
  { key: 'gaming',   label: 'gaming',           emoji: '🎮', status: 'busy'   },
  { key: 'eating',   label: 'eating',           emoji: '🍽️', status: 'busy'  },
  { key: 'workout',  label: 'workout',          emoji: '🏋️', status: 'busy'  },
  { key: 'travel',   label: 'travelling',       emoji: '✈️', status: 'away'  },
  { key: 'missing',  label: 'missing you',      emoji: '💭', status: 'free'   },
  { key: 'bedtime',  label: 'bedtime',          emoji: '🌙', status: 'asleep' },
]

const BY_KEY = Object.fromEntries(ACTIVITIES.map((a) => [a.key, a]))
export const getActivity = (key) => (key ? BY_KEY[key] ?? null : null)

export const ACTIVITY_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

// True if `setAt` is recent enough that the activity should still be shown.
export function isActivityFresh(setAtIso) {
  if (!setAtIso) return false
  const ms = Date.now() - new Date(setAtIso).getTime()
  return Number.isFinite(ms) && ms >= 0 && ms < ACTIVITY_TTL_MS
}
