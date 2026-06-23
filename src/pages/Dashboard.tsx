import React, { useState } from 'react';
import { useOnline } from '../hooks/useOnline';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexie';
import { useDashboardData } from '../features/dashboard/useDashboardData';
import { Card } from '../components/ui/Card';
import { MoneyText } from '../components/ui/MoneyText';
import { Badge } from '../components/ui/Badge';
import { BottomSheet } from '../components/ui/BottomSheet';
import { getProductIconAndGradient } from '../lib/productHelper';
import { Toast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { useSubscription } from '../hooks/useSubscription';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface DashboardProps {
  onNavigate?: (tab: 'caisse' | 'stock' | 'ardoise' | 'dashboard') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const isOnline = useOnline();
  const { user } = useAuth();
  const metrics = useDashboardData();
  const { subscription } = useSubscription();
  const isPro = subscription?.plan === 'pro' || subscription?.plan === 'annual' || import.meta.env.DEV;

  const [period, setPeriod] = useState<'24h' | '7j' | '30j' | '1an'>('7j');
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [bilanPeriod, setBilanPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [selectedAnalysisProduct, setSelectedAnalysisProduct] = useState<any | null>(null);
  const [analysisType, setAnalysisType] = useState<'top' | 'unsold' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Export states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'excel'>('excel');
  const [exportScope, setExportScope] = useState<'ventes' | 'stock' | 'ardoises'>('ventes');
  const [isExporting, setIsExporting] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const renderLockedSection = (title: string, children: React.ReactNode) => {
    if (isPro) return children;
    return (
      <div className="relative group">
        <div className="opacity-30 pointer-events-none select-none blur-[2px]">
          {children}
        </div>
        <div className="absolute inset-0 bg-[#F5F7FA]/75 backdrop-blur-[2px] border border-outline-variant/60 rounded-2xl flex flex-col items-center justify-center gap-3 p-6 text-center z-10">
          <span className="px-3 py-1 bg-gradient-to-r from-secondary to-secondary/80 text-white rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm border border-secondary/20 animate-pulse-subtle">
            Option Pro
          </span>
          <h3 className="text-xs font-black text-primary uppercase tracking-wide">Débloquez le {title}</h3>
          <p className="text-[10px] text-outline max-w-[240px] leading-relaxed">
            Mettez à niveau votre abonnement pour accéder aux rapports avancés et historiques.
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.('subscription')}
            className="h-8 px-4 bg-primary hover:bg-primary/95 text-white text-[9px] font-black rounded-lg uppercase tracking-wider active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            Passer à l'offre Pro
          </button>
        </div>
      </div>
    );
  };

  const sales = useLiveQuery(() => db.ventes.toArray(), []) || [];
  const allProducts = useLiveQuery(() => db.produits.where('archive').equals(0).toArray(), []) || [];
  const saleItems = useLiveQuery(() => db.vente_items.toArray(), []) || [];

  const productSalesMap: Record<string, number> = {};
  saleItems.forEach(item => {
    productSalesMap[item.produit_id] = (productSalesMap[item.produit_id] || 0) + item.quantite;
  });

  const unsoldProducts = allProducts
    .map(p => ({
      id: p.id,
      nom: p.nom,
      quantite: p.quantite,
      prix: p.prix,
      qtySold: productSalesMap[p.id] || 0
    }))
    .sort((a, b) => a.qtySold - b.qtySold || b.quantite - a.quantite)
    .slice(0, 5);

  return (
    <div className="pb-40 pt-20 px-4 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Page Header */}
      <div className="flex justify-between items-center mt-2">
        <div className="text-left">
          <h1 className="font-headline-lg-mobile text-on-surface">Bilan d'Activité</h1>
          <p className="font-body-md text-on-surface-variant">Statistiques et rapports de votre boutique.</p>
        </div>
        <button
          onClick={() => {
            if (isPro) {
              setIsExportModalOpen(true);
            } else {
              setShowUpgradeModal(true);
            }
          }}
          className="h-10 px-4 bg-primary hover:bg-primary/95 text-white text-[10px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">file_download</span>
          Exporter
        </button>
      </div>

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
      {renderLockedSection("Graphique d'Activité", (() => {
        const fmtFr = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
        const now = new Date();
        let chartData: { label: string; value: number; detail: string }[] = [];

        if (period === '24h') {
          // Last 24 hours in 2-hour steps (12 points)
          for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 2 * 60 * 60 * 1000);
            const hour = d.getHours();
            const label = `${hour}h`;
            
            // filter sales within this 2-hour window
            const windowStart = new Date(d.getTime() - 1 * 60 * 60 * 1000);
            const windowEnd = new Date(d.getTime() + 1 * 60 * 60 * 1000);
            const val = sales
              .filter(s => {
                const sDate = new Date(s.created_at);
                return sDate >= windowStart && sDate < windowEnd;
              })
              .reduce((sum, s) => sum + s.total, 0);

            chartData.push({ 
              label, 
              value: val, 
              detail: `Tranche de ${hour - 1}h à ${hour + 1}h`
            });
          }
        } else if (period === '7j') {
          const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
          for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const label = i === 0 ? "Aujourd'hui" : days[d.getDay()];
            const dateStr = d.toDateString();
            const val = sales
              .filter(s => new Date(s.created_at).toDateString() === dateStr)
              .reduce((sum, s) => sum + s.total, 0);
            chartData.push({ 
              label, 
              value: val, 
              detail: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' }) 
            });
          }
        } else if (period === '30j') {
          // Last 30 days
          for (let i = 29; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const label = `${d.getDate()}/${d.getMonth() + 1}`;
            const dateStr = d.toDateString();
            const val = sales
              .filter(s => new Date(s.created_at).toDateString() === dateStr)
              .reduce((sum, s) => sum + s.total, 0);
            
            // Only show labels for every 5th day to avoid clutter
            const showLabel = i % 5 === 0 ? label : '';
            chartData.push({ 
              label: showLabel, 
              value: val, 
              detail: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' }) 
            });
          }
        } else if (period === '1an') {
          const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
          for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const label = months[d.getMonth()];
            const year = d.getFullYear();
            const val = sales
              .filter(s => {
                const sDate = new Date(s.created_at);
                return sDate.getFullYear() === year && sDate.getMonth() === d.getMonth();
              })
              .reduce((sum, s) => sum + s.total, 0);
            chartData.push({ 
              label, 
              value: val, 
              detail: `${d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}` 
            });
          }
        }

        const width = 500;
        const height = 180;
        const paddingX = 35;
        const paddingY = 25;

        const maxVal = Math.max(...chartData.map(d => d.value), 1000);
        const points = chartData.map((d, idx) => {
          const x = paddingX + (chartData.length > 1 ? (idx / (chartData.length - 1)) * (width - 2 * paddingX) : (width / 2));
          const y = height - paddingY - (d.value / maxVal) * (height - 2 * paddingY);
          return { x, y, label: d.label, value: d.value, detail: d.detail };
        });

        // Compute Bezier Curve path
        let pathD = '';
        let fillPath = '';
        if (points.length > 1) {
          pathD = `M ${points[0].x} ${points[0].y}`;
          for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];
            const cpX1 = p0.x + (p1.x - p0.x) / 2;
            const cpY1 = p0.y;
            const cpX2 = p0.x + (p1.x - p0.x) / 2;
            const cpY2 = p1.y;
            pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
          }
          fillPath = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;
        } else if (points.length === 1) {
          pathD = `M ${points[0].x} ${points[0].y}`;
        }

        const hoveredPoint = hoveredPointIdx !== null ? points[hoveredPointIdx] : null;

        return (
          <section className="flex flex-col gap-3 text-left">
            <div className="flex justify-between items-center border-b border-outline-variant pb-2">
              <h2 className="font-headline-sm text-sm text-primary font-bold uppercase tracking-wider">Courbe d'Activité</h2>
              
              {/* Period selection chips */}
              <div className="flex gap-1 bg-surface-container/60 p-0.5 rounded-lg border border-outline-variant">
                {([
                  { id: '24h', label: '24h' },
                  { id: '7j', label: '7j' },
                  { id: '30j', label: '30j' },
                  { id: '1an', label: '1 an' }
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setPeriod(tab.id);
                      setHoveredPointIdx(null);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer ${
                      period === tab.id
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-outline hover:text-texte hover:bg-surface-container'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <Card elevation={1} className="p-4 flex flex-col justify-between relative overflow-visible bg-gradient-to-b from-primary-container/10 to-transparent">
              <div className="flex justify-between items-start mb-1">
                <div className="flex flex-col">
                  <span className="text-[10px] text-outline font-extrabold uppercase tracking-wider">Chiffre d'Affaires</span>
                  <span className="text-xs font-black text-on-surface-variant">
                    {period === '24h' ? 'Activité sur les dernières 24 heures' :
                     period === '7j' ? 'Activité sur la dernière semaine' :
                     period === '30j' ? 'Activité sur les 30 derniers jours' :
                     'Activité sur l\'année en cours'}
                  </span>
                </div>
                {hoveredPoint && (
                  <div className="text-right flex flex-col items-end animate-fade-in">
                    <span className="text-[10px] text-primary font-extrabold font-numeric-display">{fmtFr(hoveredPoint.value)} FCFA</span>
                    <span className="text-[9px] text-outline font-semibold">{hoveredPoint.detail}</span>
                  </div>
                )}
              </div>

              {/* Graphic area */}
              <div className="relative w-full overflow-visible mt-2">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
                  <defs>
                    <linearGradient id="dashboardGlowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1A3C5E" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#1A3C5E" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal gridlines */}
                  <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#E5E7EB" strokeWidth="1.5" />
                  <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#E5E7EB" strokeWidth="0.5" strokeDasharray="3,3" />

                  {/* Shaded Area */}
                  {fillPath && <path d={fillPath} fill="url(#dashboardGlowGrad)" className="transition-all duration-300" />}

                  {/* Curve Path */}
                  {pathD && <path d={pathD} fill="none" stroke="#1A3C5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-300" />}

                  {/* Interactive Cursor line on hover */}
                  {hoveredPoint && (
                    <line
                      x1={hoveredPoint.x}
                      y1={paddingY}
                      x2={hoveredPoint.x}
                      y2={height - paddingY}
                      stroke="#1A3C5E"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                      className="animate-fade-in"
                    />
                  )}

                  {/* Interaction Dots */}
                  {points.map((p, idx) => {
                    const isHovered = hoveredPointIdx === idx;
                    return (
                      <g
                        key={idx}
                        onMouseEnter={() => setHoveredPointIdx(idx)}
                        onMouseLeave={() => setHoveredPointIdx(null)}
                        className="cursor-pointer"
                      >
                        {/* Glow indicator */}
                        {isHovered && (
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r="8"
                            fill="#1A3C5E"
                            opacity="0.25"
                            className="transition-all duration-150 animate-pulse-subtle"
                          />
                        )}
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={isHovered ? "5" : "3.5"}
                          fill={isHovered ? "#1A3C5E" : "#FFFFFF"}
                          stroke="#1A3C5E"
                          strokeWidth="2"
                          className="transition-all duration-150"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Bottom Labels */}
              <div className="flex justify-between items-center text-[8px] text-outline font-black uppercase tracking-wider mt-2 px-4.5">
                <span>{chartData[0]?.label || ''}</span>
                <span>{chartData[Math.floor(chartData.length / 2)]?.label || ''}</span>
                <span>{chartData[chartData.length - 1]?.label || ''}</span>
              </div>
            </Card>
          </section>
        );
      })())}

      {/* Performance Reports Section */}
      {renderLockedSection("Bilans de Clôture", (() => {
        const fmtFr = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
        const now = new Date();
        let start = new Date();
        let end = new Date();
        let periodName = "";
        let nextAvailableDate = "";

        if (bilanPeriod === 'week') {
          // Last completed calendar week (Monday to Sunday)
          const currentDay = now.getDay(); // 0 = Sun, 1 = Mon, etc.
          const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1; // days since last Monday
          const mondayOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract);
          
          start = new Date(mondayOfThisWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
          start.setHours(0,0,0,0);
          
          end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
          periodName = `Semaine du ${start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} au ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`;
          
          // Next report is available next Monday
          const nextMonday = new Date(mondayOfThisWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
          nextAvailableDate = `Prochain bilan dispo le ${nextMonday.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`;
        } else if (bilanPeriod === 'month') {
          // Last completed calendar month
          start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          periodName = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
          
          // Next report available 1st of next month
          const nextMonthFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          nextAvailableDate = `Prochain bilan dispo le ${nextMonthFirst.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`;
        } else {
          // Last completed calendar year
          start = new Date(now.getFullYear() - 1, 0, 1);
          end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
          periodName = `Année ${start.getFullYear()}`;
          
          // Next report available Jan 1st of next year
          nextAvailableDate = `Prochain bilan dispo le 01 jan. ${now.getFullYear() + 1}`;
        }

        const periodSales = sales.filter(s => {
          const sDate = new Date(s.created_at);
          return sDate >= start && sDate <= end;
        });

        const totalRevenue = periodSales.reduce((sum, s) => sum + s.total, 0);
        const estimatedProfit = Math.round(totalRevenue * 0.20);
        const transactionsCount = periodSales.length;
        const avgBasket = transactionsCount > 0 ? Math.round(totalRevenue / transactionsCount) : 0;

        const handleCopyBilan = () => {
          const text = `🏆 BILAN DE PERFORMANCE BOUTIQUE OS\n` +
            `Type : Bilan ${bilanPeriod === 'week' ? 'Hebdomadaire' : bilanPeriod === 'month' ? 'Mensuel' : 'Annuel'}\n` +
            `Période : ${periodName}\n` +
            `-----------------------------------\n` +
            `• Chiffre d'Affaires : ${fmtFr(totalRevenue)} FCFA\n` +
            `• Bénéfice Estimé (20%) : ${fmtFr(estimatedProfit)} FCFA\n` +
            `• Transactions de Vente : ${transactionsCount}\n` +
            `• Panier Moyen : ${fmtFr(avgBasket)} FCFA\n` +
            `-----------------------------------\n` +
            `Généré automatiquement par BoutikOS.`;
          navigator.clipboard.writeText(text);
          setToast({ message: "Bilan copié !", type: "success" });
        };

        const handleDownloadCSV = () => {
          if (periodSales.length === 0) {
            setToast({ message: "Aucune transaction pour cette période !", type: "error" });
            return;
          }
          const headers = "ID Vente;Date;Heure;Total (FCFA)\n";
          const rows = periodSales.map(s => {
            const dateObj = new Date(s.created_at);
            const dateStr = dateObj.toLocaleDateString('fr-FR');
            const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            return `${s.id};${dateStr};${timeStr};${s.total}`;
          }).join('\n');
          
          const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(headers + rows);
          const link = document.createElement("a");
          link.setAttribute("href", csvContent);
          link.setAttribute("download", `bilan_${bilanPeriod}_${periodName.replace(/\s+/g, '_')}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        return (
          <section className="flex flex-col gap-3 text-left">
            <h2 className="font-headline-sm text-sm border-b border-outline-variant pb-2 text-primary font-bold uppercase tracking-wider">Bilans de Clôture</h2>
            <Card elevation={1} className="p-4 flex flex-col gap-4 relative overflow-hidden bg-white">
              {/* Tabs inside Card */}
              <div className="flex justify-between items-center pb-2 border-b border-outline-variant/40">
                <div className="flex gap-1.5 bg-surface-container/60 p-0.5 rounded-lg border border-outline-variant">
                  {([
                    { id: 'week', label: 'Hebdo' },
                    { id: 'month', label: 'Mensuel' },
                    { id: 'year', label: 'Annuel' }
                  ] as const).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setBilanPeriod(tab.id)}
                      className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer ${
                        bilanPeriod === tab.id
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-outline hover:text-texte hover:bg-surface-container'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <span className="text-[9px] text-outline font-black bg-surface-container/80 px-2 py-1 rounded-full uppercase">
                  Période Terminée
                </span>
              </div>

              {/* Bilan Header */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-black text-on-surface uppercase tracking-wide">
                  {bilanPeriod === 'week' ? 'Bilan de la semaine dernière' :
                   bilanPeriod === 'month' ? 'Bilan du mois dernier' :
                   'Bilan de l\'année dernière'}
                </span>
                <span className="text-[10px] text-outline font-bold bg-primary-container/20 border border-outline-variant/60 rounded-lg px-2.5 py-1.5 inline-block w-fit">
                  📅 {periodName}
                </span>
              </div>

              {/* Bilan Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="bg-surface-container-lowest border border-outline-variant/60 p-3 rounded-xl flex flex-col justify-between h-20 shadow-sm">
                  <span className="text-[9px] font-bold text-outline uppercase tracking-wide">Chiffre d'Affaires</span>
                  <span className="text-base font-black text-primary font-numeric-display">{fmtFr(totalRevenue)} F</span>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant/60 p-3 rounded-xl flex flex-col justify-between h-20 shadow-sm">
                  <span className="text-[9px] font-bold text-outline uppercase tracking-wide">Bénéfice Estimé</span>
                  <span className="text-base font-black text-secondary font-numeric-display">{fmtFr(estimatedProfit)} F</span>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant/60 p-3 rounded-xl flex flex-col justify-between h-20 shadow-sm">
                  <span className="text-[9px] font-bold text-outline uppercase tracking-wide">Transactions</span>
                  <span className="text-base font-black text-texte font-numeric-display">{transactionsCount}</span>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant/60 p-3 rounded-xl flex flex-col justify-between h-20 shadow-sm">
                  <span className="text-[9px] font-bold text-outline uppercase tracking-wide">Panier Moyen</span>
                  <span className="text-base font-black text-tertiary font-numeric-display">{fmtFr(avgBasket)} F</span>
                </div>
              </div>

              {/* Share / Export button */}
              <div className="flex flex-col sm:flex-row gap-2 border-t border-outline-variant/40 pt-3 mt-1 justify-between items-center w-full">
                <span className="text-[9px] text-outline italic font-medium">{nextAvailableDate}</span>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleDownloadCSV}
                    className="flex-1 sm:flex-initial h-8 px-4 border border-outline-variant hover:bg-surface-container text-texte-2 text-[10px] font-black rounded-lg uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    Télécharger CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyBilan}
                    className="flex-1 sm:flex-initial h-8 px-4 bg-primary hover:bg-primary/95 text-white text-[10px] font-black rounded-lg uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">share</span>
                    Partager
                  </button>
                </div>
              </div>
            </Card>
          </section>
        );
      })())}

      {/* Top 5 Products Section */}
      {renderLockedSection("Top Produits", (
        <section className="flex flex-col gap-3 text-left">
        <h2 className="font-headline-sm text-sm border-b border-outline-variant pb-2 text-primary font-bold uppercase tracking-wider">Top 5 Produits Vendus</h2>
        <Card elevation={1} className="flex flex-col gap-4 p-4">
          {metrics.topProducts.length === 0 ? (
            <p className="text-sm text-outline text-center py-6">Aucune vente enregistrée.</p>
          ) : (
            metrics.topProducts.map((product, idx) => {
              const percentage = (product.qty / product.maxQty) * 100;
              const productStyle = getProductIconAndGradient(product.nom);
              const fullProduct = allProducts.find(p => p.nom === product.nom);
              
              return (
                <div 
                  key={idx}
                  onClick={() => {
                    setSelectedAnalysisProduct({
                      nom: product.nom,
                      qty: product.qty,
                      quantite: fullProduct ? fullProduct.quantite : 0,
                      prix: fullProduct ? fullProduct.prix : 0
                    });
                    setAnalysisType('top');
                  }}
                  className="flex flex-col gap-1.5 p-2 -mx-2 hover:bg-primary-container/10 border border-transparent hover:border-outline-variant/30 rounded-xl transition-all cursor-pointer active:scale-[0.99]"
                >
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
      ))}

      {/* Top 5 Unsold Products Section */}
      {renderLockedSection("Produits Invendus", (
        <section className="flex flex-col gap-3 text-left">
        <div className="flex justify-between items-center border-b border-outline-variant pb-2">
          <h2 className="font-headline-sm text-sm text-primary font-bold uppercase tracking-wider">Top 5 Produits Invendus</h2>
          <Badge variant="warning" className="text-[9px] font-black uppercase">
            Alerte Trésorerie
          </Badge>
        </div>
        <Card elevation={1} className="flex flex-col gap-4 p-4">
          {unsoldProducts.length === 0 ? (
            <p className="text-sm text-outline text-center py-6">Aucun produit en stock.</p>
          ) : (
            unsoldProducts.map((product, idx) => {
              const productStyle = getProductIconAndGradient(product.nom);
              const totalDeadCapital = product.quantite * product.prix;
              return (
                <div 
                  key={idx}
                  onClick={() => {
                    setSelectedAnalysisProduct(product);
                    setAnalysisType('unsold');
                  }}
                  className="flex flex-col gap-1.5 p-2 -mx-2 hover:bg-error-container/10 border border-transparent hover:border-outline-variant/30 rounded-xl transition-all cursor-pointer active:scale-[0.99]"
                >
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`w-6 h-6 rounded bg-gradient-to-br ${productStyle.bg} flex items-center justify-center flex-shrink-0 relative shadow-sm border border-outline-variant/30`}>
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                        <span className="text-[10px] select-none">{productStyle.emoji}</span>
                      </div>
                      <span className="text-on-surface font-bold text-sm truncate">{product.nom}</span>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="font-numeric-display text-error font-extrabold text-xs">
                        {totalDeadCapital > 0 ? `${new Intl.NumberFormat('fr-FR').format(totalDeadCapital)} F bloqués` : '0 F'}
                      </span>
                      <span className="text-[8px] text-outline uppercase font-bold">Capital dormant</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[9px] text-outline font-semibold">
                    <span>En Stock : {product.quantite} unité(s)</span>
                    <span>{product.qtySold} vendu(s)</span>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </section>
      ))}

      {/* Bottom Sheet for Product Analytics */}
      <BottomSheet
        isOpen={selectedAnalysisProduct !== null}
        onClose={() => {
          setSelectedAnalysisProduct(null);
          setAnalysisType(null);
        }}
        title={selectedAnalysisProduct ? `${analysisType === 'top' ? '🌟 Produit Gagnant' : '⚠️ Produit Dormant'} : ${selectedAnalysisProduct.nom}` : ''}
      >
        {selectedAnalysisProduct && (() => {
          const p = selectedAnalysisProduct;
          const isTop = analysisType === 'top';
          const totalCapital = p.quantite * (p.prix || 0);

          let reasons = "";
          let recs = "";
          let alternatives = "";

          if (isTop) {
            reasons = "Produit de première nécessité à forte rotation et prix attractif. Présente un fort taux de fidélité client.";
            recs = p.quantite < 15 
              ? "🚨 Stock Bas : Augmentez l'approvisionnement de 50% au plus vite pour éviter une rupture de stock." 
              : "✅ Stock Sécurisé : Le niveau actuel couvre parfaitement la demande estimée.";
            alternatives = p.nom.toLowerCase().includes("riz") ? "Riz Brisé 5kg, Riz Parfumé 1kg, Pâtes Alimentaires" :
                           p.nom.toLowerCase().includes("huile") ? "Huile de Tournesol, Beurre de Karité, Sel iodé" :
                           "Sucre en Poudre, Lait Concentré, Café soluble";
          } else {
            reasons = "Rotation faible ou nulle due à un manque de visibilité en rayon, un prix trop élevé ou une saisonnalité défavorable.";
            recs = "Remise promotionnelle de 10-15% ou création d'un pack bundle (vendre en lot avec un produit star) pour libérer de la trésorerie.";
            alternatives = "Réorganiser l'emplacement physique en rayon (hauteur des yeux) et proposer en suggestion active à la caisse.";
          }

          return (
            <div className="flex flex-col gap-5 text-left pb-6">
              
              {/* Financial impact card */}
              <div className={`p-4 rounded-2xl border ${isTop ? 'bg-primary-container/20 border-primary/20' : 'bg-error-container/20 border-error/20'}`}>
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline font-black uppercase tracking-wider">
                      {isTop ? 'Volume de Ventes (7j)' : 'Capital Immobilisé (Dormant)'}
                    </span>
                    <span className="text-lg font-black text-on-surface font-numeric-display">
                      {isTop ? `${p.qty} unités vendues` : `${new Intl.NumberFormat('fr-FR').format(totalCapital)} FCFA`}
                    </span>
                  </div>
                  <span className={`material-symbols-outlined text-2xl ${isTop ? 'text-primary' : 'text-error'}`}>
                    {isTop ? 'trending_up' : 'trending_down'}
                  </span>
                </div>
              </div>

              {/* Purchase frequency or stock health */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-outline font-extrabold uppercase tracking-wider">Diagnostic & Fréquence</span>
                <p className="text-xs text-on-surface font-semibold leading-relaxed bg-surface-container/40 p-3 rounded-xl border border-outline-variant/50">
                  {isTop 
                    ? `📈 Fréquence élevée : Achat régulier par les clients. Vitesse moyenne estimée à ${(p.qty / 7).toFixed(1)} ventes/jour.` 
                    : `⚠️ Fréquence critique : Aucun achat récent. ${p.quantite} pièces dorment en stock sans générer de revenus.`}
                </p>
              </div>

              {/* Why it works / why it doesn't */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-outline font-extrabold uppercase tracking-wider font-bold">Analyse de Performance</span>
                <p className="text-xs text-on-surface leading-relaxed">
                  {reasons}
                </p>
              </div>

              {/* Action plan (increase stock or stop bleeding) */}
              <div className="flex flex-col gap-2 border-t border-outline-variant/30 pt-3">
                <span className="text-[10px] text-outline font-extrabold uppercase tracking-wider text-primary">
                  {isTop ? 'Plan d\'Approvisionnement Recommandé' : 'Plan d\'Action pour Stopper l\'Hémorragie'}
                </span>
                <div className="bg-primary-container/10 border border-primary/20 rounded-xl p-3 flex gap-2.5 items-start">
                  <span className="material-symbols-outlined text-primary text-lg flex-shrink-0 mt-0.5">lightbulb</span>
                  <p className="text-xs text-on-surface font-bold leading-relaxed">
                    {recs}
                  </p>
                </div>
              </div>

              {/* Similar products or corrective actions */}
              <div className="flex flex-col gap-1.5 border-t border-outline-variant/30 pt-3">
                <span className="text-[10px] text-outline font-extrabold uppercase tracking-wider">
                  {isTop ? 'Produits similaires gagnants (Prédiction)' : 'Remèdes / Actions physiques'}
                </span>
                <p className="text-xs text-texte-2 leading-relaxed">
                  {isTop 
                    ? `💡 Produits connexes recommandés pour diversifier votre offre : ${alternatives}`
                    : `📦 Solution recommandée : ${alternatives}`}
                </p>
              </div>
              
              <button
                onClick={() => {
                  setSelectedAnalysisProduct(null);
                  setAnalysisType(null);
                }}
                className="w-full h-10 mt-2 bg-surface-container hover:bg-outline-variant/50 border border-outline-variant text-texte text-xs font-black rounded-xl transition-all"
              >
                Fermer l'analyse
              </button>
            </div>
          );
        })()}
      </BottomSheet>
 
      {/* MODAL: Upgrade CTA */}
      <Modal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} title="🚀 Fonctionnalité Pro">
        <div className="flex flex-col gap-4 text-center p-2">
          <div className="w-12 h-12 rounded-full bg-secondary/15 text-secondary flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-2xl">workspace_premium</span>
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-black text-primary uppercase">Mettre à niveau votre forfait</h3>
            <p className="text-[11px] text-outline leading-relaxed">
              L'export des bilans au format PDF et Excel est réservé aux abonnements **Pro** et **Annuel**.
            </p>
          </div>
          <div className="flex gap-2.5 mt-2">
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="flex-1 h-10 border border-outline-variant hover:bg-surface-container text-texte text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                setShowUpgradeModal(false);
                onNavigate?.('subscription');
              }}
              className="flex-1 h-10 bg-primary hover:bg-primary/95 text-white text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-sm"
            >
              Voir les offres
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Export Configuration */}
      <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="📥 Exporter les Données">
        <div className="flex flex-col gap-4 text-left">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-outline">Type de Rapport</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'ventes', label: 'Ventes', icon: 'receipt_long' },
                { id: 'stock', label: 'Stock', icon: 'inventory_2' },
                { id: 'ardoises', label: 'Ardoises', icon: 'menu_book' }
              ] as const).map(s => (
                <button
                  key={s.id}
                  onClick={() => setExportScope(s.id)}
                  className={`h-16 border rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer ${
                    exportScope === s.id
                      ? 'bg-primary-container/20 border-primary text-primary font-bold'
                      : 'border-outline-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{s.icon}</span>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-outline">Format d'Export</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { id: 'excel', label: 'Excel / CSV', desc: 'Fichier tableur' },
                { id: 'pdf', label: 'PDF (Impression)', desc: 'Document prêt à imprimer' }
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setExportType(t.id)}
                  className={`p-3 border rounded-xl flex flex-col text-left gap-0.5 active:scale-95 transition-all cursor-pointer ${
                    exportType === t.id
                      ? 'bg-secondary-container/20 border-secondary text-secondary'
                      : 'border-outline-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase tracking-wide">{t.label}</span>
                  <span className="text-[8px] text-outline font-semibold">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={async () => {
              setIsExporting(true);
              try {
                // Generate exports client-side for offline-first resilience
                if (exportScope === 'stock') {
                  const produits = await db.produits.where('archive').equals(0).toArray();
                  
                  if (exportType === 'excel') {
                    let csvContent = '\ufeff'; // UTF-8 BOM for Excel
                    csvContent += 'Nom Produit;Prix (FCFA);Quantité;Seuil d Alerte\n';
                    produits.forEach(p => {
                      csvContent += `"${p.nom.replace(/"/g, '""')}";${p.prix};${p.quantite};${p.seuil_alerte}\n`;
                    });
                    
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `export_stock_${new Date().toISOString().slice(0, 10)}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setToast({ message: 'Téléchargement du stock lancé !', type: 'success' });
                  } else {
                    const htmlText = `
                      <html>
                      <head>
                        <title>Rapport de Stock — BoutikOS</title>
                        <style>
                          body { font-family: sans-serif; padding: 20px; color: #333; }
                          h1 { color: #1a3c5e; border-bottom: 2px solid #1a3c5e; padding-bottom: 10px; }
                          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                          th { background-color: #f5f5f5; }
                        </style>
                      </head>
                      <body>
                        <h1>Rapport d'Inventaire des Stocks</h1>
                        <p>Généré le : ${new Date().toLocaleString('fr-FR')}</p>
                        <table>
                          <thead>
                            <tr><th>Produit</th><th>Prix (FCFA)</th><th>Quantité en Stock</th></tr>
                          </thead>
                          <tbody>
                            ${produits.map(p => `<tr><td>${p.nom}</td><td>${new Intl.NumberFormat('fr-FR').format(p.prix)}</td><td>${p.quantite}</td></tr>`).join('')}
                          </tbody>
                        </table>
                        <script>window.onload = function() { window.print(); }</script>
                      </body>
                      </html>
                    `;
                    const win = window.open();
                    if (win) {
                      win.document.write(htmlText);
                      win.document.close();
                    } else {
                      setToast({ message: 'Veuillez autoriser les fenêtres pop-up.', type: 'error' });
                    }
                  }
                } else if (exportScope === 'ardoises') {
                  const ardoises = await db.ardoises.toArray();
                  
                  if (exportType === 'excel') {
                    let csvContent = '\ufeff';
                    csvContent += 'Client;Montant Total (FCFA);Statut\n';
                    ardoises.forEach(a => {
                      csvContent += `"${a.client_nom.replace(/"/g, '""')}";${a.montant_total};${a.statut}\n`;
                    });
                    
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `export_ardoises_${new Date().toISOString().slice(0, 10)}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setToast({ message: 'Téléchargement des ardoises lancé !', type: 'success' });
                  } else {
                    const htmlText = `
                      <html>
                      <head>
                        <title>Rapport des Ardoises — BoutikOS</title>
                        <style>
                          body { font-family: sans-serif; padding: 20px; color: #333; }
                          h1 { color: #ba1a1a; border-bottom: 2px solid #ba1a1a; padding-bottom: 10px; }
                          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                          th { background-color: #f5f5f5; }
                        </style>
                      </head>
                      <body>
                        <h1>Rapport des Crédits & Ardoises Clients</h1>
                        <p>Généré le : ${new Date().toLocaleString('fr-FR')}</p>
                        <table>
                          <thead>
                            <tr><th>Nom Client</th><th>Crédit Total (FCFA)</th><th>Statut</th></tr>
                          </thead>
                          <tbody>
                            ${ardoises.map(a => `<tr><td>${a.client_nom}</td><td>${new Intl.NumberFormat('fr-FR').format(a.montant_total)}</td><td>${a.statut === 'soldee' ? 'Soldée' : 'En cours'}</td></tr>`).join('')}
                          </tbody>
                        </table>
                        <script>window.onload = function() { window.print(); }</script>
                      </body>
                      </html>
                    `;
                    const win = window.open();
                    if (win) {
                      win.document.write(htmlText);
                      win.document.close();
                    } else {
                      setToast({ message: 'Veuillez autoriser les fenêtres pop-up.', type: 'error' });
                    }
                  }
                } else { // ventes
                  const ventes = await db.ventes.toArray();
                  
                  if (exportType === 'excel') {
                    let csvContent = '\ufeff';
                    csvContent += 'Date;Montant Total (FCFA);ID Caissier\n';
                    ventes.forEach(v => {
                      csvContent += `${new Date(v.created_at).toLocaleString('fr-FR')};${v.total};${v.caissier_id}\n`;
                    });
                    
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `export_ventes_${new Date().toISOString().slice(0, 10)}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setToast({ message: 'Téléchargement des ventes lancé !', type: 'success' });
                  } else {
                    const htmlText = `
                      <html>
                      <head>
                        <title>Rapport des Ventes — BoutikOS</title>
                        <style>
                          body { font-family: sans-serif; padding: 20px; color: #333; }
                          h1 { color: #27ae60; border-bottom: 2px solid #27ae60; padding-bottom: 10px; }
                          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                          th { background-color: #f5f5f5; }
                        </style>
                      </head>
                      <body>
                        <h1>Rapport Général des Ventes</h1>
                        <p>Généré le : ${new Date().toLocaleString('fr-FR')}</p>
                        <table>
                          <thead>
                            <tr><th>Date</th><th>Montant (FCFA)</th><th>ID Caissier</th></tr>
                          </thead>
                          <tbody>
                            ${ventes.map(v => `<tr><td>${new Date(v.created_at).toLocaleString('fr-FR')}</td><td>${new Intl.NumberFormat('fr-FR').format(v.total)}</td><td>${v.caissier_id.slice(0, 8)}</td></tr>`).join('')}
                          </tbody>
                        </table>
                        <script>window.onload = function() { window.print(); }</script>
                      </body>
                      </html>
                    `;
                    const win = window.open();
                    if (win) {
                      win.document.write(htmlText);
                      win.document.close();
                    } else {
                      setToast({ message: 'Veuillez autoriser les fenêtres pop-up.', type: 'error' });
                    }
                  }
                }
                setIsExportModalOpen(false);
              } catch (e: any) {
                setToast({ message: e.message || 'Erreur lors de l\'export.', type: 'error' });
              } finally {
                setIsExporting(false);
              }
            }}
            disabled={isExporting}
            className="h-10 bg-primary hover:bg-primary/95 text-white text-[10px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-sm mt-2 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">file_download</span>
            {isExporting ? 'EXPORTATION EN COURS...' : 'CONFIRMER L\'EXPORT'}
          </button>
        </div>
      </Modal>
    </div>
  );
};
export default Dashboard;
