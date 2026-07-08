import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DetailDrawer } from './DetailDrawer';

type Period = '24h' | '7d' | '30d' | '12m' | 'all';

export const RevenueSection: React.FC = () => {
  const [period, setPeriod] = useState<Period>('30d');
  const [mrrData, setMrrData] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  useEffect(() => {
    const fetchRevenue = async () => {
      setLoading(true);
      try {
        const [mrrRes, revRes] = await Promise.all([
          supabase.rpc('get_mrr_arr'),
          supabase.rpc('get_revenue_by_period', { p_period: period })
        ]);

        if (mrrRes.error) console.error('MRR error:', mrrRes.error);
        if (revRes.error) console.error('Rev error:', revRes.error);

        setMrrData(mrrRes.data);
        setRevenueData(revRes.data);
      } catch (err) {
        console.error('Erreur fetch revenue:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRevenue();
  }, [period]);

  const openBreakdown = async () => {
    setDrawerOpen(true);
    setLoadingBreakdown(true);
    try {
      const { data, error } = await supabase.rpc('get_revenue_breakdown', { p_period: period });
      if (error) throw error;
      setBreakdown(data || []);
    } catch (err) {
      console.error('Erreur fetch breakdown:', err);
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('fr-SN', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(val || 0);
  };

  if (loading || !revenueData || !mrrData) {
    return <div className="h-96 w-full bg-admin-card animate-pulse rounded-xl"></div>;
  }

  const { total_revenu, evolution_pct, revenu_par_plan, revenu_par_methode } = revenueData;

  const planData = Object.entries(revenu_par_plan || {}).map(([name, value]) => ({ name, value }));
  const methodData = Object.entries(revenu_par_methode || {}).map(([name, value]) => ({ name, value }));
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header & Selector */}
        <div className="flex justify-between items-center bg-admin-card p-5 rounded-xl border border-admin-border">
          <h2 className="text-lg font-black tracking-tight text-admin-text">Revenus & Croissance</h2>
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="bg-admin-surface border border-admin-border text-admin-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-admin-primary"
          >
            <option value="24h">24 Dernières Heures</option>
            <option value="7d">7 Derniers Jours</option>
            <option value="30d">30 Derniers Jours</option>
            <option value="12m">12 Derniers Mois</option>
            <option value="all">Depuis le début</option>
          </select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-admin-card p-6 rounded-xl border border-admin-border hover:border-admin-primary/50 transition-colors cursor-pointer" onClick={openBreakdown}>
            <span className="text-xs font-bold uppercase tracking-wider text-admin-text-muted mb-2 block">Revenu Période</span>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-admin-text">{formatMoney(total_revenu)}</span>
              <span className={`text-sm font-bold ${evolution_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {evolution_pct >= 0 ? '+' : ''}{evolution_pct}%
              </span>
            </div>
            <span className="text-[10px] text-admin-text-muted mt-2 block opacity-70">Cliquez pour voir les détails</span>
          </div>

          <div className="bg-admin-card p-6 rounded-xl border border-admin-border">
            <span className="text-xs font-bold uppercase tracking-wider text-admin-text-muted mb-2 block">MRR (Revenu Mensuel)</span>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-admin-text">{formatMoney(mrrData.mrr)}</span>
            </div>
          </div>

          <div className="bg-admin-card p-6 rounded-xl border border-admin-border">
            <span className="text-xs font-bold uppercase tracking-wider text-admin-text-muted mb-2 block">ARR (Revenu Annuel)</span>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-admin-text">{formatMoney(mrrData.arr)}</span>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-admin-card p-6 rounded-xl border border-admin-border h-80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-admin-text-muted mb-6">Répartition par Plan</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {planData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ backgroundColor: '#1e1e2e', borderColor: '#2d2d44', color: '#fff', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-admin-card p-6 rounded-xl border border-admin-border h-80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-admin-text-muted mb-6">Historique MRR (6 mois)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mrrData.historique_6_mois || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d44" vertical={false} />
                <XAxis dataKey="mois" stroke="#6c7086" fontSize={10} tickMargin={10} />
                <YAxis stroke="#6c7086" fontSize={10} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip formatter={(value: number) => formatMoney(value)} cursor={{ fill: '#2d2d44', opacity: 0.4 }} contentStyle={{ backgroundColor: '#1e1e2e', borderColor: '#2d2d44', color: '#fff', borderRadius: '8px' }} />
                <Bar dataKey="mrr" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <DetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`Détail des revenus (${period})`}
        width="lg"
      >
        {loadingBreakdown ? (
          <div className="animate-pulse flex flex-col gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-admin-surface border border-admin-border rounded-xl"></div>
            ))}
          </div>
        ) : breakdown.length === 0 ? (
          <p className="text-admin-text-muted text-sm text-center py-8">Aucune transaction sur cette période.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {breakdown.map((tx: any, idx: number) => (
              <div key={idx} className="bg-admin-card p-4 rounded-xl border border-admin-border flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="font-bold text-admin-text text-sm">{tx.nom_boutique}</span>
                  <span className="text-[10px] text-admin-text-muted mt-1 uppercase tracking-wider">
                    {new Date(tx.date).toLocaleDateString()} • {tx.methode_paiement}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-black text-admin-primary">{formatMoney(tx.montant)}</span>
                  <span className="px-2 py-0.5 bg-admin-surface border border-admin-border rounded text-[9px] uppercase font-bold text-admin-text-muted mt-1">
                    {tx.plan}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DetailDrawer>
    </>
  );
};
