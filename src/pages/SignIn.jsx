import { useState } from 'react'
import { signInWithEmail, signInWithGoogle } from '../lib/auth.js'
import OtterMascot from '../components/OtterMascot.jsx'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    if (!email) return
    setSending(true); setError(null)
    const { error } = await signInWithEmail(email)
    setSending(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  async function onGoogle() {
    setError(null)
    const { error } = await signInWithGoogle()
    if (error) setError(error.message)
  }

  return (
    <div className="otter-scroll" style={{ paddingBottom: 48 }}>
      <div className="brand-only">
        <OtterMascot size={88} />
        <h1>otter</h1>
        <p className="tagline">a private app for two</p>
      </div>

      <section className="card">
        <p className="card-label"><span className="dot" /> sign in</p>

        {sent ? (
          <p className="success">check <strong>{email}</strong> for a sign-in link.</p>
        ) : (
          <form onSubmit={onSubmit} className="stack">
            <div className="field">
              <label>email</label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <button className="btn primary full" type="submit" disabled={sending}>
              {sending ? 'sending…' : 'email me a link'}
            </button>
            <div className="divider"><span>or</span></div>
            <button type="button" className="btn ghost full" onClick={onGoogle}>
              continue with google
            </button>
          </form>
        )}

        {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
      </section>
    </div>
  )
}
