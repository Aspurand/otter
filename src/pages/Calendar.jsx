import { useEffect, useMemo, useState } from 'react'
import {
  fetchUpcoming,
  createEvent,
  updateEvent,
  deleteEvent,
  EVENT_TYPES,
} from '../lib/events.js'
import Icon from '../components/Icon.jsx'

const TYPE_EMOJI = { call: '📞', date: '🍝', visit: '✈️', anniversary: '🤍' }

export default function Calendar({ profile, onOpenWatch }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    let alive = true
    fetchUpcoming(profile.couple_id)
      .then((rows) => { if (alive) { setEvents(rows); setLoading(false) } })
      .catch((e) => { if (alive) { setError(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [profile.couple_id])

  async function onCreate(fields) {
    const row = await createEvent(profile.couple_id, fields)
    setEvents((prev) => insertSorted(prev, row))
    setShowForm(false)
  }
  async function onSaveEdit(id, fields) {
    const row = await updateEvent(id, fields)
    setEvents((prev) => insertSorted(prev.filter((e) => e.id !== id), row))
    setEditing(null)
  }
  async function onDelete(id) {
    await deleteEvent(id)
    setEvents((prev) => prev.filter((e) => e.id !== id))
    setEditing(null)
  }

  const grouped = useMemo(() => groupByDay(events), [events])

  return (
    <div className="otter-scroll screen-enter">
      <header className="scr-head">
        <div className="htext">
          <h1>plans</h1>
          <p className="sub">the things keeping us close</p>
        </div>
        <div className="spacer" />
        {!showForm && !editing && (
          <button className="icon-btn" type="button" onClick={() => setShowForm(true)} aria-label="add plan">
            <Icon name="plus" size={20} stroke={2.4} />
          </button>
        )}
      </header>

      {showForm && (
        <EventForm onCancel={() => setShowForm(false)} onSubmit={onCreate} />
      )}

      {loading && <p className="hint">loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !events.length && !showForm && (
        <div className="cal-empty">
          <p>nothing on the calendar yet.</p>
          <button className="btn primary" type="button" onClick={() => setShowForm(true)}>add the first one</button>
        </div>
      )}

      {grouped.map(({ key, dnum, dwk, items }) => (
        <section className="cal-day" key={key}>
          <div className="cal-date">
            <div className="dnum">{dnum}</div>
            <div className="dwk">{dwk}</div>
          </div>
          <div className="cal-events">
            {items.map((e) => (
              editing === e.id ? (
                <EventForm
                  key={e.id}
                  initial={e}
                  onCancel={() => setEditing(null)}
                  onSubmit={(fields) => onSaveEdit(e.id, fields)}
                  onDelete={() => onDelete(e.id)}
                />
              ) : (
                <EventRow key={e.id} event={e} onEdit={() => setEditing(e.id)} />
              )
            ))}
          </div>
        </section>
      ))}

      {onOpenWatch && (
        <button className="btn ghost full-row" type="button" onClick={onOpenWatch} style={{ marginTop: 6 }}>
          🎬 watch a video together →
        </button>
      )}
    </div>
  )
}

function EventRow({ event, onEdit }) {
  const emoji = TYPE_EMOJI[event.type] ?? '•'
  return (
    <button className={`cal-row ${event.is_reunion ? 'reunion-row' : ''}`} type="button" onClick={onEdit}>
      <div className="cal-ic">{emoji}</div>
      <div className="cal-info">
        <p className="cal-title">
          {event.title}
          {event.is_reunion && <span className="pill">reunion</span>}
        </p>
        <p className="cal-time">{formatTime(event.starts_at)}{event.description ? ' · ' + event.description : ''}</p>
      </div>
    </button>
  )
}

function EventForm({ initial, onSubmit, onCancel, onDelete }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [type, setType] = useState(initial?.type ?? 'date')
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.starts_at))
  const [endsAt, setEndsAt] = useState(toLocalInput(initial?.ends_at))
  const [isReunion, setIsReunion] = useState(!!initial?.is_reunion)
  const [description, setDescription] = useState(initial?.description ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!title || !startsAt) return
    setBusy(true); setError(null)
    try {
      await onSubmit({
        title: title.trim(),
        type,
        startsAt,
        endsAt: endsAt || null,
        isReunion,
        description: description.trim() || null,
      })
    } catch (e) { setError(e.message); setBusy(false) }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <div className="field">
        <label>what</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. sunday call" />
      </div>
      <div className="field">
        <label>type</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {EVENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label>starts</label>
        <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
      </div>
      <div className="field">
        <label>ends (optional)</label>
        <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={isReunion} onChange={(e) => setIsReunion(e.target.checked)} />
        <span>this is a reunion</span>
      </label>
      <div className="field">
        <label>note (optional)</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="anything else" />
      </div>

      <div className="row">
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'saving…' : (initial ? 'save' : 'add')}</button>
        <button className="btn ghost" type="button" onClick={onCancel} disabled={busy}>cancel</button>
        {initial && onDelete && (
          <button className="btn link danger" type="button" onClick={() => { if (confirm('delete this event?')) onDelete() }} disabled={busy}>
            delete
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  )
}

function groupByDay(events) {
  const out = []
  let cur = null
  for (const e of events) {
    const d = new Date(e.starts_at)
    const key = d.toDateString()
    if (!cur || cur.key !== key) {
      cur = {
        key,
        dnum: d.getDate(),
        dwk: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()],
        items: [],
      }
      out.push(cur)
    }
    cur.items.push(e)
  }
  return out
}

function insertSorted(list, row) {
  const next = [...list, row]
  next.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
  return next
}

function formatTime(iso) {
  try {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso)).toLowerCase()
  } catch { return '' }
}

function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
