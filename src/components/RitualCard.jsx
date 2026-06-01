// The "today's check-in" card: tap to send a short "I'm okay" / "goodnight"
// nudge to the partner. Shows their check-in state when it arrives.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { sendRitual, fetchMyRitualToday, fetchPartnerRitualToday } from '../lib/ritual.js'
import { relativeAgo } from '../lib/timezone.js'
import Icon from './Icon.jsx'

export default function RitualCard({ profile, partner, partnerStatus, pushToast }) {
  const [mine, setMine] = useState(null)       // most-recent own ritual today
  const [theirs, setTheirs] = useState(null)   // most-recent partner ritual today
  const [busy, setBusy] = useState(false)

  // Initial load — own + partner's today.
  useEffect(() => {
    if (!profile.couple_id) return
    let alive = true
    const partnerId = partner?.id ?? null
    Promise.all([
      fetchMyRitualToday(profile.couple_id, profile.id),
      partnerId ? fetchPartnerRitualToday(profile.couple_id, partnerId) : Promise.resolve(null),
    ]).then(([m, t]) => { if (alive) { setMine(m); setTheirs(t) } }).catch(() => {})
    return () => { alive = false }
  }, [profile.couple_id, profile.id, partner?.id])

  // Realtime — listen for ritual nudges from the partner.
  useEffect(() => {
    if (!profile.couple_id || !partner?.id) return
    const ch = supabase
      .channel(`ritual:${profile.couple_id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'nudges', filter: `couple_id=eq.${profile.couple_id}` },
        (payload) => {
          const n = payload.new
          if (n.sender_id !== partner.id) return
          if (n.kind !== 'okay' && n.kind !== 'goodnight') return
          setTheirs(n)
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile.couple_id, partner?.id])

  const partnerAsleep = partnerStatus === 'asleep'
  const kind = partnerAsleep ? 'goodnight' : 'okay'
  const done = !!mine
  const partnerHere = !!theirs

  async function onTap() {
    if (busy || done) return
    setBusy(true)
    try {
      const row = await sendRitual(profile.couple_id, kind)
      setMine(row)
      pushToast?.({
        emoji: kind === 'goodnight' ? '🌙' : '🤍',
        title: kind === 'goodnight' ? 'goodnight left for them' : 'they know you\'re okay',
        body: kind === 'goodnight' ? 'they\'ll see it the moment they wake' : 'sent right to their pocket',
      })
    } catch (e) { console.error('ritual send failed', e) }
    finally { setBusy(false) }
  }

  const subtitle = done
    ? (partnerHere ? `${partner?.display_name ?? 'they'} checked in · ${relativeAgo(theirs.created_at) ?? 'today'}` : 'waiting on their check-in')
    : (partnerAsleep ? 'tuck them in for when they wake' : 'one tap to let them know you\'re safe')

  return (
    <section className={`card ritual ${done ? 'done' : ''}`}>
      <div className="glow" aria-hidden>{partnerAsleep ? '🌙' : '☀️'}</div>
      <div className="rtext">
        <h3>{done ? 'you\'re both okay today' : (partnerAsleep ? 'leave a goodnight' : 'today\'s check-in')}</h3>
        <p>{subtitle}</p>
      </div>
      {!done ? (
        <button className="go" type="button" onClick={onTap} disabled={busy}>
          {partnerAsleep ? 'goodnight' : 'i\'m okay'}
        </button>
      ) : (
        <span className="go" style={{ background: 'var(--success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-label="done">
          <Icon name="check" size={16} stroke={3} />
        </span>
      )}
    </section>
  )
}
