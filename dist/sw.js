const CACHE = "itjima-shell-v3";
const SHELL = [
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/badge-72.png",
];
const PUSH_LOG = "[itjima:sw:push]";
const DEFAULT_TITLE = "잊지마";
const DEFAULT_BODY = "예정된 일정이 있어요.";
const NOTIFICATION_ICON = "/icons/icon-192.png";
const NOTIFICATION_BADGE = "/icons/badge-72.png";

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

function parsePushPayload(event) {
  if (!event.data) {
    return { payload: {}, parseMode: "empty" };
  }

  try {
    return { payload: event.data.json(), parseMode: "json" };
  } catch {
    try {
      const text = event.data.text();
      if (!text) return { payload: {}, parseMode: "empty-text" };
      return { payload: JSON.parse(text), parseMode: "text-json" };
    } catch {
      return { payload: {}, parseMode: "fallback" };
    }
  }
}

function buildNotificationOptions(payload, url) {
  const scheduleId = payload.data?.scheduleId;
  return {
    body: payload.body || DEFAULT_BODY,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    tag: payload.tag || (scheduleId ? `schedule-${scheduleId}` : "itjima-reminder"),
    data: {
      ...(payload.data && typeof payload.data === "object" ? payload.data : {}),
      url,
      scheduleId,
    },
    renotify: true,
  };
}

async function showPushNotification(payload, parseMode) {
  const scheduleId = payload.data?.scheduleId;
  const fallbackUrl = scheduleId
    ? `/schedule?open=${encodeURIComponent(String(scheduleId))}`
    : "/schedule";
  const url = safeAppPath(payload.data?.url, fallbackUrl);
  const title = payload.title || DEFAULT_TITLE;
  const options = buildNotificationOptions(payload, url);

  console.info(PUSH_LOG, "received", {
    parseMode,
    hasTitle: Boolean(payload.title),
    hasBody: Boolean(payload.body),
    hasUrl: Boolean(payload.data?.url),
    tag: options.tag,
  });

  try {
    await self.registration.showNotification(title, options);
    console.info(PUSH_LOG, "showNotification:ok", { tag: options.tag, url });
    return true;
  } catch (error) {
    console.warn(PUSH_LOG, "showNotification:failed", {
      tag: options.tag,
      message: error instanceof Error ? error.message : String(error),
    });

    await self.registration.showNotification(DEFAULT_TITLE, {
      body: DEFAULT_BODY,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_BADGE,
      tag: "itjima-push-fallback",
      data: { url: "/schedule" },
      renotify: true,
    });
    console.info(PUSH_LOG, "showNotification:fallback_ok");
    return false;
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
  const { payload, parseMode } = parsePushPayload(event);

  event.waitUntil(showPushNotification(payload, parseMode));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeAppPath(event.notification.data?.url, "/schedule");

  console.info(PUSH_LOG, "notificationclick", { url });

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
