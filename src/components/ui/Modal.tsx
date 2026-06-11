import React from 'react';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-md">
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
            className="material-symbols-outlined text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container/50"
          >
            close
          </button>
        </div>

        {/* Content Body */}
        <div className="text-body-md text-on-surface-variant">
          {children}
        </div>
      </div>
    </div>
  );
};
