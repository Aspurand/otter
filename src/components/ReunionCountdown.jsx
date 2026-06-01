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

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const breakdown = useMemo(() => {
    if (!reunion) return null
    const ms = new Date(reunion.starts_at).getTime() - now.getTime()
    if (ms <= 0) return { past: true }
    const days = Math.floor(ms / 86_400_000)
    const hours = Math.floor((ms % 86_400_000) / 3_600_000)
    const mins  = Math.floor((ms % 3_600_000) / 60_000)
    return { days, hours, mins }
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
          <div className="cd-num"><strong>{breakdown.days}</strong><span>days</span></div>
          <span className="cd-colon">:</span>
          <div className="cd-num"><strong>{String(breakdown.hours).padStart(2, '0')}</strong><span>hrs</span></div>
          <span className="cd-colon">:</span>
          <div className="cd-num"><strong>{String(breakdown.mins).padStart(2, '0')}</strong><span>min</span></div>
        </div>
        <p className="reunion-title">{reunion.title}</p>
        <p className="reunion-when">{new Date(reunion.starts_at).toLocaleString()}</p>
        {soon && <span className="reunion-soon">✨ so close now</span>}
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
