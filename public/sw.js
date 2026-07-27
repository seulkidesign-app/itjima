const CACHE = "itjima-shell-v2";
const SHELL = ["/index.html", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put("/index.html", response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match("/index.html");
    return (
      cached ??
      new Response("잊지마를 오프라인에서 불러오지 못했어요.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstStatic(request) {
  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("offline asset unavailable");
  }
}

function safeAppPath(value, fallback = "/schedule") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, self.location.origin);
    if (parsed.origin !== self.location.origin) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirstAsset(request));
    return;
  }

  if (["style", "script", "image", "font", "manifest"].includes(request.destination)) {
    event.respondWith(networkFirstStatic(request));
  }
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
  const fallbackUrl = scheduleId
    ? `/schedule?open=${encodeURIComponent(String(scheduleId))}`
    : "/schedule";
  const url = safeAppPath(payload.data?.url, fallbackUrl);

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
  const url = safeAppPath(event.notification.data?.url, "/schedule");

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clients) {
        if (!("focus" in client) || !("navigate" in client)) continue;
        const navigated = await client.navigate(url);
        if (navigated && "focus" in navigated) {
          return navigated.focus();
        }
        return client.focus();
      }

      return self.clients.openWindow(url);
    })(),
  );
});
