import React from 'react';
import { useOnline } from '../hooks/useOnline';
import { useDashboardData } from '../features/dashboard/useDashboardData';
import { Card } from '../components/ui/Card';
import { MoneyText } from '../components/ui/MoneyText';

export const Dashboard: React.FC = () => {
  const isOnline = useOnline();
  const metrics = useDashboardData();

  return (
    <div className="pb-40 pt-16 px-margin-mobile max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto flex flex-col gap-lg">
      
      {/* Permanent Connection Banner */}
      <div className="flex justify-between items-center mt-sm border border-border bg-card px-md py-sm rounded-xl">
        <span className="font-headline-sm text-on-surface">Statut Connexion</span>
        <div className="flex items-center gap-sm">
          <span className={`w-3.5 h-3.5 rounded-full ${isOnline ? 'bg-secondary' : 'bg-error'}`} />
          <span className="font-label-md text-label-md text-on-surface-variant font-bold">
            {isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
          </span>
        </div>
      </div>

      {/* Metrics Section */}
      <section className="flex flex-col gap-sm text-left">
        <h2 className="font-headline-sm border-b border-border pb-xs">Chiffre d'Affaires</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          <Card elevation={2} className="flex flex-col gap-xs">
            <span className="text-[10px] text-outline font-bold uppercase tracking-wider">Aujourd'hui</span>
            <MoneyText value={metrics.caToday} className="text-xl text-primary font-bold" />
          </Card>
          <Card elevation={2} className="flex flex-col gap-xs">
            <span className="text-[10px] text-outline font-bold uppercase tracking-wider">7 Derniers Jours</span>
            <MoneyText value={metrics.caWeek} className="text-xl text-primary font-bold" />
          </Card>
          <Card elevation={2} className="flex flex-col gap-xs">
            <span className="text-[10px] text-outline font-bold uppercase tracking-wider">30 Derniers Jours</span>
            <MoneyText value={metrics.caMonth} className="text-xl text-primary font-bold" />
          </Card>
        </div>
      </section>

      {/* Store Metrics */}
      <section className="flex flex-col gap-sm text-left">
        <h2 className="font-headline-sm border-b border-border pb-xs">Indicateurs d'Activité</h2>
        <div className="grid grid-cols-3 gap-md">
          <Card elevation={1} className="text-center p-sm flex flex-col items-center">
            <span className="material-symbols-outlined text-primary text-2xl mb-1">receipt_long</span>
            <span className="font-numeric-display text-lg text-primary">{metrics.salesCountToday}</span>
            <span className="text-[9px] text-outline font-semibold uppercase mt-1">Ventes Jour</span>
          </Card>
          <Card elevation={1} className="text-center p-sm flex flex-col items-center">
            <span className="material-symbols-outlined text-tertiary-container text-2xl mb-1">menu_book</span>
            <span className="font-numeric-display text-lg text-tertiary-container">{metrics.openArdoisesCount}</span>
            <span className="text-[9px] text-outline font-semibold uppercase mt-1">Ardoises</span>
          </Card>
          <Card elevation={1} className="text-center p-sm flex flex-col items-center">
            <span className="material-symbols-outlined text-error text-2xl mb-1">warning</span>
            <span className="font-numeric-display text-lg text-error">{metrics.outOfStockCount}</span>
            <span className="text-[9px] text-outline font-semibold uppercase mt-1">Ruptures</span>
          </Card>
        </div>
      </section>

      {/* Top 5 Products sold (Custom Data-viz) */}
      <section className="flex flex-col gap-sm text-left">
        <h2 className="font-headline-sm border-b border-border pb-xs">Top 5 Produits Vendus</h2>
        <Card elevation={1} className="flex flex-col gap-md">
          {metrics.topProducts.length === 0 ? (
            <p className="text-sm text-outline text-center py-sm">Aucune vente enregistrée.</p>
          ) : (
            metrics.topProducts.map((product, idx) => {
              const percentage = (product.qty / product.maxQty) * 100;
              return (
                <div key={idx} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-on-surface">{product.nom}</span>
                    <span className="font-numeric-display text-primary">{product.qty} vendus</span>
                  </div>
                  {/* Progress Bar Container */}
                  <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${percentage}%` }}
                      className="h-full bg-primary rounded-full transition-all duration-500" 
                    />
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </section>

    </div>
  );
};
export default Dashboard;
