import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Select } from '../../components/ui/Select';
import { MaskedValue } from '../../components/admin/MaskedValue';
import { useRevealUser } from '../../hooks/useRevealUser';

interface SubscriptionEntry {
  id: string;
  user_id: string;
  nom_masque: string;
  email_masque: string;
  boutique_nom: string | null;
  plan: 'starter' | 'pro' | 'annual';
  status: string;
  payment_method: string | null;
  amount: number | null;
  net_amount: number | null;
  is_trial: boolean;
  starts_at: string;
  expires_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  email_masque?: string;
}

interface RevealedIdentity {
  nom: string;
  prenom: string;
  email: string;
  phone_number: string;
}

export const AdminSubscriptions: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<SubscriptionEntry[]>([]);
  const [loading, setLoading]             = useState(true);
  const [editingSub, setEditingSub]       = useState<SubscriptionEntry | null>(null);
  const [newPlan, setNewPlan]             = useState<'starter' | 'pro' | 'annual'>('starter');
  const [newExpiresAt, setNewExpiresAt]   = useState('');
  const [isUpdating, setIsUpdating]       = useState(false);

  // Reveal state : userId → données en clair (cache local par session)
  const [revealed, setRevealed]           = useState<Record<string, RevealedIdentity>>({});
  const [revealingId, setRevealingId]     = useState<string | null>(null);

  // Reveal State
  const { revealStates, revealedDetails, handleReveal } = useRevealUser();

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_subscriptions_list_masked');
      if (error) throw error;
      setSubscriptions(data || []);
    } catch (e: unknown) {
      console.error('[AdminSubscriptions] Erreur fetch:', e instanceof Error ? e.message : e);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubscriptions(); }, []);

  const handleReveal = async (userId: string) => {
    if (revealed[userId] || revealingId) return;
    setRevealingId(userId);
    try {
      const { data, error } = await supabase.rpc('reveal_user_details', {
        p_user_id: userId,
      });
      if (error) throw error;
      setRevealed(prev => ({ ...prev, [userId]: data as RevealedIdentity }));
    } catch (e: unknown) {
      console.error('[AdminSubscriptions] Reveal error:', e instanceof Error ? e.message : e);
    } finally {
      setRevealingId(null);
    }
  };

  const handleOpenEdit = (sub: SubscriptionEntry) => {
    setEditingSub(sub);
    setNewPlan(sub.plan);
    setNewExpiresAt(new Date(sub.expires_at).toISOString().slice(0, 16));
  };

  const handleUpdateSubscription = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSub) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.rpc('sys_update_subscription', {
        target_user:    editingSub.user_id,
        new_plan:       newPlan,
        new_expires_at: new Date(newExpiresAt).toISOString(),
      });
      if (error) throw error;
      setEditingSub(null);
      fetchSubscriptions();
    } catch (err: unknown) {
      alert("Erreur lors de la modification : " + (err instanceof Error ? err.message : err));
    } finally {
      setIsUpdating(false);
    }
  };

  const statusBadge = (s: SubscriptionEntry) => {
    const expired = new Date(s.expires_at) < new Date();
    const isActive = s.status === 'active' && !expired;
    if (isActive)
      return <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[8px] font-black uppercase tracking-wider">Actif</span>;
    if (s.status === 'pending')
      return <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[8px] font-black uppercase tracking-wider">En attente</span>;
    if (s.status === 'failed')
      return <span className="px-2 py-0.5 bg-red-700/20 text-red-400 border border-red-700/30 rounded-full text-[8px] font-black uppercase tracking-wider">Échoué</span>;
    return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-[8px] font-black uppercase tracking-wider">Expiré</span>;
  };

  return (
    <div className="flex flex-col gap-6 text-left">
      <div>
        <h1 className="text-xl font-black text-admin-text uppercase tracking-wider">Gestion Abonnements</h1>
        <p className="text-xs text-admin-text-muted">Consultez l'historique et modifiez manuellement les formules d'abonnements.</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-admin-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-admin-card border border-admin-border rounded-2xl p-4 overflow-x-auto shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-admin-border text-admin-text-muted uppercase tracking-wider">
                <th className="py-3 px-4 font-black">Marchand</th>
                <th className="py-3 px-4 font-black">Boutique</th>
                <th className="py-3 px-4 font-black">Formule</th>
                <th className="py-3 px-4 font-black">Statut</th>
                <th className="py-3 px-4 font-black">Montant</th>
                <th className="py-3 px-4 font-black">Expiration</th>
                <th className="py-3 px-4 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map(s => {
                const identity = revealedDetails[s.user_id];
                const revealStatus = revealStates[s.user_id] || 'hidden';

                return (
                  <tr key={s.id} className="border-b border-admin-border/50 hover:bg-admin-surface/20 text-admin-text">
                    {/* Marchand — masqué ou révélé via MaskedValue */}
                    <td className="py-3 px-4 min-w-[180px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-admin-text">
                          <MaskedValue 
                            maskedText={s.nom_masque || 'Anonyme'}
                            revealedText={[identity?.prenom, identity?.nom].filter(Boolean).join(' ') || identity?.nom}
                            status={revealStatus}
                            onReveal={() => handleReveal(s.user_id)}
                            type="nom"
                          />
                        </span>
                        <span className="text-admin-primary-light font-mono">
                          <MaskedValue 
                            maskedText={s.email_masque || '***@***.**'}
                            revealedText={identity?.email}
                            status={revealStatus}
                            onReveal={() => handleReveal(s.user_id)}
                            type="email"
                          />
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-admin-text-muted">
                      {s.boutique_nom ?? '—'}
                    </td>
                    <td className="py-3 px-4 font-bold uppercase text-admin-primary-light">
                      {s.plan}{s.is_trial && <span className="ml-1 text-[8px] text-amber-400">(essai)</span>}
                    </td>
                    <td className="py-3 px-4">{statusBadge(s)}</td>
                    <td className="py-3 px-4 font-bold font-numeric-display">
                      {s.amount ? `${new Intl.NumberFormat('fr-FR').format(s.amount)} F` : '0 F'}
                    </td>
                    <td className="py-3 px-4 text-admin-text-muted" title={new Date(s.expires_at).toLocaleString('fr-FR')}>
                      {new Date(s.expires_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="h-8 px-3 bg-admin-primary/20 hover:bg-admin-primary/30 text-admin-primary-light font-black uppercase rounded-lg tracking-wider active:scale-95 transition-all text-[9px] cursor-pointer"
                        >
                          Ajuster
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {subscriptions.length === 0 && (
            <p className="text-center text-admin-text-muted py-10 text-xs">Aucun abonnement trouvé.</p>
          )}
        </div>
      )}

      {/* MODAL : Ajuster abonnement */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleUpdateSubscription} className="bg-admin-card rounded-2xl p-6 max-w-sm w-full relative shadow-xl text-left border border-admin-border flex flex-col gap-4 animate-scale-in">
            <h3 className="text-sm font-black text-admin-text uppercase">💳 Ajuster l'Abonnement</h3>
            <div className="flex flex-col text-[10px] text-admin-text-muted font-mono leading-relaxed gap-0.5">
              <span className="truncate">
                {revealed[editingSub.user_id]?.email ?? editingSub.email_masque}
              </span>
              <span className="truncate text-admin-text-muted/60">Sub : {editingSub.id}</span>
            </div>

            <div className="flex flex-col gap-3">
              <Select
                label="Formule de Plan"
                value={newPlan}
                onChange={(val) => setNewPlan(val as 'starter' | 'pro' | 'annual')}
                options={[
                  { value: 'starter', label: 'Starter' },
                  { value: 'pro',     label: 'Pro' },
                  { value: 'annual',  label: 'Annuel (Annual)' },
                ]}
                isAdmin={true}
              />
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase tracking-wider text-admin-text-muted">Date d'Expiration</label>
                <input
                  type="datetime-local"
                  required
                  value={newExpiresAt}
                  onChange={e => setNewExpiresAt(e.target.value)}
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
