-- Migration 0060 : Modération des utilisateurs (Caissier/Gérant)
-- Étend profils.status (existant depuis 0031) avec blocked/banned/deleted,
-- ajoute une traçabilité générique du changement de statut, un helper
-- get_my_status() sur le modèle de get_my_role(), des policies RESTRICTIVE
-- qui coupent réellement l'accès aux données métier pour tout statut non
-- actif, et les RPCs moderate_user / reactivate_user / lift_ban_user.
--
-- L'anonymisation complète du compte (action "supprimé", qui doit aussi
-- changer l'email dans auth.users) est faite séparément par l'Edge Function
-- delete-user-account (nécessite la service role key, indisponible en SQL
-- pur) — cette migration prépare uniquement les colonnes qu'elle utilisera.

BEGIN;

-- ══════════════════════════════════════════════════════════════
-- 1. Étendre profils.status : ajoute blocked/banned/deleted
--    (pending/active/rejected/suspended existaient déjà depuis 0031 ;
--    'suspended' n'était jamais utilisé en pratique, on l'active enfin)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.profils DROP CONSTRAINT IF EXISTS profils_status_check;
ALTER TABLE public.profils ADD CONSTRAINT profils_status_check
  CHECK (status IN ('pending','active','rejected','suspended','blocked','banned','deleted'));

-- ══════════════════════════════════════════════════════════════
-- 2. Traçabilité générique du changement de statut
--    (rejected_at/rejected_reason existants restent inchangés pour
--    approve_user/reject_user — ces colonnes couvrent toutes les
--    transitions, y compris la réactivation)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.profils
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_profils_status_changed_at ON public.profils(status_changed_at DESC);

-- ══════════════════════════════════════════════════════════════
-- 3. get_my_status() — même modèle que get_my_role()/get_my_boutique_id()
--    (0025_restore_rls_helpers_and_set_admin.sql). Le JWT ne portant aucun
--    claim fiable dans ce projet (cf. 0057), toute policy basée sur ce
--    helper relit profils à chaque requête : l'effet est immédiat dès la
--    modération, sans avoir besoin d'invalider le token de l'utilisateur.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_my_status()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  user_status text;
BEGIN
  SELECT status INTO user_status FROM public.profils WHERE id = auth.uid();
  RETURN user_status;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 4. RESTRICTIVE : coupe l'accès aux données métier pour tout statut
--    différent de 'active' (pending/rejected/suspended/blocked/banned/
--    deleted), sauf super_admin. Coexiste avec block_suspended_* (0057)
--    qui teste le statut de la BOUTIQUE — ici on teste le statut de
--    l'UTILISATEUR appelant ; plusieurs RESTRICTIVE sur une même commande
--    sont combinées en AND par Postgres, donc les deux gates s'appliquent
--    indépendamment sans se substituer l'une à l'autre.
--    Défense en profondeur : le blocage réel au login se fait côté client
--    (AuthProvider signOut immédiat) — ces policies garantissent qu'un
--    appel API direct avec un token encore valide échoue quand même.
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "block_non_active_users_produits" ON public.produits;
CREATE POLICY "block_non_active_users_produits" ON public.produits
  AS RESTRICTIVE FOR ALL USING (
    public.get_my_status() = 'active' OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "block_non_active_users_ventes" ON public.ventes;
CREATE POLICY "block_non_active_users_ventes" ON public.ventes
  AS RESTRICTIVE FOR ALL USING (
    public.get_my_status() = 'active' OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "block_non_active_users_vente_items" ON public.vente_items;
CREATE POLICY "block_non_active_users_vente_items" ON public.vente_items
  AS RESTRICTIVE FOR ALL USING (
    public.get_my_status() = 'active' OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "block_non_active_users_ardoises" ON public.ardoises;
CREATE POLICY "block_non_active_users_ardoises" ON public.ardoises
  AS RESTRICTIVE FOR ALL USING (
    public.get_my_status() = 'active' OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "block_non_active_users_ardoise_paiements" ON public.ardoise_paiements;
CREATE POLICY "block_non_active_users_ardoise_paiements" ON public.ardoise_paiements
  AS RESTRICTIVE FOR ALL USING (
    public.get_my_status() = 'active' OR public.get_my_role() = 'super_admin'
  );

-- profils : SELECT reste ouvert sur sa propre ligne quel que soit le statut
-- (le client a besoin de lire son propre statut pour se déconnecter avec un
-- message clair) — seuls UPDATE/INSERT/DELETE sont verrouillés pour un
-- compte non actif. Un mod même moderé garde donc juste la lecture.
DROP POLICY IF EXISTS "block_non_active_users_profils_update" ON public.profils;
CREATE POLICY "block_non_active_users_profils_update" ON public.profils
  AS RESTRICTIVE FOR UPDATE USING (
    public.get_my_status() = 'active' OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "block_non_active_users_profils_insert" ON public.profils;
CREATE POLICY "block_non_active_users_profils_insert" ON public.profils
  AS RESTRICTIVE FOR INSERT WITH CHECK (
    public.get_my_status() = 'active' OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "block_non_active_users_profils_delete" ON public.profils;
CREATE POLICY "block_non_active_users_profils_delete" ON public.profils
  AS RESTRICTIVE FOR DELETE USING (
    public.get_my_status() = 'active' OR public.get_my_role() = 'super_admin'
  );

-- ══════════════════════════════════════════════════════════════
-- 5. moderate_user(user_id, new_status, reason)
--    Suspendre / bloquer / bannir un compte. super_admin uniquement.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.moderate_user(
  p_user_id    UUID,
  p_new_status TEXT,
  p_reason     TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target_role TEXT;
  v_previous    TEXT;
BEGIN
  PERFORM public._assert_super_admin();

  IF p_new_status NOT IN ('suspended','blocked','banned') THEN
    RAISE EXCEPTION 'Statut invalide. Valeurs acceptées : suspended, blocked, banned';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas modifier votre propre statut.';
  END IF;

  SELECT role, status INTO v_target_role, v_previous FROM profils WHERE id = p_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Utilisateur introuvable : %', p_user_id;
  END IF;

  IF v_target_role = 'super_admin' THEN
    RAISE EXCEPTION 'Impossible de modérer un compte Super Admin.';
  END IF;

  IF v_previous = 'deleted' THEN
    RAISE EXCEPTION 'Ce compte a été supprimé, son statut ne peut plus être modifié.';
  END IF;

  UPDATE profils
  SET status             = p_new_status,
      status_reason      = NULLIF(TRIM(COALESCE(p_reason, '')), ''),
      status_changed_at  = NOW(),
      status_changed_by  = auth.uid(),
      updated_at         = NOW()
  WHERE id = p_user_id;

  INSERT INTO sys_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'user.' || p_new_status, 'user', p_user_id,
    jsonb_build_object('reason', p_reason, 'previous_status', v_previous));

  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    p_user_id,
    'account_' || p_new_status,
    CASE p_new_status
      WHEN 'suspended' THEN 'Compte suspendu'
      WHEN 'blocked'   THEN 'Compte bloqué'
      ELSE 'Compte banni'
    END,
    COALESCE(
      'Votre compte a été ' ||
        CASE p_new_status WHEN 'suspended' THEN 'suspendu' WHEN 'blocked' THEN 'bloqué' ELSE 'banni' END ||
        '. Raison : ' || p_reason,
      'Votre compte a été ' ||
        CASE p_new_status WHEN 'suspended' THEN 'suspendu' WHEN 'blocked' THEN 'bloqué' ELSE 'banni' END ||
        '. Contactez le support pour plus d''informations.'
    )
  );

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'status', p_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_user(UUID, TEXT, TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 6. reactivate_user(user_id, reason)
--    Lève une suspension/blocage. Refuse explicitement pour banned/deleted
--    (task : un bannissement exige une action manuelle DISTINCTE).
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reactivate_user(
  p_user_id UUID,
  p_reason  TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_previous TEXT;
BEGIN
  PERFORM public._assert_super_admin();

  SELECT status INTO v_previous FROM profils WHERE id = p_user_id;

  IF v_previous IS NULL THEN
    RAISE EXCEPTION 'Utilisateur introuvable : %', p_user_id;
  END IF;

  IF v_previous = 'banned' THEN
    RAISE EXCEPTION 'Ce compte est banni — utilisez lift_ban_user() pour lever un bannissement explicitement.';
  END IF;

  IF v_previous = 'deleted' THEN
    RAISE EXCEPTION 'Ce compte a été supprimé, il ne peut pas être réactivé.';
  END IF;

  IF v_previous NOT IN ('suspended','blocked') THEN
    RAISE EXCEPTION 'Ce compte n''est ni suspendu ni bloqué (statut actuel : %).', v_previous;
  END IF;

  UPDATE profils
  SET status             = 'active',
      status_reason      = NULLIF(TRIM(COALESCE(p_reason, '')), ''),
      status_changed_at  = NOW(),
      status_changed_by  = auth.uid(),
      updated_at         = NOW()
  WHERE id = p_user_id;

  INSERT INTO sys_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'user.reactivated', 'user', p_user_id,
    jsonb_build_object('reason', p_reason, 'previous_status', v_previous));

  INSERT INTO notifications (user_id, type, title, message)
  VALUES (p_user_id, 'account_reactivated', 'Compte réactivé',
    'Votre compte Sama Boutik a été réactivé. Vous pouvez de nouveau vous connecter.');

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reactivate_user(UUID, TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 7. lift_ban_user(user_id, reason)
--    Seule voie pour réactiver un compte banni — action manuelle distincte.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.lift_ban_user(
  p_user_id UUID,
  p_reason  TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_previous TEXT;
BEGIN
  PERFORM public._assert_super_admin();

  SELECT status INTO v_previous FROM profils WHERE id = p_user_id;

  IF v_previous IS NULL THEN
    RAISE EXCEPTION 'Utilisateur introuvable : %', p_user_id;
  END IF;

  IF v_previous != 'banned' THEN
    RAISE EXCEPTION 'Ce compte n''est pas banni (statut actuel : %).', v_previous;
  END IF;

  UPDATE profils
  SET status             = 'active',
      status_reason      = NULLIF(TRIM(COALESCE(p_reason, '')), ''),
      status_changed_at  = NOW(),
      status_changed_by  = auth.uid(),
      updated_at         = NOW()
  WHERE id = p_user_id;

  INSERT INTO sys_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'user.ban_lifted', 'user', p_user_id, jsonb_build_object('reason', p_reason));

  INSERT INTO notifications (user_id, type, title, message)
  VALUES (p_user_id, 'account_ban_lifted', 'Bannissement levé',
    'Votre bannissement a été levé. Vous pouvez de nouveau vous connecter.');

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.lift_ban_user(UUID, TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 8. get_users_list_masked() : ajout additif de status_reason/
--    status_changed_at, sans toucher au masquage ni au filtrage existant
--    (WHERE p.deleted_at IS NULL inchangé — un compte 'deleted' est
--    anonymisé par l'Edge Function qui pose aussi deleted_at, donc il
--    sort naturellement de cette liste, cohérent avec le comportement
--    déjà en place pour les autres soft-delete du dashboard).
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
          'email_masque',       mask_email(u.email),
          'phone_masque',       CASE
                                   WHEN p.phone_number IS NULL THEN NULL
                                   ELSE
                                     SUBSTRING(REGEXP_REPLACE(p.phone_number, '^\+?221', ''), 1, 2)
                                     || '****'
                                     || RIGHT(p.phone_number, 2)
                                 END,
          'role',               p.role,
          'status',             p.status,
          'status_reason',      p.status_reason,
          'status_changed_at',  p.status_changed_at,
          'boutique_id',        p.boutique_id,
          'boutique_nom',       b.nom,
          'created_at',         p.created_at
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

NOTIFY pgrst, 'reload schema';

COMMIT;
