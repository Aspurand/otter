// "Remember this?" — surfaces an on-this-day or random old memory at the top
// of the Us tab. Stable per day, shared across both partners.

const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function yearsAgo(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  let y = now.getFullYear() - d.getFullYear()
  // Use month+day comparison since "exactly" 1 year ago matters for the label.
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) {
    y -= 1
  }
  return y
}

function isOnThisDay(iso) {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  // Compare in the viewer's LOCAL tz so the label matches what the RPC matched on.
  return d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

export default function ThrowbackCard({ memory, onZoom }) {
  if (!memory) return null

  const whenIso = memory.happened_at ?? memory.created_at
  const onThisDay = isOnThisDay(whenIso)
  const years = yearsAgo(whenIso)
  const header = onThisDay
    ? (years >= 1 ? `✨ ${years === 1 ? 'a year ago today' : `${years} years ago today`}` : '✨ on this day')
    : '✨ remember this?'

  return (
    <section className="throwback">
      <p className="throwback-pill">{header}</p>
      {memory.kind === 'photo' && memory.signed_url && (
        <button
          className="throwback-photo-btn"
          type="button"
          onClick={() => onZoom?.(memory.signed_url, memory.caption ?? '')}
          aria-label="view photo full screen"
        >
          <img className="throwback-photo" src={memory.signed_url} alt={memory.caption ?? ''} loading="lazy" />
        </button>
      )}
      {memory.kind === 'voice' && memory.signed_url && (
        <audio className="throwback-audio" controls src={memory.signed_url} />
      )}
      <div className="throwback-body">
        {memory.caption && (
          <p className="throwback-cap">
            {memory.kind === 'note' ? `"${memory.caption}"` : memory.caption}
          </p>
        )}
        <p className="throwback-date">{formatDate(whenIso)}</p>
      </div>
    </section>
  )
}
