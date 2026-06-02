// Minimalist line icons for the activity grid. Stroke = currentColor so they
// inherit the tile's text color (dark on default tile, accent on active tile,
// light in dark mode). 24x24 viewBox, ~1.7px stroke.

const ICONS = {
  // film strip / clapperboard
  movie: (
    <g>
      <rect x="3.5" y="6" width="17" height="13" rx="1.8" />
      <path d="M3.5 10h17M3.5 15h17M8 6v13M16 6v13" />
    </g>
  ),
  // phone with scroll lines
  reeling: (
    <g>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M9.5 7.5h5M9.5 11.5h5M9.5 15.5h3" />
      <circle cx="12" cy="19.2" r="0.6" fill="currentColor" stroke="none" />
    </g>
  ),
  // briefcase
  working: (
    <g>
      <rect x="3" y="7.5" width="18" height="12" rx="1.8" />
      <path d="M9 7.5V5.5a1.2 1.2 0 0 1 1.2-1.2h3.6a1.2 1.2 0 0 1 1.2 1.2v2" />
      <path d="M3 13h18" />
    </g>
  ),
  // speech bubble (in a meeting)
  meeting: (
    <g>
      <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2z" />
      <circle cx="8.5"  cy="9.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12"   cy="9.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="9.5" r="0.9" fill="currentColor" stroke="none" />
    </g>
  ),
  // two adults + child (family time)
  family: (
    <g>
      <circle cx="7" cy="6.5" r="2.2" />
      <circle cx="17" cy="6.5" r="2.2" />
      <circle cx="12" cy="12" r="1.6" />
      <path d="M3 21v-2.5a4 4 0 0 1 4-4 4 4 0 0 1 4 4V21" />
      <path d="M13 21v-2.5a4 4 0 0 1 4-4 4 4 0 0 1 4 4V21" />
      <path d="M9 21v-2a3 3 0 0 1 3-3 3 3 0 0 1 3 3v2" />
    </g>
  ),
  // lotus / meditation (me time)
  me: (
    <g>
      <circle cx="12" cy="6" r="2.2" />
      <path d="M12 8.5v3" />
      <path d="M4.5 19c2-3.5 5-5 7.5-5s5.5 1.5 7.5 5" />
      <path d="M4 19h16" />
    </g>
  ),
  // open book
  reading: (
    <g>
      <path d="M3 5.5c3-1.2 6-1.2 9 0V19c-3-1.2-6-1.2-9 0z" />
      <path d="M21 5.5c-3-1.2-6-1.2-9 0V19c3-1.2 6-1.2 9 0z" />
    </g>
  ),
  // wrench (building)
  building: (
    <g>
      <path d="M14.7 6.3a1.4 1.4 0 0 0 0 2l1 1a1.4 1.4 0 0 0 2 0L21 6c1 1.5.5 4-1 5.5a4 4 0 0 1-5 1l-8 8a1.6 1.6 0 0 1-2.3 0l-.4-.4a1.6 1.6 0 0 1 0-2.3l8-8a4 4 0 0 1 1-5C15 3 17.5 2.5 19 3.5z" />
    </g>
  ),
  // gamepad
  gaming: (
    <g>
      <rect x="2" y="7" width="20" height="11" rx="4.5" />
      <line x1="7" y1="11" x2="7" y2="14" />
      <line x1="5.5" y1="12.5" x2="8.5" y2="12.5" />
      <circle cx="17" cy="11" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13.5" r="0.95" fill="currentColor" stroke="none" />
    </g>
  ),
  // fork + knife
  eating: (
    <g>
      <path d="M7 3v8a2 2 0 0 0 2 2v9M9 3v6M5 3v6" />
      <path d="M16 3c-1.7 0-3 1.7-3 4s1.3 4 3 4h.5V22" />
    </g>
  ),
  // dumbbell
  workout: (
    <g>
      <line x1="4" y1="9" x2="4" y2="15" />
      <line x1="6.5" y1="6.5" x2="6.5" y2="17.5" />
      <line x1="17.5" y1="6.5" x2="17.5" y2="17.5" />
      <line x1="20" y1="9" x2="20" y2="15" />
      <line x1="6.5" y1="12" x2="17.5" y2="12" strokeWidth="2.5" />
    </g>
  ),
  // airplane
  travel: (
    <g>
      <path d="M21 14l-8.5-2-3-7-1.4.4 2.6 6.2-5 .8-2.2-1.8-1 .4 1.7 3.5-1.7 3.5 1 .4 2.2-1.8 5 .8-2.6 6.2 1.4.4 3-7L21 14z" />
    </g>
  ),
  // heart in thought-bubble vibe — "missing you"
  missing: (
    <g>
      <path d="M12 20.5s-6.5-4.2-8.5-7.7C1.7 9.5 3.5 5.5 6.5 5.5c1.8 0 2.8 1 3.5 2.2.7-1.2 1.7-2.2 3.5-2.2 3 0 4.8 4 3 7.3-2 3.5-8.5 7.7-8.5 7.7z" />
    </g>
  ),
  // moon (bedtime)
  bedtime: (
    <g>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </g>
  ),
}

export default function ActivityIcon({ name, size = 22, stroke = 1.7 }) {
  const path = ICONS[name]
  if (!path) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {path}
    </svg>
  )
}
