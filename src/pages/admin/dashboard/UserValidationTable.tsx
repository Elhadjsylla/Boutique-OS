import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { DetailDrawer } from './DetailDrawer';

interface PendingUser {
  id: string;
  nom: string;
  prenom: string;
  email_masque: string;
  telephone_masque: string;
  created_at: string;
  role_demande: string;
  boutique_nom: string;
}

export const UserValidationTable: React.FC = () => {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPendingUsers = async () => {
    try {
      const { data, error } = await supabase.rpc('get_users_pending_validation');
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Erreur fetch pending users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUsers();

    const channel = supabase.channel('admin-pending-users')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profils', filter: 'status=eq.pending' },
        () => {
          fetchPendingUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openUserDetails = async (id: string) => {
    setSelectedUserId(id);
    setLoadingDetails(true);
    setShowRejectInput(false);
    setRejectReason('');
    try {
      const { data, error } = await supabase.rpc('get_user_full_details', { p_user_id: id });
      if (error) throw error;
      setUserDetails(data);
    } catch (err) {
      console.error('Erreur fetch user details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedUserId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('approve_user', { p_user_id: selectedUserId });
      if (error) throw error;
      setUsers(prev => prev.filter(u => u.id !== selectedUserId));
      setSelectedUserId(null);
    } catch (err) {
      console.error('Erreur approve user:', err);
      alert("Erreur lors de l'approbation.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedUserId) return;
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('reject_user', { p_user_id: selectedUserId, p_raison: rejectReason });
      if (error) throw error;
      setUsers(prev => prev.filter(u => u.id !== selectedUserId));
      setSelectedUserId(null);
    } catch (err) {
      console.error('Erreur reject user:', err);
      alert('Erreur lors du rejet.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="h-64 w-full bg-admin-card animate-pulse rounded-xl"></div>;
  }

  if (users.length === 0) {
    return (
      <div className="bg-admin-card rounded-xl p-8 border border-admin-border text-center">
        <span className="material-symbols-outlined text-4xl text-admin-text-muted mb-3">check_circle</span>
        <h3 className="text-lg font-bold text-admin-text">Aucun compte en attente</h3>
        <p className="text-sm text-admin-text-muted mt-1">Tous les comptes ont été traités.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-admin-card rounded-xl border border-admin-border overflow-hidden">
        <div className="p-5 border-b border-admin-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-black tracking-tight text-admin-text">Comptes à valider ({users.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-admin-surface text-admin-text-muted text-[10px] uppercase tracking-wider font-bold">
              <tr>
                <th className="px-5 py-3">Boutique</th>
                <th className="px-5 py-3">Utilisateur</th>
                <th className="px-5 py-3">Rôle demandé</th>
                <th className="px-5 py-3">Date de création</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {users.map((user) => (
                <tr 
                  key={user.id} 
                  className="hover:bg-admin-surface/50 transition-colors cursor-pointer"
                  onClick={() => openUserDetails(user.id)}
                >
                  <td className="px-5 py-4 font-bold text-admin-text">{user.boutique_nom}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-admin-text">{user.prenom} {user.nom}</span>
                      <span className="text-xs text-admin-text-muted">{user.email_masque}</span>
                      <span className="text-xs text-admin-text-muted">{user.telephone_masque}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="px-2 py-1 bg-admin-primary/10 text-admin-primary rounded-lg text-[10px] uppercase font-black tracking-wider">
                      {user.role_demande}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-admin-text-muted text-xs">
                    {new Date(user.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button className="p-2 text-admin-primary hover:bg-admin-primary/10 rounded-xl transition-colors">
                      <span className="material-symbols-outlined text-sm">visibility</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DetailDrawer
        isOpen={selectedUserId !== null}
        onClose={() => setSelectedUserId(null)}
        title="Détails du compte"
        width="lg"
      >
        {loadingDetails || !userDetails ? (
          <div className="flex flex-col gap-4">
            <div className="h-20 bg-admin-surface border border-admin-border animate-pulse rounded-xl"></div>
            <div className="h-48 bg-admin-surface border border-admin-border animate-pulse rounded-xl"></div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="p-5 bg-admin-card rounded-xl border border-admin-border">
              <h3 className="text-sm font-black uppercase text-admin-text-muted mb-4">Informations personnelles</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-admin-text-muted mb-1">Nom complet</span>
                  <span className="font-bold text-admin-text">{userDetails.prenom} {userDetails.nom}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-admin-text-muted mb-1">Email</span>
                  <span className="font-bold text-admin-text">{userDetails.email}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-admin-text-muted mb-1">Téléphone</span>
                  <span className="font-bold text-admin-text">{userDetails.telephone || 'Non renseigné'}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-admin-text-muted mb-1">Date de création</span>
                  <span className="font-bold text-admin-text">{new Date(userDetails.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-admin-card rounded-xl border border-admin-border">
              <h3 className="text-sm font-black uppercase text-admin-text-muted mb-4">Informations Boutique</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-admin-text-muted mb-1">Nom boutique</span>
                  <span className="font-bold text-admin-text">{userDetails.boutique?.nom || 'Inconnue'}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-admin-text-muted mb-1">Rôle demandé</span>
                  <span className="font-bold text-admin-primary">{userDetails.role}</span>
                </div>
                {userDetails.boutique?.adresse && (
                  <div className="col-span-2">
                    <span className="block text-[10px] uppercase tracking-wider text-admin-text-muted mb-1">Adresse</span>
                    <span className="text-admin-text">{userDetails.boutique.adresse}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-4">
              {showRejectInput && (
                <div className="flex flex-col gap-2 mb-2 animate-fade-in">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-admin-text-muted">Raison du refus (optionnelle)</label>
                  <textarea 
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full bg-admin-surface border border-admin-border rounded-xl p-3 text-sm text-admin-text focus:outline-none focus:border-admin-primary resize-none"
                    rows={3}
                    placeholder="Ex: Pièce d'identité non valide..."
                  />
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  {showRejectInput ? 'Confirmer le refus' : 'Refuser'}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading || showRejectInput}
                  className={`flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-green-500/20 disabled:opacity-50 ${showRejectInput ? 'hidden' : ''}`}
                >
                  Valider le compte
                </button>
                {showRejectInput && (
                  <button
                    onClick={() => setShowRejectInput(false)}
                    disabled={actionLoading}
                    className="flex-1 py-3 bg-admin-surface hover:bg-admin-border text-admin-text border border-admin-border font-bold rounded-xl transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </>
  );
};
