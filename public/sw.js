const CACHE = "itjima-shell-v4";
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

self.addEventListener("install", (event) => {
  self.skipWaiting();
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

function sanitizePushLogMessage(error) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/https?:\/\/[^\s]+/g, "[redacted]")
    .replace(/[A-Za-z0-9+/=_-]{32,}/g, "[redacted]")
    .slice(0, 160);
}

function formatDiagnosticBody(payload) {
  const base = payload.body || DEFAULT_BODY;
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  if (data.source !== "server-web-push") return base;

  const deliveryId =
    typeof data.deliveryId === "string" ? data.deliveryId.slice(0, 8) : null;
  const serverSentAt =
    typeof data.serverSentAt === "string" ? data.serverSentAt : null;
  if (!deliveryId && !serverSentAt) return base;

  const sentLabel = serverSentAt
    ? new Date(serverSentAt).toISOString().slice(11, 19)
    : "";
  return `${base} [${deliveryId ?? "--------"}@${sentLabel}]`;
}

function showPushNotification(payload, parseMode) {
  const scheduleId = payload.data?.scheduleId;
  const fallbackUrl = scheduleId
    ? `/schedule?open=${encodeURIComponent(String(scheduleId))}`
    : "/schedule";
  const url = safeAppPath(payload.data?.url, fallbackUrl);
  const title = payload.title || DEFAULT_TITLE;
  const body = formatDiagnosticBody(payload);
  const swShownAt = new Date().toISOString();
  const tag = payload.tag || (scheduleId ? `schedule-${scheduleId}` : "itjima-reminder");

  console.info(PUSH_LOG, "received", {
    parseMode,
    source: payload.data?.source ?? null,
    hasDeliveryId: Boolean(payload.data?.deliveryId),
    tag,
  });

  const data = {
    ...(payload.data && typeof payload.data === "object" ? payload.data : {}),
    url,
    scheduleId,
    swShownAt,
  };

  return self.registration
    .showNotification(title, { body, tag, data })
    .then(() => {
      console.info(PUSH_LOG, "showNotification:ok", { tag, swShownAt });
    })
    .catch((error) => {
      console.warn(PUSH_LOG, "showNotification:failed", {
        tag,
        message: sanitizePushLogMessage(error),
      });
      return self.registration.showNotification(title, { body }).then(() => {
        console.info(PUSH_LOG, "showNotification:fallback_ok", { tag, swShownAt });
      });
    })
    .catch((fallbackError) => {
      console.warn(PUSH_LOG, "showNotification:fallback_failed", {
        tag,
        message: sanitizePushLogMessage(fallbackError),
      });
    });
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

/** Server-triggered Web Push — show immediately; never wait for open clients. */
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
