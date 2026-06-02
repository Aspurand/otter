import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { fetchCurrentSession, startSession, updateSession, endSession } from '../lib/watch.js'
import { useWakeKey } from '../lib/wake.js'

const DRIFT_SECONDS = 2.0
const IGNORE_REMOTE_MS = 350

export default function Watch({ profile, onBack }) {
  const wakeKey = useWakeKey()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState(null)

  const videoRef = useRef(null)
  const ignoringRemoteRef = useRef(false)
  const lastSentRef = useRef(0)

  useEffect(() => {
    let alive = true
    fetchCurrentSession(profile.couple_id)
      .then((s) => { if (alive) { setSession(s); setLoading(false) } })
      .catch((e) => { if (alive) { setError(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [profile.couple_id, wakeKey])

  useEffect(() => {
    if (!profile.couple_id) return
    const ch = supabase
      .channel(`watch:${profile.couple_id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'watch_sessions', filter: `couple_id=eq.${profile.couple_id}` },
        (payload) => setSession(payload.new),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'watch_sessions', filter: `couple_id=eq.${profile.couple_id}` },
        (payload) => {
          setSession(payload.new)
          applyRemote(payload.new)
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'watch_sessions', filter: `couple_id=eq.${profile.couple_id}` },
        () => setSession(null),
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile.couple_id, wakeKey])

  function applyRemote(s) {
    const v = videoRef.current
    if (!v || !s) return
    ignoringRemoteRef.current = true
    const drift = Math.abs((v.currentTime ?? 0) - (s.playback_position ?? 0))
    if (drift > DRIFT_SECONDS) v.currentTime = s.playback_position
    if (s.is_playing && v.paused) v.play().catch(() => {})
    else if (!s.is_playing && !v.paused) v.pause()
    setTimeout(() => { ignoringRemoteRef.current = false }, IGNORE_REMOTE_MS)
  }

  async function pushState(patch) {
    if (!session) return
    const now = Date.now()
    if (now - lastSentRef.current < 200) return
    lastSentRef.current = now
    try { await updateSession(session.id, patch) }
    catch (e) { console.error('watch sync failed', e) }
  }

  function onLocalPlay() {
    if (ignoringRemoteRef.current) return
    pushState({ is_playing: true, playback_position: videoRef.current?.currentTime ?? 0 })
  }
  function onLocalPause() {
    if (ignoringRemoteRef.current) return
    pushState({ is_playing: false, playback_position: videoRef.current?.currentTime ?? 0 })
  }
  function onLocalSeeked() {
    if (ignoringRemoteRef.current) return
    pushState({ playback_position: videoRef.current?.currentTime ?? 0 })
  }

  async function onStart(e) {
    e.preventDefault()
    if (!url.trim()) return
    setStarting(true); setError(null)
    try {
      const row = await startSession(profile.couple_id, url.trim())
      setSession(row)
      setUrl('')
    } catch (e) { setError(e.message) }
    finally { setStarting(false) }
  }

  async function onEnd() {
    if (!session) return
    if (!confirm('end this watch session for both of you?')) return
    try {
      await endSession(session.id)
      setSession(null)
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="otter-scroll screen-enter">
      <header className="scr-head">
        <button className="chat-back" type="button" onClick={onBack} aria-label="back">←</button>
        <div className="htext">
          <h1 style={{ fontSize: 22 }}>watch together</h1>
          <p className="sub">{session ? 'in sync' : 'paste a video URL'}</p>
        </div>
        <div className="spacer" />
        {session && (
          <button className="btn link danger" type="button" onClick={onEnd}>end</button>
        )}
      </header>

      {loading && <p className="hint">loading…</p>}

      {!loading && !session && (
        <form className="card stack" onSubmit={onStart}>
          <div className="field">
            <label>video URL</label>
            <input
              type="url"
              placeholder="https://example.com/film.mp4"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <p className="hint">
            direct video URLs only for now (.mp4, .webm, .mov). youtube and DRM-locked services aren't supported yet.
          </p>
          <button className="btn primary full" type="submit" disabled={starting}>
            {starting ? 'starting…' : 'start watching'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}

      {!loading && session && (
        <div className="watch-player">
          <video
            ref={videoRef}
            src={session.content_url}
            controls
            playsInline
            preload="metadata"
            onPlay={onLocalPlay}
            onPause={onLocalPause}
            onSeeked={onLocalSeeked}
            onLoadedMetadata={() => applyRemote(session)}
          />
          <p className="hint">
            both sides drive playback. drift over {DRIFT_SECONDS}s auto-corrects.
          </p>
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  )
}
