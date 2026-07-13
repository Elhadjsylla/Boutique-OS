const TIERS = [
  { value: 1_000_000_000, suffix: 'Md' },
  { value: 1_000_000, suffix: 'M' },
  { value: 1_000, suffix: 'K' },
] as const;

/**
 * Abrège un montant pour l'affichage : 45000 -> "45K", 2500000 -> "2,5M", 1000000000 -> "1Md".
 * En dessous de 1000, le montant est affiché tel quel.
 */
export function formatMontantCompact(valeur: number | string | null | undefined): string {
  if (valeur == null) return "0";

  const num = typeof valeur === 'string' ? parseFloat(valeur) : valeur;
  if (isNaN(num)) return "0";

  const sign = num < 0 ? '-' : '';
  const absNum = Math.abs(num);

  if (absNum < 1000) {
    return sign + Math.round(absNum).toString();
  }

  for (let i = 0; i < TIERS.length; i++) {
    const tier = TIERS[i];
    if (absNum >= tier.value) {
      let rounded = Math.round((absNum / tier.value) * 10) / 10;
      let suffix: string = tier.suffix;

      // Le passage à la décimale supérieure peut faire dépasser 1000 (ex: 999.96K -> 1000K) : on remonte d'un palier.
      if (rounded >= 1000 && i > 0) {
        rounded = Math.round((rounded / 1000) * 10) / 10;
        suffix = TIERS[i - 1].suffix;
      }

      const numberPart = Number.isInteger(rounded)
        ? String(rounded)
        : rounded.toFixed(1).replace('.', ',');

      return sign + numberPart + suffix;
    }
  }

  return sign + Math.round(absNum).toString();
}

/** Montant complet avec séparateurs de milliers (ex: "2 500 000"), pour affichage non abrégé. */
export function formatMontantFull(valeur: number | string | null | undefined): string {
  if (valeur == null) return "0";
  const num = typeof valeur === 'string' ? parseFloat(valeur) : valeur;
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat('fr-FR').format(num);
}
