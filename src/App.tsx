import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Caisse } from './pages/Caisse';
import { Stock } from './pages/Stock';
import { Dashboard } from './pages/Dashboard';
import { Ardoise } from './pages/Ardoise';
import { BottomNav, type TabType } from './components/ui/BottomNav';
import { LandingPage } from './pages/LandingPage';

function App() {
  const devAdminSession = {
    user: {
      id: 'dev-admin-id',
      email: 'admin@boutikos.dev',
      user_metadata: {
        boutique_id: 'boutique-dev',
        boutique_name: 'BoutikOS Dev',
        role: 'admin',
      }
    }
  };

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('caisse');
  const [showLandingOverride, setShowLandingOverride] = useState(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
      } else if (import.meta.env.DEV) {
        setSession(devAdminSession);
      } else {
        setSession(null);
      }
      setLoading(false);
    }).catch(() => {
      if (import.meta.env.DEV) {
        setSession(devAdminSession);
      }
      setLoading(false);
    });

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
      } else if (import.meta.env.DEV && _event !== 'SIGNED_OUT') {
        // Only set dev session if the user didn't explicitly log out
        setSession(devAdminSession);
      } else {
        setSession(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-outline font-bold text-xs uppercase tracking-wider">Chargement de la session...</p>
      </div>
    );
  }

  if (!session || showLandingOverride) {
    return (
      <LandingPage 
        isLoggedIn={!!session} 
        onBackToApp={() => setShowLandingOverride(false)} 
      />
    );
  }

  // Extract metadata safely with fallbacks if needed
  const user = session.user;
  const boutiqueId = user.user_metadata?.boutique_id || 'boutique-1';
  const boutiqueName = user.user_metadata?.boutique_name || 'BoutikOS';
  const caissierId = user.id;
  const userRole = user.user_metadata?.role || 'caissier';

  // Role badge config — couleurs sur fond sombre (top bar bg-primary)
  const roleConfig: Record<string, { label: string; bg: string; text: string; icon: string }> = {
    admin:    { label: 'Admin',    bg: 'bg-purple-400/25',  text: 'text-purple-200',  icon: 'shield_person' },
    gerant:   { label: 'Gérant',   bg: 'bg-sky-400/20',     text: 'text-sky-200',     icon: 'manage_accounts' },
    caissier: { label: 'Caissier', bg: 'bg-emerald-400/20', text: 'text-emerald-200', icon: 'point_of_sale' },
  };
  const role = roleConfig[userRole] ?? { label: userRole, bg: 'bg-white/10', text: 'text-white/70', icon: 'person' };

  return (
    <div className="min-h-screen bg-background text-on-background">
      {/* Top App Bar */}
      <header className="bg-primary text-on-primary fixed top-0 left-0 w-full z-45 h-16 flex justify-between items-center px-4 border-b border-white/5 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-secondary to-secondary/80 flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-black">
              {boutiqueName.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight leading-none">{boutiqueName}</h1>
              {/* Role Badge */}
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${role.bg} ${role.text} border border-current/20`}>
                <span className="material-symbols-outlined" style={{ fontSize: '9px' }}>{role.icon}</span>
                {role.label}
              </span>
            </div>
            <span className="text-[9px] opacity-70 tracking-widest font-black uppercase mt-0.5">
              {user.email}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setShowLandingOverride(true)}
            className="flex items-center gap-1 h-9 px-3 text-[10px] uppercase font-black text-on-primary border border-white/20 hover:bg-white/10 rounded-xl transition-all active:scale-95 mr-1"
            title="Accéder au site vitrine"
          >
            <span className="material-symbols-outlined text-sm" style={{ fontSize: '15px' }}>public</span>
            Site Vitrine
          </button>
          <button className="material-symbols-outlined text-on-primary hover:bg-white/10 p-2.5 rounded-full transition-all active:scale-95">
            notifications
          </button>
          <button 
            onClick={handleLogout}
            className="material-symbols-outlined text-on-primary/80 hover:text-on-primary hover:bg-white/10 p-2.5 rounded-full transition-all active:scale-95"
            title="Se déconnecter"
          >
            logout
          </button>
        </div>
      </header>

      {/* Pages Switcher */}
      <main className="w-full">
        {activeTab === 'caisse' && <Caisse boutiqueId={boutiqueId} caissierId={caissierId} />}
        {activeTab === 'stock' && <Stock boutiqueId={boutiqueId} />}
        {activeTab === 'ardoise' && <Ardoise boutiqueId={boutiqueId} />}
        {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
      </main>

      {/* Global Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default App;
