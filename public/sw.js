const CACHE = 'duibei-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        if (res.ok) caches.open(CACHE).then((cache) => cache.put(req, copy))
        return res
      })
      .catch(() => caches.match(req).then((hit) => hit || Promise.reject())),
  )
})
