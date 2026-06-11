import React from 'react';

interface MoneyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
}

export const MoneyText: React.FC<MoneyTextProps> = ({
  value,
  className = '',
  ...props
}) => {
  // Format number with spaces for thousands (Sénégal/CFA standard)
  const formattedValue = new Intl.NumberFormat('fr-FR').format(value);

  return (
    <span
      className={`font-numeric-display text-on-surface ${className}`}
      {...props}
    >
      {formattedValue} <span className="text-sm font-semibold ml-0.5">FCFA</span>
    </span>
  );
};
