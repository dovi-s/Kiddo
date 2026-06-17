// Kiddo PWA service worker.
//
// Design goal: make the installed PWA feel like a real app (offline shell,
// instant repeat loads, push notifications) WITHOUT ever serving stale content
// while online — because the web app is actively developed and loved as-is.
//
//  • API (/api/*) and all non-GET requests: NEVER cached. Always live.
//  • Navigations / HTML: NETWORK-FIRST. Fresh when online; cached shell offline.
//  • Hashed static assets (immutable filenames): cache-first (safe — new builds
//    produce new filenames, so there is no stale-asset risk).
//  • Push + notificationclick handlers: ready for web push once a subscription
//    + VAPID keys + backend send are wired.
const CACHE = "kiddo-v1";
const SHELL = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png", "/favicon.svg"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // mutations etc. always hit the network
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // only same-origin
  if (url.pathname.startsWith("/api/")) return; // API is always live, never cached

  // Immutable hashed assets → cache-first (fast repeat loads, zero stale risk).
  if (/\.[0-9a-f]{8,}\.(js|css|woff2?|png|jpe?g|svg|ttf|webp)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else (navigations, non-hashed assets) → network-first, cache fallback.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
  );
});

// ── Web push ────────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Kiddo", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if (c.url.includes(target) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    }),
  );
});
