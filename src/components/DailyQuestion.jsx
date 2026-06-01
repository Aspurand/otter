import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import {
  getOrCreateSession,
  setStateKey,
  questionForDay,
  todayISO,
} from '../lib/games.js'

export default function DailyQuestion({ profile, partner }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const today = todayISO()
        const s = await getOrCreateSession('daily_question', {
          day: today,
          prompt: questionForDay(today),
          answers: {},
        })
        if (alive) { setSession(s); setDraft('') }
      } catch (e) { if (alive) setError(e.message) }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [profile.couple_id])

  useEffect(() => {
    if (!profile.couple_id) return
    const ch = supabase
      .channel(`game-dq:${profile.couple_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `couple_id=eq.${profile.couple_id}` },
        (payload) => {
          if (payload.new?.game_type !== 'daily_question') return
          setSession(payload.new ?? null)
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile.couple_id])

  if (loading) return <p className="hint">loading…</p>
  if (!session) return <p className="error">{error ?? 'no session'}</p>

  const answers = session.state?.answers ?? {}
  const myAnswer = answers[profile.id]
  const partnerAnswer = partner ? answers[partner.id] : null
  const bothIn = !!myAnswer && !!partnerAnswer

  async function onSubmit(e) {
    e.preventDefault()
    if (!draft.trim()) return
    setSubmitting(true); setError(null)
    try {
      const updated = await setStateKey(session.id, ['answers', profile.id], draft.trim())
      setSession(updated)
      setDraft('')
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  return (
    <>
      <p className="q-counter">today's question</p>
      <section className="card q-card">
        <p className="q-prompt">{session.state?.prompt}</p>
      </section>

      {!myAnswer ? (
        <>
          <textarea
            className="answer-box"
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`your answer (${partner?.display_name ?? 'they'} can't see it until you both reply)…`}
          />
          <button className="btn primary full" type="button" disabled={submitting || !draft.trim()} onClick={onSubmit}>
            {submitting ? 'sending…' : 'send my answer'}
          </button>
        </>
      ) : !bothIn ? (
        <div className="card">
          <div className="waiting"><span className="pip" /><span className="pip" /><span className="pip" /></div>
          <p className="muted-note" style={{ marginTop: 8 }}>answer saved · waiting for {partner?.display_name ?? 'them'} to reply…</p>
        </div>
      ) : (
        <div className="reveal">
          <div className="card ans-card">
            <p className="ans-who">{profile.display_name ?? 'you'}</p>
            <p className="ans-text">{myAnswer}</p>
          </div>
          <div className="card ans-card" style={{ background: 'var(--accent-soft)', borderColor: 'transparent' }}>
            <p className="ans-who">{partner?.display_name ?? 'partner'}</p>
            <p className="ans-text">{partnerAnswer}</p>
          </div>
          <p className="muted-note">come back tomorrow for a new one 🤍</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </>
  )
}
