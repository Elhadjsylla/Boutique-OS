import React from 'react';
import { createPortal } from 'react-dom';

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

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />

      {/* Centered Panel */}
      <div className="relative w-full max-w-md bg-card rounded-card shadow-2xl z-10 max-h-[90vh] flex flex-col animate-scale-in border border-border">
        {/* Close Button / Top Area */}
        <div className="w-full flex justify-end px-3 pt-3">
          <button
            onClick={onClose}
            className="material-symbols-outlined text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container/50 transition-all cursor-pointer"
          >
            close
          </button>
        </div>

        {title && (
          <div className="px-md pb-sm border-b border-border flex justify-between items-center -mt-6">
            <h2 className="font-headline-sm text-on-surface text-base">{title}</h2>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-md pb-md">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
