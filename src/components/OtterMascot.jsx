// Parametric otter mascot. Mood is derived from app state — partner asleep
// (sleepy), nudge sent (love), reunion <= 5 days (excited), else happy.

export default function OtterMascot({ mood = 'happy', size = 48 }) {
  const sleepy  = mood === 'sleepy'
  const love    = mood === 'love'
  const excited = mood === 'excited'
  const blush   = love ? 0.85 : excited ? 0.7 : 0.5

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label={`otter feeling ${mood}`}
      style={{
        borderRadius: size * 0.29,
        boxShadow: '0 2px 8px rgba(43,34,48,.18)',
        display: 'block',
        overflow: 'visible',
        flex: '0 0 auto',
      }}
    >
      <rect width="512" height="512" rx="112" ry="112" fill="var(--accent)" />
      <ellipse cx="256" cy="430" rx="170" ry="40" fill="#000" opacity="0.12" />

      {/* ears */}
      <circle cx="158" cy="170" r="42" fill="#a26b54" />
      <circle cx="354" cy="170" r="42" fill="#a26b54" />
      <circle cx="158" cy="170" r="20" fill="#e6a48c" />
      <circle cx="354" cy="170" r="20" fill="#e6a48c" />

      {/* head + muzzle */}
      <ellipse cx="256" cy="280" rx="172" ry="158" fill="#c98a6e" />
      <ellipse cx="256" cy="335" rx="120" ry="108" fill="#fce5d3" />

      {/* blush */}
      <circle cx="150" cy="335" r="24" fill="#f4a5b0" opacity={blush} />
      <circle cx="362" cy="335" r="24" fill="#f4a5b0" opacity={blush} />

      {/* eyes */}
      {sleepy ? (
        <g stroke="#2b2230" strokeWidth="7" fill="none" strokeLinecap="round">
          <path d="M 182 272 Q 200 286 218 272" />
          <path d="M 294 272 Q 312 286 330 272" />
        </g>
      ) : love ? (
        <g fill="#d14b62">
          <path d="M 200 258 c -7 -11 -25 -10 -25 5 c 0 11 16 20 25 27 c 9 -7 25 -16 25 -27 c 0 -15 -18 -16 -25 -5 z" />
          <path d="M 312 258 c -7 -11 -25 -10 -25 5 c 0 11 16 20 25 27 c 9 -7 25 -16 25 -27 c 0 -15 -18 -16 -25 -5 z" />
        </g>
      ) : (
        <g>
          <circle cx="200" cy="270" r="22" fill="#2b2230" />
          <circle cx="312" cy="270" r="22" fill="#2b2230" />
          <circle cx="208" cy="262" r="8" fill="#fff" />
          <circle cx="194" cy="278" r="3" fill="#fff" />
          <circle cx="320" cy="262" r="8" fill="#fff" />
          <circle cx="306" cy="278" r="3" fill="#fff" />
        </g>
      )}

      {/* nose */}
      <path
        d="M 238 322 Q 256 350 274 322 Q 270 314 256 314 Q 242 314 238 322 Z"
        fill="#2b2230"
      />

      {/* mouth */}
      {excited ? (
        <path
          d="M 230 350 Q 256 388 282 350"
          stroke="#2b2230"
          strokeWidth="6"
          fill="#b8455a"
          strokeLinecap="round"
        />
      ) : (
        <g stroke="#2b2230" strokeWidth="5" fill="none" strokeLinecap="round">
          <path d="M 256 348 Q 256 372 232 368" />
          <path d="M 256 348 Q 256 372 280 368" />
        </g>
      )}

      {/* whiskers */}
      <g stroke="#7a4634" strokeWidth="3" strokeLinecap="round" opacity="0.7">
        <line x1="170" y1="346" x2="118" y2="338" />
        <line x1="170" y1="358" x2="118" y2="362" />
        <line x1="342" y1="346" x2="394" y2="338" />
        <line x1="342" y1="358" x2="394" y2="362" />
      </g>

      {/* forehead heart */}
      <path
        d="M 256 200 c -6 -10 -22 -10 -22 4 c 0 10 14 18 22 24 c 8 -6 22 -14 22 -24 c 0 -14 -16 -14 -22 -4 z"
        fill="#f4a5b0"
        opacity="0.85"
      />

      {/* mood accessories */}
      {sleepy && (
        <g fill="#fff" fontFamily="Nunito, sans-serif" fontWeight="800">
          <text x="392" y="150" fontSize="56" opacity="0.95">z</text>
          <text x="430" y="108" fontSize="40" opacity="0.8">z</text>
        </g>
      )}
      {love && (
        <g fill="#fff">
          <path
            d="M 408 120 c -8 -13 -28 -12 -28 6 c 0 13 18 23 28 31 c 10 -8 28 -18 28 -31 c 0 -18 -20 -19 -28 -6 z"
            opacity="0.95"
          />
        </g>
      )}
      {excited && (
        <g fill="#fff">
          <path d="M408 92 l6 16 16 6 -16 6 -6 16 -6-16 -16-6 16-6z" opacity="0.95" />
          <path d="M104 132 l4 11 11 4 -11 4 -4 11 -4-11 -11-4 11-4z" opacity="0.8" />
        </g>
      )}
    </svg>
  )
}
