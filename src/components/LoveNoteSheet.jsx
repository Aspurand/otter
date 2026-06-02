// Compose a love note: optional schedule for future delivery.
// Immediate notes use kind='thinking_of_you'; scheduled ones use kind='love_note'
// with delivered=false until the pg_cron job flips it.

import { useMemo, useState } from 'react'
import { sendNudge } from '../lib/nudges.js'
import { formatInTimezone, tzNickname, tzOffsetLabel } from '../lib/timezone.js'

function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function LoveNoteSheet({ coupleId, onClose, onSent, initialBody = '', profile, partner }) {
  const [body, setBody] = useState(initialBody)
  const [later, setLater] = useState(false)
  const [when, setWhen] = useState(() => toLocalInput(new Date(Date.now() + 6 * 3_600_000)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Same instant, two perspectives.
  const previews = useMemo(() => {
    if (!when) return null
    const d = new Date(when) // datetime-local is interpreted in the BROWSER's local tz
    if (Number.isNaN(d.getTime())) return null
    return {
      mine:    profile?.timezone ? { label: formatInTimezone(profile.timezone, d), tz: tzNickname(profile.timezone), off: tzOffsetLabel(profile.timezone) } : null,
      theirs:  partner?.timezone ? { label: formatInTimezone(partner.timezone, d), tz: tzNickname(partner.timezone), off: tzOffsetLabel(partner.timezone) } : null,
    }
  }, [when, profile, partner])

  async function onSubmit(e) {
    e.preventDefault()
    const text = body.trim()
    if (!text || busy) return
    setBusy(true); setError(null)
    try {
      await sendNudge(coupleId, {
        kind: later ? 'love_note' : 'thinking_of_you',
        body: text,
        deliverAt: later ? new Date(when).toISOString() : null,
      })
      onSent?.(later)
    } catch (e) { setError(e.message); setBusy(false) }
  }

  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <h2>a love note</h2>
        <div className="field">
          <label>what's on your heart</label>
          <textarea
            autoFocus
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="say the thing you'd say if they were here…"
          />
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={later} onChange={(e) => setLater(e.target.checked)} />
          <span>deliver later — surprise them at a perfect moment</span>
        </label>
        {later && (
          <>
            <div className="field">
              <label>arrives at</label>
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
            </div>
            {previews && (previews.mine || previews.theirs) && (
              <div className="tz-preview">
                {previews.mine && (
                  <div className="tz-row">
                    <span className="tz-side">you</span>
                    <span className="tz-when">{previews.mine.label}</span>
                    <span className="tz-where">{previews.mine.tz} · {previews.mine.off}</span>
                  </div>
                )}
                {previews.theirs && (
                  <div className="tz-row partner">
                    <span className="tz-side">{partner?.display_name ?? 'them'}</span>
                    <span className="tz-when">{previews.theirs.label}</span>
                    <span className="tz-where">{previews.theirs.tz} · {previews.theirs.off}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        <button className="btn primary full" type="button" disabled={!body.trim() || busy} onClick={onSubmit}>
          {busy ? 'sending…' : (later ? 'schedule it 💌' : 'send it ♥')}
        </button>
        {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
      </div>
    </div>
  )
}
