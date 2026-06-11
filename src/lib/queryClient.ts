import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Offline-first query configuration
      staleTime: 1000 * 60 * 5, // 5 minutes before considering data stale
      gcTime: 1000 * 60 * 60 * 24, // Keep garbage collected cache in memory for 24h
      refetchOnWindowFocus: false, // Don't refetch on window focus to save bandwidth/mobile battery
      refetchOnReconnect: 'always', // Always refetch when coming back online
      retry: (failureCount) => {
        // Do not retry queries if the device is offline
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          return false;
        }
        return failureCount < 3; // Retry up to 3 times when online
      },
    },
    mutations: {
      // Retry configuration for mutations
      retry: 2,
    },
  },
});
