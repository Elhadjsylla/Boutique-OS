import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Select } from '../../components/ui/Select';
import { MaskedValue } from '../../components/admin/MaskedValue';
import { useRevealUser } from '../../hooks/useRevealUser';

interface Profile {
  id: string;
  nom_masque?: string;
  email_masque?: string;
  role: string;
  boutique_id?: string | null;
  boutique_nom?: string;
  created_at: string;
  boutiques?: { nom: string } | null;
}

interface Boutique {
  id: string;
  nom: string;
}

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [loading, setLoading] = useState(true);

  // Reveal State
  const { revealStates, revealedDetails, handleReveal } = useRevealUser();

  // Edit State
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<'caissier' | 'gerant' | 'super_admin'>('caissier');
  const [editBoutiqueId, setEditBoutiqueId] = useState<string>('null');
  const [isUpdating, setIsUpdating] = useState(false);

  const [error, setError] = useState<string | null>(null);

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
        supabase.rpc('get_users_list_masked'),
        supabase.rpc('sys_get_boutiques'),
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
      const { error } = await supabase.rpc('assign_staff', {
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

  return (
    <div className="flex flex-col gap-6 text-left">
      <div>
        <h1 className="text-xl font-black text-admin-text uppercase tracking-wider">Gestion Utilisateurs</h1>
        <p className="text-xs text-admin-text-muted">Affichez les profils utilisateurs et réassignez les rôles et boutiques.</p>
      </div>

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
        <div className="bg-admin-card border border-admin-border rounded-2xl p-4 overflow-x-auto shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-admin-border text-admin-text-muted uppercase tracking-wider">
                <th className="py-3 px-4 font-black">ID Utilisateur</th>
                <th className="py-3 px-4 font-black">Nom</th>
                <th className="py-3 px-4 font-black">Email</th>
                <th className="py-3 px-4 font-black">Rôle</th>
                <th className="py-3 px-4 font-black">Boutique</th>
                <th className="py-3 px-4 font-black">Créé le</th>
                <th className="py-3 px-4 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-admin-border/50 hover:bg-admin-surface/20 text-admin-text">
                  <td className="py-3 px-4 font-mono select-all truncate max-w-[120px]" title={u.id}>
                    {u.id}
                  </td>
                  <td className="py-3 px-4 truncate max-w-[150px]">
                    <MaskedValue 
                      maskedText={u.nom_masque || 'Anonyme'}
                      revealedText={revealedDetails[u.id]?.nom}
                      status={revealStates[u.id] || 'hidden'}
                      onReveal={() => handleReveal(u.id)}
                      type="nom"
                    />
                  </td>
                  <td className="py-3 px-4 truncate max-w-[180px]">
                    <MaskedValue 
                      maskedText={u.email_masque || '***@***.**'}
                      revealedText={revealedDetails[u.id]?.email}
                      status={revealStates[u.id] || 'hidden'}
                      onReveal={() => handleReveal(u.id)}
                      type="email"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                      u.role === 'super_admin' ? 'bg-purple-500/20 text-purple-300' :
                      u.role === 'gerant' ? 'bg-sky-500/20 text-sky-300' :
                      'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 truncate max-w-[150px]" title={u.boutique_nom || u.boutiques?.nom || 'Aucune'}>
                    {u.boutique_nom || u.boutiques?.nom || <span className="text-admin-text-muted italic">Non assignée</span>}
                  </td>
                  <td className="py-3 px-4 text-admin-text-muted">
                    {new Date(u.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="py-3 px-4 text-right flex justify-end gap-2">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="h-8 px-3 bg-admin-primary/20 hover:bg-admin-primary/30 text-admin-primary-light font-black uppercase rounded-lg tracking-wider active:scale-95 transition-all text-[9px] cursor-pointer"
                    >
                      Modifier
                    </button>

                    <div className="relative group inline-block">
                      <button
                        disabled
                        className="h-8 px-3 bg-admin-border/30 text-admin-text-muted font-black uppercase rounded-lg tracking-wider text-[9px] cursor-not-allowed opacity-50"
                      >
                        Reset MDP
                      </button>
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-admin-surface border border-admin-border text-admin-text text-[9px] font-semibold py-1 px-2 rounded shadow-lg whitespace-nowrap z-10">
                        Bientôt disponible (SMTP)
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </div>
  );
};
