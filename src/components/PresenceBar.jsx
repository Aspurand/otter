// Two pcards side-by-side: you on the left, partner on the right (gradient).
// Status chips live in the user's own card.

import { useEffect, useMemo, useState } from 'react'
import { formatLocalTime, getLocalHour, tzOffsetLabel, relativeAgo } from '../lib/timezone.js'
import { updateMyProfile } from '../lib/profile.js'

const STATUSES = [
  { key: 'free',   label: 'free',   color: '#2f7a4e' },
  { key: 'busy',   label: 'busy',   color: '#c97a2f' },
  { key: 'asleep', label: 'asleep', color: '#5a4eb8' },
  { key: 'away',   label: 'away',   color: '#9a8e95' },
]

const STATUS_META = Object.fromEntries(STATUSES.map((s) => [s.key, s]))

export default function PresenceBar({ profile, partner, presence = {}, onStatusChange }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const myMeta = STATUS_META[profile.status] ?? STATUSES[0]
  const partnerOnline = partner && !!presence[partner.id]
  const partnerStatus = (partnerOnline ? presence[partner.id]?.status : null) ?? partner?.status ?? 'free'
  const partnerMeta = STATUS_META[partnerStatus] ?? STATUSES[0]

  async function setMyStatus(s) {
    if (s === profile.status) return
    const prev = profile.status
    onStatusChange?.(s) // optimistic local update
    try {
      await updateMyProfile({ status: s, last_active: new Date().toISOString() })
    } catch (e) {
      console.error('status update failed', e)
      // Only roll back if the user hasn't moved on to yet another status in the meantime.
      // Otherwise we'd clobber a more recent in-flight choice.
      if (profile.status === s) onStatusChange?.(prev)
    }
  }

  const myTime = formatTimeParts(profile.timezone, now)
  const theirTime = partner ? formatTimeParts(partner.timezone, now) : { hm: '—', ampm: '' }

  const partnerHint = useMemo(() => {
    if (!partner) return null
    if (partnerOnline) return 'online now'
    const ago = relativeAgo(partner.last_active)
    return ago ? `last seen ${ago}` : 'offline'
  }, [partner, partnerOnline])

  const reachoutHint = useMemo(() => {
    if (!partner) return null
    const hour = getLocalHour(partner.timezone, now)
    if (partnerStatus === 'asleep' || (hour != null && (hour >= 23 || hour < 6))) return 'asleep — let them rest'
    if (partnerStatus === 'busy') return 'heads-down right now'
    if (partnerStatus === 'away') return 'away from their phone'
    return 'a good moment to say hi'
  }, [partner, partnerStatus, now])

  return (
    <section className="presence">
      <div className="pcard">
        <div className="pname" style={{ color: myMeta.color }}>
          <span className="dot" style={{ background: myMeta.color, color: myMeta.color }} />
          <span style={{ color: 'var(--muted)' }}>you</span>
        </div>
        <div className="ptime">
          {myTime.hm}<span className="ampm">{myTime.ampm}</span>
        </div>
        <div className="pmeta">{tzOffsetLabel(profile.timezone)} · {myMeta.label}</div>
        <div className="status-row" role="group" aria-label="set my status">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`chip ${profile.status === s.key ? 'on' : ''}`}
              onClick={() => setMyStatus(s.key)}
            >{s.label}</button>
          ))}
        </div>
      </div>

      <div className="pcard partner">
        <div className="pname">
          <span className="dot" style={{ background: partnerMeta.color, color: partnerMeta.color }} />
          <span>{partner?.display_name ?? 'partner'}</span>
        </div>
        {partner ? (
          <>
            <div className="ptime">{theirTime.hm}<span className="ampm">{theirTime.ampm}</span></div>
            <div className="pmeta">{tzOffsetLabel(partner.timezone)} · {partnerHint}</div>
            <div className="phint">
              <span>♥</span> {reachoutHint}
            </div>
          </>
        ) : (
          <div className="pmeta">waiting for them to join…</div>
        )}
      </div>
    </section>
  )
}

function formatTimeParts(tz, now) {
  const full = formatLocalTime(tz, now) // e.g. "4:03 PM"
  const m = full.match(/^(\d{1,2}:\d{2})\s*(AM|PM)$/i)
  if (!m) return { hm: full, ampm: '' }
  return { hm: m[1], ampm: m[2].toLowerCase() }
}
