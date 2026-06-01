import { useEffect, useMemo, useState } from 'react'
import {
  fetchMemories,
  attachSignedUrls,
  uploadMedia,
  createMemory,
  deleteMemory,
} from '../lib/memories.js'
import Icon from '../components/Icon.jsx'

export default function Memories({ profile, pushToast }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let alive = true
    fetchMemories(profile.couple_id)
      .then(attachSignedUrls)
      .then((rows) => { if (alive) { setItems(rows); setLoading(false) } })
      .catch((e) => { if (alive) { setError(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [profile.couple_id])

  async function onCreate({ kind, file, caption, happenedAt }) {
    let mediaUrl = null
    if (file) mediaUrl = await uploadMedia(profile.couple_id, file)
    const row = await createMemory(profile.couple_id, { kind, caption, happenedAt, mediaUrl })
    const [withUrl] = await attachSignedUrls([row])
    setItems((prev) => insertSorted(prev, withUrl))
    setAdding(false)
    pushToast?.({ emoji: '📸', title: 'memory saved', body: 'tucked into your timeline' })
  }
  async function onDelete(memory) {
    await deleteMemory(memory)
    setItems((prev) => prev.filter((m) => m.id !== memory.id))
  }

  const grouped = useMemo(() => groupByMonth(items), [items])

  return (
    <div className="otter-scroll screen-enter">
      <header className="scr-head">
        <div className="htext">
          <h1>us</h1>
          <p className="sub">{items.length} {items.length === 1 ? 'moment' : 'moments'}, saved just for two</p>
        </div>
        <div className="spacer" />
        <button className="icon-btn" onClick={() => setAdding(true)} aria-label="add memory">
          <Icon name="plus" size={20} stroke={2.4} />
        </button>
      </header>

      {adding && <MemoryForm onCancel={() => setAdding(false)} onSubmit={onCreate} />}
      {loading && <p className="hint">loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !items.length && !adding && (
        <div className="cal-empty">
          <p>no memories yet — save the first one.</p>
          <button className="btn primary" type="button" onClick={() => setAdding(true)}>add a memory</button>
        </div>
      )}

      {grouped.map(({ key, label, items: month }) => (
        <section key={key}>
          <p className="mem-month">{label}</p>
          <ul className="mem-list">
            {month.map((m) => (
              <li key={m.id}>
                <MemoryCard memory={m} onDelete={() => { if (confirm('delete this memory?')) onDelete(m) }} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function MemoryCard({ memory, onDelete }) {
  const isNote = memory.kind === 'note'
  return (
    <article className={`mem-card ${isNote ? 'mem-note' : ''}`}>
      {memory.kind === 'photo' && memory.signed_url && (
        <img className="mem-photo" src={memory.signed_url} alt={memory.caption ?? ''} loading="lazy" />
      )}
      {memory.kind === 'voice' && memory.signed_url && (
        <audio className="mem-audio" controls src={memory.signed_url} />
      )}
      <div className="mem-body">
        <div className="mem-meta-row">
          <div className="mem-meta-text">
            {memory.caption && <p className="mem-cap">{isNote ? `"${memory.caption}"` : memory.caption}</p>}
            <p className="mem-date">
              <span className="mem-byline">{memory.kind}</span> · {formatDate(memory.happened_at ?? memory.created_at)}
            </p>
          </div>
          <button className="btn link danger" type="button" onClick={onDelete}>delete</button>
        </div>
      </div>
    </article>
  )
}

function MemoryForm({ onSubmit, onCancel }) {
  const [kind, setKind] = useState('photo')
  const [file, setFile] = useState(null)
  const [caption, setCaption] = useState('')
  const [happenedAt, setHappenedAt] = useState(() => toLocalInput(new Date().toISOString()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const needsFile = kind !== 'note'

  async function submit(e) {
    e.preventDefault()
    if (needsFile && !file) { setError('pick a file'); return }
    if (kind === 'note' && !caption.trim()) { setError('add some text'); return }
    setBusy(true); setError(null)
    try {
      await onSubmit({ kind, file, caption: caption.trim() || null, happenedAt })
    } catch (e) { setError(e.message); setBusy(false) }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <fieldset className="field">
        <span>type</span>
        <div className="row">
          {['photo', 'note', 'voice'].map((k) => (
            <button
              key={k}
              type="button"
              className={`chip ${kind === k ? 'on' : ''}`}
              onClick={() => { setKind(k); setFile(null) }}
            >{k}</button>
          ))}
        </div>
      </fieldset>

      {needsFile && (
        <label className="field">
          <span>file</span>
          <input
            type="file"
            accept={kind === 'photo' ? 'image/*' : 'audio/*'}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </label>
      )}

      <label className="field">
        <span>{kind === 'note' ? 'note' : 'caption (optional)'}</span>
        {kind === 'note'
          ? <textarea rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} required />
          : <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="say something about it" />}
      </label>

      <label className="field">
        <span>when</span>
        <input type="datetime-local" value={happenedAt} onChange={(e) => setHappenedAt(e.target.value)} />
      </label>

      <div className="row">
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'saving…' : 'save'}</button>
        <button className="btn ghost" type="button" onClick={onCancel} disabled={busy}>cancel</button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  )
}

function groupByMonth(items) {
  const out = []
  let cur = null
  for (const m of items) {
    const d = new Date(m.happened_at ?? m.created_at)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d).toLowerCase()
    if (!cur || cur.key !== key) { cur = { key, label, items: [] }; out.push(cur) }
    cur.items.push(m)
  }
  return out
}

function insertSorted(list, row) {
  const next = [row, ...list]
  next.sort((a, b) => new Date(b.happened_at ?? b.created_at) - new Date(a.happened_at ?? a.created_at))
  return next
}

function formatDate(iso) {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso)).toLowerCase()
  } catch { return '' }
}

function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
