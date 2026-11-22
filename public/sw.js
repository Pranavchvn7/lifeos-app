/* LifeOS service worker. It only shows push notifications and opens the app when one is tapped. It caches nothing. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title.slice(0, 80) : "LifeOS";
  const body = typeof data.body === "string" ? data.body.slice(0, 200) : "";
  const tag = typeof data.tag === "string" && data.tag ? data.tag.slice(0, 40) : "lifeos";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/__grok/icon-192.png",
      badge: "/__grok/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Always open the app's own home page, never an address taken from the message.
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow("/");
    })(),
  );
});
