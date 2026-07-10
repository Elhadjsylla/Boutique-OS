import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexie';
import { useArdoise } from '../features/ardoise/useArdoise';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { MoneyText } from '../components/ui/MoneyText';
import { Toast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { BottomSheet } from '../components/ui/BottomSheet';
import { formatMontantCompact } from '../lib/format';

const getAvatarGradient = (name: string) => {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradients = [
    'from-blue-500 to-indigo-600',
    'from-amber-400 to-orange-500',
    'from-emerald-400 to-teal-600',
    'from-purple-500 to-pink-600',
  ];
  return gradients[hash % gradients.length];
};

const fmt = (n: number) => formatMontantCompact(n);

const ArdoiseInteractiveChart: React.FC<{
  items: any[];
  type: 'credits' | 'fiches';
  onOpenDetail: (id: string) => void;
  onAddPayment: (id: string, amount: number) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onShowToast?: (msg: string, type: 'success' | 'error') => void;
}> = ({
  items,
  type,
  onOpenDetail,
  onAddPayment,
  selectedId,
  setSelectedId,
  onShowToast
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="text-xs text-outline italic text-center py-4 bg-surface-container/20 rounded-xl">
        Aucune donnée disponible pour le graphique.
      </p>
    );
  }

  const paddingX = 30;
  const paddingY = 20;
  const width = 450;
  const height = 160;

  // Sort by remaining debt ascending to make a nice curve
  const sortedItems = [...items].sort((a, b) => {
    const valA = type === 'credits' ? a.remaining : a.montant_total;
    const valB = type === 'credits' ? b.remaining : b.montant_total;
    return valA - valB;
  });

  const getVal = (item: any) => {
    return type === 'credits' ? item.remaining : item.montant_total;
  };

  const maxVal = Math.max(...sortedItems.map(getVal), 1);

  const points = sortedItems.map((item, index) => {
    const x = paddingX + (sortedItems.length > 1 ? (index / (sortedItems.length - 1)) * (width - 2 * paddingX) : (width / 2));
    const val = getVal(item);
    const y = height - paddingY - (val / maxVal) * (height - 2 * paddingY);
    return { x, y, item };
  });

  let pathD = '';
  let areaD = '';
  if (points.length > 1) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    areaD = `M ${points[0].x} ${height - paddingY} L ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
      areaD += ` L ${points[i].x} ${points[i].y}`;
    }
    areaD += ` L ${points[points.length - 1].x} ${height - paddingY} Z`;
  }

  const selectedPoint = points.find(p => p.item.id === selectedId);
  const hoveredPoint = points.find(p => p.item.id === hoveredId);

  // Generate WhatsApp text
  const getWhatsAppLink = (clientNom: string, remaining: number) => {
    const message = `Bonjour ${clientNom}, nous vous rappelons amicalement que le solde restant de votre ardoise chez Sama Boutik est de ${formatMontantCompact(remaining)} FCFA. Merci !`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="bg-gradient-to-b from-primary-container/20 to-transparent border border-outline-variant/40 rounded-2xl p-4 flex flex-col gap-3 relative shadow-inner">
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-outline font-extrabold uppercase tracking-wider">
          {type === 'credits' ? 'Répartition des Dettes par Client' : 'Volumes des Crédits Initiaux'}
        </span>
        <Badge variant={type === 'credits' ? 'danger' : 'success'} className="text-[9px] font-black uppercase">
          Interactif
        </Badge>
      </div>

      <div className="relative w-full overflow-visible">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="ardoiseCurveGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#BA1A1A" />
              <stop offset="100%" stopColor="#1A3C5E" />
            </linearGradient>
            <linearGradient id="ardoiseAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#BA1A1A" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#BA1A1A" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#E5E7EB" strokeWidth="1.5" />
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#E5E7EB" strokeWidth="0.5" strokeDasharray="3,3" />

          {/* Area fill */}
          {areaD && <path d={areaD} fill="url(#ardoiseAreaGrad)" />}

          {/* Line path */}
          {pathD && <path d={pathD} fill="none" stroke="url(#ardoiseCurveGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

          {/* Interactive dots */}
          {points.map((p) => {
            const isHovered = hoveredId === p.item.id;
            const isSelected = selectedId === p.item.id;

            return (
              <g
                key={p.item.id}
                onMouseEnter={() => setHoveredId(p.item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setSelectedId(isSelected ? null : p.item.id)}
                className="cursor-pointer"
              >
                {/* Glow ring */}
                {(isHovered || isSelected) && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? 9 : 7}
                    fill={type === 'credits' ? '#BA1A1A' : '#1A3C5E'}
                    opacity="0.3"
                    className="transition-all duration-200"
                  />
                )}
                {/* Core dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4.5"
                  fill={isSelected ? '#1A3C5E' : (type === 'credits' ? '#BA1A1A' : '#27AE60')}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  className="transition-all duration-200 hover:scale-125"
                />
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredPoint && (() => {
          const percent = (hoveredPoint.x / width) * 100;
          let transform = 'translate(-50%, -105%)';
          let leftStyle = `${percent}%`;

          if (percent < 25) {
            transform = 'translate(8px, -105%)';
          } else if (percent > 75) {
            transform = 'translate(-100%, -105%)';
          }

          return (
            <div
              className="absolute bg-slate-900/95 text-white p-2 rounded-xl text-left pointer-events-none z-50 shadow-md border border-white/10 flex flex-col gap-0.5"
              style={{
                left: leftStyle,
                transform: transform,
                top: `${(hoveredPoint.y / height) * 100}%`,
              }}
            >
              <span className="text-[10px] font-black whitespace-nowrap">{hoveredPoint.item.client_nom}</span>
              <span className="text-[9px] opacity-70 whitespace-nowrap">
                Reste : {formatMontantCompact(hoveredPoint.item.remaining)} FCFA
              </span>
            </div>
          );
        })()}
      </div>

      {/* Selected client actions */}
      {selectedPoint ? (
        <div className="bg-white border border-outline-variant/80 p-3 rounded-xl flex flex-col gap-3 animate-scale-in text-left shadow-sm">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-xs font-black text-on-surface">{selectedPoint.item.client_nom}</span>
              <span className="text-[9px] text-outline font-semibold">
                Reste dû : {formatMontantCompact(selectedPoint.item.remaining)} FCFA ({selectedPoint.item.percent}% remboursé)
              </span>
            </div>
            <button
              onClick={() => onOpenDetail(selectedPoint.item.id)}
              className="text-[10px] font-black text-primary border border-outline-variant hover:bg-primary-container/20 px-2.5 py-1 rounded-lg transition-all"
            >
              Gérer la fiche
            </button>
          </div>

          {/* Quick Pay */}
          {selectedPoint.item.remaining > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-outline-variant/30 pt-2">
              <span className="text-[9px] text-outline font-bold uppercase tracking-wider">Versement Rapide :</span>
              <div className="flex gap-1.5">
                {[1000, 2000, 5000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => onAddPayment(selectedPoint.item.id, amt)}
                    disabled={selectedPoint.item.remaining < amt}
                    className="flex-1 h-7 rounded-lg bg-secondary-container/60 hover:bg-secondary-container text-secondary text-[10px] font-black active:scale-95 transition-all disabled:opacity-30"
                  >
                    +{formatMontantCompact(amt)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* WhatsApp and WhatsApp template */}
          <div className="flex gap-2 border-t border-outline-variant/30 pt-2.5">
            <a
              href={getWhatsAppLink(selectedPoint.item.client_nom, selectedPoint.item.remaining)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 h-8 rounded-lg bg-green-500 hover:bg-green-600 text-white text-[10px] font-black flex items-center justify-center gap-1 active:scale-95 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">chat</span>
              Relance WhatsApp
            </a>
            <button
              onClick={() => {
                const text = `Bonjour ${selectedPoint.item.client_nom}, nous vous rappelons amicalement que le solde restant de votre ardoise chez Sama Boutik est de ${formatMontantCompact(selectedPoint.item.remaining)} FCFA. Merci !`;
                navigator.clipboard.writeText(text);
                if (onShowToast) {
                  onShowToast("Message de relance copié !", "success");
                } else {
                  console.log("Message de relance copié !");
                }
              }}
              className="px-2.5 h-8 rounded-lg border border-outline-variant text-[10px] font-black text-texte-2 hover:bg-surface-container active:scale-95 transition-all"
              title="Copier le texte de relance"
            >
              Copier texte
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-outline text-center font-medium py-1">
          💡 Touchez un client sur la courbe pour enregistrer un versement ou le relancer sur WhatsApp.
        </p>
      )}
    </div>
  );
};

interface ArdoiseProps {
  boutiqueId: string;
}

export const Ardoise: React.FC<ArdoiseProps> = ({ boutiqueId }) => {
  const [filter, setFilter] = useState<'all' | 'en_cours' | 'soldee'>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal / Sheet states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedArdoiseId, setSelectedArdoiseId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeMetricMenu, setActiveMetricMenu] = useState<'credits' | 'fiches' | null>(null);
  const [selectedChartClientId, setSelectedChartClientId] = useState<string | null>(null);
  const [criticalFilterActive, setCriticalFilterActive] = useState(false);
  const [showChart, setShowChart] = useState(false);

  // Form states — création
  const [newClientName, setNewClientName] = useState('');
  const [newInitialAmount, setNewInitialAmount] = useState('');

  // Form states — versement dans la fiche client
  const [paymentAmount, setPaymentAmount] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states — ajout de dette
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [addDebtAmount, setAddDebtAmount] = useState('');

  const ardoises = useLiveQuery(() => db.ardoises.toArray(), []) || [];
  const payments = useLiveQuery(() => db.ardoise_paiements.toArray(), []) || [];

  const handleSuccess = (msg: string) => {
    setToast({ message: msg, type: 'success' });
    // Ferme seulement le modal de création
    setIsCreateOpen(false);
    // Réinitialise tous les champs
    setNewClientName('');
    setNewInitialAmount('');
    setPaymentAmount('');
    setAddDebtAmount('');
    setShowAddDebt(false);
    // La fiche client (isDetailOpen) reste ouverte pour que le user voie la mise à jour
  };

  const { createArdoise, addPayment, addDebt } = useArdoise(
    handleSuccess,
    (msg) => setToast({ message: msg, type: 'error' })
  );

  const getPaidTotal = (ardoiseId: string) =>
    payments.filter((p) => p.ardoise_id === ardoiseId).reduce((sum, p) => sum + p.montant, 0);

  const processedArdoises = ardoises.map((a) => {
    const paid = getPaidTotal(a.id);
    const remaining = Math.max(0, a.montant_total - paid);
    return {
      ...a,
      paid,
      remaining,
      percent: a.montant_total > 0 ? Math.round((paid / a.montant_total) * 100) : 0,
    };
  });

  const filteredArdoises = processedArdoises.filter((a) => {
    const matchesFilter = filter === 'en_cours' ? a.statut === 'en_cours' : filter === 'soldee' ? a.statut === 'soldee' : true;
    if (!matchesFilter) return false;
    if (criticalFilterActive) return a.remaining > 10000;
    return true;
  });

  const totalRemainingCredit = processedArdoises.filter(a => a.statut === 'en_cours').reduce((sum, a) => sum + a.remaining, 0);
  const activeAccountsCount = processedArdoises.filter((a) => a.statut === 'en_cours').length;

  const selectedArdoise = processedArdoises.find((a) => a.id === selectedArdoiseId);
  const selectedPayments = payments
    .filter((p) => p.ardoise_id === selectedArdoiseId)
    .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());

  const openDetail = (id: string) => {
    setSelectedArdoiseId(id);
    setPaymentAmount('');
    setAddDebtAmount('');
    setShowAddDebt(false);
    setIsDetailOpen(true);
  };

  const handleExportGlobalReport = () => {
    const debtors = processedArdoises.filter(a => a.remaining > 0);
    if (debtors.length === 0) {
      setToast({ message: "Aucune dette en cours à exporter !", type: "error" });
      return;
    }
    const text = `Rapport des ardoises en cours (Boutique OS) :\n` +
      debtors.map(d => `- ${d.client_nom} : ${fmt(d.remaining)} FCFA`).join('\n') +
      `\nTotal dû : ${fmt(totalRemainingCredit)} FCFA`;
    navigator.clipboard.writeText(text);
    setToast({ message: "Rapport global copié dans le presse-papiers !", type: "success" });
  };

  const handleExportCSV = () => {
    if (processedArdoises.length === 0) {
      setToast({ message: "Aucune fiche à exporter !", type: "error" });
      return;
    }
    const headers = "Client;Statut;Montant Initial;Paye;Reste du\n";
    const rows = processedArdoises.map(a => 
      `"${a.client_nom.replace(/"/g, '""')}";${a.statut === 'soldee' ? 'Soldee' : 'En cours'};${a.montant_total};${a.paid};${a.remaining}`
    ).join('\n');
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(headers + rows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `ardoises_fiches_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ message: "Export CSV téléchargé !", type: "success" });
  };

  return (
    <div className="pb-40 pt-20 px-4 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="text-left mt-2">
        <h1 className="font-headline-lg-mobile text-on-surface">Carnet d'Ardoise</h1>
        <p className="font-body-md text-on-surface-variant">Suivez et encaissez les crédits clients en toute simplicité.</p>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scroll-hide">
        {([
          { id: 'all', label: 'Toutes' },
          { id: 'en_cours', label: 'En cours' },
          { id: 'soldee', label: 'Soldées' }
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-5 h-9 rounded-full font-label-md text-xs whitespace-nowrap active:scale-95 transition-all ${
              filter === tab.id
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white border border-outline-variant text-texte-2 hover:bg-surface-container-low'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div 
          onClick={() => {
            setSelectedChartClientId(null);
            setShowChart(true);
            setActiveMetricMenu('credits');
          }}
          className={`cursor-pointer border p-4 rounded-2xl text-left premium-shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30 active:scale-95 ${
            filter === 'en_cours'
              ? 'bg-primary-container/20 border-primary ring-2 ring-primary/20'
              : 'bg-white border-outline-variant'
          }`}
        >
          <p className="text-[10px] text-outline font-bold uppercase tracking-wider">Crédits En Cours</p>
          <MoneyText value={totalRemainingCredit} className="text-lg font-extrabold text-error" />
        </div>
        <div 
          onClick={() => {
            setSelectedChartClientId(null);
            setShowChart(true);
            setActiveMetricMenu('fiches');
          }}
          className={`cursor-pointer border p-4 rounded-2xl text-left premium-shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30 active:scale-95 ${
            filter === 'all'
              ? 'bg-primary-container/20 border-primary ring-2 ring-primary/20'
              : 'bg-white border-outline-variant'
          }`}
        >
          <p className="text-[10px] text-outline font-bold uppercase tracking-wider">Fiches Actives</p>
          <p className="text-lg font-extrabold text-primary font-numeric-display">{activeAccountsCount}</p>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {filteredArdoises.length === 0 ? (
          <p className="text-sm text-outline text-center py-10 bg-white rounded-2xl border border-outline-variant">
            Aucune ardoise trouvée.
          </p>
        ) : (
          filteredArdoises.map((a) => {
            const initials = a.client_nom.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
            const isSold = a.statut === 'soldee';

            return (
              <Card
                key={a.id}
                elevation={1}
                className={`flex flex-col gap-3 relative transition-all duration-200 hover:shadow-md hover:border-primary/20 ${isSold ? 'opacity-60 bg-surface-container-low/50' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${getAvatarGradient(a.client_nom)} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                      {initials}
                    </div>
                    <div className="text-left">
                      <h3 className="font-headline-sm text-sm text-on-surface leading-tight font-bold">{a.client_nom}</h3>
                      <span className="text-xs text-outline font-semibold">
                        {isSold ? 'Solde entièrement réglé' : `Remboursé à ${a.percent}%`}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    {isSold && <Badge variant="success">RÉGLÉ</Badge>}
                    <MoneyText value={a.remaining} className={`text-base font-bold ${isSold ? 'text-secondary' : 'text-error'}`} />
                    <p className="text-[10px] text-outline font-bold uppercase">Reste dû</p>
                  </div>
                </div>

                {!isSold && (
                  <div className="mt-1">
                    <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${a.percent < 30 ? 'bg-error' : a.percent < 70 ? 'bg-tertiary' : 'bg-secondary'}`}
                        style={{ width: `${a.percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-outline font-semibold mt-1">
                      <span>Versé : {fmt(a.paid)} FCFA</span>
                      <span>{a.percent}%</span>
                    </div>
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="md"
                  className="mt-1 w-full bg-surface-container/30 hover:bg-surface-container border border-outline-variant hover:border-outline text-xs"
                  onClick={() => openDetail(a.id)}
                >
                  <span className="material-symbols-outlined text-base mr-1">manage_accounts</span>
                  Gérer le compte client
                </Button>
              </Card>
            );
          })
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setIsCreateOpen(true)}
        className="fixed bottom-22 right-4 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
      >
        <span className="material-symbols-outlined text-[28px]">person_add</span>
      </button>

      {/* MODAL: Create Ardoise */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nouveau compte Ardoise">
        <div className="flex flex-col gap-4">
          <Input label="Nom du Client" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Nom complet..." />
          <Input label="Montant Initial Dû (FCFA)" type="number" value={newInitialAmount} onChange={(e) => setNewInitialAmount(e.target.value)} placeholder="Ex: 5000" />
          <Button onClick={() => createArdoise(boutiqueId, newClientName, parseFloat(newInitialAmount))} disabled={!newClientName || !newInitialAmount} className="w-full mt-2">
            CRÉER LA FICHE
          </Button>
        </div>
      </Modal>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* BOTTOM SHEET: Fiche Client — Versement + Historique + Ajout Dette       */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <BottomSheet
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={selectedArdoise ? selectedArdoise.client_nom : ''}
      >
        {selectedArdoise && (
          <div className="flex flex-col gap-5 text-left">

            {/* ── Résumé financier ── */}
            <div className={`rounded-2xl p-4 border ${selectedArdoise.statut === 'soldee' ? 'bg-secondary-container/40 border-secondary/20' : 'bg-primary-container/30 border-primary/10'}`}>
              <div className="grid grid-cols-3 gap-1 mb-3">
                <div>
                  <span className="text-[9px] text-outline font-bold uppercase tracking-wider block">Total ardoise</span>
                  <MoneyText value={selectedArdoise.montant_total} className="text-sm font-extrabold text-on-surface" />
                </div>
                <div className="text-center">
                  <span className="text-[9px] text-outline font-bold uppercase tracking-wider block">Déjà versé</span>
                  <MoneyText value={selectedArdoise.paid} className="text-sm font-extrabold text-secondary" />
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-outline font-bold uppercase tracking-wider block">Reste dû</span>
                  <MoneyText
                    value={selectedArdoise.remaining}
                    className={`text-sm font-extrabold ${selectedArdoise.statut === 'soldee' ? 'text-secondary' : 'text-error'}`}
                  />
                </div>
              </div>
              {/* Barre de progression */}
              <div className="h-2.5 bg-black/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    selectedArdoise.percent >= 100 ? 'bg-secondary' :
                    selectedArdoise.percent >= 50 ? 'bg-tertiary' : 'bg-error'
                  }`}
                  style={{ width: `${Math.min(selectedArdoise.percent, 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-outline font-semibold mt-1 block">
                {selectedArdoise.percent >= 100 ? '✅ Ardoise soldée' : `${selectedArdoise.percent}% remboursé`}
              </span>
            </div>

            {/* ── Lien de partage client ── */}
            {(() => {
              const effectiveToken = (selectedArdoise as any).access_token || `mock-token-${selectedArdoise.id}`;
              return (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">share</span>
                    <h4 className="text-xs text-on-surface font-extrabold uppercase tracking-wider">Lien client</h4>
                  </div>
                  <div className="flex gap-2 items-center bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-texte-2 font-medium flex-1 truncate">
                      {`${window.location.origin}/?token=${effectiveToken}`}
                    </p>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/?token=${effectiveToken}`;
                        navigator.clipboard.writeText(url).then(() => {
                          setCopiedId(selectedArdoise.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        });
                      }}
                      className="flex-shrink-0 flex items-center gap-1 px-2.5 h-7 bg-primary text-white text-[10px] font-black rounded-lg active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                        {copiedId === selectedArdoise.id ? 'check' : 'content_copy'}
                      </span>
                      {copiedId === selectedArdoise.id ? 'Copié !' : 'Copier'}
                    </button>
                  </div>
                  <p className="text-[10px] text-outline">Envoyez ce lien à votre client via WhatsApp ou SMS.</p>
                </div>
              );
            })()}

            {/* ── Section Versement ── visible uniquement si ardoise en cours */}
            {selectedArdoise.statut !== 'soldee' && (
              <div className="flex flex-col gap-3">
                {/* Titre section */}
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">payments</span>
                  <h4 className="text-xs text-on-surface font-extrabold uppercase tracking-wider">Enregistrer un versement</h4>
                </div>

                <Input
                  label={`Montant versé (FCFA) — Reste : ${fmt(selectedArdoise.remaining)} FCFA`}
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Saisir le montant..."
                />

                {/* Montants rapides */}
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-outline font-bold uppercase tracking-wider">Montants courants</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1000, 2000, 5000, 10000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setPaymentAmount(amt.toString())}
                        className={`h-8 border text-[10px] font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                          Number(paymentAmount) === amt
                            ? 'bg-secondary border-secondary text-white shadow-sm scale-95'
                            : 'border-outline-variant bg-white text-texte-2 hover:border-primary/30 hover:bg-primary-container/20'
                        }`}
                      >
                        {fmt(amt)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Raccourci "tout solder" */}
                {selectedArdoise.remaining > 0 && (
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(selectedArdoise.remaining.toString())}
                    className="flex items-center gap-1.5 text-[11px] text-secondary font-bold hover:opacity-80 transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    Solder tout : {fmt(selectedArdoise.remaining)} FCFA
                  </button>
                )}

                {/* Feedback rendu */}
                {paymentAmount && Number(paymentAmount) > 0 && (
                  <div className={`flex justify-between items-center rounded-xl px-3 py-2 border ${
                    Number(paymentAmount) <= selectedArdoise.remaining
                      ? 'bg-secondary-container/50 border-secondary-container text-secondary'
                      : 'bg-error-container/50 border-error-container text-error'
                  }`}>
                    <span className="text-[10px] font-extrabold uppercase tracking-wide">
                      {Number(paymentAmount) <= selectedArdoise.remaining ? 'Reste après versement :' : '⚠ Dépasse le solde'}
                    </span>
                    {Number(paymentAmount) <= selectedArdoise.remaining && (
                      <span className="text-sm font-black">
                        {fmt(Math.max(0, selectedArdoise.remaining - Number(paymentAmount)))} FCFA
                      </span>
                    )}
                  </div>
                )}

                <Button
                  onClick={() => addPayment(selectedArdoise.id, parseFloat(paymentAmount))}
                  disabled={!paymentAmount || Number(paymentAmount) <= 0 || Number(paymentAmount) > selectedArdoise.remaining}
                  className="w-full flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  CONFIRMER LE VERSEMENT
                </Button>
              </div>
            )}

            {/* ── Historique des versements ── */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline text-lg">history</span>
                <h4 className="text-xs text-outline font-extrabold uppercase tracking-wider">
                  Historique ({selectedPayments.length} versement{selectedPayments.length !== 1 ? 's' : ''})
                </h4>
              </div>
              {selectedPayments.length === 0 ? (
                <p className="text-sm text-outline italic text-center py-3 bg-surface-container/30 rounded-xl">
                  Aucun versement enregistré.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {selectedPayments.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center bg-secondary-container/20 border border-secondary-container/40 rounded-xl px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-outline font-bold bg-white rounded-full w-5 h-5 flex items-center justify-center border border-outline-variant">
                          {selectedPayments.length - idx}
                        </span>
                        <span className="text-xs text-outline font-medium">
                          {new Date(p.paid_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <MoneyText value={p.montant} className="text-sm font-extrabold text-secondary" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Ajouter une dette (achat à crédit supplémentaire) ── */}
            <div className="border-t border-outline-variant pt-4">
              {!showAddDebt ? (
                <button
                  type="button"
                  onClick={() => setShowAddDebt(true)}
                  className="flex items-center gap-2 text-xs text-error font-bold hover:opacity-80 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-base">add_circle</span>
                  Ajouter un nouvel achat à crédit
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-error text-lg">add_shopping_cart</span>
                    <h4 className="text-xs text-error font-extrabold uppercase tracking-wider">Nouvel achat à crédit</h4>
                  </div>
                  <Input
                    label="Montant à ajouter à l'ardoise (FCFA)"
                    type="number"
                    value={addDebtAmount}
                    onChange={(e) => setAddDebtAmount(e.target.value)}
                    placeholder="Ex: 3 500"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => { setShowAddDebt(false); setAddDebtAmount(''); }}
                      className="flex-1 text-xs border border-outline-variant"
                    >
                      Annuler
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => addDebt(selectedArdoise.id, parseFloat(addDebtAmount))}
                      disabled={!addDebtAmount || Number(addDebtAmount) <= 0}
                      className="flex-[2] text-xs"
                    >
                      <span className="material-symbols-outlined text-sm mr-1">add</span>
                      AJOUTER LA DETTE
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </BottomSheet>
      {/* Metrics Menu Bottom Sheet */}
      <BottomSheet
        isOpen={activeMetricMenu !== null}
        onClose={() => setActiveMetricMenu(null)}
        title={activeMetricMenu === 'credits' ? 'Options - Crédits En Cours' : 'Options - Fiches Actives'}
      >
        <div className="flex flex-col gap-3 text-left">
          {activeMetricMenu === 'credits' ? (
            <>
              {/* Toggle Graph Button */}
              <button
                type="button"
                onClick={() => setShowChart(!showChart)}
                className={`w-full text-left p-3.5 border rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer ${
                  showChart 
                    ? 'bg-primary-container/20 border-primary text-primary' 
                    : 'bg-primary-container/20 border-outline-variant/60 hover:bg-primary-container/30'
                }`}
              >
                <span className="material-symbols-outlined text-primary">show_chart</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">Graphique Interactif</span>
                  <span className="text-[10px] text-outline">Afficher la courbe de répartition des dettes en cours.</span>
                </div>
              </button>

              {/* Display Graph if showChart is true */}
              {showChart && (
                <div className="mt-1 animate-scale-in">
                  <ArdoiseInteractiveChart
                    items={processedArdoises.filter(a => a.statut === 'en_cours')}
                    type="credits"
                    onOpenDetail={(id) => {
                      setActiveMetricMenu(null);
                      openDetail(id);
                    }}
                    onAddPayment={async (id, amount) => {
                      await addPayment(id, amount);
                    }}
                    selectedId={selectedChartClientId}
                    setSelectedId={setSelectedChartClientId}
                    onShowToast={(msg, type) => setToast({ message: msg, type })}
                  />
                </div>
              )}

              {/* Critical Filter Button */}
              <button
                type="button"
                onClick={() => {
                  setCriticalFilterActive(!criticalFilterActive);
                }}
                className={`w-full text-left p-3.5 border rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer ${
                  criticalFilterActive 
                    ? 'bg-error-container/30 border-error text-error' 
                    : 'bg-primary-container/20 border-outline-variant/60 hover:bg-primary-container/30'
                }`}
              >
                <span className="material-symbols-outlined text-error">warning</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">
                    {criticalFilterActive ? "Désactiver le filtre critique" : "Filtrer les dettes critiques (> 10 000 FCFA)"}
                  </span>
                  <span className="text-[10px] text-outline">Isoler uniquement les clients avec des arriérés importants.</span>
                </div>
              </button>

              {/* Export Global Report Button */}
              <button
                type="button"
                onClick={handleExportGlobalReport}
                className="w-full text-left p-3.5 bg-primary-container/20 hover:bg-primary-container/30 border border-outline-variant/60 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary">share</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">Exporter le rapport global (Copier)</span>
                  <span className="text-[10px] text-outline">Copier le récapitulatif de tous les clients débiteurs.</span>
                </div>
              </button>

              {/* Filter List to en_cours */}
              <button
                type="button"
                onClick={() => {
                  setFilter('en_cours');
                  setActiveMetricMenu(null);
                }}
                className="w-full text-left p-3.5 bg-primary-container/20 hover:bg-primary-container/30 border border-outline-variant/60 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary">filter_alt</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">Filtrer la liste</span>
                  <span className="text-[10px] text-outline">Afficher uniquement les comptes avec des dettes en cours dans l'ardoise principale.</span>
                </div>
              </button>

              {/* Nouveau compte Ardoise */}
              <button
                type="button"
                onClick={() => {
                  setActiveMetricMenu(null);
                  setIsCreateOpen(true);
                }}
                className="w-full text-left p-3.5 bg-primary-container/20 hover:bg-primary-container/30 border border-outline-variant/60 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary">person_add</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">Nouveau compte Ardoise</span>
                  <span className="text-[10px] text-outline">Ouvrir un nouveau carnet d'ardoise pour un client.</span>
                </div>
              </button>
            </>
          ) : (
            <>
              {/* Toggle Graph Button */}
              <button
                type="button"
                onClick={() => setShowChart(!showChart)}
                className={`w-full text-left p-3.5 border rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer ${
                  showChart 
                    ? 'bg-primary-container/20 border-primary text-primary' 
                    : 'bg-primary-container/20 border-outline-variant/60 hover:bg-primary-container/30'
                }`}
              >
                <span className="material-symbols-outlined text-primary">show_chart</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">Graphique Interactif</span>
                  <span className="text-[10px] text-outline">Afficher la courbe des volumes de crédits totaux octroyés.</span>
                </div>
              </button>

              {/* Display Graph if showChart is true */}
              {showChart && (
                <div className="mt-1 animate-scale-in">
                  <ArdoiseInteractiveChart
                    items={processedArdoises}
                    type="fiches"
                    onOpenDetail={(id) => {
                      setActiveMetricMenu(null);
                      openDetail(id);
                    }}
                    onAddPayment={async (id, amount) => {
                      await addPayment(id, amount);
                    }}
                    selectedId={selectedChartClientId}
                    setSelectedId={setSelectedChartClientId}
                    onShowToast={(msg, type) => setToast({ message: msg, type })}
                  />
                </div>
              )}

              {/* Statistics & Distribution summary card */}
              <div className="w-full p-4 bg-surface-container border border-outline-variant/50 rounded-xl flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase text-outline tracking-wider">Statistiques des Fiches</span>
                <div className="grid grid-cols-3 gap-2 text-center mt-1">
                  <div className="bg-white p-2 rounded-lg border border-outline-variant/40">
                    <span className="text-[9px] text-outline block font-medium">Total clients</span>
                    <span className="text-xs font-black text-on-surface">{processedArdoises.length}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-outline-variant/40">
                    <span className="text-[9px] text-outline block font-medium">Taux de solde</span>
                    <span className="text-xs font-black text-secondary">
                      {processedArdoises.length > 0 ? Math.round((processedArdoises.filter(a => a.statut === 'soldee').length / processedArdoises.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-outline-variant/40">
                    <span className="text-[9px] text-outline block font-medium">Moy. Dette</span>
                    <span className="text-xs font-black text-error">
                      {activeAccountsCount > 0 ? fmt(Math.round(totalRemainingCredit / activeAccountsCount)) : 0} F
                    </span>
                  </div>
                </div>
              </div>

              {/* Export CSV Button */}
              <button
                type="button"
                onClick={handleExportCSV}
                className="w-full text-left p-3.5 bg-primary-container/20 hover:bg-primary-container/30 border border-outline-variant/60 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary">download</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">Exporter au format Excel (CSV)</span>
                  <span className="text-[10px] text-outline">Télécharger la base des fiches d'ardoise clients.</span>
                </div>
              </button>

              {/* Afficher tous les comptes */}
              <button
                type="button"
                onClick={() => {
                  setFilter('all');
                  setActiveMetricMenu(null);
                }}
                className="w-full text-left p-3.5 bg-primary-container/20 hover:bg-primary-container/30 border border-outline-variant/60 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary">group</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">Afficher tous les comptes</span>
                  <span className="text-[10px] text-outline">Montrer toutes les fiches (en cours et soldées).</span>
                </div>
              </button>

              {/* Nouveau compte Ardoise */}
              <button
                type="button"
                onClick={() => {
                  setActiveMetricMenu(null);
                  setIsCreateOpen(true);
                }}
                className="w-full text-left p-3.5 bg-primary-container/20 hover:bg-primary-container/30 border border-outline-variant/60 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary">person_add</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">Nouveau compte Ardoise</span>
                  <span className="text-[10px] text-outline">Ouvrir un nouveau carnet d'ardoise pour un client.</span>
                </div>
              </button>
            </>
          )}
        </div>
      </BottomSheet>
    </div>
  );
};
export default Ardoise;
