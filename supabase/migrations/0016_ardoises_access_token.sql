-- ============================================================
-- Portal client : accès anonyme aux ardoises via token sécurisé
-- Ajoute access_token (UUID) sur ardoises + RPC pour le portail
-- client sans authentification marchande.
-- ============================================================

-- 1. Colonne access_token sur ardoises
-- Les lignes existantes reçoivent un UUID unique généré automatiquement.
ALTER TABLE public.ardoises
  ADD COLUMN IF NOT EXISTS access_token UUID NOT NULL DEFAULT gen_random_uuid();

-- Index unique : lookup rapide + protection contre les collisions
CREATE UNIQUE INDEX IF NOT EXISTS idx_ardoises_access_token
  ON public.ardoises(access_token);

-- 2. RPC pour le portail client anonyme
-- Retourne l'ardoise + ses paiements pour un token donné.
-- SECURITY DEFINER : s'exécute en tant que owner, bypass RLS.
-- search_path explicite pour éviter les injection via search_path.
CREATE OR REPLACE FUNCTION public.get_ardoise_by_token(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'ardoise',   row_to_json(a.*),
    'paiements', COALESCE(
      (SELECT json_agg(p ORDER BY p.paid_at DESC)
       FROM public.ardoise_paiements p
       WHERE p.ardoise_id = a.id),
      '[]'::json
    )
  )
  INTO v_result
  FROM public.ardoises a
  WHERE a.access_token = p_token;

  -- Retourne NULL si token inconnu (le frontend gère le cas "introuvable")
  RETURN v_result;
END;
$$;

-- Accessible sans authentification (appel depuis le portail client via anon key)
GRANT EXECUTE ON FUNCTION public.get_ardoise_by_token(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_ardoise_by_token(UUID) TO authenticated;
