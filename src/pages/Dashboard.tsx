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
            {isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
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

      {/* Bénéfice Estimé Grid */}
      <section className="flex flex-col gap-3 text-left">
        <h2 className="font-headline-sm text-sm border-b border-outline-variant pb-2 text-primary font-bold uppercase tracking-wider">Bénéfice Estimé (Est. 20%)</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Aujourd'hui", value: Math.round(metrics.caToday * 0.20) },
            { label: "7 jours", value: Math.round(metrics.caWeek * 0.20) },
            { label: "30 jours", value: Math.round(metrics.caMonth * 0.20) }
          ].map((item, i) => (
            <Card key={i} elevation={1} className="flex flex-col gap-1 p-3.5 hover:border-secondary/20 hover:shadow-md transition-all bg-secondary-container/10 border-secondary-container/20">
              <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">{item.label}</span>
              <MoneyText value={item.value} className="text-base text-secondary font-extrabold" />
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

      {/* Activity Graph Section */}
      {(() => {
        const maxVal = Math.max(...(metrics.dailySalesHistory || []), 1000);
        const fillPath = `M0,20 ` + (metrics.dailySalesHistory || []).map((val, idx) => {
          const x = (idx / 6) * 100;
          const y = 20 - (val / maxVal) * 16;
          return `L${x},${y}`;
        }).join(' ') + ` L100,20 Z`;
        
        return (
          <section className="flex flex-col gap-3 text-left">
            <h2 className="font-headline-sm text-sm border-b border-outline-variant pb-2 text-primary font-bold uppercase tracking-wider">Courbe d'Activité (7 jours)</h2>
            <Card elevation={1} className="p-4 flex flex-col justify-between relative overflow-hidden">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-outline font-bold uppercase tracking-wider">Chiffre d'Affaires journalier</span>
                <span className="text-[10px] text-outline font-bold">Dernière semaine</span>
              </div>
              <div className="w-full h-24 mt-2 relative">
                <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="glowGradDash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1A3C5E" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#1A3C5E" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={fillPath} fill="url(#glowGradDash)" />
                  <path d={`M0,${20 - ((metrics.dailySalesHistory?.[0] || 0) / maxVal) * 16} ` + (metrics.dailySalesHistory || []).map((val, idx) => `L${(idx / 6) * 100},${20 - (val / maxVal) * 16}`).join(' ')} fill="none" stroke="#1A3C5E" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="flex justify-between items-center text-[9px] text-outline font-bold mt-2 px-1">
                <span>Il y a 6 jours</span>
                <span>Il y a 3 jours</span>
                <span>Aujourd'hui</span>
              </div>
            </Card>
          </section>
        );
      })()}

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
