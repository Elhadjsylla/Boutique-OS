import React, { useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import type { Profile, Boutique } from '../store/useAuthStore';
import type { User, Session } from '@supabase/supabase-js';

// ─── DEV BYPASS ───────────────────────────────────────────────────────────────
const DEV_BYPASS = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS !== 'false';

const DEV_USER: User = {
  id: 'dev-admin-000-0000-0000-000000000000',
  email: 'admin@samaboutik.dev',
  app_metadata: {},
  user_metadata: { full_name: 'Admin DEV', role: 'super_admin' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User;

const DEV_PROFILE: Profile = {
  id: 'dev-admin-000-0000-0000-000000000000',
  role: 'super_admin',
  boutique_id: 'dev-boutique-000-0000-0000-000000000',
};

const DEV_BOUTIQUE: Boutique = {
  id: 'dev-boutique-000-0000-0000-000000000',
  nom: 'Boutique DEV',
  adresse: 'Mode développement local',
  gerant_id: null,
};
// ──────────────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  boutique: Boutique | null;
  isLoading: boolean;
  session: Session | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setAuth, clearAuth, setLoading, user, profile, boutique, isLoading } = useAuthStore();
  const [session, setSessionState] = React.useState<Session | null>(null);

  const getRoleFromJWT = useCallback((accessToken: string): string | null => {
    try {
      if (!accessToken) return null;
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      return payload.user_metadata?.role ?? payload.role ?? null;
    } catch {
      return null;
    }
  }, []);

  const fetchProfileAndBoutique = useCallback(async (currentSession: Session) => {
    const authUser = currentSession.user;
    try {
      setLoading(true);

      const failsafe = setTimeout(() => {
        setLoading(false);
      }, 8000);

      const { data: profileData, error: profileError } = await supabase
        .from('profils')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError) {
        const meta = authUser.user_metadata ?? {};
        const role = meta.role || getRoleFromJWT(currentSession.access_token) || 'caissier';
        const boutiqueId: string | null = meta.boutique_id ?? null;
        const boutiqueName: string | null = meta.boutique_name ?? null;
        setAuth(
          authUser,
          { id: authUser.id, role, boutique_id: boutiqueId } as Profile,
          boutiqueId && boutiqueName
            ? { id: boutiqueId, nom: boutiqueName, adresse: null, gerant_id: null } as Boutique
            : null
        );
        clearTimeout(failsafe);
        return;
      }

      const userProfile = profileData as Profile;
      let userBoutique: Boutique | null = null;
      
      if (userProfile.boutique_id) {
        const { data: boutiqueData, error: boutiqueError } = await supabase
          .from('boutiques')
          .select('*')
          .eq('id', userProfile.boutique_id)
          .single();

        if (boutiqueError) {
          console.error('Error fetching user boutique:', boutiqueError);
          const meta = authUser.user_metadata ?? {};
          if (meta.boutique_id && meta.boutique_name) {
            userBoutique = { id: meta.boutique_id, nom: meta.boutique_name, adresse: null, gerant_id: null } as Boutique;
          }
        } else {
          userBoutique = boutiqueData as Boutique;
        }
      }

      setAuth(authUser, userProfile, userBoutique);
      clearTimeout(failsafe);
    } catch (err) {
      console.error('Unexpected error in fetchProfileAndBoutique:', err);
      setAuth(currentSession?.user || null, null, null);
    }
  }, [setAuth, setLoading, getRoleFromJWT]);

  // Applies DEV role override to any session (real or fake)
  const applyDevRoleOverride = useCallback((s: any) => {
    if (!DEV_BYPASS || !s) return s;
    const devRole = localStorage.getItem('dev_role');
    if (devRole) {
      return {
        ...s,
        user: {
          ...s.user,
          user_metadata: {
            ...s.user.user_metadata,
            role: devRole,
          }
        }
      };
    }
    return s;
  }, []);

  const getDevSession = useCallback(() => {
    const devRole = localStorage.getItem('dev_role') || 'admin';
    return {
      user: {
        id: 'dev-admin-id',
        email: 'admin@samaboutik.dev',
        user_metadata: {
          boutique_id: 'boutique-dev',
          boutique_name: 'Sama Boutik Dev',
          role: devRole,
        }
      }
    } as any;
  }, []);

  useEffect(() => {
    if (DEV_BYPASS) {
      const isSignedOut = localStorage.getItem('dev_signed_out') === 'true';
      if (!isSignedOut) {
        setAuth(DEV_USER, DEV_PROFILE, DEV_BOUTIQUE);
        setSessionState(getDevSession());
      } else {
        clearAuth();
        setSessionState(null);
      }
      // Wait, we still need to listen for sign out events even in dev bypass
      // but let's just keep the master listener active instead of returning early
    }

    const masterFailsafe = setTimeout(() => {
      setLoading(false);
    }, 8000);

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      let finalSession = currentSession;
      if (finalSession && DEV_BYPASS) {
        finalSession = applyDevRoleOverride(finalSession);
      }
      setSessionState(finalSession);
      
      if (finalSession?.user) {
        fetchProfileAndBoutique(finalSession);
      } else {
        if (DEV_BYPASS && localStorage.getItem('dev_signed_out') !== 'true') {
           setSessionState(getDevSession());
           setAuth(DEV_USER, DEV_PROFILE, DEV_BOUTIQUE);
           setLoading(false);
        } else {
           clearAuth();
        }
      }
    }).catch(() => {
      clearAuth();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        let finalSession = currentSession;
        if (finalSession && DEV_BYPASS) {
          finalSession = applyDevRoleOverride(finalSession);
        }
        setSessionState(finalSession);
        
        if (_event === 'SIGNED_OUT') {
          if (DEV_BYPASS) localStorage.setItem('dev_signed_out', 'true');
          clearAuth();
        } else if (finalSession?.user) {
          if (DEV_BYPASS) localStorage.removeItem('dev_signed_out');
          await fetchProfileAndBoutique(finalSession);
        } else if (DEV_BYPASS) {
          const isSignedOut = localStorage.getItem('dev_signed_out') === 'true';
          if (!isSignedOut) {
            setSessionState(getDevSession());
            setAuth(DEV_USER, DEV_PROFILE, DEV_BOUTIQUE);
          } else {
            clearAuth();
          }
        } else {
          clearAuth();
        }
      }
    );

    return () => {
      clearTimeout(masterFailsafe);
      subscription.unsubscribe();
    };
  }, [fetchProfileAndBoutique, clearAuth, setAuth, setLoading, applyDevRoleOverride, getDevSession]);

  const signOut = async () => {
    if (!DEV_BYPASS) {
      await supabase.auth.signOut();
    }
    clearAuth();
    setSessionState(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, boutique, isLoading, session, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider");
  }
  return context;
}
