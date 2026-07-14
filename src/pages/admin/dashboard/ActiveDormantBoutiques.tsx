import React, { useState, useEffect } from 'react';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DetailDrawer } from './DetailDrawer';
import { callRpcWithRetry } from '../../../lib/supabase-rpc';
import { formatMontantCompact } from '../../../lib/format';

export const ActiveDormantBoutiques: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [topBoutiques, setTopBoutiques] = useState<any[]>([]);
  const [loadingTop, setLoadingTop] = useState(true);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'dormantes' | 'boutique'>('dormantes');
  const [selectedBoutique, setSelectedBoutique] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setLoadingTop(true);
      try {
        const [statusRes, topRes] = await Promise.all([
          callRpcWithRetry('get_active_vs_dormant', { p_seuil_jours: 30 }),
          callRpcWithRetry('get_top_boutiques', { p_period: '30d', p_limit: 10 })
        ]);

        if (statusRes.error) console.error('Status error:', statusRes.error);
        if (topRes.error) console.error('Top error:', topRes.error);

        setData(statusRes.data);
        setTopBoutiques(topRes.data || []);
      } catch (err) {
        console.error('Erreur fetch boutiques status:', err);
      } finally {
        setLoading(false);
        setLoadingTop(false);
      }
    };
    fetchData();
  }, []);

  const openDormantes = () => {
    setDrawerMode('dormantes');
    setDrawerOpen(true);
  };

  const openBoutique = (b: any) => {
    setSelectedBoutique(b);
    setDrawerMode('boutique');
    setDrawerOpen(true);
  };

  const formatMoney = (val: number) => {
    return formatMontantCompact(val || 0) + ' F';
  };

  if (loading || !data) {
    return <div className="h-96 w-full bg-admin-card animate-pulse rounded-xl"></div>;
  }

  const pieData = [
    { name: 'Actives', value: data.nb_actives },
    { name: 'Dormantes', value: data.nb_dormantes },
    { name: 'Suspendues', value: data.nb_suspendues }
  ];
  const COLORS = ['#10b981', '#64748b', '#ef4444'];

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KPI Actives vs Dormantes */}
        <div className="lg:col-span-1 bg-admin-card p-6 rounded-xl border border-admin-border flex flex-col items-center justify-center cursor-pointer hover:border-admin-primary/50 transition-colors min-w-0" onClick={openDormantes}>
          <h2 className="text-sm font-black tracking-tight text-admin-text mb-4 w-full text-left uppercase">Santé du Parc (30j)</h2>
          
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                  {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e1e2e', borderColor: '#2d2d44', color: '#fff', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex w-full justify-between mt-4">
            <div className="flex flex-col items-center">
              <span className="w-3 h-3 rounded-full bg-emerald-500 mb-1"></span>
              <span className="text-lg font-black">{data.nb_actives}</span>
              <span className="text-[10px] text-admin-text-muted uppercase">Actives</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="w-3 h-3 rounded-full bg-slate-500 mb-1"></span>
              <span className="text-lg font-black">{data.nb_dormantes}</span>
              <span className="text-[10px] text-admin-text-muted uppercase">Dormantes</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="w-3 h-3 rounded-full bg-red-500 mb-1"></span>
              <span className="text-lg font-black">{data.nb_suspendues}</span>
              <span className="text-[10px] text-admin-text-muted uppercase">Suspendues</span>
            </div>
          </div>
          
          <div className="w-full mt-6 py-2 text-center text-xs font-bold text-admin-primary bg-admin-primary/10 rounded-lg">
            Voir les {data.nb_dormantes} dormantes →
          </div>
        </div>

        {/* Top 10 Table */}
        <div className="lg:col-span-2 bg-admin-card rounded-xl border border-admin-border flex flex-col min-w-0">
          <div className="p-5 border-b border-admin-border">
            <h2 className="text-lg font-black tracking-tight text-admin-text">Top 10 Boutiques (30j)</h2>
          </div>
          <div className="flex-1 overflow-auto">
            {loadingTop ? (
              <div className="h-full flex items-center justify-center">
                <span className="text-admin-text-muted">Chargement du classement...</span>
              </div>
            ) : (
              <>
                <div className="hidden md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-admin-surface text-admin-text-muted text-[10px] uppercase tracking-wider font-bold sticky top-0">
                      <tr>
                        <th className="px-5 py-3">Boutique</th>
                        <th className="px-5 py-3 text-right">Revenu</th>
                        <th className="px-5 py-3 text-right">Ventes</th>
                        <th className="px-5 py-3 text-center">Plan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-admin-border">
                      {topBoutiques.map((b) => (
                        <tr 
                          key={b.boutique_id} 
                          className="hover:bg-admin-surface/50 transition-colors cursor-pointer"
                          onClick={() => openBoutique(b)}
                        >
                          <td className="px-5 py-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-admin-text flex items-center gap-2">
                                {b.nom}
                                {b.suspended && <span className="w-2 h-2 rounded-full bg-red-500" title="Suspendue"></span>}
                              </span>
                              <span className="text-[10px] text-admin-text-muted mt-0.5">{b.quartier || 'Non localisée'}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right font-black text-admin-primary">{formatMoney(b.revenu)}</td>
                          <td className="px-5 py-3 text-right text-admin-text-muted font-bold">{b.nb_transactions}</td>
                          <td className="px-5 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider ${
                              b.plan === 'pro' ? 'bg-purple-500/10 text-purple-500' :
                              b.plan === 'starter' ? 'bg-blue-500/10 text-blue-500' :
                              b.plan === 'annual' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-500'
                            }`}>
                              {b.plan || 'Free'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile top list view */}
                <div className="md:hidden flex flex-col divide-y divide-admin-border">
                  {topBoutiques.map((b) => (
                    <div 
                      key={b.boutique_id} 
                      className="p-4 hover:bg-admin-surface/35 transition-colors cursor-pointer flex flex-col gap-2.5 text-left"
                      onClick={() => openBoutique(b)}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-admin-text text-sm flex items-center gap-1.5 truncate">
                            {b.nom}
                            {b.suspended && <span className="w-2 h-2 rounded-full bg-red-500" title="Suspendue"></span>}
                          </span>
                          <span className="text-[10px] text-admin-text-muted mt-0.5">{b.quartier || 'Non localisée'}</span>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-bold tracking-wider flex-shrink-0 ${
                          b.plan === 'pro' ? 'bg-purple-500/10 text-purple-500' :
                          b.plan === 'starter' ? 'bg-blue-500/10 text-blue-500' :
                          b.plan === 'annual' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-500'
                        }`}>
                          {b.plan || 'Free'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-admin-text-muted block">Revenu</span>
                          <span className="font-black text-admin-primary text-xs">{formatMoney(b.revenu)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] uppercase tracking-wider text-admin-text-muted block">Ventes</span>
                          <span className="font-bold text-admin-text-muted text-xs">{b.nb_transactions}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <DetailDrawer
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedBoutique(null); }}
        title={drawerMode === 'dormantes' ? 'Boutiques Dormantes' : `Détails: ${selectedBoutique?.nom}`}
        width="lg"
      >
        {drawerMode === 'dormantes' ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-admin-text-muted mb-4">
              Ces boutiques n'ont enregistré aucune vente sur les 30 derniers jours.
            </p>
            {data.detail?.filter((b: any) => b.statut === 'dormante').map((b: any, idx: number) => (
              <div key={idx} className="bg-admin-card p-4 rounded-xl border border-admin-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col">
                  <span className="font-bold text-admin-text">{b.nom}</span>
                  <span className="text-[10px] text-admin-text-muted uppercase mt-1">Dernière activité: il y a {b.jours_inactivite} jours</span>
                </div>
                <button className="px-3 py-1.5 bg-admin-surface border border-admin-border hover:bg-admin-primary hover:border-admin-primary hover:text-white rounded-lg text-xs font-bold transition-all">
                  Relancer
                </button>
              </div>
            ))}
            {data.detail?.filter((b: any) => b.statut === 'dormante').length === 0 && (
              <p className="text-center text-admin-text-muted text-sm py-4">Aucune boutique dormante.</p>
            )}
          </div>
        ) : (
          selectedBoutique && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-admin-card p-4 rounded-xl border border-admin-border">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-admin-text-muted mb-1 block">Revenu 30j</span>
                  <span className="text-2xl font-black text-admin-text">{formatMoney(selectedBoutique.revenu)}</span>
                </div>
                <div className="bg-admin-card p-4 rounded-xl border border-admin-border">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-admin-text-muted mb-1 block">Ventes 30j</span>
                  <span className="text-2xl font-black text-admin-text">{selectedBoutique.nb_transactions}</span>
                </div>
              </div>
              <div className="bg-admin-card p-5 rounded-xl border border-admin-border">
                <h3 className="text-xs font-bold uppercase tracking-wider text-admin-text-muted mb-4">Informations</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-admin-border pb-2">
                    <span className="text-admin-text-muted">Quartier</span>
                    <span className="font-bold text-admin-text">{selectedBoutique.quartier || 'Non renseigné'}</span>
                  </div>
                  <div className="flex justify-between border-b border-admin-border pb-2">
                    <span className="text-admin-text-muted">Plan actuel</span>
                    <span className="font-bold text-admin-text capitalize">{selectedBoutique.plan || 'Free'}</span>
                  </div>
                  <div className="flex justify-between pb-2">
                    <span className="text-admin-text-muted">Statut</span>
                    <span className={`font-bold ${selectedBoutique.suspended ? 'text-red-500' : 'text-green-500'}`}>
                      {selectedBoutique.suspended ? 'Suspendue' : 'Active'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-4">
                <button className="px-4 py-2 bg-admin-surface border border-admin-border rounded-xl text-sm font-bold text-admin-text hover:bg-admin-border transition-colors">
                  Voir historique complet
                </button>
              </div>
            </div>
          )
        )}
      </DetailDrawer>
    </>
  );
};
