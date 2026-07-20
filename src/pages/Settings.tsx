import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Toast } from '../components/ui/Toast';
import { supabaseService } from '../services/supabaseService';
import { useAuthStore } from '../store/useAuthStore';
import { Select } from '../components/ui/Select';
import { SignalementModal } from '../components/SignalementModal';
const DEV_BYPASS = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS !== 'false';

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
  const [isSignalementOpen, setIsSignalementOpen] = useState(false);

  const user = session.user;
  const storeProfile = useAuthStore(state => state.profile);
  const boutiqueId = user.user_metadata?.boutique_id || storeProfile?.boutique_id;
  const initialBoutiqueName = user.user_metadata?.boutique_name || 'Ma Boutique';
  // Use role from profils table (Zustand store) first, fallback to user_metadata
  const userRole = storeProfile?.role || user.user_metadata?.role || 'caissier';
  const userEmail = user.email;

  const roleLabels: Record<string, string> = {
    super_admin: 'SUPER ADMIN',
    admin: 'SUPER ADMIN',
    gerant: 'Gérant',
    caissier: 'Caissier',
  };

  const [teamProfiles, setTeamProfiles] = useState<any[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'caissier' | 'gerant'>('caissier');
  const [isInviting, setIsInviting] = useState(false);

  // Retrait d'un membre de l'équipe
  const [removingMember, setRemovingMember] = useState<any | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [teamActivityLog, setTeamActivityLog] = useState<any[]>([]);
  const [showTeamHistory, setShowTeamHistory] = useState(false);

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

      const { data: logs } = await supabase
        .from('team_activity_log')
        .select('*')
        .eq('boutique_id', boutiqueId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (logs) setTeamActivityLog(logs);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [boutiqueId]);

  const handleConfirmRemove = async () => {
    if (!removingMember) return;
    setIsRemoving(true);
    try {
      const { error } = await supabase.rpc('gerant_remove_staff', {
        p_target_user_id: removingMember.id,
        p_reason: removeReason.trim() || null,
      });
      if (error) throw error;
      setToast({ message: 'Membre retiré de l\'équipe.', type: 'success' });
      setRemovingMember(null);
      setRemoveReason('');
      fetchTeam();
    } catch (e: any) {
      setToast({ message: e.message || 'Erreur lors du retrait.', type: 'error' });
    } finally {
      setIsRemoving(false);
    }
  };

  const [boutiqueName, setBoutiqueName] = useState(initialBoutiqueName);
  const [seuilAlerte, setSeuilAlerte] = useState(parseInt(localStorage.getItem('seuil_alerte_global') || '5'));
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Profile management states
  const [userFullName, setUserFullName] = useState(user.user_metadata?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user.user_metadata?.avatar_url || '');
  const [userPhoneNumber, setUserPhoneNumber] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  useEffect(() => {
    const fetchPhone = async () => {
      const { data } = await supabase.from('profils').select('phone_number').eq('id', user.id).single();
      if (data?.phone_number) {
        setUserPhoneNumber(data.phone_number);
      }
    };
    fetchPhone();
  }, [user.id]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password reset states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Extra preference states
  const [soundAlerts, setSoundAlerts] = useState(() => localStorage.getItem('pref_sound_alerts') !== 'false');
  const [weeklyReport, setWeeklyReport] = useState(() => localStorage.getItem('pref_weekly_report') === 'true');
  const [receiptGreeting, setReceiptGreeting] = useState(() => localStorage.getItem('pref_receipt_greeting') || 'Merci de votre visite !');

  const handleSaveSettings = () => {
    setIsSaving(true);
    localStorage.setItem('seuil_alerte_global', seuilAlerte.toString());
    localStorage.setItem('pref_sound_alerts', soundAlerts.toString());
    localStorage.setItem('pref_weekly_report', weeklyReport.toString());
    localStorage.setItem('pref_receipt_greeting', receiptGreeting);
    
    // Simulate savings animation
    setTimeout(() => {
      setIsSaving(false);
      setToast({ message: "Paramètres enregistrés avec succès !", type: "success" });
    }, 800);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setToast({ message: "L'image ne doit pas dépasser 2 Mo.", type: "error" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    setIsUpdatingProfile(true);
    try {
      if (DEV_BYPASS && user) {
        const updatedUser = {
          ...user,
          user_metadata: {
            ...user.user_metadata,
            full_name: userFullName.trim(),
            avatar_url: avatarUrl
          }
        };
        useAuthStore.getState().setAuth(updatedUser as any, storeProfile, useAuthStore.getState().boutique);
        setToast({ message: "Profil mis à jour avec succès (Local) !", type: "success" });
        setIsUpdatingProfile(false);
        return;
      }

      // Automatically refresh the session/JWT if expired before calling updateUser
      await supabase.auth.getSession();

      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: userFullName.trim(),
          avatar_url: avatarUrl
        }
      });
      if (error) throw error;
      
      if (userPhoneNumber.trim()) {
        const { error: phoneError } = await supabase.rpc('update_phone_number', { new_phone: userPhoneNumber.trim() });
        if (phoneError) throw phoneError;
      }
      
      // Update local store user object immediately
      if (data.user) {
        useAuthStore.getState().setAuth(data.user, storeProfile, useAuthStore.getState().boutique);
      }
      setToast({ message: "Profil mis à jour avec succès !", type: "success" });
    } catch (e: any) {
      setToast({ message: e.message || "Erreur lors de la mise à jour.", type: "error" });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setToast({ message: "Les mots de passe ne correspondent pas.", type: "error" });
      return;
    }
    if (newPassword.length < 6) {
      setToast({ message: "Le mot de passe doit contenir au moins 6 caractères.", type: "error" });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      if (DEV_BYPASS) {
        setNewPassword('');
        setConfirmPassword('');
        setToast({ message: "Mot de passe modifié avec succès (Local) !", type: "success" });
        setIsUpdatingPassword(false);
        return;
      }

      // Explicitly read the current session from storage (may have expired access token)
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!currentSession?.refresh_token) {
        setSessionExpired(true);
        return;
      }

      // Force refresh — GoTrue accepts the refresh token even when access token is expired
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession(currentSession);

      if (refreshError || !refreshData.session) {
        setSessionExpired(true);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword('');
      setConfirmPassword('');
      setSessionExpired(false);
      setToast({ message: "Mot de passe modifié avec succès !", type: "success" });
    } catch (e: any) {
      const isJwtIssue = /expired|invalid.*jwt|jwt.*invalid|bad_jwt/i.test(e?.message ?? '');
      if (isJwtIssue) {
        setSessionExpired(true);
      } else {
        setToast({ message: e.message || "Erreur lors de la modification du mot de passe.", type: "error" });
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!userEmail) return;
    setIsSendingResetEmail(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setToast({ message: `Email de réinitialisation envoyé à ${userEmail}. Cliquez sur le lien dans l'email.`, type: "success" });
      setSessionExpired(false);
    } catch (e: any) {
      setToast({ message: e.message || "Erreur lors de l'envoi de l'email.", type: "error" });
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  const handleExportDB = async () => {
    const boutiqueId = storeProfile?.boutique_id || useAuthStore.getState().profile?.boutique_id;
    if (!boutiqueId) {
      setToast({ message: "Boutique introuvable.", type: "error" });
      return;
    }
    
    try {
      // Export complet de la boutique = doit tout couvrir, pas une page
      const [produits, ventes, ardoises, items, paiements] = await Promise.all([
        supabaseService.getProduits(boutiqueId, { limit: 5000 }),
        supabaseService.getVentesAll(boutiqueId),
        supabaseService.getArdoises(boutiqueId, { limit: 5000 }),
        supabaseService.getVenteItemsAll(boutiqueId),
        supabaseService.getArdoisePaiementsAll(boutiqueId),
      ]);

      const exportData = {
        produits,
        ventes,
        vente_items: items,
        ardoises,
        ardoise_paiements: paiements,
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const link = document.createElement("a");
      link.setAttribute("href", dataStr);
      link.setAttribute("download", `boutique_os_export_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setToast({ message: "Base de données exportée avec succès.", type: "success" });
    } catch (err: any) {
      setToast({ message: "Erreur lors de l'export : " + err.message, type: "error" });
    }
  };

  return (
    <div className="pb-40 pt-20 px-4 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in text-left">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div>
        <h1 className="font-headline-lg-mobile text-on-surface">Configuration</h1>
        <p className="font-body-md text-on-surface-variant">Ajustez vos préférences et gérez les détails de votre compte.</p>
      </div>

      {/* Hidden File Input for Avatar */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Account Profile Card */}
      <Card elevation={1} className="p-4 flex flex-col gap-5 relative overflow-hidden bg-gradient-to-r from-primary-container/20 to-transparent border border-outline-variant/40">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          {/* Avatar container with custom overlay and styling */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-black text-xl shadow-md relative group cursor-pointer border-2 border-white/50"
            title="Cliquez pour changer votre photo de profil"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span>{(userFullName || userEmail || 'U').slice(0, 2).toUpperCase()}</span>
            )}
            
            {/* Smooth hover state overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
              <span className="material-symbols-outlined text-white text-base">photo_camera</span>
            </div>
          </div>

          <div className="flex flex-col flex-1 w-full gap-3 sm:gap-1">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
              <div className="flex flex-col text-center sm:text-left">
                <h3 className="text-base font-black text-on-surface leading-tight">
                  {userFullName || userEmail}
                </h3>
                <span className="text-xs text-outline font-medium mt-0.5">{userEmail}</span>
              </div>
              <span className="text-[9px] uppercase font-black text-primary bg-primary-container/40 px-2.5 py-1 rounded-full border border-primary/10">
                Role: {roleLabels[userRole] || userRole}
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 items-end mt-2">
              <div className="flex-1 w-full flex flex-col gap-3">
                <Input 
                  label="Votre Nom Complet" 
                  value={userFullName} 
                  onChange={(e) => setUserFullName(e.target.value)} 
                  placeholder="Ex: Babacar Diop"
                />
                <Input 
                  label="Numéro de téléphone" 
                  value={userPhoneNumber} 
                  onChange={(e) => setUserPhoneNumber(e.target.value)} 
                  placeholder="Ex: 771234567"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isUpdatingProfile || !userFullName.trim()}
                className="w-full sm:w-auto h-11 px-4 bg-primary hover:bg-primary/95 disabled:opacity-50 text-white text-[10px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">save</span>
                {isUpdatingProfile ? 'ENREGISTREMENT...' : 'Enregistrer'}
              </button>
            </div>
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

      {/* Security: Password Update Card */}
      <Card elevation={1} className="p-4 flex flex-col gap-4 text-left">
        <style>{`
          @keyframes emojiBounce {
            0% { transform: scale(0.3) rotate(-25deg); opacity: 0; }
            50% { transform: scale(1.1) rotate(15deg); }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
          }
          .animate-emoji-change {
            animation: emojiBounce 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
            display: inline-block;
          }
        `}</style>

        <div className="border-b border-outline-variant/40 pb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-sm">security</span>
          <h3 className="text-xs text-outline font-extrabold uppercase tracking-wider">
            Sécurité du Compte
          </h3>
        </div>

        <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Input
                label="Nouveau mot de passe"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-9 text-xl select-none focus:outline-none transition-all active:scale-90"
                title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                <span key={showPassword ? "eyes" : "monkey"} className="animate-emoji-change">
                  {showPassword ? "👀" : "🙈"}
                </span>
              </button>
            </div>

            <div className="flex-1 relative">
              <Input
                label="Confirmer le mot de passe"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ressaisir le mot de passe"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-9 text-xl select-none focus:outline-none transition-all active:scale-90"
                title={showConfirmPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                <span key={showConfirmPassword ? "eyes" : "monkey"} className="animate-emoji-change">
                  {showConfirmPassword ? "👀" : "🙈"}
                </span>
              </button>
            </div>
          </div>

          {sessionExpired && (
            <div className="flex flex-col gap-2 p-3 bg-error/10 border border-error/30 rounded-xl text-left">
              <p className="text-xs text-error font-bold">Votre session a expiré. Vous pouvez vous déconnecter et vous reconnecter, ou recevoir un email de réinitialisation.</p>
              <button
                type="button"
                onClick={handleSendResetEmail}
                disabled={isSendingResetEmail}
                className="self-start h-9 px-4 bg-error/20 hover:bg-error/30 text-error text-[10px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSendingResetEmail ? 'ENVOI...' : `Envoyer un email à ${userEmail}`}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={isUpdatingPassword || !newPassword}
            className="w-full sm:w-auto self-end h-10 px-5 bg-primary hover:bg-primary/95 disabled:opacity-50 text-white text-[10px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">vpn_key</span>
            {isUpdatingPassword ? 'MISE À JOUR...' : 'Modifier le mot de passe'}
          </button>
        </form>
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
            const limit = activePlan.toLowerCase() === 'pro' ? 3 : (activePlan.toLowerCase() === 'annual' || activePlan.toLowerCase().includes('max')) ? 9999 : 1;
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
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-secondary font-black uppercase tracking-wider bg-secondary/15 px-2 py-0.5 rounded-full">Actif</span>
                {member.role === 'caissier' && (
                  <button
                    type="button"
                    onClick={() => { setRemovingMember(member); setRemoveReason(''); }}
                    className="text-[9px] text-error font-black uppercase tracking-wider bg-error-container/40 hover:bg-error-container/70 px-2 py-0.5 rounded-full active:scale-95 transition-all cursor-pointer"
                  >
                    Retirer
                  </button>
                )}
              </div>
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
            <div className="flex-[2]">
              <Select
                label="Rôle"
                value={inviteRole}
                onChange={(val) => setInviteRole(val as any)}
                options={[
                  { value: 'caissier', label: 'Caissier' },
                  { value: 'gerant', label: 'Gérant' },
                ]}
                isAdmin={false}
              />
            </div>
          </div>

          {(() => {
            const activeCount = teamProfiles.filter(p => p.role === 'caissier').length;
            const pendingCount = pendingInvitations.filter(i => i.role === 'caissier').length;
            const total = activeCount + pendingCount;
            const limit = activePlan.toLowerCase() === 'pro' ? 3 : (activePlan.toLowerCase() === 'annual' || activePlan.toLowerCase().includes('max')) ? 9999 : 1;
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

                // Extraire le message d'erreur même depuis les réponses 4xx
                let errorMessage: string | null = null;
                if (error) {
                  try {
                    const body = await (error as any).context?.json?.();
                    errorMessage = body?.error || error.message || 'Erreur lors de l\'invitation.';
                  } catch {
                    errorMessage = error.message || 'Erreur lors de l\'invitation.';
                  }
                } else if (data?.error) {
                  errorMessage = data.error;
                }

                if (errorMessage) {
                  setToast({ message: errorMessage, type: 'error' });
                } else {
                  const msg = data?.already_registered
                    ? 'Utilisateur déjà enregistré — il a été lié à votre boutique directement.'
                    : 'Invitation envoyée avec succès !';
                  setToast({ message: msg, type: 'success' });
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
              (inviteRole === 'caissier' && (teamProfiles.filter(p => p.role === 'caissier').length + pendingInvitations.filter(i => i.role === 'caissier').length) >= (activePlan.toLowerCase() === 'pro' ? 3 : (activePlan.toLowerCase() === 'annual' || activePlan.toLowerCase().includes('max')) ? 9999 : 1))
            }
            className="h-10 bg-primary hover:bg-primary/95 text-white text-[10px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            {isInviting ? 'ENVOI DE L\'INVITATION...' : 'INVITER L\'UTILISATEUR'}
          </button>
        </div>

        {/* Historique des retraits d'équipe */}
        {teamActivityLog.length > 0 && (
          <div className="border-t border-outline-variant/40 pt-3">
            <button
              type="button"
              onClick={() => setShowTeamHistory(!showTeamHistory)}
              className="flex items-center gap-1.5 text-[10px] text-outline font-bold uppercase tracking-wider hover:text-on-surface transition-all"
            >
              <span className="material-symbols-outlined text-sm">{showTeamHistory ? 'expand_less' : 'expand_more'}</span>
              Historique de l'équipe ({teamActivityLog.length})
            </button>
            {showTeamHistory && (
              <div className="flex flex-col gap-1.5 mt-2 max-h-40 overflow-y-auto pr-1">
                {teamActivityLog.map((log) => (
                  <div key={log.id} className="p-2 bg-surface-container/20 border border-outline-variant/40 rounded-lg text-[9px] text-outline">
                    <span className="font-bold text-on-surface">Membre {log.target_id.slice(0, 8)} retiré</span>
                    {' — '}
                    {new Date(log.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {log.reason && <span className="block italic mt-0.5">Motif : {log.reason}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Settings Form */}
      <Card elevation={1} className="p-4 flex flex-col gap-5">
        <h3 className="text-xs text-outline font-extrabold uppercase tracking-wider border-b border-outline-variant/40 pb-2">
          Réglages de la Boutique & Préférences
        </h3>

        <Input 
          label="Nom commercial de la Boutique" 
          value={boutiqueName} 
          onChange={(e) => setBoutiqueName(e.target.value)} 
          placeholder="Ex: Supermarché du Centre"
        />

        <div className="flex flex-col gap-1.5 border-b border-outline-variant/30 pb-4">
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

        {/* Receipt Custom Message Preference */}
        <div className="flex flex-col gap-2 border-b border-outline-variant/30 pb-4">
          <Input 
            label="Message personnalisé sur les tickets de caisse" 
            value={receiptGreeting} 
            onChange={(e) => setReceiptGreeting(e.target.value)} 
            placeholder="Ex: Merci pour votre visite ! À bientôt."
          />
          <p className="text-[10px] text-outline italic">Ce texte apparaîtra en bas de chaque ticket de caisse généré.</p>
        </div>

        {/* Toggles Preferences */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-outline">volume_up</span>
                Alertes sonores
              </span>
              <span className="text-[10px] text-outline mt-0.5">Émettre un son lors de la validation d'une vente</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={soundAlerts} 
                onChange={(e) => setSoundAlerts(e.target.checked)} 
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-outline-variant after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
            </label>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-outline">mail</span>
                Rapport hebdomadaire par e-mail
              </span>
              <span className="text-[10px] text-outline mt-0.5">Recevoir un résumé d'activité chaque dimanche soir</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={weeklyReport} 
                onChange={(e) => setWeeklyReport(e.target.checked)} 
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-outline-variant after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
            </label>
          </div>
        </div>
      </Card>



      {/* Super Admin Console Access — visible only for admin / super_admin role users */}
      {(userRole === 'admin' || userRole === 'super_admin' || userEmail === 'cedricbenoitdieme@gmail.com' || userEmail === 'admin@samaboutik.dev') && onActivateAdmin && (
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

      {/* Support & Incident Reporting (Only for Caissier & Gerant) */}
      {(userRole === 'caissier' || userRole === 'gerant') && (
        <Card elevation={1} className="p-4 flex flex-col gap-4 bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined text-lg">support_agent</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-outline font-black uppercase tracking-wider">Support technique</span>
              <span className="text-xs font-bold text-on-surface">Signaler un problème</span>
            </div>
          </div>
          <p className="text-[10px] text-outline">Vous rencontrez un bug ou un problème de paiement ? Signalez-le directement à notre équipe support.</p>
          <button
            type="button"
            onClick={() => setIsSignalementOpen(true)}
            className="h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">report_problem</span>
            Signaler un problème
          </button>
        </Card>
      )}

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

      {boutiqueId && (
        <SignalementModal
          isOpen={isSignalementOpen}
          onClose={() => setIsSignalementOpen(false)}
          boutiqueId={boutiqueId}
        />
      )}

      {/* MODAL : Retirer un membre de l'équipe */}
      {removingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full relative shadow-xl text-left border border-error/30 flex flex-col gap-4 animate-scale-in">
            <h3 className="text-sm font-black text-error uppercase tracking-wider flex items-center gap-1">⚠️ Retirer ce membre</h3>
            <p className="text-xs text-outline leading-relaxed">
              Ce caissier perdra immédiatement l'accès à la boutique. Son historique de ventes reste intact et lui reste attribué — il pourra être réinvité plus tard, dans cette boutique ou une autre.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-outline">Motif (optionnel)</label>
              <textarea
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                rows={2}
                placeholder="Ex: Fin de contrat, changement de poste..."
                className="w-full p-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-error/20 focus:border-error outline-none transition-all text-sm text-on-surface resize-none"
              />
            </div>
            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setRemovingMember(null)}
                disabled={isRemoving}
                className="flex-1 h-10 border border-outline-variant hover:bg-surface-container text-on-surface text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={isRemoving}
                className="flex-1 h-10 bg-error hover:bg-error/90 disabled:opacity-50 text-white text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                {isRemoving ? 'RETRAIT...' : 'CONFIRMER'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

};
export default Settings;
