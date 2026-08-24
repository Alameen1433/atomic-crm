/* Retires the navigation service worker installed by older Xenora CRM builds. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      await self.registration.unregister();

      const openClients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: "window",
      });
      await Promise.all(openClients.map((client) => client.navigate(client.url)));
    })(),
  );
});
