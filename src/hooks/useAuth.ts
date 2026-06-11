import { useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'
import type { Profile, Boutique } from '../store/useAuthStore'
import type { User } from '@supabase/supabase-js'

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
  }, [fetchProfileAndBoutique, clearAuth])

  return {
    user,
    profile,
    boutique,
    isLoading,
    signOut: async () => {
      await supabase.auth.signOut()
      clearAuth()
    }
  }
}
