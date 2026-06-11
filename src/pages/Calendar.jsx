import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchUpcoming,
  fetchRange,
  createEvent,
  updateEvent,
  deleteEvent,
  eventEndMs,
  EVENT_TYPES,
} from '../lib/events.js'
import { supabase } from '../lib/supabase.js'
import { useWakeKey } from '../lib/wake.js'
import Icon from '../components/Icon.jsx'

const TYPE_EMOJI = { call: '📞', date: '🍝', visit: '✈️', anniversary: '🤍' }
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

export default function Calendar({ profile, partnerName, onOpenWatch }) {
  const wakeKey = useWakeKey()
  const [events, setEvents] = useState([])           // upcoming list (can span months)
  const [monthEvents, setMonthEvents] = useState([]) // everything in the displayed month (incl. past days)
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState(null) // 'YYYY-MM-DD' | null
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formDate, setFormDate] = useState(null)     // prefill when adding from a tapped day
  const [editing, setEditing] = useState(null)
  const [nowTick, setNowTick] = useState(() => Date.now())

  // Tick once a minute so finished plans (past their end time) drop off the
  // upcoming list while the app sits open, without waiting for a refetch.
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const reload = useCallback(async () => {
    const next = addMonths(month, 1)
    const [up, mo] = await Promise.all([
      fetchUpcoming(profile.couple_id),
      fetchRange(profile.couple_id, month.toISOString(), next.toISOString()),
    ])
    return { up, mo }
  }, [profile.couple_id, month])

  useEffect(() => {
    let alive = true
    reload()
      .then(({ up, mo }) => { if (alive) { setEvents(up); setMonthEvents(mo); setError(null); setLoading(false) } })
      .catch((e) => { if (alive) { setError(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [reload, wakeKey])

  // Live updates: when either of you adds/edits/deletes a plan on any device,
  // both calendars refresh without a reload.
  useEffect(() => {
    if (!profile.couple_id) return
    let alive = true
    const ch = supabase
      .channel(`events-cal:${profile.couple_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `couple_id=eq.${profile.couple_id}` },
        () => {
          reload()
            .then(({ up, mo }) => { if (alive) { setEvents(up); setMonthEvents(mo) } })
            .catch(() => {})
        },
      )
      .subscribe()
    return () => { alive = false; supabase.removeChannel(ch) }
  }, [profile.couple_id, reload, wakeKey])

  async function refresh() {
    try {
      const { up, mo } = await reload()
      setEvents(up); setMonthEvents(mo)
    } catch { /* realtime will catch us up */ }
  }
  async function onCreate(fields) {
    await createEvent(profile.couple_id, fields)
    await refresh()
    setShowForm(false); setFormDate(null)
  }
  async function onSaveEdit(id, fields) {
    await updateEvent(id, fields)
    await refresh()
    setEditing(null)
  }
  async function onDelete(id) {
    await deleteEvent(id)
    await refresh()
    setEditing(null)
  }

  function openAdd(dayKey = null) {
    setFormDate(dayKey)
    setEditing(null)
    setShowForm(true)
  }
  function tapDay(key) {
    setSelectedDay((cur) => (cur === key ? null : key))
  }

  const eventDays = useMemo(() => {
    const s = new Set()
    for (const e of monthEvents) s.add(dayKey(new Date(e.starts_at)))
    return s
  }, [monthEvents])

  const dayEvents = useMemo(
    () => (selectedDay ? monthEvents.filter((e) => dayKey(new Date(e.starts_at)) === selectedDay) : []),
    [selectedDay, monthEvents],
  )

  // fetchUpcoming already filters once at fetch time; re-filter against the
  // ticking clock so events vanish the minute they're over.
  const liveEvents = useMemo(() => events.filter((e) => eventEndMs(e) > nowTick), [events, nowTick])
  const grouped = useMemo(() => groupByDay(liveEvents), [liveEvents])

  const rowProps = { meId: profile.id, partnerName, onEditId: setEditing }

  return (
    <div className="otter-scroll screen-enter">
      <header className="scr-head">
        <div className="htext">
          <h1>plans</h1>
          <p className="sub">one calendar for the both of us</p>
        </div>
        <div className="spacer" />
        {!showForm && !editing && (
          <button className="icon-btn" type="button" onClick={() => openAdd(selectedDay)} aria-label="add plan">
            <Icon name="plus" size={20} stroke={2.4} />
          </button>
        )}
      </header>

      <MonthGrid
        month={month}
        eventDays={eventDays}
        selectedDay={selectedDay}
        onPrev={() => { setMonth((m) => addMonths(m, -1)); setSelectedDay(null) }}
        onNext={() => { setMonth((m) => addMonths(m, 1)); setSelectedDay(null) }}
        onTapDay={tapDay}
      />

      {showForm && (
        <EventForm
          initialDate={formDate}
          onCancel={() => { setShowForm(false); setFormDate(null) }}
          onSubmit={onCreate}
        />
      )}

      {loading && <p className="hint">loading…</p>}
      {error && <p className="error">{error}</p>}

      {selectedDay && (
        <>
          <p className="cal-sec-title">{formatDayHeading(selectedDay)}</p>
          {dayEvents.length === 0 && <p className="muted-note" style={{ textAlign: 'left', marginBottom: 12 }}>nothing planned this day.</p>}
          <div className="cal-events" style={{ marginBottom: 16 }}>
            {dayEvents.map((e) => (
              editing === e.id
                ? <EventForm key={e.id} initial={e} onCancel={() => setEditing(null)} onSubmit={(f) => onSaveEdit(e.id, f)} onDelete={() => onDelete(e.id)} />
                : <EventRow key={e.id} event={e} {...rowProps} />
            ))}
          </div>
          {!showForm && (
            <button className="btn ghost full-row" type="button" onClick={() => openAdd(selectedDay)} style={{ marginBottom: 18 }}>
              + add a plan this day
            </button>
          )}
        </>
      )}

      {!loading && !liveEvents.length && !showForm && !selectedDay && (
        <div className="cal-empty">
          <p>nothing on the calendar yet.</p>
          <button className="btn primary" type="button" onClick={() => openAdd()}>add the first one</button>
        </div>
      )}

      {!selectedDay && grouped.length > 0 && <p className="cal-sec-title">coming up</p>}
      {!selectedDay && grouped.map(({ key, dnum, dwk, items }) => (
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
                <EventRow key={e.id} event={e} {...rowProps} />
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

function MonthGrid({ month, eventDays, selectedDay, onPrev, onNext, onTapDay }) {
  const today = dayKey(new Date())
  const cells = useMemo(() => buildMonthCells(month), [month])
  return (
    <section className="mcal" aria-label="month calendar">
      <div className="mcal-head">
        <button className="mcal-nav" type="button" onClick={onPrev} aria-label="previous month">
          <Icon name="back" size={17} stroke={2.6} />
        </button>
        <p className="mcal-title">{MONTHS[month.getMonth()]} {month.getFullYear()}</p>
        <button className="mcal-nav" type="button" onClick={onNext} aria-label="next month">
          <Icon name="fwd" size={17} stroke={2.6} />
        </button>
      </div>
      <div className="mcal-grid">
        {DOW.map((d) => <div className="mcal-dow" key={d}>{d[0]}</div>)}
        {cells.map((c, i) => c === null ? (
          <button className="mcal-day" key={`pad-${i}`} type="button" disabled>·</button>
        ) : (
          <button
            key={c.key}
            type="button"
            className={`mcal-day ${c.key === today ? 'today' : ''} ${c.key === selectedDay ? 'sel' : ''} ${c.past ? 'dim' : ''}`}
            onClick={() => onTapDay(c.key)}
            aria-label={c.key}
          >
            <span>{c.dnum}</span>
            {eventDays.has(c.key) ? <span className="mcal-dot" /> : <span className="nodot" />}
          </button>
        ))}
      </div>
    </section>
  )
}

function EventRow({ event, meId, partnerName, onEditId }) {
  const emoji = TYPE_EMOJI[event.type] ?? '•'
  const who = event.created_by === meId ? 'you' : (partnerName ?? 'them')
  return (
    <button className={`cal-row ${event.is_reunion ? 'reunion-row' : ''}`} type="button" onClick={() => onEditId(event.id)}>
      <div className="cal-ic">{emoji}</div>
      <div className="cal-info">
        <p className="cal-title">
          {event.title}
          {event.is_reunion && <span className="pill">reunion</span>}
        </p>
        <p className="cal-time">
          {formatTime(event.starts_at)}
          {event.description ? ' · ' + event.description : ''}
          {' · '}{who} added
        </p>
      </div>
    </button>
  )
}

function EventForm({ initial, initialDate, onSubmit, onCancel, onDelete }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [type, setType] = useState(initial?.type ?? 'date')
  const [startsAt, setStartsAt] = useState(
    initial?.starts_at ? toLocalInput(initial.starts_at) : (initialDate ? `${initialDate}T18:00` : ''),
  )
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

// ───────── date helpers (all local-time; the grid is "your" calendar) ─────────

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}
function dayKey(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
// null = leading pad cell before the 1st.
function buildMonthCells(month) {
  const cells = []
  for (let i = 0; i < month.getDay(); i++) cells.push(null)
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  for (let d = 1; d <= days; d++) {
    const date = new Date(month.getFullYear(), month.getMonth(), d)
    cells.push({ key: dayKey(date), dnum: d, past: date < todayStart })
  }
  return cells
}
function formatDayHeading(key) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${DOW[date.getDay()]} ${MONTHS[m - 1]} ${d}`
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
        dwk: DOW[d.getDay()],
        items: [],
      }
      out.push(cur)
    }
    cur.items.push(e)
  }
  return out
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
