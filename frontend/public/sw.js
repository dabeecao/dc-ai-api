const CACHE_NAME = 'dc-ai-chat-v1';
const ASSETS_TO_CACHE = [
  '/chat',
  '/admin/chat.html',
  '/admin/manifest.json',
  '/admin/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip cross-origin requests unless they are fonts
  if (url.origin !== self.location.origin) {
    if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
      event.respondWith(
        caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request).then(networkResponse => {
            if (networkResponse.ok) {
              const cacheCopy = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, cacheCopy));
            }
            return networkResponse;
          });
        })
      );
    }
    return;
  }

  // Exclude API calls and non-GET requests from caching
  if (url.pathname.includes('/api/') || 
      url.pathname.includes('/v1/') || 
      url.pathname.includes('/v1beta/') || 
      url.pathname.includes('/openai/') || 
      url.pathname.includes('/models') || 
      url.pathname.includes('/messages') ||
      event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Return cached, and dynamically fetch to update the cache in the background (Stale-While-Revalidate)
        fetch(event.request).then(networkResponse => {
          if (networkResponse.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Ignore network failures in background */});
        return cachedResponse;
      }

      return fetch(event.request).then(response => {
        // Cache newly loaded static assets like Vite chunks
        if (response.ok && (url.pathname.includes('/assets/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.svg'))) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});
