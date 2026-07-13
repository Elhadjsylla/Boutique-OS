import React, { useState, useEffect, useRef } from 'react';
import { formatMontantCompact, formatMontantFull } from '../../lib/format';

interface MoneyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  duration?: number;
  /** Abrège l'affichage (45K, 2,5M, 1Md) — à réserver aux cartes/listes/résumés, jamais aux montants liés à la manipulation d'argent réel (caisse, dettes). */
  compact?: boolean;
}

export const MoneyText: React.FC<MoneyTextProps> = ({
  value,
  className = '',
  duration = 800,
  compact = false,
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

  // Format number with spaces for thousands (Sénégal/CFA standard), ou abrégé si compact
  const formattedValue = compact ? formatMontantCompact(displayValue) : formatMontantFull(displayValue);
  const finalFormattedValue = compact ? formatMontantCompact(value) : formatMontantFull(value);

  return (
    <span
      className={`inline-grid font-numeric-display text-on-surface ${className}`}
      {...props}
    >
      {/* Invisible element to reserve exact final width and prevent layout shift */}
      <span className="invisible col-start-1 row-start-1" aria-hidden="true">
        {finalFormattedValue} <span className="text-sm font-semibold ml-0.5">FCFA</span>
      </span>
      {/* Visible animating element */}
      <span className="col-start-1 row-start-1 tabular-nums justify-self-end">
        {formattedValue} <span className="text-sm font-semibold ml-0.5">FCFA</span>
      </span>
    </span>
  );
};
