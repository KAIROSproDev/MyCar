
const CACHE_NAME = "mycar-cache-v3";

const FILES = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./manifest.json",
  "./assets/icon.svg"
];

// Instalação: armazena os arquivos principais
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        for (const file of FILES) {
          try {
            await cache.add(file);
          } catch (error) {
            console.warn("Não foi possível armazenar:", file);
          }
        }
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação: remove versões antigas do cache
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith("mycar-cache-") && key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Busca: tenta o cache antes de acessar a internet
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Não intercepta outros sites
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;

        return fetch(event.request)
          .then(response => {
            if (
              response &&
              response.status === 200 &&
              response.type === "basic"
            ) {
              const copy = response.clone();

              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, copy));
            }

            return response;
          });
      })
      .catch(() => {
        // Se estiver offline, tenta entregar a página inicial
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }

        return new Response("Você está offline.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      })
  );
});
