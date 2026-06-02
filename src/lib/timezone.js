// Timezone formatting helpers for the presence bar.

export function formatLocalTime(tz, date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date)
  } catch {
    return '—'
  }
}

export function getLocalHour(tz, date = new Date()) {
  try {
    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    }).format(date)
    const h = parseInt(hourStr, 10)
    return Number.isFinite(h) ? h : null
  } catch {
    return null
  }
}

export function tzOffsetLabel(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date())
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? tz
  } catch {
    return tz
  }
}

// Friendly nickname for an IANA timezone — "Los_Angeles" → "Los Angeles".
export function tzNickname(tz) {
  if (!tz) return ''
  const parts = String(tz).split('/')
  return (parts[parts.length - 1] || tz).replace(/_/g, ' ')
}

// Full datetime formatted in a specific tz, e.g. "Mon Jun 2, 11:00 PM".
// Returned with no tz label so the caller can pair it with tzNickname/tzOffsetLabel as desired.
export function formatInTimezone(tz, date) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date instanceof Date ? date : new Date(date))
  } catch {
    return '—'
  }
}

// "5 min ago" / "3h ago" / "2d ago" — for the partner-offline case.
export function relativeAgo(iso) {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  const s = Math.floor(ms / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
