import React, { useEffect } from 'react';

export interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type,
  onClose,
  duration = 2000,
}) => {
  const playToastSound = () => {
    // Sound effects disabled
  };

  useEffect(() => {
    playToastSound();
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const bgStyles = type === 'success' ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container';
  const borderStyles = type === 'success' ? 'border-secondary' : 'border-error';

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] px-margin-mobile pt-sm animate-fade-in-down">
      <div className={`w-full ${bgStyles} border-b-2 ${borderStyles} px-md py-sm rounded-lg shadow-lg flex items-center justify-between`}>
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-xl">
            {type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span className="font-body-md font-medium">{message}</span>
        </div>
        <button
          onClick={onClose}
          className="material-symbols-outlined hover:opacity-70 active:scale-90 transition-transform p-1"
        >
          close
        </button>
      </div>
    </div>
  );
};
