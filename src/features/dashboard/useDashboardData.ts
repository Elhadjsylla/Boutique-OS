import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { supabaseService } from '../../services/supabaseService';
import { useAuthStore } from '../../store/useAuthStore';

export interface DashboardMetrics {
  caToday: number;
  caWeek: number;
  caMonth: number;
  salesCountToday: number;
  openArdoisesCount: number;
  outOfStockCount: number;
  topProducts: { nom: string; qty: number; maxQty: number }[];
  dailySalesHistory: number[];
  loading: boolean;
}

export function useDashboardData(): DashboardMetrics {
  const boutiqueId = useAuthStore(state => state.profile?.boutique_id || state.boutique?.id);
  const [metrics, setMetrics] = useState<Omit<DashboardMetrics, 'loading'>>({
    caToday: 0,
    caWeek: 0,
    caMonth: 0,
    salesCountToday: 0,
    openArdoisesCount: 0,
    outOfStockCount: 0,
    topProducts: [],
    dailySalesHistory: Array(7).fill(0),
  });
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    if (!boutiqueId) return;
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // 1. Fetch sales
      const sales = await supabaseService.getVentesAll(boutiqueId);
      
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

        const diffDays = Math.floor((startOfTodayMs - new Date(saleDate.slice(0, 10)).getTime()) / dayMs);
        if (diffDays >= 0 && diffDays < 7) {
          dailySalesHistory[6 - diffDays] += sale.total;
        }
      });

      // 2. Fetch active ardoises count
      const { count: openArdoisesCount, error: ardoiseError } = await supabase
        .from('ardoises')
        .select('*', { count: 'exact', head: true })
        .eq('boutique_id', boutiqueId)
        .eq('statut', 'en_cours')
        .is('deleted_at', null);

      if (ardoiseError) throw ardoiseError;

      // 3. Fetch out of stock count
      const { count: outOfStockCount, error: stockError } = await supabase
        .from('produits')
        .select('*', { count: 'exact', head: true })
        .eq('boutique_id', boutiqueId)
        .eq('archive', 0)
        .eq('quantite', 0)
        .is('deleted_at', null);

      if (stockError) throw stockError;

      // 4. Compute Top 5 products
      const saleItems = await supabaseService.getVenteItemsAll(boutiqueId);
      const productQuantities: Record<string, number> = {};

      saleItems.forEach(item => {
        productQuantities[item.produit_id] = (productQuantities[item.produit_id] || 0) + item.quantite;
      });

      const sortedProductEntries = Object.entries(productQuantities)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const topProducts = [];
      let maxQty = 1;

      for (const [productId, qty] of sortedProductEntries) {
        const { data: product } = await supabase
          .from('produits')
          .select('nom')
          .eq('id', productId)
          .maybeSingle();

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

      const finalTopProducts = topProducts.map(p => ({
        ...p,
        maxQty,
      }));

      setMetrics({
        caToday,
        caWeek,
        caMonth,
        salesCountToday,
        openArdoisesCount: openArdoisesCount || 0,
        outOfStockCount: outOfStockCount || 0,
        topProducts: finalTopProducts,
        dailySalesHistory,
      });
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [boutiqueId]);

  useEffect(() => {
    const handleFocus = () => {
      fetchMetrics();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [boutiqueId]);

  // Realtime subscriptions
  useEffect(() => {
    if (!boutiqueId) return;

    const channel = supabase
      .channel('realtime_dashboard_metrics')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ventes', filter: `boutique_id=eq.${boutiqueId}` },
        () => fetchMetrics()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'produits', filter: `boutique_id=eq.${boutiqueId}` },
        () => fetchMetrics()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ardoises', filter: `boutique_id=eq.${boutiqueId}` },
        () => fetchMetrics()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boutiqueId]);

  return {
    ...metrics,
    loading,
  };
}
