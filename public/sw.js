/* Service worker de Código Energía: sitio instalable y lectura sin conexión. */
const VERSION = "ce-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const IMAGES = `${VERSION}-img`;
const OFFLINE = "/offline";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll([OFFLINE, "/"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await c.delete(k);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // nunca cachear back office, API ni tareas
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/cron")) return;

  // estáticos versionados de Next: cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa-icon") || url.pathname === "/brand-icon") {
    e.respondWith(
      caches.open(STATIC).then(async (c) => (await c.match(req)) || fetch(req).then((r) => (r.ok && c.put(req, r.clone()), r))),
    );
    return;
  }

  // imágenes de notas (proxy): stale-while-revalidate
  if (url.pathname.startsWith("/api/img")) {
    e.respondWith(
      caches.open(IMAGES).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req)
          .then((r) => {
            if (r.ok) c.put(req, r.clone()).then(() => trim(IMAGES, 150));
            return r;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
    return;
  }

  // páginas: red primero (noticias frescas), y si no hay señal, la última copia o la página offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) caches.open(PAGES).then((c) => c.put(req, r.clone())).then(() => trim(PAGES, 60));
          return r;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(OFFLINE))),
    );
  }
});
