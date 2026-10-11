import { useEffect } from 'react';

export function useServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('[SW] Registered:', reg.scope);
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW] New version available');
            }
          });
        });
      })
      .catch(err => {
        console.error('[SW] Registration failed:', err);
      });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        window.location.href = event.data.url;
      }
    });
  }, []);
}

export default useServiceWorker;