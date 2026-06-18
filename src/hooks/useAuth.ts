import { useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'
import type { Profile, Boutique } from '../store/useAuthStore'
import type { User } from '@supabase/supabase-js'

// ─── DEV BYPASS ───────────────────────────────────────────────────────────────
// In development mode, skip Supabase auth entirely and inject a mock super_admin
// session so the team can access the full interface without credentials.
// This flag is removed automatically when building for production.
const DEV_BYPASS = import.meta.env.DEV

const DEV_USER: User = {
  id: 'dev-admin-000-0000-0000-000000000000',
  email: 'admin@boutikos.dev',
  app_metadata: {},
  user_metadata: { full_name: 'Admin DEV' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User

const DEV_PROFILE: Profile = {
  id: 'dev-admin-000-0000-0000-000000000000',
  role: 'super_admin',
  boutique_id: 'dev-boutique-000-0000-0000-000000000',
}

const DEV_BOUTIQUE: Boutique = {
  id: 'dev-boutique-000-0000-0000-000000000',
  nom: 'Boutique DEV',
  adresse: 'Mode développement local',
  gerant_id: null,
}
// ──────────────────────────────────────────────────────────────────────────────

export function useAuth() {
  const { setAuth, clearAuth, setLoading, user, profile, boutique, isLoading } = useAuthStore()

  const fetchProfileAndBoutique = useCallback(async (authUser: User) => {
    try {
      setLoading(true)
      
      // Fetch public profile
      const { data: profileData, error: profileError } = await supabase
        .from('profils')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileError) {
        console.error('Error fetching user profile:', profileError)
        setAuth(authUser, null, null)
        return
      }

      const userProfile = profileData as Profile

      // Fetch boutique details if associated
      let userBoutique: Boutique | null = null
      if (userProfile.boutique_id) {
        const { data: boutiqueData, error: boutiqueError } = await supabase
          .from('boutiques')
          .select('*')
          .eq('id', userProfile.boutique_id)
          .single()

        if (boutiqueError) {
          console.error('Error fetching user boutique:', boutiqueError)
        } else {
          userBoutique = boutiqueData as Boutique
        }
      }

      setAuth(authUser, userProfile, userBoutique)
    } catch (err) {
      console.error('Unexpected error in fetchProfileAndBoutique:', err)
      setAuth(authUser, null, null)
    }
  }, [setAuth, setLoading])

  useEffect(() => {
    // ── DEV BYPASS: inject fake admin session immediately ──
    if (DEV_BYPASS) {
      setAuth(DEV_USER, DEV_PROFILE, DEV_BOUTIQUE)
      return
    }

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          await fetchProfileAndBoutique(session.user)
        } else {
          clearAuth()
        }
      }
    )

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfileAndBoutique(session.user)
      } else {
        clearAuth()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfileAndBoutique, clearAuth, setAuth])

  return {
    user,
    profile,
    boutique,
    isLoading,
    signOut: async () => {
      if (!DEV_BYPASS) {
        await supabase.auth.signOut()
      }
      clearAuth()
    }
  }
}
