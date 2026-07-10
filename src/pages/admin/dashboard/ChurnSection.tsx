import React, { useState, useEffect } from 'react';


import { DetailDrawer } from './DetailDrawer';
import { callRpcWithRetry } from '../../../lib/supabase-rpc';
import { Select } from '../../../components/ui/Select';

export const ChurnSection: React.FC = () => {
  const [period, setPeriod] = useState<string>('30d');
  const [churnData, setChurnData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [churnedUsers, setChurnedUsers] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    const fetchChurn = async () => {
      setLoading(true);
      try {
        const { data, error } = await callRpcWithRetry('get_churn_rate', { p_period: period });
        if (error) throw error;
        setChurnData(data);
      } catch (err) {
        console.error('Erreur fetch churn:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchChurn();
  }, [period]);

  const openDetails = async () => {
    setDrawerOpen(true);
    setLoadingDetail(true);
    try {
      const { data, error } = await callRpcWithRetry('get_churned_users_detail', { p_period: period });
      if (error) throw error;
      setChurnedUsers(data || []);
    } catch (err) {
      console.error('Erreur fetch churned users detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  if (loading || !churnData) {
    return <div className="h-48 w-full bg-admin-card animate-pulse rounded-xl"></div>;
  }

  // Format data for chart (if we had historical points from RPC)
  // The current get_churn_rate returns a single aggregate, we'll mock a small trend or just display the current value as a prominent KPI if historical isn't array.
  // Assuming churnData might return a single object, we focus on the KPI.

  return (
    <>
      <div className="bg-admin-card p-6 rounded-xl border border-admin-border flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-black tracking-tight text-admin-text">Désabonnements (Churn)</h2>
          <Select 
            value={period} 
            onChange={(val) => setPeriod(val)}
            options={[
              { value: '7d', label: '7 Derniers Jours' },
              { value: '30d', label: '30 Derniers Jours' },
              { value: '3m', label: '3 Derniers Mois' }
            ]}
            isAdmin={true}
            containerClassName="w-48 self-start"
          />
        </div>

        <div className="flex items-center gap-6 cursor-pointer group" onClick={openDetails}>
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold uppercase tracking-wider text-admin-text-muted mb-1">Taux Actuel</span>
            <span className="text-4xl font-black text-red-400 group-hover:text-red-300 transition-colors">
              {churnData.churn_rate_pct?.toFixed(1)}%
            </span>
          </div>
          
          <div className="h-12 w-px bg-admin-border"></div>
          
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-admin-text-muted mb-1">Comptes Perdus</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-admin-text">{churnData.nb_churned}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${churnData.evolution_pts > 0 ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                {churnData.evolution_pts > 0 ? '+' : ''}{churnData.evolution_pts?.toFixed(1)} pts
              </span>
            </div>
          </div>
          
          <div className="ml-4 p-3 bg-admin-surface group-hover:bg-admin-border rounded-xl transition-colors">
            <span className="material-symbols-outlined text-admin-text-muted group-hover:text-admin-text">chevron_right</span>
          </div>
        </div>
      </div>

      <DetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`Détail Churn (${period})`}
        width="lg"
      >
        {loadingDetail ? (
          <div className="animate-pulse flex flex-col gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-admin-surface border border-admin-border rounded-xl"></div>
            ))}
          </div>
        ) : churnedUsers.length === 0 ? (
          <p className="text-admin-text-muted text-sm text-center py-8">Aucun compte perdu sur cette période.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {churnedUsers.map((u: any, idx: number) => (
              <div key={idx} className="bg-admin-card p-5 rounded-xl border border-admin-border flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-admin-text text-sm block">{u.boutique_nom}</span>
                    <span className="text-xs text-admin-text-muted">{u.prenom} {u.nom}</span>
                  </div>
                  <span className="px-2 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-[10px] uppercase font-black tracking-wider">
                    {u.plan}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-admin-border flex justify-between text-[10px] uppercase tracking-wider text-admin-text-muted">
                  <span>Annulé le: {new Date(u.date_annulation).toLocaleDateString()}</span>
                  <span>Valeur: {u.montant_paye} FCFA payés</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DetailDrawer>
    </>
  );
};
