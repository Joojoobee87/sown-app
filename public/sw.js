// Sown — push notification service worker

self.addEventListener('push', event => {
  const data = event.data?.json() || {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Sown garden reminder', {
      body:  data.body  || '',
      icon:  '/vite.svg',
      badge: '/vite.svg',
      data:  data.data  || {},
      tag:   'sown-monthly',        // replaces previous notification rather than stacking
      renotify: false,
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/calendar'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(url))
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})
