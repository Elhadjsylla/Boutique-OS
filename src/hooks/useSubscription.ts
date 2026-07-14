import { useAuthStore } from '../store/useAuthStore';
import { supabaseService } from '../services/supabaseService';

export type PlanType = 'free' | 'starter' | 'pro' | 'annual';
export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'trial' | 'trial_cancelled';
export type PaymentMethod = 'wave' | 'orange_money' | 'admin';

export interface PlanLimits {
  plan: PlanType;
  max_articles: number;      // -1 = illimité
  max_ventes_mois: number;   // -1 = illimité
  max_caissiers: number;     // -1 = illimité
  modules_bloques: string[]; // ex: ['export_pdf', 'dashboard_avance']
}

export const PLAN_CONFIG: Record<PlanType, { label: string; amount: number; duration: string; features: string[]; limits?: Partial<PlanLimits> }> = {
  free: {
    label: 'Gratuit',
    amount: 0,
    duration: 'Indéfini',
    features: ['30 articles max', '100 ventes/mois', '1 caissier', 'Stock & Ardoise', 'Sync hors ligne'],
    limits: { max_articles: 30, max_ventes_mois: 100, max_caissiers: 1, modules_bloques: ['export_pdf', 'dashboard_avance'] },
  },
  starter: {
    label: 'Starter',
    amount: 2900,
    duration: '1 mois',
    features: ['1 caissier', 'Ventes illimitées', 'Stock & Ardoise', 'Sync hors ligne'],
    limits: { max_articles: -1, max_ventes_mois: -1, max_caissiers: 1, modules_bloques: ['export_pdf', 'dashboard_avance'] },
  },
  pro: {
    label: 'Pro',
    amount: 5900,
    duration: '1 mois',
    features: ['3 caissiers', 'Tout Starter inclus', 'Dashboard avancé', 'Export PDF/Excel'],
    limits: { max_articles: -1, max_ventes_mois: -1, max_caissiers: 3, modules_bloques: [] },
  },
  annual: {
    label: 'Annuel',
    amount: 52900,
    duration: '12 mois',
    features: ['Caissiers illimités', 'Tout Pro inclus', '2 mois offerts', 'Support prioritaire'],
    limits: { max_articles: -1, max_ventes_mois: -1, max_caissiers: -1, modules_bloques: [] },
  },
};

interface UseSubscriptionReturn {
  subscription: { plan: PlanType | null; date_fin: string | null } | null;
  isActive: boolean;
  isLoading: boolean;
  daysLeft: number | null;
  refetch: () => Promise<void>;
}

/**
 * Lit le statut d'abonnement mis en cache dans le store d'auth (chargé une seule fois à la
 * connexion via get_boutique_subscription_status — voir AuthProvider). N'effectue plus son
 * propre fetch séparé à chaque montage.
 */
export function useSubscription(): UseSubscriptionReturn {
  const boutiqueId = useAuthStore(state => state.profile?.boutique_id ?? state.boutique?.id ?? null);
  const status = useAuthStore(state => state.subscriptionStatus);
  const isAuthLoading = useAuthStore(state => state.isLoading);
  const setSubscriptionStatus = useAuthStore(state => state.setSubscriptionStatus);

  const refetch = async () => {
    if (!boutiqueId) {
      setSubscriptionStatus(null);
      return;
    }
    try {
      const fresh = await supabaseService.getBoutiqueSubscriptionStatus(boutiqueId);
      setSubscriptionStatus(fresh);
    } catch (err) {
      console.error('useSubscription refetch error:', err);
      setSubscriptionStatus(null);
    }
  };

  const daysLeft = status?.date_fin
    ? Math.max(0, Math.ceil((new Date(status.date_fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return {
    subscription: status ? { plan: status.plan as PlanType | null, date_fin: status.date_fin } : null,
    isActive: status?.actif ?? false,
    isLoading: isAuthLoading,
    daysLeft,
    refetch,
  };
}
