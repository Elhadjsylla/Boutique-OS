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
  if (normName.includes('eau') || normName.includes('boisson') || normName.includes('jus') || normName.includes('soda') || normName.includes('coca') || normName.includes('fanta') || normName.includes('sprite')) {
    return { bg: 'from-sky-400 to-blue-600', emoji: '💧' };
  }
  // Perfume / Cosmetics / Beauty
  if (normName.includes('parfum') || normName.includes('fragrance') || normName.includes('cosmétique') || normName.includes('cosmetique') || normName.includes('crème') || normName.includes('creme') || normName.includes('lotion') || normName.includes('bodysplash') || normName.includes('deodorant') || normName.includes('déodorant') || normName.includes('maquillage') || normName.includes('rouge à lèvres')) {
    return { bg: 'from-pink-400 to-purple-600', emoji: '🧴' };
  }
  // Soap / Hygiene / Toothpaste
  if (normName.includes('savon') || normName.includes('hygiène') || normName.includes('propreté') || normName.includes('dentifrice')) {
    return { bg: 'from-teal-400 to-emerald-600', emoji: '🧼' };
  }
  // Milk / Dairy
  if (normName.includes('lait') || normName.includes('yaourt') || normName.includes('fromage') || normName.includes('beurre')) {
    return { bg: 'from-sky-200 to-slate-400', emoji: '🥛' };
  }
  // Sugar / Sweets / Biscuits
  if (normName.includes('sucre') || normName.includes('bonbon') || normName.includes('chocolat') || normName.includes('biscuit') || normName.includes('gâteau') || normName.includes('gateau') || normName.includes('chips')) {
    return { bg: 'from-pink-400 to-rose-600', emoji: '🍬' };
  }
  // Coffee / Tea
  if (normName.includes('café') || normName.includes('cafe') || normName.includes('thé') || normName.includes('the') || normName.includes('infusion')) {
    return { bg: 'from-amber-600 to-amber-900', emoji: '☕' };
  }
  // Bread / Bakery / Flour
  if (normName.includes('pain') || normName.includes('croissant') || normName.includes('farine') || normName.includes('baguette') || normName.includes('boulangerie')) {
    return { bg: 'from-orange-300 to-amber-600', emoji: '🍞' };
  }
  // Pasta / Noodles
  if (normName.includes('pâte') || normName.includes('pate') || normName.includes('spaghetti') || normName.includes('nouilles') || normName.includes('macaroni')) {
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
  // Fruits
  if (normName.includes('pomme') || normName.includes('banane') || normName.includes('orange') || normName.includes('mangue') || normName.includes('fraise') || normName.includes('citron') || normName.includes('fruit') || normName.includes('ananas') || normName.includes('avocat')) {
    return { bg: 'from-green-400 to-yellow-500', emoji: '🍎' };
  }
  // Vegetables
  if (normName.includes('carotte') || normName.includes('salade') || normName.includes('chou') || normName.includes('légume') || normName.includes('legume') || normName.includes('pomme de terre') || normName.includes('patate')) {
    return { bg: 'from-orange-400 to-green-600', emoji: '🥕' };
  }
  // Meat
  if (normName.includes('viande') || normName.includes('poulet') || normName.includes('boeuf') || normName.includes('porc') || normName.includes('mouton') || normName.includes('agneau') || normName.includes('brochette')) {
    return { bg: 'from-red-400 to-rose-700', emoji: '🍖' };
  }
  // Fish / Seafood
  if (normName.includes('poisson') || normName.includes('thon') || normName.includes('sardine') || normName.includes('crevette') || normName.includes('crabe') || normName.includes('fruits de mer')) {
    return { bg: 'from-cyan-400 to-blue-600', emoji: '🐟' };
  }
  // Electronics
  if (normName.includes('téléphone') || normName.includes('telephone') || normName.includes('chargeur') || normName.includes('câble') || normName.includes('cable') || normName.includes('pile') || normName.includes('ampoule') || normName.includes('écouteur') || normName.includes('ecouteur')) {
    return { bg: 'from-blue-500 to-indigo-600', emoji: '🔌' };
  }
  // Clothing / Accessories
  if (normName.includes('habits') || normName.includes('vêtement') || normName.includes('vetement') || normName.includes('t-shirt') || normName.includes('pantalon') || normName.includes('robe') || normName.includes('chaussure') || normName.includes('basket') || normName.includes('sac') || normName.includes('chapeau') || normName.includes('casquette')) {
    return { bg: 'from-purple-400 to-pink-500', emoji: '👕' };
  }
  // Stationery / Books
  if (normName.includes('cahier') || normName.includes('stylo') || normName.includes('crayon') || normName.includes('papier') || normName.includes('livre') || normName.includes('agenda')) {
    return { bg: 'from-indigo-400 to-blue-700', emoji: '📝' };
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
