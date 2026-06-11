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

export const Ardoise: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'en_cours' | 'soldee'>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedArdoiseId, setSelectedArdoiseId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  // Form states
  const [newClientName, setNewClientName] = useState('');
  const [newInitialAmount, setNewInitialAmount] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');

  // Seed DB if empty
  useEffect(() => {
    const seed = async () => {
      const count = await db.ardoises.count();
      if (count === 0) {
        await db.ardoises.bulkAdd(SEED_ARDOISES);
        await db.ardoise_paiements.bulkAdd(SEED_PAYMENTS);
      }
    };
    seed();
  }, []);

  // Fetch ardoises & payments
  const ardoises = useLiveQuery(() => db.ardoises.toArray(), []) || [];
  const payments = useLiveQuery(() => db.ardoise_paiements.toArray(), []) || [];

  // SUCCESS / ERROR callbacks
  const handleSuccess = (msg: string) => {
    setToast({ message: msg, type: 'success' });
    setIsCreateOpen(false);
    setIsPaymentOpen(false);
    setNewClientName('');
    setNewInitialAmount('');
    setPaymentAmount('');
  };

  const handleError = (msg: string) => {
    setToast({ message: msg, type: 'error' });
  };

  const { createArdoise, addPayment } = useArdoise(handleSuccess, handleError);

  // Helper: Get payments total for an ardoise
  const getPaidTotal = (ardoiseId: string) => {
    return payments
      .filter((p) => p.ardoise_id === ardoiseId)
      .reduce((sum, p) => sum + p.montant, 0);
  };

  // Helper: Deterministic avatar color (tertiary/teal/ochre - never red)
  const getAvatarColor = (name: string) => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = ['bg-primary', 'bg-tertiary-container', 'bg-secondary', 'bg-[#007239]'];
    return colors[hash % colors.length];
  };

  // Process data for rendering
  const processedArdoises = ardoises.map((a) => {
    const paid = getPaidTotal(a.id);
    const remaining = Math.max(0, a.montant_total - paid);
    const percent = a.montant_total > 0 ? Math.round((paid / a.montant_total) * 100) : 0;
    return {
      ...a,
      paid,
      remaining,
      percent,
    };
  });

  // Filter & Sort
  const filteredArdoises = processedArdoises.filter((a) => {
    if (filter === 'en_cours') return a.statut === 'en_cours';
    if (filter === 'soldee') return a.statut === 'soldee';
    return true;
  });

  // Stats
  const activeAccountsCount = processedArdoises.filter(a => a.statut === 'en_cours').length;
  const totalRemainingCredit = processedArdoises.reduce((sum, a) => sum + a.remaining, 0);

  const selectedArdoise = processedArdoises.find(a => a.id === selectedArdoiseId);
  const selectedPayments = payments.filter(p => p.ardoise_id === selectedArdoiseId);

  return (
    <div className="pb-40 pt-16 px-margin-mobile max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto flex flex-col gap-md">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Screen Title */}
      <div className="text-left mt-sm">
        <h1 className="font-headline-lg-mobile text-on-surface">Gestion de l'Ardoise</h1>
        <p className="font-body-md text-on-surface-variant">Suivi des crédits clients en temps réel.</p>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-sm overflow-x-auto pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`px-lg h-10 rounded-full font-label-md text-label-md whitespace-nowrap active:scale-95 transition-all ${
            filter === 'all' ? 'bg-primary-container text-on-primary-container' : 'border border-outline text-on-surface-variant'
          }`}
        >
          Toutes
        </button>
        <button
          onClick={() => setFilter('en_cours')}
          className={`px-lg h-10 rounded-full font-label-md text-label-md whitespace-nowrap active:scale-95 transition-all ${
            filter === 'en_cours' ? 'bg-primary-container text-on-primary-container' : 'border border-outline text-on-surface-variant'
          }`}
        >
          En cours
        </button>
        <button
          onClick={() => setFilter('soldee')}
          className={`px-lg h-10 rounded-full font-label-md text-label-md whitespace-nowrap active:scale-95 transition-all ${
            filter === 'soldee' ? 'bg-primary-container text-on-primary-container' : 'border border-outline text-on-surface-variant'
          }`}
        >
          Soldées
        </button>
      </div>

      {/* Ardoise Cards List */}
      <div className="flex flex-col gap-md">
        {filteredArdoises.map((a) => {
          const initials = a.client_nom.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
          const isSold = a.statut === 'soldee';

          return (
            <Card
              key={a.id}
              elevation={1}
              className={`flex flex-col gap-sm relative ${isSold ? 'opacity-70 bg-surface-container-low' : ''}`}
            >
              {isSold && (
                <div className="absolute top-md right-md">
                  <Badge variant="success">SOLDÉE</Badge>
                </div>
              )}
              
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-md">
                  <div className={`w-[44px] h-[44px] rounded-full ${getAvatarColor(a.client_nom)} flex items-center justify-center text-white font-headline-sm`}>
                    {initials}
                  </div>
                  <div className="text-left">
                    <h3 className="font-headline-sm text-on-surface leading-tight">{a.client_nom}</h3>
                    <span className="font-label-md text-label-md text-on-surface-variant">
                      {isSold ? 'Solde réglé' : `Remboursé à ${a.percent}%`}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <MoneyText value={a.remaining} className={`text-lg font-bold ${isSold ? 'text-secondary' : 'text-error'}`} />
                  <p className="font-label-md text-label-md text-on-surface-variant">Reste à payer</p>
                </div>
              </div>

              {!isSold && (
                <div className="mt-xs">
                  <div className="h-1 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className={`h-full progress-bar-fill ${a.percent < 30 ? 'bg-error' : 'bg-secondary'}`}
                      style={{ width: `${a.percent}%` }}
                    />
                  </div>
                </div>
              )}

              <Button
                variant="ghost"
                size="md"
                className="mt-xs w-full"
                onClick={() => {
                  setSelectedArdoiseId(a.id);
                  setIsDetailOpen(true);
                }}
              >
                Détails du compte
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Mini Stats Summary */}
      <div className="grid grid-cols-2 gap-md">
        <div className="bg-surface-container p-md rounded-xl text-left">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase">Total Crédits</p>
          <MoneyText value={totalRemainingCredit} className="text-lg font-bold text-error" />
        </div>
        <div className="bg-surface-container p-md rounded-xl text-left">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase">Comptes Actifs</p>
          <p className="font-headline-sm text-headline-sm text-primary">{activeAccountsCount}</p>
        </div>
      </div>

      {/* Add New Credit FAB */}
      <button
        onClick={() => setIsCreateOpen(true)}
        className="fixed bottom-20 right-margin-mobile w-14 h-14 bg-primary-container text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-all z-40"
      >
        <span className="material-symbols-outlined text-[28px]">person_add</span>
      </button>

      {/* MODAL: Create New Ardoise */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Créer un compte Ardoise"
      >
        <div className="flex flex-col gap-md">
          <Input
            label="Nom du Client"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            placeholder="Nom complet..."
          />
          <Input
            label="Montant Initial Dû (FCFA)"
            type="number"
            value={newInitialAmount}
            onChange={(e) => setNewInitialAmount(e.target.value)}
            placeholder="Ex: 5000"
          />
          <Button
            onClick={() => createArdoise('boutique-1', newClientName, parseFloat(newInitialAmount))}
            disabled={!newClientName || !newInitialAmount}
            className="w-full mt-sm"
          >
            CRÉER L'ARDOISE
          </Button>
        </div>
      </Modal>

      {/* BOTTOM SHEET: Details & Payment History */}
      <BottomSheet
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={selectedArdoise ? `Compte de ${selectedArdoise.client_nom}` : ''}
      >
        {selectedArdoise && (
          <div className="flex flex-col gap-md text-left">
            <div className="flex justify-between items-center bg-surface-container p-md rounded-xl">
              <div>
                <span className="text-[10px] text-outline font-bold">CRÉDIT TOTAL</span>
                <p className="font-headline-sm"><MoneyText value={selectedArdoise.montant_total} /></p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-outline font-bold">RESTE À PAYER</span>
                <p className="font-headline-sm text-error"><MoneyText value={selectedArdoise.remaining} /></p>
              </div>
            </div>

            {/* Payments History */}
            <div>
              <h4 className="font-label-md text-label-md text-outline mb-sm uppercase">Historique des Paiements</h4>
              {selectedPayments.length === 0 ? (
                <p className="text-sm text-outline">Aucun paiement enregistré.</p>
              ) : (
                <div className="flex flex-col gap-sm max-h-40 overflow-y-auto">
                  {selectedPayments.map((p) => (
                    <div key={p.id} className="flex justify-between items-center border-b border-border pb-xs">
                      <span className="text-xs text-outline">{new Date(p.paid_at).toLocaleDateString('fr-FR')}</span>
                      <MoneyText value={p.montant} className="text-sm font-bold text-secondary" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedArdoise.statut !== 'soldee' && (
              <Button
                onClick={() => {
                  setIsDetailOpen(false);
                  setIsPaymentOpen(true);
                }}
                className="w-full mt-sm"
              >
                ENREGISTRER UN PAIEMENT
              </Button>
            )}
          </div>
        )}
      </BottomSheet>

      {/* MODAL: Record Payment */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        title="Enregistrer un paiement"
      >
        {selectedArdoise && (
          <div className="flex flex-col gap-md text-left">
            <div className="mb-sm">
              <span className="text-xs text-outline">Solde restant :</span>
              <p className="text-lg font-bold text-error"><MoneyText value={selectedArdoise.remaining} /></p>
            </div>
            <Input
              label="Montant du Paiement (FCFA)"
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Ex: 2000"
            />
            <Button
              onClick={() => addPayment(selectedArdoise.id, parseFloat(paymentAmount))}
              disabled={!paymentAmount}
              className="w-full mt-sm"
            >
              CONFIRMER LE PAIEMENT
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};
export default Ardoise;
