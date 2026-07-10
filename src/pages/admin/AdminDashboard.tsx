import React from 'react';
import { AlertsBanner } from './dashboard/AlertsBanner';
import { UserValidationTable } from './dashboard/UserValidationTable';
import { RevenueSection } from './dashboard/RevenueSection';
import { LTVFunnelSection } from './dashboard/LTVFunnelSection';
import { ChurnSection } from './dashboard/ChurnSection';
import { TrafficSection } from './dashboard/TrafficSection';
import { ActiveDormantBoutiques } from './dashboard/ActiveDormantBoutiques';
import { GeoMap } from './dashboard/GeoMap';
import { SignalementsTable } from './dashboard/SignalementsTable';
import { AdminActionsLog } from './dashboard/AdminActionsLog';

interface AdminDashboardProps {
  onNavigate?: (tab: 'dashboard' | 'boutiques' | 'users' | 'subscriptions' | 'logs') => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = () => {
  return (
    <div className="flex flex-col gap-8 pb-10 min-w-0 w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-black uppercase tracking-tight text-admin-text">
          Tableau de Bord
        </h1>
        <p className="text-admin-text-muted text-sm">
          Vue globale des performances de Sama Boutik
        </p>
      </div>

      <AlertsBanner />

      {/* Row 1: Users Validation & Traffic */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <UserValidationTable />
        <TrafficSection />
      </div>

      {/* Row 2: Revenue */}
      <RevenueSection />

      {/* Row 3: LTV & Funnel */}
      <LTVFunnelSection />

      {/* Row 4: Churn & Active/Dormant Boutiques */}
      <div className="flex flex-col gap-8">
        <ChurnSection />
        <ActiveDormantBoutiques />
      </div>

      {/* Row 5: Geo & Signalements */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <GeoMap />
        <SignalementsTable />
      </div>

      {/* Row 6: Audit Logs */}
      <div>
        <AdminActionsLog />
      </div>
    </div>
  );
};
