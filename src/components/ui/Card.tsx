import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: 1 | 2;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  elevation = 1,
  className = '',
  children,
  ...props
}) => {
  const baseStyles = 'bg-card rounded-card p-md border border-border transition-all';
  
  const elevations = {
    1: '', // defined only by border
    2: 'product-card-shadow border-transparent', // Level 2 shadow: 0px 4px 12px rgba(26,60,94,0.08)
  };

  return (
    <div
      className={`${baseStyles} ${elevations[elevation]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
