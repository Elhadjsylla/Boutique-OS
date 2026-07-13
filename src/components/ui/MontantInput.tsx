import React from 'react';
import { Input } from './Input';
import { useMontantInput } from '../../hooks/useMontantInput';

interface MontantInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  label: string;
  error?: string;
  /** Valeur brute en chiffres uniquement, sans espaces (ex: "450000") — c'est elle qui est stockée/envoyée. */
  value: string;
  /** Reçoit la valeur brute en chiffres uniquement à chaque frappe. */
  onChange: (raw: string) => void;
}

/**
 * Champ de saisie de montant avec espace de milliers en direct pendant la frappe
 * (450000 -> "450 000"), sans perdre la position du curseur. La valeur exposée via
 * `value`/`onChange` reste toujours le nombre brut sans espaces.
 */
export const MontantInput: React.FC<MontantInputProps> = ({ value, onChange, ...props }) => {
  const { inputRef, displayValue, handleChange, handleKeyDown } = useMontantInput(value, onChange);

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
};
