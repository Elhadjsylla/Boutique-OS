import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/Button';
import { Toast } from '../components/ui/Toast';

interface ReglagesProps {
  boutiqueId: string;
}

export const Reglages: React.FC<ReglagesProps> = ({ boutiqueId }) => {
  const { user, profile, boutique } = useAuthStore();
  const [boutiqueName, setBoutiqueName] = useState(boutique?.nom || '');
  const [stockThreshold, setStockThreshold] = useState(5);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (boutique?.nom) setBoutiqueName(boutique.nom);
  }, [boutique]);

  const saveSettings = async () => {
    if (!boutiqueName.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('boutiques')
        .update({ nom: boutiqueName.trim() })
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
    super_admin: 'Admin',
    admin: 'Admin',
    gerant: 'Gérant',
    caissier: 'Caissier',
  };

  const displayName = boutique?.nom || 'BoutikOS';
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

        <Button
          onClick={saveSettings}
          disabled={isSaving || !boutiqueName.trim()}
          className="w-full"
        >
          {isSaving ? 'Sauvegarde...' : 'SAUVEGARDER LES RÉGLAGES'}
        </Button>
      </div>
    </div>
  );
};

export default Reglages;
