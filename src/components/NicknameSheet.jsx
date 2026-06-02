// Set / clear a nickname for your partner. Stored on YOUR profile, so each
// side independently picks what to call the other.

import { useState } from 'react'
import { setPartnerNickname } from '../lib/profile.js'

export default function NicknameSheet({ profile, partner, onClose, onSaved }) {
  const [value, setValue] = useState(profile.partner_nickname ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const partnerReal = partner?.display_name ?? 'them'

  async function save(next) {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const updated = await setPartnerNickname(next)
      onSaved?.(updated ?? { partner_nickname: next || null })
      onClose?.()
    } catch (e) { setError(e.message); setBusy(false) }
  }

  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <h2>what do you call them?</h2>
        <p className="hint" style={{ marginBottom: 14 }}>
          this is just for you. {partnerReal} won't see what you set here.
        </p>
        <div className="field">
          <label>your nickname for {partnerReal}</label>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 40))}
            placeholder={partnerReal}
            maxLength={40}
          />
        </div>
        <div className="row">
          <button className="btn primary" type="button" disabled={busy} onClick={() => save(value)}>
            {busy ? 'saving…' : 'save'}
          </button>
          {profile.partner_nickname && (
            <button className="btn ghost" type="button" disabled={busy} onClick={() => save('')}>
              clear
            </button>
          )}
          <button className="btn link" type="button" disabled={busy} onClick={onClose}>cancel</button>
        </div>
        {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
      </div>
    </div>
  )
}
