/* Minimal service worker: caches the app shell for offline start.
   Network-first for everything, so updates always win; never touches API calls, other sites, the APK or version.json. */
var CACHE = "hk-shell-v3", IMG = "hk-img-v1", IMG_MAX = 400;
var SHELL = ["./", "index.html", "features.html", "hark.css", "hark-hero.css", "hark.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(new Request(u, { cache: "reload" })).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE && k !== IMG; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.hostname === "i.ytimg.com") { e.respondWith(thumb(req, url)); return; } // cover art: cached so playlists look right offline
  if (url.origin !== self.location.origin) return;            // YouTube, APIs, fonts: straight to network
  if (/\.(apk|json)$/.test(url.pathname) || url.pathname.endsWith("/sw.js")) return;
  var isPage = req.mode === "navigate" || /\/(index\.html|features\.html)?$/.test(url.pathname);
  var isShell = isPage || /\.(css|js|png|webmanifest)$/.test(url.pathname);
  if (!isShell) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok && res.type === "basic") {
      var copy = res.clone(), key = isPage && req.mode === "navigate" ? (/features\.html$/.test(url.pathname) ? "features.html" : "index.html") : req;
      caches.open(CACHE).then(function (c) { c.put(key, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (r) {
      return r || (isPage ? caches.match(/features\.html$/.test(url.pathname) ? "features.html" : "index.html") : undefined) || Response.error();
    });
  }));
});

/* cover thumbnails: cache-first (i.ytimg.com sends CORS headers, so the cached copy is a normal, non-opaque response) */
var imgPuts = 0;
function thumb(req, url) {
  return caches.open(IMG).then(function (c) {
    return c.match(url.href).then(function (hit) {
      if (hit) return hit;
      return fetch(url.href, { mode: "cors", credentials: "omit" }).then(function (res) {
        if (res && res.ok) {
          c.put(url.href, res.clone());
          if (++imgPuts % 25 === 0) c.keys().then(function (ks) { ks.slice(0, Math.max(0, ks.length - IMG_MAX)).forEach(function (k) { c.delete(k); }); });
        }
        return res;
      }).catch(function () { return fetch(req); });
    });
  });
}
