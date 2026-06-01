import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import {
  getOrCreateSession,
  setStateKey,
  setSessionState,
  WYR_DECK,
} from '../lib/games.js'

export default function WouldYouRather({ profile, partner }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [advancing, setAdvancing] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const s = await getOrCreateSession('wyr', { index: 0, answers: {} })
        if (alive) setSession(s)
      } catch (e) { if (alive) setError(e.message) }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [profile.couple_id])

  useEffect(() => {
    if (!profile.couple_id) return
    const ch = supabase
      .channel(`game-wyr:${profile.couple_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `couple_id=eq.${profile.couple_id}` },
        (payload) => {
          if (payload.new?.game_type !== 'wyr') return
          setSession(payload.new ?? null)
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile.couple_id])

  if (loading) return <p className="hint">loading…</p>
  if (!session) return <p className="error">{error ?? 'no session'}</p>

  const idx = session.state?.index ?? 0
  const totalCards = WYR_DECK.length
  const done = idx >= totalCards
  const card = WYR_DECK[idx % totalCards]
  const answers = session.state?.answers ?? {}
  const mine = answers[profile.id]
  const theirs = partner ? answers[partner.id] : null
  const bothIn = !!mine && !!theirs
  const matched = bothIn && mine === theirs
  const partnerName = partner?.display_name ?? 'them'
  const myName = profile.display_name ?? 'you'

  async function pick(choice) {
    if (mine) return
    setError(null)
    try {
      const updated = await setStateKey(session.id, ['answers', profile.id], choice)
      setSession(updated)
    } catch (e) { setError(e.message) }
  }

  async function nextCard() {
    if (advancing) return
    setAdvancing(true); setError(null)
    try {
      const updated = await setSessionState(session.id, { index: idx + 1, answers: {} })
      setSession(updated)
    } catch (e) { setError(e.message) }
    finally { setAdvancing(false) }
  }

  async function restart() {
    setAdvancing(true); setError(null)
    try {
      const updated = await setSessionState(session.id, { index: 0, answers: {} })
      setSession(updated)
    } catch (e) { setError(e.message) }
    finally { setAdvancing(false) }
  }

  if (done) {
    return (
      <>
        <section className="card q-card" style={{ textAlign: 'center', padding: '34px 20px' }}>
          <div style={{ fontSize: 44 }}>🤍</div>
          <p className="q-prompt" style={{ fontSize: 20, marginTop: 8 }}>that's the deck for now</p>
          <p className="muted-note" style={{ marginTop: 6 }}>fresh either-ors drop tomorrow</p>
        </section>
        <button className="btn primary full" type="button" onClick={restart} disabled={advancing}>play again</button>
      </>
    )
  }

  return (
    <>
      <p className="q-counter">would you rather · {idx + 1} of {totalCards}</p>
      <div className="wyr">
        <WyrCard
          label={card.a}
          choice="a"
          selected={mine === 'a'}
          locked={!!mine}
          mineHere={mine === 'a' ? myName : null}
          theirsHere={bothIn && theirs === 'a' ? partnerName : null}
          onPick={pick}
        />
        <p className="wyr-or">or</p>
        <WyrCard
          label={card.b}
          choice="b"
          selected={mine === 'b'}
          locked={!!mine}
          mineHere={mine === 'b' ? myName : null}
          theirsHere={bothIn && theirs === 'b' ? partnerName : null}
          onPick={pick}
        />
      </div>

      {mine && !bothIn && (
        <p className="muted-note">you picked · waiting on {partnerName}…</p>
      )}
      {bothIn && (
        <>
          <div className="wyr-verdict">
            <span className="big">{matched ? '🤝' : '🌗'}</span>
            <span>{matched ? 'matched — of course you did' : 'opposites, and that\'s the fun'}</span>
          </div>
          <button className="btn primary full" type="button" onClick={nextCard} disabled={advancing}>
            {advancing ? 'next…' : 'next →'}
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </>
  )
}

function WyrCard({ label, choice, selected, locked, mineHere, theirsHere, onPick }) {
  return (
    <button
      type="button"
      className={`wyr-card ${selected ? 'on' : ''}`}
      onClick={() => !locked && onPick(choice)}
      disabled={locked && !selected}
    >
      <span>{label}</span>
      <span className="wyr-tags">
        {mineHere && <span className="wyr-tag you">{mineHere}</span>}
        {theirsHere && <span className="wyr-tag them">{theirsHere}</span>}
      </span>
    </button>
  )
}
