import './i18n/index'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import './index.css'
import App from './App.tsx'

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  // Dev: unregister SW and clear caches to avoid stale-code issues on localhost
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length > 0) {
      for (const registration of registrations) {
        registration.unregister();
      }
      if ('caches' in window) {
        caches.keys().then((keys) => {
          Promise.all(keys.map(key => caches.delete(key))).then(() => {
            (window as any).location.reload();
          });
        });
      } else {
        (window as any).location.reload();
      }
    }
  });
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
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
