// Daily suggestion tailored to the partner's love language. Tap to compose a note
// pre-seeded with the prompt.

import { useMemo } from 'react'

const PROMPTS = {
  words: [
    'send them a compliment about something they did this week',
    'tell them one specific thing you noticed they\'re good at',
    'remind them of the last small thing they did that meant a lot',
  ],
  acts: [
    'do one small chore from their list — drop them a "done"',
    'plan something tiny for them — a 5-minute kindness',
    'offer help with the next admin task you know they\'re dreading',
  ],
  gifts: [
    'send a tiny token — a song link, a photo, a meme that\'s only for them',
    'order a snack to their door, even just one thing they love',
    'pick a future date and tell them a gift is on the way',
  ],
  time: [
    'block 30 minutes today for an undistracted call',
    'plan a synced activity tonight — same movie, same recipe, same playlist',
    'send a "free at __" — give them first dibs on your evening',
  ],
  touch: [
    'send a long voice note — let them hear you',
    'send a photo where they can see your face, not the room',
    'plan the next in-person moment in writing so it feels closer',
  ],
}

const LABELS = {
  words: 'words of affirmation',
  acts:  'acts of service',
  gifts: 'gifts',
  time:  'quality time',
  touch: 'physical touch',
}

function pickToday(prompts) {
  const d = new Date()
  // local-day hash so both partners see the same prompt regardless of timezone
  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return prompts[Math.abs(h) % prompts.length]
}

export default function LoveLanguagePrompt({ partner, onCompose }) {
  const ll = partner?.love_language
  const prompt = useMemo(() => (ll ? pickToday(PROMPTS[ll] ?? []) : null), [ll])

  if (!partner || !ll || !prompt) return null

  return (
    <section className="card ll-card">
      <p className="card-label"><span className="dot" /> their love language · {LABELS[ll]}</p>
      <p className="ll-prompt">{prompt}</p>
      <button className="text-link" type="button" onClick={() => onCompose?.(prompt)}>
        send a love note →
      </button>
    </section>
  )
}
