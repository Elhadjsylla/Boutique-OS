import { useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'
import type { Profile, Boutique } from '../store/useAuthStore'
import type { User } from '@supabase/supabase-js'

// ─── DEV BYPASS ───────────────────────────────────────────────────────────────
// In development mode, skip Supabase auth entirely and inject a mock super_admin
// session so the team can access the full interface without credentials.
// This flag is removed automatically when building for production.
const DEV_BYPASS = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS !== 'false'

const DEV_USER: User = {
  id: 'dev-admin-000-0000-0000-000000000000',
  email: 'admin@samaboutik.dev',
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

  const getRoleFromJWT = useCallback((accessToken: string): string | null => {
    try {
      if (!accessToken) return null
      const payload = JSON.parse(atob(accessToken.split('.')[1]))
      // user_metadata.role is the actual app role (injected by custom_access_token_hook).
      // payload.role at the top level is always 'authenticated' (PostgREST role).
      return payload.user_metadata?.role ?? payload.role ?? null
    } catch {
      return null
    }
  }, [])

  const fetchProfileAndBoutique = useCallback(async (session: any) => {
    const authUser = session.user;
    try {
      setLoading(true)

      // Failsafe timeout to prevent infinite loading
      const failsafe = setTimeout(() => {
        setLoading(false);
      }, 8000);

      // Fetch public profile
      const { data: profileData, error: profileError } = await supabase
        .from('profils')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileError) {
        // Offline or DB error: build from session user_metadata (set by custom_access_token_hook on last refresh).
        // Provides correct role + boutique_id so the sync engine can still run offline.
        const meta = authUser.user_metadata ?? {};
        const role = meta.role || getRoleFromJWT(session.access_token) || 'caissier';
        const boutiqueId: string | null = meta.boutique_id ?? null;
        const boutiqueName: string | null = meta.boutique_name ?? null;
        setAuth(
          authUser,
          { id: authUser.id, role, boutique_id: boutiqueId } as Profile,
          boutiqueId && boutiqueName
            ? { id: boutiqueId, nom: boutiqueName, adresse: null, gerant_id: null } as Boutique
            : null
        )
        clearTimeout(failsafe);
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
          // Offline fallback: reconstruct boutique from JWT metadata
          const meta = authUser.user_metadata ?? {};
          if (meta.boutique_id && meta.boutique_name) {
            userBoutique = { id: meta.boutique_id, nom: meta.boutique_name, adresse: null, gerant_id: null } as Boutique;
          }
        } else {
          userBoutique = boutiqueData as Boutique
        }
      }

      setAuth(authUser, userProfile, userBoutique)
      clearTimeout(failsafe);
    } catch (err) {
      console.error('Unexpected error in fetchProfileAndBoutique:', err)
      setAuth(session?.user || null, null, null)
    }
  }, [setAuth, setLoading, getRoleFromJWT])

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
          await fetchProfileAndBoutique(session)
        } else {
          clearAuth()
        }
      }
    )

    // ── MASTER FAILSAFE: Ensure we never load indefinitely ──
    const masterFailsafe = setTimeout(() => {
      setLoading(false)
    }, 8000);

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        fetchProfileAndBoutique(session)
      } else {
        clearAuth()
      }
    }).catch(() => {
      clearAuth()
    })

    return () => {
      clearTimeout(masterFailsafe)
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
