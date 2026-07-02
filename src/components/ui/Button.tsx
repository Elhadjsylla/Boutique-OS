import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'lg',
  className = '',
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-body-md font-semibold rounded-button transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-primary/20';
  
  const variants = {
    primary: 'bg-primary text-on-primary hover:bg-primary/95',
    ghost: 'bg-transparent text-primary hover:bg-primary-container/10 border border-transparent',
    danger: 'bg-error text-on-error hover:bg-error/95',
  };

  const sizes = {
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base', // 48px height minimum for tactile targets
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
