import React, { useState } from 'react';
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
}

export const Settings: React.FC<SettingsProps> = ({ 
  session, 
  onLogout,
  activePlan = 'Starter',
  onManageSubscription
}) => {
  const user = session.user;
  const initialBoutiqueName = user.user_metadata?.boutique_name || 'Ma Boutique';
  const userRole = user.user_metadata?.role || 'caissier';
  const userEmail = user.email;

  const [boutiqueName, setBoutiqueName] = useState(initialBoutiqueName);
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('sound_enabled') !== 'false');
  const [confettiEnabled, setConfettiEnabled] = useState(localStorage.getItem('confetti_enabled') !== 'false');
  const [seuilAlerte, setSeuilAlerte] = useState(parseInt(localStorage.getItem('seuil_alerte_global') || '5'));
  const [isSaving, setIsSaving] = useState(false);
  const [dopamineClickCount, setDopamineClickCount] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const playChachingSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc1.frequency.setValueAtTime(1760, ctx.currentTime + 0.08);
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = () => {
    setIsSaving(true);
    localStorage.setItem('sound_enabled', soundEnabled.toString());
    localStorage.setItem('confetti_enabled', confettiEnabled.toString());
    localStorage.setItem('seuil_alerte_global', seuilAlerte.toString());
    
    // Simulate savings animation
    setTimeout(() => {
      setIsSaving(false);
      if (soundEnabled) {
        playChachingSound();
      }
      setToast({ message: "Paramètres enregistrés avec succès !", type: "success" });
    }, 800);
  };

  const triggerDopamineShot = () => {
    setDopamineClickCount(prev => prev + 1);
    playChachingSound();
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

      {/* Dopamine and Effects Card */}
      <Card elevation={1} className="p-4 flex flex-col gap-4 bg-secondary-container/10 border-secondary-container/20">
        <h3 className="text-xs text-secondary font-extrabold uppercase tracking-wider border-b border-secondary-container/30 pb-2">
          Effets & Expérience Utilisateur (Dopamine Shot)
        </h3>

        {/* Toggle sound */}
        <div className="flex justify-between items-center py-1">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-on-surface">Effet sonore de caisse</span>
            <span className="text-[10px] text-outline">Jouer un bruit de pièces de monnaie "Cha-ching" à chaque vente.</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={soundEnabled} 
              onChange={(e) => setSoundEnabled(e.target.checked)} 
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-surface-container rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-outline after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
          </label>
        </div>

        {/* Toggle confetti */}
        <div className="flex justify-between items-center py-1 border-t border-outline-variant/20 pt-3">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-on-surface">Confettis de célébration</span>
            <span className="text-[10px] text-outline">Lancer une pluie de confettis virtuels après chaque encaissement.</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={confettiEnabled} 
              onChange={(e) => setConfettiEnabled(e.target.checked)} 
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-surface-container rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-outline after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
          </label>
        </div>

        {/* Interactive Dopamine Shot Button */}
        <div className="border-t border-outline-variant/20 pt-3 mt-1 flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-on-surface">Bouton Dopamine Instantané</span>
            <span className="text-[10px] text-outline">Une mini-célébration immédiate pour relâcher le stress ({dopamineClickCount} clics).</span>
          </div>
          <button
            type="button"
            onClick={triggerDopamineShot}
            className="h-8 px-3.5 bg-gradient-to-r from-secondary to-orange-500 hover:scale-105 active:scale-95 text-white text-[10px] font-black rounded-lg uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm"
          >
            🔥 CLIC DOPAMINE
          </button>
        </div>
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
