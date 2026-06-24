import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface PlatformStats {
  total_boutiques: number;
  active_boutiques: number;
  suspended_boutiques: number;
  total_users: number;
  total_sales_today: number;
  total_sales_week: number;
  total_sales_month: number;
  ca_today: number;
  ca_week: number;
  ca_month: number;
  active_subscriptions: number;
  expired_subscriptions: number;
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [demoReason, setDemoReason] = useState<string | null>(null);

  // Demo data used when the backend RPCs haven't been deployed yet
  const DEMO_STATS: PlatformStats = {
    total_boutiques: 12,
    active_boutiques: 10,
    suspended_boutiques: 2,
    total_users: 34,
    total_sales_today: 47,
    total_sales_week: 312,
    total_sales_month: 1205,
    ca_today: 285000,
    ca_week: 1870000,
    ca_month: 7430000,
    active_subscriptions: 8,
    expired_subscriptions: 4
  };

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const { data, error: err } = await supabase.rpc('admin_platform_stats');
        if (err) throw err;
        setStats(data);
        setIsDemo(false);
      } catch (e: any) {
        // Fallback to demo data when the RPC doesn't exist yet or permission is denied
        console.warn('[AdminDashboard] RPC admin_platform_stats indisponible, utilisation des données démo.', e.message);
        setStats(DEMO_STATS);
        setIsDemo(true);
        setDemoReason(e.message || 'RPC non déployé');
        setError(null);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-20 text-admin-text-muted">
        <div className="w-10 h-10 border-4 border-admin-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-black uppercase tracking-wider">Chargement des statistiques...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 bg-red-950/20 border border-red-900/40 text-red-400 rounded-xl text-center">
        <span className="material-symbols-outlined text-3xl mb-1">warning</span>
        <p className="text-sm font-bold">{error || "Impossible de charger les données."}</p>
      </div>
    );
  }

  const formatNum = (num: number) => new Intl.NumberFormat('fr-FR').format(num);

  return (
    <div className="flex flex-col gap-6 text-left">
      <div>
        <h1 className="text-xl font-black text-admin-text uppercase tracking-wider">Dashboard Plateforme</h1>
        <p className="text-xs text-admin-text-muted">Indicateurs clés et chiffre d'affaires global BoutikOS.</p>
      </div>

      {isDemo && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined text-amber-400 text-lg">science</span>
          <div className="flex flex-col">
            <span className="text-xs font-black text-amber-300 uppercase tracking-wider">Mode Démo</span>
            <span className="text-[10px] text-amber-400/80">
              Les données affichées sont fictives. Raison : {demoReason || 'Inconnue (Vérifiez la console)'}
            </span>
          </div>
        </div>
      )}

      {/* Main KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Boutiques", val: stats.total_boutiques, sub: `${stats.active_boutiques} actives / ${stats.suspended_boutiques} suspendues`, icon: "store", color: "text-admin-primary-light bg-admin-primary/10" },
          { label: "Utilisateurs", val: stats.total_users, sub: "Comptes créés", icon: "people", color: "text-blue-400 bg-blue-500/10" },
          { label: "Abonnements Actifs", val: stats.active_subscriptions, sub: `${stats.expired_subscriptions} expirés`, icon: "credit_card", color: "text-emerald-400 bg-emerald-500/10" },
          { label: "Ventes (Aujourd'hui)", val: stats.total_sales_today, sub: `${stats.total_sales_week} cette semaine`, icon: "shopping_cart", color: "text-amber-400 bg-amber-500/10" }
        ].map((item, idx) => (
          <div key={idx} className="p-4 bg-admin-card border border-admin-border rounded-2xl flex flex-col gap-2 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-admin-text-muted">{item.label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color}`}>
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
              </div>
            </div>
            <span className="text-2xl font-black text-admin-text font-numeric-display">{formatNum(item.val)}</span>
            <span className="text-[9px] font-bold text-admin-text-muted">{item.sub}</span>
          </div>
        ))}
      </div>

      {/* Revenue Section */}
      <div className="bg-admin-card border border-admin-border rounded-2xl p-5 flex flex-col gap-4">
        <h2 className="text-xs font-black uppercase tracking-wider text-admin-text border-b border-admin-border pb-3 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">payments</span>
          Chiffre d'Affaires Cumulé (FCFA)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Aujourd'hui", val: stats.ca_today, bg: "bg-admin-primary/5" },
            { label: "7 derniers jours", val: stats.ca_week, bg: "bg-admin-primary/10" },
            { label: "30 derniers jours", val: stats.ca_month, bg: "bg-gradient-to-br from-admin-primary/20 to-transparent" }
          ].map((item, idx) => (
            <div key={idx} className={`p-4 rounded-xl border border-admin-border/60 ${item.bg} flex flex-col gap-1`}>
              <span className="text-[10px] font-black uppercase tracking-wider text-admin-text-muted">{item.label}</span>
              <span className="text-xl font-black text-admin-text font-numeric-display">
                {formatNum(item.val)} <span className="text-xs font-medium text-admin-text-muted">FCFA</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick overview of sales volume */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-admin-card border border-admin-border rounded-2xl p-5 flex flex-col gap-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-admin-text border-b border-admin-border pb-2">
            Volume de Ventes
          </h3>
          <div className="flex flex-col gap-2.5">
            {[
              { label: "Aujourd'hui", val: stats.total_sales_today, max: Math.max(stats.total_sales_today, 10) },
              { label: "7 derniers jours", val: stats.total_sales_week, max: Math.max(stats.total_sales_week, 10) },
              { label: "30 derniers jours", val: stats.total_sales_month, max: Math.max(stats.total_sales_month, 10) }
            ].map((p, i) => {
              const percent = Math.min(100, Math.round((p.val / p.max) * 100));
              return (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-bold text-admin-text-muted">
                    <span>{p.label}</span>
                    <span>{formatNum(p.val)} transactions</span>
                  </div>
                  <div className="h-2 bg-admin-surface rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-admin-primary-light rounded-full" 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-admin-card border border-admin-border rounded-2xl p-5 flex flex-col gap-3 justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-admin-text border-b border-admin-border pb-2">
              Performance SaaS
            </h3>
            <p className="text-[11px] text-admin-text-muted mt-1 leading-relaxed">
              Le taux de conversion vers les formules payantes (Pro / Annuel) est calculé sur la base des abonnements actifs.
            </p>
          </div>
          <div className="flex justify-around items-center py-2">
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-admin-text-muted">Taux d'Activité</span>
              <span className="text-2xl font-black text-admin-primary-light mt-1">
                {stats.total_boutiques > 0 ? Math.round((stats.active_boutiques / stats.total_boutiques) * 100) : 0}%
              </span>
            </div>
            <span className="w-px h-8 bg-admin-border" />
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-admin-text-muted">Abonnements / Boutiques</span>
              <span className="text-2xl font-black text-emerald-400 mt-1">
                {stats.total_boutiques > 0 ? Math.round((stats.active_subscriptions / stats.total_boutiques) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
