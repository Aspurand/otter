// send-push — fanout web-push notifications to all of a user's devices.
// Hardened version: hard-fails on missing secret, timing-safe compare, URL validation.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('SB_URL') ?? ''
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SB_SERVICE_ROLE_KEY') ?? ''
const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@otter.app'
const SHARED_SECRET = Deno.env.get('PUSH_SHARED_SECRET') ?? ''

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Constant-time string comparison.
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  if (ea.length !== eb.length) return false
  let diff = 0
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i]
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' })

  // Hard-fail if the shared secret isn't configured. We never want to silently
  // accept unauthenticated calls.
  if (!SHARED_SECRET) return json(500, { error: 'misconfigured' })
  const got = req.headers.get('x-push-secret') ?? ''
  if (!safeEqual(got, SHARED_SECRET)) return json(401, { error: 'bad secret' })

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json(500, { error: 'vapid not configured' })

  let payload: any
  try { payload = await req.json() }
  catch { return json(400, { error: 'invalid json' }) }

  const { user_id, title, body, url } = payload ?? {}
  if (!user_id || !title) return json(400, { error: 'user_id and title required' })

  // The SW always treats url as relative to its scope; force it to be a relative path
  // starting with /otter/. Anything else gets dropped.
  const safeUrl = (typeof url === 'string' && /^\/otter\/[^\s]*$/.test(url)) ? url : '/otter/'

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', user_id)
  if (error) return json(500, { error: error.message })

  const wireBody = JSON.stringify({
    title: String(title).slice(0, 120),
    body: typeof body === 'string' ? body.slice(0, 400) : '',
    url: safeUrl,
  })

  const results = await Promise.allSettled((subs ?? []).map(async (s: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        wireBody,
      )
      return { id: s.id, ok: true }
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', s.id)
        return { id: s.id, gone: true }
      }
      throw err
    }
  }))

  const sent  = results.filter(r => r.status === 'fulfilled').length
  const failed = results.length - sent
  return json(200, { sent, failed, total: results.length })
})
