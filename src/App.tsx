import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { Login } from './components/Login'
import { Caisse } from './pages/Caisse'
import { Dashboard } from './pages/Dashboard'
import { Stock } from './pages/Stock'
import { Ardoise } from './pages/Ardoise'
import { BottomNav, type TabType } from './components/ui/BottomNav'
import { Loader2, LogOut } from 'lucide-react'
import { SyncIndicator } from './pwa/SyncIndicator'
import { PwaPrompt } from './pwa/PwaPrompt'

function App() {
  const { user, profile, boutique, isLoading, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('caisse')

  // 1. LOADING SCREEN
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background font-body">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-md" />
        <p className="text-outline text-sm font-medium">Chargement de BoutikOS...</p>
      </div>
    )
  }

  // 2. UNAUTHENTICATED SCREEN
  if (!user) {
    return <Login />
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
        <div className="flex items-center gap-3">
          <SyncIndicator />
          <button 
            onClick={signOut}
            title="Déconnexion"
            className="flex items-center justify-center text-on-primary hover:bg-white/10 p-2.5 rounded-full transition-all active:scale-95 cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Pages Switcher */}
      <main className="w-full">
        {activeTab === 'caisse' && <Caisse boutiqueId={boutiqueId} caissierId={caissierId} />}
        {activeTab === 'stock' && <Stock boutiqueId={boutiqueId} />}
        {activeTab === 'ardoise' && <Ardoise boutiqueId={boutiqueId} />}
        {activeTab === 'dashboard' && <Dashboard />}
      </main>

      {/* Global Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* PWA Prompt for install & updates */}
      <PwaPrompt />
    </div>
  )
}

export default App
