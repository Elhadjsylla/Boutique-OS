import React, { useState, useEffect } from 'react';
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

const SEED_ARDOISES = [
  { id: 'a1b9d6bc-bbfd-4b2d-9b5d-ab8dfbbd4be1', boutique_id: 'boutique-1', client_nom: 'Moussa Keita', montant_total: 22000, statut: 'en_cours' as const, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'a2b9d6bc-bbfd-4b2d-9b5d-ab8dfbbd4be2', boutique_id: 'boutique-1', client_nom: 'Amina Diallo', montant_total: 48000, statut: 'en_cours' as const, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'a3b9d6bc-bbfd-4b2d-9b5d-ab8dfbbd4be3', boutique_id: 'boutique-1', client_nom: 'Bakary Traoré', montant_total: 15000, statut: 'soldee' as const, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const SEED_PAYMENTS = [
  { id: 'p1b9d6bc-bbfd-4b2d-9b5d-ab8dfbbd4be1', ardoise_id: 'a1b9d6bc-bbfd-4b2d-9b5d-ab8dfbbd4be1', montant: 9500, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p2b9d6bc-bbfd-4b2d-9b5d-ab8dfbbd4be2', ardoise_id: 'a2b9d6bc-bbfd-4b2d-9b5d-ab8dfbbd4be2', montant: 6000, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p3b9d6bc-bbfd-4b2d-9b5d-ab8dfbbd4be3', ardoise_id: 'a3b9d6bc-bbfd-4b2d-9b5d-ab8dfbbd4be3', montant: 15000, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

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

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

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

  // Form states — création
  const [newClientName, setNewClientName] = useState('');
  const [newInitialAmount, setNewInitialAmount] = useState('');

  // Form states — versement dans la fiche client
  const [paymentAmount, setPaymentAmount] = useState('');

  // Form states — ajout de dette
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [addDebtAmount, setAddDebtAmount] = useState('');

  useEffect(() => {
    const seed = async () => {
      if ((await db.ardoises.count()) === 0) {
        await db.ardoises.bulkAdd(SEED_ARDOISES);
        await db.ardoise_paiements.bulkAdd(SEED_PAYMENTS);
      }
    };
    seed();
  }, []);

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
    if (filter === 'en_cours') return a.statut === 'en_cours';
    if (filter === 'soldee') return a.statut === 'soldee';
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
        <div className="bg-white border border-outline-variant p-4 rounded-2xl text-left premium-shadow-sm">
          <p className="text-[10px] text-outline font-bold uppercase tracking-wider">Crédits En Cours</p>
          <MoneyText value={totalRemainingCredit} className="text-lg font-extrabold text-error" />
        </div>
        <div className="bg-white border border-outline-variant p-4 rounded-2xl text-left premium-shadow-sm">
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
                {isSold && (
                  <div className="absolute top-4 right-4">
                    <Badge variant="success">REGLÉ</Badge>
                  </div>
                )}

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
                  <div className="text-right">
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
    </div>
  );
};
export default Ardoise;
