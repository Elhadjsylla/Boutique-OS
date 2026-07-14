import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { callRpcWithRetry } from '../../lib/supabase-rpc';
import { formatMontantCompact } from '../../lib/format';

interface Boutique {
  id: string;
  nom: string;
  adresse: string | null;
  suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  gerant_id: string | null;
}

interface BoutiqueDetails {
  id: string;
  nom: string;
  adresse: string | null;
  suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  gerant: { id: string; email: string; role: string } | null;
  stats: {
    total_users: number;
    total_products: number;
    total_sales: number;
    ca_total: number;
    ca_month: number;
    open_ardoises: number;
    ardoises_amount: number;
  };
}

export const AdminBoutiques: React.FC = () => {
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoutiqueId, setSelectedBoutiqueId] = useState<string | null>(null);
  const [selectedBoutiqueDetails, setSelectedBoutiqueDetails] = useState<BoutiqueDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Suspension Modals State
  const [suspendingBoutique, setSuspendingBoutique] = useState<Boutique | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  
  // Creation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newBoutiqueName, setNewBoutiqueName] = useState('');
  const [newBoutiqueAddress, setNewBoutiqueAddress] = useState('');
  const [newBoutiqueGerantEmail, setNewBoutiqueGerantEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const fetchBoutiques = async (retryCount = 0) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (retryCount < 3) {
          await new Promise(r => setTimeout(r, 1500));
          return fetchBoutiques(retryCount + 1);
        }
        throw new Error('Session expirée — veuillez vous reconnecter');
      }
      const { data, error: rpcErr } = await callRpcWithRetry('sys_get_boutiques');
      if (rpcErr) throw rpcErr;
      setBoutiques((data as Boutique[] | null) || []);
      setError(null);
    } catch (e: any) {
      const isAuthError = e?.code === '42501' || e?.message?.includes('Accès refusé');
      if (isAuthError && retryCount < 2) {
        try { await supabase.auth.refreshSession(); } catch (_) {}
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return fetchBoutiques(retryCount + 1);
      }
      console.error('[AdminBoutiques] Erreur:', e?.message ?? e);
      setError(e.message || 'Erreur de chargement des boutiques');
      setBoutiques([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoutiques();
  }, []);

  const handleOpenDetails = async (id: string) => {
    setSelectedBoutiqueId(id);
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const { data, error } = await callRpcWithRetry('sys_boutique_details', { boutique_uuid: id });
      if (error) throw error;
      setSelectedBoutiqueDetails(data);
    } catch (e: any) {
      console.error('[AdminBoutiques] Erreur de chargement des détails de la boutique:', e);
      setDetailsError(e.message || 'Erreur de chargement des détails de la boutique.');
      setSelectedBoutiqueDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleToggleSuspend = async (b: Boutique, actionSuspend: boolean) => {
    try {
      const { error } = await callRpcWithRetry('sys_toggle_boutique_suspend', {
        boutique_uuid: b.id,
        suspend: actionSuspend,
        reason: actionSuspend ? suspendReason : null
      });
      if (error) throw error;
      
      setSuspendingBoutique(null);
      setSuspendReason('');
      fetchBoutiques();
      if (selectedBoutiqueId === b.id) {
        handleOpenDetails(b.id);
      }
    } catch (e: any) {
      alert("Erreur : " + e.message);
    }
  };

  const handleCreateBoutique = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoutiqueName.trim()) return;

    setIsCreating(true);
    try {
      const { error } = await supabase.functions.invoke('create-boutique', {
        body: {
          nom: newBoutiqueName.trim(),
          adresse: newBoutiqueAddress.trim() || null,
          gerant_email: newBoutiqueGerantEmail.trim() || null
        }
      });
      if (error) throw error;
      
      setIsCreateModalOpen(false);
      setNewBoutiqueName('');
      setNewBoutiqueAddress('');
      setNewBoutiqueGerantEmail('');
      fetchBoutiques();
    } catch (err: any) {
      alert("Erreur lors de la création de la boutique : " + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-admin-text uppercase tracking-wider">Gestion Boutiques</h1>
          <p className="text-xs text-admin-text-muted">Créez, suspendez et inspectez les points de vente Sama Boutik.</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="h-10 px-4 bg-admin-primary hover:bg-admin-primary-light text-white text-[10px] font-black rounded-xl uppercase tracking-wider transition-all active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">add_business</span>
          Nouvelle Boutique
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-red-400 text-xs">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchBoutiques()}
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
      ) : boutiques.length === 0 ? (
        <div className="p-8 bg-admin-card border border-admin-border rounded-2xl text-center text-admin-text-muted">
          Aucune boutique enregistrée.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* List Card */}
          <div className="bg-admin-card border border-admin-border rounded-2xl p-4 flex flex-col gap-3">
            <h2 className="text-[10px] font-black uppercase tracking-wider text-admin-text-muted border-b border-admin-border pb-2">
              Toutes les Boutiques ({boutiques.length})
            </h2>
            <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
              {boutiques.map(b => (
                <div
                  key={b.id}
                  onClick={() => handleOpenDetails(b.id)}
                  className={`p-3.5 border rounded-xl flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] ${
                    selectedBoutiqueId === b.id
                      ? 'bg-admin-primary/10 border-admin-primary'
                      : 'border-admin-border hover:bg-admin-surface/30'
                  }`}
                >
                  <div className="flex flex-col text-left gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-admin-text truncate">{b.nom}</span>
                      {b.suspended && (
                        <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-[8px] font-black uppercase tracking-wider">
                          Suspendue
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-admin-text-muted truncate">
                      {b.adresse || 'Sans adresse'} • Créée le {new Date(b.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-admin-text-muted">chevron_right</span>
                </div>
              ))}
            </div>
          </div>

          {/* Details & Action Card */}
          <div className="bg-admin-card border border-admin-border rounded-2xl p-5 flex flex-col gap-4">
            <h2 className="text-[10px] font-black uppercase tracking-wider text-admin-text-muted border-b border-admin-border pb-2">
              Détails & Actions Administration
            </h2>
            
            {detailsLoading ? (
              <div className="flex flex-col justify-center items-center py-20 text-admin-text-muted">
                <div className="w-8 h-8 border-3 border-admin-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : detailsError ? (
              <div className="p-5 bg-red-950/20 border border-red-900/40 rounded-xl flex flex-col items-center gap-3 text-center">
                <span className="material-symbols-outlined text-red-400 text-3xl">error</span>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-bold text-red-400">Impossible de charger cette section</p>
                  <p className="text-[10px] text-admin-text-muted/80">{detailsError}</p>
                </div>
                {selectedBoutiqueId && (
                  <button
                    onClick={() => handleOpenDetails(selectedBoutiqueId)}
                    className="h-8 px-4 bg-red-900/30 hover:bg-red-900/50 border border-red-800 text-red-400 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                  >
                    Réessayer
                  </button>
                )}
              </div>
            ) : selectedBoutiqueDetails ? (
              <div className="flex flex-col gap-4 animate-scale-in">
                {/* Header */}
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-black text-admin-text">{selectedBoutiqueDetails.nom}</h3>
                  <span className="text-[10px] text-admin-text-muted">{selectedBoutiqueDetails.adresse || 'Adresse non configurée'}</span>
                  <span className="text-[8px] font-mono text-admin-text-muted mt-0.5">ID: {selectedBoutiqueDetails.id}</span>
                </div>

                {/* Status card */}
                {selectedBoutiqueDetails.suspended ? (
                  <div className="p-3 bg-red-950/20 border border-red-900/40 text-red-300 rounded-xl text-xs flex flex-col gap-1.5">
                    <p className="font-bold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">lock</span>
                      Cette boutique est actuellement suspendue
                    </p>
                    <p className="opacity-80">Motif : {selectedBoutiqueDetails.suspended_reason || 'Non spécifié'}</p>
                    <button
                      onClick={() => handleToggleSuspend(selectedBoutiqueDetails as any, false)}
                      className="mt-1.5 h-8 bg-emerald-700 hover:bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                    >
                      Réactiver la Boutique
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 rounded-xl text-xs flex justify-between items-center">
                    <p className="font-bold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Boutique active
                    </p>
                    <button
                      onClick={() => setSuspendingBoutique(selectedBoutiqueDetails as any)}
                      className="h-8 px-3 bg-red-800 hover:bg-red-700 text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                    >
                      Suspendre
                    </button>
                  </div>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-1">
                  {[
                    { label: "Utilisateurs", val: selectedBoutiqueDetails.stats.total_users, desc: "Personnel assigné" },
                    { label: "Produits en Stock", val: selectedBoutiqueDetails.stats.total_products, desc: "Hors archivés" },
                    { label: "Ventes Totales", val: selectedBoutiqueDetails.stats.total_sales, desc: "Transactions" },
                    { label: "Chiffre d'Affaires", val: `${formatMontantCompact(selectedBoutiqueDetails.stats.ca_total)} F`, desc: "Total historique" }
                  ].map((s, i) => (
                    <div key={i} className="p-2.5 sm:p-3 bg-admin-surface border border-admin-border/60 rounded-xl flex flex-col justify-between min-h-[5.5rem] shadow-sm gap-1 overflow-hidden">
                      <span className="text-[8px] sm:text-[9px] font-bold text-admin-text-muted uppercase tracking-wide leading-tight break-words">{s.label}</span>
                      <span className="text-sm font-black text-admin-text truncate">{s.val}</span>
                      <span className="text-[7px] sm:text-[8px] text-admin-text-muted font-semibold truncate">{s.desc}</span>
                    </div>
                  ))}
                </div>

                {/* Manager */}
                <div className="border-t border-admin-border/40 pt-3 flex flex-col gap-1.5">
                  <span className="text-[9px] font-bold text-admin-text-muted uppercase tracking-wide">Gérant de la Boutique</span>
                  {selectedBoutiqueDetails.gerant ? (
                    <div className="p-2.5 bg-admin-surface border border-admin-border/60 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-bold text-admin-text truncate">{selectedBoutiqueDetails.gerant.email}</span>
                      <span className="px-1.5 py-0.5 bg-admin-primary/20 text-admin-primary-light rounded text-[8px] font-bold uppercase">Gérant</span>
                    </div>
                  ) : (
                    <span className="text-xs text-admin-text-muted italic">Aucun gérant assigné à cette boutique.</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-admin-text-muted text-xs italic">
                Sélectionnez une boutique pour afficher ses statistiques et outils de modération.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Suspend Reason input */}
      {suspendingBoutique && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-admin-card rounded-2xl p-6 max-w-sm w-full relative shadow-xl text-left border border-admin-border flex flex-col gap-4 animate-scale-in">
            <h3 className="text-sm font-black text-red-400 uppercase">⚠️ Suspendre {suspendingBoutique.nom}</h3>
            <p className="text-[11px] text-admin-text-muted leading-relaxed">
              Veuillez indiquer le motif de la suspension. Le personnel de cette boutique ne pourra plus effectuer d'opérations de caisse ni de gestion.
            </p>
            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                required
                placeholder="Ex: Facture impayée depuis le 01/06"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="w-full h-11 px-4 text-xs bg-admin-surface border border-admin-border rounded-xl text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-primary/40"
              />
            </div>
            <div className="flex gap-2.5 mt-2">
              <button
                onClick={() => {
                  setSuspendingBoutique(null);
                  setSuspendReason('');
                }}
                className="flex-1 h-10 border border-admin-border hover:bg-admin-surface text-admin-text text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                disabled={!suspendReason.trim()}
                onClick={() => handleToggleSuspend(suspendingBoutique, true)}
                className="flex-1 h-10 bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Creation Boutique */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateBoutique} className="bg-admin-card rounded-2xl p-6 max-w-sm w-full relative shadow-xl text-left border border-admin-border flex flex-col gap-4 animate-scale-in">
            <h3 className="text-sm font-black text-admin-text uppercase">🏪 Nouvelle Boutique</h3>
            <p className="text-[11px] text-admin-text-muted leading-relaxed">
              Configurez le point de vente et associez-y éventuellement un gérant. Un email d'invitation lui sera envoyé le cas échéant.
            </p>
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase tracking-wider text-admin-text-muted">Nom de la Boutique</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Boutique Medina"
                  value={newBoutiqueName}
                  onChange={(e) => setNewBoutiqueName(e.target.value)}
                  className="w-full h-11 px-4 text-xs bg-admin-surface border border-admin-border rounded-xl text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-primary/40"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase tracking-wider text-admin-text-muted">Adresse</label>
                <input
                  type="text"
                  placeholder="Ex: Dakar, Avenue Cheikh Anta Diop"
                  value={newBoutiqueAddress}
                  onChange={(e) => setNewBoutiqueAddress(e.target.value)}
                  className="w-full h-11 px-4 text-xs bg-admin-surface border border-admin-border rounded-xl text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-primary/40"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase tracking-wider text-admin-text-muted">E-mail Gérant (Optionnel)</label>
                <input
                  type="email"
                  placeholder="Ex: gerant@email.com"
                  value={newBoutiqueGerantEmail}
                  onChange={(e) => setNewBoutiqueGerantEmail(e.target.value)}
                  className="w-full h-11 px-4 text-xs bg-admin-surface border border-admin-border rounded-xl text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-primary/40"
                />
              </div>
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setNewBoutiqueName('');
                  setNewBoutiqueAddress('');
                  setNewBoutiqueGerantEmail('');
                }}
                className="flex-1 h-10 border border-admin-border hover:bg-admin-surface text-admin-text text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isCreating || !newBoutiqueName.trim()}
                className="flex-1 h-10 bg-admin-primary hover:bg-admin-primary-light disabled:opacity-50 text-white text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                {isCreating ? 'CRÉATION...' : 'CRÉER'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
