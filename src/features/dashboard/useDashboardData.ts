import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';

export interface DashboardMetrics {
  caToday: number;
  caWeek: number;
  caMonth: number;
  salesCountToday: number;
  openArdoisesCount: number;
  outOfStockCount: number;
  topProducts: { nom: string; qty: number; maxQty: number }[];
  dailySalesHistory: number[];
}

export function useDashboardData(): DashboardMetrics {
  return useLiveQuery(async () => {
    const now = new Date();
    
    // Start of times
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch sales
    const sales = await db.ventes.toArray();
    
    let caToday = 0;
    let caWeek = 0;
    let caMonth = 0;
    let salesCountToday = 0;

    const dayMs = 24 * 60 * 60 * 1000;
    const startOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dailySalesHistory = Array(7).fill(0);

    sales.forEach(sale => {
      const saleDate = sale.created_at;
      
      if (saleDate >= startOfToday) {
        caToday += sale.total;
        salesCountToday++;
      }
      if (saleDate >= sevenDaysAgo) {
        caWeek += sale.total;
      }
      if (saleDate >= thirtyDaysAgo) {
        caMonth += sale.total;
      }

      // Calculate index for 7-day history: 0 is 6 days ago, 6 is today
      const diffDays = Math.floor((startOfTodayMs - new Date(saleDate.slice(0, 10)).getTime()) / dayMs);
      if (diffDays >= 0 && diffDays < 7) {
        dailySalesHistory[6 - diffDays] += sale.total;
      }
    });

    // 2. Fetch active ardoises count
    const openArdoisesCount = await db.ardoises
      .where('statut')
      .equals('en_cours')
      .count();

    // 3. Fetch out of stock count
    const outOfStockCount = await db.produits
      .where('archive')
      .equals(0)
      .filter(p => p.quantite === 0)
      .count();

    // 4. Compute Top 5 products
    const saleItems = await db.vente_items.toArray();
    const productQuantities: Record<string, number> = {};

    saleItems.forEach(item => {
      productQuantities[item.produit_id] = (productQuantities[item.produit_id] || 0) + item.quantite;
    });

    // Sort products by qty sold
    const sortedProductEntries = Object.entries(productQuantities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topProducts = [];
    let maxQty = 1;

    for (const [productId, qty] of sortedProductEntries) {
      const product = await db.produits.get(productId);
      if (product) {
        topProducts.push({
          nom: product.nom,
          qty,
          maxQty,
        });
        if (qty > maxQty) {
          maxQty = qty;
        }
      }
    }

    // Map maxQty for correct relative progress bar rendering
    const finalTopProducts = topProducts.map(p => ({
      ...p,
      maxQty,
    }));

    return {
      caToday,
      caWeek,
      caMonth,
      salesCountToday,
      openArdoisesCount,
      outOfStockCount,
      topProducts: finalTopProducts,
      dailySalesHistory,
    };
  }, []) || {
    caToday: 0,
    caWeek: 0,
    caMonth: 0,
    salesCountToday: 0,
    openArdoisesCount: 0,
    outOfStockCount: 0,
    topProducts: [],
    dailySalesHistory: Array(7).fill(0),
  };
}
