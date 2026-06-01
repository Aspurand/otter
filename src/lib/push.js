// Web Push (OS-level notifications that wake the user even when the app is closed).
//
// Requirements:
//   - HTTPS (or localhost) so service workers + Push API are available.
//   - On iOS: the PWA must be installed to home screen ("Add to Home Screen").
//     iOS does NOT expose Notification.requestPermission() from a regular Safari tab.

import { supabase } from './supabase.js'
import { env } from './env.js'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined' &&
    !!VAPID_PUBLIC
  )
}

export async function currentPermission() {
  if (!pushSupported()) return 'unsupported'
  return Notification.permission // 'granted' | 'denied' | 'default'
}

export async function isPushSubscribed() {
  if (!pushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return !!sub
  } catch { return false }
}

// Subscribe this device: ask permission → make a PushSubscription → save to DB.
// Returns 'granted' | 'denied' | 'unsupported' | 'error:<message>'.
export async function subscribePush() {
  if (!pushSupported()) return 'unsupported'

  let perm = Notification.permission
  if (perm === 'default') {
    perm = await Notification.requestPermission()
  }
  if (perm !== 'granted') return perm // 'denied'

  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
    }
    await saveSubscription(sub)
    return 'granted'
  } catch (e) {
    return `error:${e?.message ?? e}`
  }
}

export async function unsubscribePush() {
  if (!pushSupported()) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      const endpoint = sub.endpoint
      await sub.unsubscribe()
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    }
  } catch (e) {
    console.error('unsubscribe failed', e)
  }
}

async function saveSubscription(sub) {
  const json = sub.toJSON()
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess.session?.user?.id
  if (!uid) throw new Error('not authenticated')
  const row = {
    user_id: uid,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: (navigator.userAgent ?? '').slice(0, 200),
  }
  // upsert by (user_id, endpoint) — same device re-subscribing is a no-op.
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'user_id,endpoint' })
  if (error) throw error
}

// VAPID public key is base64url; PushManager.subscribe wants a Uint8Array.
function urlBase64ToUint8Array(base64String) {
  const cleaned = base64String.replace(/\s+/g, '')
  const padding = '='.repeat((4 - (cleaned.length % 4)) % 4)
  const b64 = (cleaned + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

// silence unused-warning on env import in dev
void env
