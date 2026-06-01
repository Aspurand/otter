import { useMemo, useState } from 'react'
import Brand from '../components/Brand.jsx'
import PresenceBar from '../components/PresenceBar.jsx'
import ReunionCountdown from '../components/ReunionCountdown.jsx'
import NudgeButton from '../components/NudgeButton.jsx'
import LoveLanguagePrompt from '../components/LoveLanguagePrompt.jsx'
import RitualCard from '../components/RitualCard.jsx'
import LoveNoteSheet from '../components/LoveNoteSheet.jsx'
import UnreadNudges from '../components/UnreadNudges.jsx'

export default function Home({
  profile,
  partner,
  presence,
  mascotMood = 'happy',
  unreadNudges = [],
  onDismissNudge,
  onPatchProfile,
  onOpenSettings,
  pushToast,
  triggerLoveMood,
}) {
  const [noteSeed, setNoteSeed] = useState(null)

  const greeting = useMemo(() => greet(profile.display_name), [profile.display_name])
  const partnerName = partner?.display_name ?? 'them'

  const partnerStatus = partner ? (presence[partner.id]?.status ?? partner.status ?? 'free') : 'free'

  return (
    <div className="otter-scroll screen-enter">
      <Brand tagline={greeting} mood={mascotMood} onSettings={onOpenSettings} />

      <UnreadNudges
        items={unreadNudges}
        partnerName={partnerName}
        onDismiss={onDismissNudge}
      />

      <PresenceBar
        profile={profile}
        partner={partner}
        presence={presence}
        onStatusChange={(s) => onPatchProfile({ status: s, last_active: new Date().toISOString() })}
      />

      <ReunionCountdown coupleId={profile.couple_id} />

      <NudgeButton
        profile={profile}
        partnerName={partnerName}
        pushToast={pushToast}
        triggerLoveMood={triggerLoveMood}
      />

      <RitualCard
        profile={profile}
        partner={partner}
        partnerStatus={partnerStatus}
        pushToast={pushToast}
      />

      <LoveLanguagePrompt
        partner={partner}
        onCompose={(seed) => setNoteSeed(seed)}
      />

      {noteSeed != null && (
        <LoveNoteSheet
          coupleId={profile.couple_id}
          initialBody={typeof noteSeed === 'string' ? noteSeed : ''}
          onClose={() => setNoteSeed(null)}
          onSent={(scheduled) => {
            setNoteSeed(null)
            pushToast?.({
              emoji: '💌',
              title: scheduled ? 'love note scheduled' : 'love note on its way',
              body: scheduled ? 'it\'ll land at the time you picked' : `${partnerName} will get it in a heartbeat`,
            })
          }}
        />
      )}
    </div>
  )
}

function greet(name) {
  const hour = new Date().getHours()
  const tod = hour < 5 ? 'still up' : hour < 12 ? 'good morning' : hour < 18 ? 'hi' : 'evening'
  return name ? `${tod}, ${name}` : `${tod}.`
}
