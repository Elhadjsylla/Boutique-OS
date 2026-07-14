import React, { useState, useEffect } from 'react';

import { Select } from '../../components/ui/Select';
import { MaskedValue } from '../../components/admin/MaskedValue';
import { useRevealUser } from '../../hooks/useRevealUser';
import { callRpcWithRetry } from '../../lib/supabase-rpc';
import { formatMontantCompact } from '../../lib/format';

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
  revoked_at?: string | null;
  revoked_by?: string | null;
  revocation_reason?: string | null;
  revocation_type?: string | null;
  revoked_by_name?: string | null;
  revoked_previous_plan?: string | null;
}

export const AdminSubscriptions: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<SubscriptionEntry[]>([]);
  const [loading, setLoading]             = useState(true);
  const [editingSub, setEditingSub]       = useState<SubscriptionEntry | null>(null);
  const [newPlan, setNewPlan]             = useState<'starter' | 'pro' | 'annual'>('starter');
  const [newExpiresAt, setNewExpiresAt]   = useState('');
  const [isUpdating, setIsUpdating]       = useState(false);

  // Revocation State
  const [revokingSub, setRevokingSub]     = useState<SubscriptionEntry | null>(null);
  const [revokeType, setRevokeType]       = useState<'immediate' | 'delayed'>('immediate');
  const [revokeReason, setRevokeReason]   = useState<string>('Non-paiement');
  const [customReason, setCustomReason]   = useState<string>('');
  const [isRevoking, setIsRevoking]       = useState(false);
  const [doubleConfirmRevoke, setDoubleConfirmRevoke] = useState(false);

  // Reactivation State
  const [reactivatingSub, setReactivatingSub] = useState<SubscriptionEntry | null>(null);
  const [isReactivating, setIsReactivating]   = useState(false);
  const [doubleConfirmReactivate, setDoubleConfirmReactivate] = useState(false);

  // History / Audit Logs state
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs]         = useState<Record<string, any[]>>({});
  const [loadingLogs, setLoadingLogs]     = useState<Record<string, boolean>>({});

  // Toast State
  const [toast, setToast]                 = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Reveal State
  const { revealStates, revealedDetails, handleReveal } = useRevealUser();

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const { data, error } = await callRpcWithRetry('get_subscriptions_list_masked');
      if (error) throw error;
      setSubscriptions(data || []);
    } catch (e: unknown) {
      console.error('[AdminSubscriptions] Erreur fetch:', e instanceof Error ? e.message : e);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async (userId: string) => {
    setLoadingLogs(prev => ({ ...prev, [userId]: true }));
    try {
      const { data, error } = await callRpcWithRetry('get_subscription_audit_log', { target_user: userId });
      if (error) throw error;
      setAuditLogs(prev => ({ ...prev, [userId]: data || [] }));
    } catch (err) {
      console.error('[AdminSubscriptions] Error fetching audit logs:', err);
    } finally {
      setLoadingLogs(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleToggleLogs = (sub: SubscriptionEntry) => {
    if (expandedSubId === sub.id) {
      setExpandedSubId(null);
    } else {
      setExpandedSubId(sub.id);
      if (!auditLogs[sub.user_id]) {
        fetchAuditLogs(sub.user_id);
      }
    }
  };

  useEffect(() => { fetchSubscriptions(); }, []);

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
      const formattedDate = new Date(newExpiresAt).toISOString();
      const { error } = await callRpcWithRetry('sys_update_subscription', {
        target_user: editingSub.user_id,
        new_plan: newPlan,
        new_expires_at: formattedDate
      });
      if (error) throw error;
      setEditingSub(null);
      showToast("Abonnement ajusté avec succès.", "success");
      fetchSubscriptions();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Erreur lors de la modification", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenRevoke = (sub: SubscriptionEntry) => {
    setRevokingSub(sub);
    setRevokeType('immediate');
    setRevokeReason('Non-paiement');
    setCustomReason('');
    setDoubleConfirmRevoke(false);
  };

  const handleRevokeSubscription = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!revokingSub || !doubleConfirmRevoke) return;
    setIsRevoking(true);
    try {
      const finalReason = revokeReason === 'Autre' ? customReason : revokeReason;
      if (!finalReason.trim()) {
        throw new Error("Le motif est obligatoire.");
      }

      const { error } = await callRpcWithRetry('revoke_subscription', {
        p_subscription_id: revokingSub.id,
        p_revocation_type: revokeType === 'delayed' ? 'end_of_period' : 'immediate',
        p_reason: finalReason
      });
      if (error) throw error;
      
      setRevokingSub(null);
      showToast(`Abonnement révoqué (${revokeType === 'immediate' ? 'immédiatement' : 'fin de période'}).`, "success");
      fetchSubscriptions();
      if (auditLogs[revokingSub.user_id]) {
        fetchAuditLogs(revokingSub.user_id);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Erreur lors de la révocation", "error");
    } finally {
      setIsRevoking(false);
    }
  };

  const handleOpenReactivate = (sub: SubscriptionEntry) => {
    setReactivatingSub(sub);
    setDoubleConfirmReactivate(false);
  };

  const handleReactivateSubscription = async () => {
    if (!reactivatingSub || !doubleConfirmReactivate) return;
    setIsReactivating(true);
    try {
      const { error } = await callRpcWithRetry('reactivate_subscription', {
        p_subscription_id: reactivatingSub.id
      });
      if (error) throw error;

      setReactivatingSub(null);
      showToast("Abonnement réactivé avec succès.", "success");
      fetchSubscriptions();
      if (auditLogs[reactivatingSub.user_id]) {
        fetchAuditLogs(reactivatingSub.user_id);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Erreur lors de la réactivation", "error");
    } finally {
      setIsReactivating(false);
    }
  };

  const statusBadge = (s: SubscriptionEntry) => {
    if (s.revoked_at) {
      const mode = s.revocation_type === 'immediate' ? 'Immédiat' : 'Fin de période';
      return (
        <div className="flex flex-col gap-0.5 items-start">
          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-[8px] font-black uppercase tracking-wider">
            Révoqué ({mode})
          </span>
        </div>
      );
    }

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
        <div className="flex flex-col gap-4">
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-admin-card border border-admin-border rounded-2xl p-4 overflow-x-auto shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-admin-border text-admin-text-muted uppercase tracking-wider">
                  <th className="py-3 px-4 font-black">Marchand</th>
                  <th className="py-3 px-4 font-black">Boutique</th>
                  <th className="py-3 px-4 font-black">Formule</th>
                  <th className="py-3 px-4 font-black">Statut</th>
                  <th className="py-3 px-4 font-black">Montant</th>
                  <th className="py-3 px-4 font-black">Expiration</th>
                  <th className="py-3 px-4 text-right font-black">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map(s => {
                  const identity = revealedDetails[s.user_id];
                  const revealStatus = revealStates[s.user_id] || 'hidden';

                  return (
                    <React.Fragment key={s.id}>
                      <tr className="border-b border-admin-border/50 hover:bg-admin-surface/20 text-admin-text">
                        {/* Marchand */}
                        <td className="py-3 px-4 min-w-[180px]">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-admin-text">
                              <MaskedValue 
                                maskedText={s.nom_masque || 'Anonyme'}
                                revealedText={identity?.nom}
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
                            {s.revoked_at && (
                              <span className="text-[8px] text-admin-text-muted leading-tight font-mono">
                                Révoqué par {s.revoked_by_name} le {new Date(s.revoked_at).toLocaleDateString('fr-FR')}
                              </span>
                            )}
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
                          {s.amount ? `${formatMontantCompact(s.amount)} F` : '0 F'}
                        </td>
                        <td className="py-3 px-4 text-admin-text-muted" title={new Date(s.expires_at).toLocaleString('fr-FR')}>
                          {new Date(s.expires_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleLogs(s)}
                              className={`h-8 px-2.5 font-black uppercase rounded-lg tracking-wider active:scale-95 transition-all text-[9px] cursor-pointer ${
                                expandedSubId === s.id 
                                  ? 'bg-admin-surface text-admin-text border border-admin-border' 
                                  : 'bg-admin-surface/60 hover:bg-admin-surface text-admin-text-muted'
                              }`}
                            >
                              Logs
                            </button>
                            <button
                              onClick={() => handleOpenEdit(s)}
                              className="h-8 px-2.5 bg-admin-primary/20 hover:bg-admin-primary/30 text-admin-primary-light font-black uppercase rounded-lg tracking-wider active:scale-95 transition-all text-[9px] cursor-pointer"
                            >
                              Ajuster
                            </button>
                            {s.revoked_at ? (
                              <button
                                onClick={() => handleOpenReactivate(s)}
                                className="h-8 px-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-black uppercase rounded-lg tracking-wider active:scale-95 transition-all text-[9px] cursor-pointer"
                              >
                                Réactiver
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenRevoke(s)}
                                className="h-8 px-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-black uppercase rounded-lg tracking-wider active:scale-95 transition-all text-[9px] cursor-pointer"
                              >
                                Révoquer
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedSubId === s.id && (
                        <tr className="bg-admin-surface/30">
                          <td colSpan={7} className="py-4 px-6 border-b border-admin-border">
                            <div className="flex flex-col gap-3">
                              <h4 className="font-black text-[10px] text-admin-primary-light uppercase tracking-wider">
                                📜 Historique des Actions d'Abonnement
                              </h4>
                              {loadingLogs[s.user_id] ? (
                                <div className="flex items-center gap-2 text-admin-text-muted text-[10px]">
                                  <div className="w-3.5 h-3.5 border-2 border-admin-primary border-t-transparent rounded-full animate-spin" />
                                  <span>Chargement de l'historique...</span>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  {(auditLogs[s.user_id] || []).length === 0 ? (
                                    <p className="text-[10px] text-admin-text-muted italic">Aucun log d'audit d'abonnement trouvé pour ce marchand.</p>
                                  ) : (
                                    <div className="flex flex-col border border-admin-border rounded-xl overflow-hidden divide-y divide-admin-border/50 bg-admin-card/50">
                                      {(auditLogs[s.user_id] || []).map((log: any) => {
                                        let actionText = log.action;
                                        if (log.action === 'revoke') {
                                          actionText = "Révocation";
                                        } else if (log.action === 'reactivate') {
                                          actionText = "Réactivation";
                                        } else if (log.action === 'adjust') {
                                          actionText = "Ajustement";
                                        }
                                        
                                        return (
                                          <div key={log.id} className="p-3 text-[10px] flex flex-col md:flex-row md:items-center justify-between gap-2 text-admin-text">
                                            <div className="flex items-start md:items-center gap-2">
                                              <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-black border ${
                                                log.action === 'revoke' 
                                                  ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                                                  : log.action === 'reactivate' 
                                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                                    : 'bg-admin-primary/10 border-admin-primary/20 text-admin-primary-light'
                                              }`}>
                                                {actionText}
                                              </span>
                                              <div className="flex flex-col gap-0.5">
                                                <span className="font-semibold">{log.actor_name} ({log.actor_email})</span>
                                                <span className="text-[9px] text-admin-text-muted">
                                                  Le {new Date(log.created_at).toLocaleString('fr-FR')}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="flex flex-col gap-0.5 text-right font-mono text-[9px] bg-admin-surface/40 p-2 rounded-lg border border-admin-border/30 max-w-md self-start md:self-auto">
                                              {log.reason && <div><span className="text-admin-text-muted">Motif:</span> {log.reason}</div>}
                                              {log.previous_state?.plan && log.new_state?.plan && (
                                                <div>
                                                  <span className="text-admin-text-muted">Transition:</span> {log.previous_state.plan} ({log.previous_state.status}) → {log.new_state.plan} ({log.new_state.status})
                                                </div>
                                              )}
                                              {log.new_state?.revocation_type && (
                                                <div>
                                                  <span className="text-admin-text-muted">Type:</span> {log.new_state.revocation_type === 'immediate' ? 'Immédiat' : 'Différé'}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {subscriptions.length === 0 && (
              <p className="text-center text-admin-text-muted py-10 text-xs">Aucun abonnement trouvé.</p>
            )}
          </div>

          {/* Mobile/Tablet Card View */}
          <div className="lg:hidden flex flex-col gap-4">
            {subscriptions.map(s => {
              const identity = revealedDetails[s.user_id];
              const revealStatus = revealStates[s.user_id] || 'hidden';
              const isExpanded = expandedSubId === s.id;

              return (
                <div key={s.id} className="bg-admin-card border border-admin-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-sm text-xs text-left">
                  <div className="flex justify-between items-start border-b border-admin-border pb-2.5">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-bold text-sm text-admin-text truncate">
                        <MaskedValue 
                          maskedText={s.nom_masque || 'Anonyme'}
                          revealedText={identity?.nom}
                          status={revealStatus}
                          onReveal={() => handleReveal(s.user_id)}
                          type="nom"
                        />
                      </span>
                      <span className="text-admin-primary-light font-mono text-[10px] truncate">
                        <MaskedValue 
                          maskedText={s.email_masque || '***@***.**'}
                          revealedText={identity?.email}
                          status={revealStatus}
                          onReveal={() => handleReveal(s.user_id)}
                          type="email"
                        />
                      </span>
                      {s.revoked_at && (
                        <span className="text-[8px] text-admin-text-muted font-mono mt-0.5">
                          Révoqué par {s.revoked_by_name} le {new Date(s.revoked_at).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                    {statusBadge(s)}
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[9px] uppercase tracking-wider text-admin-text-muted">Boutique</span>
                      <span className="font-semibold text-admin-text truncate">
                        {s.boutique_nom ?? '—'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] uppercase tracking-wider text-admin-text-muted">Formule</span>
                      <span className="font-bold uppercase text-admin-primary-light truncate">
                        {s.plan}{s.is_trial && <span className="ml-1 text-[8px] text-amber-400">(essai)</span>}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] uppercase tracking-wider text-admin-text-muted">Montant</span>
                      <span className="font-bold text-admin-text font-numeric-display">
                        {s.amount ? `${formatMontantCompact(s.amount)} F` : '0 F'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] uppercase tracking-wider text-admin-text-muted">Expiration</span>
                      <span className="font-medium text-admin-text-muted">
                        {new Date(s.expires_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>

                  {/* Collapsible logs inside card */}
                  {isExpanded && (
                    <div className="bg-admin-surface/30 p-3.5 border border-admin-border rounded-xl flex flex-col gap-2.5 mt-1">
                      <h4 className="font-black text-[9px] text-admin-primary-light uppercase tracking-wider">
                        📜 Historique des Actions
                      </h4>
                      {loadingLogs[s.user_id] ? (
                        <div className="flex items-center gap-2 text-admin-text-muted text-[9px]">
                          <div className="w-3 h-3 border-2 border-admin-primary border-t-transparent rounded-full animate-spin" />
                          <span>Chargement...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                          {(auditLogs[s.user_id] || []).length === 0 ? (
                            <p className="text-[9px] text-admin-text-muted italic">Aucun log d'audit.</p>
                          ) : (
                            (auditLogs[s.user_id] || []).map((log: any) => {
                              let actionText = log.action;
                              if (log.action === 'revoke') actionText = "Révocation";
                              else if (log.action === 'reactivate') actionText = "Réactivation";
                              else if (log.action === 'adjust') actionText = "Ajustement";

                              return (
                                <div key={log.id} className="p-2 border border-admin-border rounded-lg bg-admin-card text-[9px] flex flex-col gap-1 text-admin-text">
                                  <div className="flex justify-between items-center gap-2">
                                    <span className={`px-1 rounded text-[7px] uppercase font-black border ${
                                      log.action === 'revoke' 
                                        ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                                        : log.action === 'reactivate' 
                                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                          : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                    }`}>
                                      {actionText}
                                    </span>
                                    <span className="text-admin-text-muted font-mono text-[8px]">
                                      {new Date(log.created_at).toLocaleString('fr-FR')}
                                    </span>
                                  </div>
                                  <p className="opacity-90 leading-tight">Motif : {log.reason || '—'}</p>
                                  <p className="text-[8px] text-admin-text-muted font-semibold">Par : {log.actor_name || 'System'}</p>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t border-admin-border/50 pt-3 flex justify-end gap-2">
                    <button
                      onClick={() => handleToggleLogs(s)}
                      className={`h-8 px-2.5 font-black uppercase rounded-lg tracking-wider active:scale-95 transition-all text-[9px] cursor-pointer ${
                        isExpanded 
                          ? 'bg-admin-surface text-admin-text border border-admin-border' 
                          : 'bg-admin-surface/60 hover:bg-admin-surface text-admin-text-muted'
                      }`}
                    >
                      Logs
                    </button>
                    <button
                      onClick={() => handleOpenEdit(s)}
                      className="h-8 px-2.5 bg-admin-primary/20 hover:bg-admin-primary/30 text-admin-primary-light font-black uppercase rounded-lg tracking-wider active:scale-95 transition-all text-[9px] cursor-pointer"
                    >
                      Ajuster
                    </button>
                    {s.revoked_at ? (
                      <button
                        onClick={() => handleOpenReactivate(s)}
                        className="h-8 px-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-black uppercase rounded-lg tracking-wider active:scale-95 transition-all text-[9px] cursor-pointer"
                      >
                        Réactiver
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenRevoke(s)}
                        className="h-8 px-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-black uppercase rounded-lg tracking-wider active:scale-95 transition-all text-[9px] cursor-pointer"
                      >
                        Révoquer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {subscriptions.length === 0 && (
              <p className="text-center text-admin-text-muted py-10 text-xs">Aucun abonnement trouvé.</p>
            )}
          </div>
        </div>
      )}

      {/* MODAL : Ajuster abonnement */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleUpdateSubscription} className="bg-admin-card rounded-2xl p-6 max-w-sm w-full relative shadow-xl text-left border border-admin-border flex flex-col gap-4 animate-scale-in">
            <h3 className="text-sm font-black text-admin-text uppercase">💳 Ajuster l'Abonnement</h3>
            <div className="flex flex-col text-[10px] text-admin-text-muted font-mono leading-relaxed gap-0.5">
              <span className="truncate">
                {revealedDetails[editingSub.user_id]?.email ?? editingSub.email_masque}
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

      {/* MODAL : Révocation abonnement */}
      {revokingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleRevokeSubscription} className="bg-admin-card rounded-2xl p-6 max-w-sm w-full relative shadow-xl text-left border border-red-500/30 flex flex-col gap-4 animate-scale-in">
            <h3 className="text-sm font-black text-red-400 uppercase tracking-wider flex items-center gap-1">⚠️ Révocation de l'Abonnement</h3>
            
            <div className="flex flex-col text-[10px] text-admin-text-muted font-mono leading-relaxed gap-0.5 border-b border-admin-border/50 pb-2">
              <span className="truncate">Marchand : {revealedDetails[revokingSub.user_id]?.nom || revokingSub.nom_masque}</span>
              <span className="truncate text-admin-text-muted/60">{revealedDetails[revokingSub.user_id]?.email || revokingSub.email_masque}</span>
            </div>

            {/* Choix du type de révocation */}
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase tracking-wider text-admin-text-muted">Type de révocation</label>
              
              <div className="flex flex-col gap-2.5">
                <label className="flex items-start gap-2.5 p-2.5 bg-admin-surface/40 hover:bg-admin-surface/70 border border-admin-border/50 rounded-xl cursor-pointer">
                  <input
                    type="radio"
                    name="revokeType"
                    value="immediate"
                    checked={revokeType === 'immediate'}
                    onChange={() => setRevokeType('immediate')}
                    className="mt-0.5 accent-red-500"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-admin-text">Révocation Immédiate</span>
                    <span className="text-[9px] text-admin-text-muted">Le marchand repasse au plan Free instantanément.</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 bg-admin-surface/40 hover:bg-admin-surface/70 border border-admin-border/50 rounded-xl cursor-pointer">
                  <input
                    type="radio"
                    name="revokeType"
                    value="delayed"
                    checked={revokeType === 'delayed'}
                    onChange={() => setRevokeType('delayed')}
                    className="mt-0.5 accent-red-500"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-admin-text">Fin de période en cours</span>
                    <span className="text-[9px] text-admin-text-muted">L'accès reste actif jusqu'au {new Date(revokingSub.expires_at).toLocaleDateString('fr-FR')}.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Motif de révocation */}
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase tracking-wider text-admin-text-muted">Motif de la révocation</label>
              <Select
                value={revokeReason}
                onChange={(val) => setRevokeReason(val)}
                options={[
                  { value: 'Non-paiement', label: 'Non-paiement' },
                  { value: 'Abus',         label: 'Abus' },
                  { value: 'Demande du marchand', label: 'Demande du marchand' },
                  { value: 'Autre',        label: 'Autre (Saisir motif)' },
                ]}
                isAdmin={true}
              />
              {revokeReason === 'Autre' && (
                <textarea
                  required
                  placeholder="Saisissez le motif de la révocation..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full h-20 p-3 text-xs bg-admin-surface border border-admin-border rounded-xl text-admin-text focus:outline-none focus:ring-2 focus:ring-red-500/40 mt-1 resize-none"
                />
              )}
            </div>

            {/* Résumé dynamique */}
            <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-xl text-[10px] text-red-300 leading-normal font-mono">
              ℹ️ Le marchand <span className="font-bold">{revealedDetails[revokingSub.user_id]?.nom || revokingSub.nom_masque}</span> passera au plan <span className="font-bold uppercase">Free</span> {
                revokeType === 'immediate' 
                  ? 'immédiatement' 
                  : `le ${new Date(revokingSub.expires_at).toLocaleDateString('fr-FR')}`
              }.
            </div>

            {/* Double confirmation */}
            <label className="flex items-center gap-2.5 p-2 bg-admin-surface/30 border border-admin-border/30 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={doubleConfirmRevoke}
                onChange={(e) => setDoubleConfirmRevoke(e.target.checked)}
                className="accent-red-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-[10px] text-admin-text font-bold uppercase select-none">
                Je confirme cette action critique
              </span>
            </label>

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setRevokingSub(null)}
                className="flex-1 h-10 border border-admin-border hover:bg-admin-surface text-admin-text text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isRevoking || !doubleConfirmRevoke || (revokeReason === 'Autre' && !customReason.trim())}
                className="flex-1 h-10 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                {isRevoking ? 'RÉVOCATION...' : 'RÉVOQUER'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL : Réactivation abonnement */}
      {reactivatingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-admin-card rounded-2xl p-6 max-w-sm w-full relative shadow-xl text-left border border-emerald-500/30 flex flex-col gap-4 animate-scale-in">
            <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">🔄 Réactiver l'Abonnement</h3>
            
            <div className="flex flex-col text-[10px] text-admin-text-muted font-mono leading-relaxed gap-0.5 border-b border-admin-border/50 pb-2">
              <span className="truncate">Marchand : {revealedDetails[reactivatingSub.user_id]?.nom || reactivatingSub.nom_masque}</span>
              <span className="truncate text-admin-text-muted/60">{revealedDetails[reactivatingSub.user_id]?.email || reactivatingSub.email_masque}</span>
            </div>

            <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-[10px] text-emerald-300 leading-normal font-mono">
              ℹ️ Voulez-vous réactiver l'abonnement du marchand ? Son plan précédent (<span className="font-bold uppercase">{reactivatingSub.revoked_previous_plan || 'starter'}</span>) sera restauré avec ses droits associés.
            </div>

            {/* Double confirmation */}
            <label className="flex items-center gap-2.5 p-2 bg-admin-surface/30 border border-admin-border/30 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={doubleConfirmReactivate}
                onChange={(e) => setDoubleConfirmReactivate(e.target.checked)}
                className="accent-emerald-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-[10px] text-admin-text font-bold uppercase select-none">
                Je confirme la réactivation
              </span>
            </label>

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setReactivatingSub(null)}
                className="flex-1 h-10 border border-admin-border hover:bg-admin-surface text-admin-text text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleReactivateSubscription}
                disabled={isReactivating || !doubleConfirmReactivate}
                className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                {isReactivating ? 'RÉACTIVATION...' : 'RÉACTIVER'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-lg flex items-center gap-2 text-xs uppercase tracking-wider font-black animate-slide-in ${
          toast.type === 'success' 
            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' 
            : 'bg-red-500/20 border-red-500/30 text-red-400'
        }`}>
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};
