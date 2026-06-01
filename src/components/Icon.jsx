// Minimal line-icon set shared across the app.

export default function Icon({ name, size = 23, stroke = 2 }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const fillP = { fill: 'currentColor' }
  const paths = {
    home: <path {...p} d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z" />,
    heart: <path {...p} d="M12 20s-7-4.4-9.2-8.5C1.3 8.6 2.8 5 6 5c2 0 3.2 1.3 4 2.5C10.8 6.3 12 5 14 5c3.2 0 4.7 3.6 3.2 6.5C19 15.6 12 20 12 20z" />,
    heartFill: <path {...fillP} d="M12 20s-7-4.4-9.2-8.5C1.3 8.6 2.8 5 6 5c2 0 3.2 1.3 4 2.5C10.8 6.3 12 5 14 5c3.2 0 4.7 3.6 3.2 6.5C19 15.6 12 20 12 20z" />,
    chat: <path {...p} d="M4 5h16v11H9l-4 3v-3H4z" />,
    photos: (
      <g {...p}>
        <rect x="3" y="6" width="14" height="12" rx="2" />
        <path d="M7 4h14v12" />
        <circle cx="8.5" cy="11" r="1.6" />
        <path d="M3 15l3-3 4 4" />
      </g>
    ),
    cal: (
      <g {...p}>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M3.5 9h17M8 3v4M16 3v4" />
      </g>
    ),
    play: (
      <g {...p}>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="9"    cy="10" r="1.1" {...fillP} stroke="none" />
        <circle cx="15"   cy="10" r="1.1" {...fillP} stroke="none" />
        <circle cx="9.5"  cy="15" r="1.1" {...fillP} stroke="none" />
        <circle cx="14.5" cy="15" r="1.1" {...fillP} stroke="none" />
      </g>
    ),
    gear: (
      <g {...p}>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1L5.3 5.3" />
      </g>
    ),
    send:  <path {...fillP} d="M3.4 11.2 19.6 4c.7-.3 1.4.4 1.1 1.1l-7.2 16.2c-.3.7-1.3.6-1.5-.1l-1.6-5.6a1 1 0 0 0-.7-.7l-5.6-1.6c-.7-.2-.8-1.2-.1-1.5z" />,
    back:  <path {...p} d="M14 6l-6 6 6 6" />,
    plus:  <path {...p} d="M12 5v14M5 12h14" />,
    play2: <path {...fillP} d="M8 5v14l11-7z" />,
    check: <path {...p} d="M5 12l5 5 9-10" />,
    moon:  <path {...p} d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
    sun: (
      <g {...p}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4" />
      </g>
    ),
  }
  return <svg width={size} height={size} viewBox="0 0 24 24">{paths[name]}</svg>
}
