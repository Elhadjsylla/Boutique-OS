import React, { useState, useEffect, useRef } from 'react';

interface MoneyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  duration?: number;
}

export const MoneyText: React.FC<MoneyTextProps> = ({
  value,
  className = '',
  duration = 800,
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = prevValueRef.current;
    const endValue = value;

    if (startValue === endValue) {
      setDisplayValue(endValue);
      return;
    }

    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Easing out quad
      const easeOutQuad = progress * (2 - progress);
      const currentValue = Math.round(startValue + easeOutQuad * (endValue - startValue));
      
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
        prevValueRef.current = endValue;
      }
    };

    animationFrameId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration]);

  // Format number with spaces for thousands (Sénégal/CFA standard)
  const formattedValue = new Intl.NumberFormat('fr-FR').format(displayValue);

  return (
    <span
      className={`font-numeric-display text-on-surface ${className}`}
      {...props}
    >
      {formattedValue} <span className="text-sm font-semibold ml-0.5">FCFA</span>
    </span>
  );
};
