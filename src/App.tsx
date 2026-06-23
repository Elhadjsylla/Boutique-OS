import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { Caisse } from './pages/Caisse'
import { Dashboard } from './pages/Dashboard'
import { Stock } from './pages/Stock'
import { Ardoise } from './pages/Ardoise'
import { Reglages } from './pages/Reglages'
import { Subscription } from './pages/Subscription'
import { BottomNav, type TabType } from './components/ui/BottomNav'
import { LandingPage } from './pages/LandingPage'
import { Loader2, LogOut } from 'lucide-react'
import { SyncIndicator } from './pwa/SyncIndicator'
import { PwaPrompt } from './pwa/PwaPrompt'
import { useOnline } from './hooks/useOnline'
import { useSubscription } from './hooks/useSubscription'

function App() {
  const { user, profile, boutique, isLoading, signOut } = useAuth()
  const { subscription, refetch } = useSubscription()
  const [activeTab, setActiveTab] = useState<TabType>('caisse')
  const [showLandingOverride, setShowLandingOverride] = useState(false)
  const [liveTime, setLiveTime] = useState(new Date())

  const planLabels: Record<string, string> = {
    starter: 'Starter',
    pro: 'Pro',
    annual: 'Annuel',
  };
  const activePlanLabel = subscription ? (planLabels[subscription.plan] || 'Starter') : 'Starter';

  const isOnline = useOnline()

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 1. LOADING SCREEN
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background font-body">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-md" />
        <p className="text-outline text-sm font-medium">Chargement de BoutikOS...</p>
      </div>
    )
  }

  // 2. UNAUTHENTICATED or LANDING OVERRIDE
  if (!user || showLandingOverride) {
    return (
      <LandingPage
        isLoggedIn={!!user}
        onBackToApp={() => setShowLandingOverride(false)}
      />
    )
  }

  const boutiqueId = boutique?.id || 'boutique-dev'
  const boutiqueName = boutique?.nom || 'BoutikOS'
  const caissierId = user.id
  const userRole = profile?.role || 'caissier'

  // Role badge config
  const roleConfig: Record<string, { label: string; bg: string; text: string; icon: string }> = {
    super_admin: { label: 'Admin',    bg: 'bg-purple-400/25',  text: 'text-purple-200',  icon: 'shield_person' },
    admin:       { label: 'Admin',    bg: 'bg-purple-400/25',  text: 'text-purple-200',  icon: 'shield_person' },
    gerant:      { label: 'Gérant',   bg: 'bg-sky-400/20',     text: 'text-sky-200',     icon: 'manage_accounts' },
    caissier:    { label: 'Caissier', bg: 'bg-emerald-400/20', text: 'text-emerald-200', icon: 'point_of_sale' },
  }
  const role = roleConfig[userRole] ?? { label: userRole, bg: 'bg-white/10', text: 'text-white/70', icon: 'person' }

  // 3. AUTHENTICATED SCREEN
  return (
    <div className="min-h-screen bg-background text-on-background pb-20 pt-16">
      {/* Top App Bar */}
      <header className="bg-primary text-on-primary fixed top-0 left-0 w-full z-40 h-16 flex justify-between items-center px-margin-mobile border-b border-white/5 shadow-md">
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
          <SyncIndicator />

          {/* ACCUEIL — landing page */}
          <button
            onClick={() => setShowLandingOverride(true)}
            className="flex items-center gap-1 h-9 px-3 text-[10px] uppercase font-black text-on-primary border border-white/20 hover:bg-white/10 rounded-xl transition-all active:scale-95 mr-1"
            title="Accueil"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>home</span>
            <span className="hidden sm:inline">Accueil</span>
          </button>

          {/* Réglages — settings gear */}
          <button
            onClick={() => setActiveTab('reglages')}
            title="Réglages"
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/90 transition-all active:scale-95 shadow-sm"
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>settings</span>
          </button>

          {/* Mobile clock */}
          <div className="flex md:hidden items-center gap-2 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-on-primary mx-1">
            <span className="font-mono">
              {liveTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-secondary animate-pulse' : 'bg-error animate-pulse'}`} />
          </div>

          <button className="material-symbols-outlined text-on-primary hover:bg-white/10 p-2.5 rounded-full transition-all active:scale-95">
            notifications
          </button>
          <button
            onClick={signOut}
            title="Déconnexion"
            className="flex items-center justify-center text-on-primary hover:bg-white/10 p-2.5 rounded-full transition-all active:scale-95 cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-error text-white text-center py-2 px-4 text-[10px] font-extrabold tracking-wider uppercase flex items-center justify-center gap-2 fixed top-16 left-0 w-full z-40 shadow-md animate-fade-in border-b border-white/10">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>wifi_off</span>
          <span>Mode Hors ligne activé — Les ventes sont sauvegardées localement et se synchroniseront au retour d'Internet.</span>
        </div>
      )}

      {/* Pages Switcher */}
      <main className="w-full">
        {activeTab === 'caisse' && <Caisse boutiqueId={boutiqueId} caissierId={caissierId} />}
        {activeTab === 'stock' && <Stock boutiqueId={boutiqueId} />}
        {activeTab === 'ardoise' && <Ardoise boutiqueId={boutiqueId} />}
        {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
        {activeTab === 'reglages' && (
          <Reglages 
            boutiqueId={boutiqueId} 
            activePlan={activePlanLabel}
            onManageSubscription={() => setActiveTab('subscription')}
          />
        )}
        {activeTab === 'subscription' && (
          <Subscription 
            currentPlan={activePlanLabel}
            onUpdatePlan={async () => {
              await refetch();
            }}
            onBack={() => setActiveTab('reglages')}
          />
        )}
      </main>

      {/* Global Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* PWA Prompt for install & updates */}
      <PwaPrompt />
    </div>
  )
}

export default App
