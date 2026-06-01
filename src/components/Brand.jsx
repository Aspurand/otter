// Wordmark + live mascot header. Used by Home and the splash/sign-in screens.

import OtterMascot from './OtterMascot.jsx'

export default function Brand({ tagline, mood = 'happy', size = 50, onSettings }) {
  return (
    <header className="scr-head">
      <OtterMascot mood={mood} size={size} />
      <div className="htext">
        <h1>otter</h1>
        {tagline && <p className="sub">{tagline}</p>}
      </div>
      {onSettings && (
        <>
          <div className="spacer" />
          <button className="icon-btn" onClick={onSettings} aria-label="settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1L5.3 5.3" />
            </svg>
          </button>
        </>
      )}
    </header>
  )
}
