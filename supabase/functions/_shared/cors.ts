// Origines autorisées à appeler les Edge Functions depuis un navigateur.
// Ajouter ici tout nouveau domaine personnalisé (ex: 'https://samaboutik.com') le jour où il est branché sur Vercel.
const ALLOWED_ORIGINS = [
  'https://boutique-os-seven.vercel.app',
  'https://boutique-os-elhadjsyllas-projects.vercel.app',
  'https://boutique-os-git-main-elhadjsyllas-projects.vercel.app',
  'http://localhost:2000', // port configuré dans vite.config.ts
  'http://localhost:5173', // port par défaut de Vite, au cas où
];

// Les déploiements de preview Vercel ont une URL générée par déploiement
// (https://boutique-os-<hash>-elhadjsyllas-projects.vercel.app) — on les matche par motif.
const PREVIEW_ORIGIN_PATTERN = /^https:\/\/boutique-os-[a-z0-9-]+-elhadjsyllas-projects\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN_PATTERN.test(origin);
}

/** Construit les headers CORS pour une requête donnée, en n'autorisant que les origines connues. */
export function buildCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
  // Si l'origine n'est pas reconnue, on n'envoie aucun Access-Control-Allow-Origin :
  // le navigateur bloquera la lecture de la réponse, ce qui est le comportement voulu.
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}
