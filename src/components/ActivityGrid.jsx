// Quick-tap activity grid. Each tile fires a single update: sets profile.activity,
// stamps activity_at, and (for activities that map cleanly) also flips the 4-state
// status so the dot reflects reality. Tapping the currently-active tile clears it.

import { useState } from 'react'
import { ACTIVITIES, isActivityFresh } from '../lib/activities.js'
import { setActivity, clearActivity } from '../lib/profile.js'

export default function ActivityGrid({ profile, onPatchProfile }) {
  const [busy, setBusy] = useState(false)
  const active = isActivityFresh(profile.activity_at) ? profile.activity : null

  async function pick(a) {
    if (busy) return
    setBusy(true)
    try {
      if (active === a.key) {
        // tapping the currently-active tile clears it
        const updated = await clearActivity()
        onPatchProfile({ activity: null, activity_at: null, ...updated })
      } else {
        const updated = await setActivity(a.key, a.status)
        onPatchProfile({
          activity: a.key,
          activity_at: new Date().toISOString(),
          status: a.status ?? profile.status,
          ...updated,
        })
      }
    } catch (e) {
      console.error('activity update failed', e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card activity-card">
      <p className="card-label">
        <span className="dot" /> what you're up to
        {active && <button type="button" className="activity-clear" onClick={() => pick({ key: active })}>clear</button>}
      </p>
      <div className="activity-grid">
        {ACTIVITIES.map((a) => (
          <button
            key={a.key}
            type="button"
            className={`activity-tile ${active === a.key ? 'on' : ''}`}
            onClick={() => pick(a)}
            disabled={busy}
            aria-pressed={active === a.key}
            title={a.label}
          >
            <span className="activity-emoji" aria-hidden>{a.emoji}</span>
            <span className="activity-label">{a.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
