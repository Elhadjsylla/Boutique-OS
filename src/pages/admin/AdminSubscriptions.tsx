import React, { useState, useEffect } from 'react';

import { Select } from '../../components/ui/Select';
import { MaskedValue } from '../../components/admin/MaskedValue';
import { useRevealUser } from '../../hooks/useRevealUser';
import { callRpcWithRetry } from '../../lib/supabase-rpc';

interface SubscriptionEntry {
  id: string;
  user_id: string;
  plan: 'starter' | 'pro' | 'annual';
  status: string;
  payment_method: string | null;
  amount: number | null;
  starts_at: string;
  expires_at: string;
  created_at: string;
  email_masque?: string;
}

export const AdminSubscriptions: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<SubscriptionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Subscription State
  const [editingSub, setEditingSub] = useState<SubscriptionEntry | null>(null);
  const [newPlan, setNewPlan] = useState<'starter' | 'pro' | 'annual'>('starter');
  const [newExpiresAt, setNewExpiresAt] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  // Reveal State
  const { revealStates, revealedDetails, handleReveal } = useRevealUser();

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const { data, error } = await callRpcWithRetry('get_subscriptions_list_masked');
      if (error) throw error;
      setSubscriptions(data || []);
      setIsDemo(false);
    } catch (e: any) {
      console.error("[AdminSubscriptions] Erreur fetch:", e?.message ?? e);
      setSubscriptions([]);
      setIsDemo(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleOpenEdit = (sub: SubscriptionEntry) => {
    setEditingSub(sub);
    setNewPlan(sub.plan);
    setNewExpiresAt(new Date(sub.expires_at).toISOString().slice(0, 16));
  };

  const handleUpdateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub) return;

    setIsUpdating(true);
    try {
      const formattedDate = new Date(newExpiresAt).toISOString();
      const { error } = await callRpcWithRetry('sys_update_subscription', {
        target_user: editingSub.user_id,
        new_plan: newPlan,
        new_expires_at: formattedDate
      });
      if (error) throw error;

      setEditingSub(null);
      fetchSubscriptions();
    } catch (err: any) {
      alert("Erreur lors de la modification de l'abonnement : " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-left">
      <div>
        <h1 className="text-xl font-black text-admin-text uppercase tracking-wider">Gestion Abonnements</h1>
        <p className="text-xs text-admin-text-muted">Consultez l'historique et modifiez manuellement les formules d'abonnements.</p>
      </div>

      {isDemo && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined text-amber-400 text-lg">science</span>
          <div className="flex flex-col">
            <span className="text-xs font-black text-amber-300 uppercase tracking-wider">Mode Démo</span>
            <span className="text-[10px] text-amber-400/80">Données fictives. Les migrations backend ne sont pas encore déployées.</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col justify-center items-center py-20 text-admin-text-muted">
          <div className="w-10 h-10 border-4 border-admin-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-admin-card border border-admin-border rounded-2xl p-4 overflow-x-auto shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-admin-border text-admin-text-muted uppercase tracking-wider">
                <th className="py-3 px-4 font-black">ID Abonnement</th>
                <th className="py-3 px-4 font-black">User ID</th>
                <th className="py-3 px-4 font-black">Email</th>
                <th className="py-3 px-4 font-black">Formule</th>
                <th className="py-3 px-4 font-black">Statut</th>
                <th className="py-3 px-4 font-black">Montant</th>
                <th className="py-3 px-4 font-black">Expiration</th>
                <th className="py-3 px-4 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map(s => {
                const isExpired = new Date(s.expires_at) < new Date();
                const isActive = s.status === 'active' && !isExpired;

                return (
                  <tr key={s.id} className="border-b border-admin-border/50 hover:bg-admin-surface/20 text-admin-text">
                    <td className="py-3 px-4 font-mono truncate max-w-[100px]" title={s.id}>
                      {s.id}
                    </td>
                    <td className="py-3 px-4 font-mono truncate max-w-[100px]" title={s.user_id}>
                      {s.user_id}
                    </td>
                    <td className="py-3 px-4 truncate max-w-[180px]">
                      <MaskedValue 
                        maskedText={s.email_masque || '***@***.**'}
                        revealedText={revealedDetails[s.user_id]?.email}
                        status={revealStates[s.user_id] || 'hidden'}
                        onReveal={() => handleReveal(s.user_id)}
                        type="email"
                      />
                    </td>
                    <td className="py-3 px-4 font-bold uppercase text-admin-primary-light">
                      {s.plan}
                    </td>
                    <td className="py-3 px-4">
                      {isActive ? (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[8px] font-black uppercase tracking-wider">
                          Actif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-[8px] font-black uppercase tracking-wider">
                          Expiré / Inactif
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold font-numeric-display">
                      {s.amount ? `${new Intl.NumberFormat('fr-FR').format(s.amount)} F` : '0 F'}
                    </td>
                    <td className="py-3 px-4 text-admin-text-muted" title={new Date(s.expires_at).toLocaleString('fr-FR')}>
                      {new Date(s.expires_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="h-8 px-3 bg-admin-primary/20 hover:bg-admin-primary/30 text-admin-primary-light font-black uppercase rounded-lg tracking-wider active:scale-95 transition-all text-[9px] cursor-pointer"
                      >
                        Ajuster
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: Adjust Subscription */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleUpdateSubscription} className="bg-admin-card rounded-2xl p-6 max-w-sm w-full relative shadow-xl text-left border border-admin-border flex flex-col gap-4 animate-scale-in">
            <h3 className="text-sm font-black text-admin-text uppercase">💳 Ajuster l'Abonnement</h3>
            <div className="flex flex-col text-[10px] text-admin-text-muted font-mono leading-relaxed gap-0.5">
              <span className="truncate">Sub ID : {editingSub.id}</span>
              <span className="truncate">User ID : {editingSub.user_id}</span>
            </div>
            
            <div className="flex flex-col gap-3">
              <Select
                label="Formule de Plan"
                value={newPlan}
                onChange={(val) => setNewPlan(val as any)}
                options={[
                  { value: 'starter', label: 'Starter' },
                  { value: 'pro', label: 'Pro' },
                  { value: 'annual', label: 'Annuel (Annual)' },
                ]}
                isAdmin={true}
              />

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase tracking-wider text-admin-text-muted">Date d'Expiration</label>
                <input
                  type="datetime-local"
                  required
                  value={newExpiresAt}
                  onChange={(e) => setNewExpiresAt(e.target.value)}
                  className="w-full h-11 px-4 text-xs bg-admin-surface border border-admin-border rounded-xl text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-primary/40"
                />
              </div>
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setEditingSub(null)}
                className="flex-1 h-10 border border-admin-border hover:bg-admin-surface text-admin-text text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="flex-1 h-10 bg-admin-primary hover:bg-admin-primary-light disabled:opacity-50 text-white text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                {isUpdating ? 'AJUSTEMENT...' : 'CONFIRMER'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
