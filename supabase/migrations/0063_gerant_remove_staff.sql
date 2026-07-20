-- Migration 0063 : Retrait d'un Caissier de l'équipe par le Gérant
--
-- Architecture confirmée par exploration : un compte n'appartient qu'à UNE
-- SEULE boutique (profils.boutique_id, colonne simple, jamais de table de
-- liaison many-to-many). "Retirer de l'équipe" = couper boutique_id, pas de
-- nuance "cette boutique précise vs les autres" à gérer.
--
-- Volontairement séparé du système de modération plateforme (profils.status,
-- migration 0060, moderate_user/reactivate_user/lift_ban_user réservés au
-- Super Admin) : un retrait d'équipe est une action de gestion RH ordinaire
-- du Gérant sur SA boutique, pas une modération de compte. Réutiliser status
-- aurait couplé les deux portées sur le même champ — boutique_id=NULL laisse
-- status intact (le compte reste 'active' au sens plateforme) et permet une
-- réintégration future dans N'IMPORTE QUELLE boutique sans intervention
-- Super Admin, exactement comme le prévoit la contrainte de la demande.
--
-- Note découverte en cours d'exploration, hors périmètre de cette migration :
-- la policy UPDATE existante sur profils (0022_fix_rls_update.sql) permet
-- déjà à un Gérant de modifier `status` d'un caissier de sa boutique en RLS
-- direct (le trigger anti-escalade ne protège que role/boutique_id, pas
-- status) — un gérant malveillant pourrait donc aujourd'hui bannir/suspendre
-- un caissier en contournant complètement moderate_user() et sys_audit_log.
-- Pas corrigé ici (hors demande), à traiter séparément si besoin.

BEGIN;

-- ── 1. Table d'historique des retraits d'équipe, consultable par le Gérant ──
CREATE TABLE IF NOT EXISTS public.team_activity_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id UUID        NOT NULL REFERENCES public.boutiques(id) ON DELETE CASCADE,
  actor_id    UUID        NOT NULL REFERENCES auth.users(id),
  target_id   UUID        NOT NULL REFERENCES auth.users(id),
  action      TEXT        NOT NULL CHECK (action IN ('removed')),
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.team_activity_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_team_activity_log_boutique
  ON public.team_activity_log(boutique_id, created_at DESC);

-- Lecture : le Gérant de la boutique concernée (ou super_admin) uniquement.
CREATE POLICY "gerant_read_team_activity_log"
  ON public.team_activity_log FOR SELECT
  USING (
    (public.get_my_role() = 'gerant' AND boutique_id = public.get_my_boutique_id())
    OR public.get_my_role() = 'super_admin'
  );

-- Écriture : uniquement via la RPC SECURITY DEFINER ci-dessous (bypass RLS).
CREATE POLICY "no_direct_insert_team_activity_log"
  ON public.team_activity_log FOR INSERT
  WITH CHECK (false);

-- ── 2. gerant_remove_staff(target_user_id, reason) ──────────────────────────
-- Réservée au rôle gerant (le Super Admin dispose déjà d'assign_staff pour
-- un besoin équivalent plus large, cf. AdminUsers.tsx). Ne touche jamais
-- ventes/vente_items/ardoises : caissier_id n'est référencé nulle part par
-- profils.boutique_id, l'historique du caissier retiré reste intact et lui
-- reste attribué.
CREATE OR REPLACE FUNCTION public.gerant_remove_staff(
  p_target_user_id UUID,
  p_reason         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_boutique UUID;
  v_target_role     TEXT;
  v_target_boutique UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF get_my_role() != 'gerant' THEN
    RAISE EXCEPTION 'Seul un Gérant peut retirer un membre de son équipe' USING HINT = '403';
  END IF;

  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas vous retirer vous-même de l''équipe.';
  END IF;

  v_caller_boutique := get_my_boutique_id();

  SELECT role, boutique_id INTO v_target_role, v_target_boutique
  FROM profils WHERE id = p_target_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Utilisateur introuvable : %', p_target_user_id;
  END IF;

  IF v_target_boutique IS DISTINCT FROM v_caller_boutique THEN
    RAISE EXCEPTION 'Ce membre n''appartient pas à votre boutique.';
  END IF;

  IF v_target_role != 'caissier' THEN
    RAISE EXCEPTION 'Seuls les comptes Caissier peuvent être retirés de l''équipe.';
  END IF;

  UPDATE profils
  SET boutique_id = NULL, updated_at = NOW()
  WHERE id = p_target_user_id;

  INSERT INTO team_activity_log (boutique_id, actor_id, target_id, action, reason)
  VALUES (v_caller_boutique, auth.uid(), p_target_user_id, 'removed', NULLIF(TRIM(COALESCE(p_reason, '')), ''));

  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    p_target_user_id,
    'team_removed',
    'Retiré de l''équipe',
    'Vous avez été retiré de l''équipe de votre boutique sur Sama Boutik. Contactez votre gérant si vous pensez qu''il s''agit d''une erreur.'
  );

  RETURN jsonb_build_object('success', true, 'target_user_id', p_target_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gerant_remove_staff(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.gerant_remove_staff(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
