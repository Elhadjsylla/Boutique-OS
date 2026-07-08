import React, { useEffect } from 'react';

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: 'md' | 'lg' | 'xl' | 'full';
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = 'md',
}) => {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const widthClass = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full sm:max-w-3xl',
  }[width];

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`relative w-full ${widthClass} bg-admin-surface border-l border-admin-border shadow-2xl flex flex-col transition-transform duration-300 transform translate-x-0`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-admin-border bg-admin-card">
          <h2 className="text-lg font-black tracking-tight text-admin-text uppercase">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-admin-text-muted hover:text-admin-text hover:bg-admin-surface rounded-xl transition-all"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-admin-surface">
          {children}
        </div>
      </div>
    </div>
  );
};
