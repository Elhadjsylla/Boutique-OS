import { useState, useEffect, useRef, Component, type ErrorInfo, type ReactNode } from 'react';
import { supabase } from './lib/supabase';
import { Caisse } from './pages/Caisse';
import { Stock } from './pages/Stock';
import { Dashboard } from './pages/Dashboard';
import { Ardoise } from './pages/Ardoise';
import { Settings } from './pages/Settings';
import { Reglages } from './pages/Reglages';
import { Subscription } from './pages/Subscription';
import { PortalClient } from './pages/PortalClient';
import { MonEspace } from './pages/MonEspace';
import { Abonnement } from './pages/Abonnement';
import { AdminLayout } from './pages/admin/AdminLayout';
import { TrialBanner } from './components/ui/TrialBanner';
import { BottomNav, type TabType } from './components/ui/BottomNav';
import { LandingPage } from './pages/LandingPage';
import { useOnline } from './hooks/useOnline';
import { BottomSheet } from './components/ui/BottomSheet';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/dexie';
import { useAuthStore } from './store/useAuthStore';
import { useAuth } from './hooks/useAuth';

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

function App() {
  // Initialize auth listener and fetch profile/boutique
  useAuth();

  // Respect VITE_DEV_BYPASS=false to disable ALL dev session injection
  const devBypassEnabled = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS !== 'false';

  const getDevSession = () => {
    const devRole = localStorage.getItem('dev_role') || 'admin';
    return {
      user: {
        id: 'dev-admin-id',
        email: 'admin@samaboutik.dev',
        user_metadata: {
          boutique_id: 'boutique-dev',
          boutique_name: 'Sama Boutik Dev',
          role: devRole,
        }
      }
    };
  };

  // Applies DEV role override to any session (real or fake)
  const applyDevRoleOverride = (s: any) => {
    if (!devBypassEnabled || !s) return s;
    const devRole = localStorage.getItem('dev_role');
    if (devRole) {
      return {
        ...s,
        user: {
          ...s.user,
          user_metadata: {
            ...s.user.user_metadata,
            role: devRole,
          }
        }
      };
    }
    return s;
  };

  const getInitialSession = () => {
    try {
      const keys = Object.keys(localStorage);
      const supabaseKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      if (supabaseKey) {
        const localSession = JSON.parse(localStorage.getItem(supabaseKey) || '');
        if (localSession) return localSession;
      }
    } catch (e) {}

    if (devBypassEnabled) {
      const isSignedOut = localStorage.getItem('dev_signed_out') === 'true';
      if (isSignedOut) return null;

      // Extract role from URL or load from localStorage, defaulting to 'admin' (merchant view)
      const urlRole = new URLSearchParams(window.location.search).get('role');
      if (urlRole) {
        localStorage.setItem('dev_role', urlRole);
      }

      return getDevSession();
    }
    return null;
  };

  const initialSession = getInitialSession();
  const [session, setSession] = useState<any>(initialSession);
  const [loading, setLoading] = useState(!initialSession);
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    return (localStorage.getItem('active_tab') as TabType) || 'caisse';
  });

  useEffect(() => {
    localStorage.setItem('active_tab', activeTab);
  }, [activeTab]);

  const [activePlan, setActivePlan] = useState(() => localStorage.getItem('active_subscription_plan') || 'Starter');
  const [showLandingOverride, setShowLandingOverride] = useState(false);
  const [trialStatus, setTrialStatus] = useState<any>(null);
  const [showAdminConsole, setShowAdminConsole] = useState(false);

  useEffect(() => {
    if (session?.user) {
      supabase.rpc('get_trial_status').then(({ data }) => {
        if (data?.has_trial) setTrialStatus(data);
      });
    }
  }, [session]);

  // Always start as 'checking' — resolved by useEffect once profile loads
  const [subStatus, setSubStatus] = useState<'checking' | 'active' | 'trial' | 'paywall'>('checking');
  const [liveTime, setLiveTime] = useState(new Date());
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const isOnline = useOnline();
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [isClientViewingPortal, setIsClientViewingPortal] = useState(false);



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

  const outOfStockCount = useLiveQuery(() => db.produits.where('archive').equals(0).filter(p => p.quantite === 0).count(), []) || 0;
  const activeArdoises = useLiveQuery(() => db.ardoises.where('statut').equals('en_cours').toArray(), []) || [];
  const activeArdoisesCount = activeArdoises?.length || 0;

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Check if session JWT is expired
        try {
          const payload = JSON.parse(atob(session.access_token.split('.')[1]));
          if (payload.exp && Date.now() / 1000 >= payload.exp) {
            console.warn('[App] Session JWT expired on load, signing out.');
            supabase.auth.signOut().then(() => {
              setSession(null);
              setLoading(false);
            });
            return;
          }
        } catch (e) {}
        // In DEV, merge the dev_role override into the real session
        setSession(applyDevRoleOverride(session));
      } else if (devBypassEnabled) {
        const isSignedOut = localStorage.getItem('dev_signed_out') === 'true';
        if (!isSignedOut) {
          setSession(getDevSession());
        } else {
          setSession(null);
        }
      } else {
        setSession(null);
      }
      setLoading(false);
    }).catch(() => {
      if (devBypassEnabled) {
        const isSignedOut = localStorage.getItem('dev_signed_out') === 'true';
        if (!isSignedOut) setSession(getDevSession());
      }
      setLoading(false);
    });

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT') {
        if (devBypassEnabled) {
          localStorage.setItem('dev_signed_out', 'true');
        }
        setSession(null);
      } else if (session) {
        // Check if session JWT is expired
        try {
          const payload = JSON.parse(atob(session.access_token.split('.')[1]));
          if (payload.exp && Date.now() / 1000 >= payload.exp) {
            console.warn('[App] Session JWT expired on auth change, signing out.');
            supabase.auth.signOut().then(() => {
              setSession(null);
            });
            return;
          }
        } catch (e) {}
        // In DEV, merge the dev_role override into the real session
        setSession(applyDevRoleOverride(session));
      } else if (devBypassEnabled) {
        const isSignedOut = localStorage.getItem('dev_signed_out') === 'true';
        if (!isSignedOut) {
          setSession(getDevSession());
        } else {
          setSession(null);
        }
      } else {
        setSession(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (devBypassEnabled) {
      localStorage.setItem('dev_signed_out', 'true');
    }
    setSession(null);
    await supabase.auth.signOut();
  };

  // Check role from Zustand store (loaded from profils table)
  const storeProfile = useAuthStore(state => state.profile);

  // Auto-open admin console if the user is an admin
  const isAdmin = storeProfile?.role === 'super_admin' || storeProfile?.role === 'admin' || session?.user?.user_metadata?.role === 'super_admin' || session?.user?.user_metadata?.role === 'admin' || session?.user?.email === 'cedricbenoitdieme@gmail.com' || session?.user?.email === 'admin@samaboutik.dev';

  const hasAutoOpenedAdmin = useRef(false);

  // Effect to automatically show admin console when admin role is detected (only once)
  useEffect(() => {
    if (isAdmin && !showAdminConsole && !hasAutoOpenedAdmin.current) {
      setShowAdminConsole(true);
      hasAutoOpenedAdmin.current = true;
    }
  }, [isAdmin, showAdminConsole]);

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
      const isAdminEmail = session.user?.email === 'cedricbenoitdieme@gmail.com' || session.user?.email === 'admin@samaboutik.dev';
      
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
        setSubStatus('trial');
        return;
      }

      // 5. Check active subscription
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .maybeSingle();
      setSubStatus(sub ? 'active' : 'paywall');
    };

    checkSubscription();
  }, [session, storeProfile]);

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
          <PortalClient />
        </main>
      </div>
    );
  }

  // 0a. PORTAL CLIENT — ardoise view by token
  const portalToken = new URLSearchParams(window.location.search).get('token');
  if (portalToken) return <PortalClient token={portalToken} />;

  // 0b. MON ESPACE CLIENT — dashboard client connecté
  const espaceParam = new URLSearchParams(window.location.search).get('espace');
  if (espaceParam === 'client') return <MonEspace />;

  // isAdmin is now defined at the top of the file
  if (!loading && session?.user && isAdmin && showAdminConsole) {
    return <AdminLayout onExit={() => setShowAdminConsole(false)} />;
  }

  if (loading) {
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
  const boutiqueName = storeProfile?.boutique_name || user.user_metadata?.boutique_name || 'Sama Boutik';
  const caissierId = user.id;
  const userRole = user.user_metadata?.role || 'caissier';

  useEffect(() => {
    console.log('[DEBUG] Current App boutiqueId:', boutiqueId);
    db.produits.toArray().then(prods => {
      const bIds = new Set(prods.map(p => p.boutique_id));
      console.log('[DEBUG] Dexie contains products for boutique_ids:', Array.from(bIds));
    });
  }, [boutiqueId]);

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
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-secondary to-secondary/80 flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-black">
              {boutiqueName.slice(0, 2).toUpperCase()}
            </span>
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

      {trialStatus && !trialStatus.is_expired && (
        <TrialBanner trialStatus={trialStatus} />
      )}

      {/* Offline Alert Banner */}
      {!isOnline && showOfflineBanner && (
        <div className="bg-error text-white text-center py-2 px-4 text-[10px] font-extrabold tracking-wider uppercase flex items-center justify-center gap-2 fixed top-16 left-0 w-full z-40 shadow-md animate-fade-in border-b border-white/10">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>wifi_off</span>
          <span>Mode Hors ligne activé — Les ventes sont sauvegardées localement et se synchroniseront au retour d'Internet.</span>
        </div>
      )}

      {/* Pages Switcher */}
      <main className="w-full">
        {subStatus === 'trial' && (
          <TrialBanner onTrialExpired={() => setSubStatus('paywall')} />
        )}
        {activeTab === 'caisse' && <Caisse boutiqueId={boutiqueId} caissierId={caissierId} />}
        {activeTab === 'stock' && <Stock boutiqueId={boutiqueId} />}
        {activeTab === 'ardoise' && <Ardoise boutiqueId={boutiqueId} />}
        {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
        {activeTab === 'settings' && (
          <Settings 
            session={session} 
            onLogout={handleLogout} 
            activePlan={activePlan}
            onManageSubscription={() => setActiveTab('subscription')}
            onNavigateToPortal={() => setIsClientViewingPortal(true)}
            onActivateAdmin={isAdmin ? () => setShowAdminConsole(true) : undefined}
          />
        )}
        {(activeTab === 'reglages' as any) && (
          <Reglages
            boutiqueId={boutiqueId}
            onOpenAdmin={isAdmin ? () => setShowAdminConsole(true) : undefined}
          />
        )}
        {activeTab === 'subscription' && (
          <Subscription 
            currentPlan={activePlan}
            onUpdatePlan={(plan) => {
              setActivePlan(plan);
              localStorage.setItem('active_subscription_plan', plan);
            }}
            onBack={() => setActiveTab('settings')}
          />
        )}
        {activeTab === 'portal_client' && <PortalClient />}
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
      <App />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
