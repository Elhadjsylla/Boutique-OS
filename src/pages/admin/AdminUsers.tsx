import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Select } from '../../components/ui/Select';
import { MaskedValue } from '../../components/admin/MaskedValue';
import { useRevealUser } from '../../hooks/useRevealUser';
import { callRpcWithRetry } from '../../lib/supabase-rpc';

interface Profile {
  id: string;
  nom_masque?: string;
  email_masque?: string;
  role: string;
  boutique_id?: string | null;
  boutique_nom?: string;
  created_at: string;
  boutiques?: { nom: string } | null;
  status?: string;
  status_reason?: string | null;
  status_changed_at?: string | null;
}

type ModerateAction = 'suspended' | 'blocked' | 'banned' | 'reactivate' | 'lift_ban' | 'delete';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active:    { label: 'Actif',    className: 'bg-emerald-500/20 text-emerald-300' },
  pending:   { label: 'En attente', className: 'bg-slate-500/20 text-slate-300' },
  rejected:  { label: 'Refusé',   className: 'bg-slate-500/20 text-slate-300' },
  suspended: { label: 'Suspendu', className: 'bg-amber-500/20 text-amber-300' },
  blocked:   { label: 'Bloqué',   className: 'bg-orange-500/20 text-orange-300' },
  banned:    { label: 'Banni',    className: 'bg-red-500/20 text-red-300' },
  deleted:   { label: 'Supprimé', className: 'bg-zinc-700/40 text-zinc-400' },
};

function getAvailableActions(status?: string): Array<{ key: ModerateAction; label: string }> {
  if (status === 'deleted') return [];
  if (status === 'banned') {
    return [
      { key: 'delete', label: 'Supprimer (anonymiser)' },
    ];
  }
  if (status === 'suspended' || status === 'blocked') {
    return [
      { key: 'reactivate', label: 'Réactiver' },
      { key: 'banned', label: 'Bannir' },
      { key: 'delete', label: 'Supprimer (anonymiser)' },
    ];
  }
  return [
    { key: 'suspended', label: 'Suspendre' },
    { key: 'blocked', label: 'Bloquer' },
    { key: 'banned', label: 'Bannir' },
    { key: 'delete', label: 'Supprimer (anonymiser)' },
  ];
}

const ACTION_CONFIRM_LABEL: Record<ModerateAction, string> = {
  suspended: 'Suspendre ce compte',
  blocked: 'Bloquer ce compte',
  banned: 'Bannir ce compte',
  reactivate: 'Réactiver ce compte',
  lift_ban: 'Lever le bannissement',
  delete: 'Supprimer (anonymiser) ce compte',
};

interface Boutique {
  id: string;
  nom: string;
}

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBoutiqueId, setFilterBoutiqueId] = useState<string | null>(() => {
    return localStorage.getItem('admin_users_filter_boutique_id');
  });

  // Reveal State
  const { revealStates, revealedDetails, handleReveal } = useRevealUser();

  // Edit State
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<'caissier' | 'gerant' | 'super_admin'>('caissier');
  const [editBoutiqueId, setEditBoutiqueId] = useState<string>('null');
  const [isUpdating, setIsUpdating] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Moderation State
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);
  const [moderatingUser, setModeratingUser] = useState<Profile | null>(null);
  const [moderateAction, setModerateAction] = useState<ModerateAction | null>(null);
  const [moderateReason, setModerateReason] = useState('');
  const [isModerating, setIsModerating] = useState(false);
  const [moderateError, setModerateError] = useState<string | null>(null);

  const fetchUsersAndBoutiques = async (retryCount = 0) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (retryCount < 3) {
          await new Promise(r => setTimeout(r, 1500));
          return fetchUsersAndBoutiques(retryCount + 1);
        }
        throw new Error('Session expirée — veuillez vous reconnecter');
      }

      const [{ data: usersData, error: usersErr }, { data: boutsData, error: boutsErr }] = await Promise.all([
        callRpcWithRetry('get_users_list_masked'),
        callRpcWithRetry('sys_get_boutiques'),
      ]);

      if (usersErr) throw usersErr;
      if (boutsErr) throw boutsErr;

      setUsers((usersData as Profile[] | null) || []);
      setBoutiques((boutsData as Boutique[] | null) || []);
      setError(null);
    } catch (e: any) {
      const isAuthError = e?.code === '42501' || e?.message?.includes('Accès refusé');
      if (isAuthError && retryCount < 2) {
        try { await supabase.auth.refreshSession(); } catch (_) {}
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return fetchUsersAndBoutiques(retryCount + 1);
      }
      console.error("[AdminUsers] Erreur fetch:", e?.message ?? e);
      setError(e.message || 'Erreur de chargement des utilisateurs');
      setUsers([]);
      setBoutiques([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndBoutiques();
  }, []);

  const handleOpenEdit = (u: Profile) => {
    setEditingUser(u);
    setEditRole(u.role as any);
    setEditBoutiqueId(u.boutique_id || 'null');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsUpdating(true);
    try {
      const targetBoutique = editBoutiqueId === 'null' ? null : editBoutiqueId;
      const { error } = await callRpcWithRetry('assign_staff', {
        target_user: editingUser.id,
        new_role: editRole,
        new_boutique: targetBoutique
      });
      if (error) throw error;

      setEditingUser(null);
      fetchUsersAndBoutiques();
    } catch (err: any) {
      alert("Erreur lors de la modification de l'utilisateur : " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenModerate = (u: Profile, action: ModerateAction) => {
    setOpenMenuUserId(null);
    setModeratingUser(u);
    setModerateAction(action);
    setModerateReason('');
    setDeleteConfirmText('');
    setModerateError(null);
  };

  const handleConfirmModerate = async () => {
    if (!moderatingUser || !moderateAction) return;
    setIsModerating(true);
    setModerateError(null);
    try {
      if (moderateAction === 'delete') {
        const { error } = await supabase.functions.invoke('delete-user-account', {
          body: { user_id: moderatingUser.id, reason: moderateReason.trim() || undefined },
        });
        if (error) throw error;
      } else if (moderateAction === 'reactivate') {
        const { error } = await callRpcWithRetry('reactivate_user', {
          p_user_id: moderatingUser.id,
          p_reason: moderateReason.trim() || null,
        });
        if (error) throw error;
      } else if (moderateAction === 'lift_ban') {
        const { error } = await callRpcWithRetry('lift_ban_user', {
          p_user_id: moderatingUser.id,
          p_reason: moderateReason.trim() || null,
        });
        if (error) throw error;
      } else {
        const { error } = await callRpcWithRetry('moderate_user', {
          p_user_id: moderatingUser.id,
          p_new_status: moderateAction,
          p_reason: moderateReason.trim() || null,
        });
        if (error) throw error;
      }

      setModeratingUser(null);
      setModerateAction(null);
      fetchUsersAndBoutiques();
    } catch (err: any) {
      setModerateError(err.message || "Erreur lors de l'action de modération.");
    } finally {
      setIsModerating(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesBoutique = !filterBoutiqueId || u.boutique_id === filterBoutiqueId;
    const matchesStatus = filterStatus === 'all' || (u.status || 'active') === filterStatus;
    return matchesBoutique && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-admin-surface/30 p-4 border border-admin-border rounded-xl">
        <div>
          <h1 className="text-xl font-black text-admin-text uppercase tracking-wider">Gestion Utilisateurs</h1>
          <p className="text-xs text-admin-text-muted">Affichez les profils utilisateurs et réassignez les rôles et boutiques.</p>
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={filterStatus}
            onChange={(val) => setFilterStatus(val)}
            options={[
              { value: 'all', label: 'Tous les statuts' },
              { value: 'active', label: 'Actif' },
              { value: 'pending', label: 'En attente' },
              { value: 'suspended', label: 'Suspendu' },
              { value: 'blocked', label: 'Bloqué' },
              { value: 'banned', label: 'Banni' },
              { value: 'deleted', label: 'Supprimé' },
            ]}
            isAdmin={true}
            label="Filtrer par Statut"
          />
        </div>
      </div>

      {filterBoutiqueId && (
        <div className="p-3.5 bg-admin-surface border border-admin-border/60 rounded-xl flex items-center justify-between gap-3 text-xs shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 text-admin-text-muted">
            <span className="material-symbols-outlined text-admin-primary-light text-lg">filter_alt</span>
            <span>
              Filtré par boutique : <strong className="text-admin-text">{boutiques.find(b => b.id === filterBoutiqueId)?.nom || 'Chargement...'}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setFilterBoutiqueId(null);
              localStorage.removeItem('admin_users_filter_boutique_id');
            }}
            className="text-[9px] font-black uppercase tracking-wider text-admin-text-muted hover:text-admin-text border border-admin-border hover:bg-admin-surface px-2.5 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer"
          >
            Réinitialiser le filtre
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-red-400 text-xs">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchUsersAndBoutiques()}
            className="text-[9px] font-black uppercase tracking-wider text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 px-2 py-1 rounded-lg transition-all cursor-pointer"
          >
            Réessayer
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col justify-center items-center py-20 text-admin-text-muted">
          <div className="w-10 h-10 border-4 border-admin-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="hidden lg:block bg-admin-card border border-admin-border rounded-2xl p-4 shadow-sm">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[15%]" />
                <col className="w-[18%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[15%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-admin-border text-admin-text-muted uppercase tracking-wider">
                  <th className="py-3 px-4 font-black">ID</th>
                  <th className="py-3 px-4 font-black">Nom</th>
                  <th className="py-3 px-4 font-black">Email</th>
                  <th className="py-3 px-4 font-black">Rôle</th>
                  <th className="py-3 px-4 font-black">Statut</th>
                  <th className="py-3 px-4 font-black">Boutique</th>
                  <th className="py-3 px-4 font-black">Créé le</th>
                  <th className="py-3 px-4 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} className="border-b border-admin-border/50 hover:bg-admin-surface/20 text-admin-text">
                    <td className="py-3 px-4 font-mono select-all truncate" title={u.id}>
                      {u.id}
                    </td>
                    <td className="py-3 px-4 truncate">
                      <MaskedValue 
                        maskedText={u.nom_masque || 'Anonyme'}
                        revealedText={revealedDetails[u.id]?.nom}
                        status={revealStates[u.id] || 'hidden'}
                        onReveal={() => handleReveal(u.id)}
                        type="nom"
                      />
                    </td>
                    <td className="py-3 px-4 truncate">
                      <MaskedValue 
                        maskedText={u.email_masque || '***@***.**'}
                        revealedText={revealedDetails[u.id]?.email}
                        status={revealStates[u.id] || 'hidden'}
                        onReveal={() => handleReveal(u.id)}
                        type="email"
                      />
                    </td>
                    <td className="py-3 px-4 truncate">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                        u.role === 'super_admin' ? 'bg-purple-500/20 text-purple-300' :
                        u.role === 'gerant' ? 'bg-sky-500/20 text-sky-300' :
                        'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 truncate">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${STATUS_BADGE[u.status || 'active']?.className || STATUS_BADGE.active.className}`}>
                        {STATUS_BADGE[u.status || 'active']?.label || u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 truncate" title={u.boutique_nom || u.boutiques?.nom || 'Aucune'}>
                      {u.boutique_nom || u.boutiques?.nom || <span className="text-admin-text-muted italic">Non assignée</span>}
                    </td>
                    <td className="py-3 px-4 text-admin-text-muted truncate">
                      {new Date(u.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        {u.role !== 'super_admin' && u.status === 'banned' && (
                          <button
                            onClick={() => handleOpenModerate(u, 'lift_ban')}
                            className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase rounded-lg tracking-wider active:scale-95 transition-all text-[8px] cursor-pointer"
                          >
                            Lever
                          </button>
                        )}
                        <div className="relative inline-block">
                          <button
                            onClick={() => setOpenMenuUserId(openMenuUserId === u.id ? null : u.id)}
                            className="h-8 w-8 bg-admin-surface hover:bg-admin-border border border-admin-border text-admin-text font-black rounded-lg active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">more_vert</span>
                          </button>
                          {openMenuUserId === u.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenMenuUserId(null)} />
                              <div className="absolute right-0 bottom-full mb-1 bg-admin-card border border-admin-border rounded-xl shadow-xl overflow-hidden z-20 py-1 flex flex-col min-w-[180px]">
                                <button
                                  onClick={() => { handleOpenEdit(u); setOpenMenuUserId(null); }}
                                  className="px-4 py-2.5 text-[10px] font-bold text-left text-admin-text hover:bg-admin-surface transition-colors cursor-pointer"
                                >
                                  Modifier le compte
                                </button>
                                {u.role !== 'super_admin' && getAvailableActions(u.status).map(a => (
                                  <button
                                    key={a.key}
                                    onClick={() => { handleOpenModerate(u, a.key); setOpenMenuUserId(null); }}
                                    className={`px-4 py-2.5 text-[10px] font-bold text-left hover:bg-admin-surface transition-colors cursor-pointer whitespace-nowrap ${
                                      a.key === 'delete' ? 'text-red-500 hover:text-red-600 font-black flex items-center gap-1.5' : 'text-admin-text'
                                    }`}
                                  >
                                    {a.key === 'delete' && <span className="material-symbols-outlined text-xs">warning</span>}
                                    {a.label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile/Tablet Card View */}
          <div className="lg:hidden flex flex-col gap-4">
            {filteredUsers.map(u => (
              <div key={u.id} className="bg-admin-card border border-admin-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-sm text-xs">
                <div className="flex justify-between items-center border-b border-admin-border pb-2.5">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[10px] text-admin-text-muted font-mono truncate select-all" title={u.id}>
                      ID: {u.id}
                    </span>
                    <span className="font-bold text-sm text-admin-text truncate">
                      <MaskedValue 
                        maskedText={u.nom_masque || 'Anonyme'}
                        revealedText={revealedDetails[u.id]?.nom}
                        status={revealStates[u.id] || 'hidden'}
                        onReveal={() => handleReveal(u.id)}
                        type="nom"
                      />
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider flex-shrink-0 ${
                    u.role === 'super_admin' ? 'bg-purple-500/20 text-purple-300' :
                    u.role === 'gerant' ? 'bg-sky-500/20 text-sky-300' :
                    'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {u.role}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[9px] uppercase tracking-wider text-admin-text-muted">Email</span>
                    <span className="font-semibold text-admin-text truncate">
                      <MaskedValue 
                        maskedText={u.email_masque || '***@***.**'}
                        revealedText={revealedDetails[u.id]?.email}
                        status={revealStates[u.id] || 'hidden'}
                        onReveal={() => handleReveal(u.id)}
                        type="email"
                      />
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[9px] uppercase tracking-wider text-admin-text-muted">Boutique</span>
                    <span className="font-semibold text-admin-text truncate">
                      {u.boutique_nom || u.boutiques?.nom || <span className="text-admin-text-muted italic">Non assignée</span>}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] uppercase tracking-wider text-admin-text-muted">Créé le</span>
                    <span className="font-medium text-admin-text">
                      {new Date(u.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] uppercase tracking-wider text-admin-text-muted">Statut</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider w-fit ${STATUS_BADGE[u.status || 'active']?.className || STATUS_BADGE.active.className}`}>
                      {STATUS_BADGE[u.status || 'active']?.label || u.status}
                    </span>
                  </div>
                </div>

                <div className="border-t border-admin-border/50 pt-3 flex justify-end gap-2 flex-wrap">
                  <button
                    onClick={() => handleOpenEdit(u)}
                    className="h-8 px-3 bg-admin-primary/20 hover:bg-admin-primary/30 text-admin-primary-light font-black uppercase rounded-lg tracking-wider active:scale-95 transition-all text-[9px] cursor-pointer"
                  >
                    Modifier
                  </button>
                  <button
                    disabled
                    className="h-8 px-3 bg-admin-border/30 text-admin-text-muted font-black uppercase rounded-lg tracking-wider text-[9px] cursor-not-allowed opacity-50"
                  >
                    Reset MDP
                  </button>
                  {u.role !== 'super_admin' && u.status === 'banned' && (
                    <button
                      onClick={() => handleOpenModerate(u, 'lift_ban')}
                      className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase rounded-lg tracking-wider active:scale-95 transition-all text-[9px] cursor-pointer"
                    >
                      Lever le bannissement
                    </button>
                  )}
                  {u.role !== 'super_admin' && getAvailableActions(u.status).length > 0 && (
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenMenuUserId(openMenuUserId === u.id ? null : u.id)}
                        className="h-8 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black uppercase rounded-lg tracking-wider active:scale-95 transition-all text-[9px] cursor-pointer"
                      >
                        Modérer
                      </button>
                      {openMenuUserId === u.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuUserId(null)} />
                          <div className="absolute right-0 top-full mt-1 bg-admin-card border border-admin-border rounded-xl shadow-xl overflow-hidden z-20 py-1 flex flex-col min-w-[180px]">
                            {getAvailableActions(u.status).map(a => (
                              <button
                                key={a.key}
                                onClick={() => handleOpenModerate(u, a.key)}
                                className={`px-4 py-2.5 text-[10px] font-bold text-left hover:bg-admin-surface transition-colors cursor-pointer whitespace-nowrap ${
                                  a.key === 'delete' ? 'text-red-500 hover:text-red-600 font-black flex items-center gap-1.5' : 'text-admin-text'
                                }`}
                              >
                                {a.key === 'delete' && <span className="material-symbols-outlined text-xs">warning</span>}
                                {a.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Edit User */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleUpdateUser} className="bg-admin-card rounded-2xl p-6 max-w-sm w-full relative shadow-xl text-left border border-admin-border flex flex-col gap-4 animate-scale-in">
            <h3 className="text-sm font-black text-admin-text uppercase">👤 Modifier l'Utilisateur</h3>
            <p className="text-[10px] text-admin-text-muted font-mono leading-relaxed truncate">
              ID : {editingUser.id}
            </p>
            
              <Select
                label="Rôle Assigné"
                value={editRole}
                onChange={(val) => setEditRole(val as any)}
                options={[
                  { value: 'caissier', label: 'Caissier' },
                  { value: 'gerant', label: 'Gérant' },
                  { value: 'super_admin', label: 'Super Admin' },
                ]}
                isAdmin={true}
              />

              <Select
                label="Boutique d'Affiliation"
                value={editBoutiqueId}
                onChange={(val) => setEditBoutiqueId(val)}
                options={[
                  { value: 'null', label: 'Aucune boutique' },
                  ...boutiques.map(b => ({ value: b.id, label: b.nom }))
                ]}
                isAdmin={true}
              />

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="flex-1 h-10 border border-admin-border hover:bg-admin-surface text-admin-text text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="flex-1 h-10 bg-admin-primary hover:bg-admin-primary-light disabled:opacity-50 text-white text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                {isUpdating ? 'ENREGISTREMENT...' : 'SAUVEGARDER'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Moderate User */}
      {moderatingUser && moderateAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-admin-card rounded-2xl p-6 max-w-sm w-full relative shadow-xl text-left border border-admin-border flex flex-col gap-4 animate-scale-in">
            <h3 className="text-sm font-black text-admin-text uppercase">⚠️ {ACTION_CONFIRM_LABEL[moderateAction]}</h3>
            <p className="text-[10px] text-admin-text-muted font-mono leading-relaxed truncate">
              ID : {moderatingUser.id}
            </p>

            {moderateAction === 'banned' && (
              <div className="p-3 bg-red-950/30 border border-red-900/40 rounded-xl text-red-300 text-[10px] leading-relaxed flex flex-col gap-1">
                <strong>Procédure de Sécurité Maximale :</strong>
                <span>Le bannissement bloque immédiatement toutes les sessions actives. Cette action requiert ensuite une levée de bannissement manuelle explicite.</span>
              </div>
            )}

            {moderateAction === 'delete' && (
              <p className="text-[11px] text-amber-400 leading-relaxed">
                Le nom, le téléphone et l'email seront anonymisés. L'historique des ventes et transactions
                de cette boutique n'est jamais supprimé.
              </p>
            )}

            {moderateError && (
              <div className="p-2.5 bg-red-950/20 border border-red-900/40 rounded-lg text-red-400 text-[10px]">
                {moderateError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-admin-text-muted">
                Raison {moderateAction === 'reactivate' || moderateAction === 'lift_ban' ? '(optionnelle)' : '(obligatoire, min 10 car. pour bannir)'}
              </label>
              <textarea
                value={moderateReason}
                onChange={(e) => setModerateReason(e.target.value)}
                rows={3}
                placeholder={moderateAction === 'banned' ? "Saisir la raison obligatoire (ex: Multiples fraudes de caisse...)" : "Ex: Comportement frauduleux signalé par plusieurs boutiques..."}
                className="w-full bg-admin-surface border border-admin-border rounded-xl p-3 text-xs text-admin-text focus:outline-none focus:border-admin-primary resize-none"
              />
            </div>

            {moderateAction === 'delete' && (
              <div className="flex flex-col gap-2 border-t border-admin-border/50 pt-3">
                <label className="text-[10px] font-black uppercase tracking-wider text-red-400">
                  Confirmation requise : Écrire "SUPPRIMER"
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Écrire SUPPRIMER pour valider"
                  className="w-full h-10 bg-admin-surface border border-admin-border rounded-xl px-3 text-xs text-admin-text focus:outline-none focus:border-admin-primary"
                />
              </div>
            )}

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => { setModeratingUser(null); setModerateAction(null); }}
                disabled={isModerating}
                className="flex-1 h-10 border border-admin-border hover:bg-admin-surface text-admin-text text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmModerate}
                disabled={
                  isModerating ||
                  (moderateAction === 'banned' && moderateReason.trim().length < 10) ||
                  (moderateAction === 'delete' && deleteConfirmText !== 'SUPPRIMER')
                }
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                {isModerating ? 'TRAITEMENT...' : 'CONFIRMER'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
