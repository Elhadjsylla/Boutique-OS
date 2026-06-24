import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Toast } from '../components/ui/Toast';
import { db } from '../db/dexie';

interface SettingsProps {
  session: any;
  onLogout: () => void;
  activePlan?: string;
  onManageSubscription?: () => void;
  onNavigateToPortal?: () => void;
  onActivateAdmin?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  session, 
  onLogout,
  activePlan = 'Starter',
  onManageSubscription,
  onNavigateToPortal,
  onActivateAdmin
}) => {
  const user = session.user;
  const boutiqueId = user.user_metadata?.boutique_id || 'boutique-1';
  const initialBoutiqueName = user.user_metadata?.boutique_name || 'Ma Boutique';
  const userRole = user.user_metadata?.role || 'caissier';
  const userEmail = user.email;

  const [teamProfiles, setTeamProfiles] = useState<any[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'caissier' | 'gerant'>('caissier');
  const [isInviting, setIsInviting] = useState(false);

  const fetchTeam = async () => {
    try {
      const { data: profs } = await supabase
        .from('profils')
        .select('*')
        .eq('boutique_id', boutiqueId);
      if (profs) setTeamProfiles(profs);

      const { data: invs } = await supabase
        .from('invitations')
        .select('*')
        .eq('boutique_id', boutiqueId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());
      if (invs) setPendingInvitations(invs);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [boutiqueId]);

  const [boutiqueName, setBoutiqueName] = useState(initialBoutiqueName);
  const [seuilAlerte, setSeuilAlerte] = useState(parseInt(localStorage.getItem('seuil_alerte_global') || '5'));
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleSaveSettings = () => {
    setIsSaving(true);
    localStorage.setItem('seuil_alerte_global', seuilAlerte.toString());
    
    // Simulate savings animation
    setTimeout(() => {
      setIsSaving(false);
      setToast({ message: "Paramètres enregistrés avec succès !", type: "success" });
    }, 800);
  };

  const handleExportDB = async () => {
    const tableNames = ['produits', 'ventes', 'vente_items', 'ardoises', 'ardoise_paiements'];
    const exportData: Record<string, any[]> = {};
    
    for (const name of tableNames) {
      exportData[name] = await db.table(name).toArray();
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `boutique_os_export_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="pb-40 pt-20 px-4 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in text-left">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div>
        <h1 className="font-headline-lg-mobile text-on-surface">Configuration</h1>
        <p className="font-body-md text-on-surface-variant">Ajustez vos préférences et gérez les détails de votre compte.</p>
      </div>

      {/* Account Profile Card */}
      <Card elevation={1} className="p-4 flex flex-col gap-4 relative overflow-hidden bg-gradient-to-r from-primary-container/20 to-transparent border border-outline-variant/40">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-black text-lg shadow-md">
            {boutiqueName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <h3 className="text-base font-black text-on-surface leading-tight">{boutiqueName}</h3>
            <span className="text-xs text-outline font-medium mt-0.5">{userEmail}</span>
            <span className="text-[9px] uppercase font-black text-primary bg-primary-container/30 px-2 py-0.5 rounded-full w-fit mt-1.5 border border-primary/10">
              Role: {userRole}
            </span>
          </div>
        </div>
      </Card>

      {/* Subscription Card */}
      <Card elevation={1} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden bg-gradient-to-r from-secondary-container/10 to-transparent border border-secondary-container/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary-container/30 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-lg">workspace_premium</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-outline font-black uppercase tracking-wider">Abonnement Actuel</span>
            <span className="text-sm font-black text-primary uppercase">{activePlan}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onManageSubscription}
          className="h-9 px-4 bg-primary text-white text-[10px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">credit_card</span>
          Gérer / Mettre à niveau
        </button>
      </Card>

      {/* Team Management Card */}
      <Card elevation={1} className="p-4 flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-outline-variant/40 pb-3">
          <div className="flex flex-col text-left">
            <h3 className="text-xs text-on-surface font-extrabold uppercase tracking-wider">
              Gestion de l'Équipe
            </h3>
            <span className="text-[9px] text-outline">Gérez vos caissiers et gérants d'établissement.</span>
          </div>
          {(() => {
            const activeCount = teamProfiles.filter(p => p.role === 'caissier').length;
            const pendingCount = pendingInvitations.filter(i => i.role === 'caissier').length;
            const total = activeCount + pendingCount;
            const limit = activePlan.toLowerCase() === 'pro' ? 3 : activePlan.toLowerCase() === 'annual' ? 9999 : 1;
            const isLimit = total >= limit;
            return (
              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black border ${
                isLimit ? 'bg-error/20 text-error border-error/30' : 'bg-secondary/20 text-secondary border-secondary/30'
              }`}>
                Caissiers : {total} / {limit === 9999 ? '∞' : limit}
              </span>
            );
          })()}
        </div>

        {/* Member list */}
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
          {teamProfiles.map((member) => (
            <div key={member.id} className="p-2.5 bg-surface-container/30 border border-outline-variant/60 rounded-xl flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline text-lg">person</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">{member.id === user.id ? 'Vous' : member.id.slice(0, 8)}</span>
                  <span className="text-[9px] text-outline uppercase font-black">{member.role}</span>
                </div>
              </div>
              <span className="text-[9px] text-secondary font-black uppercase tracking-wider bg-secondary/15 px-2 py-0.5 rounded-full">Actif</span>
            </div>
          ))}
          {pendingInvitations.map((inv) => (
            <div key={inv.id} className="p-2.5 bg-surface-container/20 border border-outline-variant/40 rounded-xl flex justify-between items-center opacity-75">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline text-lg">mail</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface truncate max-w-[120px]">{inv.email}</span>
                  <span className="text-[9px] text-outline uppercase font-black">{inv.role}</span>
                </div>
              </div>
              <span className="text-[9px] text-amber-600 font-black uppercase tracking-wider bg-amber-500/15 px-2 py-0.5 rounded-full">En attente</span>
            </div>
          ))}
        </div>

        {/* Invitation form */}
        <div className="flex flex-col gap-3.5 border-t border-outline-variant/40 pt-4">
          <div className="flex gap-2">
            <div className="flex-[3]">
              <Input 
                label="Email du nouveau membre" 
                value={inviteEmail} 
                onChange={(e) => setInviteEmail(e.target.value)} 
                placeholder="Ex: caissier@boutik.com"
                type="email"
              />
            </div>
            <div className="flex-[2] flex flex-col gap-1.5 text-left">
              <label className="text-[9px] text-outline font-black uppercase tracking-wider">Rôle</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="h-10 px-3 bg-white border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="caissier">Caissier</option>
                <option value="gerant">Gérant</option>
              </select>
            </div>
          </div>

          {(() => {
            const activeCount = teamProfiles.filter(p => p.role === 'caissier').length;
            const pendingCount = pendingInvitations.filter(i => i.role === 'caissier').length;
            const total = activeCount + pendingCount;
            const limit = activePlan.toLowerCase() === 'pro' ? 3 : activePlan.toLowerCase() === 'annual' ? 9999 : 1;
            const isLimit = total >= limit;

            if (isLimit && inviteRole === 'caissier') {
              return (
                <div className="p-3 bg-error-container/40 border border-error/20 rounded-xl text-left flex gap-2.5">
                  <span className="material-symbols-outlined text-error text-lg mt-0.5">warning</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-on-surface">Limite de caissiers atteinte</span>
                    <span className="text-[9px] text-outline leading-normal mt-0.5">
                      Votre forfait actuel ({activePlan}) limite le nombre de caissiers à {limit === 9999 ? 'illimité' : limit}. 
                      Veuillez mettre à niveau vers le plan supérieur pour inviter d'autres membres.
                    </span>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          <button
            type="button"
            onClick={async () => {
              if (!inviteEmail.trim()) return;
              setIsInviting(true);
              try {
                const { data, error } = await supabase.functions.invoke('invite-user', {
                  body: { email: inviteEmail.trim(), role: inviteRole, boutique_id: boutiqueId }
                });
                if (error || data?.error) {
                  setToast({ message: data?.error || 'Erreur lors de l\'invitation.', type: 'error' });
                } else {
                  setToast({ message: 'Invitation envoyée avec succès !', type: 'success' });
                  setInviteEmail('');
                  fetchTeam();
                }
              } catch (e: any) {
                setToast({ message: e.message || 'Erreur lors de l\'invitation.', type: 'error' });
              } finally {
                setIsInviting(false);
              }
            }}
            disabled={
              isInviting || 
              !inviteEmail.trim() || 
              (inviteRole === 'caissier' && (teamProfiles.filter(p => p.role === 'caissier').length + pendingInvitations.filter(i => i.role === 'caissier').length) >= (activePlan.toLowerCase() === 'pro' ? 3 : activePlan.toLowerCase() === 'annual' ? 9999 : 1))
            }
            className="h-10 bg-primary hover:bg-primary/95 text-white text-[10px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            {isInviting ? 'ENVOI DE L\'INVITATION...' : 'INVITER L\'UTILISATEUR'}
          </button>
        </div>
      </Card>

      {/* Settings Form */}
      <Card elevation={1} className="p-4 flex flex-col gap-5">
        <h3 className="text-xs text-outline font-extrabold uppercase tracking-wider border-b border-outline-variant/40 pb-2">
          Réglages de la Boutique
        </h3>

        <Input 
          label="Nom commercial de la Boutique" 
          value={boutiqueName} 
          onChange={(e) => setBoutiqueName(e.target.value)} 
          placeholder="Ex: Supermarché du Centre"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-outline uppercase tracking-wider">
            Seuil d'alerte de stock par défaut ({seuilAlerte} unités)
          </label>
          <input 
            type="range" 
            min="1" 
            max="30" 
            value={seuilAlerte} 
            onChange={(e) => setSeuilAlerte(parseInt(e.target.value))}
            className="w-full h-2 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <p className="text-[10px] text-outline italic">Les produits dont le stock descend sous cette valeur apparaîtront en rupture/alerte.</p>
        </div>
      </Card>



      {/* Super Admin Console Access — visible only for admin / super_admin role users */}
      {(userRole === 'admin' || userRole === 'super_admin') && onActivateAdmin && (
        <Card elevation={1} className="p-4 flex flex-col gap-4 bg-gradient-to-r from-purple-500/10 to-transparent border border-purple-500/20 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-600">
              <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-outline font-black uppercase tracking-wider">Console d'Administration</span>
              <span className="text-xs font-bold text-on-surface">Console Globale Super Admin</span>
            </div>
          </div>
          <p className="text-[10px] text-outline">Accédez à la console d'administration plateforme Sama Boutik.</p>
          <button
            type="button"
            onClick={onActivateAdmin}
            className="h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">security</span>
            Ouvrir la Console Super Admin
          </button>
        </Card>
      )}

      {/* Client Portal Access */}
      <Card elevation={1} className="p-4 flex flex-col gap-4 bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600">
            <span className="material-symbols-outlined text-lg">supervised_user_circle</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-outline font-black uppercase tracking-wider">Interface Dettes Client</span>
            <span className="text-xs font-bold text-on-surface">Espace de consultation pour vos débiteurs</span>
          </div>
        </div>
        <p className="text-[10px] text-outline">Lien d'auto-consultation permettant à un client de voir son solde et ses versements.</p>
        <button
          type="button"
          onClick={onNavigateToPortal}
          className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">open_in_new</span>
          Ouvrir l'Espace Client
        </button>
      </Card>

      {/* Safety & Backups */}
      <Card elevation={1} className="p-4 flex flex-col gap-4">
        <h3 className="text-xs text-outline font-extrabold uppercase tracking-wider border-b border-outline-variant/40 pb-2">
          Sauvegarde & Maintenance
        </h3>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleExportDB}
            className="flex-1 h-9 px-4 border border-outline-variant hover:bg-surface-container text-texte text-[10px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">download</span>
            Exporter la base de données
          </button>
          
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 h-9 px-4 bg-error hover:bg-error/95 text-white text-[10px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Déconnecter le Compte
          </button>
        </div>
      </Card>

      <div className="flex justify-center mt-2">
        <Button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="w-full sm:w-64 flex items-center justify-center gap-1.5 h-11"
        >
          <span className="material-symbols-outlined text-base">save</span>
          {isSaving ? 'ENREGISTREMENT...' : 'ENREGISTRER LA CONFIG'}
        </Button>
      </div>
    </div>
  );
};
export default Settings;
