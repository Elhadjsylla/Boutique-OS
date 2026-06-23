import React from 'react';

export type TabType = 'caisse' | 'stock' | 'ardoise' | 'dashboard' | 'settings' | 'subscription' | 'portal_client';

interface BottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
}) => {
  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'caisse', label: 'Caisse', icon: 'point_of_sale' },
    { id: 'stock', label: 'Stock', icon: 'inventory_2' },
    { id: 'ardoise', label: 'Ardoise', icon: 'menu_book' },
    { id: 'dashboard', label: 'Dashboard', icon: 'leaderboard' },
    { id: 'settings', label: 'Réglages', icon: 'settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-18 px-4 pb-safe bg-primary text-on-primary shadow-[0_-8px_30px_rgb(0,0,0,0.12)] border-t border-white/10 backdrop-blur-md">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-col items-center justify-center flex-1 h-full rounded-2xl transition-all duration-200 ${
              isActive ? 'text-white scale-105' : 'text-white/60 hover:text-white/80'
            }`}
          >
            {/* Soft background pill indicator on active with glow */}
            {isActive && (
              <>
                <span className="absolute inset-x-2 inset-y-2 bg-white/5 rounded-xl -z-10 border border-white/10 shadow-[0_0_15px_rgba(39,174,96,0.25)] animate-fade-in" />
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-secondary rounded-full shadow-[0_0_8px_#27AE60] animate-fade-in" />
              </>
            )}
            
            <span 
              className={`material-symbols-outlined text-2.5xl mb-0.5 transition-all duration-200 ${isActive ? 'text-secondary' : ''}`}
              style={isActive ? { fontVariationSettings: "'FILL' 1, 'wght' 500" } : undefined}
            >
              {tab.icon}
            </span>
            <span className={`text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${isActive ? 'text-white' : ''}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
export default BottomNav;
