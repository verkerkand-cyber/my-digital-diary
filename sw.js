// My Digital Diary — Service Worker  (DIARY-SW-2 · DIARY-PRINT-1)
// 1) Push notifications (reminders) — works even when the app/browser tab is closed.
// 2) Small offline cache of the app shell, so the installed app opens without signal.
//    index.html is NETWORK-FIRST: whenever there is internet the newest version is used,
//    the cache is only a fallback. Supabase / CDN requests are never cached here.
// This file MUST be served from the same folder as index.html for its scope to cover the app.

var CACHE = 'mdd-shell-v3';
var SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
             './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function(event){
  self.skipWaiting(); // activate immediately, don't wait for old tabs to close
  event.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(SHELL.map(function(u){ return c.add(u).catch(function(){}); }));
  }));
});

self.addEventListener('activate', function(event){
  event.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k.indexOf('mdd-shell-')===0 && k!==CACHE; })
                           .map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(event){
  var req = event.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return; // Supabase, CDNs, Paystack: straight to network
  var isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
  if(isPage){
    // network-first so updates arrive immediately; cached copy only when offline
    event.respondWith(fetch(req).then(function(res){
      if(res && res.ok){ var cp = res.clone(); caches.open(CACHE).then(function(c){ c.put('./index.html', cp); }); }
      return res;
    }).catch(function(){
      return caches.match('./index.html').then(function(r){ return r || caches.match('./'); });
    }));
    return;
  }
  // icons / manifest: cache-first, refreshed in the background
  event.respondWith(caches.match(req, {ignoreSearch:true}).then(function(hit){
    var net = fetch(req).then(function(res){
      if(res && res.ok){ var cp = res.clone(); caches.open(CACHE).then(function(c){ c.put(req, cp); }); }
      return res;
    }).catch(function(){ return hit; });
    return hit || net;
  }));
});

// Fired when a push message arrives from the server, even if no tab is open.
self.addEventListener('push', function(event){
  var data = {};
  try{
    data = event.data ? event.data.json() : {};
  }catch(e){
    data = { title: 'My Digital Journal', body: event.data ? event.data.text() : '' };
  }

  var title = data.title || 'My Digital Journal';
  var options = {
    body: data.body || "Haven't journaled in a while — your journal's still here.",
    tag: 'mdd-reminder', // replaces any existing reminder notification rather than stacking
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { url: data.url || 'https://verkerkand-cyber.github.io/my-digital-diary/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Fired when the user taps/clicks the notification itself.
self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) ||
                   'https://verkerkand-cyber.github.io/my-digital-diary/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList){
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('my-digital-diary') !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
