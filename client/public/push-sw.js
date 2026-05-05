// Web Push Service Worker — hongxcollections
self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "hongxcollections", body: "您有新通知" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    if (event.data) data.body = event.data.text();
  }

  // 1. 通知所有開住嘅頁面（即使前景）— 顯示 in-app toast + 播鈴聲 + 即時 refresh
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clientsList) {
        try { c.postMessage({ type: "PUSH", payload: data }); } catch {}
      }

      // 2. 系統通知（背景或鎖屏時用戶睇到）
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || "/favicon.ico",
        badge: "/favicon.ico",
        tag: data.tag || "bb-notify",
        data: { url: data.url || "/" },
        requireInteraction: true,
        vibrate: [200, 100, 200],
        renotify: true,
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || "/";
  // 若是相對路徑，用 service worker 的 scope 補全（避免 Railway 內部域名出現）
  const url = rawUrl.startsWith("http")
    ? rawUrl
    : new URL(rawUrl, self.registration.scope).href;
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
