const INTERVAL = 10 * 60 * 1000;
const CACHE = "umc-live";
let pollTimer = 0;
let lastPull = 0;
let iosMode = false;

async function pull() {
  const now = Date.now();
  if (now - lastPull < 15000) return;
  lastPull = now;
  try {
    const res = await fetch("/api/luu-luong", { cache: "no-store" });
    if (!res.ok) return;
    const body = await res.json();
    if (!body?.ok || !body.days?.length) return;
    const cache = await caches.open(CACHE);
    await cache.put(
      "/api/luu-luong",
      new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }),
    );
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      client.postMessage({ type: "sheet-update", days: body.days });
    }
  } catch {
    /* offline */
  }
}

function startPoll(ms, ios) {
  iosMode = !!ios;
  if (pollTimer) clearInterval(pollTimer);
  // iOS suspends SW timers — keep interval only as a best-effort while SW is awake.
  pollTimer = setInterval(() => {
    void pull();
  }, ms || INTERVAL);
  void pull();
}

async function pushCached() {
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match("/api/luu-luong");
    if (!hit) return;
    const body = await hit.json();
    if (!body?.days?.length) return;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      client.postMessage({ type: "sheet-update", days: body.days });
    }
  } catch {
    /* ignore */
  }
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await pushCached();
      if (!iosMode) startPoll(INTERVAL, false);
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "start-poll") startPoll(data.interval || INTERVAL, data.ios);
  if (data.type === "pull" || data.type === "wake") event.waitUntil(pull());
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "umc-sheet") event.waitUntil(pull());
});

self.addEventListener("sync", (event) => {
  if (event.tag === "umc-sheet") event.waitUntil(pull());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === "/api/luu-luong") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(event.request);
          if (fresh.ok) {
            const copy = fresh.clone();
            const cache = await caches.open(CACHE);
            await cache.put("/api/luu-luong", copy);
          }
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          const hit = await cache.match("/api/luu-luong");
          if (hit) return hit;
          throw new Error("offline");
        }
      })(),
    );
    return;
  }

  // iOS: mọi lần mở trang đều đánh thức SW kéo sheet.
  // Không chặn /_serverFn hay /api/auth — intercept toàn bộ fetch dễ gây Failed to fetch.
  if (event.request.mode === "navigate") {
    event.waitUntil(pull());
  }
});
