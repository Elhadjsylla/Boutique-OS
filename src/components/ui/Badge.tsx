import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'neutral';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  className = '',
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-pill font-label-md text-label-md font-bold uppercase shrink-0';
  
  const variants = {
    success: 'bg-secondary/10 text-secondary',
    warning: 'bg-tertiary-container/15 text-on-tertiary-container',
    danger: 'bg-error/10 text-error',
    neutral: 'bg-surface-container-highest text-on-surface-variant',
  };

  return (
    <span
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
