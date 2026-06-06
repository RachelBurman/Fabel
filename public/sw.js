const CACHE = 'fable-shell-v1'

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(['/']))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  // Only intercept same-origin navigation requests (page loads).
  // API calls, external resources, etc. pass through untouched.
  const { request } = event
  if (request.mode !== 'navigate') return
  if (!request.url.startsWith(self.location.origin)) return

  event.respondWith(
    fetch(request).catch(() =>
      caches.match('/').then(r => r ?? Response.error())
    )
  )
})
