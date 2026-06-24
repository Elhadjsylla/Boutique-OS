import './i18n/index'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import './index.css'
import App from './App.tsx'

// Unregister any active Service Workers and clear caches in development mode
// to prevent PWA caching issues on localhost.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
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
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
