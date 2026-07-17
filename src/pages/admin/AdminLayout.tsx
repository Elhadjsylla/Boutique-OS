import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminDashboard } from './AdminDashboard';
import { AdminBoutiques } from './AdminBoutiques';
import { AdminUsers } from './AdminUsers';
import { AdminSubscriptions } from './AdminSubscriptions';
import { AdminLogs } from './AdminLogs';

type AdminTab = 'dashboard' | 'boutiques' | 'users' | 'subscriptions' | 'logs';

interface AdminLayoutProps {
  onExit?: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onExit }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash.startsWith('admin-')) {
      const tab = hash.replace('admin-', '') as AdminTab;
      if (['dashboard', 'boutiques', 'users', 'subscriptions', 'logs'].includes(tab)) {
        return tab;
      }
    }
    return (localStorage.getItem('admin_active_tab') as AdminTab) || 'dashboard';
  });

  React.useEffect(() => {
    localStorage.setItem('admin_active_tab', activeTab);
    if (window.location.hash !== `#admin-${activeTab}`) {
      window.history.pushState(null, '', `#admin-${activeTab}`);
    }
  }, [activeTab]);

  React.useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('admin-')) {
        const tab = hash.replace('admin-', '') as AdminTab;
        if (['dashboard', 'boutiques', 'users', 'subscriptions', 'logs'].includes(tab)) {
          setActiveTab(tab);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'boutiques', label: 'Boutiques', icon: 'store' },
    { id: 'users', label: 'Utilisateurs', icon: 'people' },
    { id: 'subscriptions', label: 'Abonnements', icon: 'credit_card' },
    { id: 'logs', label: 'Audit Logs', icon: 'list_alt' }
  ] as const;

  return (
    <div className="min-h-screen bg-admin-surface text-admin-text flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-admin-card border-r border-admin-border p-5 gap-6 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-admin-primary to-admin-primary-light flex items-center justify-center shadow-sm text-white">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-black tracking-tight text-admin-text uppercase">Sama Boutik</span>
            <span className="text-[9px] font-black uppercase text-admin-primary-light tracking-widest leading-none">Super Admin</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex flex-col gap-1.5 flex-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`h-11 px-3.5 rounded-xl text-xs font-black uppercase tracking-wide flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer ${
                activeTab === item.id
                  ? 'bg-admin-primary text-white shadow-md'
                  : 'text-admin-text-muted hover:text-admin-text hover:bg-admin-surface'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Back to App */}
        {onExit && (
          <button
            onClick={onExit}
            className="h-11 px-3.5 border border-admin-border hover:bg-admin-surface text-xs font-black uppercase tracking-wide rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] cursor-pointer text-admin-text-muted mb-2"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Retour App
          </button>
        )}

        {/* Footer Logout */}
        <button
          onClick={handleLogout}
          className="h-11 px-3.5 border border-admin-border hover:bg-admin-surface text-xs font-black uppercase tracking-wide rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
          Déconnexion
        </button>
      </aside>

      {/* Header - Mobile */}
      <header className="md:hidden bg-admin-card border-b border-admin-border h-16 px-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-admin-primary to-admin-primary-light flex items-center justify-center text-white">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </div>
          <span className="text-sm font-black uppercase tracking-tight text-admin-text">Sama Boutik Admin</span>
        </div>
        <div className="flex items-center gap-2">
          {onExit && (
            <button
              onClick={onExit}
              className="material-symbols-outlined text-admin-primary-light hover:text-admin-text p-1.5 cursor-pointer"
              title="Retour boutique"
            >
              arrow_back
            </button>
          )}
          <button
            onClick={handleLogout}
            className="material-symbols-outlined text-admin-text-muted hover:text-admin-text p-1.5 cursor-pointer"
            title="Se déconnecter"
          >
            logout
          </button>
        </div>
      </header>

      {/* Main Panel Content */}
      <main className="flex-1 p-6 md:p-10 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-10 overflow-y-auto overflow-x-hidden max-w-7xl mx-auto w-full min-w-0">
        {activeTab === 'dashboard' && <AdminDashboard onNavigate={setActiveTab} />}
        {activeTab === 'boutiques' && <AdminBoutiques />}
        {activeTab === 'users' && <AdminUsers />}
        {activeTab === 'subscriptions' && <AdminSubscriptions />}
        {activeTab === 'logs' && <AdminLogs />}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-admin-card border-t border-admin-border pb-[env(safe-area-inset-bottom)] h-[calc(4rem+env(safe-area-inset-bottom))] flex justify-around items-center z-50">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer ${
              activeTab === item.id ? 'text-admin-primary-light' : 'text-admin-text-muted'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{item.icon}</span>
            <span className="text-[8px] font-black uppercase tracking-wider">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
