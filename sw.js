const CACHE_NAME = "neon-alley-runtime-v2";
const CORE_FALLBACKS = ["./", "./index.html", "./css/style.css", "./js/core.js", "./icon.svg", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_FALLBACKS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("neon-alley-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function putSafe(cache, request, response) {
  if (response && response.ok && response.type === "basic") {
    await cache.put(request, response.clone()).catch(() => undefined);
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    return putSafe(cache, request, response);
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) return cached;
    return cache.match("./index.html") || cache.match("./") || Promise.reject(error);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: false });
  if (cached) return cached;

  const response = await fetch(request);
  return putSafe(cache, request, response);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // HTML stays network-first so deployments appear immediately. Versioned
  // CSS/JS URLs are safe to cache-first and make repeat launches much faster.
  event.respondWith(request.mode === "navigate" ? networkFirst(request) : cacheFirst(request));
});
