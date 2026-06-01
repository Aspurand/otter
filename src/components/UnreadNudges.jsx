// Persistent unread-nudge stack: a card per unread thinking-of-you / love-note from
// partner. Tap any card to mark it read and dismiss. Realtime + initial state are
// managed by App.jsx; this component only renders + handles taps.

import { relativeAgo } from '../lib/timezone.js'

export default function UnreadNudges({ items = [], partnerName = 'them', onDismiss }) {
  if (!items.length) return null
  return (
    <section className="unread-stack">
      {items.map((n) => {
        const isLove = n.kind === 'love_note'
        return (
          <button key={n.id} type="button" className="unread-card" onClick={() => onDismiss?.(n.id)}>
            <span className="unread-heart">♥</span>
            <div className="unread-text">
              <strong>
                {isLove ? `a love note from ${partnerName}` : `${partnerName} is thinking of you`}
              </strong>
              {n.body && <p>{n.body}</p>}
              <span className="unread-time">{relativeAgo(n.created_at) ?? 'just now'}</span>
            </div>
            <span className="unread-dismiss" aria-hidden>tap to clear</span>
          </button>
        )
      })}
    </section>
  )
}
