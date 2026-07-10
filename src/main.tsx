import './i18n/index'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.tsx'


if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  // Dev: unregister SW and clear caches ONCE to avoid stale-code issues.
  // A localStorage flag prevents an infinite reload loop.
  const SW_CLEANED_KEY = 'sw_dev_cleaned';
  if (!localStorage.getItem(SW_CLEANED_KEY)) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      if (registrations.length > 0) {
        for (const registration of registrations) {
          registration.unregister();
        }
        localStorage.setItem(SW_CLEANED_KEY, '1');
        if ('caches' in globalThis) {
          caches.keys().then((keys) => {
            Promise.all(keys.map(key => caches.delete(key))).then(() => {
              globalThis.location.reload();
            });
          });
        } else {
          globalThis.location.reload();
        }
        return; // stop here — reload is coming
      }
    });
  }
} else if ('serviceWorker' in navigator) {
  // Production: when a new SW takes control, reload immediately so users
  // always run the latest code (works with registerType: 'autoUpdate').
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) {
      reloading = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
