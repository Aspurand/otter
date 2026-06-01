import { useState } from 'react'
import DailyQuestion from '../components/DailyQuestion.jsx'
import WouldYouRather from '../components/WouldYouRather.jsx'
import Icon from '../components/Icon.jsx'

export default function Games({ profile, partner }) {
  const [view, setView] = useState('hub') // 'hub' | 'dq' | 'wyr'

  if (view === 'dq') {
    return (
      <div className="otter-scroll screen-enter">
        <button className="game-back" type="button" onClick={() => setView('hub')}>
          <Icon name="back" size={16} stroke={2.6} /> play
        </button>
        <DailyQuestion profile={profile} partner={partner} />
      </div>
    )
  }
  if (view === 'wyr') {
    return (
      <div className="otter-scroll screen-enter">
        <button className="game-back" type="button" onClick={() => setView('hub')}>
          <Icon name="back" size={16} stroke={2.6} /> play
        </button>
        <WouldYouRather profile={profile} partner={partner} />
      </div>
    )
  }

  return (
    <div className="otter-scroll screen-enter">
      <header className="scr-head">
        <div className="htext">
          <h1>play</h1>
          <p className="sub">little things, only the two of you</p>
        </div>
      </header>

      <div className="game-tiles">
        <button className="game-tile" type="button" onClick={() => setView('dq')}>
          <div className="game-emoji">💭</div>
          <div className="gt">
            <strong>daily question</strong>
            <span>one prompt a day — answers reveal when you both reply</span>
          </div>
        </button>
        <button className="game-tile" type="button" onClick={() => setView('wyr')}>
          <div className="game-emoji">⚖️</div>
          <div className="gt">
            <strong>would you rather</strong>
            <span>pick a side · see if you match</span>
          </div>
        </button>
      </div>
    </div>
  )
}
