import { useState } from 'react';
import { Caisse } from './pages/Caisse';
import { StyleGuide } from './pages/_StyleGuide';
import { BottomNav, type TabType } from './components/ui/BottomNav';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('caisse');

  return (
    <div className="min-h-screen bg-background text-on-background">
      {/* Top App Bar */}
      <header className="bg-primary text-on-primary fixed top-0 left-0 w-full z-40 h-14 flex justify-between items-center px-margin-mobile">
        <div className="flex items-center gap-sm">
          <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-fixed">
            <span className="font-headline-md text-sm font-bold text-on-secondary-container">JS</span>
          </div>
          <div className="flex flex-col text-left">
            <h1 className="font-headline-md text-base leading-none">BoutikOS</h1>
            <span className="text-[10px] opacity-70 tracking-wider">MARCHÉ CENTRAL</span>
          </div>
        </div>
        <div className="flex items-center gap-md">
          <button className="material-symbols-outlined text-on-primary hover:bg-primary-container/20 p-2 rounded-full transition-transform active:scale-95">
            notifications
          </button>
        </div>
      </header>

      {/* Pages Switcher */}
      <main className="w-full">
        {activeTab === 'caisse' && <Caisse />}
        
        {activeTab === 'stock' && (
          <div className="pt-24 px-margin-mobile text-center">
            <div className="bg-card border border-border p-lg rounded-card shadow-sm max-w-sm mx-auto">
              <span className="material-symbols-outlined text-5xl text-outline mb-sm">inventory_2</span>
              <p className="font-headline-sm text-on-surface mb-xs">Inventaire & Stock</p>
              <p className="text-body-md text-outline">Ce module est en cours de développement par Le Big EL.</p>
            </div>
          </div>
        )}
        
        {activeTab === 'ardoise' && (
          <div className="pt-24 px-margin-mobile text-center">
            <div className="bg-card border border-border p-lg rounded-card shadow-sm max-w-sm mx-auto">
              <span className="material-symbols-outlined text-5xl text-outline mb-sm">menu_book</span>
              <p className="font-headline-sm text-on-surface mb-xs">Registre des Ardoises</p>
              <p className="text-body-md text-outline">Ce module est en cours de développement par Taph la hagra.</p>
            </div>
          </div>
        )}
        
        {activeTab === 'dashboard' && <StyleGuide />}
      </main>

      {/* Global Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default App;
