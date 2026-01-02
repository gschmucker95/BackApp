// Service Worker for BackApp Push Notifications
self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New notification from BackApp',
      icon: '/vite.svg',
      badge: '/vite.svg',
      tag: data.tag || 'backapp-notification',
      data: data.data || {},
      requireInteraction: data.data?.type === 'backup_failed' || data.data?.type === 'consecutive_failures',
      actions: getActionsForType(data.data?.type),
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'BackApp', options)
    );
  } catch (err) {
    console.error('Error showing notification:', err);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/dashboard';

  // Navigate based on notification type
  if (data.type === 'backup_started' || data.type === 'backup_success' || data.type === 'backup_failed') {
    if (data.profile_id) {
      url = `/backup-profiles/${data.profile_id}`;
    }
  } else if (data.type === 'consecutive_failures') {
    if (data.profile_id) {
      url = `/backup-runs?profile_id=${data.profile_id}`;
    }
  } else if (data.type === 'low_storage') {
    url = '/storage-locations';
  }

  // Handle action buttons
  if (event.action === 'view-runs') {
    url = '/backup-runs';
  } else if (event.action === 'view-storage') {
    url = '/storage-locations';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

function getActionsForType(type) {
  switch (type) {
    case 'backup_failed':
    case 'consecutive_failures':
      return [
        { action: 'view-runs', title: 'View Runs' },
      ];
    case 'low_storage':
      return [
        { action: 'view-storage', title: 'View Storage' },
      ];
    default:
      return [];
  }
}

// Handle subscription change
self.addEventListener('pushsubscriptionchange', function(event) {
  event.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true })
      .then(function(subscription) {
        // Re-subscribe on server
        return fetch('/api/v1/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        });
      })
  );
});
