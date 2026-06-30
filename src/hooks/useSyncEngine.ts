import { useEffect, useState, useCallback } from 'react';
import { useOnline } from './useOnline';
import { syncEngineRun } from '../db/sync';
import { useAuthStore } from '../store/useAuthStore';

export function useSyncEngine() {
  const isOnline = useOnline();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);

  const runSync = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    const state = useAuthStore.getState();
    if (state.isLoading) return; // Ne pas déclencher la garde tant que le profil charge

    const boutiqueId = state.user?.user_metadata?.boutique_id || state.profile?.boutique_id;

    if (!boutiqueId) {
      setSyncError(new Error('Profil boutique non trouvé — contactez le support'));
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      await syncEngineRun();
      setLastSyncTime(new Date());
    } catch (error) {
      setSyncError(error instanceof Error ? error : new Error('Unknown sync error'));
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing]);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline) {
      runSync();
    }
  }, [isOnline]);

  // Periodic sync every 60 seconds when online
  useEffect(() => {
    if (!isOnline) return;

    const intervalId = setInterval(() => {
      runSync();
    }, 60000);

    return () => clearInterval(intervalId);
  }, [isOnline, runSync]);

  return {
    isOnline,
    isSyncing,
    lastSyncTime,
    syncError,
    triggerForceSync: runSync,
  };
}
