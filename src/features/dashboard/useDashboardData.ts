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
      // Une seule RPC agrégée côté serveur (SUM/COUNT/GROUP BY) — remplace l'ancien calcul
      // client qui rapatriait toutes les ventes + tous les vente_items de la boutique.
      const stats = await supabaseService.getDashboardStats(boutiqueId);

      const maxQty = stats.top_products.reduce((max, p) => Math.max(max, p.qty), 1);

      setMetrics({
        caToday: stats.ca_today,
        caWeek: stats.ca_week,
        caMonth: stats.ca_month,
        salesCountToday: stats.sales_count_today,
        openArdoisesCount: stats.open_ardoises_count,
        outOfStockCount: stats.out_of_stock_count,
        topProducts: stats.top_products.map(p => ({ ...p, maxQty })),
        dailySalesHistory: stats.daily_sales_history,
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
