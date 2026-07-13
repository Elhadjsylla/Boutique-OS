import { useRef, useLayoutEffect } from 'react';
import { formatMontantInput, stripMontantInput } from '../lib/format';

/**
 * Pilote un input texte affichant un montant avec espaces de milliers en direct
 * (ex: "450000" -> "450 000") tout en gardant le curseur à une position cohérente.
 * `value` est la valeur brute (chiffres uniquement, sans espaces) — c'est elle qui
 * doit être stockée en state / envoyée à Supabase. `onChange` reçoit cette même
 * valeur brute à chaque frappe.
 */
export function useMontantInput(value: string, onChange: (raw: string) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaretRef = useRef<number | null>(null);

  const displayValue = formatMontantInput(value);

  useLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    if (caret !== null && inputRef.current) {
      inputRef.current.setSelectionRange(caret, caret);
      pendingCaretRef.current = null;
    }
  }, [displayValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const pos = el.selectionStart ?? 0;
    const selEnd = el.selectionEnd ?? pos;
    if (pos !== selEnd) return; // une sélection est active, laisser le comportement natif

    // Sauter l'espace de groupement pour que Backspace/Delete supprime bien un chiffre.
    if (e.key === 'Backspace' && pos > 0 && el.value[pos - 1] === ' ') {
      el.setSelectionRange(pos - 1, pos - 1);
    } else if (e.key === 'Delete' && pos < el.value.length && el.value[pos] === ' ') {
      el.setSelectionRange(pos + 1, pos + 1);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const rawInput = el.value;
    const caret = el.selectionStart ?? rawInput.length;

    const digitsBeforeCaret = stripMontantInput(rawInput.slice(0, caret)).length;
    const digitsOnly = stripMontantInput(rawInput);
    const newDisplay = formatMontantInput(digitsOnly);

    let newCaret = newDisplay.length;
    if (digitsBeforeCaret === 0) {
      newCaret = 0;
    } else {
      let count = 0;
      for (let i = 0; i < newDisplay.length; i++) {
        if (/\d/.test(newDisplay[i])) {
          count++;
          if (count === digitsBeforeCaret) {
            newCaret = i + 1;
            break;
          }
        }
      }
    }

    // Corrige le DOM tout de suite : si la valeur brute n'a pas changé (ex: caractère
    // non numérique tapé), React ne re-render pas et l'effet ci-dessus ne se déclenche pas.
    el.value = newDisplay;
    el.setSelectionRange(newCaret, newCaret);
    pendingCaretRef.current = newCaret;

    if (digitsOnly !== value) {
      onChange(digitsOnly);
    }
  };

  return { inputRef, displayValue, handleChange, handleKeyDown };
}
