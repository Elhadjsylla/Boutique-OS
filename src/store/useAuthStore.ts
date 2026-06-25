import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  role: 'caissier' | 'gerant' | 'admin' | 'super_admin'
  boutique_id: string | null
}

export interface Boutique {
  id: string
  nom: string
  adresse: string | null
  gerant_id: string | null
}

interface AuthState {
  user: User | null
  profile: Profile | null
  boutique: Boutique | null
  isLoading: boolean
  setAuth: (user: User | null, profile: Profile | null, boutique: Boutique | null) => void
  clearAuth: () => void
  setLoading: (isLoading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  boutique: null,
  isLoading: true,
  setAuth: (user, profile, boutique) => set({ user, profile, boutique, isLoading: false }),
  clearAuth: () => set({ user: null, profile: null, boutique: null, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}))
