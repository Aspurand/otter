// Wake-key context.
//
// iOS PWA + Android Chrome both silently kill the Supabase realtime WebSocket
// when the tab is backgrounded for more than ~30s. The SDK's auto-rejoin is
// unreliable, so we bump a counter on every wake event (visibilitychange,
// window focus, BFCache restore, network reconnect). Every channel-creating
// effect across the app depends on this counter — when it changes, the effect
// cleanup runs (remove the dead channel) and re-runs (create + subscribe a
// fresh one). That's the only way to guarantee live updates after wake.

import { createContext, useContext } from 'react'

export const WakeContext = createContext(0)
export const useWakeKey = () => useContext(WakeContext)
