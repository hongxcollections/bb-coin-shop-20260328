// Web Push Service Worker — 大BB錢幣店
self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "大BB錢幣店", body: "您有新通知" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    if (event.data) data.body = event.data.text();
  }
  const opts = {
    body: data.body,
    icon: data.icon || "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag || "bb-notify",
    data: { url: data.url || "/" },
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(data.title, opts));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
