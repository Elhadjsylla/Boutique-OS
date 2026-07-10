import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export const LTVFunnelSection: React.FC = () => {
  const [ltvData, setLtvData] = useState<any>(null);
  const [funnelData, setFunnelData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [ltvRes, funnelRes] = await Promise.all([
          supabase.rpc('get_ltv_by_plan'),
          supabase.rpc('get_conversion_funnel')
        ]);

        if (ltvRes.error) console.error('LTV error:', ltvRes.error);
        if (funnelRes.error) console.error('Funnel error:', funnelRes.error);

        setLtvData(ltvRes.data);
        setFunnelData(funnelRes.data);
      } catch (err) {
        console.error('Erreur fetch LTV/Funnel:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('fr-SN', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(val || 0);
  };

  if (loading || !ltvData || !funnelData) {
    return <div className="h-64 w-full bg-admin-card animate-pulse rounded-xl"></div>;
  }

  // Helper to render LTV card
  const renderLtvCard = (planName: string, data: any, colorClass: string) => {
    if (!data) return null;
    return (
      <div className={`p-5 rounded-xl border border-admin-border bg-admin-surface flex flex-col gap-2 ${colorClass}`}>
        <span className="text-xs font-black uppercase tracking-wider">{planName}</span>
        <div className="flex justify-between items-end mt-2">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider opacity-70 mb-1">LTV</span>
            <span className="text-xl font-black">{formatMoney(data.ltv)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Durée Moyenne</span>
            <span className="text-sm font-bold">{data.duree_moyenne_mois ? data.duree_moyenne_mois.toFixed(1) : 0} mois</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      {/* LTV Cards */}
      <div className="flex-1 bg-admin-card p-6 rounded-xl border border-admin-border">
        <h2 className="text-lg font-black tracking-tight text-admin-text mb-6">Valeur Vie Client (LTV)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {renderLtvCard('Starter', ltvData.starter, 'text-blue-400')}
          {renderLtvCard('Pro', ltvData.pro, 'text-purple-400')}
          {renderLtvCard('Annual', ltvData.annual, 'text-amber-400')}
        </div>
      </div>

      {/* Funnel */}
      <div className="flex-1 bg-admin-card p-6 rounded-xl border border-admin-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-lg font-black tracking-tight text-admin-text">Funnel de Conversion</h2>
          {funnelData.conversion_free_30j && (
            <span className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-lg text-xs font-bold">
              Taux conversion 30j: {funnelData.conversion_free_30j.taux_pct}%
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {funnelData.distribution?.map((dist: any, idx: number) => {
            // Find transition to next plan
            const nextPlan = funnelData.distribution[idx + 1]?.plan;
            const transition = funnelData.transitions?.find((t: any) => t.from_plan === dist.plan && t.to_plan === nextPlan);
            
            // Width calculation relative to the max users (usually Free plan)
            const maxUsers = Math.max(...(funnelData.distribution.map((d: any) => d.nb_users) || [1]));
            const widthPct = Math.max(10, (dist.nb_users / maxUsers) * 100);
            
            const bgColors: Record<string, string> = {
              free: 'bg-slate-500',
              starter: 'bg-blue-500',
              pro: 'bg-purple-500',
              annual: 'bg-amber-500'
            };

            return (
              <React.Fragment key={dist.plan}>
                <div className="relative h-12 w-full bg-admin-surface rounded-xl overflow-hidden border border-admin-border flex items-center group cursor-pointer hover:border-admin-primary transition-colors">
                  <div 
                    className={`absolute left-0 top-0 bottom-0 ${bgColors[dist.plan] || 'bg-admin-primary'} opacity-20`}
                    style={{ width: `${widthPct}%` }}
                  />
                  <div className="relative w-full px-4 flex justify-between items-center z-10">
                    <span className="font-black uppercase tracking-wider text-sm">{dist.plan}</span>
                    <span className="font-bold text-admin-text">{dist.nb_users} utilisateurs</span>
                  </div>
                </div>
                
                {/* Transition Arrow */}
                {transition && (
                  <div className="flex justify-center py-1">
                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-admin-text-muted">
                      <div className="flex items-center gap-1 text-green-500">
                        <span className="material-symbols-outlined text-sm">arrow_downward</span>
                        {transition.upgrades} Upgrades
                      </div>
                      {transition.downgrades > 0 && (
                        <div className="flex items-center gap-1 text-orange-500">
                          <span className="material-symbols-outlined text-sm">arrow_upward</span>
                          {transition.downgrades} Downgrades
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
