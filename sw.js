// Realm Bastion service worker (Netlify build only). 20261126-1711-c504786 and ["index.html", "app.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "assets/Barbarian.js", "assets/Knight.js", "assets/Mage.js", "assets/Rogue_Hooded.js", "assets/Skeleton_Mage.js", "assets/Skeleton_Minion.js", "assets/Skeleton_Rogue.js", "assets/Skeleton_Warrior.js", "assets/world.js"] are filled in by tools/netlify_zip.sh.
// index.html and app.js: network first (fresh on every launch with internet; 'no-cache' revalidates, so an unchanged
// file costs only a 304), cached copy offline. Everything else (models, icons): from this version's cache, so the game also runs offline. A new version gets a new cache name;
// the old one is deleted when the new worker takes over. version.json is never cached (the page checks it on launch).
const CACHE = 'realm-bastion-20261126-1711-c504786';
const CORE = ["index.html", "app.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "assets/Barbarian.js", "assets/Knight.js", "assets/Mage.js", "assets/Rogue_Hooded.js", "assets/Skeleton_Mage.js", "assets/Skeleton_Minion.js", "assets/Skeleton_Rogue.js", "assets/Skeleton_Warrior.js", "assets/world.js"];

// Safari refuses to serve a redirected response to a page load: copy it into a plain response first
async function clean(res) {
  if (!res || !res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('install', e => {
  self.skipWaiting();
  // save everything for offline play, one file at a time; a failure is skipped, never fatal
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    for (const f of CORE) {
      try { const res = await fetch(new Request(f, { cache: 'no-store' })); if (res && res.ok) await c.put(new URL(f, self.registration.scope).href, await clean(res)); } catch (err) {}
    }
  })().catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })().catch(() => {}));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json')) return;   // always the network
  const page = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  const fresh = page || url.pathname.endsWith('/app.js');
  if (fresh) {
    const key = new URL(page ? 'index.html' : 'app.js', self.registration.scope).href;
    e.respondWith((async () => {
      try {
        // a navigate request can't be re-used with options: fetch the plain URL instead
        const res = await clean(await fetch(new Request(key, { cache: 'no-cache', credentials: 'same-origin' })));
        if (res && res.ok) { const c = await caches.open(CACHE); await c.put(key, res.clone()); }
        return res;
      } catch (err) {
        const hit = await caches.match(key);
        return hit || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const key = url.origin + url.pathname;
    const hit = await caches.match(key);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok) { const c = await caches.open(CACHE); await c.put(key, res.clone()); }
      return res;
    } catch (err) { return Response.error(); }
  })());
});
