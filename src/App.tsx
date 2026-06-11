import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import Login from './components/Login'
import { LogOut, User, Store, Shield, Loader2 } from 'lucide-react'

function App() {
  const { user, profile, boutique, isLoading, signOut } = useAuth()
  const [count, setCount] = useState(0)

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
    <div className="min-h-screen bg-bg font-body text-text flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border h-16 px-md flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-xs">
          <span className="text-2xl">🏪</span>
          <span className="font-display font-bold text-lg text-primary">BoutikOS</span>
        </div>
        
        <button
          onClick={signOut}
          className="h-10 px-md bg-bg text-text hover:bg-error/10 hover:text-error rounded-button border border-border flex items-center gap-xs transition-all font-semibold text-sm cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-md max-w-4xl mx-auto w-full flex flex-col gap-md">
        {/* User Profile Summary */}
        <div className="bg-card border border-border p-md rounded-card shadow-sm flex flex-col sm:flex-row justify-between gap-sm items-start sm:items-center">
          <div className="flex items-center gap-md">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display font-bold text-md text-text">{user.email}</h2>
              <div className="flex flex-wrap gap-xs mt-xs">
                <span className="inline-flex items-center gap-xs text-xs font-bold bg-primary/10 text-primary px-sm py-[2px] rounded-pill">
                  <Shield className="w-3 h-3" />
                  Rôle : {profile?.role || 'caissier'}
                </span>
                {boutique && (
                  <span className="inline-flex items-center gap-xs text-xs font-bold bg-secondary/10 text-secondary px-sm py-[2px] rounded-pill">
                    <Store className="w-3 h-3" />
                    Boutique : {boutique.nom}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Counter Demo card */}
        <div className="bg-card border border-border p-xl rounded-card shadow-lg text-center mt-md">
          <h3 className="text-xl font-display font-bold mb-sm">Tableau de bord</h3>
          <p className="text-text2 mb-lg text-sm">
            Vous êtes connecté. Le développement de la caisse et du stock est en cours.
          </p>
          
          <div className="max-w-xs mx-auto">
            <button
              type="button"
              className="h-12 px-lg bg-primary text-white font-bold rounded-button hover:opacity-95 active:scale-98 transition-all w-full shadow-md cursor-pointer flex items-center justify-center gap-xs"
              onClick={() => setCount((c) => c + 1)}
            >
              Ventes enregistrées : <span className="numeric font-bold bg-white/20 px-xs py-[2px] rounded-button ml-xs">{count}</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App

