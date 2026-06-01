// otter service worker — workbox precache + Web Push handler.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

const SCOPE = self.registration.scope // ends with '/' — e.g. https://host/otter/

// ─── push ────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = { title: 'otter', body: '', url: SCOPE }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch (e) {
    console.warn('push payload not json', e)
  }

  // Force same-origin. The server should already only send `/otter/...` paths,
  // but defend in depth so a leaked secret can't open attacker pages.
  let targetUrl = SCOPE
  try {
    const t = new URL(payload.url ?? SCOPE, SCOPE)
    if (t.origin === self.location.origin) targetUrl = t.href
  } catch { /* ignore — fall back to SCOPE */ }

  const opts = {
    body: payload.body || ' ', // iOS Safari sometimes drops empty-body notifications
    icon:  `${SCOPE}pwa-192.png`,
    badge: `${SCOPE}pwa-192.png`,
    data: { url: targetUrl },
    tag: payload.kind || 'otter',
    renotify: true,
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(payload.title || 'otter', opts))
})

// ─── notificationclick: focus existing tab on the same URL first ─────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? SCOPE
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Prefer an exact URL match, then same-scope, then fall back to opening a new window.
    const exact = wins.find((w) => w.url === targetUrl)
    if (exact?.focus) return exact.focus()
    const sameScope = wins.find((w) => w.url.startsWith(SCOPE))
    if (sameScope?.focus) return sameScope.focus()
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    return null
  })())
})

self.addEventListener('install',  () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
