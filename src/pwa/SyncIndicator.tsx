import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useOnline } from '../hooks/useOnline';
import { db } from '../db/dexie';

export const SyncIndicator: React.FC = () => {
  const isOnline = useOnline();

  // Query number of unsynced items in Dexie outbox
  const unsyncedCount = useLiveQuery(
    () => db.outbox.where('synced').equals(0).count(),
    []
  ) ?? 0;

  let iconName = 'cloud_done';
  let iconColorClass = 'text-secondary';
  let titleText = 'Données synchronisées';

  if (!isOnline) {
    iconName = 'cloud_off';
    iconColorClass = 'text-outline';
    titleText = 'Mode hors-ligne';
  } else if (unsyncedCount > 0) {
    iconName = 'sync';
    iconColorClass = 'text-on-tertiary-container animate-spin';
    titleText = `${unsyncedCount} modification(s) en attente de synchronisation`;
  }

  return (
    <div 
      className="w-6 h-6 flex items-center justify-center select-none"
      title={titleText}
    >
      <span className={`material-symbols-outlined text-[20px] transition-colors duration-300 ${iconColorClass}`}>
        {iconName}
      </span>
    </div>
  );
};

export default SyncIndicator;
