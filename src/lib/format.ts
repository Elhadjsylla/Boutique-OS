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

/** Ne garde que les chiffres d'une saisie (retire espaces et tout autre caractère non numérique). */
export function stripMontantInput(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** Formate une saisie de chiffres bruts avec des espaces tous les 3 chiffres, pour affichage live dans un input (ex: "450000" -> "450 000"). */
export function formatMontantInput(rawDigits: string): string {
  const digits = stripMontantInput(rawDigits);
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Normalise un numéro sénégalais (+221771234567, 221771234567 ou 771234567)
 * vers le format attendu par les liens wa.me (indicatif sans "+", sans espaces).
 * Retourne null si le numéro est absent ou invalide.
 */
export function toWhatsAppNumber(numero: string | null | undefined): string | null {
  if (!numero) return null;
  const digits = numero.replace(/\D/g, '');
  if (/^221[0-9]{9}$/.test(digits)) return digits;
  if (/^[0-9]{9}$/.test(digits)) return `221${digits}`;
  return null;
}
