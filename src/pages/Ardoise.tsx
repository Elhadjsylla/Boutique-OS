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
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  // Form states
  const [newClientName, setNewClientName] = useState('');
  const [newInitialAmount, setNewInitialAmount] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');

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
    setIsCreateOpen(false);
    setIsPaymentOpen(false);
    setNewClientName('');
    setNewInitialAmount('');
    setPaymentAmount('');
  };

  const { createArdoise, addPayment } = useArdoise(handleSuccess, (msg) => setToast({ message: msg, type: 'error' }));

  const getPaidTotal = (ardoiseId: string) => payments.filter((p) => p.ardoise_id === ardoiseId).reduce((sum, p) => sum + p.montant, 0);

  const processedArdoises = ardoises.map((a) => {
    const paid = getPaidTotal(a.id);
    const remaining = Math.max(0, a.montant_total - paid);
    return { ...a, paid, remaining, percent: a.montant_total > 0 ? Math.round((paid / a.montant_total) * 100) : 0 };
  });

  const filteredArdoises = processedArdoises.filter((a) => {
    if (filter === 'en_cours') return a.statut === 'en_cours';
    if (filter === 'soldee') return a.statut === 'soldee';
    return true;
  });

  const totalRemainingCredit = processedArdoises.reduce((sum, a) => sum + a.remaining, 0);
  const activeAccountsCount = processedArdoises.filter(a => a.statut === 'en_cours').length;

  const selectedArdoise = processedArdoises.find(a => a.id === selectedArdoiseId);
  const selectedPayments = payments.filter(p => p.ardoise_id === selectedArdoiseId);

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

      {/* List */}
      <div className="flex flex-col gap-3">
        {filteredArdoises.map((a) => {
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
                  <Badge variant="success">REGLE</Badge>
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
                  <p className="text-[10px] text-outline font-bold uppercase">Reste</p>
                </div>
              </div>

              {!isSold && (
                <div className="mt-1">
                  <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${a.percent < 30 ? 'bg-error' : 'bg-secondary'}`}
                      style={{ width: `${a.percent}%` }}
                    />
                  </div>
                </div>
              )}

              <Button
                variant="ghost"
                size="md"
                className="mt-1 w-full bg-surface-container/30 hover:bg-surface-container border border-outline-variant hover:border-outline text-xs"
                onClick={() => {
                  setSelectedArdoiseId(a.id);
                  setIsDetailOpen(true);
                }}
              >
                Gérer le compte client
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-outline-variant p-4 rounded-2xl text-left premium-shadow-sm">
          <p className="text-[10px] text-outline font-bold uppercase tracking-wider">Crédits En Cours</p>
          <MoneyText value={totalRemainingCredit} className="text-lg font-extrabold text-error" />
        </div>
        <div className="bg-white border border-outline-variant p-4 rounded-2xl text-left premium-shadow-sm">
          <p className="text-[10px] text-outline font-bold uppercase tracking-wider">Fiches Actives</p>
          <p className="text-lg font-extrabold text-primary font-numeric-display">{activeAccountsCount}</p>
        </div>
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

      {/* BOTTOM SHEET: Details & Payment History */}
      <BottomSheet isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title={selectedArdoise ? `Détails : ${selectedArdoise.client_nom}` : ''}>
        {selectedArdoise && (
          <div className="flex flex-col gap-4 text-left">
            <div className="flex justify-between items-center bg-surface-container/50 p-4 rounded-2xl border border-outline-variant">
              <div>
                <span className="text-[10px] text-outline font-bold uppercase">Crédit Initial</span>
                <p className="text-base font-bold text-on-surface"><MoneyText value={selectedArdoise.montant_total} /></p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-outline font-bold uppercase">Reste Dû</span>
                <p className="text-base font-bold text-error"><MoneyText value={selectedArdoise.remaining} /></p>
              </div>
            </div>

            <div>
              <h4 className="text-xs text-outline mb-2 font-bold uppercase tracking-wider">Historique de remboursement</h4>
              {selectedPayments.length === 0 ? (
                <p className="text-sm text-outline italic">Aucun paiement enregistré.</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                  {selectedPayments.map((p) => (
                    <div key={p.id} className="flex justify-between items-center border-b border-outline-variant pb-2">
                      <span className="text-xs text-outline font-medium">{new Date(p.paid_at).toLocaleDateString('fr-FR')}</span>
                      <MoneyText value={p.montant} className="text-sm font-bold text-secondary" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedArdoise.statut !== 'soldee' && (
              <Button onClick={() => { setIsDetailOpen(false); setIsPaymentOpen(true); }} className="w-full mt-2">
                ENREGISTRER UN REMBOURSEMENT
              </Button>
            )}
          </div>
        )}
      </BottomSheet>

      {/* MODAL: Record Payment */}
      <Modal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} title="Enregistrer un remboursement">
        {selectedArdoise && (
          <div className="flex flex-col gap-4 text-left">
            <div className="bg-red-50 p-3.5 rounded-xl border border-red-100">
              <span className="text-xs text-error font-bold uppercase">Solde restant à régler :</span>
              <p className="text-xl font-extrabold text-error"><MoneyText value={selectedArdoise.remaining} /></p>
            </div>
            <Input label="Montant du remboursement (FCFA)" type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Ex: 2000" />
            <Button onClick={() => addPayment(selectedArdoise.id, parseFloat(paymentAmount))} disabled={!paymentAmount} className="w-full mt-2">
              CONFIRMER LE PAIEMENT
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};
export default Ardoise;
