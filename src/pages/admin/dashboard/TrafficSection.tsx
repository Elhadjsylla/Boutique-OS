import React, { useState, useEffect } from 'react';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DetailDrawer } from './DetailDrawer';
import { callRpcWithRetry } from '../../../lib/supabase-rpc';
import { Select } from '../../../components/ui/Select';

export const TrafficSection: React.FC = () => {
  const [period, setPeriod] = useState<string>('30d');
  const [trafficData, setTrafficData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newUsers, setNewUsers] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    const fetchTraffic = async () => {
      setLoading(true);
      try {
        const { data, error } = await callRpcWithRetry('get_new_users_by_period', { p_period: period });
        if (error) throw error;
        setTrafficData(data);
      } catch (err) {
        console.error('Erreur fetch traffic:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTraffic();
  }, [period]);

  const openDetails = async () => {
    setDrawerOpen(true);
    setLoadingDetail(true);
    try {
      const { data, error } = await callRpcWithRetry('get_new_users_detail', { p_period: period });
      if (error) throw error;
      setNewUsers(data || []);
    } catch (err) {
      console.error('Erreur fetch new users detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  if (loading || !trafficData) {
    return <div className="h-64 w-full bg-admin-card animate-pulse rounded-xl"></div>;
  }

  // Create a simple stacked bar chart representation from the aggregated data if no historical array is returned.
  // We'll just show the breakdown in a single stacked bar for the period.
  const chartData = [
    {
      name: 'Nouveaux',
      caissier: trafficData.par_role?.caissier || 0,
      gerant: trafficData.par_role?.gerant || 0,
    }
  ];

  return (
    <>
      <div className="bg-admin-card p-6 rounded-xl border border-admin-border flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-black tracking-tight text-admin-text">Trafic & Nouveaux Comptes</h2>
          <Select 
            value={period} 
            onChange={(val) => setPeriod(val)}
            options={[
              { value: '24h', label: '24 Dernières Heures' },
              { value: '7d', label: '7 Derniers Jours' },
              { value: '30d', label: '30 Derniers Jours' },
              { value: 'all', label: 'Depuis le début' },
            ]}
            isAdmin={true}
            containerClassName="w-48"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col justify-center cursor-pointer group" onClick={openDetails}>
            <span className="text-xs font-bold uppercase tracking-wider text-admin-text-muted mb-2">Comptes Créés</span>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black text-admin-text group-hover:text-admin-primary transition-colors">{trafficData.total}</span>
              <span className={`text-sm font-bold mb-1 ${trafficData.evolution_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {trafficData.evolution_pct >= 0 ? '+' : ''}{trafficData.evolution_pct}%
              </span>
            </div>
            
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-admin-text-muted font-bold">Gérants</span>
                <span className="text-admin-text font-black">{trafficData.par_role?.gerant || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-admin-text-muted font-bold">Caissiers</span>
                <span className="text-admin-text font-black">{trafficData.par_role?.caissier || 0}</span>
              </div>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-admin-primary mt-4 opacity-0 group-hover:opacity-100 transition-opacity">Voir la liste complète →</span>
          </div>

          <div className="h-48 cursor-pointer min-w-0" onClick={openDetails}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d44" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" hide />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#1e1e2e', borderColor: '#2d2d44', color: '#fff', borderRadius: '8px' }} />
                <Bar dataKey="gerant" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="Gérants" />
                <Bar dataKey="caissier" stackId="a" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Caissiers" />
                <Legend iconType="circle" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <DetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`Nouveaux Comptes (${period})`}
        width="lg"
      >
        {loadingDetail ? (
          <div className="animate-pulse flex flex-col gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-admin-surface border border-admin-border rounded-xl"></div>
            ))}
          </div>
        ) : newUsers.length === 0 ? (
          <p className="text-admin-text-muted text-sm text-center py-8">Aucun nouveau compte sur cette période.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {newUsers.map((u: any, idx: number) => (
              <div key={idx} className="bg-admin-card p-4 rounded-xl border border-admin-border flex justify-between items-center hover:border-admin-primary/50 transition-colors">
                <div className="flex flex-col">
                  <span className="font-bold text-admin-text text-sm">{u.prenom} {u.nom}</span>
                  <span className="text-[10px] text-admin-text-muted mt-1 uppercase tracking-wider">
                    {u.email} • {u.boutique_nom}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold ${u.role === 'gerant' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    {u.role}
                  </span>
                  <span className="text-[10px] text-admin-text-muted">
                    {new Date(u.created_at).toLocaleDateString()}
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
