import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { db } from './lib/db.js'
import { fetchMyProfile, fetchCoupleProfiles } from './lib/couples.js'
import { updateMyProfile, detectTimezone } from './lib/profile.js'
import { fetchNextReunion } from './lib/events.js'
import { fetchUnreadFromPartner, markNudgeRead } from './lib/nudges.js'
import { fetchThrowback } from './lib/memories.js'
import { markThrowbackSeen } from './lib/profile.js'
import { WakeContext } from './lib/wake.js'
import SignIn from './pages/SignIn.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Home from './pages/Home.jsx'
import Chat from './pages/Chat.jsx'
import Calendar from './pages/Calendar.jsx'
import Memories from './pages/Memories.jsx'
import Games from './pages/Games.jsx'
import Watch from './pages/Watch.jsx'
import Brand from './components/Brand.jsx'
import TabBar from './components/TabBar.jsx'
import SettingsSheet from './components/SettingsSheet.jsx'
import NicknameSheet from './components/NicknameSheet.jsx'
import './App.css'

const DARK_KEY = 'otter:dark'

export default function App() {
  // Auth + couple state
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [partner, setPartner] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | signed-out | onboarding | home
  const [presence, setPresence] = useState({})

  // App-shell state
  const [tab, setTab] = useState('home')                 // home | chat | us | plans | play
  const [overlay, setOverlay] = useState(null)           // null | 'watch'
  const [toasts, setToasts] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [showNickname, setShowNickname] = useState(false)
  const [loveMood, setLoveMood] = useState(false)
  const [chatUnread, setChatUnread] = useState(0)
  const [reunionDays, setReunionDays] = useState(null)
  const [unreadNudges, setUnreadNudges] = useState([])
  const [throwback, setThrowback] = useState(null)
  const [wakeKey, setWakeKey] = useState(0)
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(DARK_KEY) === '1' } catch { return false }
  })

  const channelRef = useRef(null)
  const profileRef = useRef(profile)
  useEffect(() => { profileRef.current = profile }, [profile])

  const refreshProfile = useCallback(async () => {
    const p = await fetchMyProfile()
    setProfile(p)
    return p
  }, [])

  // ────────── auth boot ──────────
  useEffect(() => {
    let alive = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      if (!data.session) { setPhase('signed-out'); return }
      const p = await refreshProfile()
      if (!alive) return
      setPhase(p?.couple_id ? 'home' : 'onboarding')
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s)
      if (!s) { setProfile(null); setPartner(null); setPhase('signed-out'); return }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        const p = await refreshProfile()
        setPhase(p?.couple_id ? 'home' : 'onboarding')
      }
    })

    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [refreshProfile])

  // ────────── on entering home: bump last_active, autodetect tz ──────────
  useEffect(() => {
    if (phase !== 'home' || !profile?.couple_id) return
    let alive = true
    ;(async () => {
      const patch = { last_active: new Date().toISOString() }
      if (!profile.timezone || profile.timezone === 'UTC') {
        const detected = detectTimezone()
        if (detected !== 'UTC') patch.timezone = detected
      }
      try {
        const updated = await updateMyProfile(patch)
        if (alive) setProfile((p) => (p ? { ...p, ...updated } : p))
      } catch { /* non-fatal */ }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ────────── partner profile ──────────
  useEffect(() => {
    if (phase !== 'home' || !profile?.couple_id) return
    let alive = true
    fetchCoupleProfiles(profile.couple_id).then((people) => {
      if (!alive) return
      setPartner(people.find((p) => p.id !== profile.id) ?? null)
    })
    return () => { alive = false }
  }, [phase, profile?.couple_id, profile?.id, wakeKey])

  // ────────── presence channel (shared by Home presence bar + Chat header) ──────────
  useEffect(() => {
    if (phase !== 'home' || !profile?.couple_id) return
    const ch = supabase.channel(`couple-presence:${profile.couple_id}`, {
      config: { presence: { key: profile.id } },
    })
    ch.on('presence', { event: 'sync' }, () => setPresence(flatten(ch.presenceState())))
    ch.subscribe(async (s) => {
      if (s !== 'SUBSCRIBED') return
      // Guard against signOut racing the subscribe callback.
      const p = profileRef.current
      if (!p) return
      await ch.track({ id: p.id, status: p.status, at: Date.now() })
    })
    channelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      channelRef.current = null
      setPresence({})
    }
  }, [phase, profile?.couple_id, profile?.id, wakeKey])

  useEffect(() => {
    const ch = channelRef.current
    if (!ch || !profile) return
    ch.track({ id: profile.id, status: profile.status, at: Date.now() }).catch(() => {})
    // Note: 'profile' itself isn't in deps. We only re-track when status/id
    // change — bumping on every profile field edit (nickname, activity_at, …)
    // would create gratuitous presence broadcasts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.status, profile?.id])

  // ────────── chat unread badge (initial seed + realtime increment) ──────────
  // Seed from the DB on home entry so messages that arrived while the app was
  // closed are reflected in the tab badge immediately. Without this, opening
  // straight to Home shows "0 unread" until the user visits Chat.
  useEffect(() => {
    if (phase !== 'home' || !profile?.couple_id || !partner?.id || tab === 'chat') return
    let alive = true
    db.select('messages', {
      match: { couple_id: profile.couple_id, sender_id: partner.id, read_at: null },
      order: { column: 'created_at', ascending: false },
      limit: 100,
    }).then(({ data }) => {
      if (alive && Array.isArray(data)) setChatUnread(data.length)
    }).catch(() => {})
    return () => { alive = false }
  }, [phase, profile?.couple_id, partner?.id, tab, wakeKey])

  useEffect(() => {
    if (phase !== 'home' || !profile?.couple_id) return
    const ch = supabase
      .channel(`unread-msgs:${profile.couple_id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `couple_id=eq.${profile.couple_id}` },
        (payload) => {
          if (payload.new.sender_id === profile.id) return
          if (tab !== 'chat') setChatUnread((n) => n + 1)
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [phase, profile?.couple_id, profile?.id, tab, wakeKey])

  // Declared early so the unread-nudges effects below can call it.
  // ────────── helper callbacks ──────────
  const onPatchProfileEarly = useCallback((patch) => {
    setProfile((p) => (p ? { ...p, ...patch } : p))
  }, [])
  const pushToastEarly = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((x) => [...x, { ...toast, id }])
    setTimeout(() => setToasts((x) => x.filter((t) => t.id !== id)), toast.ttl ?? 4200)
  }, [])
  const triggerLoveMoodEarly = useCallback((ms = 2400) => {
    setLoveMood(true)
    setTimeout(() => setLoveMood(false), ms)
  }, [])

  // ────────── unread nudges from partner (persistent cards on Home) ──────────
  // Initial fetch on home entry — surfaces things that arrived while phone was locked.
  useEffect(() => {
    if (phase !== 'home' || !profile?.couple_id || !partner?.id) return
    let alive = true
    fetchUnreadFromPartner(profile.couple_id, partner.id)
      .then((rows) => {
        if (!alive) return
        setUnreadNudges((prev) => {
          const seen = new Set(prev.map((x) => x.id))
          const merged = [...prev]
          for (const r of rows) if (!seen.has(r.id)) merged.push(r)
          merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          return merged
        })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [phase, profile?.couple_id, partner?.id, wakeKey])

  // Realtime: append new ones, drop ones that get marked read (e.g. from another device).
  useEffect(() => {
    if (phase !== 'home' || !profile?.couple_id || !partner?.id) return
    const ch = supabase
      .channel(`nudges-stream:${profile.couple_id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'nudges', filter: `couple_id=eq.${profile.couple_id}` },
        (payload) => {
          const n = payload.new
          if (n.sender_id === profile.id) return
          if (n.kind !== 'thinking_of_you' && n.kind !== 'love_note') return
          if (!n.delivered || n.read_at) return
          setUnreadNudges((prev) => (prev.find((x) => x.id === n.id) ? prev : [n, ...prev]))
          triggerLoveMoodEarly()
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'nudges', filter: `couple_id=eq.${profile.couple_id}` },
        (payload) => {
          const n = payload.new
          if (n.sender_id === profile.id) return
          if (n.kind !== 'thinking_of_you' && n.kind !== 'love_note') return
          // Scheduled love note got delivered.
          if (n.delivered && payload.old?.delivered === false && !n.read_at) {
            setUnreadNudges((prev) => (prev.find((x) => x.id === n.id) ? prev : [n, ...prev]))
            triggerLoveMoodEarly()
            return
          }
          // Marked read (from any device) — drop it.
          if (n.read_at) {
            setUnreadNudges((prev) => prev.filter((x) => x.id !== n.id))
          }
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [phase, profile?.couple_id, profile?.id, partner?.id, triggerLoveMoodEarly, wakeKey])

  const dismissUnreadNudge = useCallback(async (id) => {
    setUnreadNudges((prev) => prev.filter((n) => n.id !== id))
    try { await markNudgeRead(id) } catch (e) { console.error('mark read failed', e) }
  }, [])

  // ────────── today's throwback (Us tab "remember this?" card) ──────────
  useEffect(() => {
    if (phase !== 'home' || !profile?.couple_id) return
    let alive = true
    fetchThrowback(profile.couple_id)
      .then((m) => { if (alive) setThrowback(m) })
      .catch(() => { if (alive) setThrowback(null) })
    return () => { alive = false }
  }, [phase, profile?.couple_id, wakeKey])

  // Mark the throwback as seen when the user lands on the Us tab.
  useEffect(() => {
    if (tab !== 'us' || !throwback?.id) return
    if (profile?.last_seen_throwback_id === throwback.id) return
    markThrowbackSeen(throwback.id).then(() => {
      onPatchProfileEarly({ last_seen_throwback_id: throwback.id })
    }).catch(() => {})
  }, [tab, throwback?.id, profile?.last_seen_throwback_id, onPatchProfileEarly])

  const usHasNew = !!(throwback?.id && profile?.last_seen_throwback_id !== throwback.id)

  // ────────── reunion days, for mascot mood ──────────
  useEffect(() => {
    if (phase !== 'home' || !profile?.couple_id) return
    let alive = true
    fetchNextReunion(profile.couple_id)
      .then((r) => {
        if (!alive) return
        if (!r) { setReunionDays(null); return }
        const ms = new Date(r.starts_at).getTime() - Date.now()
        setReunionDays(Math.max(0, Math.ceil(ms / 86_400_000)))
      })
      .catch(() => { if (alive) setReunionDays(null) })
    return () => { alive = false }
  }, [phase, profile?.couple_id, tab, wakeKey])

  // ────────── wake recovery ──────────
  // iOS PWA + Android Chrome drop the realtime WebSocket when backgrounded for
  // more than ~30s, and the SDK's built-in auto-rejoin is flaky. On wake we:
  //   1) try to refresh the auth session — if the refresh token expired, kick
  //      the user back to sign-in instead of leaving them in a half-dead state;
  //   2) bump wakeKey, which is in every channel-creating effect's deps. That
  //      forces cleanup → re-create across the app and is the only reliable way
  //      to recover dropped channels.
  // We listen to all four wake signals because iOS Safari can swallow any of
  // them individually (visibilitychange may not fire on quick app-switches,
  // focus is reliable on desktop, pageshow fires on BFCache restore, online
  // catches network blips that don't involve a visibility change at all).
  useEffect(() => {
    let lastWakeAt = 0
    let cancelled = false
    async function onWake(reason) {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastWakeAt < 2_000) return // debounce; events can pile up
      lastWakeAt = now

      // Refresh the JWT. If we're past the refresh-token window, the user is
      // effectively signed out — surface that instead of silently failing.
      try {
        const { data, error } = await supabase.auth.refreshSession()
        if (cancelled) return
        if (error || !data?.session) {
          setSession(null); setProfile(null); setPartner(null); setPhase('signed-out')
          return
        }
      } catch { /* network blip — bump wakeKey anyway and try again on next wake */ }

      // Re-fetch the primary data so we don't show stale state while channels
      // are re-establishing.
      try { await refreshProfile() } catch { /* non-fatal */ }
      void reason // available for debug logging if needed

      // Forces every channel-creating effect across the app to tear down + re-create.
      setWakeKey((k) => k + 1)
    }
    const visibilityHandler = () => onWake('visibility')
    const focusHandler      = () => onWake('focus')
    const pageshowHandler   = () => onWake('pageshow')
    const onlineHandler     = () => onWake('online')

    document.addEventListener('visibilitychange', visibilityHandler)
    window.addEventListener('focus',   focusHandler)
    window.addEventListener('pageshow', pageshowHandler)
    window.addEventListener('online',   onlineHandler)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', visibilityHandler)
      window.removeEventListener('focus',   focusHandler)
      window.removeEventListener('pageshow', pageshowHandler)
      window.removeEventListener('online',   onlineHandler)
    }
  }, [refreshProfile])

  // ────────── persist dark mode ──────────
  useEffect(() => {
    try { localStorage.setItem(DARK_KEY, dark ? '1' : '0') } catch { /* ignore */ }
  }, [dark])

  // ────────── helpers passed to screens (aliases for the early callbacks above) ──────────
  const onPatchProfile = onPatchProfileEarly
  const pushToast = pushToastEarly
  const triggerLoveMood = triggerLoveMoodEarly

  // Mascot mood — single source of truth.
  const partnerStatus = partner ? (presence[partner.id]?.status ?? partner.status ?? 'free') : 'free'
  // Single source of truth for what to call the partner: your nickname for them
  // (if set) takes precedence over their actual display_name.
  const partnerName = (profile?.partner_nickname?.trim()) || partner?.display_name || 'them'
  const mascotMood = useMemo(() => {
    if (loveMood) return 'love'
    if (partnerStatus === 'asleep') return 'sleepy'
    if (reunionDays != null && reunionDays <= 5) return 'excited'
    return 'happy'
  }, [loveMood, partnerStatus, reunionDays])

  function goTab(key) {
    setTab(key)
    if (key === 'chat') setChatUnread(0)
    if (overlay) setOverlay(null)
  }

  // ────────── render ──────────
  if (phase === 'loading') return <Splash dark={dark} />
  if (phase === 'signed-out' || !session) {
    return (
      <div className="otter-app" data-mood={dark ? 'dark' : 'light'}>
        <SignIn />
      </div>
    )
  }
  if (phase === 'onboarding' || !profile?.couple_id) {
    return (
      <div className="otter-app" data-mood={dark ? 'dark' : 'light'}>
        <Onboarding profile={profile} onPaired={async () => {
          const p = await refreshProfile()
          if (p?.couple_id) setPhase('home')
        }} />
      </div>
    )
  }

  const screen = (() => {
    if (overlay === 'watch') return <Watch profile={profile} onBack={() => setOverlay(null)} />
    switch (tab) {
      case 'chat':  return <Chat profile={profile} partner={partner} partnerName={partnerName} presence={presence} />
      case 'us':    return <Memories profile={profile} pushToast={pushToast} throwback={throwback} />
      case 'plans': return <Calendar profile={profile} onOpenWatch={() => setOverlay('watch')} />
      case 'play':  return <Games profile={profile} partner={partner} partnerName={partnerName} />
      case 'home':
      default:
        return (
          <Home
            profile={profile}
            partner={partner}
            partnerName={partnerName}
            presence={presence}
            mascotMood={mascotMood}
            reunionDays={reunionDays}
            unreadNudges={unreadNudges}
            onDismissNudge={dismissUnreadNudge}
            onPatchProfile={onPatchProfile}
            onOpenSettings={() => setShowSettings(true)}
            onEditNickname={() => setShowNickname(true)}
            pushToast={pushToast}
            triggerLoveMood={triggerLoveMood}
          />
        )
    }
  })()

  return (
    <WakeContext.Provider value={wakeKey}>
    <div className="otter-app" data-mood={dark ? 'dark' : 'light'}>
      <div key={overlay ?? tab} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {screen}
      </div>

      <div className="toast-wrap">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <div className="t-emoji">{t.emoji}</div>
            <div>
              <strong>{t.title}</strong>
              {t.body && <p>{t.body}</p>}
            </div>
          </div>
        ))}
      </div>

      {!overlay && <TabBar current={tab} onChange={goTab} chatUnread={chatUnread} usHasNew={usHasNew} />}

      {showSettings && (
        <SettingsSheet
          profile={profile}
          dark={dark}
          onToggleDark={(v) => setDark(v)}
          onClose={() => setShowSettings(false)}
          onSaved={(p) => onPatchProfile(p)}
        />
      )}
      {showNickname && partner && (
        <NicknameSheet
          profile={profile}
          partner={partner}
          onClose={() => setShowNickname(false)}
          onSaved={(p) => onPatchProfile(p)}
        />
      )}
    </div>
    </WakeContext.Provider>
  )
}

function flatten(state) {
  const out = {}
  for (const [key, entries] of Object.entries(state ?? {})) {
    if (entries?.length) out[key] = entries[0]
  }
  return out
}

function Splash({ dark }) {
  return (
    <div className="otter-app" data-mood={dark ? 'dark' : 'light'}>
      <div className="otter-scroll">
        <Brand />
      </div>
    </div>
  )
}
