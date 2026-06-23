import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminDashboard } from './AdminDashboard';
import { AdminBoutiques } from './AdminBoutiques';
import { AdminUsers } from './AdminUsers';
import { AdminSubscriptions } from './AdminSubscriptions';
import { AdminLogs } from './AdminLogs';

type AdminTab = 'dashboard' | 'boutiques' | 'users' | 'subscriptions' | 'logs';

export const AdminLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

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
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-admin-primary to-admin-primary-light flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-black">OS</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-black tracking-tight text-admin-text uppercase">BoutikOS</span>
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
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-admin-primary to-admin-primary-light flex items-center justify-center">
            <span className="text-white text-xs font-black">OS</span>
          </div>
          <span className="text-sm font-black uppercase tracking-tight text-admin-text">BoutikOS Admin</span>
        </div>
        <button
          onClick={handleLogout}
          className="material-symbols-outlined text-admin-text-muted hover:text-admin-text p-1.5 cursor-pointer"
          title="Se déconnecter"
        >
          logout
        </button>
      </header>

      {/* Main Panel Content */}
      <main className="flex-1 p-6 md:p-10 pb-24 md:pb-10 overflow-y-auto max-w-7xl mx-auto w-full">
        {activeTab === 'dashboard' && <AdminDashboard />}
        {activeTab === 'boutiques' && <AdminBoutiques />}
        {activeTab === 'users' && <AdminUsers />}
        {activeTab === 'subscriptions' && <AdminSubscriptions />}
        {activeTab === 'logs' && <AdminLogs />}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-admin-card border-t border-admin-border h-16 flex justify-around items-center z-50">
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
