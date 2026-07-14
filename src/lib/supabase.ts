import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder-url')) {
  throw new Error(
    "Les variables d'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être configurées dans votre fichier .env."
  );
}

let refreshInFlight: Promise<string | null> | null = null;

// Après une coupure réseau prolongée (le cas visé ici), le rafraîchissement en
// arrière-plan d'autoRefreshToken peut manquer son créneau (timer suspendu par
// le navigateur pendant que l'onglet/app est en veille). La première requête
// faite au retour en ligne peut alors essuyer un 401 avec un access token déjà
// expiré, alors même que le refresh token, lui, est toujours valide. Sans ce
// correctif, chaque appel .from()/.rpc() de l'app gérait ça au cas par cas (ou
// pas du tout — seules les pages admin passaient par callRpcWithRetry). Ici,
// c'est centralisé une fois pour toutes au niveau transport : un seul rafraî-
// chissement partagé (jamais deux en parallèle) et un seul rejeu, pour TOUTE
// requête REST/RPC de l'app. La déconnexion ne se déclenche que si ce
// rafraîchissement échoue réellement (refresh token invalide/révoqué) — dans
// ce cas onAuthStateChange('SIGNED_OUT') prend le relais normalement.
async function fetchWithAuthRetry(input: RequestInfo | URL, init?: RequestInit, isRetry = false): Promise<Response> {
  const response = await fetch(input, init);

  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const isAuthEndpoint = url.includes('/auth/v1/');

  if (response.status !== 401 || isAuthEndpoint || isRetry) {
    return response;
  }

  if (!refreshInFlight) {
    refreshInFlight = supabase.auth.refreshSession()
      .then(({ data, error }) => (error ? null : data.session?.access_token ?? null))
      .finally(() => { refreshInFlight = null; });
  }
  const newAccessToken = await refreshInFlight;

  if (!newAccessToken) {
    return response; // refresh token lui-même invalide : on laisse le 401 remonter tel quel
  }

  const retryHeaders = new Headers(init?.headers);
  retryHeaders.set('Authorization', `Bearer ${newAccessToken}`);
  return fetchWithAuthRetry(input, { ...init, headers: retryHeaders }, true);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'boutikos-session',
  },
  global: {
    fetch: fetchWithAuthRetry,
  },
});
