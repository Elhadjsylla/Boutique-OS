import { useState, useEffect, Component, type ErrorInfo, type ReactNode, lazy, Suspense } from 'react';
import { supabase } from './lib/supabase';
import { Caisse } from './pages/Caisse';
import { Stock } from './pages/Stock';
import { Dashboard } from './pages/Dashboard';
import { Ardoise } from './pages/Ardoise';
import { TrialBanner } from './components/ui/TrialBanner';
import { AuthProvider } from './components/AuthProvider';
import { BottomNav, type TabType } from './components/ui/BottomNav';
import { LandingPage } from './pages/LandingPage';
import { useOnline } from './hooks/useOnline';
import { BottomSheet } from './components/ui/BottomSheet';
import { useAuthStore } from './store/useAuthStore';
import { useAuth } from './hooks/useAuth';
import { useSyncEngine } from './hooks/useSyncEngine';

// Lazy load non-critical page components
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Reglages = lazy(() => import('./pages/Reglages').then(m => ({ default: m.Reglages })));
const Subscription = lazy(() => import('./pages/Subscription').then(m => ({ default: m.Subscription })));
const PortalClient = lazy(() => import('./pages/PortalClient').then(m => ({ default: m.PortalClient })));
const MonEspace = lazy(() => import('./pages/MonEspace').then(m => ({ default: m.MonEspace })));
const Abonnement = lazy(() => import('./pages/Abonnement').then(m => ({ default: m.Abonnement })));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));

const LazyFallback = () => (
  <div className="flex justify-center items-center py-20 min-h-[300px]">
    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#1a1a2e', color: '#ff6b6b', minHeight: '100vh' }}>
          <h1 style={{ fontSize: 24, marginBottom: 16 }}>⚠️ Sama Boutik — Erreur Runtime</h1>
          <p style={{ color: '#fff', marginBottom: 8 }}>L'application a planté. Voici l'erreur :</p>
          <pre style={{ background: '#2d2d44', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 12, color: '#ffa07a' }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{ marginTop: 16, padding: '10px 20px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
          >
            Recharger l'application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const VALID_TABS = ['caisse', 'stock', 'ardoise', 'dashboard', 'settings', 'reglages', 'subscription', 'portal_client'];

function App() {
  const { session, isLoading: isProfileLoading, signOut: handleLogout } = useAuth();
  const storeProfile = useAuthStore(state => state.profile);
  useSyncEngine();

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const hash = window.location.hash.replace('#', '');
    if (VALID_TABS.includes(hash)) return hash as TabType;
    return (localStorage.getItem('active_tab') as TabType) || 'caisse';
  });

  useEffect(() => {
    localStorage.setItem('active_tab', activeTab);
    if (window.location.hash !== `#${activeTab}` && !window.location.hash.replace('#', '').startsWith('admin-')) {
      window.history.pushState(null, '', `#${activeTab}`);
    }
  }, [activeTab]);

  const [adminManuallyDismissed, setAdminManuallyDismissed] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash.startsWith('admin-')) return false;
    return localStorage.getItem('admin_dismissed') === 'true';
  });

  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('admin-')) {
        setAdminManuallyDismissed(false);
        localStorage.setItem('admin_dismissed', 'false');
      } else if (VALID_TABS.includes(hash)) {
        setActiveTab(hash as TabType);
        setAdminManuallyDismissed(true);
        localStorage.setItem('admin_dismissed', 'true');
      }
    };
    window.addEventListener('popstate', handlePopState);
    // Sync on mount
    handlePopState();
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [activePlan, setActivePlan] = useState(() => localStorage.getItem('active_subscription_plan') || 'Starter');
  const [showLandingOverride, setShowLandingOverride] = useState(false);
  const [trialStatus, setTrialStatus] = useState<any>(null);

  // Always start as 'checking' — resolved by useEffect once profile loads
  const [subStatus, setSubStatus] = useState<'checking' | 'active' | 'trial' | 'paywall'>('checking');
  const [liveTime, setLiveTime] = useState(new Date());
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const isOnline = useOnline();
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [isClientViewingPortal, setIsClientViewingPortal] = useState(false);



  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [activeArdoisesCount, setActiveArdoisesCount] = useState(0);

  const fetchBadgeCounts = async () => {
    const boutiqueId = storeProfile?.boutique_id || session?.user?.user_metadata?.boutique_id;
    if (!boutiqueId) return;

    try {
      const { count: outOfStock } = await supabase
        .from('produits')
        .select('*', { count: 'exact', head: true })
        .eq('boutique_id', boutiqueId)
        .eq('archive', 0)
        .eq('quantite', 0)
        .is('deleted_at', null);

      const { count: activeArdoises } = await supabase
        .from('ardoises')
        .select('*', { count: 'exact', head: true })
        .eq('boutique_id', boutiqueId)
        .eq('statut', 'en_cours')
        .is('deleted_at', null);

      setOutOfStockCount(outOfStock || 0);
      setActiveArdoisesCount(activeArdoises || 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBadgeCounts();
  }, [storeProfile?.boutique_id, session]);

  useEffect(() => {
    const handleFocus = () => {
      fetchBadgeCounts();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [storeProfile?.boutique_id, session]);

  // Realtime
  useEffect(() => {
    const boutiqueId = storeProfile?.boutique_id || session?.user?.user_metadata?.boutique_id;
    if (!boutiqueId) return;

    const channel = supabase
      .channel('realtime_app_badges')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'produits', filter: `boutique_id=eq.${boutiqueId}` },
        () => fetchBadgeCounts()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ardoises', filter: `boutique_id=eq.${boutiqueId}` },
        () => fetchBadgeCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeProfile?.boutique_id, session]);

  useEffect(() => {
    if (!isOnline) {
      setShowOfflineBanner(true);
      const timer = setTimeout(() => {
        setShowOfflineBanner(false);
      }, 30000);
      return () => clearTimeout(timer);
    } else {
      setShowOfflineBanner(false);
    }
  }, [isOnline]);

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);



  // Known admin emails — bypass is immediate, no need to wait for DB profile.
  // This list is the single source of truth for email-based admin detection.
  const ADMIN_EMAILS = ['elhadjsylla667@gmail.com', 'cedricbenoitdieme@gmail.com', 'gmoustapha0805@gmail.com', 'admin@samaboutik.dev'];
  const isAdminEmail = ADMIN_EMAILS.includes(session?.user?.email ?? '');
  const isAdmin = storeProfile?.role === 'super_admin' || storeProfile?.role === 'admin' || session?.user?.user_metadata?.role === 'super_admin' || session?.user?.user_metadata?.role === 'admin' || isAdminEmail;


  // Check subscription status for real (non-dev) sessions
  useEffect(() => {
    if (!session) return;

    const checkSubscription = async () => {
      // 1. Determine effective role — try Zustand store first, then query DB directly
      let effectiveRole: string = session.user?.user_metadata?.role || 'caissier';

      if (storeProfile?.role) {
        effectiveRole = storeProfile.role;
      } else {
        // Profile not yet in store — query DB directly as a fallback
        try {
          const { data: dbProfile } = await supabase
            .from('profils')
            .select('role')
            .eq('id', session.user.id)
            .single();
          if (dbProfile?.role) {
            effectiveRole = dbProfile.role;
          }
        } catch (e) {
          console.warn('[App] Could not fetch profile from DB:', e);
        }
      }

      // 2. Admin bypass — no subscription needed
      console.log('[App] Final effectiveRole:', effectiveRole);
      
      // Force admin bypass for known admin emails just in case DB is out of sync
      const isAdminEmail = ADMIN_EMAILS.includes(session.user?.email ?? '');

      if (effectiveRole === 'super_admin' || effectiveRole === 'admin' || isAdminEmail) {
        console.log('[App] ✅ ADMIN DETECTED — bypassing paywall');
        setSubStatus('active');
        setActivePlan('Plan MAX');
        return;
      }

      // 3. Dev fake session bypass
      const isDevFake = import.meta.env.DEV && session.user?.id === 'dev-admin-id';
      if (isDevFake) { setSubStatus('active'); return; }

      // 4. Check trial
      const { data: trial } = await supabase.rpc('get_trial_status');
      if (trial?.has_trial && trial.status === 'trial' && !trial.is_expired) {
        setTrialStatus(trial);
        setSubStatus('trial');
        setActivePlan('Essai Gratuit');
        return;
      }

      // 5. Check active subscription
      // Fetch all active subs, prioritise non-free (trial/paid) over the free baseline.
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('id, plan')
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString());

      const planLabels: Record<string, string> = {
        free: 'Plan Gratuit', starter: 'Starter', pro: 'Pro', annual: 'Annuel',
      };
      const bestSub = subs?.find(s => s.plan !== 'free') ?? subs?.find(s => s.plan === 'free') ?? null;
      if (bestSub) {
        setSubStatus('active');
        setActivePlan(planLabels[bestSub.plan] ?? 'Starter');
      } else {
        setSubStatus('paywall');
      }
    };

    checkSubscription();
  }, [session, storeProfile]);

  const [forceUnlock, setForceUnlock] = useState(false);
  
  useEffect(() => {
    // ── HARD FAILSAFE ──
    // Unblock the UI automatically after 5 seconds, no matter what.
    const timer = setTimeout(() => {
      setForceUnlock(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (isClientViewingPortal) {
    return (
      <div className="min-h-screen bg-background text-on-background">
        <header className="bg-primary text-on-primary fixed top-0 left-0 w-full z-50 h-16 flex justify-between items-center px-4 border-b border-white/5 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-secondary to-secondary/80 flex items-center justify-center shadow-sm text-white">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
            </div>
            <span className="text-lg font-black tracking-tight text-white">Sama Boutik — Espace Client</span>
          </div>
          <button 
            onClick={() => setIsClientViewingPortal(false)}
            className="flex items-center justify-center h-9 px-3.5 text-on-primary border border-white/20 hover:bg-white/10 rounded-xl transition-all active:scale-95"
            title="Quitter l'espace client"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            <span className="ml-1.5 text-[10px] uppercase font-black">Quitter</span>
          </button>
        </header>
        <main className="w-full">
          <Suspense fallback={<LazyFallback />}>
            <PortalClient />
          </Suspense>
        </main>
      </div>
    );
  }

  // 0a. PORTAL CLIENT — ardoise view by token
  const portalToken = new URLSearchParams(window.location.search).get('token');
  if (portalToken) return (
    <Suspense fallback={<LazyFallback />}>
      <PortalClient token={portalToken} />
    </Suspense>
  );

  // 0b. MON ESPACE CLIENT — dashboard client connecté
  const espaceParam = new URLSearchParams(window.location.search).get('espace');
  if (espaceParam === 'client') return (
    <Suspense fallback={<LazyFallback />}>
      <MonEspace />
    </Suspense>
  );

  const isSessionOrProfileLoading = !forceUnlock && (isProfileLoading);

  // ── ADMIN FAST-PATH ──────────────────────────────────────────────────────────
  // For known admin emails: bypass ALL loading guards immediately.
  // The session email is available from the very first render, so we never
  // need to wait for the profils table to confirm the role.
  // This fixes cedricbenoitdieme@gmail.com (and any other admin) getting stuck
  // on the subscription-check spinner or "Profil Incomplet" screen.
  if (session?.user && isAdminEmail && !adminManuallyDismissed) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <AdminLayout onExit={() => setAdminManuallyDismissed(true)} />
      </Suspense>
    );
  }

  // Admin console: also shows for admins detected via DB role (non-email path)
  if (!isSessionOrProfileLoading && session?.user && isAdmin && !adminManuallyDismissed) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <AdminLayout onExit={() => setAdminManuallyDismissed(true)} />
      </Suspense>
    );
  }

  if (isSessionOrProfileLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col justify-center items-center p-6 text-center select-none animate-fade-in">
        <div className="flex flex-col items-center gap-5">
          {/* Centered Logo */}
          <div className="w-20 h-20 rounded-[24px] bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-lg text-white">
            <svg className="w-11 h-11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black text-primary tracking-tight">Sama Boutik</h1>
            <p className="text-[11px] text-outline font-bold uppercase tracking-wider mt-1">Point de Vente & Stock Intelligent</p>
          </div>
          
          {/* Progressive Loading Bar */}
          <div className="w-48 h-2 bg-slate-200 rounded-full overflow-hidden mt-3 shadow-inner relative">
            <div 
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full" 
              style={{
                animation: 'loadingProgress 1.8s ease-in-out infinite',
                width: '100%',
                transformOrigin: 'left'
              }} 
            />
          </div>
          <style>{`
            @keyframes loadingProgress {
              0% { transform: scaleX(0); }
              50% { transform: scaleX(0.6); }
              100% { transform: scaleX(1); }
            }
          `}</style>
          <p className="text-[10px] text-outline font-bold uppercase tracking-widest mt-1">Chargement de la session...</p>
        </div>
      </div>
    );
  }

  if (!session || showLandingOverride) {
    return (
      <LandingPage 
        isLoggedIn={!!session} 
        onBackToApp={() => setShowLandingOverride(false)} 
        onNavigateToPortal={() => setIsClientViewingPortal(true)}
      />
    );
  }

  // Extract metadata safely with fallbacks if needed
  const user = session.user;
  const boutiqueId = storeProfile?.boutique_id || user.user_metadata?.boutique_id || 'boutique-1';
  const boutiqueName = (storeProfile as any)?.boutique_name || user.user_metadata?.boutique_name || 'Sama Boutik';
  const caissierId = user.id;
  const userRole = storeProfile?.role || user.user_metadata?.role || 'caissier';

  if (!boutiqueId) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h1 className="text-2xl font-bold text-on-background mb-4">Profil Incomplet</h1>
        <p className="text-outline max-w-md mb-8">
          Votre compte n'est pas associé à une boutique valide. Veuillez contacter le support technique ou un administrateur pour configurer votre boutique.
        </p>
        <button
          onClick={handleLogout}
          className="px-6 py-3 bg-primary text-on-primary font-bold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95"
        >
          Se déconnecter
        </button>
      </div>
    );
  }



  // Super Admin check

  if (subStatus === 'checking') {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-outline font-bold text-xs uppercase tracking-wider">Vérification de l'abonnement...</p>
        <button
          onClick={handleLogout}
          className="mt-6 px-6 py-2 text-xs font-bold text-outline border border-outline-variant rounded-xl hover:bg-surface-container transition-all active:scale-95"
        >
          Se déconnecter
        </button>
      </div>
    );
  }

  if (subStatus === 'paywall') {
    return <Abonnement onSuccess={() => setSubStatus('active')} onLogout={handleLogout} />;
  }


  const appNotifications = [
    {
      id: 'welcome',
      title: 'Bienvenue sur Sama Boutik',
      desc: 'Votre moteur de caisse et de stock intelligent est prêt et synchronisé localement.',
      icon: 'info',
      color: 'text-primary'
    },
    {
      id: 'csv_feature',
      title: 'Nouvelle fonctionnalité CSV',
      desc: 'Vous pouvez désormais exporter vos bilans et rapports clients au format Excel (CSV).',
      icon: 'download',
      color: 'text-secondary'
    }
  ];

  if (outOfStockCount > 0) {
    appNotifications.unshift({
      id: 'stock_alert',
      title: 'Alerte de Stock Bas',
      desc: `${outOfStockCount} produit(s) en rupture de stock totale ! Réapprovisionnez au plus vite.`,
      icon: 'warning',
      color: 'text-error animate-pulse'
    });
  }

  if (activeArdoisesCount > 0) {
    appNotifications.unshift({
      id: 'ardoise_alert',
      title: 'Dettes clients en cours',
      desc: `Vous avez ${activeArdoisesCount} fiche(s) d'ardoises actives. Pensez à relancer les clients par WhatsApp.`,
      icon: 'menu_book',
      color: 'text-tertiary'
    });
  }

  // Role badge config — couleurs sur fond sombre (top bar bg-primary)
  const roleConfig: Record<string, { label: string; bg: string; text: string; icon: string }> = {
    super_admin: { label: 'SUPER ADMIN', bg: 'bg-amber-400/25',  text: 'text-amber-200',  icon: 'military_tech' },
    admin:       { label: 'SUPER ADMIN', bg: 'bg-amber-400/25',  text: 'text-amber-200',  icon: 'military_tech' },
    gerant:      { label: 'Gérant',      bg: 'bg-sky-400/20',     text: 'text-sky-200',     icon: 'manage_accounts' },
    caissier:    { label: 'Caissier',    bg: 'bg-emerald-400/20', text: 'text-emerald-200', icon: 'point_of_sale' },
  };
  const role = roleConfig[userRole] ?? { label: userRole, bg: 'bg-white/10', text: 'text-white/70', icon: 'person' };

  return (
    <div className="min-h-screen bg-background text-on-background">
      {/* Top App Bar */}
      <header className="bg-primary text-on-primary fixed top-0 left-0 w-full z-50 h-16 flex justify-between items-center px-4 border-b border-white/5 shadow-md">
        <div 
          onClick={() => setActiveTab('settings')} 
          className="flex items-center gap-3 cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all"
          title="Paramètres du compte"
        >
          <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-tr from-secondary to-secondary/80 flex items-center justify-center shadow-sm">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-xs font-black">
                {boutiqueName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight leading-none">{boutiqueName}</h1>
              {/* Role Badge */}
              <span className={`hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${role.bg} ${role.text} border border-current/20`}>
                <span className="material-symbols-outlined" style={{ fontSize: '9px' }}>{role.icon}</span>
                {role.label}
              </span>
            </div>
            <span className="hidden sm:inline text-[9px] opacity-70 tracking-widest font-black uppercase mt-0.5">
              {user.email}
            </span>
          </div>
        </div>

        {/* Live Date, Time & Connection indicator */}
        <div className="hidden md:flex items-center gap-4 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-xl text-[11px] font-bold text-on-primary">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '14px' }}>calendar_month</span>
            <span>
              {liveTime.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
          <span className="w-px h-3 bg-white/20" />
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '14px' }}>schedule</span>
            <span className="font-mono">
              {liveTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <span className="w-px h-3 bg-white/20" />
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-secondary animate-pulse' : 'bg-error animate-pulse'}`} />
            <span className="text-[9px] tracking-wider uppercase font-black">
              {isOnline ? 'En ligne' : 'Hors ligne'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isOnline && !showOfflineBanner && (
            <div className="flex items-center justify-center px-2 py-1 text-error animate-pulse mr-1" title="Hors ligne">
              <span className="material-symbols-outlined text-lg" style={{ animationDuration: '2s' }}>wifi_off</span>
            </div>
          )}
          <button 
            onClick={() => setShowLandingOverride(true)}
            className="hidden sm:flex items-center justify-center h-9 w-9 md:w-auto md:px-3 text-on-primary border border-white/20 hover:bg-white/10 rounded-xl transition-all active:scale-95 mr-1"
            title="Accéder à l'accueil"
          >
            <span className="material-symbols-outlined text-sm" style={{ fontSize: '16px' }}>home</span>
            <span className="hidden md:inline ml-1 text-[10px] uppercase font-black">Accueil</span>
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={`hidden sm:inline-block material-symbols-outlined hover:bg-white/10 p-2.5 rounded-full transition-all active:scale-95 ${activeTab === 'settings' ? 'text-secondary bg-white/10' : 'text-on-primary'}`}
            title="Paramètres de l'application"
          >
            settings
          </button>
          <button 
            onClick={() => setIsNotificationsOpen(true)}
            className="material-symbols-outlined text-on-primary hover:bg-white/10 p-2.5 rounded-full transition-all active:scale-95 relative"
            title="Notifications SaaS"
          >
            notifications
            {appNotifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full ring-2 ring-primary animate-pulse" />
            )}
          </button>
          <button 
            onClick={handleLogout}
            className="hidden sm:inline-block material-symbols-outlined text-on-primary/80 hover:text-on-primary hover:bg-white/10 p-2.5 rounded-full transition-all active:scale-95"
            title="Se déconnecter"
          >
            logout
          </button>
        </div>
      </header>

      {/* Offline Alert Banner */}
      {!isOnline && showOfflineBanner && (
        <div className="bg-error text-white text-center py-2 px-4 text-[10px] font-extrabold tracking-wider uppercase flex items-center justify-center gap-2 fixed top-16 left-0 w-full z-40 shadow-md animate-fade-in border-b border-white/10">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>wifi_off</span>
          <span>Mode Hors ligne activé — Les ventes sont sauvegardées localement et se synchroniseront au retour d'Internet.</span>
        </div>
      )}

      {/* Pages Switcher */}
      <main className="w-full">
        {subStatus === 'trial' && trialStatus && (
          <TrialBanner trialStatus={trialStatus} onTrialExpired={() => setSubStatus('paywall')} />
        )}
        {activeTab === 'caisse' && <Caisse boutiqueId={boutiqueId} caissierId={caissierId} />}
        {activeTab === 'stock' && <Stock boutiqueId={boutiqueId} />}
        {activeTab === 'ardoise' && <Ardoise boutiqueId={boutiqueId} />}
        {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
        {activeTab === 'settings' && (
          <Suspense fallback={<LazyFallback />}>
            <Settings 
              session={session} 
              onLogout={handleLogout} 
              activePlan={activePlan}
              onManageSubscription={() => setActiveTab('subscription')}
              onNavigateToPortal={() => setIsClientViewingPortal(true)}
              onActivateAdmin={isAdmin ? () => setAdminManuallyDismissed(false) : undefined}
            />
          </Suspense>
        )}
        {(activeTab === 'reglages' as any) && (
          <Suspense fallback={<LazyFallback />}>
            <Reglages
              boutiqueId={boutiqueId}
              onOpenAdmin={isAdmin ? () => setAdminManuallyDismissed(false) : undefined}
            />
          </Suspense>
        )}
        {activeTab === 'subscription' && (
          <Suspense fallback={<LazyFallback />}>
            <Subscription 
              currentPlan={activePlan}
              onUpdatePlan={(plan) => {
                setActivePlan(plan);
                localStorage.setItem('active_subscription_plan', plan);
              }}
              onBack={() => setActiveTab('settings')}
            />
          </Suspense>
        )}
        {activeTab === 'portal_client' && (
          <Suspense fallback={<LazyFallback />}>
            <PortalClient />
          </Suspense>
        )}
      </main>

      {/* Global Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Bottom Sheet for SaaS Notifications */}
      <BottomSheet
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        title="Centre de Notifications SaaS"
      >
        <div className="flex flex-col gap-3 text-left">
          {appNotifications.length === 0 ? (
            <p className="text-xs text-outline italic text-center py-4 bg-surface-container/20 rounded-xl">
              Aucune notification active.
            </p>
          ) : (
            appNotifications.map((notif) => (
              <div 
                key={notif.id}
                className="p-3 bg-surface-container/40 hover:bg-surface-container border border-outline-variant/60 rounded-xl flex gap-3 transition-all"
              >
                <span className={`material-symbols-outlined ${notif.color} text-xl mt-0.5`}>
                  {notif.icon}
                </span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">{notif.title}</span>
                  <span className="text-[10px] text-outline mt-0.5 leading-relaxed">{notif.desc}</span>
                </div>
              </div>
            ))
          )}
          
          <button
            onClick={() => setIsNotificationsOpen(false)}
            className="w-full h-10 mt-2 bg-primary text-white text-xs font-black rounded-xl active:scale-95 transition-all shadow-sm"
          >
            Fermer le Centre
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
