/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

const CACHE = "itjima-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg"];

type ReminderPayload = {
  id: string;
  title: string;
  fireAt: string;
};

const scheduled = new Map<string, number>();

function clearReminder(id: string) {
  const existing = scheduled.get(id);
  if (existing !== undefined) {
    clearTimeout(existing);
    scheduled.delete(id);
  }
}

function scheduleReminder(payload: ReminderPayload) {
  clearReminder(payload.id);
  const delay = new Date(payload.fireAt).getTime() - Date.now();
  if (delay <= 0 || delay > 7 * 24 * 60 * 60 * 1000) return;
  const timer = setTimeout(async () => {
    scheduled.delete(payload.id);
    await self.registration.showNotification("⏰ 잊지마", {
      body: payload.title,
      tag: `schedule-${payload.id}`,
      data: { scheduleId: payload.id, url: "/schedule" },
      icon: "/favicon.svg",
      badge: "/favicon.svg",
    });
  }, delay) as unknown as number;
  scheduled.set(payload.id, timer);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
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
      .catch(() => caches.match(event.request).then((r) => r ?? caches.match("/index.html")!)),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data as
    | { type: "SCHEDULE_REMINDERS"; reminders: ReminderPayload[] }
    | { type: "CANCEL_REMINDER"; id: string }
    | { type: "CLEAR_ALL" };
  if (!data || typeof data !== "object") return;

  if (data.type === "CLEAR_ALL") {
    for (const id of scheduled.keys()) clearReminder(id);
    return;
  }
  if (data.type === "CANCEL_REMINDER") {
    clearReminder(data.id);
    return;
  }
  if (data.type === "SCHEDULE_REMINDERS") {
    for (const id of scheduled.keys()) clearReminder(id);
    for (const r of data.reminders) scheduleReminder(r);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data as { url?: string } | undefined)?.url ?? "/schedule";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          void client.focus();
          void (client as WindowClient).navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
