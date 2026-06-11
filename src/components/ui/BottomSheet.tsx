import React from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />

      {/* Bottom Sheet Panel */}
      <div className="relative w-full max-w-lg bg-card rounded-t-card shadow-lg z-10 max-h-[85vh] flex flex-col animate-slide-up border-t border-border">
        {/* Drag Handle Indicator */}
        <div 
          className="w-full flex justify-center py-3 cursor-pointer"
          onClick={onClose}
        >
          <div className="w-10 h-1 bg-surface-container-highest rounded-full" />
        </div>

        {title && (
          <div className="px-md pb-sm border-b border-border flex justify-between items-center">
            <h2 className="font-headline-sm text-on-surface">{title}</h2>
            <button
              onClick={onClose}
              className="material-symbols-outlined text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container/50"
            >
              close
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-md pb-xl">
          {children}
        </div>
      </div>
    </div>
  );
};
