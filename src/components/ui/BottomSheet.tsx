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
      <div className="relative w-full max-w-md bg-card rounded-card shadow-2xl z-10 max-h-[90svh] flex flex-col animate-scale-in border border-border overflow-hidden">
        {/* Header: titre + bouton close dans le même row */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border flex-shrink-0">
          {title ? (
            <h2 className="font-bold text-on-surface text-base leading-tight">{title}</h2>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="material-symbols-outlined text-outline hover:text-on-surface w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-all cursor-pointer flex-shrink-0 ml-2 text-[20px]"
          >
            close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-5">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
