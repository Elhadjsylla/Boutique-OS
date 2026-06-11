import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import Login from './components/Login'
import { Caisse } from './pages/Caisse'
import { Dashboard } from './pages/Dashboard'
import { Stock } from './pages/Stock'
import { BottomNav, type TabType } from './components/ui/BottomNav'
import { Loader2, LogOut } from 'lucide-react'

function App() {
  const { user, profile, boutique, isLoading, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('caisse')

  // 1. LOADING SCREEN
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg font-body">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-md" />
        <p className="text-text2 text-sm font-medium">Chargement de BoutikOS...</p>
      </div>
    )
  }

  // 2. UNAUTHENTICATED SCREEN
  if (!user) {
    return <Login />
  }

  // 3. AUTHENTICATED SCREEN
  return (
    <div className="min-h-screen bg-background text-on-background">
      {/* Top App Bar */}
      <header className="bg-primary text-on-primary fixed top-0 left-0 w-full z-40 h-14 flex justify-between items-center px-margin-mobile">
        <div className="flex items-center gap-sm">
          <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-fixed">
            <span className="font-headline-md text-sm font-bold text-on-secondary-container">
              {profile?.role === 'caissier' ? 'C' : profile?.role === 'gerant' ? 'G' : 'A'}
            </span>
          </div>
          <div className="flex flex-col text-left">
            <h1 className="font-headline-md text-base leading-none">BoutikOS</h1>
            <span className="text-[10px] opacity-70 tracking-wider">
              {boutique?.nom.toUpperCase() || 'MARCHÉ CENTRAL'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-md">
          <button 
            onClick={signOut}
            title="Déconnexion"
            className="flex items-center justify-center text-on-primary hover:bg-primary-container/20 p-2 rounded-full transition-transform active:scale-95 cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Pages Switcher */}
      <main className="w-full">
        {activeTab === 'caisse' && <Caisse />}
        
        {activeTab === 'stock' && <Stock />}
        
        {activeTab === 'ardoise' && (
          <div className="pt-24 px-margin-mobile text-center">
            <div className="bg-card border border-border p-lg rounded-card shadow-sm max-w-sm mx-auto">
              <span className="material-symbols-outlined text-5xl text-outline mb-sm">menu_book</span>
              <p className="font-headline-sm text-on-surface mb-xs">Registre des Ardoises</p>
              <p className="text-body-md text-outline">Ce module est en cours de développement par Taph la hagra.</p>
            </div>
          </div>
        )}
        
        {activeTab === 'dashboard' && <Dashboard />}
      </main>

      {/* Global Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  )
}

export default App
