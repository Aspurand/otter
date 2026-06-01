import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { fetchMessages, sendMessage, markRead } from '../lib/chat.js'
import OtterMascot from '../components/OtterMascot.jsx'
import Icon from '../components/Icon.jsx'

const PAGE_SIZE = 50

const STATUS_LABELS = {
  free: 'online now',
  busy: 'busy',
  asleep: 'asleep',
  away: 'away',
}

export default function Chat({ profile, partner, presence }) {
  const [messages, setMessages] = useState([])
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [composer, setComposer] = useState('')
  const [sending, setSending] = useState(false)
  const [atBottom, setAtBottom] = useState(true)

  const listRef = useRef(null)
  const typingChRef = useRef(null)
  const partnerTypingTimeoutRef = useRef(null)
  const myTypingLastSentRef = useRef(0)
  const initialScrollDoneRef = useRef(false)

  const partnerOnline = partner && !!presence?.[partner.id]
  const partnerStatus = (partnerOnline ? presence[partner.id]?.status : null) ?? partner?.status ?? 'free'

  // --- Initial fetch + mark-read on open --------------------------------------------------
  useEffect(() => {
    let alive = true
    fetchMessages(profile.couple_id, { limit: PAGE_SIZE })
      .then((rows) => {
        if (!alive) return
        const ordered = [...rows].reverse()
        setMessages(ordered)
        setHasMore(rows.length === PAGE_SIZE)
        const unread = ordered.filter((m) => m.sender_id !== profile.id && !m.read_at).map((m) => m.id)
        if (unread.length) markRead(unread).catch(() => {})
      })
      .catch((e) => console.error('fetchMessages failed', e))
    return () => { alive = false }
  }, [profile.couple_id, profile.id])

  useEffect(() => {
    if (initialScrollDoneRef.current) return
    if (!messages.length) return
    const el = listRef.current
    if (!el) return
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
    initialScrollDoneRef.current = true
  }, [messages.length])

  // --- Realtime: new messages + read-receipt updates --------------------------------------
  useEffect(() => {
    if (!profile.couple_id) return
    const ch = supabase
      .channel(`chat-msgs:${profile.couple_id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `couple_id=eq.${profile.couple_id}` },
        (payload) => {
          setMessages((prev) => (prev.find((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]))
          if (payload.new.sender_id !== profile.id) {
            markRead([payload.new.id]).catch(() => {})
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `couple_id=eq.${profile.couple_id}` },
        (payload) => {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m)))
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile.couple_id, profile.id])

  // --- Realtime broadcast: typing indicator -----------------------------------------------
  useEffect(() => {
    if (!profile.couple_id) return
    const ch = supabase.channel(`chat-typing:${profile.couple_id}`)
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (!payload || payload.userId === profile.id) return
      setPartnerTyping(true)
      clearTimeout(partnerTypingTimeoutRef.current)
      partnerTypingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 3000)
    })
    ch.subscribe()
    typingChRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      typingChRef.current = null
      clearTimeout(partnerTypingTimeoutRef.current)
    }
  }, [profile.couple_id, profile.id])

  // --- Auto-scroll when new content arrives and the user is near the bottom -------------
  useEffect(() => {
    if (!atBottom) return
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length, partnerTyping, atBottom])

  // --- Load older when user scrolls near the top -----------------------------------------
  const loadOlder = useCallback(async () => {
    if (!messages.length || loadingOlder || !hasMore) return
    setLoadingOlder(true)
    const oldest = messages[0]
    const el = listRef.current
    const prevHeight = el?.scrollHeight ?? 0
    try {
      const older = await fetchMessages(profile.couple_id, { before: oldest.created_at, limit: PAGE_SIZE })
      setMessages((prev) => [...[...older].reverse(), ...prev])
      setHasMore(older.length === PAGE_SIZE)
      requestAnimationFrame(() => {
        if (!el) return
        el.scrollTop = el.scrollHeight - prevHeight
      })
    } catch (e) { console.error('loadOlder failed', e) }
    finally { setLoadingOlder(false) }
  }, [messages, loadingOlder, hasMore, profile.couple_id])

  function onScroll(e) {
    const el = e.currentTarget
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setAtBottom(nearBottom)
    if (el.scrollTop < 60) loadOlder()
  }

  function broadcastTyping() {
    const ch = typingChRef.current
    if (!ch) return
    const now = Date.now()
    if (now - myTypingLastSentRef.current < 1500) return
    myTypingLastSentRef.current = now
    ch.send({ type: 'broadcast', event: 'typing', payload: { userId: profile.id } }).catch(() => {})
  }

  async function onSend(e) {
    e?.preventDefault()
    const text = composer.trim()
    if (!text || sending) return
    setSending(true)
    setComposer('')
    try {
      await sendMessage(profile.couple_id, { kind: 'text', body: text })
      setAtBottom(true)
    } catch (err) {
      console.error('sendMessage failed', err)
      setComposer(text)
    } finally { setSending(false) }
  }

  const groups = useMemo(() => groupConsecutive(messages, profile.id), [messages, profile.id])

  return (
    <div className="otter-scroll flush screen-enter">
      <header className="chat-head">
        <OtterMascot mood="happy" size={42} />
        <div className="htext">
          <strong>{partner?.display_name ?? 'partner'}</strong>
          <span className="csub">
            <span className="dot" style={{ width: 7, height: 7, background: dotColor(partnerStatus), color: dotColor(partnerStatus), boxShadow: 'none' }} />
            {partner ? (STATUS_LABELS[partnerStatus] ?? 'free') : 'waiting for them to join'}
          </span>
        </div>
      </header>

      <div className="chat-list" ref={listRef} onScroll={onScroll}>
        {loadingOlder && <div className="chat-day">loading…</div>}
        {!hasMore && messages.length > 0 && <div className="chat-day">that's the start</div>}
        {messages.length === 0 && !loadingOlder && (
          <p className="muted-note" style={{ margin: 'auto 0' }}>no messages yet — say hi.</p>
        )}
        {groups.map((g) => (
          <div key={g.id} className={`grp ${g.mine ? 'mine' : 'theirs'}`}>
            {g.items.map((m) => (
              <div className="bubble" key={m.id}>{m.body}</div>
            ))}
            <div className="bubble-meta">
              {formatTime(g.items[g.items.length - 1].created_at)}
              {g.mine && (g.items[g.items.length - 1].read_at ? ' · read' : ' · sent')}
            </div>
          </div>
        ))}
        {partnerTyping && (
          <div className="grp theirs">
            <div className="bubble typing"><i /><i /><i /></div>
          </div>
        )}
      </div>

      <form className="composer" onSubmit={onSend}>
        <input
          value={composer}
          onChange={(e) => { setComposer(e.target.value); broadcastTyping() }}
          placeholder={`message ${partner?.display_name ?? 'them'}…`}
          enterKeyHint="send"
          autoComplete="off"
          aria-label="message"
        />
        <button className="send-btn" type="submit" disabled={!composer.trim() || sending} aria-label="send">
          <Icon name="send" size={20} />
        </button>
      </form>
    </div>
  )
}

function groupConsecutive(messages, myId) {
  const groups = []
  for (const m of messages) {
    const mine = m.sender_id === myId
    const last = groups[groups.length - 1]
    if (last && last.mine === mine && (new Date(m.created_at) - new Date(last.items[last.items.length - 1].created_at)) < 5 * 60_000) {
      last.items.push(m)
    } else {
      groups.push({ id: m.id, mine, items: [m] })
    }
  }
  return groups
}

function formatTime(iso) {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d).toLowerCase()
  } catch { return '' }
}

function dotColor(status) {
  return ({ free: '#2f7a4e', busy: '#c97a2f', asleep: '#5a4eb8', away: '#9a8e95' })[status] ?? '#2f7a4e'
}
