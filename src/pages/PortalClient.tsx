import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexie';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { MoneyText } from '../components/ui/MoneyText';

export const PortalClient: React.FC = () => {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch all ardoises and payments
  const ardoises = useLiveQuery(() => db.ardoises.toArray(), []) || [];
  const payments = useLiveQuery(() => db.ardoise_paiements.toArray(), []) || [];

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

  // Filter ardoises by search query
  const filteredClients = processedArdoises.filter(a => 
    a.client_nom.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedClient = processedArdoises.find(a => a.id === selectedClientId);
  const selectedPayments = payments
    .filter(p => p.ardoise_id === selectedClientId)
    .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());

  // Badge dynamic logic based on repayment
  const getRepaymentBadge = (percent: number) => {
    if (percent === 100) return { label: 'Entièrement Libéré 🎉', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    if (percent >= 75) return { label: 'Excellent Payeur ⭐', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
    if (percent >= 50) return { label: 'Bon Rythme 👍', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' };
    if (percent >= 25) return { label: 'En Cours de Règlement 🕒', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    return { label: 'Début de Remboursement 🌱', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
  };

  const handleDownloadReceipt = () => {
    if (!selectedClient) return;
    const text = `==================================\n` +
                 `      REÇU DE COMPTE - BOUTIKOS   \n` +
                 `==================================\n` +
                 `Client : ${selectedClient.client_nom}\n` +
                 `Date : ${new Date().toLocaleDateString('fr-FR')}\n\n` +
                 `Statut : ${selectedClient.statut === 'soldee' ? 'SOLDÉ' : 'EN COURS'}\n` +
                 `Crédit Initial : ${new Intl.NumberFormat('fr-FR').format(selectedClient.montant_total)} FCFA\n` +
                 `Total Versé    : ${new Intl.NumberFormat('fr-FR').format(selectedClient.paid)} FCFA\n` +
                 `Reste à Payer  : ${new Intl.NumberFormat('fr-FR').format(selectedClient.remaining)} FCFA\n` +
                 `Remboursé à    : ${selectedClient.percent}%\n` +
                 `==================================\n` +
                 `Merci pour votre confiance !`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `recu_ardoise_${selectedClient.client_nom.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="pb-40 pt-20 px-4 max-w-lg mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="text-left mt-2">
        <h1 className="font-headline-lg-mobile text-on-surface">Espace Client Ardoise</h1>
        <p className="font-body-md text-on-surface-variant">Consultez l'état de votre compte en toute transparence.</p>
      </div>

      {!selectedClient ? (
        <Card className="flex flex-col gap-4 p-5 bg-surface-container/50 border border-outline-variant/60">
          <div className="text-left">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-outline mb-1">Rechercher mon compte</h2>
            <p className="text-[11px] text-outline mb-4">Saisissez votre nom pour accéder à votre historique de crédit.</p>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher votre nom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 px-4 text-xs bg-white border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface placeholder:text-outline/70"
            />
            <span className="material-symbols-outlined absolute right-3.5 top-3 text-outline text-lg">search</span>
          </div>

          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto mt-2">
            {filteredClients.length === 0 ? (
              <p className="text-xs text-outline italic text-center py-4">Aucun client trouvé.</p>
            ) : (
              filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className="w-full p-3 bg-white hover:bg-primary-container/20 border border-outline-variant/60 rounded-xl flex items-center justify-between transition-all active:scale-[0.99] text-left cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-on-surface">{client.client_nom}</span>
                    <span className="text-[10px] text-outline">Mis à jour le {new Date(client.updated_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-right">
                    <MoneyText value={client.remaining} className="text-xs font-extrabold text-error" />
                    <span className="text-[8px] text-outline uppercase block font-bold">Reste dû</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-5 animate-scale-in">
          {/* Back button */}
          <button
            onClick={() => { setSelectedClientId(''); setSearchQuery(''); }}
            className="flex items-center gap-1 text-[11px] text-primary font-black uppercase tracking-wider self-start active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-sm font-bold">arrow_back</span>
            Changer de client
          </button>

          {/* Premium Client Dashboard Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary-container text-white p-6 rounded-3xl shadow-lg border border-white/5 flex flex-col gap-4 text-left">
            {/* Ambient glows */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-secondary rounded-full filter blur-2xl opacity-30" />
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-primary-container rounded-full filter blur-2xl opacity-20" />

            <div className="flex justify-between items-start z-10">
              <div className="flex flex-col">
                <span className="text-[9px] opacity-75 font-black tracking-widest uppercase">Espace Client</span>
                <h2 className="text-lg font-black tracking-tight mt-0.5">{selectedClient.client_nom}</h2>
              </div>
              {(() => {
                const b = getRepaymentBadge(selectedClient.percent);
                return (
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black border ${b.color}`}>
                    {b.label}
                  </span>
                );
              })()}
            </div>

            <div className="mt-2 z-10">
              <span className="text-[10px] opacity-75 font-bold uppercase tracking-wider block">Solde Restant Dû</span>
              <MoneyText value={selectedClient.remaining} className="text-3xl font-black text-white font-numeric-display" />
            </div>

            {/* Repayment progress */}
            <div className="flex flex-col gap-1.5 mt-2 z-10">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="opacity-80">Remboursé à {selectedClient.percent}%</span>
                <span className="opacity-80">{new Intl.NumberFormat('fr-FR').format(selectedClient.paid)} / {new Intl.NumberFormat('fr-FR').format(selectedClient.montant_total)} FCFA</span>
              </div>
              <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-secondary rounded-full transition-all duration-700"
                  style={{ width: `${selectedClient.percent}%` }}
                />
              </div>
            </div>

            <p className="text-[10px] opacity-70 italic leading-relaxed border-t border-white/10 pt-3 mt-1 z-10">
              {selectedClient.remaining > 0 
                ? "💡 Merci d'effectuer vos règlements régulièrement pour maintenir votre crédit disponible."
                : "🎉 Félicitations ! Votre compte est entièrement libre de dettes."
              }
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDownloadReceipt}
              className="h-10 bg-white border border-outline-variant hover:bg-surface-container rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-[0.97]"
            >
              <span className="material-symbols-outlined text-base">download</span>
              Télécharger Reçu
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Bonjour, je consulte mon ardoise sur BoutikOS. Solde restant dû : ${new Intl.NumberFormat('fr-FR').format(selectedClient.remaining)} FCFA.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 bg-green-500 hover:bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-[0.97]"
            >
              <span className="material-symbols-outlined text-base">chat</span>
              Contacter Boutique
            </a>
          </div>

          {/* Payment History */}
          <div className="flex flex-col gap-3 text-left">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-outline">Historique de vos Versements</h3>
            {selectedPayments.length === 0 ? (
              <p className="text-xs text-outline italic text-center py-6 bg-surface-container/20 rounded-xl border border-outline-variant/40">
                Aucun versement n'a encore été enregistré sur cette fiche.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedPayments.map((payment, index) => (
                  <div
                    key={payment.id}
                    className="p-3 bg-white border border-outline-variant/60 rounded-xl flex items-center justify-between shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-secondary-container text-secondary flex items-center justify-center font-bold text-[10px]">
                        #{selectedPayments.length - index}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-on-surface">Versement Reçu</span>
                        <span className="text-[9px] text-outline">
                          {new Date(payment.paid_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <MoneyText value={payment.montant} className="text-xs font-black text-secondary" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Publicité / Ads Placeholder */}
          <div className="mt-6 p-4 rounded-2xl bg-surface-container/30 border border-dashed border-outline-variant flex flex-col items-center justify-center gap-2 text-center text-outline">
            <span className="text-[9px] font-black uppercase tracking-widest bg-outline/10 px-2 py-0.5 rounded text-outline-variant">Sponsorisé / Publicité</span>
            <div className="w-full h-20 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 flex items-center justify-center border border-outline-variant/40">
              <p className="text-[10px] italic">Espace publicitaire réservé (Configuration en attente du nom de domaine)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
