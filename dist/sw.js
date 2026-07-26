const CACHE = "itjima-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((r) => r ?? caches.match("/index.html")),
      ),
  );
});

/** Server-triggered Web Push — no in-memory scheduling. */
self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = {};
  }

  const title = payload.title ?? "⏰ 잊지마";
  const body = payload.body ?? "예정된 일정 알림";
  const scheduleId = payload.data?.scheduleId;
  const url =
    payload.data?.url ??
    (scheduleId ? `/schedule?open=${scheduleId}` : "/schedule");

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: payload.tag ?? (scheduleId ? `schedule-${scheduleId}` : "itjima-reminder"),
      data: { url, scheduleId },
      icon: "/favicon.svg",
      badge: "/favicon.svg",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data;
  const url = data?.url ?? "/schedule";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client && "navigate" in client) {
            void client.focus();
            void client.navigate(url);
            return;
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
