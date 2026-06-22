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
    if (localStorage.getItem('sound_enabled') === 'false') return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.error(e);
    }
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
