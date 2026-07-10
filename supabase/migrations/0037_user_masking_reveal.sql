-- Migration 0037 : Masquage données utilisateurs + audit de révélation
-- Objectif :
--   1. Fonctions réutilisables mask_email() et mask_name()
--   2. RPC get_users_list_masked() — email + nom masqués dès le SQL
--   3. Table user_reveal_logs — trace chaque demande de révélation
--   4. RPC reveal_user_details() — données en clair, super_admin only, tracé

BEGIN;

-- ══════════════════════════════════════════════════════════════
-- 1. FONCTIONS DE MASQUAGE (IMMUTABLE, réutilisables)
-- ══════════════════════════════════════════════════════════════

-- mask_email : "elhadjsylla667@gmail.com" → "el****@gmail.com"
CREATE OR REPLACE FUNCTION public.mask_email(p_email TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT SET search_path = public AS $$
  SELECT
    SUBSTRING(p_email, 1, 2)
    || '****@'
    || SUBSTRING(p_email, POSITION('@' IN p_email) + 1)
$$;

-- mask_name : "Aïcha Diallo" → "Aïcha D***"  |  "Moussa" → "Mou***"
-- Attend un nom complet (prénom nom ou nom seul).
CREATE OR REPLACE FUNCTION public.mask_name(p_name TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_parts TEXT[];
  v_first TEXT;
  v_rest  TEXT;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RETURN 'N/A';
  END IF;

  v_parts := regexp_split_to_array(btrim(p_name), '\s+');

  IF array_length(v_parts, 1) = 1 THEN
    -- Un seul mot : prend les 3 premières lettres + ***
    v_first := v_parts[1];
    RETURN SUBSTRING(v_first, 1, LEAST(3, length(v_first))) || '***';
  ELSE
    -- Plusieurs mots : prénom + 1ère lettre du suivant + ***
    v_first := v_parts[1];
    v_rest  := v_parts[2];
    RETURN v_first || ' ' || SUBSTRING(v_rest, 1, 1) || '***';
  END IF;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 2. Mise à jour de get_users_pending_validation
--    pour utiliser mask_email() au lieu du masquage inline
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_users_pending_validation()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  PERFORM _assert_super_admin();

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',                p.id,
          'nom',               COALESCE(p.nom, split_part(u.email, '@', 1)),
          'prenom',            COALESCE(p.prenom, ''),
          'email_masque',      mask_email(u.email),
          'telephone_masque',
            CASE
              WHEN p.phone_number IS NULL THEN NULL
              ELSE
                SUBSTRING(REGEXP_REPLACE(p.phone_number, '^\+?221', ''), 1, 2)
                || '****'
                || RIGHT(p.phone_number, 2)
            END,
          'created_at',        p.created_at,
          'role_demande',      p.role,
          'boutique_nom',      b.nom
        )
        ORDER BY p.created_at ASC
      )
      FROM profils p
      JOIN auth.users u ON u.id = p.id
      LEFT JOIN boutiques b ON b.id = p.boutique_id
      WHERE p.status = 'pending'
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_pending_validation() TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 3. RPC get_users_list_masked()
--    Remplace sys_list_users() avec données sensibles masquées en SQL.
--    Le client ne reçoit JAMAIS email ou nom en clair depuis cet endpoint.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_users_list_masked()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  PERFORM _assert_super_admin();

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',           p.id,
          -- Nom masqué : "Aïcha D***" ou fallback sur le début de l'email
          'nom_masque',   mask_name(
                            COALESCE(
                              NULLIF(
                                COALESCE(p.prenom, '') ||
                                CASE WHEN p.prenom IS NOT NULL AND p.nom IS NOT NULL THEN ' ' || p.nom
                                     WHEN p.nom IS NOT NULL THEN p.nom
                                     ELSE ''
                                END,
                                ''
                              ),
                              split_part(u.email, '@', 1)
                            )
                          ),
          'email_masque', mask_email(u.email),
          'phone_masque', CASE
                            WHEN p.phone_number IS NULL THEN NULL
                            ELSE
                              SUBSTRING(REGEXP_REPLACE(p.phone_number, '^\+?221', ''), 1, 2)
                              || '****'
                              || RIGHT(p.phone_number, 2)
                          END,
          'role',         p.role,
          'status',       p.status,
          'boutique_id',  p.boutique_id,
          'boutique_nom', b.nom,
          'created_at',   p.created_at
        )
        ORDER BY p.created_at DESC
      )
      FROM profils p
      JOIN auth.users u ON u.id = p.id
      LEFT JOIN boutiques b ON b.id = p.boutique_id
      WHERE p.deleted_at IS NULL
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_list_masked() TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 4. TABLE user_reveal_logs
--    Trace chaque accès super_admin aux données sensibles en clair.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_reveal_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        UUID        NOT NULL REFERENCES auth.users(id),
  target_user_id  UUID        NOT NULL REFERENCES auth.users(id),
  revealed_fields TEXT[]      NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_reveal_logs ENABLE ROW LEVEL SECURITY;

-- Seuls les super_admin peuvent lire les logs
DROP POLICY IF EXISTS "super_admin_read_reveal_logs" ON public.user_reveal_logs;
CREATE POLICY "super_admin_read_reveal_logs"
  ON public.user_reveal_logs FOR SELECT
  USING ((SELECT role FROM public.profils WHERE id = auth.uid()) = 'super_admin');

-- Les inserts passent par la RPC SECURITY DEFINER (bypass RLS implicite),
-- cette policy protège l'accès direct à la table.
DROP POLICY IF EXISTS "no_direct_insert_reveal_logs" ON public.user_reveal_logs;
CREATE POLICY "no_direct_insert_reveal_logs"
  ON public.user_reveal_logs FOR INSERT
  WITH CHECK (false);

-- Index pour les requêtes d'audit par admin et par cible
CREATE INDEX IF NOT EXISTS idx_reveal_logs_admin
  ON public.user_reveal_logs(admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reveal_logs_target
  ON public.user_reveal_logs(target_user_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- 5. RPC reveal_user_details(p_user_id)
--    Retourne nom + email + téléphone en clair.
--    Réservée super_admin. Trace l'accès dans user_reveal_logs.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reveal_user_details(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM _assert_super_admin();

  SELECT jsonb_build_object(
    'id',           p.id,
    'nom',          COALESCE(p.nom, ''),
    'prenom',       COALESCE(p.prenom, ''),
    'email',        u.email,
    'phone_number', COALESCE(p.phone_number, '')
  )
  INTO v_result
  FROM profils p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = p_user_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Utilisateur introuvable : %', p_user_id;
  END IF;

  -- Log de l'accès aux données sensibles (SECURITY DEFINER bypass RLS)
  INSERT INTO user_reveal_logs (admin_id, target_user_id, revealed_fields)
  VALUES (auth.uid(), p_user_id, ARRAY['nom', 'prenom', 'email', 'phone_number']);

  -- Trace aussi dans sys_audit_log pour cohérence avec les autres actions admin
  INSERT INTO sys_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'user.details_revealed',
    'user',
    p_user_id,
    jsonb_build_object('fields', ARRAY['nom', 'prenom', 'email', 'phone_number'])
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reveal_user_details(UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- TESTS DE VALIDATION (à exécuter manuellement après migration)
-- ══════════════════════════════════════════════════════════════
--
-- # Test mask_name
-- SELECT mask_name('Aïcha Diallo');     -- → 'Aïcha D***'
-- SELECT mask_name('Moussa');           -- → 'Mou***'
-- SELECT mask_name('Jean-Pierre Ndiaye'); -- → 'Jean-Pierre N***'
-- SELECT mask_name(NULL);              -- → 'N/A'
-- SELECT mask_name('');                -- → 'N/A'
--
-- # Test mask_email
-- SELECT mask_email('elhadjsylla667@gmail.com'); -- → 'el****@gmail.com'
--
-- # Test get_users_list_masked (super_admin)
-- SELECT get_users_list_masked();  -- doit retourner les users avec champs masqués
--
-- # Test get_users_list_masked (non admin) — doit lever une exception 403
-- -- Connecté en tant que compte caissier :
-- SELECT get_users_list_masked();  -- doit retourner 'Accès refusé — super_admin requis'
--
-- # Test reveal_user_details
-- SELECT reveal_user_details('<uuid-utilisateur>');  -- retourne nom/email en clair
-- SELECT * FROM user_reveal_logs ORDER BY created_at DESC LIMIT 5; -- vérifie le log

NOTIFY pgrst, 'reload schema';

COMMIT;
