// Liquid-glass bottom tab bar. 5 tabs: home, chat, us (memories), plans (calendar), play (games).

import Icon from './Icon.jsx'

const TABS = [
  { key: 'home',  label: 'home',  icon: 'heart' },
  { key: 'chat',  label: 'chat',  icon: 'chat' },
  { key: 'us',    label: 'us',    icon: 'photos' },
  { key: 'plans', label: 'plans', icon: 'cal' },
  { key: 'play',  label: 'play',  icon: 'play' },
]

export default function TabBar({ current, onChange, chatUnread = 0 }) {
  return (
    <nav className="tabbar" aria-label="primary">
      {TABS.map((tb) => {
        const on = current === tb.key
        const iconName = tb.key === 'home' && on ? 'heartFill' : tb.icon
        return (
          <button
            key={tb.key}
            className={`tab ${on ? 'on' : ''}`}
            onClick={() => onChange(tb.key)}
            aria-current={on ? 'page' : undefined}
            type="button"
          >
            {on && <span className="tab-blob" />}
            <Icon name={iconName} size={23} stroke={2} />
            <span>{tb.label}</span>
            {tb.key === 'chat' && chatUnread > 0 && <span className="badge">{chatUnread}</span>}
          </button>
        )
      })}
    </nav>
  )
}
