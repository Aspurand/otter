// Reunion countdown — rose gradient card with big d/h/m numbers.
// Inline "set the next one" form when none is scheduled.

import { useEffect, useMemo, useState } from 'react'
import { fetchNextReunion, addReunion } from '../lib/events.js'

export default function ReunionCountdown({ coupleId }) {
  const [reunion, setReunion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let alive = true
    fetchNextReunion(coupleId)
      .then((r) => { if (alive) { setReunion(r); setLoading(false) } })
      .catch((e) => { if (alive) { setError(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [coupleId])

  // Hybrid tick: 1s when ≤ 1 hour to go (so the final stretch shows live seconds),
  // 60s otherwise (cheap battery cost). Also pauses when the tab is hidden so a
  // backgrounded PWA isn't running timers for nothing — visibilitychange in App.jsx
  // re-fetches data the moment the tab comes back, so we won't show stale values.
  useEffect(() => {
    if (!reunion) return
    let timer = null
    function plan() {
      clearInterval(timer)
      if (document.visibilityState !== 'visible') return
      const ms = new Date(reunion.starts_at).getTime() - Date.now()
      if (ms <= 0) return
      const interval = ms <= 3_600_000 ? 1_000 : 60_000
      setNow(new Date()) // immediate refresh on (re)plan
      timer = setInterval(() => {
        setNow(new Date())
        // If we just crossed the 1h boundary, re-plan to switch cadences.
        const remaining = new Date(reunion.starts_at).getTime() - Date.now()
        const wantInterval = remaining <= 3_600_000 ? 1_000 : 60_000
        if (wantInterval !== interval) plan()
      }, interval)
    }
    plan()
    document.addEventListener('visibilitychange', plan)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', plan)
    }
  }, [reunion])

  const breakdown = useMemo(() => {
    if (!reunion) return null
    const ms = new Date(reunion.starts_at).getTime() - now.getTime()
    if (ms <= 0) return { past: true }
    const days  = Math.floor(ms / 86_400_000)
    const hours = Math.floor((ms % 86_400_000) / 3_600_000)
    const mins  = Math.floor((ms % 3_600_000) / 60_000)
    const secs  = Math.floor((ms % 60_000) / 1_000)
    return { days, hours, mins, secs, finalHour: ms <= 3_600_000 }
  }, [reunion, now])

  async function onAdd(e) {
    e.preventDefault()
    if (!title || !when) return
    setBusy(true); setError(null)
    try {
      const r = await addReunion(coupleId, { title, startsAt: when })
      setReunion(r)
      setEditing(false); setTitle(''); setWhen('')
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  if (loading) {
    return (
      <section className="card reunion">
        <p className="card-label"><span className="dot" /> counting down to</p>
        <p style={{ margin: 0, opacity: 0.85 }}>loading…</p>
      </section>
    )
  }

  if (reunion && !breakdown?.past) {
    const soon = breakdown.days <= 7
    return (
      <section className="card reunion">
        <p className="card-label"><span className="dot" /> counting down to</p>
        <div className="countdown">
          {breakdown.finalHour ? (
            <>
              <div className="cd-num"><strong>{String(breakdown.mins).padStart(2, '0')}</strong><span>min</span></div>
              <span className="cd-colon">:</span>
              <div className="cd-num"><strong>{String(breakdown.secs).padStart(2, '0')}</strong><span>sec</span></div>
            </>
          ) : (
            <>
              <div className="cd-num"><strong>{breakdown.days}</strong><span>days</span></div>
              <span className="cd-colon">:</span>
              <div className="cd-num"><strong>{String(breakdown.hours).padStart(2, '0')}</strong><span>hrs</span></div>
              <span className="cd-colon">:</span>
              <div className="cd-num"><strong>{String(breakdown.mins).padStart(2, '0')}</strong><span>min</span></div>
            </>
          )}
        </div>
        <p className="reunion-title">{reunion.title}</p>
        <p className="reunion-when">{new Date(reunion.starts_at).toLocaleString()}</p>
        {breakdown.finalHour
          ? <span className="reunion-soon">✨ almost there</span>
          : soon && <span className="reunion-soon">✨ so close now</span>}
      </section>
    )
  }

  if (editing) {
    return (
      <section className="card">
        <p className="card-label"><span className="dot" /> set the next reunion</p>
        <form className="stack" onSubmit={onAdd}>
          <label className="field">
            <span>what</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="reunion in lisbon" required />
          </label>
          <label className="field">
            <span>when</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
          </label>
          <div className="row">
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'saving…' : 'save'}</button>
            <button className="btn ghost" type="button" onClick={() => setEditing(false)} disabled={busy}>cancel</button>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      </section>
    )
  }

  return (
    <section className="card reunion">
      <p className="card-label"><span className="dot" /> next reunion</p>
      <p style={{ margin: '6px 0 10px', fontSize: 15, fontWeight: 600, opacity: 0.9 }}>nothing on the calendar yet.</p>
      <button className="reunion-cta" type="button" onClick={() => setEditing(true)}>set the next one →</button>
      {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
    </section>
  )
}
