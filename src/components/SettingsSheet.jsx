// Edit display name, timezone, love language. Dark mode + push notifications.

import { useEffect, useState } from 'react'
import { updateMyProfile, detectTimezone } from '../lib/profile.js'
import { signOut } from '../lib/auth.js'
import { pushSupported, subscribePush, unsubscribePush, isPushSubscribed, currentPermission } from '../lib/push.js'

const LOVE_LANGUAGES = [
  { key: 'words', label: 'words of affirmation' },
  { key: 'acts',  label: 'acts of service' },
  { key: 'gifts', label: 'gifts' },
  { key: 'time',  label: 'quality time' },
  { key: 'touch', label: 'physical touch' },
]

export default function SettingsSheet({ profile, dark, onToggleDark, onClose, onSaved }) {
  const [name, setName] = useState(profile.display_name ?? '')
  const [timezone, setTimezone] = useState(profile.timezone ?? detectTimezone())
  const [love, setLove] = useState(profile.love_language ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Push state
  const [pushOn, setPushOn] = useState(false)
  const [pushPerm, setPushPerm] = useState('default')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushNote, setPushNote] = useState(null)

  useEffect(() => {
    (async () => {
      setPushOn(await isPushSubscribed())
      setPushPerm(await currentPermission())
    })()
  }, [])

  async function onSave(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const saved = await updateMyProfile({
        display_name: name.trim() || null,
        timezone: timezone || 'UTC',
        love_language: love || null,
      })
      onSaved?.(saved)
      onClose?.()
    } catch (e) { setError(e.message); setBusy(false) }
  }

  async function togglePush(next) {
    if (pushBusy) return
    setPushBusy(true); setPushNote(null)
    try {
      if (next) {
        const result = await subscribePush()
        if (result === 'granted') {
          setPushOn(true); setPushPerm('granted')
        } else if (result === 'denied') {
          setPushOn(false); setPushPerm('denied')
          setPushNote('notifications were blocked. enable them in your browser site settings.')
        } else if (result === 'unsupported') {
          setPushOn(false)
          setPushNote(iosInstallHint() ?? 'this browser doesn\'t support push notifications yet.')
        } else if (result.startsWith?.('error:')) {
          setPushOn(false)
          setPushNote(result.slice(6))
        }
      } else {
        await unsubscribePush()
        setPushOn(false)
      }
    } catch (e) { setPushNote(e.message) }
    finally {
      setPushBusy(false)
      setPushPerm(await currentPermission())
      setPushOn(await isPushSubscribed())
    }
  }

  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <h2>settings</h2>

        <form className="stack" onSubmit={onSave}>
          <div className="field">
            <label>your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="what your partner sees" />
          </div>

          <div className="field">
            <label>your timezone</label>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/Los_Angeles" />
          </div>

          <fieldset className="field">
            <label style={{ display: 'block', marginBottom: 8 }}>your love language</label>
            <div className="love-grid">
              {LOVE_LANGUAGES.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  className={`love-chip ${love === l.key ? 'on' : ''}`}
                  onClick={() => setLove(love === l.key ? '' : l.key)}
                >{l.label}</button>
              ))}
            </div>
          </fieldset>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={!!dark}
              onChange={(e) => onToggleDark?.(e.target.checked)}
            />
            <span>night mode — gentler at bedtime</span>
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={pushOn}
              disabled={pushBusy || !pushSupported() || pushPerm === 'denied'}
              onChange={(e) => togglePush(e.target.checked)}
            />
            <span>{pushBusy ? 'wiring up notifications…' : 'push notifications — wake my phone for nudges'}</span>
          </label>
          {pushNote && (
            <p className="hint" style={{ marginTop: -8, color: 'var(--accent-deep)' }}>{pushNote}</p>
          )}
          {!pushSupported() && (
            <p className="hint" style={{ marginTop: -8 }}>
              {iosInstallHint() ?? 'your browser doesn\'t expose push api here.'}
            </p>
          )}

          <button className="btn primary full" type="submit" disabled={busy}>
            {busy ? 'saving…' : 'done'}
          </button>
          {error && <p className="error">{error}</p>}

          <button
            type="button"
            className="btn link"
            style={{ marginTop: 6, alignSelf: 'center' }}
            onClick={() => { onClose?.(); signOut() }}
          >
            sign out
          </button>
        </form>
      </div>
    </div>
  )
}

// On iOS, web push only works for PWAs installed to the home screen.
function iosInstallHint() {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent || ''
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  if (!isIOS) return null
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone
  if (isStandalone) return null
  return 'on iphone, push needs the app added to your home screen. tap share → "add to home screen", then come back here.'
}
