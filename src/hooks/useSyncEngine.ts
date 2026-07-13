import { useOnline } from './useOnline';

export function useSyncEngine() {
  const isOnline = useOnline();

  return {
    isOnline,
    isSyncing: false,
    lastSyncTime: new Date(),
    syncError: null,
    triggerForceSync: async () => {},
  };
}
