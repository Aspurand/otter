import { useState } from 'react'
import { createCouple, joinCouple } from '../lib/couples.js'
import { signOut } from '../lib/auth.js'
import OtterMascot from '../components/OtterMascot.jsx'

export default function Onboarding({ profile, onPaired }) {
  const [mode, setMode] = useState('choose') // choose | create | join
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [createdCode, setCreatedCode] = useState(null)

  async function onCreate() {
    setBusy(true); setError(null)
    try {
      const { inviteCode } = await createCouple()
      setCreatedCode(inviteCode)
    } catch (e) { setError(humanize(e)) }
    finally { setBusy(false) }
  }

  async function onJoin(e) {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true); setError(null)
    try {
      await joinCouple(code)
      onPaired?.()
    } catch (e) { setError(humanize(e)) }
    finally { setBusy(false) }
  }

  function reset() { setMode('choose'); setCode(''); setError(null) }

  return (
    <div className="otter-scroll" style={{ paddingBottom: 48 }}>
      <div className="brand-only">
        <OtterMascot size={72} />
        <h1>otter</h1>
        <p className="tagline">hi {profile?.display_name ?? 'there'} — let's pair you up</p>
      </div>

      {mode === 'choose' && (
        <section className="card stack">
          <p className="card-label"><span className="dot" /> get started</p>
          <button className="btn primary full" type="button" onClick={() => setMode('create')}>
            create a new couple
          </button>
          <button className="btn ghost full" type="button" onClick={() => setMode('join')}>
            i have an invite code
          </button>
        </section>
      )}

      {mode === 'create' && (
        <section className="card stack">
          <p className="card-label"><span className="dot" /> create couple</p>
          {createdCode ? (
            <>
              <p className="hint">share this code with your partner. they sign in and tap "i have an invite code."</p>
              <div className="invite-code">{createdCode}</div>
              <button className="btn primary full" type="button" onClick={onPaired}>i'm done — open otter</button>
            </>
          ) : (
            <>
              <p className="hint">we'll generate a 6-character invite code for your partner.</p>
              <button className="btn primary full" type="button" onClick={onCreate} disabled={busy}>
                {busy ? 'creating…' : 'generate code'}
              </button>
              <button className="btn ghost full" type="button" onClick={reset} disabled={busy}>back</button>
            </>
          )}
        </section>
      )}

      {mode === 'join' && (
        <section className="card stack">
          <p className="card-label"><span className="dot" /> join couple</p>
          <form className="stack" onSubmit={onJoin}>
            <div className="field">
              <label>invite code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="6 characters"
                style={{ textTransform: 'uppercase', letterSpacing: '0.18em', fontFamily: 'ui-monospace, Consolas, monospace' }}
                required
              />
            </div>
            <button className="btn primary full" type="submit" disabled={busy || code.length < 6}>
              {busy ? 'joining…' : 'join'}
            </button>
            <button type="button" className="btn ghost full" onClick={reset} disabled={busy}>back</button>
          </form>
        </section>
      )}

      {error && <p className="error">{error}</p>}

      <button className="btn link" type="button" onClick={signOut} style={{ alignSelf: 'center' }}>sign out</button>
    </div>
  )
}

function humanize(err) {
  const msg = err?.message ?? String(err)
  if (msg.includes('invalid invite code')) return 'that invite code didn\'t match any couple.'
  if (msg.includes('already in a couple')) return 'you\'re already paired with someone.'
  if (msg.includes('already full')) return 'that couple already has two people.'
  return msg
}
