import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  role: 'caissier' | 'gerant' | 'admin' | 'super_admin'
  boutique_id: string | null
  status?: 'pending' | 'active' | 'rejected' | 'suspended' | 'blocked' | 'banned' | 'deleted'
}

export interface Boutique {
  id: string
  nom: string
  adresse: string | null
  gerant_id: string | null
  message_ticket?: string | null
}

export interface SubscriptionStatus {
  actif: boolean
  plan: string | null
  date_fin: string | null
}

interface AuthState {
  user: User | null
  profile: Profile | null
  boutique: Boutique | null
  // Statut d'abonnement de la boutique, chargé une fois à la connexion (voir AuthProvider)
  // pour que le front n'ait jamais besoin de le recalculer à chaque écran.
  subscriptionStatus: SubscriptionStatus | null
  isLoading: boolean
  // Message affiché une fois sur l'écran de connexion quand le compte est
  // rejeté côté serveur (statut non actif) — voir AuthProvider.fetchProfileAndBoutique.
  authError: string | null
  setAuth: (user: User | null, profile: Profile | null, boutique: Boutique | null) => void
  setBoutique: (boutique: Boutique | null) => void
  setSubscriptionStatus: (status: SubscriptionStatus | null) => void
  setAuthError: (authError: string | null) => void
  clearAuth: () => void
  setLoading: (isLoading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  boutique: null,
  subscriptionStatus: null,
  isLoading: true,
  authError: null,
  setAuth: (user, profile, boutique) => set({ user, profile, boutique, isLoading: false }),
  setBoutique: (boutique) => set({ boutique }),
  setSubscriptionStatus: (subscriptionStatus) => set({ subscriptionStatus }),
  setAuthError: (authError) => set({ authError }),
  clearAuth: () => set({ user: null, profile: null, boutique: null, subscriptionStatus: null, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}))
