export function formatMontantCompact(valeur: number | string | null | undefined): string {
  if (valeur == null) return "0";
  
  const num = typeof valeur === 'string' ? parseFloat(valeur) : valeur;
  if (isNaN(num)) return "0";

  const absNum = Math.abs(num);

  if (absNum >= 1_000_000_000) {
    const formatStr = (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '');
    return formatStr.replace('.', ',') + "Md";
  }
  
  if (absNum >= 1_000_000) {
    const formatStr = (num / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return formatStr.replace('.', ',') + "M";
  }

  if (absNum >= 1_000) {
    const formatStr = (num / 1_000).toFixed(1).replace(/\.0$/, '');
    return formatStr.replace('.', ',') + "K";
  }

  return new Intl.NumberFormat('fr-FR').format(num);
}
