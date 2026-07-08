import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Types
interface Alert {
  id: string;
  type: string;
  message: string;
  severite: 'urgent' | 'attention' | 'info';
  cible_id: string;
  created_at: string;
  lue: boolean;
}

interface PendingUser {
  id: string;
  nom: string;
  prenom: string;
  email_masque: string;
  telephone_masque: string;
  created_at: string;
  role_demande: string;
  boutique_nom: string | null;
}


interface RevenueData {
  period: string;
  total_revenu: number;
  nb_transactions: number;
  revenu_par_plan: Record<string, number>;
  revenu_par_methode: Record<string, number>;
  evolution_pct: number;
  revenu_periode_prec: number;
}

interface TransactionDetail {
  subscription_id: string;
  user_id: string;
  nom_boutique: string;
  montant: number;
  plan: string;
  methode_paiement: string;
  date: string;
  statut: string;
}

interface MRRData {
  mrr: number;
  arr: number;
  historique_6_mois: { mois: string; mrr: number }[];
}

interface LTVData {
  starter: { nb_utilisateurs: number; revenu_moyen: number; duree_moyenne_mois: number; ltv: number };
  pro: { nb_utilisateurs: number; revenu_moyen: number; duree_moyenne_mois: number; ltv: number };
  annual: { nb_utilisateurs: number; revenu_moyen: number; duree_moyenne_mois: number; ltv: number };
}

interface FunnelData {
  distribution: { plan: string; nb_users: number }[];
  transitions: { from_plan: string; to_plan: string; total: number; upgrades: number; downgrades: number }[];
  conversion_free_30j: { total_free: number; convertis: number; taux_pct: number };
}

interface ChurnData {
  period: string;
  churn_rate_pct: number;
  nb_churned: number;
  nb_actifs_debut: number;
  churn_rate_prec_pct: number;
  evolution_pts: number;
}



interface TrafficData {
  period: string;
  total: number;
  par_role: Record<string, number>;
  par_statut: Record<string, number>;
  total_prec: number;
  evolution_pct: number;
}


interface ActiveVsDormant {
  seuil_jours: number;
  nb_actives: number;
  nb_dormantes: number;
  nb_suspendues: number;
  total: number;
  detail: any[];
}

interface TopBoutique {
  boutique_id: string;
  nom: string;
  quartier: string | null;
  adresse: string | null;
  revenu: number;
  nb_transactions: number;
  plan: string;
  suspended: boolean;
}

interface BoutiqueGeo {
  boutique_id: string;
  nom: string;
  quartier: string;
  latitude: number;
  longitude: number;
  revenu_total: number;
  nb_ventes: number;
  statut: string;
}

interface GeoData {
  total_boutiques: number;
  boutiques_localisees: number;
  boutiques: BoutiqueGeo[];
}

interface Signalement {
  id: string;
  type: 'bug' | 'suggestion' | 'plainte' | 'autre';
  sujet: string;
  statut: 'nouveau' | 'en_cours' | 'resolu';
  priorite: 'haute' | 'normale' | 'basse';
  created_at: string;
  nom_user: string;
  email_user: string;
  nom_boutique: string | null;
  nb_reponses: number;
  dernier_message_at: string;
}

interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

interface AdminDashboardProps {
  onNavigate?: (tab: 'dashboard' | 'boutiques' | 'users' | 'subscriptions' | 'logs') => void;
}

// Leaflet custom icons configuration
const createCustomMarker = (isActive: boolean, nom: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-lg ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}" title="${nom}">
      <div class="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

export const AdminDashboard: React.FC<AdminDashboardProps> = () => {
  // Global States
  const [period, setPeriod] = useState<string>('7d');
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Sections loading states
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [loadingPending, setLoadingPending] = useState(true);
  const [loadingRevenue, setLoadingRevenue] = useState(true);
  const [loadingLtvFunnel, setLoadingLtvFunnel] = useState(true);
  const [loadingChurn, setLoadingChurn] = useState(true);
  const [loadingTraffic, setLoadingTraffic] = useState(true);
  const [loadingBoutiques, setLoadingBoutiques] = useState(true);
  const [loadingGeo, setLoadingGeo] = useState(true);
  const [loadingSignalements, setLoadingSignalements] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Data States
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [revenueDataPrev, setRevenueDataPrev] = useState<RevenueData | null>(null);
  const [mrrData, setMrrData] = useState<MRRData | null>(null);
  const [ltvData, setLtvData] = useState<LTVData | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [churnData, setChurnData] = useState<ChurnData | null>(null);
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [activeVsDormant, setActiveVsDormant] = useState<ActiveVsDormant | null>(null);
  const [topBoutiques, setTopBoutiques] = useState<TopBoutique[]>([]);
  const [topBoutiquesSort, setTopBoutiquesSort] = useState<'revenu' | 'volume'>('revenu');
  const [geoData, setGeoData] = useState<GeoData | null>(null);
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [signalementsStatut, setSignalementsStatut] = useState<string>('all');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Search/Filters states
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingRoleFilter, setPendingRoleFilter] = useState('all');

  // Drawer / Details Modal State
  const [activeDrawer, setActiveDrawer] = useState<{
    type: 'user_detail' | 'revenue_breakdown' | 'churn_detail' | 'traffic_detail' | 'boutique_detail' | 'signalement_thread';
    title: string;
    data: any;
    extra?: any;
  } | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [newResponse, setNewResponse] = useState('');

  // Toast helper
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Fetch Alerts & realtime setup
  const fetchAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const { data, error } = await supabase.rpc('get_alerts', { p_non_lues_only: true });
      if (error) throw error;
      setAlerts(data || []);
    } catch (e: any) {
      showToast(e.message || "Erreur de chargement des alertes", 'error');
    } finally {
      setLoadingAlerts(false);
    }
  };

  // 2. Fetch pending validations & realtime setup
  const fetchPendingUsers = async () => {
    setLoadingPending(true);
    try {
      const { data, error } = await supabase.rpc('get_users_pending_validation');
      if (error) throw error;
      setPendingUsers(data || []);
    } catch (e: any) {
      showToast(e.message || "Erreur de chargement des comptes à valider", 'error');
    } finally {
      setLoadingPending(false);
    }
  };

  // 3. Fetch Revenue / MRR / ARR
  const fetchRevenue = async () => {
    setLoadingRevenue(true);
    try {
      const [{ data: revData, error: revErr }, { data: mrrDataRes, error: mrrErr }] = await Promise.all([
        supabase.rpc('get_revenue_by_period', { p_period: period }),
        supabase.rpc('get_mrr_arr')
      ]);

      if (revErr) throw revErr;
      if (mrrErr) throw mrrErr;

      setRevenueData(revData);
      setMrrData(mrrDataRes);

      if (compareMode) {
        // Simple mock comparison or fetch previous period if supported
        // Here we simulate previous data logic by calling with double period size or offset if supported
        // For standard UI, we show secondary comparison calculations
        setRevenueDataPrev({
          ...revData,
          total_revenu: revData.revenu_periode_prec,
          nb_transactions: Math.round(revData.nb_transactions * 0.9),
          evolution_pct: 0
        });
      }
    } catch (e: any) {
      showToast(e.message || "Erreur de chargement des revenus", 'error');
    } finally {
      setLoadingRevenue(false);
    }
  };

  // 4. Fetch LTV & Funnel
  const fetchLtvFunnel = async () => {
    setLoadingLtvFunnel(true);
    try {
      const [{ data: ltvRes, error: ltvErr }, { data: funnelRes, error: funnelErr }] = await Promise.all([
        supabase.rpc('get_ltv_by_plan'),
        supabase.rpc('get_conversion_funnel')
      ]);

      if (ltvErr) throw ltvErr;
      if (funnelErr) throw funnelErr;

      setLtvData(ltvRes);
      setFunnelData(funnelRes);
    } catch (e: any) {
      showToast(e.message || "Erreur de chargement du funnel / LTV", 'error');
    } finally {
      setLoadingLtvFunnel(false);
    }
  };

  // 5. Fetch Churn
  const fetchChurn = async () => {
    setLoadingChurn(true);
    try {
      const { data, error } = await supabase.rpc('get_churn_rate', { p_period: period });
      if (error) throw error;
      setChurnData(data);
    } catch (e: any) {
      showToast(e.message || "Erreur de chargement du Churn", 'error');
    } finally {
      setLoadingChurn(false);
    }
  };

  // 6. Fetch Traffic / New accounts
  const fetchTraffic = async () => {
    setLoadingTraffic(true);
    try {
      const { data, error } = await supabase.rpc('get_new_users_by_period', { p_period: period });
      if (error) throw error;
      setTrafficData(data);
    } catch (e: any) {
      showToast(e.message || "Erreur de chargement du trafic", 'error');
    } finally {
      setLoadingTraffic(false);
    }
  };

  // 7. Fetch Boutiques (Top 10 / active vs dormant)
  const fetchBoutiques = async () => {
    setLoadingBoutiques(true);
    try {
      const [{ data: topRes, error: topErr }, { data: statusRes, error: statusErr }] = await Promise.all([
        supabase.rpc('get_top_boutiques', { p_period: period, p_limit: 10 }),
        supabase.rpc('get_active_vs_dormant', { p_seuil_jours: 30 })
      ]);

      if (topErr) throw topErr;
      if (statusErr) throw statusErr;

      setTopBoutiques(topRes || []);
      setActiveVsDormant(statusRes);
    } catch (e: any) {
      showToast(e.message || "Erreur de chargement des boutiques", 'error');
    } finally {
      setLoadingBoutiques(false);
    }
  };

  // 8. Fetch Geo Map
  const fetchGeo = async () => {
    setLoadingGeo(true);
    try {
      const { data, error } = await supabase.rpc('get_boutiques_geo');
      if (error) throw error;
      setGeoData(data);
    } catch (e: any) {
      showToast(e.message || "Erreur de chargement de la carte géographique", 'error');
    } finally {
      setLoadingGeo(false);
    }
  };

  // 9. Fetch Signalements
  const fetchSignalements = async () => {
    setLoadingSignalements(true);
    try {
      const { data, error } = await supabase.rpc('get_signalements', { 
        p_statut: signalementsStatut === 'all' ? null : signalementsStatut 
      });
      if (error) throw error;
      setSignalements(data || []);
    } catch (e: any) {
      showToast(e.message || "Erreur de chargement des signalements", 'error');
    } finally {
      setLoadingSignalements(false);
    }
  };

  // 10. Fetch Audit Logs
  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('sys_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setAuditLogs(data || []);
    } catch (e: any) {
      showToast(e.message || "Erreur de chargement des logs d'actions", 'error');
    } finally {
      setLoadingLogs(false);
    }
  };

  // Global useEffect for initial loads
  useEffect(() => {
    fetchAlerts();
    fetchPendingUsers();
    fetchLtvFunnel();
    fetchGeo();
    fetchLogs();

    // REALTIME CHANNELS
    // 1. Alerts subscription
    const alertsChannel = supabase.channel('admin-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, () => {
        fetchAlerts();
        showToast("Nouvelle alerte détectée !", 'error');
      })
      .subscribe();

    // 2. Pending users validation subscription
    const usersChannel = supabase.channel('admin-pending')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profils' }, () => {
        fetchPendingUsers();
      })
      .subscribe();

    // 3. Signalements updates subscription
    const signalementsChannel = supabase.channel('admin-signalements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'signalements' }, () => {
        fetchSignalements();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(alertsChannel);
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(signalementsChannel);
    };
  }, []);

  // Update period based fetches
  useEffect(() => {
    fetchRevenue();
    fetchChurn();
    fetchTraffic();
    fetchBoutiques();
  }, [period, compareMode]);

  // Update signalements based fetch
  useEffect(() => {
    fetchSignalements();
  }, [signalementsStatut]);

  // Interactivity Actions
  const handleOpenUserDetail = async (userId: string) => {
    setDrawerLoading(true);
    setActiveDrawer({ type: 'user_detail', title: "Détails de l'utilisateur", data: null });
    try {
      const { data, error } = await supabase.rpc('get_user_full_details', { p_user_id: userId });
      if (error) throw error;
      setActiveDrawer({ type: 'user_detail', title: `Détails de ${data.nom} ${data.prenom}`, data });
    } catch (e: any) {
      showToast(e.message || "Erreur de chargement des détails utilisateur", 'error');
      setActiveDrawer(null);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      const { error } = await supabase.rpc('approve_user', { p_user_id: userId });
      if (error) throw error;
      showToast("Compte utilisateur approuvé avec succès !");
      fetchPendingUsers();
      fetchLogs();
      setActiveDrawer(null);
    } catch (e: any) {
      showToast(e.message || "Erreur lors de l'approbation", 'error');
    }
  };

  const handleRejectUser = async (userId: string, reason: string) => {
    try {
      const { error } = await supabase.rpc('reject_user', { p_user_id: userId, p_raison: reason });
      if (error) throw error;
      showToast("Compte utilisateur rejeté.");
      fetchPendingUsers();
      fetchLogs();
      setActiveDrawer(null);
    } catch (e: any) {
      showToast(e.message || "Erreur lors du rejet", 'error');
    }
  };

  const handleOpenRevenueBreakdown = async (subPeriod: string) => {
    setDrawerLoading(true);
    setActiveDrawer({ type: 'revenue_breakdown', title: `Transactions - ${subPeriod}`, data: [] });
    try {
      const { data, error } = await supabase.rpc('get_revenue_breakdown', { p_period: period });
      if (error) throw error;
      setActiveDrawer({ type: 'revenue_breakdown', title: `Transactions - ${subPeriod}`, data: data || [] });
    } catch (e: any) {
      showToast(e.message || "Erreur de chargement des transactions", 'error');
      setActiveDrawer(null);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleOpenChurnDetail = async (subPeriod: string) => {
    setDrawerLoading(true);
    setActiveDrawer({ type: 'churn_detail', title: `Détails Churn - ${subPeriod}`, data: [] });
    try {
      const { data, error } = await supabase.rpc('get_churned_users_detail', { p_period: period });
      if (error) throw error;
      setActiveDrawer({ type: 'churn_detail', title: `Utilisateurs désabonnés - ${subPeriod}`, data: data || [] });
    } catch (e: any) {
      showToast(e.message || "Erreur de chargement du détail du churn", 'error');
      setActiveDrawer(null);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleOpenTrafficDetail = async (subPeriod: string) => {
    setDrawerLoading(true);
    setActiveDrawer({ type: 'traffic_detail', title: `Inscriptions - ${subPeriod}`, data: [] });
    try {
      const { data, error } = await supabase.rpc('get_new_users_detail', { p_period: period });
      if (error) throw error;
      setActiveDrawer({ type: 'traffic_detail', title: `Nouveaux comptes - ${subPeriod}`, data: data || [] });
    } catch (e: any) {
      showToast(e.message || "Erreur de chargement du détail du trafic", 'error');
      setActiveDrawer(null);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleOpenSignalementThread = async (sigId: string) => {
    setDrawerLoading(true);
    setActiveDrawer({ type: 'signalement_thread', title: "Signalement", data: null });
    try {
      const { data, error } = await supabase.rpc('get_signalement_thread', { p_signalement_id: sigId });
      if (error) throw error;
      setActiveDrawer({ 
        type: 'signalement_thread', 
        title: `Signalement #${sigId.slice(0, 8)} - ${data.signalement.sujet}`, 
        data: data 
      });
    } catch (e: any) {
      showToast(e.message || "Erreur de chargement du fil de discussion", 'error');
      setActiveDrawer(null);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleSendSignalementResponse = async (sigId: string) => {
    if (!newResponse.trim()) return;
    try {
      const { error } = await supabase.rpc('repondre_signalement', {
        p_signalement_id: sigId,
        p_message: newResponse.trim()
      });
      if (error) throw error;
      showToast("Réponse envoyée !");
      setNewResponse('');
      // Reload thread
      const { data } = await supabase.rpc('get_signalement_thread', { p_signalement_id: sigId });
      setActiveDrawer(prev => prev ? { ...prev, data } : null);
      fetchSignalements();
    } catch (e: any) {
      showToast(e.message || "Erreur d'envoi de réponse", 'error');
    }
  };

  const handleResolveSignalement = async (sigId: string) => {
    try {
      const { error } = await supabase.rpc('update_signalement_statut', {
        p_signalement_id: sigId,
        p_statut: 'resolu'
      });
      if (error) throw error;
      showToast("Signalement marqué comme résolu.");
      // Reload thread
      const { data } = await supabase.rpc('get_signalement_thread', { p_signalement_id: sigId });
      setActiveDrawer(prev => prev ? { ...prev, data } : null);
      fetchSignalements();
    } catch (e: any) {
      showToast(e.message || "Erreur de mise à jour du statut", 'error');
    }
  };

  const handleMarkAlertRead = async (alertId: string) => {
    try {
      const { error } = await supabase.rpc('mark_alert_read', { p_alert_id: alertId });
      if (error) throw error;
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      showToast("Alerte archivée.");
    } catch (e: any) {
      showToast(e.message || "Erreur de marquage", 'error');
    }
  };

  const handleMarkAllAlertsRead = async () => {
    try {
      const { error } = await supabase.rpc('mark_all_alerts_read');
      if (error) throw error;
      setAlerts([]);
      showToast("Toutes les alertes ont été lues.");
    } catch (e: any) {
      showToast(e.message || "Erreur", 'error');
    }
  };

  const exportToCSV = (data: any[], filename = 'export.csv') => {
    if (!data || !data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(val => 
        typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
      ).join(',')
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper formats
  const formatNum = (num: number) => new Intl.NumberFormat('fr-FR').format(num);

  const getAlertColor = (sev: 'urgent' | 'attention' | 'info') => {
    if (sev === 'urgent') return 'bg-rose-950/20 border-rose-900/40 text-rose-400';
    if (sev === 'attention') return 'bg-amber-950/20 border-amber-900/40 text-amber-400';
    return 'bg-blue-950/20 border-blue-900/40 text-blue-400';
  };

  // Filters pending list
  const filteredPendingUsers = pendingUsers.filter(u => {
    const matchesSearch = `${u.nom} ${u.prenom} ${u.email_masque}`.toLowerCase().includes(pendingSearch.toLowerCase());
    const matchesRole = pendingRoleFilter === 'all' || u.role_demande === pendingRoleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="flex flex-col gap-8 text-left pb-16 relative">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg transition-all animate-bounce ${
          toast.type === 'error' ? 'bg-rose-950 border-rose-900 text-rose-300' : 'bg-emerald-950 border-emerald-900 text-emerald-300'
        }`}>
          <span className="material-symbols-outlined">{toast.type === 'error' ? 'error' : 'check_circle'}</span>
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {/* Header & Main Selectors */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-admin-text uppercase tracking-wider">Dashboard Super Admin</h1>
          <p className="text-xs text-admin-text-muted">Pilotez et analysez en temps réel les performances de Sama Boutik.</p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="flex items-center gap-1.5 bg-admin-card border border-admin-border p-1 rounded-xl">
            {(['24h', '7d', '1m', 'all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  period === p ? 'bg-admin-primary text-white' : 'text-admin-text-muted hover:text-admin-text'
                }`}
              >
                {p === '24h' ? '24h' : p === '7d' ? '7j' : p === '1m' ? '1m' : 'Tout'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`h-9 px-3 border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              compareMode ? 'border-admin-primary bg-admin-primary/10 text-admin-primary-light' : 'border-admin-border text-admin-text-muted hover:text-admin-text'
            }`}
          >
            <span className="material-symbols-outlined text-sm">compare_arrows</span>
            Comparer
          </button>
        </div>
      </div>

      {/* 1. SECTION ALERTES */}
      {!loadingAlerts && alerts.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-admin-text-muted">Alertes Critiques ({alerts.length})</h2>
            <button onClick={handleMarkAllAlertsRead} className="text-[9px] font-bold text-admin-primary-light hover:underline uppercase">Tout masquer</button>
          </div>
          <div className="flex flex-col gap-2">
            {alerts.map(a => (
              <div 
                key={a.id} 
                className={`p-4 border rounded-2xl flex justify-between items-center transition-all hover:scale-[1.01] ${getAlertColor(a.severite)}`}
              >
                <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => {
                  if (a.type === 'compte_attente') handleOpenUserDetail(a.cible_id);
                  if (a.type === 'signalement_urgent') handleOpenSignalementThread(a.cible_id);
                }}>
                  <span className="material-symbols-outlined text-lg">
                    {a.severite === 'urgent' ? 'error_med' : a.severite === 'attention' ? 'warning' : 'info'}
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold leading-normal">{a.message}</span>
                    <span className="text-[9px] opacity-75">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleMarkAlertRead(a.id)}
                  className="material-symbols-outlined text-base opacity-60 hover:opacity-100 p-1 cursor-pointer"
                  title="Marquer comme lu"
                >
                  close
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. SECTION COMPTES A VALIDER */}
      <div className="bg-admin-card border border-admin-border rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-admin-border pb-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-admin-text flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">how_to_reg</span>
            Comptes en attente de validation
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black">
            {pendingUsers.length} en attente
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Rechercher par nom, email..."
            value={pendingSearch}
            onChange={(e) => setPendingSearch(e.target.value)}
            className="flex-1 h-9 px-3 bg-admin-surface border border-admin-border rounded-xl text-xs font-semibold outline-none text-admin-text placeholder-admin-text-muted focus:border-admin-primary-light"
          />
          <select
            value={pendingRoleFilter}
            onChange={(e) => setPendingRoleFilter(e.target.value)}
            className="h-9 px-3 bg-admin-surface border border-admin-border rounded-xl text-xs font-semibold outline-none text-admin-text cursor-pointer focus:border-admin-primary-light"
          >
            <option value="all">Tous les rôles</option>
            <option value="gerant">Gérant</option>
            <option value="caissier">Caissier</option>
          </select>
        </div>

        {loadingPending ? (
          <div className="py-10 flex justify-center"><div className="w-6 h-6 border-2 border-admin-primary border-t-transparent rounded-full animate-spin"></div></div>
        ) : filteredPendingUsers.length === 0 ? (
          <p className="text-xs text-admin-text-muted text-center py-6">Aucun utilisateur en attente de validation.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-admin-border text-admin-text-muted uppercase text-[9px] font-black tracking-wider">
                  <th className="py-2.5">Utilisateur</th>
                  <th className="py-2.5">Email</th>
                  <th className="py-2.5">Téléphone</th>
                  <th className="py-2.5">Boutique</th>
                  <th className="py-2.5">Rôle demandé</th>
                  <th className="py-2.5 text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredPendingUsers.map(u => (
                  <tr 
                    key={u.id}
                    onClick={() => handleOpenUserDetail(u.id)}
                    className="border-b border-admin-border/60 hover:bg-admin-surface/45 cursor-pointer transition-all"
                  >
                    <td className="py-3 font-bold text-admin-text">{u.prenom} {u.nom}</td>
                    <td className="py-3 text-admin-text-muted font-numeric-display">{u.email_masque}</td>
                    <td className="py-3 text-admin-text-muted font-numeric-display">{u.telephone_masque}</td>
                    <td className="py-3 font-bold text-admin-primary-light">{u.boutique_nom || 'N/A'}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                        u.role_demande === 'gerant' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      }`}>
                        {u.role_demande}
                      </span>
                    </td>
                    <td className="py-3 text-right text-admin-text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. SECTION REVENUS */}
      <div className="bg-admin-card border border-admin-border rounded-2xl p-5 flex flex-col gap-6">
        <div className="flex justify-between items-center border-b border-admin-border pb-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-admin-text flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">payments</span>
            Suivi Financier & Revenus
          </h2>
          <button 
            onClick={() => revenueData && exportToCSV([revenueData], 'revenu_stats.csv')}
            className="h-8 px-3 border border-admin-border hover:bg-admin-surface rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xs">download</span> CSV
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-admin-surface rounded-2xl border border-admin-border/60 flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-admin-text-muted">Revenu sur Période</span>
            {loadingRevenue ? (
              <div className="h-8 w-32 bg-admin-border/40 animate-pulse rounded-lg mt-1"></div>
            ) : (
              <>
                <span className="text-2xl font-black text-admin-text font-numeric-display">
                  {formatNum(revenueData?.total_revenu || 0)} <span className="text-xs font-medium">FCFA</span>
                </span>
                <span className={`text-[10px] font-bold flex items-center gap-0.5 ${
                  (revenueData?.evolution_pct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  <span className="material-symbols-outlined text-xs">{(revenueData?.evolution_pct || 0) >= 0 ? 'arrow_upward' : 'arrow_downward'}</span>
                  {revenueData?.evolution_pct || 0}% vs période préc.
                </span>
              </>
            )}
          </div>
          <div className="p-4 bg-admin-surface rounded-2xl border border-admin-border/60 flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-admin-text-muted">MRR (Mensuel récurrent)</span>
            {loadingRevenue ? (
              <div className="h-8 w-32 bg-admin-border/40 animate-pulse rounded-lg mt-1"></div>
            ) : (
              <>
                <span className="text-2xl font-black text-emerald-400 font-numeric-display">
                  {formatNum(mrrData?.mrr || 0)} <span className="text-xs font-medium text-admin-text-muted">FCFA</span>
                </span>
                <span className="text-[9px] font-bold text-admin-text-muted">Revenu mensuel estimé</span>
              </>
            )}
          </div>
          <div className="p-4 bg-admin-surface rounded-2xl border border-admin-border/60 flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-admin-text-muted">ARR (Annuel récurrent)</span>
            {loadingRevenue ? (
              <div className="h-8 w-32 bg-admin-border/40 animate-pulse rounded-lg mt-1"></div>
            ) : (
              <>
                <span className="text-2xl font-black text-indigo-400 font-numeric-display">
                  {formatNum(mrrData?.arr || 0)} <span className="text-xs font-medium text-admin-text-muted">FCFA</span>
                </span>
                <span className="text-[9px] font-bold text-admin-text-muted">MRR x 12</span>
              </>
            )}
          </div>
        </div>

        {/* Charts & breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main revenue BarChart */}
          <div className="lg:col-span-2 bg-admin-surface rounded-2xl p-4 border border-admin-border/40 flex flex-col gap-2 h-72">
            <span className="text-[9px] font-black uppercase tracking-widest text-admin-text-muted">Évolution du chiffre d'affaires</span>
            {loadingRevenue ? (
              <div className="w-full h-full bg-admin-border/10 rounded-xl flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-admin-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="90%">
                <BarChart 
                  data={[{ 
                    name: 'Revenu', 
                    montant: revenueData?.total_revenu || 0,
                    prec: compareMode ? (revenueDataPrev?.total_revenu || 0) : null
                  }]}
                  onClick={(e) => {
                    if (e && e.activeLabel) handleOpenRevenueBreakdown(String(e.activeLabel));
                  }}
                  className="cursor-pointer"
                >
                  <XAxis dataKey="name" stroke="#5E636E" fontSize={10} tickLine={false} />
                  <YAxis stroke="#5E636E" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1A2333', borderColor: '#2E3545', color: '#ECEFF4', borderRadius: 8 }} />
                  <Bar dataKey="montant" fill="#1CBB86" radius={[6, 6, 0, 0]} barSize={40} />
                  {compareMode && <Bar dataKey="prec" fill="#2E3545" radius={[6, 6, 0, 0]} barSize={40} />}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Revenue distribution by Plan / PaymentMethod */}
          <div className="bg-admin-surface rounded-2xl p-4 border border-admin-border/40 flex flex-col gap-4 justify-between h-72">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-admin-text-muted">Répartition du revenu</span>
            </div>
            {loadingRevenue ? (
              <div className="w-full h-2/3 bg-admin-border/10 rounded-xl flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-admin-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="flex justify-around items-center h-full">
                {/* Method Pie */}
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-bold text-admin-text-muted uppercase">Paiement</span>
                  <ResponsiveContainer width={100} height={100}>
                    <PieChart>
                      <Pie
                        data={Object.entries(revenueData?.revenu_par_methode || {}).map(([k, v]) => ({ name: k, value: v }))}
                        cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={2} dataKey="value"
                      >
                        <Cell fill="#1CBB86" />
                        <Cell fill="#3F91F2" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <span className="text-[10px] font-bold text-admin-text">Wave / OM</span>
                </div>
                {/* Plan Pie */}
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-bold text-admin-text-muted uppercase">Plan</span>
                  <ResponsiveContainer width={100} height={100}>
                    <PieChart>
                      <Pie
                        data={Object.entries(revenueData?.revenu_par_plan || {}).map(([k, v]) => ({ name: k, value: v }))}
                        cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={2} dataKey="value"
                      >
                        <Cell fill="#A78BFA" />
                        <Cell fill="#3F91F2" />
                        <Cell fill="#1CBB86" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <span className="text-[10px] font-bold text-admin-text">SaaS / Pro</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. SECTION LTV & FUNNEL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LTV par Plan */}
        <div className="bg-admin-card border border-admin-border rounded-2xl p-5 flex flex-col gap-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-admin-text border-b border-admin-border pb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">stars</span>
            LTV (Valeur vie client) par abonnement
          </h3>
          {loadingLtvFunnel ? (
            <div className="py-10 flex justify-center"><div className="w-6 h-6 border-2 border-admin-primary border-t-transparent rounded-full animate-spin"></div></div>
          ) : (
            <div className="flex flex-col gap-3 flex-1 justify-center">
              {['starter', 'pro', 'annual'].map(plan => {
                const p = ltvData?.[plan as keyof LTVData];
                return (
                  <div key={plan} className="flex justify-between items-center p-3.5 bg-admin-surface rounded-xl border border-admin-border/50">
                    <div className="flex flex-col text-left gap-1">
                      <span className="text-xs font-black uppercase tracking-wider text-admin-text">{plan}</span>
                      <span className="text-[9px] text-admin-text-muted font-bold">
                        {p?.nb_utilisateurs || 0} utilisateurs • durée moy. {p?.duree_moyenne_mois || 0} mois
                      </span>
                    </div>
                    <span className="text-sm font-black text-admin-primary-light font-numeric-display">
                      {formatNum(p?.ltv || 0)} FCFA
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Funnel de conversion */}
        <div className="bg-admin-card border border-admin-border rounded-2xl p-5 flex flex-col gap-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-admin-text border-b border-admin-border pb-2">
            Funnel & Conversion
          </h3>
          {loadingLtvFunnel ? (
            <div className="py-10 flex justify-center"><div className="w-6 h-6 border-2 border-admin-primary border-t-transparent rounded-full animate-spin"></div></div>
          ) : (
            <div className="flex flex-col gap-4 flex-1 justify-center">
              {/* Funnel steps */}
              <div className="flex flex-col gap-2">
                {[
                  { name: 'Essai gratuit', count: funnelData?.conversion_free_30j.total_free || 0, color: 'bg-slate-500/10 border-slate-500/25 text-slate-400' },
                  { name: 'Abonnés convertis', count: funnelData?.conversion_free_30j.convertis || 0, color: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' }
                ].map((step, idx) => (
                  <div key={idx} className={`p-3 rounded-xl border ${step.color} flex justify-between items-center cursor-pointer hover:opacity-90`} onClick={() => handleOpenUserDetail(step.name)}>
                    <span className="text-xs font-bold">{step.name}</span>
                    <span className="text-xs font-black font-numeric-display">{step.count} boutiques</span>
                  </div>
                ))}
              </div>
              <div className="text-center p-3 bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 rounded-xl">
                <span className="text-[10px] font-black uppercase tracking-wider">Taux de conversion global</span>
                <p className="text-2xl font-black mt-1 font-numeric-display">{funnelData?.conversion_free_30j.taux_pct || 0}%</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. SECTION CHURN */}
      <div className="bg-admin-card border border-admin-border rounded-2xl p-5 flex flex-col gap-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-admin-text border-b border-admin-border pb-2 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">trending_down</span>
          Analyse du Churn (Désabonnements)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-admin-surface rounded-xl border border-admin-border/50 flex flex-col gap-1.5 justify-center">
            <span className="text-[9px] font-black uppercase tracking-wider text-admin-text-muted">Taux de Churn</span>
            {loadingChurn ? (
              <div className="h-8 w-24 bg-admin-border/40 animate-pulse rounded-lg"></div>
            ) : (
              <>
                <span className="text-2xl font-black text-rose-400 font-numeric-display">
                  {churnData?.churn_rate_pct || 0}%
                </span>
                <span className="text-[9px] text-admin-text-muted font-bold">
                  {churnData?.nb_churned || 0} désabonnements sur {churnData?.nb_actifs_debut || 0} actifs
                </span>
              </>
            )}
          </div>
          {/* Simple historical BarChart */}
          <div className="md:col-span-2 h-44 bg-admin-surface rounded-xl border border-admin-border/40 p-3">
            <span className="text-[8px] font-bold text-admin-text-muted uppercase">Désabonnements par sous-période</span>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={[{ name: 'Churn', count: churnData?.nb_churned || 0 }]} onClick={() => handleOpenChurnDetail(period)}>
                <XAxis dataKey="name" stroke="#5E636E" fontSize={10} />
                <YAxis stroke="#5E636E" fontSize={10} />
                <Tooltip />
                <Bar dataKey="count" fill="#E06C75" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 6. SECTION TRAFIC / NOUVEAUX UTILISATEURS */}
      <div className="bg-admin-card border border-admin-border rounded-2xl p-5 flex flex-col gap-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-admin-text border-b border-admin-border pb-2 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">trending_up</span>
          Trafic & Inscriptions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-admin-surface rounded-xl border border-admin-border/50 flex flex-col gap-1.5 justify-center">
            <span className="text-[9px] font-black uppercase tracking-wider text-admin-text-muted">Nouveaux Comptes</span>
            {loadingTraffic ? (
              <div className="h-8 w-24 bg-admin-border/40 animate-pulse rounded-lg"></div>
            ) : (
              <>
                <span className="text-2xl font-black text-admin-primary-light font-numeric-display">
                  +{trafficData?.total || 0}
                </span>
                <span className="text-[9px] text-admin-text-muted font-bold">
                  Evolution : {trafficData?.evolution_pct || 0}% vs période précédente
                </span>
              </>
            )}
          </div>
          {/* Simple historical BarChart */}
          <div className="md:col-span-2 h-44 bg-admin-surface rounded-xl border border-admin-border/40 p-3">
            <span className="text-[8px] font-bold text-admin-text-muted uppercase">Inscriptions par rôle</span>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart 
                data={Object.entries(trafficData?.par_role || {}).map(([k, v]) => ({ name: k, count: v }))} 
                onClick={() => handleOpenTrafficDetail(period)}
              >
                <XAxis dataKey="name" stroke="#5E636E" fontSize={10} />
                <YAxis stroke="#5E636E" fontSize={10} />
                <Tooltip />
                <Bar dataKey="count" fill="#4B6FFF" radius={[4, 4, 0, 0]} barSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 7. SECTION BOUTIQUES & TOP 10 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active vs Dormant */}
        <div className="bg-admin-card border border-admin-border rounded-2xl p-5 flex flex-col gap-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-admin-text border-b border-admin-border pb-2">
            Statuts Boutiques (30j)
          </h3>
          {loadingBoutiques ? (
            <div className="py-10 flex justify-center"><div className="w-6 h-6 border-2 border-admin-primary border-t-transparent rounded-full animate-spin"></div></div>
          ) : (
            <div className="flex flex-col gap-4 justify-center flex-1">
              <div className="flex justify-around items-center h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Actives', value: activeVsDormant?.nb_actives || 0, color: '#1CBB86' },
                        { name: 'Dormantes', value: activeVsDormant?.nb_dormantes || 0, color: '#5E636E' },
                        { name: 'Suspendues', value: activeVsDormant?.nb_suspendues || 0, color: '#E06C75' }
                      ]}
                      cx="50%" cy="50%" innerRadius={28} outerRadius={42} dataKey="value"
                    >
                      <Cell fill="#1CBB86" />
                      <Cell fill="#5E636E" />
                      <Cell fill="#E06C75" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-admin-text-muted">Actives :</span>
                  <span className="font-black text-emerald-400">{activeVsDormant?.nb_actives || 0}</span>
                </div>
                <div className="flex justify-between text-xs cursor-pointer hover:underline" onClick={() => handleOpenUserDetail("dormantes")}>
                  <span className="text-admin-text-muted">Dormantes (Relance) :</span>
                  <span className="font-black text-admin-text-muted">{activeVsDormant?.nb_dormantes || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-admin-text-muted">Suspendues :</span>
                  <span className="font-black text-rose-400">{activeVsDormant?.nb_suspendues || 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Top 10 Boutiques */}
        <div className="lg:col-span-2 bg-admin-card border border-admin-border rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-admin-border pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-admin-text">
              Top 10 Boutiques
            </h3>
            <div className="flex gap-1.5 bg-admin-surface border border-admin-border p-0.5 rounded-lg">
              <button
                onClick={() => setTopBoutiquesSort('revenu')}
                className={`px-2 py-1 text-[8px] font-black uppercase rounded transition-all cursor-pointer ${
                  topBoutiquesSort === 'revenu' ? 'bg-admin-primary text-white' : 'text-admin-text-muted'
                }`}
              >
                Revenu
              </button>
              <button
                onClick={() => setTopBoutiquesSort('volume')}
                className={`px-2 py-1 text-[8px] font-black uppercase rounded transition-all cursor-pointer ${
                  topBoutiquesSort === 'volume' ? 'bg-admin-primary text-white' : 'text-admin-text-muted'
                }`}
              >
                Volume
              </button>
            </div>
          </div>
          {loadingBoutiques ? (
            <div className="py-10 flex justify-center"><div className="w-6 h-6 border-2 border-admin-primary border-t-transparent rounded-full animate-spin"></div></div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-admin-text-muted uppercase text-[9px] font-black tracking-wider border-b border-admin-border">
                    <th className="py-1.5">Boutique</th>
                    <th className="py-1.5">Quartier</th>
                    <th className="py-1.5">Revenu</th>
                    <th className="py-1.5 text-right">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {topBoutiques.map((b, i) => (
                    <tr key={b.boutique_id} className="border-b border-admin-border/50 hover:bg-admin-surface/30">
                      <td className="py-2.5 font-bold text-admin-text flex items-center gap-1.5">
                        <span className="text-[9px] font-black text-admin-text-muted bg-admin-surface px-1.5 py-0.5 rounded">#{i+1}</span>
                        {b.nom}
                      </td>
                      <td className="py-2.5 text-admin-text-muted">{b.quartier || 'Non renseigné'}</td>
                      <td className="py-2.5 font-black text-emerald-400 font-numeric-display">{formatNum(b.revenu)} XOF</td>
                      <td className="py-2.5 text-right font-bold text-admin-text font-numeric-display">{b.nb_transactions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 8. SECTION CARTE GEOGRAPHIQUE */}
      <div className="bg-admin-card border border-admin-border rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-admin-border pb-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-admin-text flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">map</span>
            Cartographie des Boutiques (Dakar)
          </h2>
          {geoData && (
            <span className="text-[10px] font-bold text-admin-text-muted">
              {geoData.boutiques_localisees} boutiques localisées sur {geoData.total_boutiques}
            </span>
          )}
        </div>

        {loadingGeo ? (
          <div className="h-[400px] w-full bg-admin-border/10 rounded-2xl flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-admin-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="h-[400px] w-full rounded-2xl overflow-hidden border border-admin-border/70 z-0">
            <MapContainer center={[14.7167, -17.4677]} zoom={12} className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {geoData?.boutiques.map(b => (
                <Marker 
                  key={b.boutique_id} 
                  position={[b.latitude, b.longitude]}
                  icon={createCustomMarker(b.statut === 'active', b.nom)}
                >
                  <Popup>
                    <div className="p-2 flex flex-col gap-1 text-xs">
                      <span className="font-bold text-slate-800 text-sm leading-tight">{b.nom}</span>
                      <span className="text-slate-500 font-medium">Quartier: {b.quartier}</span>
                      <span className="text-emerald-600 font-bold font-numeric-display">Revenu: {formatNum(b.revenu_total)} XOF</span>
                      <span className="text-slate-500 font-bold">Ventes: {b.nb_ventes}</span>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}
      </div>

      {/* 9. SECTION SIGNALEMENTS */}
      <div className="bg-admin-card border border-admin-border rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-admin-border pb-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-admin-text flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">support_agent</span>
            Signalements & Support
          </h2>
          <div className="flex gap-2">
            {(['all', 'nouveau', 'en_cours', 'resolu'] as const).map(stat => (
              <button
                key={stat}
                onClick={() => setSignalementsStatut(stat)}
                className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border transition-all cursor-pointer ${
                  signalementsStatut === stat 
                    ? 'bg-admin-primary text-white border-admin-primary' 
                    : 'bg-admin-surface text-admin-text-muted border-admin-border hover:text-admin-text'
                }`}
              >
                {stat === 'all' ? 'Tous' : stat === 'en_cours' ? 'En cours' : stat}
              </button>
            ))}
          </div>
        </div>

        {loadingSignalements ? (
          <div className="py-10 flex justify-center"><div className="w-6 h-6 border-2 border-admin-primary border-t-transparent rounded-full animate-spin"></div></div>
        ) : signalements.length === 0 ? (
          <p className="text-xs text-admin-text-muted text-center py-6">Aucun signalement trouvé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-admin-border text-admin-text-muted uppercase text-[9px] font-black tracking-wider">
                  <th className="py-2">Sujet / Boutique</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Priorité</th>
                  <th className="py-2">Statut</th>
                  <th className="py-2">Dernier Msg</th>
                  <th className="py-2 text-right">Réponses</th>
                </tr>
              </thead>
              <tbody>
                {signalements.map(s => (
                  <tr 
                    key={s.id}
                    onClick={() => handleOpenSignalementThread(s.id)}
                    className="border-b border-admin-border/50 hover:bg-admin-surface/30 cursor-pointer"
                  >
                    <td className="py-3">
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-admin-text">{s.sujet}</span>
                        <span className="text-[10px] text-admin-primary-light">{s.nom_boutique || 'Boutique Inconnue'} ({s.nom_user})</span>
                      </div>
                    </td>
                    <td className="py-3 capitalize text-admin-text-muted">{s.type}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                        s.priorite === 'haute' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 
                        s.priorite === 'normale' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                        'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        {s.priorite}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                        s.statut === 'nouveau' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        s.statut === 'en_cours' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {s.statut.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-admin-text-muted">{new Date(s.dernier_message_at).toLocaleDateString()}</td>
                    <td className="py-3 text-right font-bold text-admin-text">{s.nb_reponses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 10. SECTION JOURNAL D'ACTIONS ADMIN */}
      <div className="bg-admin-card border border-admin-border rounded-2xl p-5 flex flex-col gap-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-admin-text border-b border-admin-border pb-2 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">history</span>
          Journal d'actions administrateur
        </h3>
        {loadingLogs ? (
          <div className="py-6 flex justify-center"><div className="w-6 h-6 border-2 border-admin-primary border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-admin-text-muted uppercase text-[9px] font-black tracking-wider border-b border-admin-border">
                  <th className="py-2">Date</th>
                  <th className="py-2">Action</th>
                  <th className="py-2">Cible</th>
                  <th className="py-2">Détails</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id} className="border-b border-admin-border/40 hover:bg-admin-surface/30">
                    <td className="py-2.5 text-admin-text-muted font-numeric-display">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="py-2.5 font-bold text-admin-primary-light">{log.action}</td>
                    <td className="py-2.5 text-admin-text font-semibold">{log.target_type} ({log.target_id?.slice(0, 8)})</td>
                    <td className="py-2.5 text-admin-text-muted font-mono text-[10px] truncate max-w-[200px]">{JSON.stringify(log.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAILED GENERIC DRAWER OVERLAY */}
      {activeDrawer && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex justify-end transition-all">
          <div className="w-full max-w-lg bg-admin-card border-l border-admin-border h-full flex flex-col shadow-2xl p-6 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-admin-border pb-4 mb-6">
              <h3 className="text-sm font-black uppercase tracking-wider text-admin-text">{activeDrawer.title}</h3>
              <button 
                onClick={() => setActiveDrawer(null)}
                className="material-symbols-outlined text-lg hover:text-admin-text p-1 cursor-pointer"
              >
                close
              </button>
            </div>

            {drawerLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-admin-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-6 text-left">
                {/* 1. User detail Drawer Content */}
                {activeDrawer.type === 'user_detail' && activeDrawer.data && (
                  <div className="flex flex-col gap-4 text-xs">
                    <div className="grid grid-cols-2 gap-3 bg-admin-surface p-4 rounded-xl border border-admin-border">
                      <div>
                        <span className="text-[9px] text-admin-text-muted uppercase font-bold">Nom Complet</span>
                        <p className="font-bold text-admin-text">{activeDrawer.data.prenom} {activeDrawer.data.nom}</p>
                      </div>
                      <div>
                        <span className="text-[9px] text-admin-text-muted uppercase font-bold">Statut</span>
                        <p className="font-bold capitalize text-amber-400">{activeDrawer.data.status}</p>
                      </div>
                      <div>
                        <span className="text-[9px] text-admin-text-muted uppercase font-bold">Email</span>
                        <p className="font-bold font-numeric-display">{activeDrawer.data.email}</p>
                      </div>
                      <div>
                        <span className="text-[9px] text-admin-text-muted uppercase font-bold">Téléphone</span>
                        <p className="font-bold font-numeric-display">{activeDrawer.data.phone || 'Non renseigné'}</p>
                      </div>
                    </div>

                    {/* Validation Action buttons */}
                    {activeDrawer.data.status === 'pending' && (
                      <div className="flex flex-col gap-3 border-t border-admin-border pt-4">
                        <span className="text-[10px] font-black uppercase tracking-wider text-admin-text">Actions de validation</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveUser(activeDrawer.data.id)}
                            className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                          >
                            Valider le compte
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt("Raison du refus :");
                              if (reason !== null) handleRejectUser(activeDrawer.data.id, reason);
                            }}
                            className="flex-1 h-10 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                          >
                            Refuser
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Transactions detail Drawer Content */}
                {activeDrawer.type === 'revenue_breakdown' && (
                  <div className="flex flex-col gap-4 text-xs">
                    {activeDrawer.data.length === 0 ? (
                      <p className="text-admin-text-muted text-center py-6">Aucune transaction sur cette période.</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {activeDrawer.data.map((tx: TransactionDetail, idx: number) => (
                          <div key={idx} className="p-3 bg-admin-surface border border-admin-border/50 rounded-xl flex justify-between items-center">
                            <div className="flex flex-col text-left">
                              <span className="font-bold text-admin-text">{tx.nom_boutique}</span>
                              <span className="text-[9px] text-admin-text-muted uppercase font-bold">{tx.plan} via {tx.methode_paiement}</span>
                            </div>
                            <span className="font-black text-emerald-400">{formatNum(tx.montant)} XOF</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Signalements thread Drawer Content */}
                {activeDrawer.type === 'signalement_thread' && activeDrawer.data && (
                  <div className="flex flex-col gap-4 flex-1">
                    {/* Main ticket metadata */}
                    <div className="bg-admin-surface p-4 border border-admin-border rounded-xl text-xs flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[9px] font-black uppercase border border-indigo-500/20">
                          {activeDrawer.data.signalement.type}
                        </span>
                        <span className="text-admin-text-muted">{new Date(activeDrawer.data.signalement.created_at).toLocaleString()}</span>
                      </div>
                      <p className="font-bold text-admin-text text-sm">{activeDrawer.data.signalement.sujet}</p>
                      <p className="text-admin-text-muted mt-2 leading-relaxed">{activeDrawer.data.signalement.message}</p>
                    </div>

                    {/* Messages thread list */}
                    <div className="flex-1 flex flex-col gap-3 my-4 overflow-y-auto max-h-[300px] border-t border-admin-border pt-4">
                      {activeDrawer.data.reponses.length === 0 ? (
                        <p className="text-[10px] text-admin-text-muted text-center py-4">Aucune réponse pour le moment.</p>
                      ) : (
                        activeDrawer.data.reponses.map((rep: any) => (
                          <div 
                            key={rep.id} 
                            className={`p-3 rounded-2xl max-w-[85%] text-xs text-left ${
                              rep.auteur_type === 'admin' 
                                ? 'bg-admin-primary/10 border border-admin-primary/20 text-admin-primary-light self-end' 
                                : 'bg-admin-surface border border-admin-border text-admin-text self-start'
                            }`}
                          >
                            <span className="text-[8px] font-black uppercase tracking-wider block mb-1">
                              {rep.nom_auteur} ({rep.auteur_type})
                            </span>
                            <p className="leading-relaxed">{rep.message}</p>
                            <span className="text-[8px] opacity-60 block text-right mt-1.5">
                              {new Date(rep.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Reply interface */}
                    {activeDrawer.data.signalement.statut !== 'resolu' && (
                      <div className="border-t border-admin-border pt-4 flex flex-col gap-3 mt-auto">
                        <textarea
                          placeholder="Saisissez votre réponse..."
                          value={newResponse}
                          onChange={(e) => setNewResponse(e.target.value)}
                          className="w-full h-20 p-3 bg-admin-surface border border-admin-border rounded-xl text-xs font-semibold outline-none text-admin-text focus:border-admin-primary-light placeholder-admin-text-muted resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSendSignalementResponse(activeDrawer.data.signalement.id)}
                            className="flex-1 h-9 bg-admin-primary hover:bg-admin-primary/90 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-sm">send</span> Envoyer
                          </button>
                          <button
                            onClick={() => handleResolveSignalement(activeDrawer.data.signalement.id)}
                            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                          >
                            Marquer résolu
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
