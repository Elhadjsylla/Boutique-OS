import React from 'react';
import { useOnline } from '../hooks/useOnline';

export const SyncIndicator: React.FC = () => {
  const isOnline = useOnline();

  let iconName = 'cloud_done';
  let iconColorClass = 'text-secondary';
  let titleText = 'Connecté au serveur';

  if (!isOnline) {
    iconName = 'cloud_off';
    iconColorClass = 'text-outline';
    titleText = 'Mode hors-ligne';
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
