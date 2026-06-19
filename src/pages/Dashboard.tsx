import React from 'react';
import { useOnline } from '../hooks/useOnline';
import { useDashboardData } from '../features/dashboard/useDashboardData';
import { Card } from '../components/ui/Card';
import { MoneyText } from '../components/ui/MoneyText';
import { getProductIconAndGradient } from '../lib/productHelper';
interface DashboardProps {
  onNavigate?: (tab: 'caisse' | 'stock' | 'ardoise' | 'dashboard') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const isOnline = useOnline();
  const metrics = useDashboardData();

  return (
    <div className="pb-40 pt-20 px-4 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in">
      
      {/* Sleek connection banner */}
      <div className="flex justify-between items-center bg-white border border-outline-variant px-4 py-3 rounded-2xl premium-shadow-sm">
        <span className="text-sm font-bold text-on-surface">Moteur de synchronisation</span>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-secondary animate-pulse' : 'bg-error'}`} />
          <span className="text-xs font-bold text-texte-2">
            {isOnline ? 'EN LIGNE (SUPABASE)' : 'HORS LIGNE (STOCKÉ LOCAL)'}
          </span>
        </div>
      </div>

      {/* Revenue Grid */}
      <section className="flex flex-col gap-3 text-left">
        <h2 className="font-headline-sm text-sm border-b border-outline-variant pb-2 text-primary font-bold uppercase tracking-wider">Chiffre d'Affaires</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Aujourd'hui", value: metrics.caToday },
            { label: "7 jours", value: metrics.caWeek },
            { label: "30 jours", value: metrics.caMonth }
          ].map((item, i) => (
            <Card key={i} elevation={1} className="flex flex-col gap-1 p-3.5 hover:border-primary/20 hover:shadow-md transition-all">
              <span className="text-[10px] text-outline font-bold uppercase tracking-wider">{item.label}</span>
              <MoneyText value={item.value} className="text-base text-primary font-extrabold" />
            </Card>
          ))}
        </div>
      </section>

      {/* Indicators */}
      <section className="flex flex-col gap-3 text-left">
        <h2 className="font-headline-sm text-sm border-b border-outline-variant pb-2 text-primary font-bold uppercase tracking-wider">Indicateurs d'Activité</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'caisse', icon: 'receipt_long', val: metrics.salesCountToday, label: 'Ventes Jour', color: 'text-primary' },
            { id: 'ardoise', icon: 'menu_book', val: metrics.openArdoisesCount, label: 'Ardoises', color: 'text-tertiary' },
            { id: 'stock', icon: 'warning', val: metrics.outOfStockCount, label: 'Ruptures', color: 'text-error' }
          ].map((ind, i) => (
            <Card 
              key={i} 
              elevation={1} 
              onClick={() => onNavigate?.(ind.id as any)}
              className="text-center p-4 flex flex-col items-center hover:border-primary/20 hover:shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <span className={`material-symbols-outlined ${ind.color} text-2xl mb-1`}>{ind.icon}</span>
              <span className="text-lg font-extrabold text-on-surface font-numeric-display">{ind.val}</span>
              <span className="text-[9px] text-outline font-bold uppercase mt-1 tracking-wider">{ind.label}</span>
            </Card>
          ))}
        </div>
      </section>

      {/* Analytics chart */}
      <section className="flex flex-col gap-3 text-left">
        <h2 className="font-headline-sm text-sm border-b border-outline-variant pb-2 text-primary font-bold uppercase tracking-wider">Top 5 Produits Vendus</h2>
        <Card elevation={1} className="flex flex-col gap-4 p-4">
          {metrics.topProducts.length === 0 ? (
            <p className="text-sm text-outline text-center py-6">Aucune vente enregistrée.</p>
          ) : (
            metrics.topProducts.map((product, idx) => {
              const percentage = (product.qty / product.maxQty) * 100;
              const productStyle = getProductIconAndGradient(product.nom);
              return (
                <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`w-6 h-6 rounded bg-gradient-to-br ${productStyle.bg} flex items-center justify-center flex-shrink-0 relative shadow-sm border border-outline-variant/30`}>
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                        <span className="text-[10px] select-none">{productStyle.emoji}</span>
                      </div>
                      <span className="text-on-surface font-bold text-sm truncate">{product.nom}</span>
                    </div>
                    <span className="font-numeric-display text-primary font-bold flex-shrink-0">{product.qty} vendus</span>
                  </div>
                  <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${percentage}%` }}
                      className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500" 
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
