export interface ProductStyle {
  bg: string;
  emoji: string;
}

export function getProductIconAndGradient(name: string): ProductStyle {
  const normName = name.toLowerCase().trim();

  // Oil keywords (palm oil, etc.)
  if (normName.includes('huile')) {
    return { bg: 'from-amber-400 to-orange-600', emoji: '🌴' };
  }
  // Rice
  if (normName.includes('riz')) {
    return { bg: 'from-yellow-300 to-amber-500', emoji: '🌾' };
  }
  // Water / Drinks
  if (normName.includes('eau') || normName.includes('boisson') || normName.includes('jus')) {
    return { bg: 'from-sky-400 to-blue-600', emoji: '💧' };
  }
  // Soap / Hygiene
  if (normName.includes('savon') || normName.includes('hygiène') || normName.includes('propreté') || normName.includes('dentifrice')) {
    return { bg: 'from-teal-400 to-emerald-600', emoji: '🧼' };
  }
  // Milk
  if (normName.includes('lait')) {
    return { bg: 'from-sky-200 to-slate-400', emoji: '🥛' };
  }
  // Sugar / Sweets
  if (normName.includes('sucre') || normName.includes('bonbon') || normName.includes('chocolat')) {
    return { bg: 'from-pink-400 to-rose-600', emoji: '🍬' };
  }
  // Coffee / Tea
  if (normName.includes('café') || normName.includes('cafe') || normName.includes('thé') || normName.includes('the')) {
    return { bg: 'from-amber-600 to-amber-900', emoji: '☕' };
  }
  // Bread / Bakery
  if (normName.includes('pain') || normName.includes('croissant') || normName.includes('farine')) {
    return { bg: 'from-orange-300 to-amber-600', emoji: '🍞' };
  }
  // Pasta / Noodles
  if (normName.includes('pâte') || normName.includes('pate') || normName.includes('spaghetti') || normName.includes('nouilles')) {
    return { bg: 'from-yellow-400 to-orange-500', emoji: '🍝' };
  }
  // Tomato
  if (normName.includes('tomate')) {
    return { bg: 'from-red-400 to-rose-600', emoji: '🍅' };
  }
  // Onion
  if (normName.includes('oignon')) {
    return { bg: 'from-purple-200 to-pink-300', emoji: '🧅' };
  }
  // Egg
  if (normName.includes('oeuf') || normName.includes('œuf') || normName.includes('oeufs')) {
    return { bg: 'from-slate-100 to-slate-300', emoji: '🥚' };
  }

  // Fallback hash-based styles for other items
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const fallbacks = [
    { bg: 'from-blue-400 to-indigo-600', emoji: '📦' },
    { bg: 'from-emerald-400 to-teal-600', emoji: '🛍️' },
    { bg: 'from-amber-400 to-orange-600', emoji: '🏪' },
    { bg: 'from-purple-400 to-pink-600', emoji: '🏷️' },
  ];
  return fallbacks[hash % fallbacks.length];
}
