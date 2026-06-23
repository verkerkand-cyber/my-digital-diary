// My Digital Journal — Service Worker
// Handles push notifications even when the app/browser tab is closed.
// This file MUST be served from the root of the site (same place as index.html)
// for its scope to cover the whole app.

self.addEventListener('install', function(event){
  self.skipWaiting(); // activate immediately, don't wait for old tabs to close
});

self.addEventListener('activate', function(event){
  event.waitUntil(self.clients.claim());
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
