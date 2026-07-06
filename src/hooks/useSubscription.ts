import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type PlanType = 'free' | 'starter' | 'pro' | 'annual';
export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'trial' | 'trial_cancelled';
export type PaymentMethod = 'wave' | 'orange_money' | 'admin';

export interface Subscription {
  id: string;
  plan: PlanType;
  status: SubscriptionStatus;
  payment_method: PaymentMethod;
  amount: number;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
}

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
  subscription: Subscription | null;
  isActive: boolean;
  isLoading: boolean;
  daysLeft: number | null;
  refetch: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('status', 'active')
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setSubscription(data ?? null);
    } catch (err) {
      console.error('useSubscription fetch error:', err);
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const isActive = subscription?.status === 'active' &&
    !!subscription.expires_at &&
    new Date(subscription.expires_at) > new Date();

  const daysLeft = subscription?.expires_at
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return { subscription, isActive, isLoading, daysLeft, refetch: fetchSubscription };
}
