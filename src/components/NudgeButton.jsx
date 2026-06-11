// Send-only "thinking of you" + love-note trigger.
// Incoming nudges are handled centrally in App.jsx so they survive tab switches.

import { useState } from 'react'
import { sendNudge } from '../lib/nudges.js'
import LoveNoteSheet from './LoveNoteSheet.jsx'
import Icon from './Icon.jsx'

// Cute little messages the PARTNER receives, one at random per tap. Sent as
// the nudge body, so it shows in their push notification and unread card.
const CUTE_MESSAGES = [
  'you crossed my mind',
  'missing you extra',
  'wish you were here',
  "you're my favorite",
  'thinking of you, always',
  'sending a squeeze',
]

export default function NudgeButton({ profile, partner, partnerName = 'them', pushToast, triggerLoveMood }) {
  const [sending, setSending] = useState(false)
  const [pulsing, setPulsing] = useState(false)
  const [showCompose, setShowCompose] = useState(false)

  async function onTap() {
    if (sending) return
    setSending(true)
    setPulsing(true)
    setTimeout(() => setPulsing(false), 600)
    triggerLoveMood?.()
    try {
      const msg = `${CUTE_MESSAGES[Math.floor(Math.random() * CUTE_MESSAGES.length)]} 🤍`
      await sendNudge(profile.couple_id, { body: msg })
      pushToast?.({
        emoji: '🤍',
        title: 'sent 🤍',
        body: `“${msg}” is on its way to ${partnerName}`,
      })
    } catch (e) {
      console.error(e)
      pushToast?.({ emoji: '⚠️', title: 'couldn\'t send', body: e.message })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="nudge-row">
        <button
          className={`nudge-btn ${pulsing ? 'pulsing' : ''}`}
          type="button"
          onClick={onTap}
          disabled={sending}
        >
          <span className="heart">♥</span>
          <span>thinking of you</span>
        </button>
        <button
          type="button"
          className="note-btn"
          onClick={() => setShowCompose(true)}
          aria-label="write a love note"
        >
          <Icon name="plus" size={16} stroke={2.4} /> note
        </button>
      </div>

      {showCompose && (
        <LoveNoteSheet
          coupleId={profile.couple_id}
          profile={profile}
          partner={partner}
          partnerName={partnerName}
          onClose={() => setShowCompose(false)}
          onSent={(scheduled) => {
            setShowCompose(false)
            pushToast?.({
              emoji: '💌',
              title: scheduled ? 'love note scheduled' : 'love note on its way',
              body: scheduled ? 'it\'ll arrive right when you set it' : `${partnerName} will get it in a heartbeat`,
            })
          }}
        />
      )}
    </>
  )
}
