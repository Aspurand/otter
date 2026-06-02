// Reunion countdown — rose gradient card with big d/h/m numbers.
// Hybrid tick (1s when ≤ 1h, 60s otherwise). Handles three phases:
//   1) upcoming → live countdown
//   2) happening now (started, not yet ended) → celebratory state, no numbers
//   3) ended → auto-refetch the next reunion in queue, so the card never
//      goes stale or shows "nothing scheduled" while a real reunion is
//      next in line.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchNextReunion, addReunion } from '../lib/events.js'
import { useWakeKey } from '../lib/wake.js'

const REUNION_GRACE_MS = 24 * 60 * 60 * 1000

export default function ReunionCountdown({ coupleId }) {
  const wakeKey = useWakeKey()
  const [reunion, setReunion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(() => new Date())

  const refetch = useCallback(() => {
    if (!coupleId) return
    fetchNextReunion(coupleId)
      .then((r) => { setReunion(r); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [coupleId])

  useEffect(() => {
    let alive = true
    fetchNextReunion(coupleId)
      .then((r) => { if (alive) { setReunion(r); setLoading(false) } })
      .catch((e) => { if (alive) { setError(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [coupleId, wakeKey])

  // Tick cadence: 1s in the final hour, 60s otherwise. Pauses when the tab is hidden
  // to save battery — App.jsx's wake handler will trigger refetch anyway.
  useEffect(() => {
    if (!reunion) return
    let timer = null
    function plan() {
      clearInterval(timer)
      if (document.visibilityState !== 'visible') return
      const startsAt = new Date(reunion.starts_at).getTime()
      const ms = startsAt - Date.now()
      if (ms <= 0) return // happening-now: re-fetch scheduler below handles it
      const interval = ms <= 3_600_000 ? 1_000 : 60_000
      setNow(new Date())
      timer = setInterval(() => {
        setNow(new Date())
        const remaining = startsAt - Date.now()
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

  // When the active reunion ends, auto-refetch the next one in queue.
  useEffect(() => {
    if (!reunion) return
    const startsAt = new Date(reunion.starts_at).getTime()
    const endsAt = reunion.ends_at ? new Date(reunion.ends_at).getTime() : startsAt + REUNION_GRACE_MS
    const ms = endsAt - Date.now()
    if (ms <= 0) {
      // Already over — refetch right away (will return next reunion or null).
      refetch()
      return
    }
    // Cap setTimeout to ~24 days (signed 32-bit limit) to avoid overflow.
    const safeMs = Math.min(ms + 1_000, 2_000_000_000)
    const id = setTimeout(refetch, safeMs)
    return () => clearTimeout(id)
  }, [reunion?.id, reunion?.ends_at, reunion?.starts_at, refetch, reunion])

  const breakdown = useMemo(() => {
    if (!reunion) return null
    const startsAt = new Date(reunion.starts_at).getTime()
    const endsAt = reunion.ends_at ? new Date(reunion.ends_at).getTime() : startsAt + REUNION_GRACE_MS
    const t = now.getTime()
    if (t >= endsAt) return { ended: true }
    if (t >= startsAt) return { happeningNow: true }
    const ms = startsAt - t
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

  // Phase 2: started but not ended → "happening now"
  if (reunion && breakdown?.happeningNow) {
    return (
      <section className="card reunion">
        <p className="card-label"><span className="dot" /> happening now</p>
        <p className="reunion-title" style={{ marginTop: 4 }}>{reunion.title} ✨</p>
        <p className="reunion-when">soak it in.</p>
      </section>
    )
  }

  // Phase 1: upcoming → live countdown
  if (reunion && !breakdown?.ended) {
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

  // Phase 3 / empty: editing or no reunion
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
