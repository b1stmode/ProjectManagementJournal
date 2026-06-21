const CACHE_NAME = 'pm-journal-v5';
const FONTS_CACHE = 'pm-journal-fonts';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/css/tokens.css',
  '/css/base.css',
  '/css/components/modal.css',
  '/css/components/projects.css',
  '/css/components/project-detail.css',
  '/css/components/tasks.css',
  '/css/components/home.css',
  '/css/components/sessions.css',
  '/css/components/calendar.css',
  '/js/app.js',
  '/js/router.js',
  '/js/db.js',
  '/js/config.js',
  '/js/supabase.js',
  '/js/sync.js',
  '/js/views/home.js',
  '/js/views/projects.js',
  '/js/views/project.js',
  '/js/utils/milestones.js',
  '/js/utils/modal.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== FONTS_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Google Fonts — cache on first use, serve from cache on repeat visits
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONTS_CACHE).then(async cache => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Navigation requests — network first, fall back to cached index.html (hash-based SPA)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(request).then(cached => cached ?? fetch(request))
  );
});
