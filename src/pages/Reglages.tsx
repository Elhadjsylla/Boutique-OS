import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Toast } from '../components/ui/Toast';
import { Select } from '../components/ui/Select';

interface ReglagesProps {
  boutiqueId: string;
  activePlan?: string;
  onManageSubscription?: () => void;
  onOpenAdmin?: () => void;
}

export const Reglages: React.FC<ReglagesProps> = ({ 
  boutiqueId,
  activePlan = 'Starter',
  onManageSubscription,
  onOpenAdmin
}) => {
  const { t, i18n } = useTranslation();
  const languages = [
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'wo', label: 'Wolof', flag: '🇸🇳' },
  ];

  const { user, profile, boutique } = useAuthStore();
  const [boutiqueName, setBoutiqueName] = useState(boutique?.nom || '');
  const [stockThreshold, setStockThreshold] = useState(5);
  const [boutiqueQuartier, setBoutiqueQuartier] = useState('');
  const [quartiers, setQuartiers] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchBoutiqueAndQuartiers = async () => {
      try {
        // Fetch quartiers
        const { data: qData } = await supabase.from('quartiers_dakar').select('nom').order('nom');
        if (qData) {
          setQuartiers(qData.map(q => q.nom));
        } else {
          setQuartiers(["Dakar Plateau", "Médina", "Fann-Point E-Amitié", "Ouakam", "Yoff", "Ngor-Almadies", "Mermoz-Sacré Cœur", "Grand Dakar", "Parcelles Assainies", "Pikine", "Guédiawaye", "Rufisque"]);
        }

        // Fetch current boutique quartier
        const { data: bData } = await supabase
          .from('boutiques')
          .select('nom, quartier')
          .eq('id', boutiqueId)
          .single();
        
        if (bData) {
          if (bData.nom) setBoutiqueName(bData.nom);
          if (bData.quartier) setBoutiqueQuartier(bData.quartier);
        }
      } catch (err) {
        console.error("Error loading boutique details:", err);
      }
    };

    fetchBoutiqueAndQuartiers();
  }, [boutiqueId]);

  const saveSettings = async () => {
    if (!boutiqueName.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('boutiques')
        .update({ 
          nom: boutiqueName.trim(),
          quartier: boutiqueQuartier || null
        })
        .eq('id', boutiqueId);
      if (error) throw error;
      setToast({ message: 'Paramètres sauvegardés avec succès.', type: 'success' });
    } catch {
      setToast({ message: 'Erreur lors de la sauvegarde.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const userRole = profile?.role || 'caissier';
  const roleLabels: Record<string, string> = {
    super_admin: 'SUPER ADMIN',
    admin: 'SUPER ADMIN',
    gerant: 'Gérant',
    caissier: 'Caissier',
  };

  const displayName = boutique?.nom || 'Sama Boutik';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="pb-40 pt-20 px-4 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="text-left mt-2">
        <h1 className="font-headline-lg-mobile text-on-surface">Configuration</h1>
        <p className="font-body-md text-on-surface-variant">Ajustez vos préférences et gérez les détails de votre compte.</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white border border-outline-variant rounded-2xl p-5 flex items-center gap-4 premium-shadow-sm">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-secondary to-secondary/80 flex items-center justify-center shadow-sm flex-shrink-0">
          <span className="text-white text-xl font-black">{initials}</span>
        </div>
        <div className="flex flex-col text-left gap-1.5">
          <h2 className="font-headline-sm text-on-surface leading-tight">{displayName}</h2>
          <p className="text-xs text-outline">{user?.email}</p>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary-container text-primary text-[10px] font-black uppercase tracking-wider w-fit border border-primary/20">
            Role: {roleLabels[userRole] ?? userRole}
          </span>
        </div>
      </div>

      {/* Subscription Card */}
      <div className="bg-white border border-outline-variant rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 premium-shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary-container text-secondary flex items-center justify-center">
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
          className="h-9 px-4 bg-primary hover:bg-primary/95 text-white text-[10px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">credit_card</span>
          Gérer / S'abonner
        </button>
      </div>

      {/* Boutique Settings */}
      <div className="bg-white border border-outline-variant rounded-2xl p-5 flex flex-col gap-5 premium-shadow-sm">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-outline border-b border-outline-variant pb-3">
          Réglages de la boutique
        </h3>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
            Nom commercial de la boutique
          </label>
          <input
            type="text"
            value={boutiqueName}
            onChange={(e) => setBoutiqueName(e.target.value)}
            className="w-full h-12 px-4 bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-semibold text-on-surface"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
            Quartier (Dakar)
          </label>
          <Select
            value={boutiqueQuartier}
            onChange={(val) => setBoutiqueQuartier(val)}
            options={[
              { value: '', label: 'Non renseigné' },
              ...quartiers.map(q => ({ value: q, label: q }))
            ]}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
            Seuil d'alerte de stock par défaut ({stockThreshold} unités)
          </label>
          <input
            type="range"
            min={1}
            max={20}
            value={stockThreshold}
            onChange={(e) => setStockThreshold(parseInt(e.target.value))}
            className="w-full h-2 accent-secondary cursor-pointer"
          />
          <p className="text-[10px] text-outline">
            Les produits dont le stock descend sous cette valeur apparaîtront en rupture/alerte.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-outline text-left">
            {t('reglages.langue')}
          </span>
          <div className="flex gap-2">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => i18n.changeLanguage(lang.code)}
                className={`flex-1 h-11 rounded-xl border text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${
                  i18n.language.startsWith(lang.code)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline-variant bg-white text-outline hover:bg-slate-50'
                }`}
              >
                {lang.flag} {lang.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={saveSettings}
          disabled={isSaving || !boutiqueName.trim()}
          className="w-full"
        >
          {isSaving ? 'Sauvegarde...' : 'SAUVEGARDER LES RÉGLAGES'}
        </Button>
      </div>

      {/* Super Admin Console Access */}
      {((userRole as string) === 'admin' || userRole === 'super_admin') && onOpenAdmin && (
        <div className="bg-white border border-purple-200 rounded-2xl p-5 flex flex-col gap-4 premium-shadow-sm bg-gradient-to-r from-purple-500/5 to-transparent text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-600">
              <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-outline font-black uppercase tracking-wider">Console d'Administration</span>
              <span className="text-sm font-bold text-on-surface">Console Globale Super Admin</span>
            </div>
          </div>
          <p className="text-xs text-outline">Accédez à la console d'administration plateforme Sama Boutik.</p>
          <button
            type="button"
            onClick={onOpenAdmin}
            className="h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">security</span>
            Ouvrir la Console Super Admin
          </button>
        </div>
      )}
    </div>
  );
};

export default Reglages;
