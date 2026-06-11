import React from 'react';

export type TabType = 'caisse' | 'stock' | 'ardoise' | 'dashboard';

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
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-16 px-2 pb-safe bg-primary text-on-primary shadow-lg border-t border-white/5">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-col items-center justify-center flex-1 h-full hover:bg-primary-container/10 transition-colors ${
              isActive ? 'text-secondary-fixed font-bold' : 'text-on-primary/60'
            }`}
          >
            {/* Active Vertical Indicator on the left of each tab container or sub-bar */}
            {isActive && (
              <span className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-full" />
            )}
            
            <span className="material-symbols-outlined text-2xl mb-0.5">
              {tab.icon}
            </span>
            <span className="font-label-md text-label-md">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
