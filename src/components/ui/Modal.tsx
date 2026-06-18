import React from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-md">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Content */}
      <div className="bg-card rounded-card border border-border w-full max-w-md p-md relative z-10 shadow-[0px_8px_24px_rgba(0,0,0,0.12)] animate-scale-in">
        {/* Header */}
        <div className="flex justify-between items-center mb-md">
          {title ? (
            <h2 className="font-headline-sm text-on-surface">{title}</h2>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            className="material-symbols-outlined text-outline hover:text-on-surface w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-all cursor-pointer flex-shrink-0 ml-2 text-[20px]"
          >
            close
          </button>
        </div>

        {/* Content Body */}
        <div className="text-body-md text-on-surface-variant">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
